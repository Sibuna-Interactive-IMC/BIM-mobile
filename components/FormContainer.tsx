import React from 'react';
import {
	KeyboardAvoidingView,
	KeyboardAvoidingViewProps,
	Platform,
	View,
} from 'react-native';

type Props = React.PropsWithChildren<{
	style?: any;
	behavior?: KeyboardAvoidingViewProps['behavior'];
	keyboardVerticalOffset?: number;
}>;

export default function FormContainer({
	children,
	style,
	behavior,
	keyboardVerticalOffset,
}: Props) {
	// Use KeyboardAvoidingView when a behavior is explicitly requested, or on iOS by default.
	const shouldUseKeyboardAvoiding =
		behavior !== undefined || Platform.OS === 'ios';

	if (shouldUseKeyboardAvoiding) {
		// On Android, passing behavior (e.g. 'padding') enables keyboard avoiding when desired.
		return (
			<KeyboardAvoidingView
				behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : 'padding')}
				keyboardVerticalOffset={keyboardVerticalOffset ?? 0}
				style={style}
			>
				{children}
			</KeyboardAvoidingView>
		);
	}

	// Default fallback: plain View
	return <View style={style}>{children}</View>;
}
