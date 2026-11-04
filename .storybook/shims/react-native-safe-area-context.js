import React from 'react';

// Minimal shim for react-native-safe-area-context for Storybook web preview.
// Provides SafeAreaProvider and useSafeAreaInsets returning zero insets.
export const SafeAreaProvider = ({ children }) => {
    return React.createElement(React.Fragment, null, children);
};

export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });

export const initialWindowMetrics = {
    frame: { x: 0, y: 0, width: 0, height: 0 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

export default {
    SafeAreaProvider,
    useSafeAreaInsets,
    initialWindowMetrics,
};

