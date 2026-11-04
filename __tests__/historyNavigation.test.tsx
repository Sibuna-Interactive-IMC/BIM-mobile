import { GeneralProvider, useGeneral } from '@/context/GeneralContext';
import * as AuthService from '@/services/AuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { act } from 'react-test-renderer';
import { renderHook } from './utils/renderHook';

(global as any).__DEV__ = true;

jest.mock('expo-blur', () => ({
	BlurView: ({ children }: any) => children,
}));
jest.mock('expo-constants', () => ({
	manifest: { extra: {} },
	expoConfig: { extra: {} },
}));
jest.mock('@/constants/API', () => ({
	apiBaseUrl: 'https://api.example.com',
}));
jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
	SafeAreaProvider: ({ children }: any) => children,
}));
jest.mock('expo-router', () => ({
	useRouter: jest.fn(),
	usePathname: jest.fn(() => '/'),
}));
jest.mock('expo-secure-store', () => ({
	getItemAsync: jest.fn(),
	deleteItemAsync: jest.fn(),
	setItemAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
}));
jest.mock('@/services/AuthService', () => ({
	logout: jest.fn(),
	refreshToken: jest.fn(),
	verifyToken: jest.fn(),
}));
jest.mock('@/helpers/api', () => ({
	registerAuthCallbacks: jest.fn(),
	parseApiError: jest.fn(),
}));
jest.mock('@/helpers', () => ({
	delay: jest.fn(() => Promise.resolve()),
	normalizePhoneForApi: jest.fn(),
	parseAmount: jest.fn(),
}));
jest.mock('expo-device', () => ({
	totalMemory: 1000,
}));
jest.mock('@react-native-community/netinfo', () => ({
	useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));

describe('view history navigation', () => {
	let router: {
		push: jest.Mock;
		replace: jest.Mock;
		dismissTo: jest.Mock;
		back: jest.Mock;
	};

	beforeEach(() => {
		jest.clearAllMocks();
		router = {
			push: jest.fn(),
			replace: jest.fn(),
			dismissTo: jest.fn(),
			back: jest.fn(),
		};
		(useRouter as jest.Mock).mockReturnValue(router);
	});

	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<GeneralProvider>{children}</GeneralProvider>
	);

	test('records paths once and de-duplicates consecutive entries', () => {
		const { result } = renderHook(() => useGeneral(), { wrapper });

		act(() => {
			result.current.handleUpdateHistory('/(authenticated)/home');
			result.current.handleUpdateHistory('/(authenticated)/routers');
			result.current.handleUpdateHistory('/(authenticated)/routers');
		});

		expect(result.current.history).toEqual([
			'/(authenticated)/home',
			'/(authenticated)/routers',
		]);
	});

	test('handleGoBack pops the current screen and navigates to the previous one', async () => {
		const { result } = renderHook(() => useGeneral(), { wrapper });

		act(() => {
			result.current.handleUpdateHistory('/(authenticated)/home');
			result.current.handleUpdateHistory('/(authenticated)/routers');
			result.current.handleUpdateHistory('/(authenticated)/routers/preview/1');
		});

		await act(async () => {
			result.current.handleGoBack();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		expect(result.current.history).toEqual([
			'/(authenticated)/home',
			'/(authenticated)/routers',
		]);
		// The authenticated area is a Drawer navigator, where REPLACE maps to
		// JUMP_TO. POP_TO/dismissTo is unsupported there, so we must not use it.
		expect(router.replace).toHaveBeenCalledWith('/(authenticated)/routers');
		expect(router.dismissTo).not.toHaveBeenCalled();
	});

	test('stale history from a previous run is dropped, not restored', () => {
		(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
			JSON.stringify(['/(authenticated)/old-route'])
		);

		const { result } = renderHook(() => useGeneral(), { wrapper });

		expect(AsyncStorage.removeItem).toHaveBeenCalledWith('BIM_history_v1');
		expect(result.current.history).toEqual([]);
	});

	test('logout clears the recorded history', async () => {
		(SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');
		(AuthService.logout as jest.Mock).mockResolvedValue({ ok: true });

		const { result } = renderHook(() => useGeneral(), { wrapper });

		act(() => {
			result.current.handleUpdateHistory('/(authenticated)/home');
			result.current.handleUpdateHistory('/(authenticated)/routers');
		});

		expect(result.current.history).toHaveLength(2);

		await act(async () => {
			await result.current.handleLogout();
		});

		expect(result.current.history).toEqual([]);
		expect(AsyncStorage.setItem).toHaveBeenCalledWith('BIM_history_v1', '[]');
	});
});
