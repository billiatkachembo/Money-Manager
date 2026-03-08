import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { Transaction } from '@/types/transaction';
import { TransactionItem } from '@/components/TransactionItem';
import { EditTransactionModal } from '@/components/EditTransactionModal';

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function buildCalendarDays(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export default function CalendarScreen() {
  const { transactions, formatCurrency, deleteTransaction } = useTransactionStore();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const transactionsByDate = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[]; income: number; expenses: number; net: number }>();

    for (const transaction of transactions) {
      const key = toDateKey(new Date(transaction.date));
      const bucket = map.get(key) ?? { transactions: [], income: 0, expenses: 0, net: 0 };

      bucket.transactions.push(transaction);
      if (transaction.type === 'income') {
        bucket.income += transaction.amount;
        bucket.net += transaction.amount;
      } else if (transaction.type === 'expense') {
        bucket.expenses += transaction.amount;
        bucket.net -= transaction.amount;
      }

      map.set(key, bucket);
    }

    return map;
  }, [transactions]);

  const selectedDateTransactions = useMemo(
    () => transactionsByDate.get(toDateKey(selectedDate))?.transactions ?? [],
    [selectedDate, transactionsByDate]
  );

  const currentMonthTransactions = useMemo(
    () => transactions.filter((transaction) => isSameMonth(new Date(transaction.date), currentMonth)),
    [currentMonth, transactions]
  );

  const monthSummary = useMemo(
    () => ({
      income: currentMonthTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      expenses: currentMonthTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      count: currentMonthTransactions.length,
    }),
    [currentMonthTransactions]
  );

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigateMonth = (direction: 'prev' | 'next') => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    const normalized = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    setCurrentMonth(normalized);

    if (!isSameMonth(selectedDate, normalized)) {
      setSelectedDate(normalized);
    }
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

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

  const isToday = (date: Date) => isSameDay(date, new Date());
  const getDayEntry = (date: Date) => transactionsByDate.get(toDateKey(date));

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <TouchableOpacity style={[styles.navButton, { backgroundColor: theme.colors.background }]} onPress={() => navigateMonth('prev')}>
          <ChevronLeft size={22} color={theme.colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.monthTitle, { color: theme.colors.text }]}> 
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <Text style={[styles.monthSubtitle, { color: theme.colors.textSecondary }]}> 
            {monthSummary.count} transaction{monthSummary.count === 1 ? '' : 's'} this month
          </Text>
        </View>

        <TouchableOpacity style={[styles.navButton, { backgroundColor: theme.colors.background }]} onPress={() => navigateMonth('next')}>
          <ChevronRight size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.monthStats, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={[styles.monthStatCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
          <TrendingUp size={16} color="#16A34A" />
          <Text style={[styles.monthStatLabel, { color: theme.colors.textSecondary }]}>Income</Text>
          <Text style={[styles.monthStatValue, { color: '#16A34A' }]}>{formatCurrency(monthSummary.income)}</Text>
        </View>
        <View style={[styles.monthStatCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
          <TrendingDown size={16} color="#DC2626" />
          <Text style={[styles.monthStatLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
          <Text style={[styles.monthStatValue, { color: '#DC2626' }]}>{formatCurrency(monthSummary.expenses)}</Text>
        </View>
      </View>

      <View style={[styles.calendar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={styles.weekHeader}>
          {weekDays.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={[styles.weekDayText, { color: theme.colors.textSecondary }]}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((date) => {
            const entry = getDayEntry(date);
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const selected = isSameDay(date, selectedDate);
            const dots = Math.min(entry?.transactions.length ?? 0, 3);

            return (
              <TouchableOpacity
                key={toDateKey(date)}
                style={styles.dayCell}
                activeOpacity={0.82}
                onPress={() => selectDate(date)}
              >
                <View
                  style={[
                    styles.dayInner,
                    {
                      backgroundColor: selected
                        ? theme.colors.primary
                        : isToday(date)
                          ? theme.colors.primary + '18'
                          : 'transparent',
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: selected
                          ? '#FFFFFF'
                          : isCurrentMonth
                            ? theme.colors.text
                            : theme.colors.textSecondary,
                        opacity: isCurrentMonth ? 1 : 0.65,
                      },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {dots > 0 ? (
                    <View style={styles.dotRow}>
                      {Array.from({ length: dots }).map((_, index) => (
                        <View
                          key={`${toDateKey(date)}-${index}`}
                          style={[
                            styles.dot,
                            {
                              backgroundColor: selected
                                ? '#FFFFFF'
                                : (entry?.net ?? 0) >= 0
                                  ? '#16A34A'
                                  : '#DC2626',
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.selectedDateSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <View style={styles.selectedHeader}>
          <Text style={[styles.selectedDateTitle, { color: theme.colors.text }]}> 
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <TouchableOpacity onPress={() => selectDate(new Date())}>
            <Text style={[styles.todayLink, { color: theme.colors.primary }]}>Today</Text>
          </TouchableOpacity>
        </View>

        {selectedDateTransactions.length > 0 ? (
          <>
            <View style={styles.dayStats}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
                <TrendingUp size={16} color="#16A34A" />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                <Text style={[styles.statValue, { color: '#16A34A' }]}>
                  {formatCurrency(
                    selectedDateTransactions
                      .filter((transaction) => transaction.type === 'income')
                      .reduce((sum, transaction) => sum + transaction.amount, 0)
                  )}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
                <TrendingDown size={16} color="#DC2626" />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                <Text style={[styles.statValue, { color: '#DC2626' }]}>
                  {formatCurrency(
                    selectedDateTransactions
                      .filter((transaction) => transaction.type === 'expense')
                      .reduce((sum, transaction) => sum + transaction.amount, 0)
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.transactionsList}>
              <Text style={[styles.transactionsTitle, { color: theme.colors.text }]}>Transactions</Text>
              {selectedDateTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  showActions
                  onEdit={() => setEditingTransaction(transaction)}
                  onDelete={() => confirmDeleteTransaction(transaction)}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.noTransactions}>
            <Text style={[styles.noTransactionsText, { color: theme.colors.textSecondary }]}> 
              No transactions on this date
            </Text>
          </View>
        )}
      </View>

      {editingTransaction ? (
        <EditTransactionModal
          visible={true}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={() => setEditingTransaction(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  monthSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  monthStats: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  monthStatCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  monthStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 4,
  },
  monthStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  calendar: {
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    padding: 3,
  },
  dayInner: {
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  selectedDateSection: {
    margin: 16,
    marginTop: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  todayLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionsList: {
    gap: 4,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  noTransactions: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noTransactionsText: {
    fontSize: 14,
  },
});
