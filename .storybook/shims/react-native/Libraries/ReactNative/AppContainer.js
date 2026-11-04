// Minimal AppContainer stub for web stories. Some libraries import this for debug wrappers.
import React from 'react';

export default function AppContainer({ children }) {
    return React.createElement('div', null, children);
}
