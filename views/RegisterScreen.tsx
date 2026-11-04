import bimTextImg from '@/assets/images/bim-text-img.png';
import FormContainer from '@/components/FormContainer';
import Loader from '@/components/Loader';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { emailRegex, passwordRegex, phoneRegexWithSpaces } from '@/constants';
// theme colors are provided via `useThemeColor`
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatPhoneNumber } from '@/helpers';
import { signalAppReady } from '@/helpers/appReady';
import { verifyToken } from '@/helpers/auth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
} from 'react-native';

const devWidth = Dimensions.get('window').width;

export default function RegisterScreen() {
	// track register screen
	useTrackHistory('/(auth)/index');

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
	// timeout ref
	const signupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const loaderFadeAnim = useAnimatedValue(0);
	const scrollRef = useRef<any>(null);
	useColorScheme();
	const { language, handleRegistration } = useGeneral();

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
	const tint = useThemeColor({}, 'tint');
	const [fullName, setFullName] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [focusedInput, setFocusedInput] = useState<string | null>(null);

	const [errors, setErrors] = useState({
		phoneNumber: false,
		fullName: false,
		email: false,
		password: false,
		confirmPassword: false,
		signup: false,
	});

	useFocusEffect(() => {
		const onPressBack = () => {
			if (navigation.canGoBack()) {
				handleResetAll();
				if (signupTimeoutRef.current) {
					clearTimeout(signupTimeoutRef.current);
				}
				navigation.goBack();
				return true;
			}
		};
		const subscription = BackHandler.addEventListener(
			'hardwareBackPress',
			onPressBack
		);
		return () => subscription.remove();
	});

	// Autofill registration fields for local development manual testing.
	// Guarded by __DEV__ so this never runs in production builds.
	useEffect(() => {
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			// Development test credentials for registration (direct setters to avoid hook deps)
			setFullName('Test User');
			setPhoneNumber(formatPhoneNumber('0789244866'));
			setEmail('test@example.com');
			setPassword('mystBim1234.');
			setConfirmPassword('mystBim1234.');
			setErrors((prev) => ({
				...prev,
				phoneNumber: false,
				fullName: false,
				email: false,
				password: false,
				confirmPassword: false,
			}));
		}
	}, []);

	useEffect(() => {
		const subscription = navigation.addListener('blur', () => {
			if (signupTimeoutRef.current) {
				clearTimeout(signupTimeoutRef.current);
			}
			handleResetAll();
		});
		return subscription;
	}, [navigation]);

	useEffect(() => {
		const verify = async () => {
			try {
				const token = await AsyncStorage.getItem('bim-token');
				const isValid = await verifyToken(token || '');
				if (isValid) {
					router.replace({
						pathname: '/(authenticated)/home',
						params: { token },
					});
				}
			} catch {
				// ignore verification errors on startup
			}
		};
		verify();
	}, [router]);

	useEffect(() => {
		if (focusedInput) {
			setErrors((prev) => ({ ...prev, [focusedInput]: false }));
		}
	}, [focusedInput]);

	// Auto-scroll focused input into view when focusedInput changes
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
		// try a few times to account for animation timing
		doScroll();
		const t1 = setTimeout(doScroll, 60);
		const t2 = setTimeout(doScroll, 140);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, [focusedInput]);

	const handleSetFullName = (value: string): void => {
		if (value.length >= 3) {
			setErrors((prev) => ({ ...prev, fullName: false }));
		} else {
			setErrors((prev) => ({ ...prev, fullName: true }));
		}
		setFullName(value);
	};

	const handleSetPhone = (value: string): void => {
		const phoneNumber = formatPhoneNumber(value);
		if (!phoneNumber || !phoneRegexWithSpaces.test(phoneNumber)) {
			setErrors((prev) => ({ ...prev, phoneNumber: true }));
		} else {
			setErrors((prev) => ({ ...prev, phoneNumber: false }));
		}
		setPhoneNumber(phoneNumber);
	};

	const handleSetEmail = (value: string): void => {
		if ((emailRegex.test(email) && email) || !email) {
			setErrors((prev) => ({ ...prev, email: false }));
		}
		setEmail(value);
	};

	const handleSetPassword = (value: string): void => {
		if ((passwordRegex.test(password) && password) || !password) {
			setErrors((prev) => ({ ...prev, password: false }));
		}
		setPassword(value);
	};

	const handleSetConfirmPassword = (value: string): void => {
		if (value === password) {
			setErrors((prev) => ({ ...prev, confirmPassword: false }));
		} else {
			setErrors((prev) => ({ ...prev, confirmPassword: true }));
		}
		setConfirmPassword(value);
	};

	const handleOnSignUp = async () => {
		if (
			fullName.length < 3 ||
			!phoneRegexWithSpaces.test(phoneNumber) ||
			!emailRegex.test(email) ||
			!passwordRegex.test(password) ||
			confirmPassword !== password
		) {
			setErrors({
				fullName: fullName.length < 3,
				phoneNumber: !phoneRegexWithSpaces.test(phoneNumber),
				email: !emailRegex.test(email),
				password: !passwordRegex.test(password),
				confirmPassword: !confirmPassword || confirmPassword !== password,
				signup: true,
			});
			return;
		}
		try {
			handleToggleLoader(true);
			if (signupTimeoutRef.current) {
				clearTimeout(signupTimeoutRef.current);
			}
			// Delegate to global registration handler which will set appMessage on error
			await handleRegistration({
				phone: phoneNumber,
				password,
				name: fullName,
				email,
			});
		} catch (error) {
			setErrors((prev) => ({ ...prev, signup: true }));
			console.error('Signup error:', error);
		} finally {
			handleToggleLoader(false);
		}
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
		setFullName('');
		setPhoneNumber('');
		setEmail('');
		setPassword('');
		setConfirmPassword('');
		setFocusedInput(null);
		setErrors({
			phoneNumber: false,
			fullName: false,
			email: false,
			password: false,
			confirmPassword: false,
			signup: false,
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
									{translations[language].categories.auth['signUp.title']}
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
									{translations[language].categories.auth['signUp.subtitle']}
								</ThemedText>
							</ThemedView>
							<ThemedView
								testID='TID-reg-form'
								style={styles.formInputs}
								lightColor={inputContainerBackground}
								darkColor={inputContainerBackground}
							>
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor: errors.fullName ? errorColor : inputBorder,
										},
									]}
									lightColor={textColor}
									darkColor={textColor}
									value={fullName}
									setValue={handleSetFullName}
									placeholder={
										translations[language].categories.auth['fullName']
									}
									placeholderTextColor={textColor}
									keyboardType='default'
									onFocus={() => setFocusedInput('fullName')}
									onBlur={() => setFocusedInput(null)}
								/>
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor: errors.phoneNumber
												? errorColor
												: inputBorder,
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
									onFocus={() => setFocusedInput('phoneNumber')}
									onBlur={() => setFocusedInput(null)}
								/>
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor: errors.email ? errorColor : inputBorder,
										},
									]}
									lightColor={textColor}
									darkColor={textColor}
									value={email}
									setValue={handleSetEmail}
									placeholder={translations[language].categories.auth['email']}
									placeholderTextColor={textColor}
									keyboardType='email-address'
									onFocus={() => setFocusedInput('email')}
									onBlur={() => setFocusedInput(null)}
								/>
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor: errors.password ? errorColor : inputBorder,
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
								<ThemedInput
									style={[
										styles.formInput,
										{
											borderColor:
												focusedInput === 'confirmPassword'
													? tint
													: errors.confirmPassword
													? errorColor
													: inputBorder,

											backgroundColor: inputBackground,
											color: textColor,
										},
									]}
									lightColor={textColor}
									darkColor={textColor}
									value={confirmPassword}
									secureTextEntry={true}
									setValue={handleSetConfirmPassword}
									placeholder={
										translations[language].categories.auth['confirmPassword']
									}
									placeholderTextColor={textColor}
									keyboardType='default'
									onFocus={() => setFocusedInput('confirmPassword')}
									onBlur={() => setFocusedInput(null)}
								/>
								<ThemedButton
									title={translations[language].categories.buttons[
										'signUp'
									]?.toUpperCase()}
									onPress={handleOnSignUp}
									style={{
										borderRadius: 8,
									}}
									darkColor={errors['signup'] ? buttonError : bim}
									lightColor={errors['signup'] ? buttonError : bim}
									darkTextColor={authButtonText}
									lightTextColor={authButtonText}
								/>
								<ThemedView
									style={{
										flexDirection: 'row',
										marginTop: 10,
										alignItems: 'center',
										justifyContent: 'center',
									}}
									lightColor={bg}
									darkColor={bg}
								>
									<ThemedText
										style={{
											fontSize: fontSize['text.large'],
											color: textColor,
											textAlign: 'center',
										}}
										lightColor={textColor}
										darkColor={textColor}
									>
										{translations[language].categories.auth['haveAnAccount']}{' '}
									</ThemedText>
									<TouchableOpacity
										style={{
											flexDirection: 'row',
											backgroundColor: 'transparent',
											alignItems: 'center',
										}}
										onPress={() => router.push('/(auth)/login')}
									>
										<ThemedText style={{ color: bim }}>
											{translations[language].categories.auth['signIn']}
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
