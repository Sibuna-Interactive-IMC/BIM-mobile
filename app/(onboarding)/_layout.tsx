import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
// useColorScheme not required in onboarding layout
import { signalAppReady } from '@/helpers/appReady';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect } from 'react';

export default function AuthLayout() {
	const tint = useThemeColor({}, 'tint');


	// Signal readiness for onboarding routes as well (two paint frames).
	useEffect(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				signalAppReady();
			});
		});
	}, []);

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: tint,
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarBackground: TabBarBackground,
				tabBarStyle: {
					display: 'none',
				},
			}}
		></Tabs>
	);
}
