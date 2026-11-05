/// <reference types="jest" />
import { render } from '@testing-library/react-native';
import React from 'react';
import { ScrollView, Text } from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
	useBottomTabBarHeight: () => 0,
}));
jest.mock('expo-blur', () => ({ BlurView: ({ children }: any) => children }));

describe('ParallaxScrollView', () => {
	test('lets the first tap reach buttons while the keyboard is open', () => {
		const { UNSAFE_getByType } = render(
			<ParallaxScrollView>
				<Text>form</Text>
			</ParallaxScrollView>
		);

		// With the framework default ('never') the tap that dismisses the keyboard
		// is swallowed, so submitting a form took two taps.
		expect(
			UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps
		).toBe('handled');
	});
});
