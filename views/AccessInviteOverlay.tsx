import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { ShowAlert, translateWithVariables } from '@/helpers';
import { getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import { inviteUser } from '@/services/AccessService';
import type { InviteUserPayload } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/** The three account seats the API accepts (`owner|Finance|Auditor`). */
export const SEAT_ROLES: InviteUserPayload['role'][] = [
	'owner',
	'Finance',
	'Auditor',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `POST /invitations` — invite someone to the active account. */
export default function AccessInviteOverlay({
	visible,
	fadeAnim,
	authToken,
	accountName,
	onClose,
	onInvited,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	accountName: string;
	onClose: () => void;
	onInvited: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.access;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'mutedText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');

	const [email, setEmail] = useState('');
	const [roleLabel, setRoleLabel] = useState('');
	const [cosignatory, setCosignatory] = useState(false);
	const [saving, setSaving] = useState(false);
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);

	const roleRef = useRef<View>(null);
	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	const roleOptions = useMemo(
		() => [t.roleOwner, t.roleFinance, t.roleAuditor],
		[t.roleAuditor, t.roleFinance, t.roleOwner]
	);

	useEffect(() => {
		if (!visible) return;
		setEmail('');
		setRoleLabel(roleOptions[0] ?? '');
		setCosignatory(false);
		setOpenDropdown(null);
	}, [visible, roleOptions]);

	const isFinance = roleLabel === t.roleFinance;

	const submit = useCallback(async () => {
		if (!authToken) return;
		const trimmed = email.trim();
		if (!trimmed) {
			ShowAlert(t.emailRequired, 'Error');
			return;
		}
		if (!EMAIL_PATTERN.test(trimmed)) {
			ShowAlert(t.invalidEmail, 'Error');
			return;
		}

		setSaving(true);
		try {
			const res = await inviteUser(
				{
					email: trimmed,
					role: SEAT_ROLES[roleOptions.indexOf(roleLabel)] ?? 'owner',
					// The server only stores a co-signatory on a Finance seat.
					...(isFinance ? { is_cosignatory: cosignatory } : {}),
				},
				authToken
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.inviteFailed, 'Error');
				return;
			}
			ShowAlert(t.invited, 'Success');
			onInvited();
			onClose();
		} catch (e) {
			console.error('[AccessInviteOverlay] invite failed', e);
			ShowAlert(t.inviteFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		authToken,
		cosignatory,
		email,
		isFinance,
		onClose,
		onInvited,
		roleLabel,
		roleOptions,
		t.emailRequired,
		t.invalidEmail,
		t.inviteFailed,
		t.invited,
	]);

	return (
		<OverlayContainer
			id='access-invite-form'
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={onClose}
			scrollable
			autoKeyboardInset
			bottomPadding={16}
			keyboardGap={40}
			centerLiftOnKeyboard
			centerLiftRatio={0.9}
		>
			<ThemedView
				style={[styles.card, { backgroundColor: bg }]}
				lightColor={bg}
				darkColor={bg}
			>
				<View style={styles.titleRow}>
					<ThemedText
						style={[styles.title, { color: screenTitleText }]}
						lightColor={screenTitleText}
						darkColor={screenTitleText}
						numberOfLines={2}
					>
						{accountName
							? translateWithVariables(t.inviteTo, { account: accountName })
							: t.inviteTitle}
					</ThemedText>
					{saving ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				<ThemedInput
					label={t.email}
					placeholder='name@example.com'
					keyboardType='email-address'
					autoCapitalize='none'
					value={email}
					setValue={setEmail}
					style={fields}
				/>

				<ThemedDropdown
					id='access-invite-role'
					containerRef={roleRef}
					label={t.role}
					placeholder={t.role}
					options={roleOptions}
					value={roleLabel}
					setValue={setRoleLabel}
					showDropdown={openDropdown === 'role'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'role' : null)}
					openDirection='down'
				/>

				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{t.roleHelp}
				</ThemedText>

				{isFinance ? (
					<>
						<View style={styles.switchRow}>
							<ThemedText
								style={[styles.switchLabel, { color: screenTitleText }]}
								lightColor={screenTitleText}
								darkColor={screenTitleText}
							>
								{t.cosignatory}
							</ThemedText>
							<ThemedSwitch value={cosignatory} onValueChange={setCosignatory} />
						</View>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.cosignatoryHint}
						</ThemedText>
					</>
				) : null}

				<View style={styles.actions}>
					<ThemedButton
						title={buttons.cancel}
						onPress={onClose}
						disabled={saving}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={cancelButton}
						darkColor={cancelButton}
						lightTextColor={white}
						darkTextColor={white}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={t.invite}
						icon='paperplane.fill'
						onPress={() => {
							void submit();
						}}
						loading={saving}
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
			</ThemedView>
		</OverlayContainer>
	);
}

const styles = StyleSheet.create({
	card: {
		width: '100%',
		borderRadius: 10,
		padding: 16,
		gap: 10,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	title: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
	},
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
	},
	switchLabel: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['button.small'],
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 6,
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
