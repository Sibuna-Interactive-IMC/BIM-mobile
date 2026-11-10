/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import DataDeletionRequestsScreen from '@/views/DataDeletionRequestsScreen';

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

let mockUser: any = { id: 1, platform: { is_admin: true } };
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token', user: mockUser }),
}));

const mockFetchRequests = jest.fn();
const mockFetchRequest = jest.fn();
const mockReply = jest.fn();
const mockComplete = jest.fn();
const mockReject = jest.fn();
jest.mock('@/services/DataDeletionService', () => ({
	fetchAdminDataDeletionRequests: (...args: any[]) =>
		mockFetchRequests(...args),
	fetchAdminDataDeletionRequest: (...args: any[]) => mockFetchRequest(...args),
	replyToDataDeletionRequest: (...args: any[]) => mockReply(...args),
	completeDataDeletionRequest: (...args: any[]) => mockComplete(...args),
	rejectDataDeletionRequest: (...args: any[]) => mockReject(...args),
}));

const requests = [
	{
		id: 14,
		name: 'Grace Nakato',
		email: 'grace@example.com',
		phone: '+256700000000',
		request_type: 'account',
		request_type_label: 'Account and all data',
		status: 'pending',
		status_label: 'Pending',
		created_at: '2026-10-30T12:00:00+03:00',
	},
];

describe('DataDeletionRequestsScreen', () => {
	beforeEach(() => {
		mockUser = { id: 1, platform: { is_admin: true } };
		mockFetchRequests.mockReset();
		mockFetchRequest.mockReset();
		mockReply.mockReset();
		mockComplete.mockReset();
		mockReject.mockReset();
		mockFetchRequests.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				data: {
					deletion_requests: requests,
					status_counts: {
						pending: 1,
						in_review: 0,
						awaiting_user: 0,
						completed: 0,
						rejected: 0,
					},
					total: 1,
				},
				meta: {
					pagination: {
						deletion_requests: {
							current_page: 1,
							last_page: 1,
							total: 1,
						},
					},
				},
			}),
		});
	});

	test('loads deletion requests and status counts for platform admins', async () => {
		const { findByText, getAllByText } = render(
			<DataDeletionRequestsScreen />
		);

		await waitFor(() =>
			expect(mockFetchRequests).toHaveBeenCalledWith(
				'token',
				expect.objectContaining({ page: 1, perPage: 20 })
			)
		);
		expect(await findByText(/Grace Nakato/)).toBeTruthy();
		expect(getAllByText('Pending').length).toBeGreaterThan(0);
		expect(getAllByText('Account and all data').length).toBeGreaterThan(0);
	});

	test('does not request the admin queue for non-admin users', async () => {
		mockUser = { id: 2, platform: { is_admin: false } };
		const { findByText } = render(<DataDeletionRequestsScreen />);

		expect(
			await findByText('Only platform admins can manage data deletion requests.')
		).toBeTruthy();
		expect(mockFetchRequests).not.toHaveBeenCalled();
	});
});
