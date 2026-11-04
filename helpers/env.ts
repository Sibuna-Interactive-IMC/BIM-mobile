import Constants from 'expo-constants';

export function env(
	key: string,
	fallback?: string | undefined
): string | undefined {
	try {
		const extra =
			(Constants &&
				(Constants.expoConfig as any) &&
				(Constants.expoConfig as any).extra) ||
			{};
		return (extra[key] as string) ?? (process.env as any)[key] ?? fallback;
	} catch {
		return (process.env as any)[key] ?? fallback;
	}
}

export default env;
