import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, translateWithVariables } from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useHeaderBack from '@/hooks/useHeaderBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchSite } from '@/services/SiteService';
import type {
	GetSiteResponse,
	SiteAccessPoint,
	SiteExpense,
} from '@/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/** `GET /sites/{router}`: premises, access points and expenses for one site. */
export default function SiteDetailsScreen() {
	useTrackHistory('/(authenticated)/sites/[routerId]');
	useHeaderBack('/(authenticated)/sites');
	const { routerId } = useLocalSearchParams<{ routerId: string }>();
	const { language, authToken } = useGeneral();
	const t = translations[language].categories.sites;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');

	const [site, setSite] = useState<GetSiteResponse['data']>();
	const [accessPoints, setAccessPoints] = useState<SiteAccessPoint[]>([]);
	const [expenses, setExpenses] = useState<SiteExpense[]>([]);
	const [accessPointTotal, setAccessPointTotal] = useState(0);
	const [expenseTotal, setExpenseTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const loadSite = useCallback(async () => {
		if (!authToken || !routerId) return;
		setLoading(true);
		try {
			const res = await fetchSite(String(routerId), authToken);
			if (!res.ok) {
				setSite(undefined);
				return;
			}
			const body: GetSiteResponse = await res.json();
			const data = getApiData<NonNullable<GetSiteResponse['data']>>(body);
			setSite(data ?? undefined);
			setAccessPoints(data?.access_points ?? []);
			setExpenses(data?.expenses ?? []);
			setAccessPointTotal(
				getApiPagination(body, 'access_points')?.total ??
					data?.access_points?.length ??
					0
			);
			setExpenseTotal(
				getApiPagination(body, 'expenses')?.total ?? data?.expenses?.length ?? 0
			);
		} catch (e) {
			console.error('[SiteDetailsScreen] loadSite failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken, routerId]);

	useEffect(() => {
		void loadSite();
	}, [loadSite]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadSite();
		} finally {
			setRefreshing(false);
		}
	}, [loadSite]);

	const siteFields: RecordField[] = site?.site
		? [
				{ label: t.location, value: site.site.location || '—' },
				{ label: t.type, value: site.site.type || '—' },
				{ label: t.landlord, value: site.site.site_detail?.landlord || '—' },
				{
					label: t.accessPoints,
					value: formatAmount(site.site.access_points_count ?? 0, 0),
				},
				{
					label: t.totalExpenses,
					value: formatAmount(site.totals?.total ?? 0, 0),
				},
				{
					label: t.spentThisMonth,
					value: formatAmount(site.totals?.this_month ?? 0, 0),
				},
				{
					label: t.notes,
					value: site.site.site_detail?.notes || '—',
					fullWidth: true,
				},
			]
		: [];

	const accessPointFields = (accessPoint: SiteAccessPoint): RecordField[] => [
		{ label: t.model, value: accessPoint.model || '—' },
		{ label: t.macAddress, value: accessPoint.mac_address || '—' },
		{
			label: t.physicalLocation,
			value: accessPoint.physical_location || '—',
			fullWidth: true,
		},
		{ label: t.installedOn, value: accessPoint.installed_on || '—' },
		{
			label: t.totalExpenses,
			value: formatAmount(accessPoint.expenses_total ?? 0, 0),
		},
	];

	const expenseFields = (expense: SiteExpense): RecordField[] => [
		{ label: t.category, value: expense.category_label || expense.category || '—' },
		{
			label: t.amount,
			value: `${expense.currency || ''} ${formatAmount(expense.amount ?? 0, 2)}`.trim(),
			tone: 'warning',
		},
		{ label: t.incurredOn, value: expense.incurred_on || '—' },
		{
			label: t.accessPoint,
			value: expense.access_point_label || '—',
		},
		{
			label: t.compensation,
			value:
				expense.compensation?.type === 'voucher'
					? expense.compensation.voucher_username || '—'
					: expense.compensation?.type === 'cash'
						? expense.compensation.disbursement_label || '—'
						: t.notCompensated,
			fullWidth: !!expense.compensation,
		},
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
				id='site-overview-tile'
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
						{site?.site?.name || t.title}
					</ThemedText>
					{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>
				{site?.site ? (
					<RecordCard
						id='site-overview'
						title={t.premises}
						fields={siteFields}
					/>
				) : !loading ? (
					<ThemedText
						style={[styles.description, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.notFound}
					</ThemedText>
				) : null}
			</TileContainer>

			<TileContainer
				id='site-access-points-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<RecordList
					id='site-access-points'
					title={t.accessPoints}
					description={
						accessPoints.length
							? translateWithVariables(t.accessPointsCount, {
									count: formatAmount(accessPointTotal, 0),
								})
							: undefined
					}
					loading={loading && accessPoints.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && accessPoints.length === 0}
					emptyMessage={t.noAccessPoints}
				>
					{accessPoints.map((accessPoint) => (
						<RecordCard
							key={accessPoint.id}
							id={`access-point-${accessPoint.id}`}
							title={accessPoint.label || accessPoint.name}
							fields={accessPointFields(accessPoint)}
						/>
					))}
				</RecordList>
			</TileContainer>

			<TileContainer
				id='site-expenses-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<RecordList
					id='site-expenses'
					title={t.expenses}
					description={
						expenses.length
							? translateWithVariables(t.expensesCount, {
									count: formatAmount(expenseTotal, 0),
								})
							: undefined
					}
					loading={loading && expenses.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && expenses.length === 0}
					emptyMessage={t.noExpenses}
				>
					{expenses.map((expense) => (
						<RecordCard
							key={expense.id}
							id={`site-expense-${expense.id}`}
							title={expense.description || expense.category_label || t.expenses}
							fields={expenseFields(expense)}
						/>
					))}
				</RecordList>
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
