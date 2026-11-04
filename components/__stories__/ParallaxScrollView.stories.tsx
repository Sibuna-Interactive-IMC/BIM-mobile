import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import ParallaxScrollView from '../ParallaxScrollView';

export default {
	title: 'Components/ParallaxScrollView',
	component: ParallaxScrollView,
} as ComponentMeta<typeof ParallaxScrollView>;
const Template: ComponentStory<typeof ParallaxScrollView> = (args: any) => (
	<ParallaxScrollView {...args}>
		<div style={{ height: 200 }} />
	</ParallaxScrollView>
);
export const Default = Template.bind({});
Default.args = {};
