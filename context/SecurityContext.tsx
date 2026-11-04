import { getApiData } from '@/helpers/apiResponse';
import * as ConnectorService from '@/services/ConnectorService';
import type { GetConnectorKeyResponse, GetConnectorKeysResponse, WireguardKey } from '@/types';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from 'react';
import { useGeneral } from './GeneralContext';

export interface SecurityContextType {
	/** All WireGuard keys for the authenticated user */
	wireguardKeys: WireguardKey[];
	/** Whether a WireGuard operation is in flight */
	loading: boolean;
	setLoading: (loading: boolean) => void;
	/** Fetch all WireGuard keys from the API */
	fetchWireguardKeys: () => Promise<void>;
	/** Create a new WireGuard key pair */
	createWireguardKey: (keyName: string, address?: string, port?: number) => Promise<WireguardKey | null>;
	/** Update the display name of a WireGuard key */
	updateWireguardKey: (id: string, keyName: string) => Promise<WireguardKey | null>;
	/** Delete a WireGuard key */
	deleteWireguardKey: (id: string) => Promise<boolean>;
	/** Retry adding a WireGuard peer */
	retryWireguardKey: (id: string) => Promise<boolean>;
	/** Repair a WireGuard key configuration */
	repairWireguardKey: (id: string) => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const { authToken, handleLogout } = useGeneral();
	const [wireguardKeys, setWireguardKeys] = useState<WireguardKey[]>([]);
	const [loading, setLoading] = useState(false);

	// --------------- fetch ---------------

	const fetchWireguardKeys = useCallback(async () => {
		if (!authToken) {
			handleLogout();
			return;
		}
		setLoading(true);
		try {
			const res = await ConnectorService.fetchWireguardKeys(authToken);
			if (res && res.ok) {
				const body: GetConnectorKeysResponse = await res.json();
				// API 2.0: `{ data: { keys: [...] } }`
				const keys = getApiData<NonNullable<GetConnectorKeysResponse['data']>>(body)?.keys;
				if (Array.isArray(keys)) {
					setWireguardKeys(keys);
				}
			}
		} catch (e) {
			console.error('fetchWireguardKeys: failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken, handleLogout]);

	// --------------- create ---------------

	const createWireguardKey = useCallback(
		async (keyName: string, address?: string, port?: number): Promise<WireguardKey | null> => {
			if (!authToken) {
				handleLogout();
				return null;
			}
			setLoading(true);
			try {
				const res = await ConnectorService.createWireguardKey(keyName, address, port, authToken);
				if (res && res.ok) {
					const body: GetConnectorKeyResponse = await res.json();
					const newKey = getApiData<NonNullable<GetConnectorKeyResponse['data']>>(body)?.key;
					if (newKey) {
						setWireguardKeys((prev) => [...prev, newKey]);
						return newKey;
					}
				}
			} catch (e) {
				console.error('createWireguardKey: failed', e);
			} finally {
				setLoading(false);
			}
			return null;
		},
		[authToken, handleLogout],
	);

	// --------------- update ---------------

	const updateWireguardKey = useCallback(
		async (id: string, keyName: string): Promise<WireguardKey | null> => {
			if (!authToken) {
				handleLogout();
				return null;
			}
			setLoading(true);
			try {
				const res = await ConnectorService.updateWireguardKey(id, keyName, authToken);
				if (res && res.ok) {
					const body: GetConnectorKeyResponse = await res.json();
					const updated = getApiData<NonNullable<GetConnectorKeyResponse['data']>>(body)?.key;
					if (updated) {
						setWireguardKeys((prev) =>
							prev.map((k) => (k.id === id ? updated : k)),
						);
						return updated;
					}
				}
			} catch (e) {
				console.error('updateWireguardKey: failed', e);
			} finally {
				setLoading(false);
			}
			return null;
		},
		[authToken, handleLogout],
	);

	// --------------- delete ---------------

	const deleteWireguardKey = useCallback(
		async (id: string): Promise<boolean> => {
			if (!authToken) {
				handleLogout();
				return false;
			}
			setLoading(true);
			try {
				const res = await ConnectorService.deleteWireguardKey(id, authToken);
				if (res && res.ok) {
					setWireguardKeys((prev) => prev.filter((k) => k.id !== id));
					return true;
				}
			} catch (e) {
				console.error('deleteWireguardKey: failed', e);
			} finally {
				setLoading(false);
			}
			return false;
		},
		[authToken, handleLogout],
	);

	// --------------- retry ---------------

	const retryWireguardKey = useCallback(
		async (id: string): Promise<boolean> => {
			if (!authToken) {
				handleLogout();
				return false;
			}
			setLoading(true);
			try {
				const res = await ConnectorService.retryWireguardKey(id, authToken);
				if (res && res.ok) {
					// Refresh the list so the key reflects its new status
					await fetchWireguardKeys();
					return true;
				}
			} catch (e) {
				console.error('retryWireguardKey: failed', e);
			} finally {
				setLoading(false);
			}
			return false;
		},
		[authToken, handleLogout, fetchWireguardKeys],
	);

	// --------------- repair ---------------

	const repairWireguardKey = useCallback(
		async (id: string): Promise<boolean> => {
			if (!authToken) {
				handleLogout();
				return false;
			}
			setLoading(true);
			try {
				const res = await ConnectorService.repairWireguardKey(id, authToken);
				if (res && res.ok) {
					await fetchWireguardKeys();
					return true;
				}
			} catch (e) {
				console.error('repairWireguardKey: failed', e);
			} finally {
				setLoading(false);
			}
			return false;
		},
		[authToken, handleLogout, fetchWireguardKeys],
	);


	useEffect(() => {
		(async function () {
			if (authToken) {

				fetchWireguardKeys();
			}
		})();
	}, [fetchWireguardKeys, authToken]);

	return (
		<SecurityContext.Provider
			value={{
				wireguardKeys,
				loading,
				setLoading,
				fetchWireguardKeys,
				createWireguardKey,
				updateWireguardKey,
				deleteWireguardKey,
				retryWireguardKey,
				repairWireguardKey,
			}}
		>
			{children}
		</SecurityContext.Provider>
	);
};

export function useSecurity(): SecurityContextType {
	const ctx = useContext(SecurityContext);
	if (!ctx) {
		throw new Error('useSecurity must be used within a SecurityProvider');
	}
	return ctx;
}
