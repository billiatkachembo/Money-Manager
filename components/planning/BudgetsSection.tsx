import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

interface BudgetFormState {
  categoryId: string;
  amount: string;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseIsoDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function BudgetsSection() {
  const { theme } = useTheme();
  const {
    budgets,
    addBudget,
    formatCurrency,
    getBudgetSpending,
    getBudgetCategories,
  } = useTransactionStore();

  const budgetCategories = getBudgetCategories();

  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newBudget, setNewBudget] = useState<BudgetFormState>({
    categoryId: '',
    amount: '',
    period: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
  });

  const ensureDefaults = () => {
    setNewBudget((current) => ({
      ...current,
      categoryId: current.categoryId || budgetCategories[0]?.id || '',
      startDate: current.startDate || new Date().toISOString().slice(0, 10),
    }));
  };

  const toggleAddBudgetForm = () => {
    setShowAddBudget((previous) => {
      const next = !previous;
      if (next) {
        ensureDefaults();
      }
      return next;
    });
  };

  const addNewBudget = () => {
    if (!newBudget.categoryId || !newBudget.amount || !newBudget.startDate) {
      Alert.alert('Error', 'Please provide category, amount, and start date');
      return;
    }

    const amount = parsePositiveNumber(newBudget.amount);
    if (!amount) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }

    const startDate = parseIsoDateInput(newBudget.startDate.trim());
    if (!startDate) {
      Alert.alert('Error', 'Please enter a valid date in YYYY-MM-DD format');
      return;
    }

    const selectedCategory = budgetCategories.find((category) => category.id === newBudget.categoryId);
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a budget category');
      return;
    }

    try {
      addBudget({
        categoryId: selectedCategory.id,
        category: selectedCategory,
        amount,
        period: newBudget.period,
        startDate,
        alertAt80Percent: true,
        alertAtLimit: true,
      });

      setNewBudget({
        categoryId: budgetCategories[0]?.id || '',
        amount: '',
        period: 'monthly',
        startDate: new Date().toISOString().slice(0, 10),
      });
      setShowAddBudget(false);
      Alert.alert('Success', 'Budget created successfully');
    } catch {
      Alert.alert('Error', 'Failed to create budget');
    }
  };

  const categoryChipBackground = useMemo(() => theme.colors.primary + '14', [theme.colors.primary]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Budget Tracking</Text>
        <TouchableOpacity
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Add budget"
          onPress={toggleAddBudgetForm}
        >
          <Plus size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {showAddBudget && (
        <View style={[styles.addGoalForm, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.formLabel, { color: theme.colors.text }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryChipsScroll}>
            <View style={styles.categoryChipsRow}>
              {budgetCategories.map((category) => {
                const isSelected = newBudget.categoryId === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      { borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                      isSelected && { backgroundColor: categoryChipBackground },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${category.name} budget category`}
                    onPress={() => setNewBudget((current) => ({ ...current, categoryId: category.id }))}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Budget amount"
            placeholderTextColor={theme.colors.textSecondary}
            value={newBudget.amount}
            onChangeText={(text) => setNewBudget((current) => ({ ...current, amount: text }))}
            keyboardType="numeric"
          />

          <Text style={[styles.formLabel, { color: theme.colors.text }]}>Period</Text>
          <View style={styles.periodButtonsRow}>
            {(['weekly', 'monthly', 'yearly'] as const).map((period) => {
              const isSelected = newBudget.period === period;
              return (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    { borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                    isSelected && { backgroundColor: categoryChipBackground },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Set budget period to ${period}`}
                  onPress={() => setNewBudget((current) => ({ ...current, period }))}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.textSecondary}
            value={newBudget.startDate}
            onChangeText={(text) => setNewBudget((current) => ({ ...current, startDate: text }))}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Add budget"
              onPress={addNewBudget}
            >
              <Text style={styles.saveButtonText}>Add Budget</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel budget form"
              onPress={() => setShowAddBudget(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {budgets.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}
          >
            No budgets set yet. Tap + to create one.
          </Text>
        </View>
      ) : (
        budgets.map((budget) => {
          const spent = getBudgetSpending(budget.id);
          const percentage = budget.amount ? (spent / budget.amount) * 100 : 0;
          const isOverBudget = percentage > 100;

          return (
            <View
              key={budget.id}
              style={[styles.budgetCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              accessibilityRole="summary"
              accessibilityLabel={`${budget.category?.name ?? 'Uncategorized'} budget card`}
            >
              <View style={styles.budgetHeader}>
                <Text style={[styles.budgetCategory, { color: theme.colors.text }]}
                >
                  {budget.category?.name || 'Uncategorized'}
                </Text>
                <Text style={[styles.budgetPeriod, { color: theme.colors.textSecondary }]}
                >
                  {budget.period}
                </Text>
              </View>

              <View style={styles.budgetProgress}>
                <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: isOverBudget ? theme.colors.error : theme.colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressText,
                    { color: isOverBudget ? theme.colors.error : theme.colors.text },
                  ]}
                >
                  {percentage.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.budgetDetails}>
                <Text style={[styles.budgetAmount, { color: theme.colors.text }]}
                >
                  {formatCurrency(spent)} / {formatCurrency(budget.amount)}
                </Text>
                <Text
                  style={[
                    styles.budgetRemaining,
                    { color: isOverBudget ? theme.colors.error : theme.colors.success },
                  ]}
                >
                  {isOverBudget
                    ? `Over by ${formatCurrency(spent - budget.amount)}`
                    : `${formatCurrency(budget.amount - spent)} remaining`}
                </Text>
              </View>
            </View>
          );
        })
      )}
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
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryChipsScroll: {
    marginBottom: 12,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  periodButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '500',
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
  budgetCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetCategory: {
    fontSize: 16,
    fontWeight: '600',
  },
  budgetPeriod: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  budgetProgress: {
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
  budgetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  budgetRemaining: {
    fontSize: 12,
    fontWeight: '500',
  },
});
