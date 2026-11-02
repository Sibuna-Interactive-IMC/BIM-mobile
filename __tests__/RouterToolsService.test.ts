/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const RouterToolsService = require('@/services/RouterToolsService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('router tools service', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('diagnoseRouter always asks for one router', async () => {
		await RouterToolsService.diagnoseRouter({
			routerId: 'r-1',
			token: 'token',
		});
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/router-console/diagnose');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ scope: 'one', router_id: 'r-1' });
		expect(init.headers.Authorization).toContain('Bearer');
	});

	test('runRouterAction posts the action, scope and router', async () => {
		await RouterToolsService.runRouterAction(
			{ action: 'push-portal', scope: 'one', router_id: 'r-1' },
			'token'
		);
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/router-console/run');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			action: 'push-portal',
			scope: 'one',
			router_id: 'r-1',
		});
	});

	test('a destructive action carries the typed router name', async () => {
		await RouterToolsService.runRouterAction(
			{
				action: 'remove-duplicate-cookies',
				scope: 'one',
				router_id: 'r-1',
				confirmed: 'Orange Hostel',
			},
			'token'
		);
		const [, init] = calls()[0];
		expect(JSON.parse(init.body)).toMatchObject({
			action: 'remove-duplicate-cookies',
			confirmed: 'Orange Hostel',
		});
	});

	test('a raw command rides along as command_text', async () => {
		await RouterToolsService.runRouterAction(
			{
				action: 'send-command',
				scope: 'one',
				router_id: 'r-1',
				command_text: '/ip/hotspot/user/print',
			},
			'token'
		);
		const [, init] = calls()[0];
		expect(JSON.parse(init.body)).toMatchObject({
			action: 'send-command',
			command_text: '/ip/hotspot/user/print',
		});
	});

	test('preview omits fields it was not given', async () => {
		await RouterToolsService.previewRouterAction(
			{ action: 'push-portal', routerId: 'r-1', token: 'token' }
		);
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/router-console/preview');
		expect(JSON.parse(init.body)).toEqual({
			action: 'push-portal',
			router_id: 'r-1',
		});
	});

	test('a task log is read by id', async () => {
		await RouterToolsService.fetchRouterTaskLog(42, 'token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/admin/router-console/tasks/42');
		expect(init.method).toBe('GET');
	});
});
