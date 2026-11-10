import type { Href } from 'expo-router';

import type { IconSymbolName } from '@/components/ui/IconSymbol';
import translations from '@/constants/Trans';
import { isPlatformAdmin, isPlatformStaff } from '@/helpers/permissions';
import type { langCode, User } from '@/types';

/** Who may open a feature. Mirrors the role gates used by the drawer and the screens. */
type FeatureAudience = 'everyone' | 'staff' | 'admin';

export type AppFeature = {
	/** Also the prefix of the `features.<id>.label` / `features.<id>.description` copy. */
	id: string;
	path: Href;
	icon: IconSymbolName;
	audience: FeatureAudience;
	/** Extra search terms that are not part of the translated copy (synonyms, acronyms). */
	keywords: string[];
};

export type FeatureSearchResult = {
	feature: AppFeature;
	label: string;
	description: string;
};

/** Every screen a user can jump to from the header search, in navigation order. */
export const appFeatures: AppFeature[] = [
	{
		id: 'home',
		path: '/(authenticated)/home',
		icon: 'home.outline',
		audience: 'everyone',
		keywords: ['dashboard', 'overview', 'earnings', 'summary'],
	},
	{
		id: 'routers',
		path: '/(authenticated)/routers',
		icon: 'routers.outline',
		audience: 'everyone',
		keywords: ['router', 'hotspot', 'wireguard', 'devices'],
	},
	{
		id: 'packages',
		path: '/(authenticated)/packages',
		icon: 'packages',
		audience: 'everyone',
		keywords: ['package', 'profile', 'radius', 'plan', 'bandwidth'],
	},
	{
		id: 'vouchers',
		path: '/(authenticated)/vouchers',
		icon: 'vouchers',
		audience: 'everyone',
		keywords: ['voucher', 'codes', 'tickets'],
	},
	{
		id: 'transactions',
		path: '/(authenticated)/transactions',
		icon: 'transactions',
		audience: 'everyone',
		keywords: ['payments', 'credits', 'debits', 'money'],
	},
	{
		id: 'accounts',
		path: '/(authenticated)/accounts',
		icon: 'accounts',
		audience: 'everyone',
		keywords: ['money', 'finance', 'hub', 'balances'],
	},
	{
		id: 'withdraw',
		path: '/(authenticated)/withdraw',
		icon: 'withdrawal',
		audience: 'everyone',
		keywords: ['withdrawal', 'payout', 'cash out'],
	},
	{
		id: 'withdraw-approvals',
		path: '/(authenticated)/withdraw-approvals',
		icon: 'check',
		audience: 'everyone',
		keywords: ['approvals', 'approve', 'reject', 'retract', 'sign-off'],
	},
	{
		id: 'disbursement-records',
		path: '/(authenticated)/disbursement-records',
		icon: 'documents',
		audience: 'everyone',
		keywords: ['disbursement', 'expenses', 'records'],
	},
	{
		id: 'sites',
		path: '/(authenticated)/sites',
		icon: 'sites',
		audience: 'everyone',
		keywords: ['site', 'locations', 'rent', 'electricity', 'maintenance'],
	},
	{
		id: 'banks',
		path: '/(authenticated)/banks',
		icon: 'bank',
		audience: 'everyone',
		keywords: ['bank', 'payout', 'account number'],
	},
	{
		id: 'access',
		path: '/(authenticated)/access',
		icon: 'users',
		audience: 'everyone',
		keywords: ['members', 'team', 'invite', 'roles', 'permissions'],
	},
	{
		id: 'connector',
		path: '/(authenticated)/connector',
		icon: 'key',
		audience: 'everyone',
		keywords: ['wireguard', 'keys', 'api', 'integration'],
	},
	{
		id: 'documents',
		path: '/(authenticated)/documents',
		icon: 'documents',
		audience: 'everyone',
		keywords: ['kyc', 'uploads', 'verification', 'files'],
	},
	{
		id: 'profile',
		path: '/(authenticated)/profile',
		icon: 'account',
		audience: 'everyone',
		keywords: ['account', 'password', 'avatar', 'personal details'],
	},
	{
		id: 'settings',
		path: '/(authenticated)/settings',
		icon: 'settings',
		audience: 'everyone',
		keywords: [
			'preferences',
			'push',
			'email',
			'sms',
			'channels',
			'notification settings',
		],
	},
	{
		id: 'notifications',
		path: '/(authenticated)/notifications',
		icon: 'notifications.outline',
		audience: 'everyone',
		keywords: ['alerts', 'messages', 'inbox'],
	},
	{
		id: 'business-analytics',
		path: '/(authenticated)/business-analytics',
		icon: 'analytics',
		audience: 'staff',
		keywords: ['analytics', 'revenue', 'platform', 'reports'],
	},
	{
		id: 'accounts-analytics',
		path: '/(authenticated)/accounts-analytics',
		icon: 'accounts',
		audience: 'admin',
		keywords: ['analytics', 'balances', 'accounts', 'reports'],
	},
	{
		id: 'admin-users',
		path: '/(authenticated)/admin-users',
		icon: 'users',
		audience: 'admin',
		keywords: ['users', 'logins', 'roles', 'membership'],
	},
	{
		id: 'profit',
		path: '/(authenticated)/profit',
		icon: 'cash',
		audience: 'admin',
		keywords: ['profit', 'excess', 'margin', 'cash'],
	},
	{
		id: 'payment-gateway',
		path: '/(authenticated)/payment-gateway',
		icon: 'gateway',
		audience: 'admin',
		keywords: ['gateway', 'provider', 'failover', 'override', 'payments'],
	},
	{
		id: 'broadcasts',
		path: '/(authenticated)/broadcasts',
		icon: 'broadcast',
		audience: 'admin',
		keywords: ['sms', 'messages', 'announcements', 'bulk'],
	},
	{
		id: 'router-tools',
		path: '/(authenticated)/router-tools',
		icon: 'tools.outline',
		audience: 'admin',
		keywords: ['router', 'tools', 'diagnostics', 'utilities'],
	},
	{
		id: 'document-verification',
		path: '/(authenticated)/document-verification',
		icon: 'document-verified',
		audience: 'admin',
		keywords: ['kyc', 'verify', 'documents', 'approval'],
	},
	{
		id: 'data-deletion-requests',
		path: '/(authenticated)/data-deletion-requests',
		icon: 'delete.outline',
		audience: 'admin',
		keywords: ['privacy', 'delete', 'erasure', 'data removal', 'requests'],
	},
];

