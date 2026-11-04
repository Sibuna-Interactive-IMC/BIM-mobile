declare module '@testing-library/react-native' {
	export function render(component: any): any;
	export function fireEvent(...args: any[]): any;
	export function waitFor(fn: () => any, options?: any): Promise<any>;
}
