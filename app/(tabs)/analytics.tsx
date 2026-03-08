import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { PieChart, LineChart } from 'react-native-chart-kit';
import { DollarSign } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import {
  computeExpenseCategoryBreakdown,
  computeExpenseDistribution,
  computeQuickStats,
} from '@/src/domain/analytics';

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

export default function AnalyticsScreen() {
  const { transactions, getTotalIncome, getTotalExpenses, formatCurrency } = useTransactionStore();
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
});