const normalize = (value: string) =>
	value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();

/**
 * Crude singular form so "banks" still matches a "Bank Accounts" label (and vice
 * versa) without pulling in a stemming dependency.
 */
const singularize = (token: string) => {
	if (token.length > 4 && token.endsWith('ies'))
		return `${token.slice(0, -3)}y`;
	if (token.length > 5 && token.endsWith('es')) return token.slice(0, -2);
	if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
	return token;
};

const tokenVariants = (token: string) =>
	token === singularize(token) ? [token] : [token, singularize(token)];

const featureCopyFor = (language: langCode) =>
	translations[language]?.categories?.features ??
	translations.en.categories.features;

export function isFeatureVisible(
	feature: AppFeature,
	user?: User | null
): boolean {
	if (feature.audience === 'admin') return isPlatformAdmin(user);
	if (feature.audience === 'staff') return isPlatformStaff(user);
	return true;
}

function scoreFeature(
	feature: AppFeature,
	label: string,
	description: string,
	tokens: string[]
): number {
	const normalizedLabel = normalize(label);
	const normalizedDescription = normalize(description);
	const keywords = feature.keywords.map(normalize);
	const path = normalize(String(feature.path));
	let score = 0;
	for (const token of tokens) {
		const variants = tokenVariants(token);
		let tokenScore = 0;
		if (variants.some((variant) => normalizedLabel === variant))
			tokenScore = 8;
		else if (variants.some((variant) => normalizedLabel.startsWith(variant)))
			tokenScore = 6;
		else if (variants.some((variant) => normalizedLabel.includes(variant)))
			tokenScore = 5;
		else if (
			keywords.some((keyword) =>
				variants.some((variant) => keyword.startsWith(variant))
			)
		)
			tokenScore = 4;
		else if (
			keywords.some((keyword) =>
				variants.some((variant) => keyword.includes(variant))
			)
		)
			tokenScore = 3;
		else if (
			variants.some((variant) => normalizedDescription.includes(variant))
		)
			tokenScore = 2;
		else if (variants.some((variant) => path.includes(variant))) tokenScore = 1;
		// Every token has to match something, so "voucher codes" narrows the list.
		if (tokenScore === 0) return 0;
		score += tokenScore;
	}
	return score;
}

/** Features matching `query`, best match first. An empty query returns nothing. */
export function searchFeatures(
	query: string,
	user: User | null | undefined,
	language: langCode
): FeatureSearchResult[] {
	const tokens = normalize(query).split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return [];
	const copy = featureCopyFor(language);
	return appFeatures
		.filter((feature) => isFeatureVisible(feature, user))
		.map((feature) => {
			const label = copy[`${feature.id}.label`] ?? feature.id;
			const description = copy[`${feature.id}.description`] ?? '';
			return {
				feature,
				label,
				description,
				score: scoreFeature(feature, label, description, tokens),
			};
		})
		.filter((result) => result.score > 0)
		.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
		.map(({ feature, label, description }) => ({
			feature,
			label,
			description,
		}));
}
