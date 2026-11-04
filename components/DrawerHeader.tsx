import bimTextImg from '@/assets/images/bim-text-img.png';
import { useThemeColor } from '@/hooks/useThemeColor';
// @ts-ignore - some versions of @react-navigation/drawer may or may not export useDrawerStatus types
import { useDrawerStatus } from '@react-navigation/drawer';
import { useEffect } from 'react';
import {
	Animated,
	Image,
	TouchableOpacity,
	useAnimatedValue,
} from 'react-native';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
// avoid importing fragile navigation types/hooks from @react-navigation/drawer which can vary by version
type DrawerNavigationProp = any;

export default function Header({
	navigation,
}: {
	navigation: DrawerNavigationProp;
}) {
	const arrowAnimValue = useAnimatedValue(0);
	const drawerStatus = useDrawerStatus();
	useEffect(() => {
		if (drawerStatus === 'open') {
			Animated.timing(arrowAnimValue, {
				toValue: 1,
				duration: 150,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(arrowAnimValue, {
				toValue: 0,
				duration: 150,
				useNativeDriver: true,
			}).start();
		}
	}, [drawerStatus, arrowAnimValue]);
	return (
		<ThemedView
			lightColor={useThemeColor({}, 'headerBackground')}
			darkColor={useThemeColor({}, 'headerBackground')}
			style={{
				flexDirection: 'row',
				flexWrap: 'nowrap',
				justifyContent: 'space-between',
				alignItems: 'center',
			}}
		>
			<Image
				source={bimTextImg}
				style={{ width: 200, height: 40, resizeMode: 'contain' }}
			/>
			<TouchableOpacity onPress={() => navigation.toggleDrawer()}>
				<Animated.View
					style={{
						transform: [
							{
								rotate: arrowAnimValue.interpolate({
									inputRange: [0, 1],
									outputRange: ['0deg', '180deg'],
								}),
							},
						],
					}}
				>
					<IconSymbol
						name='doubleRight'
						size={24}
						color={useThemeColor({}, 'text')}
					/>
				</Animated.View>
			</TouchableOpacity>
		</ThemedView>
	);
}
