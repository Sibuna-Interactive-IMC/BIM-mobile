import useHeaderBack from '@/hooks/useHeaderBack';

/**
 * Returns to the Accounts hub. Use this on the hub's direct sub-views; deeper
 * screens should call `useHeaderBack` with their own parent instead.
 */
export default function useAccountsBack() {
	return useHeaderBack('/(authenticated)/accounts');
}
