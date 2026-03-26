import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  InteractionManager,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  VictoryArea,
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryGroup,
  VictoryLine,
  VictoryPie,
  VictoryTooltip,
  createContainer,
} from 'victory-native';
import { Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, Download, X } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { formatDateDDMMYYYY, formatDateWithWeekday } from '@/utils/date';
import {
  computeNetWorthProgress,
  computeExpenseCategoryBreakdown,
  computeExpenseDistribution,
  computeQuickStats,
} from '@/src/domain/analytics';
import { computeStarterInvestmentTarget } from '@/src/domain/financial-intelligence';
import { deriveAccountBalance } from '@/src/domain/ledger';
import type { Transaction } from '@/types/transaction';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const chartPalette = {
  income: '#22C55E',
  expenses: '#EF4444',
  savings: '#3B82F6',
  investments: '#8B5CF6',
  debt: '#F97316',
  netWorth: '#60A5FA',
  growth: '#34D399',
  netFlow: '#FBBF24',
};

const categoryPalette = [
  '#60A5FA',
  '#F9A8D4',
  '#FCA5A5',
  '#A7F3D0',
  '#93C5FD',
  '#FDBA74',
  '#A78BFA',
  '#FCD34D',
];

const VoronoiCursorContainer = createContainer('voronoi', 'cursor') as React.ComponentType<any>;

type ExportableChartId =
  | 'net-worth-progress'
  | 'expense-distribution'
  | 'comparison-6-month'
  | 'spending-by-category'
  | 'net-worth-forecast';

type AnalyticsRangePreset = 'monthly' | 'sixMonths' | 'annually' | 'period';

