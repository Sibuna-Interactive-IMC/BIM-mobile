/// <reference types="jest" />
import { searchFeatures } from '@/helpers/featureSearch';
import type { User } from '@/types';

const admin = {
	id: 1,
	platform: { is_admin: true, is_staff: true },
} as unknown as User;
const staff = {
	id: 2,
	platform: { is_admin: false, is_staff: true },
} as unknown as User;
const owner = {
	id: 3,
	platform: { is_admin: false, is_staff: false },
} as unknown as User;

const ids = (query: string, user?: User | null) =>
	searchFeatures(query, user, 'en').map((result) => result.feature.id);

describe('searchFeatures', () => {
	it('returns nothing for an empty query', () => {
		expect(searchFeatures('', admin, 'en')).toEqual([]);
		expect(searchFeatures('   ', admin, 'en')).toEqual([]);
	});

	it('finds a feature by its label', () => {
		expect(ids('routers', owner)[0]).toBe('routers');
		expect(ids('vouchers', owner)[0]).toBe('vouchers');
	});

	it('ignores case and surrounding whitespace', () => {
		expect(ids('  VOUCHERS ', owner)[0]).toBe('vouchers');
	});

	it('matches keywords that are not in the copy', () => {
		expect(ids('sms', admin)[0]).toBe('broadcasts');
		expect(ids('wireguard', owner)).toEqual(
			expect.arrayContaining(['routers', 'connector'])
		);
	});

	it('ranks a label match above a description match', () => {
		const results = ids('sites', owner);
		expect(results[0]).toBe('sites');
		// "Sites" is also mentioned in the Accounts description, so it still matches
		expect(results).toContain('accounts');
	});

	it('requires every token to match', () => {
		expect(ids('bank payout', owner)[0]).toBe('banks');
		expect(ids('voucher profit', admin)).toEqual([]);
	});

	it('hides admin features from non-admins', () => {
		expect(ids('profit', owner)).toEqual([]);
		expect(ids('profit', admin)).toContain('profit');
	});

	it('shows staff features to staff and admins only', () => {
		expect(ids('business analytics', owner)).toEqual([]);
		expect(ids('business analytics', staff)).toContain('business-analytics');
		expect(ids('business analytics', admin)).toContain('business-analytics');
	});

	it('returns the translated label and description', () => {
		const [result] = searchFeatures('routers', owner, 'en');
		expect(result.label).toBe('Routers');
		expect(result.description).toBeTruthy();
	});

	it('falls back to English copy for languages without features', () => {
		const [result] = searchFeatures('routers', owner, 'fr');
		expect(result.label).toBe('Routers');
	});
});
