import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { useThemeColor } from '@/hooks/useThemeColor';

type Stage = 'image' | 'svg' | 'placeholder';

const isSvg = (uri: string) => uri.split('?')[0].toLowerCase().endsWith('.svg');

/**
 * The shipped preset avatars are SVGs: a browser draws one inside `<img>`, but a
 * native `Image` cannot, so it goes through `react-native-svg` there. A failed
 * fetch falls back to the placeholder instead of an empty box.
 */
export default function AvatarImage({
	uri,
	size = 84,
	alt,
}: {
	uri?: string | null;
	size?: number;
	alt?: string;
}) {
	const placeholderBg = useThemeColor({}, 'listItemBackground');
	const placeholderIcon = useThemeColor({}, 'mutedText');

	const initial = useCallback(
		(value?: string | null): Stage => {
			if (!value) return 'placeholder';
			if (Platform.OS === 'web') return 'image';
			return isSvg(value) ? 'svg' : 'image';
		},
		[]
	);

	const [stage, setStage] = useState<Stage>(() => initial(uri));

	// A changed avatar id deserves a fresh attempt.
	useEffect(() => {
		setStage(initial(uri));
	}, [initial, uri]);

	const handleError = useCallback(() => {
		setStage((prev) => (prev === 'image' && Platform.OS !== 'web' ? 'svg' : 'placeholder'));
	}, []);

	const radius = size / 2;

	if (stage === 'svg' && uri) {
		return (
			<View style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
				<SvgUri
					uri={uri}
					width={size}
					height={size}
					onError={handleError}
					fallback={
						<View
							style={[
								styles.frame,
								{
									width: size,
									height: size,
									borderRadius: radius,
									backgroundColor: placeholderBg,
								},
							]}
						/>
					}
				/>
			</View>
		);
	}

	if (stage === 'image' && uri) {
		return (
			<Image
				source={{ uri }}
				accessibilityLabel={alt}
				style={{ width: size, height: size, borderRadius: radius }}
				onError={handleError}
			/>
		);
	}

	return (
		<View
			style={[
				styles.placeholder,
				{
					width: size,
					height: size,
					borderRadius: radius,
					backgroundColor: placeholderBg,
				},
			]}
		>
			<IconSymbol name='account' size={size * 0.5} color={placeholderIcon} />
		</View>
	);
}

const styles = StyleSheet.create({
	frame: {
		overflow: 'hidden',
	},
	placeholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
});
