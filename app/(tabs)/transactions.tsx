import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionItem } from '@/components/TransactionItem';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { Transaction, TransactionType } from '@/types/transaction';

const FILTER_OPTIONS: Array<{ key: 'all' | TransactionType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expenses' },
  { key: 'transfer', label: 'Transfers' },
];

export default function TransactionsScreen() {
  const { transactions, deleteTransaction, formatCurrency } = useTransactionStore();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | TransactionType>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, filter]);

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => (filter === 'all' ? true : transaction.type === filter)),
    [filter, transactions]
  );

  const totals = useMemo(
    () => ({
      income: filteredTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      expenses: filteredTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      transfers: filteredTransactions
        .filter((transaction) => transaction.type === 'transfer')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }),
    [filteredTransactions]
  );

  const confirmDeleteTransaction = (transaction: Transaction) => {
    Alert.alert('Delete transaction', `Delete "${transaction.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTransaction(transaction.id),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}> 
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}> 
        <View style={styles.filterContainer}>
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.7}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.background,
                    borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                  },
                ]}
                onPress={() => setFilter(option.key)}
              >
                <Text style={[styles.filterText, { color: isActive ? 'white' : theme.colors.textSecondary }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryContainer}>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>{formatCurrency(totals.income)}</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>{formatCurrency(totals.expenses)}</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Transfers</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>{formatCurrency(totals.transfers)}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {filteredTransactions.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No transactions found</Text>
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}> 
                {filter === 'all' ? 'Start adding transactions to see them here.' : `No ${filter} transactions are available right now.`}
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {filteredTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  showActions
                  onEdit={() => setEditingTransaction(transaction)}
                  onDelete={() => confirmDeleteTransaction(transaction)}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {editingTransaction ? (
        <EditTransactionModal
          visible={true}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={() => setEditingTransaction(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  incomeText: {
    color: '#16A34A',
  },
  expenseText: {
    color: '#DC2626',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  transactionsList: {
    gap: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
