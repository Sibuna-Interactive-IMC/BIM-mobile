import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import type { RecordField, RecordTone } from '@/components/RecordList';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage, getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchSharedProfiles } from '@/services/PackageService';
import {
	deleteVoucherUser,
	disableVoucherUser,
	enableVoucherUser,
	fetchVoucherHotspots,
	fetchVoucherRouters,
	fetchVouchers,
	resetVoucherUser,
} from '@/services/VoucherService';
import type {
	GetVoucherHotspotsResponse,
	GetVoucherRoutersResponse,
	GetVouchersResponse,
	langCode,
	SharedRadiusProfile,
	Voucher,
	VoucherListStats,
	VoucherRouterStats,
	VoucherStatus,
} from '@/types';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Animated,
	Pressable,
	StyleSheet,
	useAnimatedValue,
	View,
} from 'react-native';

import VoucherQrPreview from '@/views/VoucherQrPreview';
import GenerateVouchersOverlay from '@/views/GenerateVouchersOverlay';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;
/** The web page refreshes its counters every 30s; the app does the same while focused. */
const AUTO_REFRESH_MS = 30_000;

type VoucherAction = 'disable' | 'enable' | 'reset' | 'delete';

type VoucherLabels = { [key: string]: string };

type SortKey = 'newest' | 'oldest' | 'usernameAsc' | 'usernameDesc' | 'used';

const SORT_QUERIES: Record<
	SortKey,
	{ sort: 'created_at' | 'username' | 'last_auth'; dir: 'asc' | 'desc' }
> = {
	newest: { sort: 'created_at', dir: 'desc' },
	oldest: { sort: 'created_at', dir: 'asc' },
	usernameAsc: { sort: 'username', dir: 'asc' },
	usernameDesc: { sort: 'username', dir: 'desc' },
	used: { sort: 'last_auth', dir: 'desc' },
};

const STATUS_TONES: Record<VoucherStatus, RecordTone> = {
	online: 'success',
	active: 'info',
	unused: 'default',
	expired: 'warning',
	disabled: 'danger',
};

function statusTone(status?: string | null): RecordTone {
	return STATUS_TONES[(status ?? '') as VoucherStatus] ?? 'default';
}

/** A status tile doubles as the filter control, mirroring the web's linked counters. */
function StatTile({
	id,
	label,
	value,
	color,
	active,
	onPress,
}: {
	id: string;
	label: string;
	value: number;
	color: string;
	active: boolean;
	onPress: () => void;
}) {
	const background = useThemeColor({}, 'background');
	const mutedText = useThemeColor({}, 'mutedText');
	const activeBorder = useThemeColor({}, 'bim');
	const border = useThemeColor({}, 'inputBorder');

	return (
		<Pressable
			id={id}
			accessibilityRole='button'
			accessibilityState={{ selected: active }}
			onPress={onPress}
			style={[
				styles.statTile,
				{
					backgroundColor: background,
					borderColor: active ? activeBorder : border,
					borderWidth: active ? 2 : 1,
				},
			]}
		>
			<ThemedText
				style={[styles.statLabel, { color: mutedText }]}
				lightColor={mutedText}
				darkColor={mutedText}
				numberOfLines={1}
			>
				{label}
			</ThemedText>
			<ThemedText
				style={[styles.statValue, { color }]}
				lightColor={color}
				darkColor={color}
			>
				{formatAmount(value, 0)}
			</ThemedText>
		</Pressable>
	);
}

function FilterDropdown({
	id,
	placeholder,
	value,
	options,
	onChange,
}: {
	id: string;
	placeholder: string;
	value: string;
	options: string[];
	onChange: (value: string) => void;
}) {
	const [showDropdown, setShowDropdown] = useState(false);
	const containerRef = useRef<View>(null);

	return (
		<View style={styles.filterCell}>
			<ThemedDropdown
				id={id}
				containerRef={containerRef}
				placeholder={placeholder}
				options={options}
				value={value}
				setValue={onChange}
				showDropdown={showDropdown}
				setShowDropdown={setShowDropdown}
				openDirection='down'
				dropDownStyle={styles.dropdownMenu}
			/>
		</View>
	);
}

