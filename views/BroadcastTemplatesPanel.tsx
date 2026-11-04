import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import { deleteBroadcastTemplate } from '@/services/BroadcastService';
import type { BroadcastTemplate } from '@/types';
import { useCallback, useState } from 'react';
import { StyleSheet, useAnimatedValue, View } from 'react-native';

/** The saved message bodies: list them and delete the ones no longer wanted. */
export default function BroadcastTemplatesPanel({
	authToken,
	templates,
	loading,
	onDeleted,
}: {
	authToken?: string;
	templates: BroadcastTemplate[];
	loading: boolean;
	onDeleted: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.broadcast;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;

	const dangerButton = useThemeColor({}, 'dangerButton');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const white = useThemeColor({}, 'white');
	const mutedText = useThemeColor({}, 'screenTitleText');

	const [target, setTarget] = useState<BroadcastTemplate | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [showPrompt, setShowPrompt] = useState(false);
	const promptFade = useAnimatedValue(0);

	const closePrompt = useCallback(() => {
		promptFade.setValue(0);
		setShowPrompt(false);
		setTarget(null);
	}, [promptFade]);

	const runDelete = useCallback(async () => {
		if (!authToken || !target) return;
		const template = target;
		closePrompt();
		setDeleting(true);
		try {
			const res = await deleteBroadcastTemplate(template.id, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.templateDeleteFailed, 'Error');
				return;
			}
			ShowAlert(getApiMessage(body) || t.templateDeleted, 'Success');
			onDeleted();
		} catch (e) {
			console.error('[BroadcastTemplatesPanel] delete failed', e);
			ShowAlert(t.templateDeleteFailed, 'Error');
		} finally {
			setDeleting(false);
		}
	}, [authToken, closePrompt, onDeleted, t.templateDeleteFailed, t.templateDeleted, target]);

	const fieldsOf = (template: BroadcastTemplate): RecordField[] => [
		{ label: t.message, value: template.body, fullWidth: true },
		{ label: t.created, value: formatDateTime(template.created_at) },
	];

	return (
		<View style={styles.panel}>
			<RecordList
				id='broadcast-templates'
				title={t.templates}
				description={translateWithVariables(t.templatesCount, {
					count: templates.length,
				})}
				loading={loading && templates.length === 0}
				loadingMessage={loadingCopy}
				isEmpty={!loading && templates.length === 0}
				emptyMessage={t.noTemplates}
			>
				{templates.map((template) => (
					<RecordCard
						key={template.id}
						id={`broadcast-template-${template.id}`}
						title={template.name}
						fields={fieldsOf(template)}
						actions={[
							{
								label: t.delete,
								icon: 'delete.outline',
								tone: 'danger',
								loading: deleting,
								onPress: () => {
									setTarget(template);
									promptFade.setValue(1);
									setShowPrompt(true);
								},
							},
						]}
					/>
				))}
			</RecordList>

			<ThemedText
				style={[styles.hint, { color: mutedText }]}
				lightColor={mutedText}
				darkColor={mutedText}
			>
				{t.templatesHint}
			</ThemedText>

			<Prompt
				id='broadcast-template-prompt'
				fadeAnim={promptFade}
				visible={showPrompt}
				onClose={closePrompt}
				title={t.templateDeleteTitle}
				message={translateWithVariables(t.templateDeleteMessage, {
					name: target?.name ?? '',
				})}
				buttons={[
					{
						title: buttons.cancel,
						color: cancelButton,
						textColor: white,
						action: closePrompt,
					},
					{
						title: t.delete,
						color: dangerButton,
						textColor: white,
						action: () => {
							void runDelete();
						},
					},
				]}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: {
		width: '100%',
		gap: 12,
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
		fontWeight: fontWeight['text.xsmall'],
	},
});
