/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />
// Mock constants to avoid importing expo native modules during tests
jest.mock('@/constants', () => ({
	phoneNumberLength: 12,
	countryCode: '+256',
}));

// Mock react-native to avoid importing native modules during tests
jest.mock('react-native', () => ({
	Platform: { OS: 'ios' },
	Alert: { alert: jest.fn() },
	ToastAndroid: { show: jest.fn() },
}));

// Require helper after mocks
const { parseAmount } = require('@/helpers') as {
	parseAmount: (v?: any) => number;
};

describe('parseAmount', () => {
	test('parses numeric strings with commas and spaces', () => {
		expect(parseAmount('27,200.00')).toBe(27200);
		expect(parseAmount(' 27 200.00 ')).toBe(27200);
	});

	test('parses integer strings and numbers', () => {
		expect(parseAmount('1000')).toBe(1000);
		expect(parseAmount(1234)).toBe(1234);
	});

	test('returns NaN for null/undefined/invalid', () => {
		expect(Number.isNaN(parseAmount(null))).toBe(true);
		expect(Number.isNaN(parseAmount(undefined))).toBe(true);
		expect(Number.isNaN(parseAmount('abc'))).toBe(true);
	});

	test('parses negative numbers and decimals', () => {
		expect(parseAmount('-1,234.56')).toBe(-1234.56);
		expect(parseAmount('0.00')).toBe(0);
	});
});
