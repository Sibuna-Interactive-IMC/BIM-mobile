import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { PaymentProviderChoice } from '@/types';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

/**
 * `GET /admin/payment-provider` — the active gateway, the manual override and
 * both circuit breakers (admin only).
 */
export async function fetchPaymentRouting(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/admin/payment-provider`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `PUT /admin/payment-provider` — force a provider, or hand routing back to the
 * automatic failover with `auto`.
 *
 * The server requires `provider` (`present`), so `auto` is sent explicitly:
 * omitting the field is a 422, never a silent reset.
 */
export async function setPaymentProvider(
	provider: PaymentProviderChoice,
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/admin/payment-provider`, {
		method: 'PUT',
		headers: buildHeaders(token),
		body: JSON.stringify({ provider }),
	});
}

export default {
	fetchPaymentRouting,
	setPaymentProvider,
};
