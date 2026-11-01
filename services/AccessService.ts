import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { InviteUserPayload } from '@/types';

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
 * `GET /invitations` — the active account, its members and pending invitations.
 * Owner-only actions (invite, revoke, remove) are enforced by the API.
 */
export async function fetchAccess(
	token?: string,
	{ page, perPage }: { page?: number; perPage?: number } = {}
) {
	const qs = toQueryString({ page, per_page: perPage });
	return apiFetch(`${apiBaseUrl || ''}/invitations${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `POST /invitations` — emails the invite to `email` with the given seat. */
export async function inviteUser(payload: InviteUserPayload, token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/invitations`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

/** `DELETE /invitations/{invitation}` — revoke a pending invitation. */
export async function revokeInvitation(
	invitationId: number,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/invitations/${encodeURIComponent(invitationId)}`,
		{ method: 'DELETE', headers: buildHeaders(token) }
	);
}

/** `DELETE /invitations/users/{userId}` — remove a member from the account. */
export async function removeAccountMember(
	userId: number,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/invitations/users/${encodeURIComponent(userId)}`,
		{ method: 'DELETE', headers: buildHeaders(token) }
	);
}

export default {
	fetchAccess,
	inviteUser,
	revokeInvitation,
	removeAccountMember,
};
