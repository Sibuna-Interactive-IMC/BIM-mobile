import OverlayContainer from '@/components/OverlayContainer';
import ThemedDatePicker from '@/components/ThemedDatePicker';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { parseApiDate, ShowAlert, toApiDate } from '@/helpers';
import { getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import { createAccessPoint, updateAccessPoint } from '@/services/SiteService';
import type { SiteAccessPoint } from '@/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/** `POST /sites/{router}/access-points[/{id}]` — add or edit mounted gear. */
export default function AccessPointFormOverlay({
	visible,
	fadeAnim,
	authToken,
	routerId,
	editing,
	onClose,
	onSaved,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	routerId: string;
	/** The access point being edited, or null when adding. */
	editing: SiteAccessPoint | null;
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

	const [name, setName] = useState('');
	const [model, setModel] = useState('');
	const [macAddress, setMacAddress] = useState('');
	const [physicalLocation, setPhysicalLocation] = useState('');
	const [installedOn, setInstalledOn] = useState<Date | null>(null);
	const [notes, setNotes] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!visible) return;
		setName(editing?.name ?? '');
		setModel(editing?.model ?? '');
		setMacAddress(editing?.mac_address ?? '');
		setPhysicalLocation(editing?.physical_location ?? '');
		setInstalledOn(parseApiDate(editing?.installed_on));
		setNotes(editing?.notes ?? '');
	}, [editing, visible]);

	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	const submit = useCallback(async () => {
		if (!authToken) return;
		const trimmedName = name.trim();
		if (!trimmedName) {
			ShowAlert(t.nameRequired, 'Error');
			return;
		}

		const payload = {
			name: trimmedName,
			model: model.trim() || null,
			mac_address: macAddress.trim() || null,
			physical_location: physicalLocation.trim() || null,
			installed_on: toApiDate(installedOn),
			notes: notes.trim() || null,
		};

		setSaving(true);
		try {
			const res = editing
				? await updateAccessPoint(routerId, editing.id, payload, authToken)
				: await createAccessPoint(routerId, payload, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				return;
			}
			ShowAlert(t.accessPointSaved, 'Success');
			onSaved();
			onClose();
		} catch (e) {
			console.error('[AccessPointFormOverlay] save failed', e);
			ShowAlert(t.saveFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		authToken,
		editing,
		installedOn,
		macAddress,
		model,
		name,
		notes,
		onClose,
		onSaved,
		physicalLocation,
		routerId,
		t.accessPointSaved,
		t.nameRequired,
		t.saveFailed,
	]);

	return (
		<OverlayContainer
			id='access-point-form'
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
						{editing ? t.editAccessPoint : t.addAccessPoint}
					</ThemedText>
					{saving ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				<ThemedInput
					label={t.accessPointName}
					placeholder={t.accessPointNamePlaceholder}
					value={name}
					setValue={setName}
					style={fields}
				/>
				<ThemedInput
					label={t.model}
					placeholder={t.modelPlaceholder}
					value={model}
					setValue={setModel}
					style={fields}
				/>
				<ThemedInput
					label={t.macAddress}
					placeholder={t.macAddressPlaceholder}
					value={macAddress}
					setValue={setMacAddress}
					autoCapitalize='characters'
					style={fields}
				/>
				<ThemedInput
					label={t.physicalLocation}
					placeholder={t.physicalLocationPlaceholder}
					value={physicalLocation}
					setValue={setPhysicalLocation}
					style={fields}
				/>
				<ThemedDatePicker
					label={t.installedOn}
					placeholder={t.datePlaceholder}
					value={installedOn}
					onChange={setInstalledOn}
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
