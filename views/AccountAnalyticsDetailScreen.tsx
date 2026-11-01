import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import type { RecordField, RecordTone } from '@/components/RecordList';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, formatDateTime, translateWithVariables } from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useHeaderBack from '@/hooks/useHeaderBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	fetchAnalyticsAccount,
	fetchAnalyticsAccountVouchers,
	fetchAnalyticsAccountWithdrawals,
} from '@/services/AnalyticsService';
import type {
	AnalyticsAccount,
	AnalyticsAccountStats,
	AnalyticsMember,
	AnalyticsRouter,
	AnalyticsVoucherBatch,
	AnalyticsWithdrawal,
	GetAnalyticsAccountResponse,
	GetAnalyticsVouchersResponse,
	GetAnalyticsWithdrawalsResponse,
} from '@/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

type TabKey = 'overview' | 'members' | 'vouchers' | 'withdrawals' | 'routers';

function statusTone(status?: string | null): RecordTone {
	const key = (status ?? '').toLowerCase();
	if (key === 'successful' || key === 'approved' || key === 'online') return 'success';
	if (key === 'pending' || key === 'stale') return 'warning';
	if (key === 'failed' || key === 'rejected' || key === 'offline') return 'danger';
	return 'default';
}

/** The web's admin/analytics/accounts/{id}: overview, members, vouchers, withdrawals, routers. */
export default function AccountAnalyticsDetailScreen() {
	useTrackHistory('/(authenticated)/accounts-analytics/[accountId]');
	useHeaderBack('/(authenticated)/accounts-analytics');
	const { accountId } = useLocalSearchParams<{ accountId: string }>();
	const { language, authToken } = useGeneral();
	const t = translations[language].categories.accountsAnalytics;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const mutedText = useThemeColor({}, 'mutedText');

	const [tab, setTab] = useState<TabKey>('overview');
	const [account, setAccount] = useState<AnalyticsAccount | null>(null);
	const [stats, setStats] = useState<AnalyticsAccountStats | null>(null);
	const [members, setMembers] = useState<AnalyticsMember[]>([]);
	const [routers, setRouters] = useState<AnalyticsRouter[]>([]);
	const [voucherStats, setVoucherStats] = useState<
		AnalyticsAccountStats['vouchers'] | null
	>(null);
	const [batches, setBatches] = useState<AnalyticsVoucherBatch[]>([]);
	const [withdrawals, setWithdrawals] = useState<AnalyticsWithdrawal[]>([]);
	const [batchPage, setBatchPage] = useState(1);
	const [batchLastPage, setBatchLastPage] = useState(1);
	const [withdrawalPage, setWithdrawalPage] = useState(1);
	const [withdrawalLastPage, setWithdrawalLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const numericId = Number(accountId);

	const loadDetail = useCallback(async () => {
		if (!authToken || !Number.isFinite(numericId)) return;
		setLoading(true);
		try {
			const res = await fetchAnalyticsAccount(numericId, authToken);
			if (!res.ok) {
				setAccount(null);
				return;
			}
			const body: GetAnalyticsAccountResponse = await res.json();
			const data = getApiData<NonNullable<GetAnalyticsAccountResponse['data']>>(body);
			setAccount(data?.account ?? null);
			setStats(data?.stats ?? null);
			setMembers(data?.members ?? []);
			setRouters(data?.routers ?? []);
		} catch (e) {
			console.error('[AccountAnalyticsDetail] detail failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken, numericId]);

	const loadVouchers = useCallback(
		async (page: number) => {
			if (!authToken || !Number.isFinite(numericId)) return;
			const res = await fetchAnalyticsAccountVouchers(numericId, authToken, page);
			if (!res.ok) return;
			const body: GetAnalyticsVouchersResponse = await res.json();
			const data = getApiData<NonNullable<GetAnalyticsVouchersResponse['data']>>(body);
			setVoucherStats(data?.stats ?? null);
			setBatches(data?.vouchers ?? []);
			setBatchLastPage(
				Math.max(1, getApiPagination(body, 'vouchers')?.last_page ?? 1)
			);
		},
		[authToken, numericId]
	);

	const loadWithdrawals = useCallback(
		async (page: number) => {
			if (!authToken || !Number.isFinite(numericId)) return;
			const res = await fetchAnalyticsAccountWithdrawals(numericId, authToken, page);
			if (!res.ok) return;
			const body: GetAnalyticsWithdrawalsResponse = await res.json();
			setWithdrawals(
				getApiData<NonNullable<GetAnalyticsWithdrawalsResponse['data']>>(body)
					?.withdrawals ?? []
			);
			setWithdrawalLastPage(
				Math.max(1, getApiPagination(body, 'withdrawals')?.last_page ?? 1)
			);
		},
		[authToken, numericId]
	);

	useEffect(() => {
		void loadDetail();
	}, [loadDetail]);

	// The tab's data is fetched the first time it is opened.
	useEffect(() => {
		if (tab === 'vouchers') void loadVouchers(batchPage);
	}, [tab, batchPage, loadVouchers]);

	useEffect(() => {
		if (tab === 'withdrawals') void loadWithdrawals(withdrawalPage);
	}, [tab, withdrawalPage, loadWithdrawals]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadDetail();
			if (tab === 'vouchers') await loadVouchers(batchPage);
			if (tab === 'withdrawals') await loadWithdrawals(withdrawalPage);
		} finally {
			setRefreshing(false);
		}
	}, [batchPage, loadDetail, loadVouchers, loadWithdrawals, tab, withdrawalPage]);

	const voucherTotal = stats?.vouchers ?? voucherStats;
	const withdrawalStats = stats?.withdrawals;
	const routerStats = stats?.routers;

	const tabs = useMemo(
		() => [
			{ key: 'overview', label: t.detailOverview },
			{
				key: 'members',
				label: t.detailMembers,
				count: account?.members_count ?? members.length,
			},
			{ key: 'vouchers', label: t.detailVouchers },
			{ key: 'withdrawals', label: t.detailWithdrawals },
			{
				key: 'routers',
				label: t.detailRouters,
				count: routerStats?.total ?? routers.length,
			},
		],
		[
			account?.members_count,
			members.length,
			routerStats?.total,
			routers.length,
			t.detailMembers,
			t.detailOverview,
			t.detailRouters,
			t.detailVouchers,
			t.detailWithdrawals,
		]
	);

	const overviewFields: RecordField[] = account
		? [
				{ label: t.detailAccountType, value: account.type_label || account.type || '—' },
				{
					label: t.detailMembers,
					value: translateWithVariables(t.detailMemberCount, {
						count: formatAmount(account.members_count ?? members.length, 0),
					}),
				},
				{ label: t.detailSeat, value: account.access_levels_summary || '—', fullWidth: true },
				{
					label: t.detailLastActive,
					value: account.last_active?.user_name
						? translateWithVariables(t.detailLastActiveHint, {
								when: formatDateTime(account.last_active.at),
								role: account.last_active.role || '—',
							})
						: t.neverActive,
					fullWidth: true,
				},
				{ label: t.createdAt, value: formatDateTime(account.created_at) },
			]
		: [];

	const memberFields = (member: AnalyticsMember): RecordField[] => [
		{ label: t.detailMemberEmail, value: member.email || '—', fullWidth: true },
		{
			label: t.detailSeat,
			value: member.account_role_label || member.account_role || '—',
			tone: 'info',
		},
		{
			label: t.detailCosignatory,
			value: member.is_cosignatory ? t.detailYes : t.detailNo,
			tone: member.is_cosignatory ? 'success' : 'muted',
		},
		{
			label: t.detailPlatformRole,
			value: member.platform_role || '—',
		},
		{ label: t.detailLastActive, value: formatDateTime(member.last_activity_at) },
	];

	const batchFields = (batch: AnalyticsVoucherBatch): RecordField[] => [
		{
			label: t.detailVouchersInBatch,
			value: formatAmount(batch.vouchers ?? 0, 0),
			tone: 'info',
		},
		{ label: t.detailRouter, value: batch.router_name || '—' },
		{ label: t.detailFirstAt, value: formatDateTime(batch.first_at) },
		{ label: t.detailLastAt, value: formatDateTime(batch.last_at) },
	];

	const withdrawalFields = (withdrawal: AnalyticsWithdrawal): RecordField[] => [
		{
			label: t.amount,
			value: `${withdrawal.currency || ''} ${formatAmount(
				withdrawal.amount ?? 0,
				2
			)}`.trim(),
			tone: 'warning',
		},
		{ label: t.detailRouter, value: withdrawal.router?.name || '—' },
		{
			label: t.detailStatus,
			value: withdrawal.status || '—',
			tone: statusTone(withdrawal.status),
		},
		{ label: t.detailInitiatedBy, value: withdrawal.initiated_by?.name || '—' },
		{ label: t.createdAt, value: formatDateTime(withdrawal.created_at), fullWidth: true },
	];

	const routerFields = (router: AnalyticsRouter): RecordField[] => [
		{
			label: t.detailRouterState,
			value: router.state || '—',
			tone: statusTone(router.state),
		},
		{ label: t.detailRouterIp, value: router.ip_address || '—' },
		{ label: t.detailRouterDns, value: router.hotspot_dns || '—' },
		{
			label: t.detailHeartbeat,
			value: translateWithVariables(t.detailLastActiveHint, {
				when: formatDateTime(router.router_heartbeat_at),
				role: router.heartbeat_state || '—',
			}),
			fullWidth: true,
		},
		{ label: t.detailOwner, value: router.owner_name || '—' },
	];

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='account-detail-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='account-detail-header'
					title={account?.name || t.detailTitle}
					loading={loading}
				/>
			</TileContainer>

			<TileContainer
				id='account-detail-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				{account ? (
					<SegmentedTabs tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as TabKey)} />
				) : null}

				{!account && !loading ? (
					<ThemedText
						style={[styles.description, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.detailNotFound}
					</ThemedText>
				) : null}

				{account && tab === 'overview' ? (
					<>
						<RecordCard id='account-summary' fields={overviewFields} />
						<RecordCard
							id='account-voucher-stats'
							title={t.detailVoucherGeneration}
							fields={[
								{
									label: t.detailVouchers,
									value: formatAmount(voucherTotal?.total ?? 0, 0),
									tone: 'info',
								},
								{
									label: t.detailManualBatches,
									value: translateWithVariables(t.detailManualBatchesValue, {
										batches: formatAmount(
											voucherTotal?.manual_batches?.batches ?? 0,
											0
										),
										vouchers: formatAmount(
											voucherTotal?.manual_batches?.vouchers ?? 0,
											0
										),
									}),
									fullWidth: true,
								},
								{
									label: t.detailLastAt,
									value: formatDateTime(voucherTotal?.last_at),
									fullWidth: true,
								},
							]}
						/>
						<RecordCard
							id='account-withdrawal-stats'
							title={t.detailWithdrawals}
							fields={[
								{
									label: t.detailWithdrawals,
									value: formatAmount(withdrawalStats?.count ?? 0, 0),
								},
								{
									label: t.detailTotal,
									value: `${formatAmount(
										Math.abs(withdrawalStats?.total ?? 0),
										0
									)}`,
									tone: 'warning',
								},
								{
									label: t.detailStatus,
									value: translateWithVariables(t.detailWithdrawalTotals, {
										pending: formatAmount(withdrawalStats?.pending ?? 0, 0),
										amount: formatAmount(
											Math.abs(withdrawalStats?.total ?? 0),
											0
										),
									}),
									fullWidth: true,
								},
							]}
						/>
						<RecordCard
							id='account-router-stats'
							title={t.detailRouters}
							fields={[
								{
									label: t.detailRouters,
									value: formatAmount(routerStats?.total ?? 0, 0),
								},
								{
									label: t.detailHeartbeat,
									value: translateWithVariables(t.detailRoutersReporting, {
										count: formatAmount(routerStats?.reporting ?? 0, 0),
									}),
									fullWidth: true,
								},
							]}
						/>
					</>
				) : null}

				{account && tab === 'members' ? (
					<RecordList
						id='account-members'
						loading={loading && members.length === 0}
						loadingMessage={loadingCopy}
						isEmpty={!loading && members.length === 0}
						emptyMessage={t.detailNoMembers}
					>
						{members.map((member) => (
							<RecordCard
								key={member.id}
								id={`account-member-${member.id}`}
								title={member.name}
								badge={
									member.account_role_label || member.account_role
										? {
												label:
													member.account_role_label ||
													member.account_role ||
													'',
												tone: 'info',
											}
										: undefined
								}
								fields={memberFields(member)}
							/>
						))}
					</RecordList>
				) : null}

				{account && tab === 'vouchers' ? (
					<>
						<RecordList
							id='account-voucher-batches'
							description={
								voucherStats
									? translateWithVariables(t.detailVoucherTotal, {
											count: formatAmount(voucherStats.total ?? 0, 0),
										})
									: undefined
							}
							loading={loading && batches.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && batches.length === 0}
							emptyMessage={t.detailNoVouchers}
						>
							{batches.map((batch, index) => (
								<RecordCard
									key={`${batch.batch ?? 'batch'}-${index}`}
									id={`voucher-batch-${index}`}
									title={batch.batch || t.detailBatch}
									fields={batchFields(batch)}
								/>
							))}
						</RecordList>
						{batches.length > 0 ? (
							<ListPagination
								id='account-voucher-pagination'
								page={batchPage}
								lastPage={batchLastPage}
								onPrev={() => setBatchPage((current) => Math.max(1, current - 1))}
								onNext={() =>
									setBatchPage((current) => Math.min(batchLastPage, current + 1))
								}
							/>
						) : null}
					</>
				) : null}

				{account && tab === 'withdrawals' ? (
					<>
						<RecordList
							id='account-withdrawals'
							description={
								withdrawalStats
									? translateWithVariables(t.detailWithdrawalCount, {
											count: formatAmount(withdrawalStats.count ?? 0, 0),
										})
									: undefined
							}
							loading={loading && withdrawals.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && withdrawals.length === 0}
							emptyMessage={t.detailNoWithdrawals}
						>
							{withdrawals.map((withdrawal) => (
								<RecordCard
									key={withdrawal.id}
									id={`account-withdrawal-${withdrawal.id}`}
									title={withdrawal.router?.name || t.detailWithdrawals}
									fields={withdrawalFields(withdrawal)}
								/>
							))}
						</RecordList>
						{withdrawals.length > 0 ? (
							<ListPagination
								id='account-withdrawal-pagination'
								page={withdrawalPage}
								lastPage={withdrawalLastPage}
								onPrev={() =>
									setWithdrawalPage((current) => Math.max(1, current - 1))
								}
								onNext={() =>
									setWithdrawalPage((current) =>
										Math.min(withdrawalLastPage, current + 1)
									)
								}
							/>
						) : null}
					</>
				) : null}

				{account && tab === 'routers' ? (
					<RecordList
						id='account-routers'
						description={
							routerStats
								? translateWithVariables(t.detailRouterCount, {
										count: formatAmount(routerStats.total ?? routers.length, 0),
									})
								: undefined
						}
						loading={loading && routers.length === 0}
						loadingMessage={loadingCopy}
						isEmpty={!loading && routers.length === 0}
						emptyMessage={t.detailNoRouters}
					>
						{routers.map((router) => (
							<RecordCard
								key={router.id}
								id={`account-router-${router.id}`}
								title={router.name}
								fields={routerFields(router)}
							/>
						))}
					</RecordList>
				) : null}
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	titleRow: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	screenTitle: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	description: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
});
