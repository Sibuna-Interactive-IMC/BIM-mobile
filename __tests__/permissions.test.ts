import {
	canDeletePortalPackage,
	canDeleteSharedRadiusProfile,
	isPlatformAdmin,
} from '@/helpers/permissions';
import { PortalPackage, User } from '@/types';

const basePackage: PortalPackage = {
	id: 'pkg-1',
	label: 'Daily',
	label_key: null,
	label_translations: {},
	price: 1000,
	rad_group: 'DAILY_1000',
	duration_label: '24h',
	sort: 0,
	is_active: true,
	is_global: false,
	is_trial: false,
	account_id: 1,
	user_id: 1,
	owner: { type: 'account', id: 1, name: 'My account' },
	profile: {
		group: 'DAILY_1000',
		name: 'DAILY_1000',
		display_name: 'Daily',
		shared: true,
		price: 1000,
		duration: '24h',
		duration_seconds: 86400,
		rate_limit: '4M/3M',
		devices: 1,
		editable: false,
	},
	routers: [],
	rate_limits: {},
};

function userWithPlatform(isAdmin: boolean | 'true' | 'false'): User {
	return {
		id: 1,
		name: 'Test User',
		email: 'test@example.com',
		phone: '256700000000',
		platform: {
			role: isAdmin === true || isAdmin === 'true' ? 'admin' : 'owner',
			role_label: isAdmin === true || isAdmin === 'true' ? 'Admin' : 'Owner',
			is_admin: isAdmin,
			is_staff: false,
			is_blog_editor: false,
			blog_editor_scope: '',
			can_write_blog_content: false,
		},
	} as User;
}

describe('delete permissions', () => {
	test('treats boolean and string admin flags as admin', () => {
		expect(isPlatformAdmin(userWithPlatform(true))).toBe(true);
		expect(isPlatformAdmin(userWithPlatform('true'))).toBe(true);
		expect(isPlatformAdmin(userWithPlatform(false))).toBe(false);
		expect(isPlatformAdmin(undefined)).toBe(false);
	});

	test('only admins can delete shared RADIUS profiles', () => {
		expect(canDeleteSharedRadiusProfile(userWithPlatform(true))).toBe(true);
		expect(canDeleteSharedRadiusProfile(userWithPlatform(false))).toBe(false);
	});

	test('admins can delete any package', () => {
		expect(
			canDeletePortalPackage(userWithPlatform(true), {
				...basePackage,
				is_global: true,
				owner: { type: 'platform', id: null, name: 'Platform' },
			})
		).toBe(true);
	});

	test('owners can delete their own package', () => {
		expect(canDeletePortalPackage(userWithPlatform(false), basePackage)).toBe(
			true
		);
	});

	test('owners cannot delete global or platform packages', () => {
		expect(
			canDeletePortalPackage(userWithPlatform(false), {
				...basePackage,
				is_global: true,
			})
		).toBe(false);
		expect(
			canDeletePortalPackage(userWithPlatform(false), {
				...basePackage,
				owner: { type: 'platform', id: null, name: 'Platform' },
			})
		).toBe(false);
	});
});
