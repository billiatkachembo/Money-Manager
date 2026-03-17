import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
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
import { ArrowDownRight, ArrowUpRight, DollarSign, X } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { formatDateDDMMYYYY } from '@/utils/date';
import {
  computeNetWorthProgress,
  computeExpenseCategoryBreakdown,
  computeExpenseDistribution,
  computeQuickStats,
} from '@/src/domain/analytics';
import { deriveAccountBalance } from '@/src/domain/ledger';
import type { Transaction } from '@/types/transaction';

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

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDayKey(date: Date): string {
  return `${toMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildRecentDays(length: number): Date[] {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (length - 1));
  return Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
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

function formatShortDayLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function truncateLabel(label: string, maxLength = 10): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}...`;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
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
  fromAccountName: string;
  toAccountName: string;
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
}

const AnalyticsScreen = React.memo(function AnalyticsScreen() {
  const { transactions, allTransactions, accounts, debtAccounts, getTotalIncome, getTotalExpenses, formatCurrency, financialIntelligence } = useTransactionStore();
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const advisorInsights = financialIntelligence.insights ?? [];
  const budgetSuggestions = financialIntelligence.budgetSuggestions ?? [];
  const cashflowRunway = financialIntelligence.cashflowRunway;
  const netWorthSimulation = financialIntelligence.netWorthSimulation;
  const debtPayoffPlan = financialIntelligence.debtPayoff;
  const milestoneProgress = financialIntelligence.milestones;

  const netWorthForecastData = useMemo(() => {
    if (!netWorthSimulation) {
      return null;
    }

    const data = netWorthSimulation.points.map((point) => ({
      x: new Date(point.year, 0, 1),
      y: point.netWorth,
    }));

    const tickValues = netWorthSimulation.points
      .filter((_, index) => index % 2 === 0)
      .map((point) => new Date(point.year, 0, 1));

    return { data, tickValues };
  }, [netWorthSimulation]);

  const chartWidth = Math.max(screenWidth - 32, 260);
  const gridColor = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const axisLabelColor = theme.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.6)';
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
  const chartAnimation = useMemo(
    () => ({ duration: 900, easing: 'cubicOut' as const }),
    []
  );
  const today = new Date();
  const currentMonth = toMonthKey(today);
  const elapsedDays = Math.max(1, today.getDate());

  const currentMonthTransactions = useMemo(
    () => transactions.filter((transaction) => toMonthKey(transaction.date) === currentMonth),
    [currentMonth, transactions]
  );

  const quickStats = useMemo(
    () => computeQuickStats(currentMonthTransactions, elapsedDays),
    [currentMonthTransactions, elapsedDays]
  );

  const monthlyIncome = quickStats.income;
  const monthlyExpenses = quickStats.expenses;

  const categorySpending = useMemo(
    () => computeExpenseCategoryBreakdown(currentMonthTransactions),
    [currentMonthTransactions]
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

  const expenseDonutData = useMemo(() => {
    if (categorySpending.length === 0) {
      return [];
    }

    const distribution = computeExpenseDistribution(categorySpending, 5);
    return distribution.map((entry, index) => ({
      x: entry.name,
      y: entry.amount,
      color: entry.color ?? categoryPalette[index % categoryPalette.length],
    }));
  }, [categorySpending]);

  const expenseDonutColors = useMemo(
    () => expenseDonutData.map((entry) => entry.color),
    [expenseDonutData]
  );

  const transactionsByDay = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    for (const transaction of transactions) {
      if (transaction.type !== 'income' && transaction.type !== 'expense') {
        continue;
      }
      const key = toDayKey(transaction.date);
      const entry = map.get(key) ?? { income: 0, expenses: 0 };
      if (transaction.type === 'income') {
        entry.income += transaction.amount;
      } else {
        entry.expenses += transaction.amount;
      }
      map.set(key, entry);
    }
    return map;
  }, [transactions]);

  const trendSeries = useMemo(() => {
    const recentDays = buildRecentDays(14);
    const expenses = recentDays.map((date) => transactionsByDay.get(toDayKey(date))?.expenses ?? 0);
    const income = recentDays.map((date) => transactionsByDay.get(toDayKey(date))?.income ?? 0);
    const net = income.map((value, index) => (value ?? 0) - (expenses[index] ?? 0));

    const tickValues = recentDays.filter((_, index) => index % 2 === 0);
    const totalExpenses = roundCurrency(expenses.reduce((sum, value) => sum + value, 0));

    return {
      expenseData: recentDays.map((date, index) => ({
        x: date,
        y: expenses[index] ?? 0,
      })),
      incomeData: recentDays.map((date, index) => ({
        x: date,
        y: income[index] ?? 0,
      })),
      netData: recentDays.map((date, index) => ({
        x: date,
        y: net[index] ?? 0,
      })),
      tickValues,
      totalExpenses,
    };
  }, [transactionsByDay]);

  const monthlyComparisonSeries = useMemo(() => {
    const recentMonths = buildRecentMonths(6);
    const labels = recentMonths.map((month) => month.toLocaleDateString('en-US', { month: 'short' }));
    const expenses = recentMonths.map((month) => getTotalExpenses(toMonthKey(month)));
    const income = recentMonths.map((month) => getTotalIncome(toMonthKey(month)));

    return {
      labels,
      expenseData: labels.map((label, index) => ({
        x: label,
        y: expenses[index] ?? 0,
      })),
      incomeData: labels.map((label, index) => ({
        x: label,
        y: income[index] ?? 0,
      })),
      totalIncome: roundCurrency(income.reduce((sum, value) => sum + value, 0)),
      totalExpenses: roundCurrency(expenses.reduce((sum, value) => sum + value, 0)),
    };
  }, [getTotalExpenses, getTotalIncome, transactions]);

  const netWorthProgress = useMemo(
    () => computeNetWorthProgress(accounts, allTransactions, 6),
    [accounts, allTransactions]
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

  const investmentTarget = 1000;
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
    });

    const investmentInsights: string[] = [];
    if (investmentBalance < investmentTarget) {
      investmentInsights.push('Starting with $1,000 can begin your long-term growth.');
    } else {
      investmentInsights.push('You have started investing. Keep the momentum going.');
    }

    cards.push({
      id: 'first-investment',
      title: 'First Investment',
      targetLabel: 'Target',
      currentLabel: 'Invested',
      target: investmentTarget,
      current: investmentBalance,
      progress: investmentProgress,
      estimatedMonths: investmentEtaMonths,
      insights: investmentInsights,
      achieved: investmentProgress >= 1,
    });

    const netWorthInsights: string[] = [];
    if (!netWorthTarget) {
      netWorthInsights.push('You have achieved the highest net worth milestone in this list.');
    } else if (netWorthEtaMonths !== null) {
      const etaText = formatDurationLong(netWorthEtaMonths);
      if (etaText) {
        netWorthInsights.push(`You could reach ${formatCurrency(netWorthTarget)} in about ${etaText}.`);
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

  const hasTrendData = useMemo(
    () =>
      trendSeries.expenseData.some((point) => point.y !== 0) ||
      trendSeries.incomeData.some((point) => point.y !== 0) ||
      trendSeries.netData.some((point) => point.y !== 0),
    [trendSeries]
  );

  const hasComparisonData = useMemo(
    () =>
      monthlyComparisonSeries.expenseData.some((point) => point.y !== 0) ||
      monthlyComparisonSeries.incomeData.some((point) => point.y !== 0),
    [monthlyComparisonSeries]
  );


  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>This Month</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>{formatCurrency(monthlyIncome)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>{formatCurrency(monthlyExpenses)}</Text>
          </View>
        </View>
        <View style={[styles.netIncomeContainer, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Net Income</Text>
          <Text style={[styles.netIncomeValue, quickStats.netAmount >= 0 ? styles.incomeText : styles.expenseText]}>
            {quickStats.netAmount >= 0 ? '+' : ''}{formatCurrency(quickStats.netAmount)}
          </Text>
          <Text style={[styles.savingsRateText, { color: theme.colors.textSecondary }]}>
            Savings Rate: {formatPercentage(savingsRate)}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Net Worth Progress</Text>
          <Text style={[styles.netWorthChangeText, netWorthProgress.monthlyChange >= 0 ? styles.incomeText : styles.expenseText]}>
            {netWorthTrendText}
          </Text>
        </View>
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
                  backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC',
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.netWorthLabel, { color: theme.colors.textSecondary }]}>Current Net Worth</Text>
              <Text style={[styles.netWorthValue, { color: theme.colors.text }]}>
                {formatCurrency(netWorthProgress.currentNetWorth)}
              </Text>
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
            <View style={styles.chartContainer}>
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
                    `${formatShortMonthLabel(new Date(datum.x))} ${new Date(datum.x).getFullYear()}
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
                    backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC',
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

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Expense Distribution</Text>
          <View style={styles.cardSubtitle}>
            <DollarSign size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.cardSubtitleText, { color: theme.colors.textSecondary }]}>{formatCurrency(monthlyExpenses)} total</Text>
          </View>
        </View>
        <View style={styles.chartSummary}>
          <Text style={[styles.chartSummaryValue, { color: theme.colors.text }]}>{formatCurrency(monthlyExpenses)}</Text>
          <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>total expenses this month</Text>
        </View>
        {expenseDonutData.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No expenses this month</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
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
              <View style={styles.donutCenter}>
                <Text style={[styles.donutLabel, { color: theme.colors.textSecondary }]}>Total Expenses</Text>
                <Text style={[styles.donutValue, { color: theme.colors.text }]}>{formatCurrency(monthlyExpenses)}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>14-Day Trend</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: chartPalette.expenses }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Expenses</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: chartPalette.income }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: chartPalette.savings }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Net</Text>
            </View>
          </View>
        </View>
        <View style={styles.chartSummary}>
          <Text style={[styles.chartSummaryValue, { color: theme.colors.text }]}>{formatCurrency(trendSeries.totalExpenses)}</Text>
          <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>last 14 days spend</Text>
        </View>
        {!hasTrendData ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No transactions in the last 14 days</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <VictoryChart
              width={chartWidth}
              height={220}
              padding={chartPadding}
              scale={{ x: 'time' }}
              domainPadding={{ y: 12 }}
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
                <SvgLinearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={chartPalette.expenses} stopOpacity={0.28} />
                  <Stop offset="100%" stopColor={chartPalette.expenses} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              <VictoryAxis
                tickValues={trendSeries.tickValues}
                tickFormat={(value) => formatShortDayLabel(new Date(value))}
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
                data={trendSeries.expenseData}
                interpolation="natural"
                animate={chartAnimation}
                style={{
                  data: {
                    stroke: chartPalette.expenses,
                    strokeWidth: 2,
                    fill: 'url(#trendGradient)',
                  },
                }}
                labels={({ datum }) =>
                  `${formatShortDayLabel(new Date(datum.x))}
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
                data={trendSeries.incomeData}
                interpolation="natural"
                animate={chartAnimation}
                style={{
                  data: {
                    stroke: chartPalette.income,
                    strokeWidth: 1.8,
                  },
                }}
              />
              <VictoryLine
                data={trendSeries.netData}
                interpolation="natural"
                animate={chartAnimation}
                style={{
                  data: {
                    stroke: chartPalette.savings,
                    strokeWidth: 1.6,
                    strokeDasharray: '3,3',
                  },
                }}
              />
            </VictoryChart>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>6-Month Income vs Expenses</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: chartPalette.expenses }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Expenses</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: chartPalette.income }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Income</Text>
            </View>
          </View>
        </View>
        <View style={styles.chartSummary}>
          <Text style={[styles.chartSummaryValue, { color: theme.colors.text }]}>{formatSignedCurrency(formatCurrency, monthlyIncome - monthlyExpenses)}</Text>
          <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>net this month</Text>
        </View>
        {!hasComparisonData ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No data for comparison</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
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
                  data={monthlyComparisonSeries.incomeData}
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
                  data={monthlyComparisonSeries.expenseData}
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
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Spending by Category</Text>
        <View style={styles.chartSummary}>
          <Text style={[styles.chartSummaryValue, { color: theme.colors.text }]}>{formatCurrency(topCategory?.amount ?? 0)}</Text>
          <Text style={[styles.chartSummaryLabel, { color: theme.colors.textSecondary }]}>
            {topCategory ? `${topCategory.categoryName} top category` : 'Top category'}
          </Text>
        </View>
        {categorySpending.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { borderColor: theme.colors.border }]}>
                    <View style={[styles.emptyStateDot, { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No expenses this month</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
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
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Quick Stats</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statItem, { backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC', borderColor: theme.colors.border }]}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{quickStats.transactionCount}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Transactions This Month</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC', borderColor: theme.colors.border }]}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{formatCurrency(quickStats.averageDailySpend)}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Daily Spend</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC', borderColor: theme.colors.border }]}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{quickStats.activeCategories}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Active Categories</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC', borderColor: theme.colors.border }]}>
            <Text style={[styles.statValue, quickStats.netAmount >= 0 ? styles.incomeText : styles.expenseText]}>
              {quickStats.netAmount >= 0 ? '+' : ''}{formatCurrency(quickStats.netAmount)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Net This Month</Text>
          </View>
        </View>
      </View>
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

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Net Worth Forecast</Text>
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
              <Text style={[styles.forecastValue, { color: theme.colors.text }]}>
                {formatCurrency(netWorthSimulation.futureValue)}
              </Text>
              <Text style={[styles.forecastMeta, { color: theme.colors.textSecondary }]}>
                Projected in {netWorthSimulation.years} years
              </Text>
              <Text style={[styles.forecastSub, { color: theme.colors.textSecondary }]}>
                Contributions {formatCurrency(netWorthSimulation.totalContributions)} - Growth {formatCurrency(netWorthSimulation.investmentGrowth)}
              </Text>
            </View>
            {netWorthForecastData ? (
              <View style={styles.chartContainer}>
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
                      `${new Date(datum.x).getFullYear()}
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
            const etaText = formatDurationShort(milestone.estimatedMonths ?? null);
            const achieved = milestone.achieved ?? milestone.progress >= 1;
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
                    backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC',
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
                  <Text style={[styles.milestoneAmount, { color: theme.colors.text }]}>
                    {formatCurrency(milestone.target)}
                  </Text>
                </View>
                <View style={styles.milestoneRow}>
                  <Text style={[styles.milestoneLabel, { color: theme.colors.textSecondary }]}>
                    {milestone.currentLabel}
                  </Text>
                  <Text style={[styles.milestoneAmount, { color: theme.colors.text }]}>
                    {formatCurrency(milestone.current)}
                  </Text>
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
                  Progress {progressPercent}%{etaText ? ` - Est ${etaText}` : ''}
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
                <Text style={[styles.monthModalMetricValue, styles.incomeText]}>
                  {formatCurrency(monthContributionSummary.income)}
                </Text>
              </View>
              <View style={styles.monthModalMetric}>
                <Text style={[styles.monthModalMetricLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                <Text style={[styles.monthModalMetricValue, styles.expenseText]}>
                  {formatCurrency(monthContributionSummary.expenses)}
                </Text>
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

export default AnalyticsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  incomeText: {
    color: '#16A34A',
  },
  expenseText: {
    color: '#DC2626',
  },
  netIncomeContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  netIncomeValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  savingsRateText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
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
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cardSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartSummary: {
    marginBottom: 12,
  },
  chartSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  chartSummaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingVertical: 4,
  },
  lineChartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
  categoriesList: {
    gap: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    minWidth: 120,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  categoryAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryShareText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarContainer: {
    width: 120,
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
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
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
    borderRadius: 12,
    padding: 12,
    gap: 4,
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
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
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
    borderRadius: 12,
    padding: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
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
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
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
