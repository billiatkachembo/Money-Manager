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
} from 'react-native';
import {
  Plus,
  AlertTriangle,
  Info,
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
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { TransactionItem } from '@/components/TransactionItem';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { SmartInsightsCard } from '@/components/dashboard/SmartInsightsCard';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';
import { useTransactionStore } from '@/store/transaction-store';
import { useQuickActionsStore } from '@/store/quick-actions-store';
import { useTheme } from '@/store/theme-store';
import { useTabNavigationStore } from '@/store/tab-navigation-store';
import { useRouter } from 'expo-router';
import { getHealthScoreLabel, getHealthScoreColor } from '@/lib/health-score';
import { hasFarmActivity, getSeasonalFarmSummary } from '@/lib/farming';
import { Insight, Transaction } from '@/types/transaction';
import { getActiveBudgets } from '@/src/domain/budgeting';
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

const InsightCard = React.memo(function InsightCard({ insight, isDark, onPress }: { insight: Insight; isDark: boolean; onPress?: () => void }) {
  const severityConfig = {
    critical: { icon: AlertTriangle, color: '#EF4444', bg: isDark ? '#2D1B1B' : '#FEF2F2', border: isDark ? '#5C2020' : '#FECACA' },
    warning: { icon: Zap, color: '#F59E0B', bg: isDark ? '#2D2514' : '#FFFBEB', border: isDark ? '#5C4B14' : '#FDE68A' },
    info: { icon: Info, color: '#3B82F6', bg: isDark ? '#1B2338' : '#EFF6FF', border: isDark ? '#1E3A5F' : '#BFDBFE' },
  };

  const config = severityConfig[insight.severity];
  const Icon = config.icon;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  }, [scaleAnim]);
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[insightStyles.card, { backgroundColor: config.bg, borderColor: config.border, borderWidth: 1 }]}
      >
        <View style={[insightStyles.iconWrap, { backgroundColor: config.color + '18' }]}>
          <Icon size={15} color={config.color} />
        </View>
        <View style={insightStyles.content}>
          <Text style={[insightStyles.title, { color: config.color }]} numberOfLines={1}>
            {insight.title}
          </Text>
          <Text style={[insightStyles.message, { color: isDark ? '#A0A0A0' : '#6B7280' }]} numberOfLines={2}>
            {insight.message}
          </Text>
        </View>
        <ChevronRight size={14} color={config.color} style={{ opacity: 0.5 }} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const insightStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
    alignItems: 'center',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginBottom: 1,
  },
  message: {
    fontSize: 11,
    lineHeight: 15,
  },
});

type MetricCardTarget = 'budget' | 'health' | 'goals' | 'savings';
type HomeActivityFilter = 'all' | Transaction['type'];

const HOME_ACTIVITY_FILTERS: Array<{ key: HomeActivityFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expenses' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'debt', label: 'Debt' },
];

