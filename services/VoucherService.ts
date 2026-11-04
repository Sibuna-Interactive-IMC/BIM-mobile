import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { VoucherStatus } from '@/types';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

export type VoucherOrigin = 'manual' | 'auto';

export type VoucherSort =
	| 'created_at'
	| 'username'
	| 'router_name'
	| 'profile'
	| 'status'
	| 'first_auth'
	| 'last_auth'
	| 'expires_at';

export interface VoucherQuery {
	/** Lifecycle filter; omit for every voucher. */
	status?: VoucherStatus | null;
	/** Username substring. */
	search?: string;
	/** Router id or router name. */
	router?: string;
	/** RADIUS profile/group name. */
	profile?: string;
	origin?: VoucherOrigin;
	sort?: VoucherSort;
	dir?: 'asc' | 'desc';
	page?: number;
	perPage?: number;
}

function toQueryString(params: Record<string, string | number | undefined>) {
	const search = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined || value === null || value === '') return;
		search.append(key, String(value));
	});
	const qs = search.toString();
	return qs ? `?${qs}` : '';
}

/** `GET /vouchers` — the caller's vouchers plus global stats and per-router totals. */
export async function fetchVouchers(
	{
		status,
		search,
		router,
		profile,
		origin,
		sort,
		dir,
		page,
		perPage,
	}: VoucherQuery = {},
	token?: string
) {
	const qs = toQueryString({
		status: status ?? undefined,
		search: search?.trim() || undefined,
		router,
		profile,
		origin,
		sort,
		dir,
		page,
		per_page: perPage,
	});
	return apiFetch(`${apiBaseUrl || ''}/vouchers${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /vouchers/routers` — the router picker for the voucher list. */
export async function fetchVoucherRouters(
	token?: string,
	{ page, perPage }: { page?: number; perPage?: number } = {}
) {
	const qs = toQueryString({ page, per_page: perPage });
	return apiFetch(`${apiBaseUrl || ''}/vouchers/routers${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /vouchers/{routerId}/hotspots` */
export async function fetchVoucherHotspots(routerId: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/vouchers/${encodeURIComponent(routerId)}/hotspots`,
		{
			method: 'GET',
			headers: buildHeaders(token),
		}
	);
}

export interface GenerateVouchersPayload {
	/** How many vouchers to create (1–100). */
	numberOfUsers: number;
	/** RADIUS profile/group name the vouchers get. */
	profile: string;
	/** Hotspot server name on the router the vouchers belong to. */
	hotspotServer: string;
}

/**
 * `POST /vouchers/{routerId}/generate` — the bulk generator behind the web's
 * "Generate Bulk Vouchers" form. Returns `data.users` for the created batch.
 */
export async function generateVouchers(
	routerId: string,
	{ numberOfUsers, profile, hotspotServer }: GenerateVouchersPayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/vouchers/${encodeURIComponent(routerId)}/generate`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify({
				number_of_users: numberOfUsers,
				profile,
				hotspot_server: hotspotServer,
			}),
		}
	);
}

/** `POST /vouchers/users/{username}/disable` */
export async function disableVoucherUser(username: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/vouchers/users/${encodeURIComponent(username)}/disable`,
		{
			method: 'POST',
			headers: buildHeaders(token),
		}
	);
}

/** `POST /vouchers/users/{username}/enable` */
export async function enableVoucherUser(username: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/vouchers/users/${encodeURIComponent(username)}/enable`,
		{
			method: 'POST',
			headers: buildHeaders(token),
		}
	);
}

/** `POST /vouchers/users/{username}/reset-unused` */
export async function resetVoucherUser(username: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/vouchers/users/${encodeURIComponent(username)}/reset-unused`,
		{
			method: 'POST',
			headers: buildHeaders(token),
		}
	);
}

/** `DELETE /vouchers/users/{username}/delete` */
export async function deleteVoucherUser(username: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/vouchers/users/${encodeURIComponent(username)}/delete`,
		{
			method: 'DELETE',
			headers: buildHeaders(token),
		}
	);
}

export default {
	fetchVouchers,
	fetchVoucherRouters,
	fetchVoucherHotspots,
	generateVouchers,
	disableVoucherUser,
	enableVoucherUser,
	resetVoucherUser,
	deleteVoucherUser,
};
