import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { PieChart, LineChart, BarChart } from 'react-native-chart-kit';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { EXPENSE_CATEGORIES } from '@/constants/categories';
import { Transaction } from '@/types/transaction';

export default function AnalyticsScreen() {
  const { transactions, getTotalIncome, getTotalExpenses, getCategorySpending } = useTransactionStore();
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyIncome = getTotalIncome(currentMonth);
  const monthlyExpenses = getTotalExpenses(currentMonth);
  
  const formatCurrency = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0 || amount > 1000000) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const categorySpending = EXPENSE_CATEGORIES.map(category => ({
    ...category,
    amount: getCategorySpending(category.id, currentMonth),
  })).filter(category => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const maxSpending = Math.max(...categorySpending.map(c => c.amount), 1);
  
  // Prepare enhanced pie chart data
  const pieChartData = useMemo(() => {
    if (categorySpending.length === 0) return [];
    
    const topCategories = categorySpending.slice(0, 5);
    const otherAmount = categorySpending.slice(5).reduce((sum, cat) => sum + cat.amount, 0);
    
    const chartData = topCategories.map((category) => ({
      name: category.name,
      amount: category.amount,
      color: category.color,
      legendFontColor: '#333',
      legendFontSize: 11,
    }));
    
    if (otherAmount > 0) {
      chartData.push({
        name: 'Other',
        amount: otherAmount,
        color: '#95a5a6',
        legendFontColor: '#333',
        legendFontSize: 11,
      });
    }
    
    return chartData;
  }, [categorySpending]);
  
  // Prepare enhanced trend line data for the last 14 days
  const trendData = useMemo(() => {
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      return date;
    });
    
    const dailyExpenses: number[] = last14Days.map(date => {
      const dayTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.toDateString() === date.toDateString() && t.type === 'expense';
      });
      return dayTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    });
    
    const dailyIncome: number[] = last14Days.map(date => {
      const dayTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.toDateString() === date.toDateString() && t.type === 'income';
      });
      return dayTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    });
    
    const dailyNet: number[] = dailyIncome.map((income, index) => income - dailyExpenses[index]);
    
    return {
      labels: last14Days.map(date => {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        return `${month}/${day}`;
      }),
      datasets: [
        {
          data: dailyExpenses,
          color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: dailyIncome,
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: dailyNet,
          color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['Expenses', 'Income', 'Net'],
    };
  }, [transactions]);
  
  // Prepare monthly comparison data
  const monthlyComparisonData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return date.toISOString().slice(0, 7);
    });
    
    const monthlyExpenses = last6Months.map(month => getTotalExpenses(month));
    const monthlyIncome = last6Months.map(month => getTotalIncome(month));
    
    return {
      labels: last6Months.map(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1);
        return date.toLocaleDateString('en-US', { month: 'short' });
      }),
      datasets: [
        {
          data: monthlyExpenses,
          color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
        },
        {
          data: monthlyIncome,
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        },
      ],
      legend: ['Expenses', 'Income'],
    };
  }, [transactions, getTotalExpenses, getTotalIncome]);
  
  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
    labelColor: (opacity = 1) => theme.isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(51, 51, 51, ${opacity})`,
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
    fillShadowGradientOpacity: 0.1,
  };
  
  const barChartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(102, 126, 234, ${opacity})`,
    labelColor: (opacity = 1) => theme.isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(51, 51, 51, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: theme.colors.border,
      strokeWidth: 1,
    },
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>This Month</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>
              {formatCurrency(monthlyIncome)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>
              {formatCurrency(monthlyExpenses)}
            </Text>
          </View>
        </View>
        <View style={styles.netIncomeContainer}>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Net Income</Text>
          <Text style={[
            styles.netIncomeValue,
            monthlyIncome - monthlyExpenses >= 0 ? styles.incomeText : styles.expenseText
          ]}>
            {formatCurrency(monthlyIncome - monthlyExpenses)}
          </Text>
        </View>
      </View>

      {/* Enhanced Pie Chart */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Expense Distribution</Text>
          <View style={styles.cardSubtitle}>
            <DollarSign size={16} color="#666" />
            <Text style={[styles.cardSubtitleText, { color: theme.colors.textSecondary }]}>
              {formatCurrency(monthlyExpenses)} total
            </Text>
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
              width={screenWidth - 72}
              height={240}
              chartConfig={chartConfig}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[0, 0]}
              absolute
              hasLegend={true}
            />
          </View>
        )}
      </View>
      
      {/* Enhanced Trend Line Chart */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>14-Day Trend</Text>
          <View style={styles.trendIndicators}>
            <View style={styles.trendIndicator}>
              <View style={[styles.trendDot, { backgroundColor: '#F44336' }]} />
              <Text style={[styles.trendLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
            </View>
            <View style={styles.trendIndicator}>
              <View style={[styles.trendDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={[styles.trendLabel, { color: theme.colors.textSecondary }]}>Income</Text>
            </View>
            <View style={styles.trendIndicator}>
              <View style={[styles.trendDot, { backgroundColor: '#667eea' }]} />
              <Text style={[styles.trendLabel, { color: theme.colors.textSecondary }]}>Net</Text>
            </View>
          </View>
        </View>
        {trendData.datasets[0].data.every(val => val === 0) && trendData.datasets[1].data.every(val => val === 0) ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No transactions in the last 14 days</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <LineChart
              data={trendData}
              width={screenWidth - 72}
              height={240}
              chartConfig={chartConfig}
              bezier
              style={styles.lineChartStyle}
              withDots={true}
              withShadow={true}
              withScrollableDot={true}
            />
          </View>
        )}
      </View>
      
      {/* Monthly Comparison Bar Chart */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>6-Month Comparison</Text>
          <TouchableOpacity style={styles.viewMoreButton}>
            <Text style={[styles.viewMoreText, { color: theme.colors.primary }]}>View More</Text>
            <TrendingUp size={14} color="#667eea" />
          </TouchableOpacity>
        </View>
        {monthlyComparisonData.datasets[0].data.every(val => val === 0) && monthlyComparisonData.datasets[1].data.every(val => val === 0) ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No data for comparison</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <BarChart
              data={monthlyComparisonData}
              width={screenWidth - 72}
              height={220}
              chartConfig={barChartConfig}
              style={styles.barChartStyle}
              showValuesOnTopOfBars={false}
              fromZero={true}
              yAxisLabel="$"
              yAxisSuffix=""
            />
          </View>
        )}
      </View>
      
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Spending by Category</Text>
        {categorySpending.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No expenses this month</Text>
          </View>
        ) : (
          <View style={styles.categoriesList}>
            {categorySpending.map((category) => {
              const percentage = (category.amount / maxSpending) * 100;
              
              return (
                <View key={category.id} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>{category.name}</Text>
                  </View>
                  <View style={styles.categoryAmount}>
                    <Text style={[styles.categoryAmountText, { color: theme.colors.text }]}>
                      {formatCurrency(category.amount)}
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${percentage}%`,
                            backgroundColor: category.color,
                          }
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Quick Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{transactions.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Transactions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {formatCurrency(monthlyExpenses / Math.max(new Date().getDate(), 1))}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Daily Average</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{categorySpending.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Active Categories</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              monthlyIncome - monthlyExpenses >= 0 ? styles.incomeText : styles.expenseText
            ]}>
              {monthlyIncome - monthlyExpenses >= 0 ? '+' : ''}{formatCurrency(monthlyIncome - monthlyExpenses)}
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
    backgroundColor: '#f8f9fa',
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  incomeText: {
    color: '#4CAF50',
  },
  expenseText: {
    color: '#F44336',
  },
  netIncomeContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  netIncomeValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  categoriesList: {
    gap: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: '#1a1a1a',
    flex: 1,
  },
  categoryAmount: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  categoryAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  progressBarContainer: {
    width: 60,
    height: 4,
    backgroundColor: '#f0f0f0',
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
    color: '#666',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardSubtitleText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  trendIndicators: {
    flexDirection: 'row',
    gap: 12,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trendLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#667eea20',
  },
  viewMoreText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  lineChartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
  barChartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
});