import FormContainer from '@/components/FormContainer';
import { useCallback, useEffect, useState } from 'react';
import { Animated, useColorScheme, View } from 'react-native';

import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { InternetPackage } from '@/types';

export type InternetPackageOverlayMode = 'create' | 'view' | 'edit';

type Props = {
	visible: boolean;
	fadeAnim: Animated.Value;
	mode: InternetPackageOverlayMode;
	initial?: Partial<InternetPackage>;
	onClose: () => void;
	onSubmit: (payload: {
		name: string;
		usersPerDevice: number;
		bandwidth: string;
		duration: number;
	}) => void;
	onRequestClose?: () => void;
};

export default function InternetPackageOverlay({
	visible,
	fadeAnim,
	mode,
	initial,
	onClose,
	onSubmit,
	onRequestClose,
}: Props) {
	useColorScheme();
	const { language } = useGeneral();

	const bg = useThemeColor({}, 'background');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const textColor = useThemeColor({}, 'text');
	const cancelButton = useThemeColor({}, 'cancelButton');
	const white = useThemeColor({}, 'white');
	const lime = useThemeColor({}, 'lime');
	const bim = useThemeColor({}, 'bim');
	const readOnly = mode === 'view';

	const [name, setName] = useState('');
	const [usersPerDevice, setUsersPerDevice] = useState('');
	const [bandwidth, setBandwidth] = useState('');
	const [duration, setDuration] = useState('');

	// Handlers for setting input values (kept simple for now; place for validation/transforms)
	const handleChangeName = useCallback((v: string) => setName(v ?? ''), []);
	const handleChangeUsersPerDevice = useCallback(
		(v: string) => setUsersPerDevice(v ?? ''),
		[]
	);
	const handleChangeBandwidth = useCallback(
		(v: string) => setBandwidth(v ?? ''),
		[]
	);
	const handleChangeDuration = useCallback(
		(v: string) => setDuration(v ?? ''),
		[]
	);

	useEffect(() => {
		if (visible) {
			setName(initial?.tag ?? '');
			setUsersPerDevice(
				initial?.usersPerDevice !== undefined &&
					initial?.usersPerDevice !== null
					? String(initial.usersPerDevice)
					: '1'
			);
			setBandwidth(initial?.bandwidth ?? '');
			setDuration(
				initial?.duration !== undefined && initial?.duration !== null
					? String(initial.duration)
					: '1'
			);
		}
	}, [visible, initial]);

	const t = translations[language]?.categories as any;
	const title =
		mode === 'create'
			? t.internetPackage.createTitle
			: mode === 'edit'
			? t.internetPackage.editTitle
			: t.internetPackage.viewTitle;

	const primaryLabel =
		mode === 'create'
			? t.buttons.createPackage.toUpperCase()
			: t.buttons.saveChanges.toUpperCase();
	const primaryColor = mode === 'create' ? lime : bim;

	const handleSubmit = () => {
		if (readOnly) return onClose();
		const payload = {
			name: name.trim(),
			usersPerDevice: Math.max(1, parseInt(usersPerDevice || '1', 10) || 1),
			bandwidth: bandwidth.trim(),
			duration: Math.max(1, parseInt(duration || '1', 10) || 1),
		};
		onSubmit(payload);
	};

	return (
		<OverlayContainer
			showOverlay={visible}
			fadeAnim={fadeAnim}
			position='center'
			onRequestClose={onRequestClose ?? onClose}
		>
			<FormContainer style={{ width: '100%' }}>
				<ThemedView
					style={{
						flexDirection: 'column',
						backgroundColor: bg,
						padding: 20,
						borderRadius: 10,
						width: '100%',
					}}
					lightColor={bg}
					darkColor={bg}
				>
					<ThemedText
						lightColor={screenTitleText}
						darkColor={screenTitleText}
						style={{
							fontSize: fontSize['heading.two'],
							fontWeight: fontWeight['heading.two'],
							marginBottom: 8,
						}}
					>
						{title}
					</ThemedText>

					<ThemedInput
						label={t.internetPackage.packageName}
						placeholder={t.internetPackage.placeholderPackageName || ''}
						value={name}
						setValue={handleChangeName}
						editable={!readOnly}
						style={{ marginBottom: 10 }}
						lightColor={textColor}
						darkColor={textColor}
					/>
					<ThemedInput
						label={t.internetPackage.usersPerDevice}
						placeholder={t.internetPackage.placeholderUsersPerDevice || ''}
						keyboardType='number-pad'
						value={usersPerDevice}
						setValue={handleChangeUsersPerDevice}
						editable={!readOnly}
						style={{ marginBottom: 10 }}
						lightColor={textColor}
						darkColor={textColor}
					/>
					<ThemedInput
						label={t.internetPackage.bandwidth}
						placeholder={t.internetPackage.placeholderBandwidth || ''}
						value={bandwidth}
						setValue={handleChangeBandwidth}
						editable={!readOnly}
						style={{ marginBottom: 10 }}
						lightColor={textColor}
						darkColor={textColor}
					/>
					<ThemedInput
						label={t.internetPackage.durationHours}
						placeholder={t.internetPackage.placeholderDurationHours || ''}
						keyboardType='number-pad'
						value={duration}
						setValue={handleChangeDuration}
						editable={!readOnly}
						style={{ marginBottom: 18 }}
						lightColor={textColor}
						darkColor={textColor}
					/>

					<View
						style={{
							flexDirection: 'row',
							justifyContent: 'flex-end',
							gap: 10,
						}}
					>
						<ThemedButton
							title={t.buttons.cancel.toUpperCase()}
							onPress={onClose}
							numberOfLines={1}
							lightColor={cancelButton}
							darkColor={cancelButton}
							lightTextColor={white}
							darkTextColor={white}
						/>
						{mode !== 'view' && (
							<ThemedButton
								title={primaryLabel}
								onPress={handleSubmit}
								numberOfLines={1}
								lightColor={primaryColor}
								darkColor={primaryColor}
								lightTextColor={white}
								darkTextColor={white}
							/>
						)}
					</View>
				</ThemedView>
			</FormContainer>
		</OverlayContainer>
	);
}
