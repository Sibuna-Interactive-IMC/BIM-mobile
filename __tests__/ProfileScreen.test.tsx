/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import ProfileScreen from '@/views/ProfileScreen';

// `userEvent` ships in this version's runtime but is missing from its typings.
const { userEvent } = jest.requireActual<{
	userEvent: {
		press: (element: unknown) => Promise<void>;
		type: (element: unknown, text: string) => Promise<void>;
	};
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
jest.mock('react-native-svg', () => ({ SvgUri: () => null }));
jest.mock('@react-navigation/bottom-tabs', () => ({
	useBottomTabBarHeight: () => 0,
}));
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
	useRouter: () => ({
		push: mockRouterPush,
		replace: jest.fn(),
		back: jest.fn(),
	}),
	usePathname: () => '/',
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);

const mockSetUser = jest.fn();
const mockHandleLogout = jest.fn(() => Promise.resolve());
const mockUser = {
	id: 7,
	name: 'Grace Nakato',
	email: 'grace@example.com',
	phone: '256772494949',
	gender: 'female',
	avatar_id: 'female-deep',
	avatar_url: 'https://api.example/img/avatars/presets/female-deep.svg',
	documents_verified: true,
};
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({
		language: 'en',
		authToken: 'token',
		user: mockUser,
		setUser: mockSetUser,
		handleLogout: mockHandleLogout,
	}),
}));

const mockFetchProfile = jest.fn();
const mockFetchAvatars = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUpdatePassword = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/services/ProfileService', () => ({
	fetchProfile: (...args: any[]) => mockFetchProfile(...args),
	fetchAvatarOptions: (...args: any[]) => mockFetchAvatars(...args),
	updateProfile: (...args: any[]) => mockUpdateProfile(...args),
	updatePassword: (...args: any[]) => mockUpdatePassword(...args),
	deleteAccount: (...args: any[]) => mockDelete(...args),
}));

const presets = [
	{
		id: 'default',
		gender: 'neutral',
		tone: 'light',
		beard: false,
		label: 'Neutral · Light skin tone',
		file: 'default.svg',
		url: 'https://api.example/img/avatars/presets/default.svg',
	},
	{
		id: 'female-deep',
		gender: 'female',
		tone: 'deep',
		beard: false,
		label: 'Female · Deep skin tone',
		file: 'female-deep.svg',
		url: 'https://api.example/img/avatars/presets/female-deep.svg',
	},
];

