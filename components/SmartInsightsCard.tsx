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
  safeToSpend: number;
  balance: number;
  daysLeft: number;
  trendPercent: number;
  trendState: 'up' | 'down' | 'flat';
  topCategoryName: string | null;
  spendingRatio: number;
  healthLevel: 'Excellent' | 'Healthy' | 'Warning';
  healthColor: string;
  trendText: string;
  insights: InsightItem[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

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
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysLeft = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / DAY_MS));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
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

    const safeToSpend = Math.max(0, balance / daysLeft);

    let trendPercent = 0;
    if (previousWeekExpenses > 0) {
      trendPercent = ((lastWeekExpenses - previousWeekExpenses) / previousWeekExpenses) * 100;
    } else if (lastWeekExpenses > 0) {
      trendPercent = 100;
    }

    const trendState: 'up' | 'down' | 'flat' =
      trendPercent > 20 ? 'up' : trendPercent < -20 ? 'down' : 'flat';

    const trendText =
      trendState === 'up'
        ? `Spending increased ${Math.round(trendPercent)}% this week`
        : trendState === 'down'
          ? `Good job, spending decreased ${Math.round(Math.abs(trendPercent))}% this week`
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

    const spendingRatio = monthIncome > 0 ? monthExpenses / monthIncome : monthExpenses > 0 ? Infinity : 0;

    const healthLevel: 'Excellent' | 'Healthy' | 'Warning' =
      spendingRatio < 0.6 ? 'Excellent' : spendingRatio <= 0.8 ? 'Healthy' : 'Warning';
    const healthColor =
      healthLevel === 'Excellent'
        ? theme.colors.success
        : healthLevel === 'Healthy'
          ? theme.colors.warning
          : theme.colors.error;

    const insights: InsightItem[] = [];
    insights.push({
      id: 'weekly-trend',
      message: trendText,
      tone: trendState === 'up' ? 'warning' : trendState === 'down' ? 'positive' : 'neutral',
      icon: trendState === 'up' ? 'up' : trendState === 'down' ? 'down' : 'check',
    });

    if (topCategoryName && topCategoryAmount > 0) {
      insights.push({
        id: 'top-category',
        message: `${topCategoryName} is your largest expense this month`,
        tone: 'neutral',
        icon: 'alert',
      });
    } else {
      const ratioMessage = Number.isFinite(spendingRatio)
        ? `You are spending ${Math.round(spendingRatio * 100)}% of your income`
        : 'No income this month while expenses are recorded';
      insights.push({
        id: 'ratio',
        message: ratioMessage,
        tone: Number.isFinite(spendingRatio) && spendingRatio <= 0.8 ? 'positive' : 'warning',
        icon: Number.isFinite(spendingRatio) && spendingRatio <= 0.8 ? 'check' : 'alert',
      });
    }

    if (transactions.length === 0) {
      return {
        safeToSpend: 0,
        balance: 0,
        daysLeft,
        trendPercent: 0,
        trendState: 'flat',
        topCategoryName: null,
        spendingRatio: 0,
        healthLevel: 'Healthy',
        healthColor: theme.colors.warning,
        trendText: 'Add transactions to generate spending trends',
        insights: [
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
        ],
      };
    }

    return {
      safeToSpend,
      balance,
      daysLeft,
      trendPercent,
      trendState,
      topCategoryName,
      spendingRatio,
      healthLevel,
      healthColor,
      trendText,
      insights: insights.slice(0, 2),
    };
  }, [theme.colors.error, theme.colors.success, theme.colors.warning, transactions]);

  const safeToSpendLabel = React.useMemo(
    () => formatCurrency(Math.max(0, analytics.safeToSpend)),
    [analytics.safeToSpend, formatCurrency]
  );

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
      <Text style={styles.subtitle}>Safe to Spend Today</Text>
      <Text style={styles.safeAmount}>{safeToSpendLabel}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {analytics.daysLeft} {analytics.daysLeft === 1 ? 'day' : 'days'} left this month
        </Text>
        <Text style={styles.metaText}>
          Balance {analytics.balance < 0 ? '-' : ''}
          {formatCurrency(Math.abs(analytics.balance))}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.trendRow}>
        {trendIcon}
        <Text style={[styles.trendText, { color: trendColor }]}>{analytics.trendText}</Text>
      </View>

      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthLabel}>Financial Health</Text>
          <View style={[styles.healthPill, { backgroundColor: `${analytics.healthColor}26` }]}>
            <Text style={[styles.healthPillText, { color: analytics.healthColor }]}>{analytics.healthLevel}</Text>
          </View>
        </View>
        <View style={styles.healthTrack}>
          <View style={[styles.healthFill, { width: `${ratioPercent}%`, backgroundColor: analytics.healthColor }]} />
        </View>
      </View>

      <View style={styles.insightsWrap}>
        {analytics.insights.map((insight) => {
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
