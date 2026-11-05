/// <reference types="jest" />
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import ApprovalBanners from '@/components/ApprovalBanners';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
	useRouter: () => ({ push: mockPush }),
}));
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

describe('ApprovalBanners', () => {
	beforeEach(() => {
		mockPush.mockClear();
	});

	it('tells an approver what needs their response', () => {
		const { getByText } = render(
			<ApprovalBanners
				language='en'
				counts={{ pendingApprovalCount: 2, myPendingCount: 0 }}
			/>
		);

		expect(getByText('Pending Approvals')).toBeTruthy();
		expect(
			getByText('2 need your response - tap to review →')
		).toBeTruthy();
	});

	it('tells an initiator their request is waiting for a response', () => {
		const { getByText } = render(
			<ApprovalBanners
				language='en'
				counts={{ pendingApprovalCount: 0, myPendingCount: 1 }}
			/>
		);

		expect(getByText('Pending Approvals')).toBeTruthy();
		expect(
			getByText('1 waiting for a response - tap to review →')
		).toBeTruthy();
	});

	it('shows both sides of the same banner when both exist', () => {
		const { getByText } = render(
			<ApprovalBanners
				language='en'
				counts={{
					profitPendingApprovalCount: 1,
					myProfitPendingCount: 2,
				}}
			/>
		);

		expect(getByText('Profit Withdrawals')).toBeTruthy();
		expect(
			getByText(
				'1 need your response · 2 waiting for a response - tap to review →'
			)
		).toBeTruthy();
	});

	it('opens the screen that can act on the banner', () => {
		const { getByText } = render(
			<ApprovalBanners
				language='en'
				counts={{ pendingApprovalCount: 1 }}
			/>
		);

		fireEvent.press(getByText('Pending Approvals'));

		expect(mockPush).toHaveBeenCalledWith(
			'/(authenticated)/withdraw-approvals'
		);
	});
});
