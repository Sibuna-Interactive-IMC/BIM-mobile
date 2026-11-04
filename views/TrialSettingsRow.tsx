import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ApiRouter, TrialSettings } from '@/types';

type Props = {
	router: ApiRouter;
	settings?: TrialSettings | null;
	loading?: boolean;
	saving?: boolean;
	onSave: (enabled: boolean, minutes: number) => void | Promise<void>;
};

export default function TrialSettingsRow({
	router,
	settings,
	loading,
	saving,
	onSave,
}: Props) {
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const border = useThemeColor({}, 'borderDark');
	const buttonBg = useThemeColor({}, 'bim');
	const buttonText = useThemeColor({}, 'authButtonText');
	const { language } = useGeneral();

	const packagesCopy = translations[language]?.categories?.packages ?? translations.en.categories.packages;
	const t = (key: string) =>
		packagesCopy[key] ?? translations.en.categories.packages[key] ?? '';

	const [enabled, setEnabled] = useState(false);
	const [minutes, setMinutes] = useState('15');

	useEffect(() => {
		setEnabled(settings?.enabled ?? false);
		setMinutes(String(settings?.duration_minutes ?? 15));
	}, [settings, router.id]);

	const parsedMinutes = Number(minutes);
	const canSave =
		Number.isFinite(parsedMinutes) &&
		parsedMinutes >= 1 &&
		parsedMinutes <= 1440 &&
		!saving;

	return (
		<ThemedView
			style={[styles.row, { borderBottomColor: border }]}
			lightColor='transparent'
			darkColor='transparent'
		>
			<ThemedView
				style={styles.header}
				lightColor='transparent'
				darkColor='transparent'
			>
				<ThemedText
					style={styles.name}
					lightColor={textColor}
					darkColor={textColor}
				>
					{router.name}
				</ThemedText>
				<ThemedView
					style={styles.status}
					lightColor='transparent'
					darkColor='transparent'
				>
					<ThemedText
						style={styles.statusText}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{enabled ? t('enabled') : t('disabled')}
					</ThemedText>
					<ThemedSwitch value={enabled} onValueChange={setEnabled} />
				</ThemedView>
			</ThemedView>

			{loading ? (
				<ThemedText
					style={styles.help}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{t('loadingTrialSettings')}
				</ThemedText>
			) : (
				<ThemedView
					style={styles.controls}
					lightColor='transparent'
					darkColor='transparent'
				>
					<ThemedInput
						label={t('trialTime')}
						placeholder={t('trialMinutesPlaceholder')}
						keyboardType='number-pad'
						value={minutes}
						setValue={setMinutes}
						containerStyle={{ flex: 1 }}
						style={{ borderColor: border }}
					/>
					<ThemedButton
						title={t('save')}
						onPress={() => {
							if (!canSave) return;
							void onSave(enabled, Math.round(parsedMinutes));
						}}
						loading={saving}
						disabled={!canSave}
						style={{ alignSelf: 'flex-end', flex: 1, height: 50 }}
						lightColor={buttonBg}
						darkColor={buttonBg}
						lightTextColor={buttonText}
						darkTextColor={buttonText}
					/>
				</ThemedView>
			)}
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	row: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		gap: 8,
	},
	header: {
		flexDirection: 'row',
		width: '100%',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	name: {
		flex: 1,
		fontSize: fontSize['text.large'],
		fontWeight: fontWeight['heading.three'],
	},
	status: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	statusText: {
		fontSize: 12,
		textTransform: 'uppercase',
	},
	help: {
		fontSize: 13,
	},
	controls: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 10,
	},
});
