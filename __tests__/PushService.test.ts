/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

jest.mock('@react-native-async-storage/async-storage', () => {
	const store: Record<string, string> = {};
	return {
		getItem: jest.fn(async (key: string) => store[key] ?? null),
		setItem: jest.fn(async (key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: jest.fn(async (key: string) => {
			delete store[key];
		}),
	};
});

const PushService = require('@/services/PushService');

function calls() {
	return mockApiFetch.mock.calls as any[];
}

describe('push device service', () => {
	beforeEach(async () => {
		mockApiFetch.mockClear();
		await PushService.forgetPushDevice();
	});

	test('registration posts the token upsert body', async () => {
		await PushService.registerPushDevice(
			{
				token: 'fcm-token',
				platform: 'android',
				device_id: 'device-1',
				app_version: '1.0.0',
				locale: 'en',
			},
			'token'
		);

		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/push-devices');
		expect(init.method).toBe('POST');
		expect(init.headers.Authorization).toContain('Bearer');
		expect(JSON.parse(init.body)).toEqual({
			token: 'fcm-token',
			platform: 'android',
			device_id: 'device-1',
			app_version: '1.0.0',
			locale: 'en',
		});
	});

	test('optional registration fields are omitted rather than sent as null', async () => {
		await PushService.registerPushDevice(
			{ token: 'fcm-token', platform: 'ios' },
			'token'
		);
		expect(JSON.parse(calls()[0][1].body)).toEqual({
			token: 'fcm-token',
			platform: 'ios',
		});
	});

	test('the device row is deleted by id', async () => {
		await PushService.removePushDevice('uuid-1', 'token');
		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/push-devices/uuid-1');
		expect(init.method).toBe('DELETE');
	});

	test('unregister removes the stored row and forgets it locally', async () => {
		await PushService.rememberPushDevice({
			token: 'fcm-token',
			deviceId: 'uuid-1',
		});

		await PushService.unregisterPushDevice('token');

		const [url, init] = calls()[0];
		expect(url).toBe('https://api.example/push-devices/uuid-1');
		expect(init.method).toBe('DELETE');
		expect(await PushService.storedPushDevice()).toBeNull();
	});

	test('unregister without a stored row does not call the API', async () => {
		await PushService.unregisterPushDevice('token');
		expect(mockApiFetch).not.toHaveBeenCalled();
	});

	test('a corrupt stored value is treated as "not registered"', async () => {
		const AsyncStorage = require('@react-native-async-storage/async-storage');
		await AsyncStorage.setItem('push_device', 'not-json');
		expect(await PushService.storedPushDevice()).toBeNull();
	});

	test('the install id is stable across calls', async () => {
		const first = await PushService.ensureInstallId();
		const second = await PushService.ensureInstallId();
		expect(first).toBe(second);
		expect(first).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
	});
});
