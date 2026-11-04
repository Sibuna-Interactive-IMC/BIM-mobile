import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { StyleSheet } from 'react-native';

/** Previous / page-of / Next row shared by the list screens. */
export default function ListPagination({
	id = 'list-pagination',
	page,
	lastPage,
	onPrev,
	onNext,
}: {
	id?: string;
	page: number;
	lastPage: number;
	onPrev: () => void;
	onNext: () => void;
}) {
	const { language } = useGeneral();
	const buttons = translations[language].categories.buttons;

	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const textLight = useThemeColor({}, 'text', 'light');
	const textDark = useThemeColor({}, 'text', 'dark');
	const mutedTextLight = useThemeColor({}, 'mutedText', 'light');
	const mutedTextDark = useThemeColor({}, 'mutedText', 'dark');

	return (
		<ThemedView
			id={id}
			style={styles.pagination}
			lightColor={backgroundLight}
			darkColor={backgroundDark}
		>
			<ThemedButton
				title={buttons.previous}
				onPress={onPrev}
				disabled={page <= 1}
				lightColor={backgroundLight}
				darkColor={backgroundDark}
				lightTextColor={page <= 1 ? mutedTextLight : undefined}
				darkTextColor={page <= 1 ? mutedTextDark : undefined}
				textStyle={styles.paginationText}
			/>
			<ThemedText lightColor={textLight} darkColor={textDark}>
				{page} / {lastPage}
			</ThemedText>
			<ThemedButton
				title={buttons.next}
				onPress={onNext}
				disabled={page >= lastPage}
				lightColor={backgroundLight}
				darkColor={backgroundDark}
				lightTextColor={page >= lastPage ? mutedTextLight : undefined}
				darkTextColor={page >= lastPage ? mutedTextDark : undefined}
				textStyle={styles.paginationText}
			/>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	pagination: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
		gap: 8,
	},
	paginationText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
