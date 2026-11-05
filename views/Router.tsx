import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { validateIPv4 } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import { NetRouter } from '@/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Animated,
	findNodeHandle,
	Keyboard,
	Platform,
	TextInput as RNTextInput,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Mode = 'add' | 'edit' | 'preview';

type Payload = {
	name: string;
	location: string;
	type: string;
	ipAddress: string;
	username: string;
	password: string;
};

type Props = {
	visible: boolean;
	mode?: Mode;
	initial?: Partial<NetRouter> & Partial<Payload>;
	onCancel: () => void;
	onSubmit: (payload: Payload) => void;
	/** Edit forms may keep the stored router password, so it is not required. */
	passwordOptional?: boolean;
	onBack?: () => void;
	onEdit?: () => void;
};

export default function RouterOverlay({
	visible,
	mode = 'add',
	initial,
	onCancel,
	onSubmit,
	passwordOptional = false,
	onBack,
	onEdit,
}: Props) {
	useColorScheme();
	const { language, isAnimatable, keyboardVisible } = useGeneral();
	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const errorColor = useThemeColor({}, 'error');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	useSafeAreaInsets();
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const ddRef = useRef<View | null>(null);
	const scrollRef = useRef<any | null>(null);
	const nameInputRef = useRef<RNTextInput | null>(null);
	const locationInputRef = useRef<RNTextInput | null>(null);
	const ipInputRef = useRef<RNTextInput | null>(null);
	const userInputRef = useRef<RNTextInput | null>(null);
	const passwordInputRef = useRef<RNTextInput | null>(null);
	useWindowDimensions();

	const [name, setName] = useState(initial?.name ?? '');
	const [location, setLocation] = useState(initial?.location ?? '');
	const [type, setType] = useState(initial?.type ?? 'Mikrotik');
	const [ipAddress, setIpAddress] = useState((initial as any)?.ipAddress ?? '');
	const [username, setUsername] = useState((initial as any)?.username ?? '');
	const [password, setPassword] = useState((initial as any)?.password ?? '');
	const [opened, setOpened] = useState<string | undefined>(undefined);

	const isPreview = mode === 'preview';
	const isEditable = mode !== 'preview';

	useEffect(() => {
		if (visible) {
			setName(initial?.name ?? '');
			setLocation(initial?.location ?? '');
			setType(initial?.type ?? 'Mikrotik');
			setIpAddress((initial as any)?.ipAddress ?? '');
			setUsername((initial as any)?.username ?? '');
			setPassword((initial as any)?.password ?? '');
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 150,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 150,
				useNativeDriver: true,
			}).start();
		}
	}, [visible, initial, fadeAnim]);

	// Track keyboard height to compute precise scroll delta
	useEffect(() => {
		const showEvent =
			Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
		const hideEvent =
			Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
		const s = Keyboard.addListener(showEvent, () => {});
		const h = Keyboard.addListener(hideEvent, () => {});
		return () => {
			s.remove();
			h.remove();
		};
	}, []);

	const canSubmit = useMemo(() => {
		const ipOk = validateIPv4(ipAddress.trim());
		return (
			isEditable &&
			name.trim().length > 0 &&
			location.trim().length > 0 &&
			type.trim().length > 0 &&
			ipOk &&
			username.trim().length > 0 &&
			(passwordOptional || password.trim().length > 0)
		);
	}, [isEditable, name, location, passwordOptional, type, ipAddress, username, password]);

	const title = useMemo(() => {
		return isPreview
			? translations[language].categories.routers.title
			: mode === 'edit'
			? translations[language].categories.routers.editTitle
			: translations[language].categories.routers.newTitle;
	}, [isPreview, mode, language]);

	const scrollToInput = (
		inputRef: React.RefObject<RNTextInput | null>,
		extra: number = 64
	) => {
		const doScroll = () => {
			try {
				const node = findNodeHandle(inputRef.current);
				if (!node) return;
				const responder =
					scrollRef.current?.getScrollResponder?.() ?? scrollRef.current;
				responder?.scrollResponderScrollNativeHandleToKeyboard?.(
					node,
					extra,
					true
				);
			} catch {}
		};
		// Try immediately, then again after the keyboard finishes animating
		doScroll();
		setTimeout(doScroll, Platform.OS === 'ios' ? 260 : 80);
		setTimeout(doScroll, Platform.OS === 'ios' ? 420 : 150);
	};

	return (
		<OverlayContainer
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			contentFill={true}
			scrollable
			autoKeyboardInset
			bottomPadding={12}
			getScrollRef={(r) => (scrollRef.current = r)}
			onRequestClose={onCancel}
			keyboardGap={20}
		>
			<ThemedView
				style={[
					styles.card,
					{
						paddingVertical: 30,
						marginBottom: keyboardVisible ? 90 : 0,
					},
				]}
				lightColor={bg}
				darkColor={bg}
			>
				<ThemedText
					style={styles.title}
					lightColor={screenTitleText}
					darkColor={screenTitleText}
				>
					{title}
				</ThemedText>

				<ThemedInput
					ref={nameInputRef as any}
					label={translations[language].categories.dashboard.routerName}
					placeholder={'eg. Router 01'}
					value={name}
					setValue={setName}
					editable={isEditable}
					onFocus={() => scrollToInput(nameInputRef)}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 8 }}
				/>

				<ThemedInput
					ref={locationInputRef as any}
					label={translations[language].categories.dashboard.location}
					placeholder={'eg. UCU Main Campus'}
					value={location}
					setValue={setLocation}
					editable={isEditable}
					onFocus={() => scrollToInput(locationInputRef)}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 8 }}
				/>

				<ThemedDropdown
					containerRef={ddRef}
					lightColor={bg}
					darkColor={bg}
					placeholder={translations[language].categories.dashboard.routerType}
					value={type}
					label={translations[language].categories.routers.routerType}
					showDropdown={opened === 'router-type'}
					setShowDropdown={(v) => setOpened(v ? 'router-type' : undefined)}
					multiselect={false}
					onSelect={() =>
						setOpened((prev) =>
							prev === 'router-type' ? undefined : 'router-type'
						)
					}
					setValue={setType}
					style={{ marginBottom: 8 }}
					isAnimatable={isAnimatable}
					keyboardVisible={keyboardVisible}
					options={['Mikrotik', 'TpLink', 'LinkSys', 'Cisco']}
					active={isEditable}
				/>

				<ThemedInput
					ref={ipInputRef as any}
					label={translations[language].categories.dashboard.ipAddress}
					placeholder={'eg. 10.0.0.1'}
					value={ipAddress}
					setValue={setIpAddress}
					editable={isEditable}
					onFocus={() => scrollToInput(ipInputRef)}
					style={{
						backgroundColor: bg,
						borderColor:
							ipAddress.trim().length === 0
								? inputBorder
								: validateIPv4(ipAddress.trim())
								? inputBorder
								: errorColor,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 8 }}
				/>

				<ThemedInput
					ref={userInputRef as any}
					label={translations[language].categories.dashboard.routerUsername}
					placeholder={'eg. admin'}
					value={username}
					setValue={setUsername}
					editable={isEditable}
					onFocus={() => scrollToInput(userInputRef)}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 8 }}
				/>

				<ThemedInput
					ref={passwordInputRef as any}
					label={translations[language].categories.dashboard.routerPassword}
					placeholder={'******'}
					value={password}
					setValue={setPassword}
					secureTextEntry
					editable={isEditable}
					onFocus={() => scrollToInput(passwordInputRef, 80)}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 8 }}
				/>

				<View style={styles.actions}>
					{isPreview ? (
						<>
							<ThemedButton
								title={translations[language].categories.buttons.close}
								onPress={onBack ?? onCancel}
								lightColor={cancelButton}
								darkColor={cancelButton}
								lightTextColor={white}
								darkTextColor={white}
							/>
							<ThemedButton
								title={translations[language].categories.buttons.save}
								onPress={onEdit ?? (() => {})}
								lightColor={bim}
								darkColor={bim}
								lightTextColor={white}
								darkTextColor={white}
							/>
						</>
					) : (
						<>
							<ThemedButton
								title={translations[language].categories.buttons.cancel}
								onPress={onCancel}
								lightColor={cancelButton}
								darkColor={cancelButton}
								lightTextColor={white}
								darkTextColor={white}
							/>
							<ThemedButton
								title={translations[language].categories.buttons.saveRouter}
								onPress={() =>
									onSubmit({
										name,
										location,
										type,
										ipAddress,
										username,
										password,
									})
								}
								disabled={!canSubmit}
								lightColor={bim}
								darkColor={bim}
								lightTextColor={white}
								darkTextColor={white}
							/>
						</>
					)}
				</View>
			</ThemedView>
		</OverlayContainer>
	);
}

const styles = StyleSheet.create({
	kbContainer: { width: '100%' },
	card: {
		flexDirection: 'column',
		paddingVertical: 30,
		paddingHorizontal: 20,
		borderRadius: 10,
		width: '100%',
		gap: 12,
	},
	title: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 8,
	},
});
