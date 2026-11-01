import { apiBaseUrl } from '@/constants/API';
import { apiFetch, pollQueuedOperation } from '@/helpers/api';
import { getOperationCacheKey } from '@/helpers/apiResponse';
import type { RouterPayload } from '@/types';
import EventSource from 'react-native-sse';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

function jsonResponse(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload ?? {}), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

/**
 * Router reads may be queued (202) when the cached value is stale.
 * API 2.0 reports the cache key on `operation.cache_key` (and `data.cache_key`);
 * poll until the operation completes and surface the finished payload as a 200.
 */
async function resolveQueuedResponse(
	resp: Response,
	token: string | undefined,
	label: string
): Promise<Response> {
	if (resp.status !== 202) return resp;

	let cacheKey: string | undefined;
	try {
		const body = await resp.json().catch(() => null);
		cacheKey = getOperationCacheKey(body);
		if (!cacheKey) {
			console.error(`[${label}] queued response did not include a cache key`);
			return jsonResponse(body, 502);
		}
		const polled = await pollQueuedOperation(cacheKey, token);
		return jsonResponse(polled);
	} catch (error) {
		console.error(`[${label}] queued request failed`, error);
		return jsonResponse({ error: String(error) }, 500);
	}
}

export async function fetchRouters(token?: string) {
	return apiFetch((apiBaseUrl || '') + '/routers', {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export async function getRouterById(routerId: string, token?: string) {
	return apiFetch((apiBaseUrl || '') + `/routers/${encodeURIComponent(routerId)}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `PUT /routers/{id}` — the router profile edited from Site Management. */
export async function updateRouter(
	routerId: string,
	payload: RouterPayload,
	token?: string
) {
	return apiFetch((apiBaseUrl || '') + `/routers/${encodeURIComponent(routerId)}`, {
		method: 'PUT',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

export async function getRouterStatus(routerId: string, token?: string) {
	const resp = await apiFetch((apiBaseUrl || '') + `/routers/${encodeURIComponent(routerId)}/status`, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resolveQueuedResponse(resp, token, 'getRouterStatus');
}

export async function getRouterHotspots(routerId: string, token?: string) {
	const url = (apiBaseUrl || '') + `/routers/${encodeURIComponent(routerId)}/hotspots`;
	const resp = await apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resolveQueuedResponse(resp, token, 'getRouterHotspots');
}

export async function getRouterInterfaces(routerId: string, token?: string) {
	const resp = await apiFetch((apiBaseUrl || '') + `/routers/${encodeURIComponent(routerId)}/interfaces`, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resolveQueuedResponse(resp, token, 'getRouterInterfaces');
}

export function createRouterTrafficEventSource({
	routerId,
	iface,
	token,
}: {
	routerId: string;
	iface: string;
	token: string;
}) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/traffic/stream?iface=${encodeURIComponent(iface)}`;
	return new EventSource<'hello' | 'traffic' | 'bye'>(url, {
		headers: {
			...buildHeaders(token),
			'X-Client-Type': 'api-client',
		},
		pollingInterval: 3000,
	});
}

export async function pingRouter(routerId: string, token?: string) {
	return apiFetch((apiBaseUrl || '') + `/routers/${encodeURIComponent(routerId)}/ping`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export async function getRouterUsers(
	{ routerId, token, page, limit }: { routerId: string; token?: string, page?: number, limit?: number }
) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/hotspots/users?per_page=${limit || 8}&page=${page || 1}`;
	console.log('[getRouterUsers] url', url);
	const resp = await apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resp;
}

export async function getRouterActiveUsers({ routerId, token, page, limit }: { routerId: string; token?: string; page?: number; limit?: number }) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/hotspots/active?per_page=${limit || 8}&page=${page || 1}`;
	console.log('[getRouterActiveUsers] url', url);
	const resp = await apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resp;
}

export async function getRouterCookies({ routerId, token, page, limit }: { routerId: string; token?: string; page?: number; limit?: number }) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/hotspot-cookies?per_page=${limit || 8}&page=${page || 1}`;
	console.log('[getRouterCookies] url', url);
	const resp = await apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resp;
}

export async function deleteRouterCookie({ routerId, cookieId, token }: { routerId: string; cookieId: string; token?: string }) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/hotspot-cookies/${cookieId}`;
	console.log('[removeRouterCookie] url', url);
	const resp = await apiFetch(url, {
		method: 'DELETE',
		headers: buildHeaders(token),
	});

	return resp;
}

export async function getRouterHosts({ routerId, token, page, limit }: { routerId: string; token?: string; page?: number; limit?: number }) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/hosts?per_page=${limit || 8}&page=${page || 1}`;
	console.log('[getRouterHosts] url ', url);
	const resp = await apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resp;
}

export async function getRouterDHCPLeases({ routerId, token, page, limit }: { routerId: string; token?: string; page?: number; limit?: number }) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/dhcp/leases?per_page=${limit || 8}&page=${page || 1}`;
	console.log('[getRouterDHCPLeases] url ', url);
	const resp = await apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});

	return resp;
}

export async function getRouterPurchaseGuard({ routerId, token }: { routerId: string; token?: string }) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/purchase-guard`;
	console.log('[getRouterPurchaseGuard] url ', url);
	const resp = await apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});
	return resp;
}

export async function updateRouterPurchaseGuard({ routerId, token, value }: { routerId: string; token?: string; value: boolean }) {
	const url = `${apiBaseUrl || ''}/routers/${encodeURIComponent(routerId)}/purchase-guard`;
	console.log('[updateRouterPurchaseGuard] url ', url);
	const resp = await apiFetch(url, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({ notify_existing_voucher: value }),
	});
	return resp;
}

export default {
	fetchRouters,
	getRouterById,
	updateRouter,
	getRouterStatus,
	pingRouter,
	getRouterHotspots,
	getRouterInterfaces,
	createRouterTrafficEventSource,
	getRouterUsers,
	getRouterActiveUsers,
	getRouterCookies,
	deleteRouterCookie,
	getRouterHosts,
	getRouterPurchaseGuard,
	updateRouterPurchaseGuard,
};
