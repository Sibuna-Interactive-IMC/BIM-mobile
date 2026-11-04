import AvatarImage from '@/components/AvatarImage';
import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { AvatarGroup, AvatarPreset } from '@/types';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const PREVIEW_SIZE = 84;
const OPTION_SIZE = 64;

/**
 * The preset avatar picker. The choice is only a draft here: the parent form
 * owns `avatar` and saves it with the rest of the profile, so backing out of the
 * picker cannot persist an avatar the user changed their mind about.
 */
export default function AvatarPickerOverlay({
	visible,
	fadeAnim,
	groups,
	selected,
	onClose,
	onSelect,
}: {
	visible: boolean;
	fadeAnim: any;
	groups: AvatarGroup[];
	/** The currently chosen preset id. */
	selected: string;
	onClose: () => void;
	onSelect: (id: string) => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.profile;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'screenTitleText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const border = useThemeColor({}, 'inputBorder');
	const selectedBg = useThemeColor({}, 'listItemBackground');

	const [draft, setDraft] = useState(selected);

	useEffect(() => {
		if (visible) setDraft(selected);
	}, [selected, visible]);

	const allPresets = groups.flatMap((group) => group.presets);
	const draftPreset: AvatarPreset | undefined =
		allPresets.find((preset) => preset.id === draft) ?? allPresets[0];

	return (
		<OverlayContainer
			id='avatar-picker'
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={onClose}
			scrollable
			bottomPadding={16}
		>
			<ThemedView
				style={[styles.card, { backgroundColor: bg }]}
				lightColor={bg}
				darkColor={bg}
			>
				<ThemedText
					style={[styles.title, { color: screenTitleText }]}
					lightColor={screenTitleText}
					darkColor={screenTitleText}
				>
					{t.chooseAvatar}
				</ThemedText>

				<View style={styles.previewRow}>
					<AvatarImage uri={draftPreset?.url} size={PREVIEW_SIZE} alt={t.avatar} />
					<ThemedText
						style={[styles.previewLabel, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{draftPreset?.label ?? ''}
					</ThemedText>
				</View>

				<ScrollView style={styles.groups} contentContainerStyle={styles.groupsContent}>
					{groups.map((group) => (
						<View key={group.gender} style={styles.group}>
							<ThemedText
								style={[styles.groupLabel, { color: screenTitleText }]}
								lightColor={screenTitleText}
								darkColor={screenTitleText}
							>
								{group.label}
							</ThemedText>
							<View style={styles.grid}>
								{group.presets.map((preset) => {
									const active = preset.id === draft;
									return (
										<Pressable
											key={preset.id}
											accessibilityRole='radio'
											accessibilityState={{ checked: active }}
											accessibilityLabel={preset.label}
											onPress={() => setDraft(preset.id)}
											style={[
												styles.option,
												{
													borderColor: active ? bim : border,
													backgroundColor: active ? selectedBg : 'transparent',
												},
											]}
										>
											<AvatarImage
												uri={preset.url}
												size={OPTION_SIZE}
												alt={preset.label}
											/>
										</Pressable>
									);
								})}
							</View>
						</View>
					))}
				</ScrollView>

				<View style={styles.actions}>
					<ThemedButton
						title={buttons.cancel}
						onPress={onClose}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor='transparent'
						darkColor='transparent'
						lightTextColor={bim}
						darkTextColor={bim}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={t.useAvatar}
						icon='check'
						onPress={() => onSelect(draft)}
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
		maxHeight: '85%',
	},
	title: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	previewRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	previewLabel: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['text.medium'],
	},
	groups: {
		width: '100%',
	},
	groupsContent: {
		gap: 12,
	},
	group: {
		gap: 6,
	},
	groupLabel: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['button.small'],
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	option: {
		padding: 4,
		borderWidth: 2,
		borderRadius: 10,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
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
