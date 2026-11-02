// Fallback for using MaterialIcons and Ionicons on Android and web.

import {
	Ionicons,
	MaterialCommunityIcons,
	MaterialIcons,
} from '@expo/vector-icons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type MaterialCommunityIconName = ComponentProps<
	typeof MaterialCommunityIcons
>['name'];
type IoniconName = ComponentProps<typeof Ionicons>['name'];

type IconConfig = {
	type: 'material' | 'ionicon' | 'material-community';
	name: MaterialIconName | IoniconName | MaterialCommunityIconName;
};

type IconMapping = Record<string, IconConfig>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons/Ionicons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see Ionicons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: IconMapping = {
	'house.fill': { type: 'ionicon', name: 'home' },
	'paperplane.fill': { type: 'ionicon', name: 'send' },
	'chevron.left.forwardslash.chevron.right': { type: 'material', name: 'code' },
	'chevron.right': { type: 'ionicon', name: 'chevron-forward' },
	'chevron.left': { type: 'ionicon', name: 'chevron-back' },
	'search.outline': { type: 'ionicon', name: 'search-outline' },
	'notifications.outline': { type: 'material-community', name: 'bell-outline' },
	'notifications.outline.badge': {
		type: 'material-community',
		name: 'bell-badge-outline',
	},
	'home.outline': { type: 'ionicon', name: 'home-outline' },
	'routers.outline': {
		type: 'material-community',
		name: 'google-circles-extended',
	},
	bank: { type: 'material-community', name: 'bank' },
	documents: {
		type: 'material-community',
		name: 'file-document-multiple-outline',
	},
	'eye.outline': {
		type: 'material-community',
		name: 'eye-outline',
	},
	'eye.fill': {
		type: 'material-community',
		name: 'eye',
	},
	'edit.outline': {
		type: 'material-community',
		name: 'pencil-outline',
	},
	'delete.outline': {
		type: 'material-community',
		name: 'delete-outline',
	},
	'delete.fill': {
		type: 'material-community',
		name: 'delete',
	},
	'password.outline': {
		type: 'material-community',
		name: 'eye-off-outline',
	},
	'password.off.outline': {
		type: 'material-community',
		name: 'eye-outline',
	},
	attachFile: { type: 'material', name: 'attach-file' },
	block: { type: 'material', name: 'block' },
	clock: { type: 'material-community', name: 'clock-outline' },
	calendar: { type: 'material-community', name: 'calendar-blank-outline' },
	monthlyCalendar: {
		type: 'material-community',
		name: 'calendar-month-outline',
	},
	key: { type: 'material-community', name: 'key' },
	menu: { type: 'material-community', name: 'menu' },
	account: { type: 'material-community', name: 'account-outline' },
	cash: { type: 'material-community', name: 'cash-multiple' },
	gateway: { type: 'material-community', name: 'credit-card-sync-outline' },
	broadcast: { type: 'material-community', name: 'bullhorn-outline' },
	'tools.outline': { type: 'material-community', name: 'wrench-outline' },
	'document-verified': { type: 'material-community', name: 'file-check-outline' },
	logout: { type: 'material-community', name: 'logout' },
	withdrawal: { type: 'material-community', name: 'credit-card-outline' },
	check: { type: 'material-community', name: 'check' },
	checkboxBlank: { type: 'material-community', name: 'checkbox-blank-outline' },
	checkboxMarked: { type: 'material-community', name: 'checkbox-marked' },
	selectMultiple: {
		type: 'material-community',
		name: 'checkbox-multiple-marked-outline',
	},
	selectAll: { type: 'material-community', name: 'select-all' },
	printer: { type: 'material-community', name: 'printer-outline' },
	doubleLeft: { type: 'material', name: 'keyboard-double-arrow-left' },
	doubleRight: { type: 'material', name: 'keyboard-double-arrow-right' },
	vouchers: { type: 'material-community', name: 'ticket-account' },
	accounts: { type: 'material-community', name: 'account-group-outline' },
	sites: { type: 'material-community', name: 'map-marker-outline' },
	analytics: { type: 'material-community', name: 'chart-bar' },
	users: { type: 'material-community', name: 'account-cog-outline' },
	transactions: { type: 'material-community', name: 'handshake' },
	translation: { type: 'material-community', name: 'translate' },
	packages: { type: 'material-community', name: 'package-variant' },
	plus: { type: 'material', name: 'add' },
	'plus.circle.fill': { type: 'material', name: 'add-circle' },
	translate: { type: 'material', name: 'translate' },
	settings: { type: 'ionicon', name: 'settings' },
	close: { type: 'ionicon', name: 'close' },
	package: { type: 'material-community', name: 'package-variant-closed' },
	info: { type: 'material-community', name: 'information-outline' },
	refresh: { type: 'material-community', name: 'refresh' }
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons/Ionicons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons or Ionicons.
 */
export function IconSymbol({
	name,
	size = 24,
	color,
	style,
}: {
	name: IconSymbolName;
	size?: number;
	color: string | OpaqueColorValue;
	style?: StyleProp<TextStyle>;
	weight?: SymbolWeight;
}) {
	const iconConfig = MAPPING[name];

	if (!iconConfig) {
		// Missing mapping: fall back to a generic icon without logging to console
		return (
			<MaterialIcons color={color} size={size} name='help' style={style} />
		);
	}

	if (iconConfig.type === 'ionicon') {
		return (
			<Ionicons
				color={color}
				size={size}
				name={iconConfig.name as IoniconName}
				style={style}
			/>
		);
	}
	if (iconConfig.type === 'material-community') {
		return (
			<MaterialCommunityIcons
				color={color}
				size={size}
				name={iconConfig.name as MaterialCommunityIconName}
				style={style}
			/>
		);
	}
	if (iconConfig.type === 'material') {
		return (
			<MaterialIcons
				color={color}
				size={size}
				name={iconConfig.name as MaterialIconName}
				style={style}
			/>
		);
	}
	return null;
}
