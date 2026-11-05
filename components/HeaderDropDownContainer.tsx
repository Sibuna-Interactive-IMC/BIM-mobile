import { Portal, usePortalAvailable } from '@/components/Portal';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DropdownContainer({
	children,
	visible,
	fadeAnim,
	id,
	maxHeight = 300,
	top,
}: {
	children: React.ReactElement;
	visible: boolean;
	fadeAnim: Animated.Value;
	id?: string;
	/** Keeps the panel's background behind its whole content. */
	maxHeight?: number;
	/** Header bottom in host space (top margin + bar height). */
	top?: number;
}) {
	const insets = useSafeAreaInsets();
	const portalAvailable = usePortalAvailable();
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

	// `top` is the header's bottom in host space. Keep the same safe-area gap
	// the in-header panel used so the portaled panel sits below the icons.
	const portalTop =
		portalAvailable && top && top > 0
			? top + insets.top + 4
			: null;

	const panel = (
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
				top: portalTop ?? 60 + insets.top,
				backgroundColor: background,
				padding: 10,
				borderRadius: 10,
				shadowColor: '#000',
				shadowOffset: { width: 0, height: 2 },
				shadowOpacity: 0.25,
				shadowRadius: 3.84,
				elevation: 24,
				zIndex: 100000,
				maxHeight,
				//overflow: 'hidden',
			}}
		>
			{children}
		</View>
	);

	// The panel is taller than the 60px header, so leaving it inside the
	// header both clips its touch area and lets scroll gestures fall through
	// to the screen below. Render it in the root portal; the inline panel
	// remains as a fallback for Storybook/tests without a provider.
	return portalTop !== null ? <Portal>{panel}</Portal> : panel;
}
