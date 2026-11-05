import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Animated,
	ScrollView,
	StyleSheet,
	TouchableOpacity,
	useAnimatedValue,
	View,
} from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { SegmentedTab, SegmentedTabs } from '@/components/SegmentedTabs';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { parseApiError } from '@/helpers/api';
import { getApiData } from '@/helpers/apiResponse';
import {
	formatAmount,
	isTruthy,
	translateWithVariables,
} from '@/helpers/index';
import {
	canDeletePortalPackage,
	canDeleteSharedRadiusProfile,
} from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import * as PackageService from '@/services/PackageService';
import {
	ApiRouter,
	GetPackageRoutersResponse,
	GetPortalPackagesResponse,
	GetSharedRadiusProfilesResponse,
	GetTrialSettingsResponse,
	PortalPackage,
	SharedRadiusProfile,
	TrialSettings,
} from '@/types';
import PackageForm, {
	PackageFormValues,
} from '@/views/PackageForm';
import PackageRoutersCard from '@/views/PackageRoutersCard';
import RadiusProfileForm, {
	RadiusProfileFormValues,
} from '@/views/RadiusProfileForm';
import TrialSettingsRow from '@/views/TrialSettingsRow';

type TabKey = 'packages' | 'routers' | 'profiles' | 'trial';

function visibleRouterCount(pkg: PortalPackage) {
	return (pkg.routers ?? []).filter((router) => router.visible).length;
}

function profileDuration(
	profile: SharedRadiusProfile,
	format: (key: string, variables: Record<string, string | number>) => string
) {
	if (profile.duration) return profile.duration;
	const seconds = Number(profile.duration_seconds ?? 0);
	if (!Number.isFinite(seconds) || seconds <= 0) return '—';
	if (seconds % 86400 === 0)
		return format('durationDaysValue', { value: seconds / 86400 });
	if (seconds % 3600 === 0)
		return format('durationHoursValue', { value: seconds / 3600 });
	return format('durationMinutesValue', { value: Math.round(seconds / 60) });
}

