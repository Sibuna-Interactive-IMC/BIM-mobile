import { ThemedInput } from '@/components/ThemedInput';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useThemeColor } from '@/hooks/useThemeColor';
import DateTimePicker, {
	DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import {
	Platform,
	StyleProp,
	TextStyle,
	TouchableOpacity,
	useColorScheme,
	ViewStyle,
} from 'react-native';

export type ThemedDatePickerProps = {
	label?: string;
	placeholder?: string;
	value: Date | null;
	onChange: (d: Date | null) => void;
	mode?: 'date' | 'time' | 'datetime';
	minDate?: Date;
	maxDate?: Date;
	disabled?: boolean;
	containerStyle?: StyleProp<ViewStyle>;
	labelStyle?: StyleProp<TextStyle>;
	inputStyle?: StyleProp<TextStyle>;
	displayFormat?: (d: Date) => string;
	showClearButton?: boolean;
};

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
	const [open, setOpen] = useState(false);
	useColorScheme();
	const bg = useThemeColor({}, 'background');
	const textColor = useThemeColor({}, 'text');
	const inputBackground = useThemeColor({}, 'inputBackground');
	const inputBorder = useThemeColor({}, 'inputBorder');
	const bim = useThemeColor({}, 'bim');
	const iconName = mode === 'time' ? 'clock' : 'calendar';

	const formatted = useMemo(() => {
		if (!value) return '';
		if (displayFormat) return displayFormat(value);
		// default formatting
		try {
			if (mode === 'time') return value.toLocaleTimeString();
			if (mode === 'datetime') return value.toLocaleString();
			return value.toDateString();
		} catch {
			return value.toString();
		}
	}, [value, displayFormat, mode]);

	const handleChange = (event: DateTimePickerEvent, date?: Date) => {
		// Android: modal shows confirm/cancel -> event.type is 'set' or 'dismissed'
		// iOS: inline changes fire continuously without event.type semantics
		if (Platform.OS === 'android') {
			if (event.type === 'set' && date) {
				onChange(date);
			}
			// Close regardless of set/dismissed on Android
			setOpen(false);
			return;
		}
		// iOS: commit the value live, but do not auto-close to allow adjustments
		if (date) onChange(date);
	};

	const handlePress = () => {
		if (disabled) return;
		if (Platform.OS === 'web') {
			// On web, we simply do nothing for now; could integrate a web date picker in the future
			// Alternatively, you can open a custom modal with a web-friendly picker.
			return;
		}
		setOpen(true);
	};

	return (
		<ThemedView
			lightColor={bg}
			darkColor={bg}
			style={[{ flexDirection: 'column' }, containerStyle]}
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

			<TouchableOpacity
				activeOpacity={0.8}
				onPress={handlePress}
				disabled={disabled}
			>
				<ThemedView
					lightColor={bg}
					darkColor={bg}
					style={{ position: 'relative' }}
				>
					<ThemedInput
						editable={false}
						placeholder={placeholder || label}
						value={formatted}
						setValue={() => { }}
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

					<ThemedView
						lightColor={'transparent'}
						darkColor={'transparent'}
						style={{ position: 'absolute', right: 12, top: 15, zIndex: 1 }}
						pointerEvents='none'
					>
						<IconSymbol
							name={iconName as 'clock' | 'calendar'}
							size={20}
							color={textColor}
						/>
					</ThemedView>
				</ThemedView>
			</TouchableOpacity>

			{showClearButton && !!value && (
				<ThemedView
					lightColor={bg}
					darkColor={bg}
					style={{ alignItems: 'flex-end', marginTop: 6 }}
				>
					<TouchableOpacity onPress={() => onChange(null)}>
						<ThemedText style={{ color: bim }}>Clear</ThemedText>
					</TouchableOpacity>
				</ThemedView>
			)}

			{open && Platform.OS !== 'web' && (
				<DateTimePicker
					value={value ?? new Date()}
					mode={mode === 'datetime' ? 'date' : (mode as 'date' | 'time')}
					minimumDate={minDate}
					maximumDate={maxDate}
					onChange={handleChange}
				/>
			)}
		</ThemedView>
	);
}
