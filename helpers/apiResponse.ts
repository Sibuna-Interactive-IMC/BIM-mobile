import type { ApiErrors, PaginationMeta } from '@/types';

/**
 * Helpers for reading the API 2.0 response envelope:
 *   { success, message, data, meta, operation, errors }
 *
 * Every endpoint returns this envelope, so call sites should read the actual
 * payload from `data` (or use `getApiData`) instead of the top level body.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

/** True when the body (or `body.data`) reports success. */
export function isApiSuccess(body: unknown): boolean {
	const record = asRecord(body);
	if (!record) return false;
	const value = 'success' in record ? record.success : asRecord(record.data)?.success;
	return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Extract the `data` payload from an API response body.
 *
 * API 2.0 always wraps payloads in `data`. Older deployments answered with the
 * payload at the top level next to `success`/`message`; those extra keys are
 * stripped here so both shapes can be consumed the same way.
 */
export function getApiData<TData = unknown>(body: unknown): TData | null {
	if (Array.isArray(body)) return body as TData;
	const record = asRecord(body);
	if (!record) return null;
	if ('data' in record) return (record.data ?? null) as TData | null;
	const {
		success: _success,
		message: _message,
		meta: _meta,
		operation: _operation,
		errors: _errors,
		...payload
	} = record;
	return Object.keys(payload).length ? (payload as TData) : null;
}

/** Keys that identify a pagination block (as opposed to a map of blocks). */
const PAGINATION_KEYS = [
	'current_page',
	'per_page',
	'total',
	'last_page',
	'first_item',
	'last_item',
] as const;

function isPaginationBlock(
	value: Record<string, unknown> | null
): value is Record<string, unknown> & PaginationMeta {
	if (!value) return false;
	return PAGINATION_KEYS.some((key) => typeof value[key] === 'number');
}

/**
 * Pagination block for a collection.
 *
 * `meta.pagination` is keyed by collection name, e.g.
 *   `{ pagination: { active: { total: 18, per_page: 10, current_page: 1, ... } } }`
 * Pass the collection name (`key`) to read a specific block; without a key the
 * first block that carries paging numbers is returned. Flat
 * `{ pagination: { current_page, ... } }` responses and legacy `*_meta`
 * siblings inside `data` are still supported.
 */
export function getApiPagination(
	body: unknown,
	key?: string
): PaginationMeta | undefined {
	const record = asRecord(body);
	const meta = asRecord(record?.meta) ?? asRecord(asRecord(record?.data)?.meta);
	const pagination = asRecord(meta?.pagination);

	// Flat shape: `meta.pagination` holds the numbers directly.
	if (isPaginationBlock(pagination)) return pagination;

	if (pagination) {
		// Keyed shape: pick the requested collection, else the first block.
		if (key) {
			const named = asRecord(pagination[key]);
			if (isPaginationBlock(named)) return named;
		}
		for (const value of Object.values(pagination)) {
			const block = asRecord(value);
			if (isPaginationBlock(block)) return block;
		}
	}

	// Older router payloads carried `cookies_meta` / `users_meta` / `hosts_meta`
	// / `leases_meta` / `active_meta` next to the collection. The API 2.0
	// `ApiResponse::paginated()` helper uses the longer `<key>_metadata` suffix
	// and puts both at the top level of the envelope (next to success/message),
	// so read the payload with `getApiData` and accept both suffixes.
	const payload = getApiData<Record<string, unknown>>(body);
	if (!payload) return undefined;
	if (key) {
		const named =
			asRecord(payload[`${key}_metadata`]) ?? asRecord(payload[`${key}_meta`]);
		if (isPaginationBlock(named)) return named;
	}
	for (const [entryKey, value] of Object.entries(payload)) {
		if (!entryKey.endsWith('_meta') && !entryKey.endsWith('_metadata')) continue;
		const legacyMeta = asRecord(value);
		if (isPaginationBlock(legacyMeta)) return legacyMeta;
	}
	return undefined;
}

/** Concrete paging numbers for UI controls (defaults applied). */
export interface PageInfo {
	current_page: number;
	last_page: number;
	total?: number;
	per_page?: number;
}

/**
 * Paging numbers for the given collection (`key`), e.g. `getPageInfo(body, 'active')`.
 */
export function getPageInfo(body: unknown, key?: string): PageInfo | undefined {
	const pagination = getApiPagination(body, key);
	if (!pagination) return undefined;
	return {
		current_page: pagination.current_page ?? 1,
		last_page: pagination.last_page ?? 1,
		total: pagination.total,
		per_page: pagination.per_page,
	};
}

/** `message` of the envelope. */
export function getApiMessage(body: unknown): string | undefined {
	const record = asRecord(body);
	const message = record?.message ?? asRecord(record?.data)?.message;
	return typeof message === 'string' && message.trim() ? message : undefined;
}

/** `errors` block of the envelope (field level validation errors). */
export function getApiErrors(body: unknown): ApiErrors {
	const record = asRecord(body);
	const errors = record?.errors ?? asRecord(record?.data)?.errors;
	return (errors as ApiErrors) ?? null;
}

/** Lifecycle state of a queued operation (`operation.state`). */
export function getOperationState(body: unknown): string | undefined {
	const record = asRecord(body);
	const operation = asRecord(record?.operation);
	const state = operation?.state;
	return typeof state === 'string' ? state : undefined;
}

/** Cache key for a queued operation, from `operation.cache_key`, `data.cache_key` or legacy body. */
export function getOperationCacheKey(body: unknown): string | undefined {
	const record = asRecord(body);
	const operation = asRecord(record?.operation);
	const data = asRecord(record?.data);
	const key = operation?.cache_key ?? data?.cache_key ?? record?.cache_key;
	return typeof key === 'string' && key ? key : undefined;
}
