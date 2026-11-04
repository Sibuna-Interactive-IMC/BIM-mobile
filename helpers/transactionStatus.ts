import type { RecordTone } from '@/components/RecordList';

/**
 * Status colours shared by the transaction lists. Mirrors the web badges:
 * successful → green, pending → yellow, failed → red.
 */
const TRANSACTION_STATUS_TONES: Record<string, RecordTone> = {
	successful: 'success',
	completed: 'success',
	approved: 'success',
	pending_approval: 'info',
	pending: 'warning',
	reversed: 'muted',
	failed: 'danger',
	rejected: 'danger',
};

export function transactionStatusTone(status?: string | null): RecordTone {
	return (
		TRANSACTION_STATUS_TONES[(status ?? '').trim().toLowerCase()] ?? 'warning'
	);
}
