// Lightweight shim for @react-native-community/netinfo used in Storybook web
// Provides minimal API surface: addEventListener, fetch, useNetInfo
export const addEventListener = (handler) => {
    // Call handler immediately with connected=true to simulate online
    try {
        handler({ isConnected: true, isInternetReachable: true });
    } catch (_e) { }
    // return unsubscribe
    return () => { };
};

export const addListener = addEventListener;
export const removeEventListener = () => { };

export async function fetch() {
    return { isConnected: true, isInternetReachable: true };
}

export function useNetInfo() {
    // simple hook-like function returning an object compatible with useNetInfo
    return { isConnected: true, isInternetReachable: true };
}

const defaultExport = { addEventListener, addListener, removeEventListener, fetch, useNetInfo };
export default defaultExport;
