// @ts-nocheck
import translations from '@/constants/Trans';

describe('setup-2fa translations and plumbing', () => {
	test('english translations contain expected keys', () => {
		const auth = translations.en.categories.auth;
		expect(auth['setupAuthenticator']).toBeDefined();
		expect(auth['setupAuthenticator.copy']).toBeDefined();
		expect(auth['setupAuthenticator.copiedToast']).toBeDefined();
		expect(auth['setupAuthenticator.enterCodePlaceholder']).toBeDefined();
	});

	test('setAppMessage fallback message exists', () => {
		const auth = translations.en.categories.auth;
		expect(auth['loginFailed']).toBeDefined();
		expect(auth['registrationFailed']).toBeDefined();
		expect(auth['otpVerificationFailed']).toBeDefined();
	});
});
