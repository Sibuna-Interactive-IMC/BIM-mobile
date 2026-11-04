import React from 'react';

// Minimal theme used by navigation components in Storybook preview
const DefaultTheme = {
    dark: false,
    colors: {
        primary: '#0b5fff',
        background: '#fff',
        card: '#fff',
        text: '#000',
        border: '#ccc',
        notification: '#f50057',
    },
};

const ThemeContext = React.createContext(DefaultTheme);

export function useTheme() {
    const theme = React.useContext(ThemeContext);
    if (!theme) throw new Error("Couldn't find a theme. Is your component inside NavigationContainer or does it have a theme?");
    return theme;
}

export function ThemeProvider({ children, value = DefaultTheme }) {
    return React.createElement(ThemeContext.Provider, { value }, children);
}

// Minimal PlatformPressable used by some navigation components
export function PlatformPressable(props) {
    const { children, onPress, style } = props;
    return React.createElement(
        'button',
        { onClick: onPress, style: style, type: 'button' },
        children
    );
}

export default { useTheme, ThemeProvider, DefaultTheme, PlatformPressable };
