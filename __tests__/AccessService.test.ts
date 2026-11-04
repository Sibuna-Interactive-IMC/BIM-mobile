/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const AccessService = require('@/services/AccessService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('access management service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchAccess pages the invitations endpoint', async () => {
		await AccessService.fetchAccess('token', { page: 2, perPage: 10 });
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/invitations?page=2&per_page=10');
		expect(init.method).toBe('GET');
		expect(init.headers.Authorization).toContain('Bearer');
	});

	test('inviteUser posts the seat payload', async () => {
		await AccessService.inviteUser(
			{ email: 'finance@example.com', role: 'Finance', is_cosignatory: true },
			'token'
		);
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/invitations');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			email: 'finance@example.com',
			role: 'Finance',
			is_cosignatory: true,
		});
	});

	test('revokeInvitation and removeAccountMember delete by id', async () => {
		await AccessService.revokeInvitation(7, 'token');
		await AccessService.removeAccountMember(42, 'token');

		const [revoke, remove] = calls();
		expect(revoke[0]).toBe('https://api.example/invitations/7');
		expect(revoke[1].method).toBe('DELETE');
		expect(remove[0]).toBe('https://api.example/invitations/users/42');
		expect(remove[1].method).toBe('DELETE');
	});
});
