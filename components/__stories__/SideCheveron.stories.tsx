import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { SideCheveron } from '../SideCheveron';

export default {
	title: 'Components/SideCheveron',
	component: SideCheveron,
} as ComponentMeta<typeof SideCheveron>;

const Template: ComponentStory<typeof SideCheveron> = (args) => (
	<SideCheveron {...args} />
);

export const Left = Template.bind({});
Left.args = { direction: 'left', color: '#0a7ea4' } as any;

export const Right = Template.bind({});
Right.args = { direction: 'right', color: '#0a7ea4' } as any;
