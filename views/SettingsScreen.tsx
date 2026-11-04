import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { ShowAlert } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchInboxSettings, saveInboxSettings } from '@/services/InboxService';
import type { InboxSettings, NotificationChannelKey } from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Settings: the per-category notification channel matrix
 * (`GET`/`PATCH /inbox/settings`).
 *
 * Reached from the drawer and the avatar menu rather than from Profile, so
 * other account-level preferences can be added here without touching that form.
 */
export default function SettingsScreen() {
	useTrackHistory('/(authenticated)/settings');
	const { language, authToken } = useGeneral();
	const t = translations[language].categories.settings;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');

	const [notificationSettings, setNotificationSettings] =
		useState<InboxSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [savingChannel, setSavingChannel] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchInboxSettings(authToken);
			if (!res.ok) return;
			const body = await res.json().catch(() => null);
			setNotificationSettings(getApiData<InboxSettings>(body) ?? null);
		} catch (e) {
			console.error('[SettingsScreen] load failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	// Channel labels come from the API; this only covers a channel the server
	// ships without a label so the row is never blank.
	const channelLabels: Record<string, string> = useMemo(
		() => ({
			fcm: t.notificationsPush,
			mail: t.notificationsEmail,
			broadcast: t.notificationsBroadcast,
		}),
		[t.notificationsBroadcast, t.notificationsEmail, t.notificationsPush]
	);

	/**
	 * Flip one switch. The list updates immediately and reverts if the PATCH
	 * fails, so a slow network does not leave the UI lying about the setting.
	 */
	const toggleChannel = useCallback(
		async (
			categoryKey: string,
			channelKey: NotificationChannelKey,
			enabled: boolean
		) => {
			if (!authToken) return;
			const previous = notificationSettings;
			setNotificationSettings((current) => {
				if (!current) return current;
				return {
					...current,
					categories: current.categories.map((category) =>
						category.key === categoryKey
							? {
									...category,
									channels: {
										...category.channels,
										[channelKey]: {
											...category.channels[channelKey],
											enabled,
										},
									},
								}
							: category
					),
				};
			});

			setSavingChannel(`${categoryKey}.${channelKey}`);
			try {
				const res = await saveInboxSettings(
					[{ category: categoryKey, channel: channelKey, enabled }],
					authToken
				);
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					setNotificationSettings(previous);
					ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				}
			} catch (e) {
				console.error('[SettingsScreen] notification setting failed', e);
				setNotificationSettings(previous);
				ShowAlert(t.saveFailed, 'Error');
			} finally {
				setSavingChannel(null);
			}
		},
		[authToken, notificationSettings, t.saveFailed]
	);

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='settings-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='settings-header'
					title={t.title}
					description={t.description}
					loading={loading}
				/>
			</TileContainer>

			<TileContainer
				id='settings-content-tile'
				flat
				backgroundColor={background}
				style={styles.content}
			>
				<RecordList
					id='settings-notifications'
					title={t.notifications}
					description={t.notificationsDesc}
					loading={loading}
					loadingMessage={t.notificationsLoading}
					isEmpty={!loading && !notificationSettings?.categories?.length}
					emptyMessage={t.notificationsEmpty}
				>
					{notificationSettings?.categories.map((category) => (
						<View key={category.key} style={styles.preferenceGroup}>
							<ThemedText
								style={[styles.preferenceGroupTitle, { color: textColor }]}
								lightColor={textColor}
								darkColor={textColor}
							>
								{category.label}
							</ThemedText>
							{Object.entries(category.channels).map(([key, channel]) => (
								<View key={key} style={styles.preferenceRow}>
									<ThemedText style={styles.preferenceLabel}>
										{channel.label || channelLabels[key] || key}
									</ThemedText>
									<ThemedSwitch
										accessibilityLabel={`${category.label} ${
											channel.label || channelLabels[key] || key
										}`}
										value={channel.enabled}
										disabled={
											channel.locked || savingChannel === `${category.key}.${key}`
										}
										onValueChange={(next) => {
											void toggleChannel(
												category.key,
												key as NotificationChannelKey,
												next
											);
										}}
									/>
								</View>
							))}
						</View>
					))}
					<ThemedText
						style={[styles.hint, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.notificationsPushHint}
					</ThemedText>
				</RecordList>
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	content: {
		width: '100%',
		gap: 12,
	},
	preferenceGroup: {
		gap: 2,
		paddingTop: 14,
	},
	preferenceGroupTitle: {
		fontSize: fontSize['text.large'],
		fontWeight: fontWeight['heading.two'],
	},
	preferenceRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		minHeight: 48,
	},
	preferenceLabel: {
		flex: 1,
		fontSize: fontSize['text.medium'],
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		marginTop: 4,
	},
});
