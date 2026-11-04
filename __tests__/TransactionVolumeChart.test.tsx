/// <reference types="jest" />
import { render } from '@testing-library/react-native';
import React from 'react';
import { Line, Rect, Text as SvgText } from 'react-native-svg';

import TransactionVolumeChart, {
	formatTransactionVolumeTick,
	getTransactionVolumeAxis,
} from '@/components/TransactionVolumeChart';

describe('getTransactionVolumeAxis', () => {
	it('rounds the axis outwards to flat 20k ticks', () => {
		const { axisMinimum, axisMaximum, ticks } = getTransactionVolumeAxis([
			21000, 61000, 100001, 139000,
		]);

		expect(axisMinimum).toBe(0);
		expect(axisMaximum).toBe(140000);
		expect(ticks).toEqual([
			0, 20000, 40000, 60000, 80000, 100000, 120000, 140000,
		]);
	});

	it('keeps 20k ticks when refunds push the range negative', () => {
		const { axisMinimum, axisMaximum, ticks } = getTransactionVolumeAxis([
			-301000, 140000,
		]);

		expect(axisMinimum).toBe(-320000);
		expect(axisMaximum).toBe(140000);
		expect(ticks.every((tick) => tick % 20000 === 0)).toBe(true);
		expect(ticks).toContain(0);
	});
});

describe('formatTransactionVolumeTick', () => {
	it('formats every tick as a flat number of thousands', () => {
		expect(formatTransactionVolumeTick(0)).toBe('0');
		expect(formatTransactionVolumeTick(20000)).toBe('20K');
		expect(formatTransactionVolumeTick(-20000)).toBe('-20K');
		expect(formatTransactionVolumeTick(140000)).toBe('140K');
	});
});

describe('TransactionVolumeChart', () => {
	it('labels the y axis in 20k steps', () => {
		const { UNSAFE_getAllByType } = render(
			<TransactionVolumeChart
				points={[
					{ date: new Date('2026-11-01T12:00:00Z'), amount: 21000 },
					{ date: new Date('2026-11-02T12:00:00Z'), amount: 139000 },
				]}
				width={340}
				barColor='#3C82F6'
				gridColor='#ddd'
				labelColor='#828393'
			/>
		);

		const nodes = UNSAFE_getAllByType(SvgText);
		const labels = nodes.map((node: any) => String(node.props.children));

		expect(labels).toEqual(
			expect.arrayContaining([
				'0', '20K', '40K', '60K', '80K', '100K', '120K', '140K',
			])
		);
		// Axis labels must stay inside the SVG so nothing is clipped.
		nodes.forEach((node: any) => {
			expect(node.props.x).toBeGreaterThanOrEqual(0);
			expect(node.props.x).toBeLessThanOrEqual(340);
		});
	});

	it('draws lighter minor grid lines between the 20k ticks', () => {
		const { UNSAFE_getAllByType } = render(
			<TransactionVolumeChart
				points={[
					{ date: new Date('2026-11-01T12:00:00Z'), amount: 21000 },
					{ date: new Date('2026-11-02T12:00:00Z'), amount: 139000 },
				]}
				width={340}
				barColor='#3C82F6'
				gridColor='#ddd'
				labelColor='#828393'
			/>
		);

		const minorLines = UNSAFE_getAllByType(Line).filter(
			(node: any) => node.props.strokeWidth === 0.5
		);

		// 8 major ticks → 7 intervals × 3 lighter lines in between.
		expect(minorLines).toHaveLength(21);
		minorLines.forEach((node: any) =>
			expect(node.props.strokeOpacity).toBe(0.45)
		);
	});

	it('puts the bar cap at the far end of a negative bar', () => {
		const { UNSAFE_getAllByType } = render(
			<TransactionVolumeChart
				points={[
					{ date: new Date('2026-11-04T12:00:00Z'), amount: -30000 },
				]}
				width={340}
				barColor='#3C82F6'
				gridColor='#ddd'
				labelColor='#828393'
			/>
		);

		const [body, cap] = UNSAFE_getAllByType(Rect);

		expect(body.props.height as number).toBeGreaterThan(0);
		expect(cap.props.y as number).toBeCloseTo(
			(body.props.y as number) + (body.props.height as number) - 2,
			5
		);
	});
});
