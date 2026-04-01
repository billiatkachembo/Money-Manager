import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Canvas, Path, Rect, Skia } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface ChartTick {
  index: number;
  label: string;
}

interface LineChartSeries {
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

interface VerticalBarEntry {
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

interface DonutSlice {
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
    const compact = Math.round((value / 100)) / 10;
    return `${compact}`.replace(/\.0$/, '') + 'k';
  }
  return `${Math.round(value)}`;
}

function getYAxisTickValues(domain: [number, number]): number[] {
  const [min, max] = domain;
  if (max == min) {
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

function buildSkiaLinePath(points: Array<{ x: number; y: number }>, smooth: boolean = true) {
  const path = Skia.Path.Make();
  if (points.length === 0) {
    return path;
  }

  if (!smooth || points.length === 1) {
    path.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      path.lineTo(points[index].x, points[index].y);
    }
    return path;
  }

  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    path.cubicTo(midX, previous.y, midX, current.y, current.x, current.y);
  }

  return path;
}

function buildSkiaAreaPath(points: Array<{ x: number; y: number }>, baselineY: number, smooth: boolean) {
  const path = Skia.Path.Make();
  if (points.length === 0) {
    return path;
  }

  const start = points[0];
  const end = points[points.length - 1];
  path.moveTo(start.x, baselineY);
  path.lineTo(start.x, start.y);

  if (!smooth || points.length === 1) {
    for (let index = 1; index < points.length; index += 1) {
      path.lineTo(points[index].x, points[index].y);
    }
  } else {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const midX = (previous.x + current.x) / 2;
      path.cubicTo(midX, previous.y, midX, current.y, current.x, current.y);
    }
  }

  path.lineTo(end.x, baselineY);
  path.close();
  return path;
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number, smooth: boolean): string {
  if (points.length === 0) {
    return '';
  }

  const start = points[0];
  const end = points[points.length - 1];
  const linePath = smooth
    ? buildSmoothLinePath(points).replace(/^M [^ ]+ [^ ]+/, `L ${start.x} ${start.y}`)
    : points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ');
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

function withOpacity(color: string, opacity: number): string {
  if (opacity >= 1) {
    return color;
  }

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((char) => char + char).join('');
    }

    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  return color;
}

function makePath(svgPath: string) {
  return svgPath ? Skia.Path.MakeFromSVGString(svgPath) : null;
}

