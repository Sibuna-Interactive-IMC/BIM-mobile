/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => [] })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const VoucherService = require('@/services/VoucherService');

describe('VoucherService', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchVouchers serialises the filters and paging', async () => {
		await VoucherService.fetchVouchers(
			{
				status: 'online',
				search: '  12345 ',
				router: 'router-1',
				profile: 'DAILY_1000',
				origin: 'manual',
				sort: 'last_auth',
				dir: 'desc',
				page: 2,
				perPage: 20,
			},
			'token'
		);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe(
			'https://api.example/vouchers?status=online&search=12345&router=router-1&profile=DAILY_1000&origin=manual&sort=last_auth&dir=desc&page=2&per_page=20'
		);
		expect(call[1].method).toBe('GET');
		expect(call[1].headers.Authorization).toBe('Bearer token');
	});

	test('fetchVouchers omits empty filters', async () => {
		await VoucherService.fetchVouchers(
			{ status: null, search: '   ', profile: '', router: '' },
			'token'
		);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/vouchers');
	});

	test('fetchVoucherRouters pages the router picker', async () => {
		await VoucherService.fetchVoucherRouters('token', { perPage: 100 });
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/vouchers/routers?per_page=100');
		expect(call[1].method).toBe('GET');
	});

	test('fetchVoucherHotspots scopes to the router', async () => {
		await VoucherService.fetchVoucherHotspots('router-1', 'token');
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/vouchers/router-1/hotspots');
		expect(call[1].method).toBe('GET');
	});

	test('generateVouchers posts the bulk generator payload', async () => {
		await VoucherService.generateVouchers(
			'router-1',
			{ numberOfUsers: 25, profile: 'DAILY_1000', hotspotServer: 'BIM' },
			'token'
		);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/vouchers/router-1/generate');
		expect(call[1].method).toBe('POST');
		expect(call[1].headers.Authorization).toContain('Bearer');
		expect(JSON.parse(call[1].body)).toEqual({
			number_of_users: 25,
			profile: 'DAILY_1000',
			hotspot_server: 'BIM',
		});
	});

	test('voucher actions target the username scoped endpoints', async () => {
		await VoucherService.disableVoucherUser('12345', 'token');
		await VoucherService.enableVoucherUser('12345', 'token');
		await VoucherService.resetVoucherUser('12345', 'token');
		await VoucherService.deleteVoucherUser('12345', 'token');

		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/vouchers/users/12345/disable',
			'https://api.example/vouchers/users/12345/enable',
			'https://api.example/vouchers/users/12345/reset-unused',
			'https://api.example/vouchers/users/12345/delete',
		]);
		expect(calls.map((call) => call[1].method)).toEqual([
			'POST',
			'POST',
			'POST',
			'DELETE',
		]);
	});
});
