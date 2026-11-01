import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordBadge, RecordField } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { Colors } from '@/constants/Colors';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	fetchAccess,
	removeAccountMember,
	revokeInvitation,
} from '@/services/AccessService';
import type {
	AccountInvitation,
	AccountMember,
	GetAccessResponse,
} from '@/types';
import { useCallback, useEffect, useState } from 'react';
import {
	StyleSheet,
	useAnimatedValue,
	useColorScheme,
} from 'react-native';

import AccessInviteOverlay from '@/views/AccessInviteOverlay';

type PendingAction =
	| { kind: 'remove'; member: AccountMember }
	| { kind: 'revoke'; invitation: AccountInvitation };

const isTruthy = (value: unknown) =>
	value === true || value === 1 || value === '1' || value === 'true';

/** `GET /invitations` — the active account's members and pending invitations. */
export default function AccessManagementScreen() {
	useTrackHistory('/(authenticated)/access');
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.access;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const colorScheme = useColorScheme();

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const dangerButton = useThemeColor({}, 'dangerButton');

	const [accountName, setAccountName] = useState('');
	const [members, setMembers] = useState<AccountMember[]>([]);
	const [invitations, setInvitations] = useState<AccountInvitation[]>([]);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [pending, setPending] = useState<PendingAction | null>(null);
	const [busyKey, setBusyKey] = useState<string | null>(null);

	const [showInvite, setShowInvite] = useState(false);
	const [showPrompt, setShowPrompt] = useState(false);
	const inviteFade = useAnimatedValue(0);
	const promptFade = useAnimatedValue(0);

	// Owners alone can invite, revoke or remove; the API enforces the same rule.
	const isOwner = (user?.account?.role ?? '').toLowerCase() === 'owner';

	const load = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchAccess(authToken);
			if (!res.ok) {
				setMembers([]);
				setInvitations([]);
				return;
			}
			const body: GetAccessResponse = await res.json();
			const data = getApiData<NonNullable<GetAccessResponse['data']>>(body);
			setAccountName(data?.account?.name ?? '');
			setMembers(data?.members ?? []);
			setInvitations(data?.invitations ?? []);
		} catch (e) {
			console.error('[AccessManagementScreen] load failed', e);
			setMembers([]);
			setInvitations([]);
		} finally {
			setLoading(false);
		}
	}, [authToken]);

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

	const closePrompt = useCallback(() => {
		promptFade.setValue(0);
		setShowPrompt(false);
		setPending(null);
	}, [promptFade]);

	const runPending = useCallback(async () => {
		if (!authToken || !pending) return;
		const key =
			pending.kind === 'remove'
				? `remove:${pending.member.id}`
				: `revoke:${pending.invitation.id}`;
		setBusyKey(key);
		try {
			const res =
				pending.kind === 'remove'
					? await removeAccountMember(pending.member.id, authToken)
					: await revokeInvitation(pending.invitation.id, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(
					getApiMessage(body) ||
						(pending.kind === 'remove' ? t.removeFailed : t.revokeFailed),
					'Error'
				);
				return;
			}
			ShowAlert(
				pending.kind === 'remove' ? t.removed : t.revoked,
				'Success'
			);
			await load();
		} catch (e) {
			console.error('[AccessManagementScreen] action failed', e);
			ShowAlert(
				pending.kind === 'remove' ? t.removeFailed : t.revokeFailed,
				'Error'
			);
		} finally {
			setBusyKey(null);
			closePrompt();
		}
	}, [
		authToken,
		closePrompt,
		load,
		pending,
		t.removeFailed,
		t.removed,
		t.revokeFailed,
		t.revoked,
	]);

	const selfId = user?.id;

	const memberFields = (member: AccountMember): RecordField[] => [
		{ label: t.email, value: member.email || '—', fullWidth: true },
		{
			label: t.role,
			value: member.pivot?.role || '—',
			tone: 'info',
		},
		{
			label: t.joined,
			value: member.pivot?.created_at
				? formatDateTime(member.pivot.created_at)
				: '—',
		},
	];

	const memberBadge = (member: AccountMember): RecordBadge => {
		const coSignatory = isTruthy(member.pivot?.is_cosignatory);
		if (coSignatory) {
			return { label: t.coSignatoryBadge, tone: 'info' };
		}
		return { label: t.active, tone: 'success' };
	};

	const invitationFields = (invitation: AccountInvitation): RecordField[] => [
		{ label: t.role, value: invitation.role || '—', tone: 'info' },
		{
			label: t.sent,
			value: invitation.created_at
				? formatDateTime(invitation.created_at)
				: '—',
		},
		{
			label: t.status,
			value: isTruthy(invitation.is_cosignatory)
				? `${t.pending} · ${t.coSignatoryBadge}`
				: t.pending,
			fullWidth: true,
		},
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
				id='access-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='access-header'
					title={t.title}
					description={isOwner ? t.description : t.ownerOnly}
					loading={loading}
					action={
						isOwner ? (
							<ThemedButton
								title={t.invite}
								icon='plus'
								numberOfLines={1}
								onPress={() => {
									inviteFade.setValue(1);
									setShowInvite(true);
								}}
								lightColor={bim}
								darkColor={bim}
								lightTextColor={white}
								darkTextColor={white}
								iconColor={white}
							/>
						) : undefined
					}
				/>
			</TileContainer>

			<TileContainer
				id='access-content-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<RecordList
					id='access-members'
					title={t.members}
					description={
						members.length
							? translateWithVariables(t.membersCount, {
									count: members.length,
								})
							: undefined
					}
					loading={loading && members.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && members.length === 0}
					emptyMessage={t.noMembers}
				>
					{members.map((member) => {
						const isSelf = String(member.id) === String(selfId);
						const isOwnerSeat =
							(member.pivot?.role ?? '').toLowerCase() === 'owner';
						// Owners cannot remove other owners (and never themselves).
						const canRemove = isOwner && !isSelf && !isOwnerSeat;
						return (
							<RecordCard
								key={member.id}
								id={`access-member-${member.id}`}
								title={isSelf ? `${member.name} · ${t.you}` : member.name}
								badge={memberBadge(member)}
								fields={memberFields(member)}
								actions={
									canRemove
										? [
												{
													label: t.remove,
													icon: 'delete.outline',
													tone: 'danger',
													loading: busyKey === `remove:${member.id}`,
													disabled: busyKey !== null,
													onPress: () => {
														setPending({ kind: 'remove', member });
														promptFade.setValue(1);
														setShowPrompt(true);
													},
												},
											]
										: undefined
								}
							/>
						);
					})}
				</RecordList>

				<RecordList
					id='access-invitations'
					title={t.pendingInvitations}
					description={
						invitations.length
							? translateWithVariables(t.pendingCount, {
									count: invitations.length,
								})
							: undefined
					}
					loading={loading && invitations.length === 0}
					loadingMessage={loadingCopy}
					isEmpty={!loading && invitations.length === 0}
					emptyMessage={t.noInvitations}
				>
					{invitations.map((invitation) => (
						<RecordCard
							key={invitation.id}
							id={`access-invitation-${invitation.id}`}
							title={invitation.email}
							badge={{ label: t.pending, tone: 'warning' }}
							fields={invitationFields(invitation)}
							actions={
								isOwner
									? [
											{
												label: t.revoke,
												icon: 'close',
												tone: 'danger',
												loading: busyKey === `revoke:${invitation.id}`,
												disabled: busyKey !== null,
												onPress: () => {
													setPending({ kind: 'revoke', invitation });
													promptFade.setValue(1);
													setShowPrompt(true);
												},
											},
										]
									: undefined
							}
						/>
					))}
				</RecordList>
			</TileContainer>

			<AccessInviteOverlay
				visible={showInvite}
				fadeAnim={inviteFade}
				authToken={authToken ?? undefined}
				accountName={accountName}
				onClose={() => {
					inviteFade.setValue(0);
					setShowInvite(false);
				}}
				onInvited={() => {
					void load();
				}}
			/>

			<Prompt
				id='access-prompt'
				fadeAnim={promptFade}
				visible={showPrompt}
				onClose={closePrompt}
				title={
					pending?.kind === 'remove' ? t.removeTitle : t.revokeTitle
				}
				message={
					pending?.kind === 'remove'
						? translateWithVariables(t.removeMessage, {
								name: pending.member.name,
							})
						: translateWithVariables(t.revokeMessage, {
								email: pending?.invitation.email ?? '',
							})
				}
				buttons={[
					{
						title: buttons.cancel,
						color: Colors[colorScheme ?? 'light'].cancelButton,
						textColor: Colors[colorScheme ?? 'light'].white,
						action: closePrompt,
					},
					{
						title:
							pending?.kind === 'remove' ? t.remove : t.revoke,
						color: dangerButton || Colors[colorScheme ?? 'light'].dangerButton,
						textColor: Colors[colorScheme ?? 'light'].white,
						action: () => {
							void runPending();
						},
					},
				]}
			/>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
});
