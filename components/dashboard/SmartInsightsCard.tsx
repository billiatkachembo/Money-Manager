import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, TrendingUp, BarChart3 } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

interface SmartInsightsProps {
  balance: number;
  income: number;
  expenses: number;
}

export const SmartInsightsCard = React.memo(function SmartInsightsCard({
  balance,
  income,
  expenses,
}: SmartInsightsProps) {
  const { theme } = useTheme();
  const { formatCurrency: formatCurrencyWithSettings } = useTransactionStore();

  const insights = React.useMemo(() => {
    const now = new Date();
    const safeBalance = Number.isFinite(balance) ? balance : 0;
    const safeIncome = Number.isFinite(income) ? income : 0;
    const safeExpenses = Number.isFinite(expenses) ? expenses : 0;

    const year = now.getFullYear();
    const month = now.getMonth();

    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();

    const daysPassed = Math.max(today, 1);
    const remainingDays = Math.max(totalDaysInMonth - today + 1, 1);

    const dailySafeSpend = safeBalance > 0 ? safeBalance / remainingDays : 0;
    const burnRate = safeExpenses > 0 ? safeExpenses / daysPassed : 0;

    const projectedSpend = burnRate * totalDaysInMonth;
    const projectedBalance = safeIncome - projectedSpend;

    const overspending = safeExpenses > safeIncome;

    return {
      dailySafeSpend,
      burnRate,
      projectedBalance,
      overspending,
    };
  }, [balance, income, expenses]);

  const formatCurrency = React.useCallback(
    (amount: number) => {
      const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
      return formatCurrencyWithSettings(safe);
    },
    [formatCurrencyWithSettings]
  );

  const gradientColors = React.useMemo<[string, string]>(
    () => (theme.isDark ? ['#2d2d2d', '#404040'] : ['#3a7bd5', '#3a6073']),
    [theme.isDark]
  );

  const successColor = theme.colors?.success ?? '#4CAF50';
  const warningColor = theme.colors?.warning ?? '#FF9800';
  const errorColor = theme.colors?.error ?? '#F44336';

  const formattedDailySpend = React.useMemo(
    () => formatCurrency(insights.dailySafeSpend),
    [insights.dailySafeSpend, formatCurrency]
  );

  const formattedBurnRate = React.useMemo(
    () => formatCurrency(insights.burnRate),
    [insights.burnRate, formatCurrency]
  );

  const formattedProjectedBalance = React.useMemo(
    () => formatCurrency(insights.projectedBalance),
    [insights.projectedBalance, formatCurrency]
  );

  const projectionNegative = insights.projectedBalance < 0;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.header}>Smart Insights</Text>

        <View style={styles.row}>
          <View style={styles.icon}>
            <Wallet size={16} color="white" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.label}>Daily Safe Spend</Text>
            <Text
              style={styles.value}
              accessibilityRole="text"
              accessibilityLabel={`Daily safe spending amount ${formattedDailySpend} per day`}
            >
              {formattedDailySpend}
              <Text style={styles.unit}> /day</Text>
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.icon}>
            <TrendingUp size={16} color="white" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.label}>Average Daily Spend</Text>
            <Text style={styles.value}>
              {formattedBurnRate}
              <Text style={styles.unit}> /day</Text>
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.icon}>
            <BarChart3 size={16} color="white" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.label}>Projected Month End</Text>
            <Text
              style={[
                styles.value,
                projectionNegative ? { color: errorColor } : { color: successColor },
              ]}
            >
              {projectionNegative ? '-' : ''}
              {formattedProjectedBalance}
            </Text>
          </View>
        </View>

        {insights.overspending ? (
          <Text style={[styles.warning, { color: warningColor }]}>
            Spending is above income this month
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
});

SmartInsightsCard.displayName = 'SmartInsightsCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  header: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  value: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  unit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  warning: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});


