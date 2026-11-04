import { ChartDataEntry, RecentTransaction, RouterBalance } from './dashboard';
import { ServerUser, UserProfile, VoucherUser } from './security';
export * from './dashboard';
export * from './security';

export type headerOptions =
	| 'notifications'
	| 'profile'
	| 'language'
	| 'search'
	| undefined;
export type stringifiedBool = "true" | "false";

/* ------------------------------------------------------------------------- *
 * API 2.0 response envelope.
 * Every JSON response from the backend is wrapped as:
 *   { success, message, data, meta, operation, errors }
 * Response interfaces below extend `ApiEnvelope<...>` and describe `data`.
 * ------------------------------------------------------------------------- */

/** Field level validation errors returned by the API (`errors` key of the envelope). */
export type ApiErrors = Record<string, string | string[] | Record<string, unknown>> | null;

/** Pagination numbers for a single paginated collection. */
export interface PaginationMeta {
	current_page?: number;
	per_page?: number;
	total?: number;
	last_page?: number;
	first_item?: number | null;
	last_item?: number | null;
}

/**
 * `meta.pagination` is keyed by collection name — e.g.
 * `{ pagination: { active: { total, per_page, current_page, last_page } } }`.
 */
export type PaginationGroups = Record<string, PaginationMeta>;

export interface ApiMeta {
	/** Keyed collection blocks, or a single block for older/flat responses. */
	pagination?: PaginationGroups | PaginationMeta;
}

export type ApiOperationState =
	| 'queued'
	| 'processing'
	| 'done'
	| 'error'
	| 'cancelled';

/** Lifecycle information for queued (202) router operations. */
export interface ApiOperation {
	state?: ApiOperationState;
	cache_key?: string;
	poll_url?: string;
	retry_after?: number;
	progress?: {
		pages_total?: number;
		pages_ready?: number;
		[key: string]: unknown;
	};
	page_number?: number;
	page_metadata?: Record<string, unknown>;
	started_at?: string;
	updated_at?: string;
	finished_at?: string;
	timestamps?: {
		started_at?: string;
		updated_at?: string;
		finished_at?: string;
	};
	cached?: {
		has_status?: boolean;
		has_meta?: boolean;
		has_result?: boolean;
	};
	duration?: { seconds?: number; human?: string; in_progress?: boolean };
	pages?: { total?: number; ready?: number; available?: number[] };
	meta?: Record<string, unknown>;
	error?: string;
}

/** Envelope shared by every API 2.0 JSON response. */
export interface ApiEnvelope<TData = unknown> {
	success: boolean | stringifiedBool;
	message?: string;
	data?: TData | null;
	meta?: ApiMeta;
	operation?: ApiOperation;
	errors?: ApiErrors;
}

export interface Transaction {
	id: string;
	amount: number;
	type: 'credit' | 'debit';
	date: Date;
	description?: string; // Optional description for the transaction
	method: TransactionMethod; // Reference to the transaction method used
}

export interface PromptButton {
	title: string;
	color: string;
	textColor: string;
	action: () => void;
}

export interface Hotspot {
	".id": string;
	name: string; // SSID of the hotspot
	interface: string; // Network interface associated with the hotspot
	profile: string; // Profile name for the hotspot
	disabled: "true" | "false" | boolean; // Status of the hotspot
	users?: VoucherUser[]; // Optional list of voucher users connected to the hotspot
}

export interface NetworkInfo {
	mac: string;
	ipv4: string;
	ipv6: string;
	hostname: string;
	routerHash: string;
	uptime: string;
	hotspots: Hotspot[];
}

export interface HardWareInfo {
	cpuFrequency: string;
	cpuLoad: string;
	totalMemory: string;
	freeMemory: string;
	storage: string;
	routerOsVersion: string;
	firmwareVersion: string;
	model?: string;
}

export interface NetRouter {
	id: string;
	name: string; // Name of the router
	type: string;
	networkInfo: NetworkInfo;
	hardwareInfo: HardWareInfo;
	transactionBalance: number; // Balance of the router's transactions
	model?: string; // Model of the router
	location: string; // Location of the router
	firmwareVersion?: string; // Firmware version of the router
	username: string;
	password: string;
	createdAt?: Date;
	updatedAt?: Date;
}

/** Router as returned by API 2.0 (`Router` / `RouterWithWireguardKey`). */
export interface ApiRouter {
	"id": string;
	"name": string;
	"location": string;
	"type": string;
	"ip_address": string;
	"router_user": string;
	/** Router credit balance in the account currency. */
	"balance": number;
	"user_id": number;
	"notify_existing_voucher"?: boolean;
	"created_at": string;
	"updated_at": string;
	/** Only sent by the list/detail endpoints (`RouterWithWireguardKey`). */
	"wireguard_public_key"?: string;
	/** Not returned by API 2.0 — kept optional for the router edit form. */
	"router_password"?: string;
	"last_system_info"?: RouterSystemInfo;
	"last_heartbeat_at"?: string;
	"isp_id"?: string;
	"device_id"?: string;
	"auth_key"?: string;
	"hotspot_dns"?: string;
}

/** `GET /routers` */
export type GetRoutersResponse = ApiEnvelope<{ routers: ApiRouter[] }>;

export type InternetPackageName = 'short' | 'daily' | 'weekly' | 'monthly';

/**
 * MikroTik hotspot profile shape used by the voucher screens.
 * This is an app level model — API 2.0 exposes RADIUS plans through
 * `GET /profiles` (see `SharedRadiusProfile`).
 * @deprecated prefer `InternetPackage`
 */
export type RadiusProfile = InternetPackage;

export interface InternetPackage {
	".id": string;
	name: string; // Profile name
	display_name: string;
	"address-list"?: string;
	"rate-limit"?: string;
	"shared-users"?: number;
	"session-timeout"?: string;
	"router-name"?: string;
	"simultaneous-use"?: number;
	/** Populated when the profile was mapped from `GET /profiles`. */
	price?: number | null;
	shared?: boolean;
}

/** Shared RADIUS plan returned by `GET /profiles` (API 2.0 `RadiusProfile` schema). */
export interface SharedRadiusProfile {
	group: string;
	name: string;
	display_name: string;
	shared: boolean;
	price: number | null;
	duration: string | null;
	duration_seconds: number;
	rate_limit: string | null;
	devices: number;
}

export interface PackageOwner {
	type: 'platform' | 'account' | 'user';
	id: number | null;
	name: string;
}

export interface PackageRateLimit {
	rate_limit: string | null;
	is_open: boolean;
	effective_rate_limit: string | null;
	source: 'override' | 'profile';
	editable: boolean;
}

/** A router association on a portal package. */
export interface PackageRouter {
	id: string;
	name: string;
	location: string | null;
	visible: boolean;
	source: 'default' | 'override';
	heartbeat_state: 'fresh' | 'stale' | 'never';
	portal_url?: string | null;
	rate_limit: string | null;
	rate_limit_open: boolean;
	effective_rate_limit: string | null;
	rate_limit_source: 'override' | 'profile';
	rate_limit_editable: boolean;
}

export interface PortalPackageProfile {
	group: string;
	name: string;
	display_name: string;
	shared: boolean;
	price: number | null;
	duration: string | null;
	duration_seconds: number;
	rate_limit: string | null;
	devices: number;
	editable: boolean;
}

