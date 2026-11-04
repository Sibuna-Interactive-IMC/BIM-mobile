/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => [] })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const RouterService = require('@/services/RouterService');

describe('RouterService', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchRouters calls apiFetch with correct url and headers', async () => {
		await RouterService.fetchRouters();
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const url = call[0] as string;
		const init = call[1] as any;
		expect(url).toBe('https://api.example/routers');
		expect(init.method).toBe('GET');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(init.headers.Authorization).toBeUndefined();
	});

	test('fetchRouters includes Authorization when token provided', async () => {
		await RouterService.fetchRouters('rtoken');
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(init.headers.Authorization).toBe('Bearer rtoken');
	});

	test('getRouterInterfaces calls the router interfaces endpoint', async () => {
		await RouterService.getRouterInterfaces('router-1', 'rtoken');
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/routers/router-1/interfaces');
		expect(call[1].method).toBe('GET');
		expect(call[1].headers.Authorization).toBe('Bearer rtoken');
	});
});
