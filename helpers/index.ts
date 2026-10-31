import {
	countryCode as defaultCountryCode,
	phoneNumberLength,
} from '@/constants';
import { Alert, AlertButton, Platform, ToastAndroid } from 'react-native';

export function filterCharacters(
	input: string,
	type: 'number' | 'text' | 'password'
): string {
	if (type === 'number')
		// Return only numeric characters8
		return input?.replace(/[^0-9]/g, '');
	else if (type === 'text')
		// Return only alphabetic characters (excluding special characters)
		return input?.replace(/[^a-zA-Z\s]/g, '');
	else if (type === 'password')
		return input?.replaceAll(' ', ''); // Return anything that has been input
	else return ''; // Return anything that has been input
}

export function isTruthy(value: unknown) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

export function translateWithVariables(
	text: string,
	variables: Record<string, string | number>
): string {
	return text.replace(/{(\w+)}/g, (match, key) => {
		return variables[key]?.toString() || match;
	});
}

export function formatPhoneNumber(phoneNumber: string, len?: number): string {
	// Remove all non-numeric characters (including spaces) to ensure consistent formatting
	let filteredValue = filterCharacters(phoneNumber, 'number');
	let interimValue = '';

	// If filteredValue doesn't start with 0, add 0 at the start
	if (
		filteredValue !== '' &&
		filteredValue?.length > 1 &&
		!filteredValue?.startsWith('0')
	) {
		filteredValue = '0' + filteredValue;
	}

	// Limit the length of the filtered value
	if (filteredValue.length > (len ?? phoneNumberLength)) {
		filteredValue = filteredValue.slice(0, len ?? phoneNumberLength);
	}

	// Format the number: first 4 digits, then groups of 3
	if (filteredValue.length <= 4) {
		interimValue = filteredValue;
	} else {
		const firstPart = filteredValue.slice(0, 4);
		const rest = filteredValue.slice(4); // Remaining digits
		const groupedRest = rest.match(/.{1,3}/g)?.join(' ') || ''; // Group into chunks of 3
		interimValue = `${firstPart} ${groupedRest}`.trim(); // Combine and trim
	}

	return interimValue;
}

/**
 * Normalize a phone number for sending to backend APIs in E.164 format.
 * - Returns a string beginning with country code without '+' (e.g. 2567...) API doesn't expect the +
 * - Removes spaces and non-digit characters
 * - Converts numbers starting with '00' to international form
 * - Removes local trunk leading zeros before prepending default country code
 * - Returns an empty string for falsy input
 */
// IMPORTANT: The backend API expects phone tokens without a leading '+' character.
// This function intentionally returns only the numeric digits (e.g. '25677...'),
// not '+25677...'. Do NOT change this behavior — many endpoints require the
// token without the plus character.
export function normalizePhoneForApi(phone?: string | null): string {
	if (!phone) return '';
	const raw = String(phone).trim();

	// If user already provided a leading '+', keep international digits and return
	if (raw.startsWith('+')) {
		const digits = filterCharacters(raw, 'number');
		return digits ?? '';
	}

	// Treat leading '00' as international prefix (convert to +)
	const leading00 = raw.startsWith('00');
	let digits = filterCharacters(raw, 'number');
	if (!digits) return '';

	if (leading00) {
		// remove the leading 00 and return as +<digits>
		digits = digits.replace(/^00+/, '');
		return digits;
	}

	// Remove local trunk zeros (e.g., 0789... -> 789...)
	digits = digits.replace(/^0+/, '');

	// Determine default country code digits (e.g. '+256' -> '256')
	const cc = String(defaultCountryCode ?? '').replace(/[^0-9]/g, '');
	if (cc) {
		const userProvided = digits.startsWith(cc);
		if (!userProvided) digits = `${cc}${digits}`;
	}

	return digits;
}

/**
 * Parse an amount value returned by the server into a number.
 * Accepts numeric strings (with optional commas) or numbers.
 * Returns NaN if the input cannot be parsed.
 */
export function parseAmount(value?: string | number | null): number {
	if (value === null || typeof value === 'undefined') return NaN;
	if (typeof value === 'number') return value;
	const cleaned = String(value).replace(/[,\s]/g, '');
	const n = Number(cleaned);
	return Number.isFinite(n) ? n : NaN;
}

