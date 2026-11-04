import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { Collapsible } from '../Collapsible';
import { ThemedText } from '../ThemedText';

export default {
	title: 'Components/Collapsible',
	component: Collapsible,
} as ComponentMeta<typeof Collapsible>;

const Template: ComponentStory<typeof Collapsible> = (args) => (
	<Collapsible {...args}>
		<ThemedText>Hidden content</ThemedText>
	</Collapsible>
);

export const Closed = Template.bind({});
Closed.args = { title: 'More info' } as any;

export const Open = Template.bind({});
Open.args = { title: 'More info' } as any;
