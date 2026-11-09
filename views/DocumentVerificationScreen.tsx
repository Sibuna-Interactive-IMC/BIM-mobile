import ListPagination from '@/components/ListPagination';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordBadge, RecordField, RecordTone } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage, getApiPagination } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	approveDocument,
	deleteDocument,
	downloadDocumentFile,
	fetchAdminDocuments,
	rejectDocument,
} from '@/services/DocumentVerificationService';
import type {
	AdminDocument,
	DocumentStatus,
	GetAdminDocumentsResponse,
	PromptButton,
} from '@/types';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, useAnimatedValue, View } from 'react-native';

const PAGE_SIZE = 20;

const STATUS_TONES: Record<DocumentStatus, RecordTone> = {
	pending: 'warning',
	approved: 'success',
	rejected: 'danger',
};

/** The document types stored by the `documents.type` enum. */
const DOCUMENT_TYPES = [
	'National ID',
	'Passport',
	'Certificate of Incorporation',
	'Articles of Association',
	'TIN Certificate',
] as const;

type PendingAction = {
	kind: 'approve' | 'reject' | 'delete';
	document: AdminDocument;
};

/**
 * `GET /admin/documents` — admin review of every document an owner uploaded.
 *
 * Approving a document also marks its owner documents-verified. Rejection changes
 * the document outcome without clearing an owner's existing verification.
 */
