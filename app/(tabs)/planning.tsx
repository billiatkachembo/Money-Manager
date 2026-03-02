import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  KeyboardTypeOptions,
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
  Clock,
  Percent,
  Calendar,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

interface CalculatorForm {
  loanAmount: string;
  interestRate: string;
  loanTerm: string;
  principal: string;
  rateOfReturn: string;
  years: string;
  currentSavings: string;
  monthlyContribution: string;
  targetAmount: string;
  timeframe: string;
  debtAmount: string;
  monthlyPayment: string;
  extraPayment: string;
}

export default function PlanningScreen() {
  const { theme } = useTheme();
  const { financialGoals, addFinancialGoal, deleteFinancialGoal, budgets, formatCurrency, getBudgetSpending } = useTransactionStore();
  const [activeSection, setActiveSection] = useState<'goals' | 'budgets' | 'calculator'>('goals');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [activeCalculator, setActiveCalculator] = useState<string | null>(null);
  const [calculatorResult, setCalculatorResult] = useState<any>(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    targetAmount: '',
    targetDate: '',
    category: 'savings' as const,
  });

  const [calculatorForm, setCalculatorForm] = useState<CalculatorForm>({
    loanAmount: '',
    interestRate: '',
    loanTerm: '',
    principal: '',
    rateOfReturn: '',
    years: '',
    currentSavings: '',
    monthlyContribution: '',
    targetAmount: '',
    timeframe: '',
    debtAmount: '',
    monthlyPayment: '',
    extraPayment: '',
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

  // Financial Calculator Functions
  const calculateLoan = () => {
    const principal = parseFloat(calculatorForm.loanAmount);
    const annualRate = parseFloat(calculatorForm.interestRate) / 100;
    const months = parseFloat(calculatorForm.loanTerm) * 12;

    if (!principal || !annualRate || !months) {
      Alert.alert('Error', 'Please enter all loan details');
      return;
    }

    const monthlyRate = annualRate / 12;
    const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    const totalPayment = monthlyPayment * months;
    const totalInterest = totalPayment - principal;

    setCalculatorResult({
      title: 'Loan Calculator Results',
      monthlyPayment: formatCurrency(monthlyPayment),
      totalPayment: formatCurrency(totalPayment),
      totalInterest: formatCurrency(totalInterest),
    });
  };

  const calculateInvestment = () => {
    const principal = parseFloat(calculatorForm.principal);
    const annualRate = parseFloat(calculatorForm.rateOfReturn) / 100;
    const years = parseFloat(calculatorForm.years);

    if (!principal || !annualRate || !years) {
      Alert.alert('Error', 'Please enter all investment details');
      return;
    }

    const futureValue = principal * Math.pow(1 + annualRate, years);
    const totalInterest = futureValue - principal;
    const annualGrowth = (futureValue / principal) ** (1 / years) - 1;

    setCalculatorResult({
      title: 'Investment Growth Results',
      futureValue: formatCurrency(futureValue),
      totalInterest: formatCurrency(totalInterest),
      annualGrowth: `${(annualGrowth * 100).toFixed(2)}%`,
      years: years,
    });
  };

  const calculateSavingsGoal = () => {
    const current = parseFloat(calculatorForm.currentSavings);
    const monthly = parseFloat(calculatorForm.monthlyContribution);
    const target = parseFloat(calculatorForm.targetAmount);
    const months = parseFloat(calculatorForm.timeframe) * 12;

    if (!target || !months) {
      Alert.alert('Error', 'Please enter target amount and timeframe');
      return;
    }

    const needed = target - (current || 0);
    const monthlyRequired = needed / months;

    let result;
    if (monthly) {
      // Calculate months needed with current monthly contribution
      const monthsNeeded = needed / monthly;
      result = {
        title: 'Savings Goal Analysis',
        monthlyContribution: formatCurrency(monthly),
        monthsNeeded: Math.ceil(monthsNeeded),
        yearsNeeded: (monthsNeeded / 12).toFixed(1),
        totalContribution: formatCurrency(monthly * monthsNeeded),
      };
    } else {
      // Calculate required monthly contribution
      result = {
        title: 'Savings Goal Analysis',
        monthlyRequired: formatCurrency(monthlyRequired),
        totalMonths: months,
        totalYears: (months / 12).toFixed(1),
        finalAmount: formatCurrency(target),
      };
    }

    setCalculatorResult(result);
  };

  const calculateDebtPayoff = () => {
    const principal = parseFloat(calculatorForm.debtAmount);
    const monthly = parseFloat(calculatorForm.monthlyPayment);
    const annualRate = 0.18; // 18% average credit card interest
    const extra = parseFloat(calculatorForm.extraPayment) || 0;

    if (!principal || !monthly) {
      Alert.alert('Error', 'Please enter debt amount and monthly payment');
      return;
    }

    let balance = principal;
    let totalMonths = 0;
    let totalInterest = 0;
    const monthlyRate = annualRate / 12;
    const totalPayment = monthly + extra;

    while (balance > 0 && totalMonths < 600) { // Cap at 50 years
      const interest = balance * monthlyRate;
      const principalPayment = Math.min(totalPayment - interest, balance);
      balance -= principalPayment;
      totalInterest += interest;
      totalMonths++;
    }

    type DebtPayoffResult = {
      title: string;
      totalMonths: number;
      totalYears: string;
      totalInterest: string;
      totalPaid: string;
      payoffDate: string;
      interestSaved?: string;
      monthsSaved?: number;
    };

    let result: DebtPayoffResult = {
      title: 'Debt Payoff Analysis',
      totalMonths: totalMonths,
      totalYears: (totalMonths / 12).toFixed(1),
      totalInterest: formatCurrency(totalInterest),
      totalPaid: formatCurrency(principal + totalInterest),
      payoffDate: new Date(new Date().setMonth(new Date().getMonth() + totalMonths)).toLocaleDateString(),
    };

    if (extra > 0) {
      result.interestSaved = formatCurrency(principal * 0.18 * (totalMonths / 12) - totalInterest);
      result.monthsSaved = Math.round((principal * 0.18 * (10/12)) / monthly - totalMonths);
    }

    setCalculatorResult(result);
  };

  const openCalculator = (calculator: string) => {
    setActiveCalculator(calculator);
    setCalculatorResult(null);
    // Reset form for this calculator
    setCalculatorForm({
      loanAmount: '',
      interestRate: '',
      loanTerm: '',
      principal: '',
      rateOfReturn: '',
      years: '',
      currentSavings: '',
      monthlyContribution: '',
      targetAmount: '',
      timeframe: '',
      debtAmount: '',
      monthlyPayment: '',
      extraPayment: '',
    });
  };

  const closeCalculator = () => {
    setActiveCalculator(null);
    setCalculatorResult(null);
  };

  const renderCalculatorInput = (label: string, value: string, key: keyof CalculatorForm, placeholder: string, icon: React.ReactNode, keyboardType: KeyboardTypeOptions = 'numeric') => (
    <View style={styles.inputGroup}>
      <View style={styles.inputLabel}>
        {icon}
        <Text style={[styles.inputLabelText, { color: theme.colors.text }]}>{label}</Text>
      </View>
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={(text) => setCalculatorForm(prev => ({ ...prev, [key]: text }))}
        keyboardType={keyboardType}
      />
    </View>
  );

  const renderCalculatorModal = () => {
    if (!activeCalculator) return null;

    const calculators = {
      loan: {
        title: 'Loan Calculator',
        description: 'Calculate monthly payments, total interest, and payoff schedule',
        inputs: [
          renderCalculatorInput('Loan Amount', calculatorForm.loanAmount, 'loanAmount', 'e.g., 25000', <DollarSign size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Interest Rate', calculatorForm.interestRate, 'interestRate', 'Annual percentage rate', <Percent size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Loan Term', calculatorForm.loanTerm, 'loanTerm', 'Years', <Calendar size={16} color={theme.colors.textSecondary} />),
        ],
        calculate: calculateLoan,
      },
      investment: {
        title: 'Investment Growth Calculator',
        description: 'Project how your investments will grow over time',
        inputs: [
          renderCalculatorInput('Initial Investment', calculatorForm.principal, 'principal', 'e.g., 10000', <DollarSign size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Rate of Return', calculatorForm.rateOfReturn, 'rateOfReturn', 'Annual percentage', <TrendingUp size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Time Period', calculatorForm.years, 'years', 'Years', <Clock size={16} color={theme.colors.textSecondary} />),
        ],
        calculate: calculateInvestment,
      },
      savings: {
        title: 'Savings Goal Calculator',
        description: 'Plan how to reach your savings targets',
        inputs: [
          renderCalculatorInput('Current Savings', calculatorForm.currentSavings, 'currentSavings', 'e.g., 5000', <PiggyBank size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Monthly Contribution', calculatorForm.monthlyContribution, 'monthlyContribution', 'e.g., 500', <DollarSign size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Target Amount', calculatorForm.targetAmount, 'targetAmount', 'e.g., 50000', <Target size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Timeframe', calculatorForm.timeframe, 'timeframe', 'Years', <Calendar size={16} color={theme.colors.textSecondary} />),
        ],
        calculate: calculateSavingsGoal,
      },
      debt: {
        title: 'Debt Payoff Calculator',
        description: 'Create a plan to eliminate your debt faster',
        inputs: [
          renderCalculatorInput('Total Debt', calculatorForm.debtAmount, 'debtAmount', 'e.g., 15000', <DollarSign size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Monthly Payment', calculatorForm.monthlyPayment, 'monthlyPayment', 'e.g., 300', <DollarSign size={16} color={theme.colors.textSecondary} />),
          renderCalculatorInput('Extra Payment (Optional)', calculatorForm.extraPayment, 'extraPayment', 'e.g., 100', <Plus size={16} color={theme.colors.textSecondary} />),
        ],
        calculate: calculateDebtPayoff,
      },
    };

    const calculator = calculators[activeCalculator as keyof typeof calculators];

    return (
      <Modal
        visible={!!activeCalculator}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={closeCalculator}>
              <X size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{calculator.title}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
              {calculator.description}
            </Text>

            <View style={styles.calculatorForm}>
              {calculator.inputs}
            </View>

            <TouchableOpacity
              style={[styles.calculateButton, { backgroundColor: theme.colors.primary }]}
              onPress={calculator.calculate}
            >
              <Text style={styles.calculateButtonText}>Calculate</Text>
            </TouchableOpacity>

            {calculatorResult && (
              <View style={[styles.resultContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.resultTitle, { color: theme.colors.text }]}>{calculatorResult.title}</Text>
                {Object.entries(calculatorResult).map(([key, value]) => {
                  if (key === 'title') return null;
                  return (
                    <View key={key} style={styles.resultRow}>
                      <Text style={[styles.resultLabel, { color: theme.colors.textSecondary }]}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                      </Text>
                      <Text style={[styles.resultValue, { color: theme.colors.text }]}>{String(value)}</Text>
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={[styles.saveResultButton, { borderColor: theme.colors.border }]}
                  onPress={() => {
                    Alert.alert('Save Result', 'This feature will save the calculation result to your notes');
                  }}
                >
                  <Text style={[styles.saveResultText, { color: theme.colors.primary }]}>Save to Notes</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
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
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Financial Calculators</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
          Plan and optimize your finances
        </Text>
      </View>
      
      <View style={styles.calculatorGrid}>
        <TouchableOpacity 
          style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openCalculator('loan')}
        >
          <View style={styles.calculatorIconContainer}>
            <Calculator size={28} color={theme.colors.primary} />
          </View>
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Loan Calculator</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Calculate monthly payments and interest
          </Text>
          <ChevronRight size={20} color={theme.colors.textSecondary} style={styles.calculatorArrow} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openCalculator('investment')}
        >
          <View style={styles.calculatorIconContainer}>
            <TrendingUp size={28} color={theme.colors.success} />
          </View>
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Investment Growth</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Project investment returns over time
          </Text>
          <ChevronRight size={20} color={theme.colors.textSecondary} style={styles.calculatorArrow} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openCalculator('savings')}
        >
          <View style={styles.calculatorIconContainer}>
            <PiggyBank size={28} color={theme.colors.warning} />
          </View>
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Savings Goal</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Calculate how much to save monthly
          </Text>
          <ChevronRight size={20} color={theme.colors.textSecondary} style={styles.calculatorArrow} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.calculatorCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openCalculator('debt')}
        >
          <View style={styles.calculatorIconContainer}>
            <DollarSign size={28} color={theme.colors.error} />
          </View>
          <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>Debt Payoff</Text>
          <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}>
            Plan your debt elimination strategy
          </Text>
          <ChevronRight size={20} color={theme.colors.textSecondary} style={styles.calculatorArrow} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tipsContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.tipsTitle, { color: theme.colors.text }]}>💡 Financial Tips</Text>
        <View style={styles.tipItem}>
          <Text style={[styles.tipText, { color: theme.colors.text }]}>
            • Aim to save 3-6 months of expenses for emergencies
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={[styles.tipText, { color: theme.colors.text }]}>
            • Invest at least 15% of income for retirement
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={[styles.tipText, { color: theme.colors.text }]}>
            • Pay off high-interest debt first (credit cards)
          </Text>
        </View>
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

      {renderCalculatorModal()}
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 4,
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
  // Calculator Styles
  calculatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  calculatorCard: {
    borderRadius: 16,
    padding: 20,
    width: '48%',
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
  calculatorIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  calculatorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  calculatorDescription: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  calculatorArrow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  tipsContainer: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipItem: {
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
  },
  calculatorForm: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calculateButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  calculateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  resultLabel: {
    fontSize: 14,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveResultButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  saveResultText: {
    fontSize: 14,
    fontWeight: '600',
  },
});