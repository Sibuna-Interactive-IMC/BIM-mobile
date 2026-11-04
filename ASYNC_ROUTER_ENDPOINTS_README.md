# Async Router Operations - UX/UI Implementation Guide

## Overview

Router operations (fetching active sessions, user lists, IP bindings, etc.) can take 10-60 seconds to complete. Instead of blocking the user with timeouts, we use an **asynchronous queue system with progressive results**.

This guide shows you how to implement excellent UX with loading states, progress indicators, and incremental rendering.

---

## How It Works

### 1. Initial Request (202 Queued)

When you request router data, the backend may queue the operation and respond immediately with `202 Accepted`:

```http
POST /routers/{id}/hotspots/active
Response: 202 Accepted
```

API 2.0 wraps every JSON response in a common envelope and reports queue
lifecycle in `operation`:

```json
{
  "success": true,
  "message": "Operation queued, use the cache key to poll for results",
  "data": {
    "status": "queued",
    "cache_key": "router_123_active_sessions_abc123",
    "retry_after": 2,
    "router": { "id": 123, "name": "Main Router" }
  },
  "operation": {
    "state": "queued",
    "cache_key": "router_123_active_sessions_abc123",
    "retry_after": 2
  }
}
```

Read the cache key from `operation.cache_key` (fall back to `data.cache_key`
for older builds) — see `getOperationCacheKey()` in `helpers/apiResponse.ts`.

### 2. Poll for Results

Use the `cache_key` to poll the results endpoint:

```http
POST /api/router-operations/poll
{ "cache_key": "router_123_active_sessions_abc123" }
```

**While processing (202):**
```json
{
  "success": true,
  "message": "Operation still processing",
  "data": [
    { "user": "john@example.com", "address": "10.0.0.5", "uptime": "01:23:45" }
  ],
  "operation": {
    "state": "processing",
    "progress": { "pages_total": 5, "pages_ready": 2 },
    "page_number": 1,
    "started_at": "2025-12-21T10:30:00Z",
    "updated_at": "2025-12-21T10:30:05Z"
  }
}
```

### 3. Complete Results

When `operation.state` becomes `"done"` the full payload is in `data`:

```json
{
  "success": true,
  "message": "Operation finished",
  "data": {
    "active": [ /* all 250 rows */ ],
    "total": 250
  },
  "operation": {
    "state": "done",
    "duration": { "seconds": 12, "human": "12s", "in_progress": false }
  }
}
```

`operation.state` of `error` or `cancelled` is terminal; surface
`errors.error`/`message` to the user. The mobile client implements this in
`pollQueuedOperation()` (`helpers/api.ts`).

---

## Frontend Implementation

### Using RouterOperationPoller (Recommended)

The `RouterOperationPoller` class handles all polling logic, adaptive backoff, and progressive page fetching:

```javascript
// Include the poller script
<script src="{{ asset('js/router-operation-poller.js') }}"></script>

// Initialize with callbacks
const poller = new RouterOperationPoller({
  cacheKey: response.operation.cache_key, // or response.data.cache_key
  pollInterval: 1500,        // Start polling every 1.5s
  maxAttempts: 90,           // Poll for up to 3 minutes
  
  // Called when status changes
  onProgress: (status, progress) => {
    if (progress && progress.pages_ready && progress.pages_total) {
      const percent = Math.round((progress.pages_ready / progress.pages_total) * 100);
      updateMessage(`Loading... ${percent}% (${progress.pages_ready}/${progress.pages_total} pages)`);
    } else {
      updateMessage(status === 'queued' ? 'Queued...' : 'Processing...');
    }
  },
  
  // Called when each page is ready (RECOMMENDED for large datasets)
  onPageReady: (page, pageNum, progress) => {
    // Render incrementally
    if (pageNum === 1) {
      renderRows(page);  // First page replaces
    } else {
      appendRows(page);  // Subsequent pages append
    }
    
    // Update count badge
    const currentCount = document.querySelectorAll('tbody tr').length;
    updateCountBadge(currentCount);
  },
  
  // Called when all data is ready
  onSuccess: (payload) => {
    hideLoading();
    // Fallback for non-paginated responses
    if (payload.data && !pollerReceivedPages) {
      renderRows(payload.data.active || payload.data.users || []);
    }
  },
  
  // Called on error
  onError: (error) => {
    hideLoading();
    showError('Failed to load data: ' + error);
  },
  
  // Called on timeout (3 minutes elapsed)
  onTimeout: () => {
    hideLoading();
    showWarning('Request timed out. Data may be partially loaded.');
  }
});

poller.start();
```

