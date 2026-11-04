import OverlayContainer from '@/components/OverlayContainer';
import { BlurView } from 'expo-blur';
import { ActivityIndicator, Animated, StyleSheet } from 'react-native';
export default function Overlay({
	showOverlay,
	fadeAnim,
	view,
	toggleShowOverlay,
}: {
	showOverlay: boolean;
	fadeAnim: Animated.Value;
	view?: React.ReactNode;
	toggleShowOverlay: (v?: boolean) => void;
}) {
	return (
		<OverlayContainer
			showOverlay={showOverlay}
			fadeAnim={fadeAnim}
			position='center'
			onTouch={() => toggleShowOverlay(false)}
		>
			<BlurView
				intensity={70}
				tint='systemChromeMaterialLight'
				style={StyleSheet.absoluteFill}
			>
				<ActivityIndicator
					size='small'
					color='#fff'
					style={{
						position: 'absolute',
						top: '50%',
						left: '50%',
						transform: [{ translateX: -25 }, { translateY: -25 }],
					}}
				/>
			</BlurView>
		</OverlayContainer>
	);
}
