/* eslint-disable @typescript-eslint/no-require-imports */
/// <reference types="jest" />

jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

const mockApiFetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: async () => ({}) })
);
jest.mock('@/helpers/api', () => ({ apiFetch: mockApiFetch }));

const SiteService = require('@/services/SiteService');
const AnalyticsService = require('@/services/AnalyticsService');
const AdminUserService = require('@/services/AdminUserService');

function lastCall() {
	return (mockApiFetch.mock.calls[0] as any[]) || [];
}

describe('account area services', () => {
	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('fetchSites pages the site list', async () => {
		await SiteService.fetchSites('token', { page: 2, perPage: 20 });
		const call = lastCall();
		expect(call[0]).toBe('https://api.example/sites?page=2&per_page=20');
		expect(call[1].method).toBe('GET');
		expect(call[1].headers.Authorization).toContain('Bearer');
	});

	test('fetchSite targets the router scoped endpoint', async () => {
		await SiteService.fetchSite('router-1', 'token', { month: '2026-10' });
		const call = lastCall();
		expect(call[0]).toBe('https://api.example/sites/router-1?month=2026-10');
		expect(call[1].method).toBe('GET');
	});

	test('analytics accounts stay on the admin analytics prefix', async () => {
		await AnalyticsService.fetchAnalyticsAccounts('token', { perPage: 1 });
		await AnalyticsService.fetchAnalyticsAccount(2, 'token');
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/analytics/accounts?per_page=1',
			'https://api.example/analytics/accounts/2',
		]);
	});

	test('account detail sub-resources hang off the account', async () => {
		await AnalyticsService.fetchAnalyticsAccountActivity(2, 'token');
		await AnalyticsService.fetchAnalyticsAccountWithdrawals(2, 'token', 2);
		await AnalyticsService.fetchAnalyticsAccountVouchers(2, 'token');
		await AnalyticsService.fetchAnalyticsAccountPayouts(2, 'token');
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/analytics/accounts/2/activity',
			'https://api.example/analytics/accounts/2/withdrawals?page=2',
			'https://api.example/analytics/accounts/2/vouchers',
			'https://api.example/analytics/accounts/2/payouts',
		]);
	});

	test('admin users trims the search term and omits blank ones', async () => {
		await AdminUserService.fetchAdminUsers('token', {
			q: '  steven ',
			page: 1,
			perPage: 20,
		});
		await AdminUserService.fetchAdminUsers('token', { q: '   ' });
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls[0][0]).toBe(
			'https://api.example/admin/users?q=steven&page=1&per_page=20'
		);
		expect(calls[1][0]).toBe('https://api.example/admin/users');
	});

	test('business lists carry their period, owner and paging', async () => {
		await AnalyticsService.fetchBusinessList('charges', 'token', {
			owner: 8,
			period: 'month',
			page: 2,
			perPage: 20,
		});
		await AnalyticsService.fetchBusinessList('credits', 'token', { period: 'today' });
		await AnalyticsService.fetchBusinessRouters('token', { perPage: 5 });
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/analytics/business/charges?owner=8&period=month&page=2&per_page=20',
			'https://api.example/analytics/business/credits?period=today',
			'https://api.example/analytics/business/routers?per_page=5',
		]);
	});

	test('admin user forms load from the create and edit endpoints', async () => {
		await AdminUserService.fetchAdminUserForm('token');
		await AdminUserService.fetchAdminUserForm('token', 58);
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/admin/users/create',
			'https://api.example/admin/users/58/edit',
		]);
	});

	test('creating a login sends the platform role and the account seat', async () => {
		await AdminUserService.createAdminUser(
			{
				name: '  Jane Okello ',
				phone: '0789244866',
				email: ' jane@example.co ',
				password: 'Sup3rSecret',
				roleId: 1,
				accountId: 2,
				accountRole: 'owner',
				newAccountName: null,
			},
			'token'
		);
		const call = lastCall();
		expect(call[0]).toBe('https://api.example/admin/users');
		expect(call[1].method).toBe('POST');
		expect(JSON.parse(call[1].body)).toEqual({
			name: 'Jane Okello',
			phone: '0789244866',
			email: 'jane@example.co',
			role_id: 1,
			account_id: 2,
			account_role: 'owner',
			new_account_name: null,
			password: 'Sup3rSecret',
		});
	});

	test('editing a login omits an unchanged password and supports a new account', async () => {
		await AdminUserService.updateAdminUser(
			58,
			{
				name: 'BAK KAU NAK',
				phone: '256774370659',
				email: 'bakkau231@gmail.com',
				roleId: null,
				accountId: '__new__',
				accountRole: 'finance',
				newAccountName: 'Kampala Branch',
			},
			'token'
		);
		const call = lastCall();
		expect(call[0]).toBe('https://api.example/admin/users/58');
		expect(call[1].method).toBe('PUT');
		const body = JSON.parse(call[1].body);
		expect(body).toEqual({
			name: 'BAK KAU NAK',
			phone: '256774370659',
			email: 'bakkau231@gmail.com',
			role_id: null,
			account_id: '__new__',
			account_role: 'finance',
			new_account_name: 'Kampala Branch',
		});
		expect('password' in body).toBe(false);
	});

	test('deleting a login targets the user endpoint', async () => {
		await AdminUserService.deleteAdminUser(58, 'token');
		const call = lastCall();
		expect(call[0]).toBe('https://api.example/admin/users/58');
		expect(call[1].method).toBe('DELETE');
	});
});

