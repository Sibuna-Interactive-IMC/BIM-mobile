import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { UpdateProfilePayload } from '@/types';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

/** `GET /profile` — the login's own record, plus its account listing. */
export async function fetchProfile(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/profile`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `GET /profile/avatars` — the preset avatar catalog and gender options.
 *
 * The presets ship with the app only as URLs; without this the client would have
 * to hard-code the preset ids the server validates against.
 */
export async function fetchAvatarOptions(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/profile/avatars`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `PATCH /profile` — name, email, phone, gender, notification email and avatar.
 *
 * Every field except name/email is `sometimes` on the server, so only what
 * changed is sent: a partial update cannot blank the phone number, which is also
 * the sign-in identity.
 */
export async function updateProfile(
	payload: UpdateProfilePayload,
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/profile`, {
		method: 'PATCH',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

/** `PUT /password` — needs the current password, and a confirmed new one. */
export async function updatePassword(
	payload: {
		current_password: string;
		password: string;
		password_confirmation: string;
	},
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/password`, {
		method: 'PUT',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

/** `DELETE /profile` — deletes the login for good; the password is the confirmation. */
export async function deleteAccount(password: string, token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/profile`, {
		method: 'DELETE',
		headers: buildHeaders(token),
		body: JSON.stringify({ password }),
	});
}

export default {
	fetchProfile,
	fetchAvatarOptions,
	updateProfile,
	updatePassword,
	deleteAccount,
};
