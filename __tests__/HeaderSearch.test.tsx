/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React, { act } from 'react';

import Header from '@/components/Header';
import type { User } from '@/types';

// `fireEvent` ships in this version's runtime but its event typings are missing.
const { fireEvent } = jest.requireActual<{
	fireEvent: {
		(element: unknown, event: string): void;
		changeText: (element: unknown, text: string) => void;
		press: (element: unknown) => void;
	};
}>('@testing-library/react-native');

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/drawer', () => ({
	useDrawerStatus: () => 'closed',
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@expo/vector-icons', () => ({
	MaterialIcons: () => null,
	MaterialCommunityIcons: () => null,
	Ionicons: () => null,
}));
jest.mock('react-native-svg', () => ({ SvgUri: () => null }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
	useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
	useNavigation: () => ({ toggleDrawer: jest.fn(), goBack: jest.fn() }),
}));

const admin = {
	id: 1,
	name: 'Admin',
	platform: { is_admin: true, is_staff: true },
} as unknown as User;
const owner = {
	id: 2,
	name: 'Owner',
	platform: { is_admin: false, is_staff: false },
} as unknown as User;

function renderHeader(user: User) {
	return render(
		<Header
			user={user}
			handleLogout={jest.fn()}
			language='en'
			setLanguage={jest.fn()}
			notifications={[]}
			setNotifications={jest.fn()}
			selectedOption='search'
			setSelectedOption={jest.fn()}
			online={true}
		/>
	);
}

describe('header feature search', () => {
	beforeEach(() => {
		mockPush.mockClear();
	});

	it('suggests features matching the query', async () => {
		const { getByPlaceholderText, getByTestId } = renderHeader(owner);

		fireEvent.changeText(getByPlaceholderText('Search features…'), 'voucher');

		await waitFor(() =>
			expect(getByTestId('header-search-result-vouchers')).toBeTruthy()
		);
	});

	it('opens the feature that was picked', async () => {
		const { getByPlaceholderText, getByTestId } = renderHeader(owner);

		fireEvent.changeText(getByPlaceholderText('Search features…'), 'voucher');
		await waitFor(() =>
			expect(getByTestId('header-search-result-vouchers')).toBeTruthy()
		);

		fireEvent.press(getByTestId('header-search-result-vouchers'));

		expect(mockPush).toHaveBeenCalledWith('/(authenticated)/vouchers');
	});

	it('opens the top suggestion on submit', async () => {
		const { getByPlaceholderText, getByTestId } = renderHeader(owner);

		const input = getByPlaceholderText('Search features…');
		fireEvent.changeText(input, 'banks');
		await waitFor(() =>
			expect(getByTestId('header-search-result-banks')).toBeTruthy()
		);

		fireEvent(input, 'submitEditing');

		expect(mockPush).toHaveBeenCalledWith('/(authenticated)/banks');
	});

	it('only lists features the current user may open', async () => {
		const { getByPlaceholderText, getByTestId, queryByTestId } =
			renderHeader(owner);

		fireEvent.changeText(getByPlaceholderText('Search features…'), 'profit');

		await waitFor(() =>
			expect(getByTestId('header-search-results-list')).toBeTruthy()
		);
		expect(queryByTestId('header-search-result-profit')).toBeNull();
	});

	it('lists admin features for admins', async () => {
		const { getByPlaceholderText, getByTestId } = renderHeader(admin);

		fireEvent.changeText(getByPlaceholderText('Search features…'), 'profit');

		await waitFor(() =>
			expect(getByTestId('header-search-result-profit')).toBeTruthy()
		);
	});
});

describe('header notification bell', () => {
	beforeEach(() => {
		mockPush.mockClear();
	});

	it('shows the unread badge and marks a row read when it is opened', async () => {
		const markNotificationRead = jest.fn(async () => undefined);
		const fetchNotifications = jest.fn(async () => undefined);

		const { getByText } = render(
			<Header
				user={admin}
				handleLogout={jest.fn()}
				language='en'
				setLanguage={jest.fn()}
				notifications={[
					{
						id: 'inbox-1',
						from: '',
						to: '',
						type: 'alert',
						title: 'Approval needed',
						message: 'A withdrawal is waiting for you',
						isRead: false,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				]}
				setNotifications={jest.fn()}
				unreadNotificationCount={1}
				fetchNotifications={fetchNotifications}
				markNotificationRead={markNotificationRead}
				selectedOption='notifications'
				setSelectedOption={jest.fn()}
				online={true}
			/>
		);

		await waitFor(() => expect(getByText('1')).toBeTruthy());
		await waitFor(() => expect(getByText('Approval needed')).toBeTruthy());

		fireEvent.press(getByText('Approval needed'));

		expect(markNotificationRead).toHaveBeenCalledWith('inbox-1');
		expect(mockPush).toHaveBeenCalledWith('/(authenticated)/notifications');

		// Let the dropdown's open animation and visibility timers finish before
		// the Jest environment tears down (React Native schedules those with
		// timers that outlive a synchronous test).
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 350));
		});
	});
});
