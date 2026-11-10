import ListPagination from '@/components/ListPagination';
import OverlayContainer from '@/components/OverlayContainer';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordBadge, RecordField, RecordTone } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedRadioButtons } from '@/components/ThemedRadioButtons';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage, getApiPagination } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	completeDataDeletionRequest,
	fetchAdminDataDeletionRequest,
	fetchAdminDataDeletionRequests,
	rejectDataDeletionRequest,
	replyToDataDeletionRequest,
} from '@/services/DataDeletionService';
import type {
	AdminDataDeletionRequest,
	AdminDataDeletionRequestsData,
	DataDeletionMatchingUser,
	DataDeletionStatus,
	GetAdminDataDeletionRequestResponse,
	GetAdminDataDeletionRequestsResponse,
} from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useAnimatedValue, View } from 'react-native';

const PAGE_SIZE = 20;

const STATUSES: DataDeletionStatus[] = [
	'pending',
	'in_review',
	'awaiting_user',
	'completed',
	'rejected',
];

const STATUS_TONES: Record<DataDeletionStatus, RecordTone> = {
	pending: 'warning',
	in_review: 'info',
	awaiting_user: 'primary',
	completed: 'success',
	rejected: 'danger',
};

type ActiveAction = 'reply' | 'complete' | 'reject';
type ReplyStatus = 'pending' | 'in_review' | 'awaiting_user';

