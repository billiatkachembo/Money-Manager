/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useState, useEffect } from 'react';
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
import { X, Calendar, Calculator, ArrowLeftRight, TrendingUp } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { Transaction, TransactionCategory } from '@/types/transaction';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES } from '@/constants/categories';

interface EditTransactionModalProps {
  visible: boolean;
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}

export function EditTransactionModal({ visible, transaction, onClose, onSave }: EditTransactionModalProps) {
  const { theme } = useTheme();
  const { updateTransaction } = useTransactionStore();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorDisplay, setCalculatorDisplay] = useState('0');

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setDescription(transaction.description || '');
      setDate(new Date(transaction.date));
      setType(transaction.type);
      setSelectedCategory(transaction.category || null);
    }
  }, [transaction]);

  const categories = type === 'transfer' ? [] : (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

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
                onPress={() => {
                  setType('expense');
                  setSelectedCategory(null);
                }}
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
                onPress={() => {
                  setType('income');
                  setSelectedCategory(null);
                }}
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
                onPress={() => setType('transfer')}
              >
                <ArrowLeftRight size={16} color={type === 'transfer' ? theme.colors.text : theme.colors.textSecondary} />
                <Text style={[
                  styles.typeButtonText,
                  { color: type === 'transfer' ? theme.colors.text : theme.colors.textSecondary }
                ]}>
                  Transfer
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                <View style={styles.categoriesRow}>
                  {categories.map((category) => {
                    const isSelected = selectedCategory?.id === category.id;
                    const IconComponent = (require('lucide-react-native') as any)[category.icon] || TrendingUp;
                    
                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryItem,
                          { backgroundColor: theme.colors.surface, borderColor: isSelected ? theme.colors.primary : category.color }
                        ]}
                        onPress={() => setSelectedCategory(category)}
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
            </View>
          )}
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
