import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
// useColorScheme not required here
import { useThemeColor } from '@/hooks/useThemeColor';
import { Platform } from 'react-native';

export default function AuthLayout() {
	const tint = useThemeColor({}, 'tint');

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: tint,
				headerShown: true,
				tabBarButton: HapticTab,
				tabBarBackground: TabBarBackground,
				headerStyle: {
					height: Platform.OS === 'ios' ? 50 : 40,
				},
				sceneStyle: {
					marginBottom: Platform.OS === 'android' ? 50 : 5,
				},
				tabBarStyle: {
					display: 'none',
				},
			}}
		>
			<Tabs.Screen
				name='index'
				options={{
					title: 'Register',
					headerTitle: '',
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name='house.fill' color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='login'
				options={{
					title: 'Login',
					headerTitle: '',
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name='paperplane.fill' color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='verify'
				options={{
					title: 'Verify',
					headerTitle: '',
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name='paperplane.fill' color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
