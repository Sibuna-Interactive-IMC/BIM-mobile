import {
	formatCountdown,
	getBodyRetryAfterSeconds,
	getHeaderRetryAfterSeconds,
	isRateLimitResponse,
	parseRetryAfterSeconds,
	resolveRetryAfterSeconds,
} from '@/helpers/rateLimit';

describe('parseRetryAfterSeconds', () => {
	test('parses the login throttle message (X seconds)', () => {
		expect(
			parseRetryAfterSeconds(
				'Too many login attempts. Please try again in 45 seconds.'
			)
		).toBe(45);
	});

	test('parses the login throttle message (X minutes)', () => {
		expect(
			parseRetryAfterSeconds(
				'Too many login attempts. Please try again in 15 minutes.'
			)
		).toBe(900);
	});

	test('parses the 2FA lockout message (Xm Ys)', () => {
		expect(
			parseRetryAfterSeconds('Too many failed attempts. Try again in 01m 30s.')
		).toBe(90);
		expect(
			parseRetryAfterSeconds('Too many failed attempts. Try again in 00m 45s.')
		).toBe(45);
		expect(
			parseRetryAfterSeconds('Too many failed attempts. Try again in 60m 0s.')
		).toBe(3600);
	});

	test('parses the 2FA lockout message (1 hour)', () => {
		expect(
			parseRetryAfterSeconds('Too many failed attempts. Try again in 1 hour.')
		).toBe(3600);
	});

	test('returns 0 when there is no wait time', () => {
		expect(parseRetryAfterSeconds('Invalid OTP. You have 2 attempts left.')).toBe(0);
		expect(parseRetryAfterSeconds(null)).toBe(0);
	});
});

describe('getBodyRetryAfterSeconds', () => {
	test('reads data.retry_after (seconds)', () => {
		expect(
			getBodyRetryAfterSeconds({
				success: false,
				message: 'Too many login attempts.',
				data: { retry_after: 900 },
			})
		).toBe(900);
	});

	test('derives seconds from data.retry_at when retry_after is absent', () => {
		const retryAt = new Date(Date.now() + 120_000).toISOString();
		const seconds = getBodyRetryAfterSeconds({
			success: false,
			data: { retry_at: retryAt },
		});
		expect(seconds).toBeGreaterThan(110);
		expect(seconds).toBeLessThanOrEqual(120);
	});

	test('accepts a legacy body with retry_after at the top level', () => {
		expect(getBodyRetryAfterSeconds({ retry_after: 30 })).toBe(30);
	});

	test('returns 0 for bodies without a cooldown', () => {
		expect(getBodyRetryAfterSeconds({ message: 'Invalid OTP.' })).toBe(0);
		expect(getBodyRetryAfterSeconds(null)).toBe(0);
	});
});

describe('getHeaderRetryAfterSeconds', () => {
	test('reads the Retry-After header in seconds', () => {
		expect(
			getHeaderRetryAfterSeconds({ headers: { get: () => '900' } })
		).toBe(900);
	});

	test('accepts an HTTP-date Retry-After', () => {
		const when = new Date(Date.now() + 60_000).toUTCString();
		const seconds = getHeaderRetryAfterSeconds({ headers: { get: () => when } });
		expect(seconds).toBeGreaterThan(50);
		expect(seconds).toBeLessThanOrEqual(60);
	});

	test('returns 0 when the header is missing or not a wait', () => {
		expect(getHeaderRetryAfterSeconds({ headers: { get: () => null } })).toBe(0);
		expect(
			getHeaderRetryAfterSeconds({ headers: { get: () => 'application/json' } })
		).toBe(0);
	});
});

describe('resolveRetryAfterSeconds', () => {
	test('prefers the header, then the body, then the message', () => {
		const res = { headers: { get: () => '900' } };
		const body = { data: { retry_after: 600 } };
		expect(resolveRetryAfterSeconds(res, body, 'try again in 5 minutes')).toBe(900);

		const noHeader = { headers: { get: () => null } };
		expect(resolveRetryAfterSeconds(noHeader, body, 'try again in 5 minutes')).toBe(600);
		expect(
			resolveRetryAfterSeconds(noHeader, {}, 'Too many attempts. Try again in 5 minutes.')
		).toBe(300);
	});
});

describe('isRateLimitResponse', () => {
	test('flags 429 and "too many"/"try again in" messages', () => {
		expect(isRateLimitResponse(429, 'anything')).toBe(true);
		expect(
			isRateLimitResponse(
				422,
				'Too many login attempts. Please try again in 45 seconds.'
			)
		).toBe(true);
		expect(
			isRateLimitResponse(403, 'Too many failed attempts. Try again in 1 hour.')
		).toBe(true);
	});

	test('does not flag plain auth errors or attempts-left warnings', () => {
		expect(isRateLimitResponse(422, 'These credentials do not match our records.')).toBe(false);
		expect(
			isRateLimitResponse(403, 'Invalid OTP. You have 2 attempts left.')
		).toBe(false);
	});
});

describe('formatCountdown', () => {
	test('formats seconds as m:ss', () => {
		expect(formatCountdown(90)).toBe('1:30');
		expect(formatCountdown(45)).toBe('0:45');
		expect(formatCountdown(0)).toBe('0:00');
		expect(formatCountdown(3600)).toBe('60:00');
	});
});
