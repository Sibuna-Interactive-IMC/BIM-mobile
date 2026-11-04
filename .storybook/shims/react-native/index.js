// ESM wrapper that explicitly exports commonly-used React Native symbols
// and falls back to the default shim for anything else.
import * as Shim from '../react-native-shim.js';

// Ensure a minimal globalThis.expo object exists for expo-modules-core runtime checks.
// expo-modules-core calls ensureNativeModulesAreInstalled() which expects
// registerWebGlobals() to set `globalThis.expo`. Some package entrypoints
// don't resolve the web-specific build in our Storybook environment, so
// provide a safe fallback here that supplies the small subset of APIs
// that libraries (like expo-web-browser, expo-modules-core) access.
if (typeof globalThis !== 'undefined' && !globalThis.expo) {
    globalThis.expo = {
        // Minimal NativeModule placeholder used by expo-modules-core
        NativeModule: {},
        // Minimal EventEmitter used by some expo pieces
        EventEmitter: class {
            addListener() { }
            removeListener() { }
            emit() { }
        },
        // Lightweight SharedObject/SharedRef placeholders
        SharedObject: class { },
        SharedRef: class { },
        // A place to register any web-specific module implementations
        modules: {},
        // UUID helpers (no-op identifiers) — some code references uuidv4/uuidv5
        uuidv4: () => '',
        uuidv5: () => '',
        getViewConfig: () => {
            throw new Error('Method not implemented.');
        },
        reloadAppAsync: async () => {
            try {
                if (typeof window !== 'undefined' && window.location) window.location.reload();
            } catch (_e) {
                /* ignore in storybook */
            }
        },
    };
}

// Ensure common web modules are registered on globalThis.expo.modules so
// `requireNativeModule('ExpoWebBrowser')` and similar resolve.
try {
    const webModules = (globalThis && globalThis.expo && globalThis.expo.modules) || {};
    // Prefer implementation from the underlying shim if available
    const shimNativeModules = (Shim && Shim.NativeModules) || (Shim.default && Shim.default.NativeModules) || {};
    webModules.ExpoWebBrowser = webModules.ExpoWebBrowser || shimNativeModules.ExpoWebBrowser || {
        openBrowserAsync: async (url) => {
            try {
                if (typeof window !== 'undefined' && window.open) window.open(url, '_blank');
            } catch (_e) {
                /* ignore */
            }
            return { type: 'opened' };
        },
    };
    // Minimal ExpoAsset stub used by some expo packages (e.g. expo-haptics)
    webModules.ExpoAsset = webModules.ExpoAsset || shimNativeModules.ExpoAsset || {
        fromModule: (module) => {
            // Return an object with a localUri and a downloadAsync helper
            const uri = (module && (module.uri || module)) || '';
            return {
                localUri: uri,
                async downloadAsync() {
                    return { localUri: uri };
                },
            };
        },
        async downloadAsync() {
            return { localUri: '' };
        },
    };
    if (globalThis && globalThis.expo) globalThis.expo.modules = webModules;
} catch (_e) {
    // ignore shim setup errors in storybook
}

// Delegate named exports to the underlying shim to avoid duplicate export errors.
// Consumers can still `import * as Shim` or import named symbols directly from this module
// because we re-export everything below.

// Minimal TurboModuleRegistry shim required by some native libraries (e.g. react-native-svg fabric)
// Provide getEnforcing(name) -> returns a no-op proxy so method calls don't crash in the web preview.
// TurboModuleRegistry stub: some libraries import { TurboModuleRegistry } from 'react-native'
// and call TurboModuleRegistry.getEnforcing(name). Provide a no-op implementation here
// that returns a proxy with noop functions to avoid runtime crashes in Storybook web.
export const TurboModuleRegistry = {
    getEnforcing: (/* name */) => new Proxy({}, {
        get: () => () => undefined,
    }),
    get: (/* name */) => new Proxy({}, {
        get: () => () => undefined,
    }),
};

// Re-export everything from the underlying shim and expose its default via the namespace
export * from '../react-native-shim.js';
export default Shim.default;

