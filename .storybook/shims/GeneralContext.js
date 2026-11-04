// Minimal GeneralContext shim used only inside Storybook web preview.
// Keeps the same named exports `GeneralProvider` and `useGeneral`
// but avoids importing expo-device / expo-router which trigger native prebundling.

const DEFAULT = {
    user: null,
    language: 'en',
    setLanguage: () => { },
    handleLogout: async () => { },
    fetchNotifications: async () => { },
    notifications: [],
    isAnimatable: false,
    isHighEndDevice: false,
    keyboardVisible: false,
    setNotifications: () => { },
    selectedOption: undefined,
    setSelectedOption: () => { },
    history: [],
    handleUpdateHistory: () => { },
    handleGoBack: () => { },
    handleAuthentication: async () => { },
    online: true,
    router: {
        back: () => { },
        replace: () => { },
        push: () => { },
    },
};

export const GeneralProvider = ({ children }) => children;

export const useGeneral = () => {
    const overrides = (typeof globalThis !== 'undefined' && globalThis.__STORYBOOK_GENERAL__) || {};
    return { ...DEFAULT, ...overrides };
};

export default GeneralProvider;
