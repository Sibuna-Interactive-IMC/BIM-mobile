import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { Colors } from '@/constants/Colors';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';import { useTransaction } from '@/context/TransactionContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { getApiData } from '@/helpers/apiResponse';
import { pingRouter } from '@/services/RouterService';
import { ApiRouter, PingRouterResponse } from '@/types';
import RouterOverlay from '@/views/Router';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, useAnimatedValue, useColorScheme } from 'react-native';
import { formatAmount } from '@/helpers/index';

export default function RoutersScreen() {
	const colorScheme = useColorScheme() ?? 'light';

	const bg = useThemeColor({}, 'background');
	const actionButton = useThemeColor({}, 'actionButton');
	const authButtonText = useThemeColor({}, 'authButtonText');
	const router = useRouter();
	const { routers, setRouters, fetchRouters } = useTransaction();
	const { language, authToken } = useGeneral();
	const promptFadeAnim = useAnimatedValue(0);
	const [showPrompt, setShowPrompt] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [editRouterId, setEditRouterId] = useState<string | undefined>();
	const [activeRouter, setActiveRouter] = useState<string | undefined>();
	const [refreshing, setRefreshing] = useState(false);
	const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});

	// compute initial values for edit modal when a router is selected
	const editInitial = useMemo(() => {
		if (!editRouterId || !routers) return undefined;
		const r = routers.find((x) => x.id === editRouterId);
		return r
			? {
				name: r.name,
				location: r.location,
				type: r.type,
				ipAddress: r.ip_address,
				username: r.router_user,
				password: r.router_password,
			}
			: undefined;
	}, [routers, editRouterId]);

	// stable per-mount id to avoid duplicate handler registration during Fast Refresh
	const routerListId = useRef(
		`router-list-${Math.random().toString(36).slice(2)}`
	);

	useFocusEffect(
		useCallback(() => {
			if (!routers || !authToken) return;
			routers.forEach(async (r) => {
				if (!r.id) return;
				try {
					const resp = await pingRouter(r.id, authToken);
					if (resp.ok) {
						const body: PingRouterResponse = await resp.json();
						// API 2.0: `{ data: { online } }`
						const ping = getApiData<NonNullable<PingRouterResponse['data']>>(body);
						setOnlineStatus((prev) => ({ ...prev, [r.id!]: ping?.online === true }));
					} else {
						setOnlineStatus((prev) => ({ ...prev, [r.id!]: false }));
					}
				} catch {
					setOnlineStatus((prev) => ({ ...prev, [r.id!]: false }));
				}
			});
		}, [routers, authToken])
	);

	// explicitly track this page in app history
	useTrackHistory('/(authenticated)/routers');

	useEffect(() => {
		if (!routers) {
			(async () => {
				await fetchRouters();
			})();
		}
	}, [routers, fetchRouters]);

	const toggleShowPrompt = (v?: boolean) => {
		const value = v ?? !showPrompt;
		if (value) {
			Animated.timing(promptFadeAnim, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start(() => setShowPrompt(true));
		} else {
			Animated.timing(promptFadeAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start(() => setShowPrompt(false));
		}
	};

	const handleAddRouter = () => {
		setShowCreateModal(true);
	};

	const handleViewRouter = (Router: ApiRouter) => {
		if (!Router.id) return;
		router.push({ pathname: '/routers/preview/[routerId]', params: { ...Router, routerId: Router.id } as any });
	};
	const handleEditRouter = (routerId: string) => {
		if (!routerId) return;
		setEditRouterId(routerId);
		setShowEditModal(true);
	};
	const handleDeleteRouter = () => {
		// Delete router logic here
		if (!routers) return;
		toggleShowPrompt(false);
	};

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchRouters();
		} catch (e) {
			console.error('[RoutersScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchRouters]);

	return (
		<>
			<ParallaxScrollView
				contentStyle={{ paddingHorizontal: 10 }}
				headerBackgroundColor={{
					light: bg,
					dark: bg,
				}}
				containerStyle={{ flex: 1 }}
				onRefresh={handleRefresh}
				refreshing={refreshing}
			>
				<TileContainer
					id='routers-header-tile'
					flat
					backgroundColor={bg}
					style={{ width: '100%' }}
				>
					<ScreenHeader
						id='routers-header'
						title={translations[language].categories.routers.title}
						action={
							<ThemedButton
								title={translations[language].categories.buttons.addRouter}
								icon='plus'
								numberOfLines={1}
								onPress={handleAddRouter}
								style={{ borderRadius: 8 }}
								darkColor={actionButton}
								lightColor={actionButton}
								darkTextColor={authButtonText}
								lightTextColor={authButtonText}
							/>
						}
					/>
				</TileContainer>
				<TileContainer
					id='routers-list-tile'
					flat
					backgroundColor={bg}
					style={{ flexDirection: 'column' }}
				>
					<RecordList
						id={routerListId.current}
						loading={!routers}
						loadingMessage={translations[language].categories.dashboard.loading}
						isEmpty={routers?.length === 0}
						emptyMessage={translations[language].categories.routers.noRouters}
					>
						{routers?.map((router) => {
							const status = onlineStatus[router.id];
							return (
								<RecordCard
									key={router.id}
									id={`router-${router.id}`}
									title={router.name}
									subtitle={router.location}
									badge={
										status === undefined
											? undefined
											: {
												label: status
													? translations[language].categories.routers.online
													: translations[language].categories.routers.offline,
												tone: status ? 'success' : 'danger',
											}
									}
									fields={[
										{
											label: translations[language].categories.dashboard.type,
											value: router.type,
										},
										{
											label: translations[language].categories.dashboard.ipAddress,
											value: router.ip_address,
										},
										{
											label: translations[language].categories.dashboard.balance,
											value: formatAmount(router.balance),
										},
										{
											label: translations[language].categories.dashboard.routerUsername,
											value: router.router_user,
										},
									]}
									actions={[
										{
											label: translations[language].categories.packages.view,
											icon: 'eye.outline',
											tone: 'primary',
											onPress: () => handleViewRouter(router),
										},
										{
											label: translations[language].categories.packages.edit,
											icon: 'edit.outline',
											tone: 'warning',
											onPress: () => handleEditRouter(router.id),
										},
										{
											label: translations[language].categories.packages.delete,
											icon: 'delete.outline',
											tone: 'danger',
											onPress: () => {
												setActiveRouter(router.id);
												toggleShowPrompt(true);
											},
										},
									]}
								/>
							);
						})}
					</RecordList>
				</TileContainer>
			</ParallaxScrollView>
			{/* Add Router Modal */}
			<RouterOverlay
				visible={showCreateModal}
				mode='add'
				onCancel={() => setShowCreateModal(false)}
				onBack={() => setShowCreateModal(false)}
				onSubmit={({ name, location, type, ipAddress, username, password }) => {
					// NOTE: This local update is temporary. In a real app, we'd refetch or optimistically update properly.
					// Since we are using ApiRouter structure, we need to match it.
					// For now, I'll just refetch to keep it simple and correct.
					fetchRouters();
					setShowCreateModal(false);
				}}
			/>

			{/* Edit Router Modal */}
			{editRouterId && (
				<RouterOverlay
					visible={showEditModal}
					mode='edit'
					initial={editInitial}
					onCancel={() => {
						setShowEditModal(false);
						setEditRouterId(undefined);
					}}
					onBack={() => {
						setShowEditModal(false);
						setEditRouterId(undefined);
					}}
					onSubmit={({
						name,
						location,
						type,
						ipAddress,
						username,
						password,
					}) => {
						if (!editRouterId || !routers) return;

						// Optimistic update for ApiRouter structure
						const updatedData: ApiRouter[] = routers.map((r) =>
							r.id === editRouterId
								? {
									...r,
									name,
									location,
									type,
									router_user: username,
									router_password: password,
									ip_address: ipAddress,
									updated_at: new Date().toISOString(),
								}
								: r
						);

						setRouters(updatedData)

						setShowEditModal(false);
						setEditRouterId(undefined);
					}}
				/>
			)}
			<Prompt
				id='delete-router-prompt'
				fadeAnim={promptFadeAnim}
				onClose={() => toggleShowPrompt(false)}
				visible={showPrompt}
				title={translations[language].categories.dashboard.confirmDeleteTitle}
				message={translations[language].categories.routers.deleteMessage}
				buttons={[
					{
						title: translations[language].categories.buttons.cancel,
						color: Colors[colorScheme].cancelButton,
						textColor: Colors[colorScheme].white,
						action: () => toggleShowPrompt(false),
					},
					{
						title: translations[language].categories.buttons.delete,
						color: Colors[colorScheme].dangerButton,
						textColor: Colors[colorScheme].white,
						action: handleDeleteRouter,
					},
				]}
			/>
		</>
	);
}

// styles previously used for container/routerItem are no longer necessary after ParallaxScrollView refactor
