import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type {
	BroadcastAudienceFilters,
	BroadcastTemplatePayload,
	RecipientStatus,
} from '@/types';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

function toQueryString(params: Record<string, string | number | undefined | null>) {
	const search = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined || value === null || value === '') return;
		search.append(key, String(value));
	});
	const qs = search.toString();
	return qs ? `?${qs}` : '';
}

/** The audience half of a broadcast request (shared by preview and send). */
function audienceBody(filters: BroadcastAudienceFilters) {
	return {
		audience: filters.audience,
		...(filters.audience === 'site' ? { router_id: filters.router_id } : {}),
		...(filters.audience === 'single' ? { phone: filters.phone } : {}),
		// A single number has no date/purchase filters on the server either.
		...(filters.audience !== 'single'
			? {
					...(filters.date_from ? { date_from: filters.date_from } : {}),
					...(filters.date_to ? { date_to: filters.date_to } : {}),
					...(filters.purchases_operator
						? { purchases_operator: filters.purchases_operator }
						: {}),
					...(filters.purchases_count
						? { purchases_count: filters.purchases_count }
						: {}),
				}
			: {}),
		...(filters.excluded?.length ? { excluded: filters.excluded } : {}),
	};
}

/**
 * `GET /admin/broadcasts` — the history plus the composer's sites, templates and
 * limits (admin only; `ApiResponse::paginated` splices every key at the top level).
 */
export async function fetchBroadcasts(
	token?: string,
	{
		page,
		perPage,
		q,
		status,
		audience,
		routerId,
		from,
		to,
	}: {
		page?: number;
		perPage?: number;
		q?: string;
		status?: string;
		audience?: string;
		routerId?: string;
		from?: string;
		to?: string;
	} = {}
) {
	const qs = toQueryString({
		page,
		per_page: perPage,
		q,
		status,
		audience,
		router_id: routerId,
		from,
		to,
	});
	return apiFetch(`${apiBaseUrl || ''}/admin/broadcasts${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `POST /admin/broadcasts/recipients` — the numbers the audience filters resolve
 * to. `q` only narrows the returned page; the send audience is the whole result.
 */
export async function previewRecipients(
	filters: BroadcastAudienceFilters & { q?: string; message?: string },
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/admin/broadcasts/recipients`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({
			...audienceBody(filters),
			...(filters.q ? { q: filters.q } : {}),
			...(filters.message ? { message: filters.message } : {}),
		}),
	});
}

/**
 * `POST /admin/broadcasts` — queue the send.
 *
 * `recipients_total` is the admin's confirmation of the list they previewed; the
 * server re-resolves the audience and refuses the send when the count moved.
 */
export async function queueBroadcast(
	filters: BroadcastAudienceFilters & {
		message: string;
		recipients_total: number;
		template_id?: number | null;
	},
	token?: string
) {
	const { message, recipients_total, template_id, ...audience } = filters;
	return apiFetch(`${apiBaseUrl || ''}/admin/broadcasts`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({
			...audienceBody(audience),
			message,
			recipients_total,
			...(template_id ? { template_id } : {}),
		}),
	});
}

/** `GET /admin/broadcasts/{broadcast}` — one send with its per-recipient outcome. */
export async function fetchBroadcast(
	broadcastId: number,
	token?: string,
	{
		page,
		perPage,
		q,
		status,
	}: {
		page?: number;
		perPage?: number;
		q?: string;
		status?: RecipientStatus | '';
	} = {}
) {
	const qs = toQueryString({ page, per_page: perPage, q, status });
	return apiFetch(
		`${apiBaseUrl || ''}/admin/broadcasts/${encodeURIComponent(broadcastId)}${qs}`,
		{ method: 'GET', headers: buildHeaders(token) }
	);
}

/** `GET /admin/broadcasts/templates` */
export async function fetchBroadcastTemplates(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/admin/broadcasts/templates`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `POST /admin/broadcasts/templates` */
export async function createBroadcastTemplate(
	payload: BroadcastTemplatePayload,
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/admin/broadcasts/templates`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

/** `DELETE /admin/broadcasts/templates/{template}` */
export async function deleteBroadcastTemplate(
	templateId: number,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/admin/broadcasts/templates/${encodeURIComponent(templateId)}`,
		{ method: 'DELETE', headers: buildHeaders(token) }
	);
}

export default {
	fetchBroadcasts,
	previewRecipients,
	queueBroadcast,
	fetchBroadcast,
	fetchBroadcastTemplates,
	createBroadcastTemplate,
	deleteBroadcastTemplate,
};
