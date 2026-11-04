/// <reference types="jest" />
import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import HomeScreen from '@/views/HomeScreen';

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
jest.mock('react-native-chart-kit', () => ({ BarChart: () => null }));
jest.mock('@react-navigation/bottom-tabs', () => ({
	useBottomTabBarHeight: () => 0,
}));
jest.mock('@react-navigation/native', () => ({
	useIsFocused: () => true,
}));
jest.mock('expo-router', () => ({
	useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
	usePathname: () => '/',
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);
jest.mock('@/helpers/appReady', () => ({ signalAppReady: jest.fn() }));

jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({
		setSelectedOption: jest.fn(),
		language: 'en',
		user: { id: 1, platform: { is_admin: false } },
		refreshDashboard: jest.fn(),
		dashboardLoading: false,
		lastDashboardUpdated: null,
	}),
}));

const mockRecentTransactions = [
	{
		id: 't-1',
		amount: 500,
		status: 'successful',
		routerName: 'KISA Hostel',
		date: new Date('2026-11-03T19:00:00Z'),
		created_at: new Date('2026-11-03T19:00:00Z'),
		reason: 'other',
		type: 'credit',
		method: { type: 'credit' },
		router: { id: 'r-1', name: 'KISA Hostel' },
		gateway: 'YO',
	},
	{
		id: 't-2',
		amount: 1000,
		status: 'pending',
		routerName: 'KISA Hostel',
		date: new Date('2026-11-03T18:00:00Z'),
		created_at: new Date('2026-11-03T18:00:00Z'),
		reason: 'other',
		type: 'credit',
		method: { type: 'credit' },
		router: { id: 'r-1', name: 'KISA Hostel' },
		gateway: null,
	},
	{
		id: 't-3',
		amount: 2000,
		status: 'failed',
		routerName: 'Orange Hostel',
		date: new Date('2026-11-03T17:00:00Z'),
		created_at: new Date('2026-11-03T17:00:00Z'),
		reason: 'other',
		type: 'credit',
		method: { type: 'credit' },
		router: { id: 'r-2', name: 'Orange Hostel' },
		gateway: null,
	},
];

jest.mock('@/context/TransactionContext', () => ({
	useTransaction: () => ({
		dailyPurchasesTotal: 500,
		weeklyPurchasesTotal: 1500,
		monthlyPurchasesTotal: 2000,
		lastSevenDaysPurchases: [],
		lastFiveTransactions: mockRecentTransactions,
		purchasesPerRouter: [],
		dailyVoucherUsersTotal: 1,
		weeklyVoucherUsersTotal: 2,
		monthlyVoucherUsersTotal: 3,
	}),
}));

describe('HomeScreen transaction tiles', () => {
	it('leads each transaction with its router and colour-coded status', () => {
		const { getAllByText, getByText } = render(<HomeScreen />);

		const colorOf = (label: string) =>
			StyleSheet.flatten(getAllByText(label)[0].props.style).color;

		// Successful → green, pending → yellow, failed → red (same as web).
		expect(colorOf('Successful')).toBe('#72E128');
		expect(colorOf('Pending')).toBe('#FDB529');
		expect(colorOf('Failed')).toBe('#FF3B30');

		// The router name is the card title, not a field.
		expect(getByText('Orange Hostel')).toBeTruthy();
		expect(() => getByText('Router Name')).toThrow();
	});
});
