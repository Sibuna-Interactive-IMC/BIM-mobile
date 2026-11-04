/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => [] })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const PackageService = require('@/services/PackageService');

describe('PackageService', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchPackages calls apiFetch with correct url and headers', async () => {
		await PackageService.fetchPackages();
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const url = call[0] as string;
		const init = call[1] as any;
		expect(url).toBe('https://api.example/packages');
		expect(init.method).toBe('GET');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(init.headers.Authorization).toBeUndefined();
	});

	test('fetchPackages includes Authorization when token provided', async () => {
		await PackageService.fetchPackages('ptoken');
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(init.headers.Authorization).toBe('Bearer ptoken');
	});

	test('fetchPortalPackages forwards pagination and scope', async () => {
		await PackageService.fetchPortalPackages('ptoken', {
			per_page: 100,
			scope: 'all',
		});
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe(
			'https://api.example/packages?per_page=100&scope=all'
		);
		expect(call[1].method).toBe('GET');
	});

	test('updatePackageRouters sends visibility and rate limits', async () => {
		await PackageService.updatePackageRouters(
			'pkg-1',
			{
				visible: ['router-1'],
				rate_limits: { 'router-1': '5M/5M' },
				reconnect_users: true,
			},
			'ptoken'
		);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/packages/pkg-1/routers');
		expect(call[1].method).toBe('PUT');
		expect(JSON.parse(call[1].body)).toEqual({
			visible: ['router-1'],
			rate_limits: { 'router-1': '5M/5M' },
			reconnect_users: true,
		});
	});

	test('trial settings use the router trial endpoint', async () => {
		await PackageService.updateTrialSettings(
			'router-1',
			{ enabled: true, duration_minutes: 15 },
			'ptoken'
		);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/packages/trial/router-1');
		expect(call[1].method).toBe('POST');
		expect(JSON.parse(call[1].body)).toEqual({
			enabled: true,
			duration_minutes: 15,
		});
	});

	test('createSharedProfile posts a shared plan', async () => {
		await PackageService.createSharedProfile(
			{
				name: 'DAILY_1000',
				no_of_users: 1,
				bandwidth: '4M/3M',
				duration: '24h',
				price: 1000,
			},
			'ptoken'
		);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/profiles');
		expect(call[1].method).toBe('POST');
		expect(JSON.parse(call[1].body)).toEqual({
			name: 'DAILY_1000',
			no_of_users: 1,
			bandwidth: '4M/3M',
			duration: '24h',
			price: 1000,
		});
	});
});
