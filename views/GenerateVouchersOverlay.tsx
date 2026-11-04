import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import { fetchVoucherHotspots, generateVouchers } from '@/services/VoucherService';
import type {
	GetGeneratedVouchersResponse,
	GetVoucherHotspotsResponse,
	Hotspot,
	SharedRadiusProfile,
} from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 100;
const DEFAULT_QUANTITY = '10';

function profileLabel(profile: SharedRadiusProfile) {
	return profile.display_name || profile.name;
}

function Hint({ text }: { text: string }) {
	const mutedText = useThemeColor({}, 'mutedText');

	return (
		<ThemedText
			style={[styles.hint, { color: mutedText }]}
			lightColor={mutedText}
			darkColor={mutedText}
		>
			{text}
		</ThemedText>
	);
}

/** Single dropdown with its own open state, so the overlay never re-renders mid-press. */
function FormDropdown({
	id,
	label,
	placeholder,
	value,
	options,
	hint,
	onSelect,
}: {
	id: string;
	label: string;
	placeholder: string;
	value: string;
	options: string[];
	hint: string;
	onSelect: (value: string) => void;
}) {
	const [showDropdown, setShowDropdown] = useState(false);
	const containerRef = useRef<View>(null);

	return (
		// Raise the field while its menu is open, otherwise the menu paints
		// behind the fields below it.
		<View style={[styles.field, showDropdown && styles.fieldRaised]}>
			<ThemedDropdown
				id={id}
				containerRef={containerRef}
				label={label}
				labelStyle={styles.fieldLabel}
				placeholder={placeholder}
				options={options}
				value={value}
				setValue={onSelect}
				showDropdown={showDropdown}
				setShowDropdown={setShowDropdown}
				openDirection='down'
			/>
			<Hint text={hint} />
		</View>
	);
}

/**
 * The bulk generator the web exposes at /vouchers/bulk/create, as a modal:
 * router, RADIUS profile, hotspot server and quantity are the inputs the
 * `POST /vouchers/{routerId}/generate` endpoint takes.
 */
