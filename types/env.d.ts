declare module '@/helpers/env' {
	/** Read an environment variable by key. Returns `undefined` when not set. */
	export function env(
		key: string,
		fallback?: string | undefined
	): string | undefined;
	export default env;
}
