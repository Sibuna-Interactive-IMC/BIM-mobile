import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';import TileContainer from '@/components/TileContainer';
import { ThemedView } from '@/components/ThemedView';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { ShowAlert } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { getApiData } from '@/helpers/apiResponse';
import { getRouterHotspots } from '@/services/RouterService';
import { ApiRouter, Hotspot } from '@/types';
import {
	useFocusEffect,
	useLocalSearchParams,
	useNavigation,
	useRouter,
} from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

export default function RouterVouchersScreen() {
	useColorScheme();
	// Theme helpers
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const navigation = useNavigation();
	const router = useRouter();
	const { vRId } = useLocalSearchParams() as { vRId?: string };
	// memoize the path so useTrackHistory doesn't receive a new string each render
	const trackPath = useMemo(() => {
		return vRId ? '/(authenticated)/routers/vouchers/' + vRId : undefined;
	}, [vRId]);
	useTrackHistory(trackPath);
	const { packages, fetchPackages, routers } = useTransaction();
	const { user, language, handleUpdateHistory, authToken } = useGeneral();
	const [currentRouter, setCurrentRouter] = React.useState<ApiRouter>();
	const [hotspots, setHotspots] = React.useState<Hotspot[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [refreshing, setRefreshing] = React.useState(false);

	// stable per-mount id to avoid duplicate handler registration during Fast Refresh
	const packageRouterHotspotsListId = useRef(
		`package-router-hotspots-list-${Math.random().toString(36).slice(2)}`
	);

	// avoid repeatedly seeding the parent history entry (prevents loops)
	const seededParentRef = useRef(false);

	useEffect(() => {
		navigation.setOptions({
			headerProps: {
				goback: true,
			},
		});
	}, [navigation]);

	useFocusEffect(
		useCallback(() => {
			if (!vRId) return;
			const parent = '/(authenticated)/vouchers';
			if (!seededParentRef.current) {
				handleUpdateHistory(parent);
				if (trackPath) {
					handleUpdateHistory(trackPath);
				}
				seededParentRef.current = true;
			}
			return () => {
				// on blur (cleanup)
				seededParentRef.current = false;
			};
		}, [handleUpdateHistory, trackPath, vRId])
	);

	const fetchHotspots = useCallback(async () => {
		if (!vRId || !authToken) return;
		setIsLoading(true);
		try {
			const hotspotsResponse = await getRouterHotspots(vRId, authToken);
			if (hotspotsResponse && hotspotsResponse.ok) {
				const hotspotsBody = await hotspotsResponse.json();
				// API 2.0: `{ data: { hotspots: [...] } }`
				const hotspotsData = getApiData<{ hotspots?: Hotspot[] }>(hotspotsBody);
				if (Array.isArray(hotspotsData?.hotspots)) {
					setHotspots(hotspotsData.hotspots);
				}
			} else {
				ShowAlert(translations[language].categories.errors.somethingWentWrong, 'Error');
			}
		} catch (e) {
			console.error('[VouchersHotspotScreen] fetchHotspots failed', e);
			ShowAlert(translations[language].categories.errors.somethingWentWrong, 'Error');
		} finally {
			setIsLoading(false);
		}
	}, [vRId, authToken, language]);

	useEffect(() => {
		void fetchHotspots();
	}, [fetchHotspots]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchHotspots();
		} catch (e) {
			console.error('[VouchersHotspotScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchHotspots]);

	useEffect(() => {
		if (user && packages.length === 0) {
			(async () => {
				await fetchPackages();
			})();
		}
	}, [user, packages, fetchPackages]);

	useEffect(() => {
		if (vRId && routers) {
			const found = routers.find((r) => r.id === vRId);
			setCurrentRouter(found);
		}
	}, [vRId, routers]);
	if (isLoading) {
			return (
				<ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} lightColor={background} darkColor={background}>
					<ActivityIndicator size="large" color={bim} />
				</ThemedView>
			);
		}
	return (
		<ParallaxScrollView
			containerStyle={styles.container}
			contentStyle={{ paddingHorizontal: 10 }}
			headerBackgroundColor={{ dark: backgroundDark, light: backgroundLight }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
						<TileContainer
				id='router-vouchers-header-tile'
				flat
				backgroundColor={background}
				style={{ width: '100%', marginBottom: 10 }}
			>
				<ScreenHeader
					id='router-vouchers-header'
					title={translations[language].categories.hotspots.title}
					description={currentRouter?.name}
				/>
			</TileContainer>

<TileContainer
				id='router-vouchers-list-tile'
				flat
				backgroundColor={background}
				style={{ flexDirection: 'column' }}
			>
				<RecordList
					id={packageRouterHotspotsListId.current}
					isEmpty={hotspots.length === 0}
					emptyMessage={translations[language].categories.hotspots.noHotspots}
				>
					{hotspots.map((hotspot) => {
						const disabled =
							hotspot.disabled === true || hotspot.disabled === 'true';
						return (
							<RecordCard
								key={hotspot['.id'] ?? hotspot.name}
								id={`voucher-hotspot-${hotspot['.id'] ?? hotspot.name}`}
								title={hotspot.name}
								badge={{
									label: disabled
										? translations[language].categories.hotspots.disabled
										: translations[language].categories.hotspots.enabled,
									tone: disabled ? 'danger' : 'success',
								}}
								fields={[
									{
										label: translations[language].categories.hotspots.interface,
										value: hotspot.interface,
									},
									{
										label: translations[language].categories.hotspots.profile,
										value: hotspot.profile,
									},
								]}
								actions={[
									{
										label:
											translations[language].categories.buttons.viewVouchers,
										icon: 'vouchers',
										tone: 'primary',
										onPress: () =>
											router.push({
												pathname:
													'/(authenticated)/routers/vouchers/[vRId]/[hotspotId]',
												params: {
													vRId: vRId ?? '',
													hotspotId: hotspot['.id'],
													name: hotspot.name,
												},
											}),
									},
								]}
							/>
						);
					})}
				</RecordList>
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		margin: 0,
	},
	routerItem: {
		borderBottomWidth: 1
	},
});
