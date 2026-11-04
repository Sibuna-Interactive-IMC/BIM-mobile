import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { WithdrawalRequestPayload } from '@/types';

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
 * `GET /accounts/summary` — every tile number the Accounts hub shows.
 * Admin/staff figures come back null for callers who cannot open those pages.
 */
export async function fetchAccountsSummary(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/accounts/summary`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /withdrawals/approvals` — mine to approve, plus the ones I initiated. */
export async function fetchWithdrawalApprovals(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/withdrawals/approvals`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `POST /withdrawals/approvals/{approval}/approve` */
export async function approveWithdrawal(approvalId: number, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/withdrawals/approvals/${approvalId}/approve`,
		{ method: 'POST', headers: buildHeaders(token) }
	);
}

/** `POST /withdrawals/approvals/{approval}/reject` */
export async function rejectWithdrawal(
	approvalId: number,
	comment: string | undefined,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/withdrawals/approvals/${approvalId}/reject`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify({ comment: comment ?? null }),
		}
	);
}

/** `POST /withdrawals/{transaction}/retract` — pull back a pending request. */
export async function retractWithdrawal(
	transactionId: string,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/withdrawals/${encodeURIComponent(transactionId)}/retract`,
		{ method: 'POST', headers: buildHeaders(token) }
	);
}

/**
 * `POST /withdrawals/{router}` — the two-step owner withdrawal. The first call
 * sends `request_otp`; the second sends the `otp` plus its `reference`.
 */
export async function requestWithdrawal(
	routerId: string,
	payload: WithdrawalRequestPayload,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/withdrawals/${encodeURIComponent(routerId)}`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify(payload),
		}
	);
}

/** `GET /disbursement-records` */
export async function fetchDisbursementRecords(
	token?: string,
	{
		router,
		dateFrom,
		dateTo,
		hasNarration,
		page,
		perPage,
	}: {
		router?: string;
		dateFrom?: string;
		dateTo?: string;
		hasNarration?: 'yes' | 'no';
		page?: number;
		perPage?: number;
	} = {}
) {
	const qs = toQueryString({
		router,
		date_from: dateFrom,
		date_to: dateTo,
		has_narration: hasNarration,
		page,
		per_page: perPage,
	});
	return apiFetch(`${apiBaseUrl || ''}/disbursement-records${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /disbursement-records/{record}/documents` */
export async function fetchDisbursementDocuments(
	recordId: string,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/disbursement-records/${encodeURIComponent(recordId)}/documents`,
		{ method: 'GET', headers: buildHeaders(token) }
	);
}

/** `POST /disbursement-records/{record}/documents` — multipart upload. */
export async function uploadDisbursementDocument(
	recordId: string,
	form: FormData,
	token?: string
) {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (token) headers.Authorization = `Bearer ${token}`;
	// No Content-Type: the runtime must add the multipart boundary itself.
	return apiFetch(
		`${apiBaseUrl || ''}/disbursement-records/${encodeURIComponent(recordId)}/documents`,
		{ method: 'POST', headers, body: form }
	);
}

/** `DELETE /disbursement-records/{record}/documents/{document}` */
export async function deleteDisbursementDocument(
	recordId: string,
	documentId: number | string,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/disbursement-records/${encodeURIComponent(recordId)}/documents/${documentId}`,
		{ method: 'DELETE', headers: buildHeaders(token) }
	);
}

/**
 * `GET /disbursement-records/{record}/documents/{document}` — the file itself.
 * The API requires the bearer token, so previews are fetched here and turned
 * into a data URI instead of pointing an `<Image>` at `document.url`.
 */
export async function downloadDisbursementDocument(
	recordId: string,
	documentId: number | string,
	token?: string
) {
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	return apiFetch(
		`${apiBaseUrl || ''}/disbursement-records/${encodeURIComponent(recordId)}/documents/${documentId}`,
		{ method: 'GET', headers }
	);
}

/** `GET /analytics/business/summary` */
export async function fetchBusinessSummary(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/analytics/business/summary`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `GET /analytics/profit` — snapshot, approvals awaiting me, and history. */
export async function fetchProfit(token?: string, historyPage?: number) {
	const qs = toQueryString({ history_page: historyPage });
	return apiFetch(`${apiBaseUrl || ''}/analytics/profit${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/** `POST /analytics/profit/withdrawals` — ask for the OTP that guards a payout. */
export async function requestProfitOtp(
	payload: {
		amount: number;
		provider: 'yo' | 'relworx';
		recipientMsisdn: string;
	},
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/analytics/profit/withdrawals`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({
			amount: payload.amount,
			provider: payload.provider,
			recipient_msisdn: payload.recipientMsisdn,
			request_otp: true,
		}),
	});
}

/** `POST /analytics/profit/withdrawals` — second step, with the OTP and its reference. */
export async function requestProfitWithdrawal(
	payload: {
		amount: number;
		provider: 'yo' | 'relworx';
		recipientMsisdn: string;
		otp: string;
		reference: string;
	},
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/analytics/profit/withdrawals`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({
			amount: payload.amount,
			provider: payload.provider,
			recipient_msisdn: payload.recipientMsisdn,
			otp: payload.otp,
			reference: payload.reference,
		}),
	});
}

/** `POST /analytics/profit/approvals/{approval}/approve` */
export async function approveProfitWithdrawal(
	approvalId: number,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/analytics/profit/approvals/${approvalId}/approve`,
		{ method: 'POST', headers: buildHeaders(token) }
	);
}

/** `POST /analytics/profit/approvals/{approval}/reject` */
export async function rejectProfitWithdrawal(
	approvalId: number,
	comment: string | undefined,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/analytics/profit/approvals/${approvalId}/reject`,
		{
			method: 'POST',
			headers: buildHeaders(token),
			body: JSON.stringify({ comment: comment ?? null }),
		}
	);
}

/** `POST /analytics/profit/withdrawals/{withdrawal}/retract` */
export async function retractProfitWithdrawal(
	withdrawalId: string,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/analytics/profit/withdrawals/${encodeURIComponent(
			withdrawalId
		)}/retract`,
		{ method: 'POST', headers: buildHeaders(token) }
	);
}

export default {
	fetchAccountsSummary,
	fetchWithdrawalApprovals,
	approveWithdrawal,
	rejectWithdrawal,
	retractWithdrawal,
	fetchDisbursementRecords,
	requestWithdrawal,
	fetchDisbursementDocuments,
	uploadDisbursementDocument,
	deleteDisbursementDocument,
	downloadDisbursementDocument,
	fetchBusinessSummary,
	fetchProfit,
	requestProfitOtp,
	requestProfitWithdrawal,
	approveProfitWithdrawal,
	rejectProfitWithdrawal,
	retractProfitWithdrawal,
};
