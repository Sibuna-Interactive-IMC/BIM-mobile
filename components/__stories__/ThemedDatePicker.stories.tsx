import ThemedDatePicker from '@/components/ThemedDatePicker';
import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

const meta: Meta<typeof ThemedDatePicker> = {
	title: 'Components/ThemedDatePicker',
	component: ThemedDatePicker,
};

export default meta;

type Story = StoryObj<typeof ThemedDatePicker>;

const Controlled = (args: React.ComponentProps<typeof ThemedDatePicker>) => {
	const [value, setValue] = React.useState<Date | null>(args.value ?? null);

	return (
		<div
			style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}
		>
			<ThemedDatePicker
				{...args}
				value={value}
				onChange={(d) => {
					setValue(d);
					if (typeof args.onChange === 'function') args.onChange(d);
				}}
			/>
		</div>
	);
};

export const DateMode: Story = {
	args: {
		label: 'Select date',
		placeholder: 'Pick a date',
		mode: 'date',
	},
	render: (args) => <Controlled {...args} />,
};

export const TimeMode: Story = {
	args: {
		label: 'Select time',
		placeholder: 'Pick a time',
		mode: 'time',
	},
	render: (args) => <Controlled {...args} />,
};

export const DateTimeMode: Story = {
	args: {
		label: 'Select date & time',
		placeholder: 'Pick date & time',
		mode: 'datetime',
	},
	render: (args) => <Controlled {...args} />,
};
