/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const ProfileService = require('@/services/ProfileService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('profile service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchProfile reads the login record', async () => {
		await ProfileService.fetchProfile('token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/profile');
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toBe('Bearer token');
	});

	test('fetchAvatarOptions reads the preset catalog', async () => {
		await ProfileService.fetchAvatarOptions('token');
		expect(calls()[0][0]).toBe('https://api.example/profile/avatars');
	});

	test('updateProfile PATCHes only the fields it is given', async () => {
		await ProfileService.updateProfile(
			{ name: 'Grace', email: 'grace@example.com', avatar: 'female-deep' },
			'token'
		);
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/profile');
		expect(init.method).toBe('PATCH');
		expect(JSON.parse(init.body)).toEqual({
			name: 'Grace',
			email: 'grace@example.com',
			avatar: 'female-deep',
		});
	});

	test('updatePassword sends the confirmation the server validates', async () => {
		await ProfileService.updatePassword(
			{
				current_password: 'old-secret',
				password: 'new-secret',
				password_confirmation: 'new-secret',
			},
			'token'
		);
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/password');
		expect(init.method).toBe('PUT');
		expect(JSON.parse(init.body)).toEqual({
			current_password: 'old-secret',
			password: 'new-secret',
			password_confirmation: 'new-secret',
		});
	});

	test('deleteAccount DELETEs with the password as confirmation', async () => {
		await ProfileService.deleteAccount('secret', 'token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/profile');
		expect(init.method).toBe('DELETE');
		expect(JSON.parse(init.body)).toEqual({ password: 'secret' });
	});
});
