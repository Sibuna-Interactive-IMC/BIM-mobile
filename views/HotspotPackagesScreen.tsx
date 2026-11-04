import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import * as factories from '@/helpers/factories';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { InternetPackage } from '@/types';
import InternetPackageOverlay, {
	InternetPackageOverlayMode,
} from '@/views/InternetPackageOverlay';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, useColorScheme } from 'react-native';

export default function HotspotPackagesScreen() {
	const navigation = useNavigation<any>();
	const { hotspotId, hotspotName } = useLocalSearchParams() as { hotspotId?: string, hotspotName?: string };
	const { user, language } = useGeneral();
	const { packages, setPackages, fetchPackages } = useTransaction();
	useColorScheme();
	// Theme helpers
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const background = useThemeColor({}, 'background');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');
	const white = useThemeColor({}, 'white');
	const actionButtonLight = useThemeColor({}, 'actionButton', 'light');
	const actionButtonDark = useThemeColor({}, 'actionButton', 'dark');
	const authButtonTextLight = useThemeColor({}, 'authButtonText', 'light');
	const authButtonTextDark = useThemeColor({}, 'authButtonText', 'dark');
	const [showOverlay, setShowOverlay] = useState(false);
	const [overlayMode, setOverlayMode] =
		useState<InternetPackageOverlayMode>('create');
	const [selectedPkg, setSelectedPkg] = useState<InternetPackage | undefined>(
		undefined
	);
	const overlayFadeAnim = useRef(new Animated.Value(0)).current;

	const [showPrompt, setShowPrompt] = useState(false);
	const promptFadeAnim = useRef(new Animated.Value(0)).current;

	// Animate overlay visibility
	useEffect(() => {
		// stop any ongoing animation to prevent jank
		if ((overlayFadeAnim as any).stopAnimation) {
			(overlayFadeAnim as any).stopAnimation();
		}
		Animated.timing(overlayFadeAnim, {
			toValue: showOverlay ? 1 : 0,
			duration: 160,
			useNativeDriver: true,
		}).start();
	}, [showOverlay, overlayFadeAnim]);

	// Animate prompt visibility
	useEffect(() => {
		if ((promptFadeAnim as any).stopAnimation) {
			(promptFadeAnim as any).stopAnimation();
		}
		Animated.timing(promptFadeAnim, {
			toValue: showPrompt ? 1 : 0,
			duration: 160,
			useNativeDriver: true,
		}).start();
	}, [showPrompt, promptFadeAnim]);

	// Build and track path
	const trackPath = useMemo(() => {
		return hotspotId
			? `/(authenticated)/routers/packages/${hotspotId}`
			: '/(authenticated)/routers/packages';
	}, [hotspotId]);
	useTrackHistory(trackPath);

	useEffect(() => {
		navigation.setOptions({
			headerProps: { goback: true },
		});
	}, [navigation]);

	useEffect(() => {
		// Ensure packages are loaded
		if (user && packages.length === 0) {
			(async () => {
				await fetchPackages();
			})();
		}
	}, [user, packages, fetchPackages]);

	const [refreshing, setRefreshing] = useState(false);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchPackages();
		} finally {
			setRefreshing(false);
		}
	}, [fetchPackages]);


	const t = translations[language]?.categories as any;

	const handleCreateNew = () => {
		setOverlayMode('create');
		setSelectedPkg(undefined);
		setShowOverlay(true);
	};
	const handleView = (pkg: InternetPackage) => {
		setOverlayMode('view');
		setSelectedPkg(pkg);
		setShowOverlay(true);
	};
	const handleEdit = (pkg: InternetPackage) => {
		setOverlayMode('edit');
		setSelectedPkg(pkg);
		setShowOverlay(true);
	};
	const handleDelete = (pkg: InternetPackage) => {
		setSelectedPkg(pkg);
		setShowPrompt(true);
	};

	const handleSubmitOverlay = (payload: {
		name: string;
		usersPerDevice: number;
		bandwidth: string;
		duration: number;
	}) => {
		const allowedNames = ['short', 'daily', 'weekly', 'monthly'] as const;
		type AllowedName = (typeof allowedNames)[number];
		const toPkgName = (s: string): AllowedName => {
			const v = (s || '').trim().toLowerCase() as AllowedName;
			return allowedNames.includes(v) ? v : 'short';
		};
		if (overlayMode === 'create') {
			const created = factories.generateInternetPackage({
				name: toPkgName(payload.name),
				"simultaneous-use": payload.usersPerDevice,
				"rate-limit": payload.bandwidth,
				"session-timeout": String(payload.duration),
			});
			setPackages((prev) => [created, ...prev]);
		} else if (overlayMode === 'edit' && selectedPkg) {
			setPackages((prev) =>
				prev.map((p) =>
					p[".id"] === selectedPkg[".id"]
						? {
							...p,
							name: toPkgName(payload.name),
							'simultaneous-use': payload.usersPerDevice,
							'rate-limit': payload.bandwidth,
							'session-timeout': String(payload.duration),
						}
						: p
				)
			);
		}
		setShowOverlay(false);
		setSelectedPkg(undefined);
	};

	const confirmDelete = () => {
		if (!selectedPkg) return setShowPrompt(false);
		setPackages((prev) => prev.filter((p) => p[".id"] !== selectedPkg[".id"]));
		setShowPrompt(false);
		setSelectedPkg(undefined);
	};

	return (
		<>
			<ParallaxScrollView
				headerBackgroundColor={{
					light: backgroundLight,
					dark: backgroundDark,
				}}
				refreshing={refreshing}
				onRefresh={handleRefresh}
				contentStyle={{ paddingHorizontal: 10 }}
				containerStyle={{ flex: 1 }}
			>
				<TileContainer
					id='hotspot-packages-header-tile'
					flat
					backgroundColor={background}
					style={{ width: '100%', marginBottom: 10 }}
				>
					<ScreenHeader
						id='hotspot-packages-header'
						title={t.packages.packagesOnHotspot.replace('{hotspotName}', hotspotName || '')}
						action={
							<ThemedButton
								title={t.buttons.createNewPackage}
								icon='plus'
								onPress={handleCreateNew}
								numberOfLines={1}
								style={{ borderRadius: 8 }}
								darkColor={actionButtonDark}
								lightColor={actionButtonLight}
								darkTextColor={authButtonTextDark}
								lightTextColor={authButtonTextLight}
							/>
						}
					/>
				</TileContainer>
				<TileContainer
					id='hotspot-packages-list-tile'
					flat
					backgroundColor={background}
					style={{ flexDirection: 'column' }}
				>
					<RecordList
						id={hotspotId || 'hotspot-packages'}
						isEmpty={packages.length === 0}
						emptyMessage={t.packages.noPackages}
					>
						{packages.map((p) => (
							<RecordCard
								key={p['.id'] ?? p.name}
								id={`hotspot-package-${p['.id'] ?? p.name}`}
								title={p.name}
								subtitle={p.display_name}
								fields={[
									{
										label: t.packages.usersPerDevice,
										value: p['simultaneous-use'] ?? '—',
									},
									{
										label: t.packages.bandwidth,
										value: p['rate-limit'] ?? '—',
									},
									{
										label: t.packages.durationHours,
										value: p['session-timeout'] ?? '—',
									},
								]}
								actions={[
									{
										label: t.packages.view,
										icon: 'eye.outline',
										tone: 'primary',
										onPress: () => handleView(p),
									},
									{
										label: t.packages.edit,
										icon: 'edit.outline',
										tone: 'warning',
										onPress: () => handleEdit(p),
									},
									{
										label: t.packages.delete,
										icon: 'delete.outline',
										tone: 'danger',
										onPress: () => handleDelete(p),
									},
								]}
							/>
						))}
					</RecordList>
				</TileContainer>
			</ParallaxScrollView>

			<InternetPackageOverlay
				visible={showOverlay}
				fadeAnim={overlayFadeAnim}
				mode={overlayMode}
				initial={selectedPkg}
				onClose={() => {
					setShowOverlay(false);
					setSelectedPkg(undefined);
				}}
				onSubmit={handleSubmitOverlay}
			/>
			<Prompt
				id='delete-internet-package'
				fadeAnim={promptFadeAnim}
				onClose={() => setShowPrompt(false)}
				visible={showPrompt}
				title={t.dashboard.confirmDeleteTitle}
				message={t.packages.deleteMessage}
				buttons={[
					{
						title: t.buttons.cancel,
						color: cancelButton,
						textColor: white,
						action: () => setShowPrompt(false),
					},
					{
						title: t.buttons.delete,
						color: dangerButton,
						textColor: white,
						action: confirmDelete,
					},
				]}
			/>
		</>
	);
}

