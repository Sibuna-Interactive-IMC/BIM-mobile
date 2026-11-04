/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

// Mock the API base URL used by the service
jest.mock('@/constants/API', () => ({
	apiBaseUrl: 'https://api.example',
}));

// Mock the apiFetch helper so we can assert it's called correctly
const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const UserService = require('@/services/UserService');

describe('UserService', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchDashboard calls apiFetch with correct url and headers', async () => {
		await UserService.fetchDashboard();
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const url = call[0] as string;
		const init = call[1] as any;
		expect(url).toBe('https://api.example/dashboard');
		expect(init).toBeDefined();
		expect(init.method).toBe('GET');
		expect(init.headers['Content-Type']).toBe('application/json');
		// no Authorization header when token not provided
		expect(init.headers.Authorization).toBeUndefined();
	});

	test('fetchDashboard includes Authorization when token provided', async () => {
		await UserService.fetchDashboard('mytoken');
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(init.headers.Authorization).toBe('Bearer mytoken');
	});

	test('fetchPurchases and fetchDocuments call correct endpoints', async () => {
		await UserService.fetchPurchases('t1');
		await UserService.fetchDocuments('t2');
		expect(mockApiFetch).toHaveBeenCalledTimes(2);

		const call0 = (mockApiFetch.mock.calls[0] as any[]) || [];
		const purchasesUrl = call0[0] as string;
		const purchasesInit = call0[1] as any;
		expect(purchasesUrl).toBe('https://api.example/transactions');
		expect(purchasesInit.headers.Authorization).toBe('Bearer t1');

		const call1 = (mockApiFetch.mock.calls[1] as any[]) || [];
		const docsUrl = call1[0] as string;
		const docsInit = call1[1] as any;
		expect(docsUrl).toBe('https://api.example/documents');
		expect(docsInit.headers.Authorization).toBe('Bearer t2');
	});

	test('fetchPurchases serialises filters and paging', async () => {
		await UserService.fetchPurchases('t1', {
			start_date: '2026-10-01',
			end_date: '2026-10-31',
			status: 'successful',
			type: 'credit',
			page: 3,
			per_page: 20,
		});

		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe(
			'https://api.example/transactions?start_date=2026-10-01&end_date=2026-10-31&status=successful&type=credit&page=3&per_page=20'
		);
		expect((call[1] as any).method).toBe('GET');
	});

	test('fetchPurchases skips empty filter values', async () => {
		await UserService.fetchPurchases('t1', { status: '', type: 'credit' });

		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		expect(call[0]).toBe('https://api.example/transactions?type=credit');
	});
});
