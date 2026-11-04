/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => [] })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const BankService = require('@/services/BankService');

describe('BankService', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchBanks calls apiFetch with correct url and headers', async () => {
		await BankService.fetchBanks();
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const url = call[0] as string;
		const init = call[1] as any;
		expect(url).toBe('https://api.example/banks');
		expect(init.method).toBe('GET');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(init.headers.Authorization).toBeUndefined();
	});

	test('fetchBanks includes Authorization when token provided', async () => {
		await BankService.fetchBanks('btoken');
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(init.headers.Authorization).toBe('Bearer btoken');
	});
});
