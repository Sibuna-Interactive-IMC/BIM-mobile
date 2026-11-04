import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { ThemedText } from '../ThemedText';

export default {
	title: 'Components/ThemedText',
	component: ThemedText,
} as ComponentMeta<typeof ThemedText>;

const Template: ComponentStory<typeof ThemedText> = (args) => (
	<ThemedText {...args}>Sample text</ThemedText>
);

export const Default = Template.bind({});
Default.args = {
	type: 'default',
};
