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
} from 'react-native';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Zap,
  Sprout,
  ChevronRight,
  Activity,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Target,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TransactionItem } from '@/components/TransactionItem';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { SmartInsightsCard } from '@/components/dashboard/SmartInsightsCard';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';
import { useTransactionStore } from '@/store/transaction-store';
import { useQuickActionsStore } from '@/store/quick-actions-store';
import { useTheme } from '@/store/theme-store';
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

export default function HomeScreen() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [preferredType, setPreferredType] = useState<'income' | 'expense' | 'transfer' | 'debt' | null>(null);
  const [activeMetricTooltip, setActiveMetricTooltip] = useState<MetricCardTarget | null>(null);
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

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const monthlyIncome = getTotalIncome(currentMonth);
  const monthlyExpenses = getTotalExpenses(currentMonth);
  const monthlyCashFlow = monthlyIncome - monthlyExpenses;
  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 7),
    [transactions]
  );



  const topSpending = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; amount: number }>();

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;
      if (transaction.date.toISOString().slice(0, 7) !== currentMonth) continue;

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
  }, [transactions, currentMonth]);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPreferredType(null);
    setShowAddModal(true);
  }, [fabScale]);

  const handleFabLongPress = useCallback(() => {
    Alert.alert(t('home.addType.title'), t('home.addType.message'), [
      {
        text: 'Income',
        onPress: () => {
          setPreferredType('income');
          setShowAddModal(true);
        },
      },
      {
        text: 'Expense',
        onPress: () => {
          setPreferredType('expense');
          setShowAddModal(true);
        },
      },
      {
        text: 'Transfer',
        onPress: () => {
          setPreferredType('transfer');
          setShowAddModal(true);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [setPreferredType, setShowAddModal]);

  const handleMetricPress = useCallback((target: MetricCardTarget) => {
    setActiveMetricTooltip((current) => (current === target ? null : target));
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
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setActiveMetricTooltip(null)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <LinearGradient
          colors={isDark ? ['#14332B', '#0C1F1A'] : ['#0D3B2E', '#155C47']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Net Worth</Text>
              <AdaptiveAmountText
                style={[styles.heroBalance, netBalance < 0 && styles.negativeBalance]}
                minFontSize={18}
                value={`${netBalance < 0 ? '-' : ''}${formatCurrency(Math.abs(netBalance))}`}
              />
              <Text
                style={[styles.heroMeta, monthlyCashFlow < 0 && styles.heroMetaNegative]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                This month {monthlyCashFlow >= 0 ? '+' : '-'}{formatCurrency(Math.abs(monthlyCashFlow))}
              </Text>
            </View>
            <View style={styles.cashFlowPill}>
              <Text style={styles.cashFlowPillLabel}>Cash Flow</Text>
              <View style={styles.cashFlowValueRow}>
                {monthlyCashFlow >= 0 ? (
                  <ArrowUpRight size={12} color="#4ADE80" />
                ) : (
                  <ArrowDownRight size={12} color="#F87171" />
                )}
                <AdaptiveAmountText
                  style={[
                    styles.cashFlowPillText,
                    { color: monthlyCashFlow >= 0 ? '#4ADE80' : '#F87171' },
                  ]}
                  minFontSize={9}
                  value={`${monthlyCashFlow >= 0 ? '+' : ''}${formatCurrency(monthlyCashFlow)}`}
                />
              </View>
            </View>
          </View>

          <View style={styles.flowRow}>
            <View style={styles.flowItem}>
              <View style={[styles.flowIcon, { backgroundColor: 'rgba(74,222,128,0.15)' }]}>
                <TrendingUp size={13} color="#4ADE80" />
              </View>
              <View>
                <Text style={styles.flowLabel}>Income</Text>
                <AdaptiveAmountText style={styles.flowValue} minFontSize={11} value={formatCurrency(monthlyIncome)} />
              </View>
            </View>
            <View style={styles.flowDivider} />
            <View style={styles.flowItem}>
              <View style={[styles.flowIcon, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                <TrendingDown size={13} color="#F87171" />
              </View>
              <View>
                <Text style={styles.flowLabel}>Expenses</Text>
                <AdaptiveAmountText style={styles.flowValue} minFontSize={11} value={formatCurrency(monthlyExpenses)} />
              </View>
            </View>
          </View>
        </LinearGradient>


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
              <Text style={[styles.sectionMeta, { color: theme.colors.textSecondary }]}>This month</Text>
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Activity</Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity style={styles.seeAllBtn}>
                <Text style={[styles.seeAll, { color: theme.colors.primary }]}>See All</Text>
                <ChevronRight size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {recentTransactions.length === 0 ? (
            <View style={[styles.emptyState, {
              backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
              borderColor: theme.colors.border,
              borderWidth: 1,
            }]}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1A332920' : '#F0FDF4' }]}>
                <Plus size={24} color={isDark ? '#34D399' : '#059669'} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No transactions yet</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Tap the button below to start tracking
              </Text>
            </View>
          ) : (
            <View style={[styles.txList, {
              backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
              borderRadius: 14,
              overflow: 'hidden',
            }]}>
              {recentTransactions.map((transaction, index) => (
                <View key={transaction.id}>
                  {index > 0 && (
                    <View style={[styles.txDivider, { backgroundColor: theme.colors.border }]} />
                  )}
                  <TransactionItem
                    transaction={transaction}
                    showActions compact
                    onEdit={() => setEditingTransaction(transaction)}
                    onDelete={() => confirmDeleteTransaction(transaction)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: isDark ? '#16A34A' : '#0D3B2E' }]}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          onLongPress={handleFabLongPress}
          delayLongPress={250}
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
  skeletonWrap: {
    padding: 16,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 18,
    padding: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  heroBalance: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800' as const,
    marginTop: 3,
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 5,
  },
  heroMetaNegative: {
    color: '#FCA5A5',
  },
  negativeBalance: {
    color: '#FCA5A5',
  },
  cashFlowPill: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 2,
  },
  cashFlowPillLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
  },
  cashFlowValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cashFlowPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    flexShrink: 1,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
  },
  flowItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flowIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  flowLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  flowValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
    marginTop: 1,
    flexShrink: 1,
  },
  flowDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
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
  txList: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  txDivider: {
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
    bottom: 24,
    right: 24,
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



















































