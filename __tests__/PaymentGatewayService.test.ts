/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const PaymentGatewayService = require('@/services/PaymentGatewayService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('payment gateway service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchPaymentRouting reads the admin endpoint', async () => {
		await PaymentGatewayService.fetchPaymentRouting('token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/payment-provider');
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toContain('Bearer');
	});

	test('setPaymentProvider forces a provider with a PUT', async () => {
		await PaymentGatewayService.setPaymentProvider('yo', 'token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/payment-provider');
		expect(init.method).toBe('PUT');
		expect(JSON.parse(init.body)).toEqual({ provider: 'yo' });
	});

	test('clearing the override sends "auto" instead of omitting the field', async () => {
		await PaymentGatewayService.setPaymentProvider('auto', 'token');
		const [, init] = calls()[0];
		expect(JSON.parse(init.body)).toEqual({ provider: 'auto' });
	});
});
