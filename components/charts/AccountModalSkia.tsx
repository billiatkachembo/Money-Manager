import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { FinanceDonutChart } from "@/components/charts/SkiaFinanceCharts";
import { useTheme } from "@/store/theme-store";
import { useTransactionStore } from "@/store/transaction-store";

const { width } = Dimensions.get("window");
const CHART_W = Math.max(width - 20, 280);
const LINE_H = 188;
const BAR_H = 206;
const PIE_SIZE = Math.min(CHART_W, 320);
const LINE_PADDING = { top: 18, right: 12, bottom: 16, left: 34 };
const BAR_PADDING = { top: 16, right: 10, bottom: 18, left: 34 };
const PIE_COLORS = ["#FF6B6B", "#FFA45B", "#FFD166", "#D9ED54", "#A7E163", "#4D96FF"];

interface AccountModalData {
  months?: string[];
  lineValues?: number[];
  income?: number[];
  expenses?: number[];
  pieLabels?: string[];
  pieValues?: number[];
}

interface AccountModalSkiaProps {
  data?: AccountModalData;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatAxisTick(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000000) {
    const compact = Math.round((value / 1000000) * 10) / 10;
    return `${compact}`.replace(/\.0$/, "") + "M";
  }
  if (absolute >= 10000) {
    return `${Math.round(value / 1000)}k`;
  }
  if (absolute >= 1000) {
    const compact = Math.round((value / 100)) / 10;
    return `${compact}`.replace(/\.0$/, "") + "k";
  }
  return `${Math.round(value)}`;
}

