import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import * as factories from '@/helpers/factories';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { DocumentProps } from '@/types';
import DocumentOverlay from '@/views/Document';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';

export default function DocumentsScreen() {
	// explicitly track documents page
	useTrackHistory('/(authenticated)/documents');
	const bg = useThemeColor({}, 'background');
	const bimColor = useThemeColor({}, 'bim');
	const { documents, fetchDocuments, setDocuments } = useTransaction();
	const { user, language } = useGeneral();
	const copy =
		translations[language]?.categories?.documents ??
		translations.en.categories.documents;

	const [refreshing, setRefreshing] = useState(false);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetchDocuments();
		} catch (e) {
			console.error('[DocumentsScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchDocuments]);

	// Overlay state
	const [showDocModal, setShowDocModal] = useState(false);
	const [docMode, setDocMode] = useState<'add' | 'edit' | 'preview'>('add');
	const [activeDoc, setActiveDoc] = useState<DocumentProps | null>(null);

	const [page] = useState(1);
	const pageSize = 50;
	const paged = useMemo(() => {
		const start = (page - 1) * pageSize;
		return documents.slice(start, start + pageSize);
	}, [documents, page]);

	useEffect(() => {
		if (user && documents.length === 0) {
			(async () => {
				await fetchDocuments();
			})();
		}
	}, [user, documents, fetchDocuments]);

	const handleAddDocument = () => {
		setActiveDoc(null);
		setDocMode('add');
		setShowDocModal(true);
	};
	const handlePreview = async (doc: DocumentProps) => {
		// Open overlay in preview mode (keep external link as inline "Open" text)
		setActiveDoc(doc);
		setDocMode('preview');
		setShowDocModal(true);
	};
	const handleEdit = (doc: DocumentProps) => {
		setActiveDoc(doc);
		setDocMode('edit');
		setShowDocModal(true);
	};
	const handleDelete = (doc: DocumentProps) => {
		// Remove by id to ensure stable identity
		try {
			setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
		} catch (e) {
			console.warn('Failed to delete document', e);
		}
	};

	// Overlay submit handling
	const handleSubmitOverlay = (payload: {
		type: DocumentProps['type'];
		documentId: string;
		url: string;
	}) => {
		if (docMode === 'add') {
			// Create new document via factory, default status 'pending' unless derived
			const newDoc = factories.generateDocument({
				type: payload.type,
				documentId: payload.documentId,
				url: payload.url,
				status: 'pending',
			});
			setDocuments((prev) => [newDoc, ...prev]);
		} else if (docMode === 'edit' && activeDoc) {
			// Update existing document, preserve id and status unless changed elsewhere
			setDocuments((prev) =>
				prev.map((d) =>
					d.id === activeDoc.id
						? {
								...d,
								type: payload.type,
								documentId: payload.documentId,
								url: payload.url,
								name:
									payload.type === 'passport'
										? 'Passport'
										: payload.type === 'driver-license'
										? 'Driver License'
										: payload.type === 'id-card'
										? 'ID Card'
										: payload.type === 'incorporation-certificate'
										? 'Incorporation Certificate'
										: payload.type === 'tax-document'
										? 'Tax Document'
										: 'Articles of Association',
						  }
						: d
				)
			);
		}
		setShowDocModal(false);
		setActiveDoc(null);
	};

	const overlayInitial = useMemo(() => {
		if (!activeDoc) return undefined;
		return {
			type: activeDoc.type,
			documentId: activeDoc.documentId,
			url: activeDoc.url,
			name: activeDoc.name,
		};
	}, [activeDoc]);

	return (
		<ParallaxScrollView
			headerBackgroundColor={{
				light: bg,
				dark: bg,
			}}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			{/* Title row */}
			<ThemedView
				lightColor={bg}
				darkColor={bg}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					marginBottom: 12,
				}}
			>
				<ThemedText
					lightColor={bimColor}
					darkColor={bimColor}
					style={{
						width: '100%',
						textTransform: 'capitalize',
						fontSize: fontSize['heading.one'],
						fontWeight: fontWeight['heading.one'],
					}}
				>
					{copy.title}
				</ThemedText>
			</ThemedView>

			{/* Actions */}
			<ThemedView
				style={{ width: '100%', alignItems: 'flex-end', marginBottom: 12 }}
				lightColor={bg}
				darkColor={bg}
			>
				<ThemedButton
					title={copy.addDocument}
					numberOfLines={1}
					onPress={handleAddDocument}
					style={{ borderRadius: 8, width: 200 }}
					darkColor={useThemeColor({}, 'actionButton')}
					lightColor={useThemeColor({}, 'actionButton')}
					darkTextColor={useThemeColor({}, 'authButtonText')}
					lightTextColor={useThemeColor({}, 'authButtonText')}
				/>
			</ThemedView>

			{/* Documents table */}
			<TileContainer
				id='documents-list-tile'
				flat
				backgroundColor={bg}
				style={{ flexDirection: 'column' }}
			>
				<RecordList
					id='documents-list'
					isEmpty={paged.length === 0}
					emptyMessage={copy.noDocuments}
				>
					{paged.map((d) => (
						<RecordCard
							key={d.documentId}
							id={`document-${d.documentId}`}
							title={d.type.replace('-', ' ')}
							subtitle={d.documentId}
							badge={{
								label: d.status,
								tone:
									d.status === 'approved'
										? 'success'
										: d.status === 'pending'
											? 'warning'
											: 'danger',
							}}
							fields={[
								{ label: copy.number, value: d.documentId },
								{
									label: copy.attachment,
									value: (
										<TouchableOpacity
											onPress={async () => {
												try {
													await openBrowserAsync(d.url);
												} catch (e) {
													console.warn('Failed to open document', e);
												}
											}}
										>
											<ThemedText
												lightColor={bimColor}
												darkColor={bimColor}
												style={{ textDecorationLine: 'underline' }}
											>
												{copy.open}
											</ThemedText>
										</TouchableOpacity>
									),
								},
							]}
							actions={[
								{
									label: translations[language].categories.packages.view,
									icon: 'eye.outline',
									tone: 'primary',
									onPress: () => handlePreview(d),
								},
								{
									label: translations[language].categories.packages.edit,
									icon: 'edit.outline',
									tone: 'warning',
									onPress: () => handleEdit(d),
								},
								{
									label: translations[language].categories.packages.delete,
									icon: 'delete.outline',
									tone: 'danger',
									onPress: () => handleDelete(d),
								},
							]}
						/>
					))}
				</RecordList>
			</TileContainer>

			{/* Document overlay */}
			<DocumentOverlay
				visible={showDocModal}
				mode={docMode}
				initial={overlayInitial}
				onCancel={() => {
					setShowDocModal(false);
					setActiveDoc(null);
				}}
				onSubmit={handleSubmitOverlay}
				onBack={() => {
					setShowDocModal(false);
					setActiveDoc(null);
				}}
				onEdit={() => setDocMode('edit')}
			/>
		</ParallaxScrollView>
	);
}
