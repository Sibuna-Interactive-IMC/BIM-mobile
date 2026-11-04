import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DropdownContainer({
	children,
	visible,
	fadeAnim,
	id,
}: {
	children: React.ReactElement;
	visible: boolean;
	fadeAnim: Animated.Value;
	id?: string;
}) {
	const insets = useSafeAreaInsets();
	const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const background = useThemeColor({}, 'background');
	const [localVisible, setLocalVisible] = useState(false);
	useEffect(() => {
		visibilityTimeoutRef.current = setTimeout(() => {
			setLocalVisible(visible);
		}, 100);
		return () => {
			if (visibilityTimeoutRef.current) {
				clearTimeout(visibilityTimeoutRef.current);
			}
		};
	}, [visible]);

	if (!localVisible) {
		return null; // Return null if not visible
	}

	return (
		<View
			id={id}
			testID={'testId-' + id}
			style={{
				position: 'absolute',
				flexDirection: 'column',
				//opacity: fadeAnim,
				//transform: [{ scaleY: fadeAnim }],
				left: 10,
				right: 10,
				top: 60 + insets.top,
				backgroundColor: background,
				padding: 10,
				borderRadius: 10,
				shadowColor: '#000',
				shadowOffset: { width: 0, height: 2 },
				shadowOpacity: 0.25,
				shadowRadius: 3.84,
				elevation: 5,
				zIndex: 1000, // Ensure it appears above other content
				maxHeight: 300, // Limit height for better UX
				//overflow: 'hidden',
			}}
		>
			{children}
		</View>
	);
}
