import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, formatDateTime, translateWithVariables } from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchDisbursementRecords } from '@/services/AccountsService';
import type {
	DisbursementRecord,
	GetDisbursementRecordsResponse,
} from '@/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PAGE_SIZE = 20;

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
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');

	const [records, setRecords] = useState<DisbursementRecord[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchDisbursementRecords(authToken, {
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
		} catch (e) {
			console.error('[DisbursementRecordsScreen] load failed', e);
			setRecords([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, page]);

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

	const fieldsFor = (record: DisbursementRecord): RecordField[] => {
		const documents = record.documents?.length ?? 0;
		return [
			{
				label: t.amount,
				value: formatAmount(Math.abs(Number(record.transaction?.amount ?? 0)), 2),
				tone: 'warning',
			},
			{ label: t.router, value: record.transaction?.router_name || '—' },
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
				id='disbursement-records-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<View style={styles.titleRow}>
					<ThemedText
						style={[styles.screenTitle, { color: textColor }]}
						lightColor={textColor}
						darkColor={textColor}
						numberOfLines={1}
					>
						{t.title}
					</ThemedText>
					{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>
				<ThemedText
					style={[styles.description, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{t.description}
				</ThemedText>

				<RecordList
					id='disbursement-records-list'
					loading={loading && records.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && records.length === 0}
					emptyMessage={t.noRecords}
				>
					{records.map((record) => (
						<RecordCard
							key={record.id}
							id={`disbursement-record-${record.id}`}
							title={record.narration || t.noNarration}
							fields={fieldsFor(record)}
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
});
