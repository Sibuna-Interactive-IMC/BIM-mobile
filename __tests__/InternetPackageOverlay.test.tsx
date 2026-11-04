/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Animated } from 'react-native';

import InternetPackageOverlay from '@/views/InternetPackageOverlay';

jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en' }),
}));

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@expo/vector-icons', () => ({
	MaterialIcons: () => null,
	MaterialCommunityIcons: () => null,
	Ionicons: () => null,
}));

describe('InternetPackageOverlay', () => {
	it('prefills the RADIUS profile fields of the package being edited', async () => {
		const { getByDisplayValue } = render(
			<InternetPackageOverlay
				visible
				fadeAnim={new Animated.Value(1)}
				mode='edit'
				initial={{
					'.id': 'group-1',
					name: 'weekly',
					display_name: 'Weekly',
					'rate-limit': '2Mbps',
					'simultaneous-use': 2,
					'session-timeout': '168',
				}}
				onClose={jest.fn()}
				onSubmit={jest.fn()}
			/>
		);

		await waitFor(() => expect(getByDisplayValue('weekly')).toBeTruthy());
		expect(getByDisplayValue('2')).toBeTruthy();
		expect(getByDisplayValue('2Mbps')).toBeTruthy();
		expect(getByDisplayValue('168')).toBeTruthy();
	});
});
