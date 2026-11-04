import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { ThemedInput } from '../ThemedInput';

export default {
	title: 'Components/ThemedInput',
	component: ThemedInput,
} as ComponentMeta<typeof ThemedInput>;

const Template: ComponentStory<typeof ThemedInput> = (args) => (
	<ThemedInput {...args} />
);

export const Default = Template.bind({});
Default.args = {
	placeholder: 'Type here',
};
