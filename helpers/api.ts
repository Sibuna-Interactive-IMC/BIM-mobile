import { apiBaseUrl } from '@/constants/API';
import { ShowAlert } from '@/helpers';
import {
	getApiData,
	getApiMessage,
	getOperationState,
} from '@/helpers/apiResponse';

/**
 * Lightweight fetch wrapper that injects the X-Client-Type header for backend API calls.
 * It will add the header only when the request target appears to be the configured apiBaseUrl.
 */
/**
 * Callbacks for handling auth lifecycle events from the API layer.
 * These are injected from the app context (GeneralContext) to avoid circular dependencies.
 */
export interface AuthCallbacks {
	onRefreshToken: () => Promise<string | null>;
	onLogout: () => void;
}

let authCallbacks: AuthCallbacks | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

// Prevent cascading refreshes: after a successful refresh, block
// subsequent refresh attempts for a short cooldown period so that
// in-flight requests with the new token don't trigger another cycle.
let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 5_000;

export function registerAuthCallbacks(callbacks: AuthCallbacks) {
	authCallbacks = callbacks;
}

/**
 * Reset interceptor state. Useful in tests to clear cooldown and
 * refresh flags between test cases.
 */
export function resetInterceptorState() {
	isRefreshing = false;
	refreshSubscribers = [];
	lastRefreshTime = 0;
}

/**
 * Subscribe to token refresh completion.
 * Used to queue requests waiting for a refresh to complete.
 */
function subscribeTokenRefresh(callback: (token: string | null) => void) {
	refreshSubscribers.push(callback);
}

/**
 * Notify all subscribers that token refresh is complete.
 */
function onRefreshComplete(token: string | null) {
	refreshSubscribers.forEach(callback => callback(token));
	refreshSubscribers = [];
}

/**
 * Lightweight fetch wrapper that injects the X-Client-Type header for backend API calls.
 * It will add the header only when the request target appears to be the configured apiBaseUrl.
 * 
 * Handles 401 Unauthorized responses by attempting to refresh the token and retrying the request.
 * Handles network errors with exponential backoff — no automatic logout for connectivity issues.
 */