### Progressive Rendering Pattern

**Key principle:** Show the first 50 rows within 2-5 seconds, then append more as they arrive.

```javascript
function renderRows(rows) {
  const tbody = document.querySelector('#myTable tbody');
  tbody.innerHTML = ''; // Clear table
  rows.forEach(row => {
    const tr = createRowElement(row);
    tbody.appendChild(tr);
  });
  bindEventHandlers(tbody);
}

function appendRows(rows) {
  const tbody = document.querySelector('#myTable tbody');
  rows.forEach(row => {
    const tr = createRowElement(row);
    tbody.appendChild(tr);
  });
  bindEventHandlers(tbody);
}
```

---

## UX Best Practices

### ✅ DO: Show Loading State Immediately

```javascript
if (response.status === 202 && response.cache_key) {
  showLoadingOverlay('Fetching data from router...');
  startPolling(response.cache_key);
}
```

### ✅ DO: Show Progress Percentage

```javascript
onProgress: (status, progress) => {
  if (progress) {
    const percent = Math.round((progress.pages_ready / progress.pages_total) * 100);
    updateMessage(`Loading... ${percent}%`);
  }
}
```

### ✅ DO: Render Incrementally for Large Datasets

```javascript
onPageReady: (page, pageNum, progress) => {
  // User sees first 50 rows immediately
  pageNum === 1 ? renderRows(page) : appendRows(page);
}
```

### ✅ DO: Handle Errors Gracefully

```javascript
onError: (error) => {
  showError('Failed to load data. Please try again.');
  console.error('Router operation failed:', error);
}
```

### ✅ DO: Set Realistic Timeouts

```javascript
maxAttempts: 90  // 90 attempts × 2s = 3 minutes
```

### ❌ DON'T: Show "Failed" Before Trying

```javascript
// BAD: Shows error as initial state
<p>Failed to load data.</p>

// GOOD: Shows loading state initially
<p><i class="fa fa-spinner fa-spin"></i> Loading...</p>
```

### ❌ DON'T: Wait for All Data Before Showing Anything

```javascript
// BAD: User waits 30s for 500 rows
onSuccess: (payload) => {
  renderRows(payload.data.active); // Waits for everything
}

// GOOD: User sees 50 rows after 3s
onPageReady: (page, pageNum) => {
  pageNum === 1 ? renderRows(page) : appendRows(page);
}
```

### ❌ DON'T: Block UI Without Progress Indicator

```javascript
// BAD: Blank screen with spinner
<div class="loading">Loading...</div>

// GOOD: Progress percentage
<div class="loading">Loading... 60% (3/5 pages)</div>
```

---

## API Reference

### POST /routers/{id}/hotspots/active

Fetch active sessions. May return immediately (200) or queue (202).

**Response (200 - Cached):**
```json
{
  "active": [ /* rows */ ],
  "active_meta": { "total": 250 }
}
```

**Response (202 - Queued):**
```json
{
  "status": "queued",
  "cache_key": "router_123_active_sessions_abc",
  "message": "Operation queued"
}
```

### GET /api/router-operations/poll

Poll for queued operation results.

**Query Parameters:**
- `cache_key` (required): The key from 202 response
- `page` (optional): Request specific page number (1-indexed)

**Response (Processing):**
```json
{
  "status": "processing",
  "progress": {
    "pages_total": 5,
    "pages_ready": 2
  },
  "meta": {
    "started_at": "2025-12-21T10:30:00Z"
  }
}
```

**Response (Done - No Page Parameter):**
```json
{
  "status": "done",
  "progress": {
    "pages_total": 5,
    "pages_ready": 5
  },
  "data": {
    "active": [ /* all rows */ ]
  }
}
```

