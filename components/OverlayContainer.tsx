import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import {
	Animated,
	BackHandler,
	Keyboard,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	ScrollViewProps,
	StyleSheet,
	TextInput,
	View,
	findNodeHandle,
	useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import translations from '@/constants/Trans';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Portal } from './Portal';

export type contentPosition = 'top' | 'bottom' | 'center';

/**
 * Radius of the card an overlay form sits in. The clipping frame around a
 * scrollable overlay uses the same value, so the corners stay rounded however
 * far the form is scrolled.
 */
const CARD_RADIUS = 10;

/** Height reserved above a card for the close button, so it never overlaps content. */
const CLOSE_BUTTON_BAND = 38;

/**
 * Keyboard space an overlay has to reserve for itself.
 *
 * Edge-to-edge Android (and iOS) keep the window at full height while the
 * keyboard is up, so the overlay pads its bottom by the keyboard height. A
 * platform that already shrank the window for the keyboard reports a smaller
 * `windowHeight`; padding there as well would leave a screen-sized gap under
 * the content, so the lift drops to zero.
 *
 * A centred card only lifts as far as it has to: reserving the whole keyboard
 * height would re-centre a short form high above the keyboard. The lift is the
 * padding that puts the card's bottom `keyboardGap` above the keyboard, and
 * zero when the card already clears it.
 */
export function overlayKeyboardGeometry({
	keyboardVisible,
	keyboardHeight,
	windowHeight,
	maxWindowHeight,
	insets,
	verticalPadding,
	keyboardGap,
	autoKeyboardInset,
	position = 'center',
	contentHeight = 0,
}: {
	keyboardVisible: boolean;
	keyboardHeight: number;
	windowHeight: number;
	maxWindowHeight: number;
	insets: { top: number; bottom: number };
	verticalPadding: number;
	keyboardGap: number;
	autoKeyboardInset: boolean;
	position?: contentPosition;
	contentHeight?: number;
}) {
	const windowShrankBy = Math.max(0, maxWindowHeight - windowHeight);
	const osResizedForKeyboard =
		keyboardVisible &&
		windowShrankBy > 24 &&
		windowShrankBy >= keyboardHeight * 0.5;
	const keyboardInset =
		keyboardVisible && autoKeyboardInset && !osResizedForKeyboard
			? keyboardHeight
			: 0;
	// Breathing room between the content and the keyboard.
	const clearance = keyboardInset + Math.max(0, keyboardGap);
	// A centred card is lifted by padding: with padding P the card's bottom sits
	// at (windowHeight - P + height) / 2, so it clears the keyboard when
	// P >= height + 2 * clearance - windowHeight. Bottom sheets always reserve
	// the whole keyboard.
	const keyboardLift =
		keyboardInset === 0
			? 0
			: position === 'center' && contentHeight > 0
				? Math.min(
						clearance,
						Math.max(
							0,
							contentHeight + 2 * clearance - windowHeight
						)
					)
				: clearance;
	// Content also stays clear of the top edge.
	const maxContentHeight = Math.max(
		0,
		windowHeight -
			insets.top -
			insets.bottom -
			verticalPadding * 2 -
			keyboardInset -
			24
	);
	return { keyboardInset, keyboardLift, maxContentHeight, osResizedForKeyboard };
}

