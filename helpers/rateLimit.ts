import { getApiData } from '@/helpers/apiResponse';

/**
 * Helpers for reading the backend's auth rate-limit responses.
 *
 * The API answers a throttled login (`POST /login`) and a throttled TOTP check
 * (`POST /2fa-verify`) with 429 + a machine-readable cooldown:
 *   - `Retry-After` response header (seconds)
 *   - `data.retry_after` (seconds)
 *   - `data.retry_at` (UTC timestamp when the limit resets)
 * and a human message such as "Too many login attempts. Please try again in
 * 15 minutes." or "Too many failed attempts. Try again in 60m 0s.".
 * Older deployments only sent the message (and used 403/422), so the message
 * is still parsed as a fallback.
 */

/** True when the response indicates a temporary auth lockout. */
export function isRateLimitResponse(
	status: number,
	message?: string | null
): boolean {
	if (status === 429) return true;
	const lower = String(message ?? '').toLowerCase();
	return lower.includes('too many') || lower.includes('try again in');
}

/** Seconds the backend asks the user to wait, parsed from its message. */
export function parseRetryAfterSeconds(message?: string | null): number {
	if (!message) return 0;
	const m = String(message);

	// "in Xm Ys" (the 2FA lockout's gmdate("i\\m s\\s") format)
	const hm = m.match(/(\d+)\s*m\s*(\d+)\s*s/i);
	if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);

	// "in X hours"
	const hour = m.match(/(\d+)\s*hours?/i);
	if (hour) return parseInt(hour[1], 10) * 3600;

	// "in X minutes"
	const min = m.match(/(\d+)\s*minutes?/i);
	if (min) return parseInt(min[1], 10) * 60;

	// "in X seconds"
	const sec = m.match(/(\d+)\s*seconds?/i);
	if (sec) return parseInt(sec[1], 10);

	return 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

/** `data.retry_after` (seconds) or `data.retry_at` (timestamp) of a body. */
export function getBodyRetryAfterSeconds(body: unknown): number {
	const payload = asRecord(getApiData<Record<string, unknown>>(body));
	if (!payload) return 0;

	const seconds = Number(payload.retry_after);
	if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);

	if (typeof payload.retry_at === 'string') {
		const when = Date.parse(payload.retry_at);
		if (Number.isFinite(when)) {
			return Math.max(0, Math.ceil((when - Date.now()) / 1000));
		}
	}
	return 0;
}

/**
 * `Retry-After` header in seconds. Accepts either the delta-seconds form the
 * API sends or an HTTP date, and tolerates stubbed responses in tests.
 */
export function getHeaderRetryAfterSeconds(res: {
	headers?: { get?: (name: string) => string | null } | null;
}): number {
	let raw: string | null = null;
	try {
		raw = res.headers?.get?.('Retry-After') ?? null;
	} catch {
		return 0;
	}
	if (!raw) return 0;

	const seconds = Number(raw);
	if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);

	const when = Date.parse(raw);
	if (Number.isFinite(when)) {
		return Math.max(0, Math.ceil((when - Date.now()) / 1000));
	}
	return 0;
}

/**
 * Seconds to wait before retrying, preferring the structured fields over the
 * message: header → body → message text.
 */
export function resolveRetryAfterSeconds(
	res: {
		headers?: { get?: (name: string) => string | null } | null;
		status?: number;
	},
	body: unknown,
	message?: string | null
): number {
	return (
		getHeaderRetryAfterSeconds(res) ||
		getBodyRetryAfterSeconds(body) ||
		parseRetryAfterSeconds(message)
	);
}

/** "90" -> "1:30" for a compact countdown display. */
export function formatCountdown(totalSeconds: number): string {
	const s = Math.max(0, Math.ceil(totalSeconds));
	const minutes = Math.floor(s / 60);
	const seconds = s % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
