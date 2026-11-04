// Minimal shim for react-native-reanimated used in web Storybook
import React from 'react';

const noop = () => { };

export const useSharedValue = (v) => ({ value: v });
export const useAnimatedStyle = (fn) => {
    try {
        return typeof fn === 'function' ? fn() : {};
    } catch (_e) {
        return {};
    }
};
export const withTiming = (v) => v;
export const withRepeat = (animation, times, reverse) => animation;
export const withDelay = (delay, animation) => animation;
export const withSequence = (...animations) => animations[animations.length - 1];
export const runOnJS = (fn) => fn;
export const useAnimatedRef = () => React.useRef(null);
// Map refs to their shared scroll offset values so a ScrollView component
// can update the corresponding shared value when scrolled.
const scrollOffsetMap = new WeakMap();

export const useScrollViewOffset = (ref) => {
    const sv = useSharedValue(0);
    React.useEffect(() => {
        try {
            // store the mapping from the ref object to the shared value
            if (ref && typeof ref === 'object') scrollOffsetMap.set(ref, sv);
        } catch (_e) { }
        return () => {
            try {
                if (ref && typeof ref === 'object') scrollOffsetMap.delete(ref);
            } catch (_e) { }
        };
    }, [ref, sv]);
    return sv;
};
// Minimal interpolate implementation: supports numeric interpolation with
// inputRange/outputRange arrays. Accepts a number or a shared-value-like
// object ({ value }). If outputs are non-numeric, returns the closest
// endpoint string instead of doing numeric interpolation.
export const interpolate = (value, inputRange = [0, 1], outputRange = [0, 1]) => {
    const v = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
    const num = Number(v);
    if (Number.isNaN(num)) {
        // Can't interpret value as number — return first output as safe fallback
        return outputRange[0];
    }
    // ensure arrays
    const inR = Array.isArray(inputRange) ? inputRange : [inputRange];
    const outR = Array.isArray(outputRange) ? outputRange : [outputRange];
    // find segment
    for (let i = 0; i < inR.length - 1; i++) {
        const inMin = inR[i];
        const inMax = inR[i + 1];
        const min = Math.min(inMin, inMax);
        const max = Math.max(inMin, inMax);
        if (num >= min && num <= max) {
            const progress = (num - inMin) / (inMax - inMin || 1);
            const outMin = outR[i];
            const outMax = outR[i + 1];
            const outMinNum = Number(outMin);
            const outMaxNum = Number(outMax);
            if (!Number.isNaN(outMinNum) && !Number.isNaN(outMaxNum)) {
                return outMinNum + progress * (outMaxNum - outMinNum);
            }
            // non-numeric outputs — return nearest endpoint
            return progress < 0.5 ? outMin : outMax;
        }
    }
    // outside ranges — clamp to ends
    if (num < inR[0]) return outR[0];
    return outR[outR.length - 1];
};

const defaultExport = {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    useAnimatedRef,
    withRepeat,
    withDelay,
    withSequence,
    interpolate,
    // helpers
    Value: function () { },
    event: () => noop,
};

// Provide a minimal Animated object with a View component so code using
// `Animated.View` can render in Storybook web preview.
const Animated = {
    ...defaultExport,
    interpolate,
    // Normalize React Native style objects/arrays into DOM-friendly style objects.
    // This flattens arrays and converts transform arrays to CSS transform strings.
    _normalizeStyle: (style) => {
        if (!style) return {};
        const flatten = (s) => {
            if (!s) return {};
            if (Array.isArray(s)) return s.reduce((acc, it) => Object.assign(acc, flatten(it)), {});
            if (typeof s === 'object') return s;
            return {};
        };
        const pxProps = new Set([
            'width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius', 'fontSize', 'lineHeight',
        ]);
        const out = {};
        const src = flatten(style);
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
        for (const k in src) {
            // Skip numeric keys that can appear when a style array leaks into DOM
            if (/^\d+$/.test(k)) {
                if (typeof console !== 'undefined' && console.warn) console.warn('[reanimated-shim] skipping numeric style key', k);
                continue;
            }
            if (k === 'transform' && Array.isArray(src[k])) {
                const parts = [];
                for (const t of src[k]) {
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
                        // fallback for unknown transforms
                        parts.push(`${key}(${val})`);
                    }
                }
                out.transform = parts.join(' ');
                continue;
            }
            const v = src[k];
            if (typeof v === 'number' && pxProps.has(k)) out[k] = `${v}px`;
            else out[k] = v;
        }
        return out;
    },
    View: ({ children, style, ...rest }) => React.createElement('div', { style: Animated._normalizeStyle(style), ...rest }, children),
    // A simple ScrollView that maps DOM scroll events to any shared value
    // registered via `useScrollViewOffset(ref)`. Style is normalized.
};

// Define a named forwardRef component so ESLint won't complain about missing displayName.
const AnimatedScrollView = React.forwardRef(({ children, style, onScroll, nestedScrollEnabled, contentContainerStyle, scrollIndicatorInsets, scrollEventThrottle, ...rest }, forwardedRef) => {
    // RN-only props — drop them so they don't become unknown DOM attributes
    // and trigger React warnings.
    void nestedScrollEnabled;
    void scrollIndicatorInsets;
    void scrollEventThrottle;
    const handleScroll = (e) => {
        try {
            const sv = scrollOffsetMap.get(forwardedRef);
            if (sv) sv.value = e?.target?.scrollTop ?? 0;
        } catch (_e) { }
        if (typeof onScroll === 'function') onScroll(e);
    };
    const mergedStyle = Object.assign({ overflow: 'auto' }, Animated._normalizeStyle(style));
    // contentContainerStyle is RN-specific and should be applied to an inner
    // container. Consume it here and don't pass it to the DOM element props.
    const inner = React.createElement('div', { style: Animated._normalizeStyle(contentContainerStyle) }, children);
    return React.createElement('div', { ref: forwardedRef, onScroll: handleScroll, style: mergedStyle, ...rest }, inner);
});
AnimatedScrollView.displayName = 'AnimatedScrollView';

Animated.ScrollView = AnimatedScrollView;

export default Animated;