export default function OverlayContainer({
	showOverlay,
	fadeAnim,
	id,
	position = 'bottom',
	horizontalPadding = 20,
	verticalPadding = 0,
	children,
	onTouch = () => { },
	useNativeModal,
	onRequestClose,
	contentFill = false,
	scrollable = false,
	autoKeyboardInset = true,
	bottomPadding = 12,
	getScrollRef,
	restoreCenterOnKeyboardHide = true,
	scrollProps,
	keyboardGap = 0,
	autoScrollFocused = true,
	focusExtraOffset,
	showCloseButton,
	closeLabel = translations.en.categories.buttons.close,
}: {
	id?: string;
	showOverlay: boolean;
	fadeAnim: any;
	children: ReactElement;
	position?: contentPosition;
	/** Inner content container horizontal padding (applied around children). Default: 20 */
	horizontalPadding?: number;
	/** Inner content container vertical padding (applied around children). Default: 0 */
	verticalPadding?: number;
	onTouch?: () => void;
	/** Force using the native Modal; default is true on all platforms unless explicitly set to false */
	useNativeModal?: boolean;
	/** Optional close handler used when intercepting Android Back button in custom overlay */
	onRequestClose?: () => void;
	/** If true, the animated content wrapper will fill the available screen space, enabling full-screen scroll without maxHeight caps. */
	contentFill?: boolean;
	/** If true, wrap content in a ScrollView to allow scrolling when content overflows. */
	scrollable?: boolean;
	/** If true (default), reserve the keyboard's height so content stays above it. */
	autoKeyboardInset?: boolean;
	/** Additional bottom padding for scrollable content (on top of safe-area inset). Default: 12 */
	bottomPadding?: number;
	/** Optional callback to expose the internal ScrollView ref when scrollable is true. */
	getScrollRef?: (ref: ScrollView | null) => void;
	/** @deprecated No longer needed: the keyboard inset is always reserved, so centred content lifts itself. */
	centerLiftOnKeyboard?: boolean;
	/** @deprecated No longer needed: the keyboard inset is always reserved, so centred content lifts itself. */
	centerLiftRatio?: number;
	/** If true (default), when keyboard hides and position is 'center', auto-scroll to top to restore centered layout. */
	restoreCenterOnKeyboardHide?: boolean;
	/** Additional props to pass to the internal ScrollView when scrollable is true (e.g., onScroll). */
	scrollProps?: Partial<ScrollViewProps>;
	/** Extra pixels of gap added between the lowest content and keyboard when visible. */
	keyboardGap?: number;
	/** If true, when keyboard opens and content is scrollable, auto-scroll the currently focused input into view. */
	autoScrollFocused?: boolean;
	/** Extra offset in pixels when auto-scrolling the focused input above the keyboard. Defaults to keyboardGap (or 16). */
	focusExtraOffset?: number;
	/** Close (X) button in the content's top-right corner. Defaults to on when `onRequestClose` is given. */
	showCloseButton?: boolean;
	/** Accessible name of the close button. */
	closeLabel?: string;
}) {
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const cardBackground = useThemeColor({}, 'background');
	const closeButtonBackground = useThemeColor({}, 'listItemBackground');
	const closeButtonInk = useThemeColor({}, 'text');
	const closeVisible = showCloseButton ?? !!onRequestClose;
	const isAndroid = Platform.OS === 'android';
	const shouldUseNativeModal =
		useNativeModal !== undefined ? useNativeModal : !isAndroid;
	const modalAnimation: 'none' | 'slide' | 'fade' = isAndroid ? 'none' : 'fade';
	const [mounted, setMounted] = useState(false);
	// Track whether portal should remain rendered even during fade-out
	const [rendered, setRendered] = useState(false);
	const [kbHeight, setKbHeight] = useState(0);
	const [kbVisible, setKbVisible] = useState(false);
	const internalScrollRef = useRef<ScrollView | null>(null);

	// Defer initial rendering slightly to avoid layout/focus races on Android
	useEffect(() => {
		if (!showOverlay) return;
		let t: NodeJS.Timeout | undefined;
		if (!shouldUseNativeModal && isAndroid) {
			// short delay before making the overlay interactive
			t = setTimeout(() => setMounted(true), 60);
		} else {
			setMounted(true);
		}
		// ensure portal is rendered when opening
		setRendered(true);
		return () => {
			if (t) clearTimeout(t);
		};
	}, [showOverlay, shouldUseNativeModal, isAndroid]);

	// Keep portal mounted until fade reaches 0 when closing (custom overlay only).
	// Callers often animate the fade value first and only then set showOverlay
	// to false, so the listener can miss the final frame. Check the current
	// value synchronously and keep a fallback timer to guarantee unmounting.
	useEffect(() => {
		if (shouldUseNativeModal) return;
		if (showOverlay) {
			setRendered(true);
			return;
		}
		const currentValue =
			typeof fadeAnim?.__getValue === 'function'
				? fadeAnim.__getValue()
				: 0;
		if (currentValue <= 0.01) {
			setRendered(false);
			setMounted(false);
			return;
		}
		const id = fadeAnim?.addListener?.(({ value }: { value: number }) => {
			if ((value ?? 0) <= 0.01) {
				setRendered(false);
				setMounted(false);
			}
		});
		const fallback = setTimeout(() => {
			setRendered(false);
			setMounted(false);
		}, 500);
		return () => {
			clearTimeout(fallback);
			if (id && fadeAnim?.removeListener) fadeAnim.removeListener(id);
		};
	}, [showOverlay, shouldUseNativeModal, fadeAnim]);

	// Intercept Android back button when using custom overlay
	useEffect(() => {
		if (!isAndroid || shouldUseNativeModal || !showOverlay) return;
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			try {
				onRequestClose?.();
				onTouch?.();
			} catch { }
			return true;
		});
		return () => sub.remove();
	}, [isAndroid, shouldUseNativeModal, showOverlay, onRequestClose, onTouch]);

	// Keyboard inset tracking (iOS: willShow/Hide, Android: didShow/Hide)
	useEffect(() => {
		if (!autoKeyboardInset) return;
		const showEvent =
			Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
		const hideEvent =
			Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
		const onShow = (e: any) => {
			setKbVisible(true);
			setKbHeight(e?.endCoordinates?.height ?? 0);
		};
		const onHide = () => {
			setKbVisible(false);
			setKbHeight(0);
		};
		const s = Keyboard.addListener(showEvent, onShow);
		const h = Keyboard.addListener(hideEvent, onHide);
		return () => {
			s.remove();
			h.remove();
		};
	}, [autoKeyboardInset]);

	// When keyboard hides, restore scroll position to top to re-center content (for centered overlays)
	useEffect(() => {
		if (!scrollable || position !== 'center' || !restoreCenterOnKeyboardHide)
			return;
		if (!kbVisible) {
			const t = setTimeout(() => {
				internalScrollRef.current?.scrollTo?.({ y: 0, animated: true });
			}, 60);
			return () => clearTimeout(t);
		}
	}, [kbVisible, scrollable, position, restoreCenterOnKeyboardHide]);

	// Highest window height seen; a smaller one while the keyboard is open means
	// the OS already shrank the window itself (non edge-to-edge Android).
	const maxWindowHeightRef = useRef(windowHeight);
	useEffect(() => {
		if (windowHeight > maxWindowHeightRef.current) {
			maxWindowHeightRef.current = windowHeight;
		}
	}, [windowHeight]);

	// Scroll position/height of the overlay's ScrollView, used to scroll a
	// focused input into view without relying on screen coordinates.
	const scrollOffsetRef = useRef(0);
	const scrollViewportHeightRef = useRef(0);

	const scrollFocusedInputIntoView = useCallback(() => {
		const scroll = internalScrollRef.current;
		if (!scroll) return;
		const TI: any = TextInput as any;
		const focused: any =
			TI?.State?.currentlyFocusedInput?.() ??
			TI?.currentlyFocusedInput?.() ??
			null;
		if (!focused) return;
		const gap = focusExtraOffset ?? (keyboardGap || 16);
		const apply = (y: number, height: number) => {
			const viewport = scrollViewportHeightRef.current;
			if (!viewport) return;
			const offset = scrollOffsetRef.current;
			const bottom = y + height + gap;
			if (bottom > offset + viewport) {
				scroll.scrollTo({ y: Math.max(0, bottom - viewport), animated: true });
			} else if (y - gap < offset) {
				scroll.scrollTo({ y: Math.max(0, y - gap), animated: true });
			}
		};
		const inner =
			(scroll as any).getInnerViewRef?.() ??
			(scroll as any).getInnerViewNode?.();
		try {
			if (inner && typeof focused.measureLayout === 'function') {
				focused.measureLayout(
					inner,
					(_x: number, y: number, _w: number, height: number) =>
						apply(y, height),
					() => {}
				);
				return;
			}
		} catch { }
		// Fallback for platforms without instance measurement.
		try {
			const responder: any =
				(scroll as any).getScrollResponder?.() ?? scroll;
			const handle = findNodeHandle(focused);
			if (handle != null && responder?.scrollResponderScrollNativeHandleToKeyboard) {
				responder.scrollResponderScrollNativeHandleToKeyboard(
					handle,
					gap,
					true
				);
			}
		} catch { }
	}, [focusExtraOffset, keyboardGap]);

	// When the keyboard opens, keep the input being typed into inside the
	// overlay's scroll viewport (the built-in helper assumes a full-screen
	// scroll view, so measure locally instead).
	useEffect(() => {
		if (!scrollable || !kbVisible || !autoScrollFocused) return;
		scrollFocusedInputIntoView();
		const timers = [120, 320, 520].map((delay) =>
			setTimeout(scrollFocusedInputIntoView, delay)
		);
		return () => timers.forEach(clearTimeout);
	}, [kbVisible, kbHeight, scrollable, autoScrollFocused, scrollFocusedInputIntoView]);

	// Height of the content wrapper, measured so a centred card only lifts as
	// far as the keyboard requires.
	const [contentHeight, setContentHeight] = useState(0);
	const closeButtonShown = closeVisible && !!onRequestClose;
	const closeBand = closeButtonShown ? CLOSE_BUTTON_BAND : 0;

	// Keyboard geometry. Android runs edge-to-edge, where `adjustResize` no
	// longer shrinks the window, so the overlay reserves the keyboard height
	// itself. When the OS did resize the window, reserving it again would leave
	// a large empty gap between the content and the keyboard.
	const { keyboardLift, maxContentHeight } = overlayKeyboardGeometry({
		keyboardVisible: kbVisible,
		keyboardHeight: kbHeight,
		windowHeight,
		maxWindowHeight: maxWindowHeightRef.current,
		insets,
		verticalPadding: verticalPadding ?? 0,
		keyboardGap,
		autoKeyboardInset,
		position,
		contentHeight,
	});

	// Rendered inside the content wrapper rather than the card so it stays put
	// while a scrollable form scrolls under it. The wrapper reserves a band above
	// the card for it, so the X never sits on top of a title row or its spinner.
	const closeButton = closeButtonShown && onRequestClose ? (
		<Pressable
			accessibilityRole='button'
			accessibilityLabel={closeLabel}
			onPress={onRequestClose}
			hitSlop={10}
			style={({ pressed }) => [
				styles.closeButton,
				{
					backgroundColor: closeButtonBackground,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<IconSymbol name='close' size={18} color={closeButtonInk} />
		</Pressable>
	) : null;
	const contentMaxHeight = Math.max(0, maxContentHeight - closeBand);

	if (!shouldUseNativeModal) {
		if (!rendered) return null;
		// derive smoother backdrop and content animations from a single fade value
		const contentScale = fadeAnim.interpolate({
			inputRange: [0, 1],
			outputRange: [0.98, 1],
		});
		const animatedContentStyle = [
			{
				opacity: fadeAnim,
				width: '100%',
				backgroundColor: 'transparent',
				padding: 0,
				margin: 0,
			} as any,
			!contentFill && { transform: [{ scale: contentScale }] },
			// When contentFill is requested, allow it to expand to fill space only when
			// the keyboard is visible (for centered overlays). This keeps the overlay
			// content sized to its children when the keyboard is hidden.
			// contentFill only active when not centered or when keyboard is visible
			// (so centered overlays remain content-sized when keyboard is hidden)
		];

		const contentFillActive =
			contentFill && (position !== 'center' || kbVisible);

		// apply flex if active
		if (contentFillActive) animatedContentStyle.push({ flex: 1 });
		return (
			<Portal>
				{/* absorb touches behind overlay, but never after the overlay closes */}
				<View
					style={StyleSheet.absoluteFill}
					pointerEvents={showOverlay ? 'auto' : 'none'}
				>
					{/* Backdrop: static semi-opaque black, animate opacity */}
					<Animated.View
						style={[
							StyleSheet.absoluteFill,
							{
								backgroundColor: 'rgba(0,0,0,0.5)',
								opacity: fadeAnim,
								zIndex: 998,
								elevation: 998,
							},
						]}
					/>

					{/* Content container with position alignment */}
					<View
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							bottom: 0,
							top: 0,
							paddingHorizontal: horizontalPadding,
							paddingTop: verticalPadding,
							// Reserve the keyboard so bottom/centred content sits above it
							paddingBottom: verticalPadding + keyboardLift,
							alignItems: contentFill ? 'stretch' : 'center',
							justifyContent:
								position === 'bottom'
									? 'flex-end'
									: position === 'top'
										? 'flex-start'
										: 'center',
							zIndex: 999,
							elevation: 999,
						}}
						pointerEvents='box-none'
					>
						<Animated.View
							nativeID={id}
							pointerEvents={mounted ? 'auto' : 'none'}
							collapsable={false}
							onLayout={(e) => {
								const next = Math.round(e.nativeEvent.layout.height);
								setContentHeight((prev) =>
									Math.abs(prev - next) > 1 ? next : prev
								);
							}}
							style={[
								{ width: '100%', paddingTop: closeBand },
								// If centered and not actively filling, cap the wrapper height
								...(position === 'center' && !contentFillActive
									? [{ maxHeight: maxContentHeight }]
									: []),
								animatedContentStyle,
							]}
						>
							{scrollable ? (
								<View
									style={[
										styles.scrollCard,
										{ backgroundColor: cardBackground },
									]}
								>
									<ScrollView
										{...scrollProps}
										ref={(r) => {
											internalScrollRef.current = r;
											if (!r) scrollOffsetRef.current = 0;
											getScrollRef?.(r);
										}}
										keyboardShouldPersistTaps='handled'
										keyboardDismissMode={
											Platform.OS === 'ios' ? 'interactive' : 'none'
										}
										automaticallyAdjustKeyboardInsets={false}
										showsVerticalScrollIndicator={false}
										scrollEventThrottle={16}
										onLayout={(e) => {
											scrollViewportHeightRef.current =
												e.nativeEvent.layout.height;
										}}
										onScroll={(e) => {
											scrollOffsetRef.current =
												e.nativeEvent.contentOffset.y;
											scrollProps?.onScroll?.(e);
										}}
										contentContainerStyle={[
											{ paddingBottom: insets.bottom + bottomPadding },
											scrollProps?.contentContainerStyle,
										]}
										style={{
											width: '100%',
											// When not filling, cap height so the wrapper can be centered initially
											...(position === 'center' && !contentFill
												? { maxHeight: contentMaxHeight }
												: null),
										}}
									>
										{children}
									</ScrollView>
								</View>
							) : (
								children
							)}
							{closeButton}
						</Animated.View>
					</View>
				</View>
			</Portal>
		);
	}

	return (
		<Modal
			transparent={Platform.OS !== 'android'}
			visible={showOverlay}
			animationType={modalAnimation}
			statusBarTranslucent={Platform.OS === 'android'}
			hardwareAccelerated={true}
			onRequestClose={() => {
				// required on Android to avoid warnings
				onRequestClose?.();
			}}
		>
			<View
				style={{
					flex: 1,
				}}
			>
				{/* Backdrop: static semi-opaque black, animate opacity */}
				<Animated.View
					style={[
						StyleSheet.absoluteFill,
						{
							backgroundColor: 'rgba(0,0,0,0.5)',
							opacity: fadeAnim,
							zIndex: 998,
							elevation: 998,
						},
					]}
				/>
				{/* Content container */}
				<View
					style={{
						position: 'absolute',
						left: 0,
						right: 0,
						bottom: 0,
						top: 0,
						paddingHorizontal: horizontalPadding,
						paddingTop: verticalPadding,
						paddingBottom: verticalPadding + keyboardLift,
						alignItems: contentFill ? 'stretch' : 'center',
						justifyContent:
							position === 'bottom'
								? 'flex-end'
								: position === 'top'
									? 'flex-start'
									: 'center',
						zIndex: 999,
						elevation: 999,
					}}
				>
					<Animated.View
						nativeID={id}
						pointerEvents='auto'
						collapsable={false}
						onLayout={(e) => {
							const next = Math.round(e.nativeEvent.layout.height);
							setContentHeight((prev) =>
								Math.abs(prev - next) > 1 ? next : prev
							);
						}}
						style={[
							{ opacity: fadeAnim, width: '100%', paddingTop: closeBand },
							// Cap height when centered and not filling so the child can't grow too tall
							...(position === 'center' && !contentFill
								? [{ maxHeight: maxContentHeight }]
								: []),
							contentFill && position !== 'center' && { flex: 1 },
							!contentFill && {
								transform: [
									{
										scale: fadeAnim.interpolate({
											inputRange: [0, 1],
											outputRange: [0.98, 1],
										}),
									},
								],
							},
						]}
					>
						{scrollable ? (
							<View
								style={[
									styles.scrollCard,
									{ backgroundColor: cardBackground },
								]}
							>
								<ScrollView
									{...scrollProps}
									ref={(r) => {
										internalScrollRef.current = r;
										if (!r) scrollOffsetRef.current = 0;
										getScrollRef?.(r);
									}}
									keyboardShouldPersistTaps='handled'
									keyboardDismissMode={
										Platform.OS === 'ios' ? 'interactive' : 'none'
									}
									automaticallyAdjustKeyboardInsets={false}
									showsVerticalScrollIndicator={false}
									scrollEventThrottle={16}
									onLayout={(e) => {
										scrollViewportHeightRef.current =
											e.nativeEvent.layout.height;
									}}
									onScroll={(e) => {
										scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
										scrollProps?.onScroll?.(e);
									}}
									contentContainerStyle={[
										{ paddingBottom: insets.bottom + bottomPadding },
										scrollProps?.contentContainerStyle,
									]}
									style={{
										width: '100%',
										...(position === 'center' && !contentFill
											? { maxHeight: contentMaxHeight }
											: null),
									}}
								>
									{children}
								</ScrollView>
							</View>
						) : (
							children
						)}
						{closeButton}
					</Animated.View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	/**
	 * Rounded frame around a scrollable overlay's content. The ScrollView lives
	 * inside it, so the card's corners stay visible while the form scrolls.
	 */
	scrollCard: {
		width: '100%',
		borderRadius: CARD_RADIUS,
		overflow: 'hidden',
	},
	/** Close affordance pinned above the card's top-right corner. */
	closeButton: {
		position: 'absolute',
		top: 2,
		right: 8,
		width: 30,
		height: 30,
		borderRadius: 15,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 10,
		elevation: 10,
	},
});
