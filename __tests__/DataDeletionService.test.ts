/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const DataDeletionService = require('@/services/DataDeletionService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('data deletion service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetches the admin queue with paging and filters', async () => {
		await DataDeletionService.fetchAdminDataDeletionRequests('token', {
			page: 2,
			perPage: 20,
			q: 'Grace Nakato',
			status: 'in_review',
		});
		const [url, init] = calls()[0];
		expect(url).toBe(
			'https://api.example/admin/data-deletion-requests?page=2&per_page=20&q=Grace+Nakato&status=in_review'
		);
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toBe('Bearer token');
	});

	test('fetches request details and matching logins', async () => {
		await DataDeletionService.fetchAdminDataDeletionRequest(14, 'token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/data-deletion-requests/14');
		expect(init.method).toBe('GET');
	});

	test('posts replies with their next status', async () => {
		const payload = { message: 'Please verify your email.', status: 'awaiting_user' };
		await DataDeletionService.replyToDataDeletionRequest(14, payload, 'token');
		const [url, init] = calls()[0];
		expect(url).toBe(
			'https://api.example/admin/data-deletion-requests/14/reply'
		);
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual(payload);
	});

	test('posts typed completion confirmation and optional login selection', async () => {
		const payload = {
			confirmation: 'DELETE',
			user_id: 8,
			notes: 'Verified with the requester.',
			send_email: true,
		};
		await DataDeletionService.completeDataDeletionRequest(14, payload, 'token');
		const [url, init] = calls()[0];
		expect(url).toBe(
			'https://api.example/admin/data-deletion-requests/14/complete'
		);
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual(payload);
	});

	test('posts rejection reason and email choice', async () => {
		const payload = { reason: 'Insufficient verification.', send_email: false };
		await DataDeletionService.rejectDataDeletionRequest(14, payload, 'token');
		const [url, init] = calls()[0];
		expect(url).toBe(
			'https://api.example/admin/data-deletion-requests/14/reject'
		);
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual(payload);
	});
});
