import FormContainer from '@/components/FormContainer';
import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { phoneRegexWithSpaces } from '@/constants';
import { formatPhoneNumber } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useColorScheme, View } from 'react-native';

type BankAccountPayload = {
	name: string;
	accountNumber: string;
	phone: string;
	swift: string;
};

type Props = {
	visible: boolean;
	onCancel: () => void;
	onSave: (payload: BankAccountPayload) => void;
	mode?: 'add' | 'edit' | 'view';
	initial?: Partial<BankAccountPayload>;
	onBack?: () => void; // used in view mode (falls back to onCancel)
	onEdit?: () => void; // used in view mode
};

export default function BankAccount({
	visible,
	onCancel,
	onSave,
	mode = 'add',
	initial,
	onBack,
	onEdit,
}: Props) {
	useColorScheme();
	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const errorColor = useThemeColor({}, 'error');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');

	const [name, setName] = useState(initial?.name ?? '');
	const [accountNumber, setAccountNumber] = useState(
		initial?.accountNumber ?? ''
	);
	const [phone, setPhone] = useState(initial?.phone ?? '');
	const [phoneError, setPhoneError] = useState(false);
	const [swift, setSwift] = useState(initial?.swift ?? '');

	const fadeAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (visible) {
			// when opening, prefill with latest initial values
			setName(initial?.name ?? '');
			setAccountNumber(initial?.accountNumber ?? '');
			setPhone(initial?.phone ?? '');
			setPhoneError(false);
			setSwift(initial?.swift ?? '');
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
	}, [
		visible,
		fadeAnim,
		initial?.name,
		initial?.accountNumber,
		initial?.phone,
		initial?.swift,
	]);
	const handleSetPhone = (value: string) => {
		const formatted = formatPhoneNumber(value);
		if (!formatted || !phoneRegexWithSpaces.test(formatted)) {
			setPhoneError(true);
		} else {
			setPhoneError(false);
		}
		setPhone(formatted);
	};

	const toTitleCase = (s: string) =>
		s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

	const handleSave = () => {
		onSave({
			name: name.trim(),
			accountNumber: accountNumber.trim(),
			phone: phone.trim(),
			swift: swift.trim().toUpperCase(),
		});
	};

	return (
		<OverlayContainer
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
		>
			<FormContainer style={styles.kbContainer}>
				<ThemedView style={styles.card} lightColor={bg} darkColor={bg}>
					<ThemedText
						style={styles.title}
						lightColor={screenTitleText}
						darkColor={screenTitleText}
					>
						{toTitleCase(
							mode === 'view'
								? 'account details'
								: mode === 'edit'
								? 'edit bank account'
								: 'add bank account'
						)}
					</ThemedText>

					<ThemedInput
						label={toTitleCase('bank name')}
						placeholder={'Chase Bank'}
						value={name}
						setValue={setName}
						editable={mode !== 'view'}
						style={{
							backgroundColor: bg,
							borderColor: inputBorder,
							borderWidth: 1,
						}}
						containerStyle={{ marginBottom: 8 }}
					/>

					<ThemedInput
						label={toTitleCase('account number')}
						placeholder={'09811111222'}
						keyboardType='numeric'
						value={accountNumber}
						setValue={setAccountNumber}
						editable={mode !== 'view'}
						style={{
							backgroundColor: bg,
							borderColor: inputBorder,
							borderWidth: 1,
						}}
						containerStyle={{ marginBottom: 8 }}
					/>

					<ThemedInput
						label={toTitleCase('phone number')}
						placeholder={'0700 000 000'}
						keyboardType='number-pad'
						value={phone}
						setValue={handleSetPhone}
						editable={mode !== 'view'}
						style={{
							backgroundColor: bg,
							borderColor: phoneError ? errorColor : inputBorder,
							borderWidth: 1,
						}}
						containerStyle={{ marginBottom: 8 }}
					/>

					<ThemedInput
						label={toTitleCase('swift code')}
						placeholder={'SBICUGKX'}
						autoCapitalize='characters'
						value={swift}
						setValue={setSwift}
						editable={mode !== 'view'}
						style={{
							backgroundColor: bg,
							borderColor: inputBorder,
							borderWidth: 1,
						}}
						containerStyle={{ marginBottom: 8 }}
					/>

					<View style={styles.actions}>
						{mode === 'view' ? (
							<>
								<ThemedButton
									title={toTitleCase('back')}
									onPress={onBack ?? onCancel}
									lightColor={cancelButton}
									darkColor={cancelButton}
									lightTextColor={white}
									darkTextColor={white}
								/>
								<ThemedButton
									title={toTitleCase('edit')}
									onPress={onEdit ?? (() => {})}
									lightColor={bim}
									darkColor={bim}
									lightTextColor={white}
									darkTextColor={white}
								/>
							</>
						) : (
							<>
								<ThemedButton
									title={toTitleCase('cancel')}
									onPress={onCancel}
									lightColor={cancelButton}
									darkColor={cancelButton}
									lightTextColor={white}
									darkTextColor={white}
								/>
								<ThemedButton
									title={toTitleCase(mode === 'edit' ? 'update' : 'save')}
									onPress={handleSave}
									lightColor={bim}
									darkColor={bim}
									lightTextColor={white}
									darkTextColor={white}
								/>
							</>
						)}
					</View>
				</ThemedView>
			</FormContainer>
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
		gap: 12,
	},
	title: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 8,
	},
});
