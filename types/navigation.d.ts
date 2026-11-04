declare module '@react-navigation/drawer' {
	// Extend DrawerNavigationOptions to allow a custom `headerProps` field used by our Header factory
	interface DrawerNavigationOptions {
		headerProps?: {
			goback?: boolean;
			// optional per-screen handler which, if provided, will be used instead of
			// the app-level handleGoBack from `GeneralContext`.
			handleGoBack?: () => void;
			// add other shared header props here if needed in future
		};
	}
}