describe('accounts area services', () => {
	const AccountsService = require('@/services/AccountsService');

	beforeEach(() => {
		mockApiFetch.mockClear();
	});

	test('the hub reads one summary endpoint', async () => {
		await AccountsService.fetchAccountsSummary('token');
		const call = lastCall();
		expect(call[0]).toBe('https://api.example/accounts/summary');
		expect(call[1].method).toBe('GET');
	});

	test('withdrawal approvals expose approve, reject and retract', async () => {
		await AccountsService.fetchWithdrawalApprovals('token');
		await AccountsService.approveWithdrawal(7, 'token');
		await AccountsService.rejectWithdrawal(7, 'not ours', 'token');
		await AccountsService.retractWithdrawal('tx-1', 'token');
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/withdrawals/approvals',
			'https://api.example/withdrawals/approvals/7/approve',
			'https://api.example/withdrawals/approvals/7/reject',
			'https://api.example/withdrawals/tx-1/retract',
		]);
		expect(calls.map((call) => call[1].method)).toEqual([
			'GET',
			'POST',
			'POST',
			'POST',
		]);
		expect(JSON.parse(calls[2][1].body)).toEqual({ comment: 'not ours' });
	});

	test('disbursement records serialise their filters', async () => {
		await AccountsService.fetchDisbursementRecords('token', {
			router: 'router-1',
			hasNarration: 'yes',
			page: 3,
			perPage: 20,
		});
		const call = lastCall();
		expect(call[0]).toBe(
			'https://api.example/disbursement-records?router=router-1&has_narration=yes&page=3&per_page=20'
		);
	});

	test('business and profit analytics target the analytics prefix', async () => {
		await AccountsService.fetchBusinessSummary('token');
		await AccountsService.fetchProfit('token', 2);
		await AccountsService.approveProfitWithdrawal(4, 'token');
		await AccountsService.rejectProfitWithdrawal(4, undefined, 'token');
		await AccountsService.retractProfitWithdrawal('w-1', 'token');
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/analytics/business/summary',
			'https://api.example/analytics/profit?history_page=2',
			'https://api.example/analytics/profit/approvals/4/approve',
			'https://api.example/analytics/profit/approvals/4/reject',
			'https://api.example/analytics/profit/withdrawals/w-1/retract',
		]);
		expect(JSON.parse(calls[3][1].body)).toEqual({ comment: null });
	});

	test('profit withdrawal runs the OTP handshake in two posts', async () => {
		await AccountsService.requestProfitOtp(
			{ amount: 5000, provider: 'yo', recipientMsisdn: '0789244866' },
			'token'
		);
		await AccountsService.requestProfitWithdrawal(
			{
				amount: 5000,
				provider: 'yo',
				recipientMsisdn: '0789244866',
				otp: '123456',
				reference: 'OTP-REF-1',
			},
			'token'
		);
		const calls = mockApiFetch.mock.calls as any[];
		expect(calls.map((call) => call[0])).toEqual([
			'https://api.example/analytics/profit/withdrawals',
			'https://api.example/analytics/profit/withdrawals',
		]);
		expect(JSON.parse(calls[0][1].body)).toEqual({
			amount: 5000,
			provider: 'yo',
			recipient_msisdn: '0789244866',
			request_otp: true,
		});
		expect(JSON.parse(calls[1][1].body)).toEqual({
			amount: 5000,
			provider: 'yo',
			recipient_msisdn: '0789244866',
			otp: '123456',
			reference: 'OTP-REF-1',
		});
	});
});
