import AvatarImage from '@/components/AvatarImage';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	deleteAccount,
	fetchAvatarOptions,
	fetchProfile,
	updatePassword,
	updateProfile,
} from '@/services/ProfileService';
import type {
	AvatarGroup,
	GenderOption,
	GetAvatarOptionsResponse,
	GetProfileResponse,
	ProfileMutationResponse,
	PromptButton,
	UpdateProfilePayload,
	User,
} from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useAnimatedValue, View } from 'react-native';
import { useRouter } from 'expo-router';

import AvatarPickerOverlay from '@/views/AvatarPickerOverlay';

const FALLBACK_GENDERS: GenderOption[] = [
	{ value: '', label: 'Prefer not to say' },
	{ value: 'female', label: 'Female' },
	{ value: 'male', label: 'Male' },
	{ value: 'other', label: 'Other' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Profile: the avatar and identity fields from the web profile page, plus the
 * password change and account deletion that page also offers. Every write goes
 * to the same endpoints (`PATCH /profile`, `PUT /password`, `DELETE /profile`).
 */
export default function ProfileScreen() {
	useTrackHistory('/(authenticated)/profile');
	const router = useRouter();
	const { language, authToken, user, setUser, handleLogout } = useGeneral();
	const t = translations[language].categories.profile;
	const buttons = translations[language].categories.buttons;

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const mutedText = useThemeColor({}, 'screenTitleText');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');
	const verifiedColor = useThemeColor({}, 'lime');
	const lightBorder = useThemeColor({}, 'inputBorder');
	const lightGreyFill = useThemeColor({}, 'listItemBackground');

	const [profile, setProfile] = useState<User | null>(user ?? null);
	const [groups, setGroups] = useState<AvatarGroup[]>([]);
	const [genders, setGenders] = useState<GenderOption[]>(FALLBACK_GENDERS);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// Profile form
	const [fullName, setFullName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [genderLabel, setGenderLabel] = useState('');
	const [notificationEmail, setNotificationEmail] = useState('');
	const [avatar, setAvatar] = useState('');
	const [saving, setSaving] = useState(false);
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const genderRef = useRef<View>(null);

	// Password form
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [savingPassword, setSavingPassword] = useState(false);

	// Delete form
	const [deletePassword, setDeletePassword] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [showDeletePrompt, setShowDeletePrompt] = useState(false);
	const deleteFade = useAnimatedValue(0);

	const [showAvatarPicker, setShowAvatarPicker] = useState(false);
	const avatarFade = useAnimatedValue(0);

	/** Seed the form from whatever the API (or the cached login) says. */
	const applyProfile = useCallback((next: User | null) => {
		if (!next) return;
		setProfile(next);
		setFullName(next.name ?? '');
		setEmail(next.email ?? '');
		setPhone(next.phone ?? '');
		setNotificationEmail(next.notification_email ?? '');
		setAvatar(next.avatar_id ?? next.avatar ?? 'default');
	}, []);

	const load = useCallback(async () => {
		if (!authToken) return;
		setLoading(true);
		try {
			const [profileRes, avatarRes] = await Promise.all([
				fetchProfile(authToken),
				fetchAvatarOptions(authToken),
			]);

			if (profileRes.ok) {
				const body: GetProfileResponse = await profileRes.json().catch(() => null);
				const data = getApiData<NonNullable<GetProfileResponse['data']>>(body);
				applyProfile((data?.user ?? null) as User | null);
			}

			if (avatarRes.ok) {
				const body: GetAvatarOptionsResponse = await avatarRes
					.json()
					.catch(() => null);
				const data = getApiData<NonNullable<GetAvatarOptionsResponse['data']>>(
					body
				);
				setGroups(data?.groups ?? []);
				if (data?.gender_options?.length) setGenders(data.gender_options);
			}
		} catch (e) {
			console.error('[ProfileScreen] load failed', e);
		} finally {
			setLoading(false);
		}
	}, [applyProfile, authToken]);

	useEffect(() => {
		// Start from the cached login so the form is never blank while it loads.
		if (user) applyProfile(user as User);
		void load();
	}, [applyProfile, load, user]);

	// The gender select works in labels; the API stores the value.
	const genderOptions = useMemo(
		() => genders.map((option) => option.label),
		[genders]
	);

	useEffect(() => {
		const current = genders.find(
			(option) => option.value === (profile?.gender ?? '')
		);
		setGenderLabel(current?.label ?? genders[0]?.label ?? '');
	}, [genders, profile?.gender]);

	const genderValue =
		genders.find((option) => option.label === genderLabel)?.value ?? '';

	const avatarPreset = useMemo(() => {
		const all = groups.flatMap((group) => group.presets);
		return (
			all.find((preset) => preset.id === avatar) ??
			all.find((preset) => preset.id === 'default') ??
			null
		);
	}, [avatar, groups]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	const saveProfile = useCallback(async () => {
		if (!authToken) return;
		const trimmedName = fullName.trim();
		const trimmedEmail = email.trim();
		if (!trimmedName) return ShowAlert(t.nameRequired, 'Error');
		if (!trimmedEmail) return ShowAlert(t.emailRequired, 'Error');
		if (!EMAIL_PATTERN.test(trimmedEmail)) return ShowAlert(t.invalidEmail, 'Error');
		if (!phone.trim()) return ShowAlert(t.phoneRequired, 'Error');

		// Only what changed: phone, gender and avatar are `sometimes` server-side,
		// so a partial update cannot blank the sign-in identity.
		const payload: UpdateProfilePayload = {
			name: trimmedName,
			email: trimmedEmail,
		};
		if (phone.trim() !== (profile?.phone ?? '')) payload.phone = phone.trim();
		if (genderValue !== (profile?.gender ?? '')) payload.gender = genderValue;
		if (notificationEmail.trim() !== (profile?.notification_email ?? '')) {
			payload.notification_email = notificationEmail.trim();
		}
		if (avatar !== (profile?.avatar_id ?? profile?.avatar ?? 'default')) {
			payload.avatar = avatar;
		}

		setSaving(true);
		try {
			const res = await updateProfile(payload, authToken);
			const body: ProfileMutationResponse = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				return;
			}
			const saved = getApiData<NonNullable<ProfileMutationResponse['data']>>(body)
				?.user;
			if (saved) {
				applyProfile(saved as User);
				setUser((prev) => ({ ...(prev ?? {}), ...saved }));
			}
			ShowAlert(getApiMessage(body) || t.saved, 'Success');
		} catch (e) {
			console.error('[ProfileScreen] save failed', e);
			ShowAlert(t.saveFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		applyProfile,
		authToken,
		avatar,
		email,
		fullName,
		genderValue,
		notificationEmail,
		phone,
		profile?.avatar,
		profile?.avatar_id,
		profile?.gender,
		profile?.notification_email,
		profile?.phone,
		setUser,
		t.emailRequired,
		t.invalidEmail,
		t.nameRequired,
		t.phoneRequired,
		t.saveFailed,
		t.saved,
	]);

	const submitPassword = useCallback(async () => {
		if (!authToken) return;
		if (!currentPassword) return ShowAlert(t.passwordRequired, 'Error');
		if (newPassword.length < 8) return ShowAlert(t.passwordTooShort, 'Error');
		if (newPassword !== confirmPassword) {
			return ShowAlert(t.passwordMismatch, 'Error');
		}

		setSavingPassword(true);
		try {
			const res = await updatePassword(
				{
					current_password: currentPassword,
					password: newPassword,
					password_confirmation: confirmPassword,
				},
				authToken
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.passwordFailed, 'Error');
				return;
			}
			ShowAlert(getApiMessage(body) || t.passwordUpdated, 'Success');
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
		} catch (e) {
			console.error('[ProfileScreen] password update failed', e);
			ShowAlert(t.passwordFailed, 'Error');
		} finally {
			setSavingPassword(false);
		}
	}, [
		authToken,
		confirmPassword,
		currentPassword,
		newPassword,
		t.passwordFailed,
		t.passwordMismatch,
		t.passwordRequired,
		t.passwordTooShort,
		t.passwordUpdated,
	]);

	const closeDeletePrompt = useCallback(() => {
		deleteFade.setValue(0);
		setShowDeletePrompt(false);
	}, [deleteFade]);

	const runDelete = useCallback(async () => {
		if (!authToken) return;
		if (!deletePassword) return ShowAlert(t.passwordRequired, 'Error');
		closeDeletePrompt();
		setDeleting(true);
		try {
			const res = await deleteAccount(deletePassword, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.deleteFailed, 'Error');
				return;
			}
			ShowAlert(getApiMessage(body) || t.deleted, 'Success');
			setDeletePassword('');
			// The login is gone; drop the session and return to sign-in.
			await handleLogout();
		} catch (e) {
			console.error('[ProfileScreen] delete failed', e);
			ShowAlert(t.deleteFailed, 'Error');
		} finally {
			setDeleting(false);
		}
	}, [
		authToken,
		closeDeletePrompt,
		deletePassword,
		handleLogout,
		t.deleteFailed,
		t.deleted,
		t.passwordRequired,
	]);

	const passwordTyped = Boolean(
		currentPassword && newPassword && confirmPassword
	);

	const deleteButtons: PromptButton[] = [
		{
			title: buttons.cancel,
			color: cancelButton,
			textColor: white,
			action: closeDeletePrompt,
		},
		{
			title: t.deleteConfirm,
			color: dangerButton,
			textColor: white,
			action: () => {
				void runDelete();
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
					id='profile-header-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<ScreenHeader
						id='profile-header'
						title={t.title}
						description={t.description}
						loading={loading}
					>
						{profile ? (
							<View style={styles.statusRow}>
								{/* KYC state is the one thing the form below cannot show, so it
								    stays — as a status chip, not a repeat of the fields. */}
								<View
									style={[
										styles.statusChip,
										{
											borderColor: profile.documents_verified
												? verifiedColor
												: lightBorder,
											backgroundColor: profile.documents_verified
												? `${verifiedColor}1A`
												: lightGreyFill,
										},
									]}
								>
									<ThemedText
										style={[
											styles.statusText,
											{
												color: profile.documents_verified
													? verifiedColor
													: mutedText,
											},
										]}
										lightColor={
											profile.documents_verified ? verifiedColor : mutedText
										}
										darkColor={
											profile.documents_verified ? verifiedColor : mutedText
										}
									>
										{profile.documents_verified
											? t.documentsVerified
											: t.documentsNotVerified}
									</ThemedText>
								</View>

								{/* The documents themselves are uploaded and reviewed there, so
								    the status always has a way through to them. */}
								<ThemedButton
									title={t.manageDocuments}
									icon='documents'
									onPress={() => router.push('/(authenticated)/documents' as never)}
									numberOfLines={1}
									style={styles.pillButton}
									lightColor={bim}
									darkColor={bim}
									lightTextColor={white}
									darkTextColor={white}
									iconColor={white}
									textStyle={styles.actionText}
								/>
							</View>
						) : null}
					</ScreenHeader>
				</TileContainer>

				<TileContainer
					id='profile-content-tile'
					flat
					backgroundColor={background}
					style={styles.content}
				>

					<RecordList
						id='profile-details'
						title={t.details}
						description={t.detailsDesc}
						isEmpty={false}
						// The gender menu is absolutely positioned inside this section, so it
						// must paint above the sections below it while open.
						style={openDropdown === 'gender' ? styles.raised : undefined}
					>
						<View style={styles.avatarRow}>
							<AvatarImage uri={avatarPreset?.url} size={72} alt={t.avatar} />
							<View style={styles.avatarCopy}>
								<ThemedText
									style={[styles.hint, { color: mutedText }]}
									lightColor={mutedText}
									darkColor={mutedText}
								>
									{avatarPreset?.label ?? t.avatarHint}
								</ThemedText>
								<ThemedButton
									title={t.changeAvatar}
									icon='edit.outline'
									onPress={() => {
										avatarFade.setValue(1);
										setShowAvatarPicker(true);
									}}
									numberOfLines={1}
									style={styles.inlineButton}
									lightColor='transparent'
									darkColor='transparent'
									lightTextColor={bim}
									darkTextColor={bim}
									textStyle={styles.actionText}
								/>
							</View>
						</View>

						<ThemedInput
							label={t.fullName}
							placeholder={t.fullName}
							value={fullName}
							setValue={setFullName}
						/>
						<ThemedInput
							label={t.email}
							placeholder={t.email}
							keyboardType='email-address'
							autoCapitalize='none'
							value={email}
							setValue={setEmail}
						/>
						<ThemedInput
							label={t.phone}
							placeholder='+256 700 000000'
							keyboardType='phone-pad'
							value={phone}
							setValue={setPhone}
						/>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.phoneHint}
						</ThemedText>

						<ThemedDropdown
							id='profile-gender'
							containerRef={genderRef}
							label={t.gender}
							placeholder={t.gender}
							options={genderOptions}
							value={genderLabel}
							setValue={(value) => setGenderLabel(String(value))}
							showDropdown={openDropdown === 'gender'}
							setShowDropdown={(open) => setOpenDropdown(open ? 'gender' : null)}
							openDirection='down'
						/>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.genderHint}
						</ThemedText>

						<ThemedInput
							label={t.notificationEmail}
							placeholder={translateWithVariables(t.notificationEmailPlaceholder, {
								email: profile?.email ?? '',
							})}
							keyboardType='email-address'
							autoCapitalize='none'
							value={notificationEmail}
							setValue={setNotificationEmail}
						/>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.notificationEmailHint}
						</ThemedText>

						<View style={styles.actions}>
							<ThemedButton
								title={t.save}
								icon='check'
								onPress={() => {
									void saveProfile();
								}}
								loading={saving}
								disabled={saving}
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
						id='profile-password'
						title={t.password}
						description={t.passwordDesc}
						isEmpty={false}
					>
						<ThemedInput
							label={t.currentPassword}
							placeholder='••••••••'
							secureTextEntry
							value={currentPassword}
							setValue={setCurrentPassword}
						/>
						<ThemedInput
							label={t.newPassword}
							placeholder='••••••••'
							secureTextEntry
							value={newPassword}
							setValue={setNewPassword}
						/>
						<ThemedInput
							label={t.confirmPassword}
							placeholder='••••••••'
							secureTextEntry
							value={confirmPassword}
							setValue={setConfirmPassword}
						/>

						<View style={styles.actions}>
							<ThemedButton
								title={t.updatePassword}
								icon='check'
								onPress={() => {
									void submitPassword();
								}}
								loading={savingPassword}
								disabled={!passwordTyped || savingPassword}
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
						id='profile-delete'
						title={t.deleteAccount}
						description={t.deleteDesc}
						isEmpty={false}
					>
						<ThemedInput
							label={t.passwordLabel}
							placeholder='••••••••'
							secureTextEntry
							value={deletePassword}
							setValue={setDeletePassword}
						/>

						<View style={styles.actions}>
							<ThemedButton
								title={t.deleteAction}
								icon='delete.outline'
								onPress={() => {
									if (!deletePassword) {
										ShowAlert(t.passwordRequired, 'Error');
										return;
									}
									deleteFade.setValue(1);
									setShowDeletePrompt(true);
								}}
								loading={deleting}
								disabled={deleting}
								numberOfLines={1}
								style={styles.actionButton}
								lightColor={dangerButton}
								darkColor={dangerButton}
								lightTextColor={white}
								darkTextColor={white}
								iconColor={white}
								textStyle={styles.actionText}
							/>
						</View>
					</RecordList>
				</TileContainer>
			</ParallaxScrollView>

			<AvatarPickerOverlay
				visible={showAvatarPicker}
				fadeAnim={avatarFade}
				groups={groups}
				selected={avatar}
				onClose={() => {
					avatarFade.setValue(0);
					setShowAvatarPicker(false);
				}}
				onSelect={(id) => {
					setAvatar(id);
					avatarFade.setValue(0);
					setShowAvatarPicker(false);
				}}
			/>

			<Prompt
				id='profile-delete-prompt'
				fadeAnim={deleteFade}
				visible={showDeletePrompt}
				onClose={closeDeletePrompt}
				title={t.deleteTitle}
				message={t.deleteMessage}
				buttons={deleteButtons}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	content: {
		width: '100%',
		gap: 12,
	},
	/** Lifts the section owning the open dropdown above the sections below it. */
	raised: {
		zIndex: 20,
		elevation: 20,
	},
	summaryAvatar: {
		flexDirection: 'row',
		justifyContent: 'flex-start',
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 10,
	},
	statusChip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	/** A compact pill, so the link lines up with the status chip beside it. */
	pillButton: {
		flexShrink: 0,
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: 999,
	},
	statusText: {
		fontSize: fontSize['text.xsmall'],
		fontWeight: fontWeight['button.small'],
	},
	avatarRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	avatarCopy: {
		flexShrink: 1,
		gap: 2,
	},
	/** A link that hugs its label instead of stretching across the row. */
	inlineButton: {
		alignSelf: 'flex-start',
		paddingVertical: 4,
		paddingHorizontal: 0,
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
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
	},
});
