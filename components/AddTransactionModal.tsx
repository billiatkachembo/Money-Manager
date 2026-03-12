/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Switch,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  X, 
  Calculator, 
  Repeat, 
  ArrowLeftRight, 
  Calendar, 
  ChevronDown, 
  ChevronUp,
  Search,
  Camera,
  Upload,
  FileText,
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  Landmark,
  Image as ImageIcon,
  Scan,
  CheckCircle,
} from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import { Transaction, TransactionCategory } from '@/types/transaction';
import { MODAL_EXPENSE_CATEGORIES, MODAL_INCOME_CATEGORIES } from '@/constants/modal-categories';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { normalizeReceiptDate, ReceiptAiDraft, runReceiptOcr } from '@/utils/receiptOcr';

type NewTransactionInput = Omit<Transaction, 'id' | 'createdAt'>;

const TRANSFER_CATEGORY: TransactionCategory = {
  id: 'transfer',
  name: 'Transfer',
  icon: 'ArrowLeftRight',
  color: '#667eea',
};

const CATEGORY_CHIP_ESTIMATED_WIDTH = 108;

const createEmptyOcrDetections = () => ({
  amount: false,
  merchant: false,
  date: false,
});

function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');

  if (parts.length <= 1) {
    return parts[0] ?? '';
  }

  const whole = parts[0] ?? '0';
  const decimal = parts.slice(1).join('');
  return `${whole}.${decimal}`;
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

