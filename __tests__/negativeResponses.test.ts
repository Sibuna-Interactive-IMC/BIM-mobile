/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

// Mock expo-constants to prevent native module errors
jest.mock('expo-constants', () => ({
	manifest: { extra: {} },
	expoConfig: { extra: {} },
}));

// Prevent importing expo-constants during tests
jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

// We'll swap the apiFetch mock per test to return non-ok responses
const mockApiFetch = jest.fn();
jest.mock('@/helpers/api', () => ({
	apiFetch: (...args: any[]) => mockApiFetch(...args),
	parseApiError: jest.requireActual('@/helpers/api').parseApiError,
}));

const AuthService = require('@/services/AuthService');
const UserService = require('@/services/UserService');
const { parseApiError } = require('@/helpers/api');

describe('Negative API responses propagate and parseApiError handles them', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('AuthService.login returns non-ok response and parseApiError extracts message', async () => {
		const body = { errors: { phone: ['invalid'], password: ['too short'] } };
		const fakeRes = {
			ok: false,
			status: 400,
			headers: { get: () => 'application/json' },
			json: async () => body,
			text: async () => JSON.stringify(body),
		} as unknown as Response;

		mockApiFetch.mockResolvedValueOnce(fakeRes);

		const res = await AuthService.login('+100', 'x');
		expect(res).toBe(fakeRes);
		expect(res.ok).toBe(false);

		const msg = await parseApiError(res as Response);
		expect(msg).toContain('phone: invalid');
		expect(msg).toContain('password: too short');
	});

	test('UserService.fetchDocuments returns non-ok and parseApiError extracts message', async () => {
		const body = { message: 'Not authorized' };
		const fakeRes = {
			ok: false,
			status: 401,
			headers: { get: () => 'application/json' },
			json: async () => body,
			text: async () => JSON.stringify(body),
		} as unknown as Response;

		mockApiFetch.mockResolvedValueOnce(fakeRes);

		const res = await UserService.fetchDocuments('tok');
		expect(res).toBe(fakeRes);
		expect(res.ok).toBe(false);

		const msg = await parseApiError(res as Response);
		expect(msg).toBe('Not authorized');
	});
});
