/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import VerifyTokenScreen from '@/views/VerifyTokenScreen';

// `fireEvent` ships in this version's runtime but its event typings are missing.
const { fireEvent } = jest.requireActual<{
	fireEvent: {
		changeText: (element: unknown, text: string) => void;
		press: (element: unknown) => void;
		(element: unknown, event: string, data?: unknown): void;
	};
}>('@testing-library/react-native');

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-blur', () => ({ BlurView: ({ children }: any) => children }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-constants', () => ({
	manifest: { extra: {} },
	expoConfig: { extra: {} },
	default: { expoConfig: { extra: {} } },
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
	useBottomTabBarHeight: () => 0,
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);

const mockHandleVerify = jest.fn();
const mockHandleVerify2FA = jest.fn();

jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({
		language: 'en',
		handleVerify: mockHandleVerify,
		handleVerify2FA: mockHandleVerify2FA,
		pending2FAMethod: 'totp',
	}),
}));

describe('VerifyTokenScreen', () => {
	beforeEach(() => {
		mockHandleVerify.mockReset();
		mockHandleVerify2FA.mockReset();
	});

	test('the keyboard submit key verifies a TOTP code through the authenticator endpoint', async () => {
		const { getByPlaceholderText, getByText } = render(<VerifyTokenScreen />);

		const input = getByPlaceholderText('Enter code from authenticator');
		fireEvent.changeText(input, '123456');
		fireEvent(input, 'submitEditing', { nativeEvent: { text: '123456' } });

		await waitFor(() =>
			expect(mockHandleVerify2FA).toHaveBeenCalledWith('123456')
		);
		expect(mockHandleVerify).not.toHaveBeenCalled();

		// The button takes the same path.
		mockHandleVerify2FA.mockClear();
		fireEvent.press(getByText('VERIFY OTP'));
		await waitFor(() =>
			expect(mockHandleVerify2FA).toHaveBeenCalledWith('123456')
		);
		expect(mockHandleVerify).not.toHaveBeenCalled();
	});
});
