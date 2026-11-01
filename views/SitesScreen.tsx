import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount } from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchSites } from '@/services/SiteService';
import type { GetSitesResponse, Site } from '@/types';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PAGE_SIZE = 20;

/** `GET /sites`: every site the caller can see, with its expense totals. */
export default function SitesScreen() {
	useTrackHistory('/(authenticated)/sites');
	useAccountsBack();
	const navigation = useRouter();
	const { language, authToken } = useGeneral();
	const t = translations[language].categories.sites;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');

	const [sites, setSites] = useState<Site[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const loadSites = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchSites(authToken, { page, perPage: PAGE_SIZE });
			if (!res.ok) {
				setSites([]);
				return;
			}
			const body: GetSitesResponse = await res.json();
			setSites(getApiData<NonNullable<GetSitesResponse['data']>>(body)?.sites ?? []);
			setLastPage(Math.max(1, getApiPagination(body, 'sites')?.last_page ?? 1));
		} catch (e) {
			console.error('[SitesScreen] loadSites failed', e);
			setSites([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, page]);

	useEffect(() => {
		void loadSites();
	}, [loadSites]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadSites();
		} finally {
			setRefreshing(false);
		}
	}, [loadSites]);

	const fieldsFor = (site: Site): RecordField[] => [
		{ label: t.location, value: site.location || '—' },
		{ label: t.type, value: site.type || '—' },
		{ label: t.accessPoints, value: formatAmount(site.access_points_count ?? 0, 0) },
		{
			label: t.totalExpenses,
			value: formatAmount(site.total_expenses ?? 0, 0),
			tone: site.total_expenses ? 'info' : 'default',
		},
	];

	const openSite = useCallback(
		(siteId: string) => {
			navigation.push(`/(authenticated)/sites/${siteId}` as Href);
		},
		[navigation]
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
				id='sites-overview-tile'
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
					{t.description}
				</ThemedText>

				<RecordList
					id='sites-list'
					loading={loading && sites.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && sites.length === 0}
					emptyMessage={t.noSites}
				>
					{sites.map((site) => (
						<RecordCard
							key={site.id}
							id={`site-${site.id}`}
							title={site.name}
							fields={fieldsFor(site)}
							onPress={() => openSite(site.id)}
							actions={[
								{
									label: t.view,
									icon: 'eye.outline',
									tone: 'primary',
									onPress: () => openSite(site.id),
								},
							]}
						/>
					))}
				</RecordList>

				{sites.length > 0 ? (
					<ListPagination
						id='sites-pagination'
						page={page}
						lastPage={lastPage}
						onPrev={() => setPage((current) => Math.max(1, current - 1))}
						onNext={() =>
							setPage((current) => Math.min(lastPage, current + 1))
						}
					/>
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
