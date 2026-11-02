import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { translateWithVariables } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * The two router actions that need more than a yes/no: a raw RouterOS command,
 * and the destructive cookie cleanup, which the server only accepts once the
 * admin has typed the router's name.
 */
export default function RouterToolsOverlay({
	mode,
	visible,
	fadeAnim,
	routerName,
	submitting,
	error,
	onClose,
	onSubmit,
}: {
	mode: 'command' | 'confirm';
	visible: boolean;
	fadeAnim: any;
	routerName: string;
	submitting: boolean;
	/** Server field error shown under the input (e.g. a wrong confirmation name). */
	error?: string | null;
	onClose: () => void;
	onSubmit: (value: string) => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.routerTools;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'screenTitleText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const dangerButton = useThemeColor({}, 'dangerButton');

	const [value, setValue] = useState('');

	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	useEffect(() => {
		if (visible) setValue('');
	}, [visible, mode]);

	const isCommand = mode === 'command';
	const canSubmit = value.trim().length > 0 && !submitting;

	return (
		<OverlayContainer
			id='router-tools-form'
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
						{isCommand
							? translateWithVariables(t.sendCommandTitle, {
									router: routerName,
								})
							: translateWithVariables(t.removeCookiesConfirm, {
									router: routerName,
								})}
					</ThemedText>
					{submitting ? <ActivityIndicator size='small' color={bim} /> : null}
				</View>

				<ThemedInput
					label={isCommand ? t.sendCommandLabel : t.router}
					placeholder={
						isCommand ? t.sendCommandPlaceholder : routerName
					}
					lines={isCommand ? 6 : 1}
					multiline={isCommand}
					autoCapitalize='none'
					autoCorrect={false}
					maxLength={isCommand ? 2000 : 120}
					value={value}
					setValue={setValue}
					style={fields}
				/>

				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{isCommand
						? t.sendCommandHint
						: translateWithVariables(t.removeCookiesConfirm, {
								router: routerName,
							})}
				</ThemedText>

				{error ? (
					<ThemedText
						style={[styles.hint, { color: dangerButton }]}
						lightColor={dangerButton}
						darkColor={dangerButton}
					>
						{error}
					</ThemedText>
				) : null}

				<View style={styles.actions}>
					<ThemedButton
						title={buttons.cancel}
						onPress={onClose}
						disabled={submitting}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={cancelButton}
						darkColor={cancelButton}
						lightTextColor={white}
						darkTextColor={white}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={isCommand ? t.sendCommandAction : t.removeCookiesAction}
						icon={isCommand ? 'paperplane.fill' : 'delete.outline'}
						onPress={() => onSubmit(value.trim())}
						loading={submitting}
						disabled={!canSubmit}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={isCommand ? bim : dangerButton}
						darkColor={isCommand ? bim : dangerButton}
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
