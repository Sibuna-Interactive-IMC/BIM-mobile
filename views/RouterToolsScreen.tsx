import ParallaxScrollView from '@/components/ParallaxScrollView';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordBadge, RecordField } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useTrackHistory from '@/hooks/useTrackHistory';
import { fetchBusinessRouters } from '@/services/AnalyticsService';
import { fetchRouters } from '@/services/RouterService';
import {
	diagnoseRouter,
	runRouterAction,
} from '@/services/RouterToolsService';
import type {
	BusinessRouterRow,
	DiagnoseRouterResponse,
	GetBusinessRoutersResponse,
	PromptButton,
	RouterIdentityRow,
	RouterToolAction,
	RouterToolTarget,
} from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useAnimatedValue, View } from 'react-native';

import RouterToolsOverlay from '@/views/RouterToolsOverlay';

type PendingConfirm = {
	action: Extract<
		RouterToolAction,
		'push-portal' | 'link-radius-users'
	>;
};

/**
 * A deliberately small Router Tools screen: the four actions an admin reaches for
 * on a phone, one router at a time. Everything else (config comparison, all-router
 * scope, the full task board) stays on the web dashboard, which the note at the
 * bottom says.
 */
export default function RouterToolsScreen() {
	useTrackHistory('/(authenticated)/router-tools');
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.routerTools;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const mutedText = useThemeColor({}, 'screenTitleText');
	const cancelButton = useThemeColor({}, 'cancelButton');

	const [routers, setRouters] = useState<RouterToolTarget[]>([]);
	const [routerLabel, setRouterLabel] = useState('');
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const dropdownRef = useRef<View>(null);

	const [identity, setIdentity] = useState<RouterIdentityRow | null>(null);
	const [checking, setChecking] = useState(false);

	const [pending, setPending] = useState<PendingConfirm | null>(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const promptFade = useAnimatedValue(0);

	const [overlayMode, setOverlayMode] = useState<'command' | 'confirm'>('command');
	const [showOverlay, setShowOverlay] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [overlayError, setOverlayError] = useState<string | null>(null);
	const overlayFade = useAnimatedValue(0);

	const routerOptions = useMemo(
		() => routers.map((router) => router.name),
		[routers]
	);

	const selected =
		routers.find((router) => router.name === routerLabel) ?? null;

	// The web console picks a router before anything is queued; the same rule
	// holds here, so the first router is preselected as soon as the list arrives.
	useEffect(() => {
		if (!routerLabel && routers.length) setRouterLabel(routers[0].name);
	}, [routerLabel, routers]);

	const loadRouters = useCallback(async () => {
		if (!authToken || !isAdmin) return;
		setLoading(true);
		try {
			// The fleet, not the caller's routers: `/routers` is accessibility-scoped
			// (own + active account only), while the admin router leaderboard reads
			// every router in the system - the same set the web console acts on.
			const res = await fetchBusinessRouters(authToken);
			if (res.ok) {
				const body: GetBusinessRoutersResponse = await res.json();
				const fleet =
					getApiData<NonNullable<GetBusinessRoutersResponse['data']>>(body)
						?.routers ?? [];
				if (fleet.length) {
					setRouters(
						fleet.map((router: BusinessRouterRow) => ({
							id: router.id,
							name: router.name,
						}))
					);
					return;
				}
			}

			const fallback = await fetchRouters(authToken);
			if (!fallback.ok) {
				setRouters([]);
				return;
			}
			const body = await fallback.json();
			const data = getApiData<{ routers?: RouterToolTarget[] }>(body);
			setRouters(data?.routers ?? []);
		} catch (e) {
			console.error('[RouterToolsScreen] load routers failed', e);
			setRouters([]);
		} finally {
			setLoading(false);
		}
	}, [authToken, isAdmin]);

	useEffect(() => {
		void loadRouters();
	}, [loadRouters]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadRouters();
			setIdentity(null);
		} finally {
			setRefreshing(false);
		}
	}, [loadRouters]);

	const closePrompt = useCallback(() => {
		promptFade.setValue(0);
		setShowPrompt(false);
		setPending(null);
	}, [promptFade]);

	const closeOverlay = useCallback(() => {
		overlayFade.setValue(0);
		setShowOverlay(false);
		setOverlayError(null);
	}, [overlayFade]);

	const checkIdentity = useCallback(async () => {
		if (!authToken) return;
		if (!selected) {
			ShowAlert(t.routerRequired, 'Error');
			return;
		}
		setChecking(true);
		setIdentity(null);
		try {
			const res = await diagnoseRouter({ routerId: selected.id, token: authToken });
			const body: DiagnoseRouterResponse = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.diagnoseFailed, 'Error');
				return;
			}
			const payload = getApiData<NonNullable<DiagnoseRouterResponse['data']>>(
				body
			);
			setIdentity(payload?.routers?.[0] ?? null);
		} catch (e) {
			console.error('[RouterToolsScreen] diagnose failed', e);
			ShowAlert(t.diagnoseFailed, 'Error');
		} finally {
			setChecking(false);
		}
	}, [authToken, selected, t.diagnoseFailed, t.routerRequired]);

	const run = useCallback(
		async (
			action: RouterToolAction,
			extra: { confirmed?: string; command_text?: string } = {}
		) => {
			if (!authToken || !selected) return;
			setSubmitting(true);
			setOverlayError(null);
			try {
				const res = await runRouterAction(
					{
						action,
						scope: 'one',
						router_id: selected.id,
						...extra,
					},
					authToken
				);
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					// A destructive action rejected for a wrong confirmation answers
					// 422 with a field message: keep the overlay open and show it.
					if (showOverlay && extra.confirmed !== undefined) {
						setOverlayError(getApiMessage(body) || t.runFailed);
						return;
					}
					ShowAlert(getApiMessage(body) || t.runFailed, 'Error');
					return;
				}
				if (showOverlay) closeOverlay();
				ShowAlert(getApiMessage(body) || t.queuedGeneric, 'Success');
				setIdentity(null);
			} catch (e) {
				console.error('[RouterToolsScreen] run failed', e);
				ShowAlert(t.runFailed, 'Error');
			} finally {
				setSubmitting(false);
			}
		},
		[
			authToken,
			closeOverlay,
			selected,
			showOverlay,
			t.queuedGeneric,
			t.runFailed,
		]
	);

	const confirmQueue = useCallback(() => {
		if (!pending) return;
		const action = pending.action;
		closePrompt();
		void run(action);
	}, [closePrompt, pending, run]);

	const identityBadge: RecordBadge | undefined = identity
		? identity.identity.ok
			? { label: t.identityOk, tone: 'success' }
			: identity.identity.skipped
				? { label: t.identitySkipped, tone: 'muted' }
				: { label: t.identityFailed, tone: 'danger' }
		: undefined;

	const identityFields: RecordField[] = identity
		? identity.identity.ok
			? [
					{
						label: t.identityName,
						value: identity.identity.identity?.name || '—',
						fullWidth: true,
					},
					{ label: t.identityVersion, value: identity.identity.resource?.version || '—' },
					{ label: t.identityBoard, value: identity.identity.resource?.['board-name'] || '—' },
					{ label: t.identityUptime, value: identity.identity.resource?.uptime || '—' },
					{ label: t.identityCpu, value: identity.identity.resource?.['cpu-load'] ? `${identity.identity.resource['cpu-load']}%` : '—' },
					{
						label: t.identityMemory,
						value: identity.identity.resource?.['free-memory'] || '—',
					},
				]
			: [
					{
						label: t.identity,
						value: identity.identity.error || t.identityFailed,
						fullWidth: true,
						tone: 'danger',
					},
				]
		: [];

	const promptButtons: PromptButton[] = [
		{
			title: buttons.cancel,
			color: cancelButton,
			textColor: white,
			action: closePrompt,
		},
		{
			title: t.queue,
			color: bim,
			textColor: white,
			action: confirmQueue,
		},
	];

	const promptMessage =
		pending?.action === 'push-portal'
			? translateWithVariables(t.pushPortalConfirm, {
					router: selected?.name ?? '',
				})
			: translateWithVariables(t.linkRadiusConfirm, {
					router: selected?.name ?? '',
				});

	const actionCard = ({
		id,
		title,
		description,
		actionLabel,
		icon,
		tone,
		onPress,
		disabled,
	}: {
		id: string;
		title: string;
		description: string;
		actionLabel: string;
		icon: 'paperplane.fill' | 'delete.outline' | 'check';
		tone: 'primary' | 'danger';
		onPress: () => void;
		disabled?: boolean;
	}) => (
		<RecordCard
			id={id}
			title={title}
			fields={[{ label: t.router, value: selected?.name || '—' }]}
			footer={
				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{description}
				</ThemedText>
			}
			actions={[
				{
					label: actionLabel,
					icon,
					tone,
					onPress,
					disabled: disabled || !selected,
				},
			]}
		/>
	);

	return (
		<>
			<ParallaxScrollView
				headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
				containerStyle={{ flex: 1 }}
				contentStyle={{ paddingHorizontal: 10 }}
				onRefresh={handleRefresh}
				refreshing={refreshing}
			>
				<TileContainer
					id='router-tools-header-tile'
					flat
					backgroundColor={background}
					style={styles.section}
				>
					<ScreenHeader
						id='router-tools-header'
						title={t.title}
						description={isAdmin ? t.description : t.adminOnly}
						loading={loading}
					/>
				</TileContainer>

				{isAdmin ? (
					<TileContainer
						id='router-tools-tile'
						flat
						backgroundColor={background}
						style={styles.section}
					>
						<RecordList
							id='router-tools-router'
							title={t.router}
							description={t.fleetHint}
							loading={loading && routers.length === 0}
							loadingMessage={loadingCopy}
							isEmpty={!loading && routers.length === 0}
							emptyMessage={t.chooseRouter}
							// The picker's menu is absolutely positioned inside this
							// section, so the section must paint above the ones below it.
							style={openDropdown === 'router' ? styles.raised : undefined}
						>
							<ThemedDropdown
								id='router-tools-router-picker'
								containerRef={dropdownRef}
								placeholder={t.chooseRouter}
								options={routerOptions}
								value={routerLabel || t.chooseRouter}
								setValue={(value) => {
									setRouterLabel(
										value === t.chooseRouter ? '' : String(value)
									);
									// A reading belongs to the router it was taken from.
									setIdentity(null);
								}}
								showDropdown={openDropdown === 'router'}
								setShowDropdown={(open) =>
									setOpenDropdown(open ? 'router' : null)
								}
								openDirection='down'
							/>
						</RecordList>

						<RecordList
							id='router-tools-identity'
							title={t.identity}
							description={t.identityDesc}
							isEmpty={false}
						>
							{checking ? (
								<RecordCard
									id='router-tools-identity-checking'
									title={t.identityChecking}
									fields={[]}
								/>
							) : identity ? (
								<RecordCard
									id='router-tools-identity-result'
									title={identity.router?.name ?? selected?.name ?? ''}
									badge={identityBadge}
									fields={identityFields}
								/>
							) : null}

							<View style={styles.actions}>
								<ThemedButton
									title={t.identityAction}
									icon='refresh'
									onPress={() => {
										void checkIdentity();
									}}
									loading={checking}
									disabled={checking || !selected}
									numberOfLines={1}
									style={styles.actionButton}
									lightColor={bim}
									darkColor={bim}
									lightTextColor={white}
									darkTextColor={white}
									iconColor={white}
									textStyle={styles.actionText}
								/>
							</View>
						</RecordList>

						<RecordList id='router-tools-actions' isEmpty={false}>
							{actionCard({
								id: 'router-tools-push-portal',
								title: t.pushPortal,
								description: t.pushPortalDesc,
								actionLabel: t.pushPortalAction,
								icon: 'paperplane.fill',
								tone: 'primary',
								onPress: () => {
									setPending({ action: 'push-portal' });
									promptFade.setValue(1);
									setShowPrompt(true);
								},
							})}

							{actionCard({
								id: 'router-tools-link-radius',
								title: t.linkRadius,
								description: t.linkRadiusDesc,
								actionLabel: t.linkRadiusAction,
								icon: 'check',
								tone: 'primary',
								onPress: () => {
									setPending({ action: 'link-radius-users' });
									promptFade.setValue(1);
									setShowPrompt(true);
								},
							})}

							{actionCard({
								id: 'router-tools-send-command',
								title: t.sendCommand,
								description: t.sendCommandDesc,
								actionLabel: t.sendCommandAction,
								icon: 'paperplane.fill',
								tone: 'primary',
								onPress: () => {
									setOverlayMode('command');
									overlayFade.setValue(1);
									setShowOverlay(true);
								},
							})}

							{actionCard({
								id: 'router-tools-remove-cookies',
								title: t.removeCookies,
								description: t.removeCookiesDesc,
								actionLabel: t.removeCookiesAction,
								icon: 'delete.outline',
								tone: 'danger',
								onPress: () => {
									setOverlayMode('confirm');
									overlayFade.setValue(1);
									setShowOverlay(true);
								},
							})}
						</RecordList>

						<RecordList id='router-tools-note' isEmpty={false}>
							<ThemedText
								style={[styles.note, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{t.webNote}
							</ThemedText>
						</RecordList>
					</TileContainer>
				) : null}
			</ParallaxScrollView>

			<Prompt
				id='router-tools-prompt'
				fadeAnim={promptFade}
				visible={showPrompt}
				onClose={closePrompt}
				title={t.confirmTitle}
				message={promptMessage}
				buttons={promptButtons}
			/>

			<RouterToolsOverlay
				mode={overlayMode}
				visible={showOverlay}
				fadeAnim={overlayFade}
				routerName={selected?.name ?? ''}
				submitting={submitting}
				error={overlayError}
				onClose={closeOverlay}
				onSubmit={(value) => {
					if (overlayMode === 'command') {
						if (!value) {
							ShowAlert(t.sendCommandRequired, 'Error');
							return;
						}
						void run('send-command', { command_text: value });
						return;
					}
					// The server accepts the destructive action only when the typed
					// name matches the router exactly.
					void run('remove-duplicate-cookies', { confirmed: value });
				}}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	/** Lifts the section owning the open dropdown above the sections below it. */
	raised: {
		zIndex: 20,
		elevation: 20,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		gap: 10,
	},
	actionButton: {
		flex: 1,
		minWidth: 0,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
	},
	note: {
		fontSize: fontSize['text.medium'],
		lineHeight: 19,
	},
});
