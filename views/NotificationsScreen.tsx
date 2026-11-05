import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordAction, RecordField } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, translateWithVariables } from '@/helpers';
import {
	NOTIFICATIONS_ROUTE,
	resolveNotificationRoute,
} from '@/helpers/pushNotifications';
import { useThemeColor } from '@/hooks/useThemeColor';
import useHeaderBack from '@/hooks/useHeaderBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import type { notifications as NotificationItem } from '@/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

export default function NotificationsScreen() {
	useTrackHistory('/(authenticated)/notifications');
	useHeaderBack('/(authenticated)/home');
	const router = useRouter();
	const {
		notifications,
		unreadNotificationCount,
		language,
		fetchNotifications,
		markNotificationRead,
		markAllNotificationsRead,
	} = useGeneral();
	const t = translations[language].categories.notifications;

	const [refreshing, setRefreshing] = useState(false);
	const [markingAll, setMarkingAll] = useState(false);

	const background = useThemeColor({}, 'background');

	useEffect(() => {
		void fetchNotifications();
	}, [fetchNotifications]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchNotifications();
		} finally {
			setRefreshing(false);
		}
	}, [fetchNotifications]);

	const openNotification = useCallback(
		async (notification: NotificationItem) => {
			await markNotificationRead(notification.id);
			const route = resolveNotificationRoute(
				notification.link?.app || notification.link?.web
			);
			if (route !== NOTIFICATIONS_ROUTE) {
				router.push(route as never);
			}
		},
		[markNotificationRead, router]
	);

	const handleMarkAll = useCallback(async () => {
		setMarkingAll(true);
		try {
			await markAllNotificationsRead();
		} finally {
			setMarkingAll(false);
		}
	}, [markAllNotificationsRead]);

	return (
		<ParallaxScrollView
			headerBackgroundColor={{
				light: background,
				dark: background,
			}}
			containerStyle={{ flex: 1 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
			contentStyle={{ paddingHorizontal: 10 }}
		>
			<TileContainer
				id='notifications-header-tile'
				flat
				backgroundColor={background}
				style={styles.headerTile}
			>
				<ScreenHeader
					id='notifications-header'
					title={t.title}
					description={
						unreadNotificationCount > 0
							? translateWithVariables(t.unreadCount, {
									count: unreadNotificationCount,
								})
							: t.allRead
					}
					action={
						unreadNotificationCount > 0 ? (
							<ThemedButton
								title={t.markAllRead}
								icon='check'
								loading={markingAll}
								onPress={() => void handleMarkAll()}
								style={styles.markAllButton}
								textStyle={styles.markAllText}
							/>
						) : undefined
					}
				/>
			</TileContainer>
			<TileContainer
				id='notifications-list'
				flat
				backgroundColor={background}
				style={styles.notificationsList}
			>
				<RecordList
					id='notifications-record-list'
					isEmpty={notifications.length === 0}
					emptyMessage={t['no.notifications']}
				>
					{notifications.map((notification) => {
						const route = resolveNotificationRoute(
							notification.link?.app || notification.link?.web
						);
						const actions: RecordAction[] = [];

						if (!notification.isRead) {
							actions.push({
								label: t.markRead,
								icon: 'check',
								tone: 'success',
								onPress: () => {
									void markNotificationRead(notification.id);
								},
							});
						}

						if (route !== NOTIFICATIONS_ROUTE) {
							actions.push({
								label: t.open,
								icon: 'eye.outline',
								tone: 'primary',
								onPress: () => {
									void openNotification(notification);
								},
							});
						}

						const fields: RecordField[] = [];
						if (notification.categoryLabel || notification.category) {
							fields.push({
								label: t.category,
								value: notification.categoryLabel || notification.category,
							});
						}
						fields.push({
							label: t.received,
							value: formatDateTime(notification.createdAt.toISOString()),
							fullWidth: true,
						});

						return (
							<RecordCard
								key={notification.id}
								id={`notification-${notification.id}`}
								title={notification.title || notification.message}
								subtitle={notification.message}
								badge={
									!notification.isRead
										? { label: t.new, tone: 'primary' }
										: undefined
								}
								fields={fields}
								actions={actions}
								onPress={() => void openNotification(notification)}
							/>
						);
					})}
				</RecordList>
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	notificationsList: {
		width: '100%',
		paddingHorizontal: 10,
	},
	headerTile: {
		width: '100%',
		marginBottom: 12,
	},
	markAllButton: {
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 6,
	},
	markAllText: {
		fontSize: 12,
	},
});
