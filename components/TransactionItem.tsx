import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Transaction } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import * as Icons from 'lucide-react-native';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: () => void;
}

export function TransactionItem({ transaction, onPress }: TransactionItemProps) {
  const { theme } = useTheme();

  const formatCurrency = (amount: number) => {
    if (typeof amount !== 'number' || Number.isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    if (!date || !(date instanceof Date)) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const IconComponent = (Icons as any)[transaction.category.icon] || Icons.Circle;

  const amountPrefix =
    transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '';

  const amountColor =
    transaction.type === 'income'
      ? styles.incomeAmount
      : transaction.type === 'expense'
      ? styles.expenseAmount
      : { color: theme.colors.primary };

  return (
    <TouchableOpacity style={[styles.container, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: transaction.category.color + '20' }]}>
        <IconComponent size={20} color={transaction.category.color} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.description, { color: theme.colors.text }]} numberOfLines={1}>
          {transaction.description}
        </Text>
        <Text style={[styles.category, { color: theme.colors.textSecondary }]}>{transaction.category.name}</Text>
      </View>

      <View style={styles.rightContent}>
        <Text style={[styles.amount, amountColor]}>
          {amountPrefix}
          {formatCurrency(transaction.amount)}
        </Text>
        <Text style={[styles.date, { color: theme.colors.textSecondary }]}>{formatDate(transaction.date)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  incomeAmount: {
    color: '#4CAF50',
  },
  expenseAmount: {
    color: '#F44336',
  },
  date: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
});
