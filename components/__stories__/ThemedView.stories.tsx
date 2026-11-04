import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import { ThemedView } from '../ThemedView';

export default {
	title: 'Components/ThemedView',
	component: ThemedView,
} as ComponentMeta<typeof ThemedView>;

const Template: ComponentStory<typeof ThemedView> = (args) => (
	<ThemedView {...args}>
		<View style={{ height: 100, width: 100, backgroundColor: '#eee' }} />
	</ThemedView>
);

export const Default = Template.bind({});
Default.args = {};
