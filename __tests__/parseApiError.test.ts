/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

// Mock expo-constants to prevent native module errors
jest.mock('expo-constants', () => ({
	manifest: { extra: {} },
	expoConfig: { extra: {} },
}));

// Prevent importing real expo/native modules by mocking our API constants module
jest.mock('@/constants/API', () => ({ apiBaseUrl: undefined }));

const { parseApiError } = require('@/helpers/api') as {
	parseApiError: (res: Response) => Promise<string>;
};

describe('parseApiError', () => {
	test('parses { errors: { field: [..] } } shape', async () => {
		const body = { errors: { name: ['is required'], email: ['invalid'] } };
		const res = {
			headers: { get: () => 'application/json' },
			json: async () => body,
			text: async () => JSON.stringify(body),
			status: 400,
		} as unknown as Response;

		const msg = await parseApiError(res);
		expect(msg).toContain('name: is required');
		expect(msg).toContain('email: invalid');
	});

	test('parses { message: string }', async () => {
		const body = { message: 'Something went wrong' };
		const res = {
			headers: { get: () => 'application/json' },
			json: async () => body,
			text: async () => JSON.stringify(body),
			status: 422,
		} as unknown as Response;

		const msg = await parseApiError(res);
		expect(msg).toBe('Something went wrong');
	});

	test('parses { error: string }', async () => {
		const body = { error: 'unauthorized' };
		const res = {
			headers: { get: () => 'application/json' },
			json: async () => body,
			text: async () => JSON.stringify(body),
			status: 401,
		} as unknown as Response;

		const msg = await parseApiError(res);
		expect(msg).toBe('unauthorized');
	});

	test('falls back to stringifying simple JSON objects', async () => {
		const body = { foo: 'bar' };
		const res = {
			headers: { get: () => 'application/json' },
			json: async () => body,
			text: async () => JSON.stringify(body),
			status: 400,
		} as unknown as Response;

		const msg = await parseApiError(res);
		expect(msg).toBe(JSON.stringify(body));
	});

	test('returns plain text when content-type is text/plain', async () => {
		const res = {
			headers: { get: () => 'text/plain' },
			json: async () => {
				throw new Error('not-json');
			},
			text: async () => 'plain error',
			status: 500,
		} as unknown as Response;

		const msg = await parseApiError(res);
		expect(msg).toBe('plain error');
	});

	test('returns generic HTTP message when parsing fails', async () => {
		const res = {
			headers: { get: () => 'application/json' },
			json: async () => {
				throw new Error('boom');
			},
			text: async () => {
				throw new Error('boom2');
			},
			status: 502,
		} as unknown as Response;

		const msg = await parseApiError(res);
		expect(msg).toBe('HTTP error 502');
	});
});
