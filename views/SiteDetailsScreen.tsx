import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordAction, RecordField } from '@/components/RecordList';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { isPlatformStaff } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useHeaderBack from '@/hooks/useHeaderBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { getRouterById, updateRouter } from '@/services/RouterService';
import {
	deleteAccessPoint,
	deleteSiteExpense,
	fetchSite,
} from '@/services/SiteService';
import type {
	ApiRouter,
	GetRouterResponse,
	GetSiteResponse,
	Site,
	SiteAccessPoint,
	SiteExpense,
} from '@/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	useAnimatedValue,
	useColorScheme,
	View,
} from 'react-native';

import AccessPointFormOverlay from '@/views/AccessPointFormOverlay';
import RouterOverlay from '@/views/Router';
import SiteExpenseOverlay from '@/views/SiteExpenseOverlay';
import SitePremisesOverlay from '@/views/SitePremisesOverlay';

type SiteTab = 'site' | 'expenses';
type PendingDelete = { kind: 'accessPoint' | 'expense'; id: number };

const ALL_MONTHS = 'all';

/** `GET /sites/{router}` plus the management actions the web site page has. */
export default function SiteDetailsScreen() {
	useTrackHistory('/(authenticated)/sites/[routerId]');
	useHeaderBack('/(authenticated)/sites');
	const { routerId } = useLocalSearchParams<{ routerId: string }>();
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.sites;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const colorScheme = useColorScheme();
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const border = useThemeColor({}, 'borderDark');
	const chip = useThemeColor({}, 'listItemBackground');

	const [site, setSite] = useState<Site>();
	const [routerProfile, setRouterProfile] = useState<ApiRouter>();
	const [accessPoints, setAccessPoints] = useState<SiteAccessPoint[]>([]);
	const [expenses, setExpenses] = useState<SiteExpense[]>([]);
	const [totals, setTotals] = useState<
		NonNullable<GetSiteResponse['data']>['totals']
	>();
	const [months, setMonths] = useState<string[]>([]);
	const [month, setMonth] = useState(ALL_MONTHS);
	const [tab, setTab] = useState<SiteTab>('site');
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const [showRouterForm, setShowRouterForm] = useState(false);
	const [showPremisesForm, setShowPremisesForm] = useState(false);
	const [showAccessPointForm, setShowAccessPointForm] = useState(false);
	const [showExpenseForm, setShowExpenseForm] = useState(false);
	const [editingAccessPoint, setEditingAccessPoint] =
		useState<SiteAccessPoint | null>(null);
	const [editingExpense, setEditingExpense] = useState<SiteExpense | null>(null);

	const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
	const [showDeletePrompt, setShowDeletePrompt] = useState(false);

	const premisesFade = useAnimatedValue(0);
	const accessPointFade = useAnimatedValue(0);
	const expenseFade = useAnimatedValue(0);
	const promptFade = useAnimatedValue(0);

	// The API enforces this too; the web page hides the same actions.
	const canManage =
		isPlatformStaff(user) ||
		(!!routerProfile && String(routerProfile.user_id) === String(user?.id)) ||
		user?.account?.role?.toLowerCase() === 'owner';

	const loadSite = useCallback(async () => {
		if (!authToken || !routerId) return;
		setLoading(true);
		try {
			const res = await fetchSite(String(routerId), authToken, { month });
			if (!res.ok) {
				setSite(undefined);
				return;
			}
			const body: GetSiteResponse = await res.json();
			const data = getApiData<NonNullable<GetSiteResponse['data']>>(body);
			setSite(data?.site);
			setAccessPoints(data?.access_points ?? []);
			setExpenses(data?.expenses ?? []);
			setTotals(data?.totals);
			setMonths(data?.filters?.available_months ?? []);
		} catch (e) {
			console.error('[SiteDetailsScreen] loadSite failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken, month, routerId]);

	useEffect(() => {
		void loadSite();
	}, [loadSite]);

	// The router profile carries the fields the premises payload omits
	// (ip address, router login) and the owner id used for permissions.
	useEffect(() => {
		let cancelled = false;
		if (!authToken || !routerId) return;
		(async () => {
			try {
				const res = await getRouterById(String(routerId), authToken);
				if (!res.ok) return;
				const body: GetRouterResponse = await res.json();
				if (cancelled) return;
				setRouterProfile(
					getApiData<NonNullable<GetRouterResponse['data']>>(body)?.router
				);
			} catch (e) {
				console.error('[SiteDetailsScreen] router profile failed', e);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [authToken, routerId]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadSite();
		} finally {
			setRefreshing(false);
		}
	}, [loadSite]);

	const monthLabel = useCallback(
		(value: string) => {
			if (value === ALL_MONTHS) return t.allMonths;
			const parsed = new Date(`${value}-01T00:00:00`);
			if (Number.isNaN(parsed.getTime())) return value;
			return parsed.toLocaleDateString(undefined, {
				month: 'short',
				year: 'numeric',
			});
		},
		[t.allMonths]
	);

	const monthTabs = useMemo(
		() =>
			[ALL_MONTHS, ...months].map((value) => ({
				key: value,
				label: monthLabel(value),
			})),
		[monthLabel, months]
	);

	const siteFields: RecordField[] = site
		? [
				{ label: t.location, value: site.location || '—' },
				{ label: t.type, value: site.type || '—' },
				{ label: t.landlord, value: site.site_detail?.landlord || '—' },
				{
					label: t.accessPoints,
					value: formatAmount(site.access_points_count ?? accessPoints.length, 0),
				},
				{
					label: t.allTimeTotal,
					value: formatAmount(totals?.total ?? site.total_expenses ?? 0, 0),
				},
				{
					label: t.thisMonthTotal,
					value: formatAmount(totals?.this_month ?? 0, 0),
				},
				{
					label: t.notes,
					value: site.site_detail?.notes || '—',
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

	const accessPointActions = (accessPoint: SiteAccessPoint): RecordAction[] => [
		{
			label: t.editAccessPoint,
			icon: 'edit.outline',
			tone: 'warning',
			onPress: () => {
				setEditingAccessPoint(accessPoint);
				accessPointFade.setValue(1);
				setShowAccessPointForm(true);
			},
		},
		{
			label: buttons.remove,
			icon: 'delete.outline',
			tone: 'danger',
			onPress: () => {
				setPendingDelete({ kind: 'accessPoint', id: accessPoint.id });
				promptFade.setValue(1);
				setShowDeletePrompt(true);
			},
		},
	];

	const compensationLabel = (expense: SiteExpense) => {
		const compensation = expense.compensation;
		if (compensation?.type === 'cash') {
			return compensation.disbursement_label || t.compensationCash;
		}
		if (compensation?.type === 'voucher') {
			return compensation.voucher_username || t.compensationVoucher;
		}
		return t.notCompensated;
	};

	const expenseFields = (expense: SiteExpense): RecordField[] => [
		{
			label: t.category,
			value: expense.category_label || expense.category || '—',
		},
		{
			label: t.amount,
			value: `${expense.currency || ''} ${formatAmount(expense.amount ?? 0, 2)}`.trim(),
			tone: 'warning',
		},
		{ label: t.incurredOn, value: expense.incurred_on || '—' },
		{
			label: t.appliesTo,
			value: expense.access_point_label
				? translateWithVariables(t.accessPointOption, {
						label: expense.access_point_label,
					})
				: translateWithVariables(t.routerWide, { name: site?.name ?? '' }),
			fullWidth: true,
		},
		{
			label: t.compensation,
			value: compensationLabel(expense),
			fullWidth: true,
		},
	];

	const expenseActions = (expense: SiteExpense): RecordAction[] => [
		{
			label: t.compensationTitle,
			icon: 'cash',
			tone: 'neutral',
			onPress: () => {
				setEditingExpense(expense);
				expenseFade.setValue(1);
				setShowExpenseForm(true);
			},
		},
		{
			label: buttons.delete,
			icon: 'delete.outline',
			onPress: () => {
				setPendingDelete({ kind: 'expense', id: expense.id });
				promptFade.setValue(1);
				setShowDeletePrompt(true);
			},
			tone: 'danger',
		},
	];

	const closePrompt = useCallback(() => {
		promptFade.setValue(0);
		setShowDeletePrompt(false);
		setPendingDelete(null);
	}, [promptFade]);

	const runDelete = useCallback(async () => {
		if (!authToken || !routerId || !pendingDelete) return;
		try {
			const res =
				pendingDelete.kind === 'accessPoint'
					? await deleteAccessPoint(String(routerId), pendingDelete.id, authToken)
					: await deleteSiteExpense(String(routerId), pendingDelete.id, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				return;
			}
			ShowAlert(
				pendingDelete.kind === 'accessPoint'
					? t.accessPointRemoved
					: t.expenseDeleted,
				'Success'
			);
			await loadSite();
		} catch (e) {
			console.error('[SiteDetailsScreen] delete failed', e);
			ShowAlert(t.saveFailed, 'Error');
		} finally {
			closePrompt();
		}
	}, [
		authToken,
		closePrompt,
		loadSite,
		pendingDelete,
		routerId,
		t.accessPointRemoved,
		t.expenseDeleted,
		t.saveFailed,
	]);

	const submitRouter = useCallback(
		async ({
			name,
			location,
			type,
			ipAddress,
			username,
			password,
		}: {
			name: string;
			location: string;
			type: string;
			ipAddress: string;
			username: string;
			password: string;
		}) => {
			if (!authToken || !routerId) return;
			try {
				const res = await updateRouter(
					String(routerId),
					{
						name,
						location,
						type,
						ip_address: ipAddress,
						router_user: username,
						...(password ? { router_password: password } : {}),
					},
					authToken
				);
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
					return;
				}
				ShowAlert(t.routerSaved, 'Success');
				setShowRouterForm(false);
				await loadSite();
			} catch (e) {
				console.error('[SiteDetailsScreen] router update failed', e);
				ShowAlert(t.saveFailed, 'Error');
			}
		},
		[authToken, loadSite, routerId, t.routerSaved, t.saveFailed]
	);

	const routerInitial = useMemo(
		() => ({
			name: site?.name ?? routerProfile?.name ?? '',
			location: site?.location ?? routerProfile?.location ?? '',
			type: site?.type ?? routerProfile?.type ?? 'Mikrotik',
			ipAddress: routerProfile?.ip_address ?? '',
			username: routerProfile?.router_user ?? '',
			password: '',
		}),
		[
			routerProfile?.ip_address,
			routerProfile?.location,
			routerProfile?.name,
			routerProfile?.router_user,
			routerProfile?.type,
			site?.location,
			site?.name,
			site?.type,
		]
	);

	const summaryCards = [
		{ key: 'total', label: t.allTimeTotal, value: totals?.total ?? 0 },
		{ key: 'month', label: t.thisMonthTotal, value: totals?.this_month ?? 0 },
		{
			key: 'period',
			label: month === ALL_MONTHS ? t.periodTotal : monthLabel(month),
			value: totals?.visible ?? 0,
		},
		{ key: 'shown', label: t.expensesShown, value: expenses.length },
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
				id='site-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<View style={styles.titleRow}>
					<View style={styles.titleText}>
						<ThemedText
							style={[styles.screenTitle, { color: textColor }]}
							lightColor={textColor}
							darkColor={textColor}
							numberOfLines={2}
						>
							{site?.name || routerProfile?.name || t.title}
						</ThemedText>
						{routerProfile || site ? (
							<ThemedText
								style={[styles.subtitle, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
								numberOfLines={1}
							>
								{[routerProfile?.ip_address, site?.location]
									.filter(Boolean)
									.join(' · ')}
							</ThemedText>
						) : null}
					</View>
					{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>
				<SegmentedTabs
					tabs={[
						{
							key: 'site',
							label: t.siteTab,
							count: accessPoints.length,
						},
						{
							key: 'expenses',
							label: t.expensesTab,
							count: expenses.length,
						},
					]}
					activeKey={tab}
					onChange={(key) => setTab(key as SiteTab)}
				/>
				{!canManage ? (
					<ThemedText
						style={[styles.description, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.readOnly}
					</ThemedText>
				) : null}
			</TileContainer>

			{tab === 'site' ? (
				<>
					<TileContainer
						id='site-content-tile'
						flat
						backgroundColor={background}
						style={{ width: '100%', gap: 12 }}
					>
					<TileContainer
						id='site-overview-tile'
						borderless
						backgroundColor={background}
						style={styles.section}
					>
						{site ? (
							<RecordCard
								id='site-overview'
								title={t.premises}
								fields={siteFields}
								actions={
									canManage
										? [
												{
													label: t.editRouter,
													icon: 'edit.outline',
													tone: 'warning',
													onPress: () => {
														setShowRouterForm(true);
													},
												},
												{
													label: t.editPremises,
													icon: 'edit.outline',
													tone: 'warning',
													onPress: () => {
														premisesFade.setValue(1);
														setShowPremisesForm(true);
													},
												},
											]
										: undefined
								}
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
						borderless
						backgroundColor={background}
						style={styles.section}
					>
						<RecordList
							id='site-access-points'
							title={t.accessPoints}
							description={
								accessPoints.length
									? translateWithVariables(t.accessPointsCount, {
											count: formatAmount(accessPoints.length, 0),
										})
									: undefined
							}
							headerAction={
								canManage ? (
									<ThemedButton
										title={t.addAccessPoint}
										icon='plus'
										onPress={() => {
											setEditingAccessPoint(null);
											accessPointFade.setValue(1);
											setShowAccessPointForm(true);
										}}
										numberOfLines={1}
										lightColor={bim}
										darkColor={bim}
										lightTextColor={white}
										darkTextColor={white}
										textStyle={styles.smallButtonText}
									/>
								) : undefined
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
									actions={canManage ? accessPointActions(accessPoint) : undefined}
								/>
							))}
						</RecordList>
					</TileContainer>
					</TileContainer>
				</>
			) : (
				<>
					<TileContainer
						id='site-expenses-content-tile'
						flat
						backgroundColor={background}
						style={{ width: '100%', gap: 12 }}
					>
					<TileContainer
						id='site-expense-summary-tile'
						borderless
						backgroundColor={background}
						style={styles.section}
					>
						<View style={styles.summaryRow}>
							{summaryCards.map((card) => (
								<View
									key={card.key}
									id={`site-expense-${card.key}`}
									style={[
										styles.summaryCard,
										{ backgroundColor: chip, borderColor: border },
									]}
								>
									<ThemedText
										style={[styles.summaryValue, { color: textColor }]}
										lightColor={textColor}
										darkColor={textColor}
										numberOfLines={1}
									>
										{formatAmount(card.value, 0)}
									</ThemedText>
									<ThemedText
										style={[styles.summaryLabel, { color: mutedText }]}
										lightColor={mutedText}
										darkColor={mutedText}
										numberOfLines={2}
									>
										{card.label}
									</ThemedText>
								</View>
							))}
						</View>
					</TileContainer>

					<TileContainer
						id='site-expenses-tile'
						borderless
						backgroundColor={background}
						style={styles.section}
					>
						<SegmentedTabs
							tabs={monthTabs}
							activeKey={month}
							onChange={setMonth}
						/>
						{canManage ? (
							<ThemedButton
								title={t.recordExpense}
								icon='plus'
								onPress={() => {
									setEditingExpense(null);
									expenseFade.setValue(1);
									setShowExpenseForm(true);
								}}
								numberOfLines={1}
								lightColor={bim}
								darkColor={bim}
								lightTextColor={white}
								darkTextColor={white}
								textStyle={styles.smallButtonText}
							/>
						) : null}
						<RecordList
							id='site-expenses'
							title={t.expenses}
							description={
								expenses.length
									? translateWithVariables(t.expensesCount, {
											count: formatAmount(expenses.length, 0),
										})
									: undefined
							}
							loading={loading && expenses.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && expenses.length === 0}
							emptyMessage={
								month === ALL_MONTHS
									? t.noExpenses
									: translateWithVariables(t.noExpensesInPeriod, {
											period: monthLabel(month),
										})
							}
						>
							{expenses.map((expense) => (
								<RecordCard
									key={expense.id}
									id={`site-expense-${expense.id}`}
									title={expense.description || expense.category_label || t.expenses}
									fields={expenseFields(expense)}
									actions={canManage ? expenseActions(expense) : undefined}
								/>
							))}
						</RecordList>
					</TileContainer>
					</TileContainer>
				</>
			)}

			<RouterOverlay
				visible={showRouterForm}
				mode='edit'
				initial={routerInitial}
				passwordOptional
				onCancel={() => setShowRouterForm(false)}
				onBack={() => setShowRouterForm(false)}
				onSubmit={(payload) => {
					void submitRouter(payload);
				}}
			/>

			<SitePremisesOverlay
				visible={showPremisesForm}
				fadeAnim={premisesFade}
				authToken={authToken ?? undefined}
				routerId={String(routerId ?? '')}
				initial={{
					landlord: site?.site_detail?.landlord,
					notes: site?.site_detail?.notes,
				}}
				onClose={() => {
					premisesFade.setValue(0);
					setShowPremisesForm(false);
				}}
				onSaved={() => {
					void loadSite();
				}}
			/>

			<AccessPointFormOverlay
				visible={showAccessPointForm}
				fadeAnim={accessPointFade}
				authToken={authToken ?? undefined}
				routerId={String(routerId ?? '')}
				editing={editingAccessPoint}
				onClose={() => {
					accessPointFade.setValue(0);
					setShowAccessPointForm(false);
					setEditingAccessPoint(null);
				}}
				onSaved={() => {
					void loadSite();
				}}
			/>

			<SiteExpenseOverlay
				visible={showExpenseForm}
				fadeAnim={expenseFade}
				authToken={authToken ?? undefined}
				routerId={String(routerId ?? '')}
				routerName={site?.name ?? ''}
				accessPoints={accessPoints}
				expense={editingExpense}
				onClose={() => {
					expenseFade.setValue(0);
					setShowExpenseForm(false);
					setEditingExpense(null);
				}}
				onSaved={() => {
					void loadSite();
				}}
			/>

			<Prompt
				id='site-delete-prompt'
				fadeAnim={promptFade}
				onClose={closePrompt}
				visible={showDeletePrompt}
				title={
					pendingDelete?.kind === 'accessPoint'
						? t.deleteAccessPointTitle
						: t.deleteExpenseTitle
				}
				message={
					pendingDelete?.kind === 'accessPoint'
						? t.deleteAccessPointMessage
						: t.deleteExpenseMessage
				}
				buttons={[
					{
						title: buttons.cancel,
						color: Colors[colorScheme ?? 'light'].cancelButton,
						textColor: Colors[colorScheme ?? 'light'].white,
						action: closePrompt,
					},
					{
						title: buttons.delete,
						color: Colors[colorScheme ?? 'light'].dangerButton,
						textColor: Colors[colorScheme ?? 'light'].white,
						action: () => {
							void runDelete();
						},
					},
				]}
			/>
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
	titleText: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	screenTitle: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	subtitle: {
		fontSize: fontSize['text.xsmall'],
	},
	description: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
	summaryRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	summaryCard: {
		flexGrow: 1,
		flexBasis: '47%',
		borderWidth: 1,
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 12,
		gap: 2,
	},
	summaryValue: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	summaryLabel: {
		fontSize: fontSize['text.xsmall'],
	},
	smallButtonText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