export default function PackagesScreen() {
	useTrackHistory('/(authenticated)/packages');
	const router = useRouter();
	const { language, authToken, user, setAppMessage } = useGeneral();
	const { routers, fetchRouters } = useTransaction();

	const bg = useThemeColor({}, 'background');
	const tropicalBlue = useThemeColor({}, 'tropicalBlue');
	const skyMist = useThemeColor({}, 'skyMist');
	const bimColor = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const border = useThemeColor({}, 'borderDark');
	const chipBg = useThemeColor({}, 'listItemBackground');
	const selectedBg = useThemeColor({}, 'bim');
	const selectedText = useThemeColor({}, 'authButtonText');
	const errorColor = useThemeColor({}, 'error');

	const isAdmin = isTruthy(user?.platform?.is_admin);
	const isStaff = isTruthy(user?.platform?.is_staff);
	const canManageProfiles = isAdmin || isStaff;
	// Deletion rules are checked locally to avoid a pointless server round trip.
	// "No voucher users assigned" stays a server-side check, since this screen
	// has no per-package user counts.
	const canDeleteProfile = canDeleteSharedRadiusProfile(user);
	const canDeletePackage = useCallback(
		(pkg: PortalPackage) => canDeletePortalPackage(user, pkg),
		[user]
	);

	const packagesCopy = (translations[language]?.categories?.packages ??
		translations.en.categories.packages) as Record<string, string>;
	const buttonsCopy =
		translations[language]?.categories?.buttons ??
		translations.en.categories.buttons;
	const currency =
		translations[language]?.categories?.dashboard?.currency ??
		translations.en.categories.dashboard.currency;
	const t = useCallback(
		(key: string) =>
			packagesCopy[key] ?? translations.en.categories.packages[key] ?? '',
		[packagesCopy]
	);
	const tv = useCallback(
		(key: string, variables: Record<string, string | number>) =>
			translateWithVariables(t(key), variables),
		[t]
	);

	const tabs = useMemo<SegmentedTab[]>(
		() => [
			{
				key: 'packages',
				label: t('tabPackages'),
				icon: 'packages',
			},
			{
				key: 'routers',
				label: t('tabRoutersRateLimits'),
				icon: 'routers.outline',
			},
			{
				key: 'profiles',
				label: t('tabRadiusProfiles'),
				icon: 'key',
			},
			{
				key: 'trial',
				label: t('tabFreeTrial'),
				icon: 'clock',
			},
		],
		[t]
	);

	const [activeTab, setActiveTab] = useState<TabKey>('packages');
	const [portalPackages, setPortalPackages] = useState<PortalPackage[]>([]);
	const [profiles, setProfiles] = useState<SharedRadiusProfile[]>([]);
	const [profilesError, setProfilesError] = useState<string | null>(null);
	const [loadingPackages, setLoadingPackages] = useState(false);
	const [loadingProfiles, setLoadingProfiles] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [savingKey, setSavingKey] = useState<string | null>(null);
	const [selectedPackageId, setSelectedPackageId] = useState<string>();

	const [trialSettings, setTrialSettings] = useState<
		Record<string, TrialSettings | null | undefined>
	>({});
	const [loadingTrials, setLoadingTrials] = useState(false);
	const [trialVersion, setTrialVersion] = useState(0);
	const trialLoadedRef = useRef<Set<string>>(new Set());

	const packageFormAnim = useAnimatedValue(0);
	const profileFormAnim = useAnimatedValue(0);
	const confirmAnim = useAnimatedValue(0);

	const [showPackageForm, setShowPackageForm] = useState(false);
	const [packageFormMode, setPackageFormMode] = useState<'create' | 'edit'>(
		'create'
	);
	const [editingPackage, setEditingPackage] = useState<PortalPackage | null>(
		null
	);

	const [showProfileForm, setShowProfileForm] = useState(false);
	const [profileFormMode, setProfileFormMode] = useState<'create' | 'edit'>(
		'create'
	);
	const [editingProfile, setEditingProfile] =
		useState<SharedRadiusProfile | null>(null);

	const [showConfirm, setShowConfirm] = useState(false);
	const [confirmTarget, setConfirmTarget] = useState<{
		type: 'package' | 'profile';
		id: string;
		title: string;
		message: string;
	} | null>(null);

	const showError = useCallback(
		async (response: Response | null | undefined, fallback: string) => {
			let message = fallback;
			if (response) {
				try {
					const parsed = await parseApiError(response);
					if (parsed) message = parsed;
				} catch {
					// keep the fallback
				}
			}
			setAppMessage?.({ type: 'error', message });
		},
		[setAppMessage]
	);

	const loadPackages = useCallback(
		async (showSpinner = true) => {
			if (!authToken) return;
			if (showSpinner) setLoadingPackages(true);
			try {
				const response = await PackageService.fetchPortalPackages(authToken, {
					per_page: 100,
					scope: isAdmin ? 'all' : 'visible',
				});
				if (!response.ok) {
					await showError(response, t('loadPackagesFailed'));
					return;
				}
				const body: GetPortalPackagesResponse = await response.json();
				// API 2.0: `{ data: { scope, packages }, meta: { pagination } }`
				const data = getApiData<NonNullable<GetPortalPackagesResponse['data']>>(body);
				setPortalPackages(Array.isArray(data?.packages) ? data.packages : []);
			} catch (error) {
				console.error('[PackagesScreen] loadPackages failed', error);
				setAppMessage?.({
					type: 'error',
					message: t('loadPackagesFailed'),
				});
			} finally {
				if (showSpinner) setLoadingPackages(false);
			}
		},
		[authToken, isAdmin, setAppMessage, showError, t]
	);

	const loadProfiles = useCallback(
		async (showSpinner = true) => {
			if (!authToken) return;
			if (showSpinner) setLoadingProfiles(true);
			try {
				const response = await PackageService.fetchSharedProfiles(authToken, {
					per_page: 100,
				});
				if (!response.ok) {
					setProfilesError(
						t(response.status === 403 ? 'profilesForbidden' : 'loadProfilesFailed')
					);
					return;
				}
				const body: GetSharedRadiusProfilesResponse = await response.json();
				const data = getApiData<NonNullable<GetSharedRadiusProfilesResponse['data']>>(body);
				setProfiles(Array.isArray(data?.profiles) ? data.profiles : []);
				setProfilesError(null);
			} catch (error) {
				console.error('[PackagesScreen] loadProfiles failed', error);
				setProfilesError(t('loadProfilesFailed'));
			} finally {
				if (showSpinner) setLoadingProfiles(false);
			}
		},
		[authToken, t]
	);

	useEffect(() => {
		void loadPackages();
		void loadProfiles();
	}, [loadPackages, loadProfiles]);

	useEffect(() => {
		if (authToken && !routers) {
			void fetchRouters();
		}
	}, [authToken, routers, fetchRouters]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await Promise.all([loadPackages(false), loadProfiles(false)]);
			await fetchRouters();
			trialLoadedRef.current.clear();
			setTrialSettings({});
			setTrialVersion((version) => version + 1);
		} finally {
			setRefreshing(false);
		}
	}, [fetchRouters, loadPackages, loadProfiles]);

	useEffect(() => {
		if (activeTab !== 'trial' || !authToken || !routers?.length) return;
		const missing = routers.filter(
			(router) => !trialLoadedRef.current.has(router.id)
		);
		if (missing.length === 0) {
			setLoadingTrials(false);
			return;
		}
		missing.forEach((router) => trialLoadedRef.current.add(router.id));
		let cancelled = false;
		setLoadingTrials(true);

		void (async () => {
			await Promise.all(
				missing.map(async (router) => {
					try {
						const response = await PackageService.fetchTrialSettings(
							router.id,
							authToken
						);
						if (!response.ok) throw new Error('trial settings unavailable');
						const body: GetTrialSettingsResponse = await response.json();
						const trialData = getApiData<NonNullable<GetTrialSettingsResponse['data']>>(body);
						if (!cancelled) {
							setTrialSettings((prev) => ({
								...prev,
								[router.id]: trialData?.trial_settings ?? null,
							}));
						}
					} catch {
						if (!cancelled) {
							setTrialSettings((prev) => ({ ...prev, [router.id]: null }));
						}
					}
				})
			);
			if (!cancelled) setLoadingTrials(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [activeTab, authToken, routers, trialVersion]);

	const selectedPackage = useMemo(
		() =>
			portalPackages.find((pkg) => pkg.id === selectedPackageId) ??
			portalPackages[0],
		[portalPackages, selectedPackageId]
	);

	useEffect(() => {
		if (portalPackages.length === 0) {
			if (selectedPackageId) setSelectedPackageId(undefined);
			return;
		}
		if (
			!selectedPackageId ||
			!portalPackages.some((pkg) => pkg.id === selectedPackageId)
		) {
			setSelectedPackageId(portalPackages[0].id);
		}
	}, [portalPackages, selectedPackageId]);

	const togglePackageForm = (show?: boolean) => {
		const target = show ?? showPackageForm;
		if (target) {
			setShowPackageForm(true);
			Animated.timing(packageFormAnim, {
				toValue: 1,
				duration: 250,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(packageFormAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start(() => {
				setShowPackageForm(false);
				setEditingPackage(null);
			});
		}
	};

	const toggleProfileForm = (show?: boolean) => {
		const target = show ?? showProfileForm;
		if (target) {
			setShowProfileForm(true);
			Animated.timing(profileFormAnim, {
				toValue: 1,
				duration: 250,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(profileFormAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start(() => {
				setShowProfileForm(false);
				setEditingProfile(null);
			});
		}
	};

	const toggleConfirm = (show?: boolean) => {
		const target = show ?? showConfirm;
		if (target) {
			setShowConfirm(true);
			Animated.timing(confirmAnim, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(confirmAnim, {
				toValue: 0,
				duration: 180,
				useNativeDriver: true,
			}).start(() => {
				setShowConfirm(false);
				setConfirmTarget(null);
			});
		}
	};

	const openCreatePackage = () => {
		setPackageFormMode('create');
		setEditingPackage(null);
		togglePackageForm(true);
	};

	const openEditPackage = (pkg: PortalPackage) => {
		setPackageFormMode('edit');
		setEditingPackage(pkg);
		togglePackageForm(true);
	};

	const openCreateProfile = () => {
		setProfileFormMode('create');
		setEditingProfile(null);
		toggleProfileForm(true);
	};

	const openEditProfile = (profile: SharedRadiusProfile) => {
		setProfileFormMode('edit');
		setEditingProfile(profile);
		toggleProfileForm(true);
	};

	const handlePackageSubmit = async (values: PackageFormValues) => {
		if (!authToken) return;
		setSavingKey('package-form');
		try {
			const labelTranslations = values.labelTranslations ?? {};
			let response: Response;
			if (packageFormMode === 'create') {
				const payload =
					values.planMode === 'shared'
						? {
							label: values.label,
							label_translations: labelTranslations,
							profile: values.profileGroup,
							scope: values.isGlobal ? 'global' : 'owner',
						}
						: {
							label: values.label,
							label_translations: labelTranslations,
							price: values.price ?? 0,
							profile: {
								duration: values.duration,
								bandwidth: values.bandwidth,
								devices: values.devices,
							},
							is_active: true,
							scope: 'owner',
						};
				response = await PackageService.createPortalPackage(payload, authToken);
			} else if (editingPackage) {
				const payload = editingPackage.profile?.shared
					? {
						label: values.label,
						label_translations: labelTranslations,
					}
					: {
						label: values.label,
						label_translations: labelTranslations,
						price: values.price,
						duration: values.duration,
						bandwidth: values.bandwidth,
						devices: values.devices,
						is_active: values.isActive,
					};
				response = await PackageService.updatePortalPackage(
					editingPackage.id,
					payload,
					authToken
				);
			} else {
				return;
			}

			if (!response.ok) {
				await showError(response, t('savePackageFailed'));
				return;
			}
			togglePackageForm(false);
			await loadPackages(false);
			setAppMessage?.({ type: 'message', message: t('packageSaved') });
		} catch (error) {
			console.error('[PackagesScreen] save package failed', error);
			setAppMessage?.({ type: 'error', message: t('savePackageFailed') });
		} finally {
			setSavingKey(null);
		}
	};

	const handleProfileSubmit = async (values: RadiusProfileFormValues) => {
		if (!authToken) return;
		setSavingKey('profile-form');
		try {
			const response =
				profileFormMode === 'create'
					? await PackageService.createSharedProfile(
						{
							name: values.name,
							price: values.price ?? 0,
							no_of_users: values.devices,
							bandwidth: values.bandwidth,
							duration: values.duration,
						},
						authToken
					)
					: editingProfile
						? await PackageService.updateSharedProfile(
							editingProfile.group,
							{
								name: values.name,
								...(values.price !== undefined
									? { price: values.price }
									: {}),
								no_of_users: values.devices,
								bandwidth: values.bandwidth,
								duration: values.duration,
							},
							authToken
						)
						: null;

			if (!response || !response.ok) {
				await showError(response, t('saveProfileFailed'));
				return;
			}
			toggleProfileForm(false);
			await Promise.all([loadProfiles(false), loadPackages(false)]);
			setAppMessage?.({ type: 'message', message: t('profileSaved') });
		} catch (error) {
			console.error('[PackagesScreen] save profile failed', error);
			setAppMessage?.({
				type: 'error',
				message: t('saveProfileFailed'),
			});
		} finally {
			setSavingKey(null);
		}
	};

	const handleSaveRouters = async (
		pkg: PortalPackage,
		payload: {
			visible: string[];
			rate_limits: Record<string, string | null>;
			reconnect_users: boolean;
		}
	) => {
		if (!authToken) return;
		setSavingKey(`routers-${pkg.id}`);
		try {
			const response = await PackageService.updatePackageRouters(
				pkg.id,
				payload,
				authToken
			);
			if (!response.ok) {
				await showError(response, t('saveRouterSettingsFailed'));
				return;
			}
			const body: GetPackageRoutersResponse = await response.json();
			const data = getApiData<NonNullable<GetPackageRoutersResponse['data']>>(body);
			setPortalPackages((prev) =>
				prev.map((item) =>
					item.id === pkg.id
						? {
							...item,
							routers: Array.isArray(data?.routers)
								? data.routers
								: item.routers,
							rate_limits: data?.rate_limits ?? item.rate_limits,
						}
						: item
				)
			);
			setAppMessage?.({ type: 'message', message: t('routerSettingsSaved') });
		} catch (error) {
			console.error('[PackagesScreen] save routers failed', error);
			setAppMessage?.({
				type: 'error',
				message: t('saveRouterSettingsFailed'),
			});
		} finally {
			setSavingKey(null);
		}
	};

	const handleSaveTrial = async (
		routerItem: ApiRouter,
		enabled: boolean,
		minutes: number
	) => {
		if (!authToken) return;
		setSavingKey(`trial-${routerItem.id}`);
		try {
			const response = await PackageService.updateTrialSettings(
				routerItem.id,
				{ enabled, duration_minutes: minutes },
				authToken
			);
			if (!response.ok) {
				await showError(response, t('saveTrialFailed'));
				return;
			}
			const body: GetTrialSettingsResponse = await response.json();
			const trialData = getApiData<NonNullable<GetTrialSettingsResponse['data']>>(body);
			setTrialSettings((prev) => ({
				...prev,
				[routerItem.id]:
					trialData?.trial_settings ?? {
						router_id: routerItem.id,
						enabled,
						duration_minutes: minutes,
						cooldown_hours: 24,
					},
			}));
			setAppMessage?.({ type: 'message', message: t('trialSaved') });
		} catch (error) {
			console.error('[PackagesScreen] save trial failed', error);
			setAppMessage?.({ type: 'error', message: t('saveTrialFailed') });
		} finally {
			setSavingKey(null);
		}
	};

	const requestDeletePackage = (pkg: PortalPackage) => {
		if (!canDeletePackage(pkg)) {
			setAppMessage?.({
				type: 'error',
				message: t('deletePackageForbidden'),
			});
			return;
		}
		setConfirmTarget({
			type: 'package',
			id: pkg.id,
			title: t('deletePackageTitle'),
			message: tv('deletePackageConfirm', { label: pkg.label }),
		});
		toggleConfirm(true);
	};

	const requestDeleteProfile = (profile: SharedRadiusProfile) => {
		if (!canDeleteProfile) {
			setAppMessage?.({
				type: 'error',
				message: t('deleteProfileForbidden'),
			});
			return;
		}
		setConfirmTarget({
			type: 'profile',
			id: profile.group,
			title: t('deleteProfileTitle'),
			message: tv('deleteProfileConfirm', {
				name: profile.display_name || profile.group,
			}),
		});
		toggleConfirm(true);
	};

	const handleConfirmDelete = async () => {
		if (!authToken || !confirmTarget) return;
		const target = confirmTarget;
		if (target.type === 'package') {
			const pkg = portalPackages.find((item) => item.id === target.id);
			if (!pkg || !canDeletePackage(pkg)) {
				toggleConfirm(false);
				setAppMessage?.({
					type: 'error',
					message: t('deletePackageForbidden'),
				});
				return;
			}
		} else if (!canDeleteProfile) {
			toggleConfirm(false);
			setAppMessage?.({
				type: 'error',
				message: t('deleteProfileForbidden'),
			});
			return;
		}
		setSavingKey(`delete-${target.type}-${target.id}`);
		try {
			const response =
				target.type === 'package'
					? await PackageService.deletePortalPackage(target.id, authToken)
					: await PackageService.deleteSharedProfile(target.id, authToken);
			if (!response.ok) {
				await showError(response, t('deleteFailed'));
				return;
			}
			toggleConfirm(false);
			if (target.type === 'package') {
				await loadPackages(false);
			} else {
				await Promise.all([loadProfiles(false), loadPackages(false)]);
			}
			setAppMessage?.({ type: 'message', message: t('deleted') });
		} catch (error) {
			console.error('[PackagesScreen] delete failed', error);
			setAppMessage?.({ type: 'error', message: t('deleteFailed') });
		} finally {
			setSavingKey(null);
		}
	};

	const renderPackagesTab = () => (
		<ThemedView
			style={{ gap: 10, width: '100%' }}
			lightColor='transparent'
			darkColor='transparent'
		>
			<ThemedView
				style={styles.sectionHeader}
				lightColor='transparent'
				darkColor='transparent'
			>
				<ThemedText
					style={styles.sectionTitle}
					lightColor={textColor}
					darkColor={textColor}
				>
					{t('portalPackagesTitle')}
				</ThemedText>
				<ThemedButton
					title={t('addPackage')}
					onPress={openCreatePackage}
					icon='plus'
					lightColor={selectedBg}
					darkColor={selectedBg}
					lightTextColor={selectedText}
					darkTextColor={selectedText}
				/>
			</ThemedView>
			<ThemedText
				style={styles.help}
				lightColor={mutedText}
				darkColor={mutedText}
			>
				{t('portalPackagesDescription')}
			</ThemedText>

			{loadingPackages && portalPackages.length === 0 ? (
				<ThemedText lightColor={mutedText} darkColor={mutedText}>
					{t('loadingPackages')}
				</ThemedText>
			) : portalPackages.length === 0 ? (
				<ThemedView
					style={styles.empty}
					lightColor={chipBg}
					darkColor={chipBg}
				>
					<ThemedText lightColor={mutedText} darkColor={mutedText}>
						{t('noPackages')}
					</ThemedText>
				</ThemedView>
			) : (
				portalPackages.map((pkg) => {
					const canManage = isAdmin || pkg.owner?.type !== 'platform';
					return (
						<TileContainer
							key={pkg.id}
							id={`portal-package-${pkg.id}`}
							backgroundColor={bg}
							style={styles.card}
						>
							<ThemedView
								style={styles.cardHeader}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedView
									style={{ flex: 1, gap: 2 }}
									lightColor='transparent'
									darkColor='transparent'
								>
									<ThemedText
										style={styles.cardTitle}
										lightColor={textColor}
										darkColor={textColor}
									>
										{pkg.label}
									</ThemedText>
									<ThemedText
										style={styles.meta}
										lightColor={mutedText}
										darkColor={mutedText}
									>
										{pkg.owner?.name ??
											(pkg.is_global ? t('platform') : t('you'))}{' '}
										· {pkg.profile?.group ?? pkg.rad_group}
									</ThemedText>
								</ThemedView>
								<ThemedText
									style={[
										styles.status,
										{ color: pkg.is_active ? selectedBg : errorColor },
									]}
									lightColor={pkg.is_active ? selectedBg : errorColor}
									darkColor={pkg.is_active ? selectedBg : errorColor}
								>
									{pkg.is_active ? t('active') : t('inactive')}
								</ThemedText>
							</ThemedView>

							<ThemedView
								style={styles.metrics}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedView
									style={styles.metric}
									lightColor='transparent'
									darkColor='transparent'
								>
									<ThemedText
										style={styles.metricLabel}
										lightColor={mutedText}
										darkColor={mutedText}
									>
										{translateWithVariables(t('Price'), { currency })}
									</ThemedText>
									<ThemedText
										style={styles.metricValue}
										lightColor={textColor}
										darkColor={textColor}
									>
										{formatAmount(pkg.price ?? 0, 0)}
									</ThemedText>
								</ThemedView>
								<ThemedView
									style={styles.metric}
									lightColor='transparent'
									darkColor='transparent'
								>
									<ThemedText
										style={styles.metricLabel}
										lightColor={mutedText}
										darkColor={mutedText}
									>
										{t('devices')}
									</ThemedText>
									<ThemedText
										style={styles.metricValue}
										lightColor={textColor}
										darkColor={textColor}
									>
										{pkg.profile?.devices ?? '—'}
									</ThemedText>
								</ThemedView>
								<ThemedView
									style={styles.metric}
									lightColor='transparent'
									darkColor='transparent'
								>
									<ThemedText
										style={styles.metricLabel}
										lightColor={mutedText}
										darkColor={mutedText}
									>
										{t('routersCount')}
									</ThemedText>
									<ThemedText
										style={styles.metricValue}
										lightColor={textColor}
										darkColor={textColor}
									>
										{visibleRouterCount(pkg)} / {pkg.routers?.length ?? 0}
									</ThemedText>
								</ThemedView>
							</ThemedView>

							<ThemedView
								style={styles.actions}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedButton
									title={t('edit')}
									onPress={() => openEditPackage(pkg)}
									icon='edit.outline'
									disabled={!canManage}
									style={styles.actionButton}
									lightColor={chipBg}
									darkColor={chipBg}
									lightTextColor={textColor}
									darkTextColor={textColor}
								/>
								{canDeletePackage(pkg) ? (
									<ThemedButton
										title={t('delete')}
										onPress={() => requestDeletePackage(pkg)}
										icon='delete.outline'
										style={styles.actionButton}
										lightColor={errorColor}
										darkColor={errorColor}
										lightTextColor='#fff'
										darkTextColor='#fff'
									/>
								) : null}
							</ThemedView>
						</TileContainer>
					);
				})
			)}
		</ThemedView>
	);

	const renderRoutersTab = () => (
		<ThemedView
			style={{ gap: 10, width: '100%' }}
			lightColor='transparent'
			darkColor='transparent'
		>
			<ThemedText
				style={styles.sectionTitle}
				lightColor={textColor}
				darkColor={textColor}
			>
				{t('tabRoutersRateLimits')}
			</ThemedText>
			<ThemedText
				style={styles.help}
				lightColor={mutedText}
				darkColor={mutedText}
			>
				{t('routersRateLimitsDescription')}
			</ThemedText>

			{portalPackages.length === 0 ? (
				<ThemedView style={styles.empty} lightColor={chipBg} darkColor={chipBg}>
					<ThemedText lightColor={mutedText} darkColor={mutedText}>
						{t('noPackages')}
					</ThemedText>
				</ThemedView>
			) : (
				<>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						keyboardShouldPersistTaps='handled'
						style={{ width: '100%' }}
						contentContainerStyle={styles.selectorRow}
					>
						{portalPackages.map((pkg) => {
							const selected = pkg.id === selectedPackage?.id;
							return (
								<TouchableOpacity
									key={pkg.id}
									onPress={() => setSelectedPackageId(pkg.id)}
									style={[
										styles.selectorChip,
										{
											backgroundColor: selected ? selectedBg : chipBg,
											borderColor: selected ? selectedBg : border,
										},
									]}
								>
									<ThemedText
										numberOfLines={1}
										style={[
											styles.selectorText,
											{ color: selected ? selectedText : textColor },
										]}
										lightColor={selected ? selectedText : textColor}
										darkColor={selected ? selectedText : textColor}
									>
										{pkg.label}
									</ThemedText>
								</TouchableOpacity>
							);
						})}
					</ScrollView>
					{selectedPackage ? (
						<PackageRoutersCard
							pkg={selectedPackage}
							saving={savingKey === `routers-${selectedPackage.id}`}
							onSave={(payload) =>
								handleSaveRouters(selectedPackage, payload)
							}
						/>
					) : null}
				</>
			)}
		</ThemedView>
	);

	const renderProfilesTab = () => (
		<ThemedView
			style={{ gap: 10, width: '100%' }}
			lightColor='transparent'
			darkColor='transparent'
		>
			<ThemedView
				style={styles.sectionHeader}
				lightColor='transparent'
				darkColor='transparent'
			>
				<ThemedText
					style={styles.sectionTitle}
					lightColor={textColor}
					darkColor={textColor}
				>
					{t('tabRadiusProfiles')}
				</ThemedText>
			</ThemedView>
			<ThemedText
				style={styles.help}
				lightColor={mutedText}
				darkColor={mutedText}
			>
				{t('radiusProfilesDescription')}
			</ThemedText>
			{canManageProfiles && !canDeleteProfile ? (
				<ThemedText
					style={styles.help}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{t('profilesDeleteAdminOnly')}
				</ThemedText>
			) : null}

			{profilesError ? (
				<ThemedView style={styles.empty} lightColor={chipBg} darkColor={chipBg}>
					<ThemedText lightColor={errorColor} darkColor={errorColor}>
						{profilesError}
					</ThemedText>
				</ThemedView>
			) : loadingProfiles && profiles.length === 0 ? (
				<ThemedText lightColor={mutedText} darkColor={mutedText}>
					{t('loadingProfiles')}
				</ThemedText>
			) : profiles.length === 0 ? (
				<ThemedView style={styles.empty} lightColor={chipBg} darkColor={chipBg}>
					<ThemedText lightColor={mutedText} darkColor={mutedText}>
						{t('noProfiles')}
					</ThemedText>
				</ThemedView>
			) : (
				profiles.map((profile) => (
					<TileContainer
						key={profile.group}
						id={`radius-profile-${profile.group}`}
						backgroundColor={bg}
						style={styles.card}
					>
						<ThemedView
							style={styles.cardHeader}
							lightColor='transparent'
							darkColor='transparent'
						>
							<ThemedView
								style={{ flex: 1, gap: 2 }}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedText
									style={styles.cardTitle}
									lightColor={textColor}
									darkColor={textColor}
								>
									{profile.display_name || profile.name || profile.group}
								</ThemedText>
								<ThemedText
									style={styles.meta}
									lightColor={mutedText}
									darkColor={mutedText}
								>
									{profile.group} ·{' '}
									{profile.shared ? t('shared') : t('owner')}
								</ThemedText>
							</ThemedView>
							<ThemedText
								style={styles.status}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{tv('amountWithCurrency', {
									amount: formatAmount(profile.price ?? 0, 0),
									currency,
								})}
							</ThemedText>
						</ThemedView>

						<ThemedView
							style={styles.metrics}
							lightColor='transparent'
							darkColor='transparent'
						>
							<ThemedView
								style={styles.metric}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedText
									style={styles.metricLabel}
									lightColor={mutedText}
									darkColor={mutedText}
								>
									{t('duration')}
								</ThemedText>
								<ThemedText
									style={styles.metricValue}
									lightColor={textColor}
									darkColor={textColor}
								>
									{profileDuration(profile, tv)}
								</ThemedText>
							</ThemedView>
							<ThemedView
								style={styles.metric}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedText
									style={styles.metricLabel}
									lightColor={mutedText}
									darkColor={mutedText}
								>
									{t('rateLimit')}
								</ThemedText>
								<ThemedText
									style={styles.metricValue}
									lightColor={textColor}
									darkColor={textColor}
								>
									{profile.rate_limit ?? t('open')}
								</ThemedText>
							</ThemedView>
							<ThemedView
								style={styles.metric}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedText
									style={styles.metricLabel}
									lightColor={mutedText}
									darkColor={mutedText}
								>
									{t('devices')}
								</ThemedText>
								<ThemedText
									style={styles.metricValue}
									lightColor={textColor}
									darkColor={textColor}
								>
									{profile.devices ?? '—'}
								</ThemedText>
							</ThemedView>
						</ThemedView>

						{canManageProfiles ? (
							<ThemedView
								style={styles.actions}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedButton
									title={t('edit')}
									onPress={() => openEditProfile(profile)}
									icon='edit.outline'
									style={styles.actionButton}
									lightColor={chipBg}
									darkColor={chipBg}
									lightTextColor={textColor}
									darkTextColor={textColor}
								/>
								{canDeleteProfile ? (
									<ThemedButton
										title={t('delete')}
										onPress={() => requestDeleteProfile(profile)}
										icon='delete.outline'
										style={styles.actionButton}
										lightColor={errorColor}
										darkColor={errorColor}
										lightTextColor='#fff'
										darkTextColor='#fff'
									/>
								) : null}
							</ThemedView>
						) : null}
					</TileContainer>
				))
			)}
		</ThemedView>
	);

	const renderTrialTab = () => (
		<ThemedView
			style={{ gap: 10, width: '100%' }}
			lightColor='transparent'
			darkColor='transparent'
		>
			<ThemedText
				style={styles.sectionTitle}
				lightColor={textColor}
				darkColor={textColor}
			>
				{t('tabFreeTrial')}
			</ThemedText>
			<ThemedText
				style={styles.help}
				lightColor={mutedText}
				darkColor={mutedText}
			>
				{t('freeTrialDescription')}
			</ThemedText>

			{!routers?.length ? (
				<ThemedView style={styles.empty} lightColor={chipBg} darkColor={chipBg}>
					<ThemedText lightColor={mutedText} darkColor={mutedText}>
						{t('noRoutersYet')}
					</ThemedText>
				</ThemedView>
			) : (
				<ThemedView
					id='trial-settings'
					style={styles.card}
					lightColor='transparent'
					darkColor='transparent'
				>
					{routers.map((routerItem) => (
						<TrialSettingsRow
							key={routerItem.id}
							router={routerItem}
							settings={trialSettings[routerItem.id]}
							loading={
								loadingTrials && trialSettings[routerItem.id] === undefined
							}
							saving={savingKey === `trial-${routerItem.id}`}
							onSave={(enabled, minutes) =>
								handleSaveTrial(routerItem, enabled, minutes)
							}
						/>
					))}
				</ThemedView>
			)}
		</ThemedView>
	);

	return (
		<>
			<ParallaxScrollView
				headerBackgroundColor={{ light: bg, dark: bg }}
				containerStyle={{ flex: 1 }}
				contentStyle={{ paddingHorizontal: 10 }}
				onRefresh={handleRefresh}
				refreshing={refreshing}
			>
				<TileContainer
					id='packages-header-tile'
					flat
					backgroundColor={bg}
					style={{ width: '100%' }}
				>
					<ScreenHeader
						id='packages-header'
						title={t('title')}
						description={t('subtitle')}
					>
						<View style={styles.headerActions}>
							{canManageProfiles ? (
								<ThemedButton
									title={t('createGlobalProfile')}
									onPress={openCreateProfile}
									style={styles.headerButton}
									icon='plus'
									darkColor={bimColor}
									lightColor={bimColor}
									darkTextColor={white}
									lightTextColor={white}
								/>
							) : null}
							<ThemedButton
								title={buttonsCopy.portalLang}
								onPress={() => router.replace('/(authenticated)/translation')}
								style={[styles.headerButton, {
									borderRadius: 8,
									borderColor: skyMist,
									borderWidth: 1,
								}]}
								icon='translate'
								darkColor='transparent'
								lightColor='transparent'
								darkTextColor={tropicalBlue}
								lightTextColor={tropicalBlue}
							/>
						</View>
					</ScreenHeader>
				</TileContainer>

				<ThemedView style={{ marginVertical: 8 }} lightColor={bg} darkColor={bg}>
					<SegmentedTabs
						tabs={tabs}
						activeKey={activeTab}
						onChange={(key) => setActiveTab(key as TabKey)}
					/>
				</ThemedView>

				<TileContainer
					id='packages-tab-panel'
					flat
					backgroundColor={bg}
					style={{ flexDirection: 'column' }}
				>
					{activeTab === 'packages'
						? renderPackagesTab()
						: activeTab === 'routers'
							? renderRoutersTab()
							: activeTab === 'profiles'
								? renderProfilesTab()
								: renderTrialTab()}
				</TileContainer>
			</ParallaxScrollView>

			<PackageForm
				visible={showPackageForm}
				fadeAnim={packageFormAnim}
				toggleVisible={togglePackageForm}
				mode={packageFormMode}
				initial={editingPackage}
				profiles={profiles}
				isAdmin={isAdmin}
				saving={savingKey === 'package-form'}
				onSubmit={handlePackageSubmit}
			/>

			<RadiusProfileForm
				visible={showProfileForm}
				fadeAnim={profileFormAnim}
				toggleVisible={toggleProfileForm}
				mode={profileFormMode}
				initial={editingProfile}
				saving={savingKey === 'profile-form'}
				onSubmit={handleProfileSubmit}
			/>

			<Prompt
				visible={showConfirm}
				fadeAnim={confirmAnim}
				title={confirmTarget?.title ?? t('delete')}
				message={confirmTarget?.message ?? ''}
				onClose={() => toggleConfirm(false)}
				buttons={[
					{
						title: buttonsCopy.cancel,
						color: chipBg,
						textColor,
						action: () => toggleConfirm(false),
					},
					{
						title: t('delete'),
						color: errorColor,
						textColor: '#fff',
						action: () => {
							void handleConfirmDelete();
						},
					},
				]}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	heading: {
		width: '100%',
		textTransform: 'capitalize',
		fontSize: fontSize['heading.one'],
		fontWeight: fontWeight['heading.one'],
	},
	subtitle: {
		fontSize: fontSize['text.medium'],
		marginTop: 8,
	},
	headerActions: {
		width: '100%',
		paddingVertical: 8,
		alignItems: 'flex-end',
		gap: 8,
	},
	headerButton: {
		borderRadius: 8,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
		flexWrap: 'wrap',
	},
	sectionTitle: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	help: {
		fontSize: fontSize['text.medium'],
	},
	card: {
		width: '100%',
		gap: 10,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 8,
	},
	cardTitle: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	meta: {
		fontSize: 13,
	},
	status: {
		fontSize: 12,
		textTransform: 'uppercase',
		fontWeight: fontWeight['text.xsmall'],
	},
	metrics: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
	},
	metric: {
		minWidth: 90,
		gap: 2,
	},
	metricLabel: {
		fontSize: 11,
		textTransform: 'uppercase',
	},
	metricValue: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['heading.three'],
	},
	actions: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	actionButton: {
		flex: 1,
		minWidth: 110,
	},
	empty: {
		padding: 16,
		borderRadius: 8,
		alignItems: 'center',
	},
	selectorRow: {
		flexDirection: 'row',
		flexWrap: 'nowrap',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 2,
	},
	selectorChip: {
		flexShrink: 0,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 1,
	},
	selectorText: {
		fontSize: 13,
	},
});
