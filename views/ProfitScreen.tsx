import { useFocusEffect } from '@react-navigation/native';
import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, formatDateTime, ShowAlert } from '@/helpers';
import { getApiData, getApiMessage, getApiPagination } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	approveProfitWithdrawal,
	fetchProfit,
	rejectProfitWithdrawal,
	retractProfitWithdrawal,
} from '@/services/AccountsService';
import type {
	GetProfitResponse,
	ProfitSnapshot,
	ProfitWithdrawal,
	ProfitWithdrawalApproval,
	PromptButton,
} from '@/types';
import { useCallback, useRef, useState } from 'react';
import {
	Animated,
	StyleSheet,
	useAnimatedValue,
} from 'react-native';

import ProfitWithdrawOverlay from '@/views/ProfitWithdrawOverlay';

type PendingDecision =
	| { kind: 'approve'; approval: ProfitWithdrawalApproval }
	| { kind: 'reject'; approval: ProfitWithdrawalApproval }
	| { kind: 'retract'; withdrawal: ProfitWithdrawal };

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> =
	{
		pending_approval: 'warning',
		approved: 'info',
		disbursed: 'success',
		rejected: 'danger',
		failed: 'danger',
	};

/** `GET /analytics/profit`: provider balances, approvals and withdrawal history. */
export default function ProfitScreen() {
	useTrackHistory('/(authenticated)/profit');
	useAccountsBack();
	const { language, authToken, user, refreshDashboard } = useGeneral();
	const t = translations[language].categories.profit;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');

	const [snapshot, setSnapshot] = useState<ProfitSnapshot | null>(null);
	const [pending, setPending] = useState<ProfitWithdrawalApproval[]>([]);
	const [mine, setMine] = useState<ProfitWithdrawal[]>([]);
	const [history, setHistory] = useState<ProfitWithdrawal[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [pendingKey, setPendingKey] = useState<string | null>(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const [promptTitle, setPromptTitle] = useState('');
	const [promptMessage, setPromptMessage] = useState('');
	const promptFadeAnim = useAnimatedValue(0);
	const decision = useRef<PendingDecision | null>(null);

	const load = useCallback(async () => {
		if (!authToken || !isAdmin) return;
		setLoading(true);
		try {
			const res = await fetchProfit(authToken, page);
			if (!res.ok) {
				setSnapshot(null);
				return;
			}
			const body: GetProfitResponse = await res.json();
			const data = getApiData<NonNullable<GetProfitResponse['data']>>(body);
			setSnapshot(data?.snapshot ?? null);
			setPending(data?.pending_approvals ?? []);
			setMine(data?.my_initiated ?? []);
			setHistory(data?.history ?? []);
			setLastPage(Math.max(1, getApiPagination(body, 'history')?.last_page ?? 1));
		} catch (e) {
			console.error('[ProfitScreen] load failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken, isAdmin, page]);

	// The drawer keeps this screen mounted, so loading only on mount would
	// leave an approval that arrived while the user was elsewhere invisible
	// until a manual pull-to-refresh.
	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	const closePrompt = useCallback(() => {
		promptFadeAnim.setValue(0);
		setShowPrompt(false);
		decision.current = null;
	}, [promptFadeAnim]);

	const [showWithdraw, setShowWithdraw] = useState(false);
	const withdrawFadeAnim = useAnimatedValue(0);

	const openWithdraw = useCallback(() => {
		Animated.timing(withdrawFadeAnim, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowWithdraw(true));
	}, [withdrawFadeAnim]);

	const closeWithdraw = useCallback(() => {
		Animated.timing(withdrawFadeAnim, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowWithdraw(false));
	}, [withdrawFadeAnim]);

	const ask = useCallback(
		(next: PendingDecision) => {
			decision.current = next;
			if (next.kind === 'approve') {
				setPromptTitle(t.approve);
				setPromptMessage(t.pendingApprovals);
			} else if (next.kind === 'reject') {
				setPromptTitle(t.reject);
				setPromptMessage(t.pendingApprovals);
			} else {
				setPromptTitle(t.retract);
				setPromptMessage(t.myInitiated);
			}
			promptFadeAnim.setValue(1);
			setShowPrompt(true);
		},
		[
			promptFadeAnim,
			t.approve,
			t.myInitiated,
			t.pendingApprovals,
			t.reject,
			t.retract,
		]
	);

	const runDecision = useCallback(async () => {
		const next = decision.current;
		if (!next || !authToken) return;
		const key =
			next.kind === 'retract'
				? `retract:${next.withdrawal.id}`
				: `${next.kind}:${next.approval.id}`;
		setPendingKey(key);
		closePrompt();
		try {
			const res =
				next.kind === 'approve'
					? await approveProfitWithdrawal(next.approval.id, authToken)
					: next.kind === 'reject'
						? await rejectProfitWithdrawal(next.approval.id, undefined, authToken)
						: await retractProfitWithdrawal(next.withdrawal.id, authToken);
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				ShowAlert(getApiMessage(body) || t.actionFailed, 'Error');
				return;
			}
			await load();
			void refreshDashboard?.(true);
		} catch (e) {
			console.error('[ProfitScreen] decision failed', e);
			ShowAlert(t.actionFailed, 'Error');
		} finally {
			setPendingKey(null);
		}
	}, [authToken, closePrompt, load, refreshDashboard, t.actionFailed]);

	const withdrawalFields = (withdrawal?: ProfitWithdrawal | null): RecordField[] => [
		{
			label: t.amount,
			value: formatAmount(withdrawal?.amount ?? 0, 2),
			tone: 'warning',
		},
		{ label: t.provider, value: withdrawal?.provider || '—' },
		{ label: t.recipient, value: withdrawal?.recipient_msisdn || '—' },
		{ label: t.reference, value: withdrawal?.reference || '—' },
		{ label: t.requestedOn, value: formatDateTime(withdrawal?.created_at) },
	];

	const snapshotFields: RecordField[] = snapshot
		? [
				{ label: t.profit, value: formatAmount(snapshot.profit ?? 0, 2), tone: 'success' },
				{
					label: t.ownerOwed,
					value: formatAmount(snapshot.owner_owed ?? 0, 2),
					tone: 'warning',
				},
				{
					label: t.yoBalance,
					value: formatAmount(snapshot.yo_balance ?? 0, 2),
				},
				{
					label: t.yoAvailable,
					value: formatAmount(snapshot.yo_available ?? 0, 2),
					tone: 'info',
				},
				{
					label: t.relworxBalance,
					value: formatAmount(snapshot.relworx_balance ?? 0, 2),
				},
				{
					label: t.relworxAvailable,
					value: formatAmount(snapshot.relworx_available ?? 0, 2),
					tone: 'info',
				},
				{
					label: t.mtn,
					value: formatAmount(snapshot.yo_wallets?.mtn ?? 0, 2),
				},
				{
					label: t.airtel,
					value: formatAmount(snapshot.yo_wallets?.airtel ?? 0, 2),
				},
				{
					label: t.buffer,
					value: formatAmount(snapshot.buffer_per_provider ?? 0, 2),
				},
			]
		: [];

	const promptButtons: PromptButton[] = [
		{
			title: buttons.cancel,
			color: cancelButton,
			textColor: white,
			action: closePrompt,
		},
		{
			title: buttons.confirm,
			color: dangerButton,
			textColor: white,
			action: () => {
				void runDecision();
			},
		},
	];

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
					id='profit-header-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<ScreenHeader
						id='profit-header'
						title={t.title}
						description={isAdmin ? t.description : t.adminOnly}
						loading={loading}
						action={
							isAdmin ? (
								<ThemedButton
									style={styles.headerButton}
									title={t.withdrawAction}
									icon='withdrawal'
									numberOfLines={1}
									onPress={openWithdraw}
									lightColor={bim}
									darkColor={bim}
									lightTextColor={white}
									darkTextColor={white}
									iconColor={white}
									textStyle={styles.headerButtonText}
								/>
							) : undefined
						}
					/>
				</TileContainer>

				<TileContainer
					id='profit-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					{isAdmin ? (
						<>
							<RecordList
								id='profit-snapshot'
								title={t.snapshot}
								loading={loading && !snapshot}
								loadingMessage={loadingCopy}
								isEmpty={!loading && !snapshot}
								emptyMessage={t.description}
							>
								<RecordCard id='profit-snapshot-card' fields={snapshotFields} />
							</RecordList>

							<RecordList
								id='profit-pending'
								title={t.pendingApprovals}
								loading={loading && pending.length === 0}
								loadingMessage={loadingCopy}
								isEmpty={!loading && pending.length === 0}
								emptyMessage={t.noPending}
							>
								{pending.map((approval) => (
									<RecordCard
										key={approval.id}
										id={`profit-approval-${approval.id}`}
										title={approval.withdrawal?.reference || t.pendingApprovals}
										fields={withdrawalFields(approval.withdrawal)}
										actions={[
											{
												label: t.approve,
												icon: 'check',
												tone: 'success',
												loading: pendingKey === `approve:${approval.id}`,
												disabled: !!pendingKey,
												onPress: () => ask({ kind: 'approve', approval }),
											},
											{
												label: t.reject,
												icon: 'block',
												tone: 'danger',
												loading: pendingKey === `reject:${approval.id}`,
												disabled: !!pendingKey,
												onPress: () => ask({ kind: 'reject', approval }),
											},
										]}
									/>
								))}
							</RecordList>

							<RecordList
								id='profit-mine'
								title={t.myInitiated}
								loading={loading && mine.length === 0}
								loadingMessage={loadingCopy}
								isEmpty={!loading && mine.length === 0}
								emptyMessage={t.noInitiated}
							>
								{mine.map((withdrawal) => (
									<RecordCard
										key={withdrawal.id}
										id={`profit-mine-${withdrawal.id}`}
										title={withdrawal.reference || t.myInitiated}
										badge={{
											label: withdrawal.status || 'pending_approval',
											tone: STATUS_TONES[withdrawal.status ?? ''] ?? 'muted',
										}}
										fields={withdrawalFields(withdrawal)}
										actions={[
											{
												label: t.retract,
												icon: 'block',
												tone: 'danger',
												loading: pendingKey === `retract:${withdrawal.id}`,
												disabled: !!pendingKey,
												onPress: () => ask({ kind: 'retract', withdrawal }),
											},
										]}
									/>
								))}
							</RecordList>

							<RecordList
								id='profit-history'
								title={t.history}
								loading={loading && history.length === 0}
								loadingMessage={loadingCopy}
								isEmpty={!loading && history.length === 0}
								emptyMessage={t.noHistory}
							>
								{history.map((withdrawal) => (
									<RecordCard
										key={withdrawal.id}
										id={`profit-history-${withdrawal.id}`}
										title={withdrawal.reference || t.history}
										badge={{
											label: withdrawal.status || '—',
											tone: STATUS_TONES[withdrawal.status ?? ''] ?? 'muted',
										}}
										fields={[
											...withdrawalFields(withdrawal),
											{
												label: t.initiatedBy,
												value: withdrawal.initiated_by?.name || '—',
												fullWidth: true,
											},
										]}
									/>
								))}
							</RecordList>

							{history.length > 0 ? (
								<ListPagination
									id='profit-history-pagination'
									page={page}
									lastPage={lastPage}
									onPrev={() => setPage((current) => Math.max(1, current - 1))}
									onNext={() =>
										setPage((current) => Math.min(lastPage, current + 1))
									}
								/>
							) : null}
						</>
					) : null}
				</TileContainer>
			</ParallaxScrollView>

			<Prompt
				id='profit-prompt'
				fadeAnim={promptFadeAnim}
				visible={showPrompt}
				onClose={closePrompt}
				title={promptTitle}
				message={promptMessage}
				buttons={promptButtons}
			/>

			<ProfitWithdrawOverlay
				visible={showWithdraw}
				fadeAnim={withdrawFadeAnim}
				authToken={authToken ?? undefined}
				snapshot={snapshot}
				onClose={closeWithdraw}
				onSubmitted={() => {
					void load();
				}}
			/>
		</>
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
	headerButton: {
		flexShrink: 0,
	},
	headerButtonText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
	description: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
});
