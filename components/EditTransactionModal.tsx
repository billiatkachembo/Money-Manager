/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { X, Calendar, Calculator, ArrowLeftRight, Search, Landmark } from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { Transaction, TransactionCategory } from '@/types/transaction';
import { MODAL_EXPENSE_CATEGORIES, MODAL_INCOME_CATEGORIES } from '@/constants/modal-categories';

interface EditTransactionModalProps {
  visible: boolean;
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}

function parseDateInput(value: string): Date | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T00:00:00`)
    : new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatIsoDate(value?: Date): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().split('T')[0];
}

export function EditTransactionModal({ visible, transaction, onClose, onSave }: EditTransactionModalProps) {
  const { theme } = useTheme();
  const { updateTransaction, formatCurrency, transactions } = useTransactionStore();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [type, setType] = useState<'income' | 'expense' | 'transfer' | 'debt'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [debtDirection, setDebtDirection] = useState<'borrowed' | 'lent'>('borrowed');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [debtPayment, setDebtPayment] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorDisplay, setCalculatorDisplay] = useState('0');

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setDescription(transaction.description || '');
      setDate(new Date(transaction.date));
      setType(transaction.type);

      const categoryPool = transaction.type === 'income'
        ? MODAL_INCOME_CATEGORIES
        : transaction.type === 'expense'
          ? MODAL_EXPENSE_CATEGORIES
          : [];

      const normalizedCategory = transaction.category
        ? categoryPool.find(
            (category) =>
              category.id === transaction.category?.id ||
              category.name.toLowerCase() === transaction.category?.name?.toLowerCase()
          ) ?? transaction.category
        : null;

      setSelectedCategory(normalizedCategory);
      setCategorySearch('');
      setDebtDirection(transaction.debtDirection ?? 'borrowed');
      setCounterparty(transaction.counterparty ?? '');
      setDueDate(formatIsoDate(transaction.dueDate));
      setInterestRate(transaction.interestRate !== undefined ? transaction.interestRate.toString() : '');
      setDebtPayment(Boolean(transaction.debtPayment));
    }
  }, [transaction]);

  const categories = type === 'transfer' ? [] : (type === 'income' ? MODAL_INCOME_CATEGORIES : MODAL_EXPENSE_CATEGORIES);

  const displayedCategories = useMemo(() => {
    if (!selectedCategory || type === 'transfer') {
      return categories;
    }

    return categories.some((category) => category.id === selectedCategory.id)
      ? categories
      : [selectedCategory, ...categories];
  }, [categories, selectedCategory, type]);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) {
      return displayedCategories;
    }

    return displayedCategories.filter((category) => category.name.toLowerCase().includes(query));
  }, [categorySearch, displayedCategories]);

  const handleTypeChange = (nextType: 'income' | 'expense' | 'transfer' | 'debt') => {
    setType(nextType);
    setSelectedCategory(null);
    setCategorySearch('');
  };

  const handleCategorySelect = (category: TransactionCategory) => {
    setSelectedCategory(category);
    setCategorySearch(category.name);
  };

  const spendingInsight = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = Math.max(1, Math.min(now.getDate(), totalDays));
    const remainingDays = Math.max(totalDays - today + 1, 1);

    const monthStart = new Date(year, month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonthStart = new Date(year, month + 1, 1);
    nextMonthStart.setHours(0, 0, 0, 0);

    const parsedDraftAmount = Number.parseFloat(amount);
    const draftAmount = Number.isFinite(parsedDraftAmount) ? Math.abs(parsedDraftAmount) : 0;
    const draftDate = Number.isNaN(date.getTime()) ? now : date;

    let netBalance = 0;
    let monthExpenses = 0;

    for (const entry of transactions) {
      const isEditedTransaction = entry.id === transaction.id;
      const effectiveType = isEditedTransaction ? type : entry.type;
      const rawAmount = isEditedTransaction ? draftAmount : Number(entry.amount);
      const effectiveAmount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;
      const effectiveDate = isEditedTransaction ? draftDate : entry.date;

      if (effectiveAmount <= 0 || Number.isNaN(effectiveDate.getTime())) {
        continue;
      }

      if (effectiveType === 'income') {
        netBalance += effectiveAmount;
        continue;
      }

      if (effectiveType === 'expense') {
        netBalance -= effectiveAmount;
        if (effectiveDate >= monthStart && effectiveDate < nextMonthStart && effectiveDate <= now) {
          monthExpenses += effectiveAmount;
        }
      }
    }

    const dailySafeSpend = netBalance > 0 ? netBalance / remainingDays : 0;
    const dailyExpenseRate = monthExpenses / today;
    const daysUntilBroke = dailyExpenseRate > 0 ? Math.max(netBalance, 0) / dailyExpenseRate : Infinity;

    return {
      remainingDays,
      dailySafeSpend,
      daysUntilBroke,
    };
  }, [amount, date, transaction.id, transactions, type]);

  const formattedDailySafeSpend = useMemo(
    () => formatCurrency(Math.max(0, spendingInsight.dailySafeSpend)),
    [formatCurrency, spendingInsight.dailySafeSpend]
  );

  const daysUntilBrokeLabel = useMemo(() => {
    if (!Number.isFinite(spendingInsight.daysUntilBroke)) {
      return '∞';
    }

    return Math.max(0, Math.floor(spendingInsight.daysUntilBroke)).toString();
  }, [spendingInsight.daysUntilBroke]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleCalculatorPress = (value: string) => {
    if (value === 'C') {
      setCalculatorDisplay('0');
    } else if (value === '=') {
      try {
        const result = eval(calculatorDisplay);
        setAmount(result.toString());
        setCalculatorDisplay('0');
        setShowCalculator(false);
      } catch (error) {
        setCalculatorDisplay('Error');
      }
    } else if (value === '⌫') {
      setCalculatorDisplay(prev => prev.slice(0, -1) || '0');
    } else {
      setCalculatorDisplay(prev => prev === '0' ? value : prev + value);
    }
  };

  const handleSave = () => {
    if (!amount || !description) {
      Alert.alert('Error', 'Please fill in amount and description');
      return;
    }

    if (type !== 'transfer' && !selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const trimmedDueDate = dueDate.trim();
    const parsedDueDate = trimmedDueDate ? parseDateInput(trimmedDueDate) : null;
    if (trimmedDueDate && !parsedDueDate) {
      Alert.alert('Error', 'Please enter a valid due date in YYYY-MM-DD format');
      return;
    }

    const trimmedInterestRate = interestRate.trim();
    const parsedInterestRate = trimmedInterestRate ? Number(trimmedInterestRate) : undefined;
    if (trimmedInterestRate && !Number.isFinite(parsedInterestRate)) {
      Alert.alert('Error', 'Please enter a valid interest rate');
      return;
    }

    const updatedTransaction: Transaction = {
      ...transaction,
      amount: numAmount,
      description: description.trim(),
      date: date,
      type: type,
      category: type === 'transfer' ? {
        id: 'transfer',
        name: 'Transfer',
        icon: 'ArrowLeftRight',
        color: '#667eea',
      } : selectedCategory!,
      debtDirection: type === 'debt' ? debtDirection : undefined,
      counterparty: type === 'debt' ? counterparty.trim() || undefined : undefined,
      dueDate: type === 'debt' ? parsedDueDate ?? undefined : undefined,
      interestRate: type === 'debt' ? parsedInterestRate : undefined,
      debtPayment: type === 'expense' ? debtPayment : undefined,
    };

    try {
      updateTransaction(updatedTransaction);
      onSave();
    } catch (error) {
      Alert.alert('Error', 'Failed to update transaction');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculatorButtons = [
    ['C', '⌫', '/', '*'],
    ['7', '8', '9', '-'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '.', '', ''],
  ];

  if (!transaction) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Edit Transaction</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Transaction Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Type</Text>
            <View style={[styles.typeSelector, { backgroundColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'expense' && { backgroundColor: theme.colors.surface }
                ]}
                onPress={() => handleTypeChange('expense')}
              >
                <Text style={[
                  styles.typeButtonText,
                  { color: type === 'expense' ? theme.colors.text : theme.colors.textSecondary }
                ]}>
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'income' && { backgroundColor: theme.colors.surface }
                ]}
                onPress={() => handleTypeChange('income')}
              >
                <Text style={[
                  styles.typeButtonText,
                  { color: type === 'income' ? theme.colors.text : theme.colors.textSecondary }
                ]}>
                  Income
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'transfer' && { backgroundColor: theme.colors.surface }
                ]}
                onPress={() => handleTypeChange('transfer')}
              >
                <ArrowLeftRight size={16} color={type === 'transfer' ? theme.colors.text : theme.colors.textSecondary} />
                <Text style={[
                  styles.typeButtonText,
                  { color: type === 'transfer' ? theme.colors.text : theme.colors.textSecondary }
                ]}>
                  Transfer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'debt' && { backgroundColor: theme.colors.surface }
                ]}
                onPress={() => handleTypeChange('debt')}
              >
                <Landmark size={16} color={type === 'debt' ? theme.colors.text : theme.colors.textSecondary} />
                <Text style={[
                  styles.typeButtonText,
                  { color: type === 'debt' ? theme.colors.text : theme.colors.textSecondary }
                ]}>
                  Debt
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Date</Text>
            <TouchableOpacity
              style={[styles.dateInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={16} color={theme.colors.primary} />
              <Text style={[styles.dateInputText, { color: theme.colors.text }]}>
                {formatDate(date)}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Amount</Text>
              <TouchableOpacity
                style={styles.calculatorButton}
                onPress={() => setShowCalculator(!showCalculator)}
              >
                <Calculator size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="decimal-pad"
            />
            {showCalculator && (
              <View style={[styles.calculator, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.calculatorDisplay, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.calculatorDisplayText, { color: theme.colors.text }]}>{calculatorDisplay}</Text>
                </View>
                <View style={styles.calculatorGrid}>
                  {calculatorButtons.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.calculatorRow}>
                      {row.map((button, buttonIndex) => (
                        button ? (
                          <TouchableOpacity
                            key={buttonIndex}
                            style={[
                              styles.calculatorKey,
                              { backgroundColor: theme.colors.surface },
                              button === '=' && { backgroundColor: theme.colors.primary },
                            ]}
                            onPress={() => handleCalculatorPress(button)}
                          >
                            <Text style={[
                              styles.calculatorKeyText,
                              { color: theme.colors.text },
                              button === '=' && { color: 'white' },
                            ]}>
                              {button}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View key={buttonIndex} style={styles.calculatorKey} />
                        )
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
          {/* Spending Insights */}
          <View style={[styles.spendingInsightContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.spendingInsightContent}>
              <Text style={[styles.spendingInsightLabel, { color: theme.colors.textSecondary }]}>Daily Safe Spend</Text>
              <Text style={[styles.spendingInsightValue, { color: theme.colors.text }]}>
                {formattedDailySafeSpend} / day
              </Text>
              <Text style={[styles.spendingInsightHint, { color: theme.colors.textSecondary }]}>
                {spendingInsight.remainingDays} days left this month
              </Text>
              <Text
                style={[
                  styles.spendingInsightDays,
                  { color: spendingInsight.daysUntilBroke <= 7 ? '#FF5252' : theme.colors.text },
                ]}
              >
                {daysUntilBrokeLabel} days until balance reaches zero
              </Text>
            </View>
          </View>
          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
            />
          </View>

          {/* Category Selection */}
          {type !== 'transfer' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
              <View style={[styles.categorySearchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                <Search size={16} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.categorySearchInput, { color: theme.colors.text }]}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  placeholder="Search or scroll categories"
                  placeholderTextColor={theme.colors.textSecondary}
                />
                {categorySearch ? (
                  <TouchableOpacity onPress={() => setCategorySearch('')}>
                    <X size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                <View style={styles.categoriesRow}>
                  {filteredCategories.map((category) => {
                    const isSelected = selectedCategory?.id === category.id;
                    const IconComponent = (Icons as any)[category.icon] || Icons.Circle;

                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryItem,
                          { backgroundColor: theme.colors.surface, borderColor: isSelected ? theme.colors.primary : category.color }
                        ]}
                        onPress={() => handleCategorySelect(category)}
                      >
                        <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                          <IconComponent size={20} color={category.color} />
                        </View>
                        <Text style={[styles.categoryText, { color: isSelected ? theme.colors.primary : theme.colors.textSecondary }]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              {filteredCategories.length === 0 ? (
                <View style={styles.noResults}>
                  <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>No categories found</Text>
                </View>
              ) : null}
            </View>
          )}

          {type === 'debt' ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Debt Details</Text>
              <View style={[styles.debtDirectionRow, { backgroundColor: theme.colors.border }]}> 
                <TouchableOpacity
                  style={[
                    styles.debtDirectionButton,
                    debtDirection === 'borrowed' && { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => setDebtDirection('borrowed')}
                >
                  <Text style={[
                    styles.debtDirectionText,
                    { color: debtDirection === 'borrowed' ? theme.colors.text : theme.colors.textSecondary },
                  ]}>
                    Borrowed
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.debtDirectionButton,
                    debtDirection === 'lent' && { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => setDebtDirection('lent')}
                >
                  <Text style={[
                    styles.debtDirectionText,
                    { color: debtDirection === 'lent' ? theme.colors.text : theme.colors.textSecondary },
                  ]}>
                    Lent
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={counterparty}
                onChangeText={setCounterparty}
                placeholder="Counterparty"
                placeholderTextColor={theme.colors.textSecondary}
              />
              <View style={[styles.dateInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                <Calendar size={16} color={theme.colors.primary} />
                <TextInput
                  style={[styles.dateInputText, { color: theme.colors.text }]}
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="Due date (YYYY-MM-DD)"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="Interest rate (%)"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          ) : null}

          {type === 'expense' ? (
            <View style={styles.inputGroup}>
              <View style={styles.debtPaymentRow}>
                <View style={styles.debtPaymentInfo}>
                  <Landmark size={18} color={theme.colors.primary} />
                  <Text style={[styles.label, { color: theme.colors.text }]}>Debt Payment</Text>
                </View>
                <Switch
                  value={debtPayment}
                  onValueChange={setDebtPayment}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={debtPayment ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.colors.border }]} onPress={onClose}>
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  spendingInsightContainer: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  spendingInsightContent: {
    borderRadius: 12,
    padding: 12,
  },
  spendingInsightLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  spendingInsightValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '600',
  },
  spendingInsightHint: {
    fontSize: 12,
  },
  spendingInsightDays: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calculatorButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
  },
  calculator: {
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  calculatorDisplay: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  calculatorDisplayText: {
    fontSize: 24,
    fontWeight: '600',
  },
  calculatorGrid: {
    gap: 8,
  },
  calculatorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calculatorKey: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculatorKeyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  dateInputText: {
    flex: 1,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  debtDirectionRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  debtDirectionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  debtDirectionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  debtPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtPaymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categorySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  categoriesScroll: {
    marginHorizontal: -4,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  categoryItem: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  noResults: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});















