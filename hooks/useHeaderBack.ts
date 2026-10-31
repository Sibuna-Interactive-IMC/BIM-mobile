import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect } from 'react';

/**
 * Turns the header's drawer button into a back chevron that returns to `path`.
 * Pass the screen's own parent (not the Accounts hub) so a drill-down steps back
 * one level, e.g. a business list returns to business analytics.
 */
export default function useHeaderBack(path: string) {
	const navigation = useNavigation();
	const router = useRouter();

	useEffect(() => {
		try {
			navigation.setOptions({
				headerProps: {
					goback: true,
					handleGoBack: () => router.navigate(path as Href),
				},
			});
		} catch {
			// Previews render these screens without a navigator; nothing to override there.
		}
	}, [navigation, path, router]);
}
