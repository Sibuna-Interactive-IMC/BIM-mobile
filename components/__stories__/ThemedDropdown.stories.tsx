import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { ThemedDropdown } from '../ThemedDropdown';

export default {
	title: 'Components/ThemedDropdown',
	component: ThemedDropdown,
} as ComponentMeta<typeof ThemedDropdown>;

const Template: ComponentStory<typeof ThemedDropdown> = (args) => {
	const containerRef = React.useRef<any>(null);
	const [value, setValue] = React.useState(args.value ?? '');
	const [showDropdown, setShowDropdown] = React.useState(false);

	return (
		<div style={{ width: 320 }}>
			<ThemedDropdown
				{...args}
				containerRef={containerRef}
				value={value}
				setValue={(v: any) => {
					setValue(v);
					if (typeof args.setValue === 'function') args.setValue(v);
				}}
				showDropdown={showDropdown}
				setShowDropdown={setShowDropdown}
				options={args.options ?? ['Option A', 'Option B', 'Option C']}
			/>
		</div>
	);
};

export const Default = Template.bind({});
Default.args = {
	placeholder: 'Select',
	options: ['Option A', 'Option B', 'Option C'],
	multiselect: false,
};
