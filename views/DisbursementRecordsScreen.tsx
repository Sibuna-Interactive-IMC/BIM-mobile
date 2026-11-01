import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordBadge, RecordField, RecordTone } from '@/components/RecordList';
import ThemedDatePicker from '@/components/ThemedDatePicker';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedButton } from '@/components/ThemedButton';
import ScreenHeader from '@/components/ScreenHeader';import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import {
	formatAmount,
	formatDateTime,
	toApiDate,
	translateWithVariables,
} from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchDisbursementRecords } from '@/services/AccountsService';
import type {
	DisbursementRecord,
	GetDisbursementRecordsResponse,
} from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useAnimatedValue, View } from 'react-native';

import DisbursementDocumentsOverlay from '@/views/DisbursementDocumentsOverlay';

const PAGE_SIZE = 20;
const ALL = '\u2014';

type NarrationFilter = 'yes' | 'no';

type AppliedFilters = {
	router?: string;
	dateFrom?: string;
	dateTo?: string;
	hasNarration?: NarrationFilter;
};

const STATUS_TONES: Record<string, RecordTone> = {
	successful: 'success',
	completed: 'success',
	approved: 'success',
	pending_approval: 'info',
	pending: 'warning',
	reversed: 'muted',
	failed: 'danger',
	rejected: 'danger',
};

