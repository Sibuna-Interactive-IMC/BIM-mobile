import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Animated, ScrollView, StyleSheet, Text } from 'react-native';
import { act } from 'react-test-renderer';

// `fireEvent` ships in this version's runtime but its event typings are missing.
const { fireEvent } = jest.requireActual<{
	fireEvent: { press: (element: unknown) => void };
}>('@testing-library/react-native');

import OverlayContainer, {
	overlayKeyboardGeometry,
} from '@/components/OverlayContainer';
import { PortalProvider } from '@/components/Portal';

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const geometryBase = {
	keyboardVisible: true,
	keyboardHeight: 300,
	windowHeight: 800,
	maxWindowHeight: 800,
	insets: { top: 24, bottom: 24 },
	verticalPadding: 0,
	keyboardGap: 40,
	autoKeyboardInset: true,
};

function Overlay({
	showOverlay,
	fadeAnim,
}: {
	showOverlay: boolean;
	fadeAnim: Animated.Value;
}) {
	return (
		<PortalProvider>
			<OverlayContainer
				showOverlay={showOverlay}
				fadeAnim={fadeAnim}
				useNativeModal={false}
			>
				<Text>overlay-content</Text>
			</OverlayContainer>
		</PortalProvider>
	);
}

describe('overlay keyboard geometry', () => {
	test('reserves the keyboard height when the window keeps its height', () => {
		const g = overlayKeyboardGeometry(geometryBase);
		expect(g.keyboardInset).toBe(300);
		// Unmeasured content: fall back to the full keyboard plus the gap.
		expect(g.keyboardLift).toBe(340);
		// 800 - 24 - 24 - 300 - 24
		expect(g.maxContentHeight).toBe(428);
	});

	test('a centred card that already clears the keyboard is not lifted', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			position: 'center',
			// Centred, a 120px card ends at 460, well above the keyboard at 500.
			contentHeight: 120,
		});
		expect(g.keyboardInset).toBe(300);
		expect(g.keyboardLift).toBe(0);
	});

	test('a centred card near the keyboard lifts only as far as needed', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			position: 'center',
			// 300 + 2 * 340 - 800, so its bottom lands 40px above the keyboard.
			contentHeight: 300,
		});
		expect(g.keyboardLift).toBe(180);
	});

	test('a tall centred card lifts by the full clearance', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			position: 'center',
			contentHeight: 700,
		});
		expect(g.keyboardLift).toBe(340);
	});

	test('bottom sheets always reserve the whole keyboard', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			position: 'bottom',
			contentHeight: 120,
		});
		expect(g.keyboardLift).toBe(340);
	});

	test('does not reserve it twice when the OS shrank the window', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			// adjustResize: the window is already keyboard-height shorter.
			windowHeight: 500,
		});
		expect(g.osResizedForKeyboard).toBe(true);
		expect(g.keyboardInset).toBe(0);
		expect(g.keyboardLift).toBe(0);
		// The window itself is the visible area now.
		expect(g.maxContentHeight).toBe(500 - 24 - 24 - 24);
	});

	test('ignores a window change that is not the keyboard', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			windowHeight: 780,
		});
		expect(g.osResizedForKeyboard).toBe(false);
		expect(g.keyboardInset).toBe(300);
	});

	test('reserves nothing while the keyboard is hidden', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			keyboardVisible: false,
			keyboardHeight: 0,
		});
		expect(g.keyboardLift).toBe(0);
		expect(g.maxContentHeight).toBe(800 - 24 - 24 - 24);
	});

	test('reserves nothing when the overlay opted out of the inset', () => {
		const g = overlayKeyboardGeometry({
			...geometryBase,
			autoKeyboardInset: false,
		});
		expect(g.keyboardLift).toBe(0);
	});
});

