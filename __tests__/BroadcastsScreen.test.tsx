/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import BroadcastsScreen from '@/views/BroadcastsScreen';

// `userEvent` ships in this version's runtime but is missing from its typings.
const { userEvent } = jest.requireActual<{
	userEvent: { press: (element: unknown) => Promise<void> };
}>('@testing-library/react-native');

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
	useLocalSearchParams: () => ({ id: '12' }),
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);
jest.mock('@/hooks/useHeaderBack', () => () => undefined);

let mockUser: any = { id: 1, platform: { is_admin: true } };
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token', user: mockUser }),
}));

const sites = [{ id: 'r-1', name: 'Orange', label: 'Orange Hostel' }];
const templates = [{ id: 3, name: 'Notice', body: 'Maintenance tonight' }];
const limits = {
	max_recipients: 2000,
	max_message_length: 640,
	sms_segment_length: 160,
	sms_multipart_segment_length: 153,
};

const broadcast = {
	id: 12,
	message: 'Maintenance tonight',
	audience: 'site',
	audience_label: 'Orange Hostel',
	status: 'sent',
	status_label: 'Sent',
	recipients_count: 3,
	sent_count: 3,
	failed_count: 0,
	skipped_count: 0,
	admin: { id: 1, name: 'Admin' },
	created_at: '2026-10-31T09:00:00+03:00',
	date_from: null,
	date_to: null,
	purchases_filter: null,
	template: null,
	channel: 'sms',
};

const mockFetchBroadcasts = jest.fn();
const mockPreviewRecipients = jest.fn();
jest.mock('@/services/BroadcastService', () => ({
	fetchBroadcasts: (...args: any[]) => mockFetchBroadcasts(...args),
	previewRecipients: (...args: any[]) => mockPreviewRecipients(...args),
	queueBroadcast: jest.fn(),
	fetchBroadcast: jest.fn(),
	fetchBroadcastTemplates: jest.fn(),
	createBroadcastTemplate: jest.fn(),
	deleteBroadcastTemplate: jest.fn(),
}));

describe('BroadcastsScreen', () => {
	beforeEach(() => {
		mockUser = { id: 1, platform: { is_admin: true } };
		mockFetchBroadcasts.mockReset();
		mockPreviewRecipients.mockReset();
		mockFetchBroadcasts.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Broadcasts retrieved successfully',
				// `ApiResponse::paginated` splices every key at the top level.
				broadcasts: [broadcast],
				broadcasts_metadata: { current_page: 1, last_page: 1, total: 1 },
				sites,
				templates,
				limits,
			}),
		});
	});

	test('starts on the composer with the three audience choices', async () => {
		const { getAllByText, getByText } = render(<BroadcastsScreen />);

		await waitFor(() => expect(mockFetchBroadcasts).toHaveBeenCalled());

		expect(getAllByText('Compose').length).toBeGreaterThan(0);
		expect(getAllByText('History').length).toBeGreaterThan(0);
		expect(getAllByText('Templates').length).toBeGreaterThan(0);
		expect(getByText('Who receives it')).toBeTruthy();
		expect(getByText('All customers')).toBeTruthy();
		expect(getByText('One site')).toBeTruthy();
		expect(getByText('One number')).toBeTruthy();
	});

	test('loads the preview and shows the selected/in-audience/unchecked counts', async () => {
		mockPreviewRecipients.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Recipients retrieved successfully',
				recipients: [
					{
						phone: '256772494949',
						display_phone: '0772 494 949',
						purchases: 4,
						last_purchase_at: '2026-10-30T12:00:00+03:00',
						sites: ['Orange Hostel'],
					},
				],
				recipients_metadata: { current_page: 1, last_page: 1, total: 1 },
				summary: {
					total: 1,
					matched: 1,
					excluded: 0,
					max_recipients: 2000,
					over_limit: false,
					segments: 0,
				},
			}),
		});

		const { getAllByText, getByText, findByText } = render(
			<BroadcastsScreen />
		);

		await waitFor(() => expect(mockFetchBroadcasts).toHaveBeenCalled());

		await userEvent.press(getAllByText('Reload recipients')[0]);

		await findByText('0772 494 949');
		expect(getByText('In this audience')).toBeTruthy();
		expect(getByText('Recipients')).toBeTruthy();
	});

	test('a non-admin sees the notice and no tabs', async () => {
		mockUser = { id: 2, platform: { is_admin: false } };

		const { getAllByText, queryAllByText } = render(<BroadcastsScreen />);

		await waitFor(() =>
			expect(
				getAllByText('Only platform admins can send broadcasts.').length
			).toBeGreaterThan(0)
		);
		expect(mockFetchBroadcasts).not.toHaveBeenCalled();
		expect(queryAllByText('Who receives it').length).toBe(0);
	});

	test('an open audience dropdown lifts its section above the ones below', async () => {
		mockPreviewRecipients.mockResolvedValue({
			ok: true,
			json: async () => ({ summary: { total: 0 }, recipients: [] }),
		});

		const { getAllByText, toJSON } = render(<BroadcastsScreen />);

		await waitFor(() => expect(mockFetchBroadcasts).toHaveBeenCalled());

		// Closed: the audience section sits in normal flow.
		expect(hasZIndex(toJSON(), 20)).toBe(false);

		// Opening the Purchases menu has to raise its section, otherwise the
		// sections below paint over the menu.
		await userEvent.press(getAllByText('Any number')[0]);

		expect(hasZIndex(toJSON(), 20)).toBe(true);
	});
});

/** Does any node in the rendered tree carry this `zIndex`? */
function hasZIndex(node: any, target: number): boolean {
	if (!node) return false;
	if (Array.isArray(node)) return node.some((child) => hasZIndex(child, target));
	if (typeof node !== 'object') return false;

	if (hasZIndexInStyle(node.props?.style, target)) return true;

	return hasZIndex(node.children, target);
}

/** `style` may be an object, an array, or arrays of arrays. */
function hasZIndexInStyle(style: any, target: number): boolean {
	if (!style) return false;
	if (Array.isArray(style)) {
		return style.some((entry) => hasZIndexInStyle(entry, target));
	}
	if (typeof style !== 'object') return false;
	if (style.zIndex === target) return true;
	return false;
}
