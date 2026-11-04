import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { formatAmount, ShowAlert, translateWithVariables } from '@/helpers';
import { getApiData, getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
	requestProfitOtp,
	requestProfitWithdrawal,
} from '@/services/AccountsService';
import type { ProfitSnapshot } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const PROVIDERS = ['yo', 'relworx'] as const;
type Provider = (typeof PROVIDERS)[number];

/** Mirrors the web form's MSISDN check so the OTP is not sent for a bad number. */
function isValidMsisdn(value: string) {
	const digits = value.replace(/\D/g, '');
	return /^(?:(?:256|0)?7\d{8})$/.test(digits);
}

/**
 * Profit payout in the same two steps as the web page: ask for an OTP, then
 * submit the amount with that code. The reference comes back from step one.
 */
export default function ProfitWithdrawOverlay({
	visible,
	fadeAnim,
	authToken,
	snapshot,
	onClose,
	onSubmitted,
}: {
	visible: boolean;
	fadeAnim: any;
	authToken?: string;
	snapshot: ProfitSnapshot | null;
	onClose: () => void;
	onSubmitted: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.profit;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'mutedText');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const cancelButton = useThemeColor({}, 'cancelButton');

	const [amount, setAmount] = useState('');
	const [provider, setProvider] = useState<Provider>('yo');
	const [recipient, setRecipient] = useState('');
	const [otp, setOtp] = useState('');
	const [reference, setReference] = useState('');
	const [otpPhone, setOtpPhone] = useState('');
	const [sending, setSending] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [showProviderDropdown, setShowProviderDropdown] = useState(false);
	const providerRef = useRef<View>(null);
	const wasVisible = useRef(false);

	useEffect(() => {
		if (visible && !wasVisible.current) {
			setAmount('');
			setProvider('yo');
			setRecipient('');
			setOtp('');
			setReference('');
			setOtpPhone('');
		}
		wasVisible.current = visible;
	}, [visible]);

	const otpRequested = !!reference;

	const available = useMemo(
		() =>
			provider === 'yo'
				? (snapshot?.yo_available ?? 0)
				: (snapshot?.relworx_available ?? 0),
		[provider, snapshot]
	);

	const validate = useCallback(() => {
		const parsed = Number.parseFloat(amount.replace(/,/g, ''));
		if (!Number.isFinite(parsed) || parsed < 1 || parsed > available) {
			ShowAlert(t.invalidAmount, 'Error');
			return null;
		}
		if (!isValidMsisdn(recipient)) {
			ShowAlert(t.invalidPhone, 'Error');
			return null;
		}
		return parsed;
	}, [amount, available, recipient, t.invalidAmount, t.invalidPhone]);

	const handleSendOtp = useCallback(async () => {
		const parsed = validate();
		if (parsed === null || !authToken) return;
		setSending(true);
		try {
			const res = await requestProfitOtp(
				{ amount: parsed, provider, recipientMsisdn: recipient.trim() },
				authToken
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.otpFailed, 'Error');
				return;
			}
			const data = getApiData<{
				otp_sent?: boolean;
				reference?: string;
				otp_phone?: string;
			}>(body);
			setReference(data?.reference ?? '');
			setOtpPhone(data?.otp_phone ?? '');
		} catch (e) {
			console.error('[ProfitWithdraw] OTP failed', e);
			ShowAlert(t.otpFailed, 'Error');
		} finally {
			setSending(false);
		}
	}, [authToken, provider, recipient, t.otpFailed, validate]);

	const handleConfirm = useCallback(async () => {
		const parsed = validate();
		if (parsed === null || !authToken) return;
		if (!otp.trim()) {
			ShowAlert(t.otpRequired, 'Error');
			return;
		}
		setSubmitting(true);
		try {
			const res = await requestProfitWithdrawal(
				{
					amount: parsed,
					provider,
					recipientMsisdn: recipient.trim(),
					otp: otp.trim(),
					reference,
				},
				authToken
			);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.actionFailed, 'Error');
				return;
			}
			ShowAlert(
				res.status === 202 ? t.withdrawPending : t.withdrawSuccess,
				'Success'
			);
			onSubmitted();
			onClose();
		} catch (e) {
			console.error('[ProfitWithdraw] submit failed', e);
			ShowAlert(t.actionFailed, 'Error');
		} finally {
			setSubmitting(false);
		}
	}, [
		authToken,
		onClose,
		onSubmitted,
		otp,
		provider,
		recipient,
		reference,
		t.actionFailed,
		t.otpRequired,
		t.withdrawPending,
		t.withdrawSuccess,
		validate,
	]);

	return (
		<OverlayContainer
			id='profit-withdraw-overlay'
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
					{t.withdrawProfit}
				</ThemedText>

				<ThemedInput
					label={t.amount}
					placeholder={formatAmount(available, 0)}
					keyboardType='numeric'
					value={amount}
					setValue={setAmount}
					editable={!otpRequested}
					style={{ backgroundColor: bg }}
				/>
				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{`${t.available}: ${formatAmount(available, 2)}`}
				</ThemedText>

				<ThemedDropdown
					id='profit-withdraw-provider'
					containerRef={providerRef}
					label={t.provider}
					placeholder={t.provider}
					options={[...PROVIDERS]}
					value={provider}
					setValue={(value: string) => {
						if (!otpRequested) setProvider(value as Provider);
					}}
					showDropdown={showProviderDropdown}
					setShowDropdown={setShowProviderDropdown}
					openDirection='down'
				/>

				<ThemedInput
					label={t.recipient}
					placeholder='0751123456'
					keyboardType='phone-pad'
					value={recipient}
					setValue={setRecipient}
					editable={!otpRequested}
					style={{ backgroundColor: bg }}
				/>

				{otpRequested ? (
					<>
						<ThemedInput
							label={t.otp}
							placeholder={t.otp}
							keyboardType='number-pad'
							value={otp}
							setValue={setOtp}
							style={{ backgroundColor: bg }}
						/>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{translateWithVariables(t.otpHint, { phone: otpPhone || '—' })}
						</ThemedText>
					</>
				) : null}

				<View style={styles.actions}>
					<ThemedButton
						title={buttons.cancel}
						onPress={onClose}
						disabled={sending || submitting}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={cancelButton}
						darkColor={cancelButton}
						lightTextColor={white}
						darkTextColor={white}
						textStyle={styles.actionText}
					/>
					<ThemedButton
						title={otpRequested ? t.confirmWithdrawal : t.sendOtp}
						onPress={() => {
							void (otpRequested ? handleConfirm() : handleSendOtp());
						}}
						loading={sending || submitting}
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
	title: {
		fontSize: fontSize['heading.three'],
		fontWeight: fontWeight['heading.two'],
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