/** A sellable package as returned by GET /packages. */
export interface PortalPackage {
	id: string;
	label: string;
	label_key: string | null;
	label_translations: Record<string, string>;
	price: number;
	rad_group: string;
	duration_label: string | null;
	sort: number;
	is_active: boolean;
	is_global: boolean;
	is_trial: boolean;
	account_id: number | null;
	user_id: number | null;
	owner: PackageOwner;
	profile: PortalPackageProfile;
	routers: PackageRouter[];
	rate_limits: Record<string, PackageRateLimit>;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface TrialSettings {
	router_id: string;
	enabled: boolean;
	duration_minutes: number;
	cooldown_hours: number;
}

/** `GET /packages` */
export type GetPortalPackagesResponse = ApiEnvelope<{
	scope: 'visible' | 'global' | 'owner' | 'all';
	packages: PortalPackage[];
	}>;

/** `GET /packages/{package}/routers` */
export type GetPackageRoutersResponse = ApiEnvelope<{
	package_id: string;
	routers: PackageRouter[];
	rate_limits: Record<string, PackageRateLimit>;
	visibility?: Record<string, unknown>[];
	}>;

/** `GET /profiles` */
export type GetSharedRadiusProfilesResponse = ApiEnvelope<{ scope: 'shared'; profiles: SharedRadiusProfile[] }>;

/** `GET|POST /packages/trial/{router}` */
export type GetTrialSettingsResponse = ApiEnvelope<{ trial_settings: TrialSettings }>;

export type identityDocumentType = 'passport' | 'id-card' | 'driver-license';
export type companyDocumentType =
	| 'incorporation-certificate'
	| 'tax-document'
	| 'articles-of-association';

export interface DocumentProps {
	id?: string;
	documentId: string; // Unique identifier for the document
	name: string; // Name of the document
	type: identityDocumentType | companyDocumentType; // Type of document
	status: 'pending' | 'approved' | 'rejected';
	url: string; // URL to access the document
	createdAt?: Date;
	updatedAt?: Date;
}

export type TransactionType =
	| 'credit'
	| 'debit'
	| 'bank-transfer'
	| 'cash'
	| 'mobile-money';

export type TransactionStatus = 'pending' | 'successful' | 'failed';
export interface MicroTransaction {
	id: string;
	amount: number;
	status: TransactionStatus; // Status of the micro transaction
	routerName: string; // Name of the router associated with the micro transaction
	date: Date;
	created_at: Date; // Timestamp of when the micro transaction was created
	reason: 'wifi' | 'subscription' | 'other'; // Reason for the micro transaction
	description?: string; // Optional description for the micro transaction
	type: TransactionType; // Type of the micro transaction
	router: ApiRouter
	method: TransactionMethod; // Reference to the transaction method used
	/** Payment gateway that processed the transaction (`YO`, `Relworx`, …). */
	gateway?: string | null;
}

export interface TransactionMethod {
	id?: string;
	name?: string;
	type: TransactionType; // Type of transaction method
	phoneNumber?: string; // Optional, can be used for phone transactions
	accountNumber?: string; // Optional, can be used for bank accounts
	cardNumber?: string; // Optional, can be used for card transactions
	accountHolderName?: string; // Optional, can be used for bank accounts or cards
	csv?: string; // Optional, can be used for card transactions
	expiryDate?: Date; // Optional, can be used for card transactions
	createdAt?: Date;
	updatedAt?: Date;
}

export interface AuthRequest {
	name?: string; // Required for registration, optional for login
	email: string;
	phone?: string; // Optional, can be used for login or registration
	password: string;
}

export interface notifications {
	id: string;
	from: string;
	to: string;
	type: 'message' | 'alert' | 'reminder';
	title: string;
	message: string;
	isRead: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Push installs are registered per platform (`POST /push-devices`). */
export type PushPlatform = 'android' | 'ios' | 'web';

/** A row of `GET /push-devices` — one install that receives push for this login. */
export interface PushDevice {
	id: string;
	platform: PushPlatform;
	device_id: string | null;
	app_version: string | null;
	locale: string | null;
	is_active: boolean;
	last_seen_at: string | null;
	created_at: string | null;
}

/** Body of `POST /push-devices`; the FCM token is the upsert key. */
export interface RegisterPushDevicePayload {
	token: string;
	platform: PushPlatform;
	device_id?: string;
	app_version?: string;
	locale?: string;
}

/**
 * A row of `GET /inbox` — the signed-in user's own feed (approval requests,
 * decisions, disbursement notices). Not the same as `/notifications`, which
 * lists paid customer transactions.
 */
export interface InboxNotification {
	id: string;
	type: string;
	category: string;
	category_label?: string;
	title: string;
	body: string;
	subject?: {
		type?: string | null;
		id?: string | null;
	} | null;
	payload?: Record<string, unknown> | null;
	link?: {
		web?: string | null;
		app?: string | null;
	} | null;
	read: boolean;
	read_at?: string | null;
	created_at?: string | null;
}

/** Channels a notification preference can target (`PATCH /inbox/settings`). */
export type NotificationChannelKey = 'broadcast' | 'mail' | 'fcm';

/** One switch of the category × channel matrix. */
export interface NotificationChannelSetting {
	label: string;
	enabled: boolean;
	/** The in-app inbox is always on, so its switch cannot be turned off. */
	locked: boolean;
}

export interface NotificationCategorySetting {
	key: string;
	label: string;
	channels: Record<string, NotificationChannelSetting>;
}

/** `GET /inbox/settings` — the effective value of every notification switch. */
export interface InboxSettings {
	categories: NotificationCategorySetting[];
	channels: Record<string, string>;
	available?: {
		push?: boolean;
	};
}

/** Body entry of `PATCH /inbox/settings`. */
export interface InboxSettingsPreference {
	category: string;
	channel: NotificationChannelKey;
	enabled: boolean;
}

export interface dayPurchase {
	date: Date;
	day: string;
	amount: number;
}

export type Translations = {
	[key in langCode]: {
	name: lang;
	active: boolean; // Indicates if the language is fully translated and active
	categories: {
		[categoryKey: string]: {
			[translationKey: string]: string;
		};
	};
	};
};

export type lang =
	| 'English'
	| 'Français'
	| 'Español'
	| 'Deutsch'
	| 'Italiano'
	| 'Русский'
	| 'Português'
	| '中文'
	| '日本語'
	| 'العربية';

export type langCode =
	| 'en'
	| 'fr'
	| 'es'
	| 'de'
	| 'it'
	| 'ru'
	| 'pt'
	| 'zh'
	| 'ja'
	| 'ar';

export interface HotspotUser {
	[".id"]: string;
	name: string;
	profile?: string;
	uptime: string;
	comment?: string;
	server?: string;
	address?: string;
	online: stringifiedBool;
	"bytes-in": string;
	"bytes-out": string;
	"mac-address": string;
	"time-left"?: string;
	profile_display?: string;
	"limit-uptime"?: string;
}

export interface HotspotActiveUser {
	'.id': string;
	address: string;
	'bytes-in': string;
	'bytes-out': string;
	comment?: string;
	'idle-time'?: string;
	'keepalive-timeout'?: string;
	'login-by'?: string;
	'mac-address': string;
	'packets-in'?: string;
	'packets-out'?: string;
	'start-date'?: string;
	'start-date-iso'?: string;
	radius?: string;
	server: string;
	'session-time-left'?: string;
	uptime: string;
	user: string;
}

export interface RouterSystemInfo {
	arch?: string;
	version?: string;
	board?: string;
	platform?: string;
	build_time?: string;
}

export interface RouterTrafficSample {
	t: number;
	rx: number;
	tx: number;
}

export interface RouterTrafficHello {
	interface: string;
	units: string;
	interval_ms: number;
	latest_at: number | null;
	samples: RouterTrafficSample[];
}

export type Cookie = {
	".id": string;
	user: string;
	"mac-address": string;
	"expires-in": string;
	"mac-cookie": stringifiedBool;
}

export type Host = {
	".id": string;
	"mac-address": string;
	"address": string;
	"to-address": string;
	"server": string;
	"uptime": string;
	"idle-time": string;
	"keepalive-timeout": string;
	"host-dead-time": string;
	"bytes-in": string;
	"bytes-out": string;
	"packets-in": string;
	"packets-out": string;
	"found-by": string;
	"DHCP": stringifiedBool;
	"authorized": stringifiedBool;
	"bypassed": stringifiedBool
}

export type DHCPLease = {
	".id": string;
	"address": string;
	"mac-address": string;
	"client-id": string;
	"address-list": string;
	"server": string;
	"dhcp-option": string;
	"agent-remote-id": string;
	"status": string;
	"expires-after": string;
	"last-seen": string;
	"active-address": string;
	"active-mac-address": string;
	"active-client-id": string;
	"active-server": string;
	"active-agent-circuit-id": string;
	"active-agent-remote-id": string;
	"host-name": string;
	"class-id": string;
	"radius": stringifiedBool;
	"dynamic": stringifiedBool;
	"blocked": stringifiedBool;
	"disabled": stringifiedBool;
}

export type PurchaseGuardData = {
	"router_id"?: string;
	"notify_existing_voucher": boolean;
}

/** Platform role block (`PlatformRole` schema) returned by the identity endpoints. */
export interface Platform {
	/** `admin`, `staff`, `owner`, … — kept open because account roles reuse this block. */
	"role": string;
	"role_label": string;
	"is_admin": boolean | stringifiedBool;
	"is_staff": boolean | stringifiedBool;
	"is_blog_editor": boolean | stringifiedBool;
	"blog_editor_scope"?: string;
	"can_write_blog_content": boolean | stringifiedBool;
}

export interface OnboardingState {
	completed?: string[];
	dismissed?: string[];
}

export interface TokenMeta {
	"id": string;
	"name": string;
	"abilities": string[];
	"last_used_at"?: string;
	"created_at"?: string;
	"expires_at"?: string;
}

/** Account (organisation) block returned inside the identity payload. */
export interface Account {
	"id": number;
	"name": string;
	"type": 'admin' | 'business';
	"type_label": string;
	"is_admin_account": boolean;
	"role": string;
	"role_label": string;
	"is_cosignatory": boolean;
	"is_active": boolean;
	"joined_at": string;
}

/** `data` of `GET /dashboard` */
export interface DashboardData {
	recentTransactions?: RecentTransaction[];
	todayTransactions?: number;
	weekTransactions?: number;
	monthTransactions?: number;
	todayUsers?: number;
	weekUsers?: number;
	monthUsers?: number;
	routerBalances?: RouterBalance[];
	chartData?: ChartDataEntry[];
}

/** `GET /dashboard` and `GET /dashboard/refresh` */
export type GetDashboardResponse = ApiEnvelope<DashboardData>;

/** Router resource record returned by `GET /routers/{router}/status`. */
export interface RouterStatusRecord {
	uptime?: string;
	version?: string;
	'cpu-load'?: string;
	'free-memory'?: string;
	'total-memory'?: string;
	'free-hdd-space'?: string;
	'total-hdd-space'?: string;
	'architecture-name'?: string;
	'board-name'?: string;
	platform?: string;
}

/** `GET /routers/{router}/status` (200 — cached read) */
export type GetRouterStatusResponse = ApiEnvelope<{
	router?: ApiRouter;
	status?: RouterStatusRecord | null;
	}>;

/** `GET /routers/{router}/status` (202 — a read was queued, poll with `cache_key`). */
export type GetRouterStatusQueuedResponse = ApiEnvelope<{
	status?: string;
	cache_key?: string;
	retry_after?: number;
	}>;

/** `GET /routers/{router}/hotspots` */
export type GetRouterHotspotsResponse = ApiEnvelope<{
	router?: ApiRouter;
	hotspots?: Hotspot[];
	status?: RouterStatusRecord | null;
	pending?: boolean;
	retry_after?: number | null;
	}>;

/** `GET /routers/{router}/hotspot-cookies` */
export type GetRouterCookiesResponse = ApiEnvelope<{
	router?: ApiRouter;
	cookies?: Cookie[];
	cookies_links?: string;
	}>;

/** `GET /routers/{router}/hotspots/active` */
export type GetRouterActiveUsersResponse = ApiEnvelope<{
	router?: ApiRouter;
	active?: HotspotActiveUser[];
	active_links?: string;
	}>;

/** `GET /routers/{router}/hotspots/users` */
export type GetRouterUsersResponse = ApiEnvelope<{
	router?: ApiRouter;
	users?: HotspotUser[];
	users_links?: string;
	}>;

/** Voucher lifecycle state used by `GET /vouchers` filters and `Voucher.status`. */
export type VoucherStatus =
	| 'online'
	| 'active'
	| 'unused'
	| 'expired'
	| 'disabled';

/** One voucher returned by `GET /vouchers` (`Voucher` schema). */
export interface Voucher {
	id?: number | null;
	/** Voucher code (the RADIUS username). */
	username: string;
	router_id?: string | null;
	router_name?: string | null;
	profile?: string | null;
	profile_display?: string | null;
	status: VoucherStatus;
	is_online?: boolean;
	is_disabled?: boolean;
	is_expired?: boolean;
	has_been_used?: boolean;
	is_manual?: boolean;
	is_trial?: boolean;
	mac_address?: string | null;
	/** First login (start date), already formatted by the API. */
	first_auth?: string | null;
	last_auth?: string | null;
	created_at?: string | null;
	expires_at?: string | null;
	/** Current session duration, e.g. `4m27s`. */
	uptime?: string | null;
	/** Session length left, e.g. `5h55m33s`. */
	session_time?: string | null;
}

/** Counts for the caller's whole voucher set, before the status filter runs. */
export interface VoucherListStats {
	total?: number;
	online?: number;
	active?: number;
	unused?: number;
	expired?: number;
	disabled?: number;
	manual?: number;
	auto?: number;
}

/** Per-router counts for the caller's voucher set. */
export interface VoucherRouterStats {
	router_id?: string | null;
	router_name: string;
	total?: number;
	online?: number;
	/** Live router sessions, which may include non-voucher hotspot users. */
	live_online?: number;
}

/** `GET /vouchers` */
export type GetVouchersResponse = ApiEnvelope<{
	vouchers?: Voucher[];
	stats?: VoucherListStats;
	router_stats?: VoucherRouterStats[];
}>;

/** `GET /vouchers/routers` */
export type GetVoucherRoutersResponse = ApiEnvelope<{ routers: ApiRouter[] }>;

/** `GET /vouchers/{routerId}/hotspots` */
export type GetVoucherHotspotsResponse = ApiEnvelope<{
	router?: ApiRouter;
	hotspots?: Hotspot[];
}>;

/** One voucher created by `POST /vouchers/{routerId}/generate`. */
export interface GeneratedVoucher {
	username: string;
	profile?: string;
	profile_display?: string;
	hotspot_server?: string;
	router_name?: string;
}

/** `POST /vouchers/{routerId}/generate` */
export type GetGeneratedVouchersResponse = ApiEnvelope<{
	users?: GeneratedVoucher[];
}>;

/** Premises info attached to a site (`Site.site_detail`). */
export interface SitePremises {
	landlord?: string | null;
	notes?: string | null;
}

/** One site in `GET /sites`. */
export interface Site {
	id: string;
	name: string;
	location?: string | null;
	type?: string | null;
	site_detail?: SitePremises | null;
	access_points_count?: number;
	total_expenses?: number;
}

/** `GET /sites` */
export type GetSitesResponse = ApiEnvelope<{ sites?: Site[] }>;

/** An access point mounted on a site. */
export interface SiteAccessPoint {
	id: number;
	router_id: string;
	name: string;
	label?: string | null;
	model?: string | null;
	mac_address?: string | null;
	physical_location?: string | null;
	installed_on?: string | null;
	notes?: string | null;
	expenses_count?: number;
	expenses_total?: number;
}

/** How an expense was settled (cash disbursement or a voucher). */
export interface SiteExpenseCompensation {
	type?: 'cash' | 'voucher' | null;
	disbursement_record_id?: string | null;
	disbursement_label?: string | null;
	voucher_user_id?: number | null;
	voucher_username?: string | null;
}

/** An expense attached to a site or one of its access points. */
export interface SiteExpense {
	id: number;
	source: 'router' | 'access_point';
	access_point_id?: number | null;
	access_point_label?: string | null;
	category?: string;
	category_label?: string;
	description?: string | null;
	amount?: number;
	currency?: string;
	incurred_on?: string | null;
	notes?: string | null;
	compensation?: SiteExpenseCompensation | null;
}

/** `GET /sites/{router}` */
export type GetSiteResponse = ApiEnvelope<{
	site?: Site;
	access_points?: SiteAccessPoint[];
	expenses?: SiteExpense[];
	totals?: { total?: number; this_month?: number; visible?: number };
	filters?: { month?: string; available_months?: string[] };
}>;

/** Expense categories accepted by `POST /sites/{router}/expenses`. */
export type SiteExpenseCategory =
	| 'rent'
	| 'electricity'
	| 'maintenance'
	| 'equipment'
	| 'other';

/** `POST /sites/{router}/access-points` — `name` is the only required field. */
export interface SiteAccessPointPayload {
	name: string;
	model?: string | null;
	mac_address?: string | null;
	physical_location?: string | null;
	installed_on?: string | null;
	notes?: string | null;
}

/** How an expense was settled; `null`/absent clears both links. */
export interface SiteCompensationPayload {
	compensation_type?: 'cash' | 'voucher' | null;
	disbursement_record_id?: string | null;
	voucher_user_id?: number | null;
}

/** `POST /sites/{router}/expenses` */
export interface SiteExpensePayload extends SiteCompensationPayload {
	category: SiteExpenseCategory;
	amount: number;
	description?: string | null;
	currency?: string | null;
	incurred_on?: string | null;
	notes?: string | null;
	access_point_id?: number | null;
}

/** One option in the compensation disbursement picker. */
export interface SiteDisbursementOption {
	id: string;
	label: string;
}

/** `GET /sites/{router}/disbursements` */
export type GetSiteDisbursementsResponse = ApiEnvelope<{
	disbursements?: SiteDisbursementOption[];
	disbursements_metadata?: {
		offset?: number;
		limit?: number;
		total?: number;
		has_more?: boolean;
	};
}>;

/** `POST /sites/{router}/detail` */
export type SaveSiteDetailResponse = ApiEnvelope<{
	site_detail?: SitePremises | null;
}>;

/** `PUT /routers/{id}` — the router profile edited from the site screen. */
export interface RouterPayload {
	name: string;
	location: string;
	type: string;
	ip_address: string;
	router_user: string;
	router_password?: string;
}

/** The member seen most recently in an account. */
export interface AnalyticsAccountLastActive {
	user_id?: number;
	user_name?: string;
	role?: string | null;
	at?: string | null;
}

/** One account in `GET /analytics/accounts` (admin only). */
export interface AnalyticsAccount {
	id: number;
	name: string;
	type?: string;
	type_label?: string;
	is_admin_account?: boolean;
	members_count?: number;
	/** Account roles on the pivot, as role => count. */
	access_levels?: Record<string, number>;
	access_levels_summary?: string;
	last_active?: AnalyticsAccountLastActive | null;
	created_at?: string | null;
}

/** `GET /analytics/accounts` */
export type GetAnalyticsAccountsResponse = ApiEnvelope<{
	accounts?: AnalyticsAccount[];
}>;

/** A member of an account, with the seat they hold in it. */
export interface AnalyticsMember {
	id: number;
	name: string;
	email?: string | null;
	account_role?: string | null;
	account_role_label?: string;
	is_cosignatory?: boolean;
	/** Voyager role: admin or user. */
	platform_role?: string | null;
	last_activity_at?: string | null;
}

/** A router owned through the account. */
export interface AnalyticsRouter {
	id: string;
	name: string;
	type?: string;
	ip_address?: string;
	hotspot_dns?: string | null;
	portal_url?: string | null;
	owner_id?: number;
	owner_name?: string | null;
	router_heartbeat_at?: string | null;
	heartbeat_state?: 'fresh' | 'stale' | 'never';
	last_contact_at?: string | null;
	state?: 'online' | 'offline';
}

/** The roll-up numbers on the account detail page. */
export interface AnalyticsAccountStats {
	vouchers?: {
		total?: number;
		today?: number;
		week?: number;
		month?: number;
		last_at?: string | null;
		manual_batches?: {
			batches?: number;
			vouchers?: number;
			last_at?: string | null;
		};
	};
	withdrawals?: { count?: number; pending?: number; total?: number };
	routers?: { total?: number; reporting?: number };
}

/** `GET /analytics/accounts/{account}` */
export type GetAnalyticsAccountResponse = ApiEnvelope<{
	account?: AnalyticsAccount;
	members?: AnalyticsMember[];
	routers?: AnalyticsRouter[];
	stats?: AnalyticsAccountStats;
	pending_invitations?: Record<string, unknown>[];
}>;

/** One entry of the account activity log. */
export interface AnalyticsActivityEntry {
	id: number;
	event?: string;
	label?: string;
	summary?: string | null;
	actor?: { id?: number; name?: string } | null;
	subject_type?: string | null;
	subject_id?: string | null;
	metadata?: Record<string, unknown> | null;
	created_at?: string | null;
}

/** `GET /analytics/accounts/{account}/activity` */
export type GetAnalyticsActivityResponse = ApiEnvelope<{
	activity?: AnalyticsActivityEntry[];
}>;

/** An approval attached to an owner withdrawal. */
export interface AnalyticsWithdrawalApproval {
	id: number;
	status?: string;
	comment?: string | null;
	approver?: { id?: number; name?: string } | null;
	created_at?: string | null;
}

/** An owner withdrawal on the account's routers. */
export interface AnalyticsWithdrawal {
	id: string;
	router?: { id?: string; name?: string } | null;
	amount?: number;
	currency?: string;
	status?: string;
	reason?: string;
	initiated_by?: { id?: number; name?: string } | null;
	approvals?: AnalyticsWithdrawalApproval[];
	created_at?: string | null;
}

/** `GET /analytics/accounts/{account}/withdrawals` */
export type GetAnalyticsWithdrawalsResponse = ApiEnvelope<{
	withdrawals?: AnalyticsWithdrawal[];
}>;

/** One manual voucher generation batch. */
export interface AnalyticsVoucherBatch {
	batch?: string | null;
	router_id?: string | null;
	router_name?: string | null;
	vouchers?: number;
	first_at?: string | null;
	last_at?: string | null;
}

/** `GET /analytics/accounts/{account}/vouchers` */
export type GetAnalyticsVouchersResponse = ApiEnvelope<{
	stats?: AnalyticsAccountStats['vouchers'];
	vouchers?: AnalyticsVoucherBatch[];
}>;

/** One profit payout initiated by a member of the account. */
export interface AnalyticsPayout {
	id: string;
	amount?: number;
	currency?: string;
	provider?: string | null;
	recipient_msisdn?: string | null;
	reference?: string | null;
	status?: string;
	initiated_by?: { id?: number; name?: string } | null;
	created_at?: string | null;
}

/** `GET /analytics/accounts/{account}/payouts` */
export type GetAnalyticsPayoutsResponse = ApiEnvelope<{
	payouts?: AnalyticsPayout[];
}>;

/** An account membership on a managed login (the seat, not a platform role). */
export interface ManagedUserAccount {
	id: number;
	name: string;
	type?: string;
	pivot?: { role?: string | null; is_cosignatory?: boolean | number } | null;
}

/** A platform role assigned to a managed login. */
export interface ManagedUserRole {
	id: number;
	name?: string;
	display_name?: string;
}

/** A login as User Management sees it (`GET /admin/users`). */
export interface ManagedUser {
	id: number;
	name: string;
	email?: string | null;
	phone?: string | null;
	role_id?: number | null;
	role?: ManagedUserRole | null;
	accounts?: ManagedUserAccount[];
	phone_verified_at?: string | null;
	last_activity_at?: string | null;
	created_at?: string | null;
}

/** `GET /admin/users` */
export type GetAdminUsersResponse = ApiEnvelope<{ users?: ManagedUser[] }>;

/** An account this admin may seat a login in. */
export interface AdminUserAccountOption {
	id: number;
	name: string;
	type?: string;
	admin_members_count?: number;
}

/** The options behind the create/edit login form (`GET /admin/users/create`). */
export interface AdminUserForm {
	user?: ManagedUser | null;
	/** Platform role id => display name, limited to those this admin may assign. */
	roles?: Record<string, string>;
	accounts?: AdminUserAccountOption[];
	/** Seats inside an account (owner, finance, auditor). */
	accountRoles?: ('owner' | 'finance' | 'auditor')[];
	/** Sentinel for "create a new account": `__new__`. */
	newAccountValue?: string;
	/** Roles whose seat is forced to Auditor. */
	blogEditorRoleIds?: number[];
	holdsDefaultRole?: boolean;
	accountId?: number | null;
}

/** `GET /admin/users/create` and `GET /admin/users/{user}/edit` */
export type GetAdminUserFormResponse = ApiEnvelope<{ form?: AdminUserForm }>;

/** Tile numbers for the Accounts hub (`GET /accounts/summary`). */
export interface AccountsSummary {
	customer_payments_today?: number;
	customer_payments_amount_today?: number;
	owner_withdrawals_today?: number;
	owner_withdrawals_amount_today?: number;
	routers_count?: number;
	my_pending_approvals?: number;
	disbursement_count?: number;
	/** Bank accounts saved by the calling login (banks are per-user rows). */
	banks_count?: number;
	/** Null when the caller cannot open the admin pages behind the tile. */
	accounts_count?: number | null;
	users_count?: number | null;
	global_credits_today?: number | null;
	generated_at?: string;
}

/** `GET /accounts/summary` */
export type GetAccountsSummaryResponse = ApiEnvelope<AccountsSummary>;

/** An owner-withdrawal approval awaiting (or already actioned by) this login. */
export interface WithdrawalApproval {
	id: number;
	transaction_id?: string;
	approver_id?: number;
	status?: 'pending' | 'approved' | 'rejected';
	comment?: string | null;
	transaction?: ApiTransaction | null;
	created_at?: string | null;
}

/** `GET /withdrawals/approvals` */
export type GetWithdrawalApprovalsResponse = ApiEnvelope<{
	approvals?: WithdrawalApproval[];
	initiated?: ApiTransaction[];
}>;

/** One member of the active account (`GET /invitations`). */
export interface AccountMember {
	id: number;
	name: string;
	email?: string | null;
	phone?: string | null;
	/** Account seat on the membership pivot. */
	pivot?: {
		account_id?: number;
		user_id?: number;
		role?: string | null;
		is_cosignatory?: boolean | number | null;
		created_at?: string | null;
	};
}

/** A pending invitation to the active account (`GET /invitations`). */
export interface AccountInvitation {
	id: number;
	email: string;
	role?: string | null;
	is_cosignatory?: boolean | number | null;
	created_at?: string | null;
}

/** `GET /invitations` — active account, its members and pending invitations. */
export type GetAccessResponse = ApiEnvelope<{
	account?: Account;
	members?: AccountMember[];
	invitations?: AccountInvitation[];
}>;

/** `POST /invitations` — seat values match the server's `owner|Finance|Auditor`. */
export interface InviteUserPayload {
	email: string;
	role: 'owner' | 'Finance' | 'Auditor';
	/** Only Finance seats can co-sign withdrawals. */
	is_cosignatory?: boolean;
}

/** One gateway's circuit breaker (`GET /admin/payment-provider`). */
export interface PaymentProviderHealth {
	provider: string;
	label: string;
	role: 'primary' | 'secondary';
	state: 'closed' | 'open';
	open: boolean;
	consecutive_failures: number;
	/** Failover backoff in minutes; 0 while the circuit is closed. */
	backoff_minutes: number;
	last_failure_at?: string | null;
	probe_due_at?: string | null;
	last_success_at?: string | null;
}

/**
 * Which gateway takes new collections right now.
 * `forced` is null while the automatic failover decides.
 */
export interface PaymentProviderRouting {
	mode: 'auto' | 'forced';
	forced: string | null;
	forced_since?: string | null;
	/** The provider taking new collections right now. */
	active: string;
	active_label: string;
	primary: string;
	secondary: string;
	/** True when the override points at the primary while its circuit is open. */
	forcing_open_primary: boolean;
	providers: Record<string, PaymentProviderHealth>;
}

/** `GET`/`PUT /admin/payment-provider` — the routing sits under `payment_provider`. */
export type GetPaymentRoutingResponse = ApiEnvelope<{
	payment_provider?: PaymentProviderRouting;
}>;

/** `PUT /admin/payment-provider` — a provider name, or `auto` to clear the override. */
export type PaymentProviderChoice = string;

/** Who a broadcast goes to. `site` needs a router, `single` a phone number. */
export type BroadcastAudience = 'all' | 'site' | 'single';

/** Delivery states of one broadcast. */
export type BroadcastStatus =
	| 'queued'
	| 'sending'
	| 'sent'
	| 'partial'
	| 'failed';

/** One number's outcome inside a broadcast. */
export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/** The audience half of a preview/send request. */
export interface BroadcastAudienceFilters {
	audience: BroadcastAudience;
	router_id?: string;
	phone?: string;
	date_from?: string | null;
	date_to?: string | null;
	purchases_operator?: 'lt' | 'gt' | 'eq' | null;
	purchases_count?: number | null;
	/** Numbers the admin unchecked; excluded from the resolved audience. */
	excluded?: string[];
}

/** A router offered in the audience picker (`GET /admin/broadcasts` → `sites`). */
export interface BroadcastSite {
	id: string;
	name: string;
	label: string;
	location?: string | null;
}

/** Server-side caps the composer must not exceed. */
export interface BroadcastLimits {
	max_recipients: number;
	max_message_length: number;
	sms_segment_length: number;
	sms_multipart_segment_length: number;
}

/** A saved message body (`GET /admin/broadcasts/templates`). */
export interface BroadcastTemplate {
	id: number;
	name: string;
	body: string;
	created_by?: number | null;
	created_at?: string | null;
}

/** `POST /admin/broadcasts/templates` */
export interface BroadcastTemplatePayload {
	name: string;
	body: string;
}

/** One row of the broadcast history. */
export interface Broadcast {
	id: number;
	message: string;
	audience: BroadcastAudience;
	audience_label: string;
	site?: { id?: string | null; name?: string | null } | null;
	date_from?: string | null;
	date_to?: string | null;
	purchases_filter?: { operator: 'lt' | 'gt' | 'eq'; count: number } | null;
	channel?: string;
	status: BroadcastStatus;
	status_label: string;
	recipients_count: number;
	sent_count: number;
	failed_count: number;
	skipped_count: number;
	template?: { id?: number | null; name?: string | null } | null;
	admin?: { id?: number | null; name?: string | null };
	excluded?: string[];
	error?: string | null;
	queued_at?: string | null;
	completed_at?: string | null;
	created_at?: string | null;
	url?: string;
}

/**
 * A number in the recipient picker. The picker rows are the resolved audience,
 * not saved records, so they only carry what the preview computed.
 */
export interface BroadcastRecipientPreview {
	phone: string;
	display_phone: string;
	purchases?: number;
	first_purchase_at?: string | null;
	last_purchase_at?: string | null;
	router_ids?: string[];
	sites?: string[];
}

/** `POST /admin/broadcasts/recipients` summary. */
export interface BroadcastRecipientSummary {
	total: number;
	matched: number;
	excluded: number;
	max_recipients: number;
	over_limit: boolean;
	segments: number;
}

/** One number's outcome inside a broadcast (`GET /admin/broadcasts/{id}`). */
export interface BroadcastRecipient {
	id: number;
	phone: string;
	display_phone: string;
	status: RecipientStatus;
	status_label: string;
	error?: string | null;
	sent_at?: string | null;
}

/**
 * `GET /admin/broadcasts` — `ApiResponse::paginated` splices the history plus the
 * composer's support data at the top level, with no `data` wrapper.
 */
export interface GetBroadcastsResponse {
	success?: boolean;
	message?: string;
	broadcasts?: Broadcast[];
	broadcasts_metadata?: PaginationMeta;
	sites?: BroadcastSite[];
	sites_metadata?: PaginationMeta;
	templates?: BroadcastTemplate[];
	templates_metadata?: PaginationMeta;
	limits?: BroadcastLimits;
	data?: {
		broadcasts?: Broadcast[];
		broadcasts_metadata?: PaginationMeta;
		sites?: BroadcastSite[];
		templates?: BroadcastTemplate[];
		limits?: BroadcastLimits;
	};
}

/** `POST /admin/broadcasts/recipients` */
export interface PreviewRecipientsResponse {
	success?: boolean;
	message?: string;
	recipients?: BroadcastRecipientPreview[];
	recipients_metadata?: PaginationMeta;
	summary?: BroadcastRecipientSummary;
	data?: {
		recipients?: BroadcastRecipientPreview[];
		recipients_metadata?: PaginationMeta;
		summary?: BroadcastRecipientSummary;
	};
}

/** `GET /admin/broadcasts/{id}` */
export interface GetBroadcastResponse {
	success?: boolean;
	message?: string;
	broadcast?: Broadcast;
	recipients?: BroadcastRecipient[];
	recipients_metadata?: PaginationMeta;
	data?: {
		broadcast?: Broadcast;
		recipients?: BroadcastRecipient[];
		recipients_metadata?: PaginationMeta;
	};
}

/** `GET`/`POST /admin/broadcasts/templates` */
export interface GetBroadcastTemplatesResponse {
	success?: boolean;
	message?: string;
	templates?: BroadcastTemplate[];
	templates_metadata?: PaginationMeta;
	data?: {
		templates?: BroadcastTemplate[];
		templates_metadata?: PaginationMeta;
	};
}

/** `POST /admin/broadcasts` — the queued send. */
export interface QueueBroadcastResponse {
	success?: boolean;
	message?: string;
	broadcast?: Broadcast;
	data?: { broadcast?: Broadcast };
}

/** A router the console can act on — the whole fleet, not the caller's own. */
export interface RouterToolTarget {
	id: string;
	name: string;
}

/** `POST /admin/router-console` — the router tools the mobile app offers. */
export type RouterToolAction =
	| 'send-command'
	| 'push-portal'
	| 'remove-duplicate-cookies'
	| 'link-radius-users';

/** `POST /admin/router-console/run` — `confirmed` must be the router's name when destructive. */
export interface RunRouterActionPayload {
	action: RouterToolAction;
	scope: 'one' | 'all';
	router_id?: string;
	confirmed?: string;
	command_text?: string;
}

/** `/system/identity/print` + `/system/resource/print` for one router. */
export interface RouterIdentity {
	ok: boolean;
	/** True when the console ran out of read budget and never contacted the router. */
	skipped?: boolean;
	identity: Record<string, string>;
	resource: Record<string, string>;
	error?: string | null;
}

/** One row of `POST /admin/router-console/diagnose`. */
export interface RouterIdentityRow {
	router: { id: string; name: string };
	identity: RouterIdentity;
}

/** `POST /admin/router-console/diagnose` */
export interface DiagnoseRouterResponse {
	success?: boolean;
	message?: string;
	routers?: RouterIdentityRow[];
	routers_metadata?: PaginationMeta;
	data?: {
		routers?: RouterIdentityRow[];
		routers_metadata?: PaginationMeta;
	};
}

/** `POST /admin/router-console/preview` */
export interface PreviewRouterActionResponse {
	success?: boolean;
	message?: string;
	kind?: 'script' | 'command';
	script?: string;
	data?: { kind?: 'script' | 'command'; script?: string };
}

/**
 * `POST /admin/router-console/run` — the queue acknowledgement, or the server's
 * 422 with a per-field message.
 */
export interface RunRouterActionResponse {
	success?: boolean;
	message?: string;
	errors?: Record<string, string[]>;
	data?: { success?: boolean; message?: string; errors?: Record<string, string[]> };
}

/** `GET /admin/router-console/tasks/{task}` */
export interface RouterTaskLogResponse {
	success?: boolean;
	message?: string;
	router?: string;
	status?: string;
	queued?: string | null;
	executed?: string | null;
	command?: string;
	reported?: boolean;
	result?: string;
}

/** Statuses a document can hold (`documents.status`). */
export type DocumentStatus = 'pending' | 'approved' | 'rejected';

/** The owner behind a document, as the admin review list returns it. */
export interface DocumentOwner {
	id: number;
	name?: string | null;
	email?: string | null;
	phone?: string | null;
	/** Set from `documents_verified_at`; the document list appends it. */
	documents_verified?: boolean;
}

/** One uploaded document in the admin review list (`GET /admin/documents`). */
export interface AdminDocument {
	/** UUID. */
	id: string;
	type: string;
	number?: string | null;
	/** Storage path; the file itself lives behind `GET /documents/{id}/file`. */
	attachment?: string | null;
	status: DocumentStatus;
	user_id?: number | null;
	created_at?: string | null;
	updated_at?: string | null;
	user?: DocumentOwner | null;
}

/** `GET /admin/documents` — `ApiResponse::paginated` puts the rows at the top level. */
export interface GetAdminDocumentsResponse {
	success?: boolean;
	message?: string;
	documents?: AdminDocument[];
	documents_metadata?: PaginationMeta;
	data?: {
		documents?: AdminDocument[];
		documents_metadata?: PaginationMeta;
	};
}

/** `PATCH /admin/users/{user}/documents-verification` */
export type SetDocumentsVerifiedResponse = ApiEnvelope<{
	user?: DocumentOwner;
}>;

/** One preset avatar from `GET /profile/avatars`. */
export interface AvatarPreset {
	id: string;
	gender: string;
	tone: string;
	beard: boolean;
	label: string;
	/** File name, e.g. `female-light.svg`. */
	file: string;
	/** Absolute URL of the shipped SVG. */
	url: string;
}

/** The presets grouped by gender presentation, as the picker renders them. */
export interface AvatarGroup {
	gender: string;
	label: string;
	presets: AvatarPreset[];
}

/** A gender choice offered by the profile form; `''` means prefer not to say. */
export interface GenderOption {
	value: string;
	label: string;
}

/** `GET /profile/avatars` */
export interface GetAvatarOptionsResponse {
	success?: boolean;
	message?: string;
	groups?: AvatarGroup[];
	default?: AvatarPreset;
	gender_options?: GenderOption[];
	data?: {
		groups?: AvatarGroup[];
		default?: AvatarPreset;
		gender_options?: GenderOption[];
	};
}

/**
 * `PATCH /profile` — only the fields that changed. The server treats phone,
 * gender and avatar as `sometimes` so a partial update cannot blank them.
 */
export interface UpdateProfilePayload {
	name: string;
	email: string;
	phone?: string;
	gender?: string;
	notification_email?: string;
	avatar?: string;
}

/** The user just saved, as the API echoes it back. */
export type ProfileMutationResponse = ApiEnvelope<{ user?: UserProfile }>;

/** `POST /withdrawals/{router}` — step 1 asks for the OTP, step 2 submits it. */
export interface WithdrawalRequestPayload {
	amount: number;
	phone: string;
	narration?: string | null;
	/** First call only: ask the gateway to text the OTP. */
	request_otp?: boolean;
	/** Re-send after a partial-payment notice so the plan is accepted. */
	accept_partial?: boolean;
	/** Second call only: the code the owner typed. */
	otp?: string;
	reference?: string | null;
}

/**
 * The withdrawal endpoint answers at the top level for some branches and under
 * `data` for others, so every field is optional and both shapes are read.
 */
export interface WithdrawalRequestResult {
	success?: boolean;
	message?: string;
	otp_sent?: boolean;
	reference?: string | null;
	otp_phone?: string | null;
	/** The router balances cannot cover the amount; nothing was sent yet. */
	requires_partial_acceptance?: boolean;
	total_covered?: number;
	uncovered?: number;
	advice?: string | null;
	/** Set when the money went out through a cascade across sibling routers. */
	cascade?: boolean;
	/** Set when the payout is still being processed by the provider. */
	processing?: boolean;
	transaction?: ApiTransaction | null;
	details?: unknown;
}

export interface WithdrawalRequestResponse extends WithdrawalRequestResult {
	data?: WithdrawalRequestResult;
	errors?: Record<string, string[]>;
}

/** A document attached to a disbursement record. */
export interface DisbursementDocument {
	id?: number | string;
	/** Category label from the API ("Receipt"), or the raw key. */
	type?: string;
	type_label?: string;
	file_name?: string;
	/** Legacy alias kept for older payloads. */
	name?: string;
	mime_type?: string;
	/** Human-readable, e.g. `184.2 KB`. */
	size?: string;
	url?: string | null;
	is_image?: boolean;
	is_pdf?: boolean;
	created_at?: string | null;
}

/** Document categories accepted by `POST /disbursement-records/{record}/documents`. */
export type DisbursementDocumentType = 'receipt' | 'invoice' | 'screenshot';

/**
 * The documents endpoint answers with the list at the top level while the
 * documented shape nests it under `data` — accept both.
 */
export interface DisbursementDocumentsPayload {
	success?: boolean;
	message?: string;
	documents?: DisbursementDocument[];
	data?: { documents?: DisbursementDocument[] };
}

/** `POST /disbursement-records/{record}/documents` */
export interface UploadedDisbursementDocumentPayload {
	success?: boolean;
	message?: string;
	document?: DisbursementDocument;
	data?: { document?: DisbursementDocument };
}

/** One disbursement record (`GET /disbursement-records`). */
export interface DisbursementRecord {
	id: string;
	narration?: string | null;
	created_at?: string | null;
	transaction?: ApiTransaction | null;
	documents?: DisbursementDocument[];
}

/** `GET /disbursement-records` */
export type GetDisbursementRecordsResponse = ApiEnvelope<{
	records?: DisbursementRecord[];
	filters?: Record<string, unknown>;
	router_names?: string[];
	document_types?: Record<string, string> | string[];
}>;

/** One money bucket of the business analytics summary. */
export interface BusinessStatPeriod {
	total?: number;
	count?: number;
}

/** The platform business analytics summary (`GET /analytics/business/summary`). */
export interface BusinessAnalyticsSummary {
	credit_stats?: Record<string, BusinessStatPeriod>;
	withdrawal_stats?: Record<string, BusinessStatPeriod>;
	charge_stats?: Record<string, BusinessStatPeriod>;
	chart_data?: {
		dates?: string[];
		credits?: number[];
		withdrawals?: number[];
		charges?: number[];
		generated_at?: string;
	};
	top_routers?: {
		id: string;
		name: string;
		balance?: number;
		owner?: string;
		owner_email?: string;
	}[];
	voucher_stats?: Record<string, number | string | null>;
	generated_at?: string;
}

/** `GET /analytics/business/summary` */
export type GetBusinessAnalyticsResponse = ApiEnvelope<BusinessAnalyticsSummary>;

/** An owner filter option on the business lists. */
export interface BusinessOwnerOption {
	id: number;
	name: string;
	email?: string;
}

/** `GET /analytics/business/{credits|charges|withdrawals}` */
export interface BusinessAnalyticsList {
	transactions?: ApiTransaction[];
	/** Sum of the amounts in the selected period. */
	total?: number;
	/** Human label, e.g. `Customer Initiated Credits`. */
	type?: string;
	kind?: string;
	period?: string;
	owner?: number | null;
	owners?: BusinessOwnerOption[];
}

/** `GET /analytics/business/{kind}` */
export type GetBusinessListResponse = ApiEnvelope<BusinessAnalyticsList>;

/** One row of the router leaderboard. */
export interface BusinessRouterRow {
	id: string;
	name: string;
	ip_address?: string;
	balance?: number;
	owner_name?: string | null;
	owner_email?: string | null;
	total_volume?: number;
	total_transactions?: number;
}

/** `GET /analytics/business/routers` */
export type GetBusinessRoutersResponse = ApiEnvelope<{
	routers?: BusinessRouterRow[];
}>;

/** Provider balances minus what the owners are owed (`GET /analytics/profit`). */
export interface ProfitSnapshot {
	yo_balance?: number | null;
	yo_wallets?: {
		mtn?: number | null;
		airtel?: number | null;
		total?: number | null;
	};
	relworx_balance?: number | null;
	owner_owed?: number;
	profit?: number;
	buffer_per_provider?: number;
	yo_available?: number | null;
	relworx_available?: number | null;
	generated_at?: string;
}

/** A platform-profit payout. */
export interface ProfitWithdrawal {
	id: string;
	amount?: number;
	currency?: string;
	provider?: 'yo' | 'relworx' | string;
	recipient_msisdn?: string;
	reference?: string | null;
	status?: 'pending_approval' | 'approved' | 'disbursed' | 'rejected' | 'failed';
	initiated_by?: { id?: number; name?: string } | null;
	approvals?: Record<string, unknown>[];
	created_at?: string | null;
}

/** A profit withdrawal decision awaiting this admin. */
export interface ProfitWithdrawalApproval {
	id: number;
	status?: 'pending' | 'approved' | 'rejected';
	comment?: string | null;
	withdrawal?: ProfitWithdrawal | null;
	created_at?: string | null;
}

/** `GET /analytics/profit` */
export type GetProfitResponse = ApiEnvelope<{
	snapshot?: ProfitSnapshot;
	pending_approvals?: ProfitWithdrawalApproval[];
	my_initiated?: ProfitWithdrawal[];
	history?: ProfitWithdrawal[];
}>;

/** `GET /routers/{router}/hosts` */
export type GetRouterHostsResponse = ApiEnvelope<{
	router?: ApiRouter;
	hosts?: Host[];
	hosts_links?: string;
	}>;

/** `GET /routers/{router}/dhcp/leases` */
export type GetRouterDHCPLeasesResponse = ApiEnvelope<{
	router?: ApiRouter;
	leases?: DHCPLease[];
	leases_links?: string;
	}>;

/** A network interface as returned by `GET /routers/{router}/interfaces`. */
export interface RouterInterface {
	name?: string;
	'default-name'?: string;
	type?: string;
	'interface'?: string;
	running?: boolean | stringifiedBool;
	disabled?: boolean | stringifiedBool;
	'rx-byte'?: number | string;
	'tx-byte'?: number | string;
}

/** `GET /routers/{router}/interfaces` */
export type GetRouterInterfacesResponse = ApiEnvelope<{
	router?: ApiRouter;
	interfaces?: RouterInterface[];
	}>;

/** `GET /routers/{router}` */
export type GetRouterResponse = ApiEnvelope<{ router?: ApiRouter }>;

/** `GET|POST /routers/{router}/purchase-guard` */
export type GetPurchaseGuardResponse = ApiEnvelope<{ purchase_guard: PurchaseGuardData }>;

/** `POST /routers/{router}/purchase-guard` */
export type PostPurchaseGuardResponse = ApiEnvelope<{ purchase_guard: PurchaseGuardData }>;

/** `GET|POST /profiles/{profile}` — RADIUS plans. */
export type GetRadiusProfileResponse = ApiEnvelope<{ profiles: SharedRadiusProfile[] }>;

/** `GET /routers/{router}/ping` */
export type PingRouterResponse = ApiEnvelope<{
	online?: boolean;
	router?: { id?: string; name?: string; ip?: string };
	}>;

/** Identity payload (`IdentityContextResponse` schema). */
export interface IdentityContext {
	user?: ServerUser;
	platform?: Platform;
	accounts?: Account[];
	active_account?: Account;
	home_url?: string;
}

/** `GET /me` and `GET /user` */
export type GetMeResponse = ApiEnvelope<IdentityContext>;

/** `GET /profile` */
export type GetProfileResponse = ApiEnvelope<{ user: UserProfile; accounts: Account[] }>;

/** Session payload (`AuthTokenResponse` schema). */
export interface AuthSession {
	user: ServerUser;
	platform?: Platform;
	active_account?: Account;
	accounts?: Account[];
	token: string;
	token_meta?: TokenMeta;
	redirect?: string;
}

/** 2FA challenge payload returned by `POST /login` when TOTP is required. */
export interface TOTPRequiredData {
	redirect?: string;
	phone?: string;
}

/** Setup payload returned by `POST /login`, `POST /verify-otp` and `GET /2fa-setup`. */
export interface TotpSetupData {
	user?: ServerUser;
	platform?: Platform;
	active_account?: Account;
	accounts?: Account[];
	phone?: string;
	setup_token?: string;
	secret?: string;
	qr?: string;
	qr_base64?: string;
	message?: string;
}

/** `POST /login` (200 — TOTP required or TOTP setup required) */
export type LoginResponse = ApiEnvelope<TOTPRequiredData | TotpSetupData>;

/** `POST /register` */
export type RegisterResponse = ApiEnvelope<{ phone?: string }>;

/** `POST /verify-otp` (200 — TOTP setup required) */
export type VerifyOtpResponse = ApiEnvelope<TotpSetupData>;

/** `GET /2fa-setup` (provisioning data for API clients) */
export type GetTwoFASetupResponse = ApiEnvelope<{ qr?: string; qr_base64?: string; secret?: string }>;

/** `GET /token/verify` */
export type VerifyTokenResponse = ApiEnvelope<AuthSession>;

/** `POST /token/refresh` */
export type RefreshTokenResponse = ApiEnvelope<AuthSession>;

/** `POST /2fa-verify` */
export type TwoFAVerifyResponse = ApiEnvelope<AuthSession>;

/** `POST /2fa-setup` */
export type TwoFASetupResponse = ApiEnvelope<AuthSession>;

/** `POST /logout` */
export type LogoutResponse = ApiEnvelope<null>;

/** `POST /2fa-setup` or `POST /2fa-verify` failure payload. */
export type AuthFailureResponse = ApiEnvelope<null>;

/* ----------------------------- records ----------------------------- */

/** `Bank` schema — `GET /banks` */
export interface ApiBank {
	id: number;
	user_id: number;
	bank_name: string;
	account_number: string;
	phone?: string;
	swift_code?: string;
	bank_branch?: string;
	created_at?: string;
	updated_at?: string;
}

/** `GET /banks` */
export type GetBanksResponse = ApiEnvelope<{ banks: ApiBank[] }>;

/** `Document` schema — `GET /documents` */
export interface ApiDocument {
	id: number;
	user_id: number;
	type: string;
	number?: string;
	attachment?: string;
	status: 'pending' | 'approved' | 'rejected';
	created_at?: string;
	updated_at?: string;
}

/** `GET /documents` */
export type GetDocumentsResponse = ApiEnvelope<{ documents: ApiDocument[] }>;

/** `Transaction` schema — rows of `GET /transactions`. */
export interface ApiTransaction {
	id: string;
	router_id?: string;
	type: 'credit' | 'debit';
	/** The API serialises money as a decimal string (`"1000.00"`). */
	amount: number | string;
	reason?: string;
	status?: string;
	created_at?: string;
	router_name?: string;
	transaction_date?: string;
	/** Payment gateway that processed the transaction (`YO`, `Relworx`, …). */
	gateway?: string | null;
	/** The router this happened on, when the endpoint eager-loads it. */
	router?: { id?: string; name?: string; ip_address?: string } | null;
	/** The router owner, when the endpoint eager-loads it. */
	user?: { id?: number; name?: string; email?: string } | null;
	metadata?: Record<string, unknown> | null;
	phone?: string | null;
}

/** Paginated transaction collection (Laravel paginator shape). */
export interface PaginatedCollection<T> {
	current_page?: number;
	data?: T[];
	first_page_url?: string | null;
	from?: number | null;
	last_page?: number;
	last_page_url?: string | null;
	next_page_url?: string | null;
	path?: string;
	per_page?: number;
	prev_page_url?: string | null;
	to?: number | null;
	total?: number;
}

/**
 * `GET /transactions`
 *
 * `ApiResponse::paginated()` puts this page's rows at `transactions` and the
 * paging numbers in `transactions_metadata`, both at the top level of the
 * envelope. Older deployments nested a Laravel paginator instead, so both are
 * accepted by the readers.
 */
export type GetTransactionsResponse = ApiEnvelope<{
	transactions: ApiTransaction[] | PaginatedCollection<ApiTransaction>;
	transactions_metadata?: PaginationMeta;
	total_amount?: number;
	charge_map?: Record<string, number>;
}>;

/** `GET /connector` */
export type GetConnectorKeysResponse = ApiEnvelope<{ keys: WireguardKey[] }>;

/** `POST|GET|PUT /connector/{id}` */
export type GetConnectorKeyResponse = ApiEnvelope<{ key: WireguardKey }>;

/** WireGuard key record (`WireguardKey` schema) returned by `/connector`. */
export interface WireguardKey {
	id: string;
	user_id?: number;
	key_name: string;
	router_private_key?: string;
	router_public_key?: string;
	server_public_key?: string;
	host_address?: string;
	host_port?: number;
	host_port_observed?: number;
	observed_endpoint_address?: string;
	observed_endpoint_port?: number;
	endpoint_address?: string;
	endpoint_port?: number;
	ip_address?: string;
	my_address?: string;
	status?: 'active' | 'inactive' | 'pending' | string;
	radius_secret?: string;
	radius_nas_shortname?: string;
	radius_nas_type?: string;
	radius_ports?: string;
	radius_description?: string | null;
	last_handshake_at?: string | null;
	router_id?: string;
	created_at?: string;
	updated_at?: string;
}
