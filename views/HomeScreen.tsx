import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Dimensions,
	GestureResponderEvent,
	StyleSheet,
	useColorScheme,
} from 'react-native';

import DashboardTile from '@/components/DashboardTile';
import ApprovalBanners from '@/components/ApprovalBanners';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import TransactionVolumeChart from '@/components/TransactionVolumeChart';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { formatAmount, timeAgo, translateWithVariables } from '@/helpers';
import { signalAppReady } from '@/helpers/appReady';
import { isPlatformAdmin } from '@/helpers/permissions';
import { transactionStatusTone } from '@/helpers/transactionStatus';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { MicroTransaction } from '@/types';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
	const {
		setSelectedOption,
		language,
		user,
		refreshDashboard,
		dashboardLoading,
		lastDashboardUpdated,
	} = useGeneral();
	const dashboard = user?.dashboard;
	const isAdmin = isPlatformAdmin(user);
	const hasDashboardData =
		!!dashboard &&
		(Array.isArray(dashboard.recentTransactions) ||
			dashboard.todayTransactions !== undefined ||
			Array.isArray(dashboard.routerBalances) ||
			Array.isArray(dashboard.chartData));

	// Keep a label that updates every 60s while a last-updated timestamp exists.
	const [lastUpdatedLabel, setLastUpdatedLabel] = useState('');
	const isFocused = useIsFocused();

	useEffect(() => {
		if (!lastDashboardUpdated || !isFocused) {
			setLastUpdatedLabel('');
			return;
		}
		// Set immediately, then update every minute while screen is focused
		setLastUpdatedLabel(timeAgo(lastDashboardUpdated));
		const id = setInterval(() => {
			try {
				setLastUpdatedLabel(timeAgo(lastDashboardUpdated));
			} catch { }
		}, 60 * 1000);
		return () => clearInterval(id);
	}, [lastDashboardUpdated, isFocused]);

	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		console.log('Refreshing dashboard...');
		try {
			// Force a refresh to bypass the short-circuit when dashboard already exists
			await (refreshDashboard
				? refreshDashboard(true)
				: Promise.resolve(false));
		} catch {
			// ignore — refreshDashboard logs errors
		} finally {
			setRefreshing(false);
		}
	}, [refreshDashboard]);

	// explicitly track home page
	useTrackHistory('/(authenticated)/home');
	const width = Dimensions.get('window').width;
	const router = useRouter();
	useColorScheme();
	// Theme helpers
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const screenTitleTextLight = useThemeColor({}, 'screenTitleText', 'light');
	const screenTitleTextDark = useThemeColor({}, 'screenTitleText', 'dark');
	const headerText = useThemeColor({}, 'headers');
	const textLight = useThemeColor({}, 'text', 'light');
	const textDark = useThemeColor({}, 'text', 'dark');
	const chartBarColor = useThemeColor({}, 'dayIconBackground');
	const chartGridColor = useThemeColor({}, 'borderDark');
	const chartLabelColor = useThemeColor({}, 'text');
	const iconTint = useThemeColor({}, 'iconTint');
	const dayText = useThemeColor({}, 'dayText');
	const dayIconBackground = useThemeColor({}, 'dayIconBackground');
	const weekText = useThemeColor({}, 'weekText');
	const weekIconBackground = useThemeColor({}, 'weekIconBackground');
	const monthText = useThemeColor({}, 'monthText');
	const monthIconBackground = useThemeColor({}, 'monthIconBackground');
	const borderDark = useThemeColor({}, 'borderDark');
	const bim = useThemeColor({}, 'bim');
	const bimLight = useThemeColor({}, 'bim', 'light');
	const bimDark = useThemeColor({}, 'bim', 'dark');
	const authButtonTextLight = useThemeColor({}, 'authButtonText', 'light');
	const authButtonTextDark = useThemeColor({}, 'authButtonText', 'dark');
	const {
		dailyPurchasesTotal,
		weeklyPurchasesTotal,
		monthlyPurchasesTotal,
		lastSevenDaysPurchases,
		lastFiveTransactions,
		purchasesPerRouter,
		dailyVoucherUsersTotal,
		weeklyVoucherUsersTotal,
		monthlyVoucherUsersTotal,
	} = useTransaction();

	// Prefer server-provided recent transactions when available; fall back to
	// the TransactionContext-provided `lastFiveTransactions`.
	const renderTransactions: MicroTransaction[] =
		lastFiveTransactions && lastFiveTransactions.length > 0
			? lastFiveTransactions
			: [];
	const transactionVolumeData = user?.dashboard?.chartData
		? user.dashboard.chartData.map((chartPoint) => ({
				date: new Date(chartPoint.date),
				amount: Number(chartPoint.total) || 0,
			}))
		: (lastSevenDaysPurchases ?? []).map((purchase) => ({
				date: purchase.date,
				amount: purchase.amount,
			}));

	// Signal that the home screen is ready to be considered the first painted
	// app view. We call this after two animation frames to give the view time
	// to mount and paint.
	useEffect(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				signalAppReady();
			});
		});
	}, []);

	if (dashboardLoading && !hasDashboardData) {
		return (
			<ThemedView
				style={styles.loadingContainer}
				lightColor={background}
				darkColor={background}
			>
				<ActivityIndicator size='large' color={bim} />
			</ThemedView>
		);
	}

	return (
		<ParallaxScrollView
			onRefresh={onRefresh}
			refreshing={refreshing}
			headerBackgroundColor={{
				light: backgroundLight,
				dark: backgroundDark,
			}}
			contentStyle={{ paddingHorizontal: 10 }}
			onTouchStart={(e: GestureResponderEvent) => {
				e.stopPropagation(); // Prevent touch events from propagating to the drawer
				setSelectedOption(undefined);
			}}
		>
			<TileContainer
				id='home-header-tile'
				flat
				backgroundColor={background}
				style={{ width: '100%' }}
			>
				<ScreenHeader
					id='home-header'
					title={translations[language].categories.dashboard.title}
					description={
						typeof lastDashboardUpdated !== 'undefined' &&
						lastDashboardUpdated !== null
							? translateWithVariables(
									translations[language].categories.dashboard?.lastUpdated ||
										'Last updated: {time}',
									{ time: lastUpdatedLabel }
								)
							: undefined
					}
				/>
			</TileContainer>
			<ApprovalBanners
				id='home-approval-banners'
				counts={dashboard}
				language={language}
			/>
			<TileContainer
				id='home-content-tile'
				flat
				backgroundColor={background}
				style={{ width: '100%', gap: 12 }}
			>
				<DashboardTile
					id='todays-transactions'
					amount={dailyPurchasesTotal ?? 0}
					title={translations[language].categories.dashboard.todaysTransactions}
					iconName='cash'
					iconColor={iconTint}
					titleColor={dayText}
					iconBackgroundColor={dayIconBackground}
					iconSize={30}
					language={language}
				/>
				<DashboardTile
					id='weeks-transactions'
					amount={weeklyPurchasesTotal ?? 0}
					title={translations[language].categories.dashboard.weeksTransactions}
					iconName='calendar'
					iconColor={iconTint}
					titleColor={weekText}
					iconBackgroundColor={weekIconBackground}
					iconSize={30}
					language={language}
				/>
				<DashboardTile
					id='months-transactions'
					amount={monthlyPurchasesTotal ?? 0}
					title={translations[language].categories.dashboard.monthsTransactions}
					iconName='monthlyCalendar'
					iconColor={iconTint}
					titleColor={monthText}
					iconBackgroundColor={monthIconBackground}
					iconSize={30}
					language={language}
				/>
				<DashboardTile
					id='days-voucher-users'
					amount={dailyVoucherUsersTotal ?? 0}
					amountType='number'
					titleColor={dayText}
					title={translations[language].categories.dashboard.todaysVouchers}
					language={language}
				/>
				<DashboardTile
					id='weeks-voucher-users'
					amount={weeklyVoucherUsersTotal ?? 0}
					amountType='number'
					titleColor={weekText}
					title={translations[language].categories.dashboard.weeksVouchers}
					language={language}
				/>
				<DashboardTile
					id='months-voucher-users'
					amount={monthlyVoucherUsersTotal ?? 0}
					amountType='number'
					titleColor={monthText}
					title={translations[language].categories.dashboard.monthsVouchers}
					language={language}
				/>
				<TileContainer
					id='last-five-transactions'
					borderless
					backgroundColor={background}
					style={{
						flexDirection: 'column',
					}}
				>
					<ThemedView
						style={{ flex: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedText
							lightColor={screenTitleTextLight}
							darkColor={screenTitleTextDark}
							style={{
								width: '100%',
								textTransform: 'capitalize',
								fontSize: fontSize['heading.three'],
								fontWeight: fontWeight['heading.three'],
							}}
						>
							{translateWithVariables(
								translations[language].categories.dashboard.lastTransactions,
								{ number: 5 }
							)}
						</ThemedText>
					</ThemedView>
					<RecordList
						id='dashboard-last-transactions'
						isEmpty={renderTransactions.length === 0}
						emptyMessage={translations[language].categories.transactions.noTransactions}
					>
						{renderTransactions.map((transaction, index) => (
							<RecordCard
								key={index}
								id={`dashboard-transaction-${index}`}
								title={transaction.routerName || '—'}
								badge={{
									label:
										translations[language].categories.transactions[
											transaction.status
										] ?? transaction.status,
									tone: transactionStatusTone(transaction.status),
								}}
								fields={[
									{
										label: translations[language].categories.dashboard.amount,
										value: transaction.amount,
									},
									{
										label: translations[language].categories.dashboard.type,
										value: transaction.method.type,
									},
									{
										label: translations[language].categories.dashboard.date,
										value: transaction.date.toLocaleDateString(),
									},
									...(isAdmin && transaction.gateway
										? [
											{
												label: translations[language].categories.transactions.gateway,
												value: transaction.gateway,
											},
										]
										: []),
								]}
							/>
						))}
					</RecordList>
					<ThemedView
						style={{
							width: '100%',
							flex: 1,
							alignItems: 'center',
							justifyContent: 'center',
						}}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedButton
							title={translations[
								language
							].categories.buttons.allTransactions?.toUpperCase()}
							icon='transactions'
							onPress={() => router.push('/(authenticated)/transactions')}
							style={{
								borderRadius: 8,
							}}
							darkColor={bimDark}
							lightColor={bimLight}
							darkTextColor={authButtonTextDark}
							lightTextColor={authButtonTextLight}
						/>
					</ThemedView>
				</TileContainer>
				<TileContainer
					id='transaction-volume-chart'
					backgroundColor={background}
				>
					<ThemedView
						style={{ flex: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedText
							lightColor={screenTitleTextLight}
							darkColor={screenTitleTextDark}
							style={{
								width: '100%',
								textTransform: 'capitalize',
								fontSize: fontSize['heading.three'],
								fontWeight: fontWeight['heading.three'],
							}}
						>
							{translateWithVariables(
								translations[language].categories.dashboard.transVolume,
								{ number: 7 }
							)}
						</ThemedText>
					</ThemedView>
					<ThemedView
						lightColor={backgroundLight}
						darkColor={backgroundDark}
						style={{ marginVertical: 8 }}
					>
						<TransactionVolumeChart
							points={transactionVolumeData}
							width={width - 72}
							barColor={chartBarColor}
							gridColor={chartGridColor}
							labelColor={chartLabelColor}
						/>
					</ThemedView>
				</TileContainer>
				<TileContainer
					id='router-balances'
					backgroundColor={background}
				>
					<ThemedView
						style={{ flex: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedText
							lightColor={screenTitleTextLight}
							darkColor={screenTitleTextDark}
							style={{
								width: '100%',
								textTransform: 'capitalize',
								fontSize: fontSize['heading.three'],
								fontWeight: fontWeight['heading.three'],
							}}
						>
							{translations[language].categories.dashboard.routerBalances}
						</ThemedText>
					</ThemedView>
					<ThemedView
						style={{
							flexDirection: 'column',
							paddingBottom: 10
						}}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						{(user?.dashboard?.routerBalances
							? user.dashboard.routerBalances.map((rb) => ({
								name: rb.name,
								location: '',
								amount: rb.balance,
							}))
							: purchasesPerRouter ?? []
						).map((router, index) => (
							<ThemedView
								key={index}
								style={{
									flexDirection: 'row',
									width: '100%',
									paddingVertical: 5,
									paddingHorizontal: 12,
									justifyContent: 'space-between',
									borderBottomWidth:
										index === (purchasesPerRouter ?? []).length - 1 ? 1 : 0,
									borderBottomColor: borderDark,
									borderTopWidth: 1,
									borderTopColor: borderDark,
								}}
								lightColor={backgroundLight}
								darkColor={backgroundDark}
							>
								<ThemedText
									numberOfLines={1}
									style={{ width: 150, overflow: 'hidden' }}
									lightColor={textLight}
									darkColor={textDark}
								>
									{router.name}
								</ThemedText>
								<ThemedText
									style={{
										paddingHorizontal: 10,
										fontWeight: fontWeight['heading.one']
									}}
									lightColor={headerText}
									darkColor={headerText}
								>
									{formatAmount(router.amount)}
								</ThemedText>
							</ThemedView>
						))}
					</ThemedView>
				</TileContainer>
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	titleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	transactionItem: {
		padding: 12,
		borderRadius: 8,
		marginBottom: 8,
		borderWidth: 1,
		borderColor: '#ddd',
	},
	container: {
		flex: 1,
		padding: 16,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2, // For Android shadow
	},
	transactionContainer: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'flex-start',
		padding: 12,
		gap: 15,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
		borderWidth: 1,
		borderColor: '#ddd',
	},
});
