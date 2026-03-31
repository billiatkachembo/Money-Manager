import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export interface ChartTick {
  index: number;
  label: string;
}

export interface LineChartSeries {
  key: string;
  values: number[];
  color: string;
  strokeWidth?: number;
  dashed?: boolean;
  smooth?: boolean;
  fillColor?: string;
  showDots?: boolean;
  dotRadius?: number;
  dotFill?: string;
  dotStroke?: string;
  activeIndex?: number | null;
  activeRadius?: number;
  activeFill?: string;
  activeStroke?: string;
  opacity?: number;
}

interface FinanceLineChartProps {
  width: number;
  height: number;
  domain: [number, number];
  ticks: ChartTick[];
  series: LineChartSeries[];
  gridColor: string;
  labelColor: string;
  zeroLineColor?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
  showAxisLabels?: boolean;
  onSelectIndex?: (index: number) => void;
}

export interface GroupedBarEntry {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net?: number;
}

interface FinanceGroupedBarChartProps {
  width: number;
  height: number;
  domain: [number, number];
  entries: GroupedBarEntry[];
  incomeColor: string;
  expenseColor: string;
  lineColor?: string;
  gridColor: string;
  labelColor: string;
  zeroLineColor?: string;
  focusedKey?: string | null;
  onSelect?: (key: string) => void;
  showNetLine?: boolean;
  padding?: { top: number; right: number; bottom: number; left: number };
  showAxisLabels?: boolean;
}

export interface VerticalBarEntry {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface FinanceVerticalBarChartProps {
  width: number;
  height: number;
  domain: [number, number];
  entries: VerticalBarEntry[];
  gridColor: string;
  labelColor: string;
  benchmarkValue?: number;
  benchmarkColor?: string;
  focusedKey?: string | null;
  onSelect?: (key: string) => void;
  padding?: { top: number; right: number; bottom: number; left: number };
  showAxisLabels?: boolean;
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface FinanceDonutChartProps {
  size: number;
  slices: DonutSlice[];
  focusedKey?: string | null;
  onSelect?: (key: string) => void;
  ringThickness?: number;
  trackColor?: string;
  centerColor?: string;
  labelColor?: string;
  variant?: 'donut' | 'pie';
  showCallouts?: boolean;
}

const DEFAULT_PADDING = { top: 18, right: 16, bottom: 34, left: 16 };
const LABEL_WIDTH = 58;
const PIE_LABEL_WIDTH = 92;
const Y_AXIS_WIDTH = 36;

function formatAxisTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000000) {
    const compact = Math.round((value / 1000000) * 10) / 10;
    return `${compact}`.replace(/\.0$/, '') + 'M';
  }
  if (abs >= 10000) {
    return `${Math.round(value / 1000)}k`;
  }
  if (abs >= 1000) {
    const compact = Math.round((value / 100) ) / 10;
    return `${compact}`.replace(/\.0$/, '') + 'k';
  }
  return `${Math.round(value)}`;
}

function getYAxisTickValues(domain: [number, number]): number[] {
  const [min, max] = domain;
  if (max === min) {
    return [max];
  }

  const ticks = min < 0 && max > 0 ? [max, 0, min] : [max, (max + min) / 2, min];
  const unique: number[] = [];
  for (const tick of ticks) {
    if (!unique.some((value) => Math.abs(value - tick) < 0.0001)) {
      unique.push(tick);
    }
  }
  return unique;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getChartMetrics(
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number }
) {
  const plotLeft = padding.left;
  const plotTop = padding.top;
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);

  return {
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
  };
}

function getX(index: number, count: number, plotLeft: number, plotWidth: number): number {
  if (count <= 1) {
    return plotLeft + plotWidth / 2;
  }

  return plotLeft + (plotWidth * index) / (count - 1);
}

function getGroupX(index: number, count: number, plotLeft: number, plotWidth: number): number {
  if (count <= 0) {
    return plotLeft;
  }

  return plotLeft + ((index + 0.5) * plotWidth) / count;
}

function getY(value: number, domain: [number, number], plotTop: number, plotHeight: number): number {
  const [min, max] = domain;
  if (max === min) {
    return plotTop + plotHeight / 2;
  }

  const ratio = (value - min) / (max - min);
  return plotTop + plotHeight - ratio * plotHeight;
}

function buildLinearLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return '';
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    commands.push(`C ${midX} ${previous.y}, ${midX} ${current.y}, ${current.x} ${current.y}`);
  }

  return commands.join(' ');
}

function buildLinePath(points: Array<{ x: number; y: number }>, smooth: boolean = true): string {
  return smooth ? buildSmoothLinePath(points) : buildLinearLinePath(points);
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number, smooth: boolean): string {
  if (points.length === 0) {
    return '';
  }

  const start = points[0];
  const end = points[points.length - 1];
  const linePath = smooth ? buildSmoothLinePath(points).replace(/^M [^ ]+ [^ ]+/, `L ${start.x} ${start.y}`) : points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ');
  return [
    `M ${start.x} ${baselineY}`,
    `L ${start.x} ${start.y}`,
    linePath,
    `L ${end.x} ${baselineY}`,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function buildDonutSegmentPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function buildPieSegmentPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function getAbsoluteLabelLeft(centerX: number, width: number, labelWidth: number = LABEL_WIDTH): number {
  return clamp(centerX - labelWidth / 2, 0, Math.max(width - labelWidth, 0));
}

function formatSliceShare(value: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }
  const percent = (value / total) * 100;
  return percent >= 10 ? `${Math.round(percent)}%` : `${(Math.round(percent * 10) / 10).toFixed(1)}%`;
}

export function FinanceLineChart({
  width,
  height,
  domain,
  ticks,
  series,
  gridColor,
  labelColor,
  zeroLineColor,
  padding = DEFAULT_PADDING,
  showAxisLabels = true,
  onSelectIndex,
}: FinanceLineChartProps) {
  const { plotLeft, plotTop, plotWidth, plotHeight } = getChartMetrics(width, height, padding);
  const maxLength = Math.max(0, ...series.map((entry) => entry.values.length));
  const baselineValue = domain[0] <= 0 && domain[1] >= 0 ? 0 : domain[0];
  const baselineY = getY(baselineValue, domain, plotTop, plotHeight);

  const tickPositions = useMemo(
    () =>
      ticks.map((tick) => ({
        label: tick.label,
        left: getAbsoluteLabelLeft(getX(tick.index, maxLength, plotLeft, plotWidth), width),
      })),
    [maxLength, plotLeft, plotWidth, ticks, width]
  );

  const gridLines = useMemo(
    () => Array.from({ length: 4 }, (_, index) => plotTop + plotHeight * (index / 3)),
    [plotHeight, plotTop]
  );
  const yAxisTickValues = useMemo(() => getYAxisTickValues(domain), [domain]);
  const yAxisLabels = useMemo(
    () =>
      yAxisTickValues.map((value) => ({
        value,
        label: formatAxisTick(value),
        top: getY(value, domain, plotTop, plotHeight) - 7,
      })),
    [domain, plotHeight, plotTop, yAxisTickValues]
  );

  return (
    <View style={[styles.chartWrap, { width, height }]}> 
      <Svg width={width} height={height}>
        <Line
          x1={plotLeft}
          x2={plotLeft}
          y1={plotTop}
          y2={plotTop + plotHeight}
          stroke={gridColor}
          strokeWidth={1}
        />
        <Line
          x1={plotLeft}
          x2={plotLeft + plotWidth}
          y1={plotTop + plotHeight}
          y2={plotTop + plotHeight}
          stroke={gridColor}
          strokeWidth={1}
        />
        {gridLines.map((y, index) => (
          <Line
            key={`grid-${index}`}
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={y}
            y2={y}
            stroke={gridColor}
            strokeDasharray={index === 3 ? undefined : '4 6'}
            strokeWidth={1}
          />
        ))}
        {zeroLineColor && domain[0] < 0 && domain[1] > 0 ? (
          <Line
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={baselineY}
            y2={baselineY}
            stroke={zeroLineColor}
            strokeDasharray="5 5"
            strokeWidth={1}
          />
        ) : null}
        {series.map((entry) => {
          const points = entry.values.map((value, index) => ({
            x: getX(index, maxLength, plotLeft, plotWidth),
            y: getY(value, domain, plotTop, plotHeight),
          }));
          const smoothPath = entry.smooth ?? true;
          const path = buildLinePath(points, smoothPath);
          const areaPath = entry.fillColor ? buildAreaPath(points, baselineY, smoothPath) : '';

          return (
            <React.Fragment key={entry.key}>
              {entry.fillColor && areaPath ? <Path d={areaPath} fill={entry.fillColor} opacity={0.18} /> : null}
              {path ? (
                <Path
                  d={path}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={entry.strokeWidth ?? 2}
                  strokeDasharray={entry.dashed ? '5 5' : undefined}
                  opacity={entry.opacity ?? 1}
                />
              ) : null}
              {entry.showDots
                ? points.map((point, index) => {
                    const isActive = entry.activeIndex === index;
                    return (
                      <Circle
                        key={`${entry.key}-dot-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={isActive ? entry.activeRadius ?? 4.6 : entry.dotRadius ?? 3}
                        fill={isActive ? entry.activeFill ?? entry.color : entry.dotFill ?? entry.color}
                        stroke={isActive ? entry.activeStroke ?? '#FFFFFF' : entry.dotStroke ?? '#FFFFFF'}
                        strokeWidth={isActive ? 2 : 1.4}
                        opacity={entry.opacity ?? 1}
                        onPress={onSelectIndex ? () => onSelectIndex(index) : undefined}
                      />
                    );
                  })
                : null}
            </React.Fragment>
          );
        })}
      </Svg>
      {showAxisLabels
        ? tickPositions.map((tick, index) => (
            <Text
              key={`${tick.label}-${index}`}
              style={[
                styles.axisLabel,
                {
                  color: labelColor,
                  left: tick.left,
                  top: plotTop + plotHeight + 6,
                  width: LABEL_WIDTH,
                },
              ]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))
        : null}
      {showAxisLabels
        ? yAxisLabels.map((tick, index) => (
            <Text
              key={`y-${tick.value}-${index}`}
              style={[
                styles.yAxisLabel,
                {
                  color: labelColor,
                  left: 0,
                  top: tick.top,
                  width: Math.max(plotLeft - 4, Y_AXIS_WIDTH),
                },
              ]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))
        : null}
    </View>
  );
}

export function FinanceGroupedBarChart({
  width,
  height,
  domain,
  entries,
  incomeColor,
  expenseColor,
  lineColor,
  gridColor,
  labelColor,
  zeroLineColor,
  focusedKey,
  onSelect,
  showNetLine = true,
  padding = DEFAULT_PADDING,
  showAxisLabels = true,
}: FinanceGroupedBarChartProps) {
  const { plotLeft, plotTop, plotWidth, plotHeight } = getChartMetrics(width, height, padding);
  const zeroY = getY(domain[0] <= 0 && domain[1] >= 0 ? 0 : domain[0], domain, plotTop, plotHeight);
  const groupWidth = entries.length > 0 ? plotWidth / entries.length : plotWidth;
  const barWidth = Math.min(24, Math.max(12, groupWidth * 0.38));
  const barGap = Math.max(1.5, groupWidth * 0.018);
  const gridLines = Array.from({ length: 4 }, (_, index) => plotTop + plotHeight * (index / 3));
  const linePoints = entries.map((entry, index) => ({
    key: entry.key,
    x: getGroupX(index, entries.length, plotLeft, plotWidth),
    y: getY(entry.net ?? 0, domain, plotTop, plotHeight),
  }));
  const linePath = showNetLine ? buildLinePath(linePoints) : '';
  const tickPositions = entries.map((entry, index) => ({
    label: entry.label,
    left: getAbsoluteLabelLeft(getGroupX(index, entries.length, plotLeft, plotWidth), width),
  }));
  const yAxisLabels = getYAxisTickValues(domain).map((value) => ({
    value,
    label: formatAxisTick(value),
    top: getY(value, domain, plotTop, plotHeight) - 7,
  }));

  return (
    <View style={[styles.chartWrap, { width, height }]}> 
      <Svg width={width} height={height}>
        <Line
          x1={plotLeft}
          x2={plotLeft}
          y1={plotTop}
          y2={plotTop + plotHeight}
          stroke={gridColor}
          strokeWidth={1}
        />
        <Line
          x1={plotLeft}
          x2={plotLeft + plotWidth}
          y1={plotTop + plotHeight}
          y2={plotTop + plotHeight}
          stroke={gridColor}
          strokeWidth={1}
        />
        {gridLines.map((y, index) => (
          <Line
            key={`grid-${index}`}
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={y}
            y2={y}
            stroke={gridColor}
            strokeDasharray={index === 3 ? undefined : '4 6'}
            strokeWidth={1}
          />
        ))}
        {zeroLineColor && domain[0] < 0 && domain[1] > 0 ? (
          <Line
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={zeroY}
            y2={zeroY}
            stroke={zeroLineColor}
            strokeDasharray="5 5"
            strokeWidth={1}
          />
        ) : null}
        {entries.map((entry, index) => {
          const centerX = getGroupX(index, entries.length, plotLeft, plotWidth);
          const incomeY = getY(entry.income, domain, plotTop, plotHeight);
          const expenseY = getY(entry.expenses, domain, plotTop, plotHeight);
          const isFocused = !focusedKey || focusedKey === entry.key;

          return (
            <React.Fragment key={entry.key}>
              <Rect
                x={centerX - barGap / 2 - barWidth}
                y={Math.min(incomeY, zeroY)}
                width={barWidth}
                height={Math.max(Math.abs(zeroY - incomeY), 2)}
                rx={7}
                fill={incomeColor}
                opacity={isFocused ? 1 : 0.32}
                onPress={onSelect ? () => onSelect(entry.key) : undefined}
              />
              <Rect
                x={centerX + barGap / 2}
                y={Math.min(expenseY, zeroY)}
                width={barWidth}
                height={Math.max(Math.abs(zeroY - expenseY), 2)}
                rx={7}
                fill={expenseColor}
                opacity={isFocused ? 1 : 0.32}
                onPress={onSelect ? () => onSelect(entry.key) : undefined}
              />
            </React.Fragment>
          );
        })}
        {showNetLine && linePath ? (
          <Path d={linePath} fill="none" stroke={lineColor ?? '#94A3B8'} strokeWidth={2.1} opacity={0.94} />
        ) : null}
        {showNetLine
          ? linePoints.map((point) => {
              const isFocused = !focusedKey || focusedKey === point.key;
              return (
                <Circle
                  key={`net-${point.key}`}
                  cx={point.x}
                  cy={point.y}
                  r={focusedKey === point.key ? 4.5 : 3}
                  fill={lineColor ?? '#94A3B8'}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  opacity={isFocused ? 1 : 0.44}
                  onPress={onSelect ? () => onSelect(point.key) : undefined}
                />
              );
            })
          : null}
      </Svg>
      {showAxisLabels
        ? tickPositions.map((tick, index) => (
            <Text
              key={`${tick.label}-${index}`}
              style={[
                styles.axisLabel,
                {
                  color: labelColor,
                  left: tick.left,
                  top: plotTop + plotHeight + 6,
                  width: LABEL_WIDTH,
                },
              ]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))
        : null}
      {showAxisLabels
        ? yAxisLabels.map((tick, index) => (
            <Text
              key={`y-${tick.value}-${index}`}
              style={[
                styles.yAxisLabel,
                {
                  color: labelColor,
                  left: 0,
                  top: tick.top,
                  width: Math.max(plotLeft - 4, Y_AXIS_WIDTH),
                },
              ]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))
        : null}
    </View>
  );
}

export function FinanceVerticalBarChart({
  width,
  height,
  domain,
  entries,
  gridColor,
  labelColor,
  benchmarkValue,
  benchmarkColor,
  focusedKey,
  onSelect,
  padding = DEFAULT_PADDING,
  showAxisLabels = true,
}: FinanceVerticalBarChartProps) {
  const { plotLeft, plotTop, plotWidth, plotHeight } = getChartMetrics(width, height, padding);
  const groupWidth = entries.length > 0 ? plotWidth / entries.length : plotWidth;
  const barWidth = Math.min(24, Math.max(12, groupWidth * 0.5));
  const zeroY = getY(domain[0] <= 0 && domain[1] >= 0 ? 0 : domain[0], domain, plotTop, plotHeight);
  const benchmarkY = benchmarkValue !== undefined ? getY(benchmarkValue, domain, plotTop, plotHeight) : null;
  const gridLines = Array.from({ length: 4 }, (_, index) => plotTop + plotHeight * (index / 3));
  const tickPositions = entries.map((entry, index) => ({
    label: entry.label,
    left: getAbsoluteLabelLeft(getGroupX(index, entries.length, plotLeft, plotWidth), width),
  }));
  const yAxisLabels = getYAxisTickValues(domain).map((value) => ({
    value,
    label: formatAxisTick(value),
    top: getY(value, domain, plotTop, plotHeight) - 7,
  }));

  return (
    <View style={[styles.chartWrap, { width, height }]}> 
      <Svg width={width} height={height}>
        <Line
          x1={plotLeft}
          x2={plotLeft}
          y1={plotTop}
          y2={plotTop + plotHeight}
          stroke={gridColor}
          strokeWidth={1}
        />
        <Line
          x1={plotLeft}
          x2={plotLeft + plotWidth}
          y1={plotTop + plotHeight}
          y2={plotTop + plotHeight}
          stroke={gridColor}
          strokeWidth={1}
        />
        {gridLines.map((y, index) => (
          <Line
            key={`grid-${index}`}
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={y}
            y2={y}
            stroke={gridColor}
            strokeDasharray={index === 3 ? undefined : '4 6'}
            strokeWidth={1}
          />
        ))}
        {benchmarkY !== null ? (
          <Line
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={benchmarkY}
            y2={benchmarkY}
            stroke={benchmarkColor ?? '#94A3B8'}
            strokeDasharray="6 6"
            strokeWidth={1.4}
          />
        ) : null}
        {entries.map((entry, index) => {
          const centerX = getGroupX(index, entries.length, plotLeft, plotWidth);
          const barY = getY(entry.value, domain, plotTop, plotHeight);
          const isFocused = !focusedKey || focusedKey === entry.key;

          return (
            <Rect
              key={entry.key}
              x={centerX - barWidth / 2}
              y={Math.min(barY, zeroY)}
              width={barWidth}
              height={Math.max(Math.abs(zeroY - barY), 2)}
              rx={8}
              fill={entry.color}
              opacity={isFocused ? 1 : 0.32}
              onPress={onSelect ? () => onSelect(entry.key) : undefined}
            />
          );
        })}
      </Svg>
      {showAxisLabels
        ? tickPositions.map((tick, index) => (
            <Text
              key={`${tick.label}-${index}`}
              style={[
                styles.axisLabel,
                {
                  color: labelColor,
                  left: tick.left,
                  top: plotTop + plotHeight + 6,
                  width: LABEL_WIDTH,
                },
              ]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))
        : null}
      {showAxisLabels
        ? yAxisLabels.map((tick, index) => (
            <Text
              key={`y-${tick.value}-${index}`}
              style={[
                styles.yAxisLabel,
                {
                  color: labelColor,
                  left: 0,
                  top: tick.top,
                  width: Math.max(plotLeft - 4, Y_AXIS_WIDTH),
                },
              ]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))
        : null}
    </View>
  );
}

export function FinanceDonutChart({
  size,
  slices,
  focusedKey,
  onSelect,
  ringThickness = 48,
  trackColor = '#E2E8F0',
  centerColor = '#FFFFFF',
  labelColor = '#111827',
  variant = 'donut',
  showCallouts = false,
}: FinanceDonutChartProps) {
  const total = Math.max(slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0), 0);
  const outerRadius = size / 2 - (showCallouts ? 36 : 8);
  const innerRadius = variant === 'pie' ? 1 : Math.max(outerRadius - ringThickness, 12);
  const center = size / 2;
  let startAngle = -Math.PI / 2;
  const gapAngle = slices.length > 1 ? 0.03 : 0;
  const callouts: Array<{
    key: string;
    title: string;
    subtitle: string;
    titleLeft: number;
    top: number;
    isRight: boolean;
    color: string;
    points: [number, number, number, number, number, number];
  }> = [];

  return (
    <View style={[styles.donutWrap, { width: size, height: size }]}> 
      <Svg width={size} height={size}>
        {variant === 'donut' ? (
          <Circle
            cx={center}
            cy={center}
            r={(outerRadius + innerRadius) / 2}
            stroke={trackColor}
            strokeWidth={ringThickness}
            fill="none"
          />
        ) : null}
        {slices.map((slice) => {
          const ratio = total > 0 ? slice.value / total : 0;
          const sweep = Math.max(ratio * Math.PI * 2 - gapAngle, 0);
          const endAngle = startAngle + sweep;
          const midAngle = startAngle + sweep / 2;
          const isFocused = focusedKey === slice.key;
          const segmentOuterRadius = isFocused ? outerRadius + 4 : outerRadius;
          const opacity = !focusedKey || focusedKey === slice.key ? 1 : 0.48;

          if (showCallouts && ratio > 0) {
            const anchor = polarToCartesian(center, center, segmentOuterRadius - 2, midAngle);
            const elbow = polarToCartesian(center, center, segmentOuterRadius + 12, midAngle);
            const isRight = Math.cos(midAngle) >= 0;
            const endX = clamp(elbow.x + (isRight ? 18 : -18), 18, size - 18);
            const labelLeft = clamp(endX + (isRight ? 4 : -PIE_LABEL_WIDTH - 4), 0, size - PIE_LABEL_WIDTH);
            const labelTop = clamp(elbow.y - 16, 0, size - 34);
            callouts.push({
              key: slice.key,
              title: slice.label,
              subtitle: formatSliceShare(slice.value, total),
              titleLeft: labelLeft,
              top: labelTop,
              isRight,
              color: slice.color,
              points: [anchor.x, anchor.y, elbow.x, elbow.y, endX, elbow.y],
            });
          }

          startAngle += ratio * Math.PI * 2;

          if (ratio >= 0.999) {
            if (variant === 'pie') {
              return (
                <Circle
                  key={slice.key}
                  cx={center}
                  cy={center}
                  r={segmentOuterRadius}
                  fill={slice.color}
                  opacity={opacity}
                  onPress={onSelect ? () => onSelect(slice.key) : undefined}
                />
              );
            }

            return (
              <Circle
                key={slice.key}
                cx={center}
                cy={center}
                r={(segmentOuterRadius + innerRadius) / 2}
                stroke={slice.color}
                strokeWidth={segmentOuterRadius - innerRadius}
                fill="none"
                opacity={opacity}
                onPress={onSelect ? () => onSelect(slice.key) : undefined}
              />
            );
          }

          const path =
            variant === 'pie'
              ? buildPieSegmentPath(center, center, segmentOuterRadius, startAngle - sweep, endAngle)
              : buildDonutSegmentPath(center, center, segmentOuterRadius, innerRadius, startAngle - sweep, endAngle);

          return (
            <Path
              key={slice.key}
              d={path}
              fill={slice.color}
              opacity={opacity}
              onPress={onSelect ? () => onSelect(slice.key) : undefined}
            />
          );
        })}
        {variant === 'donut' ? <Circle cx={center} cy={center} r={innerRadius - 2} fill={centerColor} /> : null}
        {showCallouts
          ? callouts.map((callout) => (
              <Path
                key={`line-${callout.key}`}
                d={`M ${callout.points[0]} ${callout.points[1]} L ${callout.points[2]} ${callout.points[3]} L ${callout.points[4]} ${callout.points[5]}`}
                stroke={callout.color}
                strokeWidth={1.4}
                fill="none"
              />
            ))
          : null}
      </Svg>
      {showCallouts
        ? callouts.map((callout) => (
            <View
              key={`label-${callout.key}`}
              pointerEvents="none"
              style={[
                styles.pieCallout,
                {
                  left: callout.titleLeft,
                  top: callout.top,
                  alignItems: callout.isRight ? 'flex-start' : 'flex-end',
                },
              ]}
            >
              <Text style={[styles.pieCalloutTitle, { color: labelColor }]} numberOfLines={1}>
                {callout.title}
              </Text>
              <Text style={[styles.pieCalloutSubtitle, { color: labelColor }]}>{callout.subtitle}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 10,
    textAlign: 'center',
  },
  yAxisLabel: {
    position: 'absolute',
    fontSize: 10,
    textAlign: 'right',
  },
  donutWrap: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieCallout: {
    position: 'absolute',
    width: PIE_LABEL_WIDTH,
  },
  pieCalloutTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  pieCalloutSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
});
