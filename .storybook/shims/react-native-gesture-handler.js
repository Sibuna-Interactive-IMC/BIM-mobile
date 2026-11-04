import React from 'react';
import { ScrollView as RNWScrollView } from 'react-native-web';

// Lightweight passthrough components for Storybook web
export const GestureHandlerRootView = ({ children, ...rest }) => (
    React.createElement('div', rest, children)
);

export const TouchableOpacity = ({ children, ...rest }) => (
    React.createElement('button', rest, children)
);

export const ScrollView = RNWScrollView;

export const State = {};

export default {
    GestureHandlerRootView,
    TouchableOpacity,
    ScrollView,
    State,
};
