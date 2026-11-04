import qrcodeFactory from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * Renders a QR code with `react-native-svg` (Expo ships the SVG renderer), so
 * no Node/canvas based QR package needs to be bundled.
 */
export default function QrCode({
	value,
	size = 120,
	color = '#000000',
	backgroundColor = '#FFFFFF',
	quietZone = 2,
}: {
	value: string;
	size?: number;
	color?: string;
	backgroundColor?: string;
	/** Light margin around the matrix, in modules. */
	quietZone?: number;
}) {
	const { path, total } = useMemo(() => {
		const qr = qrcodeFactory(0, 'M');
		qr.addData(value);
		qr.make();
		const count = qr.getModuleCount();
		let d = '';
		for (let row = 0; row < count; row += 1) {
			for (let col = 0; col < count; col += 1) {
				if (!qr.isDark(row, col)) continue;
				d += `M${col + quietZone} ${row + quietZone}h1v1h-1z`;
			}
		}
		return { path: d, total: count + quietZone * 2 };
	}, [value, quietZone]);

	return (
		<Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
			<Rect
				x={0}
				y={0}
				width={total}
				height={total}
				fill={backgroundColor}
			/>
			<Path d={path} fill={color} />
		</Svg>
	);
}
