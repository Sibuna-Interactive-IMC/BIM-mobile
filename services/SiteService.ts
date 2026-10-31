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

export default {
	fetchSites,
	fetchSite,
};
