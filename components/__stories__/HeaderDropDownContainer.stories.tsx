import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import HeaderDropDownContainer from '../HeaderDropDownContainer';
import { ThemedText } from '../ThemedText';

export default {
	title: 'Components/HeaderDropDownContainer',
	component: HeaderDropDownContainer,
} as ComponentMeta<typeof HeaderDropDownContainer>;

const Template: ComponentStory<typeof HeaderDropDownContainer> = (args) => (
	<HeaderDropDownContainer {...(args as any)}>
		<ThemedText>Dropdown content</ThemedText>
	</HeaderDropDownContainer>
);

export const Visible = Template.bind({});
Visible.args = { visible: true, id: 'dd-1', fadeAnim: {} } as any;