/** `GET /disbursement-records`: what the disbursed funds were used for. */
export default function DisbursementRecordsScreen() {
	useTrackHistory('/(authenticated)/disbursement-records');
	useAccountsBack();
	const { language, authToken } = useGeneral();
	const t = translations[language].categories.disbursements;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');

	const [records, setRecords] = useState<DisbursementRecord[]>([]);
	const [routerNames, setRouterNames] = useState<string[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// Draft filters are edited in the form; only "Apply" copies them into the
	// applied set that the request uses.
	const [routerLabel, setRouterLabel] = useState('');
	const [dateFrom, setDateFrom] = useState<Date | null>(null);
	const [dateTo, setDateTo] = useState<Date | null>(null);
	const [narrationLabel, setNarrationLabel] = useState('');
	const [applied, setApplied] = useState<AppliedFilters>({});
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);

	const [documentsRecord, setDocumentsRecord] =
		useState<DisbursementRecord | null>(null);
	const [showDocuments, setShowDocuments] = useState(false);
	const documentsFade = useAnimatedValue(0);

	const routerRef = useRef<View>(null);
	const narrationRef = useRef<View>(null);

	const narrationOptions = useMemo(
		() => [t.allRecords, t.hasNarration, t.missingNarration],
		[t.allRecords, t.hasNarration, t.missingNarration]
	);

	const routerOptions = useMemo(
		() => [t.allRouters, ...routerNames],
		[routerNames, t.allRouters]
	);

	const load = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchDisbursementRecords(authToken, {
				router: applied.router,
				dateFrom: applied.dateFrom,
				dateTo: applied.dateTo,
				hasNarration: applied.hasNarration,
				page,
				perPage: PAGE_SIZE,
			});
			if (!res.ok) {
				setRecords([]);
				return;
			}
			const body: GetDisbursementRecordsResponse = await res.json();
			setRecords(
				getApiData<NonNullable<GetDisbursementRecordsResponse['data']>>(body)
					?.records ?? []
			);
			setLastPage(Math.max(1, getApiPagination(body, 'records')?.last_page ?? 1));

			// The server narrows the name list to the filtered query, so keep the
			// union — otherwise the router picker would collapse to one option.
			const names =
				getApiData<NonNullable<GetDisbursementRecordsResponse['data']>>(body)
					?.router_names ?? [];
			if (names.length) {
				setRouterNames((current) =>
					Array.from(new Set([...current, ...names])).sort((a, b) =>
						a.localeCompare(b)
					)
				);
			}
		} catch (e) {
			console.error('[DisbursementRecordsScreen] load failed', e);
			setRecords([]);
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

	const applyFilters = useCallback(() => {
		setApplied({
			router: routerLabel && routerLabel !== t.allRouters ? routerLabel : undefined,
			dateFrom: toApiDate(dateFrom) ?? undefined,
			dateTo: toApiDate(dateTo) ?? undefined,
			hasNarration:
				narrationLabel === t.hasNarration
					? 'yes'
					: narrationLabel === t.missingNarration
						? 'no'
						: undefined,
		});
		setPage(1);
	}, [
		dateFrom,
		dateTo,
		narrationLabel,
		routerLabel,
		t.allRouters,
		t.hasNarration,
		t.missingNarration,
	]);

	const clearFilters = useCallback(() => {
		setRouterLabel('');
		setDateFrom(null);
		setDateTo(null);
		setNarrationLabel('');
		setApplied({});
		setPage(1);
	}, []);

	const hasFilters =
		!!applied.router ||
		!!applied.dateFrom ||
		!!applied.dateTo ||
		!!applied.hasNarration;

	const statusOf = (record: DisbursementRecord) =>
		(record.transaction?.status ?? '').toString();

	const badgeFor = (record: DisbursementRecord): RecordBadge | undefined => {
		const status = statusOf(record);
		if (!status) return undefined;
		return {
			label: status.replace(/_/g, ' '),
			tone: STATUS_TONES[status] ?? 'muted',
		};
	};

	const fieldsFor = (record: DisbursementRecord): RecordField[] => {
		const documents = record.documents?.length ?? 0;
		return [
			{
				label: t.amount,
				value: formatAmount(Math.abs(Number(record.transaction?.amount ?? 0)), 2),
				tone: 'warning',
			},
			{
				label: t.router,
				value:
					record.transaction?.router?.name ||
					record.transaction?.router_name ||
					ALL,
			},
			{ label: t.date, value: formatDateTime(record.created_at) },
			{
				label: t.documentsLabel,
				value: documents
					? translateWithVariables(t.documents, { count: documents })
					: t.noDocuments,
				fullWidth: true,
			},
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
				id='disbursement-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='disbursement-header'
					title={t.title}
					description={t.description}
					loading={loading}
				/>
			</TileContainer>

			<TileContainer
				id='disbursement-content-tile'
				flat
				backgroundColor={background}
				style={{ width: '100%', gap: 12 }}
			>
			<TileContainer
				id='disbursement-filters-tile'
				borderless
				backgroundColor={background}
				style={styles.section}
			>
				<ThemedDropdown
					id='disbursement-filter-router'
					containerRef={routerRef}
					label={t.router}
					placeholder={t.allRouters}
					options={routerOptions}
					value={routerLabel || t.allRouters}
					setValue={(value) =>
						setRouterLabel(value === t.allRouters ? '' : String(value))
					}
					showDropdown={openDropdown === 'router'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'router' : null)}
					openDirection='down'
				/>

				<View style={styles.dateRow}>
					<View style={styles.dateField}>
						<ThemedDatePicker
							label={t.dateFrom}
							placeholder={t.dateFrom}
							value={dateFrom}
							onChange={setDateFrom}
						/>
					</View>
					<View style={styles.dateField}>
						<ThemedDatePicker
							label={t.dateTo}
							placeholder={t.dateTo}
							value={dateTo}
							onChange={setDateTo}
						/>
					</View>
				</View>

				<ThemedDropdown
					id='disbursement-filter-narration'
					containerRef={narrationRef}
					label={t.narration}
					placeholder={t.allRecords}
					options={narrationOptions}
					value={narrationLabel || t.allRecords}
					setValue={(value) =>
						setNarrationLabel(value === t.allRecords ? '' : String(value))
					}
					showDropdown={openDropdown === 'narration'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'narration' : null)}
					openDirection='down'
				/>

				<View style={styles.actions}>
					<ThemedButton
						title={t.clear}
						onPress={clearFilters}
						disabled={
							!hasFilters &&
							!routerLabel &&
							!dateFrom &&
							!dateTo &&
							!narrationLabel
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
						title={t.apply}
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
			</TileContainer>

			<TileContainer
				id='disbursement-records-tile'
				borderless
				backgroundColor={background}
				style={styles.section}
			>
				<RecordList
					id='disbursement-records-list'
					loading={loading && records.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && records.length === 0}
					emptyMessage={
						hasFilters ? t.noRecordsForFilters : t.noRecords
					}
				>
					{records.map((record) => (
						<RecordCard
							key={record.id}
							id={`disbursement-record-${record.id}`}
							title={record.narration || t.noNarration}
							badge={badgeFor(record)}
							fields={fieldsFor(record)}
							actions={[
								{
									label: t.documentsLabel,
									icon: 'eye.outline',
									tone: 'primary',
									onPress: () => {
										setDocumentsRecord(record);
										documentsFade.setValue(1);
										setShowDocuments(true);
									},
								},
							]}
						/>
					))}
				</RecordList>

				{records.length > 0 ? (
					<ListPagination
						id='disbursement-records-pagination'
						page={page}
						lastPage={lastPage}
						onPrev={() => setPage((current) => Math.max(1, current - 1))}
						onNext={() => setPage((current) => Math.min(lastPage, current + 1))}
					/>
				) : null}
			</TileContainer>
			</TileContainer>

			<DisbursementDocumentsOverlay
				visible={showDocuments}
				fadeAnim={documentsFade}
				authToken={authToken ?? undefined}
				record={documentsRecord}
				onClose={() => {
					documentsFade.setValue(0);
					setShowDocuments(false);
					setDocumentsRecord(null);
				}}
				onChanged={() => {
					void load();
				}}
			/>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
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
		minWidth: 96,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
