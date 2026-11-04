import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { Text } from 'react-native';
import TileContainer from '../TileContainer';

export default {
	title: 'Components/TileContainer',
	component: TileContainer,
} as ComponentMeta<typeof TileContainer>;

const Template: ComponentStory<typeof TileContainer> = (args: any) => (
	<TileContainer {...args}>
		<Text>Tile content</Text>
	</TileContainer>
);

export const Default = Template.bind({});
Default.args = {
	id: 'example',
};
