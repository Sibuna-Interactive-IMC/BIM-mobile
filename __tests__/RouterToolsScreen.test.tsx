/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import RouterToolsScreen from '@/views/RouterToolsScreen';

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
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);
jest.mock('@/hooks/useHeaderBack', () => () => undefined);

let mockUser: any = { id: 1, platform: { is_admin: true } };
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token', user: mockUser }),
}));

const mockFetchRouters = jest.fn();
jest.mock('@/services/RouterService', () => ({
	fetchRouters: (...args: any[]) => mockFetchRouters(...args),
}));

const mockFetchFleet = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({
	fetchBusinessRouters: (...args: any[]) => mockFetchFleet(...args),
}));

const mockDiagnose = jest.fn();
const mockRun = jest.fn();
jest.mock('@/services/RouterToolsService', () => ({
	diagnoseRouter: (...args: any[]) => mockDiagnose(...args),
	runRouterAction: (...args: any[]) => mockRun(...args),
	previewRouterAction: jest.fn(),
	fetchRouterTaskLog: jest.fn(),
}));

const routers = [
	{ id: 'r-1', name: 'Orange Hostel' },
	{ id: 'r-2', name: 'Blue Lodge' },
];

describe('RouterToolsScreen', () => {
	beforeEach(() => {
		mockUser = { id: 1, platform: { is_admin: true } };
		mockFetchRouters.mockReset();
		mockFetchFleet.mockReset();
		mockDiagnose.mockReset();
		mockRun.mockReset();
		mockFetchFleet.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Router leaderboard retrieved successfully',
				routers,
			}),
		});
		mockFetchRouters.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Routers retrieved successfully',
				routers,
			}),
		});
	});

	test('lists the four explicit tools with the web-only note at the bottom', async () => {
		const { getAllByText, getByText } = render(<RouterToolsScreen />);

		await waitFor(() => expect(mockFetchFleet).toHaveBeenCalled());

		expect(getByText('Connectivity & identity')).toBeTruthy();
		expect(getByText('Push portal files')).toBeTruthy();
		expect(getByText('Link RADIUS users')).toBeTruthy();
		expect(getByText('Send RouterOS command')).toBeTruthy();
		expect(getByText('Remove duplicate cookies')).toBeTruthy();
		expect(getAllByText(/bim\.sibuna\.us/).length).toBeGreaterThan(0);
	});

	test('the picker lists the whole fleet, not the caller’s own routers', async () => {
		// `/routers` is accessibility-scoped and returns three of the five routers;
		// the admin leaderboard returns all of them.
		mockFetchFleet.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				routers: [
					{ id: 'r-9', name: 'Another Account Router' },
					{ id: 'r-8', name: 'Fifth Router' },
					{ id: 'r-1', name: 'Orange Hostel' },
				],
			}),
		});
		mockFetchRouters.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				routers: [{ id: 'r-1', name: 'Orange Hostel' }],
			}),
		});

		const { findAllByText, queryAllByText } = render(<RouterToolsScreen />);

		const [firstValue] = await findAllByText('Another Account Router');
		// The options only render while the picker is open.
		await userEvent.press(firstValue);
		await findAllByText('Fifth Router');
		// The scoped list is not consulted at all once the fleet arrives.
		expect(mockFetchRouters).not.toHaveBeenCalled();
		expect(queryAllByText('Blue Lodge').length).toBe(0);
	});

	test('falls back to /routers when the fleet payload is empty', async () => {
		mockFetchFleet.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, routers: [] }),
		});

		const { findAllByText } = render(<RouterToolsScreen />);

		await findAllByText('Orange Hostel');
		expect(mockFetchRouters).toHaveBeenCalledWith('token');
	});

	test('checking connectivity reads the preselected router', async () => {
		mockDiagnose.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Router identity retrieved successfully',
				routers: [
					{
						router: { id: 'r-1', name: 'Orange Hostel' },
						identity: {
							ok: true,
							identity: { name: 'orange-1' },
							resource: {
								version: '7.15.3',
								uptime: '3d4h',
								'cpu-load': '12',
								'free-memory': '48234496',
								'board-name': 'hEX',
							},
							error: null,
						},
					},
				],
			}),
		});

		const { getAllByText, findAllByText, findByText } = render(
			<RouterToolsScreen />
		);
		await waitFor(() => expect(mockFetchFleet).toHaveBeenCalled());

		// The tools stay disabled until a router is selected, so wait for it.
		await findAllByText('Orange Hostel');

		await userEvent.press(getAllByText('Check now')[0]);

		await findByText('Reachable');
		expect(mockDiagnose).toHaveBeenCalledWith({
			routerId: 'r-1',
			token: 'token',
		});
	});

	test('pushing portal files queues the action for the picked router', async () => {
		mockRun.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, message: 'Queued.' }),
		});

		const { getAllByText, findAllByText, findByText } = render(
			<RouterToolsScreen />
		);
		await waitFor(() => expect(mockFetchFleet).toHaveBeenCalled());

		await findAllByText('Orange Hostel');

		await userEvent.press(getAllByText('Push files')[0]);
		// The confirm prompt names the router.
		await findByText('Queue this action?');
		// `Prompt` upper-cases its button labels.
		await userEvent.press(getAllByText('QUEUE IT')[0]);

		await waitFor(() =>
			expect(mockRun).toHaveBeenCalledWith(
				{ action: 'push-portal', scope: 'one', router_id: 'r-1' },
				'token'
			)
		);
	});

	test('a non-admin sees the notice and no tools', async () => {
		mockUser = { id: 2, platform: { is_admin: false } };

		const { getAllByText, queryAllByText } = render(<RouterToolsScreen />);

		await waitFor(() =>
			expect(
				getAllByText('Only platform admins can use the router tools.').length
			).toBeGreaterThan(0)
		);
		expect(mockFetchFleet).not.toHaveBeenCalled();
		expect(queryAllByText('Push portal files').length).toBe(0);
	});
});
