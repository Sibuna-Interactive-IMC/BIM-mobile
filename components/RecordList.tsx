import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TileContainer from '@/components/TileContainer';
import { IconSymbolName } from '@/components/ui/IconSymbol';
import { fontSize, fontWeight } from '@/constants/Font';
import { useThemeColor } from '@/hooks/useThemeColor';

/**
 * Universal record card/list design language.
 *
 * Use these instead of horizontally scrolling tables: fields wrap into a
 * two-column grid, so a row never needs more than the screen width, and
 * actions wrap into a full-width row beneath the fields.
 */

export type RecordTone =
	| 'default'
	| 'muted'
	| 'primary'
	| 'success'
	| 'warning'
	| 'danger'
	| 'info';

export type RecordField = {
	label: string;
	value: ReactNode;
	tone?: RecordTone;
	/** Render the field across the full card width. */
	fullWidth?: boolean;
	/** Compact node rendered right after the value, e.g. marker chips. */
	trailing?: ReactNode;
};

export type RecordAction = {
	label: string;
	/** Drop the visible text and keep the glyph; `label` stays the accessible name. */
	iconOnly?: boolean;
	onPress: () => void;
	icon?: IconSymbolName;
	tone?: 'primary' | 'neutral' | 'success' | 'info' | 'warning' | 'danger';
	disabled?: boolean;
	loading?: boolean;
};

export type RecordBadge = {
	label: string;
	tone?: RecordTone;
};

function useToneColors() {
	return {
		default: useThemeColor({}, 'text'),
		muted: useThemeColor({}, 'mutedText'),
		primary: useThemeColor({}, 'bim'),
		success: useThemeColor({}, 'lime'),
		warning: useThemeColor({}, 'yellow'),
		danger: useThemeColor({}, 'error'),
		info: useThemeColor({}, 'lightBlue'),
	} satisfies Record<RecordTone, string>;
}

export function RecordCard({
	id,
	title,
	subtitle,
	badge,
	fields,
	actions,
	footer,
	onPress,
}: {
	id?: string;
	title?: ReactNode;
	subtitle?: ReactNode;
	badge?: RecordBadge;
	fields?: RecordField[];
	actions?: RecordAction[];
	footer?: ReactNode;
	onPress?: () => void;
}) {
	const bg = useThemeColor({}, 'background');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const border = useThemeColor({}, 'borderDark');
	const chipBg = useThemeColor({}, 'listItemBackground');
	const primary = useThemeColor({}, 'bim');
	const primaryText = useThemeColor({}, 'authButtonText');
	const tones = useToneColors();

	const actionColors = {
		primary: { background: primary, text: primaryText },
		neutral: { background: chipBg, text: textColor },
		success: { background: tones.success, text: primaryText },
		info: { background: tones.info, text: primaryText },
		warning: { background: tones.warning, text: primaryText },
		danger: { background: tones.danger, text: primaryText },
	};

	return (
		<TileContainer
			id={id ?? 'record-card'}
			backgroundColor={bg}
			style={styles.card}
		>
			<Pressable
				onPress={onPress}
				disabled={!onPress}
				accessibilityRole={onPress ? 'button' : undefined}
				style={({ pressed }) => [
					styles.cardContent,
					pressed && onPress ? styles.cardPressed : null,
				]}
			>
					{title || subtitle || badge ? (
						<ThemedView
							style={[styles.header, !title && !subtitle && styles.headerEnd]}
							lightColor='transparent'
							darkColor='transparent'
						>
						{title || subtitle ? (
							<ThemedView
								style={styles.headerText}
								lightColor='transparent'
								darkColor='transparent'
							>
								{title ? (
									<ThemedText
										style={[styles.title, { color: textColor }]}
										lightColor={textColor}
										darkColor={textColor}
										numberOfLines={2}
									>
										{title}
									</ThemedText>
								) : null}
								{subtitle ? (
									<ThemedText
										style={[styles.subtitle, { color: mutedText }]}
										lightColor={mutedText}
										darkColor={mutedText}
										numberOfLines={2}
									>
										{subtitle}
									</ThemedText>
								) : null}
							</ThemedView>
						) : null}
						{badge ? (
							<ThemedView
								style={[
									styles.badge,
									{
										backgroundColor: `${tones[badge.tone ?? 'default']}1A`,
										borderColor: tones[badge.tone ?? 'default'],
									},
								]}
								lightColor='transparent'
								darkColor='transparent'
							>
								<ThemedText
									style={[
										styles.badgeText,
										{ color: tones[badge.tone ?? 'default'] },
									]}
									lightColor={tones[badge.tone ?? 'default']}
									darkColor={tones[badge.tone ?? 'default']}
								>
									{badge.label}
								</ThemedText>
							</ThemedView>
						) : null}
					</ThemedView>
				) : null}

				{fields && fields.length > 0 ? (
					<View
						style={[
							styles.fields,
							title || subtitle || badge
								? { borderTopColor: border, borderTopWidth: 1 }
								: styles.fieldsFlush,
						]}
					>
						{fields.map((field, index) => {
							const color = tones[field.tone ?? 'default'];
							return (
								<View
									key={`${field.label}-${index}`}
									style={[
										styles.field,
										field.fullWidth && styles.fieldFullWidth,
									]}
								>
									<ThemedText
										style={[styles.fieldLabel, { color: mutedText }]}
										lightColor={mutedText}
										darkColor={mutedText}
										numberOfLines={1}
									>
										{field.label}
									</ThemedText>
									<ThemedText
										style={[styles.fieldValue, { color }]}
										lightColor={color}
										darkColor={color}
										numberOfLines={1}
									>
										{field.value}
									</ThemedText>
									{field.trailing ?? null}
								</View>
							);
						})}
					</View>
				) : null}

				{actions && actions.length > 0 ? (
					<View style={styles.actions}>
						{actions.map((action, index) => {
							const colors = actionColors[action.tone ?? 'primary'];
							return (
								<ThemedButton
									key={`${action.label}-${index}`}
									title={action.iconOnly ? undefined : action.label}
									accessibilityLabel={action.label}
									onPress={action.onPress}
									icon={action.icon}
									disabled={action.disabled}
									loading={action.loading}
									numberOfLines={1}
									style={styles.actionButton}
									textStyle={styles.actionText}
									lightColor={colors.background}
									darkColor={colors.background}
									lightTextColor={colors.text}
									darkTextColor={colors.text}
									iconColor={colors.text}
								/>
							);
						})}
					</View>
				) : null}

				{footer}
			</Pressable>
		</TileContainer>
	);
}