const VoucherCard = memo(function VoucherCard({
	voucher,
	labels,
	language,
	pendingAction,
	selectMode,
	selected,
	onToggleSelect,
	onEdit,
	onRunAction,
	onReset,
	onDelete,
}: {
	voucher: Voucher;
	labels: VoucherLabels;
	language: langCode;
	pendingAction: string | null;
	selectMode: boolean;
	selected: boolean;
	onToggleSelect: (voucher: Voucher) => void;
	onEdit: (voucher: Voucher) => void;
	onRunAction: (action: VoucherAction, voucher: Voucher) => void;
	onReset: (voucher: Voucher) => void;
	onDelete: (voucher: Voucher) => void;
}) {
	const packages = translations[language].categories.packages;
	const username = voucher.username;
	const actionKey = (action: VoucherAction) => `${action}:${username}`;
	const disabled = voucher.is_disabled || voucher.status === 'disabled';
	const session = voucher.uptime || voucher.session_time;

	const fields: RecordField[] = [
		{
			label: labels.status,
			value: voucher.status,
			tone: statusTone(voucher.status),
		},
		{ label: labels.username, value: username },
		{ label: labels.router, value: voucher.router_name || '—' },
		{ label: labels.profile, value: voucher.profile_display || voucher.profile || '—' },
		{ label: labels.session, value: session || '—' },
		{ label: labels.lastLogin, value: voucher.last_auth || '—' },
		{ label: labels.startDate, value: voucher.first_auth || '—' },
		{ label: labels.expiresAt, value: voucher.expires_at || '—' },
		{ label: labels.macAddress, value: voucher.mac_address || '—' },
	];

	// Print selection replaces the row actions so the choice stays unambiguous;
	// the whole tile is tappable as well.
	if (selectMode) {
		return (
			<RecordCard
				id={`voucher-${username}`}
				fields={fields}
				onPress={() => onToggleSelect(voucher)}
				actions={[
					{
						label: selected ? labels.deselect : labels.select,
						icon: selected ? 'checkboxMarked' : 'checkboxBlank',
						tone: selected ? 'success' : 'neutral',
						onPress: () => onToggleSelect(voucher),
					},
				]}
			/>
		);
	}

	return (
		<RecordCard
			id={`voucher-${username}`}
			fields={fields}
			actions={[
				{
					label: packages.edit,
					icon: 'edit.outline',
					tone: 'warning',
					disabled: !!pendingAction,
					onPress: () => onEdit(voucher),
				},
				disabled
					? {
							label: labels.enable,
							icon: 'key',
							tone: 'success',
							disabled: !!pendingAction,
							loading: pendingAction === actionKey('enable'),
							onPress: () => onRunAction('enable', voucher),
						}
					: {
							label: labels.disable,
							icon: 'block',
							tone: 'danger',
							disabled: !!pendingAction,
							loading: pendingAction === actionKey('disable'),
							onPress: () => onRunAction('disable', voucher),
						},
				{
					label: labels.reset,
					icon: 'clock',
					tone: 'info',
					disabled: !!pendingAction,
					loading: pendingAction === actionKey('reset'),
					onPress: () => onReset(voucher),
				},
				{
					label: packages.delete,
					icon: 'delete.outline',
					tone: 'danger',
					disabled: !!pendingAction,
					loading: pendingAction === actionKey('delete'),
					onPress: () => onDelete(voucher),
				},
			]}
		/>
	);
});

