import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type {
	DataDeletionCompletePayload,
	DataDeletionRejectPayload,
	DataDeletionReplyPayload,
	DataDeletionStatus,
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

/** `GET /admin/data-deletion-requests` — paginated admin queue. */
export async function fetchAdminDataDeletionRequests(
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
		status?: DataDeletionStatus | '';
	} = {}
) {
	const qs = toQueryString({
		page,
		per_page: perPage,
		q,
		status,
	});
	return apiFetch(`${apiBaseUrl || ''}/admin/data-deletion-requests${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /admin/data-deletion-requests/{id}` — request details and matching logins. */
export async function fetchAdminDataDeletionRequest(id: number, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/admin/data-deletion-requests/${encodeURIComponent(id)}`,
		{ method: 'GET', headers: buildHeaders(token) }
	);
}

/** `POST /admin/data-deletion-requests/{id}/reply` — email and update request status. */
export async function replyToDataDeletionRequest(
	id: number,
	payload: DataDeletionReplyPayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/admin/data-deletion-requests/${encodeURIComponent(id)}/reply`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

/** `POST /admin/data-deletion-requests/{id}/complete` — optionally delete a matched login. */
export async function completeDataDeletionRequest(
	id: number,
	payload: DataDeletionCompletePayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/admin/data-deletion-requests/${encodeURIComponent(id)}/complete`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

/** `POST /admin/data-deletion-requests/{id}/reject` — record the reason and optionally email it. */
export async function rejectDataDeletionRequest(
	id: number,
	payload: DataDeletionRejectPayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/admin/data-deletion-requests/${encodeURIComponent(id)}/reject`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

export default {
	fetchAdminDataDeletionRequests,
	fetchAdminDataDeletionRequest,
	replyToDataDeletionRequest,
	completeDataDeletionRequest,
	rejectDataDeletionRequest,
};
