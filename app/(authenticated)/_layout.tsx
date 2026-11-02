import { Drawer } from 'expo-router/drawer';
import React from 'react';
// avoid importing fragile navigation types from @react-navigation/drawer which can differ by version
// allow importing DrawerContentScrollView at runtime; suppress type errors if the package's types differ
// @ts-ignore
import { DrawerContentScrollView } from '@react-navigation/drawer';

import DrawerHeader from '@/components/DrawerHeader';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { SecurityProvider } from '@/context/SecurityContext';
import { TransactionProvider } from '@/context/TransactionContext';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';
// use a runtime require to access DrawerContentScrollView to avoid missing type exports
import { Platform, TouchableOpacity, View } from 'react-native';

function CustomDrawerContent(props: any) {
	const drawerBackground = useThemeColor({}, 'drawerBackground');
	const drawerActiveBackground = useThemeColor({}, 'drawerActiveBackground');
	const drawerButtonBackground = useThemeColor({}, 'drawerButtonBackground');
	const drawerItem = useThemeColor({}, 'drawerItem');
	const drawerInactiveItem = useThemeColor({}, 'drawerInactiveItem');

	const { language, user } = useGeneral();
	const { state, descriptors, navigation } = props;
	const activeIndex = state.index;
	// Payment routing is an admin tool, so its drawer link is admin-only.
	const isAdmin = isPlatformAdmin(user);

	// Allowlist of routes to show in the drawer. Only routes listed here will render.
	// Edit this set to control which routes appear as links in the drawer.
	const allowedRoutes = React.useMemo(
		() =>
			new Set<string>([
				'home',
				'routers',
				'packages',
				'vouchers',
				'accounts',
				'access',
				...(isAdmin ? ['payment-gateway', 'broadcasts', 'router-tools'] : []),
				'banks',
				'connector',
				'documents',
			]),
		[isAdmin]
	);

	return (
		<DrawerContentScrollView
			contentContainerStyle={{ padding: 0 }}
			style={{ padding: 0 }}
			{...props}
		>
			<View
				style={{
					paddingVertical: 5,
					backgroundColor: drawerBackground,
				}}
			>
				<DrawerHeader navigation={navigation} />
			</View>

			{state.routes.map((route: any, i: number) => {
				const { options } = descriptors[route.key];
				const showItem = options.drawerItemStyle?.display !== 'none';
				// Skip routes that are not explicitly allowed
				if (!allowedRoutes.has(route.name)) return null;
				// Derive a label: prefer explicit option, otherwise use translations by route name, fallback to route.name
				const translatedNav = translations[language]?.categories
					?.navigation as Record<string, string>;
				const label =
					options.drawerLabel ??
					options.title ??
					translatedNav?.[route.name] ??
					route.name;
				const isActive = i === activeIndex;
				const activeBg =
					options.drawerActiveBackgroundColor ?? drawerActiveBackground;
				const inactiveBg =
					options.drawerInactiveBackgroundColor ?? drawerButtonBackground;
				const iconColor = isActive
					? options.drawerActiveTintColor ?? drawerItem
					: options.drawerInactiveTintColor ?? drawerInactiveItem;
				let icon: React.ReactNode = null;
				switch (route.name) {
					case 'home':
						icon = (
							<IconSymbol size={24} name='home.outline' color={iconColor} />
						);
						break;
					case 'routers':
						icon = (
							<IconSymbol size={24} name='routers.outline' color={iconColor} />
						);
						break;
					case 'packages':
						icon = <IconSymbol size={24} name='packages' color={iconColor} />;
						break;
					case 'vouchers':
						icon = <IconSymbol size={24} name='vouchers' color={iconColor} />;
						break;
					case 'accounts':
						icon = <IconSymbol size={24} name='accounts' color={iconColor} />;
						break;
					case 'transactions':
						icon = (
							<IconSymbol size={24} name='transactions' color={iconColor} />
						);
						break;
					case 'withdraw':
						icon = <IconSymbol size={24} name='withdrawal' color={iconColor} />;
						break;
					case 'connector':
						icon = <IconSymbol size={24} name='key' color={iconColor} />;
						break;
					case 'banks':
						icon = <IconSymbol size={24} name='bank' color={iconColor} />;
						break;
					case 'access':
						icon = <IconSymbol size={24} name='users' color={iconColor} />;
						break;
					case 'payment-gateway':
						icon = <IconSymbol size={24} name='gateway' color={iconColor} />;
						break;
					case 'broadcasts':
						icon = <IconSymbol size={24} name='broadcast' color={iconColor} />;
						break;
					case 'router-tools':
						icon = <IconSymbol size={24} name='tools.outline' color={iconColor} />;
						break;
					case 'documents':
						icon = <IconSymbol size={24} name='documents' color={iconColor} />;
						break;
					default:
						icon = null;
				}
				if (!showItem) {
					return null;
				}
				return (
					<TouchableOpacity
						key={route.key}
						style={{
							backgroundColor: isActive ? activeBg : inactiveBg,
							borderRadius: 5,
							margin: 0,
							padding: 0,
						}}
						onPress={() => navigation.navigate(route.name)}
					>
						<ThemedView
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								padding: 16,
							}}
							lightColor='transparent'
							darkColor='transparent'
						>
							{icon}
							<ThemedView
								style={{ marginLeft: 16 }}
								lightColor='transparent'
								darkColor='transparent'
							>
								{typeof label === 'string' ? (
									<ThemedText
										style={{
											color: isActive
												? options.drawerActiveTintColor ?? drawerItem
												: options.drawerInactiveTintColor ?? drawerInactiveItem,
											fontWeight: isActive
												? options.drawerActiveFontWeight ??
												  fontWeight['heading.one']
												: options.drawerInactiveFontWeight ??
												  fontWeight['heading.three'],
										}}
										lightColor={
											isActive
												? options.drawerActiveTintColor ?? drawerItem
												: options.drawerInactiveTintColor ?? drawerInactiveItem
										}
										darkColor={
											isActive
												? options.drawerActiveTintColor ?? drawerItem
												: options.drawerInactiveTintColor ?? drawerInactiveItem
										}
									>
										{label}
									</ThemedText>
								) : (
									label
								)}
							</ThemedView>
						</ThemedView>
					</TouchableOpacity>
				);
			})}
		</DrawerContentScrollView>
	);
}

