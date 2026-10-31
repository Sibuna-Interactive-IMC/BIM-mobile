import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { ShowAlert } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
	createAdminUser,
	fetchAdminUserForm,
	updateAdminUser,
} from '@/services/AdminUserService';
import type { AdminUserPayload } from '@/services/AdminUserService';
import type {
	AdminUserForm,
	GetAdminUserFormResponse,
	ManagedUser,
} from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const NO_ROLE = '\u2014';
const NO_ACCOUNT = '\u2014';

/** Create or edit a login; mirrors the web's admin users form. */
export default function AdminUserFormOverlay({
	visible,
	fadeAnim,
	authToken,
	editing,
	onClose,
	onSaved,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	/** The login being edited, or null when creating. */
	editing: ManagedUser | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.adminUsers;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const inputBorder = useThemeColor({}, 'inputBorder');

	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [roleLabel, setRoleLabel] = useState(NO_ROLE);
	const [accountLabel, setAccountLabel] = useState(NO_ACCOUNT);
	const [newAccountName, setNewAccountName] = useState('');
	const [accountRole, setAccountRole] = useState('');
	const [form, setForm] = useState<AdminUserForm | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);

	const roleRef = useRef<View>(null);
	const accountRef = useRef<View>(null);
	const accountRoleRef = useRef<View>(null);
	const wasVisible = useRef(false);

	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	const roleOptions = useMemo(() => {
		const entries = Object.entries(form?.roles ?? {});
		return [NO_ROLE, ...entries.map(([, label]) => label)];
	}, [form]);

	const accountOptions = useMemo(() => {
		const accounts = form?.accounts ?? [];
		const options = [NO_ACCOUNT, ...accounts.map((account) => account.name)];
		if (form?.newAccountValue) options.push(t.newAccount);
		return options;
	}, [form, t.newAccount]);

	const seatOptions = useMemo(
		() => form?.accountRoles ?? ['owner', 'finance', 'auditor'],
		[form]
	);

	const selectedRoleId = useMemo(() => {
		const entry = Object.entries(form?.roles ?? {}).find(
			([, label]) => label === roleLabel
		);
		return entry ? Number(entry[0]) : null;
	}, [form, roleLabel]);

	const isBlogEditorRole =
		selectedRoleId !== null &&
		(!!form?.blogEditorRoleIds?.length
			? form.blogEditorRoleIds.includes(selectedRoleId)
			: false);

	const creatingAccount = accountLabel === t.newAccount;

	const loadForm = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const res = await fetchAdminUserForm(authToken, editing?.id);
			if (!res.ok) {
				ShowAlert(t.formLoadFailed, 'Error');
				return;
			}
			const body: GetAdminUserFormResponse = await res.json();
			const data =
				getApiData<NonNullable<GetAdminUserFormResponse['data']>>(body)?.form ??
				null;
			setForm(data);
		} catch (e) {
			console.error('[AdminUserForm] load failed', e);
			ShowAlert(t.formLoadFailed, 'Error');
		} finally {
			setLoading(false);
		}
	}, [authToken, editing?.id, t.formLoadFailed]);

	// Seed the fields from the login being edited each time the modal opens.
	useEffect(() => {
		if (!visible || wasVisible.current) return;
		wasVisible.current = true;
		setName(editing?.name ?? '');
		setPhone(editing?.phone ?? '');
		setEmail(editing?.email ?? '');
		setPassword('');
		setNewAccountName('');
		setAccountRole('');
		setRoleLabel(editing?.role?.display_name || editing?.role?.name || NO_ROLE);
		setAccountLabel(editing?.accounts?.[0]?.name ?? NO_ACCOUNT);
		setAccountRole(editing?.accounts?.[0]?.pivot?.role ?? '');
		void loadForm();
	}, [visible, editing, loadForm]);

	useEffect(() => {
		if (!visible) wasVisible.current = false;
	}, [visible]);

	// Blog editor seats are read-only inside the account, exactly as on web.
	useEffect(() => {
		if (isBlogEditorRole && accountRole !== 'auditor') setAccountRole('auditor');
	}, [accountRole, isBlogEditorRole]);

	const submit = useCallback(async () => {
		if (!authToken) return;
		if (!name.trim()) {
			ShowAlert(t.nameRequired, 'Error');
			return;
		}
		if (!phone.trim()) {
			ShowAlert(t.phoneRequired, 'Error');
			return;
		}
		if (!email.trim()) {
			ShowAlert(t.emailRequired, 'Error');
			return;
		}
		if (!editing && password.trim().length < 8) {
			ShowAlert(t.passwordRequired, 'Error');
			return;
		}
		if (creatingAccount && !newAccountName.trim()) {
			ShowAlert(t.newAccountNameRequired, 'Error');
			return;
		}

		// An existing account id, the "__new__" sentinel, or no account at all.
		let accountId: AdminUserPayload['accountId'] = null;
		if (creatingAccount) {
			accountId =
				(form?.newAccountValue as AdminUserPayload['accountId']) ?? '__new__';
		} else if (accountLabel !== NO_ACCOUNT) {
			accountId =
				(form?.accounts ?? []).find((account) => account.name === accountLabel)
					?.id ?? null;
		}

		const needsSeat = accountId !== null;
		if (needsSeat && !accountRole) {
			ShowAlert(t.accountRoleRequired, 'Error');
			return;
		}

		const payload: AdminUserPayload = {
			name: name.trim(),
			phone: phone.trim(),
			email: email.trim(),
			password: password.trim() || undefined,
			roleId: selectedRoleId,
			accountId,
			accountRole: needsSeat ? (accountRole as AdminUserPayload['accountRole']) : null,
			newAccountName: creatingAccount ? newAccountName.trim() : null,
		};

		setSaving(true);
		try {
			const res = editing
				? await updateAdminUser(editing.id, payload, authToken)
				: await createAdminUser(payload, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				return;
			}
			ShowAlert(editing ? t.updated : t.created, 'Success');
			onSaved();
			onClose();
		} catch (e) {
			console.error('[AdminUserForm] save failed', e);
			ShowAlert(t.saveFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		accountLabel,
		accountRole,
		authToken,
		creatingAccount,
		editing,
		email,
		form,
		name,
		newAccountName,
		onClose,
		onSaved,
		password,
		phone,
		selectedRoleId,
		t.accountRoleRequired,
		t.created,
		t.emailRequired,
		t.nameRequired,
		t.newAccountNameRequired,
		t.passwordRequired,
		t.phoneRequired,
		t.saveFailed,
		t.updated,
	]);

	return (
		<OverlayContainer
			id='admin-user-form'
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
					>
						{editing ? t.editUser : t.createUser}
					</ThemedText>
					{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				<ThemedInput
					label={t.name}
					placeholder={t.name}
					value={name}
					setValue={setName}
					style={fields}
				/>
				<ThemedInput
					label={t.phone}
					placeholder='0751123456'
					keyboardType='phone-pad'
					value={phone}
					setValue={setPhone}
					style={fields}
				/>
				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{t.phoneHint}
				</ThemedText>
				<ThemedInput
					label={t.email}
					placeholder='name@example.com'
					keyboardType='email-address'
					autoCapitalize='none'
					value={email}
					setValue={setEmail}
					style={fields}
				/>
				<ThemedInput
					label={editing ? t.newPassword : t.password}
					placeholder={editing ? t.newPassword : t.password}
					secureTextEntry
					value={password}
					setValue={setPassword}
					style={fields}
				/>
				{editing ? (
					<ThemedText
						style={[styles.hint, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.passwordHint}
					</ThemedText>
				) : null}

				<ThemedDropdown
					id='admin-user-role'
					containerRef={roleRef}
					label={t.platformRole}
					placeholder={t.platformRole}
					options={roleOptions}
					value={roleLabel}
					setValue={setRoleLabel}
					showDropdown={openDropdown === 'role'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'role' : null)}
					openDirection='down'
				/>

				<ThemedDropdown
					id='admin-user-account'
					containerRef={accountRef}
					label={t.account}
					placeholder={t.account}
					options={accountOptions}
					value={accountLabel}
					setValue={setAccountLabel}
					showDropdown={openDropdown === 'account'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'account' : null)}
					openDirection='down'
				/>

				{creatingAccount ? (
					<ThemedInput
						label={t.newAccountName}
						placeholder={t.newAccountName}
						value={newAccountName}
						setValue={setNewAccountName}
						style={fields}
					/>
				) : null}

				{accountLabel !== NO_ACCOUNT ? (
					<ThemedDropdown
						id='admin-user-account-role'
						containerRef={accountRoleRef}
						label={t.accountRole}
						placeholder={t.accountRole}
						options={isBlogEditorRole ? ['auditor'] : [...seatOptions]}
						value={accountRole}
						setValue={setAccountRole}
						showDropdown={openDropdown === 'accountRole'}
						setShowDropdown={(open) =>
							setOpenDropdown(open ? 'accountRole' : null)
						}
						openDirection='down'
					/>
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
						title={buttons.save}
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
		lineHeight: 15,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 6,
	},
	actionButton: {
		minWidth: 110,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
