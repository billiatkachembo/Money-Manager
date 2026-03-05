/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { TransactionCategory } from '@/types/transaction';
import { MODAL_EXPENSE_CATEGORIES, MODAL_INCOME_CATEGORIES } from '@/constants/modal-categories';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

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
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [fromAccountSearch, setFromAccountSearch] = useState('');
  const [toAccountSearch, setToAccountSearch] = useState('');
  const [showFromAccountDropdown, setShowFromAccountDropdown] = useState(false);
  const [showToAccountDropdown, setShowToAccountDropdown] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrExtracted, setOcrExtracted] = useState(false);
  const [showImageActions, setShowImageActions] = useState(false);
  
  const { addTransaction, accounts, formatCurrency, addAccount } = useTransactionStore();

  // Add default accounts on first load
  useEffect(() => {
    const addDefaultAccounts = async () => {
      if (accounts.length === 0) {
        const defaultAccounts = [
          {
            id: '1',
            name: 'Primary Checking',
            type: 'checking' as const,
            balance: 5000,
            currency: 'USD',
            color: '#667eea',
            icon: '💳',
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: '2',
            name: 'Savings Account',
            type: 'savings' as const,
            balance: 15000,
            currency: 'USD',
            color: '#4CAF50',
            icon: '💰',
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: '3',
            name: 'Credit Card',
            type: 'credit' as const,
            balance: -1200,
            currency: 'USD',
            color: '#F44336',
            icon: '💳',
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: '4',
            name: 'Investment Account',
            type: 'investment' as const,
            balance: 25000,
            currency: 'USD',
            color: '#FF9800',
            icon: '📈',
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: '5',
            name: 'Cash Wallet',
            type: 'cash' as const,
            balance: 500,
            currency: 'USD',
            color: '#9C27B0',
            icon: '💵',
            isActive: true,
            createdAt: new Date(),
          },
        ];

        for (const account of defaultAccounts) {
          await addAccount(account);
        }
      }
    };

    addDefaultAccounts();
  }, []);

  const categories = type === 'transfer' ? [] : (type === 'income' ? MODAL_INCOME_CATEGORIES : MODAL_EXPENSE_CATEGORIES);

  // Filter categories based on search
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Function to simulate OCR scanning (in production, use a real OCR API)
  const simulateOcrScanning = async (imageUri: string) => {
    setIsScanning(true);
    setOcrExtracted(false);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock extracted data from receipt
    const mockExtractedData = {
      amount: Math.floor(Math.random() * 100) + 10 + (Math.random() > 0.5 ? 0.99 : 0.00),
      description: type === 'expense' ? 
        ['Grocery Store', 'Coffee Shop', 'Restaurant', 'Gas Station', 'Pharmacy'][Math.floor(Math.random() * 5)] :
        ['Salary Deposit', 'Freelance Payment', 'Investment Return', 'Gift Received'][Math.floor(Math.random() * 4)],
      category: type === 'expense' ? 
        ['groceries', 'coffee', 'dining', 'gas', 'shopping'][Math.floor(Math.random() * 5)] :
        ['salary', 'freelance', 'investment', 'gift'][Math.floor(Math.random() * 4)],
      date: new Date().toISOString().split('T')[0],
    };
    
    // Update form with extracted data
    setAmount(mockExtractedData.amount.toString());
    setDescription(mockExtractedData.description);
    
    const foundCategory = categories.find(cat => cat.id === mockExtractedData.category);
    if (foundCategory) {
      setSelectedCategory(foundCategory);
    }
    
    setIsScanning(false);
    setOcrExtracted(true);
    
    // Show success message
    Alert.alert(
      'OCR Scan Complete',
      'Transaction details extracted from receipt!',
      [{ text: 'OK' }]
    );
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
        // Compress image
        const compressedImage = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: SaveFormat.JPEG }
        );
        
        setReceiptImage(compressedImage.uri);
        setShowImageActions(true);
        
        // Auto-start OCR scanning
        simulateOcrScanning(compressedImage.uri);
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
        simulateOcrScanning(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Function to scan existing receipt image
  const scanReceipt = () => {
    if (receiptImage) {
      simulateOcrScanning(receiptImage);
    }
  };

  // Function to remove receipt image
  const removeReceiptImage = () => {
    setReceiptImage(null);
    setShowImageActions(false);
    setOcrExtracted(false);
  };

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

    if (type === 'transfer' && fromAccount === toAccount) {
      Alert.alert('Error', 'Cannot transfer to the same account');
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

    // Add receipt image if exists
    if (receiptImage) {
      transactionData.receiptImage = receiptImage;
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
    setShowCategoryDropdown(false);
    setCategorySearch('');
    setFromAccountSearch('');
    setToAccountSearch('');
    setShowFromAccountDropdown(false);
    setShowToAccountDropdown(false);
    setReceiptImage(null);
    setIsScanning(false);
    setOcrExtracted(false);
    setShowImageActions(false);
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
          <TouchableOpacity onPress={() => setShowCategoryDropdown(false)}>
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
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
                  setSelectedCategory(category);
                  setShowCategoryDropdown(false);
                  setCategorySearch('');
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
    if (type !== 'transfer') return null;

    const selectedFrom = accounts.find((account) => account.id === fromAccount);
    const selectedTo = accounts.find((account) => account.id === toAccount);
    const normalizedFromSearch = fromAccountSearch.trim().toLowerCase();
    const normalizedToSearch = toAccountSearch.trim().toLowerCase();

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

    const renderAccountOption = (
      account: typeof accounts[0],
      selectedId: string,
      onSelect: (accountId: string, accountName: string) => void
    ) => {
      const isSelected = selectedId === account.id;

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
              <Text style={{ fontSize: 16 }}>{account.icon || '💰'}</Text>
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

    return (
      <>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>From Account</Text>
          <View
            style={[
              styles.transferInputContainer,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Search size={16} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.transferAccountInput, { color: theme.colors.text }]}
              value={fromAccountSearch}
              onChangeText={(text) => {
                setFromAccountSearch(text);
                setShowFromAccountDropdown(true);
                if (selectedFrom && text.trim().toLowerCase() !== selectedFrom.name.toLowerCase()) {
                  setFromAccount('');
                }
              }}
              onFocus={() => {
                setShowFromAccountDropdown(true);
                setShowToAccountDropdown(false);
              }}
              placeholder="Type to find source account"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TouchableOpacity
              onPress={() => {
                if (fromAccountSearch) {
                  setFromAccountSearch('');
                  setFromAccount('');
                  setShowFromAccountDropdown(true);
                } else {
                  setShowFromAccountDropdown(!showFromAccountDropdown);
                  setShowToAccountDropdown(false);
                }
              }}
              style={styles.transferInputAction}
            >
              {fromAccountSearch ? (
                <X size={16} color={theme.colors.textSecondary} />
              ) : showFromAccountDropdown ? (
                <ChevronUp size={16} color={theme.colors.textSecondary} />
              ) : (
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          {showFromAccountDropdown && (
            <View style={[styles.transferDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              {accounts.length === 0 ? (
                <View style={styles.transferEmptyState}>
                  <Text style={[styles.emptyAccountsText, { color: theme.colors.textSecondary }]}>Loading accounts...</Text>
                </View>
              ) : fromOptions.length === 0 ? (
                <View style={styles.transferEmptyState}>
                  <Text style={[styles.emptyAccountsText, { color: theme.colors.textSecondary }]}>No matching source account</Text>
                </View>
              ) : (
                <ScrollView style={styles.transferDropdownList} nestedScrollEnabled>
                  {fromOptions.map((account: typeof accounts[0]) =>
                    renderAccountOption(account, fromAccount, (accountId, accountName) => {
                      setFromAccount(accountId);
                      setFromAccountSearch(accountName);
                      setShowFromAccountDropdown(false);
                    })
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>To Account</Text>
          <View
            style={[
              styles.transferInputContainer,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Search size={16} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.transferAccountInput, { color: theme.colors.text }]}
              value={toAccountSearch}
              onChangeText={(text) => {
                setToAccountSearch(text);
                setShowToAccountDropdown(true);
                if (selectedTo && text.trim().toLowerCase() !== selectedTo.name.toLowerCase()) {
                  setToAccount('');
                }
              }}
              onFocus={() => {
                setShowToAccountDropdown(true);
                setShowFromAccountDropdown(false);
              }}
              placeholder="Type to find destination account"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TouchableOpacity
              onPress={() => {
                if (toAccountSearch) {
                  setToAccountSearch('');
                  setToAccount('');
                  setShowToAccountDropdown(true);
                } else {
                  setShowToAccountDropdown(!showToAccountDropdown);
                  setShowFromAccountDropdown(false);
                }
              }}
              style={styles.transferInputAction}
            >
              {toAccountSearch ? (
                <X size={16} color={theme.colors.textSecondary} />
              ) : showToAccountDropdown ? (
                <ChevronUp size={16} color={theme.colors.textSecondary} />
              ) : (
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          {showToAccountDropdown && (
            <View style={[styles.transferDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              {accounts.length === 0 ? (
                <View style={styles.transferEmptyState}>
                  <Text style={[styles.emptyAccountsText, { color: theme.colors.textSecondary }]}>Loading accounts...</Text>
                </View>
              ) : toOptions.length === 0 ? (
                <View style={styles.transferEmptyState}>
                  <Text style={[styles.emptyAccountsText, { color: theme.colors.textSecondary }]}>No matching destination account</Text>
                </View>
              ) : (
                <ScrollView style={styles.transferDropdownList} nestedScrollEnabled>
                  {toOptions.map((account: typeof accounts[0]) =>
                    renderAccountOption(account, toAccount, (accountId, accountName) => {
                      setToAccount(accountId);
                      setToAccountSearch(accountName);
                      setShowToAccountDropdown(false);
                    })
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {fromAccount && toAccount && fromAccount !== toAccount && (
          <View style={[styles.transferPreview, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.transferPreviewTitle, { color: theme.colors.text }]}>Transfer Preview</Text>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>
                Amount:
              </Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>
                {formatCurrency(parseFloat(amount) || 0)}
              </Text>
            </View>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>
                From:
              </Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>
                {selectedFrom?.name || 'Unknown'}
              </Text>
            </View>
            <View style={styles.transferPreviewRow}>
              <Text style={[styles.transferPreviewLabel, { color: theme.colors.textSecondary }]}>
                To:
              </Text>
              <Text style={[styles.transferPreviewValue, { color: theme.colors.text }]}>
                {selectedTo?.name || 'Unknown'}
              </Text>
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
              onPress={() => {
                setType('expense');
                setSelectedCategory(null);
                setShowCategoryDropdown(false);
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
                setShowCategoryDropdown(false);
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
                setShowCategoryDropdown(false);
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

          {type !== 'transfer' ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
              <TouchableOpacity
                style={[styles.categoryDropdownTrigger, { 
                  backgroundColor: theme.colors.surface, 
                  borderColor: theme.colors.border 
                }]}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                {selectedCategory ? (
                  <View style={styles.selectedCategory}>
                    <View style={[
                      styles.selectedCategoryIcon, 
                      { backgroundColor: selectedCategory.color + '20' }
                    ]}>
                      {(Icons as any)[selectedCategory.icon] ? 
                        React.createElement((Icons as any)[selectedCategory.icon], {
                          size: 16,
                          color: selectedCategory.color
                        }) : 
                        <Icons.Circle size={16} color={selectedCategory.color} />
                      }
                    </View>
                    <Text style={[styles.selectedCategoryText, { color: theme.colors.text }]}>
                      {selectedCategory.name}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                    Select a category
                  </Text>
                )}
                {showCategoryDropdown ? (
                  <ChevronUp size={20} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={20} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
              
              {renderCategoryDropdown()}
            </View>
          ) : (
            renderAccountSelection()
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


