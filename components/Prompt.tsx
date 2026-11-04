import { fontSize, fontWeight } from '@/constants/Font';
import { useThemeColor } from '@/hooks/useThemeColor';
import { PromptButton } from '@/types';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OverlayContainer from './OverlayContainer';
import { ThemedButton } from './ThemedButton';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';

export default function Prompt({
	id,
	title,
	message,
	fadeAnim,
	visible,
	onClose,
	buttons,
}: {
	id?: string;
	title: string;
	message: string;
	fadeAnim: any;
	onClose?: () => void;
	visible: boolean;
	buttons: PromptButton[];
}) {
	const bg = useThemeColor({}, 'background');
	const insets = useSafeAreaInsets();
	const titleColor = useThemeColor({}, 'screenTitleText');
	const textColor = useThemeColor({}, 'text');
	return (
		<OverlayContainer
			position='top'
			id={id}
			fadeAnim={fadeAnim}
			showOverlay={visible}
			onRequestClose={onClose}
		>
			<ThemedView
				style={{
					flexDirection: 'column',
					backgroundColor: 'white',
					padding: 20,
					borderRadius: 10,
					width: '80%',
					alignSelf: "center",
					marginTop: insets.top + 5,
					alignItems: 'center',
				}}
			>
				<ThemedView
					lightColor={bg}
					darkColor={bg}
					style={{
						width: '100%',
						marginBottom: 10,
						flexDirection: 'row',
						justifyContent: 'space-between',
						alignItems: 'center',
					}}
				>
					<ThemedText
						style={{
							fontSize: fontSize['heading.one'],
							fontWeight: fontWeight['heading.three'],
							marginBottom: 10,
							textAlign: 'left',
							alignSelf: 'flex-start',
						}}
						lightColor={titleColor}
						darkColor={titleColor}
					>
						{title}
					</ThemedText>
					{!!onClose && (
						<TouchableOpacity onPress={onClose}>
							<IconSymbol name='close' size={24} color={textColor} />
						</TouchableOpacity>
					)}
				</ThemedView>
				<ThemedText
					style={{ fontSize: 16, marginBottom: 20 }}
					lightColor={textColor}
					darkColor={textColor}
				>
					{message}
				</ThemedText>
				<ThemedView
					style={{
						flexDirection: 'row',
						justifyContent: 'flex-end',
						gap: 10,
						width: '100%',
					}}
				>
					{buttons.map((button, index) => (
						<ThemedButton
							key={index}
							lightColor={button.color}
							darkColor={button.color}
							lightTextColor={button.textColor}
							darkTextColor={button.textColor}
							title={button.title.toUpperCase()}
							onPress={button.action}
						/>
					))}
				</ThemedView>
			</ThemedView>
		</OverlayContainer>
	);
}
