/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
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
} from 'react-native';
import { X, Calculator, Repeat, ArrowLeftRight, Calendar } from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import { TransactionCategory } from '@/types/transaction';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ visible, onClose }: AddTransactionModalProps) {
  const { theme } = useTheme();
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorDisplay, setCalculatorDisplay] = useState('0');
  const [calculatorInput, setCalculatorInput] = useState('');
  
  const { addTransaction, accounts, formatCurrency } = useTransactionStore();

  const categories = type === 'transfer' ? [] : (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

  const handleSubmit = () => {
    if (!amount || !description) {
      Alert.alert('Error', 'Please fill in amount and description');
      return;
    }

    if (type !== 'transfer' && !selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (type === 'transfer' && (!fromAccount || !toAccount)) {
      Alert.alert('Error', 'Please select both accounts for transfer');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const transactionData: any = {
      amount: numAmount,
      description,
      type,
      date: new Date(),
    };

    if (type !== 'transfer') {
      transactionData.category = selectedCategory;
    } else {
      transactionData.fromAccount = fromAccount;
      transactionData.toAccount = toAccount;
      transactionData.category = {
        id: 'transfer',
        name: 'Transfer',
        icon: 'ArrowLeftRight',
        color: '#667eea',
      };
    }

    if (isRecurring) {
      transactionData.isRecurring = true;
      transactionData.recurringFrequency = recurringFrequency;
      if (recurringEndDate) {
        transactionData.recurringEndDate = new Date(recurringEndDate);
      }
    }

    addTransaction(transactionData);
    handleClose();
  };

  const handleClose = () => {
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    setFromAccount('');
    setToAccount('');
    setIsRecurring(false);
    setRecurringFrequency('monthly');
    setRecurringEndDate('');
    setShowCalculator(false);
    setCalculatorDisplay('0');
    setCalculatorInput('');
    onClose();
  };

  const handleCalculatorPress = (value: string) => {
    if (value === 'C') {
      setCalculatorDisplay('0');
      setCalculatorInput('');
    } else if (value === '=') {
      try {
        const result = eval(calculatorInput || calculatorDisplay);
        setCalculatorDisplay(result.toString());
        setAmount(result.toString());
        setCalculatorInput('');
      } catch (error) {
        setCalculatorDisplay('Error');
      }
    } else if (value === '⌫') {
      const newDisplay = calculatorDisplay.slice(0, -1) || '0';
      setCalculatorDisplay(newDisplay);
      setCalculatorInput(newDisplay);
    } else {
      const newDisplay = calculatorDisplay === '0' ? value : calculatorDisplay + value;
      setCalculatorDisplay(newDisplay);
      setCalculatorInput(newDisplay);
    }
  };

  const calculatorButtons = [
    ['C', '⌫', '/', '*'],
    ['7', '8', '9', '-'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '.', '', ''],
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Add Transaction</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              onPress={() => {
                setType('transfer');
                setSelectedCategory(null);
              }}
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
              keyboardType="numeric"
              returnKeyType="next"
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
                              ['C', '⌫'].includes(button) && { backgroundColor: theme.colors.border },
                            ]}
                            onPress={() => handleCalculatorPress(button)}
                          >
                            <Text style={[
                              styles.calculatorKeyText,
                              { color: theme.colors.text },
                              button === '=' && { color: 'white' },
                              ['C', '⌫'].includes(button) && { color: theme.colors.textSecondary },
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

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor={theme.colors.textSecondary}
              returnKeyType="done"
            />
          </View>

          {type === 'transfer' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>From Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.accountsRow}>
                    {accounts.map((account) => (
                      <TouchableOpacity
                        key={account.id}
                        style={[
                          styles.accountItem,
                          { backgroundColor: theme.colors.surface, borderColor: fromAccount === account.id ? theme.colors.primary : 'transparent' },
                        ]}
                        onPress={() => setFromAccount(account.id)}
                      >
                        <Text style={[
                          styles.accountText,
                          { color: fromAccount === account.id ? theme.colors.primary : theme.colors.text },
                        ]}>
                          {account.name}
                        </Text>
                        <Text style={[styles.accountBalance, { color: theme.colors.textSecondary }]}>
                          {formatCurrency(account.balance)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>To Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.accountsRow}>
                    {accounts.map((account) => (
                      <TouchableOpacity
                        key={account.id}
                        style={[
                          styles.accountItem,
                          { backgroundColor: theme.colors.surface, borderColor: toAccount === account.id ? theme.colors.primary : 'transparent' },
                        ]}
                        onPress={() => setToAccount(account.id)}
                      >
                        <Text style={[
                          styles.accountText,
                          { color: toAccount === account.id ? theme.colors.primary : theme.colors.text },
                        ]}>
                          {account.name}
                        </Text>
                        <Text style={[styles.accountBalance, { color: theme.colors.textSecondary }]}>
                          {formatCurrency(account.balance)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
              <View style={styles.categoriesGrid}>
                {categories.map((category) => {
                  if (!category?.id?.trim()) return null;
                  const IconComponent = (Icons as any)[category.icon] || Icons.Circle;
                  const isSelected = selectedCategory?.id === category.id;
                  
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
            </View>
          )}
          
          <View style={styles.inputGroup}>
            <View style={styles.recurringRow}>
              <View style={styles.recurringInfo}>
                <Repeat size={20} color={theme.colors.primary} />
                <Text style={[styles.label, { color: theme.colors.text }]}>Recurring Transaction</Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={isRecurring ? '#fff' : '#f4f3f4'}
              />
            </View>
            
            {isRecurring && (
              <>
                <View style={styles.frequencySelector}>
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.frequencyButton,
                        { backgroundColor: theme.colors.background },
                        recurringFrequency === freq && { backgroundColor: theme.colors.primary },
                      ]}
                      onPress={() => setRecurringFrequency(freq)}
                    >
                      <Text style={[
                        styles.frequencyButtonText,
                        { color: recurringFrequency === freq ? 'white' : theme.colors.textSecondary },
                      ]}>
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <View style={[styles.dateInputGroup, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Calendar size={16} color={theme.colors.primary} />
                  <TextInput
                    style={[styles.dateInput, { color: theme.colors.text }]}
                    value={recurringEndDate}
                    onChangeText={setRecurringEndDate}
                    placeholder="End date (YYYY-MM-DD)"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.colors.primary }]} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Add Transaction</Text>
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
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  accountsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  accountItem: {
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
  },
  accountText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 12,
  },
  recurringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recurringInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  frequencySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  frequencyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  dateInput: {
    flex: 1,
    fontSize: 16,
  },
});