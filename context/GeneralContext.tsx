import Toast from '@/components/Toast';
// apiBaseUrl removed — use service layer for endpoints
import translations from '@/constants/Trans';
import { delay, normalizePhoneForApi, ShowAlert } from '@/helpers';
import { parseApiError, parseApiErrorDetails, registerAuthCallbacks } from '@/helpers/api';
import { getApiData } from '@/helpers/apiResponse';
import * as AuthService from '@/services/AuthService';
import { fetchDashboard, fetchUser } from '@/services/UserService';
import * as InboxService from '@/services/InboxService';
import * as PushService from '@/services/PushService';
import {
	AuthSession,
	DashboardSummary,
	GetDashboardResponse,
	GetMeResponse,
	headerOptions,
	InboxNotification,
	langCode,
	LoginResponse,
	notifications,
	RefreshTokenResponse,
	RegisterResponse,
	TOTPRequiredData,
	TotpSetupData,
	TwoFASetupResponse,
	TwoFAVerifyResponse,
	User as UserProps,
	VerifyOtpResponse,
	VerifyTokenResponse
} from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import * as DeviceInfo from 'expo-device';
import { usePathname, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { Keyboard, Platform } from 'react-native';

import { env } from '@/helpers/env';
const DEV_OTP = env('DEV_OTP');

type RouterType = ReturnType<typeof useRouter>;

export interface GeneralContextType {
	user: UserProps | null;
	setUser: React.Dispatch<React.SetStateAction<UserProps | null>>;
	authToken?: string | null;
	setAuthToken?: React.Dispatch<React.SetStateAction<string | null>>;
	language: langCode;
	setLanguage: (l: langCode) => void;
	handleLogout: () => Promise<void>;
	fetchNotifications: () => Promise<void>;
	notifications: notifications[];
	/** Unread rows from the inbox, kept in sync with the header badge. */
	unreadNotificationCount: number;
	markNotificationRead: (id: string) => Promise<void>;
	markAllNotificationsRead: () => Promise<void>;
	isAnimatable: boolean;
	isHighEndDevice: boolean;
	keyboardVisible: boolean;
	setNotifications: React.Dispatch<React.SetStateAction<notifications[]>>;
	selectedOption: headerOptions | undefined;
	setSelectedOption: React.Dispatch<
		React.SetStateAction<headerOptions | undefined>
	>;
	history: string[];
	handleUpdateHistory: (current: string) => void;
	handleGoBack: () => void;
	handleAuthentication: (credentials: {
		number: string;
		password?: string;
	}) => Promise<void>;
	handleFetchUserProfile: () => void;
	handleRegistration: (payload: {
		phone: string;
		password: string;
		name?: string;
		email?: string;
	}) => Promise<void>;
	// Verify OTP for a pending phone/registration. Accepts the OTP the user entered.
	handleVerify: (otp: string) => Promise<void>;
	// Verify 2FA code (authenticator app) for pending 2FA setup. Returns true on success.
	handleVerify2FA: (otp: string) => Promise<boolean>;
	// Complete TOTP setup by sending backend the setup_token, secret and otp
	handleSetupTotp: (params?: {
		setup_token?: string;
		secret?: string;
		otp?: string;
	}) => Promise<any>;
	// Pending registration payload kept until OTP verification completes
	pendingRegistration?: {
		phone: string;
		password: string;
		fullName?: string;
		email?: string;
	} | null;
	// Pending 2FA setup info returned by the backend after verification when TOTP setup is required
	pending2FASetup?: {
		qr?: string | null;
		qr_base64?: string | null;
		secret?: string | null;
		setup_token?: string | null;
		phone?: string | null;
		user?: any;
	} | null;
	// Phone number used for pending 2FA verification after initiating login/register
	pendingPhone?: string | null;
	setPendingPhone?: React.Dispatch<React.SetStateAction<string | null>>;

	// Which 2FA method is expected for the current pending verification
	// 'sms' = SMS OTP, 'totp' = authenticator app code
	pending2FAMethod?: 'sms' | 'totp' | null;
	setPending2FAMethod?: React.Dispatch<
		React.SetStateAction<'sms' | 'totp' | null>
	>;

	setPendingRegistration?: React.Dispatch<
		React.SetStateAction<{
			phone: string;
			password: string;
			fullName?: string;
			email?: string;
		} | null>
	>;
	setPending2FASetup?: React.Dispatch<
		React.SetStateAction<{
			qr?: string | null;
			qr_base64?: string | null;
			secret?: string | null;
			setup_token?: string | null;
			phone?: string | null;
			user?: any;
		} | null>
	>;
	online: boolean;
	routersLastFetched: { [routerId: string]: string };
	setRoutersLastFetched?: React.Dispatch<
		React.SetStateAction<{ [routerId: string]: string }>
	>;
	router: RouterType;
	// Global app message (shown in Toast)
	appMessage?: {
		type: 'error' | 'message';
		message: string | null;
		actionLabel?: string | null;
		action?: (() => Promise<void>) | (() => void);
	} | null;
	setAppMessage: React.Dispatch<
		React.SetStateAction<{
			type: 'error' | 'message';
			message: string | null;
			actionLabel?: string | null;
			action?: (() => Promise<void>) | (() => void);
		} | null>
	>;

	retryRefresh?: () => Promise<boolean>;
	refreshDashboard?: (force?: boolean) => Promise<boolean>;
	dashboardLoading: boolean;
	lastDashboardUpdated?: number | null;
	verifyingAuth?: boolean;
	// Epoch ms until which login/2FA attempts are throttled by the backend.
	loginRetryAt?: number | null;
}

const GeneralContext = createContext<GeneralContextType | undefined>(undefined);

const HISTORY_KEY = 'BIM_history_v1';
const MAX_HISTORY = 5;

// AsyncStorage calls are fire-and-forget here: storage failures must never break
// navigation, and some environments only expose partially mocked storage.
const writeHistoryStorage = (value: string) => {
	try {
		const pending = AsyncStorage.setItem(HISTORY_KEY, value) as unknown as
			| Promise<void>
			| undefined;
		pending?.catch?.(() => { });
	} catch { }
};

const clearHistoryStorage = () => {
	try {
		const pending = AsyncStorage.removeItem(HISTORY_KEY) as unknown as
			| Promise<void>
			| undefined;
		pending?.catch?.(() => { });
	} catch { }
};

// Cross-platform runtime global for React Native (no browser `window` fallback)
// Use `globalThis` when available, otherwise `global` (Node-like runtimes).
const runtime: any =
	typeof globalThis !== 'undefined'
		? globalThis
		: typeof global !== 'undefined'
			? global
			: {};

export const GeneralProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const router = useRouter();
	const pathName = usePathname();
	// Latest path kept in a ref so the auth-verification effect can read it
	// without re-running (and re-showing the global loader) on every navigation.
	const pathNameRef = React.useRef(pathName);
	useEffect(() => {
		pathNameRef.current = pathName;
	}, [pathName]);
	const netInfo = useNetInfo();
	const totalMemory = (DeviceInfo as any)?.totalMemory;

	// Used to suppress history updates while we are programmatically navigating back
	const navigatingBackRef = React.useRef(false);
	const isLoggingOutRef = React.useRef(false);

	const [user, setUser] = useState<UserProps | null>(null);

	// Keep an in-memory copy of the auth token for fast checks and guards
	const [authToken, setAuthToken] = useState<string | null>(null);
	// Ref always in sync with latest authToken so attemptRefresh never captures a stale value
	const authTokenRef = React.useRef<string | null>(null);
	React.useEffect(() => {
		authTokenRef.current = authToken;
	}, [authToken]);
	const [notifications, setNotifications] = useState<notifications[]>([]);
	const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
	const notificationsRef = React.useRef<notifications[]>([]);
	React.useEffect(() => {
		notificationsRef.current = notifications;
	}, [notifications]);
	const [pendingPhone, setPendingPhone] = useState<string | null>(null);
	// Which 2FA method is expected for the current pending verification
	// 'sms' = SMS OTP, 'totp' = authenticator app code
	const [pending2FAMethod, setPending2FAMethod] = useState<
		'sms' | 'totp' | null
	>(null);
	// Pending registration payload kept until OTP verification completes
	const [pendingRegistration, setPendingRegistration] = useState<{
		phone: string;
		password: string;
		fullName?: string;
		email?: string;
	} | null>(null);
	// pending 2FA setup information returned by backend after verify when TOTP setup required
	const [pending2FASetup, setPending2FASetup] = useState<{
		qr?: string | null;
		qr_base64?: string | null;
		secret?: string | null;
		setup_token?: string | null;
		phone?: string | null;
		user?: any;
	} | null>(null);
	// global message state shown as toast/modal; can include an optional action
	const [appMessage, setAppMessage] = useState<{
		type: 'error' | 'message';
		message: string | null;
		actionLabel?: string | null;
		action?: (() => Promise<void>) | (() => void);
	} | null>(null);
	const [language, setLanguage] = useState<langCode>('en');
	// Local typed alias for current language translations to avoid TS indexing errors
	// Memoize so it's stable for hook dependency arrays.
	const tr = useMemo(
		() => (translations as any)[language] ?? translations.en,
		[language]
	);
	const [online, setOnline] = useState<boolean>(true);
	const [routersLastFetched, setRoutersLastFetched] = useState<{ [routerId: string]: string }>({});
	const [selectedOption, setSelectedOption] = useState<
		headerOptions | undefined
	>(undefined);
	const [mounted, setMounted] = useState<boolean>(false);
	// Keep loader visible until we've checked SecureStore for an existing token
	const [verifyingAuth, setVerifyingAuth] = useState<boolean>(true);
	// Epoch ms until which the backend throttles further login/2FA attempts.
	const [loginRetryAt, setLoginRetryAt] = useState<number | null>(null);
	// Timestamp (ms since epoch) when the dashboard was last updated from server
	const [lastDashboardUpdated, setLastDashboardUpdated] = useState<
		number | null
	>(null);
	const [dashboardLoading, setDashboardLoading] = useState(false);
	// Flag to indicate we've finished the initial token load from SecureStore
	const [initialTokenChecked, setInitialTokenChecked] =
		useState<boolean>(false);
	const [isAnimatable, setIsAnimatable] = useState<boolean>(false);
	const [isHighEndDevice, setIsHighEndDevice] = useState<boolean>(false);
	const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);

	const [history, setHistory] = useState<string[]>([]);

	// Determine whether to enable detailed auth lifecycle debug. Sources:
	// - build-time env: `process.env.BIM_AUTH_DEBUG` === 'true'
	// Optional TTL (minutes) can be provided via `process.env.BIM_AUTH_DEBUG_TTL_MIN`
	// is deterministic across the session.
	const _envDebug =
		typeof process !== 'undefined' && process.env?.BIM_AUTH_DEBUG === 'true';
	const _envTtlMin =
		typeof process !== 'undefined' && process.env?.BIM_AUTH_DEBUG_TTL_MIN
			? Number(process.env.BIM_AUTH_DEBUG_TTL_MIN)
			: 0;
	const _winDebug = Boolean(runtime && runtime.__BIM_AUTH_DEBUG__);
	const _winTtlMin = runtime
		? Number(runtime.__BIM_AUTH_DEBUG_TTL_MIN__ ?? 0)
		: 0;

	if (runtime && (_envDebug || _winDebug)) {
		// record when debugging was first enabled in this session so TTL is stable
		if (!runtime.__BIM_AUTH_DEBUG_ENABLED_AT__) {
			runtime.__BIM_AUTH_DEBUG_ENABLED_AT__ = Date.now();
		}
	}

	const _enabledAt = runtime ? runtime.__BIM_AUTH_DEBUG_ENABLED_AT__ : 0;
	const _ttlMin = _winTtlMin || _envTtlMin || 0;
	const _ttlMs = _ttlMin > 0 ? _ttlMin * 60 * 1000 : 0;

	const authDebug = Boolean(
		(_envDebug || _winDebug) &&
		(!_ttlMs || Date.now() - (_enabledAt || 0) < _ttlMs)
	);

	// View history is session scoped: never restore entries persisted by an older
	// run, they can point at screens (and detail ids) that no longer exist.
	useEffect(() => {
		clearHistoryStorage();
	}, []);

	// Keep an up-to-date ref of history so we can read it synchronously
	// without causing re-renders or relying on setState updaters.
	const historyRef = React.useRef<string[]>(history);
	useEffect(() => {
		historyRef.current = history;
	}, [history]);

	// Start each authenticated session with a clean history so back navigation can
	// never lead into auth screens or routes from a previous session.
	const wasAuthenticatedRef = React.useRef(false);
	useEffect(() => {
		const isAuthenticated = Boolean(authToken);
		if (isAuthenticated && !wasAuthenticatedRef.current) {
			setHistory([]);
			writeHistoryStorage('[]');
		}
		wasAuthenticatedRef.current = isAuthenticated;
	}, [authToken]);

	useEffect(() => {
		const show = Keyboard.addListener('keyboardDidShow', () =>
			setKeyboardVisible(true)
		);
		const hide = Keyboard.addListener('keyboardDidHide', () =>
			setKeyboardVisible(false)
		);
		delay(200).then(() => setMounted(true));
		return () => {
			show.remove();
			hide.remove();
		};
	}, []);

	// Logout handler: revoke token (if present), clear storage and app state,
	// then redirect to the login screen.
	// Logout handler: revoke token (if present), clear storage and app state,
	// then redirect to the login screen.
	const handleLogout = React.useCallback(async () => {
		// Prevent multiple simultaneous logout calls
		if (isLoggingOutRef.current) {
			console.log('Logout already in progress, ignoring duplicate call');
			return;
		}

		isLoggingOutRef.current = true;
		authTokenRef.current = null;
		setAuthToken(null);

		try {
			// 1. Attempt backend logout (best effort)
			try {
				const token = await SecureStore.getItemAsync('auth_token');
				if (token) {
					// We don't await the result or check success/failure for UI purposes
					// The user wants to be logged out regardless of server status.
					await AuthService.logout(String(token)).catch(() => { });
					// Stop pushes for this install before the token is dropped; the
					// token identifies the install and would otherwise keep receiving
					// the next user's notifications.
					await PushService.unregisterPushDevice(String(token)).catch(() => { });
				}
			} catch {
				// Ignore token lookup errors
			}

			// 2. Perform local cleanup (Critical)
			let localCleanupSuccess = true;
			try {
				// Clear credentials
				await SecureStore.deleteItemAsync('auth_token');
				await SecureStore.deleteItemAsync('totp_secret');

				// Clear user data
				await AsyncStorage.removeItem('user_id');
				await AsyncStorage.removeItem('user_email');
				await AsyncStorage.removeItem('user_phone');

				// Reset state
				setUser(null);
				setNotifications([]);
				setUnreadNotificationCount(0);
				// Drop the view history so the next session starts clean
				setHistory([]);
				writeHistoryStorage('[]');
				setPendingRegistration?.(null);
				setPending2FASetup?.(null);
				setPendingPhone?.(null);
				setPending2FAMethod?.(null);
			} catch (e) {
				console.error('logout: local cleanup failed', e);
				localCleanupSuccess = false;
			}

			// 3. UI Feedback & Navigation
			if (localCleanupSuccess) {
				setAppMessage?.({
					type: 'message',
					message: tr.categories.auth['logoutSuccess'] || 'Logged out',
				});
				router.replace('/(auth)/login');
			} else {
				setAppMessage?.({
					type: 'error',
					message: 'Failed to clear local session. Please try again.',
				});
			}
		} finally {
			isLoggingOutRef.current = false;
		}
	}, [tr, router]);

	// Attempt a single token refresh on demand. Returns the new token on success, or null.
	// Uses a ref for authToken to avoid stale closures — after a successful refresh,
	// in-flight requests that still hold the old token would fail if they attempted
	// to refresh an already-rotated token.
	const attemptRefresh = React.useCallback(async (): Promise<string | null> => {
		const currentToken = authTokenRef.current;
		if (!currentToken) return null;
		try {
			const tokenVal = String(currentToken);
			if (authDebug)
				console.debug(
					'attemptRefresh: calling refresh endpoint, token prefix=',
					tokenVal?.slice?.(0, 8)
				);
			const refreshRes = await AuthService.refreshToken(tokenVal);
			if (authDebug)
				console.debug(
					'attemptRefresh: refresh response',
					refreshRes && refreshRes.status,
					'ok=',
					refreshRes && refreshRes.ok
				);
			if (!refreshRes || !refreshRes.ok) return null;
			const refBody: RefreshTokenResponse = await refreshRes.json();
			// API 2.0 wraps the session payload in `data`.
			const refJson: AuthSession | null = getApiData<AuthSession>(refBody);
			if (refJson && refJson.token) {
				const newToken = refJson.token;
				try {
					await SecureStore.setItemAsync(
						'auth_token',
						newToken
					);
				} catch { }
				setAuthToken(newToken);

				if (refJson.user) {
					setUser(prev => ({ ...prev ?? {}, ...refJson.user, platform: refJson.platform, account: refJson.active_account }));
				}
				return newToken;
			}
			return null;
		} catch (e) {
			if (authDebug) console.error('attemptRefresh: error', e);
			return null;
		}
	}, [authDebug]);

	// Register API interceptor callbacks
	useEffect(() => {
		registerAuthCallbacks({
			onRefreshToken: attemptRefresh,
			onLogout: handleLogout,
		});
	}, [attemptRefresh, handleLogout]);

	// When an auth token is present in memory, verify it with the backend. If
	// the token is invalid, perform a logout to clear local state. If the
	// verify response includes an expiry timestamp, schedule an automatic
	// logout when the token expires.
	useEffect(() => {
		let expiryTimer: ReturnType<typeof setTimeout> | null = null;
		let canceled = false;
		const verifyAndSchedule = async () => {
			if (!initialTokenChecked) {
				if (authDebug)
					console.debug('verifyAndSchedule: waiting for initial token load');
				return;
			}
			if (authDebug)
				console.debug('verifyAndSchedule: starting; authToken=', authToken);
			// No setVerifyingAuth(true) here: the blocking auth overlay is only for
			// the initial boot check (its initial state). Re-arming it on every
			// re-verification made the white overlay flash on top of the screen's
			// own loading indicator during navigation.
			try {
				if (!authToken) {
					if (expiryTimer) {
						clearTimeout(expiryTimer);
						expiryTimer = null;
					}
					return;
				}

				const res = await AuthService.verifyToken(authToken);
				if (authDebug)
					console.debug(
						'[GeneralContext] verifyAndSchedule: verify response',
						res && res.status,
						'ok=',
						res && res.ok
					);
				if (!res || !res.ok) {
					if (authDebug)
						console.debug(
							'[GeneralContext] verifyAndSchedule: verify failed, calling handleLogout'
						);
					await handleLogout();
					return;
				}

				const body: VerifyTokenResponse = await res.json();
				// API 2.0 wraps the identity payload in `data`.
				const json: AuthSession | null = getApiData<AuthSession>(body);
				if (authDebug) console.debug('[GeneralContext] verifyAndSchedule: verify json', json);
				if (!json) return;

				// Merge returned user object into state when present
				if (json.user) {
					setUser((prev) => ({ ...prev ?? {}, ...json.user, platform: json.platform, account: json.active_account }));
					const currentPath = pathNameRef.current;
					const anyRouter = router;
					if (
						!currentPath ||
						currentPath === '/' ||
						currentPath.startsWith('/(auth)')
					) {
						try {
							anyRouter.replace('/(authenticated)/home');
						} catch { console.log("[GeneralContext] Could not navigate") }
					}
				}

				//Support token expiry from token_meta.expires_at
				const expiresAt =
					json.token_meta?.expires_at
				if (expiresAt) {
					if (authDebug)
						console.debug('[GeneralContext] verifyAndSchedule: token expiresAt=', expiresAt);
					const expMs = Date.parse(String(expiresAt));
					if (!Number.isFinite(expMs)) return;
					const now = Date.now();
					const msUntilExpiry = expMs - now;
					if (authDebug)
						console.debug('[GeneralContext] verifyAndSchedule: msUntilExpiry=', msUntilExpiry);

					const REFRESH_BEFORE_MS = 30000; // try refresh 30s before expiry

					const scheduleRefresh = async (immediate = false) => {
						const doRefresh = async () => {
							const ok = await attemptRefresh();
							if (!ok) {
								setAppMessage({
									type: 'error',
									message:
										(tr && tr.categories?.auth?.sessionRefreshFailed) ||
										'Session refresh failed. Tap Retry to attempt refresh or log in again.',
									actionLabel: (tr && tr.categories?.buttons?.retry) || 'Retry',
									action: async () => {
										setAppMessage(null);
										const ok2 = await attemptRefresh();
										if (!ok2) {
											setAppMessage({
												type: 'error',
												message:
													(tr && tr.categories?.auth?.retryFailedPleaseLogin) ||
													'Retry failed — please log in again',
											});
										}
									},
								});
							}
						};

						if (immediate) {
							await doRefresh();
							return;
						}

						const msUntilRefresh = Math.max(
							0,
							msUntilExpiry - REFRESH_BEFORE_MS
						);
						if (authDebug)
							console.debug(
								'[GeneralContext] verifyAndSchedule: scheduling refresh in ms',
								msUntilRefresh
							);
						expiryTimer = setTimeout(async () => {
							if (canceled) return;
							try {
								if (authDebug)
									console.debug('[GeneralContext] verifyAndSchedule: scheduled refresh firing');
								await doRefresh();
							} catch (e) {
								console.error('[GeneralContext] scheduled token refresh failed', e);
							}
						}, msUntilRefresh);
					};

					if (msUntilExpiry <= 0) {
						if (authDebug)
							console.debug(
								'[GeneralContext] verifyAndSchedule: token already expired, attempting immediate refresh'
							);
						await scheduleRefresh(true);
						return;
					}

					await scheduleRefresh(false);
				}
			} catch (e) {
				console.error('[GeneralContext] token verification failed', e);
			} finally {
				setVerifyingAuth(false);
			}
		};

		verifyAndSchedule();

		return () => {
			canceled = true;
			if (expiryTimer) clearTimeout(expiryTimer);
		};
	}, [
		authToken,
		handleLogout,
		authDebug,
		attemptRefresh,
		tr,
		router,
		initialTokenChecked,
	]);

	// Load auth token from SecureStore on mount so guards can rely on it
	useEffect(() => {
		(async () => {
			try {
				const t = await SecureStore.getItemAsync('auth_token');
				if (t) {
					if (authDebug)
						console.debug(
							'[GeneralContext] loaded auth_token from SecureStore',
							t
						);
					setAuthToken(String(t));
				} else {
					if (authDebug)
						console.debug('[GeneralContext] no auth_token found in SecureStore');
				}
			} catch (e) {
				if (authDebug)
					console.debug('[GeneralContext] SecureStore.getItemAsync error', e);
			} finally {
				// Mark that initial token load has completed so verification can proceed
				setInitialTokenChecked(true);
			}
		})();
	}, [authDebug]);

	useEffect(() => {
		if (!totalMemory) return;
		const lIsHighEnd = totalMemory > 4 * 1024 * 1024 * 1024;
		setIsHighEndDevice(lIsHighEnd);
		setIsAnimatable(
			Platform.OS === 'ios' || (Platform.OS === 'android' && lIsHighEnd)
		);
	}, [totalMemory]);

	/**
	 * Load the caller's inbox. Also refreshes the header badge count from the
	 * server so unread rows outside the first page are still counted.
	 */
	const fetchNotifications = useCallback(async () => {
		try {
			const token =
				authToken || (await SecureStore.getItemAsync('auth_token'));
			if (!token) {
				setNotifications([]);
				setUnreadNotificationCount(0);
				return;
			}

			const response = await InboxService.fetchInbox(String(token), {
				perPage: 50,
			});
			if (!response.ok) return;

			const body = await response.json().catch(() => null);
			const data = getApiData<{
				notifications?: InboxNotification[];
				unread_count?: number;
			}>(body);
			if (!data || !Array.isArray(data.notifications)) return;
			const rows = data.notifications;

			const mapped: notifications[] = rows.map((row) => {
				const createdAt = row.created_at ? new Date(row.created_at) : new Date();
				return {
					id: row.id,
					from: row.subject?.type ?? '',
					to: '',
					type:
						row.type === 'alert' || row.type === 'reminder'
							? row.type
							: 'message',
					title: row.title,
					message: row.body,
					isRead: row.read,
					createdAt,
					updatedAt: createdAt,
					category: row.category,
					categoryLabel: row.category_label,
					link: row.link,
				};
			});

			setNotifications(mapped);
			setUnreadNotificationCount(
				typeof data?.unread_count === 'number'
					? data.unread_count
					: mapped.filter((row) => !row.isRead).length
			);
		} catch (error) {
			console.warn('[GeneralContext] fetchNotifications failed', error);
		}
	}, [authToken]);

	/**
	 * Cheap poll for the header badge. The full inbox is only fetched when the
	 * bell opens (or a push arrives), so the list stays fresh without downloading
	 * 50 rows every minute.
	 */
	const refreshNotificationCount = useCallback(async () => {
		try {
			const token =
				authToken || (await SecureStore.getItemAsync('auth_token'));
			if (!token) return;
			const response = await InboxService.fetchInboxUnreadCount(String(token));
			if (!response.ok) return;
			const body = await response.json().catch(() => null);
			const data = getApiData<{ count?: number }>(body);
			if (typeof data?.count === 'number') {
				setUnreadNotificationCount(data.count);
			}
		} catch (error) {
			console.warn(
				'[GeneralContext] refreshNotificationCount failed',
				error
			);
		}
	}, [authToken]);

	// Load on sign-in and when the token rotates, then poll the cheap unread
	// count so pushes delivered to another device still reach the badge.
	useEffect(() => {
		if (!mounted) return;
		if (!authToken) {
			setNotifications([]);
			setUnreadNotificationCount(0);
			return;
		}
		void fetchNotifications();
		const id = setInterval(() => {
			void refreshNotificationCount();
		}, 60 * 1000);
		return () => clearInterval(id);
	}, [mounted, authToken, fetchNotifications, refreshNotificationCount]);

	/** Mark one inbox row read; the API call is idempotent. */
	const markNotificationRead = useCallback(
		async (id: string) => {
			const token =
				authToken || (await SecureStore.getItemAsync('auth_token'));
			if (!token) return;
			if (notificationsRef.current.find((row) => row.id === id)?.isRead) {
				return;
			}
			try {
				const response = await InboxService.markInboxRead(id, String(token));
				if (!response.ok) return;
				setNotifications((prev) =>
					prev.map((row) => (row.id === id ? { ...row, isRead: true } : row))
				);
				setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
			} catch (error) {
				console.warn('[GeneralContext] markNotificationRead failed', error);
			}
		},
		[authToken]
	);

	/** Mark every inbox row read for this login. */
	const markAllNotificationsRead = useCallback(async () => {
		const token = authToken || (await SecureStore.getItemAsync('auth_token'));
		if (!token) return;
		try {
			const response = await InboxService.markAllInboxRead(String(token));
			if (!response.ok) return;
			setNotifications((prev) => prev.map((row) => ({ ...row, isRead: true })));
			setUnreadNotificationCount(0);
		} catch (error) {
			console.warn('[GeneralContext] markAllNotificationsRead failed', error);
		}
	}, [authToken]);

	useEffect(() => {
		const check = async () => {
			if (
				netInfo.isConnected === true &&
				netInfo.isInternetReachable !== false
			) {
				try {
					const res = await fetch('https://clients3.google.com/generate_204');
					setOnline(res.status === 204);
				} catch {
					setOnline(false);
				}
			} else setOnline(false);
		};
		mounted && check();
	}, [netInfo, mounted]);

	const normalizePath = (p: string) => {
		try {
			const stripped = p.split('?')[0].split('#')[0];
			const parts = stripped.split('/').filter(Boolean);
			return (
				'/' +
				parts
					.map((seg) =>
						/^\d+$/.test(seg) || /^[0-9a-fA-F-]{8,}$/.test(seg) ? ':id' : seg
					)
					.join('/')
			);
		} catch {
			return p;
		}
	};

	const persist = (arr: string[]) => {
		try {
			writeHistoryStorage(JSON.stringify(arr));
		} catch (e) {
			if (runtime?.__BIM_HISTORY_DEBUG__)
				console.debug('[GeneralContext] persist failed', e);
		}
	};

	const handleUpdateHistory = useCallback((current: string) => {
		const debug = runtime?.__BIM_HISTORY_DEBUG__;
		if (debug) console.debug('[GeneralContext] handleUpdateHistory called with', current);
		setHistory((prev) => {
			if (debug) console.debug('[GeneralContext] handleUpdateHistory prev', prev);
			// If a back navigation is in progress, ignore incidental updates
			if (navigatingBackRef.current) {
				if (debug)
					console.debug('[GeneralContext] handleUpdateHistory: skipping due to back nav');
				return prev;
			}
			try {
				const last = prev[prev.length - 1] || '';
				if (
					current === '/(authenticated)/routers' &&
					last.includes('/(authenticated)/routers/hotspots')
				)
					return prev;
			} catch { }

			// If the routers parent is being pushed AFTER a routers detail is already last,
			// reorder so the parent sits immediately before the current detail (keep detail last).
			try {
				const isRoutersParent = current === '/(authenticated)/routers';
				const last = prev[prev.length - 1] || '';
				const isRoutersDetail = /\/(authenticated)\/routers\/preview\//.test(
					last
				);
				if (isRoutersParent && isRoutersDetail) {
					// Remove any previous occurrences of the parent to avoid duplicates
					const withoutParent = prev.filter(
						(p) => normalizePath(p) !== normalizePath(current)
					);
					const lastEntry = withoutParent[withoutParent.length - 1];
					const base = withoutParent.slice(0, -1);
					const reordered = [...base, current, lastEntry].slice(
						Math.max(0, base.length + 2 - MAX_HISTORY)
					);
					if (debug)
						console.debug(
							'[GeneralContext] handleUpdateHistory: reorder parent before detail',
							reordered
						);
					persist(reordered);
					return reordered;
				}
			} catch { }

			if (prev.length > 0 && prev[prev.length - 1] === current) {
				if (debug)
					console.debug(
						'[GeneralContext] handleUpdateHistory: identical last entry, skipping',
						current
					);
				return prev;
			}

			if (
				prev.length > 0 &&
				normalizePath(prev[prev.length - 1]) === normalizePath(current)
			) {
				const updated = [...prev];
				updated[updated.length - 1] = current;
				if (debug)
					console.debug('[GeneralContext] handleUpdateHistory: replace-last with', updated);
				persist(updated);
				return updated;
			}

			const next = [...prev, current];
			if (next.length > MAX_HISTORY) {
				next.splice(0, next.length - MAX_HISTORY);
			}
			if (debug) console.debug('[GeneralContext] handleUpdateHistory: push next', next);
			persist(next);
			return next;
		});
	}, []);

	useEffect(() => {
		if (runtime) {
			// Expose a debug helper that reads persisted history and logs it.
			(runtime as any).__BIM_DUMP_HISTORY__ = async () => {
				try {
					const raw = await AsyncStorage.getItem(HISTORY_KEY);
					const parsed = raw ? JSON.parse(raw) : history;
					console.log('BIM_HISTORY_DUMP', parsed);
				} catch (e) {
					console.log('BIM_HISTORY_DUMP error', e);
				}
			};
			return () => {
				try {
					delete (runtime as any).__BIM_DUMP_HISTORY__;
				} catch { }
			};
		}
	}, [history]);

	const navigateToPath = useCallback(
		(path: string) => {
			// router may not be ready at provider mount time. Retry briefly
			// until router methods are available before giving up.
			const tryNavigate = (attempt = 0) => {
				const maxAttempts = 12; // ~1.2s
				const anyRouter = router as any;
				// NB: the authenticated area is a Drawer navigator, so every screen
				// (including nested router routes) is a drawer screen. A POP_TO
				// (`dismissTo`) action is not handled there and silently does nothing,
				// while REPLACE maps to JUMP_TO and works. Keep replace-first.
				if (anyRouter?.replace) {
					try {
						anyRouter.replace(path);
						return;
					} catch { }
				}
				if ((router as any)?.push) {
					try {
						(router.push as any)(path);
						return;
					} catch { }
				}
				if (attempt < maxAttempts) {
					setTimeout(() => tryNavigate(attempt + 1), 100);
				} else if (runtime && runtime.__BIM_HISTORY_DEBUG__)
					console.warn(
						'[GeneralContext] navigateToPath: router not ready, aborting navigation to',
						path
					);
			};
			tryNavigate();
		},
		[router]
	);

	const handleGoBack = useCallback(() => {
		navigatingBackRef.current = true;
		const prev = historyRef.current || [];
		let action: () => void = () => { };

		if (runtime?.__BIM_HISTORY_DEBUG__)
			console.debug('[GeneralContext] handleGoBack using history', prev);

		if (prev.length <= 1 || !prev[prev.length - 2]) {
			// No previous path recorded, use a fallback navigation
			let currentPath = '';
			try {
				currentPath = pathNameRef.current || '';
				if (!currentPath) {
					const anyRouter = router as any;
					currentPath =
						anyRouter?.pathname || anyRouter?.asPath || anyRouter?.route || '';
				}
			} catch { }
			if (currentPath && /\/routers\/hotspots\//.test(currentPath)) {
				action = () => navigateToPath('/(authenticated)/packages');
			} else {
				action = () => router.back?.();
			}
		} else {
			// Pop current and navigate to the immediate previous entry
			const targetPath = prev[prev.length - 2];
			const newHistory = prev.slice(0, -1);
			// Keep the ref in sync immediately so rapid consecutive back presses
			// don't read a stale stack and pop twice.
			historyRef.current = newHistory;
			setHistory(newHistory);
			persist(newHistory);
			action = () => {
				try {
					navigateToPath(targetPath);
				} catch {
					if (router.back) {
						try {
							router.back();
						} catch {
							(router.replace as unknown as (p: string) => void)(targetPath);
						}
					} else {
						(router.replace as unknown as (p: string) => void)(targetPath);
					}
				}
			};
		}

		// Perform navigation after state has been updated, outside of render/state updater
		setTimeout(() => {
			try {
				action();
			} finally {
				navigatingBackRef.current = false;
			}
		}, 0);
	}, [router, navigateToPath]);

	// Record the server's auth cooldown so the login and 2FA screens can show a
	// live countdown and disable their submit buttons. The API reports the wait
	// as `Retry-After` / `data.retry_after` / `data.retry_at` (parseApiErrorDetails
	// also falls back to the message for older deployments); a 429 without a
	// usable wait locks the UI briefly so repeated taps do not extend the lockout.
	const applyAuthCooldown = (status: number, retryAfterSeconds: number) => {
		if (retryAfterSeconds > 0) {
			setLoginRetryAt(Date.now() + retryAfterSeconds * 1000);
		} else if (status === 429) {
			setLoginRetryAt(Date.now() + 60_000);
		}
	};

	const handleAuthentication = async ({
		number,
		password,
	}: {
		number: string;
		password?: string;
	}) => {
		// Initiate login which (per backend) sends a 2FA OTP to the provided phone
		try {
			const normalizedNumber = normalizePhoneForApi(number);
			const res = await AuthService.login(normalizedNumber, password ?? '');
			if (!res.ok) {
				const { message: text, retryAfterSeconds } =
					await parseApiErrorDetails(res);
				applyAuthCooldown(res.status, retryAfterSeconds);
				setAppMessage({
					type: 'error',
					message:
						String(text) && String(text).trim()
							? String(text)
							: tr.categories.auth['loginFailed'] || 'Login failed',
				});
				return;
			}
			const loginBody: LoginResponse = await res.json();
			console.log("[GeneralContext] Authentication response", { loginBody });
			// API 2.0 wraps the challenge payload in `data`; the envelope carries `message`.
			const data = getApiData<TOTPRequiredData | TotpSetupData>(loginBody);
			const envelopeMessage = loginBody?.message;

			// Determine which 2FA method the backend expects when redirecting to verify
			try {
				const msg = String(envelopeMessage || '').toLowerCase();
				if (msg.includes('totp setup required')) {
					const setup = data as TotpSetupData | null;
					if (setup && (setup.qr || setup.setup_token || setup.qr_base64)) {
						setPending2FASetup({
							qr: setup.qr ?? null,
							qr_base64: setup.qr_base64 ?? null,
							secret: setup.secret ?? null,
							setup_token: setup.setup_token ?? null,
							phone: normalizePhoneForApi(setup.phone ?? number),
							user: setup.user ?? null,
						});
						// navigate to the authenticator setup screen
						return navigateToPath('/(auth)/setup-2fa');
					}
				} else {
					setPending2FAMethod('totp');
				}
			} catch (e) {
				console.error('[GeneralContext] Error determining 2FA method:', e);
				setPending2FAMethod(null);
			}
			// Store the pending phone so the verify screen can reference it if need
			setPendingPhone(data?.phone || number);
			// Navigate to verify screen for OTP entry
			router.replace('/(auth)/verify');
		} catch (error) {
			// Surface unexpected/network errors via the global app message instead of throwing
			const msg = (error && (error as any).message) || '';
			setAppMessage({
				type: 'error',
				message:
					String(msg) && String(msg).trim()
						? String(msg)
						: tr.categories.auth['loginFailed'] || 'Login failed',
			});
		}
	};

	// Shared helper that actually performs the dashboard fetch and merges
	// the result into `user.dashboard`. Returns true on success.
	const refreshDashboard = React.useCallback(
		async (force = false): Promise<boolean> => {
			console.log({ force, authToken });
			if (!user || !authToken) return false;

			setDashboardLoading(true);
			try {
				// If not forced, skip fetching when dashboard-like data already exists
				if (!force) {
					try {
						const existing = user.dashboard;
						if (
							existing &&
							typeof existing === 'object' &&
							(Array.isArray((existing as any).recentTransactions) ||
								(existing as any).todayTransactions !== undefined ||
								Array.isArray((existing as any).routerBalances) ||
								Array.isArray((existing as any).chartData))
						) {
							return false;
						}
					} catch (err: any) {
						console.log("[GeneralContext] current dashboard err ", err);
					}
				}

				const resp = await fetchDashboard(String(authToken));
				try {
					const body: GetDashboardResponse = await resp.json();
					// API 2.0 nests the dashboard metrics under `data`.
					const data = getApiData<NonNullable<GetDashboardResponse['data']>>(body);
					if (data) {
						setUser(() => {
							try {
								setLastDashboardUpdated(Date.now());
							} catch (err: any) { console.error("[GeneralContext] set last updated error ", err) }
							const dashboard: DashboardSummary = {
								chartData: data.chartData ?? [],
								monthTransactions: data.monthTransactions,
								monthUsers: data.monthUsers ?? 0,
								recentTransactions: data.recentTransactions,
								routerBalances: data.routerBalances ?? [],
								todayTransactions: data.todayTransactions ?? 0,
								todayUsers: data.todayUsers ?? 0,
								weekTransactions: data.weekTransactions ?? 0,
								weekUsers: data.weekUsers ?? 0,
								pendingApprovalCount: data.pendingApprovalCount ?? 0,
								pendingApprovals: data.pendingApprovals,
								myPendingCount: data.myPendingCount ?? 0,
								profitPendingApprovalCount:
									data.profitPendingApprovalCount ?? 0,
								myProfitPendingCount: data.myProfitPendingCount ?? 0,
							}
							return { ...user, dashboard };
						});
						return true;
					}
				} catch (e) {
					console.debug('[GeneralContext] refreshDashboard parse failed:', e);
					return false;
				}
				return false;
			} catch (e) {
				console.warn('[GeneralContext] refreshDashboard failed:', e);
				return false;
			} finally {
				setDashboardLoading(false);
			}
		},
		[authToken, user]
	);

	const handleFetchUserProfile = React.useCallback(() => {
		if (!user?.id || !authToken) return;
		(async () => {
			try {
				const userData = await fetchUser(authToken);
				if (userData && userData.ok) {
					const body: GetMeResponse = await userData.json();
					// API 2.0 wraps the identity context in `data`.
					const meResponse = getApiData<NonNullable<GetMeResponse['data']>>(body);
					const meUser = meResponse?.user;
					if (meUser)
						setUser(prev => ({ ...prev ?? {}, ...meUser, platform: meResponse?.platform, account: meResponse?.active_account }))
				}
			} catch (e) {
				console.log("[GeneralContext fetchUserProfile] ", e);
				ShowAlert("Profile could not be fetched", "Error");
			}
		})();
	}, [authToken, user?.id]);

	// Initial fetch when we become authenticated — do not re-run on unrelated
	// `user` object changes. The helper will avoid duplicate fetching.
	useEffect(() => {
		if (!user?.id || !authToken) return;
		void refreshDashboard(false);
	}, [authToken, user?.id, refreshDashboard]);

	// Auto-refresh dashboard every 2 minutes while authenticated.
	useEffect(() => {
		if (!user?.id || !authToken) return undefined;
		const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
		const id = setInterval(() => {
			void refreshDashboard(true);
		}, INTERVAL_MS);
		return () => clearInterval(id);
	}, [authToken, user?.id, refreshDashboard]);

	const handleRegistration = async ({
		phone,
		password,
		name,
		email,
	}: {
		phone: string;
		password: string;
		name?: string;
		email?: string;
	}) => {
		try {
			const res = await AuthService.register({
				phone: normalizePhoneForApi(phone),
				password: password || '',
				name: name || undefined,
				email: email || undefined,
			});
			if (!res.ok) {
				const text = await parseApiError(res);
				console.info('[GeneralContext] Registration error response:', text);
				setAppMessage({
					type: 'error',
					message:
						String(text) && String(text).trim()
							? String(text)
							: tr.categories.auth['registrationFailed'] ||
							'Registration failed',
				});
				return;
			}
			const body: RegisterResponse = await res.json();
			// API 2.0 returns `{ data: { phone } }`; older builds returned `{ phone }`.
			const data = getApiData<{ phone?: string }>(body);
			console.info('[GeneralContext] Registration response data:', data);
			setPendingPhone(data?.phone || phone);
			setPendingRegistration({ phone, password, fullName: name, email });
			router.replace('/(auth)/verify');
		} catch (error: any) {
			console.info('[GeneralContext] Registration error:', error?.message);
			const msg = (error && (error as any).message) || '';
			setAppMessage({
				type: 'error',
				message:
					String(msg) && String(msg).trim()
						? String(msg)
						: tr.categories.auth['registrationFailed'] || 'Registration failed',
			});
		}
	};

	const handleVerify = async (otp: string) => {
		// Determine OTP to send. In development, backend expects a fixed DEV_OTP; otherwise use the
		// code passed in.
		const otpToSend =
			typeof DEV_OTP !== 'undefined' && DEV_OTP ? String(DEV_OTP) : otp;

		const payload = {
			name: pendingRegistration?.fullName || pendingRegistration?.phone || '',
			email: pendingRegistration?.email || '',
			phone: pendingRegistration?.phone || pendingPhone || '',
			password: pendingRegistration?.password || '',
			otp: otpToSend,
		};

		// Normalize phone before sending to backend
		payload.phone = normalizePhoneForApi(payload.phone);

		try {
			const res = await AuthService.verifyOtp(payload);
			if (!res.ok) {
				const { message: text, retryAfterSeconds } =
					await parseApiErrorDetails(res);
				applyAuthCooldown(res.status, retryAfterSeconds);
				setAppMessage({
					type: 'error',
					message:
						String(text) && String(text).trim()
							? String(text)
							: tr.categories.auth['otpVerificationFailed'] ||
							'OTP verification failed',
				});
				return;
			}
			const resBody: VerifyOtpResponse = await res.json();
			// API 2.0 wraps the setup payload in `data`.
			const resJson = getApiData<TotpSetupData>(resBody);
			// If backend requests TOTP setup, store the setup payload and navigate to the setup screen
			if (resJson && (resJson.qr || resJson.setup_token || resJson.qr_base64)) {
				setPending2FASetup({
					qr: resJson.qr ?? null,
					qr_base64: resJson.qr_base64 ?? null,
					secret: resJson.secret ?? null,
					setup_token: resJson.setup_token ?? null,
					phone: resJson.phone ?? payload.phone,
					user: resJson.user ?? null,
				});
				// navigate to the authenticator setup screen
				navigateToPath('/(auth)/setup-2fa');
				return;
			}
			console.log("[GeneralContext] VerfiyOTP response", { resJson });
			// Success - clear pending state and navigate to home
			setLoginRetryAt(null);
			setPendingRegistration?.(null);
			setPendingPhone?.(null);
			setPending2FAMethod?.(null);
			router.push('/(authenticated)/home');
		} catch (err: any) {
			const msg = (err && err.message) || '';
			setAppMessage({
				type: 'error',
				message:
					String(msg) && String(msg).trim()
						? String(msg)
						: tr.categories.auth['otpVerificationFailed'] ||
						'OTP verification failed',
			});
		}
	};

	const handleVerify2FA = async (otp: string) => {
		if (!pending2FASetup?.phone && !pendingPhone) {
			setAppMessage({
				type: 'error',
				message:
					tr.categories.auth['setupAuthenticator.missingPhone'] ??
					'Missing phone for 2FA verification',
			});
			return false;
		}
		if (!otp || String(otp).trim().length === 0) {
			setAppMessage({
				type: 'error',
				message:
					tr.categories.auth['setupAuthenticator.enterCodeError'] ??
					'Enter the code from your authenticator app',
			});
			return false;
		}
		try {
			const res = await AuthService.verify2fa(
				normalizePhoneForApi(String(pending2FASetup?.phone ?? pendingPhone)),
				String(otp).trim()
			);
			if (!res.ok) {
				const { message: text, retryAfterSeconds } =
					await parseApiErrorDetails(res);
				applyAuthCooldown(res.status, retryAfterSeconds);
				setAppMessage({
					type: 'error',
					message:
						String(text) && String(text).trim()
							? String(text)
							: tr.categories.auth['setupAuthenticator.verifyFailed'] ||
							'2FA verification failed',
				});
				return false;
			}
			const verifyBody: TwoFAVerifyResponse = await res.json();
			// API 2.0 wraps the session payload in `data`.
			const resJson: AuthSession | null = getApiData<AuthSession>(verifyBody);
			console.info('[GeneralContext] 2FA verification response ', { resJson });
			// A tokenless response means the session could not be established;
			// do not navigate into the authenticated area (its guard would bounce
			// straight back to login).
			if (!resJson || !resJson.token) {
				setAppMessage({
					type: 'error',
					message:
						tr.categories.auth['setupAuthenticator.verifyFailed'] ||
						'2FA verification failed',
				});
				return false;
			}
			// Establish the in-memory session first — navigation depends on it.
			setLoginRetryAt(null);
			setAuthToken(resJson.token);
			if (resJson.user) {
				const u = resJson.user;
				setUser((prev) => ({
					...prev ?? {},
					...u,
					platform: resJson.platform,
					account: resJson.active_account,
				}));
			}
			// Persist to storage best-effort; a storage failure must not bounce
			// the user back to login after a successful verification.
			const userSnapshot = resJson.user;
			void (async () => {
				try {
					await SecureStore.setItemAsync('auth_token', resJson.token);
					if (userSnapshot) {
						if (userSnapshot.id !== undefined) {
							await AsyncStorage.setItem('user_id', String(userSnapshot.id));
						}
						if (userSnapshot.email)
							await AsyncStorage.setItem('user_email', userSnapshot.email);
						if (userSnapshot.phone)
							await AsyncStorage.setItem('user_phone', userSnapshot.phone);
						if (userSnapshot.totp_secret) {
							await SecureStore.setItemAsync(
								'totp_secret',
								userSnapshot.totp_secret
							);
						}
					}
				} catch (e) {
					console.error('handleVerify2FA: error persisting auth state', e);
				}
			})();
			// Show success toast if backend provided a message
			try {
				const successMessage =
					verifyBody?.message ||
					tr.categories.auth['setupAuthenticator.loginSuccess'] ||
					'Login successful';
				setAppMessage?.({ type: 'message', message: successMessage });
			} catch { }
			// success — clear pending setup and navigate to home
			setPending2FASetup?.(null);
			setPending2FAMethod?.(null);
			router.replace('/(authenticated)/home');
			return true;
		} catch (err: any) {
			setAppMessage({
				type: 'error',
				message:
					err?.message ||
					tr.categories.auth['setupAuthenticator.verifyFailed'] ||
					'2FA verification failed',
			});
			return false;
		}
	};

	const handleSetupTotp = async (params?: {
		setup_token?: string;
		secret?: string;
		otp?: string;
	}) => {
		const setup_token = params?.setup_token ?? pending2FASetup?.setup_token;
		const secret = params?.secret ?? pending2FASetup?.secret;
		const otp = params?.otp ?? '';

		if (!setup_token) {
			setAppMessage?.({
				type: 'error',
				message:
					tr.categories.auth['setupAuthenticator.missingSetupToken'] ??
					'Missing setup token for TOTP setup',
			});
			return null;
		}
		if (!secret) {
			setAppMessage?.({
				type: 'error',
				message:
					tr.categories.auth['setupAuthenticator.missingSecret'] ??
					'Missing secret for TOTP setup',
			});
			return null;
		}
		if (!otp || String(otp).trim().length === 0) {
			setAppMessage?.({
				type: 'error',
				message:
					tr.categories.auth['setupAuthenticator.enterCodeError'] ??
					'Enter the code from your authenticator app',
			});
			return null;
		}
		try {
			const res = await AuthService.setupTotp({
				setup_token,
				secret,
				otp: String(otp).trim(),
			});
			if (!res.ok) {
				const { message: text, retryAfterSeconds } =
					await parseApiErrorDetails(res);
				applyAuthCooldown(res.status, retryAfterSeconds);
				setAppMessage?.({
					type: 'error',
					message:
						String(text) && String(text).trim()
							? String(text)
							: tr.categories.auth['setupAuthenticator.setupFailed'] ||
							'TOTP setup failed',
				});
				return null;
			}
			const setupBody: TwoFASetupResponse = await res.json();
			// API 2.0 wraps the session payload in `data`.
			const json: AuthSession | null = getApiData<AuthSession>(setupBody);

			// A tokenless response means the session could not be established;
			// do not navigate into the authenticated area.
			if (!json || !json.token) {
				setAppMessage?.({
					type: 'error',
					message:
						tr.categories.auth['setupAuthenticator.setupFailed'] ||
						'TOTP setup failed',
				});
				return null;
			}
			// Establish the in-memory session first — navigation depends on it.
			setLoginRetryAt(null);
			setAuthToken(json.token);
			if (json.user) {
				const user = json.user;
				setUser((prev) => ({
					...prev ?? {},
					...user,
					account: json.active_account,
					platform: json.platform,
				}));
			}
			// Persist best-effort; a storage failure must not bounce the user
			// back to login after TOTP setup succeeded.
			const userSnapshot = json.user;
			void (async () => {
				try {
					await SecureStore.setItemAsync('auth_token', json.token);
					if (userSnapshot) {
						if (userSnapshot.id !== undefined) {
							await AsyncStorage.setItem('user_id', String(userSnapshot.id));
						}
						if (userSnapshot.email) {
							await AsyncStorage.setItem('user_email', userSnapshot.email);
						}
						if (userSnapshot.phone) {
							await AsyncStorage.setItem('user_phone', userSnapshot.phone);
						}
						if (userSnapshot.totp_secret) {
							await SecureStore.setItemAsync(
								'totp_secret',
								userSnapshot.totp_secret
							);
						}
					}
				} catch (e) {
					console.error('[GeneralContext] handleSetupTotp: error persisting auth state', e);
				}
			})();
			// Show success toast if backend provided a message, then navigate
			try {
				const successMessage =
					setupBody?.message ||
					tr.categories.auth['setupAuthenticator.setupSuccess'] ||
					'Two-factor authentication enabled.';
				setAppMessage?.({ type: 'message', message: String(successMessage) });
			} catch {
				// ignore
			}

			// Clear pending setup and navigate into authenticated area
			setPending2FASetup?.(null);
			setPending2FAMethod?.(null);
			router.replace('/(authenticated)/home');
		} catch (err: any) {
			setAppMessage?.({
				type: 'error',
				message:
					(err?.message as string) ||
					tr.categories.auth['setupAuthenticator.setupFailed'] ||
					'TOTP setup failed',
			});
			console.error('[GeneralContext] TOTP setup error ', err);
		}
	};

	const retryRefreshWrapper = useCallback(async () => {
		const res = await attemptRefresh();
		return !!res;
	}, [attemptRefresh]);

	return (
		<GeneralContext.Provider
			value={{
				user,
				setUser,
				handleLogout,
				router,
				language,
				history,
				handleUpdateHistory,
				handleGoBack,
				isAnimatable,
				isHighEndDevice,
				setLanguage,
				keyboardVisible,
				notifications,
				unreadNotificationCount,
				fetchNotifications,
				markNotificationRead,
				markAllNotificationsRead,
				selectedOption,
				setSelectedOption,
				setNotifications,
				handleAuthentication,
				handleFetchUserProfile,
				handleRegistration,
				handleVerify,
				handleVerify2FA,
				handleSetupTotp,
				pending2FAMethod,
				setPending2FAMethod,
				pendingPhone,
				setPendingPhone,
				routersLastFetched,
				setRoutersLastFetched,
				online,
				appMessage,
				setAppMessage,
				pendingRegistration,
				setPendingRegistration,
				pending2FASetup,
				setPending2FASetup,
				authToken,
				setAuthToken,
				retryRefresh: retryRefreshWrapper,
				verifyingAuth,
				dashboardLoading,
				lastDashboardUpdated,
				loginRetryAt,
			}}
		>
			{children}
			{/* Global toast for app messages/errors */}
			<Toast
				visible={!!appMessage}
				type={appMessage?.type ?? 'message'}
				message={appMessage?.message ?? ''}
				onDismiss={() => setAppMessage(null)}
				onAction={() => {
					if (appMessage && appMessage.action) {
						// fire-and-forget the action; it will update app state/message as needed
						try {
							void appMessage.action();
						} catch { }
					} else {
						setAppMessage(null);
					}
				}}
				actionLabel={appMessage?.actionLabel ?? undefined}
			/>
		</GeneralContext.Provider>
	);
};

export const useGeneral = () => {
	const context = useContext(GeneralContext);
	if (!context)
		throw new Error('useGeneral must be used within a GeneralProvider');
	return context;
};

export function enableHistoryDebug() {
	if (runtime) (runtime as any).__BIM_HISTORY_DEBUG__ = true;
}

export function disableHistoryDebug() {
	if (runtime) (runtime as any).__BIM_HISTORY_DEBUG__ = false;
}
