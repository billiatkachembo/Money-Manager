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
  Dimensions,
  Keyboard,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  X,
  Repeat, 
  ArrowLeftRight, 
  ArrowDownRight,
  ArrowUpRight,
  Calendar, 
  ChevronDown, 
  ChevronUp,
  Search,
  Camera,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Icons from 'lucide-react-native';
import { Transaction, TransactionCategory } from '@/types/transaction';
import { createCustomCategory, mergeCategories } from '@/constants/categories';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { formatDateDDMMYYYY, formatDateTimeWithWeekday } from '@/utils/date';
import { AmountCalculatorSheet } from '@/components/AmountCalculatorSheet';
import { AccountSelectorSheet } from '@/components/AccountSelectorSheet';
import { QuickAccountCreateModal } from '@/components/QuickAccountCreateModal';
import { getAdaptiveAmountFontSize } from '@/components/ui/AdaptiveAmountText';
import type { QuickAccountCreateInput } from '@/components/QuickAccountCreateModal';
import { CategorySelectorSheet } from '@/components/CategorySelectorSheet';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { normalizeReceiptDate, ReceiptAiDraft, runReceiptOcr } from '@/utils/receiptOcr';
import { useRouter } from 'expo-router';
import { useBottomSheetController } from '@/hooks/useBottomSheetController';
import { useI18n } from '@/src/i18n';

type NewTransactionInput = Omit<Transaction, 'id' | 'createdAt'>;

const TRANSFER_CATEGORY: TransactionCategory = {
  id: 'transfer',
  name: 'Transfer',
  icon: 'ArrowLeftRight',
  color: '#667eea',
};

const CATEGORY_CHIP_ESTIMATED_WIDTH = 108;

const ACCOUNT_TYPE_ICONS = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  cash: Landmark,
} as const;

const TRANSACTION_TYPE_OPTIONS: Array<{
  key: 'expense' | 'income' | 'transfer' | 'debt';
  label: string;
  accent: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  { key: 'expense', label: 'Expense', accent: '#C2410C', icon: ArrowDownRight },
  { key: 'income', label: 'Income', accent: '#166534', icon: ArrowUpRight },
  { key: 'transfer', label: 'Transfer', accent: '#1D4ED8', icon: ArrowLeftRight },
  { key: 'debt', label: 'Debt', accent: '#7E22CE', icon: Landmark },
];

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

  const isoMatch = normalized.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dayFirstMatch = normalized.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(normalized);
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

function formatTransactionDateSummary(value: Date): string {
  return formatDateTimeWithWeekday(value);
}

function mergeDateWithExistingTime(value: Date, reference: Date): Date {
  const merged = new Date(value);
  merged.setHours(reference.getHours(), reference.getMinutes(), reference.getSeconds(), reference.getMilliseconds());
  return merged;
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
  initialType?: 'income' | 'expense' | 'transfer' | 'debt';
}

