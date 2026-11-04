import { ReactElement, useEffect, useRef, useState } from 'react';
import {
	Animated,
	BackHandler,
	Keyboard,
	Modal,
	Platform,
	ScrollView,
	ScrollViewProps,
	StyleSheet,
	TextInput,
	View,
	findNodeHandle,
	useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal } from './Portal';

export type contentPosition = 'top' | 'bottom' | 'center';

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
	centerLiftOnKeyboard = false,
	centerLiftRatio = 0.6,
	restoreCenterOnKeyboardHide = true,
	scrollProps,
	keyboardGap = 0,
	autoScrollFocused = true,
	focusExtraOffset,
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
	/** If true (default), automatically add keyboard-height inset to bottom padding for the scrollable content. */
	autoKeyboardInset?: boolean;
	/** Additional bottom padding for scrollable content (on top of safe-area inset and optional keyboard height). Default: 12 */
	bottomPadding?: number;
	/** Optional callback to expose the internal ScrollView ref when scrollable is true. */
	getScrollRef?: (ref: ScrollView | null) => void;
	/** If true and position is 'center', when the keyboard is visible the container will add bottom padding to visually lift centered content above the keyboard. */
	centerLiftOnKeyboard?: boolean;
	/** The ratio of keyboard height to add as bottom padding when centerLiftOnKeyboard is true. Default 0.6 (60%). */
	centerLiftRatio?: number;
	/** If true (default), when keyboard hides and position is 'center', auto-scroll to top to restore centered layout. */
	restoreCenterOnKeyboardHide?: boolean;
	/** Additional props to pass to the internal ScrollView when scrollable is true (e.g., onScroll). */
	scrollProps?: Partial<ScrollViewProps>;
	/** Extra pixels of gap added between the lowest content and keyboard when visible. */
	keyboardGap?: number;
	/** If true, when keyboard opens and content is scrollable, auto-scroll the currently focused input into view. */
	autoScrollFocused?: boolean;
	/** Extra offset in pixels when auto-scrolling the focused input above the keyboard. Defaults to keyboardGap or 32. */
	focusExtraOffset?: number;
}) {
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
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

	// When keyboard shows, ensure the currently focused input is scrolled above the keyboard with a gap
	useEffect(() => {
		if (!scrollable || !kbVisible || !autoScrollFocused) return;
		const responder: any =
			(internalScrollRef.current as any)?.getScrollResponder?.() ??
			internalScrollRef.current;
		if (!responder?.scrollResponderScrollNativeHandleToKeyboard) return;
		const extra = focusExtraOffset ?? keyboardGap ?? 32;
		const doScroll = () => {
			try {
				const TI: any = TextInput as any;
				let focused: any = null;
				if (TI?.State && typeof TI.State.currentlyFocusedInput === 'function') {
					focused = TI.State.currentlyFocusedInput();
				} else if (typeof TI?.currentlyFocusedInput === 'function') {
					focused = TI.currentlyFocusedInput();
				}
				if (!focused) return;
				const handle = findNodeHandle(focused);
				if (!handle) return;
				responder.scrollResponderScrollNativeHandleToKeyboard(
					handle,
					extra,
					true
				);
			} catch { }
		};
		// try multiple times to survive differing animation timings
		doScroll();
		const t1 = setTimeout(doScroll, Platform.OS === 'ios' ? 220 : 60);
		const t2 = setTimeout(doScroll, Platform.OS === 'ios' ? 380 : 140);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, [kbVisible, scrollable, autoScrollFocused, keyboardGap, focusExtraOffset]);
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
		const _computedPad =
			centerLiftOnKeyboard && position === 'center' && kbVisible
				? Math.round(
					(kbHeight + insets.bottom) *
					Math.max(0, Math.min(centerLiftRatio, 1))
				)
				: 0;
		// Clamp to 1-2px visual gap as requested
		const containerBottomPad = Math.min(2, _computedPad);
		// Reduce top padding when keyboard is visible so the overlay doesn't appear pushed down
		const baseVertical = verticalPadding ?? 0;
		const containerTopPad =
			centerLiftOnKeyboard && position === 'center' && kbVisible
				? Math.min(2, baseVertical)
				: baseVertical;

		// When keyboard is hidden we want the child to be content-sized but capped
		// to the available screen height (so it can never exceed the screen).
		const availableScreenHeight = Math.max(
			0,
			windowHeight - insets.top - insets.bottom - (verticalPadding ?? 0) * 2
		);
		const maxScrollableHeight = kbVisible
			? Math.max(
				0,
				windowHeight -
				insets.top -
				insets.bottom -
				(verticalPadding ?? 0) * 2 -
				40 -
				(autoKeyboardInset && kbVisible ? kbHeight : 0)
			)
			: availableScreenHeight;
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
							paddingTop: containerTopPad,
							// Add additional bottom padding to lift centered content when keyboard is open
							paddingBottom: baseVertical + containerBottomPad,
							alignItems: contentFill ? 'stretch' : 'center',
							justifyContent:
								position === 'bottom'
									? 'flex-end'
									: position === 'top'
										? 'flex-start'
										: position === 'center' && centerLiftOnKeyboard && kbVisible
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
							style={[
								{ width: '100%' },
								// If centered and not actively filling, cap the wrapper height
								...(position === 'center' && !contentFillActive
									? [{ maxHeight: maxScrollableHeight }]
									: []),
								animatedContentStyle,
							]}
						>
							{scrollable ? (
								<ScrollView
									ref={(r) => {
										internalScrollRef.current = r;
										getScrollRef?.(r);
									}}
									keyboardShouldPersistTaps='handled'
									keyboardDismissMode={
										Platform.OS === 'ios' ? 'interactive' : 'on-drag'
									}
									automaticallyAdjustKeyboardInsets={false}
									showsVerticalScrollIndicator={false}
									contentContainerStyle={[
										{
											paddingBottom:
												(autoKeyboardInset && kbVisible
													? kbHeight + keyboardGap
													: 0) +
												insets.bottom +
												bottomPadding,
										},
										scrollProps?.contentContainerStyle,
									]}
									style={{
										width: '100%',
										// When not filling, cap height so the wrapper can be centered initially
										...(position === 'center' && !contentFill
											? { maxHeight: maxScrollableHeight }
											: null),
									}}
									{...scrollProps}
								>
									{children}
								</ScrollView>
							) : (
								children
							)}
						</Animated.View>
					</View>
				</View>
			</Portal>
		);
	}

	const _computedPadModal =
		centerLiftOnKeyboard && position === 'center' && kbVisible
			? Math.round(
				(kbHeight + insets.bottom) * Math.max(0, Math.min(centerLiftRatio, 1))
			)
			: 0;
	const containerBottomPadModal = Math.min(2, _computedPadModal);
	const baseVerticalModal = verticalPadding ?? 0;
	const containerTopPadModal =
		centerLiftOnKeyboard && position === 'center' && kbVisible
			? Math.min(2, baseVerticalModal)
			: baseVerticalModal;

	const maxScrollableHeightModal = kbVisible
		? Math.max(
			0,
			windowHeight -
			insets.top -
			insets.bottom -
			(verticalPadding ?? 0) * 2 -
			40 -
			(autoKeyboardInset && kbVisible ? kbHeight : 0)
		)
		: Math.max(
			0,
			windowHeight - insets.top - insets.bottom - (verticalPadding ?? 0) * 2
		);
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
						paddingTop: containerTopPadModal,
						paddingBottom: baseVerticalModal + containerBottomPadModal,
						alignItems: contentFill ? 'stretch' : 'center',
						justifyContent:
							position === 'bottom'
								? 'flex-end'
								: position === 'top'
									? 'flex-start'
									: position === 'center' && centerLiftOnKeyboard && kbVisible
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
						style={[
							{ opacity: fadeAnim, width: '100%' },
							// Cap height when centered and not filling so the child can't grow too tall
							...(position === 'center' && !contentFill
								? [{ maxHeight: maxScrollableHeightModal }]
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
							<ScrollView
								ref={(r) => {
									internalScrollRef.current = r;
									getScrollRef?.(r);
								}}
								keyboardShouldPersistTaps='handled'
								keyboardDismissMode={
									Platform.OS === 'ios' ? 'interactive' : 'on-drag'
								}
								automaticallyAdjustKeyboardInsets={false}
								showsVerticalScrollIndicator={false}
								contentContainerStyle={[
									{
										paddingBottom:
											(autoKeyboardInset && kbVisible
												? kbHeight + keyboardGap
												: 0) +
											insets.bottom +
											bottomPadding,
									},
									scrollProps?.contentContainerStyle,
								]}
								style={{
									width: '100%',
									...(position === 'center' && !contentFill
										? { maxHeight: maxScrollableHeightModal }
										: null),
								}}
								{...scrollProps}
							>
								{children}
							</ScrollView>
						) : (
							children
						)}
					</Animated.View>
				</View>
			</View>
		</Modal>
	);
}
