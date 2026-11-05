import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import {
	formatAmount,
	parseAmount,
	ShowAlert,
	translateWithVariables,
} from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import { requestWithdrawal } from '@/services/AccountsService';
import type {
	WithdrawalRequestPayload,
	WithdrawalRequestResponse,
	WithdrawalRequestResult,
} from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/** The web form enforces this minimum before it will request an OTP. */
const MIN_WITHDRAWAL = 10000;

const UGANDA_MSISDN = /^(?:(?:256|0)?7\d{8})$/;

type Step = 'form' | 'otp' | 'done';

/** Some branches answer at the top level, others under `data`. */
function readResult(body: WithdrawalRequestResponse | null): WithdrawalRequestResult {
	if (!body) return {};
	return body.data ? { ...body, ...body.data } : body;
}

function firstError(body: WithdrawalRequestResponse | null, fallback: string) {
	const errors = body?.errors;
	if (errors) {
		for (const messages of Object.values(errors)) {
			if (Array.isArray(messages) && messages.length) return messages[0];
			if (typeof messages === 'string' && messages) return messages;
		}
	}
	return readResult(body).message || fallback;
}

/**
 * The owner withdrawal flow: amount + mobile-money number, then the OTP the
 * gateway texts, then a result card. Mirrors `withdraws/create.blade.php`.
 */
