import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField, RecordTone } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, translateWithVariables } from '@/helpers';
import { getApiData, getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useHeaderBack from '@/hooks/useHeaderBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchBroadcast } from '@/services/BroadcastService';
import type {
	Broadcast,
	BroadcastRecipient,
	BroadcastStatus,
	GetBroadcastResponse,
	RecipientStatus,
} from '@/types';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const PAGE_SIZE = 25;

const BROADCAST_TONES: Record<BroadcastStatus, RecordTone> = {
	queued: 'muted',
	sending: 'info',
	sent: 'success',
	partial: 'warning',
	failed: 'danger',
};

const RECIPIENT_TONES: Record<RecipientStatus, RecordTone> = {
	pending: 'warning',
	sent: 'success',
	failed: 'danger',
	skipped: 'muted',
};

/** `GET /admin/broadcasts/{id}` — one send and its per-recipient outcome. */
export default function BroadcastDetailScreen() {
	useTrackHistory('/(authenticated)/broadcasts/detail');
	useHeaderBack('/(authenticated)/broadcasts');
	const params = useLocalSearchParams<{ id?: string }>();
	const broadcastId = Number(params.id);
	const { language, authToken } = useGeneral();
	const t = translations[language].categories.broadcast;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');

	const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
	const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [search, setSearch] = useState('');
	const [statusLabel, setStatusLabel] = useState('');
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const statusRef = useRef<View>(null);

	const statusOptions = useMemo(
		() => [
			t.anyStatus,
			t.statusPending,
			t.statusSent,
			t.statusFailed,
			t.recipientSkipped,
		],
		[t.anyStatus, t.recipientSkipped, t.statusFailed, t.statusPending, t.statusSent]
	);

	const statusValue: RecipientStatus | '' =
		statusLabel === t.statusPending
			? 'pending'
			: statusLabel === t.statusSent
				? 'sent'
				: statusLabel === t.statusFailed
					? 'failed'
					: statusLabel === t.recipientSkipped
						? 'skipped'
						: '';

	const load = useCallback(
		async (nextPage: number, q: string, status: RecipientStatus | '') => {
			if (!authToken || !Number.isFinite(broadcastId)) return;
			setLoading(true);
			try {
				const res = await fetchBroadcast(broadcastId, authToken, {
					page: nextPage,
					perPage: PAGE_SIZE,
					q: q.trim() || undefined,
					status,
				});
				const body: GetBroadcastResponse = await res.json().catch(() => null);
				if (!res.ok) {
					setBroadcast(null);
					setRecipients([]);
					return;
				}
				const payload = getApiData<NonNullable<GetBroadcastResponse['data']>>(body);
				setBroadcast(payload?.broadcast ?? null);
				setRecipients(payload?.recipients ?? []);
				const meta = getApiPagination(body, 'recipients');
				setPage(meta?.current_page ?? nextPage);
				setLastPage(Math.max(1, meta?.last_page ?? 1));
			} catch (e) {
				console.error('[BroadcastDetailScreen] load failed', e);
				setBroadcast(null);
			} finally {
				setLoading(false);
			}
		},
		[authToken, broadcastId]
	);

	useEffect(() => {
		void load(1, '', '');
	}, [load]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load(page, search, statusValue);
		} finally {
			setRefreshing(false);
		}
	}, [load, page, search, statusValue]);

	const summaryFields: RecordField[] = broadcast
		? [
				{
					label: t.recipientsCount,
					value: String(broadcast.recipients_count ?? 0),
					tone: 'info',
				},
				{
					label: t.outcome,
					value: translateWithVariables(t.sentCount, {
						count: broadcast.sent_count ?? 0,
					}),
					tone: 'success',
				},
				{
					label: t.statusFailed,
					value: String(broadcast.failed_count ?? 0),
					tone: (broadcast.failed_count ?? 0) > 0 ? 'danger' : 'muted',
				},
				{
					label: t.recipientSkipped,
					value: String(broadcast.skipped_count ?? 0),
					tone: (broadcast.skipped_count ?? 0) > 0 ? 'warning' : 'muted',
				},
				{
					label: t.audience,
					value: broadcast.audience_label || '—',
					fullWidth: true,
				},
				{ label: t.dateRange, value: dateRangeLabel(broadcast, t), fullWidth: true },
				...(broadcast.purchases_filter
					? [
							{
								label: t.purchasesFilter,
								value: purchasesLabel(broadcast, t),
								fullWidth: true,
							},
						]
					: []),
				{ label: t.channel, value: (broadcast.channel ?? 'sms').toUpperCase() },
				{ label: t.admin, value: broadcast.admin?.name || '—' },
				{ label: t.when, value: formatDateTime(broadcast.created_at) },
			]
		: [];

	const recipientFields = (recipient: BroadcastRecipient): RecordField[] => [
		{
			label: t.status,
			value: recipient.status_label,
			tone: RECIPIENT_TONES[recipient.status] ?? 'muted',
		},
		{ label: t.sentAt, value: formatDateTime(recipient.sent_at) },
		...(recipient.error
			? [
					{
						label: t.recipientDetail,
						value: recipient.error,
						fullWidth: true as const,
						tone: 'danger' as const,
					},
				]
			: []),
	];

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='broadcast-detail-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='broadcast-detail-header'
					title={translateWithVariables(t.broadcastLead, { id: broadcastId })}
					description={broadcast?.status_label}
					loading={loading}
				/>
			</TileContainer>

			<TileContainer
				id='broadcast-detail-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<RecordList
					id='broadcast-detail-summary'
					title={t.message}
					loading={loading && !broadcast}
					loadingMessage={loadingCopy}
					isEmpty={!loading && !broadcast}
					emptyMessage={t.notFound}
				>
					<RecordCard
						id='broadcast-detail-card'
						title={broadcast?.message}
						badge={
							broadcast
								? {
										label: broadcast.status_label,
										tone: BROADCAST_TONES[broadcast.status] ?? 'muted',
									}
								: undefined
						}
						fields={summaryFields}
					/>
				</RecordList>

				{broadcast?.error ? (
					<RecordList id='broadcast-detail-error' isEmpty={false}>
						<RecordCard
							id='broadcast-detail-error-card'
							fields={[
								{
									label: t.recipientDetail,
									value: broadcast.error,
									fullWidth: true,
									tone: 'danger',
								},
							]}
						/>
					</RecordList>
				) : null}

				<RecordList
					id='broadcast-detail-recipients'
					title={t.recipients}
					loading={loading && recipients.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && recipients.length === 0}
					emptyMessage={t.noRecipients}
				>
					<View
						style={[
							styles.filters,
							openDropdown === 'status' ? styles.raised : null,
						]}
					>
						<ThemedInput
							label={t.search}
							placeholder={t.searchRecipient}
							maxLength={60}
							value={search}
							setValue={setSearch}
						/>

						<ThemedDropdown
							id='broadcast-detail-status'
							containerRef={statusRef}
							label={t.status}
							placeholder={t.anyStatus}
							options={statusOptions}
							value={statusLabel || t.anyStatus}
							setValue={(value) =>
								setStatusLabel(value === t.anyStatus ? '' : String(value))
							}
							showDropdown={openDropdown === 'status'}
							setShowDropdown={(open) => setOpenDropdown(open ? 'status' : null)}
							openDirection='down'
						/>

						<ThemedButton
							title={t.search}
							icon='search.outline'
							onPress={() => {
								void load(1, search, statusValue);
							}}
							loading={loading}
							numberOfLines={1}
							lightColor={bim}
							darkColor={bim}
							lightTextColor={white}
							darkTextColor={white}
							iconColor={white}
							textStyle={styles.actionText}
						/>
					</View>

					{recipients.map((recipient) => (
						<RecordCard
							key={recipient.id}
							id={`broadcast-recipient-${recipient.id}`}
							title={recipient.display_phone || recipient.phone}
							badge={{
								label: recipient.status_label,
								tone: RECIPIENT_TONES[recipient.status] ?? 'muted',
							}}
							fields={recipientFields(recipient)}
						/>
					))}

					{lastPage > 1 ? (
						<ListPagination
							id='broadcast-detail-pagination'
							page={page}
							lastPage={lastPage}
							onPrev={() => {
								void load(Math.max(1, page - 1), search, statusValue);
							}}
							onNext={() => {
								void load(Math.min(lastPage, page + 1), search, statusValue);
							}}
						/>
					) : null}
				</RecordList>
			</TileContainer>
		</ParallaxScrollView>
	);
}

function purchasesLabel(broadcast: Broadcast, t: Record<string, string>) {
	const filter = broadcast.purchases_filter;
	if (!filter) return '—';
	if (filter.operator === 'lt') {
		return translateWithVariables(t.purchasesValue, { count: filter.count });
	}
	if (filter.operator === 'gt') {
		return translateWithVariables(t.purchasesValueMore, { count: filter.count });
	}
	return translateWithVariables(t.purchasesValueExactly, { count: filter.count });
}

function dateRangeLabel(broadcast: Broadcast | null, t: Record<string, string>) {
	if (!broadcast?.date_from && !broadcast?.date_to) return t.anyDate;
	return translateWithVariables(t.dateRangeValue, {
		from: broadcast?.date_from
			? formatDateTime(broadcast.date_from).split(',')[0]
			: t.fromBeginning,
		to: broadcast?.date_to
			? formatDateTime(broadcast.date_to).split(',')[0]
			: t.untilToday,
	});
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	filters: {
		width: '100%',
		gap: 8,
	},
	/** Lifts the filter row (and its open dropdown menu) above the cards below. */
	raised: {
		zIndex: 20,
		elevation: 20,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
