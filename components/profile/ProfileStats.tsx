import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/store/theme-store';

interface ProfileStatsProps {
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  hideAmounts?: boolean;
  formatCurrency: (value: number) => string;
}

export function ProfileStats({
  transactionCount,
  totalIncome,
  totalExpenses,
  hideAmounts,
  formatCurrency,
}: ProfileStatsProps) {
  const { theme } = useTheme();

  const incomeText = hideAmounts ? '***' : formatCurrency(totalIncome);
  const expenseText = hideAmounts ? '***' : formatCurrency(totalExpenses);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
      <Text style={[styles.title, { color: theme.colors.text }]}>Your Statistics</Text>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={[styles.value, { color: theme.colors.text }]}>{transactionCount}</Text>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Transactions</Text>
        </View>
        <View style={styles.item}>
          <Text style={[styles.value, { color: theme.colors.success }]}>{incomeText}</Text>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Total Income</Text>
        </View>
        <View style={styles.item}>
          <Text style={[styles.value, { color: theme.colors.error }]}>{expenseText}</Text>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Total Expenses</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
