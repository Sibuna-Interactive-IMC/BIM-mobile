import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField, RecordTone } from '@/components/RecordList';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import TileContainer from '@/components/TileContainer';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, formatDateTime, translateWithVariables } from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { isPlatformStaff } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useHeaderBack from '@/hooks/useHeaderBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchBusinessList } from '@/services/AnalyticsService';
import type { BusinessListKind, BusinessListPeriod } from '@/services/AnalyticsService';
import type {
	ApiTransaction,
	BusinessAnalyticsList,
	BusinessOwnerOption,
	GetBusinessListResponse,
} from '@/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PAGE_SIZE = 20;

const KINDS: BusinessListKind[] = ['credits', 'charges', 'withdrawals'];

function statusTone(status?: string | null): RecordTone {
	const key = (status ?? '').toLowerCase();
	if (key === 'successful' || key === 'approved') return 'success';
	if (key === 'pending') return 'warning';
	if (key === 'failed' || key === 'rejected') return 'danger';
	return 'default';
}

/**
 * The drill-down behind each business-analytics card: `/analytics/business/{kind}`
 * with the same period and owner filters the web list pages use.
 */
export default function BusinessListScreen() {
	useTrackHistory('/(authenticated)/business-analytics/[kind]');
	useHeaderBack('/(authenticated)/business-analytics');
	const params = useLocalSearchParams<{ kind?: string; period?: string }>();
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.businessAnalytics;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const canView = isPlatformStaff(user);

	const kind: BusinessListKind = KINDS.includes(params.kind as BusinessListKind)
		? (params.kind as BusinessListKind)
		: 'credits';
	const initialPeriod: BusinessListPeriod = (
		['today', 'week', 'month', 'all'] as BusinessListPeriod[]
	).includes(params.period as BusinessListPeriod)
		? (params.period as BusinessListPeriod)
		: 'today';

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');

	const [period, setPeriod] = useState<BusinessListPeriod>(initialPeriod);
	const [ownerId, setOwnerId] = useState<number | null>(null);
	const [owners, setOwners] = useState<BusinessOwnerOption[]>([]);
	const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
	const ownerRef = useRef<View>(null);

	const title = useMemo(() => {
		if (kind === 'charges') return t.chargesTitle;
		if (kind === 'withdrawals') return t.withdrawalsTitle;
		return t.collectionsTitle;
	}, [kind, t.chargesTitle, t.collectionsTitle, t.withdrawalsTitle]);

	const ownerOptions = useMemo(
		() => [t.allOwners, ...owners.map((item) => item.name)],
		[owners, t.allOwners]
	);

	// The dropdown is label-driven; the request is id-driven.
	const ownerLabel = useMemo(
		() =>
			ownerId === null
				? t.allOwners
				: (owners.find((item) => item.id === ownerId)?.name ?? t.allOwners),
		[ownerId, owners, t.allOwners]
	);

	const load = useCallback(async () => {
		if (!authToken || !canView) return;
		setLoading(true);
		try {
			const res = await fetchBusinessList(kind, authToken, {
				owner: ownerId ?? undefined,
				period,
				page,
				perPage: PAGE_SIZE,
			});
			if (!res.ok) {
				setTransactions([]);
				return;
			}
			const body: GetBusinessListResponse = await res.json();
			const data = getApiData<BusinessAnalyticsList>(body);
			setTransactions(data?.transactions ?? []);
			setTotal(data?.total ?? 0);
			if (data?.owners?.length) setOwners(data.owners);
			setLastPage(
				Math.max(1, getApiPagination(body, 'transactions')?.last_page ?? 1)
			);
		} catch (e) {
			console.error('[BusinessListScreen] load failed', e);
			setTransactions([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, canView, kind, ownerId, page, period]);

	useEffect(() => {
		setPage(1);
	}, [period, ownerId]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	const periodTabs = useMemo(
		() => [
			{ key: 'today', label: t.today },
			{ key: 'week', label: t.week },
			{ key: 'month', label: t.month },
			{ key: 'all', label: t.allTime },
		],
		[t.allTime, t.month, t.today, t.week]
	);

	const fieldsFor = (transaction: ApiTransaction): RecordField[] => [
		{
			label: t.amount,
			value: formatAmount(Math.abs(Number(transaction.amount ?? 0)), 2),
			tone: kind === 'charges' ? 'danger' : kind === 'withdrawals' ? 'warning' : 'success',
		},
		{
			label: t.router,
			value: transaction.router?.name || transaction.router_name || '—',
		},
		{ label: t.owner, value: transaction.user?.name || '—' },
		{
			label: t.status,
			value: transaction.status || '—',
			tone: statusTone(transaction.status),
		},
		{ label: t.reason, value: transaction.reason || '—', fullWidth: true },
		{ label: t.date, value: formatDateTime(transaction.created_at), fullWidth: true },
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
				id='business-list-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<View style={styles.titleRow}>
					<ThemedText
						style={[styles.screenTitle, { color: textColor }]}
						lightColor={textColor}
						darkColor={textColor}
						numberOfLines={2}
					>
						{title}
					</ThemedText>
					{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				{canView ? (
					<>
						<SegmentedTabs
							tabs={periodTabs}
							activeKey={period}
							onChange={(key) => setPeriod(key as BusinessListPeriod)}
						/>

						<ThemedDropdown
							id='business-owner-filter'
							containerRef={ownerRef}
							placeholder={t.allOwners}
							options={ownerOptions}
							value={ownerLabel}
							setValue={(value: string) =>
								setOwnerId(
									value === t.allOwners
										? null
										: (owners.find((item) => item.name === value)?.id ?? null)
								)
							}
							showDropdown={showOwnerDropdown}
							setShowDropdown={setShowOwnerDropdown}
							openDirection='down'
						/>

						<ThemedText
							style={[styles.total, { color: textColor }]}
							lightColor={textColor}
							darkColor={textColor}
						>
							{`${t.total}: ${formatAmount(total, 2)}`}
						</ThemedText>

						<RecordList
							id='business-list'
							description={translateWithVariables(t.txCount, {
								count: formatAmount(transactions.length, 0),
							})}
							loading={loading && transactions.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && transactions.length === 0}
							emptyMessage={t.noTransactions}
						>
							{transactions.map((transaction, index) => (
								<RecordCard
									key={`${transaction.id}-${index}`}
									id={`business-tx-${transaction.id}-${index}`}
									title={transaction.router?.name || transaction.router_name || t.transactions}
									fields={fieldsFor(transaction)}
								/>
							))}
						</RecordList>

						{transactions.length > 0 ? (
							<ListPagination
								id='business-list-pagination'
								page={page}
								lastPage={lastPage}
								onPrev={() => setPage((current) => Math.max(1, current - 1))}
								onNext={() => setPage((current) => Math.min(lastPage, current + 1))}
							/>
						) : null}
					</>
				) : (
					<ThemedText
						style={[styles.description, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.staffOnly}
					</ThemedText>
				)}
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
	total: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['heading.two'],
	},
});
