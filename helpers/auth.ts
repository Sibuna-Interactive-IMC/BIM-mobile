// Deprecated helper — delegate to AuthService to centralize auth endpoints.
import { getApiData, isApiSuccess } from '@/helpers/apiResponse';
import * as AuthService from '@/services/AuthService';
import type { AuthSession } from '@/types';

export async function getAuthToken({
	phone,
	email,
	password,
}: {
	phone?: string;
	email?: string;
	password?: string;
}) {
	try {
		const res = await AuthService.getAuthToken({ phone, email, password });
		if (!res || !res.ok) return null;
		const body = await res.json();
		// API 2.0 wraps the payload in `data`; fall back to the flat legacy body.
		const data = getApiData<AuthSession & { token?: string }>(body);
		return data?.token ?? null;
	} catch (e) {
		console.error('getAuthToken: delegation failed', e);
		return null;
	}
}

export async function verifyToken(token: string) {
	if (!token) return false;
	try {
		const res = await AuthService.verifyToken(token);
		if (!res || !res.ok) return false;
		const body = await res.json();
		// `/token/verify` returns 200 with the identity payload for a valid token.
		return Boolean(getApiData<AuthSession>(body)?.token) || isApiSuccess(body);
	} catch (e) {
		console.error('verifyToken: delegation failed', e);
		return false;
	}
}
