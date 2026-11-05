/// <reference types="jest" />
import { buildApprovalBanners } from '@/helpers/approvalBanners';

describe('buildApprovalBanners', () => {
	it('mirrors the web dashboard cards for owner withdrawals', () => {
		const banners = buildApprovalBanners({
			pendingApprovalCount: 2,
			myPendingCount: 1,
		});

		expect(banners).toHaveLength(1);
		expect(banners[0]).toMatchObject({
			id: 'withdrawals',
			route: '/(authenticated)/withdraw-approvals',
			tone: 'warning',
			total: 3,
			actionCount: 2,
			awaitingCount: 1,
		});
	});

	it('shows a profit banner when only an initiated request awaits others', () => {
		const banners = buildApprovalBanners({
			profitPendingApprovalCount: 0,
			myProfitPendingCount: 1,
		});

		expect(banners).toHaveLength(1);
		expect(banners[0]).toMatchObject({
			id: 'profit',
			route: '/(authenticated)/profit',
			tone: 'danger',
			total: 1,
			actionCount: 0,
			awaitingCount: 1,
		});
	});

	it('returns both cards in web order when both have rows', () => {
		const banners = buildApprovalBanners({
			pendingApprovalCount: 1,
			myPendingCount: 0,
			profitPendingApprovalCount: 0,
			myProfitPendingCount: 2,
		});

		expect(banners.map((banner) => banner.id)).toEqual([
			'withdrawals',
			'profit',
		]);
	});

	it('falls back to the pendingApprovals list when the count is absent', () => {
		const banners = buildApprovalBanners({
			pendingApprovals: [{ id: 7, router_name: 'Kisa', amount: 1000 }],
		});

		expect(banners).toHaveLength(1);
		expect(banners[0]).toMatchObject({ id: 'withdrawals', total: 1 });
	});

	it('omits empty, missing and non-numeric counts', () => {
		expect(buildApprovalBanners(undefined)).toEqual([]);
		expect(buildApprovalBanners({})).toEqual([]);
		expect(
			buildApprovalBanners({
				pendingApprovalCount: Number.NaN,
				profitPendingApprovalCount: 0,
			})
		).toEqual([]);
	});
});
