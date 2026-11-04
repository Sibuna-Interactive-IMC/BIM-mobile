import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { HapticTab } from '../HapticTab';

export default {
	title: 'Components/HapticTab',
	component: HapticTab,
} as ComponentMeta<typeof HapticTab>;

const Template: ComponentStory<typeof HapticTab> = (args) => (
	<HapticTab {...(args as any)} />
);

export const Default = Template.bind({});
Default.args = {} as any;
