import bimTextImg from '@/assets/images/bim-text-img.png';
import FormContainer from '@/components/FormContainer';
import Loader from '@/components/Loader';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
// apiBaseUrl and network calls are handled in GeneralContext
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
// no direct router usage here; GeneralContext performs navigation after successful verify
import { signalAppReady } from '@/helpers/appReady';
import { env } from '@/helpers/env';
import { useEffect, useRef, useState } from 'react';
import {
	Animated,
	Dimensions,
	Image,
	Platform,
	StyleSheet,
	TextInput,
	findNodeHandle,
	useAnimatedValue,
	useColorScheme,
} from 'react-native';
const DEV_OTP = env('DEV_OTP');

const devWidth = Dimensions.get('window').width;

export default function VerifyTokenScreen() {
	useTrackHistory('/(auth)/verify');
	useColorScheme();

	// Signal readiness after two paint frames so layout can hide splash.
	useEffect(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				signalAppReady();
			});
		});
	}, []);
	const bg = useThemeColor({}, 'background');
	const headers = useThemeColor({}, 'headers');
	const textColor = useThemeColor({}, 'text');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const errorColor = useThemeColor({}, 'error');
	const bim = useThemeColor({}, 'bim');
	const buttonError = useThemeColor({}, 'buttonError');
	const authButtonText = useThemeColor({}, 'authButtonText');
	// router not needed here; navigation handled in GeneralContext after verify
	// timeout ref
	const otpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const loaderFadeAnim = useAnimatedValue(0);
	const { language, handleVerify, handleVerify2FA, pending2FAMethod } =
		useGeneral(); // Get language and verify handlers + 2FA method from context
	const [code, setCode] = useState('');
	const [focusedInput, setFocusedInput] = useState<string | null>(null);
	const scrollRef = useRef<any>(null);
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState({
		code: false,
		login: false,
	});

	// Prefill OTP in development when DEV_OTP is provided in local .env
	useEffect(() => {
		// Prefill OTP in development when DEV_OTP is provided in local .env
		// Do NOT prefill when the app expects a TOTP from an authenticator app
		if (
			typeof __DEV__ !== 'undefined' &&
			__DEV__ &&
			DEV_OTP &&
			pending2FAMethod !== 'totp'
		) {
			setCode(String(DEV_OTP));
			setErrors((prev) => ({ ...prev, code: false }));
		}
	}, [pending2FAMethod]);

	// Clean up on unmount
	useEffect(() => {
		const t = otpTimeoutRef.current;
		return () => {
			if (t) clearTimeout(t);
		};
	}, []);

	// Auto-scroll focused input into view
	useEffect(() => {
		if (!focusedInput || !scrollRef.current) return;
		const responder: any =
			(scrollRef.current as any)?.getScrollResponder?.() ?? scrollRef.current;
		if (!responder?.scrollResponderScrollNativeHandleToKeyboard) return;
		const doScroll = () => {
			try {
				const TI: any = TextInput as any;
				let focused: any = null;
				if (TI?.State && typeof TI.State.currentlyFocusedInput === 'function') {
					focused = TI.State.currentlyFocusedInput();
				} else if (typeof TI?.currentlyFocusedInput === 'function') {
					focused = TI.currentlyFocusedInput();
				}
				if (!focused) return;
				const handle = findNodeHandle(focused);
				if (!handle) return;
				responder.scrollResponderScrollNativeHandleToKeyboard(handle, 80, true);
			} catch {}
		};
		doScroll();
		const t1 = setTimeout(doScroll, 60);
		const t2 = setTimeout(doScroll, 140);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, [focusedInput]);

	const handleSetCode = (value: string) => {
		if (value.length > 6) return; // Limit input to 6 characters
		if (value.length === 6) {
			setErrors((prev) => ({ ...prev, code: false }));
		} else {
			setErrors((prev) => ({ ...prev, code: true }));
		}
		if (value.length <= 6 && !isNaN(Number(value))) setCode(value);
	};

	const handleToggleLoader = (show?: boolean) => {
		const toValue = show ?? !loading;
		setLoading(toValue);
		if (toValue) {
			Animated.timing(loaderFadeAnim, {
				toValue: 1,
				duration: 300,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(loaderFadeAnim, {
				toValue: 0,
				duration: 300,
				useNativeDriver: true,
			}).start();
		}
	};

	const handleOnVerifyCode = async () => {
		handleToggleLoader(true);
		if (otpTimeoutRef.current) {
			clearTimeout(otpTimeoutRef.current);
		}
		if (code.length !== 6) {
			setErrors((prev) => ({ ...prev, code: true }));
			return handleToggleLoader(false);
		}
		try {
			await handleVerify(code);
		} finally {
			handleToggleLoader(false);
		}
	};
	return (
		<>
			<FormContainer
				style={{
					flex: 1,
					minWidth: devWidth,
					minHeight: '100%',
					padding: 0,
					margin: 0,
				}}
				behavior={Platform.OS === 'ios' ? 'position' : 'padding'}
			>
				<ParallaxScrollView
					headerBackgroundColor={{
						light: bg,
						dark: bg,
					}}
					getScrollRef={(r) => (scrollRef.current = r)}
				>
					<ThemedView style={styles.container} lightColor={bg} darkColor={bg}>
						<ThemedView style={styles.header} lightColor={bg} darkColor={bg}>
							<Image
								source={bimTextImg}
								style={{ height: 35, resizeMode: 'contain' }}
							/>
						</ThemedView>
						<ThemedView style={styles.form} lightColor={bg} darkColor={bg}>
							<ThemedView
								style={styles.formHeader}
								lightColor={bg}
								darkColor={bg}
							>
								<ThemedText
									style={{
										fontWeight: 500,
										fontSize: 22,
										color: headers,
									}}
									lightColor={headers}
									darkColor={headers}
								>
									{translations[language].categories.buttons['verifyOTP']}
								</ThemedText>
								<ThemedText
									testID='verify-otp-subtitle'
									style={{
										fontWeight: 400,
										fontSize: 16,
										color: textColor,
										marginTop: 10,
									}}
									lightColor={textColor}
									darkColor={textColor}
								>
									{pending2FAMethod === 'totp'
										? translations[language].categories.auth[
												'setupAuthenticator.enterCodePlaceholder'
										  ] ?? 'Please enter code from your authenticator app'
										: translations[language].categories.auth['verify.subtitle']}
								</ThemedText>
							</ThemedView>
							<ThemedView
								style={styles.formInputs}
								lightColor={bg}
								darkColor={bg}
							>
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor: errors.code ? errorColor : inputBorder,
										},
									]}
									lightColor={textColor}
									darkColor={textColor}
									value={code}
									setValue={handleSetCode}
									placeholder={
										pending2FAMethod === 'totp'
											? translations[language].categories.auth[
													'setupAuthenticator.enterCodePlaceholder'
											  ]
											: translations[language].categories.auth['enterOTP']
									}
									placeholderTextColor={textColor}
									keyboardType='number-pad'
									onFocus={() => setFocusedInput('code')}
									onBlur={() => setFocusedInput(null)}
								/>

								{pending2FAMethod === 'totp' ? (
									<ThemedButton
										title={translations[language].categories.buttons[
											'verifyOTP'
										]?.toUpperCase()}
										onPress={async () => {
											// call TOTP verify handler
											handleToggleLoader(true);
											try {
												await handleVerify2FA(code);
											} finally {
												handleToggleLoader(false);
											}
										}}
										style={{ borderRadius: 8 }}
										darkColor={errors['login'] ? buttonError : bim}
										lightColor={errors['login'] ? buttonError : bim}
										darkTextColor={authButtonText}
										lightTextColor={authButtonText}
									/>
								) : (
									<ThemedButton
										title={translations[language].categories.buttons[
											'verifyOTP'
										]?.toUpperCase()}
										onPress={handleOnVerifyCode}
										style={{ borderRadius: 8 }}
										darkColor={errors['login'] ? buttonError : bim}
										lightColor={errors['login'] ? buttonError : bim}
										darkTextColor={authButtonText}
										lightTextColor={authButtonText}
									/>
								)}
							</ThemedView>
						</ThemedView>
					</ThemedView>
				</ParallaxScrollView>
			</FormContainer>
			<Loader
				showOverlay={loading}
				fadeAnim={loaderFadeAnim}
				toggleShowOverlay={handleToggleLoader}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'flex-start',
		alignItems: 'center',
	},
	header: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 20,
	},
	form: {
		flex: 1,
		flexDirection: 'column',
		width: '100%',
		alignItems: 'flex-start',
		paddingVertical: 20,
	},
	formHeader: {
		flexDirection: 'column',
	},
	formInputs: {
		flexDirection: 'column',
		width: '100%',
		marginVertical: 50,
		// backgroundColor moved inline to respect current colorScheme
		gap: 15,
	},
	formInput: {
		width: '100%',
		fontSize: 16,
		backgroundColor: undefined,
		borderRadius: 8,
		borderColor: undefined,
		borderWidth: 1,
		// color moved inline to respect current colorScheme
	},
});
