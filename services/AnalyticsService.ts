import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
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

/** `GET /analytics/accounts` — multi-party accounts (admin only). */
export async function fetchAnalyticsAccounts(
	token?: string,
	{ page, perPage }: { page?: number; perPage?: number } = {}
) {
	const qs = toQueryString({ page, per_page: perPage });
	return apiFetch(`${apiBaseUrl || ''}/analytics/accounts${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /analytics/accounts/{account}` — members, routers and stats. */
export async function fetchAnalyticsAccount(accountId: number, token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/analytics/accounts/${accountId}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

function subResource(accountId: number, resource: string, page?: number) {
	const qs = toQueryString({ page });
	return `${apiBaseUrl || ''}/analytics/accounts/${accountId}/${resource}${qs}`;
}

/** `GET /analytics/accounts/{account}/activity` */
export async function fetchAnalyticsAccountActivity(
	accountId: number,
	token?: string,
	page?: number
) {
	return apiFetch(subResource(accountId, 'activity', page), {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /analytics/accounts/{account}/withdrawals` */
export async function fetchAnalyticsAccountWithdrawals(
	accountId: number,
	token?: string,
	page?: number
) {
	return apiFetch(subResource(accountId, 'withdrawals', page), {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /analytics/accounts/{account}/vouchers` */
export async function fetchAnalyticsAccountVouchers(
	accountId: number,
	token?: string,
	page?: number
) {
	return apiFetch(subResource(accountId, 'vouchers', page), {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /analytics/accounts/{account}/payouts` */
export async function fetchAnalyticsAccountPayouts(
	accountId: number,
	token?: string,
	page?: number
) {
	return apiFetch(subResource(accountId, 'payouts', page), {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** The three money lists behind the business analytics dashboard. */
export type BusinessListKind = 'credits' | 'charges' | 'withdrawals';

export type BusinessListPeriod = 'today' | 'week' | 'month' | 'all';

/** `GET /analytics/business/{kind}` — one paged money list. */
export async function fetchBusinessList(
	kind: BusinessListKind,
	token?: string,
	{
		owner,
		period,
		page,
		perPage,
	}: {
		owner?: number;
		period?: BusinessListPeriod;
		page?: number;
		perPage?: number;
	} = {}
) {
	const qs = toQueryString({
		owner,
		period,
		page,
		per_page: perPage,
	});
	return apiFetch(`${apiBaseUrl || ''}/analytics/business/${kind}${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /analytics/business/routers` — the router leaderboard. */
export async function fetchBusinessRouters(
	token?: string,
	{ page, perPage }: { page?: number; perPage?: number } = {}
) {
	const qs = toQueryString({ page, per_page: perPage });
	return apiFetch(`${apiBaseUrl || ''}/analytics/business/routers${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export default {
	fetchAnalyticsAccounts,
	fetchAnalyticsAccount,
	fetchAnalyticsAccountActivity,
	fetchAnalyticsAccountWithdrawals,
	fetchAnalyticsAccountVouchers,
	fetchAnalyticsAccountPayouts,
	fetchBusinessList,
	fetchBusinessRouters,
};
