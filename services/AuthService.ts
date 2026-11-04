import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';

export async function login(phone: string, password: string) {
	return apiFetch((apiBaseUrl || '') + '/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone, password: password ?? '' }),
	});
}

export async function register(payload: {
	phone: string;
	password: string;
	name?: string;
	email?: string;
}) {
	return apiFetch((apiBaseUrl || '') + '/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			phone: payload.phone,
			password: payload.password || '',
			password_confirmation: payload.password || '',
			name: payload.name || undefined,
			email: payload.email || undefined,
		}),
	});
}

export async function verifyOtp(payload: {
	name?: string;
	email?: string;
	phone: string;
	password?: string;
	otp: string;
}) {
	return apiFetch((apiBaseUrl || '') + '/verify-otp', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
}

export async function verify2fa(phone: string, otp: string) {
	return apiFetch((apiBaseUrl || '') + '/2fa-verify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone, otp }),
	});
}

export async function setupTotp({
	setup_token,
	secret,
	otp,
}: {
	setup_token: string;
	secret: string;
	otp: string;
}) {
	return apiFetch((apiBaseUrl || '') + '/2fa-setup', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ setup_token, secret, otp }),
	});
}

export async function logout(token: string) {
	return apiFetch((apiBaseUrl || '') + '/logout', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
	});
}

export async function getAuthToken({
	phone,
	email,
	password,
}: {
	phone?: string;
	email?: string;
	password?: string;
}) {
	const url =
		(apiBaseUrl || '') +
		'/auth/token?phone=' +
		(phone || '') +
		'&&password?=' +
		(password || '');
	return apiFetch(url, {
		method: 'GET',
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function verifyToken(token: string) {
	return apiFetch((apiBaseUrl || '') + '/token/verify', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
	});
}

export async function refreshToken(token: string) {
	return apiFetch((apiBaseUrl || '') + '/token/refresh', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			'X-Skip-Interceptor': 'true',
		},
	});
}

export default {
	login,
	register,
	verifyOtp,
	verify2fa,
	setupTotp,
	logout,
	getAuthToken,
	verifyToken,
	refreshToken,
};
