import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type {
	SiteAccessPointPayload,
	SiteCompensationPayload,
	SiteExpensePayload,
	SitePremises,
} from '@/types';

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

/** `GET /sites` — the caller's sites with expense totals. */
export async function fetchSites(
	token?: string,
	{ page, perPage }: { page?: number; perPage?: number } = {}
) {
	const qs = toQueryString({ page, per_page: perPage });
	return apiFetch(`${apiBaseUrl || ''}/sites${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /sites/{router}` — premises, access points and expenses for one site. */
export async function fetchSite(
	routerId: string,
	token?: string,
	{ month }: { month?: string } = {}
) {
	const qs = toQueryString({ month });
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}${qs}`,
		{
			method: 'GET',
			headers: buildHeaders(token),
		}
	);
}

/** `GET /sites/{router}/disbursements` — owner withdrawals usable as expense compensation. */
export async function fetchSiteDisbursements(
	routerId: string,
	token?: string,
	{ offset = 0, limit = 200 }: { offset?: number; limit?: number } = {}
) {
	const qs = toQueryString({ offset, limit });
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/disbursements${qs}`,
		{ method: 'GET', headers: buildHeaders(token) }
	);
}

/** `POST /sites/{router}/detail` — create or update the premises row. */
export async function saveSiteDetail(
	routerId: string,
	payload: SitePremises,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/detail`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

/** `POST /sites/{router}/access-points` */
export async function createAccessPoint(
	routerId: string,
	payload: SiteAccessPointPayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/access-points`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

/**
 * `POST /sites/{router}/access-points/{accessPoint}` — the API uses POST, not
 * PUT, to mirror the web form.
 */
export async function updateAccessPoint(
	routerId: string,
	accessPointId: number,
	payload: SiteAccessPointPayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/access-points/${accessPointId}`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

/** `DELETE /sites/{router}/access-points/{accessPoint}` — also drops its expenses. */
export async function deleteAccessPoint(
	routerId: string,
	accessPointId: number,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/access-points/${accessPointId}`,
		{ method: 'DELETE', headers: buildHeaders(token) }
	);
}

/** `POST /sites/{router}/expenses` */
export async function createSiteExpense(
	routerId: string,
	payload: SiteExpensePayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/expenses`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

/** `DELETE /sites/{router}/expenses/{expense}` */
export async function deleteSiteExpense(
	routerId: string,
	expenseId: number,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/expenses/${expenseId}`,
		{ method: 'DELETE', headers: buildHeaders(token) }
	);
}

/** `POST /sites/{router}/expenses/{expense}/compensation` — set or clear the link. */
export async function updateExpenseCompensation(
	routerId: string,
	expenseId: number,
	payload: SiteCompensationPayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/sites/${encodeURIComponent(routerId)}/expenses/${expenseId}/compensation`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

export default {
	fetchSites,
	fetchSite,
	fetchSiteDisbursements,
	saveSiteDetail,
	createAccessPoint,
	updateAccessPoint,
	deleteAccessPoint,
	createSiteExpense,
	deleteSiteExpense,
	updateExpenseCompensation,
};
