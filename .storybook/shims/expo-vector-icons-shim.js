import React from 'react';

// Visible, lightweight shim for @expo/vector-icons in Storybook web.
// Renders a recognizable SVG glyph per icon name so previews match the app.
const svg = (size, color, children, rest) =>
    React.createElement(
        'svg',
        {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: color,
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'data-shim-icon': true,
            style: { display: 'inline-block', verticalAlign: 'middle' },
            ...rest,
        },
        children.map((child, index) =>
            React.isValidElement(child)
                ? React.cloneElement(child, { key: child.key ?? index })
                : child
        )
    );

const rect = (props) => React.createElement('rect', props);
const line = (props) => React.createElement('line', props);
const circle = (props) => React.createElement('circle', props);
const path = (props) => React.createElement('path', props);

const checkMark = (x = 7, y = 12) => path({ d: `M${x} ${y}l3 3l7-7` });

const StubIcon = ({ size = 16, color = 'currentColor', name, ...rest }) => {
    const key = String(name || '').toLowerCase();

    if (key.includes('clock')) {
        return svg(size, color, [
            circle({ cx: 12, cy: 12, r: 9 }),
            line({ x1: 12, y1: 12, x2: 12, y2: 7 }),
            line({ x1: 12, y1: 12, x2: 16, y2: 12 }),
        ], rest);
    }
    if (key.includes('printer')) {
        return svg(size, color, [
            path({ d: 'M6 9V3h12v6' }),
            rect({ x: 3, y: 9, width: 18, height: 8, rx: 2 }),
            rect({ x: 6, y: 13, width: 12, height: 8, rx: 1 }),
        ], rest);
    }
    if (key.includes('select-all') || key.includes('multiple')) {
        return svg(size, color, [
            rect({ x: 3, y: 3, width: 8, height: 8, rx: 1 }),
            rect({ x: 13, y: 3, width: 8, height: 8, rx: 1 }),
            rect({ x: 3, y: 13, width: 8, height: 8, rx: 1 }),
            checkMark(13, 17),
        ], rest);
    }
    if (key.includes('checkbox-marked')) {
        return svg(size, color, [
            rect({ x: 3, y: 3, width: 18, height: 18, rx: 2 }),
            checkMark(7, 12),
        ], rest);
    }
    if (key.includes('checkbox-blank')) {
        return svg(size, color, [rect({ x: 3, y: 3, width: 18, height: 18, rx: 2 })], rest);
    }
    if (key === 'check') {
        return svg(size, color, [path({ d: 'M4 12l5 5L20 6' })], rest);
    }
    if (key.includes('add') || key.includes('plus')) {
        return svg(size, color, [
            line({ x1: 12, y1: 4, x2: 12, y2: 20 }),
            line({ x1: 4, y1: 12, x2: 20, y2: 12 }),
        ], rest);
    }
    if (key.includes('pencil') || key.includes('edit')) {
        return svg(size, color, [
            path({ d: 'M4 20h4L20 8l-4-4L4 16v4z' }),
            line({ x1: 14, y1: 6, x2: 18, y2: 10 }),
        ], rest);
    }
    if (key.includes('delete') || key.includes('trash')) {
        return svg(size, color, [
            line({ x1: 4, y1: 7, x2: 20, y2: 7 }),
            path({ d: 'M9 7V4h6v3' }),
            path({ d: 'M6 7l1 13h10l1-13' }),
        ], rest);
    }
    if (key.includes('block') || key.includes('cancel')) {
        return svg(size, color, [
            circle({ cx: 12, cy: 12, r: 9 }),
            line({ x1: 6, y1: 18, x2: 18, y2: 6 }),
        ], rest);
    }
    if (key.includes('eye')) {
        return svg(size, color, [
            path({ d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' }),
            circle({ cx: 12, cy: 12, r: 3 }),
        ], rest);
    }
    if (key.includes('key')) {
        return svg(size, color, [
            circle({ cx: 8, cy: 8, r: 4 }),
            path({ d: 'M11 11l9 9M17 17l2-2M14 14l2-2' }),
        ], rest);
    }
    if (key.includes('chevron') || key.includes('forward') || key.includes('back')) {
        return svg(size, color, [path({ d: 'M9 6l6 6-6 6' })], rest);
    }
    if (key.includes('map-marker') || key.includes('pin')) {
        return svg(size, color, [
            path({ d: 'M12 22s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12z' }),
            circle({ cx: 12, cy: 10, r: 2.5 }),
        ], rest);
    }
    if (key.includes('account-group') || key.includes('account-cog')) {
        return svg(size, color, [
            circle({ cx: 9, cy: 8, r: 3 }),
            path({ d: 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6' }),
            circle({ cx: 17, cy: 9, r: 2.5 }),
            path({ d: 'M15 20c0-2.5 1-4.2 2.6-5' }),
        ], rest);
    }
    if (key.includes('chart')) {
        return svg(size, color, [
            line({ x1: 5, y1: 20, x2: 5, y2: 12 }),
            line({ x1: 12, y1: 20, x2: 12, y2: 6 }),
            line({ x1: 19, y1: 20, x2: 19, y2: 10 }),
        ], rest);
    }
    if (key.includes('handshake')) {
        return svg(size, color, [
            path({ d: 'M3 12l4-4 5 5 5-5 4 4' }),
            path({ d: 'M7 16l5 4 5-4' }),
        ], rest);
    }
    if (key.includes('credit-card') || key.includes('ticket')) {
        return svg(size, color, [
            rect({ x: 2, y: 5, width: 20, height: 14, rx: 2 }),
            line({ x1: 2, y1: 10, x2: 22, y2: 10 }),
        ], rest);
    }
    // Calendar glyph (default)
    return svg(size, color, [
        rect({ x: 3, y: 4, width: 18, height: 17, rx: 2, ry: 2 }),
        line({ x1: 3, y1: 10, x2: 21, y2: 10 }),
        line({ x1: 8, y1: 2, x2: 8, y2: 6 }),
        line({ x1: 16, y1: 2, x2: 16, y2: 6 }),
    ], rest);
};

// Export common icon families as stubs. Apps commonly import named families.
export const Ionicons = StubIcon;
export const MaterialIcons = StubIcon;
export const FontAwesome = StubIcon;
export const Entypo = StubIcon;
export const Feather = StubIcon;
export const MaterialCommunityIcons = StubIcon;
export const Octicons = StubIcon;

// default export usable as a generic icon component
export default StubIcon;
