import ParallaxScrollView from "@/components/ParallaxScrollView";
import Prompt from "@/components/Prompt";
import { RecordCard, RecordList } from "@/components/RecordList";
import ScreenHeader from "@/components/ScreenHeader";
import TileContainer from "@/components/TileContainer";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { ThemedButton } from "@/components/ThemedButton";
import { ThemedDropdown } from "@/components/ThemedDropdown";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import translations from "@/constants/Trans";
import { useGeneral } from "@/context/GeneralContext";
import { generateRandomInt } from "@/helpers";
import { getApiData, getPageInfo, PageInfo } from "@/helpers/apiResponse";
import { useThemeColor } from "@/hooks/useThemeColor";
import useTrackHistory from "@/hooks/useTrackHistory";
import {
    createRouterTrafficEventSource,
    deleteRouterCookie,
    getRouterActiveUsers,
    getRouterCookies,
    getRouterDHCPLeases,
    getRouterHosts,
    getRouterInterfaces,
    getRouterUsers
} from "@/services/RouterService";
import {
    Cookie,
    DHCPLease,
    GetRouterActiveUsersResponse,
    GetRouterCookiesResponse,
    GetRouterDHCPLeasesResponse,
    GetRouterHostsResponse,
    GetRouterUsersResponse,
    Host,
    HotspotActiveUser,
    HotspotUser,
    RouterTrafficHello,
    RouterTrafficSample
} from "@/types";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, useAnimatedValue, View } from "react-native";
import { LineChart } from "react-native-chart-kit";

type routerTab = 'active' | 'users' | 'cookies' | 'hosts' | 'dhcp_leases' | 'traffic';
const cooloffTime = 1000 * 60; // 1 minute

function getInterfaceNames(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.flatMap((item) => {
            if (typeof item === 'string') return [item.trim()].filter(Boolean);
            if (!item || typeof item !== 'object') return [];
            const record = item as Record<string, unknown>;
            const name = record.name ?? record.interface ?? record['default-name'];
            if (typeof name === 'string') return [name.trim()].filter(Boolean);
            return getInterfaceNames(record);
        });
    }

    if (!value || typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    const name = record.name ?? record.interface ?? record['default-name'];
    if (typeof name === 'string') return [name.trim()].filter(Boolean);
    for (const key of ['interfaces', 'data', 'result', 'router']) {
        if (key in record) {
            const names = getInterfaceNames(record[key]);
            if (names.length) return names;
        }
    }
    return Object.values(record).flatMap((item) =>
        item && typeof item === 'object' ? getInterfaceNames(item) : []
    );
}

function isTrafficSample(value: unknown): value is RouterTrafficSample {
    if (!value || typeof value !== 'object') return false;
    const sample = value as Record<string, unknown>;
    return typeof sample.t === 'number' && Number.isFinite(sample.t) &&
        typeof sample.rx === 'number' && Number.isFinite(sample.rx) &&
        typeof sample.tx === 'number' && Number.isFinite(sample.tx);
}

function formatTrafficRate(bitsPerSecond: number): string {
    if (bitsPerSecond >= 1_000_000) return `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbps`;
    if (bitsPerSecond >= 1_000) return `${(bitsPerSecond / 1_000).toFixed(2)} Kbps`;
    return `${Math.round(bitsPerSecond)} bps`;
}

