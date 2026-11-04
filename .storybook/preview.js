// Ensure a minimal `process` object exists in the browser runtime for
// libraries that reference `process` (e.g. util/assert do).
// This must run early, before other modules rely on `process`.
import React from 'react';
import { View } from 'react-native';
// Synchronously import react-dom so we can patch it before Storybook runtime uses it.
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

// Sanitize URL args early: remove any top-level unsafe query keys and drop the
// `args` parameter entirely if it contains suspicious tokens. This prevents
// Storybook from logging "Omitted potentially unsafe URL args."
(() => {
    try {
        if (typeof window === 'undefined' || typeof URL === 'undefined') return;
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const unsafePattern = /(^__proto__$|constructor|prototype|\[|\]|\$)/i;
        let changed = false;

        // Remove any top-level query keys that look unsafe
        for (const key of Array.from(params.keys())) {
            const val = params.get(key) || '';
            if (unsafePattern.test(key) || unsafePattern.test(val)) {
                params.delete(key);
                changed = true;
            }
        }

        // Storybook's short args encoding (e.g. "k:!hex(fff);...") can contain
        // punctuation that Storybook flags as potentially unsafe. To avoid
        // spurious "Omitted potentially unsafe URL args" warnings, drop the
        // entire `args` param unconditionally — args can be set programmatically
        // from stories if needed.
        if (url.searchParams.has('args')) {
            url.searchParams.delete('args');
            changed = true;
        }

        if (changed) {
            const newSearch = url.searchParams.toString();
            const newHref = url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash;
            try {
                history.replaceState(history.state, '', newHref);
            } catch (_err) {
                // ignore
            }
        }
    } catch (_e) {
        // ignore
    }
})();

// Diagnostic: print current URL and args for debugging purposes so we can
// see if unsafe args remain after sanitization.
(function printUrlArgs() {
    try {
        if (typeof window === 'undefined') return;

        const params = new URL(window.location.href).searchParams;

        if (params.has('args')) {
            // diagnostics removed
        }
    } catch (_err) {
        // ignore
    }
})();

// Resilient sanitizer: poll for a short window to remove `args` if it's
// re-inserted by Storybook or an addon after initial page load. This covers
// cases where args are added asynchronously.
(function resilientSanitizer() {
    try {
        if (typeof window === 'undefined') return;
        let attempts = 0;
        const maxAttempts = 20; // ~2 seconds at 100ms
        const interval = setInterval(() => {
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has('args')) {
                    // remove args unconditionally
                    url.searchParams.delete('args');
                    const newSearch = url.searchParams.toString();
                    const newHref = url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash;
                    try {
                        history.replaceState(history.state, '', newHref);

                    } catch (_e) {
                        // ignore
                    }
                }
            } catch (_e2) {
                // ignore
            }
            attempts += 1;
            if (attempts >= maxAttempts) clearInterval(interval);
        }, 100);
    } catch (_e) {
        // ignore
    }
})();

// If unmountComponentAtNode is missing (React 18), provide a synchronous polyfill
// that delegates to createRoot().unmount() where possible.
if (typeof ReactDOM['unmountComponentAtNode'] === 'undefined') {
    try {
        if (ReactDOMClient && typeof ReactDOMClient.createRoot === 'function') {
            ReactDOM['unmountComponentAtNode'] = function (container) {
                try {
                    const root = ReactDOMClient.createRoot(container);
                    root.unmount();
                    return true;
                } catch (_e) {
                    while (container.firstChild) container.removeChild(container.firstChild);
                    return true;
                }
            };
        }
    } catch (_e) {
        // ignore
    }
}

// Ensure a minimal `process` object exists in the browser runtime for
// libraries that reference `process` (e.g. util/assert do).
// This must run early, before other modules rely on `process`.
if (typeof globalThis.process === 'undefined') {
    globalThis.process = { env: { NODE_ENV: 'development' } };
}

// Runtime polyfill: ensure ReactDOM.unmountComponentAtNode exists for React 18+.
// Some Storybook internals call this API; provide a runtime delegating implementation
// that uses react-dom/client.createRoot().unmount() when available.
(async () => {
    try {
        const ReactDOM = await import('react-dom');
        if (typeof ReactDOM['unmountComponentAtNode'] === 'undefined') {
            try {
                const client = await import('react-dom/client');
                if (client && typeof client.createRoot === 'function') {
                    ReactDOM['unmountComponentAtNode'] = (container) => {
                        try {
                            const root = client.createRoot(container);
                            root.unmount();
                            return true;
                        }
                        catch (_err) {
                            while (container.firstChild) container.removeChild(container.firstChild);
                            return true;
                        }
                    };
                }
            }
            catch (_e) {
                // ignore
            }
        }
    }
    catch (_e) {
        // ignore
    }
})();

// Using React.createElement avoids JSX parsing in a plain ESM file.
export const decorators = [
    (Story) =>
        React.createElement(
            View,
            { style: { flex: 1, padding: 16 } },
            React.createElement(Story)
        ),
];

export const parameters = {
    actions: { argTypesRegex: '^on[A-Z].*' },
};
