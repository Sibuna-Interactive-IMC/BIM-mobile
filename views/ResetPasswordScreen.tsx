import bimTextImg from '@/assets/images/bim-text-img.png';
import FormContainer from '@/components/FormContainer';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { emailRegex } from '@/constants';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
	Image,
	Platform,
	StyleSheet,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native';

export default function ResetPasswordScreen() {
	useTrackHistory('/(auth)/reset');
	const router = useRouter();
	const navigation = useNavigation();

	useEffect(() => {
		// ensure native header is visible with empty title (matches login/signup)
		try {
			navigation.setOptions?.({ headerShown: true, headerTitle: '' });
		} catch {}
		return () => {};
	}, [navigation]);
	const { language } = useGeneral();
	useColorScheme();
	const bg = useThemeColor({}, 'background');
	const headers = useThemeColor({}, 'headers');
	const textColor = useThemeColor({}, 'text');
	const inputContainerBackground = useThemeColor(
		{},
		'inputContainerBackground'
	);
	const bim = useThemeColor({}, 'bim');
	const authButtonText = useThemeColor({}, 'authButtonText');

	const [email, setEmail] = useState('');
	const [error, setError] = useState(false);

	const handleSendReset = () => {
		if (!emailRegex.test(email)) {
			setError(true);
			return;
		}
		setError(false);
		// Implement send reset link via API/context
		console.log('Send reset link to', email);
		// After sending, navigate back to login
		router.push('/(auth)/login');
	};

	return (
		<FormContainer
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'position' : 'padding'}
		>
			<ParallaxScrollView
				headerBackgroundColor={{
					light: bg,
					dark: bg,
				}}
			>
				<ThemedView style={styles.container} lightColor={bg} darkColor={bg}>
					<ThemedView style={styles.header} lightColor={bg} darkColor={bg}>
						<Image
							source={bimTextImg}
							style={{ height: 35, resizeMode: 'contain' }}
						/>
					</ThemedView>

					<ThemedView style={styles.formHeader} lightColor={bg} darkColor={bg}>
						<ThemedText
							style={{
								fontWeight: fontWeight['heading.one'],
								fontSize: fontSize['heading.one'],
								color: headers,
							}}
							lightColor={headers}
							darkColor={headers}
						>
							{translations[language].categories.auth['reset.title']}
						</ThemedText>
						<ThemedText
							style={{
								marginTop: 10,
								color: textColor,
							}}
						>
							{translations[language].categories.auth['reset.subtitle']}
						</ThemedText>
					</ThemedView>

					<ThemedView
						style={[
							styles.formInputs,
							{
								backgroundColor: inputContainerBackground,
							},
						]}
						lightColor={inputContainerBackground}
						darkColor={inputContainerBackground}
					>
						<ThemedInput
							value={email}
							setValue={(v) => {
								setEmail(v);
								if (error) setError(false);
							}}
							placeholder={translations[language].categories.auth.email}
							placeholderTextColor={textColor}
							keyboardType='email-address'
							containerStyle={{ width: '100%' }}
						/>

						<ThemedButton
							title={translations[language].categories.auth['reset.sendLink']}
							onPress={handleSendReset}
							style={{ borderRadius: 8 }}
							lightColor={bim}
							darkColor={bim}
							lightTextColor={authButtonText}
							darkTextColor={authButtonText}
							disabled={email.length === 0}
						/>

						<View
							style={{
								flexDirection: 'row',
								marginTop: 10,
								justifyContent: 'center',
							}}
						>
							<TouchableOpacity onPress={() => router.push('/(auth)/login')}>
								<ThemedView
									lightColor={bg}
									darkColor={bg}
									style={{ flexDirection: 'row', alignItems: 'center' }}
								>
									<IconSymbol name={'chevron.left'} size={16} color={bim} />
									<ThemedText style={{ color: bim, marginLeft: 8 }}>
										{
											translations[language].categories.auth[
												'reset.backToLogin'
											]
										}
									</ThemedText>
								</ThemedView>
							</TouchableOpacity>
						</View>
					</ThemedView>
				</ThemedView>
			</ParallaxScrollView>
		</FormContainer>
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
		width: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 20,
	},
	formHeader: {
		width: '100%',
		marginTop: 24,
	},
	formInputs: {
		width: '100%',
		marginTop: 24,
		gap: 12,
	},
});