export default function VouchersScreen() {
	useTrackHistory('/(authenticated)/vouchers');
	const navigation = useRouter();
	const { language, authToken } = useGeneral();

	const t = translations[language].categories.vouchers;
	const buttons = translations[language].categories.buttons;

	// Theme helpers
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const textLight = useThemeColor({}, 'text', 'light');
	const textDark = useThemeColor({}, 'text', 'dark');
	const mutedText = useThemeColor({}, 'mutedText');
	const mutedTextLight = useThemeColor({}, 'mutedText', 'light');
	const mutedTextDark = useThemeColor({}, 'mutedText', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');
	const lime = useThemeColor({}, 'lime');
	const lightBlue = useThemeColor({}, 'lightBlue');
	const yellow = useThemeColor({}, 'yellow');
	const error = useThemeColor({}, 'error');

	// Filters
	const [statusFilter, setStatusFilter] = useState<VoucherStatus | null>(null);
	const [routerFilter, setRouterFilter] = useState('');
	const [profileFilter, setProfileFilter] = useState(t.allProfiles);
	const [originFilter, setOriginFilter] = useState(t.allOrigins);
	const [sortKey, setSortKey] = useState<SortKey>('newest');
	const [search, setSearch] = useState('');
	const [searchTerm, setSearchTerm] = useState('');

	// Data
	const [vouchers, setVouchers] = useState<Voucher[]>([]);
	const [stats, setStats] = useState<VoucherListStats>({});
	const [routerStats, setRouterStats] = useState<VoucherRouterStats[]>([]);
	const [routers, setRouters] = useState<{ id: string; name: string }[]>([]);
	const [profileList, setProfileList] = useState<SharedRadiusProfile[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
	const [selectMode, setSelectMode] = useState(false);
	const [selected, setSelected] = useState<Voucher[]>([]);
	const [showQr, setShowQr] = useState(false);
	const [showGenerate, setShowGenerate] = useState(false);
	const isFocused = useIsFocused();

	const hotspotsCache = useRef<Record<string, string>>({});
	const requestIdRef = useRef(0);
	const promptFadeAnim = useAnimatedValue(0);
	const qrFadeAnim = useAnimatedValue(0);
	const generateFadeAnim = useAnimatedValue(0);
	const [showPrompt, setShowPrompt] = useState(false);
	const [promptTitle, setPromptTitle] = useState('');
	const [promptMessage, setPromptMessage] = useState('');
	const affirmAction = useRef<(() => void) | null>(null);

	useEffect(() => {
		const timer = setTimeout(
			() => setSearchTerm(search.trim()),
			SEARCH_DEBOUNCE_MS
		);
		return () => clearTimeout(timer);
	}, [search]);

	const loadVouchers = useCallback(
		async ({ silent = false }: { silent?: boolean } = {}) => {
			if (!authToken) return;
			const requestId = requestIdRef.current + 1;
			requestIdRef.current = requestId;
			if (!silent) setLoading(true);
			try {
				const res = await fetchVouchers(
					{
						status: statusFilter,
						search: searchTerm,
						router: routerFilter || undefined,
						profile:
							profileFilter === t.allProfiles ? undefined : profileFilter,
						origin:
							originFilter === t.manualOnly
								? 'manual'
								: originFilter === t.autoOnly
									? 'auto'
									: undefined,
						...SORT_QUERIES[sortKey],
						page,
						perPage: PAGE_SIZE,
					},
					authToken
				);
				if (requestId !== requestIdRef.current) return;
				if (!res.ok) {
					const body = await res.json().catch(() => null);
					if (!silent) {
						ShowAlert(getApiMessage(body) || t.actionFailed, 'Error');
					}
					return;
				}
				const body: GetVouchersResponse = await res.json();
				const data = getApiData<NonNullable<GetVouchersResponse['data']>>(body);
				const pagination = getApiPagination(body, 'vouchers');
				setVouchers(data?.vouchers ?? []);
				setStats(data?.stats ?? {});
				setRouterStats(data?.router_stats ?? []);
				setTotal(pagination?.total ?? data?.vouchers?.length ?? 0);
				setLastPage(Math.max(1, pagination?.last_page ?? 1));
				setUpdatedAt(new Date());
			} catch (e) {
				if (requestId === requestIdRef.current) {
					console.error('[VouchersScreen] fetchVouchers failed', e);
					setVouchers([]);
				}
			} finally {
				if (requestId === requestIdRef.current && !silent) setLoading(false);
			}
		},
		[
			authToken,
			statusFilter,
			searchTerm,
			routerFilter,
			profileFilter,
			originFilter,
			sortKey,
			page,
			t.actionFailed,
			t.allProfiles,
			t.manualOnly,
			t.autoOnly,
		]
	);

	const loadFilters = useCallback(async () => {
		if (!authToken) return;
		try {
			const [routersRes, profilesRes] = await Promise.all([
				fetchVoucherRouters(authToken, { perPage: 100 }),
				fetchSharedProfiles(authToken, { per_page: 100 }),
			]);
			if (routersRes.ok) {
				const body: GetVoucherRoutersResponse = await routersRes.json();
				const list =
					getApiData<NonNullable<GetVoucherRoutersResponse['data']>>(body)
						?.routers ?? [];
				setRouters(list.map((router) => ({ id: router.id, name: router.name })));
			}
			if (profilesRes.ok) {
				const body = await profilesRes.json();
				const list =
					getApiData<{ profiles?: SharedRadiusProfile[] }>(body)?.profiles ?? [];
				setProfileList(list);
			}
		} catch (e) {
			console.error('[VouchersScreen] loadFilters failed', e);
		}
	}, [authToken]);

	useEffect(() => {
		void loadFilters();
	}, [loadFilters]);

	useEffect(() => {
		void loadVouchers();
	}, [loadVouchers]);

	// Refresh the counters every 30s, but only while this screen is on top.
	useEffect(() => {
		if (!isFocused) return;
		const timer = setInterval(() => {
			void loadVouchers({ silent: true });
		}, AUTO_REFRESH_MS);
		return () => clearInterval(timer);
	}, [isFocused, loadVouchers]);

	// Any filter change restarts paging from the first page.
	useEffect(() => {
		setPage(1);
	}, [
		statusFilter,
		searchTerm,
		routerFilter,
		profileFilter,
		originFilter,
		sortKey,
	]);

	useEffect(() => {
		if (page > lastPage) setPage(lastPage);
	}, [page, lastPage]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await Promise.all([loadFilters(), loadVouchers()]);
		} catch (e) {
			console.error('[VouchersScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [loadFilters, loadVouchers]);

	const routerTabs = useMemo(() => {
		const counts: Record<string, { total: number; online: number }> = {};
		routerStats.forEach((router) => {
			const key = router.router_id || router.router_name;
			counts[key] = { total: router.total ?? 0, online: router.online ?? 0 };
		});
		return routers.map((router) => ({
			key: router.id,
			label: router.name,
			count: counts[router.id]?.total,
			secondaryCount: counts[router.id]?.online,
		}));
	}, [routers, routerStats]);

	// Tapping the active router pill clears the filter (there is no "All" pill —
	// the Total/Online tiles above already carry those global numbers).
	const handleRouterChange = useCallback((key: string) => {
		setRouterFilter((current) => (current === key ? '' : key));
	}, []);

	const profileLabels = useMemo(
		() => profileList.map((profile) => profile.display_name || profile.name),
		[profileList]
	);
	const profileOptions = useMemo(
		() => [t.allProfiles, ...profileLabels],
		[profileLabels, t.allProfiles]
	);
	const originOptions = useMemo(
		() => [t.allOrigins, t.manualOnly, t.autoOnly],
		[t.allOrigins, t.manualOnly, t.autoOnly]
	);
	const sortOptions = useMemo(
		() => [
			t.sortNewest,
			t.sortOldest,
			t.sortUsernameAsc,
			t.sortUsernameDesc,
			t.sortLastLogin,
		],
		[
			t.sortNewest,
			t.sortOldest,
			t.sortUsernameAsc,
			t.sortUsernameDesc,
			t.sortLastLogin,
		]
	);
	const sortLabels: Record<string, SortKey> = useMemo(
		() => ({
			[t.sortNewest]: 'newest',
			[t.sortOldest]: 'oldest',
			[t.sortUsernameAsc]: 'usernameAsc',
			[t.sortUsernameDesc]: 'usernameDesc',
			[t.sortLastLogin]: 'used',
		}),
		[
			t.sortNewest,
			t.sortOldest,
			t.sortUsernameAsc,
			t.sortUsernameDesc,
			t.sortLastLogin,
		]
	);
	const sortValue = useMemo(
		() => sortOptions.find((label) => sortLabels[label] === sortKey) ?? t.sortNewest,
		[sortOptions, sortLabels, sortKey, t.sortNewest]
	);

	const filtersActive =
		!!statusFilter ||
		!!routerFilter ||
		profileFilter !== t.allProfiles ||
		originFilter !== t.allOrigins ||
		!!searchTerm;

	const clearFilters = useCallback(() => {
		setStatusFilter(null);
		setRouterFilter('');
		setProfileFilter(t.allProfiles);
		setOriginFilter(t.allOrigins);
		setSearch('');
		setSortKey('newest');
	}, [t.allOrigins, t.allProfiles]);

	const toggleStatus = useCallback((status: VoucherStatus) => {
		setStatusFilter((current) => (current === status ? null : status));
	}, []);

	const toggleSelect = useCallback((voucher: Voucher) => {
		setSelected((current) =>
			current.some((item) => item.username === voucher.username)
				? current.filter((item) => item.username !== voucher.username)
				: [...current, voucher]
		);
	}, []);

	const allPageSelected =
		vouchers.length > 0 &&
		vouchers.every((voucher) =>
			selected.some((item) => item.username === voucher.username)
		);

	const toggleSelectAll = useCallback(() => {
		setSelected((current) => {
			const pageNames = new Set(vouchers.map((voucher) => voucher.username));
			const allSelected = vouchers.every((voucher) =>
				current.some((item) => item.username === voucher.username)
			);
			if (allSelected) {
				return current.filter((item) => !pageNames.has(item.username));
			}
			const merged = [...current];
			vouchers.forEach((voucher) => {
				if (!merged.some((item) => item.username === voucher.username)) {
					merged.push(voucher);
				}
			});
			return merged;
		});
	}, [vouchers]);

	const exitSelectMode = useCallback(() => {
		setSelectMode(false);
		setSelected([]);
	}, []);

	const handleGenerate = useCallback(() => {
		Animated.timing(generateFadeAnim, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowGenerate(true));
	}, [generateFadeAnim]);

	const closeGenerate = useCallback(() => {
		Animated.timing(generateFadeAnim, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowGenerate(false));
	}, [generateFadeAnim]);

	const handlePrint = useCallback(() => {
		if (selected.length === 0) {
			ShowAlert(t.selectVouchersFirst, 'Error', [{ text: buttons.ok }]);
			return;
		}
		Animated.timing(qrFadeAnim, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowQr(true));
	}, [buttons.ok, qrFadeAnim, selected.length, t.selectVouchersFirst]);

	const closeQr = useCallback(() => {
		Animated.timing(qrFadeAnim, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowQr(false));
	}, [qrFadeAnim]);

	const closePrompt = useCallback(() => {
		Animated.timing(promptFadeAnim, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowPrompt(false));
	}, [promptFadeAnim]);

	const openPrompt = useCallback(
		(title: string, message: string, action: () => void) => {
			affirmAction.current = action;
			setPromptTitle(title);
			setPromptMessage(message);
			Animated.timing(promptFadeAnim, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start(() => setShowPrompt(true));
		},
		[promptFadeAnim]
	);

	const runAction = useCallback(
		async (action: VoucherAction, voucher: Voucher) => {
			const username = voucher.username;
			if (!username) return;
			const key = `${action}:${username}`;
			setPendingAction(key);
			try {
				const request =
					action === 'disable'
						? disableVoucherUser
						: action === 'enable'
							? enableVoucherUser
							: action === 'reset'
								? resetVoucherUser
								: deleteVoucherUser;
				const res = await request(username, authToken ?? undefined);
				if (!res.ok) {
					const body = await res.json().catch(() => null);
					ShowAlert(getApiMessage(body) || t.actionFailed, 'Error');
					return;
				}
				await loadVouchers();
			} catch (e) {
				console.error('[VouchersScreen] voucher action failed', e);
				ShowAlert(t.actionFailed, 'Error');
			} finally {
				setPendingAction(null);
			}
		},
		[authToken, loadVouchers, t.actionFailed]
	);

	const handleEdit = useCallback(
		async (voucher: Voucher) => {
			const routerId = voucher.router_id;
			if (!routerId) {
				ShowAlert(t.actionFailed, 'Error');
				return;
			}
			let hotspotId = hotspotsCache.current[routerId];
			if (!hotspotId && authToken) {
				try {
					const res = await fetchVoucherHotspots(routerId, authToken);
					if (res.ok) {
						const body: GetVoucherHotspotsResponse = await res.json();
						const hotspots =
							getApiData<NonNullable<GetVoucherHotspotsResponse['data']>>(body)
								?.hotspots ?? [];
						hotspotId = hotspots[0]?.['.id'];
						if (hotspotId) hotspotsCache.current[routerId] = hotspotId;
					}
				} catch (e) {
					console.error('[VouchersScreen] hotspot lookup failed', e);
				}
			}
			navigation.push({
				pathname:
					'/(authenticated)/routers/vouchers/[vRId]/[hotspotId]/[voucher]',
				params: {
					vRId: routerId,
					hotspotId: hotspotId ?? '',
					voucher: voucher.username,
				},
			});
		},
		[authToken, navigation, t.actionFailed]
	);

	const confirmDelete = useCallback(
		(voucher: Voucher) => {
			openPrompt(t.confirmDeleteTitle, t.deleteMessage, () => {
				closePrompt();
				void runAction('delete', voucher);
			});
		},
		[closePrompt, openPrompt, runAction, t.confirmDeleteTitle, t.deleteMessage]
	);

	const confirmReset = useCallback(
		(voucher: Voucher) => {
			openPrompt(t.resetConfirmTitle, t.resetConfirmMessage, () => {
				closePrompt();
				void runAction('reset', voucher);
			});
		},
		[
			closePrompt,
			openPrompt,
			runAction,
			t.resetConfirmMessage,
			t.resetConfirmTitle,
		]
	);

	const statusTiles: { status: VoucherStatus; label: string; color: string }[] = [
		{ status: 'online', label: t.online, color: lime },
		{ status: 'active', label: t.active, color: bim },
		{ status: 'unused', label: t.unused, color: lightBlue },
		{ status: 'expired', label: t.expired, color: yellow },
		{ status: 'disabled', label: t.disabled, color: error },
	];

	return (
		<>
			<ParallaxScrollView
				headerBackgroundColor={{
					light: backgroundLight,
					dark: backgroundDark,
				}}
				containerStyle={{ flex: 1 }}
				contentStyle={{ paddingHorizontal: 10 }}
				onRefresh={handleRefresh}
				refreshing={refreshing}
			>
				<TileContainer
					id='vouchers-header-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<ScreenHeader
						id='vouchers-header'
						title={t.title}
						description={t.description}
						loading={loading}
					>
						<View style={styles.headerActions}>
							<ThemedButton
								style={styles.headerButton}
								title={
									selected.length > 0
										? translateWithVariables(t.printCount, {
												count: selected.length,
											})
										: t.print
								}
								icon='printer'
								numberOfLines={1}
								onPress={handlePrint}
								lightColor={backgroundLight}
								darkColor={backgroundDark}
								lightTextColor={textLight}
								darkTextColor={textDark}
								iconColor={textColor}
								textStyle={styles.headerButtonText}
							/>
							<ThemedButton
								style={styles.headerButton}
								title={t.generate}
								icon='plus'
								numberOfLines={1}
								onPress={handleGenerate}
								lightColor={bim}
								darkColor={bim}
								lightTextColor={white}
								darkTextColor={white}
								iconColor={white}
								textStyle={styles.headerButtonText}
							/>
						</View>
						{updatedAt ? (
							<ThemedText
								style={[styles.updated, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{translateWithVariables(t.updated, {
									time: updatedAt.toLocaleTimeString(),
								})}
							</ThemedText>
						) : null}
					</ScreenHeader>
				</TileContainer>

			<TileContainer
				id='vouchers-content-tile'
				flat
				backgroundColor={background}
				style={{ width: '100%', gap: 12 }}
			>
				<TileContainer
					id='vouchers-overview-tile'
					borderless
					backgroundColor={background}
					style={styles.section}
				>
					<View style={styles.statsGrid}>
						{statusTiles.map((tile) => (
							<StatTile
								key={tile.status}
								id={`voucher-stat-${tile.status}`}
								label={tile.label}
								value={stats[tile.status] ?? 0}
								color={tile.color}
								active={statusFilter === tile.status}
								onPress={() => toggleStatus(tile.status)}
							/>
						))}
						<StatTile
							id='voucher-stat-total'
							label={t.total}
							value={stats.total ?? 0}
							color={textColor}
							active={!statusFilter}
							onPress={() => setStatusFilter(null)}
						/>
					</View>

					<SegmentedTabs
						tabs={routerTabs}
						activeKey={routerFilter}
						onChange={handleRouterChange}
						allowNoneSelected
					/>
				</TileContainer>

				<TileContainer
					id='vouchers-users-tile'
					borderless
					backgroundColor={background}
					style={styles.section}
				>
					<ThemedInput
						containerStyle={styles.searchInput}
						value={search}
						setValue={setSearch}
						placeholder={t.searchPlaceholder}
						returnKeyType='search'
					/>

					<View style={styles.filterRow}>
						<FilterDropdown
							id='voucher-profile-filter'
							placeholder={t.allProfiles}
							value={profileFilter}
							options={profileOptions}
							onChange={setProfileFilter}
						/>
						<FilterDropdown
							id='voucher-origin-filter'
							placeholder={t.allOrigins}
							value={originFilter}
							options={originOptions}
							onChange={setOriginFilter}
						/>
						<FilterDropdown
							id='voucher-sort-filter'
							placeholder={t.sortBy}
							value={sortValue}
							options={sortOptions}
							onChange={(label) => setSortKey(sortLabels[label] ?? 'newest')}
						/>
					</View>

					{filtersActive ? (
						<View style={styles.clearRow}>
							<ThemedButton
								title={t.clearFilters}
								onPress={clearFilters}
								lightColor='transparent'
								darkColor='transparent'
								lightTextColor={bim}
								darkTextColor={bim}
								textStyle={styles.clearText}
							/>
						</View>
					) : null}

					{selectMode ? (
						<View style={styles.selectBar}>
							<ThemedButton
								style={styles.selectBarButton}
								title={allPageSelected ? t.clearSelection : t.selectAll}
								icon={allPageSelected ? 'checkboxBlank' : 'selectAll'}
								onPress={toggleSelectAll}
								lightColor={backgroundLight}
								darkColor={backgroundDark}
								lightTextColor={textLight}
								darkTextColor={textDark}
								iconColor={textColor}
								numberOfLines={1}
								textStyle={styles.toolbarText}
							/>
							<ThemedButton
								style={styles.selectBarButton}
								title={buttons.cancel}
								onPress={exitSelectMode}
								lightColor={cancelButton}
								darkColor={cancelButton}
								lightTextColor={white}
								darkTextColor={white}
								numberOfLines={1}
								textStyle={styles.toolbarText}
							/>
						</View>
					) : (
						<View style={styles.selectBar}>
							<ThemedButton
								style={styles.selectBarButton}
								title={
									selected.length > 0
										? translateWithVariables(t.selectVouchersCount, {
												count: selected.length,
											})
										: t.selectVouchers
								}
								icon='selectMultiple'
								onPress={() => setSelectMode(true)}
								lightColor={bim}
								darkColor={bim}
								lightTextColor={white}
								darkTextColor={white}
								iconColor={white}
								numberOfLines={1}
								textStyle={styles.toolbarText}
							/>
						</View>
					)}

					<RecordList
						id='vouchers-users-list'
						description={
							total > 0
								? translateWithVariables(t.totalVouchers, {
										count: formatAmount(total, 0),
									})
								: undefined
						}
						loading={loading && vouchers.length === 0}
						loadingMessage={
							translations[language].categories.dashboard.loading
						}
						isEmpty={!loading && vouchers.length === 0}
						emptyMessage={
							filtersActive ? t.noMatchingVouchers : t.noRouterVouchers
						}
					>
						{vouchers.map((voucher) => (
							<VoucherCard
								key={`${voucher.router_id ?? 'router'}-${voucher.id ?? voucher.username}`}
								voucher={voucher}
								labels={t}
								language={language}
								pendingAction={pendingAction}
								selectMode={selectMode}
								selected={selected.some(
									(item) => item.username === voucher.username
								)}
								onToggleSelect={toggleSelect}
								onEdit={handleEdit}
								onRunAction={runAction}
								onReset={confirmReset}
								onDelete={confirmDelete}
							/>
						))}
					</RecordList>

					<ThemedView
						style={styles.pagination}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedButton
							title={buttons.previous}
							onPress={() => setPage((current) => Math.max(1, current - 1))}
							disabled={page <= 1}
							darkColor={backgroundDark}
							lightColor={backgroundLight}
							lightTextColor={page <= 1 ? mutedTextLight : undefined}
							darkTextColor={page <= 1 ? mutedTextDark : undefined}
							textStyle={styles.paginationText}
						/>
						<ThemedText lightColor={textLight} darkColor={textDark}>
							{page} / {lastPage}
						</ThemedText>
						<ThemedButton
							title={buttons.next}
							onPress={() =>
								setPage((current) => Math.min(lastPage, current + 1))
							}
							disabled={page >= lastPage}
							darkColor={backgroundDark}
							lightColor={backgroundLight}
							lightTextColor={page >= lastPage ? mutedTextLight : undefined}
							darkTextColor={page >= lastPage ? mutedTextDark : undefined}
							textStyle={styles.paginationText}
						/>
					</ThemedView>
				</TileContainer>
			</TileContainer>
			</ParallaxScrollView>

			<Prompt
				id='confirm-voucher-action'
				fadeAnim={promptFadeAnim}
				visible={showPrompt}
				onClose={closePrompt}
				title={promptTitle}
				message={promptMessage}
				buttons={[
					{
						title: buttons.cancel,
						color: cancelButton,
						textColor: white,
						action: closePrompt,
					},
					{
						title: buttons.confirm,
						color: dangerButton,
						textColor: white,
						action: () => {
							affirmAction.current?.();
						},
					},
				]}
			/>

			<VoucherQrPreview
				visible={showQr}
				fadeAnim={qrFadeAnim}
				vouchers={selected}
				onClose={closeQr}
			/>

			<GenerateVouchersOverlay
				visible={showGenerate}
				fadeAnim={generateFadeAnim}
				authToken={authToken ?? undefined}
				routers={routers}
				profiles={profileList}
				initialRouterId={routerFilter}
				onClose={closeGenerate}
				onGenerated={() => {
					void handleRefresh();
				}}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	overviewHeader: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: 8,
	},
	screenTitle: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	titleRow: {
		flex: 1,
		minWidth: 0,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	headerActions: {
		flexShrink: 0,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: 6,
	},
	headerButton: {
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 6,
	},
	headerButtonText: {
		fontSize: fontSize['button.small'],
	},
	description: {
		fontSize: fontSize['text.small'],
	},
	updated: {
		fontSize: fontSize['text.xsmall'],
	},
	selectBar: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 8,
	},
	selectBarButton: {
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
	},
	toolbarText: {
		fontSize: fontSize['button.small'],
	},
	statsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	statTile: {
		flexBasis: '30%',
		flexGrow: 1,
		padding: 8,
		gap: 2,
		borderRadius: 6,
	},
	statLabel: {
		fontSize: fontSize['text.xsmall'],
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	},
	statValue: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	searchInput: {
		width: '100%',
	},
	filterRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	filterCell: {
		flexBasis: '47%',
		flexGrow: 1,
		minWidth: 140,
	},
	dropdownMenu: {
		width: '100%',
	},
	clearRow: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'flex-end',
	},
	clearText: {
		fontSize: fontSize['text.small'],
	},
	pagination: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 8,
		alignItems: 'center',
	},
	paginationText: {
		fontSize: fontSize['text.medium'],
	},
});
