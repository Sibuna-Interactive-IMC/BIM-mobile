import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { translateWithVariables } from '@/helpers';
import { buildApprovalBanners } from '@/helpers/approvalBanners';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { DashboardApprovalCounts, langCode } from '@/types';

/**
 * The mobile equivalent of the web dashboard's approval cards. Renders only
 * the cards that have rows: a yellow Pending Approvals card (owner
 * withdrawals) and a red Profit Withdrawals card (platform admins).
 */
export default function ApprovalBanners({
	id,
	counts,
	language,
}: {
	id?: string;
	counts?: DashboardApprovalCounts | null;
	language: langCode;
}) {
	const router = useRouter();
	const yellow = useThemeColor({}, 'yellow');
	const danger = useThemeColor({}, 'dangerButton');
	const white = useThemeColor({}, 'white');
	const darkText = useThemeColor({}, 'valueText');
	const copy = translations[language].categories.dashboard;

	const banners = buildApprovalBanners(counts);
	if (banners.length === 0) return null;

	return (
		<View id={id ?? 'approval-banners'} style={styles.container}>
			{banners.map((banner) => {
				const isProfit = banner.id === 'profit';
				const background = isProfit ? danger : yellow;
				const color = isProfit ? white : darkText;
				const title = isProfit
					? copy.profitWithdrawals
					: copy.pendingApprovals;
				const summary =
					banner.actionCount > 0 && banner.awaitingCount > 0
						? translateWithVariables(copy.approvalSummary, {
								action: banner.actionCount,
								awaiting: banner.awaitingCount,
							})
						: banner.actionCount > 0
							? translateWithVariables(copy.approvalActionSummary, {
									count: banner.actionCount,
								})
							: translateWithVariables(copy.approvalAwaitingSummary, {
									count: banner.awaitingCount,
								});
				return (
					<Pressable
						key={banner.id}
						accessibilityRole='button'
						accessibilityLabel={`${title}. ${summary}`}
						onPress={() => router.push(banner.route)}
						style={({ pressed }) => [
							styles.banner,
							{ backgroundColor: background },
							pressed && styles.pressed,
						]}
					>
						<IconSymbol
							name={isProfit ? 'cash' : 'clock'}
							size={36}
							color={color}
						/>
						<View style={styles.body}>
							<ThemedText
								lightColor={color}
								darkColor={color}
								style={styles.title}
							>
								{title}
							</ThemedText>
							<ThemedText
								lightColor={color}
								darkColor={color}
								style={styles.count}
							>
								{banner.total}
							</ThemedText>
							<ThemedText
								lightColor={color}
								darkColor={color}
								style={styles.summary}
							>
								{summary}
							</ThemedText>
						</View>
						<IconSymbol name='chevron.right' size={18} color={color} />
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: '100%',
		gap: 12,
	},
	banner: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		padding: 16,
		borderRadius: 8,
	},
	pressed: {
		opacity: 0.85,
	},
	body: {
		flex: 1,
		gap: 2,
	},
	title: {
		fontSize: fontSize['text.large'],
		fontWeight: fontWeight['heading.two'],
	},
	count: {
		fontSize: fontSize['heading.one'],
		fontWeight: fontWeight['heading.two'],
		lineHeight: 30,
	},
	summary: {
		fontSize: fontSize['text.xsmall'],
	},
});