export default function RouterDetailsScreen() {

    const { handleUpdateHistory, language, authToken } = useGeneral();
    const { routerId } = useLocalSearchParams() as { routerId?: string };
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const promptFadeAnim = useAnimatedValue(0);
    const promptCancelButton = useThemeColor({}, "cancelButton");
    const dangerButton = useThemeColor({}, "dangerButton");
    const bim = useThemeColor({}, 'bim');
    const lightGrey = useThemeColor({}, 'lightGrey');
    const tabText = useThemeColor({}, 'heading.one');
    const titleText = useThemeColor({}, 'headers');
    const background = useThemeColor({}, 'background');
    const white = useThemeColor({}, 'white');
    const red = useThemeColor({}, 'error');
    const [showPrompt, setShowPrompt] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<routerTab>('active');
    const [lastFetched, setLastFetched] = useState<{ activeUsers: string | undefined, users: string | undefined, cookies: string | undefined, hosts: string | undefined, dhcp_leases: string | undefined }>({ activeUsers: undefined, users: undefined, cookies: undefined, hosts: undefined, dhcp_leases: undefined });
    const [retrying, setRetrying] = useState(false);
    const [activeUsers, setActiveUsers] = useState<HotspotActiveUser[]>([]);
    const [users, setUsers] = useState<HotspotUser[]>([]);
    const [cookies, setCookies] = useState<Cookie[]>([]);
    const [hosts, setHosts] = useState<Host[]>([]);
    const [DHCPLeases, setDHCPLeases] = useState<DHCPLease[]>([]);
    const [activeCookie, setActiveCookie] = useState<string>();
    const [usersMeta, setUsersMeta] = useState<PageInfo | undefined>();
    const [hostsMeta, setHostsMeta] = useState<PageInfo | undefined>();
    const [DHCPLeasesMeta, setDHCPLeasesMeta] = useState<PageInfo | undefined>();
    const [cookiesMeta, setCookiesMeta] = useState<PageInfo | undefined>();
    const [activeMeta, setActiveMeta] = useState<PageInfo | undefined>();
    const [trafficInterfaces, setTrafficInterfaces] = useState<string[]>([]);
    const [selectedTrafficInterface, setSelectedTrafficInterface] = useState('');
    const [showTrafficInterfaceDropdown, setShowTrafficInterfaceDropdown] = useState(false);
    const trafficInterfaceDropdownRef = useRef<View>(null);
    const [trafficSamples, setTrafficSamples] = useState<RouterTrafficSample[]>([]);
    const [trafficInterfacesLoading, setTrafficInterfacesLoading] = useState(false);
    const [trafficInterfacesLoaded, setTrafficInterfacesLoaded] = useState(false);
    const [trafficInterfaceError, setTrafficInterfaceError] = useState('');
    const [trafficStatus, setTrafficStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [trafficError, setTrafficError] = useState('');

    // Seed parent immediately on mount to guarantee ordering before current route push
    useEffect(() => {
        handleUpdateHistory(`/(authenticated)/routers/preview/${routerId}`);
    }, [handleUpdateHistory, routerId]);

    // Track current route after parent seeding is registered
    useTrackHistory(
        routerId
            ? `/(authenticated)/routers/details/${routerId}`
            : '/(authenticated)/routers'
    );

    useEffect(() => {
        navigation.setOptions({
            headerProps: {
                goback: true,
            },
        });
    }, [navigation]);

    const fetchActiveUsers = useCallback(async (params?: { isRetry?: boolean; page?: number }) => {
        if (!routerId || !authToken) return;
        setLoading(true);
        setRetrying(params?.isRetry ?? false);
        try {
            const resp = await getRouterActiveUsers({ routerId, token: authToken, page: params?.page, limit: 10 });
            if (resp.ok) {
                const body: GetRouterActiveUsersResponse = await resp.json();
                // API 2.0: payload lives in `data`, pagination in `meta.pagination`.
                const data = getApiData<NonNullable<GetRouterActiveUsersResponse['data']>>(body);
                setActiveUsers(data?.active || []);
                setActiveMeta(getPageInfo(body, 'active'));
                setLastFetched((prev) => ({ ...prev, activeUsers: new Date().toISOString() }));
            } else {
                console.error('[RouterDetails] fetchActiveUsers failed', resp.status, resp.statusText);
            }
        } catch (error) {
            console.error('[RouterDetails] fetchActiveUsers error', error);
        } finally {
            setLoading(false);
        }
    }, [routerId, authToken]);

    const fetchUsers = useCallback(async (params?: { isRetry?: boolean; page?: number }) => {
        if (!routerId || !authToken) return;
        setLoading(true);
        setRetrying(params?.isRetry ?? false);
        try {
            const resp = await getRouterUsers({ routerId, token: authToken, page: params?.page, limit: 10 });
            if (resp.ok) {
                const body: GetRouterUsersResponse = await resp.json();
                const data = getApiData<NonNullable<GetRouterUsersResponse['data']>>(body);
                setUsers(data?.users || []);
                setUsersMeta(getPageInfo(body, 'users'));
                setLastFetched((prev) => ({ ...prev, users: new Date().toISOString() }));
            } else {
                console.error('[RouterDetails] fetchUsers failed', resp.status, resp.statusText);
            }
        } catch (error) {
            console.error('[RouterDetails] fetchUsers error', error);
        } finally {
            setLoading(false);
        }
    }, [routerId, authToken]);

    const fetchCookies = useCallback(async (params?: { isRetry?: boolean; page?: number }) => {
        if (!routerId || !authToken) return;
        setLoading(true);
        setRetrying(params?.isRetry ?? false);
        try {
            const resp = await getRouterCookies({ routerId, token: authToken, page: params?.page, limit: 10 });
            if (resp.ok) {
                const body: GetRouterCookiesResponse = await resp.json();
                const data = getApiData<NonNullable<GetRouterCookiesResponse['data']>>(body);
                setCookies(data?.cookies || []);
                setCookiesMeta(getPageInfo(body, 'cookies'));
                setLastFetched((prev) => ({ ...prev, cookies: new Date().toISOString() }));
            } else {
                console.error('[RouterDetails] fetchCookies failed', resp.status, resp.statusText);
            }
        } catch (error) {
            console.error('[RouterDetails] fetchCookies error', error);
        } finally {
            setLoading(false);
        }
    }, [routerId, authToken]);

    const fetchHosts = useCallback(async (params?: { isRetry?: boolean; page?: number }) => {
        if (!routerId || !authToken) return;
        setLoading(true);
        setRetrying(params?.isRetry ?? false);
        try {
            const resp = await getRouterHosts({ routerId, token: authToken, page: params?.page, limit: 10 });
            if (resp.ok) {
                const body: GetRouterHostsResponse = await resp.json();
                const data = getApiData<NonNullable<GetRouterHostsResponse['data']>>(body);
                setHosts(data?.hosts || []);
                setHostsMeta(getPageInfo(body, 'hosts'));
                setLastFetched((prev) => ({ ...prev, hosts: new Date().toISOString() }));
            } else {
                console.error('[RouterDetails] fetchHosts failed', resp.status, resp.statusText);
            }
        } catch (error) {
            console.error('[RouterDetails] fetchHosts error', error);
        } finally {
            setLoading(false);
        }
    }, [routerId, authToken]);

    const fetchDHCPLeases = useCallback(async (params?: { isRetry?: boolean; page?: number }) => {
        if (!routerId || !authToken) return;
        setLoading(true);
        setRetrying(params?.isRetry ?? false);
        try {
            const resp = await getRouterDHCPLeases({ routerId, token: authToken, page: params?.page, limit: 10 });
            if (resp.ok) {
                const body: GetRouterDHCPLeasesResponse = await resp.json();
                const data = getApiData<NonNullable<GetRouterDHCPLeasesResponse['data']>>(body);
                setDHCPLeases(data?.leases || []);
                setDHCPLeasesMeta(getPageInfo(body, 'leases'));
                setLastFetched((prev) => ({ ...prev, dhcp_leases: new Date().toISOString() }));
            } else {
                console.error('[RouterDetails] fetchDHCPLeases failed', resp.status, resp.statusText);
            }
        } catch (error) {
            console.error('[RouterDetails] fetchDHCPLeases error', error);
        } finally {
            setLoading(false)
        }
    }, [routerId, authToken]);

    const handleOpenTrafficTab = useCallback(async () => {
        setActiveTab('traffic');
        if (!routerId || !authToken || trafficInterfacesLoaded || trafficInterfacesLoading) return;
        setTrafficInterfacesLoading(true);
        setTrafficInterfaceError('');
        try {
            const response = await getRouterInterfaces(routerId, authToken);
            if (!response.ok) {
                throw new Error(`Interface request failed (${response.status})`);
            }
            const names = getInterfaceNames(getApiData(await response.json()));
            if (!names.length) {
                setTrafficInterfaceError(
                    translations[language].categories.routers.trafficNoInterfaces ||
                    'No router interfaces were found.'
                );
                return;
            }
            const uniqueNames = [...new Set(names)];
            const preferredInterface =
                uniqueNames.find((name) => name.toLowerCase() === 'ether1') ?? uniqueNames[0];
            setTrafficInterfaces(uniqueNames);
            setSelectedTrafficInterface((current) =>
                uniqueNames.includes(current) ? current : preferredInterface
            );
            setTrafficInterfacesLoaded(true);
        } catch (error) {
            console.error('[RouterDetails] failed to load router interfaces', error);
            setTrafficInterfaceError(
                translations[language].categories.routers.trafficInterfacesError ||
                'Could not load router interfaces.'
            );
        } finally {
            setTrafficInterfacesLoading(false);
        }
    }, [routerId, authToken, trafficInterfacesLoaded, trafficInterfacesLoading, language]);

    useEffect(() => {
        if (!isFocused || activeTab !== 'traffic' || !routerId || !authToken || !selectedTrafficInterface) {
            setTrafficStatus('idle');
            return;
        }

        let active = true;
        setTrafficSamples([]);
        setTrafficError('');
        setTrafficStatus('connecting');
        const eventSource = createRouterTrafficEventSource({
            routerId,
            iface: selectedTrafficInterface,
            token: authToken,
        });

        eventSource.addEventListener('open', () => {
            if (active) {
                setTrafficStatus('connected');
                setTrafficError('');
            }
        });
        eventSource.addEventListener('hello', (event) => {
            if (!active || !event.data) return;
            try {
                const hello = JSON.parse(event.data) as RouterTrafficHello;
                if (!Array.isArray(hello.samples) || !hello.samples.every(isTrafficSample)) {
                    throw new Error('Traffic stream sent invalid history data');
                }
                setTrafficSamples(hello.samples.slice(-120));
            } catch (error) {
                console.error('[RouterDetails] invalid traffic history event', error);
                setTrafficStatus('error');
                setTrafficError(
                    translations[language].categories.routers.trafficInvalidData ||
                    'Received invalid traffic data.'
                );
            }
        });
        eventSource.addEventListener('traffic', (event) => {
            if (!active || !event.data) return;
            try {
                const sample: unknown = JSON.parse(event.data);
                if (!isTrafficSample(sample)) throw new Error('Traffic stream sent an invalid sample');
                setTrafficSamples((current) => {
                    const next = current.filter((item) => item.t !== sample.t);
                    return [...next, sample].sort((a, b) => a.t - b.t).slice(-120);
                });
            } catch (error) {
                console.error('[RouterDetails] invalid traffic sample event', error);
                setTrafficStatus('error');
                setTrafficError(
                    translations[language].categories.routers.trafficInvalidData ||
                    'Received invalid traffic data.'
                );
            }
        });
        eventSource.addEventListener('bye', () => {
            if (active) setTrafficStatus('connecting');
        });
        eventSource.addEventListener('error', (event) => {
            if (!active) return;
            console.error('[RouterDetails] traffic stream error', event);
            setTrafficStatus('error');
            setTrafficError(
                translations[language].categories.routers.trafficConnectionError ||
                'Traffic stream connection failed. Retrying...'
            );
        });

        return () => {
            active = false;
            eventSource.removeAllEventListeners();
            eventSource.close();
        };
    }, [isFocused, activeTab, routerId, authToken, selectedTrafficInterface, language]);

    useEffect(() => {
        if (!routerId || !authToken || loading) return;
        if (activeTab === 'active' && (!lastFetched.activeUsers || (Date.now() - new Date(lastFetched.activeUsers).getTime() > cooloffTime))) {
            fetchActiveUsers({ isRetry: false, page: activeMeta?.current_page ?? 1 });
        }
        if (activeTab === 'users' && (!lastFetched.users || (Date.now() - new Date(lastFetched.users).getTime() > cooloffTime))) {
            fetchUsers({ isRetry: false, page: usersMeta?.current_page ?? 1 });
        }
        if (activeTab === 'cookies' && (!lastFetched.cookies || (Date.now() - new Date(lastFetched.cookies).getTime() > cooloffTime))) {
            fetchCookies({ isRetry: false, page: cookiesMeta?.current_page ?? 1 });
        }
        if (activeTab === 'hosts' && (!lastFetched.hosts || (Date.now() - new Date(lastFetched.hosts).getTime() > cooloffTime))) {
            fetchHosts({ isRetry: false, page: hostsMeta?.current_page ?? 1 });
        }
        if (activeTab === 'dhcp_leases' && (!lastFetched.dhcp_leases || (Date.now() - new Date(lastFetched.dhcp_leases).getTime() > cooloffTime))) {
            fetchDHCPLeases({ isRetry: false, page: DHCPLeasesMeta?.current_page ?? 1 });
        }

    }, [
        routerId,
        authToken,
        loading,
        activeTab,
        fetchActiveUsers,
        fetchUsers,
        fetchCookies,
        fetchHosts,
        fetchDHCPLeases,
        hostsMeta?.current_page,
        DHCPLeasesMeta?.current_page,
        activeMeta?.current_page,
        usersMeta?.current_page,
        cookiesMeta?.current_page,
        lastFetched.activeUsers,
        lastFetched.users,
        lastFetched.cookies,
        lastFetched.hosts,
        lastFetched.dhcp_leases
    ]);

    const handleRemoveCookie = useCallback(async (cId?: string) => {
        const cookieId = cId ?? activeCookie;
        if (!routerId || !authToken || !cookieId) return;
        setLoading(true);
        try {
            const resp = await deleteRouterCookie({ routerId, token: authToken, cookieId });
            if (resp.ok) {
                setCookies((prev) => prev.filter((cookie) => cookie['.id'] !== cookieId));
            } else {
                console.error('[RouterDetails] removeCookie failed', resp.status, resp.statusText);
            }
        } catch (error) {
            console.error('[RouterDetails] removeCookie error', error);
        } finally {
            setLoading(false);
        }
    }, [routerId, authToken, activeCookie]);

    const handleRefresh = () => {
        setLoading(true);
        try {
            if (activeTab === 'active')
                fetchActiveUsers({ isRetry: true, page: activeMeta?.current_page ?? 1 });
            if (activeTab === 'users')
                fetchUsers({ isRetry: true, page: usersMeta?.current_page ?? 1 });
            if (activeTab === 'cookies')
                fetchCookies({ isRetry: true, page: cookiesMeta?.current_page ?? 1 });
        } catch (error) {
            console.error('[RouterDetails] handleRefresh error', error);
        }
        setLoading(false);
    };
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
            }).start();
            setShowPrompt(false);
        }
    }
    if (loading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} lightColor={background} darkColor={background}>
                <ThemedView lightColor={background} darkColor={background} style={{ display: retrying ? 'flex' : 'none', alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' }}>
                    <ThemedText lightColor={lightGrey} darkColor={lightGrey}>
                        {translations[language].categories.generic.reloading}
                    </ThemedText>
                </ThemedView>
                <ActivityIndicator size="large" color={bim} />
            </ThemedView>
        );
    }
    return (
        <>
            <ParallaxScrollView
                headerBackgroundColor={{
                    light: background,
                    dark: background,
                }}
                contentStyle={{
                    paddingHorizontal: 10,
                }}
                containerStyle={{ flex: 1 }}
                onRefresh={handleRefresh}
                refreshing={loading}
            >
                                <TileContainer
                    id='router-details-header-tile'
                    flat
                    backgroundColor={background}
                    style={{ width: '100%' }}
                >
                    <ScreenHeader
                        id='router-details-header'
                        title={translations[language].categories.routers.routerDetails}
                    />
                </TileContainer>
                <ThemedView style={{ marginVertical: 10 }} lightColor={background} darkColor={background}>
                    <SegmentedTabs
                        activeKey={activeTab}
                        onChange={(key) => {
                            if (key === 'traffic') {
                                handleOpenTrafficTab();
                                return;
                            }
                            setActiveTab(key as routerTab);
                        }}
                        tabs={[
                            {
                                key: 'active',
                                label: translations[language].categories.routers.activeSessions,
                                count: activeMeta?.total,
                            },
                            {
                                key: 'users',
                                label: translations[language].categories.routers.users,
                                count: usersMeta?.total,
                            },
                            {
                                key: 'cookies',
                                label: translations[language].categories.routers.cookies,
                                count: cookiesMeta?.total,
                            },
                            {
                                key: 'hosts',
                                label: translations[language].categories.routers.hosts,
                                count: hostsMeta?.total,
                            },
                            {
                                key: 'dhcp_leases',
                                label: translations[language].categories.routers.dhcpLeases,
                                count: DHCPLeasesMeta?.total,
                            },
                            {
                                key: 'traffic',
                                label: translations[language].categories.routers.traffic,
                            },
                        ]}
                    />
                </ThemedView>
                <TileContainer id={routerId || 'new-router' + generateRandomInt(1000, 9999)} backgroundColor={background} flat style={{ padding: 10 }}>
                    <ThemedView
                        style={{ display: activeTab === 'active' ? 'flex' : 'none', flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start' }}
                        lightColor={background}
                        darkColor={background}
                    >
                        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }} lightColor={background} darkColor={background}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: titleText, marginVertical: 10 }}>{translations[language].categories.routers.activeSessions}</ThemedText>
                        </ThemedView>
                        <ThemedView style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', flexDirection: "column" }} lightColor={background} darkColor={background}>
                            <RecordList
                                id='router-active-sessions'
                                isEmpty={activeUsers.length === 0}
                                emptyMessage={translations[language].categories.routers.noActiveSessions}
                            >
                                {activeUsers.map((user, index) => (
                                    <RecordCard
                                        key={`${user.user}-${index}`}
                                        id={`router-active-${index}`}
                                        title={user.user}
                                        subtitle={user.server}
                                        fields={[
                                            {
                                                label: translations[language].categories.routers.address,
                                                value: user.address,
                                            },
                                            {
                                                label: translations[language].categories.routers.mac,
                                                value: user['mac-address'],
                                            },
                                            {
                                                label: translations[language].categories.routers.uptime,
                                                value: user.uptime,
                                            },
                                            {
                                                label: translations[language].categories.routers.bytesIn,
                                                value: user['bytes-in'],
                                            },
                                            {
                                                label: translations[language].categories.routers.bytesOut,
                                                value: user['bytes-out'],
                                            },
                                            {
                                                label: translations[language].categories.routers.timeLeft,
                                                value: user['session-time-left'] || '-',
                                            },
                                            {
                                                label: translations[language].categories.routers.loginBy,
                                                value: user['login-by'] || '-',
                                            },
                                            {
                                                label: translations[language].categories.routers.startDate,
                                                value: user['start-date'] || '-',
                                            },
                                        ]}
                                    />
                                ))}
                            </RecordList>
                            <ThemedView style={{ width: '100%', marginTop: 12, height: 50, flexDirection: 'row', gap: 10, display: (activeMeta?.total ?? 0 > 1) && (activeMeta?.last_page ?? 0 > 1) ? 'flex' : 'none' }} lightColor={background} darkColor={background}>
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.first}
                                    onPress={() => {
                                        if (activeMeta && activeMeta.current_page > 1) {
                                            fetchActiveUsers({ page: 1 });
                                        }
                                    }}
                                    disabled={activeMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: activeMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.previous}
                                    onPress={() => {
                                        if (activeMeta && activeMeta.current_page > 1) {
                                            fetchActiveUsers({ page: activeMeta.current_page > 1 ? activeMeta.current_page - 1 : 1 });
                                        }
                                    }}
                                    disabled={activeMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: activeMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.next}
                                    onPress={() => {
                                        if (activeMeta && activeMeta.current_page < activeMeta.last_page) {
                                            fetchActiveUsers({ page: activeMeta.current_page + 1 });
                                        }
                                    }
                                    }
                                    disabled={activeMeta?.current_page === activeMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: activeMeta?.current_page === activeMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.last}
                                    onPress={() => {
                                        if (activeMeta && activeMeta.current_page < activeMeta.last_page) {
                                            fetchActiveUsers({ page: activeMeta.last_page });
                                        }
                                    }}
                                    disabled={activeMeta?.current_page === activeMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: activeMeta?.current_page === activeMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>
                    <ThemedView
                        style={{ display: activeTab === 'users' ? 'flex' : 'none', flex: 1, justifyContent: 'center', alignSelf: 'stretch', alignItems: 'flex-start' }}
                        lightColor={background}
                        darkColor={background}
                    >
                        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }} lightColor={background} darkColor={background}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: titleText, marginVertical: 10 }}>{translations[language].categories.routers.users}</ThemedText>
                        </ThemedView>
                        <ThemedView style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', flexDirection: "column" }} lightColor={background} darkColor={background}>
                            <RecordList
                                id='router-users'
                                isEmpty={users.length === 0}
                                emptyMessage={translations[language].categories.routers.noUsers}
                            >
                                {users.map((user, index) => (
                                    <RecordCard
                                        key={`${user.name}-${index}`}
                                        id={`router-user-${index}`}
                                        title={user.name}
                                        subtitle={user.profile}
                                        fields={[
                                            {
                                                label: translations[language].categories.routers.mac,
                                                value: user['mac-address'],
                                            },
                                            {
                                                label: translations[language].categories.routers.uptime,
                                                value: user.uptime,
                                            },
                                            {
                                                label: translations[language].categories.routers.bytesIn,
                                                value: user['bytes-in'],
                                            },
                                            {
                                                label: translations[language].categories.routers.bytesOut,
                                                value: user['bytes-out'],
                                            },
                                            {
                                                label: translations[language].categories.routers.comment,
                                                value: user['comment'] || '-',
                                            },
                                        ]}
                                    />
                                ))}
                            </RecordList>
                            <ThemedView
                                style={{ width: '100%', marginTop: 12, height: 50, flexDirection: 'row', gap: 10, display: (usersMeta?.total ?? 0 > 1) && (usersMeta?.last_page ?? 0 > 1) ? 'flex' : 'none' }}
                                lightColor={background}
                                darkColor={background}>
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.first}
                                    onPress={() => {
                                        if (usersMeta && usersMeta.current_page > 1) {
                                            fetchUsers({ page: 1 });
                                        }
                                    }}
                                    disabled={usersMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: usersMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.previous}
                                    onPress={() => {
                                        if (usersMeta && usersMeta.current_page > 1) {
                                            fetchUsers({ page: usersMeta.current_page > 1 ? usersMeta.current_page - 1 : 1 });
                                        }
                                    }}
                                    disabled={usersMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: usersMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.next}
                                    onPress={() => {
                                        if (usersMeta && usersMeta.current_page < usersMeta.last_page) {
                                            fetchUsers({ page: usersMeta.current_page + 1 });
                                        }
                                    }}
                                    disabled={usersMeta?.current_page === usersMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: usersMeta?.current_page === usersMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.last}
                                    onPress={() => {
                                        if (usersMeta && usersMeta.current_page < usersMeta.last_page) {
                                            fetchUsers({ page: usersMeta.last_page });
                                        }
                                    }}
                                    disabled={usersMeta?.current_page === usersMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: usersMeta?.current_page === usersMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>
                    <ThemedView
                        style={{ display: activeTab === 'cookies' ? 'flex' : 'none', flex: 1, justifyContent: 'center', alignSelf: 'stretch', alignItems: 'flex-start' }}
                        lightColor={background}
                        darkColor={background}
                    >
                        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }} lightColor={background} darkColor={background}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: titleText, marginVertical: 10 }}>{translations[language].categories.routers.cookies}</ThemedText>
                        </ThemedView>
                        <ThemedView style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', flexDirection: "column" }} lightColor={background} darkColor={background}>
                            <RecordList
                                id='router-cookies'
                                isEmpty={cookies.length === 0}
                                emptyMessage={translations[language].categories.routers.noCookies}
                            >
                                {cookies.map((cookie, index) => (
                                    <RecordCard
                                        key={cookie['.id'] ?? index}
                                        id={`router-cookie-${cookie['.id'] ?? index}`}
                                        title={cookie.user}
                                        subtitle={cookie['mac-address']}
                                        fields={[
                                            {
                                                label: translations[language].categories.routers.macCookie,
                                                value: cookie['mac-cookie'],
                                            },
                                            {
                                                label: translations[language].categories.routers.expiresIn,
                                                value: cookie['expires-in'],
                                            },
                                        ]}
                                        actions={[
                                            {
                                                label: translations[language].categories.buttons.remove,
                                                icon: 'delete.outline',
                                                tone: 'danger',
                                                onPress: () => {
                                                    setActiveCookie(cookie['.id']);
                                                    toggleShowPrompt(true);
                                                },
                                            },
                                        ]}
                                    />
                                ))}
                            </RecordList>
                            <ThemedView
                                style={{ width: '100%', marginTop: 12, height: 50, flexDirection: 'row', gap: 10, display: (cookiesMeta?.total ?? 0 > 1) && (cookiesMeta?.last_page ?? 0 > 1) ? 'flex' : 'none' }}
                                lightColor={background}
                                darkColor={background}>
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.first}
                                    onPress={() => {
                                        if (cookiesMeta && cookiesMeta.current_page > 1) {
                                            fetchCookies({ page: 1 });
                                        }
                                    }}
                                    disabled={cookiesMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: cookiesMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.previous}
                                    onPress={() => {
                                        if (cookiesMeta && cookiesMeta.current_page > 1) {
                                            fetchCookies({ page: cookiesMeta.current_page > 1 ? cookiesMeta.current_page - 1 : 1 });
                                        }
                                    }}
                                    disabled={cookiesMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: cookiesMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.next}
                                    onPress={() => {
                                        if (cookiesMeta && cookiesMeta.current_page < cookiesMeta.last_page) {
                                            fetchCookies({ page: cookiesMeta.current_page + 1 });
                                        }
                                    }}
                                    disabled={cookiesMeta?.current_page === cookiesMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: cookiesMeta?.current_page === cookiesMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.last}
                                    onPress={() => {
                                        if (cookiesMeta && cookiesMeta.current_page < cookiesMeta.last_page) {
                                            fetchCookies({ page: cookiesMeta.last_page });
                                        }
                                    }}
                                    disabled={cookiesMeta?.current_page === cookiesMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: cookiesMeta?.current_page === cookiesMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>
                    <ThemedView
                        style={{ display: activeTab === 'hosts' ? 'flex' : 'none', flex: 1, justifyContent: 'center', alignSelf: 'stretch', alignItems: 'flex-start' }}
                        lightColor={background}
                        darkColor={background}
                    >
                        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }} lightColor={background} darkColor={background}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: titleText, marginVertical: 10 }}>{translations[language].categories.routers.hosts}</ThemedText>
                        </ThemedView>
                        <ThemedView style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', flexDirection: "column" }} lightColor={background} darkColor={background}>
                            <RecordList
                                id='router-hosts'
                                isEmpty={hosts.length === 0}
                                emptyMessage={translations[language].categories.routers.noHosts}
                            >
                                {hosts.map((host, index) => (
                                    <RecordCard
                                        key={`${host['mac-address']}-${index}`}
                                        id={`router-host-${index}`}
                                        title={host['mac-address']}
                                        subtitle={host.address}
                                        fields={[
                                            {
                                                label: translations[language].categories.routers.toAddress,
                                                value: host['to-address'],
                                            },
                                            {
                                                label: translations[language].categories.routers.server,
                                                value: host.server,
                                            },
                                            {
                                                label: translations[language].categories.routers.uptime,
                                                value: host.uptime,
                                            },
                                        ]}
                                    />
                                ))}
                            </RecordList>
                            <ThemedView
                                style={{ width: '100%', marginTop: 12, height: 50, flexDirection: 'row', gap: 10, display: (hostsMeta?.total ?? 0 > 1) && (hostsMeta?.last_page ?? 0 > 1) ? 'flex' : 'none' }}
                                lightColor={background}
                                darkColor={background}>
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.first}
                                    onPress={() => {
                                        if (hostsMeta && hostsMeta.current_page > 1) {
                                            fetchHosts({ page: 1 });
                                        }
                                    }}
                                    disabled={hostsMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: hostsMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.previous}
                                    onPress={() => {
                                        if (hostsMeta && hostsMeta.current_page > 1) {
                                            fetchHosts({ page: hostsMeta.current_page > 1 ? hostsMeta.current_page - 1 : 1 });
                                        }
                                    }}
                                    disabled={hostsMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: hostsMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.next}
                                    onPress={() => {
                                        if (hostsMeta && hostsMeta.current_page < hostsMeta.last_page) {
                                            fetchHosts({ page: hostsMeta.current_page + 1 });
                                        }
                                    }}
                                    disabled={hostsMeta?.current_page === hostsMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: hostsMeta?.current_page === hostsMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.last}
                                    onPress={() => {
                                        if (hostsMeta && hostsMeta.current_page < hostsMeta.last_page) {
                                            fetchHosts({ page: hostsMeta.last_page });
                                        }
                                    }}
                                    disabled={hostsMeta?.current_page === hostsMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: hostsMeta?.current_page === hostsMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>
                    <ThemedView
                        style={{ display: activeTab === 'dhcp_leases' ? 'flex' : 'none', flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start' }}
                        lightColor={background}
                        darkColor={background}
                    >
                        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }} lightColor={background} darkColor={background}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: titleText, marginVertical: 10 }}>{translations[language].categories.routers.activeSessions}</ThemedText>
                        </ThemedView>
                        <ThemedView style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', flexDirection: "column" }} lightColor={background} darkColor={background}>
                            <RecordList
                                id='router-dhcp-leases'
                                isEmpty={DHCPLeases.length === 0}
                                emptyMessage={translations[language].categories.routers.noDhcpLeases}
                            >
                                {DHCPLeases.map((lease, index) => (
                                    <RecordCard
                                        key={`${lease.address}-${index}`}
                                        id={`router-dhcp-lease-${index}`}
                                        title={lease.address}
                                        subtitle={lease['mac-address']}
                                        fields={[
                                            {
                                                label: translations[language].categories.routers.server,
                                                value: lease.server,
                                            },
                                            {
                                                label: translations[language].categories.routers.hostName,
                                                value: lease['host-name'] || '-',
                                            },
                                            {
                                                label: translations[language].categories.routers.expiresAfter,
                                                value: lease['expires-after'],
                                            },
                                        ]}
                                    />
                                ))}
                            </RecordList>
                            <ThemedView
                                style={{ width: '100%', marginTop: 12, height: 50, flexDirection: 'row', gap: 10, display: (DHCPLeasesMeta?.total ?? 0 > 1) && (DHCPLeasesMeta?.last_page ?? 0 > 1) ? 'flex' : 'none' }}
                                lightColor={background}
                                darkColor={background}
                            >
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.first}
                                    onPress={() => {
                                        if (DHCPLeasesMeta && DHCPLeasesMeta.current_page > 1) {
                                            fetchDHCPLeases({ page: 1 });
                                        }
                                    }}
                                    disabled={DHCPLeasesMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: DHCPLeasesMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.previous}
                                    onPress={() => {
                                        if (DHCPLeasesMeta && DHCPLeasesMeta.current_page > 1) {
                                            fetchDHCPLeases({ page: DHCPLeasesMeta.current_page > 1 ? DHCPLeasesMeta.current_page - 1 : 1 });
                                        }
                                    }}
                                    disabled={DHCPLeasesMeta?.current_page === 1}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: DHCPLeasesMeta?.current_page === 1 ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.next}
                                    onPress={() => {
                                        if (DHCPLeasesMeta && DHCPLeasesMeta.current_page < DHCPLeasesMeta.last_page) {
                                            fetchDHCPLeases({ page: DHCPLeasesMeta.current_page + 1 });
                                        }
                                    }
                                    }
                                    disabled={DHCPLeasesMeta?.current_page === DHCPLeasesMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: DHCPLeasesMeta?.current_page === DHCPLeasesMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                                <ThemedButton
                                    style={{ flex: 1 }}
                                    title={translations[language].categories.buttons.last}
                                    onPress={() => {
                                        if (DHCPLeasesMeta && DHCPLeasesMeta.current_page < DHCPLeasesMeta.last_page) {
                                            fetchDHCPLeases({ page: DHCPLeasesMeta.last_page });
                                        }
                                    }}
                                    disabled={DHCPLeasesMeta?.current_page === DHCPLeasesMeta?.last_page}
                                    darkColor={background}
                                    lightColor={background}
                                    textStyle={{ color: DHCPLeasesMeta?.current_page === DHCPLeasesMeta?.last_page ? tabText : bim, fontSize: 14 }}
                                />
                            </ThemedView>
                        </ThemedView>
                    </ThemedView>
                    <ThemedView
                        style={{ display: activeTab === 'traffic' ? 'flex' : 'none', flex: 1, alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'stretch', paddingVertical: 10 }}
                        lightColor={background}
                        darkColor={background}
                    >
                        <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: titleText, marginVertical: 10 }}>
                            {translations[language].categories.routers.traffic}
                        </ThemedText>
                        <ThemedText style={{ color: tabText, marginBottom: 8 }}>
                            {translations[language].categories.routers.trafficInterface || 'Interface'}
                        </ThemedText>
                        {trafficInterfacesLoading ? (
                            <ActivityIndicator color={bim} />
                        ) : trafficInterfaceError ? (
                            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} lightColor={background} darkColor={background}>
                                <ThemedText style={{ color: red, flex: 1 }}>{trafficInterfaceError}</ThemedText>
                                <ThemedButton
                                    title={translations[language].categories.routers.trafficRetry || 'Retry'}
                                    icon='refresh'
                                    onPress={handleOpenTrafficTab}
                                    lightColor={background}
                                    darkColor={background}
                                    lightTextColor={bim}
                                    darkTextColor={bim}
                                />
                            </ThemedView>
                        ) : trafficInterfaces.length ? (
                            <ThemedDropdown
                                id="traffic-interface"
                                containerRef={trafficInterfaceDropdownRef}
                                value={selectedTrafficInterface}
                                setValue={setSelectedTrafficInterface}
                                options={trafficInterfaces}
                                placeholder={translations[language].categories.routers.trafficChooseInterface || 'Choose an interface'}
                                showDropdown={showTrafficInterfaceDropdown}
                                setShowDropdown={setShowTrafficInterfaceDropdown}
                                lightColor={background}
                                darkColor={background}
                                style={{ width: '100%', zIndex: showTrafficInterfaceDropdown ? 2 : 0 }}
                                dropDownStyle={{ width: '100%' }}
                                isAnimatable={false}
                                showCheckbox={false}
                            />
                        ) : (
                            <ThemedText style={{ color: tabText }}>
                                {translations[language].categories.routers.trafficChooseInterface || 'Choose an interface to monitor.'}
                            </ThemedText>
                        )}
                        {!!selectedTrafficInterface && (
                            <>
                                <ThemedText style={{ color: trafficStatus === 'error' ? red : bim, marginTop: 12 }}>
                                    {trafficStatus === 'connected'
                                        ? translations[language].categories.routers.trafficConnected || 'Live'
                                        : trafficStatus === 'error'
                                            ? trafficError
                                            : translations[language].categories.routers.trafficLoading || 'Connecting to traffic stream...'}
                                </ThemedText>
                                {trafficSamples.length > 0 && (
                                    <ThemedView style={{ flexDirection: 'row', gap: 20, marginTop: 8 }} lightColor={background} darkColor={background}>
                                        <ThemedText style={{ color: tabText }}>
                                            {translations[language].categories.routers.trafficReceived || 'Received'}: {formatTrafficRate(trafficSamples[trafficSamples.length - 1].rx)}
                                        </ThemedText>
                                        <ThemedText style={{ color: tabText }}>
                                            {translations[language].categories.routers.trafficSent || 'Sent'}: {formatTrafficRate(trafficSamples[trafficSamples.length - 1].tx)}
                                        </ThemedText>
                                    </ThemedView>
                                )}
                                {trafficSamples.length < 2 ? (
                                    <ThemedText style={{ color: tabText, marginTop: 10 }}>
                                        {translations[language].categories.routers.trafficNoSamples || 'Waiting for traffic samples...'}
                                    </ThemedText>
                                ) : (
                                    <>
                                        <ThemedText style={{ color: tabText, marginTop: 8 }}>
                                            Rate (Mbps)
                                        </ThemedText>
                                        <LineChart
                                            data={{
                                                labels: trafficSamples.map((sample, index) => {
                                                    const labelEvery = Math.ceil(trafficSamples.length / 4);
                                                    return index % labelEvery === 0 || index === trafficSamples.length - 1
                                                        ? new Date(sample.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                                                        : '';
                                                }),
                                                datasets: [
                                                    {
                                                        data: trafficSamples.map((sample) => sample.rx / 1_000_000),
                                                        color: (opacity = 1) => `rgba(238, 132, 56, ${opacity})`,
                                                        strokeWidth: 2,
                                                    },
                                                    {
                                                        data: trafficSamples.map((sample) => sample.tx / 1_000_000),
                                                        color: (opacity = 1) => `rgba(41, 197, 249, ${opacity})`,
                                                        strokeWidth: 2,
                                                    },
                                                ],
                                                legend: [
                                                    translations[language].categories.routers.trafficReceived || 'Received',
                                                    translations[language].categories.routers.trafficSent || 'Sent',
                                                ],
                                            }}
                                            width={Math.max(250, Dimensions.get('window').width - 100)}
                                            height={240}
                                            yAxisSuffix="M"
                                            yAxisLabel=""
                                            yLabelsOffset={4}
                                            segments={4}
                                            fromZero
                                            bezier
                                            withDots={false}
                                            chartConfig={{
                                                backgroundGradientFrom: background,
                                                backgroundGradientTo: background,
                                                decimalPlaces: 1,
                                                propsForLabels: { fontSize: 10 },
                                                color: (opacity = 1) => `rgba(99, 101, 120, ${opacity})`,
                                                labelColor: (opacity = 1) => `rgba(99, 101, 120, ${opacity})`,
                                            }}
                                            style={{ marginTop: 6, borderRadius: 8 }}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </ThemedView>
                </TileContainer>
            </ParallaxScrollView>
            <Prompt
                id='delete-cookie-prompt'
                fadeAnim={promptFadeAnim}
                onClose={() => toggleShowPrompt(false)}
                visible={showPrompt}
                title={translations[language].categories.dashboard.confirmDeleteTitle}
                message={translations[language].categories.routers.deleteCookieConfirm}
                buttons={[
                    {
                        title: translations[language].categories.buttons.cancel,
                        color: promptCancelButton,
                        textColor: white,
                        action: () => toggleShowPrompt(false),
                    },
                    {
                        title: translations[language].categories.buttons.delete,
                        color: dangerButton,
                        textColor: white,
                        action: handleRemoveCookie,
                    },
                ]}
            />
        </>
    )
}
