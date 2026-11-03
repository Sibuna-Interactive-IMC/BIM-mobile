/// <reference types="jest" />
import { transactionStatusTone } from '@/helpers/transactionStatus';

describe('transactionStatusTone', () => {
	it('matches the web status colours', () => {
		expect(transactionStatusTone('successful')).toBe('success');
		expect(transactionStatusTone('pending')).toBe('warning');
		expect(transactionStatusTone('failed')).toBe('danger');
	});

	it('normalises case and whitespace', () => {
		expect(transactionStatusTone(' Pending ')).toBe('warning');
		expect(transactionStatusTone('FAILED')).toBe('danger');
	});

	it('keeps the extra ledger statuses', () => {
		expect(transactionStatusTone('pending_approval')).toBe('info');
		expect(transactionStatusTone('reversed')).toBe('muted');
		expect(transactionStatusTone('rejected')).toBe('danger');
	});

	it('falls back to the attention tone for unknown statuses', () => {
		expect(transactionStatusTone(undefined)).toBe('warning');
		expect(transactionStatusTone('mystery')).toBe('warning');
	});
});
