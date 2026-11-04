import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import { useThemeColor } from '@/hooks/useThemeColor';

/**
 * The app-wide screen header: a title row, optional description and optional
 * header-level action. It draws **no** container of its own — wrap it in the
 * screen's single outer `TileContainer`, which supplies the only border, so a
 * header never ends up inside a container inside another container.
 */
export default function ScreenHeader({
	id,
	title,
	description,
	loading = false,
	action,
	children,
	style,
}: {
	id?: string;
	title: string;
	description?: string;
	/** Shows a small spinner next to the title while the screen loads. */
	loading?: boolean;
	/** Header-level control on the right (a count pill, a create button, …). */
	action?: ReactNode;
	/** Extra header content below the title (a second button row, a timestamp…). */
	children?: ReactNode;
	style?: ViewStyle;
}) {
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');

	return (
		<View id={id ?? 'screen-header'} style={[styles.section, style]}>
			<View style={styles.titleRow}>
				<ThemedText
					style={[styles.screenTitle, { color: textColor }]}
					lightColor={textColor}
					darkColor={textColor}
					numberOfLines={2}
				>
					{title}
				</ThemedText>
				{loading ? <ActivityIndicator size='small' color={bim} /> : null}
				{action}
			</View>
			{description ? (
				<ThemedText
					style={[styles.description, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{description}
				</ThemedText>
			) : null}
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	titleRow: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	screenTitle: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	description: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
});