export async function apiFetch(input: RequestInfo, init?: RequestInit) {
	const url = typeof input === 'string' ? input : (input as Request).url;

	// Clone/prepare headers
	const headers: Record<string, string> = {};
	if (init && init.headers) {
		if (init.headers instanceof Headers) {
			init.headers.forEach((v, k) => (headers[k] = v));
		} else if (Array.isArray(init.headers)) {
			init.headers.forEach(([k, v]) => (headers[k] = String(v)));
		} else {
			Object.assign(headers, init.headers as Record<string, string>);
		}
	}

	// Add the X-Client-Type header for API calls (only when apiBaseUrl is configured and matches)
	try {
		if (apiBaseUrl && typeof url === 'string' && url.startsWith(apiBaseUrl)) {
			headers['X-Client-Type'] = 'api-client';
		}
	} catch {
		// ignore
	}

	// Check if we should skip the interceptor (e.g. for the refresh call itself)
	const skipInterceptor = headers['X-Skip-Interceptor'] === 'true';
	if (skipInterceptor) {
		delete headers['X-Skip-Interceptor'];
	}

	const mergedInit: RequestInit = {
		...(init || {}),
		headers,
	};

	// ---- network-error retry with exponential backoff ----
	const MAX_RETRIES = 3;
	const BASE_DELAY_MS = 1_000; // 1s → 2s → 4s

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			let response = await fetch(input, mergedInit);

			// -- 401 interception (auth token refresh) --
			if (response.status === 401 && !skipInterceptor && authCallbacks) {
				response = await handle401(response, input, mergedInit, headers);
			}

			return response;
		} catch (error) {
			const isNetworkError = error instanceof TypeError;

			if (isNetworkError && attempt < MAX_RETRIES) {
				const delay = BASE_DELAY_MS * Math.pow(2, attempt);
				console.log(
					`API: Network error, retrying in ${delay}ms ` +
					`(attempt ${attempt + 1}/${MAX_RETRIES})…`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			// Exhausted retries or non-network error
			if (isNetworkError) {
				console.error(
					`API: Request failed after ${MAX_RETRIES + 1} attempts:`,
					error
				);
			} else {
				console.error('API Request Failed:', error);
			}
			ShowAlert(
				'Network request failed. Please check your connection.',
				'Error'
			);
			return new Response(
				JSON.stringify({
					error: 'Network request failed',
					message: 'Network request failed',
				}),
				{
					status: 503,
					statusText: 'Service Unavailable',
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	}

	// TypeScript: unreachable, but satisfies the return type
	throw new Error('unreachable');
}

/**
 * Handle a 401 response: attempt token refresh and retry the original
 * request. Network errors during this process are NOT treated as auth
 * failures — they bubble up to the caller's retry loop.
 */
async function handle401(
	response: Response,
	input: RequestInfo,
	mergedInit: RequestInit,
	headers: Record<string, string>
): Promise<Response> {
	console.log('API: 401 received, attempting token refresh...');

	if (!authCallbacks) return response;

	// If a refresh is already in progress, wait for it
	if (isRefreshing) {
		console.log('API: Token refresh already in progress, waiting...');
		const newToken = await new Promise<string | null>((resolve) => {
			subscribeTokenRefresh((token) => {
				resolve(token);
			});
		});

		if (newToken) {
			console.log('API: Using refreshed token, retrying request...');
			headers['Authorization'] = `Bearer ${newToken}`;
			return await fetch(input, { ...mergedInit, headers });
		}

		// Refresh completed but returned null — auth failure, not network
		console.log('API: Token refresh failed (from queue), logging out...');
		authCallbacks.onLogout();
		return response;
	}

	// Avoid starting another refresh immediately after a completed one.
	// Requests that arrived during the refresh are handled above and wait
	// for its result instead of returning their stale 401.
	const now = Date.now();
	if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
		console.log(
			'API: 401 received but within refresh cooldown, returning 401 as-is'
		);
		return response;
	}

	// We're the first to attempt refresh
	isRefreshing = true;
	lastRefreshTime = Date.now();

	let newToken: string | null = null;
	try {
		newToken = await authCallbacks.onRefreshToken();
	} catch (e) {
		// If onRefreshToken threw a network error, don't logout —
		// the caller's retry loop will handle it.
		isRefreshing = false;
		lastRefreshTime = 0; // reset cooldown so next attempt can refresh
		onRefreshComplete(null);
		throw e; // bubble up to apiFetch's retry loop
	}

	isRefreshing = false;
	onRefreshComplete(newToken);

	if (newToken) {
		console.log('API: Token refresh successful, retrying request...');
		headers['Authorization'] = `Bearer ${newToken}`;
		return await fetch(input, { ...mergedInit, headers });
	}

	// Token refresh returned null — genuine auth failure
	console.log('API: Token refresh failed, logging out...');
	authCallbacks.onLogout();
	return response;
}

export default apiFetch;

/**
 * Parse a non-OK Response into a human readable error string.
 * Handles flattened JSON from our API like:
 * { errors: { name: ["..."], password: ["..."] } }
 */
export async function parseApiError(res: Response): Promise<string> {
	try {
		const ct = res.headers.get('content-type') || '';
		if (ct.includes('application/json')) {
			const body = await res.json();
			// If API uses { errors: { field: [..] } }
			if (body && typeof body === 'object') {
				if (body.errors && typeof body.errors === 'object') {
					const parts: string[] = [];
					for (const key of Object.keys(body.errors)) {
						const val = body.errors[key];
						if (Array.isArray(val)) {
							// join array messages for the field
							parts.push(`${key}: ${val.join('; ')}`);
						} else if (typeof val === 'string') {
							parts.push(`${key}: ${val}`);
						} else if (val && typeof val === 'object') {
							try {
								parts.push(`${key}: ${Object.values(val).flat().join('; ')}`);
							} catch {
								parts.push(`${key}: ${JSON.stringify(val)}`);
							}
						}
					}
					if (parts.length) return parts.join(' \n');
				}

				// Fallbacks: common message keys
				if (body.message && typeof body.message === 'string')
					return body.message;
				if (body.error && typeof body.error === 'string') return body.error;

				// If body is simple object, stringify a concise form
				try {
					return JSON.stringify(body);
				} catch {
					// pass through
				}
			}
		} else {
			// Non-json: return text
			try {
				const text = await res.text();
				if (text) return text;
			} catch { }
		}
	} catch {
		// ignore and continue to generic fallback
	}
	return `HTTP error ${res.status}`;
}

/**
 * Poll a queued (202) router operation by cache key until it completes or times out.
 *
 * API 2.0 contract for `POST /router-operations/poll`:
 *  - 202 while the operation is `queued` / `processing` (partial `data` may be present)
 *  - 200 when `operation.state === 'done'`, with the payload in `data`
 *  - `operation.state` of `error` / `cancelled` is terminal
 *
 * Returns the `data` payload of the finished operation.
 */
export async function pollQueuedOperation(
	cacheKey: string,
	token?: string,
	{
		maxAttempts = 30,
		intervalMs = 2000,
	} = {}
) {
	if (!cacheKey) throw new Error('cacheKey required for polling');
	const pollUrl = `${apiBaseUrl}/router-operations/poll`;
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		let terminalError: Error | null = null;
		try {
			const resp = await apiFetch(pollUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify({ cache_key: cacheKey }),
			});

			let body: unknown = null;
			try {
				body = await resp.json();
			} catch {
				body = null;
			}

			const state = (getOperationState(body) ?? '').toLowerCase();
			console.log(
				'[pollQueuedOperation] attempt',
				attempt + 1,
				'HTTP',
				resp.status,
				'state',
				state || '(none)'
			);

			if (state === 'error' || state === 'cancelled') {
				terminalError = new Error(
					getApiMessage(body) ?? `Queued operation ${state}`
				);
			} else if (resp.status === 200) {
				return getApiData(body) ?? body;
			} else if (resp.status >= 400) {
				terminalError = new Error(
					getApiMessage(body) ?? `Queued operation failed (${resp.status})`
				);
			}
		} catch (error) {
			// Network/transport problems are retryable.
			console.warn('[pollQueuedOperation] attempt', attempt + 1, 'failed:', error);
		}

		if (terminalError) throw terminalError;

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error('Queued operation timed out');
}
