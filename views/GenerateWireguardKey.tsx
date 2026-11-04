import { useRef, useState } from 'react';
import {
    Animated,
    findNodeHandle,
    Platform,
    TextInput as RNTextInput,
    useColorScheme
} from 'react-native';

import OverlayContainer from '@/components/OverlayContainer';
import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useThemeColor } from '@/hooks/useThemeColor';

type Props = {
    visible: boolean;
    fadeAnim: Animated.Value;
    toggleVisible: (show?: boolean) => void;
    generateWireguardKeys: (payload: {
        name: string;
        endpointAddress?: string;
        endpointPort?: number;
    }) => void;
    onRequestClose?: () => void;
};

export default function GenerateWireguardKey({
    visible,
    fadeAnim,
    toggleVisible,
    generateWireguardKeys,
    onRequestClose,
}: Props) {
    useColorScheme();
    const { language, keyboardVisible } = useGeneral();

    const bg = useThemeColor({}, 'background');
    const screenTitleText = useThemeColor({}, 'screenTitleText');
    const cancelButton = useThemeColor({}, 'cancelButton');
    const bim = useThemeColor({}, 'bim');
    const white = useThemeColor({}, 'white');
    const errorColor = useThemeColor({}, 'error');
    const inputBorder = useThemeColor({}, 'inputBorder');
    const [keyname, setKeyname] = useState('');
    const [endpointAddress, setEndpointAddress] = useState('');
    const [endpointPort, setEndpointPort] = useState('');
    const [inputErrors, setInputErrors] = useState<{ [key: string]: boolean }>({});
    const scrollRef = useRef<any>(null);
    const addressInputRef = useRef<RNTextInput | null>(null);
    const portInputRef = useRef<RNTextInput | null>(null);

    const primaryButtonTitle = translations[language].categories.connector.newKeyButton.toUpperCase();

    const onCancel = () => toggleVisible(false);
    const onGenerate = () => {
        if (keyname.trim() === '' || keyname.length < 3) {
            setInputErrors((prev) => ({ ...prev, keyname: true }));
            return;
        } else {
            setInputErrors((prev) => ({ ...prev, keyname: false }));
        }
        generateWireguardKeys({
            name: keyname,
            endpointAddress: endpointAddress.trim(),
            endpointPort: parseInt(endpointPort.trim()),
        });
    };

    const scrollToInput = (
        inputRef: React.RefObject<RNTextInput | null>,
        extra: number = 64
    ) => {
        const doScroll = () => {
            try {
                const node = findNodeHandle(inputRef.current);
                if (!node) return;
                const responder =
                    scrollRef.current?.getScrollResponder?.() ?? scrollRef.current;
                responder?.scrollResponderScrollNativeHandleToKeyboard?.(
                    node,
                    extra,
                    true
                );
            } catch { }
        };
        doScroll();
        setTimeout(doScroll, Platform.OS === 'ios' ? 260 : 80);
        setTimeout(doScroll, Platform.OS === 'ios' ? 420 : 150);
    };

    return (
        <OverlayContainer
            showOverlay={visible}
            fadeAnim={fadeAnim}
            position='center'
            onRequestClose={onRequestClose ?? onCancel}
            scrollable
            autoKeyboardInset
            bottomPadding={16}
            keyboardGap={40}
            getScrollRef={(r) => (scrollRef.current = r)}
            centerLiftOnKeyboard={false}
        >
            <ThemedView
                style={{
                    flexDirection: 'column',
                    backgroundColor: bg,
                    padding: 20,
                    borderRadius: 10,
                    width: '100%',
                    gap: 12,
                }}
                lightColor={bg}
                darkColor={bg}
            >
                <ThemedText
                    style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}
                    lightColor={screenTitleText}
                    darkColor={screenTitleText}
                >
                    {translations[language].categories.connector.overlayTitle}
                </ThemedText>

                <ThemedInput
                    label={translations[language].categories.connector.keyName}
                    placeholder={translations[language].categories.connector.keyName}
                    value={keyname}
                    setValue={setKeyname}
                    editable={true}
                    style={{
                        backgroundColor: bg,
                        borderColor: inputErrors.keyname ? errorColor : inputBorder,
                        borderWidth: 1,
                    }}
                    containerStyle={{ marginBottom: 4 }}
                />

                <ThemedInput
                    ref={addressInputRef as any}
                    label={translations[language].categories.vouchers.numberOfUsers}
                    placeholder={'203.0.113.5'}
                    keyboardType='number-pad'
                    value={endpointAddress}
                    setValue={setEndpointAddress}
                    onFocus={() => scrollToInput(addressInputRef)}
                    editable={true}
                    style={{
                        backgroundColor: bg,
                        borderColor: inputBorder,
                        borderWidth: 1,
                    }}
                    containerStyle={{ marginBottom: 4 }}
                />

                <ThemedInput
                    ref={portInputRef as any}
                    label={translations[language].categories.vouchers.numberOfUsers}
                    placeholder={'51820'}
                    keyboardType='number-pad'
                    value={endpointPort}
                    setValue={setEndpointPort}
                    onFocus={() => scrollToInput(portInputRef)}
                    editable={true}
                    style={{
                        backgroundColor: bg,
                        borderColor: inputBorder,
                        borderWidth: 1,
                    }}
                    containerStyle={{ marginBottom: 4 }}
                />

                <ThemedView
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        gap: 10,
                        marginTop: 12,
                    }}
                    lightColor='transparent'
                    darkColor='transparent'
                >
                    <ThemedButton
                        title={translations[
                            language
                        ].categories.connector.cancel.toUpperCase()}
                        onPress={onCancel}
                        numberOfLines={1}
                        style={{ maxWidth: '35%' }}
                        lightColor={cancelButton}
                        darkColor={cancelButton}
                        lightTextColor={white}
                        darkTextColor={white}
                    />
                    <ThemedButton
                        title={primaryButtonTitle}
                        numberOfLines={1}
                        style={{ maxWidth: '60%' }}
                        lightColor={bim}
                        darkColor={bim}
                        lightTextColor={white}
                        darkTextColor={white}
                        onPress={onGenerate}
                    />
                </ThemedView>
            </ThemedView>
        </OverlayContainer>
    );
}
