import { useGeneral } from '@/context/GeneralContext';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Records the current route in the app-level view history used by the header
 * back button. Screens that can be returned to must pass their concrete path so
 * `handleGoBack` always has a navigable target.
 *
 * Tracking runs on focus (which also covers the first mount) so it never
 * registers a screen twice or out of order.
 */
export default function useTrackHistory(path?: string) {
	const router = useRouter();
	const { handleUpdateHistory } = useGeneral();

	const derivePath = useCallback((): string => {
		if (path && path.length > 0) return path;
		let derived = '';
		try {
			// expo-router's imperative router does not expose the current route;
			// these fields only exist on some shims, so treat them as best effort.
			// @ts-ignore
			derived = router.pathname || router.asPath || router.route || '';
		} catch {
			derived = '';
		}
		return derived ? derived.toString() : '';
	}, [path, router]);

	useFocusEffect(
		useCallback(() => {
			const current = derivePath();
			if (!current) return;
			try {
				handleUpdateHistory(current);
			} catch {}
		}, [derivePath, handleUpdateHistory])
	);
}
