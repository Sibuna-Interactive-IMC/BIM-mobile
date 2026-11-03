import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordBadge, RecordField } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedRadioButtons } from '@/components/ThemedRadioButtons';
import { ThemedText } from '@/components/ThemedText';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatDateTime, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { isPlatformAdmin } from '@/helpers/permissions';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import {
	fetchPaymentRouting,
	setPaymentProvider,
} from '@/services/PaymentGatewayService';
import type {
	GetPaymentRoutingResponse,
	PaymentProviderHealth,
	PaymentProviderRouting,
} from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const AUTO = 'auto';

/**
 * `GET /admin/payment-provider`: which gateway takes collections right now,
 * each provider's circuit breaker, and the manual override (admin only).
 */
export default function PaymentGatewayScreen() {
	useTrackHistory('/(authenticated)/payment-gateway');
	// Reached from the Accounts hub, so the header steps back to it.
	useAccountsBack();
	const { language, authToken, user } = useGeneral();
	const t = translations[language].categories.paymentGateway;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const isAdmin = isPlatformAdmin(user);

	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	// Faint greys are unreadable at hint size, so hints use the darker slate.
	const hintText = useThemeColor({}, 'screenTitleText');

	const [routing, setRouting] = useState<PaymentProviderRouting | null>(null);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [saving, setSaving] = useState(false);
	/** Null until the admin picks a different route than the saved one. */
	const [choice, setChoice] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!authToken || !isAdmin) return;
		setLoading(true);
		try {
			const res = await fetchPaymentRouting(authToken);
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				ShowAlert(getApiMessage(body) || t.loadFailed, 'Error');
				setRouting(null);
				return;
			}
			const body: GetPaymentRoutingResponse = await res.json();
			const data = getApiData<NonNullable<GetPaymentRoutingResponse['data']>>(
				body
			);
			setRouting(data?.payment_provider ?? null);
			setChoice(null);
		} catch (e) {
			console.error('[PaymentGatewayScreen] load failed', e);
			ShowAlert(t.loadFailed, 'Error');
		} finally {
			setLoading(false);
		}
	}, [authToken, isAdmin, t.loadFailed]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await load();
		} finally {
			setRefreshing(false);
		}
	}, [load]);

	const savedChoice = routing?.mode === 'forced' ? (routing.forced ?? AUTO) : AUTO;
	const selected = choice ?? savedChoice;

	const providers = useMemo(() => {
		if (!routing?.providers) return [];
		return [routing.primary, routing.secondary]
			.map((key) => routing.providers[key])
			.filter((health): health is PaymentProviderHealth => Boolean(health));
	}, [routing]);

	const save = useCallback(async () => {
		if (!authToken || selected === savedChoice) return;
		setSaving(true);
		try {
			const res = await setPaymentProvider(selected, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				return;
			}
			ShowAlert(getApiMessage(body) || t.saved, 'Success');
			await load();
		} catch (e) {
			console.error('[PaymentGatewayScreen] save failed', e);
			ShowAlert(t.saveFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [authToken, load, savedChoice, selected, t.saveFailed, t.saved]);

	const modeBadge: RecordBadge =
		routing?.mode === 'forced'
			? { label: t.modeForced, tone: 'warning' }
			: { label: t.modeAuto, tone: 'success' };

	const routingFields: RecordField[] = routing
		? [
				{ label: t.activeProvider, value: routing.active_label, tone: 'success' },
				...(routing.mode === 'forced'
					? [
							{
								label: t.forcedProvider,
								value:
									routing.providers?.[routing.forced ?? '']?.label ??
									routing.forced ??
									'—',
								tone: 'warning' as const,
							},
							{
								label: t.forcedSince,
								value: formatDateTime(routing.forced_since),
							},
						]
					: []),
				{
					label: t.primaryProvider,
					value: routing.providers?.[routing.primary]?.label ?? routing.primary,
				},
				{
					label: t.secondaryProvider,
					value:
						routing.providers?.[routing.secondary]?.label ?? routing.secondary,
				},
			]
		: [];

	const providerFields = (health: PaymentProviderHealth): RecordField[] => [
		{
			label: t.circuit,
			value: health.open ? t.circuitOpen : t.circuitClosed,
			tone: health.open ? 'danger' : 'success',
		},
		{
			label: t.consecutiveFailures,
			value: String(health.consecutive_failures ?? 0),
			tone: health.consecutive_failures > 0 ? 'warning' : 'default',
		},
		{
			label: t.backoff,
			value:
				health.backoff_minutes > 0
					? translateWithVariables(t.backoffMinutes, {
							minutes: health.backoff_minutes,
						})
					: '—',
		},
		{ label: t.lastFailure, value: formatDateTime(health.last_failure_at) },
		{ label: t.nextProbe, value: formatDateTime(health.probe_due_at) },
		{ label: t.lastSuccess, value: formatDateTime(health.last_success_at) },
	];

	const overrideOptions = routing
		? [
				{
					key: AUTO,
					label: t.modeAuto,
					description: translateWithVariables(t.optionAutoHint, {
						primary: routing.providers?.[routing.primary]?.label ?? '',
						secondary: routing.providers?.[routing.secondary]?.label ?? '',
					}),
				},
				...[routing.primary, routing.secondary].map((key) => ({
					key,
					label: translateWithVariables(t.optionForce, {
						provider: routing.providers?.[key]?.label ?? key,
					}),
					description: translateWithVariables(t.optionForceHint, {
						provider: routing.providers?.[key]?.label ?? key,
					}),
				})),
			]
		: [];

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: backgroundLight, dark: backgroundDark }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
			onRefresh={handleRefresh}
			refreshing={refreshing}
		>
			<TileContainer
				id='payment-gateway-header-tile'
				flat
				backgroundColor={background}
				style={styles.section}
			>
				<ScreenHeader
					id='payment-gateway-header'
					title={t.title}
					description={isAdmin ? t.description : t.adminOnly}
					loading={loading}
				/>
			</TileContainer>

			{isAdmin ? (
				<TileContainer
					id='payment-gateway-content-tile'
					flat
					backgroundColor={background}
					style={styles.content}
				>
					<RecordList
						id='payment-gateway-routing'
						title={t.routing}
						description={
							routing
								? translateWithVariables(t.goesThrough, {
										provider: routing.active_label,
									})
								: undefined
						}
						loading={loading && !routing}
						loadingMessage={loadingCopy}
						isEmpty={!loading && !routing}
						emptyMessage={t.loadFailed}
					>
						<RecordCard
							id='payment-gateway-routing-card'
							badge={modeBadge}
							fields={routingFields}
							footer={
								routing ? (
									<ThemedText
										style={[styles.hint, { color: hintText }]}
										lightColor={hintText}
										darkColor={hintText}
									>
										{routing.mode === 'forced'
											? translateWithVariables(t.forcedExplanation, {
													since: formatDateTime(routing.forced_since),
												})
											: translateWithVariables(t.autoExplanation, {
													primary:
														routing.providers?.[routing.primary]?.label ??
														routing.primary,
													secondary:
														routing.providers?.[routing.secondary]?.label ??
														routing.secondary,
												})}
									</ThemedText>
								) : undefined
							}
						/>
					</RecordList>

					{routing?.forcing_open_primary ? (
						<RecordCard
							id='payment-gateway-canary'
							title={t.canaryTitle}
							badge={{ label: t.circuitOpen, tone: 'danger' }}
							fields={[
								{
									label: t.activeProvider,
									value: routing.active_label,
									tone: 'danger',
									fullWidth: true,
								},
							]}
							footer={
								<ThemedText
									style={[styles.hint, { color: hintText }]}
									lightColor={hintText}
									darkColor={hintText}
								>
									{translateWithVariables(t.canaryWarning, {
										provider: routing.active_label,
										secondary:
											routing.providers?.[routing.secondary]?.label ??
											routing.secondary,
									})}
								</ThemedText>
							}
						/>
					) : null}

					<RecordList
						id='payment-gateway-providers'
						title={t.providers}
						description={t.providersDescription}
						loading={loading && providers.length === 0}
						loadingMessage={loadingCopy}
						isEmpty={!loading && providers.length === 0}
						emptyMessage={t.loadFailed}
					>
						{providers.map((health) => {
							const isActive = routing?.active === health.provider;
							return (
								<RecordCard
									key={health.provider}
									id={`payment-gateway-provider-${health.provider}`}
									title={health.label}
									subtitle={
										health.role === 'primary'
											? t.primaryRole
											: t.secondaryRole
									}
									badge={
										isActive
											? { label: t.active, tone: 'info' }
											: health.open
												? { label: t.circuitOpen, tone: 'danger' }
												: undefined
									}
									fields={providerFields(health)}
								/>
							);
						})}
					</RecordList>

					<RecordList
						id='payment-gateway-override'
						title={t.override}
						description={t.overrideDescription}
						loading={loading && !routing}
						loadingMessage={loadingCopy}
						isEmpty={!loading && !routing}
						emptyMessage={t.loadFailed}
					>
						<View style={styles.override}>
							<ThemedRadioButtons
								id='payment-gateway-override-choice'
								options={overrideOptions}
								value={selected}
								onChange={setChoice}
								disabled={saving}
							/>
							<View style={styles.actions}>
								<ThemedButton
									title={buttons.cancel}
									onPress={() => setChoice(null)}
									disabled={choice === null || saving}
									numberOfLines={1}
									style={styles.actionButton}
									lightColor='transparent'
									darkColor='transparent'
									lightTextColor={bim}
									darkTextColor={bim}
									textStyle={styles.actionText}
								/>
								<ThemedButton
									title={t.saveRouting}
									icon='check'
									onPress={() => {
										void save();
									}}
									loading={saving}
									disabled={selected === savedChoice || saving}
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
							<ThemedText
								style={[styles.hint, { color: hintText }]}
								lightColor={hintText}
								darkColor={hintText}
							>
								{t.cliHint}
							</ThemedText>
						</View>
					</RecordList>
				</TileContainer>
			) : null}
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	section: {
		width: '100%',
		gap: 10,
	},
	content: {
		width: '100%',
		gap: 12,
	},
	override: {
		width: '100%',
		gap: 8,
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
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
});