export default function DrawerLayout() {
	const {
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
		authToken,
		verifyingAuth,
	} = useGeneral();
	const drawerBackground = useThemeColor({}, 'drawerBackground');
	const drawerActiveBackground = useThemeColor({}, 'drawerActiveBackground');
	const drawerButtonBackground = useThemeColor({}, 'drawerButtonBackground');
	const drawerItem = useThemeColor({}, 'drawerItem');
	const drawerInactiveItem = useThemeColor({}, 'drawerInactiveItem');

	const router = useRouter();

	// Redirect to login only after auth verification is complete and no token is present.
	// During startup, verifyingAuth is true while the token is loaded from SecureStore
	// and verified with the backend — we must wait for this to finish before deciding.
	React.useEffect(() => {
		if (!authToken && !verifyingAuth) {
			router.replace('/(auth)/login');
		}
	}, [authToken, verifyingAuth, router]);

	// The global auth overlay in the root layout covers the no-token state.
	if (!authToken) {
		return null;
	}

	return (
		<TransactionProvider>
		<SecurityProvider>
			<Drawer
				drawerContent={(props: any) => <CustomDrawerContent {...props} />}
				screenOptions={{
					headerShown: true,
					drawerActiveTintColor: drawerItem,
					drawerInactiveTintColor: drawerInactiveItem,
					drawerActiveBackgroundColor: drawerActiveBackground,
					header: (props: any) => {
						// allow screens to pass a custom goback via options.headerProps?.goback
						// fallback to the navigation back object when available
						const goback = props.options?.headerProps?.goback ?? !!props.back;
						return (
							<Header
								goback={goback}
								user={user}
								handleLogout={handleLogout}
								language={language}
								setLanguage={setLanguage}
								notifications={notifications}
								setNotifications={setNotifications}
								selectedOption={selectedOption}
								setSelectedOption={setSelectedOption}
								online={online}
								handleGoBack={
									props.options?.headerProps?.handleGoBack ?? handleGoBack
								}
								{...props}
							/>
						);
					},
					drawerStyle: {
						backgroundColor: drawerBackground,
					},
					drawerItemStyle: {
						backgroundColor: drawerButtonBackground,
						borderRadius: 0,
						marginLeft: -10,
					},
					sceneStyle: {
						zIndex: 1,
						marginBottom: Platform.OS === 'android' ? 50 : 5,
					},
					drawerLabelStyle: {
						fontSize: fontSize['text.large'],
						fontWeight: fontWeight['text.xsmall'],
					},
				}}
			>
				<Drawer.Screen name='home' />
				<Drawer.Screen name='routers' />
				<Drawer.Screen name='packages' />
				<Drawer.Screen name='vouchers' />
				<Drawer.Screen name='accounts' />
				<Drawer.Screen name='access' />
				<Drawer.Screen name='payment-gateway' />
				<Drawer.Screen name='broadcasts' />
				<Drawer.Screen name='router-tools' />
				<Drawer.Screen name='banks' />
				<Drawer.Screen name='connector' />
				<Drawer.Screen name='documents' />
				<Drawer.Screen name='profile' />
				<Drawer.Screen name='notifications' />
				{/* Add more drawer screens as needed */}
			</Drawer>
		</SecurityProvider>
		</TransactionProvider>
	);
}
