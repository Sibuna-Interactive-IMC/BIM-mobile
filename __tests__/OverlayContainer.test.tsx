import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Animated, Text } from 'react-native';
import { act } from 'react-test-renderer';

import OverlayContainer from '@/components/OverlayContainer';
import { PortalProvider } from '@/components/Portal';

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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
});
