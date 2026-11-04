import React from 'react';

// Minimal expo-blur shim for Storybook web preview.
// Exports a BlurView component that renders a div with CSS backdrop-filter as a visual hint.
export const BlurView = ({ children, intensity = 50, tint = 'default', style = {}, ...rest }) => {
    const blurPx = typeof intensity === 'number' ? `${Math.min(20, Math.round((intensity / 100) * 20))}px` : '4px';
    const background = tint === 'dark' ? 'rgba(0,0,0,0.25)' : tint === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)';
    const wrapperStyle = Object.assign({}, style, {
        WebkitBackdropFilter: `blur(${blurPx})`,
        backdropFilter: `blur(${blurPx})`,
        background,
    });
    return React.createElement('div', { style: wrapperStyle, ...rest }, children);
};

export default {
    BlurView,
};
