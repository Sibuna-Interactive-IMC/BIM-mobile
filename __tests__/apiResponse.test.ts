import {
	getApiData,
	getApiErrors,
	getApiMessage,
	getApiPagination,
	getOperationCacheKey,
	getOperationState,
	getPageInfo,
	isApiSuccess,
} from '@/helpers/apiResponse';
import {
	mapApiBankToBank,
	mapApiDocumentToDocumentProps,
	mapApiTransactionToMicroTransaction,
	mapRecentTransactionToMicroTransaction,
	mapSharedRadiusProfileToInternetPackage,
} from '@/helpers/mappers';

describe('apiResponse helpers', () => {
	const dashboardEnvelope = {
		success: true,
		message: 'Dashboard data',
		data: {
			todayTransactions: 5,
			chartData: [{ date: '2026-10-28', total: 1000 }],
		},
		meta: {
			pagination: {
				current_page: 2,
				last_page: 4,
				per_page: 10,
				total: 32,
				first_item: 11,
				last_item: 20,
			},
		},
		operation: { state: 'done', cache_key: 'cache-123' },
		errors: null,
	};

	test('reads the data payload of the API 2.0 envelope', () => {
		expect(getApiData<{ todayTransactions?: number }>(dashboardEnvelope)).toEqual(
			dashboardEnvelope.data
		);
		expect(isApiSuccess(dashboardEnvelope)).toBe(true);
		expect(getApiMessage(dashboardEnvelope)).toBe('Dashboard data');
		expect(getApiErrors(dashboardEnvelope)).toBeNull();
		expect(getOperationState(dashboardEnvelope)).toBe('done');
		expect(getOperationCacheKey(dashboardEnvelope)).toBe('cache-123');
	});

	test('falls back to flat legacy payloads', () => {
		const legacy = {
			success: true,
			message: 'ok',
			routers: [{ id: 'r1' }],
		};
		expect(getApiData<{ routers?: { id: string }[] }>(legacy)?.routers).toEqual([
			{ id: 'r1' },
		]);
	});

	test('returns null when a successful envelope has no data', () => {
		expect(getApiData({ success: true, message: 'ok', data: null })).toBeNull();
		expect(getApiData(null)).toBeNull();
	});

	test('exposes pagination and concrete page info', () => {
		expect(getApiPagination(dashboardEnvelope)?.current_page).toBe(2);
		expect(getPageInfo(dashboardEnvelope)).toMatchObject({
			current_page: 2,
			last_page: 4,
			total: 32,
		});
		expect(getPageInfo({ success: true })).toBeUndefined();
	});

	test('reads pagination keyed by collection name under meta.pagination', () => {
		// Shape returned by e.g. GET /routers/{id}/hotspots/active
		const body = {
			success: true,
			data: { active: [] },
			meta: {
				pagination: {
					active: {
						total: 18,
						per_page: 10,
						current_page: 1,
						last_page: 2,
						first_item: 1,
						last_item: 10,
					},
				},
			},
			operation: null,
			errors: null,
		};
		expect(getApiPagination(body, 'active')?.total).toBe(18);
		expect(getPageInfo(body, 'active')).toEqual({
			current_page: 1,
			last_page: 2,
			total: 18,
			per_page: 10,
		});
		// Without a key the first block that carries paging numbers is used.
		expect(getPageInfo(body)?.total).toBe(18);
		// Unknown collection names fall back instead of returning nothing.
		expect(getPageInfo(body, 'cookies')?.total).toBe(18);
	});

	test('picks the requested collection when several are paginated', () => {
		const body = {
			success: true,
			meta: {
				pagination: {
					users: { current_page: 2, last_page: 5, per_page: 10, total: 45 },
					cookies: { current_page: 3, last_page: 9, per_page: 25, total: 210 },
				},
			},
		};
		expect(getPageInfo(body, 'cookies')).toMatchObject({
			current_page: 3,
			last_page: 9,
			total: 210,
		});
		expect(getPageInfo(body, 'users')).toMatchObject({
			current_page: 2,
			last_page: 5,
			total: 45,
		});
	});

	test('ignores empty pagination group objects', () => {
		const body = {
			success: true,
			meta: { pagination: { active: {} } },
		};
		expect(getPageInfo(body, 'active')).toBeUndefined();
	});

	test('reads queued operation cache keys from data', () => {
		const queued = {
			success: true,
			data: { status: 'queued', cache_key: 'queued-key', retry_after: 2 },
			operation: { state: 'queued' },
		};
		expect(getOperationCacheKey(queued)).toBe('queued-key');
		expect(getOperationState(queued)).toBe('queued');
	});

	test('returns bare array payloads unchanged', () => {
		expect(getApiData<{ id: string }[]>([{ id: 'a' }])).toEqual([{ id: 'a' }]);
	});

	test('reads legacy per-collection pagination meta', () => {
		const legacyRouterPayload = {
			success: true,
			data: {
				cookies: [],
				users: [],
				users_meta: {
					current_page: 1,
					last_page: 2,
					per_page: 10,
					total: 12,
				},
				cookies_meta: {
					current_page: 3,
					last_page: 6,
					per_page: 10,
					total: 55,
					first_Item: 21,
					last_Item: 30,
				},
			},
		};
		// The requested collection wins over other `*_meta` siblings.
		expect(getPageInfo(legacyRouterPayload, 'cookies')).toMatchObject({
			current_page: 3,
			last_page: 6,
			total: 55,
		});
		expect(getPageInfo(legacyRouterPayload, 'users')).toMatchObject({
			current_page: 1,
			last_page: 2,
			total: 12,
		});
		expect(getPageInfo(legacyRouterPayload)).toMatchObject({
			current_page: 1,
			last_page: 2,
			total: 12,
		});
	});

	test('reads the API 2.0 `<key>_metadata` block at the top level', () => {
		// What ApiResponse::paginated() actually returns for GET /transactions:
		// rows and `<key>_metadata` sit next to success/message, with no `data`.
		const payload = {
			success: true,
			message: 'Transactions retrieved successfully',
			transactions: [{ id: 'tx-1' }, { id: 'tx-2' }],
			transactions_metadata: {
				current_page: 2,
				per_page: 20,
				total: 42,
				last_page: 3,
				first_item: 21,
				last_item: 40,
			},
			charge_map: {},
			total_amount: 1500,
		};

		expect(getApiData<any>(payload)?.transactions).toHaveLength(2);
		expect(getPageInfo(payload, 'transactions')).toMatchObject({
			current_page: 2,
			last_page: 3,
			total: 42,
		});
	});
});

