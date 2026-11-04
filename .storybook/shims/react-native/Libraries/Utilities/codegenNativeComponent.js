// Minimal stub for react-native's codegenNativeComponent used by some RN libraries
import React from 'react';

export default function codegenNativeComponent(name) {
    // Return a simple passthrough component for web stories
    const Comp = React.forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
    Comp.displayName = `CodegenNativeComponent(${String(name)})`;
    return Comp;
}
