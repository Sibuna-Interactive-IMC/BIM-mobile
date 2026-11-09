import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { DocumentStatus } from '@/types';

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
 * `GET /admin/documents` — every document uploaded by an owner, for review.
 *
 * `ApiResponse::paginated`, so the rows are at the top level under `documents`
 * with the paging block next to them as `documents_metadata`.
 */
export async function fetchAdminDocuments(
	token?: string,
	{
		page,
		perPage,
		q,
		status,
		type,
		userId,
	}: {
		page?: number;
		perPage?: number;
		q?: string;
		status?: DocumentStatus | '';
		type?: string;
		userId?: number;
	} = {}
) {
	const qs = toQueryString({
		page,
		per_page: perPage,
		q,
		status,
		type,
		user: userId,
	});
	return apiFetch(`${apiBaseUrl || ''}/admin/documents${qs}`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `POST /documents/{document}/approve` — admin/staff only; approves the
 * document and marks its owner documents-verified.
 */
export async function approveDocument(documentId: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/documents/${encodeURIComponent(documentId)}/approve`,
		{ method: 'POST', headers: buildHeaders(token) }
	);
}

/** `POST /documents/{document}/reject` — admin/staff only; flips the status. */
export async function rejectDocument(documentId: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/documents/${encodeURIComponent(documentId)}/reject`,
		{ method: 'POST', headers: buildHeaders(token) }
	);
}

/** `DELETE /documents/{document}` — removes the document record. */
export async function deleteDocument(documentId: string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/documents/${encodeURIComponent(documentId)}`,
		{ method: 'DELETE', headers: buildHeaders(token) }
	);
}

/**
 * `GET /documents/{document}/file` — the uploaded file itself.
 *
 * The route needs the bearer token, so the screen reads the blob and turns it
 * into a data URI instead of pointing a viewer at it.
 */
export async function downloadDocumentFile(documentId: string, token?: string) {
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	return apiFetch(
		`${apiBaseUrl || ''}/documents/${encodeURIComponent(documentId)}/file`,
		{ method: 'GET', headers }
	);
}

/**
 * `PATCH /admin/users/{user}/documents-verification` — the per-owner flag this
 * page exists to support. Approving a single document does not set it.
 */
export async function setUserDocumentsVerified(
	userId: number,
	verified: boolean,
	token?: string
) {
	return apiFetch(
		`${apiBaseUrl || ''}/admin/users/${encodeURIComponent(userId)}/documents-verification`,
		{
			method: 'PATCH',
			headers: buildHeaders(token),
			body: JSON.stringify({ verified }),
		}
	);
}

export default {
	fetchAdminDocuments,
	approveDocument,
	rejectDocument,
	deleteDocument,
	downloadDocumentFile,
	setUserDocumentsVerified,
};