describe('OverlayContainer', () => {
	test('unmounts the overlay when it closes after its fade finished', async () => {
		const fadeAnim = new Animated.Value(1);
		const { queryByText, rerender } = render(
			<Overlay showOverlay fadeAnim={fadeAnim} />
		);

		await waitFor(() =>
			expect(queryByText('overlay-content')).not.toBeNull()
		);

		// Callers animate to 0 first and only then flip showOverlay to false.
		await act(async () => {
			fadeAnim.setValue(0);
		});
		rerender(<Overlay showOverlay={false} fadeAnim={fadeAnim} />);
		// Let the portal unmount queue flush.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		expect(queryByText('overlay-content')).toBeNull();
	});

	test('unmounts even if the fade value never reaches zero', async () => {
		jest.useFakeTimers();
		const fadeAnim = new Animated.Value(1);
		const { queryByText, rerender } = render(
			<Overlay showOverlay fadeAnim={fadeAnim} />
		);

		await act(async () => {
			jest.advanceTimersByTime(10);
		});
		expect(queryByText('overlay-content')).not.toBeNull();

		rerender(<Overlay showOverlay={false} fadeAnim={fadeAnim} />);
		await act(async () => {
			jest.advanceTimersByTime(600);
		});
		// The portal removes entries on its own timer after the fallback fires.
		await act(async () => {
			jest.advanceTimersByTime(10);
		});

		expect(queryByText('overlay-content')).toBeNull();
		jest.useRealTimers();
	});

	test('scrolls inside a fixed rounded card so the corners stay put', async () => {
		const fadeAnim = new Animated.Value(1);
		const { UNSAFE_getByType } = render(
			<PortalProvider>
				<OverlayContainer
					showOverlay
					fadeAnim={fadeAnim}
					useNativeModal={false}
					scrollable
				>
					<Text>overlay-content</Text>
				</OverlayContainer>
			</PortalProvider>
		);

		await waitFor(() => expect(UNSAFE_getByType(ScrollView)).toBeTruthy());

		// The ScrollView sits inside a rounded, clipping frame: the card chrome
		// is stationary, so scrolling cannot push the corners out of view.
		let node: any = UNSAFE_getByType(ScrollView).parent;
		let frame: any = null;
		while (node && !frame) {
			const style = StyleSheet.flatten(node.props?.style);
			if (style?.borderRadius === 10 && style?.overflow === 'hidden') {
				frame = style;
			}
			node = node.parent;
		}
		expect(frame).toBeTruthy();
	});

	test('offers a labelled close button in the top-right corner', async () => {
		const onRequestClose = jest.fn();
		const { getByLabelText } = render(
			<PortalProvider>
				<OverlayContainer
					showOverlay
					fadeAnim={new Animated.Value(1)}
					useNativeModal={false}
					onRequestClose={onRequestClose}
				>
					<Text>overlay-content</Text>
				</OverlayContainer>
			</PortalProvider>
		);

		await waitFor(() => expect(getByLabelText('Close')).toBeTruthy());
		// The wrapper reserves a band above the card so the X never covers the title row.
		let node: any = getByLabelText('Close').parent;
		let band: number | undefined;
		while (node && band === undefined) {
			const style = StyleSheet.flatten(node.props?.style);
			if (style && typeof style.paddingTop === 'number') {
				band = style.paddingTop;
			}
			node = node.parent;
		}
		expect(band).toBe(38);
		fireEvent.press(getByLabelText('Close'));
		expect(onRequestClose).toHaveBeenCalledTimes(1);
	});

	test('hides the close button when asked or when there is nothing to close', async () => {
		const { queryByLabelText, rerender } = render(
			<PortalProvider>
				<OverlayContainer
					showOverlay
					fadeAnim={new Animated.Value(1)}
					useNativeModal={false}
				>
					<Text>overlay-content</Text>
				</OverlayContainer>
			</PortalProvider>
		);

		await waitFor(() => expect(queryByLabelText('Close')).toBeNull());

		rerender(
			<PortalProvider>
				<OverlayContainer
					showOverlay
					fadeAnim={new Animated.Value(1)}
					useNativeModal={false}
					onRequestClose={() => {}}
					showCloseButton={false}
				>
					<Text>overlay-content</Text>
				</OverlayContainer>
			</PortalProvider>
		);
		expect(queryByLabelText('Close')).toBeNull();
	});
});
