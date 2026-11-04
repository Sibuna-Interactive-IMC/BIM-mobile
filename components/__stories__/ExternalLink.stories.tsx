import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { ExternalLink } from '../ExternalLink';

export default {
	title: 'Components/ExternalLink',
	component: ExternalLink,
} as ComponentMeta<typeof ExternalLink>;

const Template: ComponentStory<typeof ExternalLink> = (args) => (
	<ExternalLink {...(args as any)}>Open website</ExternalLink>
);

export const Default = Template.bind({});
Default.args = { href: 'https://example.com' } as any;
