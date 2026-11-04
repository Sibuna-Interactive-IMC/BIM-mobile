import React from 'react';
import { View } from 'react-native';

// Ensure a minimal `process` object exists in the browser runtime for
// libraries that reference `process` (e.g. util/assert do).
// This must run early, before other modules rely on `process`.
if (typeof (globalThis as any)?.process === 'undefined') {
	// Avoid TypeScript-only `as` assertions so esbuild can parse this file.
	// Use plain globalThis and optional chaining to be safe in older environments.
	((globalThis as any) ?? globalThis).process = {
		env: { NODE_ENV: 'development' },
	};
}

// Using React.createElement avoids JSX parsing in a plain .ts file.
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