describe('api mappers', () => {
	test('maps a bank record', () => {
		expect(
			mapApiBankToBank({
				id: 12,
				user_id: 3,
				bank_name: 'Stanbic',
				account_number: '0001112223',
				phone: '256700000000',
				swift_code: 'SBICUGKX',
				bank_branch: 'Kampala',
			})
		).toMatchObject({
			id: '12',
			name: 'Stanbic',
			accountNumber: '0001112223',
			SWIFTCode: 'SBICUGKX',
			branch: 'Kampala',
		});
	});

	test('maps a document record', () => {
		expect(
			mapApiDocumentToDocumentProps({
				id: 7,
				user_id: 1,
				type: 'passport',
				number: 'P-123',
				attachment: 'https://example.com/passport.jpg',
				status: 'approved',
			})
		).toMatchObject({
			id: '7',
			documentId: 'P-123',
			name: 'Passport',
			type: 'passport',
			status: 'approved',
			url: 'https://example.com/passport.jpg',
		});
	});

	test('maps a transaction record to the purchase model', () => {
		const mapped = mapApiTransactionToMicroTransaction({
			id: 'tx-1',
			router_id: 'r-1',
			type: 'credit',
			amount: '1500.00',
			reason: 'wifi',
			status: 'successful',
			created_at: '2026-10-28T10:00:00Z',
			router_name: 'Main',
			gateway: 'YO',
		});
		expect(mapped).toMatchObject({
			id: 'tx-1',
			amount: 1500,
			status: 'successful',
			routerName: 'Main',
			reason: 'wifi',
			type: 'credit',
			gateway: 'YO',
		});
		expect(mapped.router).toMatchObject({ id: 'r-1', name: 'Main' });
		expect(mapped.date.toISOString()).toBe('2026-10-28T10:00:00.000Z');
	});

	test('maps a dashboard recent transaction', () => {
		const mapped = mapRecentTransactionToMicroTransaction({
			id: 'rt-1',
			amount: 900,
			type: 'debit',
			reason: 'subscription',
			status: 'pending',
			router: { id: 4, name: 'Kampala' },
			created_at: '2026-10-27T08:30:00Z',
			gateway: 'Relworx',
		});
		expect(mapped).toMatchObject({
			id: 'rt-1',
			reason: 'subscription',
			status: 'pending',
			routerName: 'Kampala',
			gateway: 'Relworx',
		});
		expect(mapped.router).toMatchObject({ id: '4', name: 'Kampala' });
	});

	test('maps a shared radius profile to a hotspot package', () => {
		expect(
			mapSharedRadiusProfileToInternetPackage({
				group: 'DAILY1000',
				name: 'DAILY1000',
				display_name: 'Daily 1GB',
				shared: true,
				price: 1000,
				duration: '24h',
				duration_seconds: 86400,
				rate_limit: '4M/3M',
				devices: 2,
			})
		).toMatchObject({
			'.id': 'DAILY1000',
			name: 'DAILY1000',
			display_name: 'Daily 1GB',
			'rate-limit': '4M/3M',
			'simultaneous-use': 2,
			'session-timeout': '24',
			price: 1000,
		});
	});
});
