import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect } from 'react';
import {
	Animated,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

export type ToastType = 'error' | 'message';

interface Props {
	visible: boolean;
	type: ToastType;
	message: string;
	onDismiss: () => void;
	onAction?: () => void;
	actionLabel?: string;
}

export default function Toast({
	visible,
	type,
	message,
	onDismiss,
	onAction,
	actionLabel,
}: Props) {
	const errorColor = useThemeColor({}, 'error');
	const limeColor = useThemeColor({}, 'lime');
	const bg = type === 'error' ? errorColor : limeColor;

	useEffect(() => {
		if (!visible) return;
		let t: NodeJS.Timeout | null = null;
		// auto-dismiss for 'message' type
		if (type === 'message') {
			t = setTimeout(() => onDismiss(), 3000);
		}
		return () => {
			if (t) clearTimeout(t as any);
		};
	}, [visible, type, onDismiss]);

	if (!visible) return null;

	const requireDismiss = Boolean(onAction) || type === 'error';

	return (
		<View style={styles.container} pointerEvents='box-none'>
			<Animated.View style={[styles.toast, { backgroundColor: bg }]}>
				<Text style={styles.message}>{message}</Text>
				{requireDismiss && (
					<TouchableOpacity
						onPress={() => (onAction ? onAction() : onDismiss())}
						style={styles.button}
					>
						<Text style={styles.buttonText}>{actionLabel || 'Dismiss'}</Text>
					</TouchableOpacity>
				)}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		top: 40,
		left: 0,
		right: 0,
		alignItems: 'center',
		zIndex: 9999,
	},
	toast: {
		minWidth: '80%',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		elevation: 4,
	},
	message: {
		color: '#ffffff',
		flex: 1,
		marginRight: 8,
	},
	button: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 6,
		backgroundColor: 'rgba(255,255,255,0.12)',
	},
	buttonText: {
		color: '#ffffff',
		fontWeight: '600',
	},
});
