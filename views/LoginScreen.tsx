import bimTextImg from '@/assets/images/bim-text-img.png';
import FormContainer from '@/components/FormContainer';
import Loader from '@/components/Loader';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { passwordRegex, phoneRegexWithSpaces } from '@/constants';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatPhoneNumber } from '@/helpers';
import { signalAppReady } from '@/helpers/appReady';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
	Animated,
	BackHandler,
	Dimensions,
	findNodeHandle,
	Image,
	Platform,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	useAnimatedValue,
	useColorScheme,
} from 'react-native';

const devWidth = Dimensions.get('window').width;

export default function LoginScreen() {
	useTrackHistory('/(auth)/login');

	// Signal readiness after two paint frames so layout can hide splash.
	useEffect(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				signalAppReady();
			});
		});
	}, []);
	const router = useRouter();
	const navigation = useNavigation();
	const loaderFadeAnim = useAnimatedValue(0);
	useColorScheme();
	const bg = useThemeColor({}, 'background');
	const headers = useThemeColor({}, 'headers');
	const textColor = useThemeColor({}, 'text');
	const inputContainerBackground = useThemeColor(
		{},
		'inputContainerBackground'
	);
	const inputBorder = useThemeColor({}, 'inputBorder');
	const inputBackground = useThemeColor({}, 'inputBackground');
	const bim = useThemeColor({}, 'bim');
	const errorColor = useThemeColor({}, 'error');
	const buttonError = useThemeColor({}, 'buttonError');
	const authButtonText = useThemeColor({}, 'authButtonText');
	const scrollRef = useRef<any>(null);
	const { handleAuthentication, language } = useGeneral(); // Get authenticate function from context
	const [phoneNumber, setPhoneNumber] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [focusedInput, setFocusedInput] = useState<string | null>(null);
	const [errors, setErrors] = useState({
		phone: false,
		password: false,
		login: false,
	});

	// Autofill credentials for local development manual testing.
	// Guarded by __DEV__ so this never runs in production builds.
	useEffect(() => {
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			// Development test credentials
			setPhoneNumber(formatPhoneNumber('0789244866'));
			setPassword('mystBim1234.');
		}
	}, []);

	useFocusEffect(() => {
		const sub = () => {
			if (navigation.canGoBack()) {
				handleResetAll();
				navigation.goBack();
				return true;
			}
		};
		const backHandler = BackHandler.addEventListener('hardwareBackPress', sub);
		return () => backHandler.remove();
	});

	useEffect(() => {
		const subscription = navigation.addListener('blur', () => {
			handleResetAll();
		});
		return subscription;
	}, [navigation]);

	useEffect(() => {
		if (focusedInput) {
			setErrors((prev) => ({ ...prev, [focusedInput]: false }));
		}
	}, [focusedInput]);

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

	const handleSetPhone = (value: string): void => {
		const phoneNumber = formatPhoneNumber(value);
		if (!phoneNumber || !phoneRegexWithSpaces.test(phoneNumber)) {
			setErrors((prev) => ({ ...prev, phone: true }));
		} else {
			setErrors((prev) => ({ ...prev, phone: false }));
		}
		setPhoneNumber(phoneNumber);
	};
	const handleSetPassword = (value: string): void => {
		if ((passwordRegex.test(password) && password) || !password) {
			setErrors((prev) => ({ ...prev, password: false }));
		}
		setPassword(value);
	};

	const handleOnLogin = async () => {
		if (
			!phoneRegexWithSpaces.test(phoneNumber) ||
			!passwordRegex.test(password)
		) {
			setErrors({
				phone: !phoneRegexWithSpaces.test(phoneNumber),
				password: !passwordRegex.test(password),
				login: true,
			});
			return;
		}
		handleToggleLoader(true);
		try {
			// Call your signup API here
			await handleAuthentication({
				number: phoneNumber,
				password,
			});
		} catch (error) {
			setErrors((prev) => ({ ...prev, signup: true }));
			console.error('Login error:', error);
		}
		handleToggleLoader(false);
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

	const handleResetAll = () => {
		setPhoneNumber('');
		setPassword('');
		setFocusedInput(null);
		setErrors({
			phone: false,
			password: false,
			login: false,
		});
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
										fontWeight: fontWeight['heading.one'],
										fontSize: fontSize['heading.one'],
										color: headers,
									}}
									lightColor={headers}
									darkColor={headers}
								>
									{translations[language].categories.auth['signIn.title']}
								</ThemedText>
								<ThemedText
									style={{
										fontWeight: fontWeight['heading.three'],
										fontSize: fontSize['heading.three'],
										color: textColor,
										marginTop: 10,
									}}
									lightColor={textColor}
									darkColor={textColor}
								>
									{translations[language].categories.auth['signIn.subtitle']}
								</ThemedText>
							</ThemedView>
							<ThemedView
								style={[
									styles.formInputs,
									{
										backgroundColor: inputContainerBackground,
									},
								]}
								lightColor={bg}
								darkColor={bg}
							>
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor: errors.phone ? errorColor : inputBorder,
										},
									]}
									lightColor={textColor}
									darkColor={textColor}
									value={phoneNumber}
									setValue={handleSetPhone}
									placeholder={
										translations[language].categories.auth['phoneNumber']
									}
									placeholderTextColor={textColor}
									keyboardType='number-pad'
									onFocus={() => setFocusedInput('phone')}
									onBlur={() => setFocusedInput(null)}
								/>
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor: errors.password ? errorColor : inputBorder,

											backgroundColor: inputBackground,
											color: textColor,
										},
									]}
									lightColor={textColor}
									darkColor={textColor}
									value={password}
									secureTextEntry={true}
									setValue={handleSetPassword}
									placeholder={
										translations[language].categories.auth['password']
									}
									placeholderTextColor={textColor}
									keyboardType='default'
									onFocus={() => setFocusedInput('password')}
									onBlur={() => setFocusedInput(null)}
								/>
								<ThemedButton
									title={translations[language].categories.buttons[
										'signIn'
									]?.toUpperCase()}
									onPress={handleOnLogin}
									style={{
										borderRadius: 8,
									}}
									darkColor={errors['login'] ? buttonError : bim}
									lightColor={errors['login'] ? buttonError : bim}
									darkTextColor={authButtonText}
									lightTextColor={authButtonText}
								/>
								<ThemedView
									style={{
										flexDirection: 'row',
										marginTop: 10,
										alignItems: 'center',
										justifyContent: 'space-between',
									}}
								>
									<TouchableOpacity
										style={{
											flexDirection: 'row',
											backgroundColor: 'transparent',
											alignItems: 'center',
										}}
										onPress={() => router.push('/(auth)/reset')}
									>
										<ThemedText style={{ color: bim }}>
											{translations[language].categories.auth['forgotPassword']}
										</ThemedText>
									</TouchableOpacity>
									<TouchableOpacity
										style={{
											flexDirection: 'row',
											backgroundColor: 'transparent',
											alignItems: 'center',
										}}
										onPress={() => router.push('/(auth)')}
									>
										<ThemedText style={{ color: bim }}>
											{translations[language].categories.auth['signUp']}
										</ThemedText>
									</TouchableOpacity>
								</ThemedView>
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
		gap: 15,
	},
	formInput: {
		width: '100%',
		fontSize: fontSize['input.large'],
		borderRadius: 8,
		borderWidth: 1,
	},
});
