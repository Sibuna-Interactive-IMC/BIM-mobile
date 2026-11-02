/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const DocumentVerificationService = require('@/services/DocumentVerificationService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('document verification service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchAdminDocuments pages the review list with its filters', async () => {
		await DocumentVerificationService.fetchAdminDocuments('token', {
			page: 2,
			perPage: 20,
			q: '0772',
			status: 'pending',
			type: 'Passport',
		});
		const [url, init] = calls()[0];
		expect(url).toBe(
			'https://api.example/admin/documents?page=2&per_page=20&q=0772&status=pending&type=Passport'
		);
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toContain('Bearer');
	});

	test('fetchAdminDocuments omits empty filters', async () => {
		await DocumentVerificationService.fetchAdminDocuments('token', {
			status: '',
			q: '',
		});
		expect(calls()[0][0]).toBe('https://api.example/admin/documents');
	});

	test('approveDocument posts to the per-document action', async () => {
		await DocumentVerificationService.approveDocument('uuid-1', 'token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/documents/uuid-1/approve');
		expect(init.method).toBe('POST');
	});

	test('the file download carries the token and no JSON content type', async () => {
		await DocumentVerificationService.downloadDocumentFile('uuid-1', 'token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/documents/uuid-1/file');
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toBe('Bearer token');
		expect(init.headers['Content-Type']).toBeUndefined();
	});

	test('the owner flag is set with a boolean, both directions', async () => {
		await DocumentVerificationService.setUserDocumentsVerified(7, true, 'token');
		await DocumentVerificationService.setUserDocumentsVerified(7, false, 'token');

		const [verify, unverify] = calls();
		expect(verify[0]).toBe(
			'https://api.example/admin/users/7/documents-verification'
		);
		expect(verify[1].method).toBe('PATCH');
		expect(JSON.parse(verify[1].body)).toEqual({ verified: true });
		expect(JSON.parse(unverify[1].body)).toEqual({ verified: false });
	});
});
