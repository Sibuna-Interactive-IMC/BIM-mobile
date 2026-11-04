import OverlayContainer from '@/components/OverlayContainer';
import QrCode from '@/components/QrCode';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { translateWithVariables } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Voucher } from '@/types';
import {
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from 'react-native';

/**
 * QR preview used by the Print action: one QR per voucher with the voucher
 * number underneath, so a whole batch can be shown (and captured) at once.
 */
export default function VoucherQrPreview({
	visible,
	fadeAnim,
	vouchers,
	onClose,
}: {
	visible: boolean;
	fadeAnim: any;
	vouchers: Voucher[];
	onClose: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.vouchers;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const { height: windowHeight } = useWindowDimensions();
	// The overlay centres an auto-height wrapper, so give the sheet an explicit
	// height — it must fit at least one QR plus its number without scrolling.
	const cardHeight = Math.max(320, Math.round(windowHeight * 0.78));

	return (
		<OverlayContainer
			id='voucher-qr-preview'
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={onClose}
			contentFill
		>
			<ThemedView
				style={[styles.card, { height: cardHeight }]}
				lightColor={bg}
				darkColor={bg}
			>
				<ThemedView
					style={styles.header}
					lightColor='transparent'
					darkColor='transparent'
				>
					<ThemedText
						style={[styles.title, { color: textColor }]}
						lightColor={textColor}
						darkColor={textColor}
						numberOfLines={1}
					>
						{t.printTitle}
					</ThemedText>
					<ThemedButton
						title={buttons.close}
						onPress={onClose}
						lightColor='transparent'
						darkColor='transparent'
						lightTextColor={textColor}
						darkTextColor={textColor}
					/>
				</ThemedView>

				<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
					<View style={styles.grid}>
						{vouchers.map((voucher) => (
							<View key={voucher.username} style={styles.qrBlock}>
								<QrCode value={voucher.username} size={110} />
								<ThemedText
									style={[styles.code, { color: '#000000' }]}
									lightColor='#000000'
									darkColor='#000000'
									numberOfLines={1}
								>
									{voucher.username}
								</ThemedText>
							</View>
						))}
					</View>
				</ScrollView>

				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{translateWithVariables(t.printHint, { count: vouchers.length })}
				</ThemedText>
			</ThemedView>
		</OverlayContainer>
	);
}

const styles = StyleSheet.create({
	card: {
		width: '100%',
		borderRadius: 10,
		padding: 14,
		gap: 10,
	},
	scroll: {
		flex: 1,
		/** Keep one QR block (code + number) fully visible without scrolling. */
		minHeight: 180,
	},
	scrollContent: {
		paddingBottom: 4,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	title: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
		justifyContent: 'center',
	},
	qrBlock: {
		backgroundColor: '#FFFFFF',
		padding: 8,
		borderRadius: 6,
		alignItems: 'center',
		gap: 6,
	},
	code: {
		fontSize: fontSize['text.small'],
		fontWeight: fontWeight['button.small'],
		letterSpacing: 0.4,
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		textAlign: 'center',
	},
});
