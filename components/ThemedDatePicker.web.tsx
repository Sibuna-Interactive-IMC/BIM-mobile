import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useMemo, useRef } from 'react';
import { TextStyle, ViewStyle } from 'react-native';

export type ThemedDatePickerProps = {
	label?: string;
	placeholder?: string;
	value: Date | null;
	onChange: (d: Date | null) => void;
	mode?: 'date' | 'time' | 'datetime';
	minDate?: Date;
	maxDate?: Date;
	disabled?: boolean;
	containerStyle?: ViewStyle;
	labelStyle?: TextStyle;
	inputStyle?: any;
	displayFormat?: (d: Date) => string;
	showClearButton?: boolean;
};

// Minimal, robust web implementation using a native HTML input overlay.
export default function ThemedDatePicker({
	label,
	placeholder,
	value,
	onChange,
	mode = 'date',
	minDate,
	maxDate,
	disabled,
	containerStyle,
	labelStyle,
	inputStyle,
	displayFormat,
	showClearButton = true,
}: ThemedDatePickerProps) {
	const bg = useThemeColor({}, 'background');
	const textColor = useThemeColor({}, 'text');
	const inputBackground = useThemeColor({}, 'inputBackground');
	const inputBorder = useThemeColor({}, 'inputBorder');

	const inputRef = useRef<HTMLInputElement | null>(null);

	const formatted = useMemo(() => {
		if (!value) return '';
		if (displayFormat) return displayFormat(value);
		try {
			if (mode === 'time') return value.toLocaleTimeString();
			if (mode === 'datetime') return value.toLocaleString();
			return value.toDateString();
		} catch {
			return value.toString();
		}
	}, [value, displayFormat, mode]);

	const htmlInputType =
		mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date';

	const toInputValue = (d: Date | null) => {
		if (!d) return '';
		if (htmlInputType === 'date') return d.toISOString().slice(0, 10);
		if (htmlInputType === 'time') return d.toTimeString().slice(0, 5);
		return d.toISOString().slice(0, 16);
	};

	const onNativeChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
		const v = ev.target.value;
		if (!v) {
			onChange(null);
			return;
		}
		if (htmlInputType === 'date') {
			onChange(new Date(v));
			return;
		}
		if (htmlInputType === 'time') {
			const [hh, mm] = v.split(':').map((s) => parseInt(s, 10));
			const base = value ?? new Date();
			const d = new Date(base);
			d.setHours(hh, mm, 0, 0);
			onChange(d);
			return;
		}
		onChange(new Date(v));
	};

	return (
		<ThemedView
			lightColor={bg}
			darkColor={bg}
			style={[
				{ flexDirection: 'column', position: 'relative' },
				containerStyle,
			]}
		>
			{label ? (
				<ThemedText
					lightColor={textColor}
					darkColor={textColor}
					style={[{ marginBottom: 8 }, labelStyle]}
				>
					{label}
				</ThemedText>
			) : null}

			<div style={{ position: 'relative' }}>
				<div onClick={() => inputRef.current?.showPicker?.()}>
					<ThemedInput
						editable={false}
						placeholder={placeholder || label}
						value={formatted}
						setValue={() => {}}
						style={[
							{
								paddingRight: 44,
								backgroundColor: inputBackground,
								borderColor: inputBorder,
								borderWidth: 1,
							},
							inputStyle,
						]}
					/>
				</div>

				<input
					ref={inputRef}
					type={htmlInputType}
					value={toInputValue(value)}
					onChange={onNativeChange}
					disabled={disabled}
					min={minDate ? toInputValue(minDate) : undefined}
					max={maxDate ? toInputValue(maxDate) : undefined}
					style={{
						position: 'absolute',
						opacity: 0,
						pointerEvents: 'all',
						inset: 0,
					}}
					aria-label={label || placeholder || 'date-picker'}
				/>
			</div>
		</ThemedView>
	);
}
