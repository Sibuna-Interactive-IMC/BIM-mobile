import React from 'react';

// Minimal web shim for react-native-svg used in Storybook preview.
// Converts common RN SVG primitives to DOM SVG elements and forwards props.
export const Svg = ({ children, width, height, viewBox, style, ...rest }) => {
    const attrs = { width, height, viewBox, ...rest };
    // Avoid passing array-style RN styles to DOM; normalize simple style objects
    const normStyle = style && typeof style === 'object' && !Array.isArray(style) ? style : undefined;
    if (normStyle) attrs.style = normStyle;
    return React.createElement('svg', attrs, children);
};

export const G = ({ children, ...rest }) => React.createElement('g', rest, children);
export const Path = ({ d, fill, stroke, strokeWidth, ...rest }) => React.createElement('path', { d, fill, stroke, strokeWidth, ...rest });
export const Circle = ({ cx, cy, r, ...rest }) => React.createElement('circle', { cx, cy, r, ...rest });
export const Rect = ({ x, y, width, height, rx, ry, ...rest }) => React.createElement('rect', { x, y, width, height, rx, ry, ...rest });
export const Line = ({ x1, y1, x2, y2, ...rest }) => React.createElement('line', { x1, y1, x2, y2, ...rest });
export const Ellipse = ({ cx, cy, rx, ry, ...rest }) => React.createElement('ellipse', { cx, cy, rx, ry, ...rest });
export const Polygon = ({ points, ...rest }) => React.createElement('polygon', { points, ...rest });
export const Polyline = ({ points, ...rest }) => React.createElement('polyline', { points, ...rest });
export const Text = ({ children, ...rest }) => React.createElement('text', rest, children);
export const TSpan = ({ children, ...rest }) => React.createElement('tspan', rest, children);
export const Defs = ({ children, ...rest }) => React.createElement('defs', rest, children);
export const ClipPath = ({ children, ...rest }) => React.createElement('clipPath', rest, children);
export const LinearGradient = ({ children, ...rest }) => React.createElement('linearGradient', rest, children);
export const RadialGradient = ({ children, ...rest }) => React.createElement('radialGradient', rest, children);
export const Stop = ({ offset, stopColor, stopOpacity, ...rest }) => React.createElement('stop', { offset, stopColor, stopOpacity, ...rest });
export const Use = (props) => React.createElement('use', props);
export const Symbol = ({ children, ...rest }) => React.createElement('symbol', rest, children);
export const Image = ({ href, ...rest }) => React.createElement('image', { href, ...rest });

// Remote SVGs can be rendered directly by the browser, so map SvgUri to an <img>.
export const SvgUri = ({ uri, width, height, style, onError }) =>
    React.createElement('img', {
        src: uri || undefined,
        width,
        height,
        style: style && typeof style === 'object' && !Array.isArray(style) ? style : undefined,
        alt: '',
        onError: () => onError && onError(new Error(`Failed to load ${uri}`)),
    });

// Real react-native-svg defaults to the Svg component, so mirror that while
// keeping the primitives reachable as properties on the default export.
const SvgDefault = Object.assign(Svg, {
    Svg,
    G,
    Path,
    Circle,
    Rect,
    Line,
    Ellipse,
    Polygon,
    Polyline,
    Text,
    TSpan,
    Defs,
    ClipPath,
    LinearGradient,
    RadialGradient,
    Stop,
    Use,
    Symbol,
    Image,
    SvgUri,
});

export default SvgDefault;
