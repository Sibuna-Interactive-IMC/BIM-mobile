import Loader from '@/components/Loader';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedView } from '@/components/ThemedView';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
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
import { Animated, StyleSheet, useAnimatedValue, useColorScheme } from 'react-native';

export default function PackageRouterHotspotsScreen() {
	useColorScheme();
	// Theme helpers
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const background = useThemeColor({}, 'background');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textLight = useThemeColor({}, 'text', 'light');
	const textDark = useThemeColor({}, 'text', 'dark');
	const router = useRouter();
	const navigation = useNavigation();
	const expoRouter = useRouter();
	const { rId } = useLocalSearchParams() as { rId?: string };
	const fadeAnim = useAnimatedValue(0);
		// memoize the path so useTrackHistory doesn't receive a new string each render
	const trackPath = useMemo(() => {
		return rId ? '/(authenticated)/routers/hotspots/packages/' + rId : undefined;
	}, [rId]);
	useTrackHistory(trackPath);
	const { packages, fetchPackages, routers } = useTransaction();
	const { user, language, handleUpdateHistory, authToken } = useGeneral();
	const [currentRouter, setCurrentRouter] = React.useState<ApiRouter>();
	const [hotspots, setHotspots] = React.useState<Hotspot[]>([]);
	const [loading, setLoading] = React.useState(false);
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
	}, [navigation, expoRouter]);

	useFocusEffect(
		useCallback(() => {
			if (!rId) return;
			const parent = '/(authenticated)/packages';
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
		}, [handleUpdateHistory, trackPath, rId])
	);

	useEffect(() => {
		if (user && packages.length === 0) {
			(async () => {
				await fetchPackages();
			})();
		}
	}, [user, packages, fetchPackages]);

	useEffect(() => {
		if (rId && routers) {
			const found = routers.find((r) => r.id === rId);
			setCurrentRouter(found);
		}
	}, [rId, routers]);


	const toggleOverlay = (show?: boolean) => {
		const val = show !== undefined ? show : !loading;
		if (val) {
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 300,
				useNativeDriver: true,
			}).start();
			setLoading(true);		
		} else {
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 300,
				useNativeDriver: true,
			}).start(() => {
				setLoading(false);
			});
		}
	}

	const fetchHotspots = useCallback(async (showOverlay = false) => {
		if (!rId || !authToken) return;
		if (showOverlay) toggleOverlay(true);
		try {
			const hotspotsResponse = await getRouterHotspots(rId, authToken);
			if (hotspotsResponse && hotspotsResponse.ok) {
				const hotspotsBody = await hotspotsResponse.json();
				// API 2.0: `{ data: { hotspots: [...] } }`
				const hotspotsData = getApiData<{ hotspots?: Hotspot[] }>(hotspotsBody);
				if (Array.isArray(hotspotsData?.hotspots)) {
					setHotspots(hotspotsData.hotspots);
				}
			}
		} catch (error) {
			console.error('Error fetching hotspots:', error);
		} finally {
			if (showOverlay) toggleOverlay(false);
		}
	}, [rId, authToken]);

	useEffect(() => {
		void fetchHotspots(true);
	}, [fetchHotspots]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchHotspots(false);
		} catch (e) {
			console.error('[PackageRouterHotspotsScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchHotspots]);


	return (
		<>
		<ParallaxScrollView
			contentStyle={{ paddingHorizontal: 10 }}
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
		<ThemedView
			lightColor={backgroundLight}
			darkColor={backgroundDark}
			style={styles.container}
		>
						<TileContainer
				id='package-router-hotspots-header-tile'
				flat
				backgroundColor={background}
				style={{ width: '100%', marginBottom: 10 }}
			>
				<ScreenHeader
					id='package-router-hotspots-header'
					title={translations[language].categories.hotspots.title}
					description={currentRouter?.name}
				/>
			</TileContainer>

<TileContainer
				id='hotspot-list-tile'
				flat
				backgroundColor={background}
				style={{ flexDirection: 'column' }}
			>
				<RecordList
					id={packageRouterHotspotsListId.current}
					isEmpty={hotspots.length === 0}
					emptyMessage={translations[language].categories.hotspots.noHotspots}
					headerAction={
						<ThemedButton
							title={translations[language].categories.buttons.retry}
							icon='refresh'
							onPress={() => void handleRefresh()}
							lightColor='transparent'
							darkColor='transparent'
							lightTextColor={textLight}
							darkTextColor={textDark}
						/>
					}
				>
					{hotspots.map((hotspot) => {
						const disabled =
							hotspot.disabled === true || hotspot.disabled === 'true';
						return (
							<RecordCard
								key={hotspot['.id'] ?? hotspot.name}
								id={`hotspot-${hotspot['.id'] ?? hotspot.name}`}
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
											translations[language].categories.buttons.viewPackages,
										icon: 'packages',
										tone: 'primary',
										onPress: () =>
											router.push(
												`/(authenticated)/routers/packages/${hotspot['.id']}`
											),
									},
								]}
							/>
						);
					})}
				</RecordList>
			</TileContainer>
		</ThemedView>
		</ParallaxScrollView>
			{loading && <Loader showOverlay={loading} fadeAnim={fadeAnim} toggleShowOverlay={toggleOverlay} />}
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'column',
	},
	routerItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
});
