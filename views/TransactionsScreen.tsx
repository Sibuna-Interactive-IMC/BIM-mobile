import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordBadge, RecordField } from '@/components/RecordList';
import { ThemedButton } from '@/components/ThemedButton';
import ThemedDatePicker from '@/components/ThemedDatePicker';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedText } from '@/components/ThemedText';
import ScreenHeader from '@/components/ScreenHeader';import TileContainer from '@/components/TileContainer';
import { apiBaseUrl } from '@/constants/API';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import {
	formatAmount,
	formatDateTime,
	ShowAlert,
	toApiDate,
} from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { transactionStatusTone } from '@/helpers/transactionStatus';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchPurchases } from '@/services/UserService';
import type { TransactionFilters } from '@/services/UserService';
import type { ApiTransaction, GetTransactionsResponse } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Linking,
	StyleSheet,
	View,
} from 'react-native';

const PAGE_SIZE = 20;

/** `GET /transactions` — the paged, filterable credit/debit ledger. */
export default function TransactionsScreen() {
	useTrackHistory('/(authenticated)/transactions');
	useAccountsBack();
	const { user, language, authToken } = useGeneral();
	const t = translations[language].categories.transactions;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const lime = useThemeColor({}, 'lime');
	const dangerButton = useThemeColor({}, 'dangerButton');

	const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
	const [totalAmount, setTotalAmount] = useState(0);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// Draft filters are edited in the form; "Apply" copies them into the set the
	// request uses, so typing/picking alone never fires a request.
	const [startDate, setStartDate] = useState<Date | null>(null);
	const [endDate, setEndDate] = useState<Date | null>(null);
	const [statusLabel, setStatusLabel] = useState('');
	const [typeLabel, setTypeLabel] = useState('');
	const [applied, setApplied] = useState<TransactionFilters>({});
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);

	const statusRef = useRef<View>(null);
	const typeRef = useRef<View>(null);

	const statusOptions = useMemo(
		() => [t.all, t.pending, t.successful, t.failed],
		[t.all, t.failed, t.pending, t.successful]
	);
	const typeOptions = useMemo(
		() => [t.all, t.credit, t.debit],
		[t.all, t.credit, t.debit]
	);

	const load = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchPurchases(authToken, {
				...applied,
				page,
				per_page: PAGE_SIZE,
			});
			if (!res.ok) {
				setTransactions([]);
				return;
			}
			const body: GetTransactionsResponse = await res.json();
			const data = getApiData<NonNullable<GetTransactionsResponse['data']>>(body);
			// The API returns this page's rows at `transactions`; older payloads
			// nested a Laravel paginator there instead.
			const rows = data?.transactions;
			setTransactions(Array.isArray(rows) ? rows : (rows?.data ?? []));
			setLastPage(
				Math.max(
					1,
					getApiPagination(body, 'transactions')?.last_page ??
						data?.transactions_metadata?.last_page ??
						1
				)
			);
			const total = Number.parseFloat(String(data?.total_amount ?? ''));
			setTotalAmount(Number.isFinite(total) ? total : 0);
		} catch (e) {
			console.error('[TransactionsScreen] load failed', e);
			setTransactions([]);
		} finally {
			setLoading(false);
		}
	}, [applied, authToken, page]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	const hasFilters =
		!!applied.start_date ||
		!!applied.end_date ||
		!!applied.status ||
		!!applied.type;

	const filtersForRequest = useCallback((): TransactionFilters | null => {
		const start = toApiDate(startDate);
		const end = toApiDate(endDate);
		// The API only applies the date filter when both ends are present.
		if ((start && !end) || (!start && end)) {
			ShowAlert(t.dateRangeRequired, 'Error');
			return null;
		}

		const filters: TransactionFilters = {};
		if (start && end) {
			filters.start_date = start;
			filters.end_date = end;
		}
		if (statusLabel && statusLabel !== t.all) {
			filters.status = statusLabel.toLowerCase();
		}
		if (typeLabel && typeLabel !== t.all) {
			filters.type = typeLabel.toLowerCase();
		}
		return filters;
	}, [endDate, startDate, statusLabel, t.all, t.dateRangeRequired, typeLabel]);

	const applyFilters = useCallback(() => {
		const filters = filtersForRequest();
		if (!filters) return;
		setApplied(filters);
		setPage(1);
	}, [filtersForRequest]);

	const clearFilters = useCallback(() => {
		setStartDate(null);
		setEndDate(null);
		setStatusLabel('');
		setTypeLabel('');
		setApplied({});
		setPage(1);
	}, []);

	const exportLedger = useCallback(
		async (format: 'excel' | 'pdf') => {
			try {
				const params = new URLSearchParams();
				Object.entries(applied).forEach(([key, value]) => {
					if (value === undefined || value === null || value === '') return;
					params.append(key, String(value));
				});
				const qs = params.toString();
				const url = `${apiBaseUrl || ''}/transactions/export/${format}${qs ? `?${qs}` : ''}`;

				const headers: Record<string, string> = {};
				if (authToken) headers.Authorization = `Bearer ${authToken}`;
				const res = await fetch(url, { headers });
				if (!res.ok) {
					console.error('[TransactionsScreen] export failed', res.status);
					return;
				}
				const blob = await res.blob();
				const reader = new FileReader();
				reader.onload = () => {
					if (typeof reader.result === 'string') {
						void Linking.openURL(reader.result);
					}
				};
				reader.onerror = () => {
					console.error('[TransactionsScreen] FileReader error');
				};
				reader.readAsDataURL(blob);
			} catch (e) {
				console.error('[TransactionsScreen] export failed', e);
			}
		},
		[applied, authToken]
	);

	// Like every other record list, each card leads with what the row *is*:
	// the reason the money moved, falling back to the credit/debit direction.
	const titleFor = (transaction: ApiTransaction) => {
		if (transaction.reason) return transaction.reason;
		if (transaction.type === 'debit') return t.debit;
		if (transaction.type === 'credit') return t.credit;
		return t.title;
	};

	const badgeFor = (transaction: ApiTransaction): RecordBadge | undefined => {
		const status = String(transaction.status ?? '');
		if (!status) return undefined;
		return {
			label: status.replace(/_/g, ' '),
			tone: transactionStatusTone(status),
		};
	};

	const fieldsFor = (transaction: ApiTransaction): RecordField[] => {
		const statusMessage = (
			transaction.metadata as Record<string, unknown> | null | undefined
		)?.status_message;

		return [
			{
				label: t.colAmount,
				value: formatAmount(Math.abs(Number(transaction.amount ?? 0)), 2),
				tone: 'warning',
			},
			// The reason is the card title; only show the direction as a field when
			// the title is not already the direction.
			...(transaction.reason
				? [{ label: t.colType, value: transaction.type || '—' }]
				: []),
			{
				label: t.colRouterName,
				value: transaction.router?.name || transaction.router_name || '—',
			},
			{ label: t.colTransactionDate, value: formatDateTime(transaction.created_at) },
			{
				label: t.colMessage,
				value: typeof statusMessage === 'string' && statusMessage ? statusMessage : '—',
				fullWidth: true,
			},
			...(isAdmin && transaction.gateway
				? [{ label: t.gateway, value: transaction.gateway }]
				: []),
		];
	};

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='transactions-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='transactions-header'
					title={t.title}
					description={t.description}
					loading={loading}
				>
					<View style={styles.actions}>
						<ThemedButton
							title={t.exportExcel}
							icon='documents'
							onPress={() => {
								void exportLedger('excel');
							}}
							numberOfLines={1}
							style={styles.actionButton}
							lightColor={lime}
							darkColor={lime}
							lightTextColor={white}
							darkTextColor={white}
							iconColor={white}
							textStyle={styles.actionText}
						/>
						<ThemedButton
							title={t.exportPdf}
							icon='printer'
							onPress={() => {
								void exportLedger('pdf');
							}}
							numberOfLines={1}
							style={styles.actionButton}
							lightColor={dangerButton}
							darkColor={dangerButton}
							lightTextColor={white}
							darkTextColor={white}
							iconColor={white}
							textStyle={styles.actionText}
						/>
					</View>
				</ScreenHeader>
			</TileContainer>

			<TileContainer
				id='transactions-content-tile'
				flat
				backgroundColor={background}
				style={{ width: '100%', gap: 12 }}
			>
			<TileContainer
				id='transactions-filters-tile'
				borderless
				backgroundColor={background}
				// The filter menus are absolutely positioned, so the tile that owns
				// the open menu has to paint above the transaction list below it.
				style={[styles.section, openDropdown ? styles.raised : null]}
			>
				<View style={styles.dateRow}>
					<View style={styles.dateField}>
						<ThemedDatePicker
							label={t.startDate}
							placeholder={t.startDate}
							value={startDate}
							onChange={setStartDate}
						/>
					</View>
					<View style={styles.dateField}>
						<ThemedDatePicker
							label={t.endDate}
							placeholder={t.endDate}
							value={endDate}
							onChange={setEndDate}
						/>
					</View>
				</View>

				<ThemedDropdown
					id='transactions-status-filter'
					containerRef={statusRef}
					label={t.status}
					placeholder={t.all}
					options={statusOptions}
					value={statusLabel || t.all}
					setValue={(value) => setStatusLabel(value === t.all ? '' : String(value))}
					showDropdown={openDropdown === 'status'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'status' : null)}
					openDirection='down'
				/>

				<ThemedDropdown
					id='transactions-type-filter'
					containerRef={typeRef}
					label={t.transactionType}
					placeholder={t.all}
					options={typeOptions}
					value={typeLabel || t.all}
					setValue={(value) => setTypeLabel(value === t.all ? '' : String(value))}
					showDropdown={openDropdown === 'type'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'type' : null)}
					openDirection='down'
				/>

				<View style={styles.actions}>
					<ThemedButton
						title={t.clear}
						onPress={clearFilters}
						disabled={
							!hasFilters && !startDate && !endDate && !statusLabel && !typeLabel
						}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor='transparent'
						darkColor='transparent'
						lightTextColor={bim}
						darkTextColor={bim}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={t.applyFilters}
						icon='check'
						onPress={applyFilters}
						disabled={loading}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={bim}
						darkColor={bim}
						lightTextColor={white}
						darkTextColor={white}
						iconColor={white}
						textStyle={styles.actionText}
					/>
				</View>

				<View style={styles.totalRow}>
					<ThemedText
						style={[styles.totalLabel, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.totalBalance}
					</ThemedText>
					<View style={[styles.totalPill, { backgroundColor: lime }]}>
						<ThemedText
							style={styles.totalValue}
							lightColor={white}
							darkColor={white}
							numberOfLines={1}
						>
							{formatAmount(totalAmount, 2)}
						</ThemedText>
					</View>
				</View>
			</TileContainer>

			<TileContainer
				id='transactions-list-tile'
				borderless
				backgroundColor={background}
				style={styles.section}
			>
				<RecordList
					id='transactions-list'
					loading={loading && transactions.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && transactions.length === 0}
					emptyMessage={t.noTransactions}
				>
					{transactions.map((transaction, index) => (
						<RecordCard
							key={`${transaction.id}-${index}`}
							id={`transaction-${transaction.id}-${index}`}
							title={titleFor(transaction)}
							badge={badgeFor(transaction)}
							fields={fieldsFor(transaction)}
						/>
					))}
				</RecordList>

				{transactions.length > 0 ? (
					<ListPagination
						id='transactions-pagination'
						page={page}
						lastPage={lastPage}
						onPrev={() => setPage((current) => Math.max(1, current - 1))}
						onNext={() => setPage((current) => Math.min(lastPage, current + 1))}
					/>
				) : null}
			</TileContainer>
			</TileContainer>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	/** Lifts the section owning the open dropdown above the sections below it. */
	raised: {
		zIndex: 20,
		elevation: 20,
	},
	titleRow: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	screenTitle: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	description: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
	dateRow: {
		flexDirection: 'row',
		gap: 10,
	},
	dateField: {
		flex: 1,
		minWidth: 0,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		gap: 10,
	},
	actionButton: {
		flex: 1,
		minWidth: 0,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
	totalRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	totalLabel: {
		fontSize: fontSize['text.medium'],
	},
	totalPill: {
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	totalValue: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
