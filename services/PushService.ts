import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { RegisterPushDevicePayload } from '@/types';

/** Where this install remembers the push row it created on the backend. */
const PUSH_DEVICE_KEY = 'push_device';
/** Stable id for this install, sent as `device_id` with the registration. */
const PUSH_INSTALL_KEY = 'push_install_id';

export interface StoredPushDevice {
	/** Device push token (FCM registration token / APNs token). */
	token: string;
	/** `id` of the `push_devices` row, needed to remove it on logout. */
	deviceId: string | null;
}

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

/** `GET /push-devices` — the caller's registered installs. */
export async function fetchPushDevices(token?: string) {
	return apiFetch(`${apiBaseUrl || ''}/push-devices`, {
		method: 'GET',
		headers: buildHeaders(token),
	});
}

/**
 * `POST /push-devices` — upsert on the FCM token.
 *
 * The token identifies the install, so this also rebinds the row when another
 * user signs in on the same device.
 */
export async function registerPushDevice(
	payload: RegisterPushDevicePayload,
	authToken?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/push-devices`, {
		method: 'POST',
		headers: buildHeaders(authToken),
		body: JSON.stringify(payload),
	});
}

/** `DELETE /push-devices/{id}` — stops pushes for this install. */
export async function removePushDevice(id: string, authToken?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/push-devices/${encodeURIComponent(id)}`,
		{ method: 'DELETE', headers: buildHeaders(authToken) }
	);
}

export async function rememberPushDevice(device: StoredPushDevice) {
	try {
		await AsyncStorage.setItem(PUSH_DEVICE_KEY, JSON.stringify(device));
	} catch (error) {
		console.warn('[PushService] could not persist the push device', error);
	}
}

export async function storedPushDevice(): Promise<StoredPushDevice | null> {
	try {
		const raw = await AsyncStorage.getItem(PUSH_DEVICE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<StoredPushDevice> | null;
		if (!parsed || typeof parsed.token !== 'string') return null;
		return {
			token: parsed.token,
			deviceId: parsed.deviceId ?? null,
		};
	} catch {
		return null;
	}
}

export async function forgetPushDevice() {
	try {
		await AsyncStorage.removeItem(PUSH_DEVICE_KEY);
	} catch {
		// nothing to do — the row is dropped server side on the next login
	}
}

/**
 * Stable per-install id.
 *
 * `expo-device` only exposes the hardware model, which is not unique, so the
 * backend gets a generated value that survives restarts.
 */
export async function ensureInstallId(): Promise<string> {
	try {
		const existing = await AsyncStorage.getItem(PUSH_INSTALL_KEY);
		if (existing) return existing;
	} catch {
		// fall through and mint a new one for this session
	}
	const id = `${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2, 10)}`;
	try {
		await AsyncStorage.setItem(PUSH_INSTALL_KEY, id);
	} catch {
		// best effort: the id is only a hint for the backend
	}
	return id;
}

/**
 * Removes this install from the backend, then drops the local record.
 *
 * Best effort: logout must never block on the push endpoint.
 */
export async function unregisterPushDevice(authToken?: string) {
	const stored = await storedPushDevice();
	if (!stored?.deviceId || !authToken) {
		await forgetPushDevice();
		return;
	}
	await removePushDevice(stored.deviceId, authToken);
	await forgetPushDevice();
}

export default {
	fetchPushDevices,
	registerPushDevice,
	removePushDevice,
	rememberPushDevice,
	storedPushDevice,
	forgetPushDevice,
	ensureInstallId,
	unregisterPushDevice,
};
