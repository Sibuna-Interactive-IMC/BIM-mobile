import ParallaxScrollView from '@/components/ParallaxScrollView';
import useAccountsBack from '@/hooks/useAccountsBack';
import { RecordCard, RecordList } from '@/components/RecordList';
import TileContainer from '@/components/TileContainer';
import { ThemedView } from '@/components/ThemedView';
import translations from '@/constants/Trans';
import { formatAmount } from '@/helpers';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import WithdrawFunds from '@/views/WithdrawFunds';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

export default function WithdrawScreen() {
	const bg = useThemeColor({}, 'background');
	const { routers, fetchRouters } = useTransaction();
	const { user, language, authToken } = useGeneral();

	const [refreshing, setRefreshing] = useState(false);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			if (user) await fetchRouters();
			else await fetchRouters();
		} catch (e) {
			console.error('[WithdrawScreen] refresh failed', e);
		} finally {
			setRefreshing(false);
		}
	}, [fetchRouters, user]);

	useTrackHistory('/(authenticated)/withdraw');
	useAccountsBack();

	useEffect(() => {
		if (user && routers?.length === 0) {
			(async () => {
				await fetchRouters();
			})();
		}
	}, [user, routers, fetchRouters]);

	const [showWithdraw, setShowWithdraw] = useState(false);
	const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);

	const currency = useMemo(
		() => translations[language].categories.dashboard.currency ?? 'UGX',
		[language]
	);

	const selectedRouter = useMemo(
		() => routers?.find((r) => r.id === selectedRouterId) || null,
		[routers, selectedRouterId]
	);

	const handleWithdrawRouter = (routerId: string) => {
		if (!routerId) return;
		setSelectedRouterId(routerId);
		setShowWithdraw(true);
	};

	const handleCancelWithdraw = () => {
		setShowWithdraw(false);
	};

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: bg, dark: bg }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
		<ThemedView lightColor={bg} darkColor={bg} style={styles.container}>
			<TileContainer
				id='withdraw-list-tile'
				flat
				backgroundColor={bg}
				style={{ flexDirection: 'column' }}
			>
				<RecordList
					id='withdraw-router-list'
					title={translations[language].categories.withdraw.title}
					description={
						translations[language].categories.withdraw.subtitle
					}
					isEmpty={routers?.length === 0}
					emptyMessage={translations[language].categories.withdraw.noRouters}
				>
					{routers?.map((r) => (
						<RecordCard
							key={r.id}
							id={`withdraw-router-${r.id}`}
							title={r.name}
							subtitle={r.location}
							fields={[
								{
									label: translations[language].categories.dashboard.ipAddress,
									value: r.ip_address || 'N/A',
								},
								{
									label: translations[language].categories.dashboard.balance,
									value: `${formatAmount(r.balance)} ${currency}`,
								},
							]}
							actions={[
								{
									label: translations[language].categories.buttons.withdraw,
									icon: 'withdrawal',
									tone: 'primary',
									onPress: () => handleWithdrawRouter(r.id),
								},
							]}
						/>
					))}
				</RecordList>
			</TileContainer>
			{selectedRouter && (
				<WithdrawFunds
					visible={showWithdraw}
					routerId={selectedRouter.id}
					routerName={selectedRouter.name}
					currency={currency}
					authToken={authToken ?? undefined}
					balance={selectedRouter.balance}
					onCancel={handleCancelWithdraw}
					onCompleted={() => {
						void fetchRouters();
					}}
				/>
			)}
			</ThemedView>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
