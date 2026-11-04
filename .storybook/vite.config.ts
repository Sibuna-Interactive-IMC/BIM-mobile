import path from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
	plugins: [tsconfigPaths({ root: repoRoot })],
	resolve: {
		alias: [
			// Force ThemedDatePicker to resolve to the web variant in Storybook,
			// even if tsconfigPaths resolves an absolute file first.
			{
				find: path.resolve(repoRoot, 'components', 'ThemedDatePicker.tsx'),
				replacement: path.resolve(
					repoRoot,
					'components',
					'ThemedDatePicker.web.tsx'
				),
			},
			{
				find: path.resolve(repoRoot, 'components', 'ThemedDatePicker'),
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
			// Explicit per-file aliases (deterministic)
			{
				find: '@/components/ThemedText',
				replacement: path.resolve(repoRoot, 'components', 'ThemedText.tsx'),
			},
			{
				find: '@/components/ThemedView',
				replacement: path.resolve(repoRoot, 'components', 'ThemedView.tsx'),
			},
			{
				find: '@/components/ui/IconSymbol',
				replacement: path.resolve(
					repoRoot,
					'components',
					'ui',
					'IconSymbol.tsx'
				),
			},
			{
				find: '@/constants/Colors',
				replacement: path.resolve(repoRoot, 'constants', 'Colors.ts'),
			},
			{
				find: '@/hooks/useColorScheme',
				replacement: path.resolve(repoRoot, 'hooks', 'useColorScheme.ts'),
			},
			{
				find: '@/hooks/useThemeColor',
				replacement: path.resolve(repoRoot, 'hooks', 'useThemeColor.ts'),
			},

			// Direct alias for '@' to repository root
			{ find: '@', replacement: repoRoot },

			// Fallback regex: map any @/path to the repository root
			{ find: /^@\/(.*)$/, replacement: repoRoot + '/$1' },

			// Native module shims for web
			{
				find: 'react-native-reanimated',
				replacement: path.resolve(
					__dirname,
					'shims/react-native-reanimated.js'
				),
			},
			{
				find: 'react-native-gesture-handler',
				replacement: path.resolve(
					__dirname,
					'shims/react-native-gesture-handler.js'
				),
			},
			{
				find: 'react-native-safe-area-context',
				replacement: path.resolve(
					__dirname,
					'shims/react-native-safe-area-context.js'
				),
			},
			{
				find: 'react-native-screens',
				replacement: path.resolve(__dirname, 'shims/react-native-screens.js'),
			},
			{
				find: 'expo-constants',
				replacement: path.resolve(__dirname, 'shims/expo-constants.js'),
			},
			{
				find: '@react-native-community/datetimepicker',
				replacement: path.resolve(__dirname, 'shims/datetimepicker.js'),
			},
			{
				find: /@react-native-community\/datetimepicker\/.*/,
				replacement: path.resolve(__dirname, 'shims/datetimepicker.js'),
			},
		],
		extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
	},
	// Prevent Vite from trying to prebundle datetimepicker (contains TS-only syntax in .js)
	optimizeDeps: {
		exclude: ['@react-native-community/datetimepicker'],
	},
	// Also ensure SSR build does not attempt to process it
	ssr: {
		external: ['@react-native-community/datetimepicker'],
	},
});
