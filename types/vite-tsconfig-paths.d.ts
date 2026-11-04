declare module 'vite-tsconfig-paths' {
	import { Plugin } from 'vite';
	function tsconfigPaths(options?: {
		root?: string;
		projects?: string[];
		loose?: boolean;
	}): Plugin;
	export default tsconfigPaths;
}
