import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { HiddenIcon } from '../PasswordIcon';

export default {
	title: 'Components/PasswordIcon',
	component: HiddenIcon,
} as ComponentMeta<typeof HiddenIcon>;
const Template: ComponentStory<typeof HiddenIcon> = (args: any) => (
	<HiddenIcon {...args} />
);
export const Default = Template.bind({});
Default.args = {};
