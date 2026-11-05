/// <reference types="jest" />

import {
	extractNotificationId,
	extractPushLink,
	normalizePushToken,
	resolveNotificationRoute,
	NOTIFICATIONS_ROUTE,
} from '@/helpers/pushNotifications';

describe('normalizePushToken', () => {
	test('accepts the native token string', () => {
		expect(normalizePushToken(' fcm-token ')).toBe('fcm-token');
	});

	test('unwraps the token object', () => {
		expect(normalizePushToken({ token: 'fcm-token' })).toBe('fcm-token');
	});

	test('ignores empty and unknown values', () => {
		expect(normalizePushToken('   ')).toBeNull();
		expect(normalizePushToken(null)).toBeNull();
		expect(normalizePushToken(undefined)).toBeNull();
		expect(normalizePushToken({})).toBeNull();
	});
});

describe('extractPushLink', () => {
	test('reads the nested link object the inbox row uses', () => {
		expect(extractPushLink({ link: { app: '/withdraw-approvals' } })).toBe(
			'/withdraw-approvals'
		);
	});

	test('falls back to the web link when no app link is set', () => {
		expect(extractPushLink({ link: { web: 'https://bim.sibuna.us/profile' } })).toBe(
			'https://bim.sibuna.us/profile'
		);
	});

	test('reads flattened FCM data keys', () => {
		expect(extractPushLink({ link_app: 'bimmobile://vouchers' })).toBe(
			'bimmobile://vouchers'
		);
		expect(extractPushLink({ link: '/transactions' })).toBe('/transactions');
	});

	test('unpacks a serialized notification row', () => {
		expect(
			extractPushLink({ notification: '{"link":{"app":"/profile"}}' })
		).toBe('/profile');
	});

	test('returns null when there is no link', () => {
		expect(extractPushLink({})).toBeNull();
		expect(extractPushLink(null)).toBeNull();
		expect(extractPushLink({ notification: '{oops' })).toBeNull();
	});
});

describe('extractNotificationId', () => {
	test('reads the flat id fields', () => {
		expect(extractNotificationId({ notification_id: 'uuid-1' })).toBe('uuid-1');
		expect(extractNotificationId({ id: 7 })).toBe('7');
	});

	test('reads the id out of a serialized row', () => {
		expect(extractNotificationId({ notification: '{"id":"uuid-2"}' })).toBe(
			'uuid-2'
		);
		expect(extractNotificationId({ notification: { id: 'uuid-3' } })).toBe(
			'uuid-3'
		);
	});

	test('returns null when the push carries no id', () => {
		expect(extractNotificationId({})).toBeNull();
		expect(extractNotificationId(null)).toBeNull();
	});
});

describe('resolveNotificationRoute', () => {
	test('keeps a known route and its query', () => {
		expect(resolveNotificationRoute('/withdraw-approvals?approval=12')).toBe(
			'/withdraw-approvals?approval=12'
		);
	});

	test('adds the leading slash', () => {
		expect(resolveNotificationRoute('documents')).toBe('/documents');
	});

	test('strips the custom scheme', () => {
		expect(resolveNotificationRoute('bimmobile://vouchers')).toBe('/vouchers');
	});

	test('reduces an absolute url to its path', () => {
		expect(
			resolveNotificationRoute('https://bim.sibuna.us/transactions?page=2')
		).toBe('/transactions?page=2');
	});

	test('drops a route group prefix', () => {
		expect(resolveNotificationRoute('/(authenticated)/profile')).toBe('/profile');
	});

	test('maps backend app links onto the screen that can act on them', () => {
		expect(
			resolveNotificationRoute('bim://approvals/withdrawals/0b0a')
		).toBe('/withdraw-approvals');
		expect(resolveNotificationRoute('bim://approvals/profit/44')).toBe(
			'/profit'
		);
		expect(resolveNotificationRoute('bim://profit/44')).toBe('/profit');
		expect(resolveNotificationRoute('bim://disbursements/9')).toBe(
			'/disbursement-records'
		);
		expect(resolveNotificationRoute('bim://withdrawals/9')).toBe(
			'/withdraw-approvals'
		);
		expect(resolveNotificationRoute('/withdraw/approvals')).toBe(
			'/withdraw-approvals'
		);
	});

	test('falls back to the inbox for unknown, empty or hostless links', () => {
		expect(resolveNotificationRoute('/no-such-screen')).toBe(
			NOTIFICATIONS_ROUTE
		);
		expect(resolveNotificationRoute('')).toBe(NOTIFICATIONS_ROUTE);
		expect(resolveNotificationRoute(null)).toBe(NOTIFICATIONS_ROUTE);
		expect(resolveNotificationRoute('bimmobile://')).toBe(NOTIFICATIONS_ROUTE);
	});
});
