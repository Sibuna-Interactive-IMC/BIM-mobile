import OverlayContainer from '@/components/OverlayContainer';
import ThemedFilePicker from '@/components/ThemedFilePicker';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, formatDateTime, ShowAlert, translateWithVariables } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
	deleteDisbursementDocument,
	downloadDisbursementDocument,
	fetchDisbursementDocuments,
	uploadDisbursementDocument,
} from '@/services/AccountsService';
import type {
	DisbursementDocument,
	DisbursementDocumentType,
	DisbursementDocumentsPayload,
	DisbursementRecord,
	UploadedDisbursementDocumentPayload,
} from '@/types';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Image,
	Linking,
	Platform,
	StyleSheet,
	View,
} from 'react-native';

const DOCUMENT_TYPES: DisbursementDocumentType[] = [
	'receipt',
	'invoice',
	'screenshot',
];

const MIME_BY_EXTENSION: Record<string, string> = {
	pdf: 'application/pdf',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function mimeForName(name: string) {
	const extension = name.split('.').pop()?.toLowerCase() ?? '';
	return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function isImage(doc: DisbursementDocument) {
	return doc.is_image ?? (doc.mime_type ?? '').startsWith('image/');
}

function isPdf(doc: DisbursementDocument) {
	return doc.is_pdf ?? doc.mime_type === 'application/pdf';
}

/** The API serves documents behind the bearer token, so previews are inlined. */
function blobToDataUri(blob: Blob): Promise<string> {
	if (typeof FileReader === 'undefined') return Promise.resolve('');
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

/** Supporting documents on one disbursement record: upload, preview, delete. */
export default function DisbursementDocumentsOverlay({
	visible,
	fadeAnim,
	authToken,
	record,
	onClose,
	onChanged,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	record: DisbursementRecord | null;
	onClose: () => void;
	onChanged: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.disbursements;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const chip = useThemeColor({}, 'listItemBackground');
	const border = useThemeColor({}, 'borderDark');
	const danger = useThemeColor({}, 'dangerButton');

	const [documents, setDocuments] = useState<DisbursementDocument[]>([]);
	const [previews, setPreviews] = useState<Record<string, string>>({});
	const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>(
		{}
	);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [showUpload, setShowUpload] = useState(false);
	const [typeLabel, setTypeLabel] = useState('');
	const [fileUri, setFileUri] = useState('');
	const [fileName, setFileName] = useState('');
	const [pendingDelete, setPendingDelete] = useState<DisbursementDocument | null>(
		null
	);
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);

	const typeRef = useRef<View>(null);
	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	const typeOptions = useMemo(
		() => [
			t.documentTypeReceipt,
			t.documentTypeInvoice,
			t.documentTypeScreenshot,
		],
		[t.documentTypeInvoice, t.documentTypeReceipt, t.documentTypeScreenshot]
	);

	const loadPreview = useCallback(
		async (recordId: string, doc: DisbursementDocument) => {
			if (doc.id === undefined || doc.id === null || !authToken) return;
			const key = String(doc.id);
			setPreviewLoading((prev) => ({ ...prev, [key]: true }));
			try {
				const res = await downloadDisbursementDocument(
					recordId,
					doc.id,
					authToken
				);
				if (!res.ok) return;
				const dataUri = await blobToDataUri(await res.blob());
				if (dataUri) setPreviews((prev) => ({ ...prev, [key]: dataUri }));
			} catch (e) {
				console.error('[DisbursementDocumentsOverlay] preview failed', e);
			} finally {
				setPreviewLoading((prev) => ({ ...prev, [key]: false }));
			}
		},
		[authToken]
	);

	const loadDocuments = useCallback(async () => {
		if (!authToken || !record) return;
		setLoading(true);
		try {
			const res = await fetchDisbursementDocuments(record.id, authToken);
			if (!res.ok) {
				setDocuments([]);
				return;
			}
			const body: DisbursementDocumentsPayload = await res.json();
			const list = body.documents ?? body.data?.documents ?? [];
			setDocuments(list);
			list.filter((doc) => isImage(doc)).forEach((doc) => {
				void loadPreview(record.id, doc);
			});
		} catch (e) {
			console.error('[DisbursementDocumentsOverlay] load failed', e);
			setDocuments([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, loadPreview, record]);

	useEffect(() => {
		if (!visible) return;
		setShowUpload(false);
		setPendingDelete(null);
		setPreviews({});
		setFileUri('');
		setFileName('');
		setTypeLabel(typeOptions[0] ?? '');
		void loadDocuments();
		// Seeding the form should only happen when the overlay opens.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible, record?.id]);

	const openDocument = useCallback(
		async (doc: DisbursementDocument) => {
			if (!record || !authToken || doc.id === undefined || doc.id === null) {
				return;
			}
			try {
				const cached = previews[String(doc.id)];
				let target = cached;
				if (!target) {
					const res = await downloadDisbursementDocument(
						record.id,
						doc.id,
						authToken
					);
					if (!res.ok) throw new Error(`status ${res.status}`);
					const blob = await res.blob();
					// Browsers block top-level `data:` navigation, so the web build
					// opens an object URL instead.
					target =
						Platform.OS === 'web' &&
						typeof URL !== 'undefined' &&
						typeof URL.createObjectURL === 'function'
							? URL.createObjectURL(blob)
							: await blobToDataUri(blob);
				}

				if (target) {
					await WebBrowser.openBrowserAsync(target);
					return;
				}
				throw new Error('empty preview');
			} catch (e) {
				console.error('[DisbursementDocumentsOverlay] open failed', e);
				// Fall back to the web route, which works when the browser already
				// holds a bim.sibuna.us session.
				if (doc.url) {
					await Linking.openURL(doc.url).catch(() => undefined);
					return;
				}
				ShowAlert(t.previewFailed, 'Error');
			}
		},
		[authToken, previews, record, t.previewFailed]
	);

	const submitUpload = useCallback(async () => {
		if (!record || !authToken) return;
		if (!fileUri) {
			ShowAlert(t.fileRequired, 'Error');
			return;
		}

		const type =
			DOCUMENT_TYPES[typeOptions.indexOf(typeLabel)] ?? 'receipt';
		const uploadName = fileName || fileUri.split('/').pop() || 'document';

		setSaving(true);
		try {
			const form = new FormData();
			form.append('type', type);
			if (Platform.OS === 'web') {
				const blob = await fetch(fileUri).then((res) => res.blob());
				const webFile = new (globalThis as any).File([blob], uploadName, {
					type: blob.type || mimeForName(uploadName),
				});
				form.append('file', webFile);
			} else {
				form.append('file', {
					uri: fileUri,
					name: uploadName,
					type: mimeForName(uploadName),
				} as any);
			}

			const res = await uploadDisbursementDocument(record.id, form, authToken);
			const body: UploadedDisbursementDocumentPayload = await res
				.json()
				.catch(() => ({}));
			if (!res.ok || body.success === false) {
				ShowAlert(body.message || t.uploadFailed, 'Error');
				return;
			}
			ShowAlert(t.uploaded, 'Success');
			setShowUpload(false);
			setFileUri('');
			setFileName('');
			await loadDocuments();
			onChanged();
		} catch (e) {
			console.error('[DisbursementDocumentsOverlay] upload failed', e);
			ShowAlert(t.uploadFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		authToken,
		fileName,
		fileUri,
		loadDocuments,
		onChanged,
		record,
		t.fileRequired,
		t.uploadFailed,
		t.uploaded,
		typeLabel,
		typeOptions,
	]);

	const runDelete = useCallback(async () => {
		if (!record || !authToken || !pendingDelete?.id) return;
		setSaving(true);
		try {
			const res = await deleteDisbursementDocument(
				record.id,
				pendingDelete.id,
				authToken
			);
			if (!res.ok) {
				ShowAlert(t.deleteDocumentFailed, 'Error');
				return;
			}
			ShowAlert(t.documentDeleted, 'Success');
			setPendingDelete(null);
			await loadDocuments();
			onChanged();
		} catch (e) {
			console.error('[DisbursementDocumentsOverlay] delete failed', e);
			ShowAlert(t.deleteDocumentFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		authToken,
		loadDocuments,
		onChanged,
		pendingDelete,
		record,
		t.deleteDocumentFailed,
		t.documentDeleted,
	]);

	const recordLabel = [
		record?.transaction?.router?.name || record?.transaction?.router_name,
		record?.transaction?.amount !== undefined
			? formatAmount(Math.abs(Number(record.transaction.amount)), 0)
			: undefined,
		record?.created_at ? formatDateTime(record.created_at) : undefined,
	]
		.filter(Boolean)
		.join(' · ');

	return (
		<OverlayContainer
			id='disbursement-documents'
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
						{t.documentsTitle}
					</ThemedText>
					{loading || saving ? (
						<ActivityIndicator size='small' color={bim} />
					) : null}
				</View>
				{recordLabel ? (
					<ThemedText
						style={[styles.hint, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
						numberOfLines={1}
					>
						{recordLabel}
					</ThemedText>
				) : null}

				{showUpload ? (
					<View style={styles.section}>
						<ThemedDropdown
							id='disbursement-document-type'
							containerRef={typeRef}
							label={t.documentType}
							placeholder={t.documentType}
							options={typeOptions}
							value={typeLabel}
							setValue={setTypeLabel}
							showDropdown={openDropdown === 'type'}
							setShowDropdown={(open) => setOpenDropdown(open ? 'type' : null)}
							openDirection='down'
						/>
						<ThemedFilePicker
							label={t.file}
							placeholder={t.file}
							value={fileUri}
							fileName={fileName}
							setValue={setFileUri}
							setFileName={setFileName}
							accept={['pdf', 'png', 'jpg', 'doc', 'docx', 'xls', 'xlsx']}
							style={fields}
						/>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.uploadHint}
						</ThemedText>
						<View style={styles.actions}>
							<ThemedButton
								title={buttons.cancel}
								onPress={() => setShowUpload(false)}
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
								title={t.uploadDocument}
								icon='plus'
								onPress={() => {
									void submitUpload();
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
					</View>
				) : (
					<ThemedButton
						title={t.uploadDocument}
						icon='plus'
						onPress={() => setShowUpload(true)}
						numberOfLines={1}
						lightColor={bim}
						darkColor={bim}
						lightTextColor={white}
						darkTextColor={white}
						textStyle={styles.actionText}
					/>
				)}

				{loading && documents.length === 0 ? (
					<ThemedText
						style={[styles.empty, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{translations[language].categories.dashboard.loading}
					</ThemedText>
				) : documents.length === 0 ? (
					<ThemedText
						style={[styles.empty, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{t.noDocumentsYet}
					</ThemedText>
				) : (
					documents.map((doc) => {
						const key = String(doc.id);
						const preview = previews[key];
						const name = doc.file_name || doc.name || '—';
						const meta = [doc.type_label || doc.type, doc.size, doc.created_at]
							.filter(Boolean)
							.join(' · ');

						return (
							<View
								key={key}
								id={`document-${key}`}
								style={[
									styles.document,
									{ backgroundColor: chip, borderColor: border },
								]}
							>
								{isImage(doc) ? (
									preview ? (
										<Image
											source={{ uri: preview }}
											style={styles.preview}
											resizeMode='cover'
										/>
									) : (
										<View style={styles.preview}>
											{previewLoading[key] ? (
												<ActivityIndicator size='small' color={bim} />
											) : null}
										</View>
									)
								) : (
									<View style={styles.preview}>
										<ThemedText
											style={[styles.fileKind, { color: mutedText }]}
											lightColor={mutedText}
											darkColor={mutedText}
										>
											{isPdf(doc)
												? 'PDF'
												: (name.split('.').pop() || 'FILE').toUpperCase()}
										</ThemedText>
									</View>
								)}

								<ThemedText
									style={[styles.fileName, { color: screenTitleText }]}
									lightColor={screenTitleText}
									darkColor={screenTitleText}
									numberOfLines={1}
								>
									{name}
								</ThemedText>
								<ThemedText
									style={[styles.hint, { color: mutedText }]}
									lightColor={mutedText}
									darkColor={mutedText}
									numberOfLines={1}
								>
									{meta}
								</ThemedText>

								<View style={styles.actions}>
									<ThemedButton
										title={t.open}
										icon='eye.outline'
										onPress={() => {
											void openDocument(doc);
										}}
										numberOfLines={1}
										style={styles.actionButton}
										lightColor={bim}
										darkColor={bim}
										lightTextColor={white}
										darkTextColor={white}
										iconColor={white}
										textStyle={styles.actionText}
									/>
									<ThemedButton
										title={
											pendingDelete?.id === doc.id
												? buttons.confirm
												: buttons.delete
										}
										icon='delete.outline'
										onPress={() =>
											pendingDelete?.id === doc.id
												? void runDelete()
												: setPendingDelete(doc)
										}
										disabled={saving}
										numberOfLines={1}
										style={styles.actionButton}
										lightColor={danger}
										darkColor={danger}
										lightTextColor={white}
										darkTextColor={white}
										iconColor={white}
										textStyle={styles.actionText}
									/>
								</View>
								{pendingDelete?.id === doc.id ? (
									<>
										<ThemedText
											style={[styles.hint, { color: mutedText }]}
											lightColor={mutedText}
											darkColor={mutedText}
										>
											{translateWithVariables(t.deleteDocumentMessage, {
												name,
											})}
										</ThemedText>
										<ThemedButton
											title={buttons.cancel}
											onPress={() => setPendingDelete(null)}
											numberOfLines={1}
											style={styles.actionButton}
											lightColor={cancelButton}
											darkColor={cancelButton}
											lightTextColor={white}
											darkTextColor={white}
											textStyle={styles.actionText}
										/>
									</>
								) : null}
							</View>
						);
					})
				)}

				<View style={styles.actions}>
					<ThemedButton
						title={buttons.close}
						onPress={onClose}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={cancelButton}
						darkColor={cancelButton}
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
	section: {
		gap: 10,
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 15,
	},
	empty: {
		fontSize: fontSize['text.medium'],
		paddingVertical: 8,
	},
	document: {
		borderWidth: 1,
		borderRadius: 10,
		padding: 10,
		gap: 6,
	},
	preview: {
		width: '100%',
		height: 140,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	fileKind: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	fileName: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['button.small'],
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 4,
	},
	actionButton: {
		minWidth: 96,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
