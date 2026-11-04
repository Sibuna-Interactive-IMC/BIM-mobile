import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import DrawerHeader from '../DrawerHeader';

export default {
	title: 'Components/DrawerHeader',
	component: DrawerHeader,
} as ComponentMeta<typeof DrawerHeader>;

const mockNavigation = {
	toggleDrawer: () => {
		console.log('mock toggleDrawer called');
	},
};

const Template: ComponentStory<typeof DrawerHeader> = (args) => (
	<div style={{ width: 360 }}>
		<DrawerHeader {...(args as any)} navigation={mockNavigation} />
	</div>
);

export const Default = Template.bind({});
Default.args = {} as any;
