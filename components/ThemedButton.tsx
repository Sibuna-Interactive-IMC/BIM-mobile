/** Button from TouchableOpacity */
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol, IconSymbolName } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
	StyleProp,
	StyleSheet,
	TextStyle,
	TouchableOpacity,
	ViewStyle
} from 'react-native';

export type ThemedButtonProps = {
	title: string;
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
	textStyle?: StyleProp<TextStyle>;
	lightTextColor?: string;
	darkTextColor?: string;
	lightColor?: string;
	darkColor?: string;
	numberOfLines?: number;
	icon?: IconSymbolName;
	iconColor?: string;
	disabled?: boolean;
	loading?: boolean;
};

export function ThemedButton({
	title,
	onPress,
	style,
	textStyle,
	lightTextColor,
	darkTextColor,
	lightColor,
	darkColor,
	icon,
	iconColor,
	numberOfLines,
	disabled,
	loading,
}: ThemedButtonProps) {
	const colorScheme = useColorScheme() ?? 'light';
	const presetBg = useThemeColor({}, 'tint');
	const presetTxtColor = useThemeColor({}, 'text');
	const userSetBg = colorScheme === 'dark' ? darkColor : lightColor;
	const backgroundColor = userSetBg ? userSetBg : presetBg;

	const userSetTextColor =
		colorScheme === 'dark' ? darkTextColor : lightTextColor;
	const textColor = userSetTextColor ? userSetTextColor : presetTxtColor;

	return (
		<TouchableOpacity
			style={[
				styles.button,
				{
					backgroundColor,
					maxWidth: '100%',
					flexShrink: 0,
					opacity: disabled || loading ? 0.6 : 1,
				},
				style,
			]}
			onPress={onPress}
			disabled={!!disabled || !!loading}
		>
			<ThemedView
				style={styles.buttonContent}
				lightColor='transparent'
				darkColor='transparent'
			>
				{icon && !loading && (
					<IconSymbol name={icon} size={20} color={iconColor || textColor} />
				)}
				<ThemedText
					numberOfLines={numberOfLines}
					style={[
						styles.buttonText,
						{ color: textColor, textTransform: 'uppercase' },
						textStyle,
					]}
					lightColor={textColor}
					darkColor={textColor}
				>
					{loading ? '…' : title}
				</ThemedText>
			</ThemedView>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	button: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 5,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	buttonContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 5,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: '500',
	},
});
