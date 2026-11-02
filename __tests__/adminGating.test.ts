/// <reference types="jest" />
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A structural audit of every admin-only screen.
 *
 * These are the checks the review kept coming back to: an admin tool must be
 * gated on the platform role, must not fetch before that gate, and must say why
 * it is empty instead of rendering a blank page. A new admin screen that forgets
 * one of these fails here rather than shipping.
 */
type AdminScreen = {
	/** `views/<name>.tsx` */
	view: string;
	/** The role helper it must call. */
	guard: 'isPlatformAdmin' | 'isPlatformStaff';
	/** The translation key it shows when the caller is not allowed. */
	notice: 'adminOnly' | 'staffOnly';
};

const ADMIN_SCREENS: AdminScreen[] = [
	{ view: 'AccountsAnalyticsScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'AccountAnalyticsDetailScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'AdminUsersScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'BusinessAnalyticsScreen', guard: 'isPlatformStaff', notice: 'staffOnly' },
	{ view: 'BusinessListScreen', guard: 'isPlatformStaff', notice: 'staffOnly' },
	{ view: 'BusinessRoutersScreen', guard: 'isPlatformStaff', notice: 'staffOnly' },
	{ view: 'ProfitScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'PaymentGatewayScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'BroadcastsScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'BroadcastDetailScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'RouterToolsScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
	{ view: 'DocumentVerificationScreen', guard: 'isPlatformAdmin', notice: 'adminOnly' },
];

const root = join(__dirname, '..');

function source(view: string) {
	return readFileSync(join(root, 'views', `${view}.tsx`), 'utf8');
}

describe('admin screens are role-gated', () => {
	test.each(ADMIN_SCREENS)(
		'$view calls $guard and hides itself behind $notice',
		({ view, guard, notice }) => {
			const code = source(view);

			// The role helper comes from the shared permissions module…
			expect(code).toContain(`from '@/helpers/permissions'`);
			expect(code).toContain(guard);
			// …is called, not just imported,
			expect(code).toMatch(new RegExp(`${guard}\\(user\\)`));
			// …and the screen tells a caller who is not allowed.
			expect(code).toContain(notice);
		}
	);

	test.each(ADMIN_SCREENS)(
		'$view bails out of its loader before the role gate',
		({ view, guard }) => {
			const code = source(view);
			const flag = guard === 'isPlatformAdmin' ? 'isAdmin' : 'canView';

			// The loaders start with `if (!authToken || !isAdmin …) return;`, so no
			// request is made on behalf of someone who is not allowed.
			expect(code).toMatch(new RegExp(`\\|\\| !${flag}\\b`));
		}
	);
});

describe('the drawer only shows admin routers to admins', () => {
	const layout = readFileSync(
		join(root, 'app', '(authenticated)', '_layout.tsx'),
		'utf8'
	);

	test('the admin-only drawer routes sit behind isPlatformAdmin', () => {
		const spread = layout.match(/\.\.\.\(isAdmin\s*\?\s*\[([\s\S]*?)\]\s*:\s*\[\]\)/);

		expect(spread).not.toBeNull();
		const routes = spread?.[1] ?? '';
		[
			'payment-gateway',
			'broadcasts',
			'router-tools',
			'document-verification',
		].forEach((route) => {
			expect(routes).toContain(`'${route}'`);
		});
	});

	test('no admin router is in the unconditional allowlist', () => {
		const allowlist = layout.slice(
			layout.indexOf('new Set<string>(['),
			layout.indexOf('])', layout.indexOf('new Set<string>(['))
		);

		['admin-users', 'accounts-analytics', 'business-analytics', 'profit'].forEach(
			(route) => {
				expect(allowlist).not.toContain(`'${route}'`);
			}
		);
	});
});
