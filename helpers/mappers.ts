import type {
	ApiBank,
	ApiDocument,
	ApiTransaction,
	Bank,
	DocumentProps,
	InternetPackage,
	MicroTransaction,
	RecentTransaction,
	SharedRadiusProfile,
	TransactionStatus,
	TransactionType,
} from '@/types';

/**
 * Mappers from API 2.0 records to the domain models the screens render.
 * Keep them side-effect free so they can be unit tested.
 */

function toDate(value?: string | null): Date {
	if (!value) return new Date();
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const documentTypeLabels: Record<string, string> = {
	passport: 'Passport',
	'id-card': 'ID Card',
	'driver-license': 'Driver License',
	'incorporation-certificate': 'Incorporation Certificate',
	'tax-document': 'Tax Document',
	'articles-of-association': 'Articles of Association',
};

export function mapApiDocumentToDocumentProps(
	document: ApiDocument
): DocumentProps {
	const type = (document.type ?? 'id-card') as DocumentProps['type'];
	return {
		id: String(document.id),
		documentId: document.number ?? String(document.id),
		name: documentTypeLabels[document.type] ?? document.type ?? 'Document',
		type,
		status: document.status ?? 'pending',
		url: document.attachment ?? '',
		createdAt: document.created_at ? toDate(document.created_at) : undefined,
		updatedAt: document.updated_at ? toDate(document.updated_at) : undefined,
	};
}

export function mapApiBankToBank(bank: ApiBank): Bank {
	return {
		id: String(bank.id),
		name: bank.bank_name ?? '',
		accountNumber: bank.account_number ?? '',
		accountHolderName: bank.phone ?? '',
		SWIFTCode: bank.swift_code ?? '',
		branch: bank.bank_branch,
		createdAt: bank.created_at ? toDate(bank.created_at) : undefined,
		updatedAt: bank.updated_at ? toDate(bank.updated_at) : undefined,
	};
}

const transactionStatuses: TransactionStatus[] = [
	'pending',
	'successful',
	'failed',
];

function toTransactionStatus(value?: string | null): TransactionStatus {
	const normalized = (value ?? '').toLowerCase();
	return (
		transactionStatuses.find((status) => status === normalized) ?? 'successful'
	);
}

function toTransactionType(value?: string | null): TransactionType {
	switch ((value ?? '').toLowerCase()) {
		case 'credit':
			return 'credit';
		case 'debit':
			return 'debit';
		case 'bank-transfer':
			return 'bank-transfer';
		case 'cash':
			return 'cash';
		case 'mobile-money':
			return 'mobile-money';
		default:
			return 'mobile-money';
	}
}

function toTransactionReason(value?: string | null): MicroTransaction['reason'] {
	const normalized = (value ?? '').toLowerCase();
	if (normalized.includes('wifi')) return 'wifi';
	if (normalized.includes('sub')) return 'subscription';
	return 'other';
}

export function mapApiTransactionToMicroTransaction(
	transaction: ApiTransaction
): MicroTransaction {
	const createdAt =
		transaction.created_at ?? transaction.transaction_date ?? undefined;
	return {
		id: transaction.id,
		amount: Number(transaction.amount) || 0,
		status: toTransactionStatus(transaction.status),
		routerName: transaction.router_name ?? '',
		date: toDate(createdAt),
		created_at: toDate(createdAt),
		reason: toTransactionReason(transaction.reason),
		description: transaction.reason,
		type: toTransactionType(transaction.type),
		gateway: transaction.gateway ?? null,
		router: {
			id: transaction.router_id ?? '',
			name: transaction.router_name ?? '',
		} as MicroTransaction['router'],
		method: { type: toTransactionType(transaction.type) },
	};
}

export function mapRecentTransactionToMicroTransaction(
	transaction: RecentTransaction
): MicroTransaction {
	const createdAt = transaction.created_at ?? transaction.transaction_date ?? undefined;
	const routerId = String(transaction.router?.id ?? transaction.router_id ?? '');
	const routerName =
		transaction.router_name ?? transaction.router?.name ?? '';
	return {
		id: transaction.id,
		amount: Number(transaction.amount) || 0,
		status: toTransactionStatus(transaction.status),
		routerName,
		date: toDate(createdAt),
		created_at: toDate(createdAt),
		reason: toTransactionReason(transaction.reason),
		description: transaction.reason ?? undefined,
		type: toTransactionType(transaction.type),
		gateway: transaction.gateway ?? null,
		router: {
			id: routerId,
			name: routerName,
		} as MicroTransaction['router'],
		method: { type: toTransactionType(transaction.type) },
	};
}

/**
 * Map a RADIUS plan from `GET /profiles` to the hotspot package model used by
 * the voucher screens.
 */
export function mapSharedRadiusProfileToInternetPackage(
	profile: SharedRadiusProfile
): InternetPackage {
	const durationHours =
		profile.duration_seconds && Number.isFinite(profile.duration_seconds)
			? Math.max(1, Math.round(profile.duration_seconds / 3600))
			: undefined;
	return {
		'.id': profile.group,
		name: profile.name,
		display_name: profile.display_name ?? profile.name,
		'rate-limit': profile.rate_limit ?? undefined,
		'simultaneous-use': profile.devices,
		'session-timeout': durationHours ? String(durationHours) : undefined,
		price: profile.price,
		shared: profile.shared,
	};
}