const ANALYTICS_RANGE_OPTIONS: Array<{ key: AnalyticsRangePreset; label: string }> = [
  { key: 'monthly', label: 'Weekly / Monthly' },
  { key: 'sixMonths', label: 'Six Months Trend' },
  { key: 'annually', label: 'Annually' },
  { key: 'period', label: 'Period' },
];

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDayKey(date: Date): string {
  return `${toMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildRecentMonths(length: number): Date[] {
  const today = new Date();
  return Array.from({ length }, (_, index) => new Date(today.getFullYear(), today.getMonth() - (length - 1 - index), 1));
}

function formatPercentage(value: number): string {
  const percent = value * 100;
  const rounded = percent >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatSignedCurrency(formatCurrency: (value: number) => string, value: number): string {
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${roundCurrency(abs / 1_000_000_000)}b`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${roundCurrency(abs / 1_000_000)}m`;
  }
  if (abs >= 1_000) {
    return `${sign}${roundCurrency(abs / 1_000)}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

function formatShortMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function truncateLabel(label: string, maxLength = 10): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}...`;
}

function sanitizeFileSegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'chart';
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function countDaysInclusive(start: Date, end: Date): number {
  const startMs = startOfDay(start).getTime();
  const endMs = endOfDay(end).getTime();
  const diff = Math.max(0, endMs - startMs);
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

function countMonthsInclusive(start: Date, end: Date): number {
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  return Math.max(1, yearDiff * 12 + monthDiff + 1);
}

function buildMonthBuckets(start: Date, end: Date): Date[] {
  const bucketCount = countMonthsInclusive(start, end);
  return Array.from({ length: bucketCount }, (_, index) => {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  });
}

function estimateMonthsToTarget(
  current: number,
  target: number,
  monthlySavings: number,
  annualReturn: number
): number | null {
  if (!Number.isFinite(target) || target <= 0) {
    return null;
  }
  if (current >= target) {
    return 0;
  }
  if (monthlySavings <= 0 && annualReturn <= 0) {
    return null;
  }

  const monthlyRate = annualReturn / 12;
  let balance = current;
  let months = 0;

  while (balance < target && months < 600) {
    balance = balance * (1 + monthlyRate) + monthlySavings;
    months += 1;
  }

  return months < 600 ? months : null;
}

function formatDurationShort(months: number | null): string | null {
  if (months === null || !Number.isFinite(months)) {
    return null;
  }
  if (months <= 0) {
    return '0 mo';
  }
  if (months < 12) {
    return `${Math.max(1, Math.round(months))} mo`;
  }
  const years = months / 12;
  return `${roundCurrency(years)} yrs`;
}

function formatDurationLong(months: number | null): string | null {
  if (months === null || !Number.isFinite(months)) {
    return null;
  }
  if (months <= 0) {
    return '0 months';
  }
  if (months < 12) {
    const rounded = Math.max(1, Math.round(months));
    return `${rounded} months`;
  }
  const years = roundCurrency(months / 12);
  return `${years} years`;
}

function getChangeColor(value: number): string {
  if (value > 0.01) {
    return '#16A34A';
  }
  if (value < -0.01) {
    return '#DC2626';
  }
  return '#94A3B8';
}

function getFromAccountId(transaction: Transaction): string | undefined {
  return transaction.fromAccountId ?? transaction.fromAccount;
}

function getToAccountId(transaction: Transaction): string | undefined {
  return transaction.toAccountId ?? transaction.toAccount;
}

function computeTransactionNetWorthImpact(
  transaction: Transaction,
  activeAccountIds: Set<string>
): number {
  const fromAccountId = getFromAccountId(transaction);
  const toAccountId = getToAccountId(transaction);
  const debit = fromAccountId && activeAccountIds.has(fromAccountId) ? transaction.amount : 0;
  const credit = toAccountId && activeAccountIds.has(toAccountId) ? transaction.amount : 0;
  return roundCurrency(credit - debit);
}

interface MonthContributionItem {
  transaction: Transaction;
  netWorthImpact: number;
  fromAccountName: string | undefined;
  toAccountName: string | undefined;
}

interface MilestoneCard {
  id: string;
  title: string;
  targetLabel: string;
  currentLabel: string;
  target: number;
  current: number;
  progress: number;
  estimatedMonths?: number | null;
  insights?: string[];
  achieved?: boolean;
  tone?: 'positive' | 'warning';
  etaPrefix?: string;
}

function AnalyticsCategoryBlock({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryHeaderTopRow}>
          <View
            style={[
              styles.categoryEyebrowBadge,
              { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '22' },
            ]}
          >
            <Text style={[styles.categoryEyebrow, { color: theme.colors.primary }]}>{eyebrow}</Text>
          </View>
          <View style={[styles.categoryHeaderLine, { backgroundColor: theme.colors.primary + '18' }]} />
        </View>
        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.categorySubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function AnalyticsCategoryPlaceholder({
  eyebrow,
  title,
  subtitle,
  cardCount = 2,
  chartCardIndex = 0,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  cardCount?: number;
  chartCardIndex?: number;
}) {
  const { theme } = useTheme();

  return (
    <AnalyticsCategoryBlock eyebrow={eyebrow} title={title} subtitle={subtitle}>
      {Array.from({ length: cardCount }).map((_, index) => {
        const usesChartBlock = index === chartCardIndex;
        const detailLineStyle = index === 0 ? styles.loadingLineLong : styles.loadingLineMedium;

        return (
          <View
            key={`${title}-placeholder-${index}`}
            style={[
              styles.loadingCard,
              styles.inlineLoadingCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={[styles.loadingLineShort, { backgroundColor: theme.colors.border }]} />
            <View style={[detailLineStyle, { backgroundColor: theme.colors.border }]} />
            <View
              style={[
                usesChartBlock ? styles.loadingChartBlock : styles.loadingStatRow,
                { backgroundColor: theme.colors.border },
              ]}
            />
          </View>
        );
      })}
    </AnalyticsCategoryBlock>
  );
}

const AnalyticsContent = React.memo(function AnalyticsContent({ visibleStage }: { visibleStage: number }) {
  const { transactions, allTransactions, accounts, debtAccounts, formatCurrency, financialIntelligence } = useTransactionStore();
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const advisorInsights = financialIntelligence.insights ?? [];
  const budgetSuggestions = financialIntelligence.budgetSuggestions ?? [];
  const cashflowRunway = financialIntelligence.cashflowRunway;
  const netWorthSimulation = financialIntelligence.netWorthSimulation;
  const debtPayoffPlan = financialIntelligence.debtPayoff;
  const milestoneProgress = financialIntelligence.milestones;
  const chartCaptureRefs = useRef<Record<ExportableChartId, ViewShot | null>>({
    'net-worth-progress': null,
    'expense-distribution': null,
    'comparison-6-month': null,
    'spending-by-category': null,
    'net-worth-forecast': null,
  });
  const [exportingChartId, setExportingChartId] = useState<ExportableChartId | null>(null);
  const [selectedRange, setSelectedRange] = useState<AnalyticsRangePreset>('monthly');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [customEndDate, setCustomEndDate] = useState(() => endOfDay(new Date()));
  const [showCustomStartPicker, setShowCustomStartPicker] = useState(false);
  const [showCustomEndPicker, setShowCustomEndPicker] = useState(false);

  const netWorthForecastData = useMemo(() => {
    if (!netWorthSimulation) {
      return null;
    }

    const baseDate = new Date();
    const buildForecastDate = (yearOffset: number) =>
      new Date(baseDate.getFullYear() + yearOffset, baseDate.getMonth(), baseDate.getDate());

    const data = netWorthSimulation.points.map((point) => ({
      x: buildForecastDate(point.year),
      y: point.netWorth,
    }));

    const tickValues = netWorthSimulation.points
      .filter((_, index) => index % 2 === 0)
      .map((point) => buildForecastDate(point.year));

    return {
      data,
      tickValues,
      projectedDate: data[data.length - 1]?.x ?? buildForecastDate(netWorthSimulation.years),
    };
  }, [netWorthSimulation]);

  const chartWidth = Math.max(screenWidth - 32, 260);
  const gridColor = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const axisLabelColor = theme.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.6)';
  const cardBackground = theme.isDark ? '#0F172A' : '#FFFFFF';
  const secondarySurface = theme.isDark ? 'rgba(15,23,42,0.82)' : '#F8FAFC';
  const analyticsCanvasBackground = theme.isDark ? 'rgba(15,23,42,0.92)' : '#F8FAFC';
  const softBorderColor = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const tooltipFlyoutStyle = useMemo(
    () => ({
      fill: theme.isDark ? '#0F172A' : '#FFFFFF',
      stroke: theme.colors.border,
      strokeWidth: 1,
    }),
    [theme.colors.border, theme.isDark]
  );
  const tooltipTextStyle = useMemo(
    () => ({
      fill: theme.isDark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.8)',
      fontSize: 11,
      fontWeight: '600',
    }),
    [theme.isDark]
  );
  const chartPadding = useMemo(() => ({ top: 16, bottom: 40, left: 50, right: 16 }), []);
  const chartAnimation = useMemo(() => ({ duration: 900, easing: 'cubicOut' as const }), []);
  const chartCaptureOptions = useMemo(() => ({ format: 'png' as const, quality: 1, result: 'tmpfile' as const }), []);
  const setChartCaptureRef = (chartId: ExportableChartId) => (ref: ViewShot | null) => {
    chartCaptureRefs.current[chartId] = ref;
  };
  const today = new Date();
  const activeRange = useMemo(() => {
    const normalizedCustomStart = startOfDay(customStartDate);
    const normalizedCustomEnd = endOfDay(customEndDate);

    switch (selectedRange) {
      case 'sixMonths':
        return {
          label: 'Six Months Trend',
          badge: '6-month view',
          start: new Date(today.getFullYear(), today.getMonth() - 5, 1),
          end: endOfDay(today),
          summaryTitle: 'Last 6 Months',
          summaryCaption: 'Income, expenses, and savings across the last six months.',
          comparisonTitle: '6-Month Income vs Expenses',
          comparisonSummaryLabel: 'net over 6 months',
          distributionCaption: 'Expense mix by category for the last 6 months.',
          footerTransactionLabel: 'in the last 6 months',
          topCategoryLeadText: 'leading across the last 6 months.',
          netStatLabel: 'Net in 6 Months',
          monthsWindow: 6,
          showComparison: true,
        };
      case 'annually':
        return {
          label: 'Annually',
          badge: 'Annual view',
          start: new Date(today.getFullYear(), today.getMonth() - 11, 1),
          end: endOfDay(today),
          summaryTitle: 'Last 12 Months',
          summaryCaption: 'Income, expenses, and savings across the last twelve months.',
          comparisonTitle: '12-Month Income vs Expenses',
          comparisonSummaryLabel: 'net over 12 months',
          distributionCaption: 'Expense mix by category for the last 12 months.',
          footerTransactionLabel: 'in the last 12 months',
          topCategoryLeadText: 'leading across the last 12 months.',
          netStatLabel: 'Net in 12 Months',
          monthsWindow: 12,
          showComparison: true,
        };
      case 'period': {
        const periodMonths = countMonthsInclusive(normalizedCustomStart, normalizedCustomEnd);
        return {
          label: 'Period',
          badge: 'Custom period',
          start: normalizedCustomStart,
          end: normalizedCustomEnd,
          summaryTitle: 'Selected Period',
          summaryCaption: `${formatDateDDMMYYYY(normalizedCustomStart)} to ${formatDateDDMMYYYY(normalizedCustomEnd)}.`,
          comparisonTitle: periodMonths > 1 ? `${periodMonths}-Month Income vs Expenses` : 'Period Income vs Expenses',
          comparisonSummaryLabel: 'net in selected period',
          distributionCaption: 'Expense mix by category for the selected period.',
          footerTransactionLabel: 'in the selected period',
          topCategoryLeadText: 'leading in the selected period.',
          netStatLabel: 'Net in Period',
          monthsWindow: Math.max(1, Math.min(24, periodMonths)),
          showComparison: periodMonths > 1,
        };
      }
      case 'monthly':
      default:
        return {
          label: 'Weekly / Monthly',
          badge: 'Weekly / monthly view',
          start: new Date(today.getFullYear(), today.getMonth(), 1),
          end: endOfDay(today),
          summaryTitle: 'This Month',
          summaryCaption: `Income, expenses, and savings for ${formatShortMonthLabel(today)}.`,
          comparisonTitle: '6-Month Income vs Expenses',
          comparisonSummaryLabel: 'net this month',
          distributionCaption: 'Current-month expense mix by category.',
          footerTransactionLabel: 'this month',
          topCategoryLeadText: 'leading this month.',
          netStatLabel: 'Net This Month',
          monthsWindow: 6,
          showComparison: false,
        };
    }
  }, [customEndDate, customStartDate, selectedRange, today]);

  const activeRangeStartMs = activeRange.start.getTime();
  const activeRangeEndMs = activeRange.end.getTime();

  const selectedTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const time = transaction.date.getTime();
        return time >= activeRangeStartMs && time <= activeRangeEndMs;
      }),
    [activeRangeEndMs, activeRangeStartMs, transactions]
  );

  const elapsedDays = useMemo(
    () => countDaysInclusive(activeRange.start, activeRange.end),
    [activeRange.end, activeRange.start]
  );

  const quickStats = useMemo(
    () => computeQuickStats(selectedTransactions, elapsedDays),
    [elapsedDays, selectedTransactions]
  );

  const monthlyIncome = quickStats.income;
  const monthlyExpenses = quickStats.expenses;

  const categorySpending = useMemo(
    () => computeExpenseCategoryBreakdown(selectedTransactions),
    [selectedTransactions]
  );

  const categoryBarData = useMemo(() => {
    return categorySpending
      .slice()
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5)
      .map((category, index) => ({
        x: truncateLabel(category.categoryName, 10),
        y: category.amount,
        fullLabel: category.categoryName,
        fill: category.color ?? categoryPalette[index % categoryPalette.length],
      }));
  }, [categorySpending]);

  const topCategory = useMemo(() => {
    if (categorySpending.length === 0) {
      return null;
    }

    return categorySpending.reduce((top, item) => (item.amount > top.amount ? item : top), categorySpending[0]);
  }, [categorySpending]);

  const expenseDistribution = useMemo(
    () => computeExpenseDistribution(categorySpending, 5),
    [categorySpending]
  );

  const expenseDonutData = useMemo(
    () =>
      expenseDistribution.map((entry, index) => ({
        x: entry.name,
        y: entry.amount,
        color: entry.color ?? categoryPalette[index % categoryPalette.length],
        share: entry.share,
      })),
    [expenseDistribution]
  );

  const expenseDonutColors = useMemo(
    () => expenseDonutData.map((entry) => entry.color),
    [expenseDonutData]
  );

  const comparisonMonths = useMemo(() => {
    if (!activeRange.showComparison) {
      return [] as Date[];
    }

    if (selectedRange === 'sixMonths') {
      return buildRecentMonths(6);
    }

    if (selectedRange === 'annually') {
      return buildRecentMonths(12);
    }

    return buildMonthBuckets(activeRange.start, activeRange.end);
  }, [activeRange.end, activeRange.showComparison, activeRange.start, selectedRange]);

  const comparisonSeries = useMemo(() => {
    if (comparisonMonths.length === 0) {
      return {
        labels: [] as string[],
        expenseData: [] as Array<{ x: string; y: number }>,
        incomeData: [] as Array<{ x: string; y: number }>,
        totalIncome: 0,
        totalExpenses: 0,
      };
    }

    const firstMonth = comparisonMonths[0];
    const lastMonth = comparisonMonths[comparisonMonths.length - 1];
    const includeYear = comparisonMonths.length > 12 || firstMonth.getFullYear() !== lastMonth.getFullYear();
    const bucketLabels = comparisonMonths.map((month) =>
      month.toLocaleDateString('en-US', includeYear ? { month: 'short', year: '2-digit' } : { month: 'short' })
    );
    const buckets = comparisonMonths.map((month, index) => ({
      key: toMonthKey(month),
      label: bucketLabels[index] ?? formatShortMonthLabel(month),
      income: 0,
      expenses: 0,
    }));
    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    for (const transaction of selectedTransactions) {
      if (transaction.type !== 'income' && transaction.type !== 'expense') {
        continue;
      }

      const bucket = bucketMap.get(toMonthKey(transaction.date));
      if (!bucket) {
        continue;
      }

      if (transaction.type === 'income') {
        bucket.income += transaction.amount;
      } else {
        bucket.expenses += transaction.amount;
      }
    }

    return {
      labels: buckets.map((bucket) => bucket.label),
      expenseData: buckets.map((bucket) => ({ x: bucket.label, y: roundCurrency(bucket.expenses) })),
      incomeData: buckets.map((bucket) => ({ x: bucket.label, y: roundCurrency(bucket.income) })),
      totalIncome: roundCurrency(buckets.reduce((sum, bucket) => sum + bucket.income, 0)),
      totalExpenses: roundCurrency(buckets.reduce((sum, bucket) => sum + bucket.expenses, 0)),
    };
  }, [comparisonMonths, selectedTransactions]);

  const netWorthProgress = useMemo(
    () => computeNetWorthProgress(accounts, allTransactions, activeRange.monthsWindow, activeRange.end),
    [accounts, activeRange.end, activeRange.monthsWindow, allTransactions]
  );

  const accountBalanceById = useMemo(() => {
    const map = new Map<string, number>();
    for (const account of accounts) {
      map.set(account.id, deriveAccountBalance(account.id, allTransactions));
    }
    return map;
  }, [accounts, allTransactions]);

  const liquidBalance = useMemo(
    () =>
      accounts
        .filter(
          (account) =>
            account.isActive !== false && ['checking', 'savings', 'cash'].includes(account.type)
        )
        .reduce((sum, account) => sum + (accountBalanceById.get(account.id) ?? 0), 0),
    [accounts, accountBalanceById]
  );

  const investmentBalance = useMemo(
    () =>
      accounts
        .filter((account) => account.isActive !== false && account.type === 'investment')
        .reduce((sum, account) => sum + (accountBalanceById.get(account.id) ?? 0), 0),
    [accounts, accountBalanceById]
  );

  const averageMonthlyExpenses = useMemo(() => {
    const recentMonths = buildRecentMonths(3);
    if (recentMonths.length === 0) {
      return 0;
    }

    const totals = recentMonths.map((month) => {
      const key = toMonthKey(month);
      return transactions
        .filter((transaction) => transaction.type === 'expense' && toMonthKey(transaction.date) === key)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    });

    return roundCurrency(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  }, [transactions]);

  const averageMonthlyIncome = useMemo(() => {
    const recentMonths = buildRecentMonths(3);
    if (recentMonths.length === 0) {
      return 0;
    }

    const totals = recentMonths.map((month) => {
      const key = toMonthKey(month);
      return transactions
        .filter((transaction) => transaction.type === 'income' && toMonthKey(transaction.date) === key)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    });

    return roundCurrency(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  }, [transactions]);

  const monthlySavings = Math.max(0, netWorthSimulation?.monthlySavings ?? (monthlyIncome - monthlyExpenses));
  const annualReturn = netWorthSimulation?.annualReturn ?? 0.05;

  const emergencyFundTarget = roundCurrency(averageMonthlyExpenses * 6);
  const emergencyFundProgress = emergencyFundTarget > 0 ? clamp(liquidBalance / emergencyFundTarget) : 0;
  const emergencyFundMonths = averageMonthlyExpenses > 0
    ? roundCurrency(liquidBalance / averageMonthlyExpenses)
    : null;
  const emergencyFundEtaMonths = emergencyFundTarget > 0
    ? estimateMonthsToTarget(liquidBalance, emergencyFundTarget, monthlySavings, 0)
    : null;

  const debtBalance = useMemo(
    () =>
      debtAccounts
        .filter((account) => account.direction === 'borrowed')
        .reduce((sum, account) => sum + account.balance, 0),
    [debtAccounts]
  );

  const debtPayments = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.type === 'expense' && transaction.debtPayment)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions]
  );

  const originalDebt = Math.max(debtBalance + debtPayments, debtBalance);
  const debtProgress = originalDebt > 0 ? clamp(1 - debtBalance / originalDebt) : 1;
  const debtEtaMonths = debtPayoffPlan ? debtPayoffPlan[debtPayoffPlan.recommendedStrategy].months : null;

  const investmentTarget = useMemo(
    () => computeStarterInvestmentTarget(netWorthProgress.currentNetWorth, averageMonthlyIncome, averageMonthlyExpenses),
    [averageMonthlyExpenses, averageMonthlyIncome, netWorthProgress.currentNetWorth]
  );
  const investmentProgress = investmentTarget > 0 ? clamp(investmentBalance / investmentTarget) : 0;
  const investmentEtaMonths = investmentTarget > 0
    ? estimateMonthsToTarget(investmentBalance, investmentTarget, monthlySavings, annualReturn)
    : null;

  const netWorthTarget = milestoneProgress?.nextMilestone ?? null;
  const netWorthMilestoneProgress = netWorthTarget
    ? clamp(netWorthProgress.currentNetWorth / netWorthTarget)
    : 1;
  const netWorthEtaMonths = netWorthTarget
    ? estimateMonthsToTarget(netWorthProgress.currentNetWorth, netWorthTarget, monthlySavings, annualReturn)
    : null;

  const financialIndependenceTarget = roundCurrency(averageMonthlyExpenses * 12 * 25);
  const financialIndependenceProgress = financialIndependenceTarget > 0
    ? clamp(investmentBalance / financialIndependenceTarget)
    : 0;
  const financialIndependenceEtaMonths = financialIndependenceTarget > 0
    ? estimateMonthsToTarget(investmentBalance, financialIndependenceTarget, monthlySavings, annualReturn)
    : null;

  const milestoneCards = useMemo(() => {
    const cards: MilestoneCard[] = [];

    const emergencyInsights: string[] = [];
    if (emergencyFundMonths !== null) {
      emergencyInsights.push(`You have ${emergencyFundMonths} months of emergency savings. Goal: 6 months.`);
    } else {
      emergencyInsights.push('Track at least three months of expenses to estimate your emergency fund target.');
    }

    if (emergencyFundTarget > 0 && monthlySavings > 0) {
      const baseMonths = emergencyFundEtaMonths;
      const boostedMonths = estimateMonthsToTarget(
        liquidBalance,
        emergencyFundTarget,
        monthlySavings + 200,
        0
      );
      if (baseMonths !== null && boostedMonths !== null && baseMonths > boostedMonths) {
        const diff = baseMonths - boostedMonths;
        const diffText = formatDurationLong(diff);
        if (diffText) {
          emergencyInsights.push(`Saving ${formatCurrency(200)} more per month could reach your emergency fund ${diffText} earlier.`);
        }
      }
    }

    cards.push({
      id: 'emergency-fund',
      title: 'Emergency Fund',
      targetLabel: 'Target',
      currentLabel: 'Saved',
      target: emergencyFundTarget,
      current: liquidBalance,
      progress: emergencyFundProgress,
      estimatedMonths: emergencyFundEtaMonths,
      insights: emergencyInsights,
      achieved: emergencyFundProgress >= 1 && emergencyFundTarget > 0,
      etaPrefix: 'At recent pace',
    });

    const debtInsights: string[] = [];
    if (debtBalance <= 0) {
      debtInsights.push('No active debt detected. Great job staying debt-free.');
    } else if (debtEtaMonths !== null) {
      const etaText = formatDurationLong(debtEtaMonths);
      if (etaText) {
        debtInsights.push(`You could become debt-free in ${etaText} if you maintain your current payments.`);
      }
    }

    cards.push({
      id: 'debt-freedom',
      title: 'Debt Freedom',
      targetLabel: 'Original Debt',
      currentLabel: 'Remaining',
      target: originalDebt,
      current: debtBalance,
      progress: debtProgress,
      estimatedMonths: debtEtaMonths,
      insights: debtInsights,
      achieved: debtBalance <= 0,
      tone: debtBalance > 0 ? 'warning' : 'positive',
      etaPrefix: 'At payment pace',
    });

    const investmentInsights: string[] = [];
    if (investmentBalance < investmentTarget) {
      investmentInsights.push(`Reaching ${formatCurrency(investmentTarget)} gives you a practical base for long-term investing.`);
    } else {
      investmentInsights.push(`You have already built a starter investment base above ${formatCurrency(investmentTarget)}.`);
    }

    cards.push({
      id: 'first-investment',
      title: 'Starter Investment',
      targetLabel: 'Target',
      currentLabel: 'Invested',
      target: investmentTarget,
      current: investmentBalance,
      progress: investmentProgress,
      estimatedMonths: investmentEtaMonths,
      insights: investmentInsights,
      achieved: investmentProgress >= 1,
      etaPrefix: 'At recent pace',
    });

    const netWorthInsights: string[] = [];
    if (!netWorthTarget) {
      netWorthInsights.push('You have cleared the current net worth milestone ladder.');
    } else if (netWorthEtaMonths !== null) {
      const etaText = formatDurationLong(netWorthEtaMonths);
      if (etaText) {
        netWorthInsights.push(`At your recent saving pace, you could reach ${formatCurrency(netWorthTarget)} in about ${etaText}.`);
      }
    }

    cards.push({
      id: 'net-worth',
      title: 'Net Worth Milestone',
      targetLabel: 'Next Milestone',
      currentLabel: 'Current Net Worth',
      target: netWorthTarget ?? netWorthProgress.currentNetWorth,
      current: netWorthProgress.currentNetWorth,
      progress: netWorthMilestoneProgress,
      estimatedMonths: netWorthEtaMonths,
      insights: netWorthInsights,
      achieved: !netWorthTarget,
      etaPrefix: 'At recent pace',
    });

    const fiInsights: string[] = [];
    if (financialIndependenceTarget <= 0) {
      fiInsights.push('Track expenses to estimate your financial independence target.');
    } else if (financialIndependenceEtaMonths !== null) {
      const etaText = formatDurationLong(financialIndependenceEtaMonths);
      if (etaText) {
        fiInsights.push(`Your investments could support annual expenses in about ${etaText}.`);
      }
    }

    if (financialIndependenceTarget > 0 && monthlySavings > 0) {
      const baseMonths = financialIndependenceEtaMonths;
      const boostedMonths = estimateMonthsToTarget(
        investmentBalance,
        financialIndependenceTarget,
        monthlySavings + 100,
        annualReturn
      );
      if (baseMonths !== null && boostedMonths !== null && baseMonths > boostedMonths) {
        const diff = baseMonths - boostedMonths;
        const diffText = formatDurationLong(diff);
        if (diffText) {
          fiInsights.push(`Investing ${formatCurrency(100)} more per month could reach financial independence ${diffText} earlier.`);
        }
      }
    }

    cards.push({
      id: 'financial-independence',
      title: 'Financial Independence',
      targetLabel: 'Target',
      currentLabel: 'Invested',
      target: financialIndependenceTarget,
      current: investmentBalance,
      progress: financialIndependenceProgress,
      estimatedMonths: financialIndependenceEtaMonths,
      insights: fiInsights,
      achieved: financialIndependenceProgress >= 1 && financialIndependenceTarget > 0,
      etaPrefix: 'At recent pace',
    });

    return cards;
  }, [
    annualReturn,
    debtBalance,
    debtEtaMonths,
    emergencyFundEtaMonths,
    emergencyFundMonths,
    emergencyFundProgress,
    emergencyFundTarget,
    financialIndependenceEtaMonths,
    financialIndependenceProgress,
    financialIndependenceTarget,
    formatCurrency,
    investmentBalance,
    investmentEtaMonths,
    investmentProgress,
    investmentTarget,
    liquidBalance,
    milestoneProgress,
    monthlySavings,
    netWorthEtaMonths,
    netWorthMilestoneProgress,
    netWorthProgress.currentNetWorth,
    netWorthTarget,
    originalDebt,
  ]);

  const activeAccountIds = useMemo(
    () => new Set(accounts.filter((account) => account.isActive !== false).map((account) => account.id as string)),
    [accounts]
  );

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  const monthlyNetFlowByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const transaction of transactions) {
      const key = toMonthKey(transaction.date);
      const current = map.get(key) ?? 0;
      if (transaction.type === 'income') {
        map.set(key, current + transaction.amount);
      } else if (transaction.type === 'expense') {
        map.set(key, current - transaction.amount);
      } else {
        map.set(key, current);
      }
    }
    return map;
  }, [transactions]);

  const cumulativeNetFlow = useMemo(() => {
    let running = 0;
    return netWorthProgress.points.map((point) => {
      const monthNetFlow = monthlyNetFlowByMonth.get(point.month) ?? 0;
      running += monthNetFlow;
      return roundCurrency(running);
    });
  }, [monthlyNetFlowByMonth, netWorthProgress.points]);

  const netWorthSeries = useMemo(() => {
    const dates = netWorthProgress.points.map((point) => {
      const [year, month] = point.month.split('-').map(Number);
      return new Date(year, (month ?? 1) - 1, 1);
    });

    return {
      netWorthData: dates.map((date, index) => ({
        x: date,
        y: netWorthProgress.netWorth[index] ?? 0,
      })),
      growthData: dates.map((date, index) => ({
        x: date,
        y: netWorthProgress.cumulativeGrowth[index] ?? 0,
      })),
      flowData: dates.map((date, index) => ({
        x: date,
        y: cumulativeNetFlow[index] ?? 0,
      })),
      tickValues: dates.filter((_, index) => index % 2 === 0),
    };
  }, [cumulativeNetFlow, netWorthProgress]);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [showMonthDrillDown, setShowMonthDrillDown] = useState(false);

  useEffect(() => {
    if (netWorthProgress.points.length === 0) {
      setSelectedMonthIndex(0);
      return;
    }
    setSelectedMonthIndex(netWorthProgress.points.length - 1);
  }, [netWorthProgress.points.length]);

  const hasActiveAccounts = useMemo(
    () => accounts.some((account) => account.isActive !== false),
    [accounts]
  );

  const safeSelectedMonthIndex = Math.min(
    selectedMonthIndex,
    Math.max(0, netWorthProgress.points.length - 1)
  );

  const selectedMonthPoint = netWorthProgress.points[safeSelectedMonthIndex];
  const selectedMonthChange = netWorthProgress.monthOverMonthChange[safeSelectedMonthIndex] ?? 0;
  const selectedMonthCumulativeGrowth = netWorthProgress.cumulativeGrowth[safeSelectedMonthIndex] ?? 0;
  const selectedMonthCumulativeNetFlow = cumulativeNetFlow[safeSelectedMonthIndex] ?? 0;

  const netWorthTrendText = useMemo(() => {
    if (netWorthProgress.monthlyChangeRate === null) {
      return `${formatSignedCurrency(formatCurrency, netWorthProgress.monthlyChange)} vs previous month`;
    }

    return `${formatSignedCurrency(formatCurrency, netWorthProgress.monthlyChange)} (${formatPercentage(netWorthProgress.monthlyChangeRate)})`;
  }, [formatCurrency, netWorthProgress.monthlyChange, netWorthProgress.monthlyChangeRate]);

  const netWorthGrowthText = useMemo(
    () => formatSignedCurrency(formatCurrency, netWorthProgress.currentCumulativeGrowth),
    [formatCurrency, netWorthProgress.currentCumulativeGrowth]
  );

  const netFlowOverlayText = useMemo(
    () => formatSignedCurrency(formatCurrency, cumulativeNetFlow.at(-1) ?? 0),
    [cumulativeNetFlow, formatCurrency]
  );

  const savingsRate = useMemo(() => {
    if (monthlyIncome <= 0) {
      return 0;
    }
    return (monthlyIncome - monthlyExpenses) / monthlyIncome;
  }, [monthlyExpenses, monthlyIncome]);

  const monthContributionItems = useMemo(() => {
    if (!selectedMonthPoint) {
      return [] as MonthContributionItem[];
    }

    return transactions
      .filter((transaction) => toMonthKey(transaction.date) === selectedMonthPoint.month)
      .map((transaction) => {
        const fromAccountId = getFromAccountId(transaction);
        const toAccountId = getToAccountId(transaction);

        return {
          transaction,
          netWorthImpact: computeTransactionNetWorthImpact(transaction, activeAccountIds),
          fromAccountName: fromAccountId ? accountNameById.get(fromAccountId) : undefined,
          toAccountName: toAccountId ? accountNameById.get(toAccountId) : undefined,
        };
      })
      .sort((left, right) => right.transaction.date.getTime() - left.transaction.date.getTime());
  }, [accountNameById, activeAccountIds, selectedMonthPoint, transactions]);

  const monthContributionSummary = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let netWorthImpact = 0;

    for (const item of monthContributionItems) {
      if (item.transaction.type === 'income') {
        income += item.transaction.amount;
      } else if (item.transaction.type === 'expense') {
        expenses += item.transaction.amount;
      }
      netWorthImpact += item.netWorthImpact;
    }

    return {
      income: roundCurrency(income),
      expenses: roundCurrency(expenses),
      netFlow: roundCurrency(income - expenses),
      netWorthImpact: roundCurrency(netWorthImpact),
    };
  }, [monthContributionItems]);

  const hasComparisonData = useMemo(
    () =>
      activeRange.showComparison && (
        comparisonSeries.expenseData.some((point) => point.y !== 0) ||
        comparisonSeries.incomeData.some((point) => point.y !== 0)
      ),
    [activeRange.showComparison, comparisonSeries]
  );

  const hasExpenseDistributionData = expenseDistribution.length > 0;
  const hasCategoryBreakdownData = categoryBarData.length > 0;
  const hasSpendingTrendCharts =
    hasExpenseDistributionData || hasComparisonData || hasCategoryBreakdownData;

  const handleExportChart = async (chartId: ExportableChartId, title: string) => {
    if (exportingChartId) {
      return;
    }

    const chartRef = chartCaptureRefs.current[chartId];
    if (!chartRef?.capture) {
      Alert.alert('Export unavailable', 'This chart is not ready to export yet.');
      return;
    }

    setExportingChartId(chartId);

    try {
      const captureUri = await chartRef.capture();
      if (!captureUri) {
        throw new Error('Unable to create a PNG for this chart.');
      }

      const fileName = `analytics-${sanitizeFileSegment(title)}-${Date.now()}.png`;
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      let exportUri = captureUri;

      if (baseDir) {
        exportUri = `${baseDir}${fileName}`;
        await FileSystem.deleteAsync(exportUri, { idempotent: true }).catch(() => {});
        if (exportUri !== captureUri) {
          await FileSystem.copyAsync({ from: captureUri, to: exportUri });
        }
      }

      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permission.granted && permission.directoryUri) {
          const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permission.directoryUri,
            fileName,
            'image/png'
          );
          const payload = await FileSystem.readAsStringAsync(exportUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(destinationUri, payload, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Alert.alert('Chart saved', `${title} was saved as a PNG file.`);
          return;
        }
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('PNG sharing is not available on this device.');
      }

      await Sharing.shareAsync(exportUri, {
        dialogTitle: `Save ${title}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
      Alert.alert('Chart ready', `${title} is ready to save or share as a PNG file.`);
    } catch (error) {
      console.error('Failed to export analytics chart:', error);
      Alert.alert(
        'Export Failed',
        error instanceof Error ? error.message : 'Unable to export chart right now. Please try again.'
      );
    } finally {
      setExportingChartId(null);
    }
  };

  const renderChartExportAction = (
    chartId: ExportableChartId,
    title: string,
    disabled = false
  ) => {
    const isExporting = exportingChartId === chartId;
    const shouldDisable = disabled || (exportingChartId !== null && !isExporting);
    const tintColor = shouldDisable ? theme.colors.textSecondary : theme.colors.primary;

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Download ${title} as PNG`}
        style={[
          styles.chartExportButton,
          { backgroundColor: secondarySurface, borderColor: theme.colors.border },
          shouldDisable && styles.chartExportButtonDisabled,
        ]}
        disabled={shouldDisable}
        onPress={() => handleExportChart(chartId, title)}
      >
        {isExporting ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Download size={15} color={tintColor} />
        )}
        <Text style={[styles.chartExportButtonText, { color: tintColor }]}>PNG</Text>
      </TouchableOpacity>
    );
  };

  const handleRangeSelect = (range: AnalyticsRangePreset) => {
    setSelectedRange(range);
    setShowRangeMenu(false);
  };

  const handleCustomStartDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowCustomStartPicker(false);
    if (!selectedDate) {
      return;
    }

    const nextStart = startOfDay(selectedDate);
    setCustomStartDate(nextStart);

    if (nextStart.getTime() > customEndDate.getTime()) {
      setCustomEndDate(endOfDay(selectedDate));
    }
  };

  const handleCustomEndDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowCustomEndPicker(false);
    if (!selectedDate) {
      return;
    }

    const nextEnd = endOfDay(selectedDate);
    setCustomEndDate(nextEnd);

    if (nextEnd.getTime() < customStartDate.getTime()) {
      setCustomStartDate(startOfDay(selectedDate));
    }
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setShowRangeMenu(false)}
      >
        <View style={[styles.analyticsHero, { backgroundColor: cardBackground, borderColor: softBorderColor }]}>
          <View style={[styles.analyticsHeroOrb, { backgroundColor: theme.colors.primary + '14' }]} />
          <View style={styles.analyticsHeroContent}>
            <View style={styles.analyticsHeroTopRow}>
              <View style={styles.analyticsHeroHeading}>
                <View
                  style={[
                    styles.analyticsHeroBadge,
                    { backgroundColor: secondarySurface, borderColor: softBorderColor },
                  ]}
                >
                  <Text style={[styles.analyticsHeroBadgeText, { color: theme.colors.primary }]}>{activeRange.badge}</Text>
                </View>
                <Text style={[styles.analyticsHeroTitle, { color: theme.colors.text }]}>Analytics</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Select analytics range"
                style={[
                  styles.analyticsRangeButton,
                  { backgroundColor: secondarySurface, borderColor: softBorderColor },
                ]}
                onPress={() => setShowRangeMenu((current) => !current)}
              >
                <Text style={[styles.analyticsRangeButtonText, { color: theme.colors.text }]}>{activeRange.label}</Text>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.analyticsHeroSubtitle, { color: theme.colors.textSecondary }]}>Choose a timeframe to focus the charts, summaries, and insights.</Text>
            {showRangeMenu ? (
              <View style={[styles.analyticsRangeMenu, { backgroundColor: cardBackground, borderColor: softBorderColor }]}>
                {ANALYTICS_RANGE_OPTIONS.map((option) => {
                  const isActive = option.key === selectedRange;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      accessibilityRole="button"
                      style={[
                        styles.analyticsRangeMenuItem,
                        isActive && { backgroundColor: theme.colors.primary + '12' },
                      ]}
                      onPress={() => handleRangeSelect(option.key)}
                    >
                      <Text
                        style={[
                          styles.analyticsRangeMenuText,
                          { color: isActive ? theme.colors.primary : theme.colors.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {isActive ? <Check size={15} color={theme.colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            {selectedRange === 'period' ? (
              <View style={styles.analyticsPeriodRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.analyticsPeriodField,
                    { backgroundColor: secondarySurface, borderColor: softBorderColor },
                  ]}
                  onPress={() => setShowCustomStartPicker(true)}
                >
                  <Text style={[styles.analyticsPeriodLabel, { color: theme.colors.textSecondary }]}>From</Text>
                  <Text style={[styles.analyticsPeriodValue, { color: theme.colors.text }]}>{formatDateDDMMYYYY(customStartDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.analyticsPeriodField,
                    { backgroundColor: secondarySurface, borderColor: softBorderColor },
                  ]}
                  onPress={() => setShowCustomEndPicker(true)}
                >
                  <Text style={[styles.analyticsPeriodLabel, { color: theme.colors.textSecondary }]}>To</Text>
                  <Text style={[styles.analyticsPeriodValue, { color: theme.colors.text }]}>{formatDateDDMMYYYY(customEndDate)}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.analyticsHeroStats}>
              <View
                style={[
                  styles.analyticsHeroStat,
                  { backgroundColor: secondarySurface, borderColor: softBorderColor },
                ]}
              >
                <Text style={[styles.analyticsHeroStatLabel, { color: theme.colors.textSecondary }]}>Net Worth</Text>
                <AdaptiveAmountText
                  style={[styles.analyticsHeroStatValue, { color: theme.colors.text }]}
                  minFontSize={14}
                  value={formatCurrency(netWorthProgress.currentNetWorth)}
                />
              </View>
              <View
                style={[
                  styles.analyticsHeroStat,
                  { backgroundColor: secondarySurface, borderColor: softBorderColor },
                ]}
              >
                <Text style={[styles.analyticsHeroStatLabel, { color: theme.colors.textSecondary }]}>{activeRange.netStatLabel}</Text>
                <AdaptiveAmountText
                  style={[
                    styles.analyticsHeroStatValue,
                    quickStats.netAmount >= 0 ? styles.incomeText : styles.expenseText,
                  ]}
                  minFontSize={14}
                  value={formatSignedCurrency(formatCurrency, quickStats.netAmount)}
                />
              </View>
              <View
                style={[
                  styles.analyticsHeroStat,
                  { backgroundColor: secondarySurface, borderColor: softBorderColor },
                ]}
              >
                <Text style={[styles.analyticsHeroStatLabel, { color: theme.colors.textSecondary }]}>Savings Rate</Text>
                <Text style={[styles.analyticsHeroStatValue, { color: theme.colors.text }]}>
                  {formatPercentage(savingsRate)}
                </Text>
              </View>
            </View>
            <View style={styles.analyticsHeroFooter}>
              <Text style={[styles.analyticsHeroFooterText, { color: theme.colors.textSecondary }]}>
                {quickStats.transactionCount} transaction{quickStats.transactionCount === 1 ? '' : 's'} {activeRange.footerTransactionLabel}
              </Text>
              <Text style={[styles.analyticsHeroFooterText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {topCategory ? `${topCategory.categoryName} is ${activeRange.topCategoryLeadText}` : 'Add more activity to unlock deeper patterns.'}
              </Text>
            </View>
          </View>
        </View>
      <AnalyticsCategoryBlock
        eyebrow="Snapshot"
        title="Overview"
        subtitle="Core balances and high-level performance for the current period."
      >
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.summaryCardHeader}>
          <View style={styles.summaryCardTitleWrap}>
            <Text style={[styles.cardTitle, styles.summaryCardTitle, { color: theme.colors.text }]}>{activeRange.summaryTitle}</Text>
            <Text style={[styles.summaryCardCaption, { color: theme.colors.textSecondary }]}>
              {activeRange.summaryCaption}
            </Text>
          </View>
          <View
            style={[
              styles.summaryCardBadge,
              {
                backgroundColor: secondarySurface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryCardBadgeText, { color: theme.colors.textSecondary }]}>
              {quickStats.transactionCount} txn{quickStats.transactionCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.summaryHero,
            {
              backgroundColor: secondarySurface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.summaryHeroLabel, { color: theme.colors.textSecondary }]}>Net Income</Text>
          <AdaptiveAmountText
            style={[
              styles.summaryHeroValue,
              quickStats.netAmount >= 0 ? styles.incomeText : styles.expenseText,
            ]}
            minFontSize={18}
            value={formatSignedCurrency(formatCurrency, quickStats.netAmount)}
          />
          <Text style={[styles.summaryHeroHint, { color: theme.colors.textSecondary }]}>
            {monthlyIncome > 0
              ? `${formatPercentage(savingsRate)} of income remained after expenses.`
              : monthlyExpenses > 0
                ? 'Expenses are recorded, but no income has been added yet this month.'
                : 'No income or expense activity has been recorded yet this month.'}
          </Text>
        </View>
        <View style={styles.summaryMetricGrid}>
          <View
            style={[
              styles.summaryMetricCard,
              {
                backgroundColor: secondarySurface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
            <AdaptiveAmountText style={[styles.summaryMetricValue, styles.incomeText]} minFontSize={12} value={formatCurrency(monthlyIncome)} />
          </View>
          <View
            style={[
              styles.summaryMetricCard,
              {
                backgroundColor: secondarySurface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
            <AdaptiveAmountText style={[styles.summaryMetricValue, styles.expenseText]} minFontSize={12} value={formatCurrency(monthlyExpenses)} />
          </View>
        </View>
        <View style={[styles.summaryFooter, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.summaryFooterLabel, { color: theme.colors.textSecondary }]}>Savings Rate</Text>
          <Text style={[styles.summaryFooterValue, { color: theme.colors.text }]}>
            {formatPercentage(savingsRate)}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeading}>
            <Text style={[styles.cardTitle, styles.cardHeaderTitle, { color: theme.colors.text }]}>Net Worth Progress</Text>
            <Text
              style={[styles.netWorthChangeText, styles.cardHeaderMetaText, netWorthProgress.monthlyChange >= 0 ? styles.incomeText : styles.expenseText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {netWorthTrendText}
            </Text>
          </View>
          {renderChartExportAction('net-worth-progress', 'Net Worth Progress', !hasActiveAccounts)}
        </View>
        <ViewShot ref={setChartCaptureRef('net-worth-progress')} options={chartCaptureOptions}>
          <View collapsable={false}>
        {!hasActiveAccounts ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              Add at least one active account to track net worth.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.netWorthValueBlock,
                {
                  backgroundColor: secondarySurface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.netWorthLabel, { color: theme.colors.textSecondary }]}>Current Net Worth</Text>
              <AdaptiveAmountText
                style={[styles.netWorthValue, { color: theme.colors.text }]}
                minFontSize={18}
                value={formatCurrency(netWorthProgress.currentNetWorth)}
              />
            </View>
            <View style={styles.netWorthBreakdownRow}>
              <View style={styles.netWorthBreakdownItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Assets</Text>
                <Text style={[styles.netWorthBreakdownValue, styles.incomeText]}>
                  {formatCurrency(netWorthProgress.assets[netWorthProgress.assets.length - 1] ?? 0)}
                </Text>
              </View>
              <View style={styles.netWorthBreakdownItem}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Liabilities</Text>
                <Text style={[styles.netWorthBreakdownValue, styles.expenseText]}>
                  -{formatCurrency(netWorthProgress.liabilities[netWorthProgress.liabilities.length - 1] ?? 0)}
                </Text>
              </View>
            </View>
            <View style={[styles.netWorthGrowthRow, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.netWorthGrowthLabel, { color: theme.colors.textSecondary }]}>
                Cumulative Growth (since {netWorthProgress.labels[0] || 'start'})
              </Text>
              <Text
                style={[
                  styles.netWorthBreakdownValue,
                  netWorthProgress.currentCumulativeGrowth >= 0 ? styles.incomeText : styles.expenseText,
                ]}
              >
                {netWorthGrowthText}
              </Text>
            </View>
            <View style={[styles.netWorthGrowthRow, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.netWorthGrowthLabel, { color: theme.colors.textSecondary }]}>
                Cumulative Net Inflow/Outflow
              </Text>
              <Text
                style={[
                  styles.netWorthBreakdownValue,
                  (cumulativeNetFlow[cumulativeNetFlow.length - 1] ?? 0) >= 0 ? styles.incomeText : styles.expenseText,
                ]}
              >
                {netFlowOverlayText}
              </Text>
            </View>
            <View style={[styles.legendRow, styles.netWorthLegendRow]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: chartPalette.netWorth }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Net Worth</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: chartPalette.growth }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Cumulative Growth</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: chartPalette.netFlow }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Cumulative Inflow/Outflow</Text>
              </View>
            </View>
            <View style={[styles.chartContainer, { backgroundColor: analyticsCanvasBackground, borderColor: softBorderColor }]}>
              <VictoryChart
                width={chartWidth}
                height={220}
                padding={chartPadding}
                scale={{ x: 'time' }}
                domainPadding={{ y: 12, x: 12 }}
                containerComponent={
                  <VoronoiCursorContainer
                    cursorDimension="x"
                    cursorComponent={
                      <VictoryLine
                        style={{
                          data: {
                            stroke: gridColor,
                            strokeWidth: 1,
                          },
                        }}
                      />
                    }
                  />
                }
              >
                <Defs>
                  <SvgLinearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={chartPalette.netWorth} stopOpacity={0.28} />
                    <Stop offset="100%" stopColor={chartPalette.netWorth} stopOpacity={0} />
                  </SvgLinearGradient>
                </Defs>
                <VictoryAxis
                  tickValues={netWorthSeries.tickValues}
                  tickFormat={(value) => formatShortMonthLabel(new Date(value))}
                  style={{
                    axis: { stroke: 'transparent' },
                    ticks: { stroke: 'transparent' },
                    tickLabels: { fill: axisLabelColor, fontSize: 10 },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickCount={3}
                  tickFormat={(value) => formatCompactNumber(value)}
                  style={{
                    axis: { stroke: 'transparent' },
                    ticks: { stroke: 'transparent' },
                    tickLabels: { fill: axisLabelColor, fontSize: 10 },
                    grid: { stroke: gridColor },
                  }}
                />
                <VictoryArea
                  data={netWorthSeries.netWorthData}
                  interpolation="natural"
                  animate={chartAnimation}
                  style={{
                    data: {
                      stroke: chartPalette.netWorth,
                      strokeWidth: 2.2,
                      fill: 'url(#netWorthGradient)',
                    },
                  }}
                    labels={({ datum }) =>
                      `${formatDateWithWeekday(new Date(datum.x))}
${formatCurrency(datum.y)}`
                    }
                  labelComponent={
                    <VictoryTooltip
                      flyoutStyle={tooltipFlyoutStyle}
                      style={tooltipTextStyle}
                      pointerLength={6}
                      cornerRadius={10}
                      renderInPortal={false}
                    />
                  }
                />
                <VictoryLine
                  data={netWorthSeries.netWorthData}
                  interpolation="natural"
                  animate={chartAnimation}
                  style={{
                    data: {
                      stroke: chartPalette.netWorth,
                      strokeWidth: 2.2,
                    },
                  }}
                />
                <VictoryLine
                  data={netWorthSeries.growthData}
                  interpolation="natural"
                  animate={chartAnimation}
                  style={{
                    data: {
                      stroke: chartPalette.growth,
                      strokeWidth: 1.6,
                      strokeDasharray: '4,4',
                    },
                  }}
                />
                <VictoryLine
                  data={netWorthSeries.flowData}
                  interpolation="natural"
                  animate={chartAnimation}
                  style={{
                    data: {
                      stroke: chartPalette.netFlow,
                      strokeWidth: 1.6,
                    },
                  }}
                />
              </VictoryChart>
            </View>
            {selectedMonthPoint ? (
              <View
                style={[
                  styles.monthTooltip,
                  {
                    backgroundColor: secondarySurface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.monthTooltipHeader}>
                  <Text style={[styles.monthTooltipTitle, { color: theme.colors.text }]}>
                    {selectedMonthPoint.label} {selectedMonthPoint.month.slice(0, 4)}
                  </Text>
                  <View style={styles.monthTooltipChange}>
                    {selectedMonthChange > 0 ? (
                      <ArrowUpRight size={14} color={getChangeColor(selectedMonthChange)} />
                    ) : selectedMonthChange < 0 ? (
                      <ArrowDownRight size={14} color={getChangeColor(selectedMonthChange)} />
                    ) : null}
                    <Text
                      style={[
                        styles.monthTooltipChangeText,
                        { color: getChangeColor(selectedMonthChange) },
                      ]}
                    >
                      {formatSignedCurrency(formatCurrency, selectedMonthChange)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.monthTooltipValue, { color: theme.colors.text }]}>
                  Net Worth: {formatCurrency(selectedMonthPoint.netWorth)}
                </Text>
                <Text style={[styles.monthTooltipMeta, { color: theme.colors.textSecondary }]}>
                  Growth: {formatSignedCurrency(formatCurrency, selectedMonthCumulativeGrowth)} | Inflow/Outflow: {formatSignedCurrency(formatCurrency, selectedMonthCumulativeNetFlow)}
                </Text>
              </View>
            ) : null}
            <View style={styles.monthSelectorRow}>
              {netWorthProgress.points.map((point, index) => {
                const change = netWorthProgress.monthOverMonthChange[index] - 0;
                const isSelected = index === safeSelectedMonthIndex;
                const changeColor = getChangeColor(change);

                return (
                  <TouchableOpacity
                    key={point.month}
                    style={[
                      styles.monthChip,
                      {
                        borderColor: isSelected ? changeColor : theme.colors.border,
                        backgroundColor: theme.isDark ? theme.colors.background : '#FFFFFF',
                      },
                    ]}
                    onPress={() => {
                      setSelectedMonthIndex(index);
                      setShowMonthDrillDown(true);
                    }}
                  >
                    <Text style={[styles.monthChipLabel, { color: theme.colors.text }]}>{point.label}</Text>
                    <View style={styles.monthChipChangeRow}>
                      {change > 0 ? (
                        <ArrowUpRight size={12} color={changeColor} />
                      ) : change < 0 ? (
                        <ArrowDownRight size={12} color={changeColor} />
                      ) : null}
                      <Text style={[styles.monthChipChange, { color: changeColor }]}>
                        {formatSignedCurrency(formatCurrency, change)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.monthSelectorHint, { color: theme.colors.textSecondary }]}>
              Tap a month card to drill into transactions. Tap chart points for monthly tooltip details.
            </Text>
          </>
        )}
          </View>
        </ViewShot>
      </View>

      </AnalyticsCategoryBlock>
      {visibleStage >= 2 ? (

      <AnalyticsCategoryBlock
        eyebrow="Activity"
        title="Spending & Trends"
        subtitle="Track where money is going and how income and expenses are changing."
      >
      {hasSpendingTrendCharts ? (
        <>
          {hasExpenseDistributionData ? (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeading}>
                  <Text style={[styles.cardTitle, styles.cardHeaderTitle, { color: theme.colors.text }]}>Expense Distribution</Text>
                  <Text style={[styles.cardHeaderMetaText, { color: theme.colors.textSecondary }]}>
                    {topCategory ? `${topCategory.categoryName} is ${activeRange.topCategoryLeadText}` : activeRange.distributionCaption}
                  </Text>
                </View>
                {renderChartExportAction('expense-distribution', 'Expense Distribution')}
              </View>
              <ViewShot ref={setChartCaptureRef('expense-distribution')} options={chartCaptureOptions}>
                <View collapsable={false}>
                  <View style={styles.chartSummary}>
                    <AdaptiveAmountText
                      style={[styles.chartSummaryValue, { color: theme.colors.text }]}
                      minFontSize={14}
                      value={formatCurrency(monthlyExpenses)}
                    />
                    <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>
                      {expenseDistribution.length === 1
                        ? selectedRange === 'monthly' ? '1 category contributing this month' : '1 category in view'
                        : selectedRange === 'monthly' ? `${expenseDistribution.length} categories contributing this month` : `${expenseDistribution.length} categories in view`}
                    </Text>
                  </View>
                  <View style={[styles.chartContainer, { backgroundColor: analyticsCanvasBackground, borderColor: softBorderColor }]}>
                    <View style={styles.donutWrapper}>
                      <VictoryPie
                        data={expenseDonutData}
                        colorScale={expenseDonutColors}
                        width={chartWidth}
                        height={220}
                        innerRadius={60}
                        radius={90}
                        padAngle={1.5}
                        animate={chartAnimation}
                        labels={() => ''}
                        style={{
                          data: {
                            stroke: theme.colors.surface,
                            strokeWidth: 2,
                          },
                        }}
                      />
                      <View style={[styles.donutCenter, { backgroundColor: cardBackground, borderColor: softBorderColor }]}>
                        <Text style={[styles.donutLabel, { color: theme.colors.textSecondary }]}>Total Expenses</Text>
                        <AdaptiveAmountText
                          style={[styles.donutValue, { color: theme.colors.text }]}
                          minFontSize={14}
                          value={formatCurrency(monthlyExpenses)}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={styles.categoriesList}>
                    {expenseDistribution.map((entry, index) => {
                      const accentColor = entry.color ?? categoryPalette[index % categoryPalette.length];
                      return (
                        <View key={`${entry.name}-${index}`} style={styles.categoryRow}>
                          <View style={styles.categoryInfo}>
                            <View style={[styles.categoryDot, { backgroundColor: accentColor }]} />
                            <Text style={[styles.categoryName, { color: theme.colors.text }]} numberOfLines={1}>
                              {entry.name}
                            </Text>
                          </View>
                          <View style={styles.categoryAmount}>
                            <View style={styles.categoryMeta}>
                              <Text style={[styles.categoryAmountText, { color: theme.colors.text }]} numberOfLines={1}>
                                {formatCurrency(entry.amount)}
                              </Text>
                              <Text style={[styles.categoryShareText, { color: theme.colors.textSecondary }]}>
                                {formatPercentage(entry.share)}
                              </Text>
                            </View>
                            <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.border }]}>
                              <View
                                style={[
                                  styles.progressBar,
                                  {
                                    width: `${Math.max(entry.share * 100, 6)}%`,
                                    backgroundColor: accentColor,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ViewShot>
            </View>
          ) : null}

          {hasComparisonData ? (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{activeRange.comparisonTitle}</Text>
                <View style={styles.cardHeaderLegendActions}>
                  <View style={[styles.legendRow, styles.headerLegendRow]}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: chartPalette.expenses }]} />
                      <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Expenses</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: chartPalette.income }]} />
                      <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Income</Text>
                    </View>
                  </View>
                  {renderChartExportAction('comparison-6-month', activeRange.comparisonTitle)}
                </View>
              </View>
              <ViewShot ref={setChartCaptureRef('comparison-6-month')} options={chartCaptureOptions}>
                <View collapsable={false}>
                  <View style={styles.chartSummary}>
                    <Text style={[styles.chartSummaryValue, { color: theme.colors.text }]}>{formatSignedCurrency(formatCurrency, monthlyIncome - monthlyExpenses)}</Text>
                    <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>{activeRange.comparisonSummaryLabel}</Text>
                  </View>
                  <View style={[styles.chartContainer, { backgroundColor: analyticsCanvasBackground, borderColor: softBorderColor }]}>
                    <VictoryChart
                      width={chartWidth}
                      height={220}
                      padding={chartPadding}
                      domainPadding={{ x: 20, y: 12 }}
                    >
                      <VictoryAxis
                        style={{
                          axis: { stroke: 'transparent' },
                          ticks: { stroke: 'transparent' },
                          tickLabels: { fill: axisLabelColor, fontSize: 10 },
                          grid: { stroke: 'transparent' },
                        }}
                      />
                      <VictoryAxis
                        dependentAxis
                        tickCount={3}
                        tickFormat={(value) => formatCompactNumber(value)}
                        style={{
                          axis: { stroke: 'transparent' },
                          ticks: { stroke: 'transparent' },
                          tickLabels: { fill: axisLabelColor, fontSize: 10 },
                          grid: { stroke: gridColor },
                        }}
                      />
                      <VictoryGroup offset={14}>
                        <VictoryBar
                          data={comparisonSeries.incomeData}
                          barWidth={12}
                          cornerRadius={{ top: 6, bottom: 6 }}
                          animate={chartAnimation}
                          style={{
                            data: {
                              fill: chartPalette.income,
                            },
                          }}
                        />
                        <VictoryBar
                          data={comparisonSeries.expenseData}
                          barWidth={12}
                          cornerRadius={{ top: 6, bottom: 6 }}
                          animate={chartAnimation}
                          style={{
                            data: {
                              fill: chartPalette.expenses,
                            },
                          }}
                        />
                      </VictoryGroup>
                    </VictoryChart>
                  </View>
                </View>
              </ViewShot>
            </View>
          ) : null}

          {hasCategoryBreakdownData ? (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Spending by Category</Text>
                {renderChartExportAction('spending-by-category', 'Spending by Category')}
              </View>
              <ViewShot ref={setChartCaptureRef('spending-by-category')} options={chartCaptureOptions}>
                <View collapsable={false}>
                  <View style={styles.chartSummary}>
                    <AdaptiveAmountText style={[styles.chartSummaryValue, { color: theme.colors.text }]} minFontSize={14} value={formatCurrency(topCategory?.amount ?? 0)} />
                    <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>
                      {topCategory ? `${topCategory.categoryName} top category` : 'Top category'}
                    </Text>
                  </View>
                  <View style={[styles.chartContainer, { backgroundColor: analyticsCanvasBackground, borderColor: softBorderColor }]}>
                    <VictoryChart
                      width={chartWidth}
                      height={220}
                      padding={{ top: 16, bottom: 40, left: 32, right: 16 }}
                      domainPadding={{ x: 18, y: 12 }}
                    >
                      <VictoryAxis
                        tickValues={categoryBarData.map((item) => item.x)}
                        style={{
                          axis: { stroke: 'transparent' },
                          ticks: { stroke: 'transparent' },
                          tickLabels: { fill: axisLabelColor, fontSize: 10 },
                          grid: { stroke: 'transparent' },
                        }}
                      />
                      <VictoryAxis
                        dependentAxis
                        tickCount={3}
                        tickFormat={(value) => formatCompactNumber(value)}
                        style={{
                          axis: { stroke: 'transparent' },
                          ticks: { stroke: 'transparent' },
                          tickLabels: { fill: axisLabelColor, fontSize: 10 },
                          grid: { stroke: gridColor },
                        }}
                      />
                      <VictoryBar
                        data={categoryBarData}
                        barWidth={14}
                        cornerRadius={{ top: 6, bottom: 6 }}
                        animate={chartAnimation}
                        style={{
                          data: {
                            fill: ({ datum }) => datum.fill,
                          },
                        }}
                      />
                    </VictoryChart>
                  </View>
                </View>
              </ViewShot>
            </View>
          ) : null}
        </>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Spending Charts</Text>
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
              <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Add transactions to unlock your spending charts.</Text>
          </View>
        </View>
      )}
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Quick Stats</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statItem, { backgroundColor: secondarySurface, borderColor: theme.colors.border }]}>
            <Text
              style={[styles.statValue, { color: theme.colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {quickStats.transactionCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              Transactions
            </Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: secondarySurface, borderColor: theme.colors.border }]}>
            <AdaptiveAmountText
              style={[styles.statValue, { color: theme.colors.text }]}
              minFontSize={11}
              minimumFontScale={0.64}
              value={formatCurrency(quickStats.averageDailySpend)}
            />
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              Daily Spend
            </Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: secondarySurface, borderColor: theme.colors.border }]}>
            <Text
              style={[styles.statValue, { color: theme.colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {quickStats.activeCategories}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              Active Categories
            </Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: secondarySurface, borderColor: theme.colors.border }]}>
            <AdaptiveAmountText
              style={[styles.statValue, quickStats.netAmount >= 0 ? styles.incomeText : styles.expenseText]}
              minFontSize={11}
              minimumFontScale={0.64}
              value={(quickStats.netAmount >= 0 ? '+' : '').concat(formatCurrency(quickStats.netAmount))}
            />
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {activeRange.netStatLabel}
            </Text>
          </View>
        </View>
      </View>
      </AnalyticsCategoryBlock>
      ) : (
        <AnalyticsCategoryPlaceholder
          eyebrow="Activity"
          title="Spending & Trends"
          subtitle="Track where money is going and how income and expenses are changing."
          cardCount={3}
          chartCardIndex={0}
        />
      )}
      {visibleStage >= 3 ? (

      <AnalyticsCategoryBlock
        eyebrow="Guidance"
        title="Smart Insights"
        subtitle="Recommendations, warnings, and budgeting ideas generated from your recent data."
      >
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Smart Advisor</Text>
        {advisorInsights.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              No insights yet. Add more transactions to unlock guidance.
            </Text>
          </View>
        ) : (
          <View style={styles.insightList}>
            {advisorInsights.map((insight) => {
              const toneColor =
                insight.severity === 'critical'
                  ? theme.colors.error
                  : insight.severity === 'warning'
                    ? theme.colors.warning
                    : theme.colors.success;

              return (
                <View key={insight.id} style={[styles.insightRow, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.insightTitle, { color: toneColor }]}>{insight.title}</Text>
                  <Text style={[styles.insightMessage, { color: theme.colors.textSecondary }]}>{insight.message}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Smart Budget Suggestions</Text>
        {budgetSuggestions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              Not enough spending history to suggest budgets yet.
            </Text>
          </View>
        ) : (
          <View style={styles.suggestionList}>
            {budgetSuggestions.slice(0, 3).map((suggestion) => (
              <View key={suggestion.categoryId} style={[styles.suggestionRow, { borderColor: theme.colors.border }]}>
                <View style={styles.suggestionMain}>
                  <Text style={[styles.suggestionCategory, { color: theme.colors.text }]}>{suggestion.categoryName}</Text>
                  <Text style={[styles.suggestionNote, { color: theme.colors.textSecondary }]}>{suggestion.note}</Text>
                </View>
                <View style={styles.suggestionValues}>
                  <Text style={[styles.suggestionValue, { color: theme.colors.text }]}>
                    {formatCurrency(suggestion.suggestedBudget)}
                  </Text>
                  {suggestion.currentBudget ? (
                    <Text style={[styles.suggestionSub, { color: theme.colors.textSecondary }]}>
                      Current {formatCurrency(suggestion.currentBudget)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Cashflow Runway</Text>
        {!cashflowRunway ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
              <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No runway data yet.</Text>
          </View>
        ) : (
          <View>
            <Text style={[styles.runwayValue, { color: theme.colors.text }]}>
              {cashflowRunway.daysUntilEmpty === null ? 'Stable'
                : `${Math.max(0, Math.floor(cashflowRunway.daysUntilEmpty))} days`}
            </Text>
            <Text style={[styles.runwaySubtext, { color: theme.colors.textSecondary }]}>
              Daily burn {formatCurrency(cashflowRunway.dailyBurnRate)} - {cashflowRunway.remainingDaysInMonth} days left
            </Text>
            {cashflowRunway.willRunOut ? (
              <Text style={[styles.runwayAlert, { color: theme.colors.warning }]}>Funds may run out before month end.</Text>
            ) : null}
          </View>
        )}
      </View>

      </AnalyticsCategoryBlock>
      ) : (
        <AnalyticsCategoryPlaceholder
          eyebrow="Guidance"
          title="Smart Insights"
          subtitle="Recommendations, warnings, and budgeting ideas generated from your recent data."
          cardCount={3}
          chartCardIndex={-1}
        />
      )}
      {visibleStage >= 4 ? (

      <AnalyticsCategoryBlock
        eyebrow="Planning"
        title="Forecasts & Goals"
        subtitle="See where your finances may be heading and how current progress compares to long-term targets."
      >
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Net Worth Forecast</Text>
          {renderChartExportAction('net-worth-forecast', 'Net Worth Forecast', !netWorthSimulation || !netWorthForecastData)}
        </View>
        <ViewShot ref={setChartCaptureRef('net-worth-forecast')} options={chartCaptureOptions}>
          <View collapsable={false}>
        {!netWorthSimulation ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
              <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No forecast data yet.</Text>
          </View>
        ) : (
          <View>
            <View style={styles.forecastHeader}>
              <AdaptiveAmountText
                style={[styles.forecastValue, { color: theme.colors.text }]}
                minFontSize={18}
                value={formatCurrency(netWorthSimulation.futureValue)}
              />
              <Text style={[styles.forecastMeta, { color: theme.colors.textSecondary }]}>
                Projected by {netWorthForecastData ? formatDateWithWeekday(netWorthForecastData.projectedDate) : `${netWorthSimulation.years} years from now`}
              </Text>
              <Text
                style={[styles.forecastSub, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                Contributions {formatCurrency(netWorthSimulation.totalContributions)} - Growth {formatCurrency(netWorthSimulation.investmentGrowth)}
              </Text>
            </View>
            {netWorthForecastData ? (
              <View style={[styles.chartContainer, { backgroundColor: analyticsCanvasBackground, borderColor: softBorderColor }]}>
                <VictoryChart
                  width={chartWidth}
                  height={220}
                  padding={chartPadding}
                  scale={{ x: 'time' }}
                  domainPadding={{ y: 12, x: 12 }}
                  containerComponent={
                    <VoronoiCursorContainer
                      cursorDimension="x"
                      cursorComponent={
                        <VictoryLine
                          style={{
                            data: {
                              stroke: gridColor,
                              strokeWidth: 1,
                            },
                          }}
                        />
                      }
                    />
                  }
                >
                  <Defs>
                    <SvgLinearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor={chartPalette.investments} stopOpacity={0.25} />
                      <Stop offset="100%" stopColor={chartPalette.investments} stopOpacity={0} />
                    </SvgLinearGradient>
                  </Defs>
                  <VictoryAxis
                    tickValues={netWorthForecastData.tickValues}
                    tickFormat={(value) => new Date(value).getFullYear().toString()}
                    style={{
                      axis: { stroke: 'transparent' },
                      ticks: { stroke: 'transparent' },
                      tickLabels: { fill: axisLabelColor, fontSize: 10 },
                      grid: { stroke: 'transparent' },
                    }}
                  />
                  <VictoryAxis
                    dependentAxis
                    tickCount={3}
                    tickFormat={(value) => formatCompactNumber(value)}
                    style={{
                      axis: { stroke: 'transparent' },
                      ticks: { stroke: 'transparent' },
                      tickLabels: { fill: axisLabelColor, fontSize: 10 },
                      grid: { stroke: gridColor },
                    }}
                  />
                  <VictoryArea
                    data={netWorthForecastData.data}
                    interpolation="natural"
                    animate={chartAnimation}
                    style={{
                      data: {
                        stroke: chartPalette.investments,
                        strokeWidth: 2.2,
                        fill: 'url(#forecastGradient)',
                      },
                    }}
                    labels={({ datum }) =>
                      `${formatDateWithWeekday(new Date(datum.x))}
${formatCurrency(datum.y)}`
                    }
                    labelComponent={
                      <VictoryTooltip
                        flyoutStyle={tooltipFlyoutStyle}
                        style={tooltipTextStyle}
                        pointerLength={6}
                        cornerRadius={10}
                        renderInPortal={false}
                      />
                    }
                  />
                </VictoryChart>
              </View>
            ) : null}
          </View>
        )}
          </View>
        </ViewShot>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Debt Payoff Optimizer</Text>
        {!debtPayoffPlan ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
              <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No active debts to optimize.</Text>
          </View>
        ) : (
          <View>
            <View style={styles.debtGrid}>
              <View style={[styles.debtItem, { borderColor: theme.colors.border }]}>
                <Text style={[styles.debtLabel, { color: theme.colors.textSecondary }]}>Snowball</Text>
                <Text style={[styles.debtValue, { color: theme.colors.text }]}>{debtPayoffPlan.snowball.months} mo</Text>
                <Text style={[styles.debtSub, { color: theme.colors.textSecondary }]}>
                  Interest {formatCurrency(debtPayoffPlan.snowball.totalInterest)}
                </Text>
              </View>
              <View style={[styles.debtItem, { borderColor: theme.colors.border }]}>
                <Text style={[styles.debtLabel, { color: theme.colors.textSecondary }]}>Avalanche</Text>
                <Text style={[styles.debtValue, { color: theme.colors.text }]}>{debtPayoffPlan.avalanche.months} mo</Text>
                <Text style={[styles.debtSub, { color: theme.colors.textSecondary }]}>
                  Interest {formatCurrency(debtPayoffPlan.avalanche.totalInterest)}
                </Text>
              </View>
            </View>
            <Text style={[styles.debtRecommendation, { color: theme.colors.textSecondary }]}>
              Recommended: {debtPayoffPlan.recommendedStrategy}
            </Text>
            {debtPayoffPlan.interestSaved > 0 ? (
              <Text style={[styles.debtRecommendation, { color: theme.colors.success }]}>
                Potential interest saved {formatCurrency(debtPayoffPlan.interestSaved)}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Milestones</Text>
        <View style={styles.milestoneList}>
          {milestoneCards.map((milestone) => {
            const progressPercent = Math.min(100, Math.round(clamp(milestone.progress) * 100));
            const achieved = milestone.achieved ?? milestone.progress >= 1;
            const etaText = achieved ? null : formatDurationShort(milestone.estimatedMonths ?? null);
            const toneColor = milestone.tone === 'warning'
              ? theme.colors.warning
              : achieved
                ? theme.colors.success
                : theme.colors.primary;

            return (
              <View
                key={milestone.id}
                style={[
                  styles.milestoneCard,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: secondarySurface,
                  },
                ]}
              >
                <View style={styles.milestoneHeaderRow}>
                  <Text style={[styles.milestoneTitle, { color: theme.colors.text }]}>{milestone.title}</Text>
                  {achieved ? (
                    <View
                      style={[
                        styles.milestoneBadge,
                        { borderColor: theme.colors.success, backgroundColor: theme.colors.success + '22' },
                      ]}
                    >
                      <Text style={[styles.milestoneBadgeText, { color: theme.colors.success }]}>Achieved</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.milestoneRow}>
                  <Text style={[styles.milestoneLabel, { color: theme.colors.textSecondary }]}>
                    {milestone.targetLabel}
                  </Text>
                  <AdaptiveAmountText
                    style={[styles.milestoneAmount, { color: theme.colors.text }]}
                    minFontSize={12}
                    value={formatCurrency(milestone.target)}
                  />
                </View>
                <View style={styles.milestoneRow}>
                  <Text style={[styles.milestoneLabel, { color: theme.colors.textSecondary }]}>
                    {milestone.currentLabel}
                  </Text>
                  <AdaptiveAmountText
                    style={[styles.milestoneAmount, { color: theme.colors.text }]}
                    minFontSize={12}
                    value={formatCurrency(milestone.current)}
                  />
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.colors.border, marginTop: 10 }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: toneColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.milestoneMeta, { color: theme.colors.textSecondary }]}>
                  Progress {progressPercent}%{etaText ? ` - ${milestone.etaPrefix ?? 'At current pace'} ${etaText}` : ''}
                </Text>
                {milestone.insights?.map((insight, index) => (
                  <Text
                    key={`${milestone.id}-insight-${index}`}
                    style={[styles.milestoneInsight, { color: theme.colors.textSecondary }]}
                  >
                    {insight}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </View>
      </AnalyticsCategoryBlock>
      ) : (
        <AnalyticsCategoryPlaceholder
          eyebrow="Planning"
          title="Forecasts & Goals"
          subtitle="See where your finances may be heading and how current progress compares to long-term targets."
          cardCount={2}
          chartCardIndex={0}
        />
      )}
      </ScrollView>
      <Modal
        visible={showMonthDrillDown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthDrillDown(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.monthModalCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={[styles.monthModalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.monthModalTitleWrap}>
                <Text style={[styles.monthModalTitle, { color: theme.colors.text }]}>
                  {selectedMonthPoint ? `${selectedMonthPoint.label} ${selectedMonthPoint.month.slice(0, 4)}` : 'Month Details'}
                </Text>
                <Text style={[styles.monthModalSubtitle, { color: theme.colors.textSecondary }]}>
                  Transactions contributing to net worth
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close month detail"
                style={[styles.monthModalClose, { borderColor: theme.colors.border }]}
                onPress={() => setShowMonthDrillDown(false)}
              >
                <X size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.monthModalSummary, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.monthModalMetric}>
                <Text style={[styles.monthModalMetricLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                <AdaptiveAmountText
                  style={[styles.monthModalMetricValue, styles.incomeText]}
                  minFontSize={12}
                  value={formatCurrency(monthContributionSummary.income)}
                />
              </View>
              <View style={styles.monthModalMetric}>
                <Text style={[styles.monthModalMetricLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                <AdaptiveAmountText
                  style={[styles.monthModalMetricValue, styles.expenseText]}
                  minFontSize={12}
                  value={formatCurrency(monthContributionSummary.expenses)}
                />
              </View>
              <View style={styles.monthModalMetric}>
                <Text style={[styles.monthModalMetricLabel, { color: theme.colors.textSecondary }]}>Net Flow</Text>
                <Text
                  style={[
                    styles.monthModalMetricValue,
                    monthContributionSummary.netFlow >= 0 ? styles.incomeText : styles.expenseText,
                  ]}
                >
                  {formatSignedCurrency(formatCurrency, monthContributionSummary.netFlow)}
                </Text>
              </View>
              <View style={styles.monthModalMetric}>
                <Text style={[styles.monthModalMetricLabel, { color: theme.colors.textSecondary }]}>Net Worth Impact</Text>
                <Text
                  style={[
                    styles.monthModalMetricValue,
                    { color: getChangeColor(monthContributionSummary.netWorthImpact) },
                  ]}
                >
                  {formatSignedCurrency(formatCurrency, monthContributionSummary.netWorthImpact)}
                </Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.monthModalBody}>
              {monthContributionItems.length === 0 ? (
                <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
                  <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                    No visible transactions in this month.
                  </Text>
                </View>
              ) : (
                monthContributionItems.map((item) => (
                  <View
                    key={item.transaction.id}
                    style={[styles.monthTxRow, { borderBottomColor: theme.colors.border }]}
                  >
                    <View style={styles.monthTxMain}>
                      <Text style={[styles.monthTxDescription, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.transaction.description || 'Untitled transaction'}
                      </Text>
                      <Text style={[styles.monthTxMeta, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                        {formatDateDDMMYYYY(item.transaction.date)}
                        {' - '}
                        {item.transaction.type}
                        {(item.fromAccountName || item.toAccountName)
                          ? ` - ${item.fromAccountName ?? 'External'} -> ${item.toAccountName ?? 'External'}`
                          : ''}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.monthTxImpact,
                        { color: getChangeColor(item.netWorthImpact) },
                      ]}
                    >
                      {formatSignedCurrency(formatCurrency, item.netWorthImpact)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
});

const AnalyticsLoadingState = React.memo(function AnalyticsLoadingState() {
  const { theme } = useTheme();

  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.loadingHero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={styles.loadingHeroRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>Preparing analytics</Text>
        </View>
        <Text style={[styles.loadingSubtitle, { color: theme.colors.textSecondary }]}>Opening charts and insights without blocking the tab switch.</Text>
      </View>

      <View style={[styles.loadingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={[styles.loadingLineShort, { backgroundColor: theme.colors.border }]} />
        <View style={[styles.loadingLineLong, { backgroundColor: theme.colors.border }]} />
        <View style={[styles.loadingChartBlock, { backgroundColor: theme.colors.border }]} />
      </View>

      <View style={[styles.loadingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={[styles.loadingLineShort, { backgroundColor: theme.colors.border }]} />
        <View style={[styles.loadingLineMedium, { backgroundColor: theme.colors.border }]} />
        <View style={[styles.loadingStatRow, { backgroundColor: theme.colors.border }]} />
      </View>
    </View>
  );
});

const AnalyticsScreen = React.memo(function AnalyticsScreen() {
  const [isReady, setIsReady] = useState(false);
  const [visibleStage, setVisibleStage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    setVisibleStage(0);

    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setIsReady(true);
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      setVisibleStage(0);
      return;
    }

    let cancelled = false;
    setVisibleStage(1);

    const stageTimers = [2, 3, 4].map((stage, index) =>
      setTimeout(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setVisibleStage(stage);
        });
      }, 160 + index * 180)
    );

    return () => {
      cancelled = true;
      stageTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [isReady]);

  if (!isReady) {
    return <AnalyticsLoadingState />;
  }

  return <AnalyticsContent visibleStage={visibleStage} />;
});

export default AnalyticsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  loadingHero: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  loadingHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  inlineLoadingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  loadingLineShort: {
    width: '34%',
    height: 12,
    borderRadius: 999,
    opacity: 0.45,
  },
  loadingLineMedium: {
    width: '48%',
    height: 12,
    borderRadius: 999,
    marginTop: 12,
    opacity: 0.35,
  },
  loadingLineLong: {
    width: '72%',
    height: 12,
    borderRadius: 999,
    marginTop: 12,
    opacity: 0.35,
  },
  loadingChartBlock: {
    height: 150,
    borderRadius: 16,
    marginTop: 18,
    opacity: 0.2,
  },
  loadingStatRow: {
    height: 84,
    borderRadius: 16,
    marginTop: 18,
    opacity: 0.2,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  analyticsHero: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
    position: 'relative',
  },
  analyticsHeroOrb: {
    position: 'absolute',
    top: -26,
    right: -12,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  analyticsHeroContent: {
    gap: 14,
  },
  analyticsHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  analyticsHeroHeading: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  analyticsRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  analyticsRangeButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  analyticsRangeMenu: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  analyticsRangeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  analyticsRangeMenuText: {
    fontSize: 13,
    fontWeight: '600',
  },
  analyticsPeriodRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  analyticsPeriodField: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  analyticsPeriodLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  analyticsPeriodValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  analyticsHeroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  analyticsHeroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  analyticsHeroTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  analyticsHeroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: '92%',
  },
  analyticsHeroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsHeroStat: {
    minWidth: '30%',
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  analyticsHeroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  analyticsHeroStatValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  analyticsHeroFooter: {
    paddingTop: 4,
    gap: 4,
  },
  analyticsHeroFooterText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  categorySection: {
    paddingBottom: 6,
  },
  categoryHeader: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
  },
  categoryHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryEyebrowBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryHeaderLine: {
    flex: 1,
    height: 1,
    borderRadius: 999,
  },
  categoryEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  categoryTitle: {
    marginTop: 10,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  categorySubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: '94%',
  },
  summaryCard: {
    margin: 16,
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#020617',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#020617',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  summaryCardTitleWrap: {
    flex: 1,
  },
  summaryCardTitle: {
    marginBottom: 0,
  },
  summaryCardCaption: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryCardBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryHero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  summaryHeroLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  summaryHeroValue: {
    fontSize: 30,
    fontWeight: '800',
  },
  summaryHeroHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  summaryMetricGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  summaryMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  summaryMetricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  incomeText: {
    color: '#16A34A',
  },
  expenseText: {
    color: '#DC2626',
  },
  summaryFooter: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryFooterLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryFooterValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  netWorthChangeText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  netWorthValueBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  netWorthLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  netWorthValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  netWorthBreakdownRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  netWorthBreakdownItem: {
    flex: 1,
  },
  netWorthBreakdownValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  netWorthGrowthRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  netWorthGrowthLabel: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  netWorthLegendRow: {
    marginBottom: 6,
  },
  monthTooltip: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  monthTooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  monthTooltipTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthTooltipChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  monthTooltipChangeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthTooltipValue: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  monthTooltipMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  monthSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  monthChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 86,
  },
  monthChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  monthChipChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  monthChipChange: {
    fontSize: 11,
    fontWeight: '700',
  },
  monthSelectorHint: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  cardHeaderLeading: {
    flex: 1,
    minWidth: 0,
  },
  cardHeaderTitle: {
    marginBottom: 4,
  },
  cardHeaderMetaText: {
    textAlign: 'left',
  },
  cardHeaderTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
  },
  cardHeaderLegendActions: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 0,
  },
  chartExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
  },
  chartExportButtonDisabled: {
    opacity: 0.55,
  },
  chartExportButtonText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  cardSubtitleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartSummary: {
    marginBottom: 14,
    gap: 4,
  },
  chartSummaryValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  chartSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  donutLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  donutValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    rowGap: 8,
    flexWrap: 'wrap',
  },
  headerLegendRow: {
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  lineChartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
  categoriesList: {
    gap: 14,
    marginTop: 6,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  categoryAmount: {
    width: 136,
    maxWidth: '44%',
    minWidth: 118,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  categoryAmountText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  categoryShareText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyStateIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  emptyStateText: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statItem: {
    width: '48%',
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 6,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  statValue: {
    width: '100%',
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '800',
    marginBottom: 0,
    letterSpacing: -0.2,
  },
  statLabel: {
    width: '100%',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 13,
    letterSpacing: 0.15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  monthModalCard: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  monthModalHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  monthModalTitleWrap: {
    flex: 1,
    gap: 2,
  },
  monthModalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  monthModalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  monthModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthModalSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  monthModalMetric: {
    minWidth: '47%',
    flex: 1,
  },
  monthModalMetricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  monthModalMetricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  monthModalBody: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  monthTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  monthTxMain: {
    flex: 1,
  },
  monthTxDescription: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  monthTxMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  monthTxImpact: {
    fontSize: 13,
    fontWeight: '700',
  },
  insightList: {
    gap: 12,
  },
  insightRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  insightMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionList: {
    gap: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  suggestionMain: {
    flex: 1,
  },
  suggestionCategory: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionNote: {
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionValues: {
    alignItems: 'flex-end',
    minWidth: 110,
  },
  suggestionValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  runwayValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  runwaySubtext: {
    fontSize: 12,
    lineHeight: 16,
  },
  runwayAlert: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  forecastHeader: {
    marginBottom: 12,
  },
  forecastValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  forecastMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  forecastSub: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  debtGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  debtItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  debtLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  debtValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  debtSub: {
    fontSize: 11,
  },
  debtRecommendation: {
    fontSize: 12,
    marginTop: 4,
  },
  milestoneList: {
    gap: 12,
  },
  milestoneCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  milestoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  milestoneBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  milestoneBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  milestoneLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  milestoneAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  milestoneMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  milestoneInsight: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  milestoneValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
  },
  milestoneSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  milestoneEta: {
    fontSize: 11,
    marginTop: 4,
  },
});









