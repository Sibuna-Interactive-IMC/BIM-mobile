/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const AuthService = require('@/services/AuthService');

describe('AuthService', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('login posts to /login with phone and password', async () => {
		await AuthService.login('+256789244866', 'pass');
		expect(mockApiFetch).toHaveBeenCalledTimes(1);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const url = call[0];
		const init = call[1] as any;
		expect(url).toBe('https://api.example/login');
		expect(init.method).toBe('POST');
		const body = JSON.parse(init.body as string);
		expect(body.phone).toBe('+256789244866');
		expect(body.password).toBe('pass');
	});

	test('register posts to /register with payload', async () => {
		await AuthService.register({
			phone: '+2561',
			password: 'p',
			name: 'Bob',
			email: 'b@b',
		});
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		const body = JSON.parse(init.body as string);
		expect(body.phone).toBe('+2561');
		expect(body.password).toBe('p');
		expect(body.password_confirmation).toBe('p');
		expect(body.name).toBe('Bob');
		expect(body.email).toBe('b@b');
	});

	test('verifyOtp posts to /verify-otp', async () => {
		const payload = { phone: '+1', otp: '1234' };
		await AuthService.verifyOtp(payload);
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(JSON.parse(init.body as string)).toMatchObject(payload);
	});

	test('verify2fa posts to /2fa-verify', async () => {
		await AuthService.verify2fa('+1', '0000');
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(JSON.parse(init.body as string)).toMatchObject({
			phone: '+1',
			otp: '0000',
		});
	});

	test('setupTotp posts to /2fa-setup', async () => {
		await AuthService.setupTotp({ setup_token: 't', secret: 's', otp: 'o' });
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(JSON.parse(init.body as string)).toMatchObject({
			setup_token: 't',
			secret: 's',
			otp: 'o',
		});
	});

	test('logout posts to /logout with Authorization header', async () => {
		await AuthService.logout('token-x');
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const init = call[1] as any;
		expect(init.headers.Authorization).toBe('Bearer token-x');
	});

	test('getAuthToken builds query url with phone and password', async () => {
		await AuthService.getAuthToken({ phone: '+1', password: 'pw' });
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const url = call[0] as string;
		expect(url).toContain('/auth/token');
		expect(url).toContain('phone=+1');
		expect(url).toContain('password?=pw');
	});

	test('verifyToken calls GET /token/verify with Authorization header', async () => {
		await AuthService.verifyToken('tok-1');
		const call = (mockApiFetch.mock.calls[0] as any[]) || [];
		const url = call[0] as string;
		const init = call[1] as any;
		expect(url).toBe('https://api.example/token/verify');
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toBe('Bearer tok-1');
	});
});