export default function DataDeletionRequestsScreen() {
	useTrackHistory('/(authenticated)/data-deletion-requests');
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.dataDeletionRequests;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const danger = useThemeColor({}, 'error');

	const [requests, setRequests] = useState<AdminDataDeletionRequest[]>([]);
	const [statusCounts, setStatusCounts] = useState<
		Partial<Record<DataDeletionStatus, number>>
	>({});
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<DataDeletionStatus | ''>('');
	const [applied, setApplied] = useState<{
		q?: string;
		status?: DataDeletionStatus;
	}>({});

	const [selectedRequest, setSelectedRequest] =
		useState<AdminDataDeletionRequest | null>(null);
	const [detailRequest, setDetailRequest] =
		useState<AdminDataDeletionRequest | null>(null);
	const [matchingUsers, setMatchingUsers] = useState<DataDeletionMatchingUser[]>(
		[]
	);
	const [showDetails, setShowDetails] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	const [acting, setActing] = useState(false);
	const detailFade = useAnimatedValue(0);
	const [activeAction, setActiveAction] = useState<ActiveAction>('reply');

	const [replyMessage, setReplyMessage] = useState('');
	const [replyStatus, setReplyStatus] = useState<ReplyStatus>('awaiting_user');
	const [completionUserId, setCompletionUserId] = useState('');
	const [confirmation, setConfirmation] = useState('');
	const [completionNotes, setCompletionNotes] = useState('');
	const [rejectReason, setRejectReason] = useState('');
	const [sendEmail, setSendEmail] = useState(true);

	const statusText = useCallback(
		(status: DataDeletionStatus) => {
			switch (status) {
				case 'pending':
					return t.statusPending;
				case 'in_review':
					return t.statusInReview;
				case 'awaiting_user':
					return t.statusAwaitingUser;
				case 'completed':
					return t.statusCompleted;
				case 'rejected':
					return t.statusRejected;
			}
		},
		[
			t.statusAwaitingUser,
			t.statusCompleted,
			t.statusInReview,
			t.statusPending,
			t.statusRejected,
		]
	);

	const allRequestsTotal = useMemo(
		() =>
			Object.keys(statusCounts).length
				? STATUSES.reduce(
						(count, status) => count + (statusCounts[status] ?? 0),
						0
					)
				: total,
		[statusCounts, total]
	);

	const statusTabs = useMemo(
		() => [
			{ key: '', label: t.allRequests, count: allRequestsTotal },
			...STATUSES.map((status) => ({
				key: status,
				label: statusText(status),
				count: statusCounts[status] ?? 0,
			})),
		],
		[allRequestsTotal, statusCounts, statusText, t.allRequests]
	);

	const requestTypeText = useCallback(
		(request: AdminDataDeletionRequest) => {
			if (request.request_type_label) return request.request_type_label;
			switch (request.request_type) {
				case 'account':
					return t.typeAccount;
				case 'hotspot':
					return t.typeHotspot;
				default:
					return t.typeOther;
			}
		},
		[t.typeAccount, t.typeHotspot, t.typeOther]
	);

	const load = useCallback(
		async (
			nextPage: number,
			filters: { q?: string; status?: DataDeletionStatus }
		) => {
			if (!authToken || !isAdmin) {
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const res = await fetchAdminDataDeletionRequests(authToken, {
					page: nextPage,
					perPage: PAGE_SIZE,
					...filters,
				});
				const body: GetAdminDataDeletionRequestsResponse =
					await res.json().catch(() => null);
				if (!res.ok) {
					ShowAlert(getApiMessage(body) || t.loadFailed, 'Error');
					setRequests([]);
					return;
				}
				const payload = getApiData<AdminDataDeletionRequestsData>(body);
				const list = payload?.deletion_requests ?? body.deletion_requests;
				if (!Array.isArray(list)) {
					throw new Error('The request list was missing from the response.');
				}
				setRequests(list);
				setStatusCounts(payload?.status_counts ?? body.status_counts ?? {});
				const meta = getApiPagination(body, 'deletion_requests');
				const nextTotal =
					meta?.total ?? payload?.total ?? body.total ?? list.length;
				setPage(meta?.current_page ?? nextPage);
				setTotal(nextTotal);
				setLastPage(
					Math.max(
						1,
						meta?.last_page ?? (Math.ceil(nextTotal / PAGE_SIZE) || 1)
					)
				);
			} catch (e) {
				console.error('[DataDeletionRequestsScreen] load failed', e);
				ShowAlert(t.loadFailed, 'Error');
				setRequests([]);
			} finally {
				setLoading(false);
			}
		},
		[authToken, isAdmin, t.loadFailed]
	);

	useEffect(() => {
		void load(1, {});
	}, [load]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load(page, applied);
		} finally {
			setRefreshing(false);
		}
	}, [applied, load, page]);

	const applyFilters = useCallback(() => {
		const filters = {
			q: search.trim() || undefined,
			status: (statusFilter || undefined) as DataDeletionStatus | undefined,
		};
		setApplied(filters);
		void load(1, filters);
	}, [load, search, statusFilter]);

	const clearFilters = useCallback(() => {
		setSearch('');
		setStatusFilter('');
		setApplied({});
		void load(1, {});
	}, [load]);

	const selectStatus = useCallback(
		(key: string) => {
			const next = key as DataDeletionStatus | '';
			setStatusFilter(next);
			const filters = {
				q: search.trim() || undefined,
				status: (next || undefined) as DataDeletionStatus | undefined,
			};
			setApplied(filters);
			void load(1, filters);
		},
		[load, search]
	);

	const hasFilters = Boolean(applied.q || applied.status);

	const closeDetails = useCallback(() => {
		detailFade.setValue(0);
		setShowDetails(false);
		setSelectedRequest(null);
		setDetailRequest(null);
		setMatchingUsers([]);
	}, [detailFade]);

	const openDetails = useCallback(
		async (request: AdminDataDeletionRequest) => {
			if (!authToken) return;
			setSelectedRequest(request);
			setDetailRequest(null);
			setMatchingUsers([]);
			setActiveAction('reply');
			setReplyMessage('');
			setReplyStatus('awaiting_user');
			setCompletionUserId('');
			setConfirmation('');
			setCompletionNotes('');
			setRejectReason('');
			setSendEmail(true);
			setDetailLoading(true);
			detailFade.setValue(1);
			setShowDetails(true);
			try {
				const res = await fetchAdminDataDeletionRequest(request.id, authToken);
				const body: GetAdminDataDeletionRequestResponse =
					await res.json().catch(() => null);
				if (!res.ok) {
					ShowAlert(getApiMessage(body) || t.detailFailed, 'Error');
					return;
				}
				const payload = getApiData<
					NonNullable<GetAdminDataDeletionRequestResponse['data']>
				>(body);
				const loadedRequest = payload?.deletion_request;
				if (!loadedRequest) {
					throw new Error('The request detail was missing from the response.');
				}
				setDetailRequest(loadedRequest);
				setMatchingUsers(payload?.matching_users ?? []);
			} catch (e) {
				console.error('[DataDeletionRequestsScreen] detail load failed', e);
				ShowAlert(t.detailFailed, 'Error');
			} finally {
				setDetailLoading(false);
			}
		},
		[authToken, detailFade, t.detailFailed]
	);

	const runAction = useCallback(
		async (
			action: () => Promise<Response>,
			successMessage: string,
			failedMessage: string
		) => {
			if (!authToken || !selectedRequest) return;
			setActing(true);
			try {
				const res = await action();
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					ShowAlert(getApiMessage(body) || failedMessage, 'Error');
					return;
				}
				ShowAlert(getApiMessage(body) || successMessage, 'Success');
				closeDetails();
				await load(page, applied);
			} catch (e) {
				console.error('[DataDeletionRequestsScreen] action failed', e);
				ShowAlert(failedMessage, 'Error');
			} finally {
				setActing(false);
			}
		},
		[applied, authToken, closeDetails, load, page, selectedRequest]
	);

	const submitReply = useCallback(() => {
		if (!selectedRequest || !authToken) return;
		const message = replyMessage.trim();
		if (!message) return ShowAlert(t.replyRequired, 'Error');
		void runAction(
			() =>
				replyToDataDeletionRequest(
					selectedRequest.id,
					{ message, status: replyStatus },
					authToken
				),
			t.replySuccess,
			t.replyFailed
		);
	}, [
		authToken,
		replyMessage,
		replyStatus,
		runAction,
		selectedRequest,
		t.replyFailed,
		t.replyRequired,
		t.replySuccess,
	]);

	const submitCompletion = useCallback(() => {
		if (!selectedRequest || !authToken) return;
		if (confirmation !== 'DELETE') {
			return ShowAlert(t.confirmationRequired, 'Error');
		}
		const userId = completionUserId ? Number(completionUserId) : undefined;
		void runAction(
			() =>
				completeDataDeletionRequest(
					selectedRequest.id,
					{
						confirmation: 'DELETE',
						...(userId ? { user_id: userId } : {}),
						...(completionNotes.trim()
							? { notes: completionNotes.trim() }
							: {}),
						send_email: sendEmail,
					},
					authToken
				),
			t.completeSuccess,
			t.completeFailed
		);
	}, [
		authToken,
		completionNotes,
		completionUserId,
		confirmation,
		runAction,
		selectedRequest,
		sendEmail,
		t.completeFailed,
		t.completeSuccess,
		t.confirmationRequired,
	]);

	const submitRejection = useCallback(() => {
		if (!selectedRequest || !authToken) return;
		const reason = rejectReason.trim();
		if (!reason) return ShowAlert(t.reasonRequired, 'Error');
		void runAction(
			() =>
				rejectDataDeletionRequest(
					selectedRequest.id,
					{ reason, send_email: sendEmail },
					authToken
				),
			t.rejectSuccess,
			t.rejectFailed
		);
	}, [
		authToken,
		rejectReason,
		runAction,
		selectedRequest,
		sendEmail,
		t.rejectFailed,
		t.rejectSuccess,
		t.reasonRequired,
	]);

	const requestStatusOptions = useMemo(
		() => [
			{ key: 'pending', label: t.replyStatusPending },
			{ key: 'in_review', label: t.replyStatusInReview },
			{ key: 'awaiting_user', label: t.replyStatusAwaitingUser },
		],
		[
			t.replyStatusAwaitingUser,
			t.replyStatusInReview,
			t.replyStatusPending,
		]
	);

	const matchingUserOptions = useMemo(
		() => [
			{
				key: '',
				label: t.closeWithoutDeleting,
				description: t.closeWithoutDeletingHint,
			},
			...matchingUsers.map((match) => ({
				key: String(match.id),
				label:
					match.name ||
					match.email ||
					match.phone ||
					`#${match.id}`,
				description: [
					match.email,
					match.phone,
					typeof match.accounts_count === 'number'
						? `${t.accountsCount}: ${match.accounts_count}`
						: '',
				]
					.filter(Boolean)
					.join(' · '),
			})),
		],
		[
			matchingUsers,
			t.accountsCount,
			t.closeWithoutDeleting,
			t.closeWithoutDeletingHint,
		]
	);

	const listFields = (request: AdminDataDeletionRequest): RecordField[] => [
		{
			label: t.received,
			value: formatDateTime(request.created_at),
		},
		{
			label: t.requestType,
			value: requestTypeText(request),
		},
		{
			label: t.accountReference,
			value: request.account_reference || '—',
			fullWidth: true,
		},
		{
			label: t.handledBy,
			value: request.handled_by_name || '—',
		},
	];

	const badgeOf = (request: AdminDataDeletionRequest): RecordBadge => ({
		label: request.status_label || statusText(request.status),
		tone: STATUS_TONES[request.status] ?? 'muted',
	});

	const currentRequest = detailRequest ?? selectedRequest;
	const isClosed =
		currentRequest?.status === 'completed' ||
		currentRequest?.status === 'rejected';

	const detailFields: RecordField[] = currentRequest
		? [
				{
					label: t.requestType,
					value: requestTypeText(currentRequest),
				},
				{
					label: t.received,
					value: formatDateTime(currentRequest.created_at),
				},
				{
					label: t.accountReference,
					value: currentRequest.account_reference || '—',
					fullWidth: true,
				},
				{
					label: t.handledBy,
					value: currentRequest.handled_by_name || '—',
				},
				{
					label: t.handledAt,
					value: formatDateTime(currentRequest.handled_at),
				},
				{
					label: t.repliedAt,
					value: formatDateTime(currentRequest.replied_at),
				},
		  ]
		: [];

	const renderEmailSwitch = (
		<View style={styles.switchRow}>
			<ThemedText style={styles.switchLabel}>{t.sendEmail}</ThemedText>
			<ThemedSwitch value={sendEmail} onValueChange={setSendEmail} />
		</View>
	);

	return (
		<>
			<ParallaxScrollView
				headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
				containerStyle={{ flex: 1 }}
				contentStyle={{ paddingHorizontal: 10 }}
				onRefresh={handleRefresh}
				refreshing={refreshing}
			>
				<TileContainer
					id='data-deletion-header-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<ScreenHeader
						id='data-deletion-header'
						title={t.title}
						description={isAdmin ? t.description : t.adminOnly}
						loading={loading}
					/>
				</TileContainer>

				{isAdmin ? (
					<TileContainer
						id='data-deletion-content-tile'
						flat
						backgroundColor={background}
						style={styles.section}
					>
						<SegmentedTabs
							tabs={statusTabs}
							activeKey={statusFilter}
							onChange={selectStatus}
						/>

						<RecordList
							id='data-deletion-filters'
							isEmpty={false}
						>
							<ThemedInput
								label={t.search}
								placeholder={t.searchPlaceholder}
								maxLength={100}
								value={search}
								setValue={setSearch}
							/>
							<View style={styles.actions}>
								<ThemedButton
									title={t.clear}
									onPress={clearFilters}
									disabled={!hasFilters && !search && !statusFilter}
									numberOfLines={1}
									style={styles.actionButton}
									lightColor='transparent'
									darkColor='transparent'
									lightTextColor={bim}
									darkTextColor={bim}
									textStyle={styles.actionText}
								/>
								<ThemedButton
									title={t.filter}
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
							id='data-deletion-requests'
							title={t.requests}
							description={translateWithVariables(t.requestCount, {
								count: total,
							})}
							loading={loading && requests.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && requests.length === 0}
							emptyMessage={hasFilters ? t.noMatches : t.noRequests}
						>
							{requests.map((request) => (
								<RecordCard
									key={request.id}
									id={`data-deletion-request-${request.id}`}
									title={`${t.requestRef} #${request.id} · ${request.name || t.unknown}`}
									subtitle={
										request.email ||
										request.phone ||
										t.unknown
									}
									badge={badgeOf(request)}
									fields={listFields(request)}
									onPress={() => {
										void openDetails(request);
									}}
									actions={[
										{
											label: t.actions,
											icon: 'eye.outline',
											tone: 'primary',
											onPress: () => {
												void openDetails(request);
											},
										},
									]}
								/>
							))}
							{lastPage > 1 ? (
								<ListPagination
									id='data-deletion-pagination'
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
					</TileContainer>
				) : null}
			</ParallaxScrollView>

			<OverlayContainer
				id='data-deletion-detail-overlay'
				showOverlay={showDetails}
				fadeAnim={detailFade}
				position='center'
				onRequestClose={closeDetails}
				scrollable
			>
				<View
					style={[
						styles.detailCard,
						{ backgroundColor: background },
					]}
				>
					<ThemedText
						style={[styles.detailTitle, { color: textColor }]}
						lightColor={textColor}
						darkColor={textColor}
					>
						{currentRequest
							? `${t.requestRef} #${currentRequest.id}`
							: t.title}
					</ThemedText>

					{detailLoading ? (
						<ThemedText style={{ color: mutedText }} lightColor={mutedText} darkColor={mutedText}>
							{t.detailLoading}
						</ThemedText>
					) : currentRequest ? (
						<>
							<RecordCard
								id={`data-deletion-detail-${currentRequest.id}`}
								title={currentRequest.name || t.unknown}
								subtitle={[
									currentRequest.email,
									currentRequest.phone,
								]
									.filter(Boolean)
									.join(' · ')}
								badge={badgeOf(currentRequest)}
								fields={detailFields}
							/>

							{currentRequest.details ? (
								<View style={styles.detailBlock}>
									<ThemedText style={styles.blockLabel}>{t.details}</ThemedText>
									<ThemedText style={{ color: textColor }} lightColor={textColor} darkColor={textColor}>
										{currentRequest.details}
									</ThemedText>
								</View>
							) : null}
							{currentRequest.reply_message ? (
								<View style={styles.detailBlock}>
									<ThemedText style={styles.blockLabel}>{t.replyMessage}</ThemedText>
									<ThemedText style={{ color: textColor }} lightColor={textColor} darkColor={textColor}>
										{currentRequest.reply_message}
									</ThemedText>
								</View>
							) : null}
							{currentRequest.admin_notes ? (
								<View style={styles.detailBlock}>
									<ThemedText style={styles.blockLabel}>{t.adminNotes}</ThemedText>
									<ThemedText style={{ color: textColor }} lightColor={textColor} darkColor={textColor}>
										{currentRequest.admin_notes}
									</ThemedText>
								</View>
							) : null}
							{currentRequest.ip_address || currentRequest.user_agent ? (
								<View style={styles.detailBlock}>
									<ThemedText style={styles.blockLabel}>{t.requester}</ThemedText>
									{currentRequest.ip_address ? (
										<ThemedText style={{ color: mutedText }} lightColor={mutedText} darkColor={mutedText}>
											{`${t.ipAddress}: ${currentRequest.ip_address}`}
										</ThemedText>
									) : null}
									{currentRequest.user_agent ? (
										<ThemedText style={{ color: mutedText }} lightColor={mutedText} darkColor={mutedText}>
											{`${t.userAgent}: ${currentRequest.user_agent}`}
										</ThemedText>
									) : null}
								</View>
							) : null}

							<View style={styles.detailBlock}>
								<ThemedText style={styles.blockLabel}>{t.matchingUsers}</ThemedText>
								{matchingUsers.length ? (
									matchingUsers.map((match) => (
										<View key={match.id} style={styles.matchRow}>
											<ThemedText style={{ color: textColor }} lightColor={textColor} darkColor={textColor}>
												{`#${match.id} · ${match.name || match.email || match.phone || t.unknown}`}
											</ThemedText>
											<ThemedText style={{ color: mutedText }} lightColor={mutedText} darkColor={mutedText}>
												{[
													match.email,
													match.phone,
													typeof match.accounts_count === 'number'
														? `${t.accountsCount}: ${match.accounts_count}`
														: '',
												]
													.filter(Boolean)
													.join(' · ')}
											</ThemedText>
										</View>
									))
								) : (
									<ThemedText style={{ color: mutedText }} lightColor={mutedText} darkColor={mutedText}>
										{t.noMatchingUsers}
									</ThemedText>
								)}
							</View>

							{isClosed ? (
								<ThemedText
									style={[styles.closedText, { color: mutedText }]}
									lightColor={mutedText}
									darkColor={mutedText}
								>
									{t.closedRequest}
								</ThemedText>
							) : (
								<>
									<ThemedText style={[styles.blockLabel, { color: textColor }]} lightColor={textColor} darkColor={textColor}>
										{t.actions}
									</ThemedText>
									<SegmentedTabs
										tabs={[
											{ key: 'reply', label: t.replyTab },
											{ key: 'complete', label: t.completeTab },
											{ key: 'reject', label: t.rejectTab },
										]}
										activeKey={activeAction}
										onChange={(key) => setActiveAction(key as ActiveAction)}
									/>

									{activeAction === 'reply' ? (
										<>
											<ThemedInput
												label={t.replyLabel}
												placeholder={t.replyPlaceholder}
												value={replyMessage}
												setValue={setReplyMessage}
												multiline
												textAlignVertical='top'
												style={styles.multilineInput}
											/>
											<ThemedText style={{ color: mutedText }} lightColor={mutedText} darkColor={mutedText}>
												{t.replyStatusHint}
											</ThemedText>
											<ThemedRadioButtons
												id='data-deletion-reply-status'
												options={requestStatusOptions}
												value={replyStatus}
												onChange={(value) =>
													setReplyStatus(value as ReplyStatus)
												}
											/>
											<ThemedButton
												title={t.sendReply}
												icon='paperplane.fill'
												onPress={submitReply}
												loading={acting}
												disabled={acting || !replyMessage.trim()}
												lightColor={bim}
												darkColor={bim}
												lightTextColor={white}
												darkTextColor={white}
												iconColor={white}
											/>
										</>
									) : activeAction === 'complete' ? (
										<>
											<ThemedText
												style={[styles.warningText, { color: danger }]}
												lightColor={danger}
												darkColor={danger}
											>
												{t.completeWarning}
											</ThemedText>
											<ThemedText style={styles.blockLabel}>
												{t.loginToDelete}
											</ThemedText>
											<ThemedRadioButtons
												id='data-deletion-matching-logins'
												options={matchingUserOptions}
												value={completionUserId}
												onChange={setCompletionUserId}
											/>
											<ThemedInput
												label={t.completionNotes}
												value={completionNotes}
												setValue={setCompletionNotes}
												multiline
												textAlignVertical='top'
												style={styles.multilineInput}
											/>
											<ThemedInput
												label={t.confirmDeletion}
												placeholder={t.confirmationPlaceholder}
												autoCapitalize='characters'
												value={confirmation}
												setValue={setConfirmation}
											/>
											{renderEmailSwitch}
											<ThemedButton
												title={t.completeRequest}
												icon='check'
												onPress={submitCompletion}
												loading={acting}
												disabled={acting || confirmation !== 'DELETE'}
												lightColor={bim}
												darkColor={bim}
												lightTextColor={white}
												darkTextColor={white}
												iconColor={white}
											/>
										</>
									) : (
										<>
											<ThemedInput
												label={t.rejectReason}
												placeholder={t.rejectPlaceholder}
												value={rejectReason}
												setValue={setRejectReason}
												multiline
												textAlignVertical='top'
												style={styles.multilineInput}
											/>
											{renderEmailSwitch}
											<ThemedButton
												title={t.rejectRequest}
												icon='close'
												onPress={submitRejection}
												loading={acting}
												disabled={acting || !rejectReason.trim()}
												lightColor={danger}
												darkColor={danger}
												lightTextColor={white}
												darkTextColor={white}
												iconColor={white}
											/>
										</>
									)}
								</>
							)}
					</>
					) : null}

					<ThemedButton
						title={t.cancel}
						onPress={closeDetails}
						disabled={acting}
						lightColor='transparent'
						darkColor='transparent'
						lightTextColor={bim}
						darkTextColor={bim}
					/>
				</View>
			</OverlayContainer>
		</>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	actions: {
		flexDirection: 'row',
		width: '100%',
		gap: 8,
	},
	actionButton: {
		flex: 1,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
	detailCard: {
		width: '100%',
		maxWidth: 560,
		gap: 14,
		paddingVertical: 18,
		paddingHorizontal: 16,
		borderRadius: 10,
	},
	detailTitle: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	detailBlock: {
		gap: 6,
	},
	blockLabel: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['heading.three'],
	},
	matchRow: {
		gap: 2,
		paddingVertical: 6,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#99999955',
	},
	multilineInput: {
		minHeight: 88,
		paddingTop: 12,
	},
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	switchLabel: {
		flex: 1,
	},
	warningText: {
		fontSize: fontSize['text.small'],
		lineHeight: 19,
	},
	closedText: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['text.xsmall'],
	},
});
