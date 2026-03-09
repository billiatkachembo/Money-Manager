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
import { PieChart, LineChart } from 'react-native-chart-kit';
import { ArrowDownRight, ArrowUpRight, DollarSign, X } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import {
  computeNetWorthProgress,
  computeExpenseCategoryBreakdown,
  computeExpenseDistribution,
  computeQuickStats,
} from '@/src/domain/analytics';
import type { Transaction } from '@/types/transaction';

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
  fromAccountName?: string;
  toAccountName?: string;
}

export default function AnalyticsScreen() {
  const { transactions, allTransactions, accounts, getTotalIncome, getTotalExpenses, formatCurrency } = useTransactionStore();
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const chartWidth = Math.max(screenWidth - 56, 280);
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

  const pieChartData = useMemo(() => {
    if (categorySpending.length === 0) {
      return [];
    }

    const legendColor = theme.isDark ? '#E5E7EB' : '#374151';
    return computeExpenseDistribution(categorySpending, 5).map((entry) => ({
      name: entry.name,
      amount: entry.amount,
      color: entry.color,
      legendFontColor: legendColor,
      legendFontSize: 11,
      legendFontSpacing: 4,
    }));
  }, [categorySpending, theme.isDark]);

  const trendData = useMemo(() => {
    const recentDays = buildRecentDays(14);
    const expenses = recentDays.map((date) =>
      transactions
        .filter((transaction) => transaction.type === 'expense' && toDayKey(transaction.date) === toDayKey(date))
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    );
    const income = recentDays.map((date) =>
      transactions
        .filter((transaction) => transaction.type === 'income' && toDayKey(transaction.date) === toDayKey(date))
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    );

    return {
      labels: recentDays.map((date, index) => (index % 2 === 0 ? `${date.getMonth() + 1}/${date.getDate()}` : '')),
      datasets: [
        {
          data: expenses,
          color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: income,
          color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: income.map((value, index) => value - expenses[index]),
          color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [transactions]);

  const monthlyComparisonData = useMemo(() => {
    const recentMonths = buildRecentMonths(6);
    const labels = recentMonths.map((month) => month.toLocaleDateString('en-US', { month: 'short' }));
    const expenses = recentMonths.map((month) => getTotalExpenses(toMonthKey(month)));
    const income = recentMonths.map((month) => getTotalIncome(toMonthKey(month)));

    return {
      labels,
      datasets: [
        {
          data: expenses,
          color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: income,
          color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [getTotalExpenses, getTotalIncome, transactions]);

  const netWorthProgress = useMemo(
    () => computeNetWorthProgress(accounts, allTransactions, 6),
    [accounts, allTransactions]
  );

  const activeAccountIds = useMemo(
    () => new Set(accounts.filter((account) => account.isActive !== false).map((account) => account.id)),
    [accounts]
  );

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  const cumulativeNetFlow = useMemo(() => {
    let running = 0;
    return netWorthProgress.points.map((point) => {
      const monthNetFlow = transactions.reduce((sum, transaction) => {
        if (toMonthKey(transaction.date) !== point.month) {
          return sum;
        }
        if (transaction.type === 'income') {
          return sum + transaction.amount;
        }
        if (transaction.type === 'expense') {
          return sum - transaction.amount;
        }
        return sum;
      }, 0);

      running += monthNetFlow;
      return roundCurrency(running);
    });
  }, [netWorthProgress.points, transactions]);

  const netWorthChartData = useMemo(
    () => ({
      labels: netWorthProgress.labels,
      datasets: [
        {
          data: netWorthProgress.netWorth,
          color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: netWorthProgress.cumulativeGrowth,
          color: (opacity = 1) => `rgba(20, 184, 166, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: cumulativeNetFlow,
          color: (opacity = 1) => `rgba(234, 179, 8, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    }),
    [cumulativeNetFlow, netWorthProgress]
  );

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
    () => formatSignedCurrency(formatCurrency, cumulativeNetFlow[cumulativeNetFlow.length - 1] ?? 0),
    [cumulativeNetFlow, formatCurrency]
  );

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
    () => trendData.datasets.some((dataset) => dataset.data.some((value) => value !== 0)),
    [trendData]
  );

  const hasComparisonData = useMemo(
    () => monthlyComparisonData.datasets.some((dataset) => dataset.data.some((value) => value !== 0)),
    [monthlyComparisonData]
  );

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    labelFontSize: 10,
    color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
    labelColor: (opacity = 1) =>
      theme.isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(51, 51, 51, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '3',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: theme.colors.border,
      strokeWidth: 1,
    },
    fillShadowGradient: theme.colors.primary,
    fillShadowGradientOpacity: 0.08,
  };

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
                Cumulative Growth (since {netWorthProgress.labels[0] ?? 'start'})
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
                <View style={[styles.legendDot, { backgroundColor: '#667eea' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Net Worth</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#14B8A6' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Cumulative Growth</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Cumulative Inflow/Outflow</Text>
              </View>
            </View>
            <View style={styles.chartContainer}>
              <LineChart
                data={netWorthChartData}
                width={chartWidth}
                height={220}
                chartConfig={chartConfig}
                style={styles.lineChartStyle}
                withDots={true}
                withShadow={false}
                formatXLabel={(label) => label}
                getDotColor={(_value, index) =>
                  getChangeColor(netWorthProgress.monthOverMonthChange[index] ?? 0)
                }
                onDataPointClick={({ index }) => setSelectedMonthIndex(index)}
                bezier
              />
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
                const change = netWorthProgress.monthOverMonthChange[index] ?? 0;
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
        {pieChartData.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No expenses this month</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <PieChart
              data={pieChartData}
              width={chartWidth}
              height={240}
              chartConfig={chartConfig}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="10"
              absolute
              hasLegend={true}
            />
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>14-Day Trend</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Expenses</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#667eea' }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Net</Text>
            </View>
          </View>
        </View>
        {!hasTrendData ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No transactions in the last 14 days</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <LineChart
              data={trendData}
              width={chartWidth}
              height={240}
              chartConfig={chartConfig}
              formatXLabel={(label) => label}
              xLabelsOffset={-10}
              style={styles.lineChartStyle}
              withDots={true}
              withShadow={true}
              bezier
            />
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>6-Month Income vs Expenses</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Expenses</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
              <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Income</Text>
            </View>
          </View>
        </View>
        {!hasComparisonData ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No data for comparison</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <LineChart
              data={monthlyComparisonData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              style={styles.lineChartStyle}
              withDots={true}
              withShadow={false}
              fromZero={true}
            />
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Spending by Category</Text>
        {categorySpending.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No expenses this month</Text>
          </View>
        ) : (
          <View style={styles.categoriesList}>
            {categorySpending.map((category) => {
              const percentage = Math.max(category.share * 100, 2);
              return (
                <View key={category.categoryId} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>{category.categoryName}</Text>
                  </View>
                  <View style={styles.categoryAmount}>
                    <View style={styles.categoryMeta}>
                      <Text style={[styles.categoryAmountText, { color: theme.colors.text }]}>{formatCurrency(category.amount)}</Text>
                      <Text style={[styles.categoryShareText, { color: theme.colors.textSecondary }]}>{formatPercentage(category.share)}</Text>
                    </View>
                    <View style={[styles.progressBarContainer, { backgroundColor: theme.isDark ? theme.colors.background : '#f0f0f0' }]}>
                      <View style={[styles.progressBar, { width: `${percentage}%`, backgroundColor: category.color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
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
                        {item.transaction.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}
                        {item.transaction.type}
                        {(item.fromAccountName || item.toAccountName)
                          ? ` · ${item.fromAccountName ?? 'External'} -> ${item.toAccountName ?? 'External'}`
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
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
    maxHeight: '84%',
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
});
