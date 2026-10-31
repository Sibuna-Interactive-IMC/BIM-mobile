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

/** `GET /admin/users` — logins with their platform role and account seats. */
export async function fetchAdminUsers(
	token?: string,
	{ q, page, perPage }: { q?: string; page?: number; perPage?: number } = {}
) {
	const qs = toQueryString({ q: q?.trim() || undefined, page, per_page: perPage });
	return apiFetch(`${apiBaseUrl || ''}/admin/users${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /admin/users/{user}` — one login. */
export async function fetchAdminUser(userId: number, token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/admin/users/${userId}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `GET /admin/users/create` (no id) or `/admin/users/{user}/edit`: the roles and
 * accounts this admin may assign, plus the user being edited.
 */
export async function fetchAdminUserForm(token?: string, userId?: number) {
	const path = userId
		? `/admin/users/${userId}/edit`
		: '/admin/users/create';
	return apiFetch(`${apiBaseUrl || ''}${path}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export interface AdminUserPayload {
	name: string;
	phone: string;
	email: string;
	/** Required when creating; omitted to keep the current one when updating. */
	password?: string;
	/** A PLATFORM role id, or null to leave the login without one. */
	roleId: number | null;
	/** An existing account id, `__new__`, or null for no account at all. */
	accountId: number | '__new__' | null;
	accountRole: 'owner' | 'finance' | 'auditor' | null;
	newAccountName?: string | null;
}

function toUserBody(payload: AdminUserPayload) {
	const body: Record<string, unknown> = {
		name: payload.name.trim(),
		phone: payload.phone.trim(),
		email: payload.email.trim(),
		role_id: payload.roleId,
		account_id: payload.accountId,
		account_role: payload.accountRole,
		new_account_name: payload.newAccountName?.trim() || null,
	};
	if (payload.password) body.password = payload.password;
	return JSON.stringify(body);
}

/** `POST /admin/users` — create a login. */
export async function createAdminUser(payload: AdminUserPayload, token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/admin/users`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: toUserBody(payload),
	});
}

/** `PUT /admin/users/{user}` — update a login, role included. */
export async function updateAdminUser(
	userId: number,
	payload: AdminUserPayload,
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/admin/users/${userId}`, {
		method: 'PUT',
		headers: buildHeaders(token),
		body: toUserBody(payload),
	});
}

/** `DELETE /admin/users/{user}` */
export async function deleteAdminUser(userId: number, token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/admin/users/${userId}`, {
		method: 'DELETE',
		headers: buildHeaders(token),
	});
}

export default {
	fetchAdminUsers,
	fetchAdminUser,
	fetchAdminUserForm,
	createAdminUser,
	updateAdminUser,
	deleteAdminUser,
};
