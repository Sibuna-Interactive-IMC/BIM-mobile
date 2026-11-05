import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { InboxSettingsPreference } from '@/types';

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

/**
 * `GET /inbox` — the signed-in user's own notification feed, newest first.
 *
 * Distinct from `/notifications`, which lists paid customer transactions.
 */
export async function fetchInbox(
	token?: string,
	{
		status,
		category,
		page,
		perPage,
	}: {
		status?: 'all' | 'unread' | 'read';
		category?: string;
		page?: number;
		perPage?: number;
	} = {}
) {
	const qs = toQueryString({
		status,
		category,
		page,
		per_page: perPage,
	});
	return apiFetch(`${apiBaseUrl || ''}/inbox${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /inbox/unread-count` — cheap poll target for the header badge. */
export async function fetchInboxUnreadCount(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/inbox/unread-count`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `POST /inbox/{id}/read` — idempotent, so a retry after a dropped response is fine. */
export async function markInboxRead(id: string, token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/inbox/${encodeURIComponent(id)}/read`, {
		method: 'POST',
		headers: buildHeaders(token),
	});
}

/** `POST /inbox/read-all` — marks every unread message for this login read. */
export async function markAllInboxRead(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/inbox/read-all`, {
		method: 'POST',
		headers: buildHeaders(token),
	});
}

/** `GET /inbox/settings` — the category × channel matrix with effective values. */
export async function fetchInboxSettings(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/inbox/settings`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `PATCH /inbox/settings` — each entry turns one channel on or off for one
 * category. The in-app inbox is always on and rejects a change.
 */
export async function saveInboxSettings(
	preferences: InboxSettingsPreference[],
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/inbox/settings`, {
		method: 'PATCH',
		headers: buildHeaders(token),
		body: JSON.stringify({ preferences }),
	});
}

export default {
	fetchInbox,
	fetchInboxUnreadCount,
	markInboxRead,
	markAllInboxRead,
	fetchInboxSettings,
	saveInboxSettings,
};
