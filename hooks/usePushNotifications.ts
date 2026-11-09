import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { getApiData } from '@/helpers/apiResponse';
import {
	NOTIFICATIONS_ROUTE,
	extractNotificationId,
	extractPushLink,
	normalizePushToken,
	resolveNotificationRoute,
} from '@/helpers/pushNotifications';
import * as InboxService from '@/services/InboxService';
import * as PushService from '@/services/PushService';
import type { PushDevice, PushPlatform } from '@/types';

/**
 * Android channel the backend's FCM messages are delivered on.
 *
 * Must match `push.fcm.android_channel` in the Laravel config
 * (`FCM_ANDROID_CHANNEL`, default `bim_approvals`). A message whose
 * `channel_id` has no matching channel does not use this app's channel, so
 * its importance, sound and the user's per-category settings are all skipped.
 */
const ANDROID_CHANNEL_ID = 'bim_approvals';

/** Channel earlier builds created; the backend targets `bim_approvals`. */
const LEGACY_ANDROID_CHANNEL_ID = 'default';

/**
 * Expo Go (the store client) cannot receive remote pushes from SDK 53 onwards;
 * they only work in a development build or a release build.
 */
const isExpoGo =
	Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// A push that arrives while the app is in the foreground should still be shown,
// otherwise FCM messages look like they were dropped.
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

function currentPlatform(): PushPlatform {
	if (Platform.OS === 'ios') return 'ios';
	if (Platform.OS === 'android') return 'android';
	return 'web';
}

async function ensureAndroidChannel(name: string, description?: string) {
	if (Platform.OS !== 'android') return;
	await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
		name,
		description,
		importance: Notifications.AndroidImportance.HIGH,
		lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
	});

	// Drop the channel earlier builds registered: nothing was ever delivered
	// on it, so keeping it only adds a second entry to the app's notification
	// settings.
	const legacy = await Notifications.getNotificationChannelAsync(
		LEGACY_ANDROID_CHANNEL_ID
	).catch(() => null);
	if (legacy) {
		await Notifications.deleteNotificationChannelAsync(
			LEGACY_ANDROID_CHANNEL_ID
		).catch(() => {});
	}
}

/** Apps can only be nudged once for the OS permission dialog; afterwards it is a settings toggle. */
async function ensureNotificationPermission(): Promise<boolean> {
	const current = await Notifications.getPermissionsAsync();
	if (current.granted) return true;
	if (!current.canAskAgain) return false;
	const requested = await Notifications.requestPermissionsAsync();
	return requested.granted;
}

/**
 * Registers this install for push notifications and routes a tapped
 * notification to the screen its `link.app` points at.
 *
 * Mount it inside the authenticated layout: registration needs a bearer token,
 * and the install is unregistered from `GeneralContext.handleLogout`.
 */
export default function usePushNotifications() {
	const { authToken, language, fetchNotifications, refreshDashboard } =
		useGeneral();
	const router = useRouter();

	// Token this session already registered, so a token refresh or a language
	// change does not re-post the same device row.
	const registeredTokenRef = useRef<string | null>(null);

	// `fetchNotifications` and `refreshDashboard` are recreated on every
	// provider render; keep the latest ones reachable without re-subscribing
	// the listeners.
	const fetchNotificationsRef = useRef(fetchNotifications);
	useEffect(() => {
		fetchNotificationsRef.current = fetchNotifications;
	}, [fetchNotifications]);

	const refreshDashboardRef = useRef(refreshDashboard);
	useEffect(() => {
		refreshDashboardRef.current = refreshDashboard;
	}, [refreshDashboard]);

	const openNotification = useCallback(
		async (response: Notifications.NotificationResponse) => {
			const data = (response.notification.request.content.data ?? {}) as Record<
				string,
				unknown
			>;
			const route = resolveNotificationRoute(extractPushLink(data));

			const id = extractNotificationId(data);
			if (id && authToken) {
				// Opening a push counts as reading it; the call is idempotent.
				try {
					await InboxService.markInboxRead(id, authToken);
				} catch (error) {
					console.warn('[push] could not mark the notification read', error);
				}
			}

			try {
				router.push(route as never);
			} catch {
				router.push(NOTIFICATIONS_ROUTE as never);
			}
			void fetchNotificationsRef.current();
		},
		[authToken, router]
	);

	useEffect(() => {
		if (!authToken || Platform.OS === 'web') return;

		// Expo Go cannot mint a device token, and asking for the permission only
		// to fail is worse than saying what to run instead.
		if (isExpoGo) {
			console.log(
				'[push] Expo Go cannot receive remote pushes — run `npm run dev:android` (or dev:ios) for a development build'
			);
			return;
		}

		let cancelled = false;

		const register = async (deviceToken: unknown) => {
			const token = normalizePushToken(deviceToken);
			if (!token || cancelled) return;
			if (registeredTokenRef.current === token) return;

			try {
				// A rolled token becomes a new row; drop the one this install
				// registered before, otherwise it keeps being pushed to.
				const previous = await PushService.storedPushDevice();
				if (previous?.deviceId && previous.token !== token) {
					await PushService.removePushDevice(previous.deviceId, authToken).catch(
						() => { }
					);
				}

				const response = await PushService.registerPushDevice(
					{
						token,
						platform: currentPlatform(),
						device_id: await PushService.ensureInstallId(),
						app_version: Constants.expoConfig?.version,
						locale: language,
					},
					authToken
				);
				const body = await response.json().catch(() => null);
				const device = getApiData<{ device: PushDevice }>(body)?.device ?? null;
				if (!device) {
					console.warn(
						'[push] device registration was rejected',
						response.status,
						body
					);
					return;
				}
				registeredTokenRef.current = token;
				await PushService.rememberPushDevice({
					token,
					deviceId: device.id,
				});
				console.log('[push] device registered', {
					platform: currentPlatform(),
					deviceId: device.id,
				});
			} catch (error) {
				console.warn('[push] device registration failed', error);
			}
		};

		const setup = async () => {
			if (!Device.isDevice) {
				console.log('[push] skipping registration on an emulator');
				return;
			}

			const t = translations[language]?.categories?.notifications;
			await ensureAndroidChannel(
				t?.['channelName'] ?? 'Account notifications',
				t?.['channelDescription']
			);

			if (!(await ensureNotificationPermission())) {
				console.log('[push] notification permission not granted');
				return;
			}

			await register(await Notifications.getDevicePushTokenAsync());
		};

		// Registration is idempotent server-side; a failure here must not stop
		// the listeners below from being attached.
		setup().catch((error) => {
			console.warn('[push] setup failed', error);
		});

		const tokenSubscription =
			Notifications.addPushTokenListener(register);
		const receivedSubscription = Notifications.addNotificationReceivedListener(
			() => {
				void fetchNotificationsRef.current();
				// A push means the numbers behind the dashboard changed; the
				// approval banner should not wait for the 2-minute poll.
				void refreshDashboardRef.current?.(true);
			}
		);
		const responseSubscription =
			Notifications.addNotificationResponseReceivedListener((response) => {
				void openNotification(response);
			});

		// Cold start from a tapped notification: the response listener above
		// only fires for taps that happen while the app is running.
		Notifications.getLastNotificationResponseAsync()
			.then((response) => {
				if (!response) return;
				void openNotification(response);
				return Notifications.clearLastNotificationResponseAsync();
			})
			.catch(() => {
				// No stored response (or unavailable on this platform).
			});

		return () => {
			cancelled = true;
			tokenSubscription.remove();
			receivedSubscription.remove();
			responseSubscription.remove();
		};
	}, [authToken, language, openNotification]);
}