export function RecordList({
	id,
	title,
	description,
	headerAction,
	children,
	loading,
	loadingMessage,
	emptyMessage,
	isEmpty,
	style,
}: {
	id?: string;
	title?: ReactNode;
	description?: ReactNode;
	headerAction?: ReactNode;
	children?: ReactNode;
	loading?: boolean;
	loadingMessage?: string;
	emptyMessage?: string;
	isEmpty?: boolean;
	style?: ViewStyle;
}) {
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const chipBg = useThemeColor({}, 'listItemBackground');

	const showState = loading || isEmpty;

	return (
		<ThemedView
			id={id}
			style={[styles.list, style]}
			lightColor='transparent'
			darkColor='transparent'
		>
			{title || headerAction ? (
				<ThemedView
					style={styles.listHeader}
					lightColor='transparent'
					darkColor='transparent'
				>
					{title ? (
						<ThemedText
							style={[styles.listTitle, { color: textColor }]}
							lightColor={textColor}
							darkColor={textColor}
						>
							{title}
						</ThemedText>
					) : null}
					{headerAction}
				</ThemedView>
			) : null}
			{description ? (
				<ThemedText
					style={[styles.listDescription, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{description}
				</ThemedText>
			) : null}
			{showState ? (
				<ThemedView
					style={styles.state}
					lightColor={chipBg}
					darkColor={chipBg}
				>
					<ThemedText
						lightColor={mutedText}
						darkColor={mutedText}
						style={styles.stateText}
					>
						{loading ? loadingMessage ?? '' : emptyMessage ?? ''}
					</ThemedText>
				</ThemedView>
			) : (
				children
			)}
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	card: {
		width: '100%',
		padding: 8,
	},
	cardContent: {
		width: '100%',
		gap: 4,
	},
	cardPressed: {
		opacity: 0.7,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	headerEnd: {
		justifyContent: 'flex-end',
	},
	headerText: {
		flex: 1,
		gap: 1,
	},
	title: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	subtitle: {
		fontSize: fontSize['text.small'],
	},
	badge: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 999,
		borderWidth: 1,
	},
	badgeText: {
		fontSize: fontSize['text.xsmall'],
		fontWeight: fontWeight['text.xsmall'],
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	},
	fields: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		columnGap: 10,
		rowGap: 4,
		paddingTop: 6,
	},
	fieldsFlush: {
		paddingTop: 0,
	},
	field: {
		flexBasis: '45%',
		flexGrow: 1,
		flexDirection: 'row',
		alignItems: 'baseline',
		gap: 4,
		minWidth: 100,
	},
	fieldFullWidth: {
		flexBasis: '100%',
		minWidth: '100%',
	},
	fieldLabel: {
		flexShrink: 0,
		fontSize: fontSize['text.xsmall'],
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	},
	fieldValue: {
		flexShrink: 1,
		fontSize: fontSize['text.small'],
		fontWeight: fontWeight['button.small'],
	},
	actions: {
		flexDirection: 'row',
		gap: 6,
	},
	actionButton: {
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
		minWidth: 0,
		borderRadius: 6,
		paddingVertical: 6,
		paddingHorizontal: 6,
	},
	actionText: {
		fontSize: fontSize['button.small'],
	},
	list: {
		width: '100%',
		gap: 6,
	},
	listHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
		flexWrap: 'wrap',
	},
	listTitle: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	listDescription: {
		fontSize: fontSize['text.medium'],
	},
	state: {
		padding: 16,
		borderRadius: 8,
		alignItems: 'center',
	},
	stateText: {
		fontSize: fontSize['text.medium'],
		textAlign: 'center',
	},
});
