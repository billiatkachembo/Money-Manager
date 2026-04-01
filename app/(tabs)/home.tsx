import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {
  Plus,
  AlertTriangle,
  Zap,
  Sprout,
  ChevronRight,
  Activity,
  Shield,
  PiggyBank,
  Target,
  FileText,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronDown,
  Check,
  X,
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { TransactionItem } from '@/components/TransactionItem';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';
import { useTransactionStore } from '@/store/transaction-store';
import { useQuickActionsStore } from '@/store/quick-actions-store';
import { useTheme } from '@/store/theme-store';
import { useTabNavigationStore } from '@/store/tab-navigation-store';
import { getHealthScoreLabel, getHealthScoreColor } from '@/lib/health-score';
import { hasFarmActivity, getSeasonalFarmSummary } from '@/lib/farming';
import { Transaction, TransactionCategory } from '@/types/transaction';
import { ACCOUNT_TYPE_GROUPS, getAccountTypeDefinition } from '@/constants/account-types';
import { computeBudgetSpendingForDate, getActiveBudgets } from '@/src/domain/budgeting';
import { computeBehaviorMetrics } from '@/src/domain/analytics';
import { computeFinancialHealthMetrics, computeFinancialHealthScore } from '@/src/domain/financial-health';
import { getFromAccountId, getToAccountId } from '@/src/domain/ledger';
import { showAppTooltip } from '@/store/app-tooltip-store';
import * as Haptics from 'expo-haptics';
import { useI18n } from '@/src/i18n';

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: 14,
          backgroundColor: 'rgba(148,163,184,0.2)',
          opacity,
        },
        style,
      ]}
    />
  );
}

