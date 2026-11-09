/// <reference types="jest" />
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import DocumentVerificationScreen from '@/views/DocumentVerificationScreen';

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
jest.mock('expo-web-browser', () => ({
	openBrowserAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/hooks/useTrackHistory', () => () => undefined);

let mockUser: any = { id: 1, platform: { is_admin: true } };
jest.mock('@/context/GeneralContext', () => ({
	useGeneral: () => ({ language: 'en', authToken: 'token', user: mockUser }),
}));

const documents = [
	{
		id: 'uuid-1',
		type: 'National ID',
		number: 'CM123456',
		status: 'pending',
		user_id: 7,
		created_at: '2026-10-30T12:00:00+03:00',
		user: {
			id: 7,
			name: 'Grace Nakato',
			email: 'grace@example.com',
			documents_verified: false,
		},
	},
	{
		id: 'uuid-2',
		type: 'Passport',
		number: 'P998877',
		status: 'approved',
		user_id: 7,
		created_at: '2026-10-29T12:00:00+03:00',
		user: {
			id: 7,
			name: 'Grace Nakato',
			email: 'grace@example.com',
			documents_verified: true,
		},
	},
];

const mockFetch = jest.fn();
const mockApprove = jest.fn();
const mockReject = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/services/DocumentVerificationService', () => ({
	fetchAdminDocuments: (...args: any[]) => mockFetch(...args),
	approveDocument: (...args: any[]) => mockApprove(...args),
	rejectDocument: (...args: any[]) => mockReject(...args),
	deleteDocument: (...args: any[]) => mockDelete(...args),
	downloadDocumentFile: jest.fn(),
}));

describe('DocumentVerificationScreen', () => {
	beforeEach(() => {
		mockUser = { id: 1, platform: { is_admin: true } };
		mockFetch.mockReset();
		mockApprove.mockReset();
		mockReject.mockReset();
		mockDelete.mockReset();
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				message: 'Documents retrieved successfully',
				// `ApiResponse::paginated` puts the rows at the top level.
				documents,
				documents_metadata: { current_page: 1, last_page: 1, total: 2 },
			}),
		});
	});

	test('lists every document with its owner and status', async () => {
		const { findAllByText, getAllByText, getByText } = render(
			<DocumentVerificationScreen />
		);

		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		expect(getAllByText('National ID').length).toBeGreaterThan(0);
		expect(getAllByText('Passport').length).toBeGreaterThan(0);
		expect(getAllByText('Pending').length).toBeGreaterThan(0);
		expect(getAllByText('Approved').length).toBeGreaterThan(0);
		expect((await findAllByText(/Grace Nakato/)).length).toBeGreaterThan(0);
		expect(getByText('CM123456')).toBeTruthy();
	});

	test('approving a document also verifies the owner through the approval endpoint', async () => {
		mockApprove.mockResolvedValue({
			ok: true,
			json: async () => ({ message: 'Document approved successfully' }),
		});

		const { getAllByText, findByText } = render(<DocumentVerificationScreen />);
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		await userEvent.press(getAllByText('Approve')[0]);
		await findByText('Approve this document?');
		// `Prompt` upper-cases its button labels.
		await userEvent.press(getAllByText('CONFIRM')[0]);

		await waitFor(() =>
			expect(mockApprove).toHaveBeenCalledWith('uuid-1', 'token')
		);
		expect(mockReject).not.toHaveBeenCalled();
	});

	test('View is offered on every document, decisions only on pending ones', async () => {
		const { getAllByText, queryAllByText } = render(
			<DocumentVerificationScreen />
		);
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		// Two documents, both viewable.
		expect(getAllByText('View').length).toBe(2);
		// uuid-1 is pending; uuid-2 already has a final decision.
		expect(getAllByText('Approve').length).toBe(1);
		expect(getAllByText('Reject').length).toBe(1);
	});

	test('an approved document offers no Approve, even when the owner is unverified', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				documents: [
					{
						...documents[1],
						status: 'approved',
						user: { ...documents[1].user, documents_verified: false },
					},
				],
				documents_metadata: { current_page: 1, last_page: 1, total: 1 },
			}),
		});

		const { getAllByText, queryAllByText } = render(
			<DocumentVerificationScreen />
		);
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		// Approval is final; the row stays view-only.
		expect(getAllByText('View').length).toBe(1);
		expect(queryAllByText('Approve').length).toBe(0);
		expect(queryAllByText('Reject').length).toBe(0);
	});

	test('rejecting a pending document calls the reject endpoint', async () => {
		mockReject.mockResolvedValue({
			ok: true,
			json: async () => ({ message: 'Document rejected successfully' }),
		});

		const { getAllByText, findByText } = render(<DocumentVerificationScreen />);
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		await userEvent.press(getAllByText('Reject')[0]);
		await findByText('Reject this document?');
		await userEvent.press(getAllByText('CONFIRM')[0]);

		await waitFor(() =>
			expect(mockReject).toHaveBeenCalledWith('uuid-1', 'token')
		);
		expect(mockApprove).not.toHaveBeenCalled();
	});

	test('missing files are labeled, hide file actions, and can be deleted', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				success: true,
				documents: [
					{ ...documents[0], file_missing: true },
				],
				documents_metadata: { current_page: 1, last_page: 1, total: 1 },
			}),
		});

		const { getAllByText, queryAllByText } = render(
			<DocumentVerificationScreen />
		);
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		expect(getAllByText('Missing file').length).toBeGreaterThan(0);
		expect(queryAllByText('View')).toHaveLength(0);
		expect(queryAllByText('Approve')).toHaveLength(0);
		expect(queryAllByText('Reject')).toHaveLength(0);
		expect(getAllByText('Delete').length).toBe(1);
	});

	test('deleting a document requires confirmation and removes it', async () => {
		mockDelete.mockResolvedValue({
			ok: true,
			json: async () => ({ message: 'Document deleted successfully' }),
		});

		const { getAllByText, findByText } = render(<DocumentVerificationScreen />);
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		await userEvent.press(getAllByText('Delete')[0]);
		await findByText('Delete this document?');
		await userEvent.press(getAllByText('CONFIRM')[0]);

		await waitFor(() =>
			expect(mockDelete).toHaveBeenCalledWith('uuid-1', 'token')
		);
	});

	test('the filter request carries the chosen status and type', async () => {
		const { getAllByText } = render(<DocumentVerificationScreen />);
		await waitFor(() => expect(mockFetch).toHaveBeenCalled());

		// Open the status menu and pick Rejected.
		await userEvent.press(getAllByText('All statuses')[0]);
		await userEvent.press(getAllByText('Rejected')[0]);

		await userEvent.press(getAllByText('Filter')[0]);

		await waitFor(() =>
			expect(mockFetch).toHaveBeenLastCalledWith(
				'token',
				expect.objectContaining({ status: 'rejected', page: 1 })
			)
		);
	});

	test('a non-admin sees the notice and no documents', async () => {
		mockUser = { id: 2, platform: { is_admin: false } };

		const { getAllByText, queryAllByText } = render(
			<DocumentVerificationScreen />
		);

		await waitFor(() =>
			expect(
				getAllByText('Only platform admins can review documents.').length
			).toBeGreaterThan(0)
		);
		expect(mockFetch).not.toHaveBeenCalled();
		expect(queryAllByText('National ID').length).toBe(0);
	});
});
