/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import VouchersScreen from '@/views/VouchersScreen';

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
jest.mock('@react-navigation/native', () => ({
	useIsFocused: () => true,
}));
jest.mock('expo-router', () => ({
	useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
	usePathname: () => '/',
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);

jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token', user: { id: 1 } }),
}));

jest.mock('@/views/VoucherQrPreview', () => () => null);
jest.mock('@/views/GenerateVouchersOverlay', () => () => null);

const vouchers = [
	{
		username: '1111111',
		status: 'active',
		router_name: 'KISA Hostel',
		profile: 'DAILY_1000',
		is_manual: true,
		is_trial: false,
	},
	{
		username: '2222222',
		status: 'unused',
		router_name: 'KISA Hostel',
		profile: '3DAYS_TRIAL',
		is_manual: false,
		is_trial: true,
	},
	{
		username: '3333333',
		status: 'unused',
		router_name: 'Orange Hostel',
		profile: 'WEEKLY_5000',
		is_manual: false,
		is_trial: false,
	},
];

const mockFetchVouchers = jest.fn();
const mockFetchRouters = jest.fn();
const mockFetchProfiles = jest.fn();
jest.mock('@/services/VoucherService', () => ({
	fetchVouchers: (...args: any[]) => mockFetchVouchers(...args),
	fetchVoucherRouters: (...args: any[]) => mockFetchRouters(...args),
	fetchVoucherHotspots: jest.fn(),
	enableVoucherUser: jest.fn(),
	disableVoucherUser: jest.fn(),
	resetVoucherUser: jest.fn(),
	deleteVoucherUser: jest.fn(),
}));
jest.mock('@/services/PackageService', () => ({
	fetchSharedProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

describe('VouchersScreen origin indicators', () => {
	beforeEach(() => {
		mockFetchVouchers.mockReset();
		mockFetchRouters.mockReset();
		mockFetchProfiles.mockReset();
		mockFetchVouchers.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Vouchers retrieved successfully',
				data: {
					vouchers,
					stats: { total: 3, manual: 1 },
					router_stats: [],
				},
				meta: {
					pagination: {
						vouchers: { current_page: 1, last_page: 1, total: 3 },
					},
				},
			}),
		});
		mockFetchRouters.mockResolvedValue({
			ok: true,
			json: async () => ({ data: { routers: [] } }),
		});
		mockFetchProfiles.mockResolvedValue({
			ok: true,
			json: async () => ({ data: { profiles: [] } }),
		});
	});

	it('marks manually generated and free-trial vouchers inline', async () => {
		const { getByLabelText, getByText } = render(<VouchersScreen />);

		await waitFor(() => expect(mockFetchVouchers).toHaveBeenCalled());
		await waitFor(() => expect(getByText('M')).toBeTruthy());

		const marker = (letter: 'M' | 'T') => {
			const text = getByText(letter);
			let node = text.parent;
			let chip: ViewStyle | undefined;
			while (node && !chip) {
				const style = StyleSheet.flatten(
					node.props.style as StyleProp<ViewStyle>
				);
				if (style?.backgroundColor) chip = style;
				node = node.parent;
			}
			return {
				text: StyleSheet.flatten(text.props.style as StyleProp<TextStyle>),
				chip,
			};
		};

		// One manual voucher and one free-trial voucher in the fixture. Web paints
		// these with bg-info (cyan) and bg-warning (yellow), with white ink.
		const manual = marker('M');
		expect(manual.chip?.backgroundColor).toBe('#29C5F9');
		expect(manual.text?.color).toBe('#ffffff');

		const trial = marker('T');
		expect(trial.chip?.backgroundColor).toBe('#FDB529');
		expect(trial.text?.color).toBe('#ffffff');

		// The chip is padded and spaced off the code, not glued to it.
		expect(manual.chip?.paddingHorizontal).toBe(5);
		expect(manual.chip?.marginLeft).toBe(4);

		// The code stays its own text node.
		expect(getByText('1111111')).toBeTruthy();
		expect(getByText('2222222')).toBeTruthy();
		expect(getByText('3333333')).toBeTruthy();
		expect(getByLabelText('Manual')).toBeTruthy();
		expect(getByLabelText('Trial')).toBeTruthy();
	});
});
