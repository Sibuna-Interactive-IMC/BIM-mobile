import { PortalProvider } from '@/components/Portal';
import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
// Native splash only: do not use expo-splash-screen JS API here.
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/Colors';
import { GeneralProvider, useGeneral } from '@/context/GeneralContext';
import { isAppReady, onAppReady } from '@/helpers/appReady';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
	ActivityIndicator,
	Animated,
	ImageBackground,
	InteractionManager,
	StyleSheet,
	Text,
	useAnimatedValue,
	View,
} from 'react-native';

// No-op: rely on native splash behavior handled by OS and native configuration.

function RootLayoutContent() {
	const colorScheme = useColorScheme();
	const Anim = useAnimatedValue(0); // Example of using an animated value
	const { online, verifyingAuth } = useGeneral(); // Get online and auth verifying status from context
	const [loaded] = useFonts({
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	});

	// record navigation history across the app
	// (individual screens register their own concrete path in useTrackHistory)

	useEffect(() => {
		try {
			console.debug('[RootLayout] mounted @', Date.now());
		} catch { }
	}, []);

	useEffect(() => {
		if (online)
			Animated.timing(Anim, {
				toValue: 0,
				duration: 150,
				useNativeDriver: true,
			}).start();
		else
			Animated.timing(Anim, {
				toValue: 1,
				duration: 150,
				useNativeDriver: true,
			}).start();
	}, [online, Anim]); // Example effect using animated value

	const hiddenRef = useRef(false);
	const scheduledTimeoutRef = useRef<number | null>(null);
	useEffect(() => {
		try {
			console.debug(
				'[RootLayout] loaded=',
				loaded,
				'verifyingAuth=',
				verifyingAuth,
				'@',
				Date.now()
			);
		} catch { }

		// Hide the splash only after fonts have loaded and auth verification
		// has finished. Wait until after React Native interactions complete and
		// two paint frames occur so the first JS view is visible before we hide
		// the native splash. This reduces single-frame black flashes on Android.
		if (loaded && verifyingAuth === false && !hiddenRef.current) {
			try {
				console.debug(
					'[RootLayout] waiting for interactions before hideAsync @',
					Date.now()
				);
			} catch { }

			const interactionHandle = InteractionManager.runAfterInteractions(() => {
				try {
					console.debug(
						'[RootLayout] interactions finished; scheduling paint ticks + hide in 200ms @',
						Date.now()
					);
				} catch { }

				// Two RAFs ensure the UI has a chance to paint.
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						// Wait for an explicit app-ready signal (handshake) or a short
						// timeout. This guarantees the top screen has a chance to
						// render itself before we hide the native splash.
						if (isAppReady()) {
							scheduledTimeoutRef.current = global.setTimeout(() => {
								try {
									console.debug(
										'[RootLayout] native splash: not using JS API; assuming auto-hide (app already ready) @',
										Date.now()
									);
								} catch { }
								hiddenRef.current = true;
							}, 120) as unknown as number;
							return;
						}

						const readyCancel = onAppReady(() => {
							if (scheduledTimeoutRef.current) {
								clearTimeout(scheduledTimeoutRef.current as unknown as number);
								scheduledTimeoutRef.current = null;
							}
							try {
								console.debug(
									'[RootLayout] appReady received; native splash assumed auto-hide @',
									Date.now()
								);
							} catch { }
							hiddenRef.current = true;
						});

						// Fallback: if the app doesn't signal ready within 800ms, hide anyway.
						scheduledTimeoutRef.current = global.setTimeout(() => {
							try {
								console.debug(
									'[RootLayout] appReady timeout; native splash assumed auto-hide @',
									Date.now()
								);
							} catch { }
							readyCancel();
							hiddenRef.current = true;
						}, 800) as unknown as number;
					});
				});
			});

			// Safety fallback: ensure the splash is hidden eventually if interactions
			// never complete (e.g. in edge dev-client cases). 10s fallback.
			const safety = global.setTimeout(() => {
				if (!hiddenRef.current) {
					try {
						console.debug(
							'[RootLayout] safety fallback attempting hideAsync @',
							Date.now()
						);
					} catch { }
					try {
						console.debug(
							'[RootLayout] safety fallback: native splash assumed auto-hide @',
							Date.now()
						);
					} catch { }
					hiddenRef.current = true;
				}
			}, 10000) as unknown as number;

			return () => {
				try {
					interactionHandle.cancel?.();
				} catch { }
				if (scheduledTimeoutRef.current) {
					clearTimeout(scheduledTimeoutRef.current as unknown as number);
					scheduledTimeoutRef.current = null;
				}
				clearTimeout(safety as unknown as number);
			};
		}
	}, [loaded, verifyingAuth]);
	const schemeKey = (colorScheme as any) || 'light';
	const bg = (Colors as any)[schemeKey]?.background ?? '#ffffff';
	const tint = (Colors as any)[schemeKey]?.bim ?? '#EE8438';

	if (!loaded) {
		// Keep the native-splash look, but show the spinner from the first JS
		// frame so there is no blank gap before the auth loader appears.
		return (
			<View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
				<ImageBackground
					source={require('../assets/images/splash-icon.png')}
					resizeMode='contain'
					style={{ width: 150, height: 150, alignSelf: 'center' }}
				>
					<View
						style={{
							position: 'absolute',
							bottom: 100,
							left: 0,
							right: 0,
							alignItems: 'center',
						}}
					>
						<ActivityIndicator size='large' color={tint} />
					</View>
				</ImageBackground>
			</View>
		);
	}

	return (
		<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
			{!online && (
				<Animated.View
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						height: 70,
						backgroundColor: '#ff3333',
						transform: [{ scaleY: Anim }],
						paddingTop: 20,
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 999,
					}}
				>
					<Text style={{ color: '#fff', fontWeight: 'bold' }}>
						You are offline
					</Text>
				</Animated.View>
			)}
			<Stack>
				<Stack.Screen name='(auth)' options={{ headerShown: false }} />
				<Stack.Screen name='(onboarding)' options={{ headerShown: false }} />
				<Stack.Screen name='(authenticated)' options={{ headerShown: false }} />
				<Stack.Screen name='+not-found' />
			</Stack>
			{/* Boot-time auth loader: a translucent scrim over the initial (auth)
			    screen until the stored token has been read and verified. It also
			    blocks touches, so users can't start a second auth flow while
			    auto-login is in progress. */}
			{verifyingAuth && (
				<View
					style={{
						...StyleSheet.absoluteFillObject,
						backgroundColor: 'rgba(0,0,0,0.5)',
						justifyContent: 'center',
						alignItems: 'center',
						zIndex: 1000,
					}}
				>
					<ActivityIndicator size='large' color='#fff' />
				</View>
			)}
			<StatusBar style='auto' />
		</ThemeProvider>
	);
}

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<GeneralProvider>
				<PortalProvider>
					<RootLayoutContent />
				</PortalProvider>
			</GeneralProvider>
		</GestureHandlerRootView>
	);
}
