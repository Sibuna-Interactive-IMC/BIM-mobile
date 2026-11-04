import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { HelloWave } from '../HelloWave';

export default {
	title: 'Components/HelloWave',
	component: HelloWave,
} as ComponentMeta<typeof HelloWave>;

const Template: ComponentStory<typeof HelloWave> = (args) => (
	<HelloWave {...(args as any)} />
);

export const Default = Template.bind({});
Default.args = {} as any;
