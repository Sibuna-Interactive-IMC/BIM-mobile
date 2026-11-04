import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import Header from '../Header';

export default {
	title: 'Components/Header',
	component: Header,
} as ComponentMeta<typeof Header>;

const Template: ComponentStory<typeof Header> = (args: any) => (
	<Header {...args} />
);

export const Default = Template.bind({});
Default.args = {
	goback: false,
	user: null,
	handleLogout: () => console.log('logout'),
	language: 'en',
	setLanguage: (l: any) => console.log('setLanguage', l),
	notifications: [],
	setNotifications: (n: any) => console.log('setNotifications', n),
	selectedOption: undefined,
	setSelectedOption: (s: any) => console.log('setSelectedOption', s),
	online: true,
	handleGoBack: () => console.log('goBack'),
} as any;
