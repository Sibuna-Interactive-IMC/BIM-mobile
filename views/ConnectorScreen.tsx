import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useSecurity } from '@/context/SecurityContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import GenerateWireguardKey from '@/views/GenerateWireguardKey';
import { useRef, useState } from 'react';
import {
	Animated,
	GestureResponderEvent,
	StyleSheet,
	useAnimatedValue,
} from 'react-native';

export default function ConnectorScreen() {
	useTrackHistory('/(authenticated)/connector');
	const fadeAnim = useAnimatedValue(0);
	const { language } = useGeneral();
	const bg = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const white = useThemeColor({}, 'white');
	const bim = useThemeColor({}, 'bim');
	const {
		wireguardKeys,
		loading,
		setLoading,
		fetchWireguardKeys,
		createWireguardKey,
		deleteWireguardKey,
	} = useSecurity();

	const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false);

	const wireguardKeyListId = useRef(
		`wireguard-key-list-${Math.random().toString(36).slice(2)}`
	);

	const toggleGenerateKeyModal = (v?: boolean) => {
		// use fadeAnim to animate the modal in/out
		if (v === undefined) {
			Animated.timing(fadeAnim, {
				toValue: showGenerateKeyModal ? 0 : 1,
				duration: 300,
				useNativeDriver: true,
			}).start(() => {
				setShowGenerateKeyModal(!showGenerateKeyModal);
			});
		} else {
			setShowGenerateKeyModal(v);
			Animated.timing(fadeAnim, {
				toValue: v ? 1 : 0,
				duration: 300,
				useNativeDriver: true,
			}).start();
		}
	}

	const handleGenerateKey = async (keyName: string, address?: string, port?: number) => {
		setLoading(true);
		try {
			await createWireguardKey(keyName, address, port);
		} catch (e) {
			console.error('handleGenerateKey: failed', e);
		} finally {
			setLoading(false);
		}
	}

	const onRefresh = async () => {
		setLoading(true);
		try {
			await fetchWireguardKeys();
		} catch (e) {
			console.error('[ConnectorLayout] refresh failed', e);
		} finally {
			setLoading(false);
		}
	}

	const onDeleteKey = async (id: string) => {
		setLoading(true);
		try {
			await deleteWireguardKey(id);
		} catch (e) {
			console.error('[ConnectorLayout] delete key failed', e);
		} finally {
			setLoading(false);
		}
	}

	return (
		<>
			<ParallaxScrollView
				onRefresh={onRefresh}
				refreshing={loading}
				headerBackgroundColor={{
					light: backgroundLight,
					dark: backgroundDark,
				}}
				containerStyle={styles.container}
				contentStyle={{ paddingHorizontal: 10 }}
				onTouchStart={(e: GestureResponderEvent) => {
					e.stopPropagation(); // Prevent touch events from propagating to the drawer
				}}
			>
								<TileContainer
					id='connector-header-tile'
					flat
					backgroundColor={bg}
					style={{ width: '100%', marginBottom: 12 }}
				>
					<ScreenHeader
						id='connector-header'
						title={translations[language].categories.connector.title}
						action={
							<ThemedButton
								title={translations[language].categories.connector.newKeyButton}
								icon='plus'
								onPress={() => toggleGenerateKeyModal()}
								lightColor={bim}
								darkColor={bim}
								darkTextColor={white}
								lightTextColor={white}
							/>
						}
					/>
				</TileContainer>
				<TileContainer
					id='connector-list-tile'
					flat
					backgroundColor={bg}
					style={{ flexDirection: 'column' }}
				>
					<RecordList
						id={wireguardKeyListId.current}
						isEmpty={wireguardKeys.length === 0}
						emptyMessage={translations[language].categories.connector.noKeys}
					>
						{wireguardKeys.map((key) => (
							<RecordCard
								key={key.id}
								id={`wireguard-key-${key.id}`}
								title={key.key_name}
								subtitle={key.ip_address}
								badge={
									key.status
										? {
											label: key.status,
											tone:
												key.status === 'active'
													? 'success'
													: key.status === 'pending'
														? 'warning'
														: 'danger',
										}
										: undefined
								}
								fields={[
									{
										label: translations[language].categories.connector.endpointPort,
										value: key.endpoint_port,
									},
									{
										label: translations[language].categories.connector.routerPublicKey,
										value: key.router_public_key,
										fullWidth: true,
									},
									{
										label: translations[language].categories.connector.serverPublicKey,
										value: key.server_public_key,
										fullWidth: true,
									},
								]}
								actions={[
									{
										label: translations[language].categories.connector.view,
										icon: 'eye.outline',
										tone: 'primary',
										onPress: () => {},
									},
									{
										label: translations[language].categories.connector.delete,
										icon: 'delete.outline',
										tone: 'danger',
										onPress: () => onDeleteKey(key.id),
									},
								]}
							/>
						))}
					</RecordList>
				</TileContainer>
			</ParallaxScrollView>
			<GenerateWireguardKey
				fadeAnim={fadeAnim}
				toggleVisible={toggleGenerateKeyModal}
				generateWireguardKeys={({ name, endpointAddress, endpointPort }) => handleGenerateKey(name, endpointAddress, endpointPort)}
				visible={showGenerateKeyModal}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	routerItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
});
