import avatarMaleImg from '@/assets/images/avatar-male.png';
import { fontSize } from '@/constants/Font';
import translations from '@/constants/Trans';
import { searchFeatures, type AppFeature } from '@/helpers/featureSearch';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
	headerOptions,
	langCode,
	notifications,
	User as UserProps,
} from '@/types';
import { useNavigation, useRouter } from 'expo-router';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	Animated,
	Image,
	Platform,
	ScrollView,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	useAnimatedValue,
	View,
} from 'react-native';
import { SvgUri } from 'react-native-svg';
import HeaderDropDownContainer from './HeaderDropDownContainer';
import { ThemedButton } from './ThemedButton';
import { ThemedInput } from './ThemedInput';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';

export type HeaderProps = {
	goback?: boolean;
	user?: UserProps | null;
	handleLogout: () => void;
	language: langCode;
	setLanguage: (lang: langCode) => void;
	notifications: notifications[];
	setNotifications: React.Dispatch<React.SetStateAction<notifications[]>>;
	selectedOption?: headerOptions;
	setSelectedOption: React.Dispatch<React.SetStateAction<headerOptions>>;
	online: boolean;
	handleGoBack?: () => void;
};

const AVATAR_SIZE = 40;

// The API returns avatar urls pointing at SVG files, which the native <Image /> cannot render
const isSvgAvatar = (uri?: string | null) => {
	if (!uri) return false;
	const normalized = uri.toLowerCase();
	return (
		normalized.startsWith('data:image/svg+xml') ||
		/\.svg([?#]|$)/.test(normalized)
	);
};

const AvatarPlaceholder = () => (
	<Image
		source={avatarMaleImg}
		style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
	/>
);

type UserAvatarProps = {
	uri?: string | null;
	online: boolean;
};

type AvatarStage = 'image' | 'svg' | 'placeholder';

const getInitialAvatarStage = (uri?: string | null): AvatarStage => {
	if (!uri) return 'placeholder';
	// Browsers render SVG inside <img>, so the plain <Image /> is enough on web
	if (Platform.OS === 'web') return 'image';
	return isSvgAvatar(uri) ? 'svg' : 'image';
};

function UserAvatar({ uri, online }: UserAvatarProps) {
	const [stage, setStage] = useState<AvatarStage>(() =>
		getInitialAvatarStage(uri)
	);

	const handleError = useCallback(() => {
		setStage((prev) =>
			prev === 'image' && Platform.OS !== 'web' ? 'svg' : 'placeholder'
		);
	}, []);

	// Give a changed avatar url a fresh attempt
	useEffect(() => {
		setStage(getInitialAvatarStage(uri));
	}, [uri]);

	const statusColor = useThemeColor({}, online ? 'lime' : 'error');
	const statusRingColor = useThemeColor({}, 'white');

	return (
		<ThemedView
			lightColor='transparent'
			darkColor='transparent'
			style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, position: 'relative' }}
		>
			<ThemedView
				lightColor='transparent'
				darkColor='transparent'
				style={{
					width: AVATAR_SIZE,
					height: AVATAR_SIZE,
					borderRadius: AVATAR_SIZE / 2,
					overflow: 'hidden',
				}}
			>
				{stage === 'svg' && uri ? (
					<SvgUri
						uri={uri}
						width={AVATAR_SIZE}
						height={AVATAR_SIZE}
						onError={handleError}
						fallback={<AvatarPlaceholder />}
					/>
				) : stage === 'image' && uri ? (
					<Image
						source={{ uri }}
						style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
						onError={handleError}
					/>
				) : (
					<AvatarPlaceholder />
				)}
			</ThemedView>
			<ThemedView
				lightColor={statusColor}
				darkColor={statusColor}
				style={{
					position: 'absolute',
					bottom: 0,
					right: 0,
					width: 10,
					height: 10,
					borderWidth: 2,
					borderColor: statusRingColor,
					borderRadius: 5,
				}}
			/>
		</ThemedView>
	);
}

