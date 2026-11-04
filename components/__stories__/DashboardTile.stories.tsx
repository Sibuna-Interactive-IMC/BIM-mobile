import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import DashboardTile from '../DashboardTile';

export default {
	title: 'Components/DashboardTile',
	component: DashboardTile,
} as ComponentMeta<typeof DashboardTile>;

const Template: ComponentStory<typeof DashboardTile> = (args: any) => (
	<DashboardTile {...args}>Dashboard content</DashboardTile>
);

export const Default = Template.bind({});
Default.args = { id: 'tile-1' };
Default.args = { id: 'tile-1', amount: 1234.5, title: 'Balance' };
