/// <reference types="jest" />
import {
	render,
	userEvent,
	waitFor,
	type RenderResult,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import TransactionsScreen from '@/views/TransactionsScreen';

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
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);
jest.mock('@/hooks/useAccountsBack', () => () => undefined);

jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({
		language: 'en',
		authToken: 'token',
		user: { id: 1, platform: { is_admin: false } },
	}),
}));

const mockFetchPurchases = jest.fn();
jest.mock('@/services/UserService', () => ({
	fetchPurchases: (...args: any[]) => mockFetchPurchases(...args),
}));

const transactions = [
	{
		id: 1,
		reason: 'Hotspot voucher',
		type: 'credit',
		amount: '2000.00',
		status: 'successful',
		created_at: '2026-10-31T09:00:00+03:00',
		router: { id: 'r-1', name: 'Orange' },
	},
];

/** Flattened style of the filter section that owns the dropdowns. */
const filterTileStyles = (
	UNSAFE_getAllByProps: RenderResult['UNSAFE_getAllByProps']
) =>
	UNSAFE_getAllByProps({ id: 'transactions-filters-tile' }).map((node) =>
		StyleSheet.flatten(node.props.style)
	);

describe('TransactionsScreen filter menus', () => {
	beforeEach(() => {
		mockFetchPurchases.mockReset();
		mockFetchPurchases.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Transactions retrieved successfully',
				transactions,
				transactions_metadata: { current_page: 1, last_page: 1, total: 1 },
				total_amount: '2000.00',
			}),
		});
	});

	it('lifts the filter section above the list while a menu is open', async () => {
		const { getAllByText, UNSAFE_getAllByProps } = render(
			<TransactionsScreen />
		);
		await waitFor(() => expect(mockFetchPurchases).toHaveBeenCalled());

		// Both filter menus show "All"; the transaction type one is the second.
		const typeTrigger = getAllByText('All')[1];

		await userEvent.press(typeTrigger);

		await waitFor(() =>
			expect(
				filterTileStyles(UNSAFE_getAllByProps).some(
					(style) => style.zIndex === 20 && style.elevation === 20
				)
			).toBe(true)
		);
	});

	it('drops the lift again when the menu closes', async () => {
		const { getAllByText, UNSAFE_getAllByProps } = render(
			<TransactionsScreen />
		);
		await waitFor(() => expect(mockFetchPurchases).toHaveBeenCalled());

		const typeTrigger = getAllByText('All')[1];
		await userEvent.press(typeTrigger);
		await userEvent.press(typeTrigger);

		await waitFor(() =>
			expect(
				filterTileStyles(UNSAFE_getAllByProps).every(
					(style) => style.zIndex !== 20
				)
			).toBe(true)
		);
	});
});