export default function Header({
	goback,
	user,
	handleLogout,
	language,
	setLanguage,
	notifications,
	setNotifications,
	selectedOption,
	setSelectedOption,
	online,
	handleGoBack,
}: HeaderProps) {
	const router = useRouter();
	const profileAnimValue = useAnimatedValue(0);
	const searchAnimValue = useAnimatedValue(0);
	const notificationsAnimValue = useAnimatedValue(0);
	const languageAnimValue = useAnimatedValue(0);
	const navigation = useNavigation<any>();
	const [searchValue, setSearchValue] = useState('');
	const [showSearchInput, setShowSearchInput] = useState(false);
	const [showLanguageSelection, setShowLanguageSelection] = useState(false);
	const [showNotifications, setShowNotifications] = useState(false);
	const [showProfile, setShowProfile] = useState(false);
	const searchInputRef = useRef<TextInput>(null);

	const featuresCopy =
		translations[language]?.categories?.features ??
		translations.en.categories.features;
	const searchResults = useMemo(
		() => searchFeatures(searchValue, user, language),
		[searchValue, user, language]
	);
	const showSearchResults = showSearchInput && searchValue.trim().length > 0;

	const selectFeature = useCallback(
		(feature: AppFeature) => {
			setSearchValue('');
			setSelectedOption(undefined);
			router.push(feature.path);
		},
		[router, setSelectedOption]
	);

	// The input is always mounted (only hidden while collapsed), so focus it once it expands
	useEffect(() => {
		if (!showSearchInput) return;
		const timer = setTimeout(() => searchInputRef.current?.focus(), 0);
		return () => clearTimeout(timer);
	}, [showSearchInput]);

	const toggleDrawer = (back?: boolean) => {
		setSelectedOption(undefined);
		if (back) {
			// prefer app-level history navigation when available
			if (handleGoBack) handleGoBack();
			else navigation.goBack();
		} else {
			navigation.toggleDrawer();
		}
	};

	const toggleLanguageSelection = useCallback(
		(v?: boolean) => {
			setShowLanguageSelection((prev) => {
				const newvalue = v ?? !prev;
				if (newvalue) {
					Animated.timing(languageAnimValue, {
						toValue: 1, // Example animation value change
						duration: 200,
						useNativeDriver: false,
					}).start();
				} else {
					Animated.timing(languageAnimValue, {
						toValue: 0, // Reset animation value
						duration: 150,
						useNativeDriver: false,
					}).start();
				}
				return newvalue;
			});
		},
		[languageAnimValue]
	);

	const toggleSearchInput = useCallback(
		(v?: boolean) => {
			setShowSearchInput((prev) => {
				const newvalue = v ?? !prev;
				if (newvalue) {
					Animated.timing(searchAnimValue, {
						toValue: 1, // Example animation value change
						duration: 200,
						useNativeDriver: true,
					}).start();
				} else {
					Animated.timing(searchAnimValue, {
						toValue: 0, // Reset animation value
						duration: 150,
						useNativeDriver: true,
					}).start();
				}
				return newvalue;
			});
		},
		[searchAnimValue]
	);

	const toggleNotifications = useCallback(
		(v?: boolean) => {
			setShowNotifications((prev) => {
				const newvalue = v ?? !prev;
				if (newvalue) {
					Animated.timing(notificationsAnimValue, {
						toValue: 1, // Example animation value change
						duration: 200,
						useNativeDriver: true,
					}).start();
				} else {
					Animated.timing(notificationsAnimValue, {
						toValue: 0, // Reset animation value
						duration: 150,
						useNativeDriver: true,
					}).start();
				}
				return newvalue;
			});
		},
		[notificationsAnimValue]
	);

	const headingOneColor = useThemeColor({}, 'heading.one');

	// Theme-aware color helpers
	const headerBackground = useThemeColor({}, 'headerBackground');
	const headerDropdownBackground = useThemeColor({}, 'headerDropdownBackground');
	const textColor = useThemeColor({}, 'text');
	const headerIcons = useThemeColor({}, 'headerIcons');
	const inputBackground = useThemeColor({}, 'inputBackground');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const border = useThemeColor({}, 'border');
	const background = useThemeColor({}, 'background');
	const listItemBackground = useThemeColor({}, 'listItemBackground');
	const mutedTextColor = useThemeColor({}, 'mutedText');
	const languageButtonBackground = useThemeColor(
		{},
		'languageButtonBackground'
	);
	const notificationsCount = useThemeColor({}, 'notificationsCount');
	const notificationsCountBackground = useThemeColor(
		{},
		'notificationsCountBackground'
	);
	const bimLight = useThemeColor({}, 'bim', 'light');
	const bimDark = useThemeColor({}, 'bim', 'dark');
	const authButtonTextLight = useThemeColor({}, 'authButtonText', 'light');
	const authButtonTextDark = useThemeColor({}, 'authButtonText', 'dark');

	const toggleProfile = useCallback(
		(v?: boolean) => {
			setShowProfile((prev) => {
				const newvalue = v ?? !prev;
				if (newvalue) {
					Animated.timing(profileAnimValue, {
						toValue: 1, // Example animation value change
						duration: 200,
						useNativeDriver: true,
					}).start();
				} else {
					Animated.timing(profileAnimValue, {
						toValue: 0, // Reset animation value
						duration: 150,
						useNativeDriver: true,
					}).start();
				}
				return newvalue;
			});
		},
		[profileAnimValue]
	);

	useEffect(() => {
		if (!selectedOption) {
			toggleLanguageSelection(false);
			toggleSearchInput(false);
			toggleNotifications(false);
			toggleProfile(false);
		} else if (selectedOption === 'notifications') {
			toggleLanguageSelection(false);
			toggleSearchInput(false);
			toggleProfile(false);
			toggleNotifications(true);
		} else if (selectedOption === 'profile') {
			toggleLanguageSelection(false);
			toggleSearchInput(false);
			toggleNotifications(false);
			toggleProfile(true);
		} else if (selectedOption === 'language') {
			toggleSearchInput(false);
			toggleNotifications(false);
			toggleProfile(false);
			toggleLanguageSelection(true);
		} else if (selectedOption === 'search') {
			toggleLanguageSelection(false);
			toggleNotifications(false);
			toggleProfile(false);
			toggleSearchInput(true);
		}
	}, [
		selectedOption,
		toggleNotifications,
		toggleProfile,
		toggleLanguageSelection,
		toggleSearchInput,
	]);

	return (
		<ThemedView
			lightColor={headerBackground}
			darkColor={headerBackground}
			style={[styles.container]}
		>
			<Animated.View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					flex: 1,
				}}
			>
				<TouchableOpacity onPress={() => toggleDrawer(goback)}>
					<IconSymbol
						name={goback ? 'chevron.left' : 'menu'}
						size={24}
						color={textColor}
						style={{ marginRight: 10 }}
					/>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() =>
						selectedOption === 'search'
							? setSelectedOption(undefined)
							: setSelectedOption('search')
					}
				>
					<IconSymbol
						name='search.outline'
						size={24}
						color={headerIcons}
						style={{ marginRight: 10 }}
					/>
				</TouchableOpacity>
			</Animated.View>
			<Animated.View
				id='test-id-header-search'
				style={{
					opacity: searchAnimValue,
					transform: [{ scaleX: searchAnimValue }],
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center',
					flex: 2,
				}}
			>
				<ThemedInput
					ref={searchInputRef}
					lightColor={textColor}
					darkColor={textColor}
					containerStyle={{ height: 40, flex: 1, marginLeft: 10 }}
					style={{
						display: showSearchInput ? 'flex' : 'none',
						fontSize: fontSize['text.medium'],
						height: 40,
						paddingVertical: 0,
						backgroundColor: inputBackground,
					}}
					placeholder={featuresCopy.searchPlaceholder}
					value={searchValue}
					setValue={setSearchValue}
					autoCapitalize='none'
					autoCorrect={false}
					returnKeyType='search'
					onSubmitEditing={() => {
						if (searchResults.length > 0)
							selectFeature(searchResults[0].feature);
					}}
				/>
			</Animated.View>
			<ThemedView
				lightColor={headerBackground}
				darkColor={headerBackground}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'flex-end',
					gap: 10,
					flex: 3,
				}}
			>
				<TouchableOpacity
					onPress={() =>
						selectedOption === 'language'
							? setSelectedOption(undefined)
							: setSelectedOption('language')
					}
				>
					<IconSymbol
						name='translate'
						size={24}
						color={headerIcons}
						style={{ marginRight: 10 }}
					/>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() =>
						selectedOption === 'notifications'
							? setSelectedOption(undefined)
							: setSelectedOption('notifications')
					}
				>
					{notifications &&
						notifications.length > 0 &&
						notifications.filter((n) => !n.isRead).length > 0 ? (
						<IconSymbol
							name='notifications.outline.badge'
							size={24}
							color={headerIcons}
							style={{ marginRight: 10 }}
						/>
					) : (
						<IconSymbol
							name='notifications.outline'
							size={24}
							color={headerIcons}
							style={{ marginRight: 10 }}
						/>
					)}
				</TouchableOpacity>
				<TouchableOpacity
					style={{
						position: 'relative',
						height: 40,
					}}
					onPress={() =>
						selectedOption === 'profile'
							? setSelectedOption(undefined)
							: setSelectedOption('profile')
					}
				>
					<UserAvatar uri={user?.avatar_url} online={online} />
				</TouchableOpacity>
			</ThemedView>
			<HeaderDropDownContainer
				id='header-search-results'
				visible={showSearchResults}
				fadeAnim={searchAnimValue}
			>
				<ScrollView
					style={{ maxHeight: 280, backgroundColor: headerDropdownBackground }}
					contentContainerStyle={{ flexGrow: 1 }}
					keyboardShouldPersistTaps='handled'
					keyboardDismissMode='on-drag'
					nestedScrollEnabled={true}
					showsVerticalScrollIndicator={true}
					testID='header-search-results-list'
				>
					{searchResults.length === 0 ? (
						<ThemedText
							lightColor={textColor}
							darkColor={textColor}
							style={{ fontSize: fontSize['text.small'], padding: 10 }}
						>
							{featuresCopy.noResults}
						</ThemedText>
					) : (
						searchResults.map((result, index) => (
							<TouchableOpacity
								key={result.feature.id}
								testID={`header-search-result-${result.feature.id}`}
								onPress={() => selectFeature(result.feature)}
								activeOpacity={0.7}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 10,
									paddingVertical: 10,
									paddingHorizontal: 5,
									backgroundColor: listItemBackground,
									borderTopColor: border,
									borderTopWidth: index === 0 ? 1 : 0,
									borderBottomColor: border,
									borderBottomWidth: 1,
								}}
							>
								<IconSymbol
									name={result.feature.icon}
									size={20}
									color={headerIcons}
								/>
								<ThemedView
									lightColor='transparent'
									darkColor='transparent'
									style={{ flex: 1 }}
								>
									<ThemedText
										lightColor={textColor}
										darkColor={textColor}
										style={{
											fontSize: fontSize['text.medium'],
											fontWeight: 500,
										}}
									>
										{result.label}
									</ThemedText>
									{result.description ? (
										<ThemedText
											lightColor={mutedTextColor}
											darkColor={mutedTextColor}
											style={{ fontSize: fontSize['text.small'] }}
										>
											{result.description}
										</ThemedText>
									) : null}
								</ThemedView>
								<IconSymbol
									name='chevron.right'
									size={16}
									color={mutedTextColor}
								/>
							</TouchableOpacity>
						))
					)}
				</ScrollView>
			</HeaderDropDownContainer>
			<HeaderDropDownContainer
				id='header-language'
				visible={showLanguageSelection}
				fadeAnim={languageAnimValue}
			>
				<ScrollView
					style={{
						maxHeight: 200,
						gap: 5,
						backgroundColor: headerDropdownBackground,
					}}
					contentContainerStyle={{
						flexGrow: 1,
					}}
					keyboardShouldPersistTaps='handled'
					keyboardDismissMode={'on-drag'}
					showsVerticalScrollIndicator={true}
					nestedScrollEnabled={true}
					scrollEnabled={true}
					onScroll={() => {
						/* intentional no-op to suppress noisy logs */
					}}
				>
					{Object.entries(translations).map(([key, value]) => (
						<TouchableOpacity
							key={key}
							onPress={() => {
								if (value.active) {
									setLanguage(key as langCode);
								}
								setSelectedOption(undefined);
							}}
							style={{
								display: value.active ? 'flex' : 'none',
								borderBottomColor: border,
								borderTopColor: border,
								backgroundColor: languageButtonBackground,
								borderTopWidth: 1,
								paddingVertical: 10,
								paddingHorizontal: 5,
							}}
							activeOpacity={0.7}
						>
							<ThemedText
								style={{
									fontSize: fontSize['text.medium'],
								}}
								lightColor={textColor}
								darkColor={textColor}
							>
								{value.name}
							</ThemedText>
						</TouchableOpacity>
					))}
				</ScrollView>
			</HeaderDropDownContainer>
			<HeaderDropDownContainer
				id='header-notifications'
				visible={showNotifications}
				fadeAnim={notificationsAnimValue}
			>
				<ThemedView
					style={{
						flexDirection: 'column',
						gap: 10,
					}}
					lightColor={headerDropdownBackground}
					darkColor={headerDropdownBackground}
				>
					<ThemedView
						style={{
							flexDirection: 'row',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
						lightColor={headerDropdownBackground}
						darkColor={headerDropdownBackground}
					>
						<ThemedText
							lightColor={headingOneColor}
							darkColor={headingOneColor}
							style={{
								fontSize: fontSize['text.medium'],
							}}
						>
							{translations[language].categories.notifications.title}
						</ThemedText>
						<View
							style={{
								boxSizing: 'border-box',
								flexDirection: 'row',
								paddingHorizontal: 6.5,
								alignItems: 'center',
								justifyContent: 'center',
								borderRadius: 80,
								backgroundColor: notificationsCountBackground,
							}}
						>
							<ThemedText
								style={{
									fontSize: fontSize['text.xsmall'],
									fontWeight: 500,
									padding: 0,
									margin: 0,
								}}
								lightColor={notificationsCount}
								darkColor={notificationsCount}
							>
								{notifications &&
									notifications.length > 0 &&
									notifications.filter((n) => !n.isRead).length > 0
									? notifications.filter((n) => !n.isRead).length
									: '0'}{' '}
								New
							</ThemedText>
						</View>
					</ThemedView>
					<ThemedView
						style={{
							paddingBottom: 3,
						}}
						lightColor={headerBackground}
						darkColor={headerBackground}
					>
						{/* Display notifications here last 5 */}
						{notifications && notifications.length > 0 ? (
							notifications.slice(0, 5).map((notification, index) => (
								<TouchableOpacity
									key={index}
									onPress={() => {
										const isRead = notification.isRead;
										if (!isRead) {
											const currentNotifications = notifications.map((n) =>
												n.id === notification.id ? { ...n, isRead: true } : n
											);
											setNotifications(currentNotifications);
										}
										router.push({
											pathname: '/(authenticated)/notifications',
											params: { notificationId: notification.id },
										});
										setSelectedOption(undefined);
									}}
									style={{
										borderBottomColor: border,
										borderTopColor: border,
										backgroundColor: listItemBackground,
										borderTopWidth: index === 0 ? 1 : 0,
										paddingVertical: 0,
										paddingHorizontal: 5,
										borderBottomWidth: 1,
									}}
									activeOpacity={0.7}
								>
									<ThemedText
										key={index}
										style={{
											fontSize: fontSize['text.small'],
										}}
									>
										{notification.message}
									</ThemedText>
								</TouchableOpacity>
							))
						) : (
							<ThemedText
								lightColor={textColor}
								darkColor={textColor}
								style={{
									fontSize: fontSize['text.small'],
									padding: 10,
								}}
							>
								{
									translations[language].categories.notifications[
									'no.notifications'
									]
								}
							</ThemedText>
						)}
					</ThemedView>
					<ThemedView
						style={{
							flexDirection: 'row',
							justifyContent: 'flex-end',
							paddingTop: 10,
							borderTopColor: inputBorder,
							borderTopWidth: 1,
						}}
						lightColor={headerDropdownBackground}
						darkColor={headerDropdownBackground}
					>
						<ThemedButton
							title={translations[language].categories.notifications[
								'seeAll'
							]?.toUpperCase()}
							onPress={() => {
								router.push('/(authenticated)/notifications');
								setSelectedOption(undefined);
							}}
							style={{
								borderRadius: 8,
								width: '100%',
							}}
							darkColor={bimDark}
							lightColor={bimLight}
							darkTextColor={authButtonTextDark}
							lightTextColor={authButtonTextLight}
						/>
					</ThemedView>
				</ThemedView>
			</HeaderDropDownContainer>
			<HeaderDropDownContainer
				id='header-profile'
				visible={showProfile}
				fadeAnim={profileAnimValue}
			>
				<>
					<ThemedView
						style={{
							backgroundColor: background,
							flexDirection: 'row',
							justifyContent: 'flex-start',
							borderBottomColor: border,
							borderBottomWidth: 1,
							paddingBottom: 10,
							gap: 10,
						}}
					>
						<ThemedView style={{ height: 40, position: 'relative' }}>
							<UserAvatar uri={user?.avatar_url} online={online} />
						</ThemedView>
						<ThemedView
							style={{
								flexDirection: 'column',
								justifyContent: 'center',
								marginLeft: 10,
							}}
						>
							<ThemedText
								style={{
									fontSize: fontSize['text.large'],
									color: textColor,
								}}
							>
								{user?.name || 'John Doe'}
							</ThemedText>
							<ThemedText
								style={{
									fontSize: fontSize['text.medium'],
									color: textColor,
								}}
							>
								{user?.email || 'jd@mail.com'}
							</ThemedText>
						</ThemedView>
					</ThemedView>
					<ThemedView
						style={{
							marginTop: 10,
							flexDirection: 'column',
							gap: 10,
						}}
					>
						<TouchableOpacity
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'flex-start',
							}}
							onPress={() => {
								router.push('/(authenticated)/profile');
								setSelectedOption(undefined);
							}}
						>
							<IconSymbol
								name='account'
								size={18}
								color={textColor}
								style={{ marginRight: 10 }}
							/>
							<ThemedText
								style={{
									color: textColor,
									fontSize: fontSize['text.medium'],
								}}
							>
								{translations[language].categories.navigation['profile']}
							</ThemedText>
						</TouchableOpacity>
						<TouchableOpacity
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'flex-start',
							}}
							onPress={() => {
								router.push('/(authenticated)/settings');
								setSelectedOption(undefined);
							}}
						>
							<IconSymbol
								name='settings'
								size={18}
								color={textColor}
								style={{ marginRight: 10 }}
							/>
							<ThemedText
								style={{
									color: textColor,
									fontSize: fontSize['text.medium'],
								}}
							>
								{translations[language].categories.navigation['settings']}
							</ThemedText>
						</TouchableOpacity>
						<TouchableOpacity
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'flex-start',
							}}
							onPress={() => {
								setSelectedOption(undefined);
								handleLogout();
							}}
						>
							<IconSymbol
								name='logout'
								size={18}
								color={textColor}
								style={{ marginRight: 10 }}
							/>
							<ThemedText
								style={{
									color: textColor,
									fontSize: fontSize['text.medium'],
								}}
							>
								{translations[language].categories.navigation['logout']}
							</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</>
			</HeaderDropDownContainer>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center', // Add this for vertical centering
		height: 60,
		marginTop: Platform.OS === 'ios' ? 50 : 40,
		width: '100%',
		paddingHorizontal: 10,
		zIndex: 10, // Ensure it's above other content
	},
});
