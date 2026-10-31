import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, ShowAlert } from '@/helpers';
import { getApiData, getApiMessage, getApiPagination } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { deleteAdminUser, fetchAdminUsers } from '@/services/AdminUserService';
import type { GetAdminUsersResponse, ManagedUser, PromptButton } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Animated,
	StyleSheet,
	useAnimatedValue,
	View,
} from 'react-native';

import AdminUserFormOverlay from '@/views/AdminUserFormOverlay';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

/** `GET /admin/users` — logins, their platform role and account seats (admin only). */
export default function AdminUsersScreen() {
	useTrackHistory('/(authenticated)/admin-users');
	useAccountsBack();
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.adminUsers;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');

	const [users, setUsers] = useState<ManagedUser[]>([]);
	const [search, setSearch] = useState('');
	const [searchTerm, setSearchTerm] = useState('');
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<ManagedUser | null>(null);
	const [deleting, setDeleting] = useState<number | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<ManagedUser | null>(null);
	const formFadeAnim = useAnimatedValue(0);
	const promptFadeAnim = useAnimatedValue(0);
	const [showPrompt, setShowPrompt] = useState(false);
	const confirmRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		const timer = setTimeout(
			() => setSearchTerm(search.trim()),
			SEARCH_DEBOUNCE_MS
		);
		return () => clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		setPage(1);
	}, [searchTerm]);

	const loadUsers = useCallback(async () => {
		if (!authToken || !isAdmin) return;
		setLoading(true);
		try {
			const res = await fetchAdminUsers(authToken, {
				q: searchTerm || undefined,
				page,
				perPage: PAGE_SIZE,
			});
			if (!res.ok) {
				setUsers([]);
				return;
			}
			const body: GetAdminUsersResponse = await res.json();
			setUsers(
				getApiData<NonNullable<GetAdminUsersResponse['data']>>(body)?.users ?? []
			);
			setLastPage(Math.max(1, getApiPagination(body, 'users')?.last_page ?? 1));
		} catch (e) {
			console.error('[AdminUsersScreen] loadUsers failed', e);
			setUsers([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, isAdmin, page, searchTerm]);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadUsers();
		} finally {
			setRefreshing(false);
		}
	}, [loadUsers]);

	const seatsFor = (managed: ManagedUser) => {
		const accounts = managed.accounts ?? [];
		if (!accounts.length) return t.noAccounts;
		return accounts
			.map((account) =>
				account.pivot?.role
					? `${account.name} (${account.pivot.role})`
					: account.name
			)
			.join(', ');
	};

	const isSelf = useCallback(
		(managed: ManagedUser) => String(managed.id) === String(user?.id),
		[user?.id]
	);

	const runDelete = useCallback(async () => {
		const target = pendingDelete;
		if (!target || !authToken) return;
		setDeleting(target.id);
		try {
			const res = await deleteAdminUser(target.id, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.deleteFailed, 'Error');
				return;
			}
			ShowAlert(t.deleted, 'Success');
			await loadUsers();
		} catch (e) {
			console.error('[AdminUsersScreen] delete failed', e);
			ShowAlert(t.deleteFailed, 'Error');
		} finally {
			setDeleting(null);
		}
	}, [authToken, loadUsers, pendingDelete, t.deleteFailed, t.deleted]);

	const closePrompt = useCallback(() => {
		promptFadeAnim.setValue(0);
		setShowPrompt(false);
		setPendingDelete(null);
		confirmRef.current = null;
	}, [promptFadeAnim]);

	const confirmDelete = useCallback(
		(managed: ManagedUser) => {
			setPendingDelete(managed);
			promptFadeAnim.setValue(1);
			setShowPrompt(true);
		},
		[promptFadeAnim]
	);

	const openCreate = useCallback(() => {
		setEditing(null);
		Animated.timing(formFadeAnim, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowForm(true));
	}, [formFadeAnim]);

	const openEdit = useCallback(
		(managed: ManagedUser) => {
			setEditing(managed);
			Animated.timing(formFadeAnim, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start(() => setShowForm(true));
		},
		[formFadeAnim]
	);

	const closeForm = useCallback(() => {
		Animated.timing(formFadeAnim, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true,
		}).start(() => setShowForm(false));
	}, [formFadeAnim]);

	const promptButtons: PromptButton[] = [
		{
			title: buttons.cancel,
			color: cancelButton,
			textColor: white,
			action: closePrompt,
		},
		{
			title: buttons.delete,
			color: dangerButton,
			textColor: white,
			action: () => {
				const run = async () => {
					await runDelete();
					closePrompt();
				};
				void run();
			},
		},
	];

	const fieldsFor = (managed: ManagedUser): RecordField[] => [
		{ label: t.email, value: managed.email || '—' },
		{ label: t.phone, value: managed.phone || '—' },
		{
			label: t.platformRole,
			value: managed.role?.display_name || managed.role?.name || t.noPlatformRole,
			tone: managed.role ? 'info' : 'muted',
		},
		{
			label: t.phoneStatus,
			value: managed.phone_verified_at ? t.verified : t.notVerified,
			tone: managed.phone_verified_at ? 'success' : 'warning',
		},
		{ label: t.accountSeats, value: seatsFor(managed), fullWidth: true },
		{
			label: t.lastActivity,
			value: formatDateTime(managed.last_activity_at),
			fullWidth: true,
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
				id='admin-users-tile'
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
					{isAdmin ? (
						<ThemedButton
							style={styles.headerButton}
							title={t.createUser}
							icon='plus'
							numberOfLines={1}
							onPress={openCreate}
							lightColor={bim}
							darkColor={bim}
							lightTextColor={white}
							darkTextColor={white}
							iconColor={white}
							textStyle={styles.headerButtonText}
						/>
					) : null}
				</View>
				<ThemedText
					style={[styles.description, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{isAdmin ? t.description : t.adminOnly}
				</ThemedText>

				{isAdmin ? (
					<>
						<ThemedInput
							containerStyle={styles.searchInput}
							value={search}
							setValue={setSearch}
							placeholder={t.searchPlaceholder}
							returnKeyType='search'
						/>

						<RecordList
							id='admin-users-list'
							loading={loading && users.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && users.length === 0}
							emptyMessage={t.noUsers}
						>
							{users.map((managed) => (
								<RecordCard
									key={managed.id}
									id={`admin-user-${managed.id}`}
									title={managed.name}
									fields={fieldsFor(managed)}
									actions={[
										{
											label: t.editUser,
											icon: 'edit.outline',
											tone: 'warning',
											disabled: deleting !== null,
											onPress: () => openEdit(managed),
										},
										...(isSelf(managed)
											? []
											: [
													{
														label: buttons.delete,
														icon: 'delete.outline' as const,
														tone: 'danger' as const,
														loading: deleting === managed.id,
														disabled: deleting !== null,
														onPress: () => confirmDelete(managed),
													},
												]),
									]}
								/>
							))}
						</RecordList>

						{users.length > 0 ? (
							<ListPagination
								id='admin-users-pagination'
								page={page}
								lastPage={lastPage}
								onPrev={() =>
									setPage((current) => Math.max(1, current - 1))
								}
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
			id='admin-user-delete-prompt'
			fadeAnim={promptFadeAnim}
			visible={showPrompt}
			onClose={closePrompt}
			title={t.deleteConfirmTitle}
			message={t.deleteConfirmMessage}
			buttons={promptButtons}
		/>

		<AdminUserFormOverlay
			visible={showForm}
			fadeAnim={formFadeAnim}
			authToken={authToken ?? undefined}
			editing={editing}
			onClose={closeForm}
			onSaved={() => {
				void loadUsers();
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
	description: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
	searchInput: {
		width: '100%',
	},
	headerButton: {
		flexShrink: 0,
	},
	headerButtonText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