export default function DocumentVerificationScreen() {
	useTrackHistory('/(authenticated)/document-verification');
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.documentVerification;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const danger = useThemeColor({}, 'error');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');

	const [documents, setDocuments] = useState<AdminDocument[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const [search, setSearch] = useState('');
	const [statusLabel, setStatusLabel] = useState('');
	const [typeLabel, setTypeLabel] = useState('');
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const statusRef = useRef<View>(null);
	const typeRef = useRef<View>(null);

	/** The filters the request actually used, so paging does not drop them. */
	const [applied, setApplied] = useState<{
		q?: string;
		status?: DocumentStatus;
		type?: string;
	}>({});

	const [openFileId, setOpenFileId] = useState<string | null>(null);
	const [pending, setPending] = useState<PendingAction | null>(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const [acting, setActing] = useState(false);
	const promptFade = useAnimatedValue(0);

	const statusOptions = useMemo(
		() => [t.anyStatus, t.statusPending, t.statusApproved, t.statusRejected],
		[t.anyStatus, t.statusApproved, t.statusPending, t.statusRejected]
	);

	const typeOptions = useMemo(
		() => [t.anyType, ...DOCUMENT_TYPES],
		[t.anyType]
	);

	const statusValue: DocumentStatus | '' =
		statusLabel === t.statusPending
			? 'pending'
			: statusLabel === t.statusApproved
				? 'approved'
				: statusLabel === t.statusRejected
					? 'rejected'
					: '';

	const load = useCallback(
		async (
			nextPage: number,
			filters: { q?: string; status?: DocumentStatus; type?: string }
		) => {
			if (!authToken || !isAdmin) return;
			setLoading(true);
			try {
				const res = await fetchAdminDocuments(authToken, {
					page: nextPage,
					perPage: PAGE_SIZE,
					...filters,
				});
				const body: GetAdminDocumentsResponse = await res.json().catch(() => null);
				if (!res.ok) {
					ShowAlert(getApiMessage(body) || t.loadFailed, 'Error');
					setDocuments([]);
					return;
				}
				const payload = getApiData<
					NonNullable<GetAdminDocumentsResponse['data']>
				>(body);
				setDocuments(payload?.documents ?? []);
				const meta = getApiPagination(body, 'documents');
				setPage(meta?.current_page ?? nextPage);
				setLastPage(Math.max(1, meta?.last_page ?? 1));
				setTotal(meta?.total ?? payload?.documents?.length ?? 0);
			} catch (e) {
				console.error('[DocumentVerificationScreen] load failed', e);
				ShowAlert(t.loadFailed, 'Error');
				setDocuments([]);
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
		const next = {
			q: search.trim() || undefined,
			status: (statusValue || undefined) as DocumentStatus | undefined,
			type: typeLabel || undefined,
		};
		setApplied(next);
		void load(1, next);
	}, [load, search, statusValue, typeLabel]);

	const clearFilters = useCallback(() => {
		setSearch('');
		setStatusLabel('');
		setTypeLabel('');
		setApplied({});
		void load(1, {});
	}, [load]);

	const hasFilters = Boolean(
		applied.q || applied.status || applied.type
	);

	const closePrompt = useCallback(() => {
		promptFade.setValue(0);
		setShowPrompt(false);
		setPending(null);
	}, [promptFade]);

	/** Read the file with the bearer token, then hand it to a viewer. */
	const openFile = useCallback(
		async (document: AdminDocument) => {
			if (!authToken) return;
			setOpenFileId(document.id);
			try {
				const res = await downloadDocumentFile(document.id, authToken);
				if (!res.ok) throw new Error(`status ${res.status}`);
				const blob = await res.blob();
				const target =
					Platform.OS === 'web' &&
					typeof URL !== 'undefined' &&
					typeof URL.createObjectURL === 'function'
						? URL.createObjectURL(blob)
						: await blobToDataUri(blob);
				if (!target) throw new Error('empty file');
				await WebBrowser.openBrowserAsync(target);
			} catch (e) {
				console.error('[DocumentVerificationScreen] open file failed', e);
				ShowAlert(t.openFailed, 'Error');
			} finally {
				setOpenFileId(null);
			}
		},
		[authToken, t.openFailed]
	);

	const runPending = useCallback(async () => {
		if (!authToken || !pending) return;
		const document = pending.document;
		closePrompt();
		setActing(true);
		try {
			const action =
				pending.kind === 'approve'
					? approveDocument
					: pending.kind === 'reject'
						? rejectDocument
						: deleteDocument;
			const res = await action(document.id, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				const errorMessage =
					pending.kind === 'approve'
						? t.approveFailed
						: pending.kind === 'reject'
							? t.rejectFailed
							: t.deleteFailed;
				ShowAlert(
					getApiMessage(body) || errorMessage,
					'Error'
				);
				return;
			}

			const successMessage =
				pending.kind === 'approve'
					? t.approved
					: pending.kind === 'reject'
						? t.rejected
						: t.deleted;
			ShowAlert(
				getApiMessage(body) || successMessage,
				'Success'
			);
			await load(page, applied);
		} catch (e) {
			console.error(
				`[DocumentVerificationScreen] ${pending.kind} failed`,
				e
			);
			const errorMessage =
				pending.kind === 'approve'
					? t.approveFailed
					: pending.kind === 'reject'
						? t.rejectFailed
						: t.deleteFailed;
			ShowAlert(
				errorMessage,
				'Error'
			);
		} finally {
			setActing(false);
		}
	}, [
		applied,
		authToken,
		closePrompt,
		load,
		page,
		pending,
		t.approved,
		t.approveFailed,
		t.deleteFailed,
		t.deleted,
		t.rejectFailed,
		t.rejected,
	]);

	const fieldsOf = (document: AdminDocument): RecordField[] => {
		const owner = document.user;
		return [
			{
				label: t.owner,
				value: owner
					? `${owner.name ?? ''}${owner.email ? ` · ${owner.email}` : owner.phone ? ` · ${owner.phone}` : ''}`
					: t.deletedOwner,
				fullWidth: true,
			},
			{ label: t.number, value: document.number || '—' },
			{ label: t.uploaded, value: formatDateTime(document.created_at) },
			{
				label: t.ownerVerification,
				value: owner?.documents_verified ? t.verified : t.notVerified,
				tone: owner?.documents_verified ? 'success' : 'muted',
				fullWidth: true,
			},
		];
	};

	const badgeOf = (document: AdminDocument): RecordBadge => ({
		label: document.file_missing
			? t.fileMissing
			: document.status === 'pending'
				? t.statusPending
				: document.status === 'approved'
					? t.statusApproved
					: t.statusRejected,
		tone: document.file_missing
			? 'danger'
			: STATUS_TONES[document.status] ?? 'muted',
	});

	const promptButtons: PromptButton[] = [
		{
			title: buttons.cancel,
			color: cancelButton,
			textColor: white,
			action: closePrompt,
		},
		{
			title: t.confirm,
			color: pending?.kind === 'delete' ? danger : bim,
			textColor: white,
			action: () => {
				void runPending();
			},
		},
	];

	const prompt = {
		title:
			pending?.kind === 'delete'
				? t.deleteTitle
				: pending?.kind === 'reject'
					? t.rejectTitle
					: t.approveTitle,
		message: translateWithVariables(
			pending?.kind === 'delete'
				? t.deleteMessage
				: pending?.kind === 'reject'
					? t.rejectMessage
					: t.approveMessage,
			{
				type: pending?.document.type ?? '',
				owner: pending?.document.user?.name ?? t.deletedOwner,
			}
		),
	};

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
					id='document-verification-header-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<ScreenHeader
						id='document-verification-header'
						title={t.title}
						description={isAdmin ? t.description : t.adminOnly}
						loading={loading}
					/>
				</TileContainer>

				{isAdmin ? (
					<TileContainer
						id='document-verification-tile'
						flat
						backgroundColor={background}
						style={styles.section}
					>
						<RecordList
							id='document-verification-filters'
							isEmpty={false}
							// The filter menus are absolutely positioned inside this
							// section, so it must paint above the list below it.
							style={
								openDropdown === 'status' || openDropdown === 'type'
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
								id='document-verification-status'
								containerRef={statusRef}
								label={t.status}
								placeholder={t.anyStatus}
								options={statusOptions}
								value={statusLabel || t.anyStatus}
								setValue={(value) =>
									setStatusLabel(value === t.anyStatus ? '' : String(value))
								}
								showDropdown={openDropdown === 'status'}
								setShowDropdown={(open) =>
									setOpenDropdown(open ? 'status' : null)
								}
								openDirection='down'
							/>

							<ThemedDropdown
								id='document-verification-type'
								containerRef={typeRef}
								label={t.documentType}
								placeholder={t.anyType}
								options={typeOptions}
								value={typeLabel || t.anyType}
								setValue={(value) =>
									setTypeLabel(value === t.anyType ? '' : String(value))
								}
								showDropdown={openDropdown === 'type'}
								setShowDropdown={(open) => setOpenDropdown(open ? 'type' : null)}
								openDirection='down'
							/>

							<View style={styles.actions}>
								<ThemedButton
									title={t.clear}
									onPress={clearFilters}
									disabled={
										!hasFilters && !search && !statusLabel && !typeLabel
									}
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
							id='document-verification-list'
							title={t.documents}
							description={translateWithVariables(t.documentsCount, {
								count: total,
							})}
							loading={loading && documents.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && documents.length === 0}
							emptyMessage={hasFilters ? t.noMatches : t.noDocuments}
						>
							{documents.map((document) => {
								const owner = document.user;
								// Decisions are available only while a document is pending.
								const canDecide =
									!document.file_missing &&
									Boolean(owner) &&
									document.status === 'pending';
								return (
									<RecordCard
										key={document.id}
										id={`document-${document.id}`}
										title={document.type}
										subtitle={
											owner
												? `${owner.name ?? ''}${owner.email ? ` · ${owner.email}` : ''}`
												: t.deletedOwner
										}
										badge={badgeOf(document)}
										fields={[
											...fieldsOf(document),
											...(document.file_missing
												? [
														{
															label: t.status,
															value:
																document.status === 'pending'
																	? t.statusPending
																	: document.status === 'approved'
																		? t.statusApproved
																		: t.statusRejected,
															tone: STATUS_TONES[document.status],
															fullWidth: true,
														},
													]
												: []),
										]}
										actions={[
											...(!document.file_missing
												? [
														{
															label: t.view,
															icon: 'eye.outline' as const,
															tone: 'primary' as const,
															loading: openFileId === document.id,
															onPress: () => {
																void openFile(document);
															},
														},
													]
												: []),
											...(canDecide
												? [
														{
															label: t.approve,
															icon: 'check' as const,
															tone: 'success' as const,
															disabled: acting,
															onPress: () => {
																setPending({ kind: 'approve', document });
																promptFade.setValue(1);
																setShowPrompt(true);
															},
														},
														{
															label: t.reject,
															icon: 'close' as const,
															tone: 'danger' as const,
															disabled: acting,
															onPress: () => {
																setPending({ kind: 'reject', document });
																promptFade.setValue(1);
																setShowPrompt(true);
															},
														},
													]
												: []),
											{
												label: t.delete,
												icon: 'delete.outline',
												tone: 'danger',
												disabled: acting,
												onPress: () => {
													setPending({ kind: 'delete', document });
													promptFade.setValue(1);
													setShowPrompt(true);
												},
											},
										]}
									/>
								);
							})}

							{lastPage > 1 ? (
								<ListPagination
									id='document-verification-pagination'
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

			<Prompt
				id='document-verification-prompt'
				fadeAnim={promptFade}
				visible={showPrompt}
				onClose={closePrompt}
				title={prompt.title}
				message={prompt.message}
				buttons={promptButtons}
			/>
		</>
	);
}

/** Turn a fetched file into a `data:` URI, the only way to show it on native. */
async function blobToDataUri(blob: Blob): Promise<string | null> {
	return new Promise((resolve) => {
		try {
			const reader = new FileReader();
			reader.onloadend = () =>
				resolve(typeof reader.result === 'string' ? reader.result : null);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		} catch {
			resolve(null);
		}
	});
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	/** Lifts the section owning the open dropdown above the sections below it. */
	raised: {
		zIndex: 20,
		elevation: 20,
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
