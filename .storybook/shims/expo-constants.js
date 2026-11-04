const Constants = {
    manifest: {},
    expoConfig: {},
    installationId: '',
    deviceName: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
    isDevice: false,
    platform: { web: true },
    getWebViewUserAgent: () => (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
};

export default Constants;
