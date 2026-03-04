import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { Transaction } from '@/types/transaction';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CALENDAR_MARGIN = 16;
const CALENDAR_PADDING = 16;
const GRID_WIDTH = SCREEN_WIDTH - CALENDAR_MARGIN * 2 - CALENDAR_PADDING * 2;
const CELL_SIZE = GRID_WIDTH / 7;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CalendarScreen() {
  const { transactions } = useTransactionStore();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const formatCurrency = (amount: number) => {
    if (typeof amount !== 'number' || Number.isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Keep full week rows for a stable grid.
    const trailingEmptyCells = (7 - (days.length % 7)) % 7;
    for (let i = 0; i < trailingEmptyCells; i++) {
      days.push(null);
    }

    return days;
  };

  const transactionsByDate = useMemo(() => {
    const map = new Map<
      string,
      { transactions: Transaction[]; income: number; expenses: number; net: number }
    >();

    for (const transaction of transactions) {
      const txDate = new Date(transaction.date);
      const key = toDateKey(txDate);
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

  const getTransactionsForDate = (date: Date): Transaction[] => {
    return transactionsByDate.get(toDateKey(date))?.transactions ?? [];
  };

  const getDayTotal = (date: Date) => {
    const entry = transactionsByDate.get(toDateKey(date));
    if (!entry) {
      return { income: 0, expenses: 0, net: 0 };
    }
    return { income: entry.income, expenses: entry.expenses, net: entry.net };
  };

  const selectedDateTransactions = useMemo(() => {
    return getTransactionsForDate(selectedDate);
  }, [selectedDate, transactionsByDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }

    const newSelected = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
    setCurrentMonth(newMonth);
    setSelectedDate(newSelected);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigateMonth('prev')}
        >
          <ChevronLeft size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <Text style={[styles.monthTitle, { color: theme.colors.text }]}>
          {currentMonth.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigateMonth('next')}
        >
          <ChevronRight size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.calendar, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.weekHeader}>
          {weekDays.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={[styles.weekDayText, { color: theme.colors.textSecondary }]}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {days.map((date, index) => {
            if (!date) {
              return <View key={`empty-${index}`} style={styles.emptyCell} />;
            }

            const dayTotal = getDayTotal(date);
            const hasTransactions = getTransactionsForDate(date).length > 0;

            return (
              <TouchableOpacity
                key={toDateKey(date)}
                style={[
                  styles.dayCell,
                  isToday(date) && { backgroundColor: `${theme.colors.primary}20`, borderRadius: 8 },
                  isSelected(date) && { backgroundColor: theme.colors.primary, borderRadius: 8 },
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: theme.colors.text },
                    isToday(date) && { color: theme.colors.primary, fontWeight: '600' },
                    isSelected(date) && { color: 'white', fontWeight: '600' },
                  ]}
                >
                  {date.getDate()}
                </Text>
                {hasTransactions && (
                  <View style={styles.transactionIndicator}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: dayTotal.net >= 0 ? '#4CAF50' : '#F44336' },
                      ]}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.selectedDateSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.selectedDateTitle, { color: theme.colors.text }]}> 
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        {selectedDateTransactions.length > 0 ? (
          <>
            <View style={styles.dayStats}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.background }]}>
                <TrendingUp size={16} color="#4CAF50" />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                <Text style={[styles.statValue, styles.incomeText]}>
                  {formatCurrency(
                    selectedDateTransactions
                      .filter((t) => t.type === 'income')
                      .reduce((sum, t) => sum + t.amount, 0)
                  )}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.background }]}>
                <TrendingDown size={16} color="#F44336" />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                <Text style={[styles.statValue, styles.expenseText]}>
                  {formatCurrency(
                    selectedDateTransactions
                      .filter((t) => t.type === 'expense')
                      .reduce((sum, t) => sum + t.amount, 0)
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.transactionsList}>
              <Text style={[styles.transactionsTitle, { color: theme.colors.text }]}>Transactions</Text>
              {selectedDateTransactions.map((transaction) => (
                <View key={transaction.id} style={[styles.transactionItem, { borderBottomColor: theme.colors.border }]}>
                  <View style={[styles.transactionIcon, { backgroundColor: theme.colors.background }]}> 
                    <Text style={styles.transactionEmoji}>
                      {transaction.category.icon}
                    </Text>
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={[styles.transactionDescription, { color: theme.colors.text }]}>
                      {transaction.description}
                    </Text>
                    <Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}> 
                      {transaction.category.name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.type === 'income' ? styles.incomeText : styles.expenseText,
                    ]}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'white',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#667eea20',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  calendar: {
    backgroundColor: 'white',
    margin: CALENDAR_MARGIN,
    borderRadius: 16,
    padding: CALENDAR_PADDING,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  transactionIndicator: {
    position: 'absolute',
    bottom: 4,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  selectedDateSection: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  dayStats: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  incomeText: {
    color: '#4CAF50',
  },
  expenseText: {
    color: '#F44336',
  },
  transactionsList: {
    marginTop: 8,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionEmoji: {
    fontSize: 18,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  noTransactions: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noTransactionsText: {
    fontSize: 14,
    color: '#666',
  },
});
