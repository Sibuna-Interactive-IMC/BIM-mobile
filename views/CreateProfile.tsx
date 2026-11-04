import { useRef, useState } from 'react';
import {
	Animated,
	findNodeHandle,
	Platform,
	TextInput as RNTextInput,
	useColorScheme
} from 'react-native';

import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';

type Props = {
	visible: boolean;
	fadeAnim: Animated.Value;
	toggleVisible: (show?: boolean) => void;
	mode: 'create' | 'edit';
	initialPkg?: string;
	titleOverride?: string;
	primaryButtonLabelOverride?: string;
	createProfile: () => void;
	onRequestClose?: () => void;
};

export default function CreateProfile({
	visible,
	fadeAnim,
	toggleVisible,
	mode,
	initialPkg,
	titleOverride,
	primaryButtonLabelOverride,
	createProfile,
	onRequestClose,
}: Props) {
	useColorScheme();
	const { language, keyboardVisible } = useGeneral();

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const scrollRef = useRef<any>(null);
	const sessionTimeoutInputRef = useRef<RNTextInput | null>(null);
	const [profileName, setProfileName] = useState<string | undefined>();
	const [sessionTimeout, setSessionTimeout] = useState<number | undefined>();
	const [rateLimit, setRateLimit] = useState<string | undefined>();
	const [simultaneousConnections, setSimultaneousConnections] = useState<number | undefined>();

	// no explicit keyboard listeners needed; OverlayContainer handles insets

	const packageOptions: string[] = ['short', 'daily', 'weekly', 'monthly'];

	const onCancel = () => toggleVisible(false);

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
			} catch { }
		};
		doScroll();
		setTimeout(doScroll, Platform.OS === 'ios' ? 260 : 80);
		setTimeout(doScroll, Platform.OS === 'ios' ? 420 : 150);
	};

	return (
		<OverlayContainer
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={onRequestClose ?? onCancel}
			scrollable
			autoKeyboardInset
			bottomPadding={16}
			keyboardGap={40}
			getScrollRef={(r) => (scrollRef.current = r)}
			centerLiftOnKeyboard
			centerLiftRatio={0.9}
		>
			<ThemedView
				style={{
					flexDirection: 'column',
					backgroundColor: bg,
					padding: 20,
					borderRadius: 10,
					width: '100%',
					gap: 12,
				}}
				lightColor={bg}
				darkColor={bg}
			>
				<ThemedText
					style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}
					lightColor={screenTitleText}
					darkColor={screenTitleText}
				>
					{translations[language].categories.packages.createProfile}
				</ThemedText>

				<ThemedInput
					label={translations[language].categories.packages.profileName}
					placeholder={translations[language].categories.packages.profileName}
					value={profileName}
					setValue={v => setProfileName(v)}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 4 }}
				/>

				<ThemedInput
					ref={sessionTimeoutInputRef as any}
					label={translations[language].categories.packages.sessionTimeout}
					placeholder={translations[language].categories.packages.sessionTimeout}
					keyboardType='number-pad'
					value={sessionTimeout?.toString()}
					setValue={v => setSessionTimeout(v ? parseInt(v) : undefined)}
					onFocus={() => scrollToInput(sessionTimeoutInputRef, 64)}
					editable={true}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 4 }}
				/>

				<ThemedInput
					label={translations[language].categories.packages.rateLimit}
					placeholder={translations[language].categories.packages.rateLimit}
					value={rateLimit}
					setValue={v => setRateLimit(v)}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 4 }}
				/>
				<ThemedInput
					label={translations[language].categories.packages.simultaneousConnections}
					placeholder={translations[language].categories.packages.simultaneousConnections}
					keyboardType='number-pad'
					value={simultaneousConnections?.toString()}
					setValue={v => setSimultaneousConnections(v ? parseInt(v) : undefined)}
					style={{
						backgroundColor: bg,
						borderColor: inputBorder,
						borderWidth: 1,
					}}
					containerStyle={{ marginBottom: 4 }}
				/>

				<ThemedView
					style={{
						flexDirection: 'row',
						justifyContent: 'flex-end',
						gap: 10,
						marginTop: 12,
					}}
					lightColor='transparent'
					darkColor='transparent'
				>
					<ThemedButton
						title={translations[
							language
						].categories.buttons.cancel.toUpperCase()}
						onPress={onCancel}
						numberOfLines={1}
						style={{ maxWidth: '35%' }}
						lightColor={cancelButton}
						darkColor={cancelButton}
						lightTextColor={white}
						darkTextColor={white}
					/>
					<ThemedButton
						title={'Create Profile'}
						numberOfLines={1}
						style={{ maxWidth: '60%' }}
						lightColor={bim}
						darkColor={bim}
						lightTextColor={white}
						darkTextColor={white}
						onPress={() => { }}
					/>
				</ThemedView>
			</ThemedView>
		</OverlayContainer>
	);
}