export function ShowAlert(
	message: string,
	type: 'Success' | 'Error',
	options?: AlertButton[]
): void {
	if (Platform.OS === 'android' && !options)
		ToastAndroid.show(
			message,
			type === 'Error' ? ToastAndroid.LONG : ToastAndroid.SHORT
		);
	else if (options) Alert.alert(type, message, options);
	else Alert.alert(type, message, [{ text: 'OK' }]);
}

export function generateRandomNumbers(length: number): string {
	let result = '';
	const characters = '0123456789';
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

export function generateRandomString(length: number): string {
	let result = '';
	const characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

export function generateRandomInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDateBetweenDaysAgo(daysAgo = 6): Date {
	const now = new Date();
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - daysAgo);
	const randomTs =
		start.getTime() + Math.random() * (now.getTime() - start.getTime());
	return new Date(randomTs);
}

export function toLocalISOString(date: Date) {
	const pad = (n: number) => n.toString().padStart(2, '0');
	return (
		date.getFullYear() +
		'-' +
		pad(date.getMonth() + 1) +
		'-' +
		pad(date.getDate()) +
		' ' +
		pad(date.getHours()) +
		':' +
		pad(date.getMinutes()) +
		':' +
		pad(date.getSeconds())
	);
}

export function formatMMDD(date: Date) {
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${m}-${d}`;
}

/**
 * Convert milliseconds to a compact HhMmSs string. Examples:
 * 19812000 -> "5h30m12s"
 * 180000 -> "3m0s"
 * 5000 -> "5s"
 */
export function msToHms(milliseconds: number): string {
	if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0s';
	const totalSeconds = Math.floor(milliseconds / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	// Always show seconds (including 0) to have a deterministic string
	parts.push(`${seconds}s`);

	return parts.join('');
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a number with thousand separators and fixed decimals.
 * Defaults to 2 decimal places. Falls back gracefully if Intl is unavailable.
 */
export function formatAmount(value: number | string, decimals = 2): string {
	const n = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(n)) return '0';
	try {
		return new Intl.NumberFormat(undefined, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		}).format(n);
	} catch {
		const fixed = n.toFixed(decimals);
		const [intPart, decPart] = fixed.split('.');
		const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return decPart ? `${withCommas}.${decPart}` : withCommas;
	}
}

/**
 * Format an ISO date/time string for display. Returns a dash for empty values.
 */
export function formatDateTime(value?: string | null): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString(undefined, {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

/**
 * Convert a millisecond timestamp to a human-friendly relative time string.
 * Examples: "just now", "5 minutes ago", "2 hours ago", "3 days ago"
 */
export function timeAgo(ms?: number | null): string {
	if (!ms || !Number.isFinite(ms)) return 'just now';
	const diff = Date.now() - Number(ms);
	if (diff < 5000) return 'just now';

	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return `${seconds} seconds ago`;

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} minutes ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hours ago`;

	const days = Math.floor(hours / 24);
	if (days < 7) return `${days} days ago`;

	try {
		return new Date(ms).toLocaleString();
	} catch {
		return new Date(ms).toISOString();
	}
}

/**
 * Validate an IPv4 address in dotted decimal notation.
 * - Must have exactly 4 octets
 * - Each octet is numeric and between 0 and 255
 * - No leading zeros unless the octet is exactly "0"
 */
export function validateIPv4(ip: string): boolean {
	if (typeof ip !== 'string') return false;
	const parts = ip.trim().split('.');
	if (parts.length !== 4) return false;
	for (const part of parts) {
		if (part.length === 0) return false;
		if (!/^\d+$/.test(part)) return false;
		// disallow leading zeros like 01, 001 etc., but allow single '0'
		if (part.length > 1 && part.startsWith('0')) return false;
		const n = Number(part);
		if (n < 0 || n > 255) return false;
	}
	return true;
}

/**
 * convert truthy or falsy values to boolean
 * convert boolean string equivalents to boolean
 */
export function toBoolean(v: string | boolean | number | null | undefined) {
	if (typeof v === 'string') {
		return v.toLowerCase() === 'true';
	}
	return Boolean(v);
}
