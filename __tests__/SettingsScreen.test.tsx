/// <reference types="jest" />
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import SettingsScreen from '@/views/SettingsScreen';

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));
jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-blur', () => ({ BlurView: ({ children }: any) => children }));
jest.mock('expo-constants', () => ({
	manifest: { extra: {} },
	expoConfig: { extra: {} },
	default: { expoConfig: { extra: {} } },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@expo/vector-icons', () => ({
	MaterialIcons: () => null,
	MaterialCommunityIcons: () => null,
	Ionicons: () => null,
}));
jest.mock('react-native-svg', () => ({ SvgUri: () => null }));
jest.mock('@react-navigation/bottom-tabs', () => ({
	useBottomTabBarHeight: () => 0,
}));
jest.mock('expo-router', () => ({
	useRouter: () => ({
		push: jest.fn(),
		replace: jest.fn(),
		back: jest.fn(),
	}),
	usePathname: () => '/',
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token' }),
}));

const mockFetchInboxSettings = jest.fn();
const mockSaveInboxSettings = jest.fn();
jest.mock('@/services/InboxService', () => ({
	fetchInboxSettings: (...args: any[]) => mockFetchInboxSettings(...args),
	saveInboxSettings: (...args: any[]) => mockSaveInboxSettings(...args),
}));

const settingsFixture = {
	success: true,
	data: {
		categories: [
			{
				key: 'approval.withdrawal',
				label: 'Withdrawal approvals',
				channels: {
					fcm: { label: 'Push', enabled: true, locked: false },
					mail: { label: 'Email', enabled: false, locked: false },
					broadcast: { label: 'SMS', enabled: true, locked: true },
				},
			},
		],
		channels: { fcm: 'Push', mail: 'Email', broadcast: 'SMS' },
		available: { push: true },
	},
};

describe('SettingsScreen', () => {
	beforeEach(() => {
		mockFetchInboxSettings.mockReset();
		mockSaveInboxSettings.mockReset();

		mockFetchInboxSettings.mockResolvedValue({
			ok: true,
			json: async () => settingsFixture,
		});
		mockSaveInboxSettings.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true }),
		});
	});

	test('renders the channel matrix for each category', async () => {
		const { getByText, getByLabelText } = render(<SettingsScreen />);

		await waitFor(() => expect(mockFetchInboxSettings).toHaveBeenCalledWith('token'));

		// The category row only exists once the matrix has been applied.
		await waitFor(() => expect(getByText('Withdrawal approvals')).toBeTruthy());
		expect(getByText('Notification preferences')).toBeTruthy();
		expect(getByLabelText('Withdrawal approvals Push').props.value).toBe(true);
		expect(getByLabelText('Withdrawal approvals Email').props.value).toBe(false);
	});

	test('a locked channel cannot be switched off', async () => {
		const { getByLabelText } = render(<SettingsScreen />);

		await waitFor(() => expect(mockFetchInboxSettings).toHaveBeenCalled());

		expect(getByLabelText('Withdrawal approvals SMS').props.disabled).toBe(true);
	});

	test('an on switch matches its track colour', async () => {
		const { getByLabelText } = render(<SettingsScreen />);

		await waitFor(() => expect(mockFetchInboxSettings).toHaveBeenCalled());

		// RN maps `trackColor.true` to onTintColor and `thumbColor` to thumbTintColor.
		const push = getByLabelText('Withdrawal approvals Push');
		expect(push.props.thumbTintColor).toBe('#EE8438');
		expect(push.props.onTintColor).toBe('#EE8438');
	});

	test('flipping a channel patches only that entry', async () => {
		const { getByLabelText } = render(<SettingsScreen />);

		await waitFor(() => expect(mockFetchInboxSettings).toHaveBeenCalled());

		fireEvent(getByLabelText('Withdrawal approvals Email'), 'valueChange', true);

		await waitFor(() =>
			expect(mockSaveInboxSettings).toHaveBeenCalledWith(
				[{ category: 'approval.withdrawal', channel: 'mail', enabled: true }],
				'token'
			)
		);
	});

	test('a rejected preference is rolled back', async () => {
		mockSaveInboxSettings.mockResolvedValue({
			ok: false,
			json: async () => ({ message: 'Nope' }),
		});

		const { getByLabelText } = render(<SettingsScreen />);
		await waitFor(() => expect(mockFetchInboxSettings).toHaveBeenCalled());

		fireEvent(getByLabelText('Withdrawal approvals Email'), 'valueChange', true);
		await waitFor(() => expect(mockSaveInboxSettings).toHaveBeenCalled());

		await waitFor(() =>
			expect(getByLabelText('Withdrawal approvals Email').props.value).toBe(false)
		);
	});
});
