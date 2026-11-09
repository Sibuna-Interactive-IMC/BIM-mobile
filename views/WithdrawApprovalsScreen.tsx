import { useFocusEffect } from '@react-navigation/native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, formatDateTime, ShowAlert } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	approveWithdrawal,
	fetchWithdrawalApprovals,
	rejectWithdrawal,
	retractWithdrawal,
} from '@/services/AccountsService';
import type {
	ApiTransaction,
	GetWithdrawalApprovalsResponse,
	PromptButton,
	WithdrawalApproval,
} from '@/types';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, useAnimatedValue } from 'react-native';

type PendingDecision =
	| { kind: 'approve'; approval: WithdrawalApproval }
	| { kind: 'reject'; approval: WithdrawalApproval }
	| { kind: 'retract'; transaction: ApiTransaction };

/** `GET /withdrawals/approvals`: what needs my sign-off, and what I asked for. */
export default function WithdrawApprovalsScreen() {
	useTrackHistory('/(authenticated)/withdraw-approvals');
	useAccountsBack();
	const { language, authToken, refreshDashboard } = useGeneral();
	const t = translations[language].categories.withdrawApprovals;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');

	const [approvals, setApprovals] = useState<WithdrawalApproval[]>([]);
	const [initiated, setInitiated] = useState<ApiTransaction[]>([]);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [pendingKey, setPendingKey] = useState<string | null>(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const [promptTitle, setPromptTitle] = useState('');
	const [promptMessage, setPromptMessage] = useState('');
	const promptFadeAnim = useAnimatedValue(0);
	const decision = useRef<PendingDecision | null>(null);

	const load = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchWithdrawalApprovals(authToken);
			if (!res.ok) {
				setApprovals([]);
				setInitiated([]);
				return;
			}
			const body: GetWithdrawalApprovalsResponse = await res.json();
			const data = getApiData<NonNullable<GetWithdrawalApprovalsResponse['data']>>(
				body
			);
			setApprovals(data?.approvals ?? []);
			setInitiated(data?.initiated ?? []);
		} catch (e) {
			console.error('[WithdrawApprovalsScreen] load failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken]);

	// The drawer keeps this screen mounted: re-read the approvals whenever the
	// screen is focused so a request that arrived after the first visit (a push
	// tap, the dashboard banner) is listed without a manual refresh.
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

	const ask = useCallback(
		(next: PendingDecision) => {
			decision.current = next;
			if (next.kind === 'approve') {
				setPromptTitle(t.approveConfirmTitle);
				setPromptMessage(t.approveConfirmMessage);
			} else if (next.kind === 'reject') {
				setPromptTitle(t.rejectConfirmTitle);
				setPromptMessage(t.rejectConfirmMessage);
			} else {
				setPromptTitle(t.retractConfirmTitle);
				setPromptMessage(t.retractConfirmMessage);
			}
			promptFadeAnim.setValue(1);
			setShowPrompt(true);
		},
		[
			promptFadeAnim,
			t.approveConfirmMessage,
			t.approveConfirmTitle,
			t.rejectConfirmMessage,
			t.rejectConfirmTitle,
			t.retractConfirmMessage,
			t.retractConfirmTitle,
		]
	);

	const runDecision = useCallback(async () => {
		const next = decision.current;
		if (!next || !authToken) return;
		const key =
			next.kind === 'retract'
				? `retract:${next.transaction.id}`
				: `${next.kind}:${next.approval.id}`;
		setPendingKey(key);
		closePrompt();
		try {
			const res =
				next.kind === 'approve'
					? await approveWithdrawal(next.approval.id, authToken)
					: next.kind === 'reject'
						? await rejectWithdrawal(next.approval.id, undefined, authToken)
						: await retractWithdrawal(next.transaction.id, authToken);
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				ShowAlert(getApiMessage(body) || t.actionFailed, 'Error');
				return;
			}
			await load();
			void refreshDashboard?.(true);
		} catch (e) {
			console.error('[WithdrawApprovalsScreen] decision failed', e);
			ShowAlert(t.actionFailed, 'Error');
		} finally {
			setPendingKey(null);
		}
	}, [authToken, closePrompt, load, refreshDashboard, t.actionFailed]);

	const requestFields = (transaction?: ApiTransaction | null): RecordField[] => [
		{
			label: t.amount,
			value: formatAmount(Math.abs(Number(transaction?.amount ?? 0)), 2),
			tone: 'warning',
		},
		{ label: t.router, value: transaction?.router_name || '—' },
		{ label: t.requestedOn, value: formatDateTime(transaction?.created_at) },
	];

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
					id='withdraw-approvals-header-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<ScreenHeader
						id='withdraw-approvals-header'
						title={t.title}
						description={t.description}
						loading={loading}
					/>
				</TileContainer>

				<TileContainer
					id='withdraw-approvals-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<RecordList
						id='withdraw-approvals-pending'
						title={t.awaitingYou}
						loading={loading && approvals.length === 0}
						loadingMessage={loadingCopy}
						isEmpty={!loading && approvals.length === 0}
						emptyMessage={t.noPending}
					>
						{approvals.map((approval) => (
							<RecordCard
								key={approval.id}
								id={`withdraw-approval-${approval.id}`}
								title={approval.transaction?.router_name || t.title}
								badge={{ label: approval.status || 'pending', tone: 'warning' }}
								fields={requestFields(approval.transaction)}
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
						id='withdraw-approvals-initiated'
						title={t.initiatedByYou}
						loading={loading && initiated.length === 0}
						loadingMessage={loadingCopy}
						isEmpty={!loading && initiated.length === 0}
						emptyMessage={t.noInitiated}
					>
						{initiated.map((transaction) => (
							<RecordCard
								key={transaction.id}
								id={`withdraw-initiated-${transaction.id}`}
								title={transaction.router_name || '—'}
								badge={{ label: transaction.status || 'pending', tone: 'info' }}
								fields={requestFields(transaction)}
								actions={[
									{
										label: t.retract,
										icon: 'block',
										tone: 'danger',
										loading: pendingKey === `retract:${transaction.id}`,
										disabled: !!pendingKey,
										onPress: () => ask({ kind: 'retract', transaction }),
									},
								]}
							/>
						))}
					</RecordList>
				</TileContainer>
			</ParallaxScrollView>

			<Prompt
				id='withdraw-approval-prompt'
				fadeAnim={promptFadeAnim}
				visible={showPrompt}
				onClose={closePrompt}
				title={promptTitle}
				message={promptMessage}
				buttons={promptButtons}
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
	description: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
});