function toMonthKey(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
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
  const [activityFilter, setActivityFilter] = useState<HomeActivityFilter>('all');
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
    healthScore,
    insights,
    budgets,
    getBudgetSpending,
    formatCurrency,
    isLoaded,
    triggerReconciliation,
    deleteTransaction,
  } = useTransactionStore();
  const { openAddTransactionAt, consumeQuickAdd } = useQuickActionsStore();
  const openNotesComposer = useTabNavigationStore((state) => state.openNotesComposer);
  const router = useRouter();

  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const selectedMonthKey = useMemo(() => toMonthKey(selectedMonthDate), [selectedMonthDate]);
  const selectedMonthLabel = useMemo(
    () => selectedMonthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    [selectedMonthDate]
  );
  const isCurrentSelectedMonth = selectedMonthKey === currentMonthKey;
  const monthlyIncome = getTotalIncome(selectedMonthKey);
  const monthlyExpenses = getTotalExpenses(selectedMonthKey);
  const monthlyCashFlow = monthlyIncome - monthlyExpenses;
  const remainingDebtBalance = useMemo(() => {
    const borrowedBalance = debtAccounts
      .filter((entry) => entry.direction === 'borrowed')
      .reduce((sum, entry) => sum + entry.balance, 0);
    const totalDebtPayments = transactions
      .filter((transaction) => transaction.type === 'expense' && transaction.debtPayment)
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
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const recentTransactions = useMemo(() => {
    return [...selectedMonthTransactions]
      .filter((transaction) => activityFilter === 'all' || transaction.type === activityFilter)
      .filter((transaction) => {
        if (!normalizedSearchQuery) {
          return true;
        }

        const searchFields = [
          transaction.description,
          transaction.note,
          transaction.category?.name,
          transaction.fromAccount,
          transaction.toAccount,
          transaction.type,
        ];

        return searchFields.some((value) => value?.toLowerCase().includes(normalizedSearchQuery));
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 7);
  }, [activityFilter, normalizedSearchQuery, selectedMonthTransactions]);



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
  const activeBudgets = useMemo(() => getActiveBudgets(budgets), [budgets]);

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
    if (activeBudgets.length === 0) return null;

    let overCount = 0;
    let nearCount = 0;

    for (const budget of activeBudgets) {
      const spent = getBudgetSpending(budget.id);
      const pct = budget.amount > 0 ? spent / budget.amount : 0;
      if (pct >= 1) overCount++;
      else if (pct >= 0.8) nearCount++;
    }

    return { overCount, nearCount, total: activeBudgets.length };
  }, [activeBudgets, getBudgetSpending]);

  const hasHealthData = useMemo(
    () => transactions.length > 0 || activeBudgets.length > 0 || netBalance !== 0,
    [activeBudgets.length, netBalance, transactions.length]
  );

  const topInsights = useMemo(() => insights.slice(0, 3), [insights]);

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
    setShowHomeFilterMenu(false);
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
    setShowHomeSearch(false);
    setSearchQuery('');
    setShowHomeFilterMenu((current) => !current);
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

  const handleInsightPress = useCallback((insight: Insight) => {
    Alert.alert(insight.title, insight.message);
  }, []);

  const isDark = theme.isDark;
  const metricTooltipBackground = isDark ? '#0F172A' : '#1F2937';
  const transactionEmptyState = useMemo(() => {
    if (selectedMonthTransactions.length === 0) {
      return {
        title: 'No transactions in ' + selectedMonthLabel,
        description: 'Use the Add button below to track activity for this month.',
      };
    }

    return {
      title: 'No matching transactions',
      description: 'Try a different search term or clear the current filter.',
    };
  }, [selectedMonthLabel, selectedMonthTransactions.length]);

  const recentActivitySummary = useMemo(() => {
    const counts = recentTransactions.reduce(
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
      { label: 'Shown', value: `${recentTransactions.length}`, tone: 'neutral' as const },
      counts.expense > 0 ? { label: 'Expenses', value: `${counts.expense}`, tone: 'negative' as const } : null,
      counts.income > 0 ? { label: 'Income', value: `${counts.income}`, tone: 'positive' as const } : null,
      counts.debt > 0 ? { label: 'Debt', value: `${counts.debt}`, tone: 'warning' as const } : null,
      counts.transfer > 0 ? { label: 'Transfers', value: `${counts.transfer}`, tone: 'info' as const } : null,
    ].filter(Boolean) as Array<{
      label: string;
      value: string;
      tone: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
    }>;
  }, [recentTransactions]);
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
          <Text style={[styles.homeSummaryMeta, { color: theme.colors.textSecondary }]}>{selectedMonthLabel}</Text>
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
            </TouchableOpacity>
          </View>
        </View>
        {showHomeSearch ? (
          <View style={[styles.searchBar, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: theme.colors.border }]}>
            <Search size={15} color={theme.colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search transactions"
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.searchInput, { color: theme.colors.text }]}
              autoFocus
            />
          </View>
        ) : null}
        {showHomeFilterMenu ? (
          <View style={styles.filterChipsRow}>
            {HOME_ACTIVITY_FILTERS.map((option) => {
              const isActive = activityFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  accessibilityRole="button"
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? theme.colors.primary + '18' : isDark ? theme.colors.card : '#FFFFFF',
                      borderColor: isActive ? theme.colors.primary + '50' : theme.colors.border,
                    },
                  ]}
                  onPress={() => setActivityFilter(option.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>
      {homeSummary}

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
                  {budgetRisk.total} {budgetRisk.total === 1 ? 'active budget' : 'active budgets'}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.metricEmpty, { color: theme.colors.text }]}>No budgets</Text>
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>
                  {budgets.length > 0 ? 'No active budgets' : 'Add a budget'}
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
              <HealthScoreRing score={healthScore} size={38} strokeWidth={4} />
            ) : (
              <>
                <Text style={[styles.metricEmpty, { color: theme.colors.text }]}>No data</Text>
                <Text style={[styles.metricSub, { color: theme.colors.textSecondary }]}>Add transactions</Text>
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

        {transactions.length > 0 && (
          <>
            <SmartInsightsCard
              balance={netBalance}
              income={monthlyIncome}
              expenses={monthlyExpenses}
            />
            {topInsights.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Smart Insights</Text>
                  {insights.length > 3 && (
                    <TouchableOpacity style={styles.seeAllBtn}>
                      <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
                        +{insights.length - 3} more
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {topInsights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} isDark={isDark} onPress={() => handleInsightPress(insight)} />
                ))}
              </View>
            )}
          </>
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
                <Text style={[styles.activityEyebrow, { color: theme.colors.textSecondary }]}>Home Feed</Text>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Activity</Text>
                <Text style={[styles.activitySubtitle, { color: theme.colors.textSecondary }]}>
                  {showHomeSearch || activityFilter !== 'all'
                    ? selectedMonthLabel + ' | ' + (HOME_ACTIVITY_FILTERS.find((option) => option.key === activityFilter)?.label ?? 'All')
                    : selectedMonthLabel + ' snapshot'}
                </Text>
              </View>

              <View style={styles.activityHeaderRight}>
                <View
                  style={[
                    styles.activityCountBadge,
                    { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                >
                  <Text style={[styles.activityCountValue, { color: theme.colors.text }]}>{recentTransactions.length}</Text>
                  <Text style={[styles.activityCountLabel, { color: theme.colors.textSecondary }]}>items</Text>
                </View>
                {recentTransactions.length > 0 ? (
                  <TouchableOpacity
                    style={[
                      styles.activitySeeAllBtn,
                      { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => router.push('/(tabs)/transactions')}
                  >
                    <Text style={[styles.seeAll, { color: theme.colors.primary }]}>See All</Text>
                    <ChevronRight size={14} color={theme.colors.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {recentTransactions.length === 0 ? (
              <View
                style={[
                  styles.activityEmptyState,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                ]}
              >
                <View style={[styles.activityEmptyIcon, { backgroundColor: isDark ? '#1A332920' : '#F0FDF4' }]}>
                  <Activity size={22} color={isDark ? '#34D399' : '#059669'} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{transactionEmptyState.title}</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {transactionEmptyState.description}
                </Text>
              </View>
            ) : (
              <>
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

                <View style={styles.activityFeedList}>
                  {recentTransactions.map((transaction) => (
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

        <View style={{ height: 100 }} />
      </ScrollView>

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
    minHeight: 88,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    marginBottom: 5,
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
    fontSize: 8,
    fontWeight: '600' as const,
    marginTop: 1,
    textAlign: 'center',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  metricSub: {
    fontSize: 8,
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
  seeAll: {
    fontSize: 12,
    fontWeight: '600' as const,
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
  activitySeeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
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




















































