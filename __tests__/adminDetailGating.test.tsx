/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import AccountAnalyticsDetailScreen from '@/views/AccountAnalyticsDetailScreen';
import BroadcastDetailScreen from '@/views/BroadcastDetailScreen';

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
jest.mock('@react-navigation/bottom-tabs', () => ({
	useBottomTabBarHeight: () => 0,
}));
jest.mock('expo-router', () => ({
	useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
	usePathname: () => '/',
	useLocalSearchParams: () => ({ accountId: '5', id: '12' }),
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);
jest.mock('@/hooks/useHeaderBack', () => () => undefined);

let mockUser: any = { id: 1, platform: { is_admin: false } };
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token', user: mockUser }),
}));

const mockAnalyticsAccount = jest.fn();
const mockVouchers = jest.fn();
const mockWithdrawals = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({
	fetchAnalyticsAccount: (...args: any[]) => mockAnalyticsAccount(...args),
	fetchAnalyticsAccountVouchers: (...args: any[]) => mockVouchers(...args),
	fetchAnalyticsAccountWithdrawals: (...args: any[]) => mockWithdrawals(...args),
}));

const mockBroadcast = jest.fn();
jest.mock('@/services/BroadcastService', () => ({
	fetchBroadcast: (...args: any[]) => mockBroadcast(...args),
}));

describe('admin detail screens are closed to regular users', () => {
	beforeEach(() => {
		mockUser = { id: 1, platform: { is_admin: false } };
		mockAnalyticsAccount.mockReset();
		mockVouchers.mockReset();
		mockWithdrawals.mockReset();
		mockBroadcast.mockReset();
	});

	test('account analytics detail fetches nothing and says why', async () => {
		const { findAllByText } = render(<AccountAnalyticsDetailScreen />);

		await findAllByText('Only platform admins can open account analytics.');

		expect(mockAnalyticsAccount).not.toHaveBeenCalled();
		expect(mockVouchers).not.toHaveBeenCalled();
		expect(mockWithdrawals).not.toHaveBeenCalled();
	});

	test('broadcast detail fetches nothing and says why', async () => {
		const { findAllByText } = render(<BroadcastDetailScreen />);

		await findAllByText('Only platform admins can send broadcasts.');

		expect(mockBroadcast).not.toHaveBeenCalled();
	});

	test('an admin still loads both screens', async () => {
		mockUser = { id: 1, platform: { is_admin: true } };
		mockAnalyticsAccount.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, account: { id: 5, name: 'Acme' } }),
		});
		mockBroadcast.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				broadcast: {
					id: 12,
					message: 'Hello',
					status: 'sent',
					status_label: 'Sent',
					audience: 'all',
					audience_label: 'All customers',
					recipients_count: 1,
					sent_count: 1,
					failed_count: 0,
					skipped_count: 0,
				},
				recipients: [],
			}),
		});

		render(<AccountAnalyticsDetailScreen />);
		await waitFor(() => expect(mockAnalyticsAccount).toHaveBeenCalled());

		render(<BroadcastDetailScreen />);
		await waitFor(() => expect(mockBroadcast).toHaveBeenCalled());
	});
});
