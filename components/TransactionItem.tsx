import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Transaction } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { formatDateDDMMYYYY } from '@/utils/date';
import * as Icons from 'lucide-react-native';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export function TransactionItem({
  transaction,
  onPress,
  onEdit,
  onDelete,
  showActions = false,
}: TransactionItemProps) {
  const { theme } = useTheme();
  const { formatCurrency } = useTransactionStore();

  const formatDate = (date: Date) => formatDateDDMMYYYY(date);

  const IconMap = Icons as unknown as Record<string, React.ComponentType<any>>;
  const IconComponent = IconMap[transaction.category.icon] || Icons.Circle;
  const isDebtBorrowed = transaction.type === 'debt' && transaction.debtDirection === 'borrowed';
  const isDebtLent = transaction.type === 'debt' && transaction.debtDirection === 'lent';
  const amountPrefix =
    transaction.type === 'income' || isDebtBorrowed
      ? '+'
      : transaction.type === 'expense' || isDebtLent
        ? '-'
        : '';
  const amountColor =
    transaction.type === 'income' || isDebtBorrowed
      ? styles.incomeAmount
      : transaction.type === 'expense' || isDebtLent
        ? styles.expenseAmount
        : { color: theme.colors.primary };
  const hasActions = showActions && (onEdit || onDelete);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
          shadowOpacity: theme.isDark ? 0 : 0.08,
          elevation: theme.isDark ? 0 : 2,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={onPress ? 0.82 : 1}
        disabled={!onPress}
        onPress={onPress}
        style={styles.mainRow}
      >
        <View style={[styles.iconContainer, { backgroundColor: transaction.category.color + '20' }]}>
          <IconComponent size={20} color={transaction.category.color} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.description, { color: theme.colors.text }]} numberOfLines={1}>
            {transaction.description}
          </Text>
          <Text style={[styles.category, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {transaction.category.name}
          </Text>
        </View>

        <View style={styles.rightContent}>
          <Text style={[styles.amount, amountColor]}>
            {amountPrefix}
            {formatCurrency(transaction.amount)}
          </Text>
          <Text style={[styles.date, { color: theme.colors.textSecondary }]}>{formatDate(transaction.date)}</Text>
        </View>
      </TouchableOpacity>

      {hasActions ? (
        <View style={[styles.actionsRow, { borderTopColor: theme.colors.border }]}> 
          {onEdit ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onEdit}
              style={[styles.actionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
              <Pencil size={14} color={theme.colors.primary} />
              <Text style={[styles.actionText, { color: theme.colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onDelete}
              style={[styles.actionButton, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
            >
              <Trash2 size={14} color="#DC2626" />
              <Text style={[styles.actionText, { color: '#DC2626' }]}>Delete</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowRadius: 3,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    fontWeight: '500',
  },
  rightContent: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  incomeAmount: {
    color: '#16A34A',
  },
  expenseAmount: {
    color: '#DC2626',
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});


