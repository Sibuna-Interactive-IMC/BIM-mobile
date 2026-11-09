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
		['broadcasts', 'router-tools', 'document-verification'].forEach((route) => {
			expect(routes).toContain(`'${route}'`);
		});
	});

	test('the drawer separates admin-exclusive routes from common routes', () => {
		const adminRoutes = layout.match(
			/const ADMIN_DRAWER_ROUTES = new Set\(\[([\s\S]*?)\]\)/
		)?.[1] ?? '';
		const commonGroup = layout.slice(
			layout.indexOf('const commonRoutes'),
			layout.indexOf('const adminRoutes')
		);

		['broadcasts', 'router-tools', 'document-verification'].forEach((route) => {
			expect(adminRoutes).toContain(`'${route}'`);
		});
		expect(commonGroup).toContain('!ADMIN_DRAWER_ROUTES.has(route.name)');
		expect(layout).toContain('navigation.commonGroup');
		expect(layout).toContain('navigation.adminGroup');
		// Accounts includes both shared and admin-only destinations, so it remains
		// in the common section.
		expect(adminRoutes).not.toContain("'accounts'");
	});

	test('banks and the payment gateway are reached from Accounts, not the drawer', () => {
		// Both moved under the Accounts hub, so neither may be in the drawer's
		// allowlist (that set alone decides which links render) and neither needs a
		// drawer icon. The Drawer.Screen registrations stay: they only make the
		// routes reachable.
		const allowlist = layout.slice(
			layout.indexOf('new Set<string>(['),
			layout.indexOf('])', layout.indexOf('new Set<string>(['))
		);

		expect(allowlist).not.toContain("'banks'");
		expect(allowlist).not.toContain("'payment-gateway'");
		expect(layout).not.toContain("case 'banks':");
		expect(layout).not.toContain("case 'payment-gateway':");
		expect(layout).toContain("<Drawer.Screen name='banks' />");
		expect(layout).toContain("<Drawer.Screen name='payment-gateway' />");
	});

	test('the Accounts hub offers both as tiles', () => {
		const accounts = readFileSync(
			join(root, 'views', 'AccountsScreen.tsx'),
			'utf8'
		);

		// Banks are per-user rows, so everyone gets that tile…
		expect(accounts).toContain("route: '/(authenticated)/banks'");
		// …while the gateway is the admin tool.
		const adminBlock = accounts.slice(accounts.indexOf('if (isAdmin) {'));
		expect(adminBlock).toContain("route: '/(authenticated)/payment-gateway'");
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
