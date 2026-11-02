import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import { useThemeColor } from '@/hooks/useThemeColor';

/**
 * A single-choice list, for form fields.
 *
 * Use this — not `SegmentedTabs` — when the user picks one value out of a few:
 * pills read as tabs and suggest a view switch, while these rows spell out what
 * each choice means. Every option carries a label and an optional description
 * line, mirroring the radio lists on the web dashboard.
 */
export type RadioOption = {
	key: string;
	label: string;
	/** Second line under the label: what picking this option actually does. */
	description?: string;
};

export function ThemedRadioButtons({
	id,
	options,
	value,
	onChange,
	disabled = false,
	style,
}: {
	id?: string;
	options: RadioOption[];
	/** Key of the selected option; nothing is selected while it matches none. */
	value: string;
	onChange: (key: string) => void;
	disabled?: boolean;
	style?: ViewStyle;
}) {
	const background = useThemeColor({}, 'background');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const bim = useThemeColor({}, 'bim');
	const valueText = useThemeColor({}, 'valueText');
	const screenTitleText = useThemeColor({}, 'screenTitleText');

	return (
		<View
			id={id}
			accessibilityRole='radiogroup'
			style={[styles.group, style]}
		>
			{options.map((option) => {
				const selected = option.key === value;
				return (
					<Pressable
						key={option.key}
						accessibilityRole='radio'
						accessibilityState={{ checked: selected, disabled }}
						accessibilityLabel={option.label}
						accessibilityHint={option.description}
						disabled={disabled}
						onPress={() => onChange(option.key)}
						style={({ pressed }) => [
							styles.option,
							{
								backgroundColor: background,
								borderColor: selected ? bim : inputBorder,
							},
							pressed && !disabled ? styles.pressed : null,
							disabled ? styles.disabled : null,
						]}
					>
						<View
							style={[
								styles.ring,
								{ borderColor: selected ? bim : inputBorder },
							]}
						>
							{selected ? (
								<View style={[styles.dot, { backgroundColor: bim }]} />
							) : null}
						</View>
						<View style={styles.copy}>
							<ThemedText
								style={[
									styles.label,
									{ color: selected ? bim : valueText },
								]}
								lightColor={selected ? bim : valueText}
								darkColor={selected ? bim : valueText}
							>
								{option.label}
							</ThemedText>
							{option.description ? (
								<ThemedText
									style={[styles.description, { color: screenTitleText }]}
									lightColor={screenTitleText}
									darkColor={screenTitleText}
								>
									{option.description}
								</ThemedText>
							) : null}
						</View>
					</Pressable>
				);
			})}
		</View>
	);
}

export default ThemedRadioButtons;

const styles = StyleSheet.create({
	group: {
		width: '100%',
		gap: 8,
	},
	option: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 10,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderRadius: 8,
	},
	pressed: {
		opacity: 0.75,
	},
	disabled: {
		opacity: 0.5,
	},
	ring: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 1,
	},
	dot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	copy: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	label: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['button.small'],
	},
	description: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
	},
});
