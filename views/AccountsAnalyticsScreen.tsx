import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime } from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchAnalyticsAccounts } from '@/services/AnalyticsService';
import type { AnalyticsAccount, GetAnalyticsAccountsResponse } from '@/types';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PAGE_SIZE = 20;

/** `GET /analytics/accounts` — the accounts behind multi-party logins (admin only). */
export default function AccountsAnalyticsScreen() {
	useTrackHistory('/(authenticated)/accounts-analytics');
	useAccountsBack();
	const navigation = useRouter();
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.accountsAnalytics;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');

	const [accounts, setAccounts] = useState<AnalyticsAccount[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const loadAccounts = useCallback(async () => {
		if (!authToken || !isAdmin) return;
		setLoading(true);
		try {
			const res = await fetchAnalyticsAccounts(authToken, {
				page,
				perPage: PAGE_SIZE,
			});
			if (!res.ok) {
				setAccounts([]);
				return;
			}
			const body: GetAnalyticsAccountsResponse = await res.json();
			setAccounts(
				getApiData<NonNullable<GetAnalyticsAccountsResponse['data']>>(body)
					?.accounts ?? []
			);
			setLastPage(Math.max(1, getApiPagination(body, 'accounts')?.last_page ?? 1));
		} catch (e) {
			console.error('[AccountsAnalyticsScreen] loadAccounts failed', e);
			setAccounts([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, isAdmin, page]);

	useEffect(() => {
		void loadAccounts();
	}, [loadAccounts]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadAccounts();
		} finally {
			setRefreshing(false);
		}
	}, [loadAccounts]);

	const fieldsFor = (account: AnalyticsAccount): RecordField[] => [
		{ label: t.type, value: account.type_label || account.type || '—' },
		{ label: t.members, value: String(account.members_count ?? 0) },
		{
			label: t.accessLevels,
			value: account.access_levels_summary || '—',
			fullWidth: true,
		},
		{
			label: t.lastActive,
			value: account.last_active?.user_name
				? `${account.last_active.user_name}${
						account.last_active.role ? ` · ${account.last_active.role}` : ''
					}`
				: t.neverActive,
			fullWidth: true,
		},
		{ label: t.createdAt, value: formatDateTime(account.created_at) },
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
				id='accounts-analytics-tile'
				flat
				backgroundColor={background}
				style={styles.section}
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
					{isAdmin ? t.description : t.adminOnly}
				</ThemedText>

				{isAdmin ? (
					<>
						<RecordList
							id='analytics-accounts-list'
							loading={loading && accounts.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && accounts.length === 0}
							emptyMessage={t.noAccounts}
						>
							{accounts.map((account) => (
								<RecordCard
									key={account.id}
									id={`analytics-account-${account.id}`}
									title={account.name}
									fields={fieldsFor(account)}
									actions={[
										{
											label: t.view,
											icon: 'eye.outline',
											tone: 'primary',
											onPress: () =>
												navigation.push(
													`/(authenticated)/accounts-analytics/${account.id}` as Href
												),
										},
									]}
								/>
							))}
						</RecordList>

						{accounts.length > 0 ? (
							<ListPagination
								id='analytics-accounts-pagination'
								page={page}
								lastPage={lastPage}
								onPrev={() =>
									setPage((current) => Math.max(1, current - 1))
								}
								onNext={() =>
									setPage((current) => Math.min(lastPage, current + 1))
								}
							/>
						) : null}
					</>
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