**Response (Done - With Page Parameter):**
```json
{
  "status": "done",
  "progress": {
    "pages_total": 5,
    "pages_ready": 5
  },
  "page": [ /* 50 rows */ ]
}
```

**Response (Error):**
```json
{
  "status": "error",
  "error": "Router timeout: connection refused"
}
```

### GET /api/router-operations/status

Get comprehensive status dashboard for an operation. Useful for debugging and monitoring.

**Query Parameters:**
- `cache_key` (required): The key from 202 response

**Response:**
```json
{
  "cache_key": "router_123_active_sessions_abc",
  "status": "done",
  "progress": {
    "pages_total": 5,
    "pages_ready": 5
  },
  "timestamps": {
    "started_at": "2025-12-21T10:30:00Z",
    "updated_at": "2025-12-21T10:30:15Z",
    "finished_at": "2025-12-21T10:30:15Z"
  },
  "duration": {
    "seconds": 15,
    "human": "15 seconds"
  },
  "pages": {
    "total": 5,
    "ready": 5,
    "available": [1, 2, 3, 4, 5]
  },
  "result": {
    "has_data": true,
    "data_keys": ["active"],
    "row_counts": {
      "active": 250
    }
  },
  "cached": {
    "has_status": true,
    "has_meta": true,
    "has_result": true
  }
}
```

**Use Cases:**
- **Debugging**: Check if operation completed and how long it took
- **Monitoring**: See which pages are available
- **Analytics**: Get result counts and cache state
- **DevOps**: Verify operations in production

---

## RouterOperationPoller Options

```javascript
new RouterOperationPoller({
  cacheKey: string,              // Required: cache key from 202 response
  pollInterval: number,          // Optional: initial poll interval in ms (default: 2000)
  maxAttempts: number,           // Optional: max polling attempts (default: 90)
  backoffMultiplier: number,     // Optional: backoff multiplier (default: 1.2)
  maxInterval: number,           // Optional: max poll interval in ms (default: 5000)
  
  onProgress: (status, progress) => {},     // Called on status change
  onPageReady: (page, pageNum, progress) => {},  // Called when page arrives
  onSuccess: (payload) => {},    // Called when complete
  onError: (error) => {},        // Called on error
  onTimeout: () => {}            // Called after maxAttempts
})
```

---

## Page Size and Chunking

- **Page size:** 50 rows per page
- **Why:** Balance between responsiveness and API overhead
- **Large datasets:** 500 active sessions = 10 pages, first visible in ~3-5s

---

## Adaptive Polling Behavior

The poller uses **adaptive backoff** to reduce server load:

1. **Initial:** Poll every 1.5-2s
2. **After 5 attempts:** Increase interval by 1.2× each time
3. **Maximum:** Cap at 5s interval
4. **Timeout:** Stop after 90 attempts (~3 minutes)

This ensures fast updates initially, then backs off for long operations.

---

## Complete Example: Active Sessions Tab

