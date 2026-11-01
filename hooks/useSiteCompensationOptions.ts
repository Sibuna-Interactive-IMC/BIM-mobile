import { getApiData } from '@/helpers/apiResponse';
import { fetchSiteDisbursements } from '@/services/SiteService';
import { fetchVouchers } from '@/services/VoucherService';
import type {
	GetSiteDisbursementsResponse,
	GetVouchersResponse,
	SiteDisbursementOption,
	Voucher,
} from '@/types';
import { useCallback, useEffect, useState } from 'react';

/**
 * The two link targets an expense compensation can point at: owner
 * disbursements (cash) and this router's manually generated vouchers.
 */
export default function useSiteCompensationOptions(
	routerId?: string,
	authToken?: string,
	enabled = true
) {
	const [disbursements, setDisbursements] = useState<SiteDisbursementOption[]>(
		[]
	);
	const [vouchers, setVouchers] = useState<Voucher[]>([]);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		if (!authToken || !routerId || !enabled) return;
		setLoading(true);
		try {
			const [disbursementRes, voucherRes] = await Promise.all([
				fetchSiteDisbursements(routerId, authToken),
				fetchVouchers(
					{ router: routerId, origin: 'manual', perPage: 100 },
					authToken
				),
			]);

			if (disbursementRes.ok) {
				const body: GetSiteDisbursementsResponse = await disbursementRes.json();
				setDisbursements(
					getApiData<NonNullable<GetSiteDisbursementsResponse['data']>>(body)
						?.disbursements ?? []
				);
			}

			if (voucherRes.ok) {
				const body: GetVouchersResponse = await voucherRes.json();
				setVouchers(
					(getApiData<NonNullable<GetVouchersResponse['data']>>(body)?.vouchers ??
						[]).filter((voucher) => typeof voucher.id === 'number')
				);
			}
		} catch (e) {
			console.error('[useSiteCompensationOptions] load failed', e);
		} finally {
			setLoading(false);
		}
	}, [authToken, enabled, routerId]);

	useEffect(() => {
		void load();
	}, [load]);

	return { disbursements, vouchers, loading, reload: load };
}
