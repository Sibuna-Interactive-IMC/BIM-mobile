// Mock react-native to avoid importing native modules during tests
jest.mock('react-native', () => ({
	Platform: { OS: 'ios' },
	Alert: { alert: jest.fn() },
	ToastAndroid: { show: jest.fn() },
}));

jest.mock('@/constants', () => ({
	countryCode: '+256',
	phoneNumberLength: 9,
}));

import { normalizePhoneForApi } from '@/helpers';

describe('normalizePhoneForApi (regression)', () => {
	test('strips leading + and returns digits only', () => {
		expect(normalizePhoneForApi('+256772123456')).toBe('256772123456');
	});

	test('converts leading 00 international prefix', () => {
		expect(normalizePhoneForApi('00 256 772 123456')).toBe('256772123456');
		expect(normalizePhoneForApi('00256772123456')).toBe('256772123456');
	});

	test('removes local trunk zero and prepends default country code', () => {
		// with mocked countryCode +256, a local phone 0772123456 becomes 256772123456
		expect(normalizePhoneForApi('0772123456')).toBe('256772123456');
	});

	test('prepends country code when missing', () => {
		expect(normalizePhoneForApi('772123456')).toBe('256772123456');
	});

	test('returns empty string for falsy input', () => {
		expect(normalizePhoneForApi('')).toBe('');
		expect(normalizePhoneForApi(null)).toBe('');
		expect(normalizePhoneForApi(undefined)).toBe('');
	});
});
