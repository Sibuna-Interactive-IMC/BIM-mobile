import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
// avoid importing navigation types from @react-navigation/drawer which may not export them in some versions
import useTrackHistory from '@/hooks/useTrackHistory';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';

export default function ProfileScreen() {
	useTrackHistory('/(authenticated)/profile');
	const { user, setUser } = useGeneral();
	const { language } = useGeneral();
	const navigation = useNavigation<any>();

	const bg = useThemeColor({}, 'background');
	const headingOne = useThemeColor({}, 'heading.one');
	const headers = useThemeColor({}, 'headers');
	const textColor = useThemeColor({}, 'text');
	const bim = useThemeColor({}, 'bim');
	const secondaryButton = useThemeColor({}, 'secondaryButton');
	const authButtonText = useThemeColor({}, 'authButtonText');
	const dangerButton = useThemeColor({}, 'dangerButton');
	const white = useThemeColor({}, 'white');

	console.log("[Profile] user", user)

	useFocusEffect(() => {
		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				if (navigation.canGoBack()) {
					navigation.goBack();
					return true;
				}
				return false;
			}
		);
		return () => backHandler.remove();
	});

	// Tile 1: Profile details
	const [fullName, setFullName] = useState(user?.name ?? '');
	const [email, setEmail] = useState(user?.email ?? '');
	const profileChanged = useMemo(
		() => fullName !== (user?.name ?? '') || email !== (user?.email ?? ''),
		[fullName, email, user?.name, user?.email]
	);

	// Tile 2: Change password
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	const passwordChangeValid = useMemo(() => {
		return (
			currentPassword.length > 0 &&
			newPassword.length > 0 &&
			newPassword === confirmPassword
		);
	}, [currentPassword, newPassword, confirmPassword]);

	// Tile 3: Delete account (confirmation handled elsewhere)

	const handleSaveProfile = useCallback(() => {
		if (user)
			setUser({ ...user, name: fullName, email });
	}, [user, email, fullName, setUser]);

	const handleUpdatePassword = () => {
		// Implement password update flow (call API/context)
		console.log('Update password', {
			currentPassword,
			newPassword,
			confirmPassword,
		});
	};

	const handleDeleteAccount = () => {
		// Implement delete account flow (confirm modal + API call)
		console.log('Delete account');
	};

	return (
		<ParallaxScrollView
			headerBackgroundColor={{
				light: bg,
				dark: bg,
			}}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
		>
			<TileContainer
				id='profile-header-tile'
				flat
				backgroundColor={bg}
				style={{ width: '100%', marginBottom: 12 }}
			>
				<ScreenHeader
					id='profile-header'
					title={translations[language].categories.auth['profile.details.title']}
				/>
			</TileContainer>

						<TileContainer
				id='profile-content-tile'
				flat
				backgroundColor={bg}
				style={{ width: '100%', gap: 12 }}
			>
			<TileContainer
				id={'profile-details'}
				borderless
				backgroundColor={bg}
				style={{ marginBottom: 16, alignItems: 'stretch' }}
			>
				<ThemedText
					style={{
						fontSize: fontSize['heading.three'],
						fontWeight: fontWeight['heading.three'],
					}}
					lightColor={headingOne}
					darkColor={headingOne}
				>
					{translations[language].categories.auth['profile.details.title']}
				</ThemedText>

				<ThemedText
					style={{
						fontSize: fontSize['heading.one'],
						fontWeight: fontWeight['heading.one'],
						marginTop: 4,
					}}
					lightColor={headers}
					darkColor={headers}
				>
					{translations[language].categories.auth['profile.details.subtitle']}
				</ThemedText>

				<ThemedText
					style={{ marginTop: 8 }}
					lightColor={textColor}
					darkColor={textColor}
				>
					{
						translations[language].categories.auth[
						'profile.details.description'
						]
					}
				</ThemedText>

				<View style={{ marginTop: 12 }}>
					<ThemedInput
						label={
							translations[language].categories.auth[
							'profile.placeholder.fullName'
							]
						}
						value={fullName}
						setValue={setFullName}
						placeholder={'John Doe'}
						containerStyle={{ marginBottom: 8, width: '100%' }}
					/>
					<ThemedInput
						label={
							translations[language].categories.auth[
							'profile.placeholder.email'
							]
						}
						value={email}
						setValue={setEmail}
						placeholder={
							translations[language].categories.auth[
							'profile.placeholder.email'
							]
						}
						keyboardType='email-address'
						containerStyle={{ width: '100%' }}
					/>
				</View>

				<View style={{ marginTop: 12, alignItems: 'flex-end' }}>
					<ThemedButton
						title={
							translations[language].categories.auth['profile.details.button']
						}
						icon='check'
						onPress={handleSaveProfile}
						lightColor={profileChanged ? bim : secondaryButton}
						darkColor={profileChanged ? bim : secondaryButton}
						lightTextColor={authButtonText}
						darkTextColor={authButtonText}
						disabled={!profileChanged}
					/>
				</View>
			</TileContainer>

			{/* Tile 2: Change Password */}
			<TileContainer
				id={'change-password'}
				borderless
				backgroundColor={bg}
				style={{ marginBottom: 16, alignItems: 'stretch' }}
			>
				<ThemedText
					style={{
						fontSize: fontSize['heading.three'],
						fontWeight: fontWeight['heading.three'],
					}}
					lightColor={headingOne}
					darkColor={headingOne}
				>
					{translations[language].categories.auth['profile.password.title']}
				</ThemedText>

				<ThemedText
					style={{
						fontSize: fontSize['heading.one'],
						fontWeight: fontWeight['heading.one'],
						marginTop: 4,
					}}
					lightColor={headers}
					darkColor={headers}
				>
					{translations[language].categories.auth['profile.password.subtitle']}
				</ThemedText>

				<ThemedText
					style={{ marginTop: 8 }}
					lightColor={textColor}
					darkColor={textColor}
				>
					{
						translations[language].categories.auth[
						'profile.password.description'
						]
					}
				</ThemedText>

				<View style={{ marginTop: 12 }}>
					<ThemedInput
						label={
							translations[language].categories.auth[
							'profile.placeholder.currentPassword'
							]
						}
						value={currentPassword}
						setValue={setCurrentPassword}
						placeholder={'••••••••'}
						secureTextEntry
						containerStyle={{ marginBottom: 8, width: '100%' }}
					/>
					<ThemedInput
						label={
							translations[language].categories.auth[
							'profile.placeholder.newPassword'
							]
						}
						value={newPassword}
						setValue={setNewPassword}
						placeholder={'••••••••'}
						secureTextEntry
						containerStyle={{ marginBottom: 8, width: '100%' }}
					/>
					<ThemedInput
						label={
							translations[language].categories.auth[
							'profile.placeholder.confirmPassword'
							]
						}
						value={confirmPassword}
						setValue={setConfirmPassword}
						placeholder={'••••••••'}
						secureTextEntry
						containerStyle={{ width: '100%' }}
					/>
				</View>

				<View style={{ marginTop: 12, alignItems: 'flex-end' }}>
					<ThemedButton
						title={
							translations[language].categories.auth['profile.password.button']
						}
						icon='check'
						onPress={handleUpdatePassword}
						lightColor={passwordChangeValid ? bim : secondaryButton}
						darkColor={passwordChangeValid ? bim : secondaryButton}
						lightTextColor={authButtonText}
						darkTextColor={authButtonText}
						disabled={!passwordChangeValid}
					/>
				</View>
			</TileContainer>

			{/* Tile 3: Delete Account */}
			<TileContainer
				id={'delete-account'}
				borderless
				backgroundColor={bg}
				style={{ marginBottom: 16, alignItems: 'stretch' }}
			>
				<ThemedText
					style={{
						fontSize: fontSize['heading.three'],
						fontWeight: fontWeight['heading.three'],
					}}
					lightColor={headingOne}
					darkColor={headingOne}
				>
					{translations[language].categories.auth['profile.delete.title']}
				</ThemedText>

				<ThemedText
					style={{
						fontSize: fontSize['heading.one'],
						fontWeight: fontWeight['heading.one'],
						marginTop: 4,
					}}
					lightColor={headers}
					darkColor={headers}
				>
					{translations[language].categories.auth['profile.delete.subtitle']}
				</ThemedText>

				<ThemedText
					style={{ marginTop: 8 }}
					lightColor={textColor}
					darkColor={textColor}
				>
					{translations[language].categories.auth['profile.delete.description']}
				</ThemedText>

				<View style={{ marginTop: 12, alignItems: 'flex-end' }}>
					<ThemedButton
						title={
							translations[language].categories.auth['profile.delete.button']
						}
						icon='delete.outline'
						onPress={handleDeleteAccount}
						lightColor={dangerButton}
						darkColor={dangerButton}
						lightTextColor={white}
						darkTextColor={white}
					/>
				</View>
			</TileContainer>
			</TileContainer>
		</ParallaxScrollView>
	);
}
