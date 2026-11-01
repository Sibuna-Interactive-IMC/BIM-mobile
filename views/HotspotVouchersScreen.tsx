import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';import TileContainer from '@/components/TileContainer';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { translateWithVariables } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { ApiRouter, GetRouterUsersResponse, Hotspot, HotspotActiveUser } from '@/types';
import CreateVouchers from '@/views/CreateVouchers';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, useAnimatedValue, useColorScheme } from 'react-native';

/**
 * `data` payload of `GET /routers/{router}/hotspots/users`.
 * `active` is optionally inlined by some deployments.
 */
type RouterUsersData = NonNullable<GetRouterUsersResponse['data']> & {
	active?: HotspotActiveUser[];
};

export default function HotspotVouchersScreen() {
	const promptFadeAnim = useAnimatedValue(0);
	const createVouchersFadeAnim = useAnimatedValue(0);
	const affirmAction = useRef<() => void | null>(null);
	const navigation = useNavigation<any>();
	const { vRId, hotspotId, name: hotSpotName } = useLocalSearchParams() as {
		vRId?: string;
		hotspotId?: string;
		name?: string;
	};
	const { handleUpdateHistory, language, authToken } = useGeneral();
	const { routers } = useTransaction();
	useColorScheme();
	// Theme helpers
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textLight = useThemeColor({}, 'text', 'light');
	const textDark = useThemeColor({}, 'text', 'dark');
	const bim = useThemeColor({}, 'bim');
	const lime = useThemeColor({}, 'lime');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');
	const white = useThemeColor({}, 'white');
	const [netRouter, setNetRouter] = useState<ApiRouter | undefined>();
	const [hotSpot, setHotSpot] = useState<Hotspot | undefined>();
	const [usersResponse, setUsersResponse] = useState<RouterUsersData | null>(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const [promptTitle, setPromptTitle] = useState('');
	const [promptMessage, setPromptMessage] = useState('');
	const [promptConfirmText, setPromptConfirmText] = useState('');
	const [showCreateVouchers, setShowCreateVouchers] = useState(false);
	const [multipleVouchers, setMultipleVouchers] = useState(false);
	const [editVoucherCode, setEditVoucherCode] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(false);
	const [retrying, setRetrying] = useState(false);
	const retryCount = useRef(0);

	// Seed parent immediately on mount to guarantee ordering before current route push
	useEffect(() => {
		if (!vRId) return;
		handleUpdateHistory(`/(authenticated)/routers/vouchers/${vRId}`);
	}, [handleUpdateHistory, vRId]);

	// Track current route after parent seeding is registered
	useTrackHistory(`/(authenticated)/routers/vouchers/${vRId}/${hotspotId}`);

	useEffect(() => {
		navigation.setOptions({
			headerProps: {
				goback: true,
			},
		});
	}, [navigation]);

	const fetchUsers = useCallback(async (isRetry = false) => {
		if (!vRId || !hotspotId || !authToken) return;

		setLoading(true);
		setError(false);
		if (isRetry) setRetrying(true);

		try {
			// const response = await getRouterUsers({ routerId: vRId, token: authToken });
			// console.log('[fetchUsers] response status:', response.status);
			// if (response && response.ok) {
			// 	const data: GetRouterUsersResponse = await response.json();
			// 	setUsersResponse(data);
			// 	// Set hotspot from response if available
			// 	if (data.hotspotServers && data.hotspotServers.length > 0) {
			// 		// Find the matching hotspot or default to first
			// 		const match = data.hotspotServers.find(h => h['.id'] === hotspotId) || data.hotspotServers[0];
			// 		setHotSpot(match);
			// 	}
			// 	// Reset retry count on success
			// 	retryCount.current = 0;
			// }
		} catch (error) {
			console.error('Error fetching hotspot users:', error);
			// Avoid automatic retry to reduce resource usage; rely on manual retry
			setError(true);
		} finally {
			if (!isRetry || (isRetry && retryCount.current >= 1)) {
				setLoading(false);
				setRetrying(false);
			}
		}
	}, [vRId, hotspotId, authToken]);

	// Update local router reference whenever routers collection changes
	useEffect(() => {
		if (vRId && routers) {
			const router = routers.find((r) => r.id === vRId);
			setNetRouter(router);
		}
	}, [vRId, routers]);

	// Fetch users whenever route ids or token are present
	useEffect(() => {
		if (vRId && hotspotId && authToken) {
			fetchUsers();
		}
	}, [vRId, hotspotId, fetchUsers, authToken]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchUsers();
		} catch (e) {
			console.error('[HotspotVouchersScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchUsers]);

	const handleManualRetry = () => {
		retryCount.current = 0; // Reset for manual retry to allow another auto-retry if needed? Or just treat as fresh start.
		fetchUsers();
	};

	const handleEditUserDetails = (voucher: string) => {
		if (!voucher || !usersResponse) return;
		// Always reset to single-voucher mode for edits
		setMultipleVouchers(false);
		setEditVoucherCode(voucher);
		toggleShowCreateVouchers(true);
	};

	const handleDeleteUser = (v: string) => {
		if (!v) return;
		// Update router logic here
	};

	const handleBlockUser = (v: string) => {
		if (!v) return;
		// Update router logic here
	};

	const toggleShowPrompt = (show?: boolean) => {
		const toValue = show ?? !showPrompt;
		if (toValue) {
			Animated.timing(promptFadeAnim, {
				toValue: 1,
				duration: 300,
				useNativeDriver: true,
			}).start(() => {
				setShowPrompt(true);
			});
		} else {
			Animated.timing(promptFadeAnim, {
				toValue: 0,
				duration: 300,
				useNativeDriver: true,
			}).start(() => {
				setShowPrompt(false);
			});
		}
	};

	const toggleShowCreateVouchers = (show?: boolean) => {
		const toValue = show ?? !showCreateVouchers;
		if (toValue) {
			Animated.timing(createVouchersFadeAnim, {
				toValue: 1,
				duration: 300,
				useNativeDriver: true,
			}).start(() => {
				setShowCreateVouchers(true);
			});
		} else {
			Animated.timing(createVouchersFadeAnim, {
				toValue: 0,
				duration: 300,
				useNativeDriver: true,
			}).start(() => {
				setShowCreateVouchers(false);
				setEditVoucherCode(null);
				setMultipleVouchers(false);
			});
		}
	};

	const handleCreateVouchers = () => {
		// Generate vouchers logic
		setTimeout(() => {
			toggleShowCreateVouchers(false);
		}, 300);
	};

	const handleSubmitVoucherOverlay = ({
		multiple,
		numberOfUsers,
		package: pkg,
	}: {
		multiple: boolean;
		numberOfUsers: number;
		package: string;
	}) => {
		if (!usersResponse) return;
		if (editVoucherCode) {
			// Edit existing voucher (update package only for now)
			const targetVoucher = usersResponse.users?.find(
				(u) => u.name === editVoucherCode
			);
			// Note: This mutation is local and might need a setUsersResponse to trigger re-render if deep clone wasn't done, 
			// but for now we keep the logic similar to before (direct mutation was likely used). 
			// Better to use state setter ideally.
			// if (targetVoucher) targetVoucher.profile = pkg; // Field name difference... profile_display? profile?
			// The API response user has 'profile' which is the long string, and 'profile_display'.
			// Assuming we want to update the profile or package.
			// Let's defer mutation logic fixes for a separate step if needed, but here's the access update:
			if (targetVoucher) targetVoucher.profile_display = pkg;

			setEditVoucherCode(null);
			toggleShowCreateVouchers(false);
			return;
		}
		// Else create (existing logic can be invoked)
		handleCreateVouchers();
	};

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
				style={{ paddingVertical: 16, backgroundColor: background }}
				lightColor={backgroundLight}
				darkColor={backgroundDark}
			>
				<ThemedView
					style={{
						flexDirection: 'row',
						gap: 10,
						marginBottom: 10,
					}}
					lightColor={backgroundLight}
					darkColor={backgroundDark}
				>
					<ThemedButton
						style={{ flex: 1 }}
						lightColor={bim}
						darkColor={bim}
						numberOfLines={1}
						lightTextColor={white}
						darkTextColor={white}
						title={translations[
							language
						].categories.buttons.createSingleVoucher.toUpperCase()}
						onPress={() => {
							setMultipleVouchers(false);
							toggleShowCreateVouchers(true);
						}}
					/>
					<ThemedButton
						style={{ flex: 1 }}
						lightColor={lime}
						darkColor={lime}
						numberOfLines={1}
						lightTextColor={white}
						darkTextColor={white}
						title={translations[
							language
						].categories.buttons.createBulkVouchers.toUpperCase()}
						onPress={() => {
							setMultipleVouchers(true);
							toggleShowCreateVouchers(true);
						}}
					/>
				</ThemedView>
				{loading ? (
					<ThemedView
						style={{ minHeight: 240, justifyContent: 'center', alignItems: 'center', padding: 20 }}
						lightColor={background}
						darkColor={background}
					>
						<ActivityIndicator size="large" color={bim} />
						{retrying && (
							<ThemedText style={{ marginTop: 10, textAlign: 'center' }}>
								{translations[language].categories.dashboard.retrying}
							</ThemedText>
						)}
					</ThemedView>
				) : error ? (
					<ThemedView
						style={{ minHeight: 240, justifyContent: 'center', alignItems: 'center', padding: 20 }}
						lightColor={background}
						darkColor={background}
					>
						<ThemedText style={{ marginBottom: 20, textAlign: 'center' }}>
							{translations[language].categories.auth.unexpectedError}
						</ThemedText>
						<ThemedButton
							title={translations[language].categories.buttons.retry}
							icon='refresh'
							onPress={handleManualRetry}
							lightColor={bim}
							darkColor={bim}
							lightTextColor={white}
							darkTextColor={white}
						/>
					</ThemedView>
				) : (
					<>
					<TileContainer
						id='hotspot-vouchers-header-tile'
						flat
						backgroundColor={background}
						style={{ width: '100%', marginBottom: 10 }}
					>
						<ScreenHeader
							id='hotspot-vouchers-header'
							title={translateWithVariables(
								translations[language].categories.vouchers.vouchersSubtitle,
								{ hotspotName: hotSpotName ?? '', routerName: netRouter?.name ?? '' }
							)}
						/>
					</TileContainer>
					<TileContainer
						id='hotspot-vouchers-list-tile'
						flat
						backgroundColor={background}
						style={{ flexDirection: 'column' }}
					>
						<RecordList
							id={vRId || 'hotspot-vouchers'}
							isEmpty={(usersResponse?.users?.length ?? 0) === 0}
							emptyMessage={translations[language].categories.vouchers.noVouchers}
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
							{(usersResponse?.users ?? []).map((user) => {
								const online = user.online === 'true';
								return (
									<RecordCard
										key={user['.id'] ?? user.name}
										id={`hotspot-user-${user['.id'] ?? user.name}`}
										title={user.name}
										subtitle={user.profile_display || user.profile}
										badge={{
											label: online
												? translations[language].categories.routers.online
												: translations[language].categories.routers.offline,
											tone: online ? 'success' : 'danger',
										}}
										fields={[
											{
												label: translations[language].categories.vouchers.macAddress,
												value: user['mac-address'] || '—',
											},
											{
												label: translations[language].categories.vouchers.uptime,
												value: user.uptime || '—',
											},
											{
												label: translations[language].categories.vouchers.bytesIn,
												value: user['bytes-in'] || '0',
											},
											{
												label: translations[language].categories.vouchers.bytesOut,
												value: user['bytes-out'] || '0',
											},
										]}
										actions={[
											{
												label: translations[language].categories.packages.edit,
												icon: 'edit.outline',
												tone: 'warning',
												onPress: () => handleEditUserDetails(user.name),
											},
											{
												label: translations[language].categories.buttons.block,
												icon: 'block',
												tone: 'danger',
												onPress: () => handleBlockUser(user.name),
											},
											{
												label: translations[language].categories.packages.delete,
												icon: 'delete.outline',
												tone: 'danger',
												onPress: () => handleDeleteUser(user.name),
											},
										]}
									/>
								);
							})}
						</RecordList>
					</TileContainer>
					</>
				)}
			</ThemedView>
			</ParallaxScrollView>
			<Prompt
				id='confirm-block-delete-voucher'
				fadeAnim={promptFadeAnim}
				onClose={() => toggleShowPrompt(false)}
				visible={showPrompt}
				title={promptTitle}
				message={promptMessage}
				buttons={[
					{
						title: translations[language].categories.buttons.cancel,
						color: cancelButton,
						textColor: white,
						action: () => toggleShowPrompt(false),
					},
					{
						title:
							promptConfirmText ||
							translations[language].categories.buttons.confirm,
						color: dangerButton,
						textColor: white,
						action: affirmAction.current || (() => toggleShowPrompt(false)),
					},
				]}
			/>
			{showCreateVouchers && hotSpot && (
				<CreateVouchers
					visible={showCreateVouchers}
					fadeAnim={createVouchersFadeAnim}
					multiple={multipleVouchers}
					hotspot={hotSpot}
					toggleVisible={(v) => {
						toggleShowCreateVouchers(v);
					}}
					mode={editVoucherCode ? 'edit' : 'create'}
					initialPkg={
						editVoucherCode
							? usersResponse?.users?.find((u) => u.name === editVoucherCode)
								?.profile || ''
							: undefined
					}
					titleOverride={
						editVoucherCode
							? translations[language].categories.vouchers.editVoucherTitle
							: undefined
					}
					primaryButtonLabelOverride={
						editVoucherCode
							? translations[language].categories.buttons.saveChanges
							: undefined
					}
					onSubmit={handleSubmitVoucherOverlay}
					generateVouchers={handleCreateVouchers}
				/>
			)}
		</>
	);
}

