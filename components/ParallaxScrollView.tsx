import type { PropsWithChildren, ReactElement } from 'react';
import { useEffect } from 'react';
import {
	findNodeHandle,
	GestureResponderEvent,
	RefreshControl,
	ScrollView,
	StyleProp,
	StyleSheet,
	ViewStyle,
} from 'react-native';
import Animated, {
	interpolate,
	useAnimatedRef,
	useAnimatedStyle,
	useScrollViewOffset,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/ThemedView';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
	headerImage?: ReactElement;
	containerStyle?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	headerBackgroundColor?: { dark: string; light: string };
	onTouchStart?: (e: GestureResponderEvent) => void; // Optional callback for touch start events
	/** Optional callback to receive the internal ScrollView ref (useful to scroll to focused inputs) */
	getScrollRef?: (ref: ScrollView | null) => void;
	/** Optional pull-to-refresh handler and state */
	onRefresh?: () => void | Promise<void>;
	refreshing?: boolean;
}>;

export default function ParallaxScrollView({
	children,
	headerImage,
	containerStyle,
	contentStyle,
	onTouchStart,
	headerBackgroundColor,
	getScrollRef,
	onRefresh,
	refreshing,
}: Props) {
	const colorScheme = useColorScheme() ?? 'light';
	const scrollRef = useAnimatedRef<Animated.ScrollView>();
	useEffect(() => {
		if (!getScrollRef) return;
		try {
			// Try to resolve a usable ref to pass to parent. Animated ref implementations
			// may expose a getNode() method or be directly usable. This is best-effort.
			const candidate: any = scrollRef.current as any;
			let native: ScrollView | null = null;
			if (!candidate) {
				getScrollRef(null);
				return;
			}
			if (typeof candidate.getNode === 'function') {
				native = candidate.getNode();
			} else {
				// fallback: try to get a native handle
				const handle = findNodeHandle(candidate);
				if (handle) native = candidate as unknown as ScrollView;
			}
			getScrollRef(native ?? null);
		} catch {
			getScrollRef(null);
		}
		return () => {
			try {
				getScrollRef(null);
			} catch {}
		};
	}, [getScrollRef, scrollRef]);
	const scrollOffset = useScrollViewOffset(scrollRef);
	const bottom = useBottomTabOverflow();
	// Provide a safe default when stories forget to pass headerBackgroundColor
	const hb = headerBackgroundColor ?? {
		light: 'transparent',
		dark: 'transparent',
	};
	const headerAnimatedStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{
					translateY: interpolate(
						scrollOffset.value,
						[-HEADER_HEIGHT, 0, HEADER_HEIGHT],
						[-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
					),
				},
				{
					scale: interpolate(
						scrollOffset.value,
						[-HEADER_HEIGHT, 0, HEADER_HEIGHT],
						[2, 1, 1]
					),
				},
			],
		};
	});

	return (
		<ThemedView
			onTouchStart={onTouchStart}
			style={[styles.container, containerStyle]}
			lightColor={hb.light}
			darkColor={hb.dark}
		>
			<Animated.ScrollView
				ref={scrollRef}
				scrollEventThrottle={16}
				scrollIndicatorInsets={{ bottom }}
				contentContainerStyle={{ paddingBottom: bottom }}
				nestedScrollEnabled={true}
				refreshControl={
					onRefresh ? (
						<RefreshControl
							refreshing={!!refreshing}
							onRefresh={() => {
								try {
									void onRefresh();
								} catch {}
							}}
						/>
					) : undefined
				}
			>
				<Animated.View
					style={[
						styles.header,
						{
							backgroundColor: hb[colorScheme],
							display: headerImage ? 'flex' : 'none',
						},
						headerAnimatedStyle,
					]}
				>
					{headerImage}
				</Animated.View>
				<ThemedView style={[styles.content, contentStyle]}>
					{children}
				</ThemedView>
			</Animated.ScrollView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'column',
		flex: 1,
	},
	header: {
		height: HEADER_HEIGHT,
		overflow: 'hidden',
	},
	content: {
		flex: 1,
		padding: 32,
		gap: 16,
		overflow: 'hidden',
	},
});
