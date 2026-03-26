import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { DollarSign, Edit3, PiggyBank, Plus, Target, Trash2, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { formatDateDDMMYYYY, formatDateWithWeekday, parseDateInput } from '@/utils/date';
import { useTransactionStore } from '@/store/transaction-store';
import type { FinancialGoal } from '@/types/transaction';

const GOAL_ICON_CONFIG = {
  emergency: { Icon: PiggyBank, color: '#e74c3c' },
  investment: { Icon: TrendingUp, color: '#27ae60' },
  debt: { Icon: DollarSign, color: '#f39c12' },
  savings: { Icon: Target, color: '#3498db' },
} as const;

const PRIORITY_COLORS: Record<string, string> = {
  high: '#e74c3c',
  medium: '#f39c12',
  low: '#95a5a6',
};

function parsePositiveNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseIsoDateInput(value: string): Date | null {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function calculateProgress(current: number, target: number) {
  if (!target) {
    return 0;
  }
  return Math.min((current / target) * 100, 100);
}

function estimateMonthlyContribution(goal: FinancialGoal, now: Date) {
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) {
    return null;
  }

  const diffMs = goal.targetDate.getTime() - now.getTime();
  if (diffMs <= 0) {
    return null;
  }

  const monthsRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
  return { monthsRemaining, monthlyRequired: remaining / monthsRemaining };
}

export function GoalsSection() {
  const { theme } = useTheme();
  const {
    financialGoals,
    addFinancialGoal,
    updateFinancialGoal,
    deleteFinancialGoal,
    formatCurrency,
  } = useTransactionStore();

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [goalForm, setGoalForm] = useState<{
  title: string;
  targetAmount: string;
  targetDate: string;
  category: FinancialGoal['category'];
}>({
  title: '',
  targetAmount: '',
  targetDate: '',
  category: 'savings',
});

  const today = useMemo(() => new Date(), []);

  const goalTips = useMemo(() => {
    if (financialGoals.length === 0) {
      return [
        'Start with one clear goal, one target amount, and one realistic deadline so progress is easy to track.',
        'Name the goal after the outcome you want, like Emergency Fund or School Fees, to keep motivation high.',
        'Automate even a small transfer after every income payment so the goal grows before other spending happens.',
      ];
    }

    const sortedGoals = [...financialGoals].sort(
      (left, right) => left.targetDate.getTime() - right.targetDate.getTime()
    );
    const nextGoal = sortedGoals[0];
    const monthlyContribution = estimateMonthlyContribution(nextGoal, today);
    const almostCompleteGoal = sortedGoals.find((goal) => {
      const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
      return progress >= 75 && goal.currentAmount < goal.targetAmount;
    });
    const overdueGoal = sortedGoals.find(
      (goal) => goal.targetDate.getTime() < today.getTime() && goal.currentAmount < goal.targetAmount
    );

    return [
      monthlyContribution
        ? `To stay on pace for ${nextGoal.title}, aim to set aside about ${formatCurrency(monthlyContribution.monthlyRequired)} each month.`
        : `Review ${nextGoal.title} and adjust the deadline or contribution amount so the plan stays realistic.`,
      almostCompleteGoal
        ? `${almostCompleteGoal.title} is close to complete. Protect that momentum by avoiding withdrawals until it is fully funded.`
        : 'Focus on one or two top-priority goals at a time so your monthly cash flow is not spread too thin.',
      overdueGoal
        ? `${overdueGoal.title} is already past its target date. Update the goal or increase contributions so it becomes achievable again.`
        : 'Review your goals at least once a month and raise contributions whenever income increases.',
    ];
  }, [financialGoals, formatCurrency, today]);

  const resetForm = () => {
    setGoalForm({ title: '', targetAmount: '', targetDate: '', category: 'savings' });
    setEditingGoal(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowGoalForm(true);
  };

  const openEditForm = (goal: FinancialGoal) => {
    setGoalForm({
      title: goal.title,
      targetAmount: goal.targetAmount.toString(),
      targetDate: formatDateDDMMYYYY(goal.targetDate),
      category: goal.category,
    });
    setEditingGoal(goal);
    setShowGoalForm(true);
  };

  const closeForm = () => {
    setShowGoalForm(false);
    resetForm();
  };

  const saveGoal = () => {
    const trimmedTitle = goalForm.title.trim();
    const trimmedDate = goalForm.targetDate.trim();
    const targetAmount = parsePositiveNumber(goalForm.targetAmount);

    if (!trimmedTitle || !goalForm.targetAmount || !trimmedDate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!targetAmount) {
      Alert.alert('Error', 'Please enter a valid target amount');
      return;
    }

    if (!/^(?:\d{2}[/-]\d{2}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2})$/.test(trimmedDate)) {
      Alert.alert('Error', 'Enter the target date as DD/MM/YYYY');
      return;
    }

    const parsedTargetDate = parseIsoDateInput(trimmedDate);
    if (!parsedTargetDate) {
      Alert.alert('Error', 'Please enter a valid target date');
      return;
    }

    try {
      if (editingGoal) {
        updateFinancialGoal({
          ...editingGoal,
          title: trimmedTitle,
          targetAmount,
          targetDate: parsedTargetDate,
          category: goalForm.category,
        });
        Alert.alert('Success', 'Goal updated successfully');
      } else {
        addFinancialGoal({
          title: trimmedTitle,
          targetAmount,
          currentAmount: 0,
          targetDate: parsedTargetDate,
          category: goalForm.category,
          priority: 'medium',
        });
        Alert.alert('Success', 'Goal added successfully');
      }

      closeForm();
    } catch {
      Alert.alert('Error', editingGoal ? 'Failed to update goal' : 'Failed to add goal');
    }
  };

  const getCategoryIcon = (category: string) => {
    const config = GOAL_ICON_CONFIG[category as keyof typeof GOAL_ICON_CONFIG] ?? GOAL_ICON_CONFIG.savings;
    const IconComponent = config.Icon;
    return <IconComponent size={20} color={config.color} />;
  };

  const getPriorityColor = (priority: string) => {
    return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low;
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Financial Goals</Text>
        <TouchableOpacity
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add financial goal"
          onPress={openAddForm}
        >
          <Plus size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {showGoalForm && (
        <View
          style={[styles.addGoalForm, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Goal title"
            placeholderTextColor={theme.colors.textSecondary}
            value={goalForm.title}
            onChangeText={(text) => setGoalForm((current) => ({ ...current, title: text }))}
          />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Target amount"
            placeholderTextColor={theme.colors.textSecondary}
            value={goalForm.targetAmount}
            onChangeText={(text) => setGoalForm((current) => ({ ...current, targetAmount: text }))}
            keyboardType="numeric"
          />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Target date (DD/MM/YYYY)"
            placeholderTextColor={theme.colors.textSecondary}
            value={goalForm.targetDate}
            onChangeText={(text) => setGoalForm((current) => ({ ...current, targetDate: text }))}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={editingGoal ? 'Update goal' : 'Add goal'}
              onPress={saveGoal}
            >
              <Text style={styles.saveButtonText}>{editingGoal ? 'Update Goal' : 'Add Goal'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel goal form"
              onPress={closeForm}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {financialGoals.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}
          >
            No financial goals yet. Add one to get started!
          </Text>
        </View>
      ) : (
        financialGoals.map((goal) => {
          const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
          const contribution = estimateMonthlyContribution(goal, today);
          return (
            <View
              key={goal.id}
              style={[styles.goalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              accessibilityRole="summary"
              accessibilityLabel={`${goal.title} goal card`}
            >
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleRow}>
                  {getCategoryIcon(goal.category)}
                  <Text style={[styles.goalTitle, { color: theme.colors.text }]}>{goal.title}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(goal.priority) }]}
                  >
                    <Text style={styles.priorityText}>{goal.priority}</Text>
                  </View>
                </View>
                <View style={styles.goalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${goal.title}`}
                    onPress={() => openEditForm(goal)}
                  >
                    <Edit3 size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${goal.title}`}
                    onPress={() => {
                      Alert.alert('Delete Goal', 'Are you sure you want to delete this goal?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => deleteFinancialGoal(goal.id),
                        },
                      ]);
                    }}
                  >
                    <Trash2 size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.goalProgress}>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: theme.colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%`, backgroundColor: theme.colors.primary },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}
                >
                  {progress.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.goalDetails}>
                <View style={styles.amountRow}>
                  <Text style={[styles.currentAmount, { color: theme.colors.text }]}
                  >
                    {formatCurrency(goal.currentAmount)}
                  </Text>
                  <Text style={[styles.targetAmount, { color: theme.colors.textSecondary }]}
                  >
                    / {formatCurrency(goal.targetAmount)}
                  </Text>
                </View>
                <Text style={[styles.targetDate, { color: theme.colors.textSecondary }]}
                >
                  Target: {formatDateWithWeekday(goal.targetDate)}
                </Text>
              </View>

              {contribution && (
                <View style={styles.contributionRow}>
                  <Text style={[styles.contributionLabel, { color: theme.colors.textSecondary }]}
                  >
                    Suggested monthly:
                  </Text>
                  <Text style={[styles.contributionValue, { color: theme.colors.text }]}
                  >
                    {formatCurrency(contribution.monthlyRequired)}
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={[styles.tipsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.tipsTitle, { color: theme.colors.text }]}>Goal Tips</Text>
        {goalTips.map((tip, index) => (
          <View key={`goal-tip-${index}`} style={styles.tipRow}>
            <View style={[styles.tipBadge, { backgroundColor: theme.colors.primary + '18' }]}>
              <Text style={[styles.tipBadgeText, { color: theme.colors.primary }]}>{index + 1}</Text>
            </View>
            <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  addGoalForm: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  goalCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  goalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  goalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  targetAmount: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  targetDate: {
    fontSize: 12,
  },
  contributionRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contributionLabel: {
    fontSize: 12,
  },
  contributionValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  tipsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  tipBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});

