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

const { formatShortDateTime } = require('@/helpers') as {
	formatShortDateTime: (value?: string | null) => string;
};

const pad = (value: number) => `${value}`.padStart(2, '0');

describe('formatShortDateTime', () => {
	// The API sends Carbon's `d M Y, H:i` and FreeRADIUS' `d M Y H:i:s`; both
	// collapse to the tile-friendly `dd-mm-yy hh:mm` (local time).
	const expected = (year: number, month: number, day: number, h = 10, m = 54) =>
		`${pad(day)}-${pad(month + 1)}-${pad(year % 100)} ${pad(h)}:${pad(m)}`;

	test('shortens Carbon formatted voucher dates', () => {
		expect(formatShortDateTime('05 Nov 2026, 10:54')).toBe(
			expected(2026, 10, 5)
		);
		expect(formatShortDateTime('31 Dec 2025, 23:07')).toBe(
			expected(2025, 11, 31, 23, 7)
		);
	});

	test('shortens FreeRADIUS expiration values', () => {
		expect(formatShortDateTime('05 Nov 2026 10:54:00')).toBe(
			expected(2026, 10, 5)
		);
	});

	test('keeps date-only values usable', () => {
		expect(formatShortDateTime('05 Nov 2026')).toBe(
			expected(2026, 10, 5, 0, 0)
		);
	});

	test('falls back to a dash or the raw value', () => {
		expect(formatShortDateTime(undefined)).toBe('—');
		expect(formatShortDateTime(null)).toBe('—');
		expect(formatShortDateTime('')).toBe('—');
		expect(formatShortDateTime('never')).toBe('never');
	});
});
