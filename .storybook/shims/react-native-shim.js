// Minimal react-native shim for Storybook web.
// Re-export react-native-web and attach small runtime shims for NativeModules/UIManager/etc.
import React from 'react';
import * as RNWeb from 'react-native-web';

// Minimal NativeModules expected by some libraries
const NativeModules = {
    UIManager: {},
    PlatformConstants: { forceTouchAvailable: false },
    // Minimal RNCNetInfo native module shim used by @react-native-community/netinfo
    RNCNetInfo: {
        getCurrentState: async () => ({ isConnected: true, isInternetReachable: true }),
        addListener: () => ({ remove: () => { } }),
        removeListeners: () => { },
    },
    // Minimal Expo Web Browser native module shim
    ExpoWebBrowser: {
        openBrowserAsync: async (url) => {
            // open in a new tab on web
            try {
                if (typeof window !== 'undefined' && window.open) window.open(url, '_blank');
            } catch (_e) {
                // ignore in test/storybook environment
            }
            return { type: 'opened' };
        },
        // Some builds access NativeModule on the platform implementation
        NativeModule: {
            openBrowserAsync: async (url) => {
                try {
                    if (typeof window !== 'undefined' && window.open) window.open(url, '_blank');
                } catch (_e) {
                    // ignore
                }
                return { type: 'opened' };
            },
        },
    },
    // Minimal ExponentConstants used by expo-constants
    ExponentConstants: {
        manifest: {},
        appOwnership: 'none',
        manifest2: {},
        linkingUrl: '',
        installationId: '',
    },
};

// Minimal UIManager stub
const UIManager = NativeModules.UIManager;

// Minimal NativeEventEmitter stub
class NativeEventEmitter {
    constructor() { }
    addListener() { }
    removeListener() { }
    removeAllListeners() { }
}

// Minimal Platform stub
const Platform = {
    OS: 'web',
    select: obj => (obj && obj.web != null ? obj.web : obj.default || obj),
};

// Minimal ToastAndroid stub (no-op for web)
const ToastAndroid = {
    SHORT: 0,
    LONG: 1,
    TOP: 0,
    BOTTOM: 1,
    CENTER: 2,
    show: (message, duration) => {
        // no-op on web; log for visibility in Storybook console
        console.info('[ToastAndroid]', message, duration);
    },
    showWithGravity: (message, duration, gravity) => {
        console.info('[ToastAndroid]', message, duration, gravity);
    },
    showWithGravityAndOffset: (message, duration, gravity, xOffset, yOffset) => {
        console.info('[ToastAndroid]', message, duration, gravity, xOffset, yOffset);
    },
};

// Provide a simple useAnimatedValue hook that returns a react-native-web Animated.Value
export const useAnimatedValue = (initialValue) => {
    const ref = React.useRef();
    if (!ref.current) {
        try {
            ref.current = new RNWeb.Animated.Value(initialValue);
        } catch (_e) {
            // fallback to simple object when Animated.Value isn't available
            ref.current = { value: initialValue };
        }
    }
    return ref.current;
};

export * from 'react-native-web';
export { NativeEventEmitter, NativeModules, Platform, ToastAndroid, UIManager };
export default { ...RNWeb, NativeModules, UIManager, NativeEventEmitter, Platform, ToastAndroid, useAnimatedValue };

