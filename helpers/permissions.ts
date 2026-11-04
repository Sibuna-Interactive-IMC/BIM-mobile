import { PortalPackage, User } from '@/types';

function isTruthy(value: unknown) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Deletion rules that can be decided locally, before calling the API.
 * The "no voucher users assigned" rule stays server-side because the package
 * payload does not include per-package usage counts.
 */
export function isPlatformAdmin(user?: User | null): boolean {
	return isTruthy(user?.platform?.is_admin);
}

/** Admins and staff share the platform-level read views (business analytics). */
export function isPlatformStaff(user?: User | null): boolean {
	return isPlatformAdmin(user) || isTruthy(user?.platform?.is_staff);
}

export function canDeleteSharedRadiusProfile(user?: User | null): boolean {
	return isPlatformAdmin(user);
}

export function canDeletePortalPackage(
	user: User | null | undefined,
	pkg: PortalPackage
): boolean {
	if (isPlatformAdmin(user)) return true;
	return !pkg.is_global && pkg.owner?.type !== 'platform';
}
