import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { fontSize, fontWeight } from '@/constants/Font';
import { formatAmount } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import TileContainer from './TileContainer';

export default function DashboardTile({
	id,
	amount = 0,
	amountType = 'double',
	title,
	iconName,
	iconColor,
	iconBackgroundColor,
	titleColor,
	backgroundColor,
	iconSize = 30,
}: {
	id: string;
	amount: number;
	backgroundColor?: string;
	title: string;
	titleColor?: string;
	iconName?: string;
	iconBackgroundColor?: string;
	iconColor?: string;
	iconSize?: number;
	amountType?: 'double' | 'number';
	language: string;
}) {
	const dayIconBg = useThemeColor({}, 'dayIconBackground');
	const dayText = useThemeColor({}, 'dayText');
	const valueText = useThemeColor({}, 'valueText');
	const surface = useThemeColor({}, 'background');
	return (
		// Same surface and shadow as every other tile: the day/week/month cards
		// used to carry their own tinted fill, which made them read differently
		// from the rest of the dashboard.
		<TileContainer id={id} backgroundColor={backgroundColor ?? surface}>
			<ThemedView
				style={{
					display: !!iconName ? 'flex' : 'none',
					position: 'relative',
					borderRadius: 50,
					width: 40,
					height: 40,
					padding: 5,
					overflow: 'hidden',
				}}
				lightColor={iconBackgroundColor || dayIconBg}
				darkColor={iconBackgroundColor || dayIconBg}
			>
				{iconName && (
					<IconSymbol
						style={{
							position: 'absolute',
							right: 0,
							bottom: -5,
						}}
						name={iconName}
						size={iconSize}
						color={iconColor || '#ffffff'}
					/>
				)}
			</ThemedView>
			<ThemedView lightColor='transparent' darkColor='transparent'>
				<ThemedText
					style={{
						fontSize: fontSize['text.large'],
						fontWeight: fontWeight['heading.two'],
					}}
					lightColor={titleColor || dayText}
					darkColor={titleColor || dayText}
				>
					{title}
				</ThemedText>
				<ThemedText
					style={{
						fontSize: fontSize['heading.one'],
						fontWeight: fontWeight['heading.two'],
					}}
					lightColor={valueText}
					darkColor={valueText}
				>
					{amountType === 'double'
						? formatAmount(typeof amount === 'number' ? amount : 0, 2)
						: formatAmount(
								typeof amount === 'number' ? amount : Number(amount ?? 0),
								0
						  )}
				</ThemedText>
			</ThemedView>
		</TileContainer>
	);
}
