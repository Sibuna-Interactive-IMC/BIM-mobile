import ListPagination from '@/components/ListPagination';
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
import { isPlatformStaff } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useHeaderBack from '@/hooks/useHeaderBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchBusinessRouters } from '@/services/AnalyticsService';
import type {
	BusinessRouterRow,
	GetBusinessRoutersResponse,
} from '@/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PAGE_SIZE = 20;

/** `GET /analytics/business/routers` — the full router leaderboard. */
export default function BusinessRoutersScreen() {
	useTrackHistory('/(authenticated)/business-analytics/routers');
	useHeaderBack('/(authenticated)/business-analytics');
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

	const [routers, setRouters] = useState<BusinessRouterRow[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(async () => {
		if (!authToken || !canView) return;
		setLoading(true);
		try {
			const res = await fetchBusinessRouters(authToken, {
				page,
				perPage: PAGE_SIZE,
			});
			if (!res.ok) {
				setRouters([]);
				return;
			}
			const body: GetBusinessRoutersResponse = await res.json();
			setRouters(
				getApiData<NonNullable<GetBusinessRoutersResponse['data']>>(body)?.routers ??
					[]
			);
			setLastPage(Math.max(1, getApiPagination(body, 'routers')?.last_page ?? 1));
		} catch (e) {
			console.error('[BusinessRoutersScreen] load failed', e);
			setRouters([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, canView, page]);

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

	const fieldsFor = (router: BusinessRouterRow): RecordField[] => [
		{ label: t.balance, value: formatAmount(router.balance ?? 0, 0), tone: 'info' },
		{ label: t.volume, value: formatAmount(router.total_volume ?? 0, 0) },
		{ label: t.owner, value: router.owner_name || '—', fullWidth: true },
		{ label: t.ipAddress, value: router.ip_address || '—' },
		{
			label: t.transactions,
			value: translateWithVariables(t.txCount, {
				count: formatAmount(router.total_transactions ?? 0, 0),
			}),
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
				id='business-routers-tile'
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
						{t.topRoutersTitle}
					</ThemedText>
					{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				{canView ? (
					<>
						<RecordList
							id='business-routers'
							loading={loading && routers.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && routers.length === 0}
							emptyMessage={t.noRouters}
						>
							{routers.map((router) => (
								<RecordCard
									key={router.id}
									id={`business-router-${router.id}`}
									title={router.name}
									fields={fieldsFor(router)}
								/>
							))}
						</RecordList>

						{routers.length > 0 ? (
							<ListPagination
								id='business-routers-pagination'
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
});