export function AddTransactionModal({ visible, onClose, initialType }: AddTransactionModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { activeSheet, openSheet, closeSheet } = useBottomSheetController<'calculator' | 'accounts' | 'category'>();
  const [type, setType] = useState<'income' | 'expense' | 'transfer' | 'debt'>('expense');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setType(initialType ?? 'expense');
  }, [initialType, visible]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [accountSheetTarget, setAccountSheetTarget] = useState<'from' | 'to' | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);
  const [showTransactionDatePicker, setShowTransactionDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showRecurringEndDatePicker, setShowRecurringEndDatePicker] = useState(false);
  const [calculatorDraft, setCalculatorDraft] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrExtracted, setOcrExtracted] = useState(false);
  const [ocrDetections, setOcrDetections] = useState(createEmptyOcrDetections);
  const [showImageActions, setShowImageActions] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [debtDirection, setDebtDirection] = useState<'borrowed' | 'lent'>('borrowed');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [interestRate, setInterestRate] = useState('');
  const [debtPayment, setDebtPayment] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<ReceiptAiDraft | null>(null);
  const [sheetMaxHeight, setSheetMaxHeight] = useState<number | undefined>(undefined);
  const [showQuickAccountModal, setShowQuickAccountModal] = useState(false);
  const categoryFieldRef = useRef<TextInput>(null);
  const accountFromFieldRef = useRef<TextInput>(null);
  const accountToFieldRef = useRef<TextInput>(null);
  const ocrInFlightRef = useRef(false);
  const ocrRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const categoryListRef = useRef<FlatList<TransactionCategory>>(null);
  
  const {
    addAccount,
    addTransaction,
    accounts,
    expenseCategories,
    formatCurrency,
    incomeCategories,
    merchantProfiles,
    learnMerchantCategory,
    saveCustomCategory,
    settings,
  } = useTransactionStore();

  const translatedTypeOptions = useMemo(
    () => TRANSACTION_TYPE_OPTIONS.map((option) => ({ ...option, label: t(`addTransaction.${option.key}`) })),
    [t]
  );

  const categories = useMemo(() => {
    return type === 'transfer'
      ? []
      : type === 'income'
        ? incomeCategories
        : expenseCategories;
  }, [expenseCategories, incomeCategories, type]);

  const filteredCategories = useMemo(
    () => mergeCategories(categories, selectedCategory ? [selectedCategory] : []),
    [categories, selectedCategory]
  );

  const displayTransactionDate = transactionDate ?? new Date();

  const selectedTypeOption = useMemo(
    () => translatedTypeOptions.find((option) => option.key === type) ?? translatedTypeOptions[0],
    [translatedTypeOptions, type]
  );

  const accountLabel = t('common.account');
  const accountSheetTitle = useMemo(() => {
    if (!accountSheetTarget) {
      return accountLabel;
    }

    if (type === 'transfer') {
      return accountSheetTarget === 'from'
        ? `${t('common.from')} ${accountLabel}`
        : `${t('common.to')} ${accountLabel}`;
    }

    return accountLabel;
  }, [accountLabel, accountSheetTarget, t, type]);
  const accountSheetHeader = accountSheetTitle === accountLabel ? t('common.accounts') : accountSheetTitle;

  const accountSheetAccounts = useMemo(() => {
    if (!accountSheetTarget) {
      return accounts;
    }

    if (type !== 'transfer') {
      return accounts;
    }

    const excludeId = accountSheetTarget === 'from' ? toAccount : fromAccount;
    return accounts.filter((account) => account.id !== excludeId);
  }, [accounts, accountSheetTarget, fromAccount, toAccount, type]);

  const aiCategoryName = useMemo(() => {
    if (!aiSuggestion) return null;
    const pool = aiSuggestion.debtIntent?.type === 'debt'
      ? expenseCategories
      : type === 'income'
        ? incomeCategories
        : expenseCategories;
    return pool.find((category) => category.id === aiSuggestion.categoryId)?.name ?? 'Other';
  }, [aiSuggestion, expenseCategories, incomeCategories, type]);

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
      const categoryPool = preferredType === 'income' ? incomeCategories : expenseCategories;
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
        const parsedDate = parseDateInput(normalizedDate);
        if (parsedDate) {
          setTransactionDate(parsedDate);
        }
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
    setShowUploadMenu(false);
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
    setShowUploadMenu(false);
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
    setShowUploadMenu(false);
    setOcrExtracted(false);
    setOcrDetections(createEmptyOcrDetections());
    setAiSuggestion(null);
  };

  const handleCategorySelect = (category: TransactionCategory) => {
    setSelectedCategory(category);
  };

  const handleCreateCategory = (name: string) => {
    const categoryType = type === 'income' ? 'income' : type === 'debt' ? 'debt' : 'expense';
    const nextCategory = createCustomCategory(name, categoryType, filteredCategories);
    const savedCategory = saveCustomCategory(nextCategory, categoryType);
    handleCategorySelect(savedCategory);
  };

    const handleTypeChange = (nextType: 'income' | 'expense' | 'transfer' | 'debt') => {
    setType(nextType);
    setSelectedCategory(null);
    setFromAccount('');
    setToAccount('');
    setAccountSheetTarget(null);
    closeSheet();
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

    const resolvedDate = transactionDate ?? new Date();

    const parsedDueDate = type === 'debt' ? dueDate ?? undefined : undefined;

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
      parsedRecurringEndDate = recurringEndDate;

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
    closeSheet();
    setAccountSheetTarget(null);
    setSheetMaxHeight(undefined);
    setAmount('');
    setDescription('');
    setTransactionDate(null);
    setSelectedCategory(null);
    setFromAccount('');
    setToAccount('');
    setIsRecurring(false);
    setRecurringFrequency('monthly');
    setRecurringEndDate(null);
    setShowTransactionDatePicker(false);
    setShowDueDatePicker(false);
    setShowRecurringEndDatePicker(false);
    setCalculatorDraft('');
    setReceiptImage(null);
    setIsScanning(false);
    setOcrExtracted(false);
    setOcrDetections(createEmptyOcrDetections());
    setShowImageActions(false);
    setShowUploadMenu(false);
    setShowQuickAccountModal(false);
    setDebtDirection('borrowed');
    setCounterparty('');
    setDueDate(null);
    setInterestRate('');
    setDebtPayment(false);
    setAiSuggestion(null);
    setSheetMaxHeight(undefined);
    onClose();
  };

  const closeActiveSheet = () => {
    closeSheet();
    setAccountSheetTarget(null);
    setSheetMaxHeight(undefined);
  };

  const openCalculatorSheet = () => {
    Keyboard.dismiss();
    setCalculatorDraft(amount);
    openSheet('calculator');
  };

  const handleCalculatorSheetClose = () => {
    setCalculatorDraft(amount);
    closeActiveSheet();
  };

  const amountEntryValue = (activeSheet === 'calculator' ? calculatorDraft : amount).replace(/\*/g, 'x');
  const amountFieldFontSize = useMemo(() => getAdaptiveAmountFontSize(amountEntryValue || '0', 19, 14), [amountEntryValue]);

  const openAnchoredSheet = (
    sheetName: 'category' | 'accounts',
    fieldRef?: React.RefObject<TextInput | null>,
    beforeOpen?: () => void
  ) => {
    Keyboard.dismiss();
    beforeOpen?.();

    const fieldNode = fieldRef?.current;
    if (!fieldNode || typeof fieldNode.measureInWindow !== 'function') {
      setSheetMaxHeight(undefined);
      openSheet(sheetName);
      return;
    }

    fieldNode.measureInWindow((_x, y, _width, height) => {
      const availableHeight = Dimensions.get('window').height - (y + height) - 8;
      setSheetMaxHeight(Number.isFinite(availableHeight) ? Math.max(0, availableHeight) : undefined);
      openSheet(sheetName);
    });
  };

  const renderPickerInputField = ({
    value,
    placeholder,
    onPress,
    inputRef,
    isActive = false,
  }: {
    value?: string;
    placeholder: string;
    onPress: () => void;
    inputRef?: React.RefObject<TextInput | null>;
    isActive?: boolean;
  }) => (
    <TextInput
      ref={inputRef}
      style={[
        styles.input,
        { borderBottomColor: isActive ? theme.colors.primary : theme.colors.border, color: value ? theme.colors.text : theme.colors.textSecondary },
      ]}
      value={value ?? ''}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSecondary}
      showSoftInputOnFocus={false}
      caretHidden
      contextMenuHidden
      onPressIn={() => {
        Keyboard.dismiss();
        onPress();
      }}
    />
  );

  const openCategorySheet = (fieldRef: React.RefObject<TextInput | null> = categoryFieldRef) => {
    openAnchoredSheet('category', fieldRef);
  };

  const openAccountsSheet = (
    target: 'from' | 'to',
    fieldRef?: React.RefObject<TextInput | null>
  ) => {
    openAnchoredSheet('accounts', fieldRef, () => {
      setAccountSheetTarget(target);
    });
  };

  const handleCurrencyAction = () => {
    closeActiveSheet();
    handleClose();
    router.replace('/(tabs)/profile');
  };

  const handleAccountsAction = () => {
    closeActiveSheet();
    handleClose();
    router.replace('/(tabs)/accounts');
  };

  const handleOpenQuickAccountModal = () => {
    closeSheet();
    setSheetMaxHeight(undefined);
    setShowQuickAccountModal(true);
  };

  const handleCloseQuickAccountModal = () => {
    setShowQuickAccountModal(false);
    setAccountSheetTarget(null);
    setSheetMaxHeight(undefined);
  };

  const handleQuickAccountSubmit = (accountData: QuickAccountCreateInput) => {
    const createdAccount = addAccount(accountData);
    if (!createdAccount) {
      Alert.alert('Error', 'Unable to create account right now. Please try again.');
      return;
    }

    if (accountSheetTarget === 'from') {
      setFromAccount(createdAccount.id);
    } else if (accountSheetTarget === 'to') {
      setToAccount(createdAccount.id);
    } else if (type === 'income') {
      setToAccount(createdAccount.id);
    } else {
      setFromAccount(createdAccount.id);
    }

    setShowQuickAccountModal(false);
    closeActiveSheet();
  };

  // Account selection components
  const renderAccountSelection = () => {
    const selectedFrom = accounts.find((account) => account.id === fromAccount);
    const selectedTo = accounts.find((account) => account.id === toAccount);

    const renderAccountField = ({
      label,
      selectedAccount,
      onPress,
      inputRef,
      isActive = false,
    }: {
      label: string;
      selectedAccount?: typeof accounts[0];
      onPress: () => void;
      inputRef?: React.RefObject<TextInput | null>;
      isActive?: boolean;
    }) => {
      return (
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
          {renderPickerInputField({
            value: selectedAccount?.name,
            placeholder: t('addTransaction.selectAccount'),
            onPress,
            inputRef,
            isActive,
          })}
        </View>
      );
    };

    if (type === 'expense') {
      return renderAccountField({
        label: t('common.account'),
        selectedAccount: selectedFrom,
        onPress: () => openAccountsSheet('from', accountFromFieldRef),
        inputRef: accountFromFieldRef,
        isActive: activeSheet === 'accounts' && accountSheetTarget === 'from',
      });
    }

    if (type === 'income') {
      return renderAccountField({
        label: t('common.account'),
        selectedAccount: selectedTo,
        onPress: () => openAccountsSheet('to', accountToFieldRef),
        inputRef: accountToFieldRef,
        isActive: activeSheet === 'accounts' && accountSheetTarget === 'to',
      });
    }

    if (type === 'debt') {
      const selected = debtDirection === 'borrowed' ? selectedTo : selectedFrom;
      return renderAccountField({
        label: t('common.account'),
        selectedAccount: selected,
        onPress: () => openAccountsSheet(
          debtDirection === 'borrowed' ? 'to' : 'from',
          debtDirection === 'borrowed' ? accountToFieldRef : accountFromFieldRef
        ),
        inputRef: debtDirection === 'borrowed' ? accountToFieldRef : accountFromFieldRef,
        isActive: activeSheet === 'accounts' && accountSheetTarget === (debtDirection === 'borrowed' ? 'to' : 'from'),
      });
    }

    if (type !== 'transfer') {
      return null;
    }

    return (
      <>
        {renderAccountField({
          label: `${t('common.from')} ${t('common.account')}`,
          selectedAccount: selectedFrom,
          onPress: () => openAccountsSheet('from', accountFromFieldRef),
          inputRef: accountFromFieldRef,
          isActive: activeSheet === 'accounts' && accountSheetTarget === 'from',
        })}

        {renderAccountField({
          label: `${t('common.to')} ${t('common.account')}`,
          selectedAccount: selectedTo,
          onPress: () => openAccountsSheet('to', accountToFieldRef),
          inputRef: accountToFieldRef,
          isActive: activeSheet === 'accounts' && accountSheetTarget === 'to',
        })}

        {fromAccount && toAccount && fromAccount !== toAccount && (
          <View style={[styles.transferPreview, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.transferPreviewTitle, { color: theme.colors.text }]}>{t('addTransaction.transferPreview')}</Text>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>{t('common.amount')}:</Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>
                {formatCurrency(parseFloat(amount) || 0)}
              </Text>
            </View>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>{t('common.from')}:</Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>{selectedFrom?.name || t('common.unknown')}</Text>
            </View>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>{t('common.to')}:</Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>{selectedTo?.name || t('common.unknown')}</Text>
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
          {t('addTransaction.receiptScanning')} {ocrExtracted && <CheckCircle size={16} color="#10B981" />}
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
                    <Text style={styles.imageActionText}>{t('addTransaction.scanReceipt')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={[styles.imageActionButton, { backgroundColor: theme.colors.error }]}
                  onPress={removeReceiptImage}
                >
                  <X size={16} color="white" />
                  <Text style={styles.imageActionText}>{t('common.remove')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}
        
        <Text style={[styles.receiptHint, { color: theme.colors.textSecondary }]}>
          {ocrExtracted
            ? t('addTransaction.receiptExtractedHint')
            : t('addTransaction.receiptHint')}
        </Text>

        {ocrExtracted ? (
          <View style={styles.ocrDetectionList}>
            <Text
              style={[
                styles.ocrDetectionItem,
                { color: ocrDetections.merchant ? '#10B981' : theme.colors.textSecondary },
              ]}
            >
              {ocrDetections.merchant ? '? Merchant detected' : 'Merchant not detected'}
            </Text>
            <Text
              style={[
                styles.ocrDetectionItem,
                { color: ocrDetections.amount ? '#10B981' : theme.colors.textSecondary },
              ]}
            >
              {ocrDetections.amount ? '? Amount detected' : 'Amount not detected'}
            </Text>
            <Text
              style={[
                styles.ocrDetectionItem,
                { color: ocrDetections.date ? '#10B981' : theme.colors.textSecondary },
              ]}
            >
              {ocrDetections.date ? '? Date detected' : 'Date not detected'}
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

  const categoryAccent = selectedCategory?.color ?? theme.colors.border;
  const CategoryIcon = selectedCategory ? ((Icons as any)[selectedCategory.icon] || Icons.Circle) : Icons.Circle;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

        <ScrollView
  style={styles.content}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
>
          <View style={styles.typeTitleRow}>
            <Text style={[styles.typeTitle, { color: selectedTypeOption.accent }]}>
              {selectedTypeOption.label}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.typeSelector}>
            {translatedTypeOptions.map((option) => {
              const isActive = type === option.key;
              const Icon = option.icon;

              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.typeButton}
                  activeOpacity={0.88}
                  onPress={() => handleTypeChange(option.key)}
                >
                  <View
                    style={[
                      styles.typeButtonSurface,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      isActive && [styles.typeButtonSurfaceActive, { backgroundColor: option.accent + '14', borderColor: option.accent }],
                    ]}
                  >
                    <View
                      style={[
                        styles.typeIconBadge,
                        {
                          backgroundColor: isActive ? option.accent : theme.colors.background,
                          borderColor: isActive ? option.accent : theme.colors.border,
                        },
                      ]}
                    >
                      <Icon size={16} color={isActive ? 'white' : option.accent} />
                    </View>
                    <Text
                      style={[
                        styles.typeButtonText,
                        { color: isActive ? option.accent : theme.colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={[
                styles.inlineDateField,
                { borderBottomColor: showTransactionDatePicker ? theme.colors.primary : theme.colors.border },
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setShowTransactionDatePicker(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.inlineDateLabel, { color: theme.colors.textSecondary }]}>{t('common.date')}</Text>
              <Text style={[styles.inlineDateValue, { color: theme.colors.text }]} numberOfLines={1}>
                {formatTransactionDateSummary(displayTransactionDate)}
              </Text>
            </TouchableOpacity>
            {showTransactionDatePicker ? (
              <DateTimePicker
                value={transactionDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, selectedDate) => {
                  setShowTransactionDatePicker(false);
                  if (selectedDate) {
                    setTransactionDate(mergeDateWithExistingTime(selectedDate, displayTransactionDate));
                  }
                }}
              />
            ) : null}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('common.amount')}</Text>
            <TextInput
              style={[
                styles.amountField,
                { fontSize: amountFieldFontSize },
                { borderBottomColor: activeSheet === 'calculator' ? theme.colors.primary : theme.colors.border, color: amountEntryValue ? theme.colors.text : theme.colors.textSecondary },
              ]}
              value={amountEntryValue}
              placeholderTextColor={theme.colors.textSecondary}
              showSoftInputOnFocus={false}
              caretHidden
              contextMenuHidden
              onPressIn={openCalculatorSheet}
            />
          </View>

          {type !== 'transfer' ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>{t('common.category')}</Text>
              {renderPickerInputField({
                value: selectedCategory?.name,
                placeholder: t('addTransaction.selectCategory'),
                onPress: openCategorySheet,
                inputRef: categoryFieldRef,
                isActive: activeSheet === 'category',
              })}
            </View>
          ) : null}

          {renderAccountSelection()}


          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t('common.description')}</Text>
            <TextInput
              style={[styles.input, { borderBottomColor: theme.colors.border, color: theme.colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('addTransaction.enterDescription')}
              placeholderTextColor={theme.colors.textSecondary}
              returnKeyType="done"
            />
          </View>

          {renderReceiptSection()}

          {type === 'debt' ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>{t('addTransaction.debtDetails')}</Text>
              <View style={[styles.debtDirectionRow, { backgroundColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.debtDirectionButton,
                    debtDirection === 'borrowed' && { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => setDebtDirection('borrowed')}
                >
                  <Text
                    style={[
                      styles.debtDirectionText,
                      { color: debtDirection === 'borrowed' ? theme.colors.text : theme.colors.textSecondary },
                    ]}
                  >{t('addTransaction.borrowed')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.debtDirectionButton,
                    debtDirection === 'lent' && { backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => setDebtDirection('lent')}
                >
                  <Text
                    style={[
                      styles.debtDirectionText,
                      { color: debtDirection === 'lent' ? theme.colors.text : theme.colors.textSecondary },
                    ]}
                  >{t('addTransaction.lent')}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { borderBottomColor: theme.colors.border, color: theme.colors.text }]}
                value={counterparty}
                onChangeText={setCounterparty}
                placeholder={t('addTransaction.counterparty')}
                placeholderTextColor={theme.colors.textSecondary}
              />
              {renderPickerInputField({
                value: dueDate ? formatDateDDMMYYYY(dueDate) : undefined,
                placeholder: t('addTransaction.dueDatePlaceholder'),
                onPress: () => setShowDueDatePicker(true),
                isActive: showDueDatePicker,
              })}
              {showDueDatePicker ? (
                <DateTimePicker
                  value={dueDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, selectedDate) => {
                    setShowDueDatePicker(false);
                    if (selectedDate) {
                      setDueDate(selectedDate);
                    }
                  }}
                />
              ) : null}
              <TextInput
                style={[styles.input, { borderBottomColor: theme.colors.border, color: theme.colors.text }]}
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder={t('addTransaction.interestRatePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          ) : null}

          <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: selectedTypeOption.accent }]} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>{t('addTransaction.addButton')}</Text>
            </TouchableOpacity>
            {type !== 'transfer' ? (
              <View style={styles.footerCameraAnchor}>
                <TouchableOpacity
                  style={[
                    styles.footerCameraButton,
                    { backgroundColor: selectedTypeOption.accent },
                  ]}
                  onPress={() => setShowUploadMenu((current) => !current)}
                  activeOpacity={0.88}
                >
                  <Camera size={18} color="white" />
                </TouchableOpacity>
                {showUploadMenu ? (
                  <View style={[styles.footerUploadMenu, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <TouchableOpacity style={styles.receiptUploadMenuItem} onPress={takePhoto} activeOpacity={0.8}>
                      <Camera size={16} color={theme.colors.text} />
                      <Text style={[styles.receiptUploadMenuText, { color: theme.colors.text }]}>{t('addTransaction.useCamera')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.receiptUploadMenuItem} onPress={pickImage} activeOpacity={0.8}>
                      <ImageIcon size={16} color={theme.colors.text} />
                      <Text style={[styles.receiptUploadMenuText, { color: theme.colors.text }]}>{t('addTransaction.chooseFromGallery')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          {type === 'expense' ? (
            <View style={[styles.inputGroup, styles.compactToggleGroup]}>
              <View style={[styles.recurringRow, styles.compactToggleRow]}>
                <View style={styles.recurringInfo}>
                  <Landmark size={20} color={theme.colors.primary} />
                  <Text style={[styles.label, styles.recurringToggleLabel, { color: theme.colors.text }]}>{t('addTransaction.debtPayment')}</Text>
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
            <View style={[styles.recurringRow, !isRecurring && styles.compactToggleRow]}>
              <View style={styles.recurringInfo}>
                <Repeat size={20} color={theme.colors.primary} />
                <Text style={[styles.label, styles.recurringToggleLabel, { color: theme.colors.text }]}>{t('addTransaction.recurringTransaction')}</Text>
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
                      <Text
                        style={[
                          styles.frequencyButtonText,
                          { color: recurringFrequency === freq ? 'white' : theme.colors.textSecondary },
                        ]}
                      >
                        {t(`addTransaction.${freq}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {renderPickerInputField({
                  value: recurringEndDate ? formatDateDDMMYYYY(recurringEndDate) : undefined,
                  placeholder: t('addTransaction.endDatePlaceholder'),
                  onPress: () => setShowRecurringEndDatePicker(true),
                  isActive: showRecurringEndDatePicker,
                })}
                {showRecurringEndDatePicker ? (
                  <DateTimePicker
                    value={recurringEndDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, selectedDate) => {
                      setShowRecurringEndDatePicker(false);
                      if (selectedDate) {
                        setRecurringEndDate(selectedDate);
                      }
                    }}
                  />
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
        <AmountCalculatorSheet
          visible={activeSheet === 'calculator'}
          value={calculatorDraft || amount}
          onChange={setCalculatorDraft}
          onClose={handleCalculatorSheetClose}
          onCurrencyPress={handleCurrencyAction}
          onConfirm={(nextValue) => {
            setAmount(nextValue);
            setCalculatorDraft(nextValue);
            closeActiveSheet();
          }}
        />
        <CategorySelectorSheet
          visible={activeSheet === 'category'}
          maxHeight={sheetMaxHeight}
          categories={filteredCategories}
          selectedCategoryId={selectedCategory?.id}
          onSelect={(category) => {
            handleCategorySelect(category);
            closeActiveSheet();
          }}
          onCreateCategory={(name) => {
            handleCreateCategory(name);
            closeActiveSheet();
          }}
          onClose={() => closeActiveSheet()}
        />
        <AccountSelectorSheet
          visible={activeSheet === 'accounts'}
          maxHeight={sheetMaxHeight}
          title={accountSheetHeader}
          accounts={accountSheetAccounts}
          selectedAccountId={
            accountSheetTarget === 'from'
              ? fromAccount
              : accountSheetTarget === 'to'
                ? toAccount
                : undefined
          }
          onSelect={(account) => {
            if (accountSheetTarget === 'from') {
              setFromAccount(account.id);
            }
            if (accountSheetTarget === 'to') {
              setToAccount(account.id);
            }
          }}
          onClose={() => closeActiveSheet()}
          onCreateAccount={handleOpenQuickAccountModal}
          onExpand={handleAccountsAction}
        />
        <QuickAccountCreateModal
          visible={showQuickAccountModal}
          currency={settings.currency || 'ZMW'}
          onClose={handleCloseQuickAccountModal}
          onSubmit={handleQuickAccountSubmit}
        />
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  typeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  typeTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: 0,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
  },
  typeButtonSurface: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typeButtonSurfaceActive: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  typeIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
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
  compactToggleGroup: {
    marginBottom: 12,
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
    minHeight: 42,
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 10,
    fontSize: 16,
    borderBottomWidth: 1,
  },
  inlineDateField: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineDateLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  inlineDateValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
  amountField: {
    minHeight: 38,
    paddingHorizontal: 0,
    paddingTop: 2,
    paddingBottom: 6,
    borderBottomWidth: 1,
    fontSize: 19,
    fontWeight: '600',
    textAlign: 'right',
  },
  selectorField: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  selectorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
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
  transferAccountTouch: {
    flex: 1,
  },
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
  bottomSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomSheetOverlay: {
    flex: 1,
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderWidth: 1,
    maxHeight: '55%',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSheetClose: {
    padding: 4,
  },
  accountGrid: {
    paddingBottom: 4,
  },
  accountGridRow: {
    gap: 12,
    marginBottom: 12,
  },
  accountTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  accountTileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  accountTileLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountTileBalance: {
    fontSize: 11,
    marginTop: 4,
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
  receiptUploadRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
    zIndex: 10,
  },
  receiptUploadMenuAnchor: {
    position: 'relative',
    alignItems: 'flex-end',
  },
  receiptUploadTrigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptUploadMenu: {
    position: 'absolute',
    top: 52,
    right: 0,
    minWidth: 190,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  receiptUploadMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  receiptUploadMenuText: {
    fontSize: 14,
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
  aiSuggestionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  aiSuggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiSuggestionConfidence: {
    fontSize: 12,
    fontWeight: '600',
  },
  aiSuggestionText: {
    fontSize: 13,
    marginBottom: 4,
  },
  aiSuggestionMeta: {
    fontSize: 12,
  },
  actionRow: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
  },
  submitButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  footerCameraAnchor: {
    position: 'relative',
    alignItems: 'flex-end',
    zIndex: 25,
  },
  footerCameraButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerUploadMenu: {
    position: 'absolute',
    right: 0,
    bottom: 54,
    minWidth: 190,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 14,
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
  compactToggleRow: {
    marginBottom: 0,
  },
  recurringInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recurringToggleLabel: {
    marginBottom: 0,
  },
  frequencySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
    alignItems: 'center',
  },
  frequencyButtonText: {
    fontSize: 11,
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