function makeCirclePath(cx: number, cy: number, radius: number) {
  const path = Skia.Path.Make();
  path.addCircle(cx, cy, radius);
  return path;
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

  const renderedSeries = useMemo(
    () =>
      series.map((entry) => {
        const points = entry.values.map((value, index) => ({
          x: getX(index, maxLength, plotLeft, plotWidth),
          y: getY(value, domain, plotTop, plotHeight),
        }));
        const smoothPath = entry.smooth ?? true;
        const linePath = buildSkiaLinePath(points, smoothPath);
        const areaPath = entry.fillColor ? buildSkiaAreaPath(points, baselineY, smoothPath) : null;

        return {
          entry,
          points,
          linePath,
          areaPath,
        };
      }),
    [baselineY, domain, maxLength, plotHeight, plotLeft, plotTop, plotWidth, series]
  );

  const pointTargets = useMemo(() => {
    if (!onSelectIndex || renderedSeries.length === 0) {
      return [] as Array<{ index: number; left: number; top: number }>;
    }

    const interactiveSeries = renderedSeries.find((item) => item.entry.showDots) ?? renderedSeries[0];
    return interactiveSeries.points.map((point, index) => ({
      index,
      left: point.x - 18,
      top: point.y - 18,
    }));
  }, [onSelectIndex, renderedSeries]);

  return (
    <View style={[styles.chartWrap, { width, height }]}>
      <Canvas style={{ width, height }}>
        <Rect x={plotLeft} y={plotTop} width={1} height={plotHeight} color={gridColor} />
        <Rect x={plotLeft} y={plotTop + plotHeight} width={plotWidth} height={1} color={gridColor} />
        {gridLines.map((y, index) => (
          <Rect key={`grid-${index}`} x={plotLeft} y={y} width={plotWidth} height={1} color={gridColor} />
        ))}
        {zeroLineColor && domain[0] < 0 && domain[1] > 0 ? (
          <Rect x={plotLeft} y={baselineY} width={plotWidth} height={1} color={zeroLineColor} />
        ) : null}
        {renderedSeries.map(({ entry, points, linePath, areaPath }) => {
          const lineColor = withOpacity(entry.color, entry.opacity ?? 1);
          const fillColor = entry.fillColor ? withOpacity(entry.fillColor, 0.18) : null;

          return (
            <React.Fragment key={entry.key}>
              {areaPath && fillColor ? <Path path={areaPath} color={fillColor} /> : null}
              {linePath ? (
                <Path path={linePath} color={lineColor} style="stroke" strokeWidth={entry.strokeWidth ?? 2} />
              ) : null}
              {entry.showDots
                ? points.map((point, index) => {
                    const isActive = entry.activeIndex === index;
                    const outerRadius = (isActive ? entry.activeRadius ?? 4.6 : entry.dotRadius ?? 3) + 1.2;
                    const innerRadius = isActive ? entry.activeRadius ?? 4.6 : entry.dotRadius ?? 3;
                    return (
                      <React.Fragment key={`${entry.key}-dot-${index}`}>
                        <Path path={makeCirclePath(point.x, point.y, outerRadius)} color={isActive ? entry.activeStroke ?? '#FFFFFF' : entry.dotStroke ?? '#FFFFFF'} />
                        <Path path={makeCirclePath(point.x, point.y, innerRadius)} color={isActive ? entry.activeFill ?? entry.color : entry.dotFill ?? entry.color} />
                      </React.Fragment>
                    );
                  })
                : null}
            </React.Fragment>
          );
        })}
      </Canvas>
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
      {pointTargets.map((target) => (
        <TouchableOpacity
          key={`line-target-${target.index}`}
          activeOpacity={0.85}
          onPress={() => onSelectIndex?.(target.index)}
          style={[styles.touchTarget, { left: target.left, top: target.top }]}
        />
      ))}
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
  const barWidth = Math.min(30, Math.max(14, groupWidth * 0.7));
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

  const bars = useMemo(
    () =>
      entries.map((entry, index) => {
        const centerX = getGroupX(index, entries.length, plotLeft, plotWidth);
        const barY = getY(entry.value, domain, plotTop, plotHeight);
        const isFocused = !focusedKey || focusedKey === entry.key;
        return {
          entry,
          x: centerX - barWidth / 2,
          y: Math.min(barY, zeroY),
          width: barWidth,
          height: Math.max(Math.abs(zeroY - barY), 2),
          color: isFocused ? entry.color : withOpacity(entry.color, 0.32),
        };
      }),
    [barWidth, domain, entries, focusedKey, plotHeight, plotLeft, plotTop, plotWidth, zeroY]
  );

  return (
    <View style={[styles.chartWrap, { width, height }]}>
      <Canvas style={{ width, height }}>
        <Rect x={plotLeft} y={plotTop} width={1} height={plotHeight} color={gridColor} />
        <Rect x={plotLeft} y={plotTop + plotHeight} width={plotWidth} height={1} color={gridColor} />
        {gridLines.map((y, index) => (
          <Rect key={`grid-${index}`} x={plotLeft} y={y} width={plotWidth} height={1} color={gridColor} />
        ))}
        {benchmarkY !== null ? (
          <Rect x={plotLeft} y={benchmarkY} width={plotWidth} height={1} color={benchmarkColor ?? '#94A3B8'} />
        ) : null}
        {bars.map((bar) => (
          <Rect key={bar.entry.key} x={bar.x} y={bar.y} width={bar.width} height={bar.height} color={bar.color} />
        ))}
      </Canvas>
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
      {bars.map((bar) => (
        <TouchableOpacity
          key={`bar-target-${bar.entry.key}`}
          activeOpacity={0.85}
          onPress={() => onSelect?.(bar.entry.key)}
          style={[
            styles.barTouchTarget,
            {
              left: bar.x - 6,
              top: plotTop,
              width: bar.width + 12,
              height: plotHeight,
            },
          ]}
        />
      ))}
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

  const chart = useMemo(() => {
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
      linePath: ReturnType<typeof makePath>;
    }> = [];
    const segments: Array<{
      key: string;
      paths: Array<ReturnType<typeof makePath>>;
      color: string;
    }> = [];

    for (const slice of slices) {
      const ratio = total > 0 ? slice.value / total : 0;
      const sweep = Math.max(ratio * Math.PI * 2 - gapAngle, 0);
      const endAngle = startAngle + sweep;
      const midAngle = startAngle + sweep / 2;
      const isFocused = focusedKey === slice.key;
      const segmentOuterRadius = isFocused ? outerRadius + 4 : outerRadius;
      const opacityColor = !focusedKey || focusedKey === slice.key ? slice.color : withOpacity(slice.color, 0.48);
      const segmentPaths: Array<ReturnType<typeof makePath>> = [];

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
          linePath: makePath(`M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${endX} ${elbow.y}`),
        });
      }

      if (ratio >= 0.999) {
        if (variant === 'pie') {
          const path = makePath(buildPieSegmentPath(center, center, segmentOuterRadius, -Math.PI / 2, Math.PI * 1.5 - 0.001));
          segmentPaths.push(path);
        } else {
          segmentPaths.push(makePath(buildDonutSegmentPath(center, center, segmentOuterRadius, innerRadius, -Math.PI / 2, Math.PI / 2)));
          segmentPaths.push(makePath(buildDonutSegmentPath(center, center, segmentOuterRadius, innerRadius, Math.PI / 2, Math.PI * 1.5)));
        }
      } else if (ratio > 0) {
        const path =
          variant === 'pie'
            ? makePath(buildPieSegmentPath(center, center, segmentOuterRadius, startAngle, endAngle))
            : makePath(buildDonutSegmentPath(center, center, segmentOuterRadius, innerRadius, startAngle, endAngle));
        segmentPaths.push(path);
      }

      segments.push({
        key: slice.key,
        paths: segmentPaths,
        color: opacityColor,
      });

      startAngle += ratio * Math.PI * 2;
    }

    const trackPaths =
      variant === 'donut'
        ? [
            makePath(buildDonutSegmentPath(center, center, outerRadius, innerRadius, -Math.PI / 2, Math.PI / 2)),
            makePath(buildDonutSegmentPath(center, center, outerRadius, innerRadius, Math.PI / 2, Math.PI * 1.5)),
          ]
        : [];

    return { callouts, segments, trackPaths };
  }, [center, focusedKey, innerRadius, outerRadius, showCallouts, size, slices, total, variant]);

  return (
    <View style={[styles.donutWrap, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {chart.trackPaths.map((path, index) =>
          path ? <Path key={`track-${index}`} path={path} color={trackColor} /> : null
        )}
        {chart.segments.map((segment) =>
          segment.paths.map((path, index) =>
            path ? <Path key={`${segment.key}-${index}`} path={path} color={segment.color} /> : null
          )
        )}
        {variant === 'donut' ? <Path path={makeCirclePath(center, center, innerRadius - 2)} color={centerColor} /> : null}
        {showCallouts
          ? chart.callouts.map((callout) =>
              callout.linePath ? (
                <Path key={`line-${callout.key}`} path={callout.linePath} color={callout.color} style="stroke" strokeWidth={1.4} />
              ) : null
            )
          : null}
      </Canvas>
      {showCallouts
        ? chart.callouts.map((callout) => {
            const label = (
              <>
                <Text style={[styles.pieCalloutTitle, { color: labelColor }]} numberOfLines={1}>
                  {callout.title}
                </Text>
                <Text style={[styles.pieCalloutSubtitle, { color: labelColor }]}>{callout.subtitle}</Text>
              </>
            );

            if (onSelect) {
              return (
                <TouchableOpacity
                  key={`label-${callout.key}`}
                  activeOpacity={0.85}
                  onPress={() => onSelect(callout.key)}
                  style={[
                    styles.pieCallout,
                    {
                      left: callout.titleLeft,
                      top: callout.top,
                      alignItems: callout.isRight ? 'flex-start' : 'flex-end',
                    },
                  ]}
                >
                  {label}
                </TouchableOpacity>
              );
            }

            return (
              <View
                key={`label-${callout.key}`}
                style={[
                  styles.pieCallout,
                  {
                    left: callout.titleLeft,
                    top: callout.top,
                    alignItems: callout.isRight ? 'flex-start' : 'flex-end',
                  },
                ]}
              >
                {label}
              </View>
            );
          })
        : null}
    </View>
  );
}


const MONEY_MANAGER_LINE_PADDING = { top: 18, right: 12, bottom: 16, left: 34 };
const MONEY_MANAGER_BAR_PADDING = { top: 16, right: 10, bottom: 18, left: 34 };
const MONEY_MANAGER_AXIS_ITEM_WIDTH = 58;

interface MoneyManagerAxisItem {
  index: number;
  label: string;
  valueLabel: string;
}

interface MoneyManagerLineChartSectionProps {
  width: number;
  height?: number;
  labels: string[];
  values: number[];
  selectedIndex: number;
  tooltipIndex?: number | null;
  onSelectIndex?: (index: number) => void;
  onChartPressIndex?: (index: number) => void;
  onAxisPressIndex?: (index: number) => void;
  axisItems?: MoneyManagerAxisItem[];
  metricLabel?: string;
  lineColor: string;
  gridColor: string;
  axisLabelColor: string;
  textColor: string;
  tooltipSurface: string;
  tooltipBorder: string;
  valueFormatter: (value: number) => string;
  emptyTitle?: string;
  emptyMessage?: string;
}

interface MoneyManagerBarEntry {
  key: string;
  label: string;
  value: number;
  color: string;
  valueLabel?: string;
  detail?: string;
}

interface MoneyManagerBarChartSectionProps {
  width: number;
  height?: number;
  entries: MoneyManagerBarEntry[];
  selectedKey?: string | null;
  tooltipKey?: string | null;
  onSelectKey?: (key: string) => void;
  onChartPressKey?: (key: string) => void;
  onAxisPressKey?: (key: string) => void;
  axisItems?: MoneyManagerAxisItem[];
  gridColor: string;
  axisLabelColor: string;
  textColor: string;
  tooltipSurface: string;
  tooltipBorder: string;
  selectionFill: string;
  valueFormatter: (value: number) => string;
  emptyTitle?: string;
  emptyMessage?: string;
}

function roundMoneyManagerValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoneyManagerPlainAmount(value: number): string {
  const absolute = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-${absolute}` : absolute;
}

function computeMoneyManagerLineDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) {
    return { domain: [-1, 1], ticks: [0] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (Math.abs(max - min) < 0.0001) {
    const padding = Math.max(Math.abs(max) * 0.2, 1);
    const roundedMax = roundMoneyManagerValue(max);
    return {
      domain: [roundMoneyManagerValue(min - padding), roundMoneyManagerValue(max + padding)],
      ticks: [roundedMax],
    };
  }

  if (min < 0 && max > 0) {
    const absoluteMax = Math.max(Math.abs(min), Math.abs(max));
    const padded = roundMoneyManagerValue(absoluteMax * 1.1);
    return {
      domain: [-padded, padded],
      ticks: [padded, 0, -padded],
    };
  }

  const padding = Math.max((max - min) * 0.12, 1);
  const domain: [number, number] = [roundMoneyManagerValue(min - padding), roundMoneyManagerValue(max + padding)];
  const mid = roundMoneyManagerValue((domain[0] + domain[1]) / 2);
  const ticks = [domain[1], mid, domain[0]].filter(
    (tick, index, list) => list.findIndex((value) => Math.abs(value - tick) < 0.0001) === index
  );
  return { domain, ticks };
}

function computeMoneyManagerBarMax(values: number[]): number {
  const maximum = Math.max(...values, 0);
  if (maximum <= 0) {
    return 1;
  }
  if (maximum >= 1000) {
    return Math.ceil((maximum * 1.15) / 1000) * 1000;
  }
  if (maximum >= 100) {
    return Math.ceil((maximum * 1.15) / 100) * 100;
  }
  return Math.ceil(maximum * 1.15);
}

export function MoneyManagerLineChartSection({
  width,
  height = 188,
  labels,
  values,
  selectedIndex,
  tooltipIndex,
  onSelectIndex,
  onChartPressIndex,
  onAxisPressIndex,
  axisItems,
  metricLabel,
  lineColor,
  gridColor,
  axisLabelColor,
  textColor,
  tooltipSurface,
  tooltipBorder,
  valueFormatter,
  emptyTitle = 'No chart data',
  emptyMessage = 'There is no line-chart data for this view yet.',
}: MoneyManagerLineChartSectionProps) {
  const hasData = labels.length > 0 && values.length > 0;
  const safeSelectedIndex = clamp(selectedIndex, 0, Math.max(values.length - 1, 0));
  const safeTooltipIndex =
    tooltipIndex !== null && tooltipIndex !== undefined && tooltipIndex >= 0 && tooltipIndex < values.length
      ? tooltipIndex
      : null;
  const tooltipProgress = useSharedValue(0);

  useEffect(() => {
    if (safeTooltipIndex === null) {
      tooltipProgress.value = 0;
      return;
    }

    tooltipProgress.value = 0;
    tooltipProgress.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [safeTooltipIndex, tooltipProgress]);

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipProgress.value,
    transform: [{ scale: 0.96 + tooltipProgress.value * 0.04 }],
  }));

  if (!hasData) {
    return (
      <View style={[styles.moneyManagerEmptyWrap, { width, backgroundColor: tooltipSurface, borderColor: tooltipBorder }]}>
        <Text style={[styles.moneyManagerEmptyTitle, { color: textColor }]}>{emptyTitle}</Text>
        <Text style={[styles.moneyManagerEmptyText, { color: axisLabelColor }]}>{emptyMessage}</Text>
      </View>
    );
  }

  const { domain, ticks } = useMemo(() => computeMoneyManagerLineDomain(values), [values]);
  const { plotLeft, plotTop, plotWidth, plotHeight } = getChartMetrics(width, height, MONEY_MANAGER_LINE_PADDING);
  const pointCount = Math.max(labels.length, values.length, 1);
  const points = useMemo(
    () =>
      values.map((value, index) => ({
        x: getX(index, pointCount, plotLeft, plotWidth),
        y: getY(value, domain, plotTop, plotHeight),
      })),
    [domain, plotHeight, plotLeft, plotTop, plotWidth, pointCount, values]
  );
  const linePath = useMemo(() => buildSkiaLinePath(points, true), [points]);
  const dotPaths = useMemo(
    () =>
      points.map((point, index) =>
        makeCirclePath(point.x, point.y, index === safeSelectedIndex ? 4.5 : 3.2)
      ),
    [points, safeSelectedIndex]
  );
  const tooltipPoint = safeTooltipIndex === null ? null : points[safeTooltipIndex] ?? null;
  const tooltipLabel = safeTooltipIndex === null ? null : labels[safeTooltipIndex] ?? labels[labels.length - 1] ?? 'Overview';
  const tooltipValue = safeTooltipIndex === null ? null : values[safeTooltipIndex] ?? values[values.length - 1] ?? 0;
  const renderedAxisItems =
    axisItems?.filter((item) => item.index >= 0 && item.index < values.length) ??
    values.map((value, index) => ({
      index,
      label: labels[index] ?? '',
      valueLabel: formatMoneyManagerPlainAmount(value),
    }));

  return (
    <View style={[styles.moneyManagerSection, { width }]}> 
      {metricLabel ? <Text style={[styles.moneyManagerMetricLabel, { color: axisLabelColor }]}>{metricLabel}</Text> : null}
      <Text style={[styles.moneyManagerMetricValue, { color: textColor }]}>{valueFormatter(values[safeSelectedIndex] ?? values[values.length - 1] ?? 0)}</Text>
      <View style={styles.moneyManagerChartSurface}>
        <Canvas style={{ width, height }}>
          <Rect x={plotLeft} y={plotTop} width={1} height={plotHeight} color={gridColor} />
          <Rect x={plotLeft} y={plotTop + plotHeight} width={plotWidth} height={1} color={gridColor} />
          {ticks.map((tick, index) => (
            <Rect
              key={`line-grid-${tick}-${index}`}
              x={plotLeft}
              y={getY(tick, domain, plotTop, plotHeight)}
              width={plotWidth}
              height={1}
              color={gridColor}
            />
          ))}
          <Path path={linePath} color={lineColor} style="stroke" strokeWidth={2.4} />
          {dotPaths.map((path, index) => (
            <Path key={`line-dot-${index}`} path={path} color={lineColor} />
          ))}
        </Canvas>
        {ticks.map((tick, index) => (
          <Text
            key={`line-tick-${tick}-${index}`}
            style={[
              styles.moneyManagerYAxisLabel,
              {
                color: axisLabelColor,
                top: getY(tick, domain, plotTop, plotHeight) - 7,
              },
            ]}
          >
            {formatAxisTick(tick)}
          </Text>
        ))}
        {tooltipPoint && tooltipLabel !== null && tooltipValue !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.moneyManagerTooltip,
              {
                left: clamp(tooltipPoint.x - 58, plotLeft + 4, width - 118),
                top: clamp(tooltipPoint.y - 48, 2, height - 58),
                backgroundColor: tooltipSurface,
                borderColor: tooltipBorder,
              },
              tooltipStyle,
            ]}
          >
            <Text style={[styles.moneyManagerTooltipEyebrow, { color: axisLabelColor }]}>{tooltipLabel}</Text>
            <Text style={[styles.moneyManagerTooltipValue, { color: textColor }]}>{valueFormatter(tooltipValue)}</Text>
          </Animated.View>
        ) : null}
        {points.map((point, index) => (
          <TouchableOpacity
            key={`line-touch-${labels[index] ?? index}-${index}`}
            activeOpacity={0.88}
            onPress={() => {
              if (onChartPressIndex) {
                onChartPressIndex(index);
                return;
              }
              onSelectIndex?.(index);
            }}
            style={[
              styles.moneyManagerPointTouchTarget,
              {
                left: point.x - 18,
                top: point.y - 18,
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.moneyManagerAxisRow, { width }]}> 
        {renderedAxisItems.map((item) => {
          const point = points[item.index];
          if (!point) {
            return null;
          }

          return (
            <TouchableOpacity
              key={`line-axis-${item.label}-${item.index}`}
              activeOpacity={0.88}
              onPress={() => {
                if (onAxisPressIndex) {
                  onAxisPressIndex(item.index);
                  return;
                }
                onSelectIndex?.(item.index);
              }}
              style={[
                styles.moneyManagerAxisItem,
                {
                  left: clamp(point.x - MONEY_MANAGER_AXIS_ITEM_WIDTH / 2, 0, width - MONEY_MANAGER_AXIS_ITEM_WIDTH),
                  width: MONEY_MANAGER_AXIS_ITEM_WIDTH,
                },
              ]}
            >
              <Text style={[styles.moneyManagerAxisItemLabel, { color: axisLabelColor }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text
                style={[
                  styles.moneyManagerAxisItemValue,
                  { color: item.index === safeSelectedIndex ? lineColor : axisLabelColor },
                ]}
                numberOfLines={1}
              >
                {item.valueLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function MoneyManagerBarChartSection({
  width,
  height = 206,
  entries,
  selectedKey,
  tooltipKey,
  onSelectKey,
  onChartPressKey,
  onAxisPressKey,
  axisItems,
  gridColor,
  axisLabelColor,
  textColor,
  tooltipSurface,
  tooltipBorder,
  selectionFill,
  valueFormatter,
  emptyTitle = 'No bar data',
  emptyMessage = 'There is no category data for this view yet.',
}: MoneyManagerBarChartSectionProps) {
  const hasEntries = entries.length > 0;
  const hasBarData = entries.some((entry) => entry.value > 0);
  const safeSelectedKey = entries.some((entry) => entry.key === selectedKey)
    ? selectedKey ?? null
    : entries[0]?.key ?? null;
  const safeTooltipKey = entries.some((entry) => entry.key === tooltipKey)
    ? tooltipKey ?? null
    : null;
  const tooltipProgress = useSharedValue(0);

  useEffect(() => {
    if (!safeTooltipKey) {
      tooltipProgress.value = 0;
      return;
    }

    tooltipProgress.value = 0;
    tooltipProgress.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [safeTooltipKey, tooltipProgress]);

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipProgress.value,
    transform: [{ scale: 0.96 + tooltipProgress.value * 0.04 }],
  }));

  if (!hasEntries || !hasBarData) {
    return (
      <View style={[styles.moneyManagerEmptyWrap, { width, backgroundColor: tooltipSurface, borderColor: tooltipBorder }]}>
        <Text style={[styles.moneyManagerEmptyTitle, { color: textColor }]}>{emptyTitle}</Text>
        <Text style={[styles.moneyManagerEmptyText, { color: axisLabelColor }]}>{emptyMessage}</Text>
      </View>
    );
  }

  const barMax = useMemo(() => computeMoneyManagerBarMax(entries.map((entry) => entry.value)), [entries]);
  const barDomain: [number, number] = [0, barMax];
  const barTicks = useMemo(() => [barMax, roundMoneyManagerValue(barMax / 2), 0], [barMax]);
  const { plotLeft, plotTop, plotWidth, plotHeight } = getChartMetrics(width, height, MONEY_MANAGER_BAR_PADDING);
  const groupWidth = entries.length > 0 ? plotWidth / entries.length : plotWidth;
  const baseBarWidth = clamp(groupWidth * 0.46, 14, 22);
  const selectedGroupWidth = Math.max(groupWidth - 6, baseBarWidth + 10);

  const bars = useMemo(
    () =>
      entries.map((entry, index) => {
        const centerX = getGroupX(index, entries.length, plotLeft, plotWidth);
        const isSelected = entry.key === safeSelectedKey;
        const widthValue = isSelected ? baseBarWidth + 1.5 : baseBarWidth;
        const barY = getY(entry.value, barDomain, plotTop, plotHeight);
        return {
          entry,
          centerX,
          x: centerX - widthValue / 2,
          y: Math.min(barY, plotTop + plotHeight),
          width: widthValue,
          height: Math.max(plotTop + plotHeight - barY, 2),
          isSelected,
          groupX: plotLeft + groupWidth * index + (groupWidth - selectedGroupWidth) / 2,
        };
      }),
    [barDomain, baseBarWidth, entries, groupWidth, plotHeight, plotLeft, plotTop, plotWidth, safeSelectedKey, selectedGroupWidth]
  );
  const tooltipBar = safeTooltipKey
    ? bars.find((bar) => bar.entry.key === safeTooltipKey) ?? null
    : null;
  const renderedAxisItems =
    axisItems?.filter((item) => item.index >= 0 && item.index < entries.length) ??
    entries.map((entry, index) => ({
      index,
      label: entry.label,
      valueLabel: entry.valueLabel ?? formatMoneyManagerPlainAmount(entry.value),
    }));

  return (
    <View style={[styles.moneyManagerSection, { width }]}> 
      <View style={styles.moneyManagerChartSurface}>
        <Canvas style={{ width, height }}>
          <Rect x={plotLeft} y={plotTop} width={1} height={plotHeight} color={gridColor} />
          <Rect x={plotLeft} y={plotTop + plotHeight} width={plotWidth} height={1} color={gridColor} />
          {barTicks.map((tick, index) => (
            <Rect
              key={`bar-grid-${tick}-${index}`}
              x={plotLeft}
              y={getY(tick, barDomain, plotTop, plotHeight)}
              width={plotWidth}
              height={1}
              color={gridColor}
            />
          ))}
          {bars.map((bar) => (
            <React.Fragment key={`bar-${bar.entry.key}`}>
              {bar.isSelected ? (
                <Rect
                  x={bar.groupX}
                  y={plotTop}
                  width={selectedGroupWidth}
                  height={plotHeight}
                  color={selectionFill}
                />
              ) : null}
              <Rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} color={bar.entry.color} />
            </React.Fragment>
          ))}
        </Canvas>
        {barTicks.map((tick, index) => (
          <Text
            key={`bar-tick-${tick}-${index}`}
            style={[
              styles.moneyManagerYAxisLabel,
              {
                color: axisLabelColor,
                top: getY(tick, barDomain, plotTop, plotHeight) - 7,
              },
            ]}
          >
            {formatAxisTick(tick)}
          </Text>
        ))}
        {tooltipBar ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.moneyManagerTooltip,
              {
                left: clamp(tooltipBar.centerX - 62, plotLeft + 4, width - 124),
                top: clamp(tooltipBar.y - 56, 4, height - 64),
                backgroundColor: tooltipSurface,
                borderColor: tooltipBorder,
              },
              tooltipStyle,
            ]}
          >
            <Text style={[styles.moneyManagerTooltipEyebrow, { color: axisLabelColor }]} numberOfLines={1}>
              {tooltipBar.entry.label}
            </Text>
            <Text style={[styles.moneyManagerTooltipValue, { color: textColor }]} numberOfLines={1}>
              {valueFormatter(tooltipBar.entry.value)}
            </Text>
            {tooltipBar.entry.detail ? (
              <Text style={[styles.moneyManagerTooltipMeta, { color: axisLabelColor }]} numberOfLines={1}>
                {tooltipBar.entry.detail}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}
        {bars.map((bar) => (
          <TouchableOpacity
            key={`bar-touch-${bar.entry.key}`}
            activeOpacity={0.88}
            onPress={() => {
              if (onChartPressKey) {
                onChartPressKey(bar.entry.key);
                return;
              }
              onSelectKey?.(bar.entry.key);
            }}
            style={[
              styles.barTouchTarget,
              {
                left: bar.groupX,
                top: plotTop,
                width: selectedGroupWidth,
                height: plotHeight,
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.moneyManagerAxisRow, { width }]}> 
        {renderedAxisItems.map((item) => {
          const bar = bars[item.index];
          if (!bar) {
            return null;
          }

          return (
            <TouchableOpacity
              key={`bar-axis-${item.label}-${item.index}`}
              activeOpacity={0.88}
              onPress={() => {
                if (onAxisPressKey) {
                  onAxisPressKey(bar.entry.key);
                  return;
                }
                onSelectKey?.(bar.entry.key);
              }}
              style={[
                styles.moneyManagerAxisItem,
                {
                  left: clamp(bar.centerX - MONEY_MANAGER_AXIS_ITEM_WIDTH / 2, 0, width - MONEY_MANAGER_AXIS_ITEM_WIDTH),
                  width: MONEY_MANAGER_AXIS_ITEM_WIDTH,
                },
              ]}
            >
              <Text style={[styles.moneyManagerAxisItemLabel, { color: axisLabelColor }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text
                style={[
                  styles.moneyManagerAxisItemValue,
                  { color: bar.entry.key === safeSelectedKey ? bar.entry.color : axisLabelColor },
                ]}
                numberOfLines={1}
              >
                {item.valueLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  touchTarget: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  barTouchTarget: {
    position: 'absolute',
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

  moneyManagerSection: {
    marginTop: 8,
  },
  moneyManagerMetricLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  moneyManagerMetricValue: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  moneyManagerChartSurface: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: 12,
  },
  moneyManagerYAxisLabel: {
    position: 'absolute',
    left: 0,
    width: 28,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '600',
  },
  moneyManagerTooltip: {
    position: 'absolute',
    minWidth: 112,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  moneyManagerTooltipEyebrow: {
    fontSize: 10,
    fontWeight: '700',
  },
  moneyManagerTooltipValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  moneyManagerTooltipMeta: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  moneyManagerPointTouchTarget: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  moneyManagerAxisRow: {
    position: 'relative',
    height: 46,
    marginTop: 8,
    marginBottom: 4,
  },
  moneyManagerAxisItem: {
    position: 'absolute',
    alignItems: 'center',
    gap: 3,
  },
  moneyManagerAxisItemLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  moneyManagerAxisItemValue: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  moneyManagerEmptyWrap: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 148,
  },
  moneyManagerEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  moneyManagerEmptyText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

