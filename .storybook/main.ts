// CLEAN: Single Storybook Vite config for web preview (shims aliased in viteFinal)
import { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

const config: StorybookConfig = {
	stories: ['../components/**/*.stories.@(tsx|mdx)'],
	addons: ['@storybook/addon-essentials'],
	framework: {
		name: '@storybook/react-vite',
		options: {},
	},
	docs: { autodocs: 'tag' },
	viteFinal: async (config) => {
		config.resolve = config.resolve || {};
		const existing = Array.isArray(config.resolve.alias)
			? config.resolve.alias
			: [];

		const extra = [
			// Force ThemedDatePicker to resolve to the web variant in Storybook
			{
				find: path.resolve(repoRoot, 'components', 'ThemedDatePicker.tsx'),
				replacement: path.resolve(
					repoRoot,
					'components',
					'ThemedDatePicker.web.tsx'
				),
			},
			{
				find: '@/components/ThemedDatePicker',
				replacement: path.resolve(
					repoRoot,
					'components',
					'ThemedDatePicker.web.tsx'
				),
			},
			{
				find: 'process',
				replacement: path.resolve(
					repoRoot,
					'node_modules',
					'process',
					'browser.js'
				),
			},
			{
				find: '@/context/GeneralContext',
				replacement: path.resolve(__dirname, 'shims', 'GeneralContext.js'),
			},
			{
				find: 'expo-device',
				replacement: path.resolve(__dirname, 'shims', 'expo-device-shim.js'),
			},
			{
				find: 'expo-router',
				replacement: path.resolve(__dirname, 'shims', 'expo-router-shim.js'),
			},
			{
				find: '@react-navigation/drawer',
				replacement: path.resolve(
					__dirname,
					'shims',
					'react-navigation-drawer-shim.js'
				),
			},
			{
				find: '@react-navigation/elements',
				replacement: path.resolve(
					__dirname,
					'shims',
					'react-navigation-elements-shim.js'
				),
			},
			{ find: '@', replacement: repoRoot },
			{
				find: 'expo-asset',
				replacement: path.resolve(__dirname, 'shims', 'expo-asset.js'),
			},
			{ find: /^@\/(.*)$/, replacement: repoRoot + '/$1' },
			// Map bare import to our shim and subpath imports to the shim folder so
			// imports like 'react-native/Libraries/...' resolve during Vite transform.
			{
				find: 'react-native',
				replacement: path.resolve(__dirname, 'shims', 'react-native'),
			},
			{
				find: 'warn-once',
				replacement: path.resolve(__dirname, 'shims', 'warn-once.js'),
			},
			{
				find: 'react-native-reanimated',
				replacement: path.resolve(
					__dirname,
					'shims',
					'react-native-reanimated.js'
				),
			},
			{
				find: 'react-native-svg',
				replacement: path.resolve(__dirname, 'shims', 'react-native-svg.js'),
			},
			{
				find: 'expo-blur',
				replacement: path.resolve(__dirname, 'shims', 'expo-blur.js'),
			},
			{
				find: 'react-native-gesture-handler',
				replacement: path.resolve(
					__dirname,
					'shims',
					'react-native-gesture-handler.js'
				),
			},
			{
				find: '@expo/vector-icons',
				replacement: path.resolve(
					__dirname,
					'shims',
					'expo-vector-icons-shim.js'
				),
			},
			{
				find: 'invariant',
				replacement: path.resolve(__dirname, 'shims', 'invariant.js'),
			},
			{
				find: 'react-native-safe-area-context',
				replacement: path.resolve(
					__dirname,
					'shims',
					'react-native-safe-area-context.js'
				),
			},
			// Shim native-only datetimepicker so Vite never parses its JS files
			{
				find: '@react-native-community/datetimepicker',
				replacement: path.resolve(__dirname, 'shims', 'datetimepicker.js'),
			},
			{
				find: /@react-native-community\/datetimepicker\/.*/,
				replacement: path.resolve(__dirname, 'shims', 'datetimepicker.js'),
			},
			{
				find: '@storybook/react-dom-shim',
				replacement: path.resolve(
					__dirname,
					'shims',
					'storybook-react-dom-shim.js'
				),
			},
		];

		config.resolve.alias = [...extra, ...existing];

		config.optimizeDeps = config.optimizeDeps || {};
		config.optimizeDeps.esbuildOptions =
			config.optimizeDeps.esbuildOptions || {};
		config.optimizeDeps.esbuildOptions.loader = {
			...(config.optimizeDeps.esbuildOptions.loader || {}),
			'.js': 'jsx',
			'.ts': 'ts',
			'.tsx': 'tsx',
		};

		// Ensure automatic JSX runtime so components don’t need `import React` in scope
		config.optimizeDeps.esbuildOptions.jsx = 'automatic';

		config.optimizeDeps.exclude = [
			'expo-device',
			'expo-router',
			'react-native-reanimated',
			'react-native-gesture-handler',
			'@expo/vector-icons',
			'react-native-screens',
			'react-native-safe-area-context',
			'@react-native-community/datetimepicker',
		];

		// Ensure SSR (if used by Storybook) does not attempt to bundle datetimepicker
		(config as any).ssr = (config as any).ssr || {};
		(config as any).ssr.external = [
			...(((config as any).ssr.external as string[]) || []),
			'@react-native-community/datetimepicker',
		];

		config.esbuild = config.esbuild || {};
		config.esbuild.loader = 'tsx';
		(config.esbuild as any).jsx = 'automatic';
		(config.esbuild as any).jsxImportSource = 'react';

		config.define = {
			...(config.define || {}),
			'process.env': JSON.stringify({
				NODE_ENV: 'development',
				EXPO_OS: 'web',
			}),
			process: JSON.stringify({
				env: { NODE_ENV: 'development', EXPO_OS: 'web' },
			}),
			__DEV__: JSON.stringify(true),
		};

		return config;
	},
};

export default config;
