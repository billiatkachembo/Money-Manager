import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { Transaction } from '@/types/transaction';

type InsightTone = 'positive' | 'warning' | 'neutral';
type InsightIcon = 'check' | 'alert' | 'up' | 'down';

interface InsightItem {
  id: string;
  message: string;
  tone: InsightTone;
  icon: InsightIcon;
}

interface AnalyticsSummary {
  dailyBudgetRemaining: number;
  remainingBudget: number;
  balance: number;
  daysLeft: number;
  daysPassed: number;
  totalDaysInMonth: number;
  monthProgress: number;
  monthIncome: number;
  monthExpenses: number;
  trendPercent: number;
  trendState: 'up' | 'down' | 'flat';
  topCategoryName: string | null;
  spendingRatio: number;
  healthLevel: 'Excellent' | 'Healthy' | 'Risk' | 'Overspending';
  trendText: string;
  projectedMonthEndBalance: number;
  dailyBurnRate: number;
  daysUntilEmpty: number | null;
  expectedSpendSoFar: number;
  spendingPace: number;
  isEmpty: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function clampInsightPercent(value: number, allowNegative = false): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  return Math.min(100, Math.max(allowNegative ? -100 : 0, rounded));
}


function parseTransactionDate(value: Transaction['date']): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getCategoryName(category: Transaction['category'] | string): string {
  if (typeof category === 'string') {
    return category.trim() || 'Other';
  }

  if (category && typeof category === 'object' && 'name' in category) {
    const name = String(category.name ?? '').trim();
    return name || 'Other';
  }

  return 'Other';
}

