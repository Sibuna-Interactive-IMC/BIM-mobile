import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

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
import { SharedRadiusProfile } from '@/types';

export type RadiusProfileFormValues = {
	name: string;
	price?: number;
	duration: string;
	bandwidth: string;
	devices: number;
};

type Props = {
	visible: boolean;
	fadeAnim: Animated.Value;
	toggleVisible: (show?: boolean) => void;
	mode: 'create' | 'edit';
	initial?: SharedRadiusProfile | null;
	saving?: boolean;
	onSubmit: (values: RadiusProfileFormValues) => void | Promise<void>;
};

export default function RadiusProfileForm({
	visible,
	fadeAnim,
	toggleVisible,
	mode,
	initial,
	saving,
	onSubmit,
}: Props) {
	const bg = useThemeColor({}, 'background');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const buttonBg = useThemeColor({}, 'bim');
	const buttonText = useThemeColor({}, 'authButtonText');
	const chipBg = useThemeColor({}, 'listItemBackground');
	const { language } = useGeneral();

	const packagesCopy = translations[language]?.categories?.packages ?? translations.en.categories.packages;
	const buttonsCopy =
		translations[language]?.categories?.buttons ??
		translations.en.categories.buttons;
	const currency =
		translations[language]?.categories?.dashboard?.currency ??
		translations.en.categories.dashboard.currency;
	const t = (key: string) =>
		packagesCopy[key] ?? translations.en.categories.packages[key] ?? '';

	const [name, setName] = useState('');
	const [price, setPrice] = useState('');
	const [duration, setDuration] = useState('');
	const [bandwidth, setBandwidth] = useState('');
	const [devices, setDevices] = useState('1');

	useEffect(() => {
		if (!visible) return;
		setName(
			initial
				? initial.display_name || initial.name || initial.group
				: ''
		);
		setPrice(initial?.price != null ? String(initial.price) : '');
		setDuration(initial?.duration ?? '');
		setBandwidth(initial?.rate_limit ?? '');
		setDevices(initial?.devices != null ? String(initial.devices) : '1');
	}, [visible, initial]);

	const canSubmit =
		!!name.trim() &&
		!!duration.trim() &&
		!!bandwidth.trim() &&
		Number(devices) > 0 &&
		!saving;

	const submit = () => {
		if (!canSubmit) return;
		void onSubmit({
			name: name.trim(),
			price: price.trim() ? Number(price) : undefined,
			duration: duration.trim(),
			bandwidth: bandwidth.trim(),
			devices: Number(devices),
		});
	};

	return (
		<OverlayContainer
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={() => toggleVisible(false)}
			scrollable
			bottomPadding={16}
			centerLiftOnKeyboard
			centerLiftRatio={0.9}
		>
			<ThemedView
				style={[styles.card, { backgroundColor: bg }]}
				lightColor={bg}
				darkColor={bg}
			>
				<ThemedText
					style={styles.title}
					lightColor={textColor}
					darkColor={textColor}
				>
					{mode === 'create'
						? t('createGlobalRadiusProfile')
						: t('editRadiusProfile')}
				</ThemedText>

				{mode === 'edit' && initial ? (
					<ThemedText
						style={styles.help}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{translateWithVariables(t('groupLabel'), {
							group: initial.group,
						})}
					</ThemedText>
				) : null}

				<ThemedInput
					label={
						mode === 'create'
							? t('profileNameRadiusGroup')
							: t('displayName')
					}
					placeholder={t('profileNamePlaceholder')}
					value={name}
					setValue={setName}
					style={{ borderColor: inputBorder }}
				/>

				<ThemedInput
					label={translateWithVariables(t('Price'), { currency })}
					placeholder={t('pricePlaceholder')}
					keyboardType='number-pad'
					value={price}
					setValue={setPrice}
					style={{ borderColor: inputBorder }}
				/>

				<ThemedInput
					label={t('sessionTimeout')}
					placeholder={t('sessionTimeoutPlaceholder')}
					value={duration}
					setValue={setDuration}
					style={{ borderColor: inputBorder }}
				/>

				<ThemedInput
					label={t('rateLimit')}
					placeholder={t('rateLimitPlaceholder')}
					value={bandwidth}
					setValue={setBandwidth}
					style={{ borderColor: inputBorder }}
				/>

				<ThemedInput
					label={t('simultaneousDevices')}
					placeholder={t('devicesPlaceholder')}
					keyboardType='number-pad'
					value={devices}
					setValue={setDevices}
					style={{ borderColor: inputBorder }}
				/>

				<ThemedView
					style={styles.actions}
					lightColor='transparent'
					darkColor='transparent'
				>
					<ThemedButton
						title={buttonsCopy.cancel}
						onPress={() => toggleVisible(false)}
						style={{ maxWidth: '40%' }}
						lightColor={chipBg}
						darkColor={chipBg}
						lightTextColor={textColor}
						darkTextColor={textColor}
					/>
					<ThemedButton
						title={
							mode === 'create'
								? t('createProfileButton')
								: buttonsCopy.saveChanges
						}
						onPress={submit}
						loading={saving}
						disabled={!canSubmit}
						style={{ maxWidth: '55%' }}
						lightColor={buttonBg}
						darkColor={buttonBg}
						lightTextColor={buttonText}
						darkTextColor={buttonText}
					/>
				</ThemedView>
			</ThemedView>
		</OverlayContainer>
	);
}

const styles = StyleSheet.create({
	card: {
		width: '100%',
		borderRadius: 10,
		padding: 20,
		gap: 12,
	},
	title: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
		marginBottom: 4,
	},
	help: {
		fontSize: 13,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 8,
	},
});
