/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const InboxService = require('@/services/InboxService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('inbox service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('the inbox is paged with its filters', async () => {
		await InboxService.fetchInbox('token', {
			status: 'unread',
			category: 'approval.withdrawal',
			page: 2,
			perPage: 20,
		});

		const [url, init] = calls()[0];
		expect(url).toBe(
			'https://api.example/inbox?status=unread&category=approval.withdrawal&page=2&per_page=20'
		);
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toContain('Bearer');
	});

	test('empty filters are omitted', async () => {
		await InboxService.fetchInbox('token', { status: 'all', category: '' });
		expect(calls()[0][0]).toBe('https://api.example/inbox?status=all');
	});

	test('the unread count is a plain get', async () => {
		await InboxService.fetchInboxUnreadCount('token');
		expect(calls()[0][0]).toBe('https://api.example/inbox/unread-count');
		expect(calls()[0][1].method).toBe('GET');
	});

	test('marking read is a post on the row', async () => {
		await InboxService.markInboxRead('uuid-1', 'token');
		expect(calls()[0][0]).toBe('https://api.example/inbox/uuid-1/read');
		expect(calls()[0][1].method).toBe('POST');
	});

	test('the channel matrix is read from the settings endpoint', async () => {
		await InboxService.fetchInboxSettings('token');
		expect(calls()[0][0]).toBe('https://api.example/inbox/settings');
		expect(calls()[0][1].method).toBe('GET');
	});

	test('a preference is saved as a single-entry patch', async () => {
		await InboxService.saveInboxSettings(
			[{ category: 'approval.withdrawal', channel: 'fcm', enabled: false }],
			'token'
		);

		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/inbox/settings');
		expect(init.method).toBe('PATCH');
		expect(JSON.parse(init.body)).toEqual({
			preferences: [
				{ category: 'approval.withdrawal', channel: 'fcm', enabled: false },
			],
		});
	});
});
