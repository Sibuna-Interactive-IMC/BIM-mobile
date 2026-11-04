import {
	generateRandomInt,
	generateRandomNumbers,
	generateRandomString,
	randomDateBetweenDaysAgo,
	toLocalISOString,
} from '@/helpers';
import {
	Bank,
	DocumentProps,
	HardWareInfo,
	InternetPackage,
	MicroTransaction,
	NetRouter,
	NetworkInfo,
	TransactionMethod,
	TransactionStatus,
	VoucherUser,
} from '@/types';

const packageNames: InternetPackage['name'][] = [
	'short',
	'daily',
	'weekly',
	'monthly',
];

export function generateNetRouter(
	overrides: Partial<NetRouter> = {}
): NetRouter {
	const idx = generateRandomInt(1, 254);
	const id = overrides.id ?? `R-${generateRandomNumbers(6)}`;
	const name = overrides.name ?? `${id}`;
	const location = overrides.location ?? `Location ${generateRandomInt(1, 10)}`;
	const networkInfo: NetworkInfo = overrides.networkInfo ?? {
		mac: `00:1A:2B:3C:4D:${String(idx).padStart(2, '0')}`,
		ipv4: `192.168.${generateRandomInt(0, 255)}.${idx}`,
		ipv6: `::ffff:192.168.${generateRandomInt(0, 255)}.${idx}`,
		hostname: `router-${id}.local`,
		routerHash: generateRandomString(24),
		uptime: `${generateRandomInt(0, 999999)}`,
		hotspots: Array.from({ length: generateRandomInt(1, 2) }).map(
			(_, hIdx) => ({
				".id": `${id}-hs-${hIdx + 1}`,
				name: `SSID-${generateRandomNumbers(4)}`,
				interface: `wlan${hIdx}`,
				profile: `default-profile-${hIdx + 1}`,
				disabled: Math.random() > 0.5 ? true : false,
				// Optionally include connected users for this hotspot
				users: Array.from({ length: generateRandomInt(1, 5) }).map(() => ({
					voucherCode: generateRandomNumbers(6),
					package: packageNames[generateRandomInt(0, packageNames.length - 1)],
					status: Math.random() > 0.2 ? 'active' : 'inactive',
					macAddress: `00:1A:2B:3C:4D:${String(
						generateRandomInt(0, 255)
					).padStart(2, '0')}`,
					uptime: generateRandomInt(0, 5000),
					bytesIn: generateRandomInt(0, 1_000_000),
					bytesOut: generateRandomInt(0, 1_000_000),
					comment: `${toLocalISOString(new Date())}-${id}`,
					createdAt: new Date().toDateString(),
				})),
			})
		),
	};
	const hwOverrides = (overrides.hardwareInfo || {}) as Partial<HardWareInfo>;

	return {
		id,
		name,
		type: overrides.type ?? 'Mikrotik',
		networkInfo,
		hardwareInfo: overrides.hardwareInfo ?? {
			cpuFrequency:
				hwOverrides.cpuFrequency ?? `${generateRandomInt(800, 2400)} MHz`,
			cpuLoad: hwOverrides.cpuLoad ?? `${generateRandomInt(1, 100)}%`,
			totalMemory:
				hwOverrides.totalMemory ?? `${generateRandomInt(128, 2048)} MB`,
			freeMemory: hwOverrides.freeMemory ?? `${generateRandomInt(64, 1024)} MB`,
			storage: hwOverrides.storage ?? `${generateRandomInt(1, 128)} GB`,
			routerOsVersion:
				hwOverrides.routerOsVersion ??
				`RouterOS ${generateRandomInt(6, 7)}.${generateRandomInt(0, 99)}`,
			firmwareVersion:
				hwOverrides.firmwareVersion ??
				`v${generateRandomInt(1, 9)}.${generateRandomInt(
					0,
					9
				)}.${generateRandomInt(0, 99)}`,
			model:
				hwOverrides.model ??
				overrides.model ??
				`Model-${generateRandomNumbers(3)}`,
		},
		transactionBalance:
			overrides.transactionBalance ?? generateRandomInt(10000, 1000000),
		model: overrides.model,
		location,
		firmwareVersion: overrides.firmwareVersion,
		username: overrides.username ?? `admin-${String(id).slice(-4)}`,
		password: overrides.password ?? `pass${generateRandomNumbers(4)}`,
		createdAt: overrides.createdAt,
		updatedAt: overrides.updatedAt,
	};
}

