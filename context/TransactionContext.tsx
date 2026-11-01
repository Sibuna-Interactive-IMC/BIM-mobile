import { ShowAlert } from '@/helpers';
import { getApiData } from '@/helpers/apiResponse';
import {
	mapApiBankToBank,
	mapApiDocumentToDocumentProps,
	mapApiTransactionToMicroTransaction,
	mapRecentTransactionToMicroTransaction,
	mapSharedRadiusProfileToInternetPackage,
} from '@/helpers/mappers';
import { fetchBanks as serviceFetchBanks } from '@/services/BankService';
import { fetchSharedProfiles as serviceFetchProfiles } from '@/services/PackageService';
import { fetchRouters as serviceFetchRouters } from '@/services/RouterService';
import type { TransactionFilters } from '@/services/UserService';
import * as UserService from '@/services/UserService';
import {
	ApiRouter,
	Bank,
	DocumentProps,
	GetBanksResponse,
	GetDocumentsResponse,
	GetRoutersResponse,
	GetSharedRadiusProfilesResponse,
	GetTransactionsResponse,
	InternetPackage,
	MicroTransaction,
	Transaction,
	VoucherUser
} from '@/types';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useGeneral } from './GeneralContext';

export interface TransactionContextType {
	transactions: Transaction[];
	setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
	purchases: MicroTransaction[];
	setPurchases: React.Dispatch<React.SetStateAction<MicroTransaction[]>>;
	loading: boolean;
	setLoading: React.Dispatch<React.SetStateAction<boolean>>;
	voucherUsers: VoucherUser[];
	setVoucherUsers: React.Dispatch<React.SetStateAction<VoucherUser[]>>;
	packages: InternetPackage[];
	setPackages: React.Dispatch<React.SetStateAction<InternetPackage[]>>;
	routers: ApiRouter[] | null;
	setRouters: React.Dispatch<React.SetStateAction<ApiRouter[] | null>>;
	routersResponse: GetRoutersResponse | null;
	setRoutersResponse: React.Dispatch<React.SetStateAction<GetRoutersResponse | null>>;
	banks: Bank[];
	setBanks: React.Dispatch<React.SetStateAction<Bank[]>>;
	documents: DocumentProps[];
	setDocuments: React.Dispatch<React.SetStateAction<DocumentProps[]>>;
	fetchDocuments: () => Promise<void>;
	fetchBanks: () => Promise<void>;
	fetchRouters: () => Promise<GetRoutersResponse | null>;
	fetchPackages: () => Promise<void>;
	fetchPurchases: (filters?: TransactionFilters) => Promise<void>;

	// Server-computed total across all transactions (from /transactions total_amount)
	totalAmount: number;

	// Optional dashboard data provided by the server on successful login
	serverDashboard?: any | null;
	setServerDashboard?: React.Dispatch<React.SetStateAction<any | null>>;

	// Server-provided dashboard metrics exposed for the UI (populated when server dashboard present)
	dailyPurchasesTotal?: number;
	weeklyPurchasesTotal?: number;
	monthlyPurchasesTotal?: number;
	lastSevenDaysPurchases?: { date: Date; day: string; amount: number }[];
	lastFiveTransactions?: MicroTransaction[];
	purchasesPerRouter?: { name: string; location: string; amount: number }[];
	// Voucher metrics
	dailyVoucherUsersTotal?: number;
	weeklyVoucherUsersTotal?: number;
	monthlyVoucherUsersTotal?: number;
	lastSevenVoucherUsers?: VoucherUser[];
}

const TransactionContext = createContext<TransactionContextType | undefined>(
	undefined
);

