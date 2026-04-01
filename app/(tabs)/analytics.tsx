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
  FinanceLineChart,
  MoneyManagerBarChartSection,
  MoneyManagerLineChartSection,
} from '@/components/charts/SkiaFinanceCharts';
import { AccountModalSkiaBoundary } from '@/components/charts/AccountModalSkiaBoundary';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Scale, Sparkles, TrendingUp, Wallet, X } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { formatDateDDMMYYYY, formatDateWithWeekday } from '@/utils/date';
import {
  computeNetWorthProgress,
  computeCategoryBreakdown,
  computeCategoryDistribution,
  computeQuickStats,
  computeBehaviorMetrics,
} from '@/src/domain/analytics';
import type { BehaviorMetrics, NetWorthProgress } from '@/src/domain/analytics';
import { CategoryDistributionPanel, type DistributionSection } from '@/components/analytics/CategoryDistributionPanel';
import { buildWealthMilestoneLadder, computeFinancialIntelligence, computeStarterInvestmentTarget } from '@/src/domain/financial-intelligence';
import { computeDebtPortfolioTotals } from '@/src/domain/debt-portfolio';
import type { DebtPortfolioTotals } from '@/src/domain/debt-portfolio';
import { computeInsights } from '@/src/domain/insights';
import { getAccountTypeDefinition } from '@/constants/account-types';
import type { Insight, Transaction } from '@/types/transaction';
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

const APP_SHORT_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const APP_SHORT_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type ExportableChartId =
  | 'net-worth-progress'
  | 'expense-distribution'
  | 'comparison-6-month'
  | 'spending-by-category'
  | 'net-worth-forecast';

type AnalyticsRangePreset = 'weekly' | 'monthly' | 'sixMonths' | 'annually' | 'period';

type AnalyticsAdvisorInsight = Insight & {
  windowLabel: string;
};

const ANALYTICS_RANGE_OPTIONS: Array<{
  key: AnalyticsRangePreset;
  label: string;
  description: string;
}> = [
  { key: 'weekly', label: 'Weekly', description: 'This week to date' },
  { key: 'monthly', label: 'Monthly', description: 'Current month view' },
  { key: 'sixMonths', label: 'Six Months', description: 'Recent half-year trend' },
  { key: 'annually', label: 'Annually', description: 'Rolling 12-month view' },
  { key: 'period', label: 'Period', description: 'Choose a custom range' },
];
function toDayKey(date: Date): string {
  return `${toMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}
function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}



function buildRecentMonths(length: number, referenceDate: Date = new Date()): Date[] {
  const anchor = referenceDate;
  return Array.from({ length }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth() - (length - 1 - index), 1));
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

function computeChartYDomain(values: number[]): [number, number] {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return [-1, 1];
  }

  const rawMin = Math.min(...finiteValues);
  const rawMax = Math.max(...finiteValues);
  const boundedMin = Math.min(rawMin, 0);
  const boundedMax = Math.max(rawMax, 0);
  const span = Math.max(Math.abs(boundedMax - boundedMin), Math.abs(rawMin), Math.abs(rawMax), 1);
  const padding = Math.max(span * 0.12, 1);
  const lowerPadding = rawMin < 0 ? padding : padding * 0.25;
  const upperPadding = rawMax > 0 ? padding : padding * 0.25;

  return [
    roundCurrency(boundedMin - lowerPadding),
    roundCurrency(boundedMax + upperPadding),
  ];
}

function buildZeroLineData(
  points: Array<{ x: Date | string | number }>
): Array<{ x: Date | string | number; y: number }> {
  if (points.length === 0) {
    return [];
  }

  return [
    { x: points[0].x, y: 0 },
    { x: points[points.length - 1].x, y: 0 },
  ];
}

function formatShortMonthLabel(date: Date): string {
  return APP_SHORT_MONTH_LABELS[date.getMonth()] ?? '';
}

function formatMonthYearLabel(date: Date): string {
  return `${formatShortMonthLabel(date)} ${date.getFullYear()}`;
}

function formatShortWeekdayLabel(date: Date): string {
  return APP_SHORT_WEEKDAY_LABELS[date.getDay()] ?? '';
}

function formatMonthYearShortLabel(date: Date, includeYear: boolean): string {
  if (!includeYear) {
    return formatShortMonthLabel(date);
  }

  return `${formatShortMonthLabel(date)} ${String(date.getFullYear()).slice(-2)}`;
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

function startOfWeek(date: Date): Date {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const mondayOffset = (day + 6) % 7;
  return new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate() - mondayOffset);
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
}

function buildDayBuckets(start: Date, end: Date): Date[] {
  const totalDays = countDaysInclusive(start, end);
  return Array.from({ length: totalDays }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
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

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDaysToDate(referenceDate: Date, days: number): Date {
  const next = new Date(referenceDate);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameCalendarMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function normalizePartialMonthTotal(total: number, bucketMonth: string, referenceDate: Date): number {
  if (bucketMonth !== toMonthKey(referenceDate)) {
    return total;
  }

  const daysElapsed = Math.max(1, referenceDate.getDate());
  const daysInMonth = getDaysInMonth(referenceDate);
  const progress = Math.min(1, daysElapsed / daysInMonth);
  return progress >= 1 ? total : total / progress;
}

function computeRecentAverageMonthlyTotals(
  transactions: Transaction[],
  referenceDate: Date,
  months = 3
): { averageIncome: number; averageExpenses: number; averageNet: number } | null {
  const recentMonths = buildRecentMonths(months, referenceDate);
  if (recentMonths.length === 0) {
    return null;
  }

  const totals = recentMonths.map((month) => {
    const bucketMonth = toMonthKey(month);
    const income = transactions
      .filter((transaction) => transaction.type === 'income' && toMonthKey(transaction.date) === bucketMonth)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = transactions
      .filter((transaction) => transaction.type === 'expense' && toMonthKey(transaction.date) === bucketMonth)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      income: normalizePartialMonthTotal(income, bucketMonth, referenceDate),
      expenses: normalizePartialMonthTotal(expenses, bucketMonth, referenceDate),
    };
  });

  const divisor = totals.length;
  const averageIncome = totals.reduce((sum, entry) => sum + entry.income, 0) / divisor;
  const averageExpenses = totals.reduce((sum, entry) => sum + entry.expenses, 0) / divisor;

  return {
    averageIncome: roundCurrency(averageIncome),
    averageExpenses: roundCurrency(averageExpenses),
    averageNet: roundCurrency(averageIncome - averageExpenses),
  };
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

function roundToNiceMilestoneTarget(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const steps = [1, 1.5, 2, 2.5, 3, 5, 7.5, 10];
  const step = steps.find((candidate) => normalized <= candidate) ?? 10;
  return roundCurrency(step * magnitude);
}

function addMonthsToDate(referenceDate: Date, months: number): Date {
  const safeMonths = Math.max(0, Math.ceil(months));
  const next = new Date(referenceDate);
  const originalDay = next.getDate();
  next.setMonth(next.getMonth() + safeMonths);

  if (next.getDate() < originalDay) {
    next.setDate(0);
  }

  return next;
}

function estimateTargetProjection(
  current: number,
  target: number,
  monthlySavings: number,
  annualReturn: number,
  referenceDate: Date
): { estimatedMonths: number | null; estimatedDate: Date | null } {
  const estimatedMonths = estimateMonthsToTarget(current, target, monthlySavings, annualReturn);
  return {
    estimatedMonths,
    estimatedDate: estimatedMonths === null ? null : addMonthsToDate(referenceDate, estimatedMonths),
  };
}

function resolveMilestoneRange(
  currentNetWorth: number,
  milestones: number[]
): { previousMilestone: number; nextMilestone: number } {
  const safeCurrent = Math.max(0, currentNetWorth);
  const sorted = milestones
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice()
    .sort((left, right) => left - right);

  const nextMilestone = sorted.find((value) => value > safeCurrent);
  if (nextMilestone !== undefined) {
    const previousMilestone = sorted
      .slice()
      .reverse()
      .find((value) => value <= safeCurrent) ?? 0;
    return { previousMilestone, nextMilestone };
  }

  const previousMilestone = sorted[sorted.length - 1] ?? 0;
  const anchor = Math.max(previousMilestone, safeCurrent, 250);
  return {
    previousMilestone,
    nextMilestone: roundToNiceMilestoneTarget(Math.max(anchor * 1.25, previousMilestone * 2, 250)),
  };
}

function calculateMilestoneProgress(current: number, previousMilestone: number, nextMilestone: number): number {
  if (!Number.isFinite(nextMilestone) || nextMilestone <= 0) {
    return 0;
  }

  if (current >= nextMilestone) {
    return 1;
  }

  const span = nextMilestone - previousMilestone;
  if (!Number.isFinite(span) || span <= 0) {
    return clamp(Math.max(0, current) / nextMilestone);
  }

  return clamp((current - previousMilestone) / span);
}

function computeStarterInvestmentBase(
  liquidBalance: number,
  investmentBalance: number,
  averageMonthlyExpenses: number
): number {
  const reserve = Math.max(0, averageMonthlyExpenses);
  return roundCurrency(Math.max(0, investmentBalance) + Math.max(0, liquidBalance - reserve));
}

function computeFinancialIndependenceBase(
  liquidBalance: number,
  investmentBalance: number,
  emergencyFundTarget: number
): number {
  const reserve = Math.max(0, emergencyFundTarget);
  return roundCurrency(Math.max(0, investmentBalance) + Math.max(0, liquidBalance - reserve));
}

function formatDurationShort(months: number | null): string | null {
  if (months === null || !Number.isFinite(months)) {
    return null;
  }

  const roundedMonths = Math.max(0, Math.round(months));
  if (roundedMonths <= 0) {
    return '0 mo';
  }
  if (roundedMonths < 12) {
    return `${roundedMonths} mo`;
  }

  const years = Math.floor(roundedMonths / 12);
  const remainingMonths = roundedMonths % 12;
  if (remainingMonths === 0) {
    return `${years} yr`;
  }

  return `${years} yr ${remainingMonths} mo`;
}

function formatDurationLong(months: number | null): string | null {
  if (months === null || !Number.isFinite(months)) {
    return null;
  }

  const roundedMonths = Math.max(0, Math.round(months));
  if (roundedMonths <= 0) {
    return '0 months';
  }
  if (roundedMonths < 12) {
    return `${roundedMonths} month${roundedMonths === 1 ? '' : 's'}`;
  }

  const years = Math.floor(roundedMonths / 12);
  const remainingMonths = roundedMonths % 12;
  if (remainingMonths === 0) {
    return `${years} year${years === 1 ? '' : 's'}`;
  }

  return `${years} year${years === 1 ? '' : 's'} ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
}

function rewriteInsightMessageForRange(message: string, periodText: string): string {
  return message
    .replace(/this month/gi, periodText)
    .replace(/current month/gi, periodText)
    .replace(/over the month/gi, `during ${periodText}`);
}

function getInsightSeverityWeight(severity: Insight['severity']): number {
  if (severity === 'critical') {
    return 3;
  }
  if (severity === 'warning') {
    return 2;
  }
  return 1;
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

function isAccountInTypeGroup(accountType: string | undefined, groups: string[]): boolean {
  const definition = getAccountTypeDefinition(accountType);
  return groups.includes(definition.group);
}

function computeTransactionNetWorthImpact(
  transaction: Transaction,
  activeAccountIds: Set<string>
): number {
  if (transaction.type === 'debt' || (transaction.type === 'expense' && transaction.debtPayment)) {
    return 0;
  }

  const fromAccountId = getFromAccountId(transaction);
  const toAccountId = getToAccountId(transaction);
  const debit = fromAccountId && activeAccountIds.has(fromAccountId) ? transaction.amount : 0;
  const credit = toAccountId && activeAccountIds.has(toAccountId) ? transaction.amount : 0;
  return roundCurrency(credit - debit);
}

function computeAccountBalanceMap(transactions: Transaction[]): Map<string, number> {
  const balances = new Map<string, number>();

  const applyDelta = (accountId: string | undefined, delta: number) => {
    if (!accountId || delta === 0) {
      return;
    }

    balances.set(accountId, roundCurrency((balances.get(accountId) ?? 0) + delta));
  };

  for (const transaction of transactions) {
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
      continue;
    }

    const from = getFromAccountId(transaction);
    const to = getToAccountId(transaction);

    if (transaction.type === 'income') {
      applyDelta(to, transaction.amount);
      continue;
    }

    if (transaction.type === 'expense') {
      applyDelta(from, -transaction.amount);
      continue;
    }

    if (transaction.type === 'debt') {
      if (transaction.debtDirection === 'borrowed') {
        applyDelta(to, transaction.amount);
      } else if (transaction.debtDirection === 'lent') {
        applyDelta(from, -transaction.amount);
      }
      continue;
    }

    if (transaction.type === 'transfer') {
      if (transaction.transferLeg === 'debit') {
        applyDelta(from, -transaction.amount);
      } else if (transaction.transferLeg === 'credit') {
        applyDelta(to, transaction.amount);
      } else {
        applyDelta(to, transaction.amount);
        applyDelta(from, -transaction.amount);
      }
    }
  }

  return balances;
}