export function generateNetRouters(count = 3, overrides?: Partial<NetRouter>) {
	return Array.from({ length: count }, () => generateNetRouter(overrides));
}

export function generateTransactionMethod(
	overrides: Partial<TransactionMethod> = {}
): TransactionMethod {
	const isMobile = Math.random() > 0.5;
	return {
		id: overrides.id,
		name: overrides.name ?? (isMobile ? 'Mobile Payment' : 'Bank Transfer'),
		type: overrides.type ?? (isMobile ? 'mobile-money' : 'bank-transfer'),
		phoneNumber:
			overrides.phoneNumber ??
			(isMobile ? generateRandomNumbers(10) : undefined),
		accountNumber:
			overrides.accountNumber ??
			(!isMobile ? generateRandomNumbers(10) : undefined),
		cardNumber: overrides.cardNumber,
		accountHolderName: overrides.accountHolderName,
		csv: overrides.csv,
		expiryDate: overrides.expiryDate,
		createdAt: overrides.createdAt,
		updatedAt: overrides.updatedAt,
	};
}

export function generateMicroTransaction(
	overrides: Partial<MicroTransaction> = {}
): MicroTransaction {
	const date = overrides.date ?? randomDateBetweenDaysAgo(6);
	const statuses: TransactionStatus[] = ['successful', 'pending', 'failed'];
	return {
		id: overrides.id ?? generateRandomNumbers(10),
		amount: overrides.amount ?? generateRandomInt(1000, 20000),
		status:
			overrides.status ?? statuses[generateRandomInt(0, statuses.length - 1)],
		routerName: overrides.routerName ?? `Router-${generateRandomNumbers(3)}`,
		date,
		reason: overrides.reason ?? 'wifi',
		description: overrides.description,
		method: overrides.method ?? generateTransactionMethod(),
	} as MicroTransaction;
}

export function generateMicroTransactions(count = 10) {
	return Array.from({ length: count }, () => generateMicroTransaction());
}

export function generateVoucherUserFromPurchase(
	p: MicroTransaction,
	packages: InternetPackage[] = []
): VoucherUser {
	const pkg = packages.length
		? packages[generateRandomInt(0, packages.length - 1)].name
		: 'short';
	return {
		voucherCode: generateRandomNumbers(6),
		package: pkg,
		status: 'active',
		macAddress: `00:1A:2B:3C:4D:${p.id.slice(0, 2)}`,
		uptime: generateRandomInt(0, 5000),
		bytesIn: generateRandomInt(0, 1000000),
		bytesOut: generateRandomInt(0, 1000000),
		comment: `${toLocalISOString(p.date)}-${p.id}`,
		createdAt: p.date.toDateString(),
	};
}

export function generateVoucherUsersFromPurchases(
	purchases: MicroTransaction[],
	packages: InternetPackage[] = []
) {
	return purchases.map((p) => generateVoucherUserFromPurchase(p, packages));
}

export function generateBank(overrides: Partial<Bank> = {}): Bank {
	const id = overrides.id ?? generateRandomNumbers(6);
	// Helpers to build SWIFT/BIC in strict 4-2-2 pattern (8 chars)
	const randomLetters = (len: number) => {
		const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		let out = '';
		for (let i = 0; i < len; i++)
			out += letters[Math.floor(Math.random() * letters.length)];
		return out;
	};
	const randomAlnum = (len: number) => {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let out = '';
		for (let i = 0; i < len; i++)
			out += chars[Math.floor(Math.random() * chars.length)];
		return out;
	};
	// Map ISO 4217 currency -> ISO 3166-1 alpha-2 country code (best-effort)
	const currencyToCountry: Record<string, string> = {
		UGX: 'UG', // Uganda Shilling
		KES: 'KE', // Kenya Shilling
		TZS: 'TZ', // Tanzania Shilling
		RWF: 'RW', // Rwanda Franc
		BIF: 'BI', // Burundi Franc
		CDF: 'CD', // Congolese Franc
		GHS: 'GH', // Ghana Cedi
		NGN: 'NG', // Nigeria Naira
		ZAR: 'ZA', // South Africa Rand
		USD: 'US', // US Dollar
		EUR: 'DE', // Euro (choose DE as representative country)
		GBP: 'GB', // British Pound
		XAF: 'CM', // Central African CFA (Cameroon as representative)
		XOF: 'SN', // West African CFA (Senegal as representative)
	};
	const bankCurrency = (overrides.currency ?? 'UGX').toUpperCase();
	const countryCode = currencyToCountry[bankCurrency] ?? 'UG';
	const generatedSwift = `${randomLetters(4)}${countryCode}${randomAlnum(2)}`; // 4-2-2
	return {
		id,
		name: overrides.name ?? `Bank ${id}`,
		accountNumber: overrides.accountNumber ?? generateRandomNumbers(10),
		accountHolderName: overrides.accountHolderName ?? 'John Doe',
		// SWIFT/BIC: strict 4-2-2 base code (8 chars)
		SWIFTCode: overrides.SWIFTCode ?? generatedSwift,
		// Currency is required; default to UGX if not provided
		currency: overrides.currency ?? 'UGX',
		branch: overrides.branch,
		createdAt: overrides.createdAt,
		updatedAt: overrides.updatedAt,
	};
}

