import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

export async function fetchPackages(token?: string) {
	return apiFetch((apiBaseUrl || '') + '/packages', {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

function query(params?: Record<string, string | number | undefined>) {
	if (!params) return '';
	const parts = Object.entries(params)
		.filter(([, value]) => value !== undefined && value !== '')
		.map(
			([key, value]) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
		);
	return parts.length ? `?${parts.join('&')}` : '';
}

export async function fetchPortalPackages(
	token?: string,
	params?: { page?: number; per_page?: number; scope?: string }
) {
	return apiFetch((apiBaseUrl || '') + '/packages' + query(params), {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export async function createPortalPackage(
	payload: Record<string, unknown>,
	token?: string
) {
	return apiFetch((apiBaseUrl || '') + '/packages', {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

export async function updatePortalPackage(
	packageId: string,
	payload: Record<string, unknown>,
	token?: string
) {
	return apiFetch(
		(apiBaseUrl || '') + `/packages/${encodeURIComponent(packageId)}`,
		{
			method: 'PUT',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

export async function deletePortalPackage(packageId: string, token?: string) {
	return apiFetch(
		(apiBaseUrl || '') + `/packages/${encodeURIComponent(packageId)}`,
		{
			method: 'DELETE',
			headers: buildHeaders(token),
		}
	);
}

export async function fetchPackageRouters(packageId: string, token?: string) {
	return apiFetch(
		(apiBaseUrl || '') +
			`/packages/${encodeURIComponent(packageId)}/routers`,
		{
			method: 'GET',
			headers: buildHeaders(token),
		}
	);
}

export async function updatePackageRouters(
	packageId: string,
	payload: {
		visible: string[];
		rate_limits: Record<string, string | null>;
		reconnect_users?: boolean;
	},
	token?: string
) {
	return apiFetch(
		(apiBaseUrl || '') +
			`/packages/${encodeURIComponent(packageId)}/routers`,
		{
			method: 'PUT',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

export async function fetchSharedProfiles(
	token?: string,
	params?: { page?: number; per_page?: number }
) {
	return apiFetch((apiBaseUrl || '') + '/profiles' + query(params), {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export async function createSharedProfile(
	payload: {
		name: string;
		no_of_users: number;
		bandwidth: string;
		duration: string;
		price: number;
	},
	token?: string
) {
	return apiFetch((apiBaseUrl || '') + '/profiles', {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

export async function updateSharedProfile(
	group: string,
	payload: {
		name: string;
		no_of_users: number;
		bandwidth: string;
		duration: string;
		price?: number;
	},
	token?: string
) {
	return apiFetch(
		(apiBaseUrl || '') + `/profiles/${encodeURIComponent(group)}`,
		{
			method: 'PUT',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

export async function deleteSharedProfile(group: string, token?: string) {
	return apiFetch(
		(apiBaseUrl || '') + `/profiles/${encodeURIComponent(group)}`,
		{
			method: 'DELETE',
			headers: buildHeaders(token),
		}
	);
}

export async function fetchTrialSettings(routerId: string, token?: string) {
	return apiFetch(
		(apiBaseUrl || '') + `/packages/trial/${encodeURIComponent(routerId)}`,
		{
			method: 'GET',
			headers: buildHeaders(token),
		}
	);
}

export async function updateTrialSettings(
	routerId: string,
	payload: { enabled: boolean; duration_minutes: number },
	token?: string
) {
	return apiFetch(
		(apiBaseUrl || '') + `/packages/trial/${encodeURIComponent(routerId)}`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

export default {
	fetchPackages,
	fetchPortalPackages,
	createPortalPackage,
	updatePortalPackage,
	deletePortalPackage,
	fetchPackageRouters,
	updatePackageRouters,
	fetchSharedProfiles,
	createSharedProfile,
	updateSharedProfile,
	deleteSharedProfile,
	fetchTrialSettings,
	updateTrialSettings,
};