function formatPlainAmount(value: number) {
  const absolute = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-${absolute}` : absolute;
}

function formatPercentage(value: number) {
  const percent = Math.max(0, Math.min(100, value * 100));
  const rounded = percent >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function compactCurrency(formatCurrency: (value: number) => string, value: number) {
  return formatCurrency(value).replace(/\.00\b/g, "").replace(/([^\d])\s+(?=\d)/g, "$1");
}

function computeLineDomain(values: number[]) {
  if (values.length === 0) {
    return { domain: [-1, 1] as [number, number], ticks: [0] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (Math.abs(max - min) < 0.0001) {
    const padding = Math.max(Math.abs(max) * 0.2, 1);
    return {
      domain: [min - padding, max + padding] as [number, number],
      ticks: [roundCurrency(max)],
    };
  }

  if (min < 0 && max > 0) {
    const absoluteMax = Math.max(Math.abs(min), Math.abs(max));
    const padded = roundCurrency(absoluteMax * 1.1);
    return {
      domain: [-padded, padded] as [number, number],
      ticks: [padded, 0, -padded],
    };
  }

  const padding = Math.max((max - min) * 0.12, 1);
  const domain = [roundCurrency(min - padding), roundCurrency(max + padding)] as [number, number];
  const mid = roundCurrency((domain[0] + domain[1]) / 2);
  const ticks = [domain[1], mid, domain[0]].filter(
    (tick, index, list) => list.findIndex((value) => Math.abs(value - tick) < 0.0001) === index
  );
  return { domain, ticks };
}

function computeBarMax(values: number[]) {
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

function getX(index: number, count: number, left: number, widthValue: number) {
  if (count <= 1) {
    return left + widthValue / 2;
  }
  return left + (widthValue * index) / (count - 1);
}

function getY(value: number, domain: [number, number], top: number, heightValue: number) {
  const [min, max] = domain;
  if (Math.abs(max - min) < 0.0001) {
    return top + heightValue / 2;
  }
  const ratio = (value - min) / (max - min);
  return top + heightValue - ratio * heightValue;
}

function buildCumulativeLineValues(income: number[], expenses: number[], length: number) {
  let running = 0;
  return Array.from({ length }, (_, index) => {
    running = roundCurrency(running + (income[index] ?? 0) - (expenses[index] ?? 0));
    return running;
  });
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  const path = Skia.Path.Make();
  if (points.length === 0) {
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

function makeCirclePath(cx: number, cy: number, radius: number) {
  const path = Skia.Path.Make();
  path.addCircle(cx, cy, radius);
  return path;
}

export default function AccountModalSkia({ data }: AccountModalSkiaProps) {
  const { theme } = useTheme();
  const { formatCurrency } = useTransactionStore();

  const months = data?.months ?? [];
  const income = data?.income ?? [];
  const expenses = data?.expenses ?? [];

  const lineValues = useMemo(() => {
    if (data?.lineValues && data.lineValues.length === months.length) {
      return data.lineValues;
    }

    return buildCumulativeLineValues(income, expenses, months.length);
  }, [data?.lineValues, expenses, income, months.length]);

  const pieEntries = useMemo(() => {
    const labels = data?.pieLabels ?? [];
    const values = data?.pieValues ?? [];

    return labels
      .map((label, index) => ({
        key: `${label}-${index}`,
        label,
        value: values[index] ?? 0,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value);
  }, [data?.pieLabels, data?.pieValues]);

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [lineTooltipIndex, setLineTooltipIndex] = useState<number | null>(null);
  const [barTooltipIndex, setBarTooltipIndex] = useState<number | null>(null);
  const [selectedPieKey, setSelectedPieKey] = useState<string | null>(null);
  const [pieTooltipKey, setPieTooltipKey] = useState<string | null>(null);

  useEffect(() => {
    if (months.length === 0) {
      setSelectedIndex(0);
      setLineTooltipIndex(null);
      setBarTooltipIndex(null);
      return;
    }

    setSelectedIndex((current) => {
      if (current < 0 || current >= months.length) {
        return months.length - 1;
      }
      return current;
    });
    setLineTooltipIndex(null);
    setBarTooltipIndex(null);
  }, [months.length]);

  useEffect(() => {
    if (pieEntries.length === 0) {
      setSelectedPieKey(null);
      setPieTooltipKey(null);
      return;
    }

    setSelectedPieKey((current) => {
      if (current && pieEntries.some((entry) => entry.key === current)) {
        return current;
      }

      return pieEntries.reduce((best, entry) => (entry.value > best.value ? entry : best), pieEntries[0]).key;
    });
    setPieTooltipKey(null);
  }, [pieEntries]);

  const selectedMonthLabel = months[selectedIndex] ?? months[months.length - 1] ?? "Overview";
  const lineTooltipLabel = lineTooltipIndex !== null ? months[lineTooltipIndex] ?? selectedMonthLabel : null;
  const lineTooltipValue = lineTooltipIndex !== null ? lineValues[lineTooltipIndex] ?? 0 : 0;
  const barTooltipIncome = barTooltipIndex !== null ? income[barTooltipIndex] ?? 0 : 0;
  const barTooltipExpense = barTooltipIndex !== null ? expenses[barTooltipIndex] ?? 0 : 0;
  const totalIncome = useMemo(() => roundCurrency(income.reduce((sum, value) => sum + value, 0)), [income]);
  const totalExpense = useMemo(() => roundCurrency(expenses.reduce((sum, value) => sum + value, 0)), [expenses]);
  const hasBarData = income.some((value) => value > 0) || expenses.some((value) => value > 0);
  const hasPieSeries = pieEntries.length > 0;
  const hasPieData = pieEntries.some((entry) => entry.value > 0);

  const lineColor = theme.isDark ? "#FF6B6B" : "#E85D5D";
  const incomeColor = theme.isDark ? "#2F80ED" : "#2563EB";
  const expenseColor = theme.isDark ? "#C97858" : "#C66A4B";
  const gridColor = theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.14)";
  const axisLabelColor = theme.isDark ? "rgba(255,255,255,0.76)" : "rgba(15,23,42,0.65)";
  const tooltipSurface = theme.isDark ? "rgba(38,38,42,0.96)" : "rgba(255,255,255,0.98)";
  const tooltipBorder = theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const selectionFill = theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)";

  const lineMeta = useMemo(() => computeLineDomain(lineValues), [lineValues]);
  const linePlotWidth = CHART_W - LINE_PADDING.left - LINE_PADDING.right;
  const linePlotHeight = LINE_H - LINE_PADDING.top - LINE_PADDING.bottom;
  const linePoints = useMemo(
    () =>
      lineValues.map((value, index) => ({
        x: getX(index, Math.max(months.length, 1), LINE_PADDING.left, linePlotWidth),
        y: getY(value, lineMeta.domain, LINE_PADDING.top, linePlotHeight),
      })),
    [lineMeta.domain, linePlotHeight, linePlotWidth, lineValues, months.length]
  );
  const linePath = useMemo(() => buildLinePath(linePoints), [linePoints]);
  const lineDotPaths = useMemo(
    () =>
      linePoints.map((point, index) => makeCirclePath(point.x, point.y, index === selectedIndex ? 4.5 : 3.2)),
    [linePoints, selectedIndex]
  );
  const lineTooltipPoint = lineTooltipIndex !== null ? linePoints[lineTooltipIndex] ?? null : null;

  const barChartMax = useMemo(() => computeBarMax([...income, ...expenses]), [expenses, income]);
  const barDomain = useMemo<[number, number]>(() => (hasBarData ? [0, barChartMax] : [-1, 1]), [barChartMax, hasBarData]);
  const barPlotWidth = CHART_W - BAR_PADDING.left - BAR_PADDING.right;
  const barPlotHeight = BAR_H - BAR_PADDING.top - BAR_PADDING.bottom;
  const barTicks = useMemo(() => {
    if (!hasBarData) {
      return [0];
    }
    return [barChartMax, roundCurrency(barChartMax / 2), 0];
  }, [barChartMax, hasBarData]);
  const groupWidth = months.length > 0 ? barPlotWidth / months.length : barPlotWidth;
  const barWidth = clamp(groupWidth * 0.24, 10, 18);
  const barGap = clamp(groupWidth * 0.08, 2, 6);
  const selectedGroupWidth = Math.max(groupWidth - 6, barWidth * 2 + barGap + 10);

  const lineTooltipProgress = useSharedValue(0);
  const barTooltipProgress = useSharedValue(0);
  const pieTooltipProgress = useSharedValue(0);

  useEffect(() => {
    if (lineTooltipIndex === null) {
      lineTooltipProgress.value = 0;
      return;
    }

    lineTooltipProgress.value = 0;
    lineTooltipProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [lineTooltipIndex, lineTooltipProgress]);

  useEffect(() => {
    if (barTooltipIndex === null) {
      barTooltipProgress.value = 0;
      return;
    }

    barTooltipProgress.value = 0;
    barTooltipProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [barTooltipIndex, barTooltipProgress]);

  useEffect(() => {
    if (!pieTooltipKey) {
      pieTooltipProgress.value = 0;
      return;
    }

    pieTooltipProgress.value = 0;
    pieTooltipProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [pieTooltipKey, pieTooltipProgress]);

  const lineTooltipStyle = useAnimatedStyle(() => ({
    opacity: lineTooltipProgress.value,
    transform: [{ scale: 0.96 + lineTooltipProgress.value * 0.04 }],
  }));

  const barTooltipStyle = useAnimatedStyle(() => ({
    opacity: barTooltipProgress.value,
    transform: [{ scale: 0.96 + barTooltipProgress.value * 0.04 }],
  }));

  const pieTooltipStyle = useAnimatedStyle(() => ({
    opacity: pieTooltipProgress.value,
    transform: [{ scale: 0.96 + pieTooltipProgress.value * 0.04 }],
  }));

  const pieTooltipEntry = useMemo(
    () => (pieTooltipKey ? pieEntries.find((entry) => entry.key === pieTooltipKey) ?? null : null),
    [pieEntries, pieTooltipKey]
  );
  const pieTotal = useMemo(() => roundCurrency(pieEntries.reduce((sum, entry) => sum + entry.value, 0)), [pieEntries]);
  const selectedPieShare = pieTooltipEntry && hasPieData && pieTotal > 0 ? pieTooltipEntry.value / pieTotal : 0;

  const handleSelectMonthFromNavigation = (index: number) => {
    setSelectedIndex(index);
    setLineTooltipIndex(null);
    setBarTooltipIndex(null);
    setPieTooltipKey(null);
  };

  const handleSelectLinePoint = (index: number) => {
    setSelectedIndex(index);
    setLineTooltipIndex(index);
    setBarTooltipIndex(null);
    setPieTooltipKey(null);
  };

  const handleSelectBarGroup = (index: number) => {
    setSelectedIndex(index);
    setBarTooltipIndex(index);
    setLineTooltipIndex(null);
    setPieTooltipKey(null);
  };

  const handleSelectPieCallout = (key: string) => {
    setSelectedPieKey(key);
    setPieTooltipKey(key);
    setLineTooltipIndex(null);
    setBarTooltipIndex(null);
  };

  const handleSelectPieLegend = (key: string) => {
    setSelectedPieKey(key);
    setPieTooltipKey(null);
    setLineTooltipIndex(null);
    setBarTooltipIndex(null);
  };

  if (months.length === 0) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No chart data</Text>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>There is no account history available yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      

      <View style={styles.chartSection}>
        <View style={styles.chartSurface}>
          <Canvas style={{ width: CHART_W, height: LINE_H }}>
            <Rect x={LINE_PADDING.left} y={LINE_PADDING.top} width={1} height={linePlotHeight} color={gridColor} />
            <Rect x={LINE_PADDING.left} y={LINE_PADDING.top + linePlotHeight} width={linePlotWidth} height={1} color={gridColor} />
            {lineMeta.ticks.map((tick, index) => (
              <Rect
                key={`line-grid-${tick}-${index}`}
                x={LINE_PADDING.left}
                y={getY(tick, lineMeta.domain, LINE_PADDING.top, linePlotHeight)}
                width={linePlotWidth}
                height={1}
                color={gridColor}
              />
            ))}
            <Path path={linePath} color={lineColor} style="stroke" strokeWidth={2.4} />
            {lineDotPaths.map((path, index) => (
              <Path key={`line-dot-${index}`} path={path} color={lineColor} />
            ))}
          </Canvas>
          {lineMeta.ticks.map((tick, index) => (
            <Text
              key={`line-tick-${tick}-${index}`}
              style={[
                styles.yAxisLabel,
                {
                  color: axisLabelColor,
                  top: getY(tick, lineMeta.domain, LINE_PADDING.top, linePlotHeight) - 7,
                },
              ]}
            >
              {formatAxisTick(tick)}
            </Text>
          ))}
          {lineTooltipPoint && lineTooltipLabel ? (
            <Animated.View
              style={[
                styles.lineTooltip,
                {
                  left: clamp(lineTooltipPoint.x - 58, LINE_PADDING.left + 4, CHART_W - 118),
                  top: clamp(lineTooltipPoint.y - 48, 2, LINE_H - 58),
                  backgroundColor: tooltipSurface,
                  borderColor: tooltipBorder,
                },
                lineTooltipStyle,
              ]}
            >
              <Text style={[styles.tooltipEyebrow, { color: axisLabelColor }]}>{lineTooltipLabel}</Text>
              <Text style={[styles.tooltipValue, { color: theme.colors.text }]}>{formatCurrency(lineTooltipValue)}</Text>
            </Animated.View>
          ) : null}
          {linePoints.map((point, index) => (
            <TouchableOpacity
              key={`line-touch-${months[index]}-${index}`}
              activeOpacity={0.88}
              onPress={() => handleSelectLinePoint(index)}
              style={[
                styles.pointTouchTarget,
                {
                  left: point.x - 18,
                  top: point.y - 18,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.axisRow}>
          {months.map((label, index) => (
            <TouchableOpacity
              key={`${label}-line-${index}`}
              activeOpacity={0.88}
              onPress={() => handleSelectMonthFromNavigation(index)}
              style={styles.axisItem}
            >
              <Text style={[styles.axisLabel, { color: axisLabelColor }]}>{label}</Text>
              <Text style={[styles.axisValue, { color: selectedIndex === index ? lineColor : axisLabelColor }]}>
                {formatPlainAmount(lineValues[index] ?? 0)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.chartSection}>
        <View style={styles.chartSurface}>
          <Canvas style={{ width: CHART_W, height: BAR_H }}>
            <Rect x={BAR_PADDING.left} y={BAR_PADDING.top} width={1} height={barPlotHeight} color={gridColor} />
            <Rect x={BAR_PADDING.left} y={BAR_PADDING.top + barPlotHeight} width={barPlotWidth} height={1} color={gridColor} />
            {barTicks.map((tick, index) => (
              <Rect
                key={`bar-grid-${tick}-${index}`}
                x={BAR_PADDING.left}
                y={getY(tick, barDomain, BAR_PADDING.top, barPlotHeight)}
                width={barPlotWidth}
                height={1}
                color={gridColor}
              />
            ))}
            {hasBarData
              ? months.map((_, index) => {
                  const groupX = BAR_PADDING.left + groupWidth * index + (groupWidth - selectedGroupWidth) / 2;
                  const incomeHeight = ((income[index] ?? 0) / barChartMax) * barPlotHeight;
                  const expenseHeight = ((expenses[index] ?? 0) / barChartMax) * barPlotHeight;
                  const incomeX = BAR_PADDING.left + groupWidth * index + (groupWidth - (barWidth * 2 + barGap)) / 2;
                  const expenseX = incomeX + barWidth + barGap;
                  const isSelected = index === selectedIndex;

                  return (
                    <Group key={`bar-group-${index}`}>
                      {isSelected ? (
                        <Rect
                          x={groupX}
                          y={BAR_PADDING.top}
                          width={selectedGroupWidth}
                          height={barPlotHeight}
                          color={selectionFill}
                        />
                      ) : null}
                      <Rect
                        x={incomeX}
                        y={BAR_PADDING.top + barPlotHeight - incomeHeight}
                        width={isSelected ? barWidth + 1.5 : barWidth}
                        height={Math.max(incomeHeight, 2)}
                        color={isSelected ? "#4DA3FF" : incomeColor}
                      />
                      <Rect
                        x={expenseX}
                        y={BAR_PADDING.top + barPlotHeight - expenseHeight}
                        width={isSelected ? barWidth + 1.5 : barWidth}
                        height={Math.max(expenseHeight, 2)}
                        color={isSelected ? "#D98665" : expenseColor}
                      />
                    </Group>
                  );
                })
              : null}
          </Canvas>
          {barTicks.map((tick, index) => (
            <Text
              key={`bar-tick-${tick}-${index}`}
              style={[
                styles.yAxisLabel,
                {
                  color: axisLabelColor,
                  top: getY(tick, barDomain, BAR_PADDING.top, barPlotHeight) - 7,
                },
              ]}
            >
              {formatAxisTick(tick)}
            </Text>
          ))}
          {hasBarData
            ? months.map((label, index) => (
                <TouchableOpacity
                  key={`${label}-bar-touch-${index}`}
                  activeOpacity={0.88}
                  onPress={() => handleSelectBarGroup(index)}
                  style={[
                    styles.barTouchTarget,
                    {
                      left: BAR_PADDING.left + groupWidth * index,
                      width: groupWidth,
                      top: BAR_PADDING.top,
                      height: barPlotHeight,
                    },
                  ]}
                />
              ))
            : null}
          {hasBarData && barTooltipIndex !== null ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.barTooltip,
                {
                  backgroundColor: tooltipSurface,
                  borderColor: tooltipBorder,
                },
                barTooltipStyle,
              ]}
            >
              <Text style={[styles.barTooltipText, { color: incomeColor }]}>Income {formatCurrency(barTooltipIncome)}</Text>
              <Text style={[styles.barTooltipText, { color: expenseColor }]}>Expenses {formatCurrency(barTooltipExpense)}</Text>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.barAxisRow}>
          {months.map((label, index) => (
            <TouchableOpacity
              key={`${label}-bar-${index}`}
              activeOpacity={0.88}
              onPress={() => handleSelectMonthFromNavigation(index)}
              style={styles.barAxisItem}
            >
              <Text style={[styles.axisLabel, { color: axisLabelColor }]}>{label}</Text>
              <Text style={[styles.barAxisValue, { color: incomeColor }]}>{formatPlainAmount(income[index] ?? 0)}</Text>
              <Text style={[styles.barAxisValue, { color: expenseColor }]}>{formatPlainAmount(expenses[index] ?? 0)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {hasPieSeries ? (
        <View style={styles.chartSection}>
          <View style={[styles.pieSummaryRow, { borderBottomColor: theme.colors.border }]}>
          </View>
          {hasPieData ? (
            <View style={styles.pieWrap}>
              <FinanceDonutChart
                size={PIE_SIZE}
                slices={pieEntries}
                focusedKey={selectedPieKey}
                onSelect={handleSelectPieCallout}
                variant="pie"
                showCallouts
                labelColor={theme.colors.text}
              />
            </View>
          ) : (
            <View style={[styles.emptyPieWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No distribution data</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>There is no distribution data for this window yet.</Text>
            </View>
          )}
          {pieTooltipEntry && hasPieData ? (
            <Animated.View
              style={[
                styles.pieFocusCard,
                {
                  backgroundColor: tooltipSurface,
                  borderColor: tooltipBorder,
                },
                pieTooltipStyle,
              ]}
            >
              <View style={[styles.pieFocusSwatch, { backgroundColor: pieTooltipEntry.color }]} />
              <View style={styles.pieFocusCopy}>
                <Text style={[styles.tooltipEyebrow, { color: axisLabelColor }]}>{pieTooltipEntry.label}</Text>
                <Text style={[styles.tooltipValue, { color: theme.colors.text }]}>{formatCurrency(pieTooltipEntry.value)}</Text>
              </View>
              <Text style={[styles.pieFocusShare, { color: theme.colors.text }]}>{formatPercentage(selectedPieShare)}</Text>
            </Animated.View>
          ) : null}
          <View style={styles.pieLegend}>
            {pieEntries.map((entry) => {
              const isSelected = entry.key === selectedPieKey;
              const share = hasPieData && pieTotal > 0 ? entry.value / pieTotal : 0;
              return (
                <TouchableOpacity
                  key={entry.key}
                  activeOpacity={0.88}
                  onPress={() => handleSelectPieLegend(entry.key)}
                  style={[
                    styles.pieLegendRow,
                    {
                      borderColor: isSelected ? entry.color : theme.colors.border,
                      backgroundColor: isSelected ? selectionFill : "transparent",
                    },
                  ]}
                >
                  <View style={[styles.pieLegendBadge, { backgroundColor: entry.color }]}>
                    <Text style={styles.pieLegendBadgeText}>{formatPercentage(share)}</Text>
                  </View>
                  <Text style={[styles.pieLegendLabel, { color: theme.colors.text }]} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  <Text style={[styles.pieLegendAmount, { color: theme.colors.text }]}>{formatCurrency(entry.value)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 10,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  monthPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  navButton: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  monthPillText: {
    fontSize: 16,
    fontWeight: "700",
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  balanceValue: {
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4,
  },
  chartSection: {
    marginTop: 18,
  },
  chartSurface: {
    position: "relative",
    alignSelf: "center",
  },
  yAxisLabel: {
    position: "absolute",
    left: 0,
    width: 28,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "600",
  },
  lineTooltip: {
    position: "absolute",
    minWidth: 112,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipEyebrow: {
    fontSize: 10,
    fontWeight: "700",
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  pointTouchTarget: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  axisRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 6,
  },
  axisItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  axisValue: {
    fontSize: 10,
    fontWeight: "600",
  },
  barTouchTarget: {
    position: "absolute",
  },
  barTooltip: {
    position: "absolute",
    left: "50%",
    top: BAR_PADDING.top + 72,
    width: 138,
    marginLeft: -69,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyBarTooltip: {
    top: BAR_PADDING.top + 80,
  },
  barTooltipText: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  barAxisRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  barAxisItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  barAxisValue: {
    fontSize: 10,
    fontWeight: "700",
  },
  pieSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  pieSummaryText: {
    fontSize: 16,
    fontWeight: "800",
  },
  pieWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
  },
  pieFocusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  pieFocusSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  pieFocusCopy: {
    flex: 1,
  },
  pieFocusShare: {
    fontSize: 13,
    fontWeight: "800",
  },
  pieLegend: {
    marginTop: 12,
    gap: 8,
  },
  pieLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pieLegendBadge: {
    minWidth: 46,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  pieLegendBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  pieLegendLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  pieLegendAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptyWrap: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPieWrap: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
});