describe('ProfileScreen', () => {
	beforeEach(() => {
		mockSetUser.mockClear();
		mockHandleLogout.mockClear();
		mockFetchProfile.mockReset();
		mockFetchAvatars.mockReset();
		mockUpdateProfile.mockReset();
		mockUpdatePassword.mockReset();
		mockDelete.mockReset();

		mockFetchProfile.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true, user: mockUser }),
		});
		mockFetchAvatars.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				groups: [
					{ gender: 'neutral', label: 'Neutral', presets: [presets[0]] },
					{ gender: 'female', label: 'Female', presets: [presets[1]] },
				],
				gender_options: [
					{ value: '', label: 'Prefer not to say' },
					{ value: 'female', label: 'Female' },
					{ value: 'male', label: 'Male' },
					{ value: 'other', label: 'Other' },
				],
			}),
		});
	});

	test('shows the details form, the password/delete sections and the KYC status', async () => {
		const { getAllByText, getByDisplayValue, queryByText } = render(
			<ProfileScreen />
		);

		await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

		// The name is an editable field now, not a summary line.
		expect(await getByDisplayValue('Grace Nakato')).toBeTruthy();
		expect(queryByText('Profile details')).not.toBeNull();
		expect(queryByText('Change password')).not.toBeNull();
		expect(getAllByText('Delete account').length).toBeGreaterThan(0);
		// The phone is editable, and only appears once (no duplicate summary row).
		expect(getAllByText('Phone number').length).toBe(1);
		expect(getAllByText('Notification email').length).toBeGreaterThan(0);
		expect(queryByText('Documents verified')).not.toBeNull();
	});

	test('the removed summary leaves no duplicate of the form values', async () => {
		const { queryAllByText } = render(<ProfileScreen />);
		await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

		// These used to appear twice: once in the summary card, once in the form.
		expect(queryAllByText('grace@example.com').length).toBe(0);
		expect(queryAllByText('256772494949').length).toBe(0);
	});

	test('Manage documents opens the documents screen', async () => {
		const { getAllByText } = render(<ProfileScreen />);
		await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

		await userEvent.press(getAllByText('Manage documents')[0]);

		expect(mockRouterPush).toHaveBeenCalledWith('/(authenticated)/documents');
	});

	test('saving sends only the fields that changed', async () => {
		mockUpdateProfile.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Profile updated.',
				user: { ...mockUser, name: 'Grace N. Nakato' },
			}),
		});

		const { getAllByText, getByDisplayValue } = render(<ProfileScreen />);
		await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

		const name = await getByDisplayValue('Grace Nakato');
		await userEvent.type(name, ' N.');

		await userEvent.press(getAllByText('Save changes')[0]);

		await waitFor(() =>
			expect(mockUpdateProfile).toHaveBeenCalledWith(
				{ name: 'Grace Nakato N.', email: 'grace@example.com' },
				'token'
			)
		);
		// The saved user is pushed into the session so the header follows.
		expect(mockSetUser).toHaveBeenCalled();
	});

	test(
		'a mismatched new password never reaches the API',
		async () => {
			const { getAllByText, getAllByPlaceholderText } = render(<ProfileScreen />);
			await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

			// Four password fields share the mask placeholder: current, new, confirm, delete.
			const pw = getAllByPlaceholderText('••••••••');
			await userEvent.type(pw[0], 'old-password');
			await userEvent.type(pw[1], 'new-password');
			await userEvent.type(pw[2], 'different');

			await userEvent.press(getAllByText('Update password')[0]);

			await waitFor(() => expect(mockUpdatePassword).not.toHaveBeenCalled());
		},
		// `userEvent.type` is per-character and this form has three masked fields.
		15000
	);

	test(
		'a matched password pair is submitted with its confirmation',
		async () => {
			mockUpdatePassword.mockResolvedValue({
				ok: true,
				json: async () => ({ message: 'Password updated.' }),
			});

			const { getAllByText, getAllByPlaceholderText } = render(<ProfileScreen />);
			await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

			const pw = getAllByPlaceholderText('••••••••');
			await userEvent.type(pw[0], 'old-password');
			await userEvent.type(pw[1], 'new-password');
			await userEvent.type(pw[2], 'new-password');

			await userEvent.press(getAllByText('Update password')[0]);

			await waitFor(() =>
				expect(mockUpdatePassword).toHaveBeenCalledWith(
					{
						current_password: 'old-password',
						password: 'new-password',
						password_confirmation: 'new-password',
					},
					'token'
				)
			);
		},
		15000
	);

	test('deleting confirms first, then logs out', async () => {
		mockDelete.mockResolvedValue({
			ok: true,
			json: async () => ({ message: 'Account deleted.' }),
		});

		const { getAllByText, getAllByPlaceholderText, findByText } = render(
			<ProfileScreen />
		);
		await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());

		// The delete section's own password field is the last one on the page.
		const fields = getAllByPlaceholderText('••••••••');
		await userEvent.type(fields[3], 'secret');

		await userEvent.press(getAllByText('Delete account')[1]);
		await findByText('Delete your account?');
		// `Prompt` upper-cases its button labels.
		await userEvent.press(getAllByText('DELETE')[0]);

		await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('secret', 'token'));
		await waitFor(() => expect(mockHandleLogout).toHaveBeenCalled());
	});
});
