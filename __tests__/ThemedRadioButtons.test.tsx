/// <reference types="jest" />
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ThemedRadioButtons } from '@/components/ThemedRadioButtons';

const options = [
	{
		key: 'auto',
		label: 'Automatic failover',
		description: 'Relworx while closed, Yo! Payments while open.',
	},
	{ key: 'relworx', label: 'Force Relworx', description: 'Always Relworx.' },
];

describe('ThemedRadioButtons', () => {
	test('renders every label and description with one selection', () => {
		const { getByText, getByRole } = render(
			<ThemedRadioButtons options={options} value='auto' onChange={jest.fn()} />
		);

		expect(getByText('Automatic failover')).toBeTruthy();
		expect(getByText('Force Relworx')).toBeTruthy();
		expect(
			getByText('Relworx while closed, Yo! Payments while open.')
		).toBeTruthy();
		expect(getByRole('radio', { name: 'Automatic failover' }).props.accessibilityState).toMatchObject(
			{ checked: true }
		);
		expect(getByRole('radio', { name: 'Force Relworx' }).props.accessibilityState).toMatchObject(
			{ checked: false }
		);
	});

	test('reports the pressed option key', () => {
		const onChange = jest.fn();
		const { getByRole } = render(
			<ThemedRadioButtons options={options} value='auto' onChange={onChange} />
		);

		fireEvent(getByRole('radio', { name: 'Force Relworx' }), 'press');

		expect(onChange).toHaveBeenCalledWith('relworx');
	});

	test('is inert while disabled', () => {
		const onChange = jest.fn();
		const { getByRole } = render(
			<ThemedRadioButtons
				options={options}
				value='auto'
				onChange={onChange}
				disabled
			/>
		);

		fireEvent(getByRole('radio', { name: 'Force Relworx' }), 'press');

		expect(onChange).not.toHaveBeenCalled();
	});
});