// Provide a small wrapper around react-native-web's View that normalizes
// RN style props so the DOM only receives plain objects and strings.
const BaseView = RNWeb.View;
const _normalizeStyle = (s) => {
    if (!s) return {};
    const flatten = (x) => {
        if (!x) return {};
        if (Array.isArray(x)) return x.reduce((acc, it) => Object.assign(acc, flatten(it)), {});
        if (typeof x === 'object') return x;
        return {};
    };
    const src = flatten(s);
    const out = {};
    // Map RN shadow props to CSS boxShadow
    const hexToRgb = (hex) => {
        if (!hex) return [0, 0, 0];
        const h = hex.replace('#', '');
        if (h.length === 3) {
            return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
        }
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    if (src.shadowColor || src.shadowOffset || src.shadowRadius || src.shadowOpacity || src.elevation) {
        try {
            const [r, g, b] = hexToRgb(src.shadowColor || '#000');
            const opacity = typeof src.shadowOpacity === 'number' ? src.shadowOpacity : 0.2;
            const offset = src.shadowOffset || { width: 0, height: 0 };
            const blur = typeof src.shadowRadius === 'number' ? src.shadowRadius : (src.elevation || 0);
            out.boxShadow = `${offset.width || 0}px ${offset.height || 0}px ${blur}px rgba(${r}, ${g}, ${b}, ${opacity})`;
        } catch (_e) { }
    }
    const pxProps = new Set([
        'width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius', 'fontSize', 'lineHeight'
    ]);
    for (const k in src) {
        // Skip numeric keys which indicate an array-like style object leaking
        // through — these cause Indexed property setter errors on CSSStyleDeclaration.
        if (/^\d+$/.test(k)) {
            if (typeof console !== 'undefined' && console.warn) console.warn('[shim] skipping numeric style key', k);
            continue;
        }
        const v = src[k];
        if (k === 'transform' && Array.isArray(v)) {
            const parts = [];
            for (const t of v) {
                const key = Object.keys(t)[0];
                const val = t[key];
                if (key.startsWith('translate')) {
                    const axis = key.slice('translate'.length);
                    const px = typeof val === 'number' ? `${val}px` : val;
                    parts.push(`translate${axis}(${px})`);
                } else if (key === 'scale') {
                    parts.push(`scale(${val})`);
                } else if (key === 'rotate') {
                    parts.push(`rotate(${typeof val === 'number' ? val + 'deg' : val})`);
                } else {
                    parts.push(`${key}(${val})`);
                }
            }
            out.transform = parts.join(' ');
            continue;
        }
        if (typeof v === 'number' && pxProps.has(k)) out[k] = `${v}px`;
        else out[k] = v;
    }
    return out;
};
export const View = (props) => {
    const { style, children, ...rest } = props || {};
    const norm = _normalizeStyle(style);
    return React.createElement(BaseView, { ...rest, style: norm }, children);
};

// Wrap Text to normalize style arrays
const BaseText = RNWeb.Text;
export const Text = (props) => {
    const { style, children, ...rest } = props || {};
    const norm = _normalizeStyle(style);
    return React.createElement(BaseText, { ...rest, style: norm }, children);
};

// Wrap Image to normalize style
const BaseImage = RNWeb.Image;
export const Image = (props) => {
    const { style, children, ...rest } = props || {};
    const norm = _normalizeStyle(style);
    return React.createElement(BaseImage, { ...rest, style: norm }, children);
};

// Wrap ScrollView to normalize style and contentContainerStyle
const BaseScrollView = RNWeb.ScrollView;
export const ScrollView = (props) => {
    const { style, contentContainerStyle, children, ...rest } = props || {};
    const norm = _normalizeStyle(style);
    const inner = React.createElement('div', { style: _normalizeStyle(contentContainerStyle) }, children);
    return React.createElement(BaseScrollView, { ...rest, style: norm }, inner);
};

// Wrap TouchableOpacity to normalize style
const BaseTouchable = RNWeb.TouchableOpacity || RNWeb.TouchableHighlight || RNWeb.TouchableWithoutFeedback;
export const TouchableOpacity = (props) => {
    const { style, children, ...rest } = props || {};
    const norm = _normalizeStyle(style);
    return React.createElement(BaseTouchable, { ...rest, style: norm }, children);
};

// Provide a safe Animated export that avoids attempting to use native driver on web.
const RNAnimated = RNWeb && RNWeb.Animated ? RNWeb.Animated : null;
export const Animated = (function () {
    if (!RNAnimated) {
        return {
            Value: function (v) { this.value = v; },
            timing: () => ({ start: () => { } }),
            createAnimatedComponent: (C) => C,
        };
    }
    const wrapped = { ...RNAnimated };
    const origTiming = RNAnimated.timing;
    wrapped.timing = function (value, config) {
        const cfg = Object.assign({}, config || {});
        if (cfg.useNativeDriver) cfg.useNativeDriver = false;
        try {
            return origTiming.call(RNAnimated, value, cfg);
        } catch (_e) {
            return { start: () => { } };
        }
    };
    wrapped.createAnimatedComponent = RNAnimated.createAnimatedComponent || ((C) => C);
    return wrapped;
})();

