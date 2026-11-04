/**
 * Pure helpers for the push pipeline: turning the native device token and the
 * data payload of an incoming push into values the app can act on.
 *
 * Nothing here touches React, `expo-notifications` or the network, so it can be
 * unit tested in isolation (see `__tests__/pushNotifications.test.ts`).
 */

/** In-app inbox, used whenever a push does not carry a route we can open. */
export const NOTIFICATIONS_ROUTE = '/(authenticated)/notifications';

/**
 * Routes a push may open. Anything else falls back to the inbox: a stale or
 * typo'd `link.app` should not land the user on `+not-found`.
 */
const PUSH_ROUTES = new Set([
	'access',
	'accounts',
	'accounts-analytics',
	'admin-users',
	'banks',
	'broadcasts',
	'business-analytics',
	'connector',
	'disbursement-records',
	'document-verification',
	'documents',
	'home',
	'notifications',
	'packages',
	'payment-gateway',
	'profile',
	'profit',
	'router-tools',
	'routers',
	'sites',
	'transactions',
	'translation',
	'vouchers',
	'withdraw',
	'withdraw-approvals',
]);

/**
 * Device token as a string.
 *
 * `getDevicePushTokenAsync()` resolves `{ type, data }` and `data` is the raw
 * token on native (an object on web, which this app does not register).
 */
export function normalizePushToken(value: unknown): string | null {
	if (typeof value === 'string') {
		const token = value.trim();
		return token ? token : null;
	}
	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		for (const key of ['token', 'data', 'endpoint']) {
			const nested = record[key];
			if (typeof nested === 'string' && nested.trim()) return nested.trim();
		}
	}
	return null;
}

/**
 * Deep link carried by a push.
 *
 * The backend models it as `link: { web, app }` on the inbox row; FCM data
 * values are flat strings, so accept the flattened and nested spellings.
 */
export function extractPushLink(
	data: Record<string, unknown> | null | undefined
): string | null {
	if (!data) return null;

	const direct = data.link_app ?? data.linkApp ?? data.route ?? data.url ?? data.link;
	if (typeof direct === 'string' && direct.trim()) return direct.trim();
	if (direct && typeof direct === 'object') {
		const link = direct as Record<string, unknown>;
		for (const key of ['app', 'web']) {
			const value = link[key];
			if (typeof value === 'string' && value.trim()) return value.trim();
		}
	}

	// A queued push may ship the whole notification row as a JSON string.
	const nested = data.notification;
	if (typeof nested === 'string' && nested.trim().startsWith('{')) {
		try {
			return extractPushLink(JSON.parse(nested));
		} catch {
			return null;
		}
	}
	return null;
}

/** Inbox id carried by a push, so a tap can mark that message read. */
export function extractNotificationId(
	data: Record<string, unknown> | null | undefined
): string | null {
	if (!data) return null;

	const direct =
		data.notification_id ?? data.notificationId ?? data.inbox_id ?? data.id;
	if (typeof direct === 'string' && direct.trim()) return direct.trim();
	if (typeof direct === 'number') return String(direct);

	const nested = data.notification;
	if (typeof nested === 'string' && nested.trim().startsWith('{')) {
		try {
			return extractNotificationId(JSON.parse(nested));
		} catch {
			return null;
		}
	}
	if (nested && typeof nested === 'object') {
		return extractNotificationId(nested as Record<string, unknown>);
	}
	return null;
}

/**
 * In-app route for a notification link.
 *
 * Accepts what the web dashboard stores (`/withdraw-approvals`), a custom
 * scheme link (`bimmobile://withdraw-approvals`) or an absolute URL, and keeps
 * only the path. Route groups are optional in expo-router URLs, so the path is
 * left as-is apart from the group prefix the app prepends.
 */
export function resolveNotificationRoute(link?: string | null): string {
	if (!link) return NOTIFICATIONS_ROUTE;

	let path = String(link).trim();
	if (!path) return NOTIFICATIONS_ROUTE;

	// `bimmobile://x`, `https://host/x` → `/x`
	const scheme = path.match(/^([a-z][a-z0-9+.-]*):\/\//i);
	if (scheme) {
		const rest = path.slice(scheme[0].length);
		const isWebScheme = /^https?$/i.test(scheme[1]);
		if (isWebScheme) {
			// The authority is the dashboard host, so only the path is ours.
			const slash = rest.indexOf('/');
			path = slash >= 0 ? rest.slice(slash) : '/';
		} else {
			// `bimmobile://vouchers` — the authority is the first route segment.
			path = `/${rest.replace(/^\/+/, '')}`;
		}
	}
	if (!path.startsWith('/')) path = `/${path}`;

	// `/(authenticated)/profile` and `/profile` are the same screen.
	path = path.replace(/^\/\([^)]*\)/, '') || '/';

	const [pathname] = path.split(/[?#]/);
	const segment = pathname.replace(/^\/+/, '').split('/')[0];
	if (!segment || !PUSH_ROUTES.has(segment)) return NOTIFICATIONS_ROUTE;

	return path;
}