export const TransactionProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const { user, authToken, handleLogout } = useGeneral();
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [purchases, setPurchases] = useState<MicroTransaction[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [voucherUsers, setVoucherUsers] = useState<VoucherUser[]>([]);
	const [packages, setPackages] = useState<InternetPackage[]>([]);
	const [routersResponse, setRoutersResponse] = useState<GetRoutersResponse | null>(null);
	const [routers, setRouters] = useState<ApiRouter[] | null>(null);
	const [banks, setBanks] = useState<Bank[]>([]);
	const [documents, setDocuments] = useState<DocumentProps[]>([]);
	const [packagesLastFetched, setPackagesLastFetched] = useState<string | null>(null);

	// Dashboard payload returned by server after login (optional)
	const [serverDashboard, setServerDashboard] = useState<any | null>(null);

	// UI-friendly metrics derived from server dashboard (if provided)
	const [dailyPurchasesTotal, setDailyPurchasesTotal] = useState<number>(0);
	const [weeklyPurchasesTotal, setWeeklyPurchasesTotal] = useState<number>(0);
	const [monthlyPurchasesTotal, setMonthlyPurchasesTotal] = useState<number>(0);
	const [lastSevenDaysPurchases, setLastSevenDaysPurchases] = useState<
		{
			date: Date;
			day: string;
			amount: number;
		}[]
	>([]);
	const [lastFiveTransactions, setLastFiveTransactions] = useState<
		MicroTransaction[]
	>([]);
	const [purchasesPerRouter, setPurchasesPerRouter] = useState<
		{
			name: string;
			location: string;
			amount: number;
		}[]
	>([]);

	// Voucher metrics
	const [dailyVoucherUsersTotal, setDailyVoucherUsersTotal] =
		useState<number>(0);
	const [weeklyVoucherUsersTotal, setWeeklyVoucherUsersTotal] =
		useState<number>(0);
	const [monthlyVoucherUsersTotal, setMonthlyVoucherUsersTotal] =
		useState<number>(0);
	const [lastSevenVoucherUsers, setLastSevenVoucherUsers] = useState<
		VoucherUser[]
	>([]);

	// Server-computed total from /transactions response (total_amount)
	const [totalAmount, setTotalAmount] = useState<number>(0);

	const fetchDocuments = useCallback(
		async () => {
			try {
				const res = await UserService.fetchDocuments(authToken ?? undefined);
				if (res && res.ok) {
					const body: GetDocumentsResponse = await res.json();
					// API 2.0: `{ data: { documents: [...] } }`
					const documents = getApiData<NonNullable<GetDocumentsResponse['data']>>(body)?.documents;
					if (Array.isArray(documents)) {
						setDocuments(documents.map(mapApiDocumentToDocumentProps));
						return;
					}
				}
			} catch (e) {
				console.error('fetchDocuments: failed to fetch from API', e);
			}
			setDocuments([]);
		},
		[authToken]
	);

	const fetchBanks = useCallback(
		async () => {
			try {
				const res = await serviceFetchBanks(authToken ?? undefined);
				if (res && res.ok) {
					const body: GetBanksResponse = await res.json();
					// API 2.0: `{ data: { banks: [...] } }`
					const banks = getApiData<NonNullable<GetBanksResponse['data']>>(body)?.banks;
					if (Array.isArray(banks)) {
						setBanks(banks.map(mapApiBankToBank));
						return;
					}
				}
			} catch (e) {
				console.error('fetchBanks: failed to fetch from API', e);
			}
			setBanks([]);
		},
		[authToken]
	);

	const fetchRouters = useCallback(
		async (): Promise<GetRoutersResponse | null> => {

			try {
				const res = await serviceFetchRouters(authToken ?? undefined);
				if (res && res.ok) {
					const body: GetRoutersResponse = await res.json();
					// API 2.0: `{ data: { routers: [...] } }`
					const routers = getApiData<NonNullable<GetRoutersResponse['data']>>(body)?.routers;
					if (Array.isArray(routers)) {
						setRoutersResponse(body);
						setRouters(routers);
						return body;
					}
				}
			} catch (e) {
				console.error('fetchRouters: failed to fetch from API', e);
			}
			setRoutersResponse(null);
			return null;
		},
		[authToken]
	);

	const fetchPackages = useCallback(
		async () => {
			if ((packages && packages.length > 0) && packagesLastFetched && (Date.now() - new Date(packagesLastFetched).getTime() < 60000)) return;
			try {
				console.log('[TransactionContext] fetching radius profiles from API');
				// API 2.0 exposes RADIUS plans through GET /profiles (not /packages).
				const res = await serviceFetchProfiles(authToken ?? undefined, { per_page: 100 });
				if (res && res.ok) {
					const body: GetSharedRadiusProfilesResponse = await res.json();
					const profiles = getApiData<NonNullable<GetSharedRadiusProfilesResponse['data']>>(body)?.profiles;
					if (Array.isArray(profiles)) {
						setPackages(profiles.map(mapSharedRadiusProfileToInternetPackage));
						setPackagesLastFetched(new Date().toISOString());
						return;
					}
				}
			} catch (e) {
				console.error('fetchPackages: failed to fetch from API', e);
			}
		},
		[authToken, packagesLastFetched, packages, setPackagesLastFetched]
	);

	const fetchPurchases = useCallback(
		async (filters?: TransactionFilters) => {
			try {
				if (!authToken) {
					return handleLogout();
				}
				const res = await UserService.fetchPurchases(authToken, filters);
				if (res && res.ok) {
					const body: GetTransactionsResponse = await res.json();
					// API 2.0 puts this page's rows straight at `transactions`;
					// older deployments nested a Laravel paginator under it.
					const data = getApiData<NonNullable<GetTransactionsResponse['data']>>(body);
					const rows = data?.transactions;
					const txData = Array.isArray(rows) ? rows : rows?.data;
					if (Array.isArray(txData))
						setPurchases(txData.map(mapApiTransactionToMicroTransaction));
					// Capture server-computed total_amount (respects active filters)
					const total = parseFloat(String(data?.total_amount ?? ''));
					if (Number.isFinite(total)) setTotalAmount(total);
					return;
				}
			} catch (e) {
				console.error('fetchPurchases: failed to fetch from API', e);
			}
			setPurchases([]);
			setVoucherUsers([]);
		},
		[authToken, handleLogout]
	);

	// Prevent re-running the data-loading effect on every token rotation.
	// Once data is loaded for the current user session, subsequent runs
	// (caused by user being re-set from attemptRefresh) are skipped.
	const dataLoadedRef = useRef(false);

	// Dashboard data arrives asynchronously: refreshDashboard in GeneralContext
	// fetches /dashboard and stores it in user.dashboard AFTER the initial login.
	// Process it in a separate effect that re-runs whenever user changes.
	useEffect(() => {
		if (!user) return;
		const sd = user?.dashboard || null;
		if (
			sd &&
			(sd.recentTransactions ||
				sd.todayTransactions !== undefined ||
				sd.routerBalances ||
				sd.chartData)
		) {
			setServerDashboard(sd);
			try {
				setDailyPurchasesTotal(Number(sd.todayTransactions) || 0);
				setWeeklyPurchasesTotal(Number(sd.weekTransactions) || 0);
				setMonthlyPurchasesTotal(Number(sd.monthTransactions) || 0);
				if (Array.isArray(sd.chartData)) {
					setLastSevenDaysPurchases(
						sd.chartData.map((c: any) => ({
							date: new Date(c.date),
							day: new Date(c.date).toLocaleDateString('en-US', {
								weekday: 'long',
							}),
							amount: Number(c.total) || 0,
						}))
					);
				}
				if (Array.isArray(sd.recentTransactions)) {
					setLastFiveTransactions(
						sd.recentTransactions
							.slice(0, 5)
							.map(mapRecentTransactionToMicroTransaction)
					);
				}
				if (Array.isArray(sd.routerBalances)) {
					setPurchasesPerRouter(
						sd.routerBalances.map((rb: any) => ({
							name: rb.name,
							location: rb.location ?? '',
							amount: Number(rb.balance) || 0,
						}))
					);
				}
				setDailyVoucherUsersTotal(Number(sd.todayUsers) || 0);
				setWeeklyVoucherUsersTotal(Number(sd.weekUsers) || 0);
				setMonthlyVoucherUsersTotal(Number(sd.monthUsers) || 0);
			} catch (e) {
				console.error(
					'TransactionContext: failed to map server dashboard metrics',
					e
				);
			}
		}
	}, [user]);

	// Load API data (routers, packages, purchases, banks, documents) once per session.
	useEffect(() => {
		if (!user) {
			dataLoadedRef.current = false;
			return;
		}
		if (dataLoadedRef.current) return;
		dataLoadedRef.current = true;

		(async () => {
			setLoading(true);
			try {
				// Ensure routers are fetched first so purchases can reference them.
				await fetchRouters();
				const fetchOperations = [
					{ name: 'Packages', fn: fetchPackages() },
					{ name: 'Micro Transactions', fn: fetchPurchases() },
					{ name: 'Banks', fn: fetchBanks() },
					{ name: 'Documents', fn: fetchDocuments() },
				];

				const results = await Promise.allSettled(
					fetchOperations.map((op) => op.fn)
				);

				results.forEach((result, index) => {
					const operationName = fetchOperations[index].name;
					if (result.status === 'rejected') {
						console.error(`Failed to fetch ${operationName}:`, result.reason);
					}
				});

				const failures = results.filter(
					(result) => result.status === 'rejected'
				);

				if (failures.length > 0) {
					ShowAlert(
						`Failed to load ${failures.length} out of ${results.length} data sources`,
						'Error'
					);
				}
			} catch (error) {
				console.error('Unexpected error during data fetching:', error);
				ShowAlert('Unexpected error occurred while loading data', 'Error');
			} finally {
				setLoading(false);
			}
		})();
	}, [
		user,
		fetchRouters,
		fetchPackages,
		fetchPurchases,
		fetchBanks,
		fetchDocuments,
	]);
	return (
		<TransactionContext.Provider
			value={{
				transactions,
				setTransactions,
				purchases,
				setPurchases,
				voucherUsers,
				setVoucherUsers,
				packages,
				loading,
				setLoading,
				setPackages,
				routers,
				setRouters,
				routersResponse,
				setRoutersResponse,
				banks,
				setBanks,
				documents,
				setDocuments,
				fetchBanks,
				fetchDocuments,
				fetchRouters,
				fetchPackages,
				fetchPurchases,
				totalAmount,
				serverDashboard,
				setServerDashboard,
				// Dashboard-derived UI metrics
				dailyPurchasesTotal,
				weeklyPurchasesTotal,
				monthlyPurchasesTotal,
				lastSevenDaysPurchases,
				lastFiveTransactions,
				purchasesPerRouter,
				// Voucher metrics
				dailyVoucherUsersTotal,
				weeklyVoucherUsersTotal,
				monthlyVoucherUsersTotal,
				lastSevenVoucherUsers,
			}}
		>
			{children}
		</TransactionContext.Provider>
	);
};

export const useTransaction = () => {
	const context = useContext(TransactionContext);
	if (!context) {
		throw new Error('useTransaction must be used within a TransactionProvider');
	}
	return context;
};
