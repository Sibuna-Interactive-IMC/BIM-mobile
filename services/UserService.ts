import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

export interface TransactionFilters {
	start_date?: string; // YYYY-MM-DD
	end_date?: string;   // YYYY-MM-DD
	status?: string;
	type?: string;
	router_id?: string;
	/** Server-side paging (`/transactions` returns a Laravel paginator). */
	page?: number;
	per_page?: number;
}

export async function fetchDashboard(token?: string) {
	return apiFetch((apiBaseUrl || '') + '/dashboard', {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export async function fetchUser(token?: string) {
	return apiFetch((apiBaseUrl || '') + '/me', {
		method: 'GET',
		headers: buildHeaders(token),
	});
}


export async function fetchPurchases(token?: string, filters?: TransactionFilters) {
	let url = (apiBaseUrl || '') + '/transactions';

	// Build query string from non-empty filter values
	if (filters) {
		const params = new URLSearchParams();
		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				params.append(key, value);
			}
		});
		const qs = params.toString();
		if (qs) url += '?' + qs;
	}

	return apiFetch(url, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export async function fetchDocuments(token?: string) {
	return apiFetch((apiBaseUrl || '') + '/documents', {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

export default {
	fetchDashboard,
	fetchUser,
	fetchPurchases,
	fetchDocuments,
};