export function generateBanks(count = 2) {
	return Array.from({ length: count }, () => generateBank());
}

export function generateDocument(
	overrides: Partial<DocumentProps> = {}
): DocumentProps {
	// Ensure required documentId is present
	const documentId = overrides.documentId ?? `DOC-${generateRandomNumbers(8)}`;
	const type: DocumentProps['type'] = overrides.type ?? 'id-card';
	// Determine file extension by type group (identity -> jpg, company -> pdf)
	const identityTypes = new Set(['passport', 'id-card', 'driver-license']);
	const ext = identityTypes.has(type as string) ? 'jpg' : 'pdf';
	// Derive a stable status when not provided
	const statusPool: DocumentProps['status'][] = [
		'pending',
		'approved',
		'rejected',
	];
	const status: DocumentProps['status'] =
		overrides.status ??
		statusPool[
		documentId.charCodeAt(documentId.length - 1) % statusPool.length
		];

	return {
		// id is optional; generate one if not provided to keep objects unique in lists
		id: overrides.id ?? generateRandomNumbers(6),
		documentId,
		name:
			overrides.name ??
			(type === 'passport'
				? 'Passport'
				: type === 'driver-license'
					? 'Driver License'
					: type === 'id-card'
						? 'ID Card'
						: type === 'incorporation-certificate'
							? 'Incorporation Certificate'
							: type === 'tax-document'
								? 'Tax Document'
								: type === 'articles-of-association'
									? 'Articles of Association'
									: 'Document'),
		type,
		url: overrides.url ?? `https://example.com/documents/${documentId}.${ext}`,
		status,
		createdAt: overrides.createdAt,
		updatedAt: overrides.updatedAt,
	};
}

export function generateDocuments(count = 2) {
	return Array.from({ length: count }, () => generateDocument());
}

export function generateInternetPackage(
	overrides: Partial<InternetPackage> = {}
): InternetPackage {
	const id = overrides[".id"] ?? generateRandomNumbers(6);
	const name =
		overrides.name || 'BLANK';
	// Provide a sensible default for usersPerDevice by package name
	const defaultUsersPerDevice =
		overrides['simultaneous-use'] ??
		(name === 'monthly' ? 3 : name === 'weekly' ? 2 : 1);
	return {
		".id": id,
		name,
		display_name: overrides.display_name || name,
		"rate-limit":
			overrides["rate-limit"] ??
			`${generateRandomInt(1, 100)} MBps/${generateRandomInt(1, 100)} MBps`,
		"simultaneous-use": defaultUsersPerDevice,
		"session-timeout":
			overrides['session-timeout'] || String(generateRandomInt(6, 10)),
	};
}

export function generateInternetPackages(count = 4) {
	return Array.from({ length: count }, () => generateInternetPackage());
}

export default {
	generateNetRouter,
	generateNetRouters,
	generateMicroTransaction,
	generateMicroTransactions,
	generateVoucherUserFromPurchase,
	generateVoucherUsersFromPurchases,
	generateBank,
	generateBanks,
	generateDocument,
	generateDocuments,
	generateInternetPackage,
	generateInternetPackages,
};
