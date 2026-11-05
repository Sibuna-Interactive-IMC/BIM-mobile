import type { DashboardApprovalCounts } from '@/types';

export type ApprovalBannerId = 'withdrawals' | 'profit';

export interface ApprovalBanner {
	id: ApprovalBannerId;
	route: '/(authenticated)/withdraw-approvals' | '/(authenticated)/profit';
	tone: 'warning' | 'danger';
	/** Rows needing the caller plus the caller's own rows awaiting others. */
	total: number;
	actionCount: number;
	awaitingCount: number;
}

const countOf = (value?: number) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Dashboard notifications the web dashboard shows as cards:
 *
 * - owner withdrawals waiting for a signature or still awaiting co-owners
 *   (`/withdrawals/approvals`);
 * - profit withdrawals waiting for an admin or still awaiting the other admins
 *   (`/analytics/profit/approvals`).
 *
 * Both are merged into `GET /dashboard` per user, so the banner needs no extra
 * request. A banner with no rows is omitted.
 */
export function buildApprovalBanners(
	counts?: DashboardApprovalCounts | null
): ApprovalBanner[] {
	if (!counts) return [];

	const pending = countOf(
		counts.pendingApprovalCount ?? counts.pendingApprovals?.length
	);
	const mine = countOf(counts.myPendingCount);
	const profitPending = countOf(counts.profitPendingApprovalCount);
	const profitMine = countOf(counts.myProfitPendingCount);

	const banners: ApprovalBanner[] = [];

	if (pending + mine > 0) {
		banners.push({
			id: 'withdrawals',
			route: '/(authenticated)/withdraw-approvals',
			tone: 'warning',
			total: pending + mine,
			actionCount: pending,
			awaitingCount: mine,
		});
	}

	if (profitPending + profitMine > 0) {
		banners.push({
			id: 'profit',
			route: '/(authenticated)/profit',
			tone: 'danger',
			total: profitPending + profitMine,
			actionCount: profitPending,
			awaitingCount: profitMine,
		});
	}

	return banners;
}
