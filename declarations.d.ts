// filepath: /Volumes/Misc/Github/swapit-mobile/declarations.d.ts
declare module '*.svg' {
	import * as React from 'react';
	import { SvgProps } from 'react-native-svg';
	const content: React.FC<SvgProps>;
	export default content;
}

// Optional dependency: expo-document-picker (runtime imported)
declare module 'expo-document-picker' {
	export function getDocumentAsync(options?: any): Promise<any>;
}
