import ListPagination from '@/components/ListPagination';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField, RecordTone } from '@/components/RecordList';
import { ThemedButton } from '@/components/ThemedButton';
import ThemedDatePicker from '@/components/ThemedDatePicker';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, toApiDate, translateWithVariables } from '@/helpers';
import { getApiPagination } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import { fetchBroadcasts } from '@/services/BroadcastService';
import type { Broadcast, BroadcastSite, GetBroadcastsResponse } from '@/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

const PAGE_SIZE = 20;

const STATUS_TONES: Record<string, RecordTone> = {
	queued: 'muted',
	sending: 'info',
	sent: 'success',
	partial: 'warning',
	failed: 'danger',
};

type AppliedFilters = {
	q?: string;
	status?: string;
	audience?: string;
	routerId?: string;
	from?: string;
	to?: string;
};

/** The message history: every send with its audience, outcome and status. */
export default function BroadcastHistoryPanel({
	authToken,
	sites,
	onLoaded,
}: {
	authToken?: string;
	sites: BroadcastSite[];
	/** Hands the history page's payload (sites/templates/limits) back to the screen. */
	onLoaded?: (body: GetBroadcastsResponse) => void;
}) {
	const router = useRouter();
	const { language } = useGeneral();
	const t = translations[language].categories.broadcast;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');

	const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [applied, setApplied] = useState<AppliedFilters>({});

	const [search, setSearch] = useState('');
	const [statusLabel, setStatusLabel] = useState('');
	const [audienceLabel, setAudienceLabel] = useState('');
	const [siteLabel, setSiteLabel] = useState('');
	const [from, setFrom] = useState<Date | null>(null);
	const [to, setTo] = useState<Date | null>(null);
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const statusRef = useRef<View>(null);
	const audienceRef = useRef<View>(null);
	const siteRef = useRef<View>(null);

	const statusOptions = useMemo(
		() => [
			t.anyStatus,
			t.statusQueued,
			t.statusSending,
			t.statusSent,
			t.statusPartial,
			t.statusFailed,
		],
		[
			t.anyStatus,
			t.statusFailed,
			t.statusPartial,
			t.statusQueued,
			t.statusSending,
			t.statusSent,
		]
	);

	const audienceOptions = useMemo(
		() => [t.anyAudience, t.audienceAll, t.audienceSite, t.audienceSingle],
		[t.anyAudience, t.audienceAll, t.audienceSingle, t.audienceSite]
	);

	const siteOptions = useMemo(
		() => [t.anySite, ...sites.map((site) => site.label)],
		[sites, t.anySite]
	);

	const statusValue =
		statusLabel === t.statusQueued
			? 'queued'
			: statusLabel === t.statusSending
				? 'sending'
				: statusLabel === t.statusSent
					? 'sent'
					: statusLabel === t.statusPartial
						? 'partial'
						: statusLabel === t.statusFailed
							? 'failed'
							: '';

	const audienceValue =
		audienceLabel === t.audienceAll
			? 'all'
			: audienceLabel === t.audienceSite
				? 'site'
				: audienceLabel === t.audienceSingle
					? 'single'
					: '';

	const load = useCallback(
		async (nextPage: number, filters: AppliedFilters) => {
			if (!authToken) return;
			setLoading(true);
			try {
				const res = await fetchBroadcasts(authToken, {
					page: nextPage,
					perPage: PAGE_SIZE,
					...filters,
				});
				const body: GetBroadcastsResponse = await res.json().catch(() => null);
				if (!res.ok) {
					setBroadcasts([]);
					return;
				}
				const payload = body?.data ?? body;
				setBroadcasts(payload?.broadcasts ?? []);
				const meta = getApiPagination(body, 'broadcasts');
				setPage(meta?.current_page ?? nextPage);
				setLastPage(Math.max(1, meta?.last_page ?? 1));
				onLoaded?.(body);
			} catch (e) {
				console.error('[BroadcastHistoryPanel] load failed', e);
				setBroadcasts([]);
			} finally {
				setLoading(false);
			}
		},
		[authToken, onLoaded]
	);

	const applyFilters = useCallback(() => {
		const next: AppliedFilters = {
			q: search.trim() || undefined,
			status: statusValue || undefined,
			audience: audienceValue || undefined,
			routerId: sites.find((site) => site.label === siteLabel)?.id,
			from: toApiDate(from) ?? undefined,
			to: toApiDate(to) ?? undefined,
		};
		setApplied(next);
		void load(1, next);
	}, [
		audienceValue,
		from,
		load,
		search,
		siteLabel,
		sites,
		statusValue,
		to,
	]);

	const clearFilters = useCallback(() => {
		setSearch('');
		setStatusLabel('');
		setAudienceLabel('');
		setSiteLabel('');
		setFrom(null);
		setTo(null);
		setApplied({});
		void load(1, {});
	}, [load]);

	const hasFilters = Object.values(applied).some(Boolean);

	const fieldsOf = (broadcast: Broadcast): RecordField[] => [
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
			tone: (broadcast.failed_count ?? 0) > 0 ? 'warning' : 'success',
		},
		{
			label: t.audience,
			value: broadcast.audience_label || '—',
			fullWidth: true,
		},
		{
			label: t.dateRange,
			value: dateRangeLabel(broadcast, t),
			fullWidth: true,
		},
		{ label: t.admin, value: broadcast.admin?.name || '—' },
		{ label: t.when, value: formatDateTime(broadcast.created_at) },
	];

	return (
		<View style={styles.panel}>
			<RecordList
				id='broadcast-history-filters'
				isEmpty={false}
				// The filter menus are absolutely positioned inside this section, so it
				// must paint above the history list below it while one is open.
				style={
					openDropdown === 'status' ||
					openDropdown === 'audience' ||
					openDropdown === 'site'
						? styles.raised
						: undefined
				}
			>
				<ThemedInput
					label={t.search}
					placeholder={t.searchPlaceholder}
					maxLength={60}
					value={search}
					setValue={setSearch}
				/>

				<ThemedDropdown
					id='broadcast-history-status'
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

				<ThemedDropdown
					id='broadcast-history-audience'
					containerRef={audienceRef}
					label={t.audience}
					placeholder={t.anyAudience}
					options={audienceOptions}
					value={audienceLabel || t.anyAudience}
					setValue={(value) =>
						setAudienceLabel(value === t.anyAudience ? '' : String(value))
					}
					showDropdown={openDropdown === 'audience'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'audience' : null)}
					openDirection='down'
				/>

				<ThemedDropdown
					id='broadcast-history-site'
					containerRef={siteRef}
					label={t.site}
					placeholder={t.anySite}
					options={siteOptions}
					value={siteLabel || t.anySite}
					setValue={(value) =>
						setSiteLabel(value === t.anySite ? '' : String(value))
					}
					showDropdown={openDropdown === 'site'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'site' : null)}
					openDirection='down'
				/>

				<View style={styles.dateRow}>
					<View style={styles.dateField}>
						<ThemedDatePicker
							label={t.sentFrom}
							placeholder={t.sentFrom}
							value={from}
							onChange={setFrom}
						/>
					</View>
					<View style={styles.dateField}>
						<ThemedDatePicker
							label={t.sentTo}
							placeholder={t.sentTo}
							value={to}
							onChange={setTo}
						/>
					</View>
				</View>

				<View style={styles.actions}>
					<ThemedButton
						title={t.clear}
						onPress={clearFilters}
						disabled={!hasFilters && !search && !statusLabel && !audienceLabel && !siteLabel && !from && !to}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor='transparent'
						darkColor='transparent'
						lightTextColor={bim}
						darkTextColor={bim}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={t.search}
						icon='search.outline'
						onPress={applyFilters}
						loading={loading}
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
			</RecordList>

			<RecordList
				id='broadcast-history'
				title={t.history}
				description={translateWithVariables(t.historyCount, {
					count: broadcasts.length,
				})}
				loading={loading && broadcasts.length === 0}
				loadingMessage={loadingCopy}
				isEmpty={!loading && broadcasts.length === 0}
				emptyMessage={hasFilters ? t.noBroadcastMatches : t.noBroadcasts}
			>
				{broadcasts.map((broadcast) => (
					<RecordCard
						key={broadcast.id}
						id={`broadcast-${broadcast.id}`}
						title={broadcast.message}
						subtitle={
							broadcast.template?.name
								? translateWithVariables(t.templateBadge, {
										name: broadcast.template.name,
									})
								: undefined
						}
						badge={{
							label: broadcast.status_label,
							tone: STATUS_TONES[broadcast.status] ?? 'muted',
						}}
						fields={fieldsOf(broadcast)}
						actions={[
							{
								label: t.viewBroadcast,
								icon: 'eye.outline',
								tone: 'primary',
								onPress: () =>
									router.push(
										`/(authenticated)/broadcasts/${broadcast.id}` as never
									),
							},
						]}
					/>
				))}

				{lastPage > 1 ? (
					<ListPagination
						id='broadcast-history-pagination'
						page={page}
						lastPage={lastPage}
						onPrev={() => {
							void load(Math.max(1, page - 1), applied);
						}}
						onNext={() => {
							void load(Math.min(lastPage, page + 1), applied);
						}}
					/>
				) : null}
			</RecordList>
		</View>
	);
}

/** `M j, Y` window the send was filtered to, matching the web history column. */
function dateRangeLabel(broadcast: Broadcast, t: Record<string, string>) {
	if (!broadcast.date_from && !broadcast.date_to) return t.anyDate;
	return translateWithVariables(t.dateRangeValue, {
		from: broadcast.date_from
			? formatDateTime(broadcast.date_from).split(',')[0]
			: t.fromBeginning,
		to: broadcast.date_to
			? formatDateTime(broadcast.date_to).split(',')[0]
			: t.untilToday,
	});
}

const styles = StyleSheet.create({
	panel: {
		width: '100%',
		gap: 12,
	},
	/** Lifts the section owning the open dropdown above the sections below it. */
	raised: {
		zIndex: 20,
		elevation: 20,
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
});
