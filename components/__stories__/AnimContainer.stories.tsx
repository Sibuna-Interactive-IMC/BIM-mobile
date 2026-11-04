import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import AnimContainer from '../AnimContainer';
import { ThemedText } from '../ThemedText';

export default {
	title: 'Components/AnimContainer',
	component: AnimContainer,
} as ComponentMeta<typeof AnimContainer>;

const Template: ComponentStory<typeof AnimContainer> = (args) => (
	<AnimContainer {...(args as any)}>
		<ThemedText>Animated content</ThemedText>
	</AnimContainer>
);

export const Default = Template.bind({});
Default.args = {} as any;
