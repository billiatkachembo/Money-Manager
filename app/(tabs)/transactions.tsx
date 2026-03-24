import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SectionList,
  TextInput,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, Search } from 'lucide-react-native';
import { TransactionItem } from '@/components/TransactionItem';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { useTransactionStore } from '@/store/transaction-store';
import { useQuickActionsStore } from '@/store/quick-actions-store';
import { useTheme } from '@/store/theme-store';
import { Transaction, TransactionType } from '@/types/transaction';

const FILTER_OPTIONS: Array<{ key: 'all' | TransactionType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expenses' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'debt', label: 'Debt' },
];

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const UNKNOWN_MONTH_KEY = 'unknown';
const UNKNOWN_MONTH_LABEL = 'Unknown Date';

type MonthSection = {
  key: string;
  title: string;
  data: Transaction[];
  income: number;
  expenses: number;
  net: number;
};

function parseTransactionDate(value: Transaction['date']): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthTitle(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function getCategoryName(category: Transaction['category'] | string | null | undefined): string {
  if (!category) {
    return '';
  }

  if (typeof category === 'string') {
    return category.trim();
  }

  if (typeof category === 'object' && 'name' in category) {
    return String(category.name ?? '').trim();
  }

  return '';
}

export default function TransactionsScreen() {
  const { transactions, deleteTransaction, formatCurrency } = useTransactionStore();
  const { openTransactionSearchAt, consumeSearch } = useQuickActionsStore();
  const searchInputRef = useRef<TextInput>(null);
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    if (!openTransactionSearchAt) {
      return;
    }

    setFilter('all');
    setSearchQuery('');
    requestAnimationFrame(() => searchInputRef.current?.focus());
    consumeSearch();
  }, [consumeSearch, openTransactionSearchAt]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const typeFilteredTransactions = useMemo(() => {
    if (filter === 'all') {
      return transactions;
    }

    return transactions.filter((transaction) => transaction.type === filter);
  }, [filter, transactions]);

  const searchedTransactions = useMemo(() => {
    if (!normalizedQuery) {
      return typeFilteredTransactions;
    }

    return typeFilteredTransactions.filter((transaction) => {
      const description = (transaction.description ?? '').toLowerCase();
      const category = getCategoryName(transaction.category).toLowerCase();
      const amount = String(transaction.amount ?? '');
      const type = transaction.type?.toLowerCase() ?? '';
      return (
        description.includes(normalizedQuery) ||
        category.includes(normalizedQuery) ||
        amount.includes(normalizedQuery) ||
        type.includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, typeFilteredTransactions]);

  const sortedTransactions = useMemo(() => {
    const sorted = [...searchedTransactions];
    sorted.sort((a, b) => {
      const dateA = parseTransactionDate(a.date)?.getTime() ?? 0;
      const dateB = parseTransactionDate(b.date)?.getTime() ?? 0;
      return dateB - dateA;
    });
    return sorted;
  }, [searchedTransactions]);

  const isSearching = normalizedQuery.length > 0;

  const grouped = useMemo(() => {
    if (isSearching) {
      return { sections: [] as MonthSection[], mostRecentKey: null as string | null };
    }

    const sectionMap = new Map<string, MonthSection>();
    const sectionOrder: string[] = [];
    let unknownSection: MonthSection | null = null;

    const ensureSection = (key: string, title: string) => {
      const existing = sectionMap.get(key);
      if (existing) {
        return existing;
      }
      const created: MonthSection = {
        key,
        title,
        data: [],
        income: 0,
        expenses: 0,
        net: 0,
      };
      sectionMap.set(key, created);
      sectionOrder.push(key);
      return created;
    };

    for (const transaction of sortedTransactions) {
      const date = parseTransactionDate(transaction.date);
      const amountValue = Number(transaction.amount);
      const amount = Number.isFinite(amountValue) ? Math.abs(amountValue) : 0;

      if (!date) {
        if (!unknownSection) {
          unknownSection = {
            key: UNKNOWN_MONTH_KEY,
            title: UNKNOWN_MONTH_LABEL,
            data: [],
            income: 0,
            expenses: 0,
            net: 0,
          };
        }
        unknownSection.data.push(transaction);
        if (transaction.type === 'income') {
          unknownSection.income += amount;
        } else if (transaction.type === 'expense') {
          unknownSection.expenses += amount;
        }
        continue;
      }

      const key = getMonthKey(date);
      const title = getMonthTitle(date);
      const section = ensureSection(key, title);
      section.data.push(transaction);
      if (transaction.type === 'income') {
        section.income += amount;
      } else if (transaction.type === 'expense') {
        section.expenses += amount;
      }
    }

    const sections = sectionOrder.map((key) => {
      const section = sectionMap.get(key) as MonthSection;
      return {
        ...section,
        net: section.income - section.expenses,
      };
    });

    if (unknownSection) {
      sections.push({
        ...unknownSection,
        net: unknownSection.income - unknownSection.expenses,
      });
    }

    return {
      sections,
      mostRecentKey: sections[0]?.key ?? null,
    };
  }, [isSearching, sortedTransactions]);

  useEffect(() => {
    if (isSearching) {
      return;
    }

    if (!grouped.mostRecentKey) {
      setExpandedMonths(new Set());
      return;
    }

    setExpandedMonths(new Set([grouped.mostRecentKey]));
  }, [filter, grouped.mostRecentKey, isSearching]);

  const totals = useMemo(
    () => ({
      income: searchedTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
      expenses: searchedTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
      transfers: searchedTransactions
        .filter((transaction) => transaction.type === 'transfer')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
      debt: searchedTransactions
        .filter((transaction) => transaction.type === 'debt')
        .reduce((sum, transaction) => {
          // Lent money = asset (-), Borrowed = liability (+)
          const direction = transaction.debtDirection === 'lent' ? -1 : 1;
          return sum + Math.abs(transaction.amount) * direction;
        }, 0),
    }),
    [searchedTransactions]
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

  const toggleMonth = useCallback((monthKey: string) => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });

    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  }, []);

  const sections = useMemo<MonthSection[]>(() => {
    if (isSearching) {
      return [
        {
          key: 'results',
          title: 'Results',
          data: sortedTransactions,
          income: 0,
          expenses: 0,
          net: 0,
        },
      ];
    }

    return grouped.sections.map((section) => ({
      ...section,
      data: expandedMonths.has(section.key) ? section.data : [],
    }));
  }, [expandedMonths, grouped.sections, isSearching, sortedTransactions]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: MonthSection }) => {
      if (isSearching) {
        return null;
      }

      const isExpanded = expandedMonths.has(section.key);
      const netColor = section.net >= 0 ? theme.colors.success : theme.colors.error;
      const netPrefix = section.net >= 0 ? '+' : '-';

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleMonth(section.key)}
          style={[
            styles.sectionHeader,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.sectionTitleRow}>
            {isExpanded ? (
              <ChevronDown size={18} color={theme.colors.textSecondary} />
            ) : (
              <ChevronRight size={18} color={theme.colors.textSecondary} />
            )}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{section.title}</Text>
          </View>
          <View style={styles.sectionSummaryRow}>
            <Text style={[styles.sectionSummaryText, { color: theme.colors.success }]}>
              Income {formatCurrency(section.income)}
            </Text>
            <Text style={[styles.sectionSummaryText, { color: theme.colors.error }]}>
              Expenses {formatCurrency(section.expenses)}
            </Text>
            <Text style={[styles.sectionSummaryText, { color: netColor }]}>
              Net {netPrefix}
              {formatCurrency(Math.abs(section.net))}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [expandedMonths, formatCurrency, isSearching, theme.colors, toggleMonth]
  );

  const emptyTitle = isSearching ? 'No results found' : 'No transactions found';
  const emptyDescription = isSearching
    ? `We couldn't find any matches for "${searchQuery.trim()}".`
    : filter === 'all'
      ? 'Start adding transactions to see them here.'
      : `No ${filter} transactions are available right now.`;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <Search size={16} color={theme.colors.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search transactions"
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

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
                  },
                ]}
                onPress={() => setFilter(option.key)}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[styles.filterText, { color: isActive ? 'white' : theme.colors.textSecondary }]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryContainer}>
          <View
            style={[
              styles.summaryItem,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>{formatCurrency(totals.income)}</Text>
          </View>
          <View
            style={[
              styles.summaryItem,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>{formatCurrency(totals.expenses)}</Text>
          </View>
          <View
            style={[
              styles.summaryItem,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Transfers</Text>
            <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>{formatCurrency(totals.transfers)}</Text>
          </View>
          <View
            style={[
              styles.summaryItem,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Debt</Text>
            <Text style={[styles.summaryValue, styles.debtText]}>{formatCurrency(totals.debt)}</Text>
          </View>
        </View>
      </View>

      {isSearching ? (
        <View style={styles.resultsInfo}>
          <Text style={[styles.resultsText, { color: theme.colors.textSecondary }]}>
            {sortedTransactions.length} result{sortedTransactions.length === 1 ? '' : 's'} found
          </Text>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            showActions
            onEdit={() => setEditingTransaction(item)}
            onDelete={() => confirmDeleteTransaction(item)}
          />
        )}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={() => (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>{emptyTitle}</Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              {emptyDescription}
            </Text>
          </View>
        )}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
      />

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 6,
  },
  filterButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    flexWrap: 'wrap',
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
  debtText: {
    color: '#F59E0B',
  },
  resultsInfo: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  resultsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  sectionSummaryText: {
    fontSize: 12,
    fontWeight: '600',
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