```blade
<div id="active-sessions-card" class="card">
  <div class="card-header">
    <h3>Active Sessions <span id="activeCount" class="badge"></span></h3>
  </div>
  <div class="card-body">
    <table id="activeTable" class="table">
      <thead>
        <tr><th>User</th><th>Address</th><th>Uptime</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>
</div>

<script src="{{ asset('js/router-operation-poller.js') }}"></script>
<script>
let activePoller = null;

function loadActiveSessions(routerId) {
  fetch(`/routers/${routerId}/hotspots/active`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' }
  })
  .then(async r => {
    const body = await r.json();
    
    if (r.status === 202 && body.cache_key) {
      showLoading('Fetching active sessions...');
      
      activePoller = new RouterOperationPoller({
        cacheKey: body.cache_key,
        pollInterval: 1500,
        maxAttempts: 90,
        
        onProgress: (status, progress) => {
          if (progress?.pages_ready && progress?.pages_total) {
            const percent = Math.round((progress.pages_ready / progress.pages_total) * 100);
            updateLoadingMessage(`Loading... ${percent}% (${progress.pages_ready}/${progress.pages_total} pages)`);
          }
        },
        
        onPageReady: (page, pageNum) => {
          if (pageNum === 1) {
            renderRows(page);
          } else {
            appendRows(page);
          }
          updateCount(document.querySelectorAll('#activeTable tbody tr').length);
        },
        
        onSuccess: () => {
          hideLoading();
        },
        
        onError: (err) => {
          hideLoading();
          showError('Failed to load active sessions: ' + err);
        },
        
        onTimeout: () => {
          hideLoading();
          showWarning('Request timed out');
        }
      });
      
      activePoller.start();
    } else {
      // Cached result, render immediately
      renderRows(body.active || []);
      updateCount(body.active?.length || 0);
    }
  })
  .catch(err => {
    showError('Request failed: ' + err.message);
  });
}

function renderRows(rows) {
  const tbody = document.querySelector('#activeTable tbody');
  tbody.innerHTML = '';
  rows.forEach(row => {
    tbody.innerHTML += `<tr>
      <td>${row.user}</td>
      <td>${row.address}</td>
      <td>${row.uptime}</td>
    </tr>`;
  });
}

function appendRows(rows) {
  const tbody = document.querySelector('#activeTable tbody');
  rows.forEach(row => {
    tbody.innerHTML += `<tr>
      <td>${row.user}</td>
      <td>${row.address}</td>
      <td>${row.uptime}</td>
    </tr>`;
  });
}

function updateCount(count) {
  document.getElementById('activeCount').textContent = `(${count})`;
}

// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadActiveSessions(@json($router->id));
});
</script>
```

---

## Troubleshooting

### "Operation timed out" after 30 seconds

**Cause:** Queue worker timeout too low  
**Fix:** Ensure `--timeout=200` in queue worker config (docker-compose.yml, supervisor)

### Progress stuck at "Queued..." forever

**Cause:** Queue worker not running or job failed  
**Fix:** Check `php artisan queue:work` is running, check Laravel logs

### No progressive rendering, everything loads at once

**Cause:** Not using `onPageReady` callback  
**Fix:** Implement `onPageReady` instead of relying only on `onSuccess`

### "Failed to load" shown before any attempt

**Cause:** Initial HTML shows error state  
**Fix:** Change initial message to "Loading..." with spinner icon

### Multiple requests to same router get queued/delayed

**Cause:** Per-router concurrency lock prevents simultaneous operations on same router  
**Behavior:** This is intentional to protect routers from being overwhelmed  
**Note:** Jobs wait up to 10 seconds for lock, then re-queue with 5 second delay

---

## Performance & Limits

### Router Concurrency

The system enforces **one operation per router at a time** to prevent overwhelming routers:

- Lock duration: **3 minutes** (auto-releases on completion)
- Wait time: Jobs wait up to **10 seconds** to acquire lock
- Re-queue: If lock not acquired, job re-queues after **5 seconds**

**Why?** Multiple concurrent API calls to the same router can cause:
- Router API slowdowns
- Timeouts and failed requests
- Unreliable results

**Impact on UX:**
- First request: Executes immediately
- Concurrent requests: Queue behind first request
- User feedback: Show "Queued..." status until lock acquired

### Page Size

- **50 rows per page** - balances responsiveness with API overhead
- Large datasets (500+ rows) = 10+ pages
- First page typically arrives in **2-5 seconds**

### Polling Behavior

- Initial interval: **1.5-2 seconds**
- Adaptive backoff: Increases by **1.2×** after 5 attempts
- Maximum interval: **5 seconds**
- Timeout: **90 attempts** (~3 minutes total)

### Cache TTL

- Operation status: **15 minutes**
- Result pages: **15 minutes**
- Full results: **15 minutes**

**Note:** Cached results served instantly (no queue, no polling)

---

## Further Reading

- [Laravel Queue Documentation](https://laravel.com/docs/queues)
- [Router Operations Implementation Summary](ROUTER_OPERATIONS_IMPLEMENTATION_SUMMARY.md)
- [Async Router Operations Guide](ASYNC_ROUTER_OPERATIONS.md)
