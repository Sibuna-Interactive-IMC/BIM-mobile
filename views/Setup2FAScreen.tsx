import bimTextImg from '@/assets/images/bim-text-img.png';
import FormContainer from '@/components/FormContainer';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
// apiFetch moved to context for 2FA verification; this screen no longer calls API directly

import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Dimensions,
	findNodeHandle,
	Image,
	Platform,
	StyleSheet,
	TextInput,
	View,
} from 'react-native';

const devWidth = Dimensions.get('window').width;

export default function Setup2FAScreen() {
	const {
		pending2FASetup,
		//setPending2FASetup,
		setAppMessage,
		language,
		//handleVerify2FA,
		handleSetupTotp,
	} = useGeneral();
	//const router = useRouter();
	const scrollRef = useRef<any>(null);
	const [focusedInput, setFocusedInput] = useState<string | null>(null);
	const bg = useThemeColor({}, 'background');
	const textColor = useThemeColor({}, 'text');
	const authButtonText = useThemeColor({}, 'authButtonText');
	const inputBackground = useThemeColor({}, 'inputBackground');
	const bim = useThemeColor({}, 'bim');
	const [code, setCode] = useState('');
	const [loading, setLoading] = useState(false);

	const qrUri = useMemo(() => {
		if (!pending2FASetup) return null;
		if (pending2FASetup.qr && String(pending2FASetup.qr).startsWith('data:'))
			return pending2FASetup.qr;
		if (pending2FASetup.qr_base64)
			return `data:image/png;base64,${pending2FASetup.qr_base64}`;
		return null;
	}, [pending2FASetup]);

	const handleCopySecret = async () => {
		if (!pending2FASetup?.secret) return;
		try {
			// Prefer native expo-clipboard if available
			if (Clipboard && typeof Clipboard.setStringAsync === 'function') {
				await Clipboard.setStringAsync(String(pending2FASetup.secret));
				setAppMessage?.({
					type: 'message',
					message:
						translations[language].categories.auth[
							'setupAuthenticator.copiedToast'
						] ?? 'Secret copied to clipboard',
				});
				return;
			}
			// Fallback to navigator.clipboard for web
			if (
				typeof navigator !== 'undefined' &&
				(navigator as any)?.clipboard?.writeText
			) {
				await (navigator as any).clipboard.writeText(
					String(pending2FASetup.secret)
				);
				setAppMessage?.({
					type: 'message',
					message:
						translations[language].categories.auth[
							'setupAuthenticator.copiedToast'
						] ?? 'Secret copied to clipboard',
				});
				return;
			}
			setAppMessage?.({
				type: 'error',
				message:
					translations[language].categories.auth[
						'setupAuthenticator.clipboardUnavailable'
					] ?? 'Clipboard not available on this platform',
			});
		} catch {
			setAppMessage?.({
				type: 'error',
				message:
					translations[language].categories.auth[
						'setupAuthenticator.copyFailed'
					] ?? 'Failed to copy secret',
			});
		}
	};

	// const handleContinue = () => {
	// 	// Clear pending 2FA setup and continue to the authenticated area
	// 	setPending2FASetup?.(null);
	// 	router.replace('/(authenticated)/home');
	// };

	// const handleOnVerify2FA = async () => {
	// 	// keep the existing verify handler available (not used on this screen anymore)
	// 	if (!pending2FASetup?.phone) {
	// 		setAppMessage?.({
	// 			type: 'error',
	// 			message:
	// 				translations[language].categories.auth[
	// 					'setupAuthenticator.missingPhone'
	// 				] ?? 'Missing phone for 2FA verification',
	// 		});
	// 		return;
	// 	}
	// 	if (!code || code.trim().length === 0) {
	// 		setAppMessage?.({
	// 			type: 'error',
	// 			message:
	// 				translations[language].categories.auth[
	// 					'setupAuthenticator.enterCodeError'
	// 				] ?? 'Enter the code from your authenticator app',
	// 		});
	// 		return;
	// 	}
	// 	try {
	// 		setLoading(true);
	// 		const ok = await handleVerify2FA(code);
	// 		if (ok) {
	// 			setCode('');
	// 		}
	// 		return ok;
	// 	} finally {
	// 		setLoading(false);
	// 	}
	// };

	const handleOnSetupTotp = async () => {
		// Validate we have required values before calling context
		if (!pending2FASetup?.setup_token) {
			setAppMessage?.({
				type: 'error',
				message:
					translations[language].categories.auth[
						'setupAuthenticator.missingSetupToken'
					] ?? 'Missing setup token for TOTP setup',
			});
			return null;
		}
		if (!pending2FASetup?.secret) {
			setAppMessage?.({
				type: 'error',
				message:
					translations[language].categories.auth[
						'setupAuthenticator.missingSecret'
					] ?? 'Missing secret for TOTP setup',
			});
			return null;
		}
		if (!code || String(code).trim().length === 0) {
			setAppMessage?.({
				type: 'error',
				message:
					translations[language].categories.auth[
						'setupAuthenticator.enterCodeError'
					] ?? 'Enter the code from your authenticator app',
			});
			return null;
		}
		try {
			setLoading(true);
			return await handleSetupTotp({
				setup_token: pending2FASetup.setup_token ?? undefined,
				secret: pending2FASetup.secret ?? undefined,
				otp: code,
			});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!focusedInput || !scrollRef.current) return;
		const responder: any =
			(scrollRef.current as any)?.getScrollResponder?.() ?? scrollRef.current;
		if (!responder?.scrollResponderScrollNativeHandleToKeyboard) return;
		const doScroll = () => {
			try {
				const TI: any = TextInput as any;
				let focused: any = null;
				if (TI?.State && typeof TI.State.currentlyFocusedInput === 'function') {
					focused = TI.State.currentlyFocusedInput();
				} else if (typeof TI?.currentlyFocusedInput === 'function') {
					focused = TI.currentlyFocusedInput();
				}
				if (!focused) return;
				const handle = findNodeHandle(focused);
				if (!handle) return;
				responder.scrollResponderScrollNativeHandleToKeyboard(handle, 80, true);
			} catch {}
		};
		doScroll();
		const t1 = setTimeout(doScroll, 60);
		const t2 = setTimeout(doScroll, 140);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, [focusedInput]);

	return (
		<FormContainer
			style={{
				flex: 1,
				minWidth: devWidth,
				minHeight: '100%',
				padding: 0,
				margin: 0,
			}}
			behavior={Platform.OS === 'ios' ? 'position' : 'padding'}
		>
			<ParallaxScrollView
				headerBackgroundColor={{
					light: bg,
					dark: bg,
				}}
				getScrollRef={(r) => (scrollRef.current = r)}
			>
				<ThemedView style={styles.container} lightColor={bg} darkColor={bg}>
					<ThemedView style={styles.header} lightColor={bg} darkColor={bg}>
						<Image
							source={bimTextImg}
							style={{ height: 35, resizeMode: 'contain' }}
						/>
					</ThemedView>
					<ThemedText style={styles.title}>
						{translations[language].categories.auth['setupAuthenticator'] ??
							'Set up authenticator'}
					</ThemedText>
					<ThemedText style={[styles.subtitle, { color: textColor }]}>
						{translations[language].categories.auth[
							'setupAuthenticator.subtitle'
						] ??
							'Scan the QR code below with your authenticator app such as Google Authenticator or Authy, or copy the secret and add it manually.'}
					</ThemedText>

					{qrUri ? (
						<View style={styles.qrWrap}>
							<Image source={{ uri: qrUri }} style={styles.qr} />
						</View>
					) : (
						<ThemedText style={styles.noQr}>
							{
								translations[language].categories.auth[
									'setupAuthenticator.noQr'
								]
							}
						</ThemedText>
					)}

					<ThemedView
						style={styles.secretBox}
						lightColor={inputBackground}
						darkColor={inputBackground}
					>
						<ThemedText style={[styles.secretLabel, { color: textColor }]}>
							{
								translations[language].categories.auth[
									'setupAuthenticator.secretLabel'
								]
							}
						</ThemedText>
						<ThemedText style={styles.secretValue}>
							{pending2FASetup?.secret ?? '—'}
						</ThemedText>
					</ThemedView>

					<ThemedInput
						style={{
							width: '100%',
							marginTop: 12,
							backgroundColor: inputBackground,
							color: textColor,
						}}
						lightColor={textColor}
						darkColor={textColor}
						value={code}
						onFocus={() => setFocusedInput('code')}
						onBlur={() => setFocusedInput(null)}
						setValue={(v: string) => {
							if (v.length <= 6 && !isNaN(Number(v))) setCode(v);
						}}
						placeholder={
							translations[language].categories.auth[
								'setupAuthenticator.enterCodePlaceholder'
							]
						}
						placeholderTextColor={textColor}
						keyboardType='number-pad'
					/>

					<ThemedView style={{ gap: 12, width: '100%', marginTop: 20 }}>
						<ThemedButton
							title={
								translations[language].categories.auth[
									'setupAuthenticator.copy'
								]
							}
							textStyle={{ color: authButtonText }}
							onPress={handleCopySecret}
						/>
						<ThemedButton
							title={
								loading
									? translations[language].categories.auth[
											'setupAuthenticator.settingUp'
									  ]
									: translations[language].categories.auth[
											'setupAuthenticator.completeSetup'
									  ]
							}
							onPress={handleOnSetupTotp}
							textStyle={{ color: authButtonText }}
							lightColor={bim}
							darkColor={bim}
							disabled={
								loading ||
								!pending2FASetup?.setup_token ||
								!code ||
								code.trim().length === 0
							}
						/>
					</ThemedView>

					<ThemedText style={styles.instructionsTitle}>
						{
							translations[language].categories.auth[
								'setupAuthenticator.howToTitle'
							]
						}
					</ThemedText>
					<ThemedText style={styles.instructions}>
						{translations[language].categories.auth['setupAuthenticator.step1']}
					</ThemedText>
					<ThemedText style={styles.instructions}>
						{translations[language].categories.auth['setupAuthenticator.step2']}
					</ThemedText>
					<ThemedText style={styles.instructions}>
						{translations[language].categories.auth['setupAuthenticator.step3']}
					</ThemedText>
					<ThemedText style={styles.instructions}>
						{translations[language].categories.auth['setupAuthenticator.step4']}
					</ThemedText>
				</ThemedView>
			</ParallaxScrollView>
		</FormContainer>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: 20,
	},
	header: {
		width: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 20,
	},
	inner: {
		alignItems: 'center',
		paddingHorizontal: 20,
		gap: 12,
	},
	title: {
		fontSize: 22,
		fontWeight: '600',
		marginBottom: 6,
	},
	subtitle: {
		fontSize: 14,
		textAlign: 'left',
		marginBottom: 12,
	},
	qrWrap: {
		height: 260,
		borderRadius: 8,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	qr: {
		width: '100%',
		height: '100%',
		resizeMode: 'contain',
	},
	noQr: {
		marginVertical: 12,
	},
	secretBox: {
		width: '100%',
		padding: 12,
		borderRadius: 8,
		marginTop: 12,
	},
	secretLabel: {
		fontSize: 12,
	},
	secretValue: {
		marginTop: 8,
		fontSize: 16,
		fontWeight: '600',
	},
	instructionsTitle: {
		marginTop: 18,
		fontSize: 16,
		fontWeight: '600',
	},
	instructions: {
		fontSize: 14,
		textAlign: 'left',
		width: '100%',
		marginTop: 8,
	},
});