export default function GenerateVouchersOverlay({
	visible,
	fadeAnim,
	authToken,
	routers,
	profiles,
	initialRouterId,
	onClose,
	onGenerated,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	routers: { id: string; name: string }[];
	profiles: SharedRadiusProfile[];
	initialRouterId?: string;
	onClose: () => void;
	onGenerated: (count: number) => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.vouchers;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const mutedText = useThemeColor({}, 'mutedText');

	const [routerName, setRouterName] = useState('');
	const [profileName, setProfileName] = useState('');
	const [hotspotName, setHotspotName] = useState('');
	const [quantity, setQuantity] = useState(DEFAULT_QUANTITY);
	const [hotspots, setHotspots] = useState<Hotspot[]>([]);
	const [loadingHotspots, setLoadingHotspots] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const wasVisible = useRef(false);

	const routerOptions = useMemo(
		() => routers.map((router) => router.name),
		[routers]
	);
	const profileOptions = useMemo(
		() => profiles.map(profileLabel),
		[profiles]
	);
	const hotspotOptions = useMemo(
		() => hotspots.map((hotspot) => hotspot.name).filter(Boolean),
		[hotspots]
	);

	const routerId = useMemo(
		() => routers.find((router) => router.name === routerName)?.id ?? '',
		[routers, routerName]
	);

	// Reset the form each time the modal opens, prefilled with the router in view.
	useEffect(() => {
		if (visible && !wasVisible.current) {
			setRouterName(
				routers.find((router) => router.id === initialRouterId)?.name ?? ''
			);
			setProfileName('');
			setHotspotName('');
			setQuantity(DEFAULT_QUANTITY);
		}
		wasVisible.current = visible;
	}, [visible, initialRouterId, routers]);

	useEffect(() => {
		if (!visible || !routerId) {
			setHotspots([]);
			return;
		}
		let cancelled = false;
		setLoadingHotspots(true);
		(async () => {
			try {
				const res = await fetchVoucherHotspots(routerId, authToken);
				const body: GetVoucherHotspotsResponse | null = await res
					.json()
					.catch(() => null);
				const list = res.ok
					? (getApiData<NonNullable<GetVoucherHotspotsResponse['data']>>(body)
							?.hotspots ?? [])
					: [];
				if (cancelled) return;
				setHotspots(list);
				// Most routers run a single hotspot server, so preselect it.
				setHotspotName((current) => {
					const names = list.map((hotspot) => hotspot.name).filter(Boolean);
					return current && names.includes(current)
						? current
						: (names[0] ?? '');
				});
			} catch (e) {
				if (cancelled) return;
				console.error('[GenerateVouchers] hotspots failed', e);
				setHotspots([]);
			} finally {
				if (!cancelled) setLoadingHotspots(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [visible, routerId, authToken]);

	const handleSubmit = useCallback(async () => {
		if (!routerId) {
			ShowAlert(t.generateRouterRequired, 'Error');
			return;
		}
		const profile = profiles.find(
			(item) => profileLabel(item) === profileName
		)?.name;
		if (!profile) {
			ShowAlert(t.generateProfileRequired, 'Error');
			return;
		}
		if (!hotspotName) {
			ShowAlert(t.generateHotspotRequired, 'Error');
			return;
		}
		const count = Number.parseInt(quantity, 10);
		if (
			!Number.isFinite(count) ||
			count < MIN_QUANTITY ||
			count > MAX_QUANTITY
		) {
			ShowAlert(t.generateQuantityInvalid, 'Error');
			return;
		}

		setSubmitting(true);
		try {
			const res = await generateVouchers(
				routerId,
				{ numberOfUsers: count, profile, hotspotServer: hotspotName },
				authToken
			);
			const body: GetGeneratedVouchersResponse | null = await res
				.json()
				.catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.generateFailed, 'Error');
				return;
			}
			const created =
				getApiData<NonNullable<GetGeneratedVouchersResponse['data']>>(body)
					?.users ?? [];
			ShowAlert(
				translateWithVariables(t.generateSuccess, { count: created.length }),
				'Success'
			);
			onGenerated(created.length);
			onClose();
		} catch (e) {
			console.error('[GenerateVouchers] generate failed', e);
			ShowAlert(t.generateFailed, 'Error');
		} finally {
			setSubmitting(false);
		}
	}, [
		authToken,
		hotspotName,
		onClose,
		onGenerated,
		profileName,
		profiles,
		quantity,
		routerId,
		t.generateFailed,
		t.generateHotspotRequired,
		t.generateProfileRequired,
		t.generateQuantityInvalid,
		t.generateRouterRequired,
		t.generateSuccess,
	]);

	return (
		<OverlayContainer
			id='generate-vouchers-overlay'
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={onClose}
			scrollable
			autoKeyboardInset
			bottomPadding={16}
			keyboardGap={40}
			centerLiftOnKeyboard
			centerLiftRatio={0.9}
		>
			<ThemedView
				style={[styles.card, { backgroundColor: bg }]}
				lightColor={bg}
				darkColor={bg}
			>
				<ThemedText
					style={[styles.title, { color: screenTitleText }]}
					lightColor={screenTitleText}
					darkColor={screenTitleText}
				>
					{t.generateTitle}
				</ThemedText>

				<FormDropdown
					id='generate-router'
					label={t.generateRouter}
					placeholder={t.generateRouterPlaceholder}
					value={routerName}
					options={routerOptions}
					hint={t.generateRouterHint}
					onSelect={setRouterName}
				/>

				<FormDropdown
					id='generate-profile'
					label={t.generateProfile}
					placeholder={t.generateProfilePlaceholder}
					value={profileName}
					options={profileOptions}
					hint={t.generateProfileHint}
					onSelect={setProfileName}
				/>

				<FormDropdown
					id='generate-hotspot'
					label={t.generateHotspot}
					placeholder={t.generateHotspotPlaceholder}
					value={hotspotName}
					options={hotspotOptions}
					hint={
						loadingHotspots
							? t.generateLoadingHotspots
							: routerId && hotspotOptions.length === 0
								? t.generateNoHotspots
								: t.generateHotspotHint
					}
					onSelect={setHotspotName}
				/>

				<View style={styles.field}>
					<ThemedInput
						label={t.generateQuantity}
						labelStyle={styles.fieldLabel}
						placeholder={DEFAULT_QUANTITY}
						keyboardType='number-pad'
						value={quantity}
						setValue={setQuantity}
						style={{
							backgroundColor: bg,
							borderColor: mutedText,
							borderWidth: 1,
						}}
					/>
					<Hint text={t.generateQuantityHint} />
				</View>

				<Hint text={t.generateNote} />

				<View style={styles.actions}>
					<ThemedButton
						title={buttons.cancel}
						onPress={onClose}
						disabled={submitting}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={cancelButton}
						darkColor={cancelButton}
						lightTextColor={white}
						darkTextColor={white}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={t.generate}
						icon='plus'
						onPress={handleSubmit}
						loading={submitting}
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
			</ThemedView>
		</OverlayContainer>
	);
}

const styles = StyleSheet.create({
	card: {
		width: '100%',
		borderRadius: 10,
		padding: 16,
		gap: 10,
	},
	title: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	field: {
		gap: 4,
	},
	fieldLabel: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['heading.two'],
	},
	fieldRaised: {
		zIndex: 10,
		elevation: 10,
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 6,
	},
	actionButton: {
		minWidth: 110,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
});