export const SmartInsightsCard = React.memo(function SmartInsightsCard() {
  const { theme } = useTheme();
  const { transactions, formatCurrency } = useTransactionStore();

  const gradientColors = React.useMemo<[string, string]>(
    () => (theme.isDark ? ['#2c2c2c', '#3b3b3b'] : ['#4facfe', '#00f2fe']),
    [theme.isDark]
  );

  const analytics = React.useMemo<AnalyticsSummary>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const daysLeft = Math.max(1, totalDaysInMonth - daysPassed + 1);
    const monthProgress = Math.min(1, Math.max(0, daysPassed / totalDaysInMonth));
    const monthStart = new Date(year, month, 1);
    const sevenDaysAgo = new Date(now.getTime() - DAY_MS * 7);
    const fourteenDaysAgo = new Date(now.getTime() - DAY_MS * 14);
    const thirtyDaysAgo = new Date(now.getTime() - DAY_MS * 30);

    let balance = 0;
    let lastWeekExpenses = 0;
    let previousWeekExpenses = 0;
    let monthIncome = 0;
    let monthExpenses = 0;
    const categoryTotals = new Map<string, number>();

    for (const transaction of transactions) {
      const rawAmount = Number(transaction.amount);
      const amount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;
      if (amount <= 0) {
        continue;
      }

      if (transaction.type === 'income') {
        balance += amount;
      } else if (transaction.type === 'expense') {
        balance -= amount;
      }

      if (transaction.type === 'transfer') {
        continue;
      }

      const date = parseTransactionDate(transaction.date);
      if (!date) {
        continue;
      }

      if (date >= monthStart && date <= now) {
        if (transaction.type === 'income') {
          monthIncome += amount;
        } else if (transaction.type === 'expense') {
          monthExpenses += amount;
        }
      }

      if (transaction.type === 'expense') {
        if (date >= sevenDaysAgo && date <= now) {
          lastWeekExpenses += amount;
        } else if (date >= fourteenDaysAgo && date < sevenDaysAgo) {
          previousWeekExpenses += amount;
        }

        if (date >= thirtyDaysAgo && date <= now) {
          const categoryName = getCategoryName(transaction.category);
          categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + amount);
        }
      }
    }

    const remainingBudget = Math.max(0, monthIncome - monthExpenses);
    const dailyBudgetRemaining = remainingBudget / daysLeft;

    let trendPercent = 0;
    if (previousWeekExpenses > 0) {
      trendPercent = ((lastWeekExpenses - previousWeekExpenses) / previousWeekExpenses) * 100;
    } else if (lastWeekExpenses > 0) {
      trendPercent = 100;
    }

    const trendState: 'up' | 'down' | 'flat' =
      trendPercent > 20 ? 'up' : trendPercent < -20 ? 'down' : 'flat';

    const clampedTrendPercent = clampInsightPercent(Math.abs(trendPercent));

    const trendText =
      trendState === 'up'
        ? `Spending increased ${clampedTrendPercent}% this week`
        : trendState === 'down'
          ? `Good job, spending decreased ${clampedTrendPercent}% this week`
          : previousWeekExpenses === 0 && lastWeekExpenses === 0
            ? 'No expense activity in the last 14 days'
            : 'Spending is stable versus last week';

    let topCategoryName: string | null = null;
    let topCategoryAmount = 0;
    for (const [categoryName, amount] of categoryTotals.entries()) {
      if (amount > topCategoryAmount) {
        topCategoryName = categoryName;
        topCategoryAmount = amount;
      }
    }

    if (topCategoryAmount === 0) {
      topCategoryName = null;
    }

    const spendingRatio = monthIncome > 0 ? monthExpenses / monthIncome : monthExpenses > 0 ? Infinity : 0;

    const healthLevel: 'Excellent' | 'Healthy' | 'Risk' | 'Overspending' =
      spendingRatio < 0.6
        ? 'Excellent'
        : spendingRatio <= 0.8
          ? 'Healthy'
          : spendingRatio <= 1
            ? 'Risk'
            : 'Overspending';

    const expectedSpendSoFar = monthIncome * monthProgress;
    const spendingPace =
      expectedSpendSoFar > 0 ? monthExpenses / expectedSpendSoFar : monthExpenses > 0 ? Infinity : 0;

    const dailyBurnRate = daysPassed > 0 ? monthExpenses / daysPassed : 0;
    const projectedMonthlyExpenses = dailyBurnRate * totalDaysInMonth;
    const projectedMonthEndBalance = monthIncome - projectedMonthlyExpenses;
    const daysUntilEmpty = dailyBurnRate > 0 && balance > 0 ? balance / dailyBurnRate : null;

    const isEmpty = transactions.length === 0;

    return {
      dailyBudgetRemaining,
      remainingBudget,
      balance,
      daysLeft,
      daysPassed,
      totalDaysInMonth,
      monthProgress,
      monthIncome,
      monthExpenses,
      trendPercent,
      trendState,
      topCategoryName,
      spendingRatio,
      healthLevel,
      trendText: isEmpty ? 'Add transactions to generate spending trends' : trendText,
      projectedMonthEndBalance,
      dailyBurnRate,
      daysUntilEmpty,
      expectedSpendSoFar,
      spendingPace,
      isEmpty,
    };
  }, [transactions]);

  const dailyBudgetLabel = React.useMemo(
    () => formatCurrency(Math.max(0, analytics.dailyBudgetRemaining)),
    [analytics.dailyBudgetRemaining, formatCurrency]
  );

  const monthProgressPercent = Math.min(100, Math.max(0, Math.round(analytics.monthProgress * 100)));

  const healthColor = React.useMemo(() => {
    if (analytics.healthLevel === 'Excellent') {
      return theme.colors.success;
    }

    if (analytics.healthLevel === 'Healthy') {
      return theme.colors.warning;
    }

    if (analytics.healthLevel === 'Risk') {
      return '#FB923C';
    }

    return theme.colors.error;
  }, [analytics.healthLevel, theme.colors.error, theme.colors.success, theme.colors.warning]);

  const trendColor =
    analytics.trendState === 'up'
      ? '#FCA5A5'
      : analytics.trendState === 'down'
        ? '#86EFAC'
        : 'rgba(255,255,255,0.82)';

  const trendIcon =
    analytics.trendState === 'up' ? (
      <TrendingUp size={14} color={trendColor} />
    ) : analytics.trendState === 'down' ? (
      <TrendingDown size={14} color={trendColor} />
    ) : (
      <CheckCircle size={14} color={trendColor} />
    );

  const spendingPaceSummary = React.useMemo(() => {
    if (analytics.isEmpty) {
      return {
        message: 'Add income and expenses to track your spending pace',
        tone: 'neutral' as InsightTone,
        icon: 'check' as InsightIcon,
      };
    }

    if (analytics.expectedSpendSoFar <= 0) {
      if (analytics.monthExpenses > 0) {
        return {
          message: 'No income recorded yet, but expenses are rising this month',
          tone: 'warning' as InsightTone,
          icon: 'alert' as InsightIcon,
        };
      }

      return {
        message: 'Log income to compare your spending pace',
        tone: 'neutral' as InsightTone,
        icon: 'check' as InsightIcon,
      };
    }

    const deviation = clampInsightPercent(Math.abs(analytics.spendingPace - 1) * 100);

    if (analytics.spendingPace > 1.05) {
      return {
        message: `You are spending ${deviation}% faster than your income pace`,
        tone: 'warning' as InsightTone,
        icon: 'up' as InsightIcon,
      };
    }

    if (analytics.spendingPace < 0.95) {
      return {
        message: `You are spending ${deviation}% slower than your income pace`,
        tone: 'positive' as InsightTone,
        icon: 'down' as InsightIcon,
      };
    }

    return {
      message: 'Spending pace is on track with your income',
      tone: 'neutral' as InsightTone,
      icon: 'check' as InsightIcon,
    };
  }, [analytics.expectedSpendSoFar, analytics.isEmpty, analytics.monthExpenses, analytics.spendingPace]);

  const paceColor =
    spendingPaceSummary.tone === 'positive'
      ? '#86EFAC'
      : spendingPaceSummary.tone === 'warning'
        ? '#FCA5A5'
        : 'rgba(255,255,255,0.82)';

  const paceIcon =
    spendingPaceSummary.icon === 'check' ? (
      <CheckCircle size={14} color={paceColor} />
    ) : spendingPaceSummary.icon === 'alert' ? (
      <AlertTriangle size={14} color={paceColor} />
    ) : spendingPaceSummary.icon === 'up' ? (
      <TrendingUp size={14} color={paceColor} />
    ) : (
      <TrendingDown size={14} color={paceColor} />
    );

  const daysUntilEmptySummary = React.useMemo(() => {
    if (analytics.isEmpty || analytics.daysUntilEmpty === null || !Number.isFinite(analytics.daysUntilEmpty)) {
      return null;
    }

    const rounded = Math.max(0, Math.floor(analytics.daysUntilEmpty));

    if (rounded <= 0) {
      return {
        message: 'Your balance may run out before the end of the month.',
        tone: 'warning' as InsightTone,
      };
    }

    if (rounded < analytics.daysLeft) {
      return {
        message: `Your balance may run out before the end of the month. At this pace it may last ${rounded} days.`,
        tone: 'warning' as InsightTone,
      };
    }

    return {
      message: `At this pace your balance may last ${rounded} days`,
      tone: 'neutral' as InsightTone,
    };
  }, [analytics.daysLeft, analytics.daysUntilEmpty, analytics.isEmpty]);

  const insights = React.useMemo<InsightItem[]>(() => {
    if (analytics.isEmpty) {
      return [
        {
          id: 'empty-1',
          message: 'Add transactions to unlock smart financial insights',
          tone: 'neutral',
          icon: 'check',
        },
        {
          id: 'empty-2',
          message: 'Track expenses to calculate category and trend analysis',
          tone: 'neutral',
          icon: 'alert',
        },
        {
          id: 'empty-3',
          message: 'Monthly projections appear once income and expenses are recorded',
          tone: 'neutral',
          icon: 'alert',
        },
      ];
    }

    const items: InsightItem[] = [];

    items.push({
      id: 'weekly-trend',
      message: analytics.trendText,
      tone: analytics.trendState === 'up' ? 'warning' : analytics.trendState === 'down' ? 'positive' : 'neutral',
      icon: analytics.trendState === 'up' ? 'up' : analytics.trendState === 'down' ? 'down' : 'check',
    });

    if (analytics.topCategoryName) {
      items.push({
        id: 'top-category',
        message: `${analytics.topCategoryName} is your largest expense this month`,
        tone: 'neutral',
        icon: 'alert',
      });
    } else {
      let ratioMessage = 'You are spending 0% of your income';
      let ratioTone: InsightTone = 'neutral';
      let ratioIcon: InsightIcon = 'check';

      if (analytics.monthIncome <= 0 && analytics.monthExpenses > 0) {
        ratioMessage = 'No income this month while expenses are recorded';
        ratioTone = 'warning';
        ratioIcon = 'alert';
      } else if (Number.isFinite(analytics.spendingRatio)) {
        if (analytics.spendingRatio > 1) {
          ratioMessage = `Your expenses exceed income by ${clampInsightPercent((analytics.spendingRatio - 1) * 100)}%`;
          ratioTone = 'warning';
          ratioIcon = 'alert';
        } else {
          ratioMessage = `You are spending ${clampInsightPercent(analytics.spendingRatio * 100)}% of your income`;
          ratioTone = analytics.spendingRatio <= 0.8 ? 'positive' : analytics.spendingRatio <= 1 ? 'neutral' : 'warning';
          ratioIcon = analytics.spendingRatio <= 0.8 ? 'check' : analytics.spendingRatio <= 1 ? 'check' : 'alert';
        }
      } else {
        ratioMessage = 'No income this month while expenses are recorded';
        ratioTone = 'warning';
        ratioIcon = 'alert';
      }

      items.push({
        id: 'ratio',
        message: ratioMessage,
        tone: ratioTone,
        icon: ratioIcon,
      });
    }

    const projectedAbs = Math.abs(analytics.projectedMonthEndBalance);
    const projectionMessage =
      analytics.projectedMonthEndBalance >= 0
        ? `Projected month-end balance: +${formatCurrency(projectedAbs)}`
        : `You may overspend by ${formatCurrency(projectedAbs)} this month`;

    items.push({
      id: 'projected-balance',
      message: projectionMessage,
      tone: analytics.projectedMonthEndBalance >= 0 ? 'positive' : 'warning',
      icon: analytics.projectedMonthEndBalance >= 0 ? 'up' : 'down',
    });

    return items.slice(0, 3);
  }, [analytics, formatCurrency]);

  const ratioPercent = Number.isFinite(analytics.spendingRatio)
    ? Math.min(100, Math.max(0, Math.round(analytics.spendingRatio * 100)))
    : 100;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Text style={styles.title}>Smart Insights</Text>
      <Text style={styles.subtitle}>Daily Budget Remaining</Text>
      <Text style={styles.safeAmount}>
        {dailyBudgetLabel}
        <Text style={styles.perDay}> /day</Text>
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {analytics.daysLeft} {analytics.daysLeft === 1 ? 'day' : 'days'} left this month
        </Text>
        <Text style={styles.metaText}>
          Balance {analytics.balance < 0 ? '-' : ''}
          {formatCurrency(Math.abs(analytics.balance))}
        </Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Month Progress</Text>
          <Text style={styles.progressValue}>{monthProgressPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${monthProgressPercent}%` }]} />
        </View>
        {daysUntilEmptySummary ? (
          <Text
            style={[
              styles.progressHint,
              daysUntilEmptySummary.tone === 'warning' ? styles.warningText : null,
            ]}
          >
            {daysUntilEmptySummary.message}
          </Text>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.trendRow}>
        {trendIcon}
        <Text style={[styles.trendText, { color: trendColor }]}>{analytics.trendText}</Text>
      </View>

      <View style={styles.paceRow}>
        {paceIcon}
        <Text style={[styles.paceText, { color: paceColor }]}>{spendingPaceSummary.message}</Text>
      </View>

      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthLabel}>Financial Health</Text>
          <View style={[styles.healthPill, { backgroundColor: `${healthColor}26` }]}>
            <Text style={[styles.healthPillText, { color: healthColor }]}>{analytics.healthLevel}</Text>
          </View>
        </View>
        <View style={styles.healthTrack}>
          <View style={[styles.healthFill, { width: `${ratioPercent}%`, backgroundColor: healthColor }]} />
        </View>
      </View>

      <View style={styles.insightsWrap}>
        {insights.map((insight) => {
          const insightColor =
            insight.tone === 'positive'
              ? '#86EFAC'
              : insight.tone === 'warning'
                ? '#FCA5A5'
                : 'rgba(255,255,255,0.92)';

          const icon =
            insight.icon === 'check' ? (
              <CheckCircle size={14} color={insightColor} />
            ) : insight.icon === 'alert' ? (
              <AlertTriangle size={14} color={insightColor} />
            ) : insight.icon === 'up' ? (
              <TrendingUp size={14} color={insightColor} />
            ) : (
              <TrendingDown size={14} color={insightColor} />
            );

          return (
            <View key={insight.id} style={styles.insightRow}>
              {icon}
              <Text style={[styles.insightText, { color: insightColor }]}>{insight.message}</Text>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
});

SmartInsightsCard.displayName = 'SmartInsightsCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 16,
    overflow: 'hidden',
  },
  title: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  safeAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  perDay: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '500',
  },
  progressSection: {
    marginTop: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  progressValue: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  progressHint: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  warningText: {
    color: '#FCA5A5',
  },
  divider: {
    marginTop: 14,
    marginBottom: 10,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  paceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  healthSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  healthLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  healthPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  healthPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  healthTrack: {
    height: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: 8,
  },
  insightsWrap: {
    marginTop: 6,
    gap: 7,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
});
