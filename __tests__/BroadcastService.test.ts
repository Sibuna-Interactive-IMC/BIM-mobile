/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const BroadcastService = require('@/services/BroadcastService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('broadcast service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchBroadcasts pages the history with its filters', async () => {
		await BroadcastService.fetchBroadcasts('token', {
			page: 2,
			perPage: 20,
			q: 'maintenance',
			status: 'sent',
			audience: 'site',
			routerId: 'r-1',
			from: '2026-10-01',
			to: '2026-10-31',
		});
		const [url, init] = calls()[0];
		expect(url).toBe(
			'https://api.example/admin/broadcasts?page=2&per_page=20&q=maintenance&status=sent&audience=site&router_id=r-1&from=2026-10-01&to=2026-10-31'
		);
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toContain('Bearer');
	});

	test('previewRecipients posts the audience and never the exclusions', async () => {
		await BroadcastService.previewRecipients(
			{
				audience: 'site',
				router_id: 'r-1',
				date_from: '2026-10-01',
				date_to: null,
				purchases_operator: 'gt',
				purchases_count: 2,
				q: '0772',
				message: 'Hello',
			},
			'token'
		);
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/broadcasts/recipients');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			audience: 'site',
			router_id: 'r-1',
			date_from: '2026-10-01',
			purchases_operator: 'gt',
			purchases_count: 2,
			q: '0772',
			message: 'Hello',
		});
	});

	test('a single-number audience sends the phone and drops the date filters', async () => {
		await BroadcastService.previewRecipients(
			{
				audience: 'single',
				phone: '256772494949',
				// Stale composer state must not reach the server for this audience.
				date_from: '2026-10-01',
				purchases_operator: 'lt',
				purchases_count: 3,
			},
			'token'
		);
		const [, init] = calls()[0];
		expect(JSON.parse(init.body)).toEqual({
			audience: 'single',
			phone: '256772494949',
		});
	});

	test('queueBroadcast confirms the recipient count and forwards exclusions', async () => {
		await BroadcastService.queueBroadcast(
			{
				audience: 'all',
				message: 'Hello',
				recipients_total: 3,
				excluded: ['256772494949'],
				template_id: 9,
			},
			'token'
		);
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/broadcasts');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			audience: 'all',
			message: 'Hello',
			recipients_total: 3,
			excluded: ['256772494949'],
			template_id: 9,
		});
	});

	test('fetchBroadcast filters the per-recipient outcome', async () => {
		await BroadcastService.fetchBroadcast(12, 'token', {
			page: 3,
			status: 'failed',
			q: '0772',
		});
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/broadcasts/12?page=3&q=0772&status=failed');
		expect(init.method).toBe('GET');
	});

	test('templates are listed, created and deleted', async () => {
		await BroadcastService.fetchBroadcastTemplates('token');
		await BroadcastService.createBroadcastTemplate(
			{ name: 'Notice', body: 'Maintenance tonight' },
			'token'
		);
		await BroadcastService.deleteBroadcastTemplate(4, 'token');

		const [list, create, remove] = calls();
		expect(list[0]).toBe('https://api.example/admin/broadcasts/templates');
		expect(list[1].method).toBe('GET');
		expect(create[1].method).toBe('POST');
		expect(JSON.parse(create[1].body)).toEqual({
			name: 'Notice',
			body: 'Maintenance tonight',
		});
		expect(remove[0]).toBe('https://api.example/admin/broadcasts/templates/4');
		expect(remove[1].method).toBe('DELETE');
	});
});
