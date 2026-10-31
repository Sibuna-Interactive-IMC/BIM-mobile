import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount } from '@/helpers';
import { getApiData } from '@/helpers/apiResponse';
import { isPlatformStaff } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchBusinessSummary } from '@/services/AccountsService';
import type { BusinessListKind } from '@/services/AnalyticsService';
import type {
	BusinessAnalyticsSummary,
	BusinessStatPeriod,
	GetBusinessAnalyticsResponse,
} from '@/types';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

type PeriodKey = 'today' | 'week' | 'month';

/** A money section: three period cards plus a link to the full list. */
function StatSection({
	id,
	title,
	stats,
	kind,
	onOpen,
	pending,
}: {
	id: string;
	title: string;
	stats?: Record<string, BusinessStatPeriod>;
	kind: BusinessListKind;
	onOpen: (kind: BusinessListKind, period?: PeriodKey) => void;
	pending: boolean;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.businessAnalytics;

	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const border = useThemeColor({}, 'borderDark');
	const chip = useThemeColor({}, 'listItemBackground');
	const bim = useThemeColor({}, 'bim');

	const periods: { key: PeriodKey; label: string }[] = [
		{ key: 'today', label: t.today },
		{ key: 'week', label: t.week },
		{ key: 'month', label: t.month },
	];

	return (
		<View id={id} style={styles.section}>
			<View style={styles.sectionHeader}>
				<ThemedText
					style={[styles.sectionTitle, { color: textColor }]}
					lightColor={textColor}
					darkColor={textColor}
					numberOfLines={2}
				>
					{title}
				</ThemedText>
				<ThemedButton
					title={t.viewAll}
					onPress={() => onOpen(kind)}
					disabled={pending}
					lightColor='transparent'
					darkColor='transparent'
					lightTextColor={bim}
					darkTextColor={bim}
					textStyle={styles.linkText}
				/>
			</View>
			<View style={styles.periodRow}>
				{periods.map((period) => {
					const stat = stats?.[period.key];
					return (
						<Pressable
							key={period.key}
							id={`${id}-${period.key}`}
							accessibilityRole='link'
							onPress={() => onOpen(kind, period.key)}
							style={[
								styles.periodCard,
								{ backgroundColor: chip, borderColor: border },
							]}
						>
							<ThemedText
								style={[styles.periodValue, { color: textColor }]}
								lightColor={textColor}
								darkColor={textColor}
								numberOfLines={1}
							>
								{formatAmount(stat?.total ?? 0, 0)}
							</ThemedText>
							<ThemedText
								style={[styles.periodMeta, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
								numberOfLines={2}
							>
								{`${formatAmount(stat?.count ?? 0, 0)} · ${period.label}`}
							</ThemedText>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

/** `GET /analytics/business/summary` plus its three drill-down lists. */
export default function BusinessAnalyticsScreen() {
	useTrackHistory('/(authenticated)/business-analytics');
	useAccountsBack();
	const navigation = useRouter();
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.businessAnalytics;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const canView = isPlatformStaff(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');

	const [summary, setSummary] = useState<BusinessAnalyticsSummary | null>(null);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(async () => {
		if (!authToken || !canView) return;
		setLoading(true);
		try {
			const res = await fetchBusinessSummary(authToken);
			if (!res.ok) {
				setSummary(null);
				return;
			}
			const body: GetBusinessAnalyticsResponse = await res.json();
			setSummary(getApiData<BusinessAnalyticsSummary>(body) ?? null);
		} catch (e) {
			console.error('[BusinessAnalyticsScreen] load failed', e);
			setSummary(null);
		} finally {
			setLoading(false);
		}
	}, [authToken, canView]);

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

	const openList = useCallback(
		(kind: BusinessListKind, period?: PeriodKey) => {
			const query = period ? `?period=${period}` : '';
			navigation.push(`/(authenticated)/business-analytics/${kind}${query}` as Href);
		},
		[navigation]
	);

	const topRouters = summary?.top_routers ?? [];
	const chart = summary?.chart_data;

	const voucherFields: RecordField[] = useMemo(
		() => [
			{ label: t.today, value: formatAmount(summary?.voucher_stats?.today ?? 0, 0) },
			{ label: t.week, value: formatAmount(summary?.voucher_stats?.week ?? 0, 0) },
			{ label: t.month, value: formatAmount(summary?.voucher_stats?.month ?? 0, 0) },
			{ label: t.allTime, value: formatAmount(summary?.voucher_stats?.total ?? 0, 0) },
		],
		[summary?.voucher_stats, t.allTime, t.month, t.today, t.week]
	);

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='business-analytics-tile'
				flat
				backgroundColor={background}
				style={styles.container}
			>
				<View style={styles.titleRow}>
					<ThemedText
						style={[styles.screenTitle, { color: textColor }]}
						lightColor={textColor}
						darkColor={textColor}
						numberOfLines={1}
					>
						{t.title}
					</ThemedText>
					{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>
				<ThemedText
					style={[styles.description, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{canView ? t.description : t.staffOnly}
				</ThemedText>

				{canView ? (
					<>
						<StatSection
							id='business-collections'
							title={t.collectionsTitle}
							stats={summary?.credit_stats}
							kind='credits'
							onOpen={openList}
							pending={loading && !summary}
						/>
						<StatSection
							id='business-withdrawals-section'
							title={t.withdrawalsTitle}
							stats={summary?.withdrawal_stats}
							kind='withdrawals'
							onOpen={openList}
							pending={loading && !summary}
						/>
						<StatSection
							id='business-charges-section'
							title={t.chargesTitle}
							stats={summary?.charge_stats}
							kind='charges'
							onOpen={openList}
							pending={loading && !summary}
						/>

						<RecordList
							id='business-voucher-users'
							title={t.voucherUsers}
							loading={loading && !summary}
							loadingMessage={loadingCopy}
							isEmpty={!loading && !summary}
							emptyMessage={t.description}
						>
							<RecordCard id='business-voucher-stats' fields={voucherFields} />
						</RecordList>

						<RecordList
							id='business-trends'
							title={t.trends}
							description={t.trendsHint}
							loading={loading && !summary}
							loadingMessage={loadingCopy}
							isEmpty={!loading && !chart?.dates?.length}
							emptyMessage={t.trendsHint}
						>
							{chart?.dates?.length ? (
								<LineChart
									data={{
										labels: chart.dates,
										datasets: [
											{
												data: chart.credits ?? [],
												color: (opacity = 1) => `rgba(238, 132, 56, ${opacity})`,
												strokeWidth: 2,
											},
											{
												data: chart.withdrawals ?? [],
												color: (opacity = 1) => `rgba(41, 197, 249, ${opacity})`,
												strokeWidth: 2,
											},
											{
												data: chart.charges ?? [],
												color: (opacity = 1) => `rgba(255, 193, 7, ${opacity})`,
												strokeWidth: 2,
											},
										],
										legend: [t.credits, t.withdrawals, t.charges],
									}}
									width={Math.max(260, Dimensions.get('window').width - 60)}
									height={220}
									yAxisLabel=''
									segments={4}
									fromZero
									bezier
									withDots={false}
									chartConfig={{
										backgroundGradientFrom: background,
										backgroundGradientTo: background,
										decimalPlaces: 0,
										propsForLabels: { fontSize: 9 },
										color: (opacity = 1) => `rgba(99, 101, 120, ${opacity})`,
										labelColor: (opacity = 1) => `rgba(99, 101, 120, ${opacity})`,
									}}
									style={styles.chart}
								/>
							) : null}
						</RecordList>

						<RecordList
							id='business-top-routers'
							title={t.topRoutersTitle}
							loading={loading && topRouters.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && topRouters.length === 0}
							emptyMessage={t.noTopRouters}
						>
							{topRouters.map((router) => (
								<RecordCard
									key={router.id}
									id={`business-router-${router.id}`}
									title={router.name}
									fields={[
										{
											label: t.balance,
											value: formatAmount(router.balance ?? 0, 0),
											tone: 'info',
										},
										{ label: t.owner, value: router.owner || '—', fullWidth: true },
									]}
								/>
							))}
						</RecordList>

						<View style={styles.viewAllRow}>
							<ThemedButton
								title={t.viewAll}
								onPress={() =>
									navigation.push(
										'/(authenticated)/business-analytics/routers' as Href
									)
								}
								lightColor='transparent'
								darkColor='transparent'
								lightTextColor={bim}
								darkTextColor={bim}
								textStyle={styles.linkText}
							/>
						</View>
					</>
				) : null}
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		width: '100%',
		gap: 12,
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
	section: {
		width: '100%',
		gap: 8,
	},
	sectionHeader: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	sectionTitle: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['text.large'],
		fontWeight: fontWeight['heading.two'],
	},
	periodRow: {
		width: '100%',
		flexDirection: 'row',
		gap: 8,
	},
	periodCard: {
		flex: 1,
		minWidth: 0,
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 8,
		gap: 2,
	},
	periodValue: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	periodMeta: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 13,
	},
	linkText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
	viewAllRow: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'flex-end',
	},
	chart: {
		marginTop: 4,
		borderRadius: 8,
	},
});
