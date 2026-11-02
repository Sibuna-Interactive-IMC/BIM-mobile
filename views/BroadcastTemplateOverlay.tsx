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
import { createBroadcastTemplate } from '@/services/BroadcastService';
import type { BroadcastLimits } from '@/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/** `POST /admin/broadcasts/templates` — save a reusable message body. */
export default function BroadcastTemplateOverlay({
	visible,
	fadeAnim,
	authToken,
	limits,
	onClose,
	onSaved,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	limits?: BroadcastLimits | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.broadcast;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'screenTitleText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');

	const [name, setName] = useState('');
	const [body, setBody] = useState('');
	const [saving, setSaving] = useState(false);

	const maxLength = limits?.max_message_length ?? 640;
	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	useEffect(() => {
		if (!visible) return;
		setName('');
		setBody('');
	}, [visible]);

	const submit = useCallback(async () => {
		if (!authToken) return;
		const trimmedName = name.trim();
		const trimmedBody = body.trim();
		if (!trimmedName) {
			ShowAlert(t.templateNameRequired, 'Error');
			return;
		}
		if (!trimmedBody) {
			ShowAlert(t.templateBodyRequired, 'Error');
			return;
		}

		setSaving(true);
		try {
			const res = await createBroadcastTemplate(
				{ name: trimmedName, body: trimmedBody },
				authToken
			);
			const payload = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(payload) || t.templateSaveFailed, 'Error');
				return;
			}
			ShowAlert(t.templateSaved, 'Success');
			onSaved();
			onClose();
		} catch (e) {
			console.error('[BroadcastTemplateOverlay] save failed', e);
			ShowAlert(t.templateSaveFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		authToken,
		body,
		name,
		onClose,
		onSaved,
		t.templateBodyRequired,
		t.templateNameRequired,
		t.templateSaveFailed,
		t.templateSaved,
	]);

	return (
		<OverlayContainer
			id='broadcast-template-form'
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
						{t.newTemplate}
					</ThemedText>
					{saving ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				<ThemedInput
					label={t.templateName}
					placeholder={t.templateNamePlaceholder}
					maxLength={80}
					value={name}
					setValue={setName}
					style={fields}
				/>

				<ThemedInput
					label={t.templateBody}
					placeholder={t.templateBodyPlaceholder}
					lines={6}
					multiline
					maxLength={maxLength}
					value={body}
					setValue={setBody}
					style={fields}
				/>

				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{body.length} / {maxLength}
				</ThemedText>

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
						title={t.saveTemplate}
						icon='check'
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
