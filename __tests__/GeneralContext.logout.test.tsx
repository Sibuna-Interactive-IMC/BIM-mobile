import { GeneralProvider, useGeneral } from '@/context/GeneralContext';
import * as AuthService from '@/services/AuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { act } from 'react-test-renderer';
import { renderHook } from './utils/renderHook';

// Set __DEV__ for testing environment (type assertion needed since it's declared as const)
(global as any).__DEV__ = true;

// Mocks
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
  apiFetch: jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
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
    useNetInfo: () => ({ isConnected: true, isInternetReachable: false }),
}));

describe('GeneralContext Logout', () => {
  let mockRouterReplace: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockRouterReplace });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GeneralProvider>{children}</GeneralProvider>
  );

  test('handleLogout performs optimistic logout on backend failure', async () => {
    // Setup: Token exists
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');
    
    // Setup: Backend logout fails
    (AuthService.logout as jest.Mock).mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useGeneral(), { wrapper });

    act(() => {
      result.current.setAuthToken?.('test-token');
    });

    await act(async () => {
      await result.current.handleLogout();
    });

    // Verify: Backend logout was attempted
    expect(AuthService.logout).toHaveBeenCalledWith('test-token');

    // Verify: Local cleanup occurred despite backend failure
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('totp_secret');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user_id');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user_email');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user_phone');
    expect(result.current.authToken).toBeNull();

    // Verify: Redirected to login
    expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/login');
    
    // Verify: Success message (optimistic)
    expect(result.current.appMessage?.type).toBe('message');
  });

  test('handleLogout handles successful backend logout', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');
    (AuthService.logout as jest.Mock).mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useGeneral(), { wrapper });

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(AuthService.logout).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/login');
    expect(result.current.appMessage?.type).toBe('message');
  });
});
