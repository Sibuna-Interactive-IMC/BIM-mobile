import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import { ThemedButton } from '@/components/ThemedButton';
import ThemedDatePicker from '@/components/ThemedDatePicker';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TileContainer from '@/components/TileContainer';
import useAccountsBack from '@/hooks/useAccountsBack';
import { apiBaseUrl } from '@/constants/API';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { formatAmount } from '@/helpers';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import type { TransactionFilters } from '@/services/UserService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, View } from 'react-native';

export default function TransactionsScreen() {
	useTrackHistory('/(authenticated)/transactions');
	useAccountsBack();
	// Theme helpers
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const bimLight = useThemeColor({}, 'bim', 'light');
	const bimDark = useThemeColor({}, 'bim', 'dark');
	const textLight = useThemeColor({}, 'text', 'light');
	const textDark = useThemeColor({}, 'text', 'dark');
	const whiteLight = useThemeColor({}, 'white', 'light');
	const whiteDark = useThemeColor({}, 'white', 'dark');
	const lime = useThemeColor({}, 'lime');
	const dangerButton = useThemeColor({}, 'dangerButton');
	const mutedTextLight = useThemeColor({}, 'mutedText', 'light');
	const mutedTextDark = useThemeColor({}, 'mutedText', 'dark');
	const { purchases, fetchPurchases, totalAmount } = useTransaction();
	const { user, language, authToken } = useGeneral();

	const [refreshing, setRefreshing] = useState(false);
	const [filterLoading, setFilterLoading] = useState(false);

	// Keep a ref of the active filters so the auto-fetch interval can reuse them
	const activeFiltersRef = useRef<TransactionFilters | undefined>(undefined);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchPurchases(activeFiltersRef.current);
		} catch (e) {
			console.error('[TransactionsScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchPurchases]);
	const t = translations[language].categories.transactions;
	const isAdmin = isPlatformAdmin(user);
	console.log({ router: purchases && purchases[0]?.router });

	// Filters state
	const [startDate, setStartDate] = useState<Date | null>(null);
	const [endDate, setEndDate] = useState<Date | null>(null);
	const [status, setStatus] = useState<string>(t.all);
	const [type, setType] = useState<string>(t.all);

	// Dropdown local
	const [showStatusDd, setShowStatusDd] = useState(false);
	const [showTypeDd, setShowTypeDd] = useState(false);
	const statusOptions = useMemo(() => [t.all, t.pending, t.successful, t.failed], [t]);
	const typeOptions = useMemo(() => [t.all, t.debit, t.credit], [t]);

	// Refs for dropdown containers (avoid any-casts)
	const statusDdRef = useRef<View>(null);
	const typeDdRef = useRef<View>(null);

	// When language changes, reset default selections to "All"
	useEffect(() => {
		setStatus(t.all);
		setType(t.all);
	}, [t.all]);

	// Pagination
	const [page, setPage] = useState(1);
	const pageSize = 10;

	// Auto-fetch purchases on an interval when the list is empty.
	// Rate-limited to at most 2 calls per minute (every 30s).
	// Manual refresh (pull-to-refresh) bypasses this limit.
	// Respects any active filters so filtered views stay up-to-date.
	const autoFetchIntervalMs = 30_000;
	const lastAutoFetchRef = useRef(0);

	useEffect(() => {
		if (!user) return;

		const intervalId = setInterval(() => {
			const now = Date.now();
			if (now - lastAutoFetchRef.current < autoFetchIntervalMs) return;

			lastAutoFetchRef.current = now;
			fetchPurchases(activeFiltersRef.current).catch(() => {});
		}, autoFetchIntervalMs);

		// Run once immediately on mount (or when user becomes available)
		if (purchases.length === 0) {
			lastAutoFetchRef.current = Date.now();
			fetchPurchases(activeFiltersRef.current).catch(() => {});
		}

		return () => clearInterval(intervalId);
		// fetchPurchases & purchases are intentionally excluded to avoid
		// re-triggering the interval on every state change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user]);

	// Pagination — server handles filtering, so paginate purchases directly
	const totalPages = Math.max(1, Math.ceil(purchases.length / pageSize));
	const paged = useMemo(() => {
		const start = (page - 1) * pageSize;
		return purchases.slice(start, start + pageSize);
	}, [purchases, page]);

	// Button handlers
	const handleApplyFilters = useCallback(async () => {
		// Build filter payload – only include non-"All" values so the server
		// returns everything when no specific filter is selected.
		const filters: TransactionFilters = {};

		if (startDate) {
			// Format as YYYY-MM-DD
			const y = startDate.getFullYear();
			const m = String(startDate.getMonth() + 1).padStart(2, '0');
			const d = String(startDate.getDate()).padStart(2, '0');
			filters.start_date = `${y}-${m}-${d}`;
		}
		if (endDate) {
			const y = endDate.getFullYear();
			const m = String(endDate.getMonth() + 1).padStart(2, '0');
			const d = String(endDate.getDate()).padStart(2, '0');
			filters.end_date = `${y}-${m}-${d}`;
		}
		if (status && status.toLowerCase() !== t.all.toLowerCase()) {
			filters.status = status.toLowerCase();
		}
		if (type && type.toLowerCase() !== t.all.toLowerCase()) {
			filters.type = type.toLowerCase();
		}

		// Persist for auto-fetch
		activeFiltersRef.current = Object.keys(filters).length > 0 ? filters : undefined;

		setFilterLoading(true);
		setPage(1);
		try {
			await fetchPurchases(filters);
		} catch (e) {
			console.error('[TransactionsScreen] applyFilters failed', e);
		} finally {
			setFilterLoading(false);
		}
	}, [startDate, endDate, status, type, t.all, fetchPurchases]);

	const handleExportExcel = useCallback(async () => {
		try {
			const params = new URLSearchParams();
			if (startDate) {
				const y = startDate.getFullYear();
				const m = String(startDate.getMonth() + 1).padStart(2, '0');
				const d = String(startDate.getDate()).padStart(2, '0');
				params.append('start_date', `${y}-${m}-${d}`);
			}
			if (endDate) {
				const y = endDate.getFullYear();
				const m = String(endDate.getMonth() + 1).padStart(2, '0');
				const d = String(endDate.getDate()).padStart(2, '0');
				params.append('end_date', `${y}-${m}-${d}`);
			}
			if (type && type.toLowerCase() !== t.all.toLowerCase()) {
				params.append('type', type.toLowerCase());
			}
			if (status && status.toLowerCase() !== t.all.toLowerCase()) {
				params.append('status', status.toLowerCase());
			}
			const qs = params.toString();
			const url = `${apiBaseUrl || ''}/transactions/export/excel${qs ? '?' + qs : ''}`;

			// Use a direct fetch with auth header to download the file
			const headers: Record<string, string> = {};
			if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
			const res = await fetch(url, { headers });
			if (!res.ok) {
				console.error('[TransactionsScreen] export Excel failed', res.status);
				return;
			}
			const blob = await res.blob();
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === 'string') {
					Linking.openURL(reader.result);
				}
			};
			reader.onerror = () => {
				console.error('[TransactionsScreen] FileReader error');
			};
			reader.readAsDataURL(blob);
		} catch (e) {
			console.error('[TransactionsScreen] export Excel failed', e);
		}
	}, [startDate, endDate, type, status, t.all, authToken]);

	const handleExportPdf = useCallback(async () => {
		try {
			const params = new URLSearchParams();
			if (startDate) {
				const y = startDate.getFullYear();
				const m = String(startDate.getMonth() + 1).padStart(2, '0');
				const d = String(startDate.getDate()).padStart(2, '0');
				params.append('start_date', `${y}-${m}-${d}`);
			}
			if (endDate) {
				const y = endDate.getFullYear();
				const m = String(endDate.getMonth() + 1).padStart(2, '0');
				const d = String(endDate.getDate()).padStart(2, '0');
				params.append('end_date', `${y}-${m}-${d}`);
			}
			if (type && type.toLowerCase() !== t.all.toLowerCase()) {
				params.append('type', type.toLowerCase());
			}
			if (status && status.toLowerCase() !== t.all.toLowerCase()) {
				params.append('status', status.toLowerCase());
			}
			const qs = params.toString();
			const url = `${apiBaseUrl || ''}/transactions/export/pdf${qs ? '?' + qs : ''}`;

			// Use a direct fetch with auth header to download the file
			const headers: Record<string, string> = {};
			if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
			const res = await fetch(url, { headers });
			if (!res.ok) {
				console.error('[TransactionsScreen] export PDF failed', res.status);
				return;
			}
			const blob = await res.blob();
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === 'string') {
					Linking.openURL(reader.result);
				}
			};
			reader.onerror = () => {
				console.error('[TransactionsScreen] FileReader error');
			};
			reader.readAsDataURL(blob);
		} catch (e) {
			console.error('[TransactionsScreen] export PDF failed', e);
		}
	}, [startDate, endDate, type, status, t.all, authToken]);

	const handlePrevPage = () => {
		setPage((p) => Math.max(1, p - 1));
	};

	const handleNextPage = () => {
		setPage((p) => Math.min(totalPages, p + 1));
	};

    return (
        <ParallaxScrollView
			headerBackgroundColor={{
				light: backgroundLight,
				dark: backgroundDark,
			}}
			refreshing={refreshing}
			onRefresh={handleRefresh}
			contentStyle={{ paddingHorizontal: 10 }}
			containerStyle={{ flex: 1 }}
		>
			{/* Title */}
			<ThemedText
				lightColor={bimLight}
				darkColor={bimDark}
				style={{
					width: '100%',
					textTransform: 'capitalize',
					fontSize: fontSize['heading.one'],
					fontWeight: fontWeight['heading.one'],
					marginBottom: 12,
				}}
			>
				{t.title}
			</ThemedText>

			{/* Filters Row */}
			<TileContainer
				id='transactions-filters'
				backgroundColor={background}
				style={{
					flexDirection: 'column',
					gap: 12,
					padding: 12,
					marginBottom: 12,
					// Ensure any nested dropdown overlays subsequent sections
					...(showStatusDd || showTypeDd
						? { zIndex: 2000, elevation: 20 }
						: {}),
				}}
			>
				<ThemedView
					style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}
					lightColor={backgroundLight}
					darkColor={backgroundDark}
				>
					{/* Start Date */}
					<ThemedView
						style={{ flexBasis: '48%', flexGrow: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedDatePicker
							label={t.startDate}
							placeholder={t.startDate}
							value={startDate}
							onChange={(d) => setStartDate(d)}
							mode='date'
							inputStyle={{ backgroundColor: background }}
						/>
					</ThemedView>
					{/* End Date */}
					<ThemedView
						style={{ flexBasis: '48%', flexGrow: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedDatePicker
							label={t.endDate}
							placeholder={t.endDate}
							value={endDate}
							onChange={(d) => setEndDate(d)}
							mode='date'
							inputStyle={{ backgroundColor: background }}
						/>
					</ThemedView>

					{/* Status */}
					<ThemedView
						style={{ flexBasis: '48%', flexGrow: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedDropdown
							id='status-dd'
							containerRef={statusDdRef}
							label={t.status}
							placeholder={t.status}
							options={statusOptions}
							value={status}
							setValue={(v) => setStatus(v)}
							showDropdown={showStatusDd}
							setShowDropdown={setShowStatusDd}
							openDirection='down'
						/>
					</ThemedView>

					{/* Transaction Type */}
					<ThemedView
						style={{ flexBasis: '48%', flexGrow: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedDropdown
							id='type-dd'
							containerRef={typeDdRef}
							label={t.transactionType}
							placeholder={t.transactionType}
							options={typeOptions}
							value={type}
							setValue={(v) => setType(v)}
							showDropdown={showTypeDd}
							setShowDropdown={setShowTypeDd}
							openDirection='down'
						/>
					</ThemedView>
				</ThemedView>

				{/* Actions row */}
				<ThemedView
					style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}
					lightColor={backgroundLight}
					darkColor={backgroundDark}
				>
					<ThemedButton
						title={t.applyFilters}
						onPress={handleApplyFilters}
						loading={filterLoading}
						style={{ backgroundColor: bim }}
						lightTextColor={whiteLight}
						darkTextColor={whiteDark}
					/>
					<ThemedView
						style={{ flex: 1 }}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					/>
				</ThemedView>

				{/* Total balance */}
				<ThemedView
					style={{
						marginTop: 8,
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
					}}
					lightColor={backgroundLight}
					darkColor={backgroundDark}
				>
					<ThemedText
						lightColor={textLight}
						darkColor={textDark}
						style={{
							fontWeight: fontWeight['heading.two'],
							fontSize: fontSize['heading.two'],
						}}
					>
						{t.totalBalance}:
					</ThemedText>
					<ThemedView
						style={{
							backgroundColor: lime,
							borderRadius: 6,
							paddingHorizontal: 8,
							paddingVertical: 4,
						}}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedText
							lightColor={whiteLight}
							darkColor={whiteDark}
							style={{
								fontWeight: fontWeight['heading.two'],
								fontSize: fontSize['heading.two'],
							}}
						>
							{formatAmount(totalAmount, 2)}
						</ThemedText>
					</ThemedView>
				</ThemedView>
			</TileContainer>

			{/* Export buttons section (no TileContainer) */}
			<ThemedView
				style={{
					flexDirection: 'row',
					gap: 12,
					marginBottom: 12,
					flexWrap: 'wrap',
				}}
				lightColor={backgroundLight}
				darkColor={backgroundDark}
			>
				<ThemedButton
					title={t.exportExcel}
					onPress={handleExportExcel}
					style={{ backgroundColor: lime }}
					lightTextColor={whiteLight}
					darkTextColor={whiteDark}
				/>
				<ThemedButton
					title={t.exportPdf}
					onPress={handleExportPdf}
					style={{ backgroundColor: dangerButton }}
					lightTextColor={whiteLight}
					darkTextColor={whiteDark}
				/>
			</ThemedView>
			<TileContainer
				id='transactions-list-tile'
				flat
				backgroundColor={background}
				style={{ flexDirection: 'column' }}
			>
				<RecordList
					id='transactions-list'
					isEmpty={paged.length === 0}
					emptyMessage={t.noTransactions}
				>
					{paged.map((trans, index) => {
						const status = String(trans.status).toLowerCase();
						return (
							<RecordCard
								key={`${trans.id}-${index}`}
								id={`transaction-${trans.id}-${index}`}
								fields={[
									{
										label: t.colStatus,
										value: trans.status,
										tone:
											status === 'successful' || status === 'approved'
												? 'success'
												: status === 'pending'
													? 'warning'
													: status === 'failed'
														? 'danger'
														: 'info',
									},
									{
										label: t.colRouterName,
										value: trans.router?.name || trans.routerName || '—',
									},
									{
										label: t.colAmount,
										value: formatAmount(trans.amount, 2),
										tone: 'default',
									},
									{ label: t.colType, value: trans.type },
									{
										label: t.colTransactionDate,
										value: new Date(trans.created_at).toLocaleDateString(),
									},
									...(isAdmin && trans.gateway
										? [{ label: t.gateway, value: trans.gateway }]
										: []),
								]}
							/>
						);
					})}
				</RecordList>
			</TileContainer>

			<ThemedView
				style={{
					flexDirection: 'row',
					gap: 12,
					marginTop: 8,
					alignItems: 'center',
				}}
				lightColor={backgroundLight}
				darkColor={backgroundDark}
			>
				<ThemedButton
					title={translations[language].categories.buttons.previous}
					onPress={handlePrevPage}
					disabled={page <= 1}
					darkColor={backgroundDark}
					lightColor={backgroundLight}
					lightTextColor={page <= 1 ? mutedTextLight : undefined}
					darkTextColor={page <= 1 ? mutedTextDark : undefined}
					textStyle={{ fontSize: 14 }}
				/>
				<ThemedText lightColor={textLight} darkColor={textDark}>
					{page} / {totalPages}
				</ThemedText>
				<ThemedButton
					title={translations[language].categories.buttons.next}
					onPress={handleNextPage}
					disabled={page >= totalPages}
					darkColor={backgroundDark}
					lightColor={backgroundLight}
					lightTextColor={page >= totalPages ? mutedTextLight : undefined}
					darkTextColor={page >= totalPages ? mutedTextDark : undefined}
					textStyle={{ fontSize: 14 }}
				/>
			</ThemedView>
		</ParallaxScrollView>
	);
}

// styles removed; layout handled by ParallaxScrollView props
