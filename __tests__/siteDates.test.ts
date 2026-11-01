/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

// The helpers barrel touches expo/react-native modules; only the date
// conversions are under test here.
jest.mock('@/constants', () => ({
	phoneNumberLength: 12,
	countryCode: '+256',
}));
jest.mock('react-native', () => ({
	Platform: { OS: 'ios' },
	Alert: { alert: jest.fn() },
	ToastAndroid: { show: jest.fn() },
}));

const { parseApiDate, toApiDate } = require('@/helpers') as {
	parseApiDate: (value?: string | null) => Date | null;
	toApiDate: (date?: Date | null) => string | null;
};

describe('site date conversion', () => {
	test('parses the API date format into a local date', () => {
		const parsed = parseApiDate('2026-10-01');
		expect(parsed?.getFullYear()).toBe(2026);
		expect(parsed?.getMonth()).toBe(9);
		expect(parsed?.getDate()).toBe(1);
	});

	test('treats an empty date as unset', () => {
		expect(parseApiDate(null)).toBeNull();
		expect(parseApiDate(undefined)).toBeNull();
		expect(parseApiDate('')).toBeNull();
		expect(parseApiDate('not-a-date')).toBeNull();
	});

	test('formats a picked date back to YYYY-MM-DD', () => {
		expect(toApiDate(new Date(2026, 0, 5))).toBe('2026-01-05');
		expect(toApiDate(new Date(2026, 11, 31))).toBe('2026-12-31');
	});

	test('round-trips without drifting a day', () => {
		expect(toApiDate(parseApiDate('2026-03-29'))).toBe('2026-03-29');
		expect(toApiDate(null)).toBeNull();
	});
});
