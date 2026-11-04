import ParallaxScrollView from '@/components/ParallaxScrollView';
import ScreenHeader from '@/components/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import TileContainer from '@/components/TileContainer';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

export default function NotificationsScreen() {
	useTrackHistory('/(authenticated)/notifications');
	const { notifications, language, fetchNotifications } = useGeneral(); // Get notifications from context
	const [refreshing, setRefreshing] = useState(false);

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await fetchNotifications();
		} finally {
			setRefreshing(false);
		}
	};

	const bg = useThemeColor({}, 'background');
	const headers = useThemeColor({}, 'headers');
	const inputContainerBackground = useThemeColor(
		{},
		'inputContainerBackground'
	);
	const textColor = useThemeColor({}, 'text');
	return (
		<ParallaxScrollView
			headerBackgroundColor={{
				light: bg,
				dark: bg,
			}}
			containerStyle={{ flex: 1 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
			contentStyle={{ paddingHorizontal: 10 }}
		>
			<TileContainer
				id='notifications-header-tile'
				flat
				backgroundColor={bg}
				style={styles.headerTile}
			>
				<ScreenHeader
					id='notifications-header'
					title={translations[language].categories.notifications['title']}
				/>
			</TileContainer>
			<TileContainer
				id='notifications-list'
				flat
				backgroundColor={bg}
				style={[styles.notificationsList, { alignItems: 'stretch' }]}
			>
				{notifications.length > 0 ? (
					notifications.map((notification, index) => (
						<ThemedView
							key={index}
							style={styles.notificationItem}
							lightColor={inputContainerBackground}
							darkColor={inputContainerBackground}
						>
							<ThemedText
								style={styles.notificationTitle}
								lightColor={headers}
								darkColor={headers}
							>
								{notification.title}
							</ThemedText>
							<ThemedText
								style={styles.notificationMessage}
								lightColor={textColor}
								darkColor={textColor}
							>
								{notification.message}
							</ThemedText>
						</ThemedView>
					))
				) : (
					<ThemedText
						style={styles.noNotifications}
						lightColor={textColor}
						darkColor={textColor}
					>
						{translations[language].categories.notifications['no.notifications']}
					</ThemedText>
				)}
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	container: {},
	header: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 20,
	},
	notificationsList: {
		flex: 4,
		width: '100%',
		paddingHorizontal: 10,
	},
	notificationItem: {
		flexDirection: 'row',
		gap: 10,
		padding: 12,
		borderBottomWidth: 1,
	},
	notificationTitle: {
		fontWeight: 'bold',
	},
	notificationMessage: {
		fontSize: fontSize['notification.body'],
	},
	noNotifications: {
		padding: 12,
		textAlign: 'center',
	},
	title: {
		fontSize: fontSize['heading.one'],
		fontWeight: fontWeight['heading.one'],
		marginBottom: 20,
	},
	headerTile: {
		width: '100%',
		marginBottom: 12,
	},
});
