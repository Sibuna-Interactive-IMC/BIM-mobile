import { fireEvent, render } from '@testing-library/react-native';
import React, { useState } from 'react';
import { TextInput } from 'react-native';

import { Portal, PortalProvider } from '@/components/Portal';

function ControlledField() {
	const [value, setValue] = useState('');
	return (
		<Portal>
			<TextInput testID='portal-input' value={value} onChangeText={setValue} />
		</Portal>
	);
}

describe('Portal', () => {
	test('reflects state changes synchronously', () => {
		const { getByTestId } = render(
			<PortalProvider>
				<ControlledField />
			</PortalProvider>
		);

		expect(getByTestId('portal-input').props.value).toBe('');

		// No timer flush here: the portal must render the new value within the
		// same commit, otherwise controlled inputs inside overlays flicker and
		// drop characters while typing.
		fireEvent(getByTestId('portal-input'), 'changeText', '1');
		expect(getByTestId('portal-input').props.value).toBe('1');

		fireEvent(getByTestId('portal-input'), 'changeText', '10000');
		expect(getByTestId('portal-input').props.value).toBe('10000');
	});

	test('unmounts its content when the child goes away', () => {
		const { getByTestId, queryByTestId, rerender } = render(
			<PortalProvider>
				<ControlledField />
			</PortalProvider>
		);

		expect(getByTestId('portal-input')).not.toBeNull();

		rerender(<PortalProvider>{null}</PortalProvider>);

		expect(queryByTestId('portal-input')).toBeNull();
	});
});
