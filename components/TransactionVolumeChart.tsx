import { G, Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

export const TRANSACTION_VOLUME_STEP = 20_000;

const LABEL_FONT_SIZE = 10;
const TOP_PADDING = 14;
const X_AXIS_LABEL_HEIGHT = 22;
const MIN_TICK_SPACING = 16;
const MINOR_LINES_PER_TICK = 4;
const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

export type TransactionVolumePoint = {
	date: Date;
	amount: number;
};

/** Axis bounds rounded outwards to flat `TRANSACTION_VOLUME_STEP` ticks. */
export function getTransactionVolumeAxis(amounts: number[]) {
	const finite = amounts.filter((amount) => Number.isFinite(amount));
	const axisMinimum =
		Math.floor(Math.min(0, ...finite) / TRANSACTION_VOLUME_STEP) *
		TRANSACTION_VOLUME_STEP;
	const axisMaximum = Math.max(
		TRANSACTION_VOLUME_STEP,
		Math.ceil(Math.max(0, ...finite) / TRANSACTION_VOLUME_STEP) *
			TRANSACTION_VOLUME_STEP
	);
	const ticks: number[] = [];
	for (
		let tick = axisMinimum;
		tick <= axisMaximum;
		tick += TRANSACTION_VOLUME_STEP
	) {
		ticks.push(tick);
	}
	return { axisMinimum, axisMaximum, ticks };
}

export function formatTransactionVolumeTick(value: number) {
	if (value === 0) return '0';
	return `${Math.round(value / 1000)}K`;
}

function formatDayLabel(date: Date) {
	const month = MONTH_LABELS[date.getMonth()] ?? '';
	return `${date.getDate()} ${month}`.trim();
}

type Props = {
	points: TransactionVolumePoint[];
	width: number;
	minHeight?: number;
	barColor: string;
	gridColor: string;
	labelColor: string;
};

export default function TransactionVolumeChart({
	points,
	width,
	minHeight = 220,
	barColor,
	gridColor,
	labelColor,
}: Props) {
	const { axisMinimum, axisMaximum, ticks } = getTransactionVolumeAxis(
		points.map((point) => point.amount)
	);
	const tickLabels = ticks.map(formatTransactionVolumeTick);
	const height = Math.max(
		minHeight,
		TOP_PADDING + X_AXIS_LABEL_HEIGHT + (ticks.length - 1) * MIN_TICK_SPACING
	);
	const plotTop = TOP_PADDING;
	const plotBottom = height - X_AXIS_LABEL_HEIGHT;
	const plotHeight = plotBottom - plotTop;
	const widestLabel = tickLabels.reduce(
		(longest, label) => Math.max(longest, label.length),
		0
	);
	const gutter = Math.ceil(widestLabel * LABEL_FONT_SIZE * 0.62) + 12;
	const plotLeft = gutter;
	const plotRight = width - 4;
	const slot = (plotRight - plotLeft) / Math.max(points.length, 1);
	const barWidth = Math.max(6, Math.min(slot * 0.55, 32));
	const range = axisMaximum - axisMinimum || 1;
	const yFor = (value: number) =>
		plotTop + ((axisMaximum - value) / range) * plotHeight;
	const zeroY = yFor(0);
	const minorTicks: number[] = [];
	for (let tick = axisMinimum; tick < axisMaximum; tick += TRANSACTION_VOLUME_STEP) {
		for (let part = 1; part < MINOR_LINES_PER_TICK; part += 1) {
			minorTicks.push(
				tick + (TRANSACTION_VOLUME_STEP / MINOR_LINES_PER_TICK) * part
			);
		}
	}

	return (
		<Svg testID='transaction-volume-chart' width={width} height={height}>
			{minorTicks.map((tick) => (
				<Line
					key={`minor-${tick}`}
					x1={plotLeft}
					x2={plotRight}
					y1={yFor(tick)}
					y2={yFor(tick)}
					stroke={gridColor}
					strokeOpacity={0.45}
					strokeWidth={0.5}
				/>
			))}
			{ticks.map((tick, index) => (
				<G key={tick}>
					<Line
						x1={plotLeft}
						x2={plotRight}
						y1={yFor(tick)}
						y2={yFor(tick)}
						stroke={gridColor}
						strokeWidth={1}
					/>
					<SvgText
						x={plotLeft - 8}
						y={yFor(tick) + 3.5}
						fontSize={LABEL_FONT_SIZE}
						fill={labelColor}
						textAnchor='end'
					>
						{tickLabels[index]}
					</SvgText>
				</G>
			))}
			<Line
				x1={plotLeft}
				x2={plotRight}
				y1={zeroY}
				y2={zeroY}
				stroke={labelColor}
				strokeOpacity={0.45}
				strokeWidth={1}
			/>
			{points.map((point, index) => {
				const center = plotLeft + slot * (index + 0.5);
				const valueY = yFor(point.amount);
				const top = point.amount >= 0 ? valueY : zeroY;
				const bottom = point.amount >= 0 ? zeroY : valueY;
				const barHeight = Math.max(bottom - top, 0);
				const capY = point.amount >= 0 ? top : Math.max(top, bottom - 2);
				return (
					<G key={`${point.date.toISOString()}-${index}`}>
						{barHeight > 0 ? (
							<>
								<Rect
									x={center - barWidth / 2}
									y={top}
									width={barWidth}
									height={barHeight}
									rx={2}
									fill={barColor}
									fillOpacity={0.35}
								/>
								<Rect
									x={center - barWidth / 2}
									y={capY}
									width={barWidth}
									height={2}
									fill={barColor}
								/>
							</>
						) : null}
						<SvgText
							x={center}
							y={height - 6}
							fontSize={LABEL_FONT_SIZE}
							fill={labelColor}
							textAnchor='middle'
						>
							{formatDayLabel(point.date)}
						</SvgText>
					</G>
				);
			})}
		</Svg>
	);
}
