import ParallaxScrollView from '@/components/ParallaxScrollView';
import ScreenHeader from '@/components/ScreenHeader';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { getApiData } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchBroadcasts } from '@/services/BroadcastService';
import type {
	BroadcastLimits,
	BroadcastSite,
	BroadcastTemplate,
	GetBroadcastsResponse,
} from '@/types';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useAnimatedValue } from 'react-native';

import BroadcastComposePanel from '@/views/BroadcastComposePanel';
import BroadcastHistoryPanel from '@/views/BroadcastHistoryPanel';
import BroadcastTemplateOverlay from '@/views/BroadcastTemplateOverlay';
import BroadcastTemplatesPanel from '@/views/BroadcastTemplatesPanel';

type Tab = 'compose' | 'history' | 'templates';

/**
 * `GET /admin/broadcasts` — the SMS composer, the message history and the saved
 * templates, over the same three tabs as the web page (admin only).
 *
 * The composer's support data (sites, templates, limits) rides on the history
 * payload, so one request seeds the whole screen.
 */
export default function BroadcastsScreen() {
	useTrackHistory('/(authenticated)/broadcasts');
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.broadcast;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');

	const [tab, setTab] = useState<Tab>('compose');
	const [sites, setSites] = useState<BroadcastSite[]>([]);
	const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
	const [limits, setLimits] = useState<BroadcastLimits | null>(null);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	/** Bumped to make the history panel reload after a send or a template change. */
	const [reloadKey, setReloadKey] = useState(0);

	const [showTemplate, setShowTemplate] = useState(false);
	const templateFade = useAnimatedValue(0);

	const loadSupport = useCallback(async () => {
		if (!authToken || !isAdmin) return;
		setLoading(true);
		try {
			const res = await fetchBroadcasts(authToken, { perPage: 1 });
			if (!res.ok) return;
			const body: GetBroadcastsResponse = await res.json();
			const payload = getApiData<NonNullable<GetBroadcastsResponse['data']>>(body);
			setSites(payload?.sites ?? []);
			setTemplates(payload?.templates ?? []);
			setLimits(payload?.limits ?? null);
		} catch (e) {
			console.error('[BroadcastsScreen] load support failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken, isAdmin]);

	useEffect(() => {
		void loadSupport();
	}, [loadSupport]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadSupport();
			setReloadKey((key) => key + 1);
		} finally {
			setRefreshing(false);
		}
	}, [loadSupport]);

	// The history panel carries the same support data, so keep the composer's
	// site/template lists in step with whatever it fetched.
	const absorbHistoryPayload = useCallback((body: GetBroadcastsResponse) => {
		const payload = getApiData<NonNullable<GetBroadcastsResponse['data']>>(body);
		if (payload?.sites) setSites(payload.sites);
		if (payload?.templates) setTemplates(payload.templates);
		if (payload?.limits) setLimits(payload.limits);
	}, []);

	const tabs = [
		{ key: 'compose', label: t.tabCompose, icon: 'paperplane.fill' as const },
		{ key: 'history', label: t.tabHistory, icon: 'clock' as const },
		{ key: 'templates', label: t.tabTemplates, icon: 'documents' as const },
	];

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='broadcasts-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='broadcasts-header'
					title={t.title}
					description={isAdmin ? t.description : t.adminOnly}
					loading={loading}
					action={
						isAdmin && tab === 'templates' ? (
							<ThemedButton
								title={t.createTemplate}
								icon='plus'
								numberOfLines={1}
								onPress={() => {
									templateFade.setValue(1);
									setShowTemplate(true);
								}}
								lightColor={bim}
								darkColor={bim}
								lightTextColor={white}
								darkTextColor={white}
								iconColor={white}
							/>
						) : undefined
					}
				>
					{isAdmin ? (
						<SegmentedTabs
							tabs={tabs}
							activeKey={tab}
							onChange={(key) => setTab(key as Tab)}
						/>
					) : null}
				</ScreenHeader>
			</TileContainer>

			{isAdmin ? (
				<TileContainer
					id='broadcasts-content-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					{tab === 'compose' ? (
						<BroadcastComposePanel
							authToken={authToken ?? undefined}
							sites={sites}
							templates={templates}
							limits={limits}
							onQueued={() => {
								setTab('history');
								setReloadKey((key) => key + 1);
							}}
						/>
					) : null}

					{tab === 'history' ? (
						<BroadcastHistoryPanel
							key={`history-${reloadKey}`}
							authToken={authToken ?? undefined}
							sites={sites}
							onLoaded={absorbHistoryPayload}
						/>
					) : null}

					{tab === 'templates' ? (
						<BroadcastTemplatesPanel
							authToken={authToken ?? undefined}
							templates={templates}
							loading={loading}
							onDeleted={() => {
								void loadSupport();
							}}
						/>
					) : null}
				</TileContainer>
			) : null}

			<BroadcastTemplateOverlay
				visible={showTemplate}
				fadeAnim={templateFade}
				authToken={authToken ?? undefined}
				limits={limits}
				onClose={() => {
					templateFade.setValue(0);
					setShowTemplate(false);
				}}
				onSaved={() => {
					void loadSupport();
				}}
			/>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
});
