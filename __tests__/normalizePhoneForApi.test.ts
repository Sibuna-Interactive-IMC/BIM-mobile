/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />
// Mock react-native to avoid importing native modules during tests
jest.mock('react-native', () => ({
	Platform: { OS: 'ios' },
	Alert: { alert: jest.fn() },
	ToastAndroid: { show: jest.fn() },
}));

// Mock the constants module to control the default country code used by the helper
jest.mock('@/constants', () => ({
	phoneNumberLength: 12,
	countryCode: '+256',
}));

// Require the helper after mocks so imports don't pull real native modules
const { normalizePhoneForApi } = require('@/helpers') as {
	normalizePhoneForApi: (p?: string | null) => string;
};

describe('normalizePhoneForApi', () => {
	test('returns empty string for null/undefined/empty', () => {
		expect(normalizePhoneForApi(undefined)).toBe('');
		expect(normalizePhoneForApi(null)).toBe('');
		expect(normalizePhoneForApi('')).toBe('');
	});

	test('preserves already E.164 formatted numbers (leading +)', () => {
		expect(normalizePhoneForApi('+256789244866')).toBe('256789244866');
		// with spaces and symbols
		expect(normalizePhoneForApi('+256 789 244 866')).toBe('256789244866');
	});

	test("converts numbers starting with '00' to +international", () => {
		expect(normalizePhoneForApi('00256789244866')).toBe('256789244866');
		expect(normalizePhoneForApi('00 256 789 244 866')).toBe('256789244866');
	});

	test('strips local trunk 0 and prepends default country code', () => {
		expect(normalizePhoneForApi('0789244866')).toBe('256789244866');
		expect(normalizePhoneForApi(' 0789 244 866 ')).toBe('256789244866');
	});

	test('prepends country code when missing and number not starting with local 0', () => {
		expect(normalizePhoneForApi('789244866')).toBe('256789244866');
	});

	test('if digits already start with country code (no +), just add +', () => {
		expect(normalizePhoneForApi('256789244866')).toBe('256789244866');
	});
});
