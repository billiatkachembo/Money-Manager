import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, CalendarClock, PiggyBank, TrendingUp } from 'lucide-react-native';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { formatDateWithWeekday } from '@/utils/date';
import type { FinancialGoal } from '@/types/transaction';

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function estimateMonthlyNeed(goal: FinancialGoal, today: Date) {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) {
    return 0;
  }

  const diffMs = goal.targetDate.getTime() - today.getTime();
  if (diffMs <= 0) {
    return remaining;
  }

  const monthsRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
  return remaining / monthsRemaining;
}

function formatSignedCurrency(formatCurrency: (value: number) => string, value: number) {
  return `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
}

export function PlanningOverviewCard() {
  const { theme } = useTheme();
  const { transactions, budgets, financialGoals, getBudgetSpending, formatCurrency } = useTransactionStore();

  const today = useMemo(() => new Date(), []);
  const currentMonthKey = toMonthKey(today);

  const currentMonthNet = useMemo(() => {
    return transactions.reduce((total, transaction) => {
      if (toMonthKey(transaction.date) !== currentMonthKey) {
        return total;
      }

      if (transaction.type === 'income') {
        return total + transaction.amount;
      }

      if (transaction.type === 'expense') {
        return total - transaction.amount;
      }

      return total;
    }, 0);
  }, [currentMonthKey, transactions]);

  const activeGoals = useMemo(
    () => financialGoals.filter((goal) => goal.targetAmount > goal.currentAmount),
    [financialGoals]
  );

  const totalGoalGap = useMemo(
    () => activeGoals.reduce((total, goal) => total + Math.max(0, goal.targetAmount - goal.currentAmount), 0),
    [activeGoals]
  );

  const requiredMonthlyPace = useMemo(
    () => activeGoals.reduce((total, goal) => total + estimateMonthlyNeed(goal, today), 0),
    [activeGoals, today]
  );

  const nextTargetGoal = useMemo(() => {
    return activeGoals
      .filter((goal) => goal.targetDate.getTime() >= today.getTime())
      .sort((left, right) => left.targetDate.getTime() - right.targetDate.getTime())[0] ?? null;
  }, [activeGoals, today]);

  const budgetHealth = useMemo(() => {
    let atRisk = 0;
    let overBudget = 0;

    for (const budget of budgets) {
      if (budget.amount <= 0) {
        continue;
      }

      const spent = getBudgetSpending(budget.id);
      const ratio = spent / budget.amount;
      if (ratio >= 1) {
        overBudget += 1;
      } else if (ratio >= 0.8) {
        atRisk += 1;
      }
    }

    return { atRisk, overBudget };
  }, [budgets, getBudgetSpending]);

  const statusMessage = nextTargetGoal
    ? `Set aside about ${formatCurrency(requiredMonthlyPace)} per month to stay on pace for ${activeGoals.length} active goal${activeGoals.length === 1 ? '' : 's'}.`
    : budgetHealth.atRisk > 0 || budgetHealth.overBudget > 0
      ? `${budgetHealth.atRisk} budget${budgetHealth.atRisk === 1 ? '' : 's'} are nearing the limit and ${budgetHealth.overBudget} ${budgetHealth.overBudget === 1 ? 'is' : 'are'} already over.`
      : 'Create goals and budgets to turn your transaction history into a clearer monthly plan.';

  return (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>Planning Snapshot</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>Overview</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{statusMessage}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.border }]}>
            <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{activeGoals.length} active goals</Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>Goal gap</Text>
          <AdaptiveAmountText
            style={[styles.heroValue, { color: theme.colors.text }]}
            minFontSize={16}
            value={formatCurrency(totalGoalGap)}
          />
          <Text style={[styles.heroHint, { color: theme.colors.textSecondary }]}>Remaining across all active financial goals.</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: theme.colors.primary + '14' }]}>
              <PiggyBank size={16} color={theme.colors.primary} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Need / month</Text>
            <AdaptiveAmountText
              style={[styles.metricValue, { color: theme.colors.text }]}
              minFontSize={12}
              value={formatCurrency(requiredMonthlyPace)}
            />
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: theme.colors.warning + '16' }]}>
              <AlertTriangle size={16} color={theme.colors.warning} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Budgets at risk</Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>{budgetHealth.atRisk + budgetHealth.overBudget}</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: theme.colors.success + '16' }]}>
              <TrendingUp size={16} color={theme.colors.success} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>This month net</Text>
            <AdaptiveAmountText
              style={[
                styles.metricValue,
                { color: currentMonthNet >= 0 ? theme.colors.success : theme.colors.error },
              ]}
              minFontSize={12}
              value={formatSignedCurrency(formatCurrency, currentMonthNet)}
            />
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <View style={styles.footerHeader}>
            <CalendarClock size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.footerLabel, { color: theme.colors.textSecondary }]}>Next target</Text>
          </View>
          <Text style={[styles.footerValue, { color: theme.colors.text }]}>
            {nextTargetGoal ? `${nextTargetGoal.title} • ${formatDateWithWeekday(nextTargetGoal.targetDate)}` : 'No upcoming goal date yet'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hero: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  heroValue: {
    fontSize: 30,
    fontWeight: '800',
  },
  heroHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 6,
  },
  footerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});