/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import PaymentGatewayScreen from '@/views/PaymentGatewayScreen';

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

let mockUser = { id: 1, platform: { is_admin: true } } as any;
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token', user: mockUser }),
}));

const relworx = {
	provider: 'relworx',
	label: 'Relworx',
	role: 'primary',
	state: 'open',
	open: true,
	consecutive_failures: 3,
	backoff_minutes: 15,
	last_failure_at: '2026-10-31T09:00:00+03:00',
	probe_due_at: '2026-10-31T09:15:00+03:00',
	last_success_at: '2026-10-31T08:00:00+03:00',
};

const yo = {
	provider: 'yo',
	label: 'Yo! Payments',
	role: 'secondary',
	state: 'closed',
	open: false,
	consecutive_failures: 0,
	backoff_minutes: 0,
	last_failure_at: null,
	probe_due_at: null,
	last_success_at: '2026-10-31T09:30:00+03:00',
};

const mockFetchPaymentRouting = jest.fn();
jest.mock('@/services/PaymentGatewayService', () => ({
	fetchPaymentRouting: (...args: any[]) => mockFetchPaymentRouting(...args),
	setPaymentProvider: jest.fn(),
}));

function respondWith(paymentProvider: Record<string, unknown>) {
	mockFetchPaymentRouting.mockResolvedValue({
		ok: true,
		json: async () => ({
			success: true,
			message: 'Payment provider routing retrieved successfully',
			// `ApiResponse::success()` splices the payload at the top level.
			payment_provider: paymentProvider,
		}),
	});
}

describe('PaymentGatewayScreen', () => {
	beforeEach(() => {
		mockFetchPaymentRouting.mockReset();
		mockUser = { id: 1, platform: { is_admin: true } };
	});

	test('shows the forced provider, both circuits and the override choice', async () => {
		respondWith({
			mode: 'forced',
			forced: 'yo',
			forced_since: '2026-10-01T10:00:00+03:00',
			active: 'yo',
			active_label: 'Yo! Payments',
			primary: 'relworx',
			secondary: 'yo',
			forcing_open_primary: false,
			providers: { relworx, yo },
		});

		const { getByText, getAllByText } = render(<PaymentGatewayScreen />);

		await waitFor(() =>
			expect(
				getByText('Collections are going through Yo! Payments')
			).toBeTruthy()
		);

		expect(getAllByText('Manual override').length).toBeGreaterThan(0);
		expect(getAllByText('Relworx').length).toBeGreaterThan(0);
		expect(getAllByText('Circuit open').length).toBeGreaterThan(0);
		expect(getAllByText('15 min').length).toBeGreaterThan(0);
		expect(getAllByText('Force Relworx').length).toBeGreaterThan(0);
		expect(getAllByText('Force Yo! Payments').length).toBeGreaterThan(0);
		expect(getAllByText('Save routing').length).toBeGreaterThan(0);
	});

	test('warns when the override points at a provider whose circuit is open', async () => {
		respondWith({
			mode: 'forced',
			forced: 'relworx',
			forced_since: '2026-10-01T10:00:00+03:00',
			active: 'relworx',
			active_label: 'Relworx',
			primary: 'relworx',
			secondary: 'yo',
			forcing_open_primary: true,
			providers: { relworx, yo },
		});

		const { getAllByText } = render(<PaymentGatewayScreen />);

		await waitFor(() =>
			expect(getAllByText('Forced on while its circuit is open').length).toBe(1)
		);
	});

	test('shows automatic failover with no forced-provider fields', async () => {
		respondWith({
			mode: 'auto',
			forced: null,
			forced_since: null,
			active: 'yo',
			active_label: 'Yo! Payments',
			primary: 'relworx',
			secondary: 'yo',
			forcing_open_primary: false,
			providers: { relworx: { ...relworx, open: false, state: 'closed' }, yo },
		});

		const { getAllByText, queryAllByText } = render(<PaymentGatewayScreen />);

		await waitFor(() =>
			expect(getAllByText('Automatic failover').length).toBeGreaterThan(0)
		);
		expect(queryAllByText('Forced provider').length).toBe(0);
		expect(queryAllByText('Circuit open').length).toBe(0);
	});

	test('admins only: a non-admin sees the notice, not the routing', async () => {
		mockUser = { id: 2, platform: { is_admin: false } };
		respondWith({});

		const { getAllByText, queryAllByText } = render(<PaymentGatewayScreen />);

		await waitFor(() =>
			expect(
				getAllByText('Only platform admins can change payment routing.').length
			).toBeGreaterThan(0)
		);
		expect(mockFetchPaymentRouting).not.toHaveBeenCalled();
		expect(queryAllByText('Save routing').length).toBe(0);
	});
});
