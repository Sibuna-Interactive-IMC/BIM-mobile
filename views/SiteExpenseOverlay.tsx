import OverlayContainer from '@/components/OverlayContainer';
import ThemedDatePicker from '@/components/ThemedDatePicker';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { parseAmount, ShowAlert, toApiDate, translateWithVariables } from '@/helpers';
import { getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import useSiteCompensationOptions from '@/hooks/useSiteCompensationOptions';
import { createSiteExpense, updateExpenseCompensation } from '@/services/SiteService';
import type { SiteAccessPoint, SiteExpense, SiteExpenseCategory } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const CATEGORY_KEYS: SiteExpenseCategory[] = [
	'rent',
	'electricity',
	'maintenance',
	'equipment',
	'other',
];

type Mode = 'create' | 'compensation';

/**
 * `POST /sites/{router}/expenses` for a new expense, or
 * `POST /sites/{router}/expenses/{id}/compensation` to relink the existing one.
 */
export default function SiteExpenseOverlay({
	visible,
	fadeAnim,
	authToken,
	routerId,
	routerName,
	accessPoints,
	expense,
	onClose,
	onSaved,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	routerId: string;
	routerName: string;
	accessPoints: SiteAccessPoint[];
	/** Set to edit compensation; leave null to record a new expense. */
	expense?: SiteExpense | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.sites;
	const buttons = translations[language].categories.buttons;
	const mode: Mode = expense ? 'compensation' : 'create';

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const inputBorder = useThemeColor({}, 'inputBorder');

	const { disbursements, vouchers, loading: optionsLoading } =
		useSiteCompensationOptions(routerId, authToken, visible);

	const [appliesTo, setAppliesTo] = useState('');
	const [category, setCategory] = useState('');
	const [amount, setAmount] = useState('');
	const [description, setDescription] = useState('');
	const [incurredOn, setIncurredOn] = useState<Date | null>(null);
	const [compensationType, setCompensationType] = useState('');
	const [disbursement, setDisbursement] = useState('');
	const [voucher, setVoucher] = useState('');
	const [saving, setSaving] = useState(false);
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);

	const appliesToRef = useRef<View>(null);
	const categoryRef = useRef<View>(null);
	const compensationRef = useRef<View>(null);
	const disbursementRef = useRef<View>(null);
	const voucherRef = useRef<View>(null);

	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	const categoryOptions = useMemo(
		() => [
			t.categoryRent,
			t.categoryElectricity,
			t.categoryMaintenance,
			t.categoryEquipment,
			t.categoryOther,
		],
		[
			t.categoryElectricity,
			t.categoryEquipment,
			t.categoryMaintenance,
			t.categoryOther,
			t.categoryRent,
		]
	);

	const appliesToOptions = useMemo(
		() => [
			translateWithVariables(t.routerWide, { name: routerName }),
			...accessPoints.map((ap) =>
				translateWithVariables(t.accessPointOption, {
					label: ap.label || ap.name,
				})
			),
		],
		[accessPoints, routerName, t.accessPointOption, t.routerWide]
	);

	const compensationOptions = [
		t.compensationNone,
		t.compensationCash,
		t.compensationVoucher,
	];

	const disbursementOptions = useMemo(
		() => [
			t.selectDisbursement,
			...disbursements.map((option) => option.label),
		],
		[disbursements, t.selectDisbursement]
	);

	const voucherOptions = useMemo(
		() => [t.selectVoucher, ...vouchers.map((entry) => entry.username)],
		[t.selectVoucher, vouchers]
	);

	const isCash = compensationType === t.compensationCash;
	const isVoucher = compensationType === t.compensationVoucher;

	const compensationPayload = useMemo(
		() => ({
			compensation_type: (isCash
				? 'cash'
				: isVoucher
					? 'voucher'
					: null) as 'cash' | 'voucher' | null,
			disbursement_record_id: isCash
				? (disbursements.find((option) => option.label === disbursement)?.id ??
					null)
				: null,
			voucher_user_id: isVoucher
				? (vouchers.find((entry) => entry.username === voucher)?.id ?? null)
				: null,
		}),
		[disbursement, disbursements, isCash, isVoucher, voucher, vouchers]
	);

	useEffect(() => {
		if (!visible) return;
		if (expense) {
			setCompensationType(
				expense.compensation?.type === 'cash'
					? t.compensationCash
					: expense.compensation?.type === 'voucher'
						? t.compensationVoucher
						: t.compensationNone
			);
			setDisbursement(expense.compensation?.disbursement_label ?? '');
			setVoucher(expense.compensation?.voucher_username ?? '');
			return;
		}
		setAppliesTo(appliesToOptions[0] ?? '');
		setCategory(categoryOptions[0] ?? '');
		setAmount('');
		setDescription('');
		setIncurredOn(null);
		setCompensationType(t.compensationNone);
		setDisbursement('');
		setVoucher('');
		// Seeding depends on the options, but re-seeding on every options change
		// would wipe what the user typed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible, expense]);

	const submit = useCallback(async () => {
		if (!authToken) return;
		if (mode === 'create' && !amount.trim()) {
			ShowAlert(t.amountRequired, 'Error');
			return;
		}
		if (isCash && !compensationPayload.disbursement_record_id) {
			ShowAlert(t.selectDisbursementFirst, 'Error');
			return;
		}
		if (isVoucher && !compensationPayload.voucher_user_id) {
			ShowAlert(t.selectVoucherFirst, 'Error');
			return;
		}

		setSaving(true);
		try {
			const res = expense
				? await updateExpenseCompensation(
						routerId,
						expense.id,
						compensationPayload,
						authToken
					)
				: await createSiteExpense(
						routerId,
						{
							category:
								CATEGORY_KEYS[categoryOptions.indexOf(category)] ?? 'other',
							amount: parseAmount(amount),
							description: description.trim() || null,
							incurred_on: toApiDate(incurredOn),
							access_point_id:
								appliesToOptions.indexOf(appliesTo) > 0
									? (accessPoints[appliesToOptions.indexOf(appliesTo) - 1]?.id ??
										null)
									: null,
							...compensationPayload,
						},
						authToken
					);

			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.saveFailed, 'Error');
				return;
			}
			ShowAlert(expense ? t.compensationSaved : t.expenseSaved, 'Success');
			onSaved();
			onClose();
		} catch (e) {
			console.error('[SiteExpenseOverlay] save failed', e);
			ShowAlert(t.saveFailed, 'Error');
		} finally {
			setSaving(false);
		}
	}, [
		accessPoints,
		amount,
		appliesTo,
		appliesToOptions,
		authToken,
		category,
		categoryOptions,
		compensationPayload,
		description,
		expense,
		incurredOn,
		isCash,
		isVoucher,
		mode,
		onClose,
		onSaved,
		routerId,
		t.amountRequired,
		t.compensationSaved,
		t.expenseSaved,
		t.saveFailed,
		t.selectDisbursementFirst,
		t.selectVoucherFirst,
	]);

	return (
		<OverlayContainer
			id='site-expense-form'
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
				<View style={styles.titleRow}>
					<ThemedText
						style={[styles.title, { color: screenTitleText }]}
						lightColor={screenTitleText}
						darkColor={screenTitleText}
					>
						{expense ? t.compensationTitle : t.expenseTitle}
					</ThemedText>
					{saving || optionsLoading ? (
						<ActivityIndicator size='small' color={bim} />
					) : null}
				</View>

				{mode === 'create' ? (
					<>
						<ThemedDropdown
							id='site-expense-applies-to'
							containerRef={appliesToRef}
							label={t.appliesTo}
							placeholder={t.appliesTo}
							options={appliesToOptions}
							value={appliesTo}
							setValue={setAppliesTo}
							showDropdown={openDropdown === 'appliesTo'}
							setShowDropdown={(open) => setOpenDropdown(open ? 'appliesTo' : null)}
							openDirection='down'
						/>
						<ThemedDropdown
							id='site-expense-category'
							containerRef={categoryRef}
							label={t.category}
							placeholder={t.category}
							options={categoryOptions}
							value={category}
							setValue={setCategory}
							showDropdown={openDropdown === 'category'}
							setShowDropdown={(open) => setOpenDropdown(open ? 'category' : null)}
							openDirection='down'
						/>
						<ThemedInput
							label={t.amountLabel}
							placeholder={t.amountPlaceholder}
							keyboardType='decimal-pad'
							value={amount}
							setValue={setAmount}
							style={fields}
						/>
						<ThemedDatePicker
							label={t.incurredOn}
							placeholder={t.datePlaceholder}
							value={incurredOn}
							onChange={setIncurredOn}
						/>
						<ThemedInput
							label={t.descriptionLabel}
							placeholder={t.descriptionPlaceholder}
							value={description}
							setValue={setDescription}
							style={fields}
						/>
					</>
				) : null}

				<ThemedDropdown
					id='site-expense-compensation'
					containerRef={compensationRef}
					label={t.compensationTypeLabel}
					placeholder={t.compensationTypeLabel}
					options={compensationOptions}
					value={compensationType}
					setValue={setCompensationType}
					showDropdown={openDropdown === 'compensation'}
					setShowDropdown={(open) => setOpenDropdown(open ? 'compensation' : null)}
					openDirection='down'
				/>

				{isCash ? (
					<>
						<ThemedDropdown
							id='site-expense-disbursement'
							containerRef={disbursementRef}
							label={t.disbursementLink}
							placeholder={t.disbursementLink}
							options={disbursementOptions}
							value={disbursement || t.selectDisbursement}
							setValue={(value) =>
								setDisbursement(
									value === t.selectDisbursement ? '' : String(value)
								)
							}
							showDropdown={openDropdown === 'disbursement'}
							setShowDropdown={(open) =>
								setOpenDropdown(open ? 'disbursement' : null)
							}
							openDirection='down'
						/>
						{!optionsLoading && disbursements.length === 0 ? (
							<ThemedText
								style={[styles.hint, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{t.noDisbursements}
							</ThemedText>
						) : null}
					</>
				) : null}

				{isVoucher ? (
					<>
						<ThemedDropdown
							id='site-expense-voucher'
							containerRef={voucherRef}
							label={t.voucherLink}
							placeholder={t.voucherLink}
							options={voucherOptions}
							value={voucher || t.selectVoucher}
							setValue={(value) =>
								setVoucher(value === t.selectVoucher ? '' : String(value))
							}
							showDropdown={openDropdown === 'voucher'}
							setShowDropdown={(open) => setOpenDropdown(open ? 'voucher' : null)}
							openDirection='down'
						/>
						{!optionsLoading && vouchers.length === 0 ? (
							<ThemedText
								style={[styles.hint, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{t.noVouchers}
							</ThemedText>
						) : null}
					</>
				) : null}

				<View style={styles.actions}>
					<ThemedButton
						title={buttons.cancel}
						onPress={onClose}
						disabled={saving}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={cancelButton}
						darkColor={cancelButton}
						lightTextColor={white}
						darkTextColor={white}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={expense ? t.saveCompensation : buttons.save}
						onPress={() => {
							void submit();
						}}
						loading={saving}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={bim}
						darkColor={bim}
						lightTextColor={white}
						darkTextColor={white}
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
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	title: {
		flex: 1,
		minWidth: 0,
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 15,
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
