import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { ShowAlert } from '@/helpers';
import { getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import { saveSiteDetail } from '@/services/SiteService';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/** `POST /sites/{router}/detail` — the landlord and notes on a site. */
export default function SitePremisesOverlay({
	visible,
	fadeAnim,
	authToken,
	routerId,
	initial,
	onClose,
	onSaved,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	routerId: string;
	initial: { landlord?: string | null; notes?: string | null };
	onClose: () => void;
	onSaved: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.sites;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const inputBorder = useThemeColor({}, 'inputBorder');

	const [landlord, setLandlord] = useState('');
	const [notes, setNotes] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!visible) return;
		setLandlord(initial.landlord ?? '');
		setNotes(initial.notes ?? '');
	}, [initial.notes, initial.landlord, visible]);

	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	const submit = useCallback(async () => {
		if (!authToken) return;
		setSaving(true);
		try {
			const res = await saveSiteDetail(
				routerId,
				{ landlord: landlord.trim() || null, notes: notes.trim() || null },
				authToken
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				return;
			}
			ShowAlert(t.premisesSaved, 'Success');
			onSaved();
			onClose();
		} catch (e) {
			console.error('[SitePremisesOverlay] save failed', e);
			ShowAlert(t.saveFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [authToken, landlord, notes, onClose, onSaved, routerId, t.premisesSaved, t.saveFailed]);

	return (
		<OverlayContainer
			id='site-premises-form'
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
						{t.premisesTitle}
					</ThemedText>
					{saving ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				<ThemedInput
					label={t.landlord}
					placeholder={t.landlordPlaceholder}
					value={landlord}
					setValue={setLandlord}
					style={fields}
				/>
				<ThemedInput
					label={t.notesField}
					placeholder={t.notesPlaceholder}
					value={notes}
					setValue={setNotes}
					multiline
					lines={3}
					style={fields}
				/>

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
