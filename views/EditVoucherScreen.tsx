import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { translateWithVariables } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
	useFocusEffect,
	useLocalSearchParams,
	useNavigation,
	useRouter,
} from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

export default function EditVoucherScreen() {
	const router = useRouter();
	const navigation = useNavigation();
	const { vRId, hotspotId, voucher } = useLocalSearchParams() as {
		vRId?: string;
		hotspotId?: string;
		voucher?: string;
	};
	const { language, handleUpdateHistory } = useGeneral();
	const { routers } = useTransaction();
	useColorScheme();
	// Theme helpers
	const background = useThemeColor({}, 'background');
	const backgroundLight = useThemeColor({}, 'background', 'light');
	const backgroundDark = useThemeColor({}, 'background', 'dark');
	const yellow = useThemeColor({}, 'yellow');
	const screenTitleText = useThemeColor({}, 'screenTitleText');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const bim = useThemeColor({}, 'bim');
	const secondaryButton = useThemeColor({}, 'secondaryButton');
	const white = useThemeColor({}, 'white');
	const [profile, setProfile] = useState<string>('');
	const [username, setUsername] = useState<string>('');
	const [password, setPassword] = useState<string>('');

	useEffect(() => {
		navigation.setOptions({
			headerProps: {
				goback: true,
			},
		});
	}, [navigation]);

	// Seed parent immediately on mount to guarantee ordering before any current route push
	useEffect(() => {
		handleUpdateHistory(
			'/(authenticated)/routers/vouchers/' + vRId + '/' + hotspotId
		);
	}, [handleUpdateHistory, vRId, hotspotId]);

	// Seed parent path on focus so back goes to routers list; guard to run once per focus
	const seededParentRef = useRef(false);
	useFocusEffect(
		useCallback(() => {
			if (!seededParentRef.current) {
				handleUpdateHistory(
					`/(authenticated)/routers/vouchers/${vRId}/${hotspotId}/${voucher}`
				);
				seededParentRef.current = true;
			}
			return () => {
				seededParentRef.current = false; // reset on blur
			};
		}, [handleUpdateHistory, vRId, hotspotId, voucher])
	);

	useEffect(() => {
		if (vRId && hotspotId && routers) {
			const router = routers.find((r) => r.id === vRId);
			console.log({ data: routers });
			// const hotspot = router?.networkInfo.hotspots.find(
			// 	(h) => h.id === hotspotId
			// );
			// const user = hotspot?.users?.find((u) => u.voucherCode === voucher);
			// setUsername(user?.voucherCode || '');
			// setPassword(user?.password || '');
			// setProfile(user?.package || '');
		}
	}, [vRId, hotspotId, routers, voucher]);

	// Router details screen implementation
	const handleCreateRouter = () => {};
	const handleCancel = () => {
		setProfile('');
		setUsername('');
		setPassword('');
		router.push(`/(authenticated)/routers/vouchers/${vRId}/${hotspotId}`);
	};
	return (
		<ParallaxScrollView
			headerBackgroundColor={{
				light: backgroundLight,
				dark: backgroundDark,
			}}
			contentStyle={{
				paddingHorizontal: 10,
			}}
			containerStyle={{ flex: 1 }}
		>
			<TileContainer
				id={voucher ?? ''}
				backgroundColor={background}
				style={{
					flexDirection: 'column',
					boxSizing: 'border-box',
					padding: 0,
					paddingBottom: 10,
					marginBottom: 20,
				}}
			>
				<ThemedView
					style={{
						width: '100%',
						padding: 10,
						height: 80,
						borderTopStartRadius: 8,
						borderTopEndRadius: 8,
						justifyContent: 'center',
						alignItems: 'center',
					}}
					lightColor={yellow}
					darkColor={yellow}
				>
					<ThemedText
						lightColor={screenTitleText}
						darkColor={screenTitleText}
						style={{
							fontSize: fontSize['heading.one'],
							fontWeight: fontWeight['heading.one'],
						}}
					>
						{translateWithVariables(
							translations[language].categories.vouchers.editVoucher,
							{ voucher: voucher ?? '' }
						)}
					</ThemedText>
				</ThemedView>
				<ThemedView
					id='router-form'
					lightColor={backgroundLight}
					darkColor={backgroundDark}
					style={{
						width: '100%',
						paddingHorizontal: 20,
						paddingVertical: 10,
					}}
				>
					<ThemedInput
						label={translations[language].categories.vouchers.username}
						placeholder='eg. 11111'
						value={username || ''}
						setValue={(value) => setUsername(value)}
						labelStyle={{
							fontWeight: fontWeight['heading.two'],
						}}
						style={{
							backgroundColor: background,
							borderWidth: 2,
							borderColor: inputBorder,
							marginBottom: 10,
						}}
					/>
					<ThemedInput
						label={translations[language].categories.vouchers.password}
						placeholder='******'
						value={password || ''}
						setValue={(value) => setPassword(value)}
						labelStyle={{
							fontWeight: fontWeight['heading.two'],
						}}
						style={{
							backgroundColor: background,
							borderWidth: 2,
							borderColor: inputBorder,
							marginBottom: 10,
						}}
					/>
					<ThemedInput
						label={translations[language].categories.vouchers.profile}
						placeholder='Daily-1000Shs'
						value={profile || ''}
						setValue={(value) => setProfile(value)}
						labelStyle={{
							fontWeight: fontWeight['heading.two'],
						}}
						style={{
							backgroundColor: background,
							borderWidth: 2,
							borderColor: inputBorder,
							marginBottom: 10,
						}}
					/>
					<ThemedView
						style={{
							flexDirection: 'row',
							width: '100%',
							gap: 10,
							marginTop: 10,
						}}
						lightColor={backgroundLight}
						darkColor={backgroundDark}
					>
						<ThemedButton
							title={translations[
								language
							].categories.buttons.saveChanges.toUpperCase()}
							lightColor={bim}
							darkColor={bim}
							darkTextColor={white}
							lightTextColor={white}
							onPress={handleCreateRouter}
							style={{ flex: 2 }}
						/>
						<ThemedButton
							title={translations[
								language
							].categories.buttons.cancel.toUpperCase()}
							lightColor={secondaryButton}
							darkColor={secondaryButton}
							darkTextColor={white}
							lightTextColor={white}
							onPress={handleCancel}
							style={{ flex: 1 }}
						/>
					</ThemedView>
				</ThemedView>
			</TileContainer>
		</ParallaxScrollView>
	);
}
