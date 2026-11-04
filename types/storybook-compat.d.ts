// Compatibility shims for Storybook story typings used in older stories
// This file provides lightweight aliases so existing stories importing
// `ComponentMeta` and `ComponentStory` type names type-check under
// Storybook v8 without changing every story file.

import type { ReactElement } from 'react';

declare module '@storybook/react' {
	// Keep these as permissive types to avoid blocking the TS build
	// while we migrate stories to newer Storybook typings.
	export type ComponentMeta<T = any> = any;
	// Provide a callable interface compatible with older Storybook patterns
	// (Template functions with `.args` and `.bind`). This keeps stories
	// compiling while we migrate to Storybook v8 typings.
	export interface ComponentStory<T = any> {
		(args: any): ReactElement | null;
		args?: any;
		bind(thisArg: any): ComponentStory<T>;
	}
}
