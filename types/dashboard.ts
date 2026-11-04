export interface ChartDataEntry {
	date: string; // ISO date string (e.g. 2025-11-15)
	total: number; // numeric total for charting
}

export interface RouterBalance {
	id: number | string;
	name: string;
	balance: number;
}

/** A row of `data.recentTransactions` from `GET /dashboard`. */
export interface RecentTransaction {
	id: string;
	amount: number;
	created_at?: string; // original server timestamp string
	updated_at?: string | null;
	deleted_at?: string | null;
	reason?: string | null;
	router_id?: string | number | null;
	router?: { id?: number | string; name?: string } | null;
	router_name?: string | null;
	transaction_date?: string | null;
	status?: string;
	type?: 'credit' | 'debit' | string;
	/** Payment gateway that processed the transaction (`YO`, `Relworx`, …). */
	gateway?: string | null;
}

export interface DashboardSummary {
	chartData: ChartDataEntry[];
	monthTransactions?: number;
	monthUsers: number;
	recentTransactions?: RecentTransaction[];
	routerBalances: RouterBalance[];
	todayTransactions: number;
	todayUsers: number;
	weekTransactions: number;
	weekUsers: number;
}

export { };

