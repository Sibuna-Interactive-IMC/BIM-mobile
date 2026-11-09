import { useFocusEffect } from '@react-navigation/native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import ScreenHeader from '@/components/ScreenHeader';import TileContainer from '@/components/TileContainer';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import type { IconSymbolName } from '@/components/ui/IconSymbol';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, translateWithVariables } from '@/helpers';
import { getApiData } from '@/helpers/apiResponse';
import { isPlatformAdmin, isPlatformStaff } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchAccountsSummary } from '@/services/AccountsService';
import type { AccountsSummary, GetAccountsSummaryResponse } from '@/types';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type HubTileConfig = {
	key: string;
	icon: IconSymbolName;
	tint: string;
	title: string;
	description: string;
	stat?: string;
	sub?: string;
	route: string;
};

function HubTile({ id, tile }: { id: string; tile: HubTileConfig }) {
	const navigation = useRouter();
	const background = useThemeColor({}, 'background');
	const border = useThemeColor({}, 'borderDark');
	const white = useThemeColor({}, 'white');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');

	return (
		<Pressable
			id={id}
			accessibilityRole='link'
			onPress={() => navigation.push(tile.route as Href)}
			style={({ pressed }) => [
				styles.tile,
				{
					backgroundColor: background,
					borderColor: border,
					opacity: pressed ? 0.85 : 1,
				},
			]}
		>
			<View style={styles.tileHeader}>
				<View style={[styles.iconChip, { backgroundColor: tile.tint }]}>
					<IconSymbol name={tile.icon} size={22} color={white} />
				</View>
				<ThemedText
					style={[styles.tileTitle, { color: textColor }]}
					lightColor={textColor}
					darkColor={textColor}
					numberOfLines={1}
				>
					{tile.title}
				</ThemedText>
				<IconSymbol name='chevron.right' size={18} color={mutedText} />
			</View>
			<ThemedText
				style={[styles.tileDescription, { color: mutedText }]}
				lightColor={mutedText}
				darkColor={mutedText}
			>
				{tile.description}
			</ThemedText>
			{tile.stat ? (
				<ThemedText
					style={[styles.tileStat, { color: textColor }]}
					lightColor={textColor}
					darkColor={textColor}
				>
					{tile.stat}
				</ThemedText>
			) : null}
			{tile.sub ? (
				<ThemedText
					style={[styles.tileSub, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{tile.sub}
				</ThemedText>
			) : null}
		</Pressable>
	);
}

/** The web /accounts hub: one tile per money area, fed by `GET /accounts/summary`. */
export default function AccountsScreen() {
	useTrackHistory('/(authenticated)/accounts');
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.accounts;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const lime = useThemeColor({}, 'lime');
	const lightBlue = useThemeColor({}, 'lightBlue');
	const skyMist = useThemeColor({}, 'skyMist');
	const yellow = useThemeColor({}, 'yellow');
	const error = useThemeColor({}, 'error');

	const isAdmin = isPlatformAdmin(user);
	const isStaff = isPlatformStaff(user);

	const [summary, setSummary] = useState<AccountsSummary | null>(null);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const loadSummary = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchAccountsSummary(authToken);
			if (!res.ok) {
				setSummary(null);
				return;
			}
			const body: GetAccountsSummaryResponse = await res.json();
			setSummary(getApiData<AccountsSummary>(body) ?? null);
		} catch (e) {
			console.error('[AccountsScreen] loadSummary failed', e);
			setSummary(null);
		} finally {
			setLoading(false);
		}
	}, [authToken]);

	// The hub's approval tile counts come from the server, so re-read them on
	// focus: returning from an approval leaves the old number behind.
	useFocusEffect(
		useCallback(() => {
			void loadSummary();
		}, [loadSummary])
	);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadSummary();
		} finally {
			setRefreshing(false);
		}
	}, [loadSummary]);

	const money = useCallback(
		(value?: number | null) => formatAmount(value ?? 0, 0),
		[]
	);

	const tiles = useMemo(() => {
		const list: HubTileConfig[] = [
			{
				key: 'transactions',
				icon: 'transactions',
				tint: bim,
				title: t.transactions,
				description: t.transactionsDesc,
				stat: translateWithVariables(t.transactionsStat, {
					payments: money(summary?.customer_payments_today),
					withdrawals: money(summary?.owner_withdrawals_today),
				}),
				sub: translateWithVariables(t.transactionsCollected, {
					amount: money(summary?.customer_payments_amount_today),
				}),
				route: '/(authenticated)/transactions',
			},
			{
				key: 'withdraw',
				icon: 'withdrawal',
				tint: yellow,
				title: t.withdraw,
				description: t.withdrawDesc,
				stat: translateWithVariables(t.withdrawStat, {
					count: money(summary?.routers_count),
				}),
				route: '/(authenticated)/withdraw',
			},
			{
				key: 'approvals',
				icon: 'check',
				tint: error,
				title: t.approvals,
				description: t.approvalsDesc,
				stat: translateWithVariables(t.approvalsStat, {
					count: money(summary?.my_pending_approvals),
				}),
				route: '/(authenticated)/withdraw-approvals',
			},
			{
				key: 'disbursements',
				icon: 'documents',
				tint: lightBlue,
				title: t.disbursements,
				description: t.disbursementsDesc,
				stat: translateWithVariables(t.disbursementsStat, {
					count: money(summary?.disbursement_count),
				}),
				route: '/(authenticated)/disbursement-records',
			},
			{
				key: 'sites',
				icon: 'sites',
				tint: lightBlue,
				title: t.sites,
				description: t.sitesDesc,
				stat: translateWithVariables(t.sitesStat, {
					count: money(summary?.routers_count),
				}),
				route: '/(authenticated)/sites',
			},
			{
				key: 'banks',
				icon: 'bank',
				tint: skyMist,
				title: t.banks,
				description: t.banksDesc,
				stat: translateWithVariables(t.banksStat, {
					count: money(summary?.banks_count),
				}),
				route: '/(authenticated)/banks',
			},
		];

		if (isStaff) {
			list.push({
				key: 'business',
				icon: 'analytics',
				tint: lime,
				title: t.business,
				description: t.businessDesc,
				stat: translateWithVariables(t.businessStat, {
					amount: money(summary?.global_credits_today),
				}),
				route: '/(authenticated)/business-analytics',
			});
		}

		if (isAdmin) {
			list.push(
				{
					key: 'accounts-analytics',
					icon: 'accounts',
					tint: bim,
					title: t.accountsAnalytics,
					description: t.accountsAnalyticsDesc,
					stat: translateWithVariables(t.accountsAnalyticsStat, {
						count: money(summary?.accounts_count),
					}),
					route: '/(authenticated)/accounts-analytics',
				},
				{
					key: 'users',
					icon: 'users',
					tint: lightBlue,
					title: t.users,
					description: t.usersDesc,
					stat: translateWithVariables(t.usersStat, {
						count: money(summary?.users_count),
					}),
					route: '/(authenticated)/admin-users',
				},
				{
					key: 'profit',
					icon: 'cash',
					tint: error,
					title: t.profit,
					description: t.profitDesc,
					stat: t.profitStat,
					route: '/(authenticated)/profit',
				},
				{
					key: 'payment-gateway',
					icon: 'gateway',
					tint: yellow,
					title: t.paymentGateway,
					description: t.paymentGatewayDesc,
					stat: t.paymentGatewayStat,
					route: '/(authenticated)/payment-gateway',
				}
			);
		}

		return list;
	}, [
		bim,
		error,
		isAdmin,
		isStaff,
		lightBlue,
		lime,
		money,
		skyMist,
		summary,
		t,
		yellow,
	]);

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='accounts-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='accounts-header'
					title={t.title}
					description={t.description}
					loading={loading}
				/>
			</TileContainer>

			<TileContainer
				id='accounts-overview-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<View style={styles.tiles}>
					{tiles.map((tile) => (
						<HubTile key={tile.key} id={`account-tile-${tile.key}`} tile={tile} />
					))}
				</View>
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
	tiles: {
		width: '100%',
		gap: 10,
	},
	tile: {
		width: '100%',
		borderWidth: 1,
		borderRadius: 10,
		padding: 12,
		gap: 6,
	},
	tileHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	iconChip: {
		width: 34,
		height: 34,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	tileTitle: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['text.large'],
		fontWeight: fontWeight['heading.two'],
	},
	tileDescription: {
		fontSize: fontSize['text.small'],
		lineHeight: 17,
	},
	tileStat: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['heading.two'],
	},
	tileSub: {
		fontSize: fontSize['text.small'],
	},
});
