import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import Loader from '../Loader';

export default {
	title: 'Components/Loader',
	component: Loader,
} as ComponentMeta<typeof Loader>;

const Template: ComponentStory<typeof Loader> = (args: any) => (
	<Loader {...args} />
);

export const Default = Template.bind({});
Default.args = {
	showOverlay: true,
	fadeAnim: {
		/* mock Animated.Value-ish object for story */
	} as any,
	toggleShowOverlay: () => {},
};