const EMPTY_NET_WORTH_PROGRESS: NetWorthProgress = {
  labels: [],
  netWorth: [],
  cumulativeGrowth: [],
  monthOverMonthChange: [],
  assets: [],
  liabilities: [],
  points: [],
  baselineNetWorth: 0,
  currentNetWorth: 0,
  currentCumulativeGrowth: 0,
  previousNetWorth: 0,
  monthlyChange: 0,
  monthlyChangeRate: null,
};

const EMPTY_DEBT_PORTFOLIO_TOTALS: DebtPortfolioTotals = {
  borrowedPrincipal: 0,
  borrowedOutstanding: 0,
  lentOutstanding: 0,
  debtRepayments: 0,
};

const EMPTY_BALANCE_MAP = new Map<string, number>();

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
  estimatedDate?: Date | null;
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
  const { transactions, allTransactions, accounts, debtAccounts, budgets, netBalance, settings, formatCurrency, financialIntelligence } = useTransactionStore();
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const shouldComputeTrendStage = visibleStage >= 2;
  const shouldComputeGuidanceStage = visibleStage >= 3;
  const shouldComputePlanningStage = visibleStage >= 4;
  const netWorthSimulation = shouldComputePlanningStage ? financialIntelligence.netWorthSimulation : null;
  const debtPayoffPlan = shouldComputePlanningStage ? financialIntelligence.debtPayoff : null;
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
  const [rangeCursorDate, setRangeCursorDate] = useState(() => endOfDay(new Date()));
  const [sixMonthsCursorStart, setSixMonthsCursorStart] = useState<Date | null>(null);
  const [showCustomStartPicker, setShowCustomStartPicker] = useState(false);
  const [showCustomEndPicker, setShowCustomEndPicker] = useState(false);
  const [focusedExpenseName, setFocusedExpenseName] = useState<string | null>(null);
  const [focusedComparisonBucketKey, setFocusedComparisonBucketKey] = useState<string | null>(null);
  const [focusedSpendingCategoryKey, setFocusedSpendingCategoryKey] = useState<string | null>(null);
  const analyticsReferenceDateKey = formatDateDDMMYYYY(new Date());
  const analyticsReferenceDate = useMemo(() => endOfDay(new Date()), [analyticsReferenceDateKey]);
  const firstRecordedMonth = useMemo(() => {
    if (allTransactions.length === 0) {
      return new Date(analyticsReferenceDate.getFullYear(), analyticsReferenceDate.getMonth(), 1);
    }

    const earliestTransactionDate = allTransactions.reduce(
      (earliest, transaction) => (transaction.date.getTime() < earliest.getTime() ? transaction.date : earliest),
      allTransactions[0].date
    );

    return new Date(earliestTransactionDate.getFullYear(), earliestTransactionDate.getMonth(), 1);
  }, [allTransactions, analyticsReferenceDate]);

  useEffect(() => {
    setRangeCursorDate((current) =>
      current.getTime() > analyticsReferenceDate.getTime() ? analyticsReferenceDate : current
    );
  }, [analyticsReferenceDate]);

  useEffect(() => {
    setSixMonthsCursorStart((current) => {
      if (!current) {
        return firstRecordedMonth;
      }

      return current.getTime() < firstRecordedMonth.getTime() ? firstRecordedMonth : current;
    });
  }, [firstRecordedMonth]);

  const netWorthForecastData = useMemo(() => {
    if (!shouldComputePlanningStage || selectedRange === 'weekly' || !netWorthSimulation) {
      return null;
    }

    const baseDate = analyticsReferenceDate;
    const buildForecastDate = (yearOffset: number) =>
      new Date(baseDate.getFullYear() + yearOffset, baseDate.getMonth(), baseDate.getDate());

    const pointByYear = new Map(netWorthSimulation.points.map((point) => [point.year, point]));
    const data = netWorthSimulation.points.map((point) => ({
      x: buildForecastDate(point.year),
      y: point.netWorth,
      year: point.year,
      savedCapital: roundCurrency(netWorthSimulation.currentNetWorth + point.contributions),
      contributions: point.contributions,
      growth: point.growth,
    }));

    const contributionData = data.map((point) => ({
      x: point.x,
      y: point.savedCapital,
      year: point.year,
    }));

    const tickValues = netWorthSimulation.points
      .filter((_, index) => index === 0 || index === netWorthSimulation.points.length - 1 || index % 2 === 0)
      .map((point) => buildForecastDate(point.year));

    const horizonYears = Array.from(
      new Set([1, 3, 5, 10, netWorthSimulation.years].filter((year) => year > 0 && year <= netWorthSimulation.years))
    ).sort((left, right) => left - right);

    const horizonItems = horizonYears.flatMap((year) => {
      const point = pointByYear.get(year);
      if (!point) {
        return [];
      }

      return [{
        year,
        label: `${year}Y`,
        date: buildForecastDate(year),
        value: point.netWorth,
        contributions: point.contributions,
        growth: point.growth,
      }];
    });

    const futureDelta = roundCurrency(netWorthSimulation.futureValue - netWorthSimulation.currentNetWorth);
    const futureDeltaRatio = netWorthSimulation.currentNetWorth !== 0
      ? futureDelta / Math.max(Math.abs(netWorthSimulation.currentNetWorth), 1)
      : null;

    return {
      data,
      contributionData,
      tickValues,
      projectedDate: data[data.length - 1]?.x ?? buildForecastDate(netWorthSimulation.years),
      horizonItems,
      futureDelta,
      futureDeltaRatio,
    };
  }, [analyticsReferenceDate, netWorthSimulation, selectedRange, shouldComputePlanningStage]);

  const netWorthForecastYDomain = useMemo<[number, number]>(() => {
    if (!netWorthForecastData) {
      return [-1, 1];
    }

    return computeChartYDomain([
      ...netWorthForecastData.data.map((point) => point.y),
      ...netWorthForecastData.contributionData.map((point) => point.y),
    ]);
  }, [netWorthForecastData]);

  const chartWidth = Math.max(screenWidth - 32, 260);
  const gridColor = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const axisLabelColor = theme.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.6)';
  const cardBackground = theme.isDark ? '#0F172A' : '#FFFFFF';
  const secondarySurface = theme.isDark ? 'rgba(15,23,42,0.82)' : '#F8FAFC';
  const analyticsCanvasBackground = theme.isDark ? 'rgba(15,23,42,0.92)' : '#F8FAFC';
  const softBorderColor = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const forecastProjectionColor = theme.isDark ? '#A78BFA' : chartPalette.investments;
  const forecastContributionColor = theme.isDark ? '#CBD5E1' : '#64748B';
  const comparisonNetColor = theme.isDark ? '#E2E8F0' : '#0F172A';
  const benchmarkLineColor = theme.isDark ? 'rgba(148,163,184,0.86)' : '#64748B';
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
  const chartCaptureOptions = useMemo(() => ({ format: 'png' as const, quality: 1, result: 'tmpfile' as const }), []);
  const setChartCaptureRef = (chartId: ExportableChartId) => (ref: ViewShot | null) => {
    chartCaptureRefs.current[chartId] = ref;
  };
  const today = analyticsReferenceDate;
  const activeRange = useMemo(() => {
    const normalizedCustomStart = startOfDay(customStartDate);
    const normalizedCustomEnd = endOfDay(customEndDate);

    switch (selectedRange) {
      case 'weekly': {
        const weekStart = startOfWeek(rangeCursorDate);
        const isCurrentWeek = weekStart.getTime() === startOfWeek(today).getTime();
        const weekEnd = isCurrentWeek ? endOfDay(today) : endOfWeek(weekStart);

        return {
          label: 'Weekly',
          badge: isCurrentWeek ? 'Week to date' : 'Selected week',
          start: weekStart,
          end: weekEnd,
          summaryTitle: isCurrentWeek ? 'This Week' : 'Selected Week',
          summaryCaption: isCurrentWeek
            ? 'Income, expenses, and net movement across the current week.'
            : `Income, expenses, and net movement for the week of ${formatDateDDMMYYYY(weekStart)}.`,
          comparisonTitle: 'Daily Income vs Expenses',
          comparisonSummaryLabel: isCurrentWeek ? 'net this week' : 'net in the selected week',
          distributionCaption: isCurrentWeek ? 'Expense mix for the current week.' : 'Expense mix for the selected week.',
          footerTransactionLabel: isCurrentWeek ? 'this week' : 'in the selected week',
          topCategoryLeadText: isCurrentWeek ? 'leading this week.' : 'leading in the selected week.',
          netStatLabel: isCurrentWeek ? 'Net This Week' : 'Net in Week',
          monthsWindow: 6,
          showComparison: true,
          insightWindowLabel: isCurrentWeek ? 'This week' : 'Selected week',
          insightPeriodText: isCurrentWeek ? 'this week' : 'the selected week',
          planningContextLabel: 'Based on last 3 months',
          isCurrentWindow: isCurrentWeek,
        };
      }
      case 'sixMonths': {
        const sixMonthsStart = sixMonthsCursorStart ?? firstRecordedMonth;
        const sixMonthsEndCandidate = endOfMonth(new Date(sixMonthsStart.getFullYear(), sixMonthsStart.getMonth() + 5, 1));
        const sixMonthsEnd = sixMonthsEndCandidate.getTime() < today.getTime() ? sixMonthsEndCandidate : endOfDay(today);
        const sixMonthsMonthCount = countMonthsInclusive(sixMonthsStart, sixMonthsEnd);
        const isInitialWindow = sixMonthsStart.getTime() === firstRecordedMonth.getTime();
        const isCurrentWindow = sixMonthsEnd.getTime() >= today.getTime();
        const isShortHistoryWindow = sixMonthsMonthCount < 6;

        return {
          label: 'Six Months',
          badge: isShortHistoryWindow
            ? 'From first activity'
            : isInitialWindow
              ? 'First 6 months'
              : 'Selected 6-month window',
          start: sixMonthsStart,
          end: sixMonthsEnd,
          summaryTitle: isShortHistoryWindow
            ? 'Since You Started'
            : isInitialWindow
              ? 'First 6 Months'
              : 'Selected 6 Months',
          summaryCaption: isShortHistoryWindow
            ? 'Income, expenses, and savings from your first recorded month to the current month.'
            : isInitialWindow
              ? 'Income, expenses, and savings across your first six recorded months.'
              : 'Income, expenses, and savings across the selected six-month window.',
          comparisonTitle: `${sixMonthsMonthCount}-Month Income vs Expenses`,
          comparisonSummaryLabel: isShortHistoryWindow
            ? 'net since your first month'
            : 'net in the selected 6-month window',
          distributionCaption: isShortHistoryWindow
            ? 'Expense mix by category since your first recorded month.'
            : 'Expense mix by category across the selected six-month window.',
          footerTransactionLabel: isShortHistoryWindow ? 'since your first month' : 'in the selected 6-month window',
          topCategoryLeadText: isShortHistoryWindow
            ? 'leading since your first recorded month.'
            : 'leading in the selected six-month window.',
          netStatLabel: isShortHistoryWindow ? 'Net Since Start' : 'Net in 6 Months',
          monthsWindow: sixMonthsMonthCount,
          showComparison: true,
          insightWindowLabel: isShortHistoryWindow ? 'Since you started' : 'Selected 6-month window',
          insightPeriodText: isShortHistoryWindow ? 'since your first recorded month' : 'the selected 6-month window',
          planningContextLabel: 'Based on last 3 months',
          isCurrentWindow,
        };
      }
      case 'annually': {
        const annualCursor = new Date(rangeCursorDate.getFullYear(), rangeCursorDate.getMonth(), 1);
        const isCurrentAnnualWindow = isSameCalendarMonth(annualCursor, today);
        const annualEnd = isCurrentAnnualWindow ? endOfDay(today) : endOfMonth(annualCursor);

        return {
          label: 'Annually',
          badge: isCurrentAnnualWindow ? 'Rolling 12 months' : 'Selected 12-month window',
          start: new Date(annualEnd.getFullYear(), annualEnd.getMonth() - 11, 1),
          end: annualEnd,
          summaryTitle: isCurrentAnnualWindow ? 'Last 12 Months' : 'Selected 12 Months',
          summaryCaption: isCurrentAnnualWindow
            ? 'Income, expenses, and savings across the last twelve months.'
            : 'Income, expenses, and savings across the selected 12-month window.',
          comparisonTitle: '12-Month Income vs Expenses',
          comparisonSummaryLabel: isCurrentAnnualWindow ? 'net over 12 months' : 'net in the selected 12-month window',
          distributionCaption: isCurrentAnnualWindow
            ? 'Expense mix by category for the last 12 months.'
            : 'Expense mix by category for the selected 12-month window.',
          footerTransactionLabel: isCurrentAnnualWindow ? 'in the last 12 months' : 'in the selected 12-month window',
          topCategoryLeadText: isCurrentAnnualWindow
            ? 'leading across the last 12 months.'
            : 'leading across the selected 12-month window.',
          netStatLabel: isCurrentAnnualWindow ? 'Net in 12 Months' : 'Net in Selected Year',
          monthsWindow: 12,
          showComparison: true,
          insightWindowLabel: isCurrentAnnualWindow ? 'Last 12 months' : 'Selected 12-month window',
          insightPeriodText: isCurrentAnnualWindow ? 'the last 12 months' : 'the selected 12-month window',
          planningContextLabel: 'Based on last 3 months',
          isCurrentWindow: isCurrentAnnualWindow,
        };
      }
      case 'period': {
        const periodMonths = countMonthsInclusive(normalizedCustomStart, normalizedCustomEnd);
        const isCurrentPeriod = normalizedCustomEnd.getTime() >= today.getTime();

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
          insightWindowLabel: 'Selected period',
          insightPeriodText: 'the selected period',
          planningContextLabel: periodMonths >= 3 ? 'Based on selected period' : 'Based on last 3 months',
          isCurrentWindow: isCurrentPeriod,
        };
      }
      case 'monthly':
      default: {
        const monthCursor = new Date(rangeCursorDate.getFullYear(), rangeCursorDate.getMonth(), 1);
        const isCurrentMonth = isSameCalendarMonth(monthCursor, today);
        const monthEnd = isCurrentMonth ? endOfDay(today) : endOfMonth(monthCursor);

        return {
          label: 'Monthly',
          badge: isCurrentMonth ? 'Monthly view' : 'Selected month',
          start: monthCursor,
          end: monthEnd,
          summaryTitle: isCurrentMonth ? 'This Month' : formatMonthYearLabel(monthCursor),
          summaryCaption: isCurrentMonth
            ? `Income, expenses, and savings for ${formatShortMonthLabel(today)}.`
            : `Income, expenses, and savings for ${formatMonthYearLabel(monthCursor)}.`,
          comparisonTitle: '6-Month Income vs Expenses',
          comparisonSummaryLabel: isCurrentMonth ? 'net this month' : 'net in the selected month',
          distributionCaption: isCurrentMonth ? 'Current-month expense mix by category.' : 'Selected-month expense mix by category.',
          footerTransactionLabel: isCurrentMonth ? 'this month' : 'in the selected month',
          topCategoryLeadText: isCurrentMonth ? 'leading this month.' : 'leading in the selected month.',
          netStatLabel: isCurrentMonth ? 'Net This Month' : 'Net in Month',
          monthsWindow: 6,
          showComparison: false,
          insightWindowLabel: isCurrentMonth ? 'This month' : 'Selected month',
          insightPeriodText: isCurrentMonth ? 'this month' : 'the selected month',
          planningContextLabel: 'Based on last 3 months',
          isCurrentWindow: isCurrentMonth,
        };
      }
    }
  }, [customEndDate, customStartDate, firstRecordedMonth, rangeCursorDate, selectedRange, sixMonthsCursorStart, today]);

  const activeRangeDisplayTitle = useMemo(() => {
    if (selectedRange === 'weekly') {
      return `${formatDateDDMMYYYY(activeRange.start)} - ${formatDateDDMMYYYY(activeRange.end)}`;
    }

    if (selectedRange === 'monthly') {
      return formatMonthYearLabel(activeRange.end);
    }

    if (selectedRange === 'period') {
      return formatDateDDMMYYYY(activeRange.start) + ' - ' + formatDateDDMMYYYY(activeRange.end);
    }

    return formatMonthYearLabel(activeRange.start) + ' - ' + formatMonthYearLabel(activeRange.end);
  }, [activeRange.end, activeRange.start, selectedRange]);

  const activeRangeDisplaySubtitle = useMemo(() => {
    if (selectedRange === 'weekly') {
      return activeRange.isCurrentWindow ? 'This week so far' : 'Navigate week by week';
    }

    if (selectedRange === 'monthly') {
      return activeRange.isCurrentWindow ? 'Current month view' : 'Navigate month by month';
    }

    if (selectedRange === 'period') {
      return 'Shift the same custom window backward or forward';
    }

    return activeRange.badge;
  }, [activeRange.badge, activeRange.isCurrentWindow, selectedRange]);

  const activeRangeStartMs = activeRange.start.getTime();
  const activeRangeEndMs = activeRange.end.getTime();
  const isWeeklyView = selectedRange === 'weekly';
  const isMonthlyView = selectedRange === 'monthly';
  const isSixMonthsView = selectedRange === 'sixMonths';
  const isAnnualView = selectedRange === 'annually';
  const isPeriodView = selectedRange === 'period';
  const shouldComputeNetWorthStage = visibleStage >= 1 && !isWeeklyView;
  const shouldComputeGuidanceMetrics = shouldComputeGuidanceStage || shouldComputePlanningStage;
  const shouldComputeDebtTotals = shouldComputeNetWorthStage || shouldComputeGuidanceMetrics;
  const shouldComputeComparisonData = shouldComputeTrendStage && activeRange.showComparison;
  const canNavigateBackward = useMemo(() => {
    if (selectedRange === 'weekly') {
      return startOfDay(addDaysToDate(activeRange.start, -7)).getTime() >= firstRecordedMonth.getTime();
    }

    if (selectedRange === 'monthly') {
      return new Date(activeRange.start.getFullYear(), activeRange.start.getMonth() - 1, 1).getTime() >= firstRecordedMonth.getTime();
    }

    if (selectedRange === 'annually') {
      return new Date(activeRange.start.getFullYear(), activeRange.start.getMonth() - 12, 1).getTime() >= firstRecordedMonth.getTime();
    }

    if (selectedRange === 'sixMonths') {
      const baseStart = sixMonthsCursorStart ?? firstRecordedMonth;
      return new Date(baseStart.getFullYear(), baseStart.getMonth() - 6, 1).getTime() >= firstRecordedMonth.getTime();
    }

    const spanDays = countDaysInclusive(customStartDate, customEndDate);
    return startOfDay(addDaysToDate(customStartDate, -spanDays)).getTime() >= firstRecordedMonth.getTime();
  }, [activeRange.start, customEndDate, customStartDate, firstRecordedMonth, selectedRange, sixMonthsCursorStart]);
  const canNavigateForward = useMemo(() => {
    if (selectedRange === 'weekly') {
      return startOfDay(addDaysToDate(activeRange.start, 7)).getTime() <= analyticsReferenceDate.getTime();
    }

    if (selectedRange === 'monthly') {
      return new Date(activeRange.start.getFullYear(), activeRange.start.getMonth() + 1, 1).getTime() <= analyticsReferenceDate.getTime();
    }

    if (selectedRange === 'annually') {
      return new Date(activeRange.end.getFullYear(), activeRange.end.getMonth() + 12, 1).getTime() <= analyticsReferenceDate.getTime();
    }

    if (selectedRange === 'sixMonths') {
      const baseStart = sixMonthsCursorStart ?? firstRecordedMonth;
      return new Date(baseStart.getFullYear(), baseStart.getMonth() + 6, 1).getTime() <= analyticsReferenceDate.getTime();
    }

    const spanDays = countDaysInclusive(customStartDate, customEndDate);
    return endOfDay(addDaysToDate(customEndDate, spanDays)).getTime() <= analyticsReferenceDate.getTime();
  }, [activeRange.end, activeRange.start, analyticsReferenceDate, customEndDate, customStartDate, firstRecordedMonth, selectedRange, sixMonthsCursorStart]);

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

  const selectedBehaviorMetrics = useMemo<BehaviorMetrics>(
    () =>
      shouldComputeGuidanceStage
        ? computeBehaviorMetrics(selectedTransactions, budgets, accounts, activeRange.end)
        : computeBehaviorMetrics([], budgets, accounts, activeRange.end),
    [accounts, activeRange.end, budgets, selectedTransactions, shouldComputeGuidanceStage]
  );

  const selectedWindowInsights = useMemo(
    () => (shouldComputeGuidanceStage ? computeInsights(selectedBehaviorMetrics.insightContext, 6) : []),
    [selectedBehaviorMetrics, shouldComputeGuidanceStage]
  );

  const viewFinancialIntelligence = useMemo(
    () =>
      shouldComputeGuidanceStage
        ? computeFinancialIntelligence({
            transactions: selectedTransactions,
            accounts,
            budgets,
            debtAccounts,
            netBalance,
            monthlyIncome: quickStats.income,
            monthlyExpenses: quickStats.expenses,
            monthlyNet: quickStats.netAmount,
            formatCurrency,
            averageDebtInterestRate: settings.averageDebtInterestRate,
            referenceDate: activeRange.end,
          })
        : null,
    [
      accounts,
      activeRange.end,
      budgets,
      debtAccounts,
      formatCurrency,
      netBalance,
      quickStats.expenses,
      quickStats.income,
      quickStats.netAmount,
      selectedTransactions,
      settings.averageDebtInterestRate,
      shouldComputeGuidanceStage,
    ]
  );

  const categorySpending = useMemo(
    () => (shouldComputeTrendStage ? computeCategoryBreakdown(selectedTransactions, 'expense') : []),
    [selectedTransactions, shouldComputeTrendStage]
  );
  const incomeCategoryBreakdown = useMemo(
    () => (shouldComputeTrendStage ? computeCategoryBreakdown(selectedTransactions, 'income') : []),
    [selectedTransactions, shouldComputeTrendStage]
  );
  const totalCategorySpend = useMemo(
    () => categorySpending.reduce((sum, category) => sum + category.amount, 0),
    [categorySpending]
  );

  const categoryBarData = useMemo(() => {
    return categorySpending
      .slice()
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5)
      .map((category, index) => ({
        key: category.categoryName,
        rank: index + 1,
        x: truncateLabel(category.categoryName, 10),
        y: category.amount,
        fullLabel: category.categoryName,
        fill: category.color ?? categoryPalette[index % categoryPalette.length],
        gradientId: `spendingCategoryGradient${index}`,
        valueLabel: formatCompactNumber(category.amount),
        share: totalCategorySpend > 0 ? category.amount / totalCategorySpend : 0,
      }));
  }, [categorySpending, totalCategorySpend]);

  const topCategory = useMemo(() => {
    if (categorySpending.length === 0) {
      return null;
    }

    return categorySpending.reduce((top, item) => (item.amount > top.amount ? item : top), categorySpending[0]);
  }, [categorySpending]);

  const expenseDistribution = useMemo(
    () => computeCategoryDistribution(categorySpending, 6),
    [categorySpending]
  );

  const incomeDistribution = useMemo(
    () => computeCategoryDistribution(incomeCategoryBreakdown, 6),
    [incomeCategoryBreakdown]
  );

  const distributionSections = useMemo<DistributionSection[]>(
    () => [
      { key: 'expense', label: 'Expenses', total: totalCategorySpend, items: expenseDistribution },
      { key: 'income', label: 'Income', total: quickStats.income, items: incomeDistribution },
    ],
    [expenseDistribution, incomeDistribution, quickStats.income, totalCategorySpend]
  );
  const comparisonMonths = useMemo(() => {
    if (!shouldComputeComparisonData) {
      return [] as Date[];
    }

    if (selectedRange === 'weekly') {
      return buildDayBuckets(activeRange.start, activeRange.end);
    }

    if (selectedRange === 'sixMonths') {
      return buildMonthBuckets(activeRange.start, activeRange.end);
    }

    if (selectedRange === 'annually') {
      return buildRecentMonths(12, activeRange.end);
    }

    return buildMonthBuckets(activeRange.start, activeRange.end);
  }, [activeRange.end, activeRange.start, selectedRange, shouldComputeComparisonData]);

  const comparisonSeries = useMemo(() => {
    if (comparisonMonths.length === 0) {
      return {
        labels: [] as string[],
        expenseData: [] as Array<{ x: string; y: number; bucketKey: string }>,
        incomeData: [] as Array<{ x: string; y: number; bucketKey: string }>,
        bucketDetails: [] as Array<{ key: string; label: string; income: number; expenses: number; net: number }>,
        totalIncome: 0,
        totalExpenses: 0,
      };
    }

    const isDailyComparison = selectedRange === 'weekly';
    const firstMonth = comparisonMonths[0];
    const lastMonth = comparisonMonths[comparisonMonths.length - 1];
    const includeYear = comparisonMonths.length > 12 || firstMonth.getFullYear() != lastMonth.getFullYear();
    const bucketLabels = comparisonMonths.map((bucketDate) =>
      isDailyComparison
        ? formatShortWeekdayLabel(bucketDate)
        : formatMonthYearShortLabel(bucketDate, includeYear)
    );
    const buckets = comparisonMonths.map((bucketDate, index) => ({
      key: isDailyComparison ? toDayKey(bucketDate) : toMonthKey(bucketDate),
      label: bucketLabels[index] ?? formatShortMonthLabel(bucketDate),
      income: 0,
      expenses: 0,
    }));
    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    for (const transaction of selectedTransactions) {
      if (transaction.type !== 'income' && transaction.type !== 'expense') {
        continue;
      }

      const bucketKey = isDailyComparison ? toDayKey(transaction.date) : toMonthKey(transaction.date);
      const bucket = bucketMap.get(bucketKey);
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
      expenseData: buckets.map((bucket) => ({ x: bucket.label, y: roundCurrency(bucket.expenses), bucketKey: bucket.key })),
      incomeData: buckets.map((bucket) => ({ x: bucket.label, y: roundCurrency(bucket.income), bucketKey: bucket.key })),
      bucketDetails: buckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        income: roundCurrency(bucket.income),
        expenses: roundCurrency(bucket.expenses),
        net: roundCurrency(bucket.income - bucket.expenses),
      })),
      totalIncome: roundCurrency(buckets.reduce((sum, bucket) => sum + bucket.income, 0)),
      totalExpenses: roundCurrency(buckets.reduce((sum, bucket) => sum + bucket.expenses, 0)),
    };
  }, [comparisonMonths, selectedRange, selectedTransactions]);

  const analyticsSkiaData = useMemo(() => {
    let runningNet = 0;
    return {
      months: comparisonSeries.bucketDetails.map((bucket) => bucket.label),
      lineValues: comparisonSeries.bucketDetails.map((bucket) => {
        runningNet = roundCurrency(runningNet + bucket.net);
        return runningNet;
      }),
      income: comparisonSeries.bucketDetails.map((bucket) => bucket.income),
      expenses: comparisonSeries.bucketDetails.map((bucket) => bucket.expenses),
    };
  }, [comparisonSeries.bucketDetails]);

  const comparisonNetData = useMemo(
    () =>
      comparisonSeries.bucketDetails.map((bucket) => ({
        x: bucket.label,
        y: bucket.net,
        bucketKey: bucket.key,
      })),
    [comparisonSeries.bucketDetails]
  );
  const comparisonBestBucket = useMemo(() => {
    if (comparisonSeries.bucketDetails.length === 0) {
      return null;
    }

    return comparisonSeries.bucketDetails.reduce((best, bucket) => (bucket.net > best.net ? bucket : best), comparisonSeries.bucketDetails[0]);
  }, [comparisonSeries.bucketDetails]);
  const comparisonYDomain = useMemo<[number, number]>(
    () =>
      computeChartYDomain([
        ...comparisonSeries.incomeData.map((point) => point.y),
        ...comparisonSeries.expenseData.map((point) => point.y),
      ]),
    [comparisonSeries.expenseData, comparisonSeries.incomeData]
  );

  const focusedExpenseDistribution = useMemo(
    () => expenseDistribution.find((entry) => entry.name === focusedExpenseName) ?? expenseDistribution[0] ?? null,
    [expenseDistribution, focusedExpenseName]
  );
  const focusedComparisonBucket = useMemo(
    () =>
      comparisonSeries.bucketDetails.find((bucket) => bucket.key === focusedComparisonBucketKey) ??
      comparisonSeries.bucketDetails[comparisonSeries.bucketDetails.length - 1] ??
      null,
    [comparisonSeries.bucketDetails, focusedComparisonBucketKey]
  );
  const focusedCategoryBar = useMemo(
    () => categoryBarData.find((entry) => entry.key === focusedSpendingCategoryKey) ?? categoryBarData[0] ?? null,
    [categoryBarData, focusedSpendingCategoryKey]
  );
  const categoryTotalStatsEntries = useMemo(
    () =>
      categoryBarData.map((item) => ({
        key: item.key,
        label: item.x,
        value: item.y,
        color: item.fill,
        valueLabel: item.valueLabel,
        detail: `${formatPercentage(item.share)} of spend`,
      })),
    [categoryBarData]
  );

  useEffect(() => {
    setFocusedExpenseName((current) =>
      expenseDistribution.some((entry) => entry.name === current) ? current : expenseDistribution[0]?.name ?? null
    );
  }, [expenseDistribution]);

  useEffect(() => {
    setFocusedComparisonBucketKey((current) =>
      comparisonSeries.bucketDetails.some((bucket) => bucket.key === current)
        ? current
        : comparisonSeries.bucketDetails[comparisonSeries.bucketDetails.length - 1]?.key ?? null
    );
  }, [comparisonSeries.bucketDetails]);

  useEffect(() => {
    setFocusedSpendingCategoryKey((current) =>
      categoryBarData.some((entry) => entry.key === current) ? current : categoryBarData[0]?.key ?? null
    );
  }, [categoryBarData]);

  const netWorthProgress = useMemo<NetWorthProgress>(
    () =>
      shouldComputeNetWorthStage
        ? computeNetWorthProgress(accounts, allTransactions, activeRange.monthsWindow, activeRange.end)
        : EMPTY_NET_WORTH_PROGRESS,
    [accounts, activeRange.end, activeRange.monthsWindow, allTransactions, shouldComputeNetWorthStage]
  );

  const currentNetWorthProgress = useMemo<NetWorthProgress>(
    () =>
      shouldComputeGuidanceMetrics
        ? computeNetWorthProgress(accounts, allTransactions, 6, analyticsReferenceDate)
        : EMPTY_NET_WORTH_PROGRESS,
    [accounts, allTransactions, analyticsReferenceDate, shouldComputeGuidanceMetrics]
  );

  const debtPortfolioTotals = useMemo<DebtPortfolioTotals>(
    () =>
      shouldComputeDebtTotals
        ? computeDebtPortfolioTotals(accounts, allTransactions)
        : EMPTY_DEBT_PORTFOLIO_TOTALS,
    [accounts, allTransactions, shouldComputeDebtTotals]
  );

  const accountBalanceById = useMemo(() => {
    if (!shouldComputeGuidanceMetrics) {
      return EMPTY_BALANCE_MAP;
    }

    return computeAccountBalanceMap(allTransactions);
  }, [allTransactions, shouldComputeGuidanceMetrics]);

  const liquidBalance = useMemo(
    () =>
      roundCurrency(
        accounts
          .filter((account) => account.isActive !== false && isAccountInTypeGroup(account.type, ['cash_bank', 'savings']))
          .reduce((sum, account) => sum + Math.max(0, accountBalanceById.get(account.id) ?? 0), 0)
      ),
    [accounts, accountBalanceById]
  );

  const investmentBalance = useMemo(
    () =>
      roundCurrency(
        accounts
          .filter((account) => account.isActive !== false && isAccountInTypeGroup(account.type, ['investment']))
          .reduce((sum, account) => sum + Math.max(0, accountBalanceById.get(account.id) ?? 0), 0)
      ),
    [accounts, accountBalanceById]
  );

  const recentMonthlySnapshot = useMemo(
    () =>
      shouldComputeGuidanceMetrics
        ? computeRecentAverageMonthlyTotals(transactions, analyticsReferenceDate, 3)
        : null,
    [analyticsReferenceDate, shouldComputeGuidanceMetrics, transactions]
  );

  const averageMonthlyExpenses = recentMonthlySnapshot?.averageExpenses ?? 0;
  const averageMonthlyIncome = recentMonthlySnapshot?.averageIncome ?? 0;

  const monthlySavings = Math.max(0, netWorthSimulation?.monthlySavings ?? recentMonthlySnapshot?.averageNet ?? roundCurrency(averageMonthlyIncome - averageMonthlyExpenses));
  const emergencyFundTarget = roundCurrency(averageMonthlyExpenses * 6);
  const emergencyFundProgress = emergencyFundTarget > 0 ? clamp(liquidBalance / emergencyFundTarget) : 0;
  const emergencyFundMonths = averageMonthlyExpenses > 0
    ? roundCurrency(liquidBalance / averageMonthlyExpenses)
    : null;
  const emergencyFundEtaMonths = emergencyFundTarget > 0
    ? estimateMonthsToTarget(liquidBalance, emergencyFundTarget, monthlySavings, 0)
    : null;

  const debtBalance = debtPortfolioTotals.borrowedOutstanding;
  const originalDebt = debtPortfolioTotals.borrowedPrincipal;
  const debtProgress = originalDebt > 0 ? clamp(1 - debtBalance / originalDebt) : 1;
  const debtEtaMonths = debtPayoffPlan ? debtPayoffPlan[debtPayoffPlan.recommendedStrategy].months : null;

  const starterInvestmentBase = useMemo(
    () => computeStarterInvestmentBase(liquidBalance, investmentBalance, averageMonthlyExpenses),
    [averageMonthlyExpenses, investmentBalance, liquidBalance]
  );
  const investmentTarget = useMemo(
    () => computeStarterInvestmentTarget(currentNetWorthProgress.currentNetWorth, averageMonthlyIncome, averageMonthlyExpenses),
    [averageMonthlyExpenses, averageMonthlyIncome, currentNetWorthProgress.currentNetWorth]
  );
  const investmentProgress = investmentTarget > 0 ? clamp(starterInvestmentBase / investmentTarget) : 0;
  const investmentProjection = useMemo(
    () => estimateTargetProjection(starterInvestmentBase, investmentTarget, monthlySavings, 0, analyticsReferenceDate),
    [investmentTarget, analyticsReferenceDate, monthlySavings, starterInvestmentBase]
  );
  const investmentEtaMonths = investmentProjection.estimatedMonths;
  const investmentEtaDate = investmentProjection.estimatedDate;

  const milestoneLadder = useMemo(
    () => buildWealthMilestoneLadder(currentNetWorthProgress.currentNetWorth, averageMonthlyIncome, averageMonthlyExpenses),
    [averageMonthlyExpenses, averageMonthlyIncome, currentNetWorthProgress.currentNetWorth]
  );
  const { previousMilestone: previousNetWorthMilestone, nextMilestone: netWorthTarget } = useMemo(
    () => resolveMilestoneRange(currentNetWorthProgress.currentNetWorth, milestoneLadder),
    [currentNetWorthProgress.currentNetWorth, milestoneLadder]
  );
  const netWorthMilestoneProgress = netWorthTarget > 0
    ? calculateMilestoneProgress(currentNetWorthProgress.currentNetWorth, previousNetWorthMilestone, netWorthTarget)
    : 0;
  const netWorthProjection = useMemo(
    () => estimateTargetProjection(currentNetWorthProgress.currentNetWorth, netWorthTarget, monthlySavings, 0, analyticsReferenceDate),
    [currentNetWorthProgress.currentNetWorth, analyticsReferenceDate, monthlySavings, netWorthTarget]
  );
  const netWorthEtaMonths = netWorthProjection.estimatedMonths;
  const netWorthEtaDate = netWorthProjection.estimatedDate;

  const financialIndependenceTarget = roundCurrency(averageMonthlyExpenses * 12 * 25);
  const financialIndependenceBase = useMemo(
    () => computeFinancialIndependenceBase(liquidBalance, investmentBalance, emergencyFundTarget),
    [emergencyFundTarget, investmentBalance, liquidBalance]
  );
  const financialIndependenceProgress = financialIndependenceTarget > 0
    ? clamp(financialIndependenceBase / financialIndependenceTarget)
    : 0;
  const financialIndependenceProjection = useMemo(
    () => estimateTargetProjection(
      financialIndependenceBase,
      financialIndependenceTarget,
      monthlySavings,
      0,
      analyticsReferenceDate
    ),
    [financialIndependenceBase, financialIndependenceTarget, analyticsReferenceDate, monthlySavings]
  );
  const financialIndependenceEtaMonths = financialIndependenceProjection.estimatedMonths;
  const financialIndependenceEtaDate = financialIndependenceProjection.estimatedDate;

  const milestoneCards = useMemo(() => {
    if (!shouldComputePlanningStage) {
      return [] as MilestoneCard[];
    }

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
      etaPrefix: 'At last 3-month pace',
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
    if (starterInvestmentBase >= investmentTarget) {
      investmentInsights.push(`You already have enough available capital to fund a starter investment base above ${formatCurrency(investmentTarget)}.`);
    } else {
      investmentInsights.push(`Reaching ${formatCurrency(investmentTarget)} gives you a practical base for long-term investing.`);
    }

    if (investmentBalance <= 0 && starterInvestmentBase > 0) {
      investmentInsights.push(`You could move ${formatCurrency(starterInvestmentBase)} from available cash into an investment account when you are ready.`);
    }

    cards.push({
      id: 'first-investment',
      title: 'Starter Investment',
      targetLabel: 'Target',
      currentLabel: 'Available to invest',
      target: investmentTarget,
      current: starterInvestmentBase,
      progress: investmentProgress,
      estimatedMonths: investmentEtaMonths,
      estimatedDate: investmentEtaDate,
      insights: investmentInsights,
      achieved: investmentProgress >= 1,
      etaPrefix: 'At last 3-month pace',
    });

    const netWorthInsights: string[] = [];
    if (previousNetWorthMilestone > 0) {
      netWorthInsights.push(`This milestone measures the stretch from ${formatCurrency(previousNetWorthMilestone)} to ${formatCurrency(netWorthTarget)}.`);
    }

    if (currentNetWorthProgress.currentNetWorth >= (milestoneLadder[milestoneLadder.length - 1] ?? 0)) {
      netWorthInsights.push(`You cleared your previous ladder. The next stretch target is ${formatCurrency(netWorthTarget)}.`);
    } else if (netWorthEtaMonths !== null) {
      const etaText = formatDurationLong(netWorthEtaMonths);
      if (etaText) {
        netWorthInsights.push(`At your last 3-month pace, you could reach ${formatCurrency(netWorthTarget)} in about ${etaText}.`);
      }
    }

    cards.push({
      id: 'net-worth',
      title: 'Net Worth Milestone',
      targetLabel: 'Next Milestone',
      currentLabel: 'Current Net Worth',
      target: netWorthTarget,
      current: currentNetWorthProgress.currentNetWorth,
      progress: netWorthMilestoneProgress,
      estimatedMonths: netWorthEtaMonths,
      estimatedDate: netWorthEtaDate,
      insights: netWorthInsights,
      achieved: false,
      etaPrefix: 'At last 3-month pace',
    });

    const fiInsights: string[] = [];
    if (financialIndependenceTarget <= 0) {
      fiInsights.push('Track expenses to estimate your financial independence target.');
    } else if (financialIndependenceEtaMonths !== null) {
      const etaText = formatDurationLong(financialIndependenceEtaMonths);
      if (etaText) {
        fiInsights.push(`At your last 3-month pace, your investable assets could cover annual expenses in about ${etaText}.`);
      }
    }

    if (financialIndependenceTarget > 0 && monthlySavings > 0) {
      const baseMonths = financialIndependenceEtaMonths;
      const boostedMonths = estimateMonthsToTarget(
        financialIndependenceBase,
        financialIndependenceTarget,
        monthlySavings + 100,
        0
      );
      if (baseMonths !== null && boostedMonths !== null && baseMonths > boostedMonths) {
        const diff = baseMonths - boostedMonths;
        const diffText = formatDurationLong(diff);
        if (diffText) {
          fiInsights.push(`Saving ${formatCurrency(100)} more per month could reach financial independence ${diffText} earlier.`);
        }
      }
    }

    cards.push({
      id: 'financial-independence',
      title: 'Financial Independence',
      targetLabel: 'Target',
      currentLabel: 'Investable Assets',
      target: financialIndependenceTarget,
      current: financialIndependenceBase,
      progress: financialIndependenceProgress,
      estimatedMonths: financialIndependenceEtaMonths,
      estimatedDate: financialIndependenceEtaDate,
      insights: fiInsights,
      achieved: financialIndependenceProgress >= 1 && financialIndependenceTarget > 0,
      etaPrefix: 'At last 3-month pace',
    });

    return cards;
  }, [
    debtBalance,
    debtEtaMonths,
    emergencyFundEtaMonths,
    emergencyFundMonths,
    emergencyFundProgress,
    emergencyFundTarget,
    financialIndependenceBase,
    financialIndependenceEtaDate,
    financialIndependenceEtaMonths,
    financialIndependenceProgress,
    financialIndependenceTarget,
    formatCurrency,
    investmentBalance,
    investmentEtaDate,
    investmentEtaMonths,
    investmentProgress,
    investmentTarget,
    starterInvestmentBase,
    liquidBalance,
    milestoneLadder,
    previousNetWorthMilestone,
    monthlySavings,
    netWorthEtaDate,
    netWorthEtaMonths,
    netWorthMilestoneProgress,
    currentNetWorthProgress.currentNetWorth,
    netWorthTarget,
    originalDebt,
    shouldComputePlanningStage,
  ]);

  const advisorInsights = useMemo<AnalyticsAdvisorInsight[]>(() => {
    if (!shouldComputeGuidanceStage) {
      return [];
    }

    const insightMap = new Map<string, AnalyticsAdvisorInsight>();

    for (const insight of selectedWindowInsights) {
      insightMap.set(insight.id, {
        ...insight,
        message: rewriteInsightMessageForRange(insight.message, activeRange.insightPeriodText),
        windowLabel: activeRange.insightWindowLabel,
      });
    }

    if (topCategory && totalCategorySpend > 0) {
      insightMap.set('advisor-top-category', {
        id: 'advisor-top-category',
        title: 'Top spending area',
        message: `${topCategory.categoryName} accounted for ${formatPercentage(topCategory.amount / totalCategorySpend)} of expenses ${activeRange.footerTransactionLabel}.`,
        severity: 'info',
        confidence: 0.72,
        windowLabel: activeRange.insightWindowLabel,
      });
    }

    const topBudgetSuggestion = viewFinancialIntelligence?.budgetSuggestions[0];
    if (topBudgetSuggestion) {
      insightMap.set(`advisor-budget-${topBudgetSuggestion.categoryId}`, {
        id: `advisor-budget-${topBudgetSuggestion.categoryId}`,
        title: 'Budget anchor',
        message: `${topBudgetSuggestion.categoryName} looks healthier around ${formatCurrency(topBudgetSuggestion.suggestedBudget)} for ${activeRange.insightPeriodText}.`,
        severity: 'info',
        confidence: 0.66,
        windowLabel: activeRange.insightWindowLabel,
      });
    }

    const nextMilestoneEtaText = formatDurationLong(netWorthEtaMonths);
    if (netWorthTarget > 0 && nextMilestoneEtaText) {
      insightMap.set('advisor-next-milestone', {
        id: 'advisor-next-milestone',
        title: 'Next net worth milestone',
        message: `${formatCurrency(netWorthTarget)} is about ${nextMilestoneEtaText} away at your last 3-month pace.`,
        severity: 'info',
        confidence: 0.7,
        windowLabel: 'Based on last 3 months',
      });
    }

    const debtEtaText = formatDurationLong(debtEtaMonths);
    if (debtBalance > 0 && debtEtaText) {
      insightMap.set('advisor-debt-horizon', {
        id: 'advisor-debt-horizon',
        title: 'Debt horizon',
        message: `At your current payment pace, debt freedom is about ${debtEtaText} away.`,
        severity: 'warning',
        confidence: 0.74,
        windowLabel: 'Based on current payment pace',
      });
    }

    return Array.from(insightMap.values())
      .sort((left, right) => {
        const severityDiff = getInsightSeverityWeight(right.severity) - getInsightSeverityWeight(left.severity);
        if (severityDiff !== 0) {
          return severityDiff;
        }

        return right.confidence - left.confidence;
      })
      .slice(0, 5);
  }, [
    activeRange.footerTransactionLabel,
    activeRange.insightPeriodText,
    activeRange.insightWindowLabel,
    debtBalance,
    debtEtaMonths,
    formatCurrency,
    netWorthEtaMonths,
    netWorthTarget,
    selectedWindowInsights,
    shouldComputeGuidanceStage,
    topCategory,
    totalCategorySpend,
    viewFinancialIntelligence,
  ]);

  const guidanceSectionSubtitle = `${activeRange.insightWindowLabel} guidance, with longer-term pace callouts labeled explicitly.`;
  const planningSectionTitle = 'Goals & Outlook';
  const planningSectionSubtitle = isWeeklyView
    ? 'Weekly activity stays above; the outlook below uses your current balances and last 3-month pace.'
    : activeRange.isCurrentWindow
      ? 'Current long-term outlook based on your latest balances and saving pace.'
      : 'Current long-term outlook shown alongside the selected historical window.';

  const activeAccountIds = useMemo(
    () => new Set(accounts.filter((account) => account.isActive !== false).map((account) => account.id as string)),
    [accounts]
  );

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  const monthlyNetFlowByMonth = useMemo(() => {
    if (!shouldComputeNetWorthStage) {
      return EMPTY_BALANCE_MAP;
    }

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
  }, [shouldComputeNetWorthStage, transactions]);

  const cumulativeNetFlow = useMemo(() => {
    if (!shouldComputeNetWorthStage) {
      return [] as number[];
    }

    let running = 0;
    return netWorthProgress.points.map((point) => {
      const monthNetFlow = monthlyNetFlowByMonth.get(point.month) ?? 0;
      running += monthNetFlow;
      return roundCurrency(running);
    });
  }, [monthlyNetFlowByMonth, netWorthProgress.points, shouldComputeNetWorthStage]);

  const netWorthSeries = useMemo(() => {
    const dates = netWorthProgress.points.map((point) => {
      const [year, month] = point.month.split('-').map(Number);
      return new Date(year, (month ?? 1) - 1, 1);
    });
    const includeYear =
      dates.length > 1 && dates[0].getFullYear() !== dates[dates.length - 1].getFullYear();
    const labels = dates.map((date) => formatMonthYearShortLabel(date, includeYear));

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
      tickValues: dates.length <= 6 ? dates : dates.filter((_, index) => index % 2 === 0),
      labels,
      includeYear,
    };
  }, [cumulativeNetFlow, netWorthProgress]);

  const netWorthChartTicks = useMemo(
    () =>
      netWorthSeries.tickValues
        .map((tickDate) => {
          const index = netWorthSeries.netWorthData.findIndex((point) => point.x.getTime() === tickDate.getTime());
          return index >= 0
            ? { index, label: formatMonthYearShortLabel(tickDate, netWorthSeries.includeYear) }
            : null;
        })
        .filter((value): value is { index: number; label: string } => value !== null),
    [netWorthSeries]
  );

  const netWorthLineSeries = useMemo(
    () => [
      {
        key: 'net-worth',
        values: netWorthSeries.netWorthData.map((point) => point.y),
        color: chartPalette.netWorth,
        strokeWidth: 2.5,
        fillColor: chartPalette.netWorth,
        showDots: true,
        dotRadius: 2.6,
        dotFill: cardBackground,
        dotStroke: chartPalette.netWorth,
        activeIndex: netWorthSeries.netWorthData.length > 0 ? netWorthSeries.netWorthData.length - 1 : null,
        activeRadius: 4.2,
        activeFill: chartPalette.netWorth,
        activeStroke: cardBackground,
      },
      {
        key: 'growth',
        values: netWorthSeries.growthData.map((point) => point.y),
        color: chartPalette.growth,
        strokeWidth: 1.8,
        dashed: true,
      },
      {
        key: 'flow',
        values: netWorthSeries.flowData.map((point) => point.y),
        color: chartPalette.netFlow,
        strokeWidth: 1.8,
      },
    ],
    [cardBackground, netWorthSeries]
  );

  const comparisonChartEntries = useMemo(
    () =>
      comparisonSeries.bucketDetails.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        income: bucket.income,
        expenses: bucket.expenses,
        net: bucket.net,
      })),
    [comparisonSeries.bucketDetails]
  );

  const forecastAxisItems = useMemo(
    () =>
      netWorthForecastData
        ? netWorthForecastData.tickValues
            .map((tickDate) => {
              const index = netWorthForecastData.data.findIndex((point) => point.x.getTime() === tickDate.getTime());
              return index >= 0
                ? {
                    index,
                    label: tickDate.getFullYear().toString(),
                    valueLabel: formatCompactNumber(netWorthForecastData.data[index]?.y ?? 0),
                  }
                : null;
            })
            .filter((value): value is { index: number; label: string; valueLabel: string } => value !== null)
        : [],
    [netWorthForecastData]
  );
  const forecastLineLabels = useMemo(
    () => (netWorthForecastData ? netWorthForecastData.data.map((point) => point.x.getFullYear().toString()) : []),
    [netWorthForecastData]
  );
  const netWorthProgressYDomain = useMemo(
    () => computeChartYDomain([
      ...netWorthProgress.netWorth,
      ...netWorthProgress.cumulativeGrowth,
      ...cumulativeNetFlow,
    ]),
    [cumulativeNetFlow, netWorthProgress.cumulativeGrowth, netWorthProgress.netWorth]
  );

  const netWorthPeakValue = useMemo(
    () => (netWorthProgress.netWorth.length > 0 ? Math.max(...netWorthProgress.netWorth) : 0),
    [netWorthProgress.netWorth]
  );
  const netWorthLowValue = useMemo(
    () => (netWorthProgress.netWorth.length > 0 ? Math.min(...netWorthProgress.netWorth) : 0),
    [netWorthProgress.netWorth]
  );
  const netWorthRangeDelta = useMemo(() => {
    if (netWorthProgress.netWorth.length === 0) {
      return 0;
    }
    return roundCurrency((netWorthProgress.netWorth[netWorthProgress.netWorth.length - 1] ?? 0) - (netWorthProgress.netWorth[0] ?? 0));
  }, [netWorthProgress.netWorth]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedForecastIndex, setSelectedForecastIndex] = useState(0);
  const [showMonthDrillDown, setShowMonthDrillDown] = useState(false);

  useEffect(() => {
    if (netWorthProgress.points.length === 0) {
      setSelectedMonthIndex(0);
      return;
    }
    setSelectedMonthIndex(netWorthProgress.points.length - 1);
  }, [netWorthProgress.points.length]);

  useEffect(() => {
    if (!netWorthForecastData || netWorthForecastData.data.length === 0) {
      setSelectedForecastIndex(0);
      return;
    }
    setSelectedForecastIndex(netWorthForecastData.data.length - 1);
  }, [netWorthForecastData?.data.length]);

  const hasActiveAccounts = useMemo(
    () => accounts.some((account) => account.isActive !== false),
    [accounts]
  );

  const hasTrackedNetWorthData =
    shouldComputeNetWorthStage && (
      hasActiveAccounts || debtPortfolioTotals.borrowedPrincipal > 0 || debtPortfolioTotals.lentOutstanding > 0
    );
  const hasRecordedDebt = useMemo(
    () =>
      shouldComputeGuidanceMetrics && (
        debtAccounts.length > 0 || allTransactions.some((transaction) => transaction.type === 'debt' || transaction.debtPayment)
      ),
    [allTransactions, debtAccounts.length, shouldComputeGuidanceMetrics]
  );

  const safeSelectedMonthIndex = Math.min(
    selectedMonthIndex,
    Math.max(0, netWorthProgress.points.length - 1)
  );
  const safeSelectedForecastIndex = Math.min(
    selectedForecastIndex,
    Math.max(0, (netWorthForecastData?.data.length ?? 1) - 1)
  );

  const selectedMonthPoint = netWorthProgress.points[safeSelectedMonthIndex];
  const selectedMonthLabel = selectedMonthPoint
    ? netWorthSeries.labels[safeSelectedMonthIndex] ?? selectedMonthPoint.label
    : null;
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
    if (!showMonthDrillDown || !selectedMonthPoint) {
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
  }, [accountNameById, activeAccountIds, selectedMonthPoint, showMonthDrillDown, transactions]);

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
  const hasIncomeDistributionData = incomeDistribution.length > 0;
  const hasCategoryBreakdownData = categoryBarData.length > 0;
  const hasNetWorthProgressChart =
    hasTrackedNetWorthData &&
    netWorthProgress.points.some((point) => point.netWorth !== 0 || point.assets !== 0 || point.liabilities !== 0);
  const hasNetWorthForecastChart = Boolean(
    netWorthSimulation &&
    netWorthForecastData &&
    netWorthForecastData.data.some((point) => point.y !== 0)
  );
  const shouldShowNetWorthSnapshot = !isWeeklyView && hasNetWorthProgressChart;
  const shouldShowExpenseDistributionChart =
    hasExpenseDistributionData || hasIncomeDistributionData;
  const shouldShowComparisonChart = hasComparisonData;
  const shouldShowCategoryBreakdownChart = hasCategoryBreakdownData;
  const hasVisibleSpendingTrendCharts =
    shouldShowExpenseDistributionChart || shouldShowComparisonChart || shouldShowCategoryBreakdownChart;
  const shouldShowForecastChart =
    hasNetWorthForecastChart &&
    !isWeeklyView &&
    (!isPeriodView || activeRange.monthsWindow >= 2);
  const hasSelectedRangeTransactions = selectedTransactions.length > 0;
  const shouldShowPlanningSection =
    shouldShowForecastChart || hasRecordedDebt || milestoneCards.length > 0;
  const hasVisibleAnalyticsContent =
    shouldShowNetWorthSnapshot || hasVisibleSpendingTrendCharts || shouldShowPlanningSection;
  const shouldShowAnalyticsEmptyState = !hasSelectedRangeTransactions || !hasVisibleAnalyticsContent;

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
    startTransition(() => {
      setSelectedRange(range);
      setShowRangeMenu(false);

      if (range === 'sixMonths') {
        setSixMonthsCursorStart(firstRecordedMonth);
        return;
      }

      if (range !== 'period') {
        setRangeCursorDate(analyticsReferenceDate);
      }
    });
  };

  const handleNavigateRange = (direction: 'previous' | 'next') => {
    if (direction === 'previous' && !canNavigateBackward) {
      return;
    }

    if (direction === 'next' && !canNavigateForward) {
      return;
    }

    const step = direction === 'previous' ? -1 : 1;

    startTransition(() => {
      setShowRangeMenu(false);

      if (selectedRange === 'weekly') {
        setRangeCursorDate(startOfDay(addDaysToDate(activeRange.start, step * 7)));
        return;
      }

      if (selectedRange === 'monthly') {
        setRangeCursorDate(startOfDay(new Date(activeRange.start.getFullYear(), activeRange.start.getMonth() + step, 1)));
        return;
      }

      if (selectedRange === 'annually') {
        setRangeCursorDate(startOfDay(new Date(activeRange.end.getFullYear(), activeRange.end.getMonth() + step * 12, 1)));
        return;
      }

      if (selectedRange === 'sixMonths') {
        const baseStart = sixMonthsCursorStart ?? firstRecordedMonth;
        const nextStart = new Date(baseStart.getFullYear(), baseStart.getMonth() + step * 6, 1);
        setSixMonthsCursorStart(nextStart.getTime() < firstRecordedMonth.getTime() ? firstRecordedMonth : nextStart);
        return;
      }

      if (selectedRange === 'period') {
        const spanDays = countDaysInclusive(customStartDate, customEndDate);
        setCustomStartDate(startOfDay(addDaysToDate(customStartDate, step * spanDays)));
        setCustomEndDate(endOfDay(addDaysToDate(customEndDate, step * spanDays)));
      }
    });
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
          <View style={[styles.analyticsHeroOrb, { backgroundColor: theme.colors.primary + '10' }]} />
          <View style={styles.analyticsHeroContent}>
            <View style={styles.analyticsHeroTopRow}>
              <View style={styles.analyticsHeroHeading}>
                <Text style={[styles.analyticsHeroEyebrow, { color: theme.colors.primary }]}>Analytics</Text>
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
                <View style={styles.analyticsRangeButtonTextWrap}>
                  <Text style={[styles.analyticsRangeButtonLabel, { color: theme.colors.textSecondary }]}>View</Text>
                  <Text style={[styles.analyticsRangeButtonText, { color: theme.colors.text }]}>{activeRange.label}</Text>
                </View>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.analyticsRangeNavigator, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Show previous ${activeRange.label.toLowerCase()} range`}
                style={[
                  styles.analyticsRangeNavButton,
                  { borderColor: softBorderColor },
                  !canNavigateBackward && styles.analyticsRangeNavButtonDisabled,
                ]}
                disabled={!canNavigateBackward}
                onPress={() => handleNavigateRange('previous')}
              >
                <ChevronLeft size={18} color={canNavigateBackward ? theme.colors.text : theme.colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.analyticsRangeNavigatorCopy}>
                <Text style={[styles.analyticsRangeHeading, { color: theme.colors.text }]} numberOfLines={1}>
                  {activeRangeDisplayTitle}
                </Text>
                <Text style={[styles.analyticsRangeHeadingMeta, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  {activeRangeDisplaySubtitle}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Show next ${activeRange.label.toLowerCase()} range`}
                style={[
                  styles.analyticsRangeNavButton,
                  { borderColor: softBorderColor },
                  !canNavigateForward && styles.analyticsRangeNavButtonDisabled,
                ]}
                disabled={!canNavigateForward}
                onPress={() => handleNavigateRange('next')}
              >
                <ChevronRight size={18} color={canNavigateForward ? theme.colors.text : theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
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

            {!shouldShowAnalyticsEmptyState ? (
              <>
                <View style={styles.analyticsHeroStats}>
                  <View style={[styles.analyticsHeroStat, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}> 
                    <Text style={[styles.analyticsHeroStatLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                    <AdaptiveAmountText style={[styles.analyticsHeroStatValue, styles.incomeText]} minFontSize={12} value={formatCurrency(monthlyIncome)} />
                  </View>
                  <View style={[styles.analyticsHeroStat, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}> 
                    <Text style={[styles.analyticsHeroStatLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                    <AdaptiveAmountText style={[styles.analyticsHeroStatValue, styles.expenseText]} minFontSize={12} value={formatCurrency(monthlyExpenses)} />
                  </View>
                  <View style={[styles.analyticsHeroStat, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}> 
                    <Text style={[styles.analyticsHeroStatLabel, { color: theme.colors.textSecondary }]}>Net</Text>
                    <AdaptiveAmountText
                      style={[styles.analyticsHeroStatValue, quickStats.netAmount >= 0 ? styles.incomeText : styles.expenseText]}
                      minFontSize={12}
                      value={formatSignedCurrency(formatCurrency, quickStats.netAmount)}
                    />
                  </View>
                  <View style={[styles.analyticsHeroStat, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}> 
                    <Text style={[styles.analyticsHeroStatLabel, { color: theme.colors.textSecondary }]}>Transactions</Text>
                    <Text style={[styles.analyticsHeroStatValue, { color: theme.colors.text }]}>{quickStats.transactionCount}</Text>
                  </View>
                </View>
                <View style={styles.analyticsHeroFooter}>
                  <Text style={[styles.analyticsHeroFooterText, { color: theme.colors.textSecondary }]}>
                    {activeRange.summaryCaption}
                  </Text>
                  <Text style={[styles.analyticsHeroFooterText, { color: theme.colors.textSecondary }]}>
                    {monthlyIncome > 0
                      ? `${formatPercentage(savingsRate)} of income remained after expenses.`
                      : monthlyExpenses > 0
                        ? 'Expenses are recorded, but no income has been added for this range yet.'
                        : 'No income or expense activity has been recorded for this range yet.'}
                  </Text>
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.analyticsHeroEmptyState,
                  { backgroundColor: secondarySurface, borderColor: softBorderColor },
                ]}
              >
                <Text style={[styles.analyticsHeroEmptyTitle, { color: theme.colors.text }]}>No data</Text>
                <Text style={[styles.analyticsHeroEmptyText, { color: theme.colors.textSecondary }]}>
                  There is no data in this view yet.
                </Text>
              </View>
            )}
          </View>
        </View>
      {!shouldShowAnalyticsEmptyState ? (
        <>
      {shouldShowNetWorthSnapshot ? (
      <AnalyticsCategoryBlock
        eyebrow="Snapshot"
        title="Net Worth"
        subtitle="Track assets, liabilities, and cumulative progress across your active accounts."
      >
            <View style={styles.chartSection}>
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
          <AnalyticsEmptyState
            title="No active accounts"
            message="Add at least one active account to track net worth."
            icon={<Wallet size={20} color={theme.colors.primary} />}
          />
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
                Cumulative Growth (since {netWorthSeries.labels[0] || 'start'})
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
            <View style={styles.chartStatRow}>
              <View style={[styles.chartStatCard, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}> 
                <Text style={[styles.chartStatLabel, { color: theme.colors.textSecondary }]}>Peak</Text>
                <AdaptiveAmountText style={[styles.chartStatValue, { color: chartPalette.netWorth }]} minFontSize={11} value={formatCurrency(netWorthPeakValue)} />
              </View>
              <View style={[styles.chartStatCard, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}> 
                <Text style={[styles.chartStatLabel, { color: theme.colors.textSecondary }]}>Low</Text>
                <AdaptiveAmountText style={[styles.chartStatValue, { color: theme.colors.text }]} minFontSize={11} value={formatCurrency(netWorthLowValue)} />
              </View>
              <View style={[styles.chartStatCard, { backgroundColor: secondarySurface, borderColor: softBorderColor }]}> 
                <Text style={[styles.chartStatLabel, { color: theme.colors.textSecondary }]}>Window Change</Text>
                <Text style={[styles.chartStatValue, { color: netWorthRangeDelta >= 0 ? theme.colors.success : theme.colors.error }]}>
                  {formatSignedCurrency(formatCurrency, netWorthRangeDelta)}
                </Text>
              </View>
            </View>
            <View style={[styles.chartContainer, styles.premiumLineChartContainer]}> 
              <FinanceLineChart
                width={chartWidth}
                height={228}
                domain={netWorthProgressYDomain}
                ticks={netWorthChartTicks}
                series={netWorthLineSeries}
                gridColor={gridColor}
                labelColor={axisLabelColor}
                zeroLineColor={gridColor}
                padding={{ top: 24, bottom: 42, left: 40, right: 16 }}
              />
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
                    {selectedMonthLabel ?? 'Month Details'}
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
                    <Text style={[styles.monthChipLabel, { color: theme.colors.text }]}>{netWorthSeries.labels[index] ?? point.label}</Text>
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
      ) : null}
      {visibleStage >= 2 ? (

      <AnalyticsCategoryBlock
        eyebrow="Activity"
        title="Spending & Trends"
        subtitle="Track where money is going and how income and expenses are changing."
      >
      {hasVisibleSpendingTrendCharts ? (
        <>
          {shouldShowComparisonChart ? (
            <View style={styles.chartSection}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeading}>
                  <Text style={[styles.cardTitle, styles.cardHeaderTitle, { color: theme.colors.text }]}>Income, Expenses & Distribution</Text>
                  <Text style={[styles.cardHeaderMetaText, { color: theme.colors.textSecondary }]}>
                    {activeRange.comparisonTitle} rendered with the shared Skia chart component.
                  </Text>
                </View>
                {renderChartExportAction('comparison-6-month', 'Income, Expenses & Distribution')}
              </View>
              <ViewShot ref={setChartCaptureRef('comparison-6-month')} options={chartCaptureOptions}>
                <View collapsable={false}>
                  <AccountModalSkiaBoundary data={analyticsSkiaData} />
                </View>
              </ViewShot>
            </View>
          ) : null}

          {shouldShowCategoryBreakdownChart ? (
            <View style={styles.chartSection}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Spending by Category</Text>
                {renderChartExportAction('spending-by-category', 'Spending by Category')}
              </View>
              <ViewShot ref={setChartCaptureRef('spending-by-category')} options={chartCaptureOptions}>
                <View collapsable={false}>
                  <View style={styles.chartSummary}>
                    <AdaptiveAmountText style={[styles.chartSummaryValue, { color: theme.colors.text }]} minFontSize={14} value={formatCurrency(topCategory?.amount ?? 0)} />
                    <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>
                      {topCategory ? `${topCategory.categoryName} leads this view` : 'Largest category in view'}
                    </Text>
                  </View>
                  <MoneyManagerBarChartSection
                    width={chartWidth}
                    height={244}
                    entries={categoryTotalStatsEntries}
                    selectedKey={focusedCategoryBar?.key ?? null}
                    onSelectKey={setFocusedSpendingCategoryKey}
                    gridColor={gridColor}
                    axisLabelColor={axisLabelColor}
                    textColor={theme.colors.text}
                    tooltipSurface={secondarySurface}
                    tooltipBorder={softBorderColor}
                    selectionFill={theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}
                    valueFormatter={formatCurrency}
                    emptyTitle="No spending data"
                    emptyMessage="There is no category spending data for this view yet."
                  />
                  <View style={styles.chartSection}>

                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Expense & Income Mix</Text>
                    </View>
                    <CategoryDistributionPanel
                      sections={distributionSections}
                      formatCurrency={formatCurrency}
                      emptyMessage="No distribution data for this view yet."
                      initialSectionKey="expense"
                    />
                  </View>
                  <View style={styles.categoryRankList}>
                    {categoryBarData.map((item, index) => {
                      const isFocused = focusedCategoryBar?.key === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          activeOpacity={0.85}
                          onPress={() => setFocusedSpendingCategoryKey(item.key)}
                          style={[
                            styles.categoryRankRow,
                            {
                              backgroundColor: isFocused ? secondarySurface : theme.colors.surface,
                              borderColor: isFocused ? item.fill : softBorderColor,
                            },
                          ]}
                        >
                          <View style={[styles.categoryRankIndex, { backgroundColor: item.fill }]}>
                            <Text style={styles.categoryRankIndexText}>#{index + 1}</Text>
                          </View>
                          <View style={styles.categoryRankContent}>
                            <View style={styles.categoryRankHeader}>
                              <Text style={[styles.categoryRankName, { color: theme.colors.text }]} numberOfLines={1}>
                                {item.fullLabel}
                              </Text>
                              <AdaptiveAmountText
                                style={[styles.categoryRankAmount, { color: theme.colors.text }]}
                                minFontSize={11}
                                value={formatCurrency(item.y)}
                              />
                            </View>
                            <View style={styles.categoryRankMetaRow}>
                              <Text style={[styles.categoryRankMetaText, { color: theme.colors.textSecondary }]}> 
                                {formatPercentage(item.share)} of spend
                              </Text>
                              {isFocused ? (
                                <Text style={[styles.categoryRankMetaAccent, { color: item.fill }]}>Selected</Text>
                              ) : null}
                            </View>
                            <View style={[styles.categoryRankProgressTrack, { backgroundColor: softBorderColor }]}> 
                              <View
                                style={[
                                  styles.categoryRankProgressFill,
                                  {
                                    backgroundColor: item.fill,
                                    width: item.share > 0 ? `${Math.max(item.share * 100, 8)}%` : '0%',
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ViewShot>
            </View>
          ) : null}
        </>
      ) : null}
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
        title="Smart Advisor"
        subtitle={guidanceSectionSubtitle}
      >
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeading}>
            <Text style={[styles.cardTitle, styles.cardHeaderTitle, { color: theme.colors.text }]}>Smart Advisor</Text>
            <Text style={[styles.cardHeaderMetaText, { color: theme.colors.textSecondary }]}>
              {activeRange.insightWindowLabel} is the main lens here; longer-term pace notes are labeled clearly.
            </Text>
          </View>
        </View>
        {advisorInsights.length === 0 ? (
          <AnalyticsEmptyState
            title="No guidance yet"
            message="Add more transactions in this view to unlock smarter guidance."
            icon={<Sparkles size={20} color={theme.colors.primary} />}
          />
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
                  <View style={styles.insightHeader}>
                    <Text style={[styles.insightTitle, { color: toneColor }]}>{insight.title}</Text>
                    <View style={[styles.insightWindowPill, { borderColor: theme.colors.border, backgroundColor: secondarySurface }]}>
                      <Text style={[styles.insightWindowText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {insight.windowLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.insightMessage, { color: theme.colors.textSecondary }]}>{insight.message}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      </AnalyticsCategoryBlock>
      ) : (
        <AnalyticsCategoryPlaceholder
          eyebrow="Guidance"
          title="Smart Advisor"
          subtitle={guidanceSectionSubtitle}
          cardCount={1}
          chartCardIndex={-1}
        />
      )}
      {visibleStage >= 4 && shouldShowPlanningSection ? (

      <AnalyticsCategoryBlock
        eyebrow="Planning"
        title={planningSectionTitle}
        subtitle={planningSectionSubtitle}
      >
      {isWeeklyView ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeading}>
              <Text style={[styles.cardTitle, styles.cardHeaderTitle, { color: theme.colors.text }]}>This Week, in Context</Text>
              <Text style={[styles.cardHeaderMetaText, { color: theme.colors.textSecondary }]}>
                Weekly activity stays short-term above. The outlook below uses your current balances and last 3-month pace.
              </Text>
            </View>
          </View>
          <View style={styles.forecastMetricRow}>
            {[
              { label: 'Current net worth', value: formatCurrency(currentNetWorthProgress.currentNetWorth), tone: theme.colors.text },
              { label: 'Next milestone ETA', value: formatDurationLong(netWorthEtaMonths) ?? 'On hold', tone: theme.colors.primary },
              { label: debtBalance > 0 ? 'Debt freedom ETA' : 'Debt status', value: debtBalance > 0 ? formatDurationLong(debtEtaMonths) ?? 'On hold' : 'Debt-free', tone: debtBalance > 0 ? theme.colors.warning : theme.colors.success },
            ].map((metric) => (
              <View
                key={metric.label}
                style={[
                  styles.forecastMetricCard,
                  { backgroundColor: secondarySurface, borderColor: softBorderColor },
                ]}
              >
                <Text style={[styles.forecastMetricLabel, { color: theme.colors.textSecondary }]}>{metric.label}</Text>
                <Text style={[styles.forecastMetricValue, { color: metric.tone }]} numberOfLines={2}>
                  {metric.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {shouldShowForecastChart ? (
      <View style={styles.chartSection}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Net Worth Forecast</Text>
          {renderChartExportAction('net-worth-forecast', 'Net Worth Forecast', !netWorthSimulation || !netWorthForecastData)}
        </View>
        <ViewShot ref={setChartCaptureRef('net-worth-forecast')} options={chartCaptureOptions}>
          <View collapsable={false}>
        {!netWorthSimulation ? (
          <AnalyticsEmptyState
            title="No forecast yet"
            message="Add more activity history to unlock a forecast."
            icon={<TrendingUp size={20} color={theme.colors.primary} />}
          />
        ) : (
          <View>
            <View
              style={[
                styles.forecastSummaryShell,
                { backgroundColor: secondarySurface, borderColor: softBorderColor },
              ]}
            >
              <View style={styles.forecastSummaryTopRow}>
                <View style={styles.forecastHeader}>
                  <Text style={[styles.forecastEyebrow, { color: theme.colors.textSecondary }]}>Projected Net Worth</Text>
                  <AdaptiveAmountText
                    style={[styles.forecastValue, { color: theme.colors.text }]}
                    minFontSize={22}
                    value={formatCurrency(netWorthSimulation.futureValue)}
                  />
                  <Text style={[styles.forecastMeta, { color: theme.colors.textSecondary }]}>
                    Projected by {netWorthForecastData ? formatDateWithWeekday(netWorthForecastData.projectedDate) : `${netWorthSimulation.years} years from now`}
                  </Text>
                </View>
                {netWorthForecastData ? (
                  <View
                    style={[
                      styles.forecastDeltaPill,
                      { backgroundColor: theme.colors.surface, borderColor: softBorderColor },
                    ]}
                  >
                    <Text style={[styles.forecastDeltaLabel, { color: theme.colors.textSecondary }]}>Outlook</Text>
                    <AdaptiveAmountText
                      style={[
                        styles.forecastDeltaValue,
                        { color: netWorthForecastData.futureDelta >= 0 ? theme.colors.success : theme.colors.error },
                      ]}
                      minFontSize={12}
                      value={formatSignedCurrency(formatCurrency, netWorthForecastData.futureDelta)}
                    />
                    {netWorthForecastData.futureDeltaRatio !== null ? (
                      <Text
                        style={[
                          styles.forecastDeltaMeta,
                          { color: netWorthForecastData.futureDelta >= 0 ? theme.colors.success : theme.colors.error },
                        ]}
                      >
                        {formatPercentage(netWorthForecastData.futureDeltaRatio)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.forecastMetricRow}>
                {[
                  { label: 'Monthly pace', value: formatCurrency(netWorthSimulation.monthlySavings), tone: theme.colors.text },
                  { label: 'Saved capital', value: formatCurrency(netWorthSimulation.totalContributions), tone: forecastContributionColor },
                  { label: 'Projected growth', value: formatCurrency(netWorthSimulation.investmentGrowth), tone: theme.colors.success },
                ].map((metric) => (
                  <View
                    key={metric.label}
                    style={[
                      styles.forecastMetricCard,
                      { backgroundColor: theme.colors.surface, borderColor: softBorderColor },
                    ]}
                  >
                    <Text style={[styles.forecastMetricLabel, { color: theme.colors.textSecondary }]}>{metric.label}</Text>
                    <AdaptiveAmountText
                      style={[styles.forecastMetricValue, { color: metric.tone }]}
                      minFontSize={11}
                      value={metric.value}
                    />
                  </View>
                ))}
              </View>
              {netWorthForecastData && netWorthForecastData.horizonItems.length > 0 ? (
                <View style={styles.forecastTimelineGrid}>
                  {netWorthForecastData.horizonItems.map((item) => (
                    <View
                      key={item.label}
                      style={[
                        styles.forecastTimelineItem,
                        { backgroundColor: theme.colors.surface, borderColor: softBorderColor },
                      ]}
                    >
                      <Text style={[styles.forecastTimelineLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                      <AdaptiveAmountText
                        style={[styles.forecastTimelineValue, { color: theme.colors.text }]}
                        minFontSize={11}
                        value={formatCurrency(item.value)}
                      />
                      <Text style={[styles.forecastTimelineDate, { color: theme.colors.textSecondary }]}>
                        {formatDateDDMMYYYY(item.date)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            {netWorthForecastData ? (
              <View style={[styles.chartContainer, styles.forecastChartContainer]}>
                <MoneyManagerLineChartSection
                  width={chartWidth}
                  height={228}
                  labels={forecastLineLabels}
                  values={netWorthForecastData.data.map((point) => point.y)}
                  axisItems={forecastAxisItems}
                  selectedIndex={safeSelectedForecastIndex}
                  onSelectIndex={setSelectedForecastIndex}
                  metricLabel="Projected Net Worth"
                  lineColor={forecastProjectionColor}
                  gridColor={gridColor}
                  axisLabelColor={axisLabelColor}
                  textColor={theme.colors.text}
                  tooltipSurface={secondarySurface}
                  tooltipBorder={softBorderColor}
                  valueFormatter={formatCurrency}
                  emptyTitle="No forecast data"
                  emptyMessage="There is no forecast line data for this view yet."
                />
                <Text style={[styles.forecastAssumptionText, { color: theme.colors.textSecondary }]}> 
                  Assumes a saving pace of {formatCurrency(netWorthSimulation.monthlySavings)} per month and 5% annual portfolio growth.
                </Text>
              </View>

            ) : null}
          </View>
        )}
          </View>
        </ViewShot>
      </View>
      ) : null}

      {hasRecordedDebt ? (
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Debt Payoff Optimizer</Text>
        {!debtPayoffPlan ? (
          <AnalyticsEmptyState
            title="No debt plan yet"
            message="Record active debts to compare payoff strategies here."
            icon={<Scale size={20} color={theme.colors.primary} />}
          />
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
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Milestones</Text>
        <View style={styles.milestoneList}>
          {milestoneCards.map((milestone) => {
            const progressPercent = Math.min(100, Math.round(clamp(milestone.progress) * 100));
            const achieved = milestone.achieved ?? milestone.progress >= 1;
            const etaText = achieved ? null : formatDurationShort(milestone.estimatedMonths ?? null);
            const projectedDateText = !achieved && milestone.estimatedDate ? formatDateWithWeekday(milestone.estimatedDate) : null;
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
                {projectedDateText ? (
                  <Text style={[styles.milestoneEta, { color: theme.colors.textSecondary }]}>Projected {projectedDateText}</Text>
                ) : null}
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
          title={planningSectionTitle}
          subtitle={planningSectionSubtitle}
          cardCount={2}
          chartCardIndex={0}
        />
      )}
        </>
      ) : null}
      </ScrollView>
      <Modal
        visible={showRangeMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRangeMenu(false)}
      >
        <View style={styles.analyticsMenuModalRoot}>
          <TouchableOpacity
            style={styles.analyticsMenuBackdrop}
            activeOpacity={1}
            onPress={() => setShowRangeMenu(false)}
          />
          <View
            style={[
              styles.analyticsMenuSheet,
              { backgroundColor: cardBackground, borderColor: softBorderColor },
            ]}
          >
            <Text style={[styles.analyticsMenuTitle, { color: theme.colors.text }]}>Visualize</Text>
            <Text style={[styles.analyticsMenuSubtitle, { color: theme.colors.textSecondary }]}>Choose the range that matches the story you want to review.</Text>
            <View style={styles.analyticsRangeMenu}>
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
                    <View style={styles.analyticsRangeMenuCopy}>
                      <Text
                        style={[
                          styles.analyticsRangeMenuText,
                          { color: isActive ? theme.colors.primary : theme.colors.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={[styles.analyticsRangeMenuHint, { color: theme.colors.textSecondary }]}>
                        {option.description}
                      </Text>
                    </View>
                    {isActive ? <Check size={15} color={theme.colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
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
                  {selectedMonthLabel ?? 'Month Details'}
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
                <AnalyticsEmptyState
                  title="No visible transactions"
                  message="There are no transactions to show in this month."
                  icon={<CalendarDays size={20} color={theme.colors.primary} />}
                />
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
        <View style={styles.loadingBadgeRow}>
          <View style={[styles.loadingStatusBadge, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '22' }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.loadingStatusText, { color: theme.colors.primary }]}>Loading analytics</Text>
          </View>
          <View style={[styles.loadingRangePill, { backgroundColor: theme.colors.border }]} />
        </View>
        <View style={[styles.loadingLineLong, { backgroundColor: theme.colors.border }]} />
        <View style={[styles.loadingLineMedium, { backgroundColor: theme.colors.border }]} />
        <View style={styles.loadingMetricGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View
              key={`loading-metric-${index}`}
              style={[styles.loadingMetricTile, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
              <View style={[styles.loadingMetricValueBar, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.loadingMetricLabelBar, { backgroundColor: theme.colors.border }]} />
            </View>
          ))}
        </View>
        <View style={[styles.loadingFooterBar, { backgroundColor: theme.colors.border }]} />
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

const AnalyticsEmptyState = React.memo(function AnalyticsEmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyStateIconWrap,
          {
            backgroundColor: theme.isDark ? theme.colors.surface : '#F8FAFC',
            borderColor: theme.colors.border,
          },
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>{message}</Text>
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
      }, 110 + index * 140)
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
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  loadingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  loadingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadingStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingRangePill: {
    width: 88,
    height: 34,
    borderRadius: 999,
    opacity: 0.4,
  },
  loadingMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  loadingMetricTile: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  loadingMetricValueBar: {
    width: '78%',
    height: 18,
    borderRadius: 999,
    opacity: 0.35,
  },
  loadingMetricLabelBar: {
    width: '46%',
    height: 10,
    borderRadius: 999,
    opacity: 0.3,
  },
  loadingFooterBar: {
    width: '84%',
    height: 12,
    borderRadius: 999,
    marginTop: 18,
    opacity: 0.28,
  },
  loadingCard: {
    borderRadius: 22,
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
    marginTop: 14,
    marginBottom: 10,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    overflow: 'hidden',
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
    gap: 16,
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
    gap: 8,
  },
  analyticsHeroIntroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  analyticsHeroIntroMeta: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: '92%',
  },
  analyticsRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  analyticsRangeButtonTextWrap: {
    alignItems: 'flex-start',
    gap: 2,
  },
  analyticsRangeButtonLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  analyticsRangeButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  analyticsRangeNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  analyticsRangeNavigatorCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
  },
  analyticsRangeNavButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsRangeNavButtonDisabled: {
    opacity: 0.45,
  },
  analyticsMenuModalRoot: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 78,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  analyticsMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  analyticsMenuSheet: {
    width: 244,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  analyticsMenuTitle: {
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  analyticsMenuSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  analyticsRangeMenu: {
    minWidth: 170,
    borderRadius: 14,
    overflow: 'hidden',
  },
  analyticsRangeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  analyticsRangeMenuCopy: {
    flex: 1,
    gap: 3,
  },
  analyticsRangeMenuText: {
    fontSize: 13,
    fontWeight: '700',
  },
  analyticsRangeMenuHint: {
    fontSize: 11,
    lineHeight: 15,
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
  analyticsHeroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  analyticsRangeHeading: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  analyticsRangeHeadingMeta: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: '92%',
  },
  analyticsSnapshotRow: {
    flexDirection: 'row',
    gap: 16,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  analyticsSnapshotItem: {
    flex: 1,
    gap: 4,
    paddingBottom: 8,
  },
  analyticsSnapshotItemActive: {
    borderBottomWidth: 2,
  },
  analyticsSnapshotLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  analyticsSnapshotValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  analyticsHeroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
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
    minWidth: '47%',
    flex: 1,
    borderRadius: 16,
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
    fontSize: 17,
    fontWeight: '800',
  },
  analyticsHeroFooter: {
    paddingTop: 2,
    gap: 5,
  },
  analyticsHeroFooterText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  analyticsHeroEmptyState: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 8,
  },
  analyticsHeroEmptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  analyticsHeroEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
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
    paddingHorizontal: 12,
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
  chartSection: {
    marginHorizontal: 16,
    marginBottom: 20,
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
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 96,
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
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
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
  premiumBarChartContainer: {
    paddingTop: 8,
  },
  premiumLineChartContainer: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  chartStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  chartStatCard: {
    flex: 1,
    minWidth: '31%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  chartStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  chartStatValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  categorySnapshotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  categorySnapshotCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  categorySnapshotLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  categorySnapshotValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  chartFocusCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    gap: 10,
  },
  chartFocusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartFocusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  chartFocusSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  chartFocusName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  chartFocusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chartFocusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chartFocusMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chartFocusMetric: {
    flex: 1,
    minWidth: 92,
    gap: 3,
  },
  chartFocusMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  chartFocusMetricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  categoryProgressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  chartFocusHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  chartFocusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chartFocusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  chartFocusChipText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  chartFocusChipAmount: {
    fontSize: 11,
    fontWeight: '800',
  },
  categoryRankList: {
    gap: 10,
    marginTop: 12,
  },
  categoryRankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  categoryRankIndex: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryRankIndexText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  categoryRankContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  categoryRankHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryRankName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryRankAmount: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: 120,
  },
  categoryRankMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryRankMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryRankMetaAccent: {
    fontSize: 11,
    fontWeight: '800',
  },
  categoryRankProgressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  categoryRankProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  pieChartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 22,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 8,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  expenseList: {
    gap: 0,
  },
  expenseListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  expenseListRowActive: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  expensePercentBadge: {
    minWidth: 46,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expensePercentBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  expenseListContent: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  expenseListMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  expenseListName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  expenseListAmount: {
    width: 110,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  expenseListProgressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  expenseListProgressFill: {
    height: '100%',
    borderRadius: 999,
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
    textAlign: 'center',
  },
  donutValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  donutMeta: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
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
    paddingHorizontal: 12,
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
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'visible',
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
  emptyStateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
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
    gap: 8,
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  insightWindowPill: {
    maxWidth: '48%',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  insightWindowText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
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
  forecastSummaryShell: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  forecastSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  forecastHeader: {
    flex: 1,
    gap: 4,
  },
  forecastEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  forecastValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  forecastMeta: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  forecastDeltaPill: {
    minWidth: 112,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-end',
    gap: 2,
  },
  forecastDeltaLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  forecastDeltaValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  forecastDeltaMeta: {
    fontSize: 11,
    fontWeight: '700',
  },
  forecastMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  forecastMetricCard: {
    flex: 1,
    minWidth: '31%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
  },
  forecastMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  forecastMetricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  forecastTimelineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  forecastTimelineItem: {
    minWidth: '31%',
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
  },
  forecastTimelineLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  forecastTimelineValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  forecastTimelineDate: {
    fontSize: 11,
    lineHeight: 15,
  },
  forecastLegendRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  forecastChartContainer: {
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  forecastAssumptionText: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 8,
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
































