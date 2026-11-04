import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import OverlayContainer from '../OverlayContainer';

export default {
	title: 'Components/OverlayContainer',
	component: OverlayContainer,
} as ComponentMeta<typeof OverlayContainer>;

const Template: ComponentStory<typeof OverlayContainer> = (args: any) => (
	<OverlayContainer {...args}>Overlay content</OverlayContainer>
);

export const Default = Template.bind({});
Default.args = { showOverlay: true, position: 'center', onTouch: () => {} };
