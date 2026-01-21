import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {
  Target,
  TrendingUp,
  PiggyBank,
  Calculator,
  DollarSign,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

export default function PlanningScreen() {
  const { theme } = useTheme();
  const { financialGoals, addFinancialGoal, deleteFinancialGoal, budgets, formatCurrency, getBudgetSpending } = useTransactionStore();
  const [activeSection, setActiveSection] = useState<'goals' | 'budgets' | 'calculator'>('goals');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    targetAmount: '',
    targetDate: '',
    category: 'savings' as const,
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'emergency':
        return <PiggyBank size={20} color="#e74c3c" />;
      case 'investment':
        return <TrendingUp size={20} color="#27ae60" />;
      case 'debt':
        return <DollarSign size={20} color="#f39c12" />;
      default:
        return <Target size={20} color="#3498db" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#e74c3c';
      case 'medium':
        return '#f39c12';
      default:
        return '#95a5a6';
    }
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const addGoal = () => {
    if (!newGoal.title || !newGoal.targetAmount || !newGoal.targetDate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      addFinancialGoal({
        title: newGoal.title,
        targetAmount: parseFloat(newGoal.targetAmount),
        currentAmount: 0,
        targetDate: new Date(newGoal.targetDate),
        category: newGoal.category,
        priority: 'medium',
      });
      setNewGoal({ title: '', targetAmount: '', targetDate: '', category: 'savings' });
      setShowAddGoal(false);
      Alert.alert('Success', 'Goal added successfully');
    } catch {
      Alert.alert('Error', 'Failed to add goal');
    }
  };

  const renderGoalsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Financial Goals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddGoal(!showAddGoal)}
        >
          <Plus size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {showAddGoal && (
        <View style={[styles.addGoalForm, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Goal title"
            placeholderTextColor={theme.colors.textSecondary}
            value={newGoal.title}
            onChangeText={(text) => setNewGoal({ ...newGoal, title: text })}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Target amount"
            placeholderTextColor={theme.colors.textSecondary}
            value={newGoal.targetAmount}
            onChangeText={(text) => setNewGoal({ ...newGoal, targetAmount: text })}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Target date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.textSecondary}
            value={newGoal.targetDate}
            onChangeText={(text) => setNewGoal({ ...newGoal, targetDate: text })}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={addGoal}>
              <Text style={styles.saveButtonText}>Add Goal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => setShowAddGoal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {financialGoals.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
            No financial goals yet. Add one to get started!
          </Text>
        </View>
      ) : (
        financialGoals.map((goal) => {
          const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
          return (
            <View key={goal.id} style={[styles.goalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleRow}>
                  {getCategoryIcon(goal.category)}
                  <Text style={[styles.goalTitle, { color: theme.colors.text }]}>{goal.title}</Text>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: getPriorityColor(goal.priority) },
                    ]}
                  >
                    <Text style={styles.priorityText}>{goal.priority}</Text>
                  </View>
                </View>
                <View style={styles.goalActions}>
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.colors.background }]}>
                    <Edit3 size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
                    onPress={() => {
                      Alert.alert(
                        'Delete Goal',
                        'Are you sure you want to delete this goal?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Delete', 
                            style: 'destructive',
                            onPress: () => deleteFinancialGoal(goal.id)
                          },
                        ]
                      );
                    }}
                  >
                    <Trash2 size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.goalProgress}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>{progress.toFixed(1)}%</Text>
              </View>

              <View style={styles.goalDetails}>
                <View style={styles.amountRow}>
                  <Text style={[styles.currentAmount, { color: theme.colors.text }]}>
                    {formatCurrency(goal.currentAmount)}
                  </Text>
                  <Text style={[styles.targetAmount, { color: theme.colors.textSecondary }]}>
                    / {formatCurrency(goal.targetAmount)}
                  </Text>
                </View>
                <Text style={[styles.targetDate, { color: theme.colors.textSecondary }]}>
                  Target: {goal.targetDate.toLocaleDateString()}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const renderBudgetsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Budget Tracking</Text>
        <TouchableOpacity style={styles.addButton}>
          <Plus size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {budgets.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
            No budgets set. Create budgets in Analytics tab!
          </Text>
        </View>
      ) : (
        budgets.map((budget) => {
          const spent = getBudgetSpending(budget.id);
          const percentage = (spent / budget.amount) * 100;
          const isOverBudget = percentage > 100;
          
          return (
            <View key={budget.id} style={[styles.budgetCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.budgetHeader}>
                <Text style={[styles.budgetCategory, { color: theme.colors.text }]}>
                  {budget.category?.name || 'Uncategorized'}
                </Text>
                <Text style={[styles.budgetPeriod, { color: theme.colors.textSecondary }]}>{budget.period}</Text>
              </View>

              <View style={styles.budgetProgress}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: isOverBudget ? '#e74c3c' : '#667eea',
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
                <Text style={[styles.budgetAmount, { color: theme.colors.text }]}>
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

  const renderCalculatorSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Financial Calculators</Text>
      
      <View style={styles.calculatorGrid}>
        <TouchableOpacity style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Calculator size={32} color={theme.colors.primary} />
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Loan Calculator</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Calculate monthly payments and interest
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TrendingUp size={32} color={theme.colors.success} />
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Investment Growth</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Project investment returns over time
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <PiggyBank size={32} color={theme.colors.warning} />
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Savings Goal</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Calculate how much to save monthly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <DollarSign size={32} color={theme.colors.error} />
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Debt Payoff</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Plan your debt elimination strategy
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeSection === 'goals' && styles.activeTab]}
          onPress={() => setActiveSection('goals')}
        >
          <Target size={20} color={activeSection === 'goals' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeSection === 'goals' ? theme.colors.primary : theme.colors.textSecondary },
              activeSection === 'goals' && { fontWeight: '600' },
            ]}
          >
            Goals
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeSection === 'budgets' && styles.activeTab]}
          onPress={() => setActiveSection('budgets')}
        >
          <PiggyBank size={20} color={activeSection === 'budgets' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeSection === 'budgets' ? theme.colors.primary : theme.colors.textSecondary },
              activeSection === 'budgets' && { fontWeight: '600' },
            ]}
          >
            Budgets
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeSection === 'calculator' && styles.activeTab]}
          onPress={() => setActiveSection('calculator')}
        >
          <Calculator size={20} color={activeSection === 'calculator' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text
            style={[
              styles.tabText,
              { color: activeSection === 'calculator' ? theme.colors.primary : theme.colors.textSecondary },
              activeSection === 'calculator' && { fontWeight: '600' },
            ]}
          >
            Tools
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeSection === 'goals' && renderGoalsSection()}
        {activeSection === 'budgets' && renderBudgetsSection()}
        {activeSection === 'calculator' && renderCalculatorSection()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
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
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
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
  calculatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  calculatorCard: {
    borderRadius: 16,
    padding: 20,
    width: '48%',
    alignItems: 'center',
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
  calculatorTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  calculatorDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
