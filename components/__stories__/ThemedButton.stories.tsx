import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { ThemedButton } from '../ThemedButton';

export default {
	title: 'Components/ThemedButton',
	component: ThemedButton,
} as ComponentMeta<typeof ThemedButton>;

const Template: ComponentStory<typeof ThemedButton> = (args) => (
	<ThemedButton {...args} />
);

export const Default = Template.bind({});
Default.args = {
	title: 'Tap me',
	onPress: () => {},
};
