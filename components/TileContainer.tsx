import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export default function TileContainer({
	id,
	backgroundColor,
	style,
	children,
	flat,
	borderless,
}: {
	id: string;
	backgroundColor?: string;
	style?: StyleProp<ViewStyle>;
	children: React.ReactNode;
	/** Parent/container tiles are flat (border only); child tiles stay raised. */
	flat?: boolean;
	/**
	 * Sections that live inside the screen's single outer container must not
	 * draw their own frame — otherwise the border is doubled. Such sections
	 * render as a plain view.
	 */
	borderless?: boolean;
}) {
	const white = useThemeColor({}, 'white');
	const borderColor = useThemeColor({}, 'inputBorder');
	const bg = backgroundColor || white;

	if (borderless) {
		return (
			<View id={id} style={[styles.section, style]}>
				{children}
			</View>
		);
	}

	return (
		<ThemedView
			id={id}
			style={[
				styles.container,
				{ borderColor },
				!flat && styles.raised,
				style,
			]}
			lightColor={bg}
			darkColor={bg}
		>
			{children}
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'column',
		alignSelf: 'stretch',
		alignItems: 'flex-start',
		justifyContent: 'flex-start',
		padding: 12,
		gap: 15,
		borderRadius: 8,
		borderWidth: 1,
	},
	section: {
		flexDirection: 'column',
		alignSelf: 'stretch',
		alignItems: 'flex-start',
		justifyContent: 'flex-start',
		gap: 15,
	},
	raised: {
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.16,
		shadowRadius: 6,
		elevation: 3,
	},
});
