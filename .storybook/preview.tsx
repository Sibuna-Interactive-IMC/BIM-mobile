import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

class StoryErrorBoundary extends React.Component<
	any,
	{ hasError: boolean; error?: Error }
> {
	constructor(props: any) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: any) {
		// you can integrate with Sentry or log here
		// For Storybook keep it local and visible in the console
		console.error('Storybook caught error in story:', error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={{ padding: 20, fontFamily: 'sans-serif' }}>
					<h3>Story failed to render</h3>
					<p>
						This story threw an error while rendering. The error has been logged
						to the console.
					</p>
					<details style={{ whiteSpace: 'pre-wrap' }}>
						{String(this.state.error)}
					</details>
				</div>
			);
		}
		return this.props.children as React.ReactNode;
	}
}
export const decorators = [
	(Story: any) => (
		<StoryErrorBoundary>
			<SafeAreaProvider>
				<Story />
			</SafeAreaProvider>
		</StoryErrorBoundary>
	),
];

export const parameters = {
	actions: { argTypesRegex: '^on[A-Z].*' },
};
