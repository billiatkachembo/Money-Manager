import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Transaction } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { formatDateDDMMYYYY } from '@/utils/date';
import * as Icons from 'lucide-react-native';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export function TransactionItem({
  transaction,
  onPress,
  onEdit,
  onDelete,
  showActions = false,
  compact = false,
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
        compact && styles.compactContainer,
      ]}
    >
      <TouchableOpacity
        activeOpacity={onPress ? 0.82 : 1}
        disabled={!onPress}
        onPress={onPress}
        style={[styles.mainRow, compact && styles.compactMainRow]}
      >
        <View style={[styles.iconContainer, compact && styles.compactIconContainer, { backgroundColor: transaction.category.color + '20' }]}>
          <IconComponent size={compact ? 18 : 20} color={transaction.category.color} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.description, compact && styles.compactDescription, { color: theme.colors.text }]} numberOfLines={1}>
            {transaction.description}
          </Text>
          <Text style={[styles.category, compact && styles.compactMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {transaction.category.name}
          </Text>
        </View>

        <View style={[styles.rightContent, compact && styles.compactRightContent]}>
          <AdaptiveAmountText
            style={[styles.amount, compact && styles.compactAmount, amountColor]}
            minFontSize={11}
            value={`${amountPrefix}${formatCurrency(transaction.amount)}`}
          />
          <Text style={[styles.date, compact && styles.compactMeta, { color: theme.colors.textSecondary }]}>{formatDate(transaction.date)}</Text>
        </View>
      </TouchableOpacity>

      {hasActions ? (
        <View style={[styles.actionsRow, compact && styles.compactActionsRow, { borderTopColor: theme.colors.border }]}> 
          {onEdit ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onEdit}
              style={[styles.actionButton, compact && styles.compactActionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
              <Pencil size={compact ? 13 : 14} color={theme.colors.primary} />
              <Text style={[styles.actionText, compact && styles.compactActionText, { color: theme.colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onDelete}
              style={[styles.actionButton, compact && styles.compactActionButton, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
            >
              <Trash2 size={compact ? 13 : 14} color="#DC2626" />
              <Text style={[styles.actionText, compact && styles.compactActionText, { color: '#DC2626' }]}>Delete</Text>
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
  compactContainer: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  compactMainRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  compactDescription: {
    fontSize: 14,
  },
  category: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactMeta: {
    fontSize: 11,
  },
  rightContent: {
    alignItems: 'flex-end',
    marginLeft: 12,
    maxWidth: '46%',
    flexShrink: 1,
  },
  compactRightContent: {
    marginLeft: 10,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'right',
  },
  compactAmount: {
    fontSize: 14,
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
  compactActionsRow: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
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
  compactActionButton: {
    borderRadius: 8,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  compactActionText: {
    fontSize: 11,
  },
});