function evaluateCalculatorExpression(expression: string): number {
  const source = expression.replace(/\s+/g, '');
  if (!source) {
    throw new Error('Empty expression');
  }

  if (!/^[0-9+\-*/.()]+$/.test(source)) {
    throw new Error('Invalid expression');
  }

  let cursor = 0;

  const parseExpression = (): number => {
    let value = parseTerm();

    while (cursor < source.length && (source[cursor] === '+' || source[cursor] === '-')) {
      const operator = source[cursor];
      cursor += 1;
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }

    return value;
  };

  const parseTerm = (): number => {
    let value = parseFactor();

    while (cursor < source.length && (source[cursor] === '*' || source[cursor] === '/')) {
      const operator = source[cursor];
      cursor += 1;
      const right = parseFactor();

      if (operator === '/' && right === 0) {
        throw new Error('Division by zero');
      }

      value = operator === '*' ? value * right : value / right;
    }

    return value;
  };

  const parseFactor = (): number => {
    if (source[cursor] === '+' || source[cursor] === '-') {
      const sign = source[cursor] === '-' ? -1 : 1;
      cursor += 1;
      return sign * parseFactor();
    }

    if (source[cursor] === '(') {
      cursor += 1;
      const value = parseExpression();
      if (source[cursor] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      cursor += 1;
      return value;
    }

    const start = cursor;
    let dotCount = 0;

    while (cursor < source.length && /[0-9.]/.test(source[cursor])) {
      if (source[cursor] === '.') {
        dotCount += 1;
      }
      cursor += 1;
    }

    if (start === cursor || dotCount > 1) {
      throw new Error('Invalid number');
    }

    const value = Number(source.slice(start, cursor));
    if (!Number.isFinite(value)) {
      throw new Error('Invalid number');
    }

    return value;
  };

  const result = parseExpression();
  if (cursor !== source.length || !Number.isFinite(result)) {
    throw new Error('Invalid expression');
  }

  return Math.round((result + Number.EPSILON) * 100) / 100;
}

function toCalculatorDisplay(value: number): string {
  const normalized = Math.round((value + Number.EPSILON) * 100) / 100;
  return normalized.toString();
}

async function persistReceiptImage(uri: string): Promise<string> {
  if (!uri.startsWith('file://')) {
    return uri;
  }

  const documentsDir = FileSystem.Paths.document;
  if (uri.startsWith(documentsDir.uri)) {
    return uri;
  }

  const receiptsDirUri = `${documentsDir.uri}receipts/`;
  try {
    await LegacyFileSystem.makeDirectoryAsync(receiptsDirUri, { intermediates: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes('already exists')) {
      throw error;
    }
  }

  const extensionMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = extensionMatch?.[1] ?? 'jpg';
  const destinationUri = `${receiptsDirUri}receipt_${Date.now()}_${Math.round(Math.random() * 10000)}.${extension}`;
  await LegacyFileSystem.copyAsync({
    from: uri,
    to: destinationUri,
  });

  return destinationUri;
}

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ visible, onClose }: AddTransactionModalProps) {
  const { theme } = useTheme();
  const [type, setType] = useState<'income' | 'expense' | 'transfer' | 'debt'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorDisplay, setCalculatorDisplay] = useState('0');
  const [calculatorInput, setCalculatorInput] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [fromAccountSearch, setFromAccountSearch] = useState('');
  const [toAccountSearch, setToAccountSearch] = useState('');
  const [showFromAccountDropdown, setShowFromAccountDropdown] = useState(false);
  const [showToAccountDropdown, setShowToAccountDropdown] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrExtracted, setOcrExtracted] = useState(false);
  const [ocrDetections, setOcrDetections] = useState(createEmptyOcrDetections);
  const [showImageActions, setShowImageActions] = useState(false);
  const [debtDirection, setDebtDirection] = useState<'borrowed' | 'lent'>('borrowed');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [debtPayment, setDebtPayment] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<ReceiptAiDraft | null>(null);
  const ocrInFlightRef = useRef(false);
  const ocrRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const categoryListRef = useRef<FlatList<TransactionCategory>>(null);
  
  const { addTransaction, accounts, formatCurrency, merchantProfiles, learnMerchantCategory } = useTransactionStore();

  const categories = useMemo(() => {
    return type === 'transfer'
      ? []
      : type === 'income'
        ? MODAL_INCOME_CATEGORIES
        : MODAL_EXPENSE_CATEGORIES;
  }, [type]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = categorySearch.trim().toLowerCase();
    if (!normalizedSearch) return categories;

    return categories.filter((category) =>
      category.name.toLowerCase().includes(normalizedSearch)
    );
  }, [categories, categorySearch]);

  const aiCategoryName = useMemo(() => {
    if (!aiSuggestion) return null;
    const pool = aiSuggestion.debtIntent?.type === 'debt'
      ? MODAL_EXPENSE_CATEGORIES
      : type === 'income'
        ? MODAL_INCOME_CATEGORIES
        : MODAL_EXPENSE_CATEGORIES;
    return pool.find((category) => category.id === aiSuggestion.categoryId)?.name ?? 'Other';
  }, [aiSuggestion, type]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!visible || type === 'transfer' || !selectedCategory) {
      return;
    }

    const selectedIndex = filteredCategories.findIndex(
      (category) => category.id === selectedCategory.id
    );

    if (selectedIndex < 0) {
      return;
    }

    requestAnimationFrame(() => {
      categoryListRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: true,
        viewPosition: 0.5,
      });
    });
  }, [filteredCategories, selectedCategory, type, visible]);

  const performOCR = async (imageUri: string, options?: { override?: boolean }) => {
    if (!isMountedRef.current || ocrInFlightRef.current) return;

    const canMutateOcrState = (requestId: number) =>
      isMountedRef.current && requestId === ocrRequestIdRef.current;

    const override = options?.override ?? false;
    const requestId = ocrRequestIdRef.current + 1;
    ocrRequestIdRef.current = requestId;
    ocrInFlightRef.current = true;
    setIsScanning(true);
    setOcrExtracted(false);
    setOcrDetections(createEmptyOcrDetections());
    setAiSuggestion(null);

    try {
      const compressedImage = await manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );

      if (!canMutateOcrState(requestId)) return;

      if (compressedImage?.uri && compressedImage.uri !== receiptImage) {
        setReceiptImage(compressedImage.uri);
      }

      const { rawText, data, ai } = await runReceiptOcr(compressedImage.uri, { merchants: merchantProfiles });
      if (!canMutateOcrState(requestId)) return;

      if (canMutateOcrState(requestId)) {
        setAiSuggestion(ai);
        if (ai.debtIntent?.type === 'debt') {
          setType('debt');
          setDebtDirection(ai.debtIntent.direction ?? 'borrowed');
          if (data.merchant && (override || !counterparty)) {
            setCounterparty(data.merchant);
          }
        } else if (ai.debtIntent?.type === 'expense' && type === 'transfer') {
          setType('expense');
        }

        if (ai.debtIntent?.debtPayment && (override || !debtPayment)) {
          setDebtPayment(true);
        }
      }


      if (!rawText.trim()) {
        if (canMutateOcrState(requestId)) {
          Alert.alert(
            'No Text Found',
            'We could not detect any text in this receipt. Please enter details manually.',
            [{ text: 'OK' }]
          );
        }
        return;
      }

      const hasValidAmount =
        typeof data.amount === 'number' && Number.isFinite(data.amount) && data.amount > 0;
      const normalizedDate = normalizeReceiptDate(data.date);
      const nextDetections = {
        amount: hasValidAmount,
        merchant: Boolean(data.merchant),
        date: Boolean(normalizedDate),
      };
      if (canMutateOcrState(requestId)) {
        setOcrDetections(nextDetections);
      }

      const hasDetectedData = hasValidAmount || Boolean(data.merchant || data.date);
      if (!hasDetectedData) {
        if (canMutateOcrState(requestId)) {
          Alert.alert(
            'No Details Detected',
            'We could not detect the amount or merchant. Please enter details manually.',
            [{ text: 'OK' }]
          );
        }
        return;
      }

      if (
        canMutateOcrState(requestId) &&
        typeof data.amount === 'number' &&
        Number.isFinite(data.amount) &&
        data.amount > 0 &&
        (override || !amount)
      ) {
        setAmount(data.amount.toString());
      }

      if (canMutateOcrState(requestId) && data.merchant && (override || !description)) {
        setDescription(data.merchant);
      }

      const preferredType = ai.debtIntent?.type === 'debt' ? 'debt' : type;
      const categoryPool = preferredType === 'income' ? MODAL_INCOME_CATEGORIES : MODAL_EXPENSE_CATEGORIES;
      const aiCategory = ai.categoryId
        ? categoryPool.find((category) => category.id === ai.categoryId)
        : null;
      const fallbackCategoryId =
        preferredType === 'income' ? 'other-income' : preferredType === 'debt' ? 'debt' : 'other';
      const fallbackCategory =
        categoryPool.find((category) => category.id === fallbackCategoryId) ?? categoryPool[0];
      const suggestedCategory = aiCategory ?? fallbackCategory;
      if (canMutateOcrState(requestId) && suggestedCategory && (override || !selectedCategory)) {
        handleCategorySelect(suggestedCategory);
      }

      if (canMutateOcrState(requestId) && normalizedDate && (override || !transactionDate)) {
        setTransactionDate(normalizedDate);
      }

      if (canMutateOcrState(requestId)) {
        setOcrExtracted(true);
      }
    } catch (error) {
      console.error('OCR error:', error);
      if (canMutateOcrState(requestId)) {
        Alert.alert(
          'OCR Failed',
          'We could not read this receipt. Please enter the transaction details manually.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      if (canMutateOcrState(requestId)) {
        setIsScanning(false);
        ocrInFlightRef.current = false;
      }
    }
  };

  // Function to take a photo with camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take photos of receipts.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setReceiptImage(result.assets[0].uri);
        setShowImageActions(true);
        
        // Auto-start OCR scanning
        performOCR(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Function to pick image from gallery
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setReceiptImage(result.assets[0].uri);
        setShowImageActions(true);
        
        // Auto-start OCR scanning
        performOCR(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Function to scan existing receipt image
  const scanReceipt = () => {
    if (receiptImage) {
      performOCR(receiptImage, { override: true });
    }
  };

  // Function to remove receipt image
  const removeReceiptImage = () => {
    ocrRequestIdRef.current += 1;
    ocrInFlightRef.current = false;
    setIsScanning(false);
    setReceiptImage(null);
    setShowImageActions(false);
    setOcrExtracted(false);
    setOcrDetections(createEmptyOcrDetections());
    setAiSuggestion(null);
  };

  const handleCategorySelect = (category: TransactionCategory) => {
    setSelectedCategory(category);
    setCategorySearch(category.name);
  };

  const handleTypeChange = (nextType: 'income' | 'expense' | 'transfer' | 'debt') => {
    setType(nextType);
    setSelectedCategory(null);
    setShowCategoryDropdown(false);
    setCategorySearch('');
    setFromAccount('');
    setToAccount('');
    setFromAccountSearch('');
    setToAccountSearch('');
    setShowFromAccountDropdown(false);
    setShowToAccountDropdown(false);
    setOcrDetections(createEmptyOcrDetections());
  };

  const handleSubmit = async () => {
    if (!amount || !description.trim()) {
      Alert.alert('Error', 'Please fill in amount and description');
      return;
    }

    if (type !== 'transfer' && !selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (type === 'expense' && !fromAccount) {
      Alert.alert('Error', 'Please select the account used for this expense');
      return;
    }

    if (type === 'income' && !toAccount) {
      Alert.alert('Error', 'Please select the account that received this income');
      return;
    }

    if (type === 'transfer' && (!fromAccount || !toAccount)) {
      Alert.alert('Error', 'Please select both accounts for transfer');
      return;
    }

    if (type === 'debt') {
      if (debtDirection === 'borrowed' && !toAccount) {
        Alert.alert('Error', 'Please select the account receiving this loan');
        return;
      }

      if (debtDirection === 'lent' && !fromAccount) {
        Alert.alert('Error', 'Please select the account used to lend this loan');
        return;
      }
    }

    if (type === 'transfer' && fromAccount === toAccount) {
      Alert.alert('Error', 'Cannot transfer to the same account');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const parsedTransactionDate = transactionDate ? parseDateInput(transactionDate) : null;
    if (transactionDate && !parsedTransactionDate) {
      Alert.alert('Error', 'Please enter a valid transaction date in YYYY-MM-DD format');
      return;
    }

    const resolvedDate = parsedTransactionDate ?? new Date();

    let parsedDueDate: Date | undefined;
    if (type === 'debt' && dueDate) {
      parsedDueDate = parseDateInput(dueDate) ?? undefined;
      if (!parsedDueDate) {
        Alert.alert('Error', 'Please enter a valid due date in YYYY-MM-DD format');
        return;
      }
    }

    let parsedInterestRate: number | undefined;
    if (type === 'debt' && interestRate) {
      const parsedRate = Number(interestRate);
      if (!Number.isFinite(parsedRate) || parsedRate < 0) {
        Alert.alert('Error', 'Please enter a valid interest rate');
        return;
      }
      parsedInterestRate = parsedRate;
    }

    let parsedRecurringEndDate: Date | undefined;
    if (isRecurring && recurringEndDate) {
      parsedRecurringEndDate = parseDateInput(recurringEndDate) ?? undefined;
      if (!parsedRecurringEndDate) {
        Alert.alert('Error', 'Please enter a valid recurring end date in YYYY-MM-DD format');
        return;
      }

      const recurringStartDate = new Date(resolvedDate);
      recurringStartDate.setHours(0, 0, 0, 0);

      const recurringEndAtStartOfDay = new Date(parsedRecurringEndDate);
      recurringEndAtStartOfDay.setHours(0, 0, 0, 0);

      if (recurringEndAtStartOfDay.getTime() < recurringStartDate.getTime()) {
        Alert.alert('Error', 'Recurring end date must be on or after the transaction date');
        return;
      }
    }

    const category = type === 'transfer' ? TRANSFER_CATEGORY : selectedCategory;
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const trimmedDescription = description.trim();
    const merchantName =
      type === 'debt' ? (counterparty.trim() || trimmedDescription) : trimmedDescription;
    const transactionData: NewTransactionInput = {
      amount: numAmount,
      description: trimmedDescription,
      type,
      date: resolvedDate,
      category,
      merchant: merchantName || undefined,
      debtDirection: type === 'debt' ? debtDirection : undefined,
      counterparty: type === 'debt' ? (counterparty.trim() || merchantName || undefined) : undefined,
      dueDate: type === 'debt' ? parsedDueDate : undefined,
      interestRate: type === 'debt' ? parsedInterestRate : undefined,
      debtPayment: type === 'expense' ? debtPayment : undefined,
      fromAccount: type === 'expense' || type === 'transfer' ? fromAccount : undefined,
      toAccount: type === 'income' || type === 'transfer' ? toAccount : undefined,
    };

    if (type === 'debt') {
      transactionData.fromAccount = debtDirection === 'lent' ? fromAccount : undefined;
      transactionData.toAccount = debtDirection === 'borrowed' ? toAccount : undefined;
    }

    // Add receipt image if exists
    if (receiptImage) {
      try {
        transactionData.receiptImage = await persistReceiptImage(receiptImage);
      } catch (error) {
        console.error('Failed to persist receipt image:', error);
        Alert.alert('Error', 'Failed to save receipt image. Please try again.');
        return;
      }
    }

    if (isRecurring) {
      transactionData.isRecurring = true;
      transactionData.recurringFrequency = recurringFrequency;
      if (parsedRecurringEndDate) {
        transactionData.recurringEndDate = parsedRecurringEndDate;
      }
    }

    addTransaction(transactionData);

    if (merchantName && type !== 'transfer') {
      learnMerchantCategory(merchantName, category.id);
    }
    handleClose();
  };

  const handleClose = () => {
    ocrRequestIdRef.current += 1;
    ocrInFlightRef.current = false;
    setAmount('');
    setDescription('');
    setTransactionDate('');
    setSelectedCategory(null);
    setFromAccount('');
    setToAccount('');
    setIsRecurring(false);
    setRecurringFrequency('monthly');
    setRecurringEndDate('');
    setShowCalculator(false);
    setCalculatorDisplay('0');
    setCalculatorInput('');
    setShowCategoryDropdown(false);
    setCategorySearch('');
    setFromAccountSearch('');
    setToAccountSearch('');
    setShowFromAccountDropdown(false);
    setShowToAccountDropdown(false);
    setReceiptImage(null);
    setIsScanning(false);
    setOcrExtracted(false);
    setOcrDetections(createEmptyOcrDetections());
    setShowImageActions(false);
    setDebtDirection('borrowed');
    setCounterparty('');
    setDueDate('');
    setInterestRate('');
    setDebtPayment(false);
    setAiSuggestion(null);
    onClose();
  };

  const handleCalculatorPress = (value: string) => {
    if (value === 'C') {
      setCalculatorDisplay('0');
      setCalculatorInput('');
    } else if (value === '=') {
      try {
        const result = evaluateCalculatorExpression(calculatorInput || calculatorDisplay);
        const displayValue = toCalculatorDisplay(result);
        setCalculatorDisplay(displayValue);
        setAmount(displayValue);
        setCalculatorInput('');
      } catch (error) {
        setCalculatorDisplay('Error');
      }
    } else if (value === '⌫') {
      if (calculatorDisplay === 'Error') {
        setCalculatorDisplay('0');
        setCalculatorInput('');
        return;
      }

      const newDisplay = calculatorDisplay.slice(0, -1) || '0';
      setCalculatorDisplay(newDisplay);
      setCalculatorInput(newDisplay);
    } else {
      if (calculatorDisplay === 'Error') {
        const resetValue = value === '.' ? '0.' : value;
        setCalculatorDisplay(resetValue);
        setCalculatorInput(resetValue);
        return;
      }

      if (value === '.') {
        const activeChunk = (calculatorDisplay.split(/[+\-*/]/).pop() ?? '');
        if (activeChunk.includes('.')) {
          return;
        }
      }

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

  const renderCategoryDropdown = () => {
    if (type === 'transfer' || !showCategoryDropdown) return null;

    return (
      <View style={[styles.dropdownContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.dropdownHeader, { borderBottomColor: theme.colors.border }]}>
          <Search size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.categorySearch, { color: theme.colors.text }]}
            placeholder="Search categories..."
            placeholderTextColor={theme.colors.textSecondary}
            value={categorySearch}
            onChangeText={setCategorySearch}
            autoFocus
          />
        </View>
        
        <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
          {filteredCategories.map((category) => {
            if (!category?.id?.trim()) return null;
            const IconComponent = (Icons as any)[category.icon] || Icons.Circle;
            const isSelected = selectedCategory?.id === category.id;
            
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.dropdownItem,
                  { backgroundColor: theme.colors.background },
                  isSelected && { backgroundColor: theme.colors.primary + '20' },
                ]}
                onPress={() => {
                  handleCategorySelect(category);
                  setShowCategoryDropdown(false);
                }}
              >
                <View style={styles.dropdownItemLeft}>
                  <View style={[styles.dropdownIcon, { backgroundColor: category.color + '20' }]}>
                    <IconComponent size={16} color={category.color} />
                  </View>
                  <Text style={[
                    styles.dropdownItemText, 
                    { color: theme.colors.text },
                    isSelected && { color: theme.colors.primary, fontWeight: '600' }
                  ]}>
                    {category.name}
                  </Text>
                </View>
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
          
          {filteredCategories.length === 0 && (
            <View style={styles.noResults}>
              <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>
                No categories found
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // Account selection components
  const renderAccountSelection = () => {
    const selectedFrom = accounts.find((account) => account.id === fromAccount);
    const selectedTo = accounts.find((account) => account.id === toAccount);
    const normalizedFromSearch = fromAccountSearch.trim().toLowerCase();
    const normalizedToSearch = toAccountSearch.trim().toLowerCase();

    const accountTypeIcons = {
      checking: Wallet,
      savings: PiggyBank,
      credit: CreditCard,
      investment: TrendingUp,
      cash: Landmark,
    } as const;

    const renderAccountOption = (
      account: typeof accounts[0],
      selectedId: string,
      onSelect: (accountId: string, accountName: string) => void
    ) => {
      const isSelected = selectedId === account.id;
      const AccountIcon = accountTypeIcons[account.type] ?? Wallet;

      return (
        <TouchableOpacity
          key={account.id}
          style={[
            styles.transferDropdownItem,
            { borderBottomColor: theme.colors.border },
            isSelected && { backgroundColor: theme.colors.primary + '14' },
          ]}
          onPress={() => onSelect(account.id, account.name)}
        >
          <View style={styles.transferDropdownItemLeft}>
            <View style={[styles.accountIcon, { backgroundColor: account.color + '20' }]}>
              <AccountIcon size={18} color={account.color || theme.colors.primary} />
            </View>
            <View>
              <Text
                style={[
                  styles.transferDropdownLabel,
                  { color: theme.colors.text },
                  isSelected && { color: theme.colors.primary, fontWeight: '600' },
                ]}
              >
                {account.name}
              </Text>
              <Text style={[styles.transferDropdownBalance, { color: theme.colors.textSecondary }]}>
                {formatCurrency(account.balance)}
              </Text>
            </View>
          </View>
          {isSelected && <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]} />}
        </TouchableOpacity>
      );
    };

    const renderPicker = ({
      label,
      searchValue,
      selectedAccount,
      selectedId,
      setSearch,
      setSelected,
      showDropdown,
      setShowDropdown,
      options,
      emptyLabel,
      placeholder,
      onOpen,
    }: {
      label: string;
      searchValue: string;
      selectedAccount?: typeof accounts[0];
      selectedId: string;
      setSearch: (value: string) => void;
      setSelected: (value: string) => void;
      showDropdown: boolean;
      setShowDropdown: (value: boolean) => void;
      options: typeof accounts;
      emptyLabel: string;
      placeholder: string;
      onOpen?: () => void;
    }) => (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
        <View
          style={[
            styles.transferInputContainer,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Search size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.transferAccountInput, { color: theme.colors.text }]}
            value={searchValue}
            onChangeText={(value) => {
              setSearch(value);
              setShowDropdown(true);
              if (selectedAccount && value.trim().toLowerCase() !== selectedAccount.name.toLowerCase()) {
                setSelected('');
              }
            }}
            onFocus={() => {
              setShowDropdown(true);
              onOpen?.();
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TouchableOpacity
            onPress={() => {
              if (searchValue) {
                setSearch('');
                setSelected('');
                setShowDropdown(true);
                onOpen?.();
              } else {
                setShowDropdown(!showDropdown);
                onOpen?.();
              }
            }}
            style={styles.transferInputAction}
          >
            {searchValue ? (
              <X size={16} color={theme.colors.textSecondary} />
            ) : showDropdown ? (
              <ChevronUp size={16} color={theme.colors.textSecondary} />
            ) : (
              <ChevronDown size={16} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
        {showDropdown && (
          <View style={[styles.transferDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            {accounts.length === 0 ? (
              <View style={styles.transferEmptyState}>
                <Text style={[styles.emptyAccountsText, { color: theme.colors.textSecondary }]}>Loading accounts...</Text>
              </View>
            ) : options.length === 0 ? (
              <View style={styles.transferEmptyState}>
                <Text style={[styles.emptyAccountsText, { color: theme.colors.textSecondary }]}>{emptyLabel}</Text>
              </View>
            ) : (
              <ScrollView style={styles.transferDropdownList} nestedScrollEnabled>
                {options.map((account: typeof accounts[0]) =>
                  renderAccountOption(account, selectedId, (accountId, accountName) => {
                    setSelected(accountId);
                    setSearch(accountName);
                    setShowDropdown(false);
                  })
                )}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    );

    if (type === 'expense') {
      const options = accounts.filter((account) => {
        if (!normalizedFromSearch) return true;
        return account.name.toLowerCase().includes(normalizedFromSearch);
      });

      return renderPicker({
        label: 'Account',
        searchValue: fromAccountSearch,
        selectedAccount: selectedFrom,
        selectedId: fromAccount,
        setSearch: setFromAccountSearch,
        setSelected: setFromAccount,
        showDropdown: showFromAccountDropdown,
        setShowDropdown: setShowFromAccountDropdown,
        options,
        emptyLabel: 'No matching account',
        placeholder: 'Type to find the account used',
        onOpen: () => setShowToAccountDropdown(false),
      });
    }

    if (type === 'income') {
      const options = accounts.filter((account) => {
        if (!normalizedToSearch) return true;
        return account.name.toLowerCase().includes(normalizedToSearch);
      });

      return renderPicker({
        label: 'Account',
        searchValue: toAccountSearch,
        selectedAccount: selectedTo,
        selectedId: toAccount,
        setSearch: setToAccountSearch,
        setSelected: setToAccount,
        showDropdown: showToAccountDropdown,
        setShowDropdown: setShowToAccountDropdown,
        options,
        emptyLabel: 'No matching account',
        placeholder: 'Type to find the receiving account',
        onOpen: () => setShowFromAccountDropdown(false),
      });
    }
    if (type === 'debt') {
      const options = accounts.filter((account) => {
        const search = debtDirection === 'borrowed' ? normalizedToSearch : normalizedFromSearch;
        if (!search) return true;
        return account.name.toLowerCase().includes(search);
      });

      return renderPicker({
        label: 'Account',
        searchValue: debtDirection === 'borrowed' ? toAccountSearch : fromAccountSearch,
        selectedAccount: debtDirection === 'borrowed' ? selectedTo : selectedFrom,
        selectedId: debtDirection === 'borrowed' ? toAccount : fromAccount,
        setSearch: debtDirection === 'borrowed' ? setToAccountSearch : setFromAccountSearch,
        setSelected: debtDirection === 'borrowed' ? setToAccount : setFromAccount,
        showDropdown: debtDirection === 'borrowed' ? showToAccountDropdown : showFromAccountDropdown,
        setShowDropdown: debtDirection === 'borrowed' ? setShowToAccountDropdown : setShowFromAccountDropdown,
        options,
        emptyLabel: 'No matching account',
        placeholder: debtDirection === 'borrowed'
          ? 'Type to find the receiving account'
          : 'Type to find the funding account',
        onOpen: () => {
          if (debtDirection === 'borrowed') {
            setShowFromAccountDropdown(false);
          } else {
            setShowToAccountDropdown(false);
          }
        },
      });
    }

    if (type !== 'transfer') {
      return null;
    }

    const fromOptions = accounts.filter((account) => {
      if (account.id === toAccount) return false;
      if (!normalizedFromSearch) return true;
      return account.name.toLowerCase().includes(normalizedFromSearch);
    });

    const toOptions = accounts.filter((account) => {
      if (account.id === fromAccount) return false;
      if (!normalizedToSearch) return true;
      return account.name.toLowerCase().includes(normalizedToSearch);
    });

    return (
      <>
        {renderPicker({
          label: 'From Account',
          searchValue: fromAccountSearch,
          selectedAccount: selectedFrom,
          selectedId: fromAccount,
          setSearch: setFromAccountSearch,
          setSelected: setFromAccount,
          showDropdown: showFromAccountDropdown,
          setShowDropdown: setShowFromAccountDropdown,
          options: fromOptions,
          emptyLabel: 'No matching source account',
          placeholder: 'Type to find source account',
          onOpen: () => setShowToAccountDropdown(false),
        })}

        {renderPicker({
          label: 'To Account',
          searchValue: toAccountSearch,
          selectedAccount: selectedTo,
          selectedId: toAccount,
          setSearch: setToAccountSearch,
          setSelected: setToAccount,
          showDropdown: showToAccountDropdown,
          setShowDropdown: setShowToAccountDropdown,
          options: toOptions,
          emptyLabel: 'No matching destination account',
          placeholder: 'Type to find destination account',
          onOpen: () => setShowFromAccountDropdown(false),
        })}

        {fromAccount && toAccount && fromAccount !== toAccount && (
          <View style={[styles.transferPreview, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <Text style={[styles.transferPreviewTitle, { color: theme.colors.text }]}>Transfer Preview</Text>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>Amount:</Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>{formatCurrency(parseFloat(amount) || 0)}</Text>
            </View>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>From:</Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>{selectedFrom?.name || 'Unknown'}</Text>
            </View>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>To:</Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>{selectedTo?.name || 'Unknown'}</Text>
            </View>
          </View>
        )}
      </>
    );
  };

  // Render receipt scanning section
  const renderReceiptSection = () => {
    if (type === 'transfer') return null;

    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Receipt Scanning {ocrExtracted && <CheckCircle size={16} color="#10B981" />}
        </Text>
        
        {receiptImage ? (
          <View style={[styles.receiptContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.receiptImageContainer}>
              <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
              {isScanning && (
                <View style={styles.scanningOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={[styles.scanningText, { color: 'white' }]}>
                    Scanning receipt...
                  </Text>
                </View>
              )}
            </View>
            
            {showImageActions && !isScanning && (
              <View style={styles.imageActions}>
                {!ocrExtracted && (
                  <TouchableOpacity 
                    style={[styles.imageActionButton, { backgroundColor: theme.colors.primary }]}
                    onPress={scanReceipt}
                  >
                    <Scan size={16} color="white" />
                    <Text style={styles.imageActionText}>Scan Receipt</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={[styles.imageActionButton, { backgroundColor: theme.colors.error }]}
                  onPress={removeReceiptImage}
                >
                  <X size={16} color="white" />
                  <Text style={styles.imageActionText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.uploadButtons}>
            <TouchableOpacity 
              style={[styles.uploadButton, { backgroundColor: theme.colors.primary }]}
              onPress={takePhoto}
            >
              <Camera size={20} color="white" />
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.uploadButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={pickImage}
            >
              <Upload size={20} color={theme.colors.text} />
              <Text style={[styles.uploadButtonText, { color: theme.colors.text }]}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <Text style={[styles.receiptHint, { color: theme.colors.textSecondary }]}>
          {ocrExtracted 
            ? '✓ Details extracted from receipt'
            : 'Upload a receipt photo to automatically fill transaction details'}
        </Text>

        {ocrExtracted ? (
          <View style={styles.ocrDetectionList}>
            <Text
              style={[
                styles.ocrDetectionItem,
                { color: ocrDetections.merchant ? '#10B981' : theme.colors.textSecondary },
              ]}
            >
              {ocrDetections.merchant ? '✓ Merchant detected' : 'Merchant not detected'}
            </Text>
            <Text
              style={[
                styles.ocrDetectionItem,
                { color: ocrDetections.amount ? '#10B981' : theme.colors.textSecondary },
              ]}
            >
              {ocrDetections.amount ? '✓ Amount detected' : 'Amount not detected'}
            </Text>
            <Text
              style={[
                styles.ocrDetectionItem,
                { color: ocrDetections.date ? '#10B981' : theme.colors.textSecondary },
              ]}
            >
              {ocrDetections.date ? '✓ Date detected' : 'Date not detected'}
            </Text>
          </View>
        ) : null}

        {aiSuggestion ? (
          <View style={[styles.aiSuggestionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <View style={styles.aiSuggestionHeader}>
              <Text style={[styles.aiSuggestionTitle, { color: theme.colors.text }]}>AI Suggestion</Text>
              <Text style={[styles.aiSuggestionConfidence, { color: theme.colors.textSecondary }]}> 
                {Math.round(aiSuggestion.confidence * 100)}%
              </Text>
            </View>
            <Text style={[styles.aiSuggestionText, { color: theme.colors.textSecondary }]}> 
              Category: {aiCategoryName ?? 'Other'}
            </Text>
            <Text style={[styles.aiSuggestionMeta, { color: theme.colors.textSecondary }]}> 
              Source: {aiSuggestion.source === 'merchant_memory' ? 'Merchant memory' : aiSuggestion.source === 'ai_classifier' ? 'AI classifier' : 'Fallback'}
            </Text>
            {aiSuggestion.debtIntent ? (
              <Text style={[styles.aiSuggestionMeta, { color: theme.colors.textSecondary }]}> 
                Debt signal: {aiSuggestion.debtIntent.type === 'debt'
                  ? `Loan ${aiSuggestion.debtIntent.direction ?? 'detected'}`
                  : 'Repayment'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

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

          {renderReceiptSection()}

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
              onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
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

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Date</Text>
            <View style={[styles.dateInputGroup, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Calendar size={16} color={theme.colors.primary} />
              <TextInput
                style={[styles.dateInput, { color: theme.colors.text }]}
                value={transactionDate}
                onChangeText={setTransactionDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          </View>

          {type !== 'transfer' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
                <View style={[styles.categorySearchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                  <Search size={16} color={theme.colors.textSecondary} />
                  <TextInput
                    style={[styles.categorySearchInput, { color: theme.colors.text }]}
                    placeholder="Search or scroll categories"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={categorySearch}
                    onChangeText={setCategorySearch}
                  />
                  {categorySearch ? (
                    <TouchableOpacity onPress={() => setCategorySearch('')}>
                      <X size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <FlatList
                  ref={categoryListRef}
                  data={filteredCategories}
                  horizontal
                  keyExtractor={(category) => category.id}
                  getItemLayout={(_, index) => ({
                    length: CATEGORY_CHIP_ESTIMATED_WIDTH,
                    offset: CATEGORY_CHIP_ESTIMATED_WIDTH * index,
                    index,
                  })}
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryChipScroll}
                  contentContainerStyle={styles.categoryChipRow}
                  onScrollToIndexFailed={({ index }) => {
                    const safeIndex = Math.max(0, Math.min(index, filteredCategories.length - 1));
                    setTimeout(() => {
                      categoryListRef.current?.scrollToIndex({
                        index: safeIndex,
                        animated: true,
                        viewPosition: 0.5,
                      });
                    }, 80);
                  }}
                  renderItem={({ item: category }) => {
                    const isSelected = selectedCategory?.id === category.id;
                    const IconComponent = (Icons as any)[category.icon] || Icons.Circle;

                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: isSelected ? theme.colors.primary : category.color,
                          },
                        ]}
                        onPress={() => handleCategorySelect(category)}
                      >
                        <View style={[styles.categoryChipIcon, { backgroundColor: category.color + '20' }]}>
                          <IconComponent size={18} color={category.color} />
                        </View>
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
                  }}
                />
                {filteredCategories.length === 0 ? (
                  <View style={styles.noResults}>
                    <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>No categories found</Text>
                  </View>
                ) : null}
              </View>
              {renderAccountSelection()}
            </>
          ) : (
            renderAccountSelection()
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
              <View style={[styles.dateInputGroup, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                <Calendar size={16} color={theme.colors.primary} />
                <TextInput
                  style={[styles.dateInput, { color: theme.colors.text }]}
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
              <View style={styles.recurringRow}>
                <View style={styles.recurringInfo}>
                  <Landmark size={20} color={theme.colors.primary} />
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
  inputGroup: {
    marginBottom: 24,
    position: 'relative',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  // Category Dropdown Styles
  categoryDropdownTrigger: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categorySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  categoryChipScroll: {
    marginTop: 12,
  },
  categoryChipRow: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 4,
  },
  categoryChip: {
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    minWidth: 92,
    borderWidth: 2,
  },
  categoryChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedCategoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCategoryText: {
    fontSize: 16,
    fontWeight: '500',
  },
  placeholderText: {
    fontSize: 16,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 300,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  categorySearch: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  dropdownList: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemText: {
    fontSize: 16,
  },
  checkmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  noResults: {
    padding: 24,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
  },
  // Transfer Section Styles
  transferInputContainer: {
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transferAccountInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  transferInputAction: {
    padding: 4,
  },
  transferDropdown: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 220,
    overflow: 'hidden',
  },
  transferDropdownList: {
    maxHeight: 220,
  },
  transferDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  transferDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  transferDropdownLabel: {
    fontSize: 15,
  },
  transferDropdownBalance: {
    fontSize: 12,
    marginTop: 2,
  },
  transferEmptyState: {
    padding: 16,
    alignItems: 'center',
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAccountsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  transferPreview: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transferPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  transferPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transferPreviewLabel: {
    fontSize: 14,
  },
  transferPreviewValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Receipt Scanning Styles
  receiptContainer: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  receiptImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  scanningText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  imageActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  imageActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButtons: {
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  receiptHint: {
    fontSize: 12,
    marginTop: 4,
  },
  ocrDetectionList: {
    marginTop: 8,
    gap: 4,
  },
  ocrDetectionItem: {
    fontSize: 12,
    fontWeight: '500',
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
