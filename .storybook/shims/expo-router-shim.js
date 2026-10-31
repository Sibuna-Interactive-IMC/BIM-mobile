import React from 'react';

export function useRouter() {
    return {
        back: () => { },
        replace: () => { },
        push: () => { },
        navigate: () => { },
    };
}

export function useNavigation() {
    return useRouter();
}

export function useLocalSearchParams() {
    const params = (typeof globalThis !== 'undefined' && globalThis.__STORYBOOK_PARAMS__) || {};
    return params;
}

export const Link = ({ children, href, ...props }) => {
    return React.createElement('a', { href: typeof href === 'string' ? href : '#', ...props }, children);
};

export default {
    useRouter,
    useNavigation,
    useLocalSearchParams,
    Link,
};
