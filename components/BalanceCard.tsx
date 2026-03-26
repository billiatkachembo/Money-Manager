import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';

interface BalanceCardProps {
  balance: number;
  income: number;
  expenses: number;
}

export const BalanceCard = React.memo(function BalanceCard({ balance, income, expenses }: BalanceCardProps) {
  const { theme } = useTheme();
  const { formatCurrency: formatCurrencyWithSettings } = useTransactionStore();

  const financialState = React.useMemo(() => {
    const safeBalance = Number.isFinite(balance) ? balance : 0;
    const safeIncome = Number.isFinite(income) ? income : 0;
    const safeExpenses = Number.isFinite(expenses) ? expenses : 0;

    return {
      safeBalance,
      safeIncome,
      safeExpenses,
      isNegative: safeBalance < 0,
      overspending: safeIncome > 0 && safeExpenses > safeIncome,
    };
  }, [balance, income, expenses]);

  const spendingInsight = React.useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = Math.max(1, Math.min(now.getDate(), totalDays));

    const remainingDays = Math.max(totalDays - today + 1, 1);

    const remainingBudget =
      financialState.safeIncome - financialState.safeExpenses;

    const dailySafeSpend =
      remainingBudget > 0 ? remainingBudget / remainingDays : 0;

    const expectedSpendByToday =
      (financialState.safeIncome / totalDays) * today;

    const pace = financialState.safeExpenses - expectedSpendByToday;

    return {
      remainingDays,
      dailySafeSpend,
      remainingBudget,
      pace,
      daysPassed: today,
    };
  }, [
    financialState.safeIncome,
    financialState.safeExpenses,
  ]);

  const daysUntilBroke = React.useMemo(() => {
    const dailyExpenseRate =
      spendingInsight.daysPassed > 0 ? financialState.safeExpenses / spendingInsight.daysPassed : 0;
    if (dailyExpenseRate <= 0) return Infinity;
    const safeBalance = financialState.safeBalance;
    return safeBalance > 0 ? safeBalance / dailyExpenseRate : 0;
  }, [financialState.safeBalance, financialState.safeExpenses, spendingInsight.daysPassed]);

  const formatCurrency = React.useCallback((amount: number) => {
    const safeAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;
    return formatCurrencyWithSettings(safeAmount);
  }, [formatCurrencyWithSettings]);

  const gradientColors = React.useMemo<[string, string]>(
    () => (theme.isDark ? ['#2d2d2d', '#404040'] : ['#667eea', '#764ba2']),
    [theme.isDark]
  );

  const incomeColor = theme.colors?.success ?? '#4CAF50';
  const expenseColor = theme.colors?.error ?? '#F44336';
  const warningColor = theme.colors?.warning ?? '#FF9800';
  const incomeIconBackground = React.useMemo(() => `${incomeColor}24`, [incomeColor]);
  const expenseIconBackground = React.useMemo(() => `${expenseColor}24`, [expenseColor]);
  const formattedBalance = React.useMemo(
    () => formatCurrency(financialState.safeBalance),
    [financialState.safeBalance, formatCurrency]
  );
  const formattedIncome = React.useMemo(
    () => formatCurrency(financialState.safeIncome),
    [financialState.safeIncome, formatCurrency]
  );
  const formattedExpenses = React.useMemo(
    () => formatCurrency(financialState.safeExpenses),
    [financialState.safeExpenses, formatCurrency]
  );
  const formattedDailySpend = React.useMemo(
    () => formatCurrency(spendingInsight.dailySafeSpend),
    [spendingInsight.dailySafeSpend, formatCurrency]
  );
  const formattedDaysUntilBroke = React.useMemo(() => {
    if (!Number.isFinite(daysUntilBroke)) return 'N/A';
    return Math.floor(daysUntilBroke).toString();
  }, [daysUntilBroke]);
  const brokeColor = daysUntilBroke <= 7 ? '#FF5252' : '#FFFFFF';

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.label}>Total Balance</Text>
        <AdaptiveAmountText
          style={[styles.balance, financialState.isNegative && styles.negativeBalance]}
          accessibilityRole="text"
          accessibilityLabel={`Total balance ${financialState.isNegative ? 'negative ' : ''}${formattedBalance}`}
          accessibilityHint="Your current total balance across all accounts"
          value={`${financialState.isNegative ? '-' : ''}${formattedBalance}`}
        />

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: incomeIconBackground }]}>
              <TrendingUp size={14} color={incomeColor} />
            </View>
            <View style={styles.statCopy}>
              <Text style={styles.statLabel}>Income</Text>
              <AdaptiveAmountText style={styles.statValue} value={formattedIncome} />
            </View>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: expenseIconBackground }]}>
              <TrendingDown size={14} color={expenseColor} />
            </View>
            <View style={styles.statCopy}>
              <Text style={styles.statLabel}>Expenses</Text>
              <AdaptiveAmountText style={styles.statValue} value={formattedExpenses} />
            </View>
          </View>
        </View>

        <View style={styles.dailyContainer}>
          <Text style={styles.dailyLabel}>Daily Safe Spend</Text>

          <View style={styles.dailyValueRow}>
            <AdaptiveAmountText
              style={styles.dailyValue}
              accessibilityRole="text"
              accessibilityLabel={`Safe daily spending amount ${formattedDailySpend}`}
              value={formattedDailySpend}
            />
            <Text style={styles.dailyUnit}>/day</Text>
          </View>

          <Text style={styles.dailySubtext}>
            Based on {spendingInsight.remainingDays} days remaining this month
          </Text>

          {spendingInsight.pace > 0 && (
            <Text style={[styles.paceWarning, { color: warningColor }]}>
              Spending ahead of monthly pace
            </Text>
          )}

          {spendingInsight.pace < 0 && (
            <Text style={styles.paceGood}>
              Under monthly pace
            </Text>
          )}
        </View>

        <View style={styles.dailyContainer}>
          <Text style={styles.dailyLabel}>Days Until Broke</Text>
          <Text style={[styles.dailyValue, { color: brokeColor }]}>
            {formattedDaysUntilBroke}
          </Text>
          <Text style={styles.dailySubtext}>
            At current spending rate
          </Text>
        </View>

        {financialState.overspending ? (
          <Text style={[styles.warning, { color: warningColor }]}>Spending is above income this month</Text>
        ) : null}
      </View>
    </LinearGradient>
  );
});

BalanceCard.displayName = 'BalanceCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  content: {
    padding: 14,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.25,
    marginBottom: 5,
  },
  balance: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  negativeBalance: {
    color: '#FFCDD2',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statCopy: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  statValue: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  warning: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
  },
  dailyContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  dailyLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  dailyValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  dailyValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
    flexShrink: 1,
  },
  dailyUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  dailySubtext: {
    marginTop: 2,
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 13,
  },
  paceWarning: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '600',
  },
  paceGood: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '600',
    color: '#A5D6A7',
  },
});
