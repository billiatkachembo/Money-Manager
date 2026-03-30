import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Landmark, X } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { Transaction } from '@/types/transaction';
import { formatDateDDMMYYYY, formatDateWithWeekday } from '@/utils/date';
import { TransactionItem } from '@/components/TransactionItem';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { useI18n } from '@/src/i18n';

function toDateKey(date: Date): string {
  return formatDateDDMMYYYY(date);
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
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showSelectedDayCard, setShowSelectedDayCard] = useState(false);

  const today = new Date();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const softSurface = theme.isDark ? 'rgba(15,23,42,0.72)' : '#F8FAFC';
  const positiveTint = theme.isDark ? 'rgba(34,197,94,0.16)' : '#ECFDF5';
  const negativeTint = theme.isDark ? 'rgba(239,68,68,0.16)' : '#FEF2F2';
  const primaryTint = theme.colors.primary + '14';

  const transactionsByDate = useMemo(() => {
    const map = new Map<string, { transactions: Transaction[]; income: number; expenses: number; debt: number; net: number }>();

    for (const transaction of transactions) {
      const normalizedDate = new Date(transaction.date);
      const key = toDateKey(normalizedDate);
      const bucket = map.get(key) ?? { transactions: [], income: 0, expenses: 0, debt: 0, net: 0 };

      bucket.transactions.push(transaction);
      if (transaction.type === 'income') {
        bucket.income += transaction.amount;
        bucket.net += transaction.amount;
      } else if (transaction.type === 'expense') {
        bucket.expenses += transaction.amount;
        bucket.net -= transaction.amount;
      } else if (transaction.type === 'debt') {
        const debtDirection = transaction.debtDirection === 'lent' ? -1 : 1;
        bucket.debt += Math.abs(transaction.amount) * debtDirection;
      }

      map.set(key, bucket);
    }

    for (const bucket of map.values()) {
      bucket.transactions.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    }

    return map;
  }, [transactions]);

  const selectedDaySummary = useMemo(
    () => transactionsByDate.get(toDateKey(selectedDate)) ?? { transactions: [], income: 0, expenses: 0, debt: 0, net: 0 },
    [selectedDate, transactionsByDate]
  );

  const currentMonthTransactions = useMemo(
    () => transactions.filter((transaction) => isSameMonth(new Date(transaction.date), currentMonth)),
    [currentMonth, transactions]
  );

  const monthSummary = useMemo(() => {
    const activeDays = new Set<string>();
    let income = 0;
    let expenses = 0;
    let debt = 0;

    for (const transaction of currentMonthTransactions) {
      const normalizedDate = new Date(transaction.date);
      activeDays.add(toDateKey(normalizedDate));
      if (transaction.type === 'income') {
        income += transaction.amount;
      } else if (transaction.type === 'expense') {
        expenses += transaction.amount;
      } else if (transaction.type === 'debt') {
        const debtDirection = transaction.debtDirection === 'lent' ? -1 : 1;
        debt += Math.abs(transaction.amount) * debtDirection;
      }
    }

    return {
      income,
      expenses,
      debt,
      net: income - expenses,
      count: currentMonthTransactions.length,
      activeDays: activeDays.size,
    };
  }, [currentMonthTransactions]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const currentMonthLabel = useMemo(
    () => currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [currentMonth]
  );

  const navigateMonth = (direction: 'prev' | 'next') => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    const normalized = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    setCurrentMonth(normalized);
    setShowSelectedDayCard(false);

    if (!isSameMonth(selectedDate, normalized)) {
      setSelectedDate(normalized);
    }
  };

  const selectDate = (date: Date) => {
    const hasTransactions = (transactionsByDate.get(toDateKey(date))?.transactions.length ?? 0) > 0;
    setSelectedDate(date);
    setShowSelectedDayCard(hasTransactions);
    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const jumpToToday = () => {
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), 1);
    setCurrentMonth(normalizedToday);
    setSelectedDate(today);
    setShowSelectedDayCard(false);
  };

  const confirmDeleteTransaction = (transaction: Transaction) => {
    Alert.alert('Delete transaction', 'Delete "' + transaction.description + '"?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTransaction(transaction.id),
      },
    ]);
  };

  const getDayEntry = (date: Date) => transactionsByDate.get(toDateKey(date));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.topBarEyebrow, { color: theme.colors.textSecondary }]}>Calendar</Text>
        </View>
        <TouchableOpacity
          style={[styles.todayButton, { backgroundColor: primaryTint, borderColor: theme.colors.primary + '26' }]}
          onPress={jumpToToday}
          activeOpacity={0.85}
        >
          <Text style={[styles.todayButtonText, { color: theme.colors.primary }]}>{t('common.today')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.monthSwitcher, { backgroundColor: softSurface, borderColor: theme.colors.border }]}> 
        <TouchableOpacity style={styles.monthNavButton} onPress={() => navigateMonth('prev')} activeOpacity={0.8}>
          <ChevronLeft size={18} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.monthSwitcherCenter}>
          <Text style={[styles.monthSwitcherTitle, { color: theme.colors.text }]}>{currentMonthLabel}</Text>
          <Text style={[styles.monthSwitcherSubtitle, { color: theme.colors.textSecondary }]}>Tap a day to inspect activity</Text>
        </View>
        <TouchableOpacity style={styles.monthNavButton} onPress={() => navigateMonth('next')} activeOpacity={0.8}>
          <ChevronRight size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.monthSummaryStrip, { borderColor: theme.colors.border }]}> 
        <View style={styles.monthSummaryItem}>
          <Text style={[styles.monthSummaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
          <Text style={[styles.monthSummaryValue, { color: '#16A34A' }]} numberOfLines={1}>{formatCurrency(monthSummary.income)}</Text>
        </View>
        <View style={[styles.monthSummaryDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.monthSummaryItem}>
          <Text style={[styles.monthSummaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
          <Text style={[styles.monthSummaryValue, { color: '#DC2626' }]} numberOfLines={1}>{formatCurrency(monthSummary.expenses)}</Text>
        </View>
        <View style={[styles.monthSummaryDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.monthSummaryItem}>
          <Text style={[styles.monthSummaryLabel, { color: theme.colors.textSecondary }]}>Debt</Text>
          <Text style={[styles.monthSummaryValue, { color: '#9333EA' }]} numberOfLines={1}>{formatCurrency(monthSummary.debt)}</Text>
        </View>
        <View style={[styles.monthSummaryDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.monthSummaryItem}>
          <Text style={[styles.monthSummaryLabel, { color: theme.colors.textSecondary }]}>Net</Text>
          <Text
            style={[
              styles.monthSummaryValue,
              { color: monthSummary.net >= 0 ? '#2563EB' : '#DC2626' },
            ]}
            numberOfLines={1}
          >
            {formatCurrency(monthSummary.net)}
          </Text>
        </View>
      </View>

      <View style={[styles.calendarSurface, { backgroundColor: softSurface, borderColor: theme.colors.border }]}> 
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
            const isSelected = isSameDay(date, selectedDate);
            const currentDay = isSameDay(date, today);
            const txCount = entry?.transactions.length ?? 0;
            const net = entry?.net ?? 0;
            const showPreview = isCurrentMonth && txCount > 0;

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
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.background,
                      borderColor: isSelected
                        ? theme.colors.primary
                        : currentDay
                          ? theme.colors.primary + '55'
                          : theme.colors.border,
                      opacity: isCurrentMonth ? 1 : 0.54,
                    },
                  ]}
                >
                  <View style={styles.dayTopRow}>
                    <Text
                      style={[
                        styles.dayText,
                        { color: isSelected ? '#FFFFFF' : theme.colors.text },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {txCount > 0 ? (
                      <View
                        style={[
                          styles.dayCountBadge,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(255,255,255,0.18)'
                              : net >= 0
                                ? positiveTint
                                : negativeTint,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayCountText,
                            { color: isSelected ? '#FFFFFF' : net >= 0 ? '#16A34A' : '#DC2626' },
                          ]}
                        >
                          {txCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {showPreview ? (
                    <Text
                      style={[
                        styles.dayNetPreview,
                        { color: isSelected ? '#FFFFFF' : net >= 0 ? '#16A34A' : '#DC2626' },
                      ]}
                      numberOfLines={1}
                    >
                      {formatCurrency(Math.abs(net))}
                    </Text>
                  ) : (
                    <View style={styles.dayPlaceholder} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Modal
        visible={showSelectedDayCard && selectedDaySummary.transactions.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSelectedDayCard(false)}
      >
        <View style={styles.selectedDayModalRoot}>
          <TouchableOpacity
            style={styles.selectedDayModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSelectedDayCard(false)}
          />
          <View style={[styles.selectedDayModalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.selectedHeader}>
              <View style={styles.selectedHeaderText}>
                <Text style={[styles.selectedDateTitle, { color: theme.colors.text }]}>{formatDateWithWeekday(selectedDate)}</Text>
                <Text style={[styles.selectedDateMeta, { color: theme.colors.textSecondary }]}>
                  {selectedDaySummary.transactions.length} item{selectedDaySummary.transactions.length === 1 ? '' : 's'} on this date
                </Text>
              </View>
              <View style={styles.selectedDayModalHeaderRow}>
                <View
                  style={[
                    styles.selectedNetChip,
                    { backgroundColor: selectedDaySummary.net >= 0 ? positiveTint : negativeTint },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectedNetChipText,
                      { color: selectedDaySummary.net >= 0 ? '#16A34A' : '#DC2626' },
                    ]}
                  >
                    {selectedDaySummary.net >= 0 ? 'Net In' : 'Net Out'}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close selected day details"
                  style={[styles.selectedDayModalCloseButton, { borderColor: theme.colors.border }]}
                  onPress={() => setShowSelectedDayCard(false)}
                >
                  <X size={16} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.selectedSummaryInline}>
              <View style={styles.selectedSummaryInlineItem}>
                <TrendingUp size={14} color="#16A34A" />
                <Text style={[styles.selectedSummaryInlineLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                <Text style={[styles.selectedSummaryInlineValue, { color: '#16A34A' }]} numberOfLines={1}>
                  {formatCurrency(selectedDaySummary.income)}
                </Text>
              </View>
              <View style={styles.selectedSummaryInlineItem}>
                <TrendingDown size={14} color="#DC2626" />
                <Text style={[styles.selectedSummaryInlineLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                <Text style={[styles.selectedSummaryInlineValue, { color: '#DC2626' }]} numberOfLines={1}>
                  {formatCurrency(selectedDaySummary.expenses)}
                </Text>
              </View>
              <View style={styles.selectedSummaryInlineItem}>
                <Landmark size={14} color="#9333EA" />
                <Text style={[styles.selectedSummaryInlineLabel, { color: theme.colors.textSecondary }]}>Debt</Text>
                <Text style={[styles.selectedSummaryInlineValue, { color: '#9333EA' }]} numberOfLines={1}>
                  {formatCurrency(selectedDaySummary.debt)}
                </Text>
              </View>
            </View>

            <ScrollView
              style={[styles.selectedDayModalList, { borderTopColor: theme.colors.border }]}
              showsVerticalScrollIndicator={false}
            >
              {selectedDaySummary.transactions.map((transaction, index) => (
                <View
                  key={transaction.id}
                  style={[
                    styles.transactionRow,
                    index < selectedDaySummary.transactions.length - 1 && { borderBottomColor: theme.colors.border },
                  ]}
                >
                  <TransactionItem
                    transaction={transaction}
                    showActions
                    compact
                    onEdit={() => {
                      setShowSelectedDayCard(false);
                      setEditingTransaction(transaction);
                    }}
                    onDelete={() => confirmDeleteTransaction(transaction)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  topBarEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  topBarTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  todayButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 2,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  monthSwitcherCenter: {
    flex: 1,
    alignItems: 'center',
  },
  monthSwitcherTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  monthSwitcherSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  monthSummaryStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  monthSummaryItem: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  monthSummaryDivider: {
    width: 1,
  },
  monthSummaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 6,
  },
  monthSummaryValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  calendarSurface: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    padding: 4,
  },
  dayInner: {
    minHeight: 84,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingTop: 7,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  dayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dayCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dayNetPreview: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  dayPlaceholder: {
    height: 12,
  },
  selectedSection: {
    marginTop: 16,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  selectedHeaderText: {
    flex: 1,
  },
  selectedDateTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  selectedDateMeta: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  selectedNetChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedNetChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectedSummaryInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  selectedSummaryInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedSummaryInlineLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedSummaryInlineValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectedDayModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  selectedDayModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  selectedDayModalCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: '72%',
  },
  selectedDayModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedDayModalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDayModalList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 320,
  },
  transactionsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  transactionRow: {
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

