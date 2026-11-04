import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { generateRandomInt, msToHms, ShowAlert, toBoolean } from '@/helpers';
import { getApiData } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { getRouterById, getRouterHotspots, getRouterPurchaseGuard, getRouterStatus, updateRouterPurchaseGuard } from '@/services/RouterService';
import { ApiRouter, GetPurchaseGuardResponse, GetRouterHotspotsResponse, GetRouterResponse, Hotspot, PostPurchaseGuardResponse } from '@/types';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

export interface RouterStatus {
	uptime?: string;
	version?: string;
	'cpu-load'?: string;
	'cpu-frequency'?: string;
	'free-memory'?: string;
	'total-memory'?: string;
	'free-hdd-space'?: string;
	'total-hdd-space'?: string;
	'architecture-name'?: string;
	'board-name'?: string;
	platform?: string;
}

export default function RouterPreviewScreen() {
	const navigation = useNavigation<any>();
	const router = useRouter();
	const { routerId, name } = useLocalSearchParams() as { routerId?: string, name?: string };
	const { handleUpdateHistory, language, authToken, routersLastFetched, setRoutersLastFetched } = useGeneral();

	// Theme helpers
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const headingOneLight = useThemeColor({}, 'heading.one', 'light');
	const headingOneDark = useThemeColor({}, 'heading.one', 'dark');;
	const textLight = useThemeColor({}, 'text', 'light');
	const textDark = useThemeColor({}, 'text', 'dark');
	const titleBgLight = useThemeColor({}, 'titleBg', 'light');
	const titleBgDark = useThemeColor({}, 'titleBg', 'dark');
	const bim = useThemeColor({}, 'bim');

	// State
	const [apiRouter, setApiRouter] = useState<Partial<ApiRouter>>();
	const [routerStatus, setRouterStatus] = useState<RouterStatus | undefined>();
	const [hotspots, setHotspots] = useState<Hotspot[]>([]);
	const [routerPurchaseGuard, setRouterPurchaseGuard] = useState(false);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// Seed parent immediately on mount to guarantee ordering before current route push
	useEffect(() => {
		handleUpdateHistory('/(authenticated)/routers');
	}, [handleUpdateHistory]);

	// Track current route after parent seeding is registered
	useTrackHistory(
		routerId
			? `/(authenticated)/routers/preview/${routerId}`
			: '/(authenticated)/routers'
	);

	useEffect(() => {
		navigation.setOptions({
			headerProps: {
				goback: true,
			},
		});
	}, [navigation]);

	// Fetch router data, status, and hotspots
	const fetchRouterData = useCallback(async () => {
		if (!routerId || !authToken || (routerId && routersLastFetched[routerId] && Date.now() - new Date(routersLastFetched[routerId]!).getTime() < 60000)) return;
		console.log('[RouterDetailsScreen] Fetching data for router ID:', routerId);
		setLoading(true);
		try {
			if (name && routerId)
				setApiRouter({ name, id: routerId });
			const routerResponse = await getRouterById(routerId, authToken);
			if (routerResponse && routerResponse.ok) {
				const routerBody: GetRouterResponse = await routerResponse.json();
				const routerData = getApiData<NonNullable<GetRouterResponse['data']>>(routerBody);
				if (routerData?.router) setApiRouter({ ...routerData.router });
			}

			const statusResponse = await getRouterStatus(routerId, authToken);
			if (statusResponse && statusResponse.ok) {
				const statusBody = await statusResponse.json();
				// API 2.0: `data.status` is a single cached resource record for the router.
				const statusData = getApiData<{ status?: RouterStatus | null }>(statusBody);
				const statusVal = statusData?.status;
				if (statusVal && typeof statusVal === 'object' && !Array.isArray(statusVal)) {
					setRouterStatus(statusVal);
				}
			}

			const hotspotsResponse = await getRouterHotspots(routerId, authToken);
			if (hotspotsResponse && hotspotsResponse.ok) {
				const hotspotsBody: GetRouterHotspotsResponse = await hotspotsResponse.json();
				const hotspotsData = getApiData<NonNullable<GetRouterHotspotsResponse['data']>>(hotspotsBody);
				if (Array.isArray(hotspotsData?.hotspots)) setHotspots(hotspotsData.hotspots);
			}
			const routerPurchaseGuard = await getRouterPurchaseGuard({ routerId, token: authToken });
			if (routerPurchaseGuard && routerPurchaseGuard.ok) {
				const guardBody: GetPurchaseGuardResponse = await routerPurchaseGuard.json();
				const guardData = getApiData<NonNullable<GetPurchaseGuardResponse['data']>>(guardBody);
				if (guardData?.purchase_guard)
					setRouterPurchaseGuard(toBoolean(guardData.purchase_guard.notify_existing_voucher));
			}

			setRoutersLastFetched && setRoutersLastFetched((prev) => ({ ...prev, [routerId]: new Date().toISOString() }));
		} catch (error) {
			console.error('[RouterDetailsScreen] Failed to fetch router data:', error);
			ShowAlert('Failed to fetch router data', 'Error')
		} finally {
			setLoading(false);
		}
	}, [routerId, name, authToken, routersLastFetched, setRoutersLastFetched]);

	useEffect(() => {
		void fetchRouterData();
	}, [fetchRouterData]);

	const handleUpdateRouterPurchaseGuard = useCallback(async (v: boolean) => {
		if (!routerId || !authToken) return;
		setLoading(true);
		try {
			const routerUpdateResult = await updateRouterPurchaseGuard({ routerId, token: authToken, value: v });
			if (routerUpdateResult.ok) {
				const guardBody: PostPurchaseGuardResponse = await routerUpdateResult.json();
				const guardData = getApiData<NonNullable<PostPurchaseGuardResponse['data']>>(guardBody);
				if (guardData?.purchase_guard)
					setRouterPurchaseGuard(toBoolean(guardData.purchase_guard.notify_existing_voucher));

			}
		} catch (error) {
			console.error('[RouterDetailsScreen] Failed to fetch router data:', error);
			ShowAlert("Something went wrong, please try again.", "Error");
		}
		finally {
			setLoading(false);
		}
	}, [routerId, authToken])

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchRouterData();
		} catch (e) {
			console.error('[RouterDetailsScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchRouterData]);

	const handleViewRouterDetails = (routerId?: string) => {
		if (!routerId) {
			console.error('[RouterDetailsScreen] No routerId provided for view details');
			return;
		}
		router.push(`/routers/details/${routerId}`);
	};


	if (loading) {
		return (
			<ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} lightColor={background} darkColor={background}>
				<ActivityIndicator size="large" color={bim} />
			</ThemedView>
		);
	}
	return (
		<ParallaxScrollView
			headerBackgroundColor={{
				light: backgroundLight,
				dark: backgroundDark,
			}}
			contentStyle={{
				paddingHorizontal: 10,
			}}
			containerStyle={{ flex: 1 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id={routerId || 'new-router-' + generateRandomInt(1000, 9999)}
				backgroundColor={background}
				style={{
					flexDirection: 'column',
					boxSizing: 'border-box',
					overflow: 'hidden',
					padding: 0,
				}}
			>
				<ThemedView
					id='router-tile-title'
					lightColor={backgroundLight}
					darkColor={backgroundDark}
					style={{ padding: 10 }}
				>
					<ThemedText
						style={{
							fontSize: fontSize['heading.one'],
							fontWeight: fontWeight['heading.two'],
						}}
						lightColor={headingOneLight}
						darkColor={headingOneDark}
					>
						{translations[language].categories.routers.router}
					</ThemedText>
				</ThemedView>
				<ThemedView
					id='router-id-container'
					lightColor={titleBgLight}
					darkColor={titleBgDark}
					style={{ flexDirection: 'column', paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 10, alignSelf: 'stretch', borderRadius: 5 }}
				>
					<ThemedText
						style={{
							fontSize: fontSize['heading.two'],
							fontWeight: fontWeight['heading.two'],
							marginBottom: 10,
						}}
						lightColor={headingOneLight}
						darkColor={headingOneDark}
					>
						{translations[language].categories.routers.routerID}
					</ThemedText>
					<ThemedText>{routerId}</ThemedText>
				</ThemedView>
				<ThemedView
					id='wireguard-key-container'
					lightColor={titleBgLight}
					darkColor={titleBgDark}
					style={{ flexDirection: 'column', paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 10, alignSelf: 'stretch', borderRadius: 5 }}
				>
					<ThemedText
						style={{
							fontSize: fontSize['heading.two'],
							fontWeight: fontWeight['heading.two'],
							marginBottom: 10,
						}}
						lightColor={headingOneLight}
						darkColor={headingOneDark}
					>
						{translations[language].categories.routers.wireguardPublicKey}
					</ThemedText>
					<ThemedText>{apiRouter?.wireguard_public_key}</ThemedText>
				</ThemedView>
				<ThemedView
					lightColor={backgroundLight}
					darkColor={backgroundDark}
					style={{ flexDirection: 'column', padding: 10 }}
				>
					<ThemedText
						style={{
							fontSize: fontSize['heading.one'],
							fontWeight: fontWeight['heading.two'],
							marginBottom: 10,
						}}
						lightColor={headingOneLight}
						darkColor={headingOneDark}
					>
						{translations[language].categories.routers.routerStatus}
					</ThemedText>
					<ThemedView
						lightColor={backgroundLight}
						darkColor={backgroundDark}
						style={{ flexDirection: 'row', alignItems: 'center' }}
					>
						<ThemedText
							lightColor={textLight}
							darkColor={textDark}
							style={styles.statusLabel}
						>
							{`${translations[language].categories.routers.uptime}:`}
						</ThemedText>
						<ThemedText style={{ marginLeft: 10 }}>
							{routerStatus?.uptime &&
								msToHms(parseInt(routerStatus.uptime))}
						</ThemedText>
					</ThemedView>
					<ThemedView
						lightColor={backgroundLight}
						darkColor={backgroundDark}
						style={{ flexDirection: 'row', alignItems: 'center' }}
					>
						<ThemedText
							lightColor={textLight}
							darkColor={textDark}
							style={styles.statusLabel}
						>
							{`${translations[language].categories.routers.routerOS}:`}
						</ThemedText>
						<ThemedText style={{ marginLeft: 10 }}>
							{routerStatus?.version}
						</ThemedText>
					</ThemedView>
					<ThemedView
						lightColor={backgroundLight}
						darkColor={backgroundDark}
						style={{ flexDirection: 'row', alignItems: 'center' }}
					>
						<ThemedText
							lightColor={textLight}
							darkColor={textDark}
							style={styles.statusLabel}
						>
							{`${translations[language].categories.routers.freeMemory}:`}
						</ThemedText>
						<ThemedText style={{ marginLeft: 10 }}>
							{routerStatus?.['free-memory']}
						</ThemedText>
					</ThemedView>
					<ThemedView
						lightColor={backgroundLight}
						darkColor={backgroundDark}
						style={{ flexDirection: 'row', alignItems: 'center' }}
					>
						<ThemedText
							lightColor={textLight}
							darkColor={textDark}
							style={styles.statusLabel}
						>
							{`${translations[language].categories.routers.totalMemory}:`}
						</ThemedText>
						<ThemedText style={{ marginLeft: 10 }}>
							{routerStatus?.['total-memory']}
						</ThemedText>
					</ThemedView>
					<ThemedView
						lightColor={backgroundLight}
						darkColor={backgroundDark}
						style={{ flexDirection: 'row', alignItems: 'center' }}
					>
						<ThemedText
							lightColor={textLight}
							darkColor={textDark}
							style={styles.statusLabel}
						>
							{`${translations[language].categories.routers.cpuFrequency}:`}
						</ThemedText>
						<ThemedText style={{ marginLeft: 10 }}>
							{routerStatus?.['cpu-frequency'] ? routerStatus?.['cpu-frequency'] + ' MHz' : 'N/A'}
						</ThemedText>
					</ThemedView>
					<ThemedView
						lightColor={backgroundLight}
						darkColor={backgroundDark}
						style={{ flexDirection: 'row', alignItems: 'center' }}
					>
						<ThemedText
							lightColor={textLight}
							darkColor={textDark}
							style={styles.statusLabel}
						>
							{`${translations[language].categories.routers.cpuLoad}:`}
						</ThemedText>
						<ThemedText lightColor={textLight} darkColor={textDark} style={{ marginLeft: 10 }}>
							{routerStatus?.['cpu-load'] ? routerStatus?.['cpu-load'] + '%' : 'N/A'}
						</ThemedText>
					</ThemedView>
				</ThemedView>
			</TileContainer>
			<TileContainer
				id={routerId || 'purchase-warning-' + generateRandomInt(1000, 9999)}
				backgroundColor={background}
				style={{
					flexDirection: 'column',
					boxSizing: 'border-box',
					overflow: 'hidden',
					padding: 0,
				}}
			>
				<ThemedView
					lightColor={backgroundLight}
					darkColor={backgroundDark}
					style={{ flexDirection: 'column', padding: 10 }}
				>
					<ThemedText
						style={{
							fontSize: fontSize['heading.two'],
							fontWeight: fontWeight['heading.two'],
							marginBottom: 10,
						}}
						lightColor={headingOneLight}
						darkColor={headingOneDark}
					>
						{translations[language].categories.vouchers.purchaseWarningTitle}
					</ThemedText>
					<ThemedText
						lightColor={textLight}
						darkColor={textDark}
					>
						{translations[language].categories.vouchers.purchaseWarningDesc}
					</ThemedText>
					<ThemedView lightColor={backgroundLight} darkColor={backgroundDark} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
						<ThemedSwitch
							darkColor={bim}
							lightColor={bim}
							disabled={loading}
							thumbColor={bim}
							value={routerPurchaseGuard}
							onValueChange={handleUpdateRouterPurchaseGuard}
						/>
						<ThemedView lightColor={backgroundLight} darkColor={backgroundDark}>
							<ThemedText lightColor={textLight} darkColor={textDark}>
								{translations[language].categories.vouchers.purchaseWarningSwitchLabel}
							</ThemedText>
						</ThemedView>
					</ThemedView>
				</ThemedView>
			</TileContainer>
			<TileContainer
				id='router-preview-hotspots-tile'
				flat
				backgroundColor={background}
				style={{ flexDirection: 'column', padding: 10 }}
			>
				<RecordList
					id={`hotspot-list-${routerId}`}
					title={`${translations[language].categories.routers.hotspotsTitle}: ${apiRouter?.name ?? ''}`}
					isEmpty={hotspots.length === 0}
					emptyMessage={translations[language].categories.hotspots.noHotspots}
				>
					{hotspots.map((hotspot) => {
						const disabled =
							hotspot.disabled === 'true' || hotspot.disabled === true;
						return (
							<RecordCard
								key={hotspot['.id'] ?? hotspot.name}
								id={`preview-hotspot-${hotspot['.id'] ?? hotspot.name}`}
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
											translations[language].categories.buttons.viewDetails,
										icon: 'routers.outline',
										tone: 'primary',
										onPress: () => handleViewRouterDetails(routerId),
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

/**
 * TODO: inside (authenticated)/routers/hotspots/details i need a dynamic route that takes hotspotId and displays hotspot details
 */

const styles = StyleSheet.create({
	statusLabel: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	colTitle: {
		fontSize: fontSize['text.small'],
		width: 120,
		textTransform: 'uppercase',
		paddingRight: 8,
	},
	colInfo: {
		width: 120,
		paddingRight: 8,
		overflow: 'hidden',
	},
});