export default function WithdrawFunds({
	visible,
	routerId,
	routerName,
	currency,
	authToken,
	balance,
	minAmount = MIN_WITHDRAWAL,
	onCancel,
	onCompleted,
}: {
	visible: boolean;
	routerId: string;
	routerName: string;
	currency: string;
	authToken?: string;
	balance?: number;
	minAmount?: number;
	onCancel: () => void;
	onCompleted?: () => void;
}) {
	const { language, refreshDashboard } = useGeneral();
	const t = translations[language].categories.withdraw;
	const buttons = translations[language].categories.buttons;

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const mutedText = useThemeColor({}, 'mutedText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');

	const [step, setStep] = useState<Step>('form');
	const [amount, setAmount] = useState('');
	const [phone, setPhone] = useState('');
	const [narration, setNarration] = useState('');
	const [otp, setOtp] = useState('');
	const [reference, setReference] = useState<string | null>(null);
	const [otpPhone, setOtpPhone] = useState<string | null>(null);
	const [partialNotice, setPartialNotice] = useState<string | null>(null);
	const [resultMessage, setResultMessage] = useState('');
	const [resultReference, setResultReference] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const fadeAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (visible) {
			setStep('form');
			setAmount('');
			setPhone('');
			setNarration('');
			setOtp('');
			setReference(null);
			setOtpPhone(null);
			setPartialNotice(null);
			setResultMessage('');
			setResultReference(null);
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 150,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 150,
				useNativeDriver: true,
			}).start();
		}
	}, [visible, fadeAnim]);

	const fields = { backgroundColor: bg, borderColor: inputBorder, borderWidth: 1 };

	const requestOtp = useCallback(
		async (extra?: Partial<WithdrawalRequestPayload>) => {
			if (!authToken) return;
			setBusy(true);
			try {
				const payload: WithdrawalRequestPayload = {
					amount: parseAmount(amount),
					phone: phone.trim(),
					narration: narration.trim() || null,
					request_otp: true,
					...extra,
				};
				const res = await requestWithdrawal(routerId, payload, authToken);
				const body: WithdrawalRequestResponse = await res
					.json()
					.catch(() => null as any);
				const data = readResult(body);

				if (data.requires_partial_acceptance) {
					setPartialNotice(data.message || '');
					return;
				}

				if (!res.ok || !data.otp_sent) {
					ShowAlert(firstError(body, t.otpRequestFailed), 'Error');
					return;
				}

				setReference(data.reference ?? null);
				setOtpPhone(data.otp_phone ?? null);
				setPartialNotice(null);
				setStep('otp');
			} catch (e) {
				console.error('[WithdrawFunds] OTP request failed', e);
				ShowAlert(t.otpRequestFailed, 'Error');
			} finally {
				setBusy(false);
			}
		},
		[amount, authToken, narration, phone, routerId, t.otpRequestFailed]
	);

	const initiate = useCallback(() => {
		const value = parseAmount(amount);
		if (!Number.isFinite(value) || value < minAmount) {
			ShowAlert(
				translateWithVariables(t.amountTooSmall, {
					amount: formatAmount(minAmount, 0),
					currency,
				}),
				'Error'
			);
			return;
		}
		if (!UGANDA_MSISDN.test(phone.replace(/\D/g, ''))) {
			ShowAlert(t.invalidPhone, 'Error');
			return;
		}
		void requestOtp();
	}, [amount, currency, minAmount, phone, requestOtp, t.amountTooSmall, t.invalidPhone]);

	const submitOtp = useCallback(async () => {
		if (!authToken) return;
		if (otp.trim().length < 4) {
			ShowAlert(t.otpRequired, 'Error');
			return;
		}
		setBusy(true);
		try {
			const res = await requestWithdrawal(
				routerId,
				{
					amount: parseAmount(amount),
					phone: phone.trim(),
					narration: narration.trim() || null,
					otp: otp.trim(),
					reference,
				},
				authToken
			);
			const body: WithdrawalRequestResponse = await res
				.json()
				.catch(() => null as any);
			const data = readResult(body);

			if (!res.ok || data.success === false) {
				ShowAlert(firstError(body, t.withdrawFailed), 'Error');
				return;
			}

			setResultMessage(data.message || t.doneMessage);
			setResultReference(data.reference ?? reference);
			setStep('done');
			onCompleted?.();
			// Refresh the dashboard so the new approval banner appears at once.
			void refreshDashboard?.(true);
		} catch (e) {
			console.error('[WithdrawFunds] OTP submit failed', e);
			ShowAlert(t.withdrawFailed, 'Error');
		} finally {
			setBusy(false);
		}
	}, [
		amount,
		authToken,
		narration,
		onCompleted,
		otp,
		phone,
		reference,
		refreshDashboard,
		routerId,
		t.doneMessage,
		t.otpRequired,
		t.withdrawFailed,
	]);

	const title =
		step === 'otp'
			? t.otpTitle
			: step === 'done'
				? t.doneTitle
				: `${t.withdrawFundsFromRouter}: ${routerName}`;

	return (
		<OverlayContainer
			id='withdraw-funds'
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={onCancel}
			scrollable
			autoKeyboardInset
			bottomPadding={16}
			keyboardGap={40}
			centerLiftOnKeyboard
			centerLiftRatio={0.9}
		>
			<View style={styles.kbContainer}>
				<ThemedView style={styles.card} lightColor={bg} darkColor={bg}>
					<ThemedText
						style={[styles.title, { color: screenTitleText }]}
						lightColor={screenTitleText}
						darkColor={screenTitleText}
						numberOfLines={2}
					>
						{title}
					</ThemedText>

					{step === 'form' ? (
						<>
							{typeof balance === 'number' ? (
								<ThemedText
									style={[styles.hint, { color: mutedText }]}
									lightColor={mutedText}
									darkColor={mutedText}
								>
									{`${t.balance}: ${formatAmount(balance)} ${currency}`}
								</ThemedText>
							) : null}

							<ThemedInput
								label={`${t.withdrawAmount} (${currency})`}
								placeholder={`${t.withdrawAmount} (${currency})`}
								keyboardType='numeric'
								value={amount}
								setValue={setAmount}
								style={fields}
								containerStyle={styles.field}
							/>
							<ThemedText
								style={[styles.hint, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{translateWithVariables(t.amountHint, {
									amount: formatAmount(minAmount, 0),
									currency,
								})}
							</ThemedText>

							<ThemedInput
								label={t.mobileMoneyPhone}
								placeholder='0751123456'
								keyboardType='phone-pad'
								value={phone}
								setValue={setPhone}
								style={fields}
								containerStyle={styles.field}
							/>
							<ThemedText
								style={[styles.hint, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{t.phoneHint}
							</ThemedText>

							<ThemedInput
								label={t.narrationOptional}
								placeholder={t.narrationOptional}
								value={narration}
								setValue={setNarration}
								multiline
								lines={2}
								style={fields}
								containerStyle={styles.field}
							/>

							{partialNotice ? (
								<View style={styles.notice}>
									<ThemedText
										style={[styles.hint, { color: mutedText }]}
										lightColor={mutedText}
										darkColor={mutedText}
									>
										{partialNotice}
									</ThemedText>
									<ThemedButton
										title={t.acceptPartial}
										icon='check'
										onPress={() => {
											void requestOtp({ accept_partial: true });
										}}
										loading={busy}
										numberOfLines={2}
										lightColor={bim}
										darkColor={bim}
										lightTextColor={white}
										darkTextColor={white}
										iconColor={white}
										textStyle={styles.actionText}
									/>
								</View>
							) : null}

							<View style={styles.actions}>
								<ThemedButton
									title={buttons.cancel}
									onPress={onCancel}
									disabled={busy}
									numberOfLines={1}
									style={styles.actionButton}
									lightColor={cancelButton}
									darkColor={cancelButton}
									lightTextColor={white}
									darkTextColor={white}
									textStyle={styles.actionText}
								/>
								<ThemedButton
									title={t.initiateWithdrawal}
									icon='withdrawal'
									onPress={initiate}
									loading={busy}
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
						</>
					) : null}

					{step === 'otp' ? (
						<>
							<ThemedText
								style={[styles.hint, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{translateWithVariables(t.otpSentTo, {
									phone: otpPhone ?? phone,
								})}
							</ThemedText>
							<ThemedInput
								label={t.otpTitle}
								placeholder={t.otpPlaceholder}
								keyboardType='number-pad'
								value={otp}
								setValue={setOtp}
								style={fields}
								containerStyle={styles.field}
							/>
							<View style={styles.actions}>
								<ThemedButton
									title={t.back}
									onPress={() => setStep('form')}
									disabled={busy}
									numberOfLines={1}
									style={styles.actionButton}
									lightColor={cancelButton}
									darkColor={cancelButton}
									lightTextColor={white}
									darkTextColor={white}
									textStyle={styles.actionText}
								/>
								<ThemedButton
									title={t.submitOtp}
									icon='check'
									onPress={() => {
										void submitOtp();
									}}
									loading={busy}
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
						</>
					) : null}

					{step === 'done' ? (
						<>
							<ThemedText
								style={[styles.hint, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{resultMessage}
							</ThemedText>
							{resultReference ? (
								<ThemedText
									style={[styles.hint, { color: screenTitleText }]}
									lightColor={screenTitleText}
									darkColor={screenTitleText}
								>
									{`${t.referenceLabel}: ${resultReference}`}
								</ThemedText>
							) : null}
							<View style={styles.actions}>
								<ThemedButton
									title={t.close}
									icon='check'
									onPress={onCancel}
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
						</>
					) : null}
				</ThemedView>
			</View>
		</OverlayContainer>
	);
}

const styles = StyleSheet.create({
	kbContainer: { width: '100%' },
	card: {
		flexDirection: 'column',
		padding: 20,
		borderRadius: 10,
		width: '100%',
		gap: 8,
	},
	title: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 4,
	},
	hint: {
		fontSize: 12,
		lineHeight: 16,
	},
	field: {
		marginBottom: 2,
	},
	notice: {
		gap: 8,
		marginTop: 4,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 8,
	},
	actionButton: {
		flex: 1,
		// Lets the label ellipsize instead of forcing the row wider than the card.
		minWidth: 0,
	},
	actionText: {
		fontSize: 13,
		fontWeight: '600',
	},
});
