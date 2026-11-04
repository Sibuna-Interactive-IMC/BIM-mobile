import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import Prompt from '../Prompt';

export default {
	title: 'Components/Prompt',
	component: Prompt,
} as ComponentMeta<typeof Prompt>;
const Template: ComponentStory<typeof Prompt> = (args: any) => (
	<Prompt {...args} />
);
export const Default = Template.bind({});
Default.args = {
	title: 'Confirm',
	message: 'Are you sure?',
	visible: true,
	onClose: () => {},
	buttons: [
		{ title: 'OK', color: '#0a7ea4', textColor: '#fff', action: () => {} },
	],
} as any;
