import { Switch, type SwitchProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedSwitchProps = SwitchProps & {
    lightColor?: string;
    darkColor?: string;
};

export function ThemedSwitch({
    lightColor,
    darkColor,
    thumbColor,
    trackColor,
    ...rest
}: ThemedSwitchProps) {
    const enabledTrackColor = useThemeColor(
        { light: lightColor, dark: darkColor },
        'bim'
    );
    const disabledTrackColor = useThemeColor({}, 'inputBorder');
    const disabledThumbColor = useThemeColor({}, 'lightGrey');
    // The knob takes the track colour unless a caller asks for something else,
    // so an "on" switch reads as one solid brand-coloured control.
    const enabledThumbColor = thumbColor ?? enabledTrackColor;
    return (
        <Switch
            trackColor={{
                false: disabledTrackColor,
                true: enabledTrackColor,
                ...trackColor

            }}
            thumbColor={
                rest.disabled
                    ? disabledThumbColor
                    : rest.value
                      ? enabledThumbColor
                      : disabledThumbColor
            }
            {...rest}
        />
    );
}