const HealthScoreRing = React.memo(function HealthScoreRing({
  score,
  size,
  strokeWidth,
}: {
  score: number;
  size: number;
  strokeWidth: number;
}) {
  const progress = Math.max(0, Math.min(score / 100, 1));
  const color = getHealthScoreColor(score);
  const label = getHealthScoreLabel(score);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [opacityAnim, scaleAnim, progress]);
  return (
    <Animated.View style={{ alignItems: 'center', opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: -strokeWidth,
            left: -strokeWidth,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: progress > 0.25 ? color : 'transparent',
            borderBottomColor: progress > 0.5 ? color : 'transparent',
            borderLeftColor: progress > 0.75 ? color : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }}
        />
        <Text style={{ fontSize: 18, fontWeight: '800' as const, color }}>{score}</Text>
      </View>
      <Text style={{ fontSize: 10, fontWeight: '600' as const, color, marginTop: 4, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </Animated.View>
  );
});

type MetricCardTarget = 'budget' | 'health' | 'goals' | 'savings';
type HomeFilterTab = 'income' | 'expense' | 'account';
type HomeAccountFilterScope = 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'debt';
const HOME_FILTER_TABS: Array<{ key: HomeFilterTab; label: string }> = [
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expenses' },
  { key: 'account', label: 'Account' },
];
const HOME_ACCOUNT_FILTER_SCOPES: Array<{ key: HomeAccountFilterScope; label: string }> = [
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expenses' },
  { key: 'transfer_in', label: 'Transfer In' },
  { key: 'transfer_out', label: 'Transfer Out' },
  { key: 'debt', label: 'Debt' },
];
function createInitialHomeAccountFilters(): Record<HomeAccountFilterScope, string[]> {
  return {
    income: [],
    expense: [],
    transfer_in: [],
    transfer_out: [],
    debt: [],
  };
}

const APP_SHORT_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatMonthYearLabel(date: Date): string {
  const monthLabel = APP_SHORT_MONTH_LABELS[date.getMonth()] ?? '';
  return monthLabel + ' ' + date.getFullYear();
}

type HomeCategorySection = {
  key: string;
  label: string;
  categories: TransactionCategory[];
};

type HomeSubcategoryFilterOption = {
  key: string;
  name: string;
  amount: number;
  transactionCount: number;
};

type HomeCategoryFilterOption = {
  category: TransactionCategory;
  categoryKey: string;
  amount: number;
  transactionCount: number;
  subcategories: HomeSubcategoryFilterOption[];
  visibleSubcategories: HomeSubcategoryFilterOption[];
};

function normalizeHomeSubcategoryValue(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

function makeHomeSubcategoryFilterKey(categoryKey: string, subcategory?: string | null): string | null {
  const normalizedSubcategory = normalizeHomeSubcategoryValue(subcategory);
  if (!categoryKey || !normalizedSubcategory) {
    return null;
  }

  return 'subcategory:' + categoryKey + ':' + normalizedSubcategory;
}

function buildHomeCategoryFilterOptions(
  transactions: Transaction[],
  type: 'income' | 'expense',
  availableCategories: TransactionCategory[] = []
): HomeCategoryFilterOption[] {
  const availableCategoryMap = new Map(
    availableCategories.map((category) => [getCategoryFilterKey(category), category] as const)
  );
  const categoryBuckets = new Map<
    string,
    {
      category: TransactionCategory;
      amount: number;
      transactionCount: number;
      subcategories: Map<string, HomeSubcategoryFilterOption>;
    }
  >();

  for (const transaction of transactions) {
    if (transaction.type !== type || !transaction.category) {
      continue;
    }

    const categoryKey = getCategoryFilterKey(transaction.category);
    const amount = Math.abs(transaction.amount);
    const existingCategory = categoryBuckets.get(categoryKey);

    if (existingCategory) {
      existingCategory.amount += amount;
      existingCategory.transactionCount += 1;
    } else {
      categoryBuckets.set(categoryKey, {
        category: transaction.category,
        amount,
        transactionCount: 1,
        subcategories: new Map(),
      });
    }

    const nextCategory = categoryBuckets.get(categoryKey);
    const subcategoryKey = makeHomeSubcategoryFilterKey(categoryKey, transaction.subcategory);
    const subcategoryName = transaction.subcategory?.trim();
    if (!nextCategory || !subcategoryKey || !subcategoryName) {
      continue;
    }

    const existingSubcategory = nextCategory.subcategories.get(subcategoryKey);
    if (existingSubcategory) {
      existingSubcategory.amount += amount;
      existingSubcategory.transactionCount += 1;
    } else {
      nextCategory.subcategories.set(subcategoryKey, {
        key: subcategoryKey,
        name: subcategoryName,
        amount,
        transactionCount: 1,
      });
    }
  }

  return Array.from(categoryBuckets.entries())
    .map(([categoryKey, entry]) => {
      const resolvedCategory = availableCategoryMap.get(categoryKey) ?? entry.category;
      const subcategories = Array.from(entry.subcategories.values()).sort((left, right) => {
        const amountDelta = right.amount - left.amount;
        if (amountDelta !== 0) {
          return amountDelta;
        }
        return left.name.localeCompare(right.name);
      });

      return {
        category: resolvedCategory,
        categoryKey,
        amount: entry.amount,
        transactionCount: entry.transactionCount,
        subcategories,
        visibleSubcategories: subcategories,
      };
    })
    .sort((left, right) => {
      const amountDelta = right.amount - left.amount;
      if (amountDelta !== 0) {
        return amountDelta;
      }
      return left.category.name.localeCompare(right.category.name);
    });
}

function doesTransactionMatchHomeCategoryFilters(
  transaction: Transaction,
  selectedFilterSet: ReadonlySet<string>
): boolean {
  if (selectedFilterSet.size === 0) {
    return true;
  }

  const categoryKey = getCategoryFilterKey(transaction.category);
  if (selectedFilterSet.has(categoryKey)) {
    return true;
  }

  const subcategoryKey = makeHomeSubcategoryFilterKey(categoryKey, transaction.subcategory);
  return subcategoryKey ? selectedFilterSet.has(subcategoryKey) : false;
}
function toMonthKey(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
function getCategoryFilterKey(category: Transaction['category'] | null | undefined): string {
  if (!category) {
    return 'uncategorized';
  }
  return category.id || category.name.trim().toLowerCase();
}
function getPercentValue(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0 || value <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}
function makeHomeAccountFilterToken(kind: 'account' | 'type', value: string): string {
  return kind + ':' + value;
}

function matchesHomeFilterQuery(query: string, ...values: Array<string | undefined | null>): boolean {
  if (!query) {
    return true;
  }
  return values.some((value) => value?.toLowerCase().includes(query));
}

export default function HomeScreen() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [preferredType, setPreferredType] = useState<'income' | 'expense' | 'transfer' | 'debt' | null>(null);
  const [activeMetricTooltip, setActiveMetricTooltip] = useState<MetricCardTarget | null>(null);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showHomeSearch, setShowHomeSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHomeFilterMenu, setShowHomeFilterMenu] = useState(false);
  const [homeFilterTab, setHomeFilterTab] = useState<HomeFilterTab>('income');
  const [homeAccountFilterScope, setHomeAccountFilterScope] = useState<HomeAccountFilterScope>('income');
  const [selectedIncomeFilterKeys, setSelectedIncomeFilterKeys] = useState<string[]>([]);
  const [selectedExpenseFilterKeys, setSelectedExpenseFilterKeys] = useState<string[]>([]);
  const [expandedIncomeFilterKeys, setExpandedIncomeFilterKeys] = useState<string[]>([]);
  const [expandedExpenseFilterKeys, setExpandedExpenseFilterKeys] = useState<string[]>([]);
  const [activeIncomeFilterSectionKey, setActiveIncomeFilterSectionKey] = useState('');
  const [activeExpenseFilterSectionKey, setActiveExpenseFilterSectionKey] = useState('');
  const [selectedAccountFilterTokens, setSelectedAccountFilterTokens] = useState<Record<HomeAccountFilterScope, string[]>>(
    () => createInitialHomeAccountFilters()
  );
  const [homeFilterQuery, setHomeFilterQuery] = useState('');
  const { theme } = useTheme();
  const { t } = useI18n();
  const fabScale = useRef(new Animated.Value(1)).current;
  const metricTooltipMessages: Record<MetricCardTarget, string> = {
    budget: t('home.metricTooltip.budget'),
    health: t('home.metricTooltip.health'),
    goals: t('home.metricTooltip.goals'),
    savings: t('home.metricTooltip.savings'),
  };

  const {
    transactions,
    accounts,
    financialGoals,
    netBalance,
    debtAccounts,
    getTotalIncome,
    getTotalExpenses,
    budgets,
    incomeCategories,
    expenseCategories,
    accountTypeDefinitions,
    formatCurrency,
    isLoaded,
    triggerReconciliation,
    deleteTransaction,
  } = useTransactionStore();
  const { openAddTransactionAt, consumeQuickAdd } = useQuickActionsStore();
  const openNotesComposer = useTabNavigationStore((state) => state.openNotesComposer);

  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const selectedMonthKey = useMemo(() => toMonthKey(selectedMonthDate), [selectedMonthDate]);
  const selectedMonthLabel = useMemo(() => formatMonthYearLabel(selectedMonthDate), [selectedMonthDate]);
  const isCurrentSelectedMonth = selectedMonthKey === currentMonthKey;
  const selectedMonthContextLabel = isCurrentSelectedMonth ? 'This month' : selectedMonthLabel;
  const monthlyIncome = getTotalIncome(selectedMonthKey);
  const monthlyExpenses = getTotalExpenses(selectedMonthKey);
  const monthlyCashFlow = monthlyIncome - monthlyExpenses;
  const remainingDebtBalance = useMemo(() => {
    const borrowedBalance = debtAccounts
      .filter((entry) => entry.direction === 'borrowed')
      .reduce((sum, entry) => sum + entry.balance, 0);
    const totalDebtPayments = transactions
      .filter((transaction) => transaction.debtPayment)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return Math.max(0, roundCurrency(borrowedBalance - totalDebtPayments));
  }, [debtAccounts, transactions]);
  const borrowedDebtCount = useMemo(
    () => debtAccounts.filter((entry) => entry.direction === 'borrowed').length,
    [debtAccounts]
  );
  const selectedMonthTransactions = useMemo(
    () => transactions.filter((transaction) => toMonthKey(transaction.date) === selectedMonthKey),
    [selectedMonthKey, transactions]
  );
  const selectedMonthBehavior = useMemo(
    () => computeBehaviorMetrics(transactions, budgets, accounts, selectedMonthDate),
    [accounts, budgets, selectedMonthDate, transactions]
  );
  const homeLiquidBalance = useMemo(
    () =>
      accounts
        .filter((account) => {
          if (account.isActive === false) {
            return false;
          }

          const group = getAccountTypeDefinition(account.type, accountTypeDefinitions).group;
          return group === 'cash_bank' || group === 'savings';
        })
        .reduce((sum, account) => sum + Math.max(0, account.balance), 0),
    [accounts]
  );
  const selectedMonthHealthMetrics = useMemo(
    () =>
      computeFinancialHealthMetrics({
        monthlyIncome: selectedMonthBehavior.monthly.map((entry) => entry.income),
        monthlyExpenses: selectedMonthBehavior.monthly.map((entry) => entry.expenses),
        budgetAdherence: selectedMonthBehavior.budget.adherence,
        liquidBalance: homeLiquidBalance,
      }),
    [homeLiquidBalance, selectedMonthBehavior]
  );
  const selectedMonthHealthScore = useMemo(
    () => computeFinancialHealthScore(selectedMonthHealthMetrics),
    [selectedMonthHealthMetrics]
  );
  const selectedMonthActiveBudgets = useMemo(
    () => getActiveBudgets(budgets, selectedMonthDate),
    [budgets, selectedMonthDate]
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const normalizedHomeFilterQuery = homeFilterQuery.trim().toLowerCase();
  const incomeCategoryFilterSet = useMemo(() => new Set(selectedIncomeFilterKeys), [selectedIncomeFilterKeys]);
  const expenseCategoryFilterSet = useMemo(() => new Set(selectedExpenseFilterKeys), [selectedExpenseFilterKeys]);
  const incomeCategoryMonthlyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of selectedMonthTransactions) {
      if (transaction.type !== 'income') {
        continue;
      }
      const key = getCategoryFilterKey(transaction.category);
      totals.set(key, (totals.get(key) ?? 0) + transaction.amount);
    }
    return totals;
  }, [selectedMonthTransactions]);
  const expenseCategoryMonthlyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of selectedMonthTransactions) {
      if (transaction.type !== 'expense') {
        continue;
      }
      const key = getCategoryFilterKey(transaction.category);
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(transaction.amount));
    }
    return totals;
  }, [selectedMonthTransactions]);
  const incomeFilterOptions = useMemo(
    () => buildHomeCategoryFilterOptions(selectedMonthTransactions, 'income', incomeCategories),
    [incomeCategories, selectedMonthTransactions]
  );
  const expenseFilterOptions = useMemo(
    () => buildHomeCategoryFilterOptions(selectedMonthTransactions, 'expense', expenseCategories),
    [expenseCategories, selectedMonthTransactions]
  );
  const homeVisibleAccounts = useMemo(() => accounts.filter((account) => account.isActive !== false), [accounts]);
  const homeAccountsById = useMemo(() => new Map(homeVisibleAccounts.map((account) => [account.id, account])), [homeVisibleAccounts]);
  const homeAccountFilterTokenSets = useMemo(
    () => ({
      income: new Set(selectedAccountFilterTokens.income),
      expense: new Set(selectedAccountFilterTokens.expense),
      transfer_in: new Set(selectedAccountFilterTokens.transfer_in),
      transfer_out: new Set(selectedAccountFilterTokens.transfer_out),
      debt: new Set(selectedAccountFilterTokens.debt),
    }),
    [selectedAccountFilterTokens]
  );
  const homeAccountSections = useMemo(
    () =>
      ACCOUNT_TYPE_GROUPS.map((group) => {
        const accountsInGroup = homeVisibleAccounts.filter(
          (account) => getAccountTypeDefinition(account.type, accountTypeDefinitions).group === group.key
        );
        const typeRows = accountTypeDefinitions.filter(
          (definition) =>
            definition.group === group.key && accountsInGroup.some((account) => account.type === definition.type)
        );

        return {
          key: group.key,
          label: group.label,
          typeRows,
          accounts: accountsInGroup,
        };
      }).filter((section) => section.typeRows.length > 0 || section.accounts.length > 0),
    [accountTypeDefinitions, homeVisibleAccounts]
  );
  const homeFilterScopeCounts = useMemo(
    () => ({
      income: selectedAccountFilterTokens.income.length,
      expense: selectedAccountFilterTokens.expense.length,
      transfer_in: selectedAccountFilterTokens.transfer_in.length,
      transfer_out: selectedAccountFilterTokens.transfer_out.length,
      debt: selectedAccountFilterTokens.debt.length,
    }),
    [selectedAccountFilterTokens]
  );
  const activeHomeAccountScopeLabel =
    HOME_ACCOUNT_FILTER_SCOPES.find((scope) => scope.key === homeAccountFilterScope)?.label ?? 'Accounts';
  const displayedIncomeFilterOptions = useMemo(
    () =>
      incomeFilterOptions
        .map((option) => {
          const categoryMatches = matchesHomeFilterQuery(normalizedHomeFilterQuery, option.category.name, option.category.icon);
          const matchingSubcategories = option.subcategories.filter((subcategory) =>
            matchesHomeFilterQuery(normalizedHomeFilterQuery, subcategory.name, option.category.name)
          );

          if (!categoryMatches && matchingSubcategories.length === 0) {
            return null;
          }

          return {
            ...option,
            visibleSubcategories: normalizedHomeFilterQuery && !categoryMatches ? matchingSubcategories : option.subcategories,
          };
        })
        .filter((option): option is HomeCategoryFilterOption => !!option)
        .sort((left, right) => {
          const leftSelected =
            selectedIncomeFilterKeys.includes(left.categoryKey) ||
            left.subcategories.some((subcategory) => selectedIncomeFilterKeys.includes(subcategory.key));
          const rightSelected =
            selectedIncomeFilterKeys.includes(right.categoryKey) ||
            right.subcategories.some((subcategory) => selectedIncomeFilterKeys.includes(subcategory.key));
          if (leftSelected !== rightSelected) {
            return leftSelected ? -1 : 1;
          }
          return left.category.name.localeCompare(right.category.name);
        }),
    [incomeFilterOptions, normalizedHomeFilterQuery, selectedIncomeFilterKeys]
  );
  const displayedExpenseFilterOptions = useMemo(
    () =>
      expenseFilterOptions
        .map((option) => {
          const categoryMatches = matchesHomeFilterQuery(normalizedHomeFilterQuery, option.category.name, option.category.icon);
          const matchingSubcategories = option.subcategories.filter((subcategory) =>
            matchesHomeFilterQuery(normalizedHomeFilterQuery, subcategory.name, option.category.name)
          );

          if (!categoryMatches && matchingSubcategories.length === 0) {
            return null;
          }

          return {
            ...option,
            visibleSubcategories: normalizedHomeFilterQuery && !categoryMatches ? matchingSubcategories : option.subcategories,
          };
        })
        .filter((option): option is HomeCategoryFilterOption => !!option)
        .sort((left, right) => {
          const leftSelected =
            selectedExpenseFilterKeys.includes(left.categoryKey) ||
            left.subcategories.some((subcategory) => selectedExpenseFilterKeys.includes(subcategory.key));
          const rightSelected =
            selectedExpenseFilterKeys.includes(right.categoryKey) ||
            right.subcategories.some((subcategory) => selectedExpenseFilterKeys.includes(subcategory.key));
          if (leftSelected !== rightSelected) {
            return leftSelected ? -1 : 1;
          }
          return left.category.name.localeCompare(right.category.name);
        }),
    [expenseFilterOptions, normalizedHomeFilterQuery, selectedExpenseFilterKeys]
  );
  useEffect(() => {
    const availableKeys = new Set(
      incomeFilterOptions.flatMap((option) => [option.categoryKey, ...option.subcategories.map((subcategory) => subcategory.key)])
    );
    const availableCategoryKeys = new Set(incomeFilterOptions.map((option) => option.categoryKey));
    setSelectedIncomeFilterKeys((current) => current.filter((key) => availableKeys.has(key)));
    setExpandedIncomeFilterKeys((current) => current.filter((key) => availableCategoryKeys.has(key)));
  }, [incomeFilterOptions]);

  useEffect(() => {
    const availableKeys = new Set(
      expenseFilterOptions.flatMap((option) => [option.categoryKey, ...option.subcategories.map((subcategory) => subcategory.key)])
    );
    const availableCategoryKeys = new Set(expenseFilterOptions.map((option) => option.categoryKey));
    setSelectedExpenseFilterKeys((current) => current.filter((key) => availableKeys.has(key)));
    setExpandedExpenseFilterKeys((current) => current.filter((key) => availableCategoryKeys.has(key)));
  }, [expenseFilterOptions]);

  const visibleHomeAccountSections = useMemo(() => {
    const selectedTokens = homeAccountFilterTokenSets[homeAccountFilterScope];

    return homeAccountSections
      .map((section) => {
        const typeRows = [...section.typeRows]
          .filter((definition) =>
            matchesHomeFilterQuery(normalizedHomeFilterQuery, definition.label, definition.type, section.label)
          )
          .sort((left, right) => {
            const leftSelected = selectedTokens.has(makeHomeAccountFilterToken('type', left.type));
            const rightSelected = selectedTokens.has(makeHomeAccountFilterToken('type', right.type));
            if (leftSelected !== rightSelected) {
              return leftSelected ? -1 : 1;
            }
            return left.label.localeCompare(right.label);
          });

        const accounts = [...section.accounts]
          .filter((account) => {
            const definition = getAccountTypeDefinition(account.type, accountTypeDefinitions);
            return matchesHomeFilterQuery(
              normalizedHomeFilterQuery,
              account.name,
              account.type,
              definition.label,
              section.label
            );
          })
          .sort((left, right) => {
            const leftSelected = selectedTokens.has(makeHomeAccountFilterToken('account', left.id));
            const rightSelected = selectedTokens.has(makeHomeAccountFilterToken('account', right.id));
            if (leftSelected !== rightSelected) {
              return leftSelected ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
          });

        return {
          ...section,
          typeRows,
          accounts,
        };
      })
      .filter((section) => section.typeRows.length > 0 || section.accounts.length > 0);
  }, [
    accountTypeDefinitions,
    homeAccountFilterScope,
    homeAccountFilterTokenSets,
    homeAccountSections,
    normalizedHomeFilterQuery,
  ]);
  const appliedHomeFilterCount = useMemo(
    () =>
      selectedIncomeFilterKeys.length +
      selectedExpenseFilterKeys.length +
      Object.values(selectedAccountFilterTokens).reduce((sum, items) => sum + items.length, 0),
    [selectedAccountFilterTokens, selectedExpenseFilterKeys.length, selectedIncomeFilterKeys.length]
  );
  const hasActiveHomeFilters = appliedHomeFilterCount > 0;
  const doesAccountMatchScope = useCallback(
    (scope: HomeAccountFilterScope, accountId?: string) => {
      const scopeTokens = homeAccountFilterTokenSets[scope];
      if (scopeTokens.size === 0) {
        return true;
      }
      if (!accountId) {
        return false;
      }
      const account = homeAccountsById.get(accountId);
      if (!account) {
        return false;
      }
      return (
        scopeTokens.has(makeHomeAccountFilterToken('account', account.id)) ||
        scopeTokens.has(makeHomeAccountFilterToken('type', account.type))
      );
    },
    [homeAccountFilterTokenSets, homeAccountsById]
  );
  const doesTransactionMatchHomeFilters = useCallback(
    (transaction: Transaction) => {
      if (
        transaction.type === 'income' &&
        !doesTransactionMatchHomeCategoryFilters(transaction, incomeCategoryFilterSet)
      ) {
        return false;
      }
      if (
        transaction.type === 'expense' &&
        !doesTransactionMatchHomeCategoryFilters(transaction, expenseCategoryFilterSet)
      ) {
        return false;
      }
      if (transaction.type === 'income') {
        return doesAccountMatchScope('income', getToAccountId(transaction));
      }
      if (transaction.type === 'expense') {
        return doesAccountMatchScope('expense', getFromAccountId(transaction));
      }
      if (transaction.type === 'transfer') {
        const hasIncomingScope = homeAccountFilterTokenSets.transfer_in.size > 0;
        const hasOutgoingScope = homeAccountFilterTokenSets.transfer_out.size > 0;
        if (!hasIncomingScope && !hasOutgoingScope) {
          return true;
        }
        const incomingMatch = !hasIncomingScope || doesAccountMatchScope('transfer_in', getToAccountId(transaction));
        const outgoingMatch = !hasOutgoingScope || doesAccountMatchScope('transfer_out', getFromAccountId(transaction));
        return incomingMatch && outgoingMatch;
      }
      if (transaction.type === 'debt') {
        if (homeAccountFilterTokenSets.debt.size === 0) {
          return true;
        }
        return (
          doesAccountMatchScope('debt', getFromAccountId(transaction)) ||
          doesAccountMatchScope('debt', getToAccountId(transaction))
        );
      }
      return true;
    },
    [
      doesAccountMatchScope,
      expenseCategoryFilterSet,
      homeAccountFilterTokenSets.debt.size,
      homeAccountFilterTokenSets.transfer_in.size,
      homeAccountFilterTokenSets.transfer_out.size,
      incomeCategoryFilterSet,
    ]
  );
  const doesTransactionMatchSearchQuery = useCallback(
    (transaction: Transaction) => {
      if (!normalizedSearchQuery) {
        return false;
      }

      const fromAccountName = homeAccountsById.get(getFromAccountId(transaction) ?? '')?.name ?? transaction.fromAccount;
      const toAccountName = homeAccountsById.get(getToAccountId(transaction) ?? '')?.name ?? transaction.toAccount;
      const amountLabel = formatCurrency(Math.abs(transaction.amount));
      const rawAmountLabel = String(transaction.amount);
      const categoryWithSubcategory = transaction.subcategory
        ? transaction.category?.name + ' ' + transaction.subcategory
        : transaction.category?.name;
      const transactionTypeLabel = transaction.type === 'debt'
        ? transaction.debtDirection === 'lent'
          ? 'lent debt'
          : 'borrowed debt'
        : transaction.type;
      const debtPaymentLabel = transaction.debtPayment ? 'debt payment debt clearing installment' : '';

      const searchFields = [
        transaction.description,
        transaction.note,
        transaction.merchant,
        transaction.counterparty,
        transaction.category?.name,
        transaction.category?.id,
        transaction.subcategory,
        categoryWithSubcategory,
        fromAccountName,
        toAccountName,
        transactionTypeLabel,
        debtPaymentLabel,
        amountLabel,
        rawAmountLabel,
        String(Math.abs(transaction.amount)),
        String(transaction.id),
        transaction.date.toISOString(),
      ];

      return searchFields.some((value) => String(value ?? '').toLowerCase().includes(normalizedSearchQuery));
    },
    [formatCurrency, homeAccountsById, normalizedSearchQuery]
  );
  const recentTransactions = useMemo(() => {
    return [...selectedMonthTransactions]
      .filter((transaction) => doesTransactionMatchHomeFilters(transaction))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 7);
  }, [doesTransactionMatchHomeFilters, selectedMonthTransactions]);
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    return [...transactions]
      .filter((transaction) => doesTransactionMatchHomeFilters(transaction))
      .filter((transaction) => doesTransactionMatchSearchQuery(transaction))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 50);
  }, [doesTransactionMatchHomeFilters, doesTransactionMatchSearchQuery, normalizedSearchQuery, transactions]);
  const activityTransactions = showHomeSearch ? searchResults : recentTransactions;
  const homeFilterSelectionSummary = useMemo(() => {
    const hasIncomeSelection = selectedIncomeFilterKeys.length > 0 || selectedAccountFilterTokens.income.length > 0;
    const hasExpenseSelection = selectedExpenseFilterKeys.length > 0 || selectedAccountFilterTokens.expense.length > 0;
    const hasTransferSelection = selectedAccountFilterTokens.transfer_in.length > 0 || selectedAccountFilterTokens.transfer_out.length > 0;
    const hasDebtSelection = selectedAccountFilterTokens.debt.length > 0;
    let incomeAmount = 0;
    let expenseAmount = 0;
    let totalAmount = 0;
    for (const transaction of selectedMonthTransactions) {
      const absoluteAmount = Math.abs(transaction.amount);
      if (transaction.type === 'income' && hasIncomeSelection) {
        const matchesCategory = doesTransactionMatchHomeCategoryFilters(transaction, incomeCategoryFilterSet);
        const matchesAccount = doesAccountMatchScope('income', getToAccountId(transaction));
        if (matchesCategory && matchesAccount) {
          incomeAmount += transaction.amount;
          totalAmount += absoluteAmount;
        }
        continue;
      }
      if (transaction.type === 'expense' && hasExpenseSelection) {
        const matchesCategory = doesTransactionMatchHomeCategoryFilters(transaction, expenseCategoryFilterSet);
        const matchesAccount = doesAccountMatchScope('expense', getFromAccountId(transaction));
        if (matchesCategory && matchesAccount) {
          expenseAmount += absoluteAmount;
          totalAmount += absoluteAmount;
        }
        continue;
      }
      if (transaction.type === 'transfer' && hasTransferSelection) {
        const hasIncomingScope = selectedAccountFilterTokens.transfer_in.length > 0;
        const hasOutgoingScope = selectedAccountFilterTokens.transfer_out.length > 0;
        const incomingMatch = !hasIncomingScope || doesAccountMatchScope('transfer_in', getToAccountId(transaction));
        const outgoingMatch = !hasOutgoingScope || doesAccountMatchScope('transfer_out', getFromAccountId(transaction));
        if (incomingMatch && outgoingMatch) {
          totalAmount += absoluteAmount;
        }
        continue;
      }
      if (transaction.type === 'debt' && hasDebtSelection) {
        const debtMatch =
          doesAccountMatchScope('debt', getFromAccountId(transaction)) ||
          doesAccountMatchScope('debt', getToAccountId(transaction));
        if (debtMatch) {
          totalAmount += absoluteAmount;
        }
      }
    }
    return {
      incomeAmount,
      expenseAmount,
      totalAmount,
      incomePercent: getPercentValue(incomeAmount, monthlyIncome),
      expensePercent: getPercentValue(expenseAmount, monthlyExpenses),
    };
  }, [
    doesAccountMatchScope,
    doesTransactionMatchHomeCategoryFilters,
    expenseCategoryFilterSet,
    incomeCategoryFilterSet,
    monthlyExpenses,
    monthlyIncome,
    selectedAccountFilterTokens,
    selectedExpenseFilterKeys.length,
    selectedIncomeFilterKeys.length,
    selectedMonthTransactions,
  ]);
  const homeFilterContextLabel = useMemo(() => {
    const tags: string[] = [];
    if (hasActiveHomeFilters) {
      tags.push(appliedHomeFilterCount + ' filters');
    }
    if (normalizedSearchQuery) {
      tags.push('Search');
    }
    if (normalizedSearchQuery && tags.length === 1) {
      return 'Search results across all activity';
    }
    if (normalizedSearchQuery && hasActiveHomeFilters) {
      return 'Search + filters across all activity';
    }
    if (tags.length === 0) {
      return selectedMonthLabel + ' snapshot';
    }
    return selectedMonthLabel + ' | ' + tags.join(' + ');
  }, [appliedHomeFilterCount, hasActiveHomeFilters, normalizedSearchQuery, selectedMonthLabel]);
  const incomeSectionSelectedCount = selectedIncomeFilterKeys.length + selectedAccountFilterTokens.income.length;
  const expenseSectionSelectedCount = selectedExpenseFilterKeys.length + selectedAccountFilterTokens.expense.length;
  const homeFilterTabCounts = useMemo(
    () => ({
      income: incomeSectionSelectedCount,
      expense: expenseSectionSelectedCount,
      account: Object.values(homeFilterScopeCounts).reduce((sum, count) => sum + count, 0),
    }),
    [expenseSectionSelectedCount, homeFilterScopeCounts, incomeSectionSelectedCount]
  );
  const homeFilterResultCount = useMemo(
    () => {
      if (homeFilterTab === 'income') {
        return displayedIncomeFilterOptions.reduce((sum, option) => sum + 1 + option.visibleSubcategories.length, 0);
      }
      if (homeFilterTab === 'expense') {
        return displayedExpenseFilterOptions.reduce((sum, option) => sum + 1 + option.visibleSubcategories.length, 0);
      }
      return visibleHomeAccountSections.reduce(
        (sum, section) => sum + section.typeRows.length + section.accounts.length,
        0
      );
    },
    [displayedExpenseFilterOptions.length, displayedIncomeFilterOptions.length, homeFilterTab, visibleHomeAccountSections]
  );
  const homeFilterSearchPlaceholder =
    homeFilterTab === 'income'
      ? 'Search income categories'
      : homeFilterTab === 'expense'
        ? 'Search expense categories'
        : 'Search accounts or account types';
  const homeFilterResultLabel = homeFilterResultCount === 1 ? '1 option' : homeFilterResultCount + ' options';
  const homeFilterStatusText =
    selectedMonthContextLabel +
    ' | ' +
    homeFilterResultLabel +
    (normalizedSearchQuery ? ' | Feed search on' : '') +
    (normalizedHomeFilterQuery ? ' | Filter search on' : '');
  const homeFilterEmptyTitle =
    homeFilterTab === 'account'
      ? 'No account filters found'
      : homeFilterTab === 'income'
        ? 'No income filters found'
        : 'No expense filters found';
  const homeFilterEmptyDescription =
    homeFilterTab === 'account'
      ? normalizedHomeFilterQuery
        ? 'Try a different account or account type name for ' + activeHomeAccountScopeLabel + '.'
        : 'Create accounts first to filter home activity by account.'
      : normalizedHomeFilterQuery
        ? 'Try a different category name or clear the filter search.'
        : 'Nothing matches this filter section yet.';
  const isIncomeSectionClear = incomeSectionSelectedCount === 0;
  const isExpenseSectionClear = expenseSectionSelectedCount === 0;
  const isCurrentAccountScopeClear = homeFilterScopeCounts[homeAccountFilterScope] === 0;

  const topSpending = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; amount: number }>();

    for (const transaction of selectedMonthTransactions) {
      if (transaction.type !== 'expense') continue;

      const category = transaction.category;
      const key = category?.id ?? category?.name ?? 'uncategorized';
      const entry = totals.get(key);
      const amount = Math.abs(transaction.amount);
      const name = category?.name ?? 'Uncategorized';
      const color = category?.color ?? 'rgba(148,163,184,0.6)';

      if (entry) {
        entry.amount += amount;
      } else {
        totals.set(key, { name, color, amount });
      }
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [selectedMonthTransactions]);
  const savingsAccounts = useMemo(
    () => accounts.filter((account) => account.isActive && account.type === 'savings'),
    [accounts]
  );

  const totalSavings = useMemo(
    () => savingsAccounts.reduce((sum, account) => sum + account.balance, 0),
    [savingsAccounts]
  );

  const goalSummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const trackedGoals = financialGoals.filter(
      (goal) => Number.isFinite(goal.targetAmount) && goal.targetAmount > 0
    );
    const activeGoals = trackedGoals.filter((goal) => goal.currentAmount < goal.targetAmount);
    const completedCount = trackedGoals.length - activeGoals.length;
    const overdueCount = activeGoals.filter((goal) => {
      const targetDate = new Date(goal.targetDate);
      targetDate.setHours(0, 0, 0, 0);
      return targetDate.getTime() < today.getTime();
    }).length;

    return {
      total: trackedGoals.length,
      activeCount: activeGoals.length,
      completedCount,
      overdueCount,
    };
  }, [financialGoals]);

  const budgetRisk = useMemo(() => {
    if (selectedMonthActiveBudgets.length === 0) return null;

    let overCount = 0;
    let nearCount = 0;

    for (const budget of selectedMonthActiveBudgets) {
      const spent = computeBudgetSpendingForDate(budget, transactions, selectedMonthDate);
      const pct = budget.amount > 0 ? spent / budget.amount : 0;
      if (pct >= 1) overCount++;
      else if (pct >= 0.8) nearCount++;
    }

    return { overCount, nearCount, total: selectedMonthActiveBudgets.length };
  }, [selectedMonthActiveBudgets, selectedMonthDate, transactions]);

  const hasHealthData = useMemo(
    () =>
      selectedMonthBehavior.monthly.some(
        (entry) => entry.income > 0 || entry.expenses > 0 || entry.transfers > 0
      ) || selectedMonthActiveBudgets.length > 0,
    [selectedMonthActiveBudgets.length, selectedMonthBehavior]
  );

  const showFarm = useMemo(() => hasFarmActivity(transactions), [transactions]);

  const farmSummary = useMemo(() => {
    if (!showFarm) return null;
    return getSeasonalFarmSummary(transactions);
  }, [transactions, showFarm]);

  const confirmDeleteTransaction = useCallback((transaction: Transaction) => {
    Alert.alert('Delete transaction', `Delete "${transaction.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTransaction(transaction.id),
      },
    ]);
  }, [deleteTransaction]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerReconciliation();
    setTimeout(() => setRefreshing(false), 600);
  }, [triggerReconciliation]);

  const onFabPressIn = useCallback(() => {
    Animated.spring(fabScale, { toValue: 0.88, useNativeDriver: true, friction: 6 }).start();
  }, [fabScale]);
  const onFabPressOut = useCallback(() => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [fabScale]);

  const shiftSelectedMonth = useCallback((offset: number) => {
    setSelectedMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }, []);
  const handleAddFabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQuickAddMenu((current) => !current);
  }, []);
  const handleAddTransactionPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowQuickAddMenu(false);
    setPreferredType(null);
    setShowAddModal(true);
  }, []);
  const handleAddNotePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQuickAddMenu(false);
    openNotesComposer();
  }, [openNotesComposer]);
  const handleMetricPress = useCallback((target: MetricCardTarget) => {
    setActiveMetricTooltip((current) => (current === target ? null : target));
  }, []);
  const handleMonthChange = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowMonthPicker(false);
    if (!selectedDate) {
      return;
    }
    setSelectedMonthDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, []);
  const handleSearchToggle = useCallback(() => {
    setShowQuickAddMenu(false);
    setShowHomeFilterMenu(false);
    setShowHomeSearch((current) => {
      if (current) {
        setSearchQuery('');
      }
      return !current;
    });
  }, []);
  const handleFilterToggle = useCallback(() => {
    setShowQuickAddMenu(false);
    setShowHomeFilterMenu((current) => {
      if (current) {
        setHomeFilterQuery('');
      }
      return !current;
    });
  }, []);
  const handleCloseHomeFilter = useCallback(() => {
    setHomeFilterQuery('');
    setShowHomeFilterMenu(false);
  }, []);
  const handleClearHomeFilters = useCallback(() => {
    setSelectedIncomeFilterKeys([]);
    setSelectedExpenseFilterKeys([]);
    setSelectedAccountFilterTokens(createInitialHomeAccountFilters());
    setHomeFilterQuery('');
    showAppTooltip({ message: 'Home filters cleared', tone: 'info' });
  }, []);
  const handleClearIncomeSectionFilters = useCallback(() => {
    setSelectedIncomeFilterKeys([]);
    setSelectedAccountFilterTokens((current) => ({
      ...current,
      income: [],
    }));
  }, []);
  const handleClearExpenseSectionFilters = useCallback(() => {
    setSelectedExpenseFilterKeys([]);
    setSelectedAccountFilterTokens((current) => ({
      ...current,
      expense: [],
    }));
  }, []);
  const handleToggleIncomeFilter = useCallback(
    (key: string, config?: { categoryKey?: string; subcategoryKeys?: string[] }) => {
      setSelectedIncomeFilterKeys((current) => {
        const next = new Set(current);
        const targetCategoryKey = config?.categoryKey ?? key;
        const relatedSubcategoryKeys = config?.subcategoryKeys ?? [];
        const isParentCategoryToggle = relatedSubcategoryKeys.length > 0 && targetCategoryKey === key;

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        if (isParentCategoryToggle) {
          relatedSubcategoryKeys.forEach((subcategoryKey) => next.delete(subcategoryKey));
        } else if (config?.categoryKey && config.categoryKey !== key) {
          next.delete(config.categoryKey);
        }

        return Array.from(next);
      });
    },
    []
  );
  const handleToggleExpenseFilter = useCallback(
    (key: string, config?: { categoryKey?: string; subcategoryKeys?: string[] }) => {
      setSelectedExpenseFilterKeys((current) => {
        const next = new Set(current);
        const targetCategoryKey = config?.categoryKey ?? key;
        const relatedSubcategoryKeys = config?.subcategoryKeys ?? [];
        const isParentCategoryToggle = relatedSubcategoryKeys.length > 0 && targetCategoryKey === key;

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        if (isParentCategoryToggle) {
          relatedSubcategoryKeys.forEach((subcategoryKey) => next.delete(subcategoryKey));
        } else if (config?.categoryKey && config.categoryKey !== key) {
          next.delete(config.categoryKey);
        }

        return Array.from(next);
      });
    },
    []
  );
  const handleToggleIncomeFilterExpansion = useCallback((categoryKey: string) => {
    setExpandedIncomeFilterKeys((current) =>
      current.includes(categoryKey) ? current.filter((value) => value !== categoryKey) : [...current, categoryKey]
    );
  }, []);
  const handleToggleExpenseFilterExpansion = useCallback((categoryKey: string) => {
    setExpandedExpenseFilterKeys((current) =>
      current.includes(categoryKey) ? current.filter((value) => value !== categoryKey) : [...current, categoryKey]
    );
  }, []);
  const handleToggleHomeAccountFilter = useCallback((scope: HomeAccountFilterScope, token: string) => {
    setSelectedAccountFilterTokens((current) => ({
      ...current,
      [scope]: current[scope].includes(token)
        ? current[scope].filter((value) => value !== token)
        : [...current[scope], token],
    }));
  }, []);
  const handleClearHomeAccountScope = useCallback((scope: HomeAccountFilterScope) => {
    setSelectedAccountFilterTokens((current) => ({
      ...current,
      [scope]: [],
    }));
  }, []);

  useEffect(() => {
    if (!activeMetricTooltip) {
      return;
    }

    const timeout = setTimeout(() => {
      setActiveMetricTooltip(null);
    }, 2400);

    return () => clearTimeout(timeout);
  }, [activeMetricTooltip]);


  const isDark = theme.isDark;
  const metricTooltipBackground = isDark ? '#0F172A' : '#1F2937';
  const homeFilterPalette = useMemo(
    () => ({
      modalBackground: theme.colors.background,
      headerBackground: theme.colors.surface,
      sectionBackground: theme.colors.surface,
      promptBackground: theme.colors.primary + (isDark ? '22' : '12'),
      incomeBackground: theme.colors.info + (isDark ? '16' : '10'),
      expenseBackground: theme.colors.error + (isDark ? '14' : '0F'),
      totalBackground: isDark ? theme.colors.card : theme.colors.surface,
      checkboxBorder: isDark ? 'rgba(179, 179, 179, 0.32)' : 'rgba(102, 102, 102, 0.2)',
    }),
    [
      isDark,
      theme.colors.background,
      theme.colors.card,
      theme.colors.error,
      theme.colors.info,
      theme.colors.primary,
      theme.colors.surface,
    ]
  );
  const renderHomeCategoryFilterOption = useCallback(
    (option: HomeCategoryFilterOption, type: 'income' | 'expense') => {
      const selectedKeys = type === 'income' ? selectedIncomeFilterKeys : selectedExpenseFilterKeys;
      const expandedKeys = type === 'income' ? expandedIncomeFilterKeys : expandedExpenseFilterKeys;
      const handleToggleFilter = type === 'income' ? handleToggleIncomeFilter : handleToggleExpenseFilter;
      const handleToggleExpansion =
        type === 'income' ? handleToggleIncomeFilterExpansion : handleToggleExpenseFilterExpansion;
      const hasVisibleSubcategories = option.visibleSubcategories.length > 0;
      const isCategorySelected = selectedKeys.includes(option.categoryKey);
      const selectedSubcategoryCount = option.subcategories.filter((subcategory) => selectedKeys.includes(subcategory.key)).length;
      const isExpanded =
        expandedKeys.includes(option.categoryKey) ||
        option.visibleSubcategories.some((subcategory) => selectedKeys.includes(subcategory.key)) ||
        (!!normalizedHomeFilterQuery && hasVisibleSubcategories);
      const isCategoryActive = isCategorySelected || selectedSubcategoryCount > 0;
      const categoryColor = option.category.color || theme.colors.primary;
      const categoryMetaLabel =
        selectedSubcategoryCount > 0
          ? selectedSubcategoryCount + ' selected'
          : hasVisibleSubcategories
            ? option.visibleSubcategories.length + ' subcategories'
            : option.transactionCount + ' transactions';
      const categoryRowBackground = isCategoryActive ? theme.colors.primary + (isDark ? '12' : '08') : 'transparent';
      const handleToggleCategorySelection = () =>
        handleToggleFilter(option.categoryKey, {
          subcategoryKeys: option.subcategories.map((subcategory) => subcategory.key),
        });
      const handleCategoryPress = hasVisibleSubcategories
        ? () => handleToggleExpansion(option.categoryKey)
        : handleToggleCategorySelection;

      return (
        <View key={option.categoryKey} style={styles.homeFilterDropdownGroup}>
          <View style={styles.homeFilterCategoryRow}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.homeFilterCategoryCheckboxButton,
                { borderBottomColor: theme.colors.border },
                hasVisibleSubcategories && isExpanded && styles.homeFilterCategoryButtonOpen,
                { backgroundColor: categoryRowBackground },
              ]}
              onPress={handleToggleCategorySelection}
            >
              <View
                style={[
                  styles.homeFilterCheckbox,
                  {
                    borderColor: homeFilterPalette.checkboxBorder,
                    backgroundColor: homeFilterPalette.sectionBackground,
                  },
                  isCategorySelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
              >
                {isCategorySelected ? <Check size={13} color="#FFFFFF" /> : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.homeFilterCategoryButton,
                { borderBottomColor: theme.colors.border },
                hasVisibleSubcategories && isExpanded && styles.homeFilterCategoryButtonOpen,
                { backgroundColor: categoryRowBackground },
              ]}
              onPress={handleCategoryPress}
            >
              <View style={[styles.homeFilterCategorySwatch, { backgroundColor: categoryColor }]} />
              <View style={styles.homeFilterCategoryContent}>
                <Text style={[styles.homeFilterRowText, { color: theme.colors.text }]} numberOfLines={1}>
                  {option.category.name}
                </Text>
                <Text style={[styles.homeFilterCategoryMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {categoryMetaLabel}
                </Text>
              </View>
              <AdaptiveAmountText
                style={[
                  styles.homeFilterRowAmount,
                  { color: isCategoryActive ? theme.colors.primary : theme.colors.textSecondary },
                ]}
                minFontSize={10}
                value={formatCurrency(option.amount)}
              />
              {hasVisibleSubcategories ? (
                <ChevronDown
                  size={16}
                  color={theme.colors.textSecondary}
                  style={isExpanded ? styles.homeFilterExpandIconOpen : undefined}
                />
              ) : null}
            </TouchableOpacity>
          </View>

          {hasVisibleSubcategories && isExpanded ? (
            <View style={styles.homeFilterSubcategoryList}>
              {option.visibleSubcategories.map((subcategory) => {
                const isSubcategorySelected = selectedKeys.includes(subcategory.key);
                return (
                  <TouchableOpacity
                    key={subcategory.key}
                    accessibilityRole="button"
                    style={[
                      styles.homeFilterSubcategoryRow,
                      { borderTopColor: theme.colors.border },
                      isSubcategorySelected && { backgroundColor: theme.colors.primary + (isDark ? '10' : '06') },
                    ]}
                    onPress={() =>
                      handleToggleFilter(subcategory.key, {
                        categoryKey: option.categoryKey,
                      })
                    }
                  >
                    <View
                      style={[
                        styles.homeFilterCheckbox,
                        {
                          borderColor: homeFilterPalette.checkboxBorder,
                          backgroundColor: homeFilterPalette.sectionBackground,
                        },
                        isSubcategorySelected && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                    >
                      {isSubcategorySelected ? <Check size={13} color="#FFFFFF" /> : null}
                    </View>
                    <View style={[styles.homeFilterSubcategoryDot, { backgroundColor: categoryColor }]} />
                    <Text style={[styles.homeFilterSubcategoryText, { color: theme.colors.text }]} numberOfLines={1}>
                      {subcategory.name}
                    </Text>
                    <AdaptiveAmountText
                      style={[
                        styles.homeFilterSubcategoryAmount,
                        { color: isSubcategorySelected ? theme.colors.primary : theme.colors.textSecondary },
                      ]}
                      minFontSize={10}
                      value={formatCurrency(subcategory.amount)}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      );
    },
    [
      expandedExpenseFilterKeys,
      expandedIncomeFilterKeys,
      formatCurrency,
      handleToggleExpenseFilter,
      handleToggleExpenseFilterExpansion,
      handleToggleIncomeFilter,
      handleToggleIncomeFilterExpansion,
      homeFilterPalette.checkboxBorder,
      homeFilterPalette.sectionBackground,
      isDark,
      normalizedHomeFilterQuery,
      selectedExpenseFilterKeys,
      selectedIncomeFilterKeys,
      theme.colors.border,
      theme.colors.primary,
      theme.colors.text,
      theme.colors.textSecondary,
    ]
  );

  const transactionEmptyState = useMemo(() => {
    if (selectedMonthTransactions.length === 0) {
      return {
        title: 'No transactions in ' + selectedMonthLabel,
        description: 'Use the Add button below to track activity for this month.',
      };
    }
    if (hasActiveHomeFilters) {
      return {
        title: 'No matching transactions',
        description: 'Try a different filter combination or clear the current filter section.',
      };
    }
    return {
      title: 'Nothing new yet',
      description: 'Transactions for ' + selectedMonthLabel + ' will appear here as you add them.',
    };
  }, [hasActiveHomeFilters, selectedMonthLabel, selectedMonthTransactions.length]);
  const searchEmptyState = useMemo(() => {
    if (!normalizedSearchQuery) {
      return {
        title: 'Search all activity',
        description: 'Start typing to see matching transactions instantly across all activity.',
      };
    }

    return {
      title: 'No search results',
      description: 'Try a different word, account name, category, note, or amount.',
    };
  }, [normalizedSearchQuery]);
  const activityEmptyState = showHomeSearch ? searchEmptyState : transactionEmptyState;
  const activityEyebrow = showHomeSearch ? 'Live Search' : 'Home Feed';
  const activityTitle = showHomeSearch ? 'Search Results' : 'Recent Activity';
  const activitySubtitle = showHomeSearch
    ? normalizedSearchQuery
      ? hasActiveHomeFilters
        ? 'Results update as you type across all activity with your current filters.'
        : 'Results update as you type across all activity.'
      : 'Start typing to search by category, subcategory, account, note, merchant, or amount.'
    : homeFilterContextLabel;
  const activityCountLabel = showHomeSearch ? 'results' : 'items';

  const recentActivitySummary = useMemo(() => {
    const counts = activityTransactions.reduce(
      (summary, transaction) => {
        summary[transaction.type] += 1;
        return summary;
      },
      {
        income: 0,
        expense: 0,
        transfer: 0,
        debt: 0,
      } as Record<'income' | 'expense' | 'transfer' | 'debt', number>
    );

    return [
      { label: 'Shown', value: `${activityTransactions.length}`, tone: 'neutral' as const },
      counts.expense > 0 ? { label: 'Expenses', value: `${counts.expense}`, tone: 'negative' as const } : null,
      counts.income > 0 ? { label: 'Income', value: `${counts.income}`, tone: 'positive' as const } : null,
      counts.debt > 0 ? { label: 'Debt', value: `${counts.debt}`, tone: 'warning' as const } : null,
      counts.transfer > 0 ? { label: 'Transfers', value: `${counts.transfer}`, tone: 'info' as const } : null,
    ].filter(Boolean) as Array<{
      label: string;
      value: string;
      tone: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
    }>;
  }, [activityTransactions]);

  const homeSummary = (
    <View style={[styles.homeSummaryStrip, { borderBottomColor: theme.colors.border }]}> 
      <View style={styles.homeSummaryTopRow}>
        <View style={styles.homeSummaryPrimary}>
          <Text style={[styles.homeSummaryLabel, { color: theme.colors.textSecondary }]}>Net Worth</Text>
          <AdaptiveAmountText
            style={[
              styles.homeSummaryPrimaryValue,
              { color: netBalance < 0 ? theme.colors.error : theme.colors.text },
            ]}
            minFontSize={18}
            value={`${netBalance < 0 ? '-' : ''}${formatCurrency(Math.abs(netBalance))}`}
          />
        </View>

        <View style={styles.homeSummarySide}>
          <View style={styles.homeSummarySideMetric}>
            <Text style={[styles.homeSummaryLabel, { color: theme.colors.textSecondary }]}>Cash Flow</Text>
            <AdaptiveAmountText
              style={[
                styles.homeSummarySideValue,
                { color: monthlyCashFlow >= 0 ? theme.colors.success : theme.colors.error },
              ]}
              minFontSize={12}
              value={`${monthlyCashFlow >= 0 ? '+' : '-'}${formatCurrency(Math.abs(monthlyCashFlow))}`}
            />
          </View>
        </View>

      </View>

      <View style={[styles.homeSummaryBottomRow, { borderTopColor: theme.colors.border }]}>
        <View style={styles.homeSummaryBottomMetric}>
          <Text style={[styles.homeSummaryBottomLabel, { color: theme.colors.textSecondary }]}>Income</Text>
          <AdaptiveAmountText
            style={[styles.homeSummaryBottomValue, { color: theme.colors.success }]}
            minFontSize={11}
            value={formatCurrency(monthlyIncome)}
          />
        </View>
        <View style={[styles.homeSummaryBottomDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.homeSummaryBottomMetric}>
          <Text style={[styles.homeSummaryBottomLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
          <AdaptiveAmountText
            style={[styles.homeSummaryBottomValue, { color: theme.colors.error }]}
            minFontSize={11}
            value={formatCurrency(monthlyExpenses)}
          />
        </View>
        <View style={[styles.homeSummaryBottomDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.homeSummaryBottomMetric}>
          <Text style={[styles.homeSummaryBottomLabel, { color: theme.colors.textSecondary }]}>Debt</Text>
          <AdaptiveAmountText
            style={[
              styles.homeSummaryBottomValue,
              { color: remainingDebtBalance > 0 ? theme.colors.error : theme.colors.textSecondary },
            ]}
            minFontSize={11}
            value={formatCurrency(remainingDebtBalance)}
          />
        </View>
      </View>
    </View>
  );

  const activitySection = (
    <View style={styles.section}>
      <View
        style={[
          styles.activityCard,
          {
            backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <View style={styles.activityCardHeader}>
          <View style={styles.activityHeadingWrap}>
            <Text style={[styles.activityEyebrow, { color: theme.colors.textSecondary }]}>{activityEyebrow}</Text>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{activityTitle}</Text>
            <Text style={[styles.activitySubtitle, { color: theme.colors.textSecondary }]}>
              {activitySubtitle}
            </Text>
          </View>

          <View style={styles.activityHeaderRight}>
            <View
              style={[
                styles.activityCountBadge,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.activityCountValue, { color: theme.colors.text }]}>{activityTransactions.length}</Text>
              <Text style={[styles.activityCountLabel, { color: theme.colors.textSecondary }]}>{activityCountLabel}</Text>
            </View>
          </View>
        </View>

        {activityTransactions.length === 0 ? (
          <View
            style={[
              styles.activityEmptyState,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
            ]}
          >
            <View style={[styles.activityEmptyIcon, { backgroundColor: isDark ? '#1A332920' : '#F0FDF4' }]}>
              <Search size={22} color={isDark ? '#34D399' : '#059669'} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{activityEmptyState.title}</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {activityEmptyState.description}
            </Text>
          </View>
        ) : (
          <>
            {(!showHomeSearch || normalizedSearchQuery) ? (
              <View
                style={[
                  styles.activitySummaryRow,
                  { borderTopColor: theme.colors.border, borderBottomColor: theme.colors.border },
                ]}
              >
                {recentActivitySummary.map((item) => {
                  const toneStyles =
                    item.tone === 'positive'
                      ? { backgroundColor: isDark ? '#14332B' : '#DCFCE7', color: '#16A34A' }
                      : item.tone === 'negative'
                        ? { backgroundColor: isDark ? '#3F1D1D' : '#FEE2E2', color: '#DC2626' }
                        : item.tone === 'warning'
                          ? { backgroundColor: isDark ? '#3B2A11' : '#FEF3C7', color: '#D97706' }
                          : item.tone === 'info'
                            ? { backgroundColor: isDark ? '#1E3A5F' : '#DBEAFE', color: '#2563EB' }
                            : { backgroundColor: theme.colors.background, color: theme.colors.textSecondary };

                  return (
                    <View
                      key={item.label}
                      style={[
                        styles.activitySummaryChip,
                        { backgroundColor: toneStyles.backgroundColor, borderColor: theme.colors.border },
                      ]}
                    >
                      <Text style={[styles.activitySummaryLabel, { color: toneStyles.color }]}>{item.label}</Text>
                      <Text style={[styles.activitySummaryValue, { color: toneStyles.color }]}>{item.value}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.activityFeedList}>
              {activityTransactions.map((transaction) => (
                <View
                  key={transaction.id}
                  style={[
                    styles.activityRowShell,
                    { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                >
                  <TransactionItem
                    transaction={transaction}
                    showActions
                    compact
                    variant="activity"
                    onEdit={() => setEditingTransaction(transaction)}
                    onDelete={() => confirmDeleteTransaction(transaction)}
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );

  const renderMetricTooltip = (target: MetricCardTarget) => {
    if (activeMetricTooltip !== target) {
      return null;
    }
  return (
      <View pointerEvents="none" style={[styles.metricTooltip, { backgroundColor: metricTooltipBackground }]}>
        <Text style={styles.metricTooltipText}>{metricTooltipMessages[target]}</Text>
        <View style={[styles.metricTooltipArrow, { borderTopColor: metricTooltipBackground }]} />
      </View>
    );
  };

  useEffect(() => {
    if (isLoaded) {
      setShowSkeleton(false);
      return;
    }

    const timer = setTimeout(() => setShowSkeleton(true), 300);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  useEffect(() => {
    if (!openAddTransactionAt) {
      return;
    }

    setPreferredType(null);
    setShowAddModal(true);
    consumeQuickAdd();
  }, [consumeQuickAdd, openAddTransactionAt]);

  if (!isLoaded && !showSkeleton) {
  return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]} />
    );
  }

  if (!isLoaded) {
  return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.skeletonWrap}>
          <SkeletonBlock width="100%" height={144} />
          <View style={{ height: 16 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <SkeletonBlock width="48%" height={88} />
            <SkeletonBlock width="48%" height={88} />
            <SkeletonBlock width="48%" height={88} />
            <SkeletonBlock width="48%" height={88} />
          </View>
          <View style={{ height: 16 }} />
          <SkeletonBlock width="100%" height={68} />
          <View style={{ height: 12 }} />
          <SkeletonBlock width="100%" height={68} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.homeToolbar, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.homeToolbarRow}>
          <View style={styles.monthSelectorWrap}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={styles.monthNavButton}
              onPress={() => shiftSelectedMonth(-1)}
            >
              <ChevronLeft size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Select month"
              style={styles.monthSelectorButton}
              onPress={() => {
                setShowQuickAddMenu(false);
                setShowHomeFilterMenu(false);
                setShowMonthPicker(true);
              }}
            >
              <Text style={[styles.monthSelectorText, { color: theme.colors.text }]}>{selectedMonthLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next month"
              disabled={isCurrentSelectedMonth}
              style={[styles.monthNavButton, isCurrentSelectedMonth && styles.toolbarIconDisabled]}
              onPress={() => shiftSelectedMonth(1)}
            >
              <ChevronRight size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.homeToolbarActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showHomeSearch ? 'Close search' : 'Search transactions'}
              style={styles.toolbarIconButton}
              onPress={handleSearchToggle}
            >
              <Search size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Filter transactions"
              style={styles.toolbarIconButton}
              onPress={handleFilterToggle}
            >
              <SlidersHorizontal size={18} color={theme.colors.text} />
              {hasActiveHomeFilters ? (
                <View style={[styles.toolbarIndicatorDot, { backgroundColor: theme.colors.primary }]} />
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
        {showHomeSearch ? (
          <View style={[styles.searchBar, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: theme.colors.border }]}>
            <Search size={15} color={theme.colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search activity, account, amount"
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.searchInput, { color: theme.colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close search"
              style={styles.searchBarAction}
              onPress={handleSearchToggle}
            >
              <X size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}
        {hasActiveHomeFilters ? (
          <View style={styles.filterStatusRow}>
            <Text style={[styles.filterStatusText, { color: theme.colors.textSecondary }]}>
              {appliedHomeFilterCount} filters active
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={handleClearHomeFilters}>
              <Text style={[styles.filterStatusAction, { color: theme.colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {showHomeSearch ? null : homeSummary}

      {showHomeSearch ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 8 }}
          onScrollBeginDrag={() => {
            setActiveMetricTooltip(null);
            setShowQuickAddMenu(false);
            setShowHomeFilterMenu(false);
          }}
        >
          {activitySection}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            setActiveMetricTooltip(null);
            setShowQuickAddMenu(false);
            setShowHomeFilterMenu(false);
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >

        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={[
              styles.metricCard,
              activeMetricTooltip === 'budget' && styles.metricCardActive,
              { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' },
            ]}
            activeOpacity={0.85}
            onPress={() => handleMetricPress('budget')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: isDark ? '#1E3A5F20' : '#EFF6FF' }]}>
              <Shield size={16} color={isDark ? '#60A5FA' : '#3B82F6'} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Budget</Text>
            {budgetRisk ? (
              <>
                {budgetRisk.overCount > 0 ? (
                  <View style={styles.riskBadge}>
                    <AlertTriangle size={13} color="#EF4444" />
                    <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                      {budgetRisk.overCount} over budget
                    </Text>
                  </View>
                ) : budgetRisk.nearCount > 0 ? (
                  <View style={styles.riskBadge}>
                    <Zap size={13} color="#F59E0B" />
                    <Text style={[styles.metricValue, { color: '#F59E0B' }]}>
                      {budgetRisk.nearCount} near
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.metricValue, { color: '#10B981' }]}>On track</Text>
                )}
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>
                  {budgetRisk.total} {budgetRisk.total === 1 ? 'budget tracked' : 'budgets tracked'}
                </Text>
                <Text style={[styles.metricMeta, { color: theme.colors.textSecondary }]}>{selectedMonthContextLabel}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.metricEmpty, { color: theme.colors.text }]}>No budgets</Text>
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>
                  {budgets.length > 0 ? 'No budget in ' + selectedMonthLabel : 'Add one in Planning'}
                </Text>
              </>
            )}
            {renderMetricTooltip('budget')}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCard,
              activeMetricTooltip === 'health' && styles.metricCardActive,
              { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' },
            ]}
            activeOpacity={0.85}
            onPress={() => handleMetricPress('health')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: isDark ? '#1A332920' : '#F0FDF4' }]}>
              <Activity size={16} color={isDark ? '#34D399' : '#059669'} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Health</Text>
            {hasHealthData ? (
              <>
                <HealthScoreRing score={selectedMonthHealthScore} size={38} strokeWidth={4} />
                <Text style={[styles.metricMeta, { color: theme.colors.textSecondary }]}>{isCurrentSelectedMonth ? '6-mo trend' : 'Trend to ' + selectedMonthLabel}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.metricEmpty, { color: theme.colors.text }]}>No data</Text>
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>{isCurrentSelectedMonth ? 'Add transactions' : 'No activity in ' + selectedMonthLabel}</Text>
              </>
            )}
            {renderMetricTooltip('health')}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCard,
              activeMetricTooltip === 'goals' && styles.metricCardActive,
              { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' },
            ]}
            activeOpacity={0.85}
            onPress={() => handleMetricPress('goals')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: isDark ? '#3C2A1120' : '#FEF3C7' }]}>
              <Target size={16} color={isDark ? '#FBBF24' : '#D97706'} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Financial Goal</Text>
            {goalSummary.total > 0 ? (
              <>
                <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                  {goalSummary.activeCount === 0 ? 'All complete' : String(goalSummary.activeCount)}
                </Text>
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>
                  {goalSummary.activeCount === 0 ? 'all goals complete' : goalSummary.activeCount === 1 ? 'active goal' : 'active goals'}
                </Text>
                <Text
                  style={[
                    styles.metricMeta,
                    { color: goalSummary.overdueCount > 0 ? theme.colors.error : theme.colors.textSecondary },
                  ]}
                >
                  {goalSummary.overdueCount > 0
                    ? `${goalSummary.overdueCount} overdue`
                    : `${goalSummary.completedCount} complete`}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.metricEmpty, { color: theme.colors.text }]}>No goals</Text>
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>Add one in Planning</Text>
              </>
            )}
            {renderMetricTooltip('goals')}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCard,
              activeMetricTooltip === 'savings' && styles.metricCardActive,
              { backgroundColor: isDark ? theme.colors.card : '#FFFFFF' },
            ]}
            activeOpacity={0.85}
            onPress={() => handleMetricPress('savings')}
          >
            <View style={[styles.metricIconBg, { backgroundColor: isDark ? '#14332B80' : '#DCFCE7' }]}>
              <PiggyBank size={16} color={isDark ? '#4ADE80' : '#16A34A'} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Savings</Text>
            {savingsAccounts.length > 0 ? (
              <>
                <AdaptiveAmountText
                  style={[styles.metricValue, { color: theme.colors.text }]}
                  minFontSize={10}
                  minimumFontScale={0.64}
                  value={formatCurrency(totalSavings)}
                />
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>
                  {savingsAccounts.length} {savingsAccounts.length === 1 ? 'account' : 'accounts'}
                </Text>
                <Text style={[styles.metricMeta, { color: theme.colors.textSecondary }]}>
                  {totalSavings > 0 ? 'Total saved' : 'No balance yet'}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.metricEmpty, { color: theme.colors.text }]}>No savings</Text>
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>Add a savings account</Text>
              </>
            )}
            {renderMetricTooltip('savings')}
          </TouchableOpacity>
        </View>


        {topSpending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Spending</Text>
              <Text style={[styles.sectionMeta, { color: theme.colors.textSecondary }]}>{selectedMonthLabel}</Text>
            </View>
            <View
              style={[
                styles.overviewCard,
                { backgroundColor: isDark ? theme.colors.card : '#FFFFFF', borderColor: theme.colors.border },
              ]}
            >
              {topSpending.map((item, index) => (
                <View key={`${item.name}-${index}`}>
                  {index > 0 && <View style={[styles.txDivider, { backgroundColor: theme.colors.border }]} />}
                  <View style={styles.spendingRow}>
                    <View style={styles.overviewNameWrap}>
                      <View style={[styles.spendingDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.overviewName, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <AdaptiveAmountText
                      style={[styles.overviewValue, { color: theme.colors.text }]}
                      minFontSize={10}
                      value={formatCurrency(item.amount)}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}


        {showFarm && farmSummary && (farmSummary.totalFarmIncome > 0 || farmSummary.totalFarmExpenses > 0) && (
          <View style={[styles.farmCard, {
            backgroundColor: isDark ? '#14332B' : '#F0FDF4',
            borderColor: isDark ? '#1A4D3D' : '#BBF7D0',
            borderWidth: 1,
          }]}>
            <View style={styles.farmHeader}>
              <View style={[styles.farmIconBg, { backgroundColor: isDark ? '#166534' : '#DCFCE7' }]}>
                <Sprout size={16} color="#16A34A" />
              </View>
              <Text style={[styles.farmTitle, { color: theme.colors.text }]}>
                {farmSummary.season} Farm Finances
              </Text>
              <View style={[styles.farmProfitPill, {
                backgroundColor: farmSummary.profit >= 0
                  ? (isDark ? '#052E16' : '#DCFCE7')
                  : (isDark ? '#450A0A' : '#FEE2E2'),
              }]}>
                <AdaptiveAmountText
                  style={{
                    fontSize: 11,
                    fontWeight: '700' as const,
                    color: farmSummary.profit >= 0 ? '#16A34A' : '#DC2626',
                  }}
                  minFontSize={9}
                  value={`${farmSummary.profit >= 0 ? '+' : ''}${formatCurrency(farmSummary.profit)}`}
                />
              </View>
            </View>
            <View style={styles.farmStats}>
              <View style={styles.farmStat}>
                <Text style={[styles.farmStatLabel, { color: theme.colors.textSecondary }]}>Revenue</Text>
                <AdaptiveAmountText
                  style={[styles.farmStatValue, { color: '#16A34A' }]}
                  minFontSize={11}
                  value={formatCurrency(farmSummary.totalFarmIncome)}
                />
              </View>
              <View style={[styles.farmStatDivider, { backgroundColor: isDark ? '#1A4D3D' : '#BBF7D0' }]} />
              <View style={styles.farmStat}>
                <Text style={[styles.farmStatLabel, { color: theme.colors.textSecondary }]}>Costs</Text>
                <AdaptiveAmountText
                  style={[styles.farmStatValue, { color: '#DC2626' }]}
                  minFontSize={11}
                  value={formatCurrency(farmSummary.totalFarmExpenses)}
                />
              </View>
            </View>
          </View>
        )}

        {activitySection}

        <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        {showQuickAddMenu ? (
          <View style={[styles.quickAddMenu, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.quickAddOption} onPress={handleAddTransactionPress} activeOpacity={0.85}>
              <View style={[styles.quickAddIconWrap, { backgroundColor: isDark ? '#163D31' : '#DCFCE7' }]}>
                <Plus size={15} color={isDark ? '#4ADE80' : '#166534'} />
              </View>
              <Text style={[styles.quickAddOptionText, { color: theme.colors.text }]}>Add transaction</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAddOption} onPress={handleAddNotePress} activeOpacity={0.85}>
              <View style={[styles.quickAddIconWrap, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                <FileText size={15} color={isDark ? '#E5E7EB' : '#334155'} />
              </View>
              <Text style={[styles.quickAddOptionText, { color: theme.colors.text }]}>Add note</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: isDark ? '#16A34A' : '#0D3B2E' }]}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          onPress={handleAddFabPress}
          activeOpacity={1}
          testID="add-transaction-fab"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </Animated.View>


      <Modal visible={showHomeFilterMenu} animationType="slide" onRequestClose={handleCloseHomeFilter}>
        <View style={[styles.homeFilterModal, { backgroundColor: homeFilterPalette.modalBackground }]}>
          <View
            style={[
              styles.homeFilterHeader,
              {
                backgroundColor: homeFilterPalette.headerBackground,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.homeFilterHeaderRow}>
              <View style={styles.homeFilterHeaderMonthWrap}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  style={styles.homeFilterHeaderIcon}
                  onPress={() => shiftSelectedMonth(-1)}
                >
                  <ChevronLeft size={18} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.homeFilterMonthButton} onPress={() => setShowMonthPicker(true)}>
                  <Text style={[styles.homeFilterMonthText, { color: theme.colors.text }]}>{selectedMonthLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  disabled={isCurrentSelectedMonth}
                  style={[styles.homeFilterHeaderIcon, isCurrentSelectedMonth && styles.toolbarIconDisabled]}
                  onPress={() => shiftSelectedMonth(1)}
                >
                  <ChevronRight size={18} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.homeFilterHeaderActions}>
                {hasActiveHomeFilters ? (
                  <TouchableOpacity accessibilityRole="button" onPress={handleClearHomeFilters}>
                    <Text style={[styles.homeFilterClearText, { color: theme.colors.primary }]}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity accessibilityRole="button" style={styles.homeFilterHeaderIcon} onPress={handleCloseHomeFilter}>
                  <X size={18} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.homeFilterPromptBar,
              {
                backgroundColor: homeFilterPalette.promptBackground,
                borderBottomColor: theme.colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text style={[styles.homeFilterPromptText, { color: theme.colors.text }]}>Select items that you want to filter.</Text>
          </View>

          <View
            style={[
              styles.homeFilterSummaryRow,
              {
                backgroundColor: homeFilterPalette.sectionBackground,
                borderBottomColor: theme.colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View
              style={[
                styles.homeFilterSummaryMetric,
                {
                  backgroundColor: homeFilterPalette.incomeBackground,
                  borderColor: theme.colors.info + (isDark ? '28' : '18'),
                },
              ]}
            >
              <Text style={[styles.homeFilterSummaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
              <View style={[styles.homeFilterCircle, { borderColor: theme.colors.info }]}>
                <Text style={[styles.homeFilterCircleValue, { color: theme.colors.text }]}>{homeFilterSelectionSummary.incomePercent}%</Text>
              </View>
              <AdaptiveAmountText
                style={[styles.homeFilterSummaryAmount, { color: theme.colors.info }]}
                minFontSize={10}
                value={formatCurrency(homeFilterSelectionSummary.incomeAmount)}
              />
            </View>

            <View
              style={[
                styles.homeFilterSummaryMetric,
                {
                  backgroundColor: homeFilterPalette.expenseBackground,
                  borderColor: theme.colors.error + (isDark ? '24' : '18'),
                },
              ]}
            >
              <Text style={[styles.homeFilterSummaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
              <View style={[styles.homeFilterCircle, { borderColor: theme.colors.error }]}>
                <Text style={[styles.homeFilterCircleValue, { color: theme.colors.text }]}>{homeFilterSelectionSummary.expensePercent}%</Text>
              </View>
              <AdaptiveAmountText
                style={[styles.homeFilterSummaryAmount, { color: theme.colors.error }]}
                minFontSize={10}
                value={formatCurrency(homeFilterSelectionSummary.expenseAmount)}
              />
            </View>

            <View
              style={[
                styles.homeFilterSummaryTotal,
                {
                  backgroundColor: homeFilterPalette.totalBackground,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.homeFilterSummaryLabel, { color: theme.colors.textSecondary }]}>Total</Text>
              <AdaptiveAmountText
                style={[styles.homeFilterSummaryTotalValue, { color: theme.colors.text }]}
                minFontSize={12}
                value={formatCurrency(homeFilterSelectionSummary.totalAmount)}
              />
              <Text style={[styles.homeFilterSummaryMeta, { color: theme.colors.textSecondary }]}>
                {hasActiveHomeFilters ? appliedHomeFilterCount + ' selected' : 'No filters yet'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.homeFilterTabsRow,
              {
                backgroundColor: homeFilterPalette.sectionBackground,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            {HOME_FILTER_TABS.map((tab) => {
              const isActive = homeFilterTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  accessibilityRole="button"
                  style={styles.homeFilterTabButton}
                  onPress={() => setHomeFilterTab(tab.key)}
                >
                  <Text
                    style={[
                      styles.homeFilterTabText,
                      { color: isActive ? theme.colors.text : theme.colors.textSecondary },
                    ]}
                  >
                    {tab.label}{homeFilterTabCounts[tab.key] > 0 ? ' (' + homeFilterTabCounts[tab.key] + ')' : ''}
                  </Text>
                  <View
                    style={[
                      styles.homeFilterTabIndicator,
                      { backgroundColor: isActive ? theme.colors.primary : 'transparent' },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {homeFilterTab === 'account' ? (
            <View
              style={[
                styles.homeFilterScopesRow,
                {
                  backgroundColor: homeFilterPalette.sectionBackground,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              {HOME_ACCOUNT_FILTER_SCOPES.map((scope) => {
                const isActive = homeAccountFilterScope === scope.key;
                return (
                  <TouchableOpacity
                    key={scope.key}
                    accessibilityRole="button"
                    style={styles.homeFilterScopeButton}
                    onPress={() => setHomeAccountFilterScope(scope.key)}
                  >
                    <Text
                      style={[
                        styles.homeFilterScopeText,
                        { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                      ]}
                    >
                      {scope.label}{homeFilterScopeCounts[scope.key] > 0 ? ' (' + homeFilterScopeCounts[scope.key] + ')' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}


          <View
            style={[
              styles.homeFilterSearchRow,
              {
                backgroundColor: homeFilterPalette.sectionBackground,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.homeFilterSearchInput,
                {
                  backgroundColor: homeFilterPalette.modalBackground,
                  borderColor: normalizedHomeFilterQuery ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Search size={15} color={normalizedHomeFilterQuery ? theme.colors.primary : theme.colors.textSecondary} />
              <TextInput
                value={homeFilterQuery}
                onChangeText={setHomeFilterQuery}
                placeholder={homeFilterSearchPlaceholder}
                placeholderTextColor={theme.colors.textSecondary}
                style={[styles.homeFilterSearchTextInput, { color: theme.colors.text }]}
              />
              {homeFilterQuery ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear filter search" style={styles.homeFilterSearchClear} onPress={() => setHomeFilterQuery('')}>
                  <X size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.homeFilterStatusRow,
              {
                backgroundColor: homeFilterPalette.sectionBackground,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.homeFilterStatusText, { color: theme.colors.textSecondary }]}>{homeFilterStatusText}</Text>
          </View>

          <ScrollView
            style={[styles.homeFilterScroll, { backgroundColor: homeFilterPalette.modalBackground }]}
            contentContainerStyle={styles.homeFilterScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {homeFilterTab === 'income' ? (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.homeFilterAllRow,
                    { borderBottomColor: theme.colors.border },
                    isIncomeSectionClear && { backgroundColor: theme.colors.primary + (isDark ? '14' : '08') },
                  ]}
                  onPress={handleClearIncomeSectionFilters}
                >
                  <View
                    style={[
                      styles.homeFilterCheckbox,
                      {
                        borderColor: homeFilterPalette.checkboxBorder,
                        backgroundColor: homeFilterPalette.sectionBackground,
                      },
                      isIncomeSectionClear && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                  >
                    {isIncomeSectionClear ? <Check size={13} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={[styles.homeFilterRowText, { color: theme.colors.text }]}>All</Text>
                  <Text
                    style={[
                      styles.homeFilterAllMetaText,
                      { color: isIncomeSectionClear ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {isIncomeSectionClear ? selectedMonthContextLabel : incomeSectionSelectedCount + ' selected'}
                  </Text>
                </TouchableOpacity>

                {displayedIncomeFilterOptions.length === 0 ? (
                  <View style={styles.homeFilterEmptyState}>
                    <Text style={[styles.homeFilterEmptyStateTitle, { color: theme.colors.text }]}>{homeFilterEmptyTitle}</Text>
                    <Text style={[styles.homeFilterEmptyStateDescription, { color: theme.colors.textSecondary }]}>{homeFilterEmptyDescription}</Text>
                  </View>
                ) : displayedIncomeFilterOptions.map((option) => renderHomeCategoryFilterOption(option, 'income'))}
              </>
            ) : homeFilterTab === 'expense' ? (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.homeFilterAllRow,
                    { borderBottomColor: theme.colors.border },
                    isExpenseSectionClear && { backgroundColor: theme.colors.primary + (isDark ? '14' : '08') },
                  ]}
                  onPress={handleClearExpenseSectionFilters}
                >
                  <View
                    style={[
                      styles.homeFilterCheckbox,
                      {
                        borderColor: homeFilterPalette.checkboxBorder,
                        backgroundColor: homeFilterPalette.sectionBackground,
                      },
                      isExpenseSectionClear && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                  >
                    {isExpenseSectionClear ? <Check size={13} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={[styles.homeFilterRowText, { color: theme.colors.text }]}>All</Text>
                  <Text
                    style={[
                      styles.homeFilterAllMetaText,
                      { color: isExpenseSectionClear ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {isExpenseSectionClear ? selectedMonthContextLabel : expenseSectionSelectedCount + ' selected'}
                  </Text>
                </TouchableOpacity>

                {displayedExpenseFilterOptions.length === 0 ? (
                  <View style={styles.homeFilterEmptyState}>
                    <Text style={[styles.homeFilterEmptyStateTitle, { color: theme.colors.text }]}>{homeFilterEmptyTitle}</Text>
                    <Text style={[styles.homeFilterEmptyStateDescription, { color: theme.colors.textSecondary }]}>{homeFilterEmptyDescription}</Text>
                  </View>
                ) : displayedExpenseFilterOptions.map((option) => renderHomeCategoryFilterOption(option, 'expense'))}
              </>
            ) : (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.homeFilterAllRow,
                    { borderBottomColor: theme.colors.border },
                    isCurrentAccountScopeClear && { backgroundColor: theme.colors.primary + (isDark ? '14' : '08') },
                  ]}
                  onPress={() => handleClearHomeAccountScope(homeAccountFilterScope)}
                >
                  <View
                    style={[
                      styles.homeFilterCheckbox,
                      {
                        borderColor: homeFilterPalette.checkboxBorder,
                        backgroundColor: homeFilterPalette.sectionBackground,
                      },
                      isCurrentAccountScopeClear && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                  >
                    {isCurrentAccountScopeClear ? <Check size={13} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={[styles.homeFilterRowText, { color: theme.colors.text }]}>All</Text>
                  <Text
                    style={[
                      styles.homeFilterAllMetaText,
                      { color: isCurrentAccountScopeClear ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {isCurrentAccountScopeClear ? selectedMonthContextLabel : homeFilterScopeCounts[homeAccountFilterScope] + ' selected'}
                  </Text>
                </TouchableOpacity>

                {visibleHomeAccountSections.length === 0 ? (
                  <View style={styles.homeFilterEmptyState}>
                    <Text style={[styles.homeFilterEmptyStateTitle, { color: theme.colors.text }]}>{homeFilterEmptyTitle}</Text>
                    <Text style={[styles.homeFilterEmptyStateDescription, { color: theme.colors.textSecondary }]}>{homeFilterEmptyDescription}</Text>
                  </View>
                ) : visibleHomeAccountSections.map((section) => (
                  <View key={section.key} style={styles.homeFilterAccountSection}>
                    <Text style={[styles.homeFilterSectionTitle, { color: theme.colors.textSecondary }]}>
                      {section.label + ' (' + (section.typeRows.length + section.accounts.length) + ')'}
                    </Text>

                    {section.typeRows.map((definition) => {
                      const token = makeHomeAccountFilterToken('type', definition.type);
                      const isSelected = selectedAccountFilterTokens[homeAccountFilterScope].includes(token);
                      const linkedAccounts = section.accounts.filter((account) => account.type === definition.type);
                      return (
                        <TouchableOpacity
                          key={definition.type}
                          accessibilityRole="button"
                          style={[
                            styles.homeFilterListRow,
                            styles.homeFilterTypeRow,
                            { borderBottomColor: theme.colors.border },
                            isSelected && { backgroundColor: theme.colors.primary + (isDark ? '12' : '08') },
                          ]}
                          onPress={() => handleToggleHomeAccountFilter(homeAccountFilterScope, token)}
                        >
                          <View
                            style={[
                              styles.homeFilterCheckbox,
                              {
                                borderColor: homeFilterPalette.checkboxBorder,
                                backgroundColor: homeFilterPalette.sectionBackground,
                              },
                              isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                            ]}
                          >
                            {isSelected ? <Check size={13} color="#FFFFFF" /> : null}
                          </View>
                          <Text style={[styles.homeFilterRowText, { color: theme.colors.text }]} numberOfLines={1}>
                            {definition.label}
                          </Text>
                          <Text style={[styles.homeFilterRowMeta, { color: theme.colors.textSecondary }]}>{linkedAccounts.length} {linkedAccounts.length === 1 ? 'account' : 'accounts'}</Text>
                        </TouchableOpacity>
                      );
                    })}

                    {section.accounts.map((account) => {
                      const token = makeHomeAccountFilterToken('account', account.id);
                      const isSelected = selectedAccountFilterTokens[homeAccountFilterScope].includes(token);
                      return (
                        <TouchableOpacity
                          key={account.id}
                          accessibilityRole="button"
                          style={[
                            styles.homeFilterListRow,
                            { borderBottomColor: theme.colors.border },
                            isSelected && { backgroundColor: theme.colors.primary + (isDark ? '12' : '08') },
                          ]}
                          onPress={() => handleToggleHomeAccountFilter(homeAccountFilterScope, token)}
                        >
                          <View
                            style={[
                              styles.homeFilterCheckbox,
                              {
                                borderColor: homeFilterPalette.checkboxBorder,
                                backgroundColor: homeFilterPalette.sectionBackground,
                              },
                              isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                            ]}
                          >
                            {isSelected ? <Check size={13} color="#FFFFFF" /> : null}
                          </View>
                          <Text style={[styles.homeFilterRowText, { color: theme.colors.text }]} numberOfLines={1}>
                            {account.name}
                          </Text>
                          <AdaptiveAmountText
                            style={[styles.homeFilterRowAmount, { color: theme.colors.textSecondary }]}
                            minFontSize={10}
                            value={formatCurrency(account.balance)}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
      <AddTransactionModal
        visible={showAddModal}
        initialType={preferredType ?? undefined}
        onClose={() => {
          setShowAddModal(false);
          setPreferredType(null);
        }}
      />

      {showMonthPicker ? (
        <DateTimePicker
          value={selectedMonthDate}
          mode="date"
          display="default"
          onChange={handleMonthChange}
        />
      ) : null}

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
  scrollView: {
    flex: 1,
  },
  homeToolbar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 36,
  },
  monthSelectorWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  monthSelectorButton: {
    flexShrink: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  monthSelectorText: {
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  monthNavButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeToolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  toolbarIconButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarIconDisabled: {
    opacity: 0.45,
  },
  searchBar: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
    paddingVertical: 0,
  },
  searchBarAction: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingLeft: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  toolbarIndicatorDot: {
    position: 'absolute',
    top: 1,
    right: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterStatusRow: {
    marginTop: 8,
    paddingLeft: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  filterStatusAction: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  homeFilterModal: {
    flex: 1,
  },
  homeFilterHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  homeFilterHeaderMonthWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  homeFilterHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  homeFilterHeaderIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFilterMonthButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  homeFilterMonthText: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  homeFilterClearText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  homeFilterPromptBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  homeFilterPromptText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  homeFilterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  homeFilterSummaryMetric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 132,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  homeFilterSummaryLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  homeFilterCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFilterCircleValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  homeFilterSummaryAmount: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginTop: 10,
    textAlign: 'center' as const,
  },
  homeFilterSummaryTotal: {
    width: 90,
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  homeFilterSummaryTotalValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    lineHeight: 20,
  },
  homeFilterSummaryMeta: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  homeFilterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterTabButton: {
    minWidth: 74,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  homeFilterTabText: {
    fontSize: 14,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  homeFilterTabIndicator: {
    width: '100%',
    height: 2,
    borderRadius: 999,
    marginTop: 8,
  },
  homeFilterScopesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterScopeButton: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  homeFilterScopeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  homeFilterCategorySectionsRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterCategorySectionsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  homeFilterCategorySectionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  homeFilterCategorySectionText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  homeFilterSearchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  homeFilterSearchTextInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  homeFilterSearchClear: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFilterStatusRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  homeFilterScroll: {
    flex: 1,
  },
  homeFilterScrollContent: {
    paddingBottom: 32,
  },
  homeFilterAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterDropdownGroup: {
    overflow: 'hidden',
  },
  homeFilterCategoryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  homeFilterCategoryCheckboxButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterCategoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterCategoryButtonOpen: {
    borderBottomWidth: 0,
  },
  homeFilterCategorySwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  homeFilterCategoryContent: {
    flex: 1,
    minWidth: 0,
  },
  homeFilterCategoryMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  homeFilterExpandButton: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeFilterExpandIconOpen: {
    transform: [{ rotate: '180deg' }],
  },
  homeFilterSubcategoryList: {
    paddingBottom: 4,
  },
  homeFilterSubcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 52,
    paddingRight: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  homeFilterSubcategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  homeFilterSubcategoryText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  homeFilterSubcategoryAmount: {
    minWidth: 72,
    fontSize: 11,
    fontWeight: '700' as const,
    textAlign: 'right' as const,
  },
  homeFilterTypeRow: {
    paddingLeft: 28,
  },
  homeFilterCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFilterRowIcon: {
    width: 18,
    fontSize: 16,
    textAlign: 'center' as const,
  },
  homeFilterRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  homeFilterRowMeta: {
    minWidth: 68,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
  homeFilterRowAmount: {
    minWidth: 78,
    fontSize: 11,
    fontWeight: '700' as const,
    textAlign: 'right' as const,
  },
  homeFilterAllMetaText: {
    marginLeft: 'auto',
    minWidth: 104,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '700' as const,
    textAlign: 'right' as const,
  },
  homeFilterAccountSection: {
    paddingTop: 14,
  },
  homeFilterSectionTitle: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  homeFilterEmptyState: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  homeFilterEmptyStateTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
  },
  homeFilterEmptyStateDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center' as const,
  },
  skeletonWrap: {
    padding: 16,
  },
  homeSummaryStrip: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  homeSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  homeSummaryPrimary: {
    flex: 1,
    minWidth: 0,
  },
  homeSummaryLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  homeSummaryPrimaryValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    marginTop: 4,
    letterSpacing: -0.35,
  },
  homeSummaryMeta: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  homeSummarySide: {
    width: 118,
    alignItems: 'flex-end',
  },
  homeSummarySideMetric: {
    alignItems: 'flex-end',
  },
  homeSummarySideValue: {
    fontSize: 15,
    fontWeight: '800' as const,
    marginTop: 3,
    textAlign: 'right' as const,
  },

  homeSummaryBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  homeSummaryBottomMetric: {
    flex: 1,
    minWidth: 0,
  },
  homeSummaryBottomLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  homeSummaryBottomValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginTop: 4,
  },
  homeSummaryBottomDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
  },
  metricCard: {
    width: '48%',
    minHeight: 92,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  metricCardActive: {
    zIndex: 12,
    elevation: 5,
  },
  metricTooltip: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: '100%',
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  metricTooltipText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 15,
    textAlign: 'center',
  },
  metricTooltipArrow: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  metricIconBg: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  metricEmpty: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 3,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800' as const,
    marginBottom: 3,
    textAlign: 'center',
  },
  metricMeta: {
    fontSize: 8.5,
    fontWeight: '600' as const,
    marginTop: 3,
    textAlign: 'center',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  metricSub: {
    fontSize: 8.5,
    fontWeight: '500' as const,
    marginTop: 1,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  overviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overviewNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 8,
  },
  overviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overviewName: {
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  },
  overviewValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    flexShrink: 1,
    textAlign: 'right',
  },
  spendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  spendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  farmCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
  },
  farmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  farmIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    flex: 1,
  },
  farmProfitPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  farmStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  farmStat: {
    flex: 1,
    alignItems: 'center',
  },
  farmStatDivider: {
    width: 1,
    height: 28,
  },
  farmStatLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    marginBottom: 2,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  farmStatValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    flexShrink: 1,
  },
  activityCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  activityCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  activityHeadingWrap: {
    flex: 1,
    minWidth: 0,
  },
  activityEyebrow: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  activityHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  activityCountBadge: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    minWidth: 58,
  },
  activityCountValue: {
    fontSize: 14,
    fontWeight: '800' as const,
    lineHeight: 16,
  },
  activityCountLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  activitySummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  activitySummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activitySummaryLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  activitySummaryValue: {
    fontSize: 11,
    fontWeight: '800' as const,
  },
  activityFeedList: {
    padding: 12,
    gap: 10,
  },
  activityRowShell: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  activityEmptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderTopWidth: 1,
  },
  activityEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  txList: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },  txDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 15,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 5,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    alignItems: 'flex-end',
  },
  quickAddMenu: {
    minWidth: 168,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  quickAddOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickAddIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddOptionText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
});






































































































