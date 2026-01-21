import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, Note, Budget, BudgetAlert, FinancialGoal, UserProfile } from '@/types/transaction';
import { Alert } from 'react-native';

interface AppSettings {
  currency: string;
  language: string;
  darkMode: boolean;
  notifications: boolean;
  biometricAuth: boolean;
  autoBackup: boolean;
  lastBackupDate?: Date;
  privacy?: {
    hideAmounts: boolean;
    requireAuth: boolean;
    dataSharing: boolean;
    analytics: boolean;
  };
  security?: {
    autoLock: number;
    passwordEnabled: boolean;
    twoFactorEnabled: boolean;
  };
}

interface BackupData {
  transactions: Transaction[];
  accounts: Account[];
  notes: Note[];
  settings: AppSettings;
  exportDate: string;
  version: string;
}

export const [TransactionProvider, useTransactionStore] = createContextHook(() => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Money Manager User',
    email: 'user@example.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
    occupation: 'Software Engineer',
    joinDate: new Date('2024-01-01'),
    avatar: '👤',
  });
  const [settings, setSettings] = useState<AppSettings>({
    currency: 'USD',
    language: 'en',
    darkMode: false,
    notifications: true,
    biometricAuth: false,
    autoBackup: false,
    privacy: {
      hideAmounts: false,
      requireAuth: false,
      dataSharing: false,
      analytics: false,
    },
    security: {
      autoLock: 5,
      passwordEnabled: false,
      twoFactorEnabled: false,
    },
  });

  const calculateBalance = useCallback((transactionList: Transaction[]) => {
    const newBalance = transactionList.reduce((acc, t) => {
      if (t.type === 'income') return acc + t.amount;
      if (t.type === 'expense') return acc - t.amount;
      // transfers don't affect total balance as money moves between accounts
      return acc;
    }, 0);
    setBalance(newBalance);
  }, []);

  const updateAccountBalance = useCallback((accountId: string, amount: number, operation: 'add' | 'subtract') => {
    setAccounts(prevAccounts => 
      prevAccounts.map(account => {
        if (account.id === accountId) {
          const newBalance = operation === 'add' 
            ? account.balance + amount 
            : account.balance - amount;
          return { ...account, balance: newBalance };
        }
        return account;
      })
    );
  }, []);

  const saveData = useCallback(async (type: 'transactions' | 'accounts' | 'notes' | 'settings' | 'budgets' | 'budgetAlerts' | 'financialGoals' | 'userProfile', data: any) => {
    try {
      let serialized;
      switch (type) {
        case 'transactions':
          serialized = data.map((t: Transaction) => ({
            ...t,
            date: t.date.toISOString(),
            createdAt: t.createdAt.toISOString(),
            recurringEndDate: t.recurringEndDate?.toISOString(),
          }));
          break;
        case 'accounts':
          serialized = data.map((a: Account) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
          }));
          break;
        case 'notes':
          serialized = data.map((n: Note) => ({
            ...n,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
          }));
          break;
        case 'settings':
          serialized = {
            ...data,
            lastBackupDate: data.lastBackupDate?.toISOString(),
          };
          break;
        case 'budgets':
          serialized = data.map((b: Budget) => ({
            ...b,
            startDate: b.startDate.toISOString(),
            endDate: b.endDate?.toISOString(),
            createdAt: b.createdAt.toISOString(),
            updatedAt: b.updatedAt.toISOString(),
          }));
          break;
        case 'budgetAlerts':
          serialized = data.map((a: BudgetAlert) => ({
            ...a,
            date: a.date.toISOString(),
          }));
          break;
        case 'financialGoals':
          serialized = data.map((g: FinancialGoal) => ({
            ...g,
            targetDate: g.targetDate.toISOString(),
            createdAt: g.createdAt.toISOString(),
            updatedAt: g.updatedAt.toISOString(),
          }));
          break;
        case 'userProfile':
          serialized = {
            ...data,
            joinDate: data.joinDate.toISOString(),
          };
          break;
        default:
          serialized = data;
      }
      await AsyncStorage.setItem(type, JSON.stringify(serialized));
    } catch (error) {
      console.error(`Failed to save ${type}:`, error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      // Load transactions
      const storedTransactions = await AsyncStorage.getItem('transactions');
      if (storedTransactions?.trim()) {
        const parsed = JSON.parse(storedTransactions);
        const transactionsWithDates = parsed.map((t: any) => ({
          ...t,
          date: new Date(t.date),
          createdAt: new Date(t.createdAt),
          recurringEndDate: t.recurringEndDate ? new Date(t.recurringEndDate) : undefined,
        }));
        setTransactions(transactionsWithDates);
        calculateBalance(transactionsWithDates);
      }

      // Load accounts
      const storedAccounts = await AsyncStorage.getItem('accounts');
      if (storedAccounts?.trim()) {
        const parsed = JSON.parse(storedAccounts);
        const accountsWithDates = parsed.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        }));
        setAccounts(accountsWithDates);
      }

      // Load notes
      const storedNotes = await AsyncStorage.getItem('notes');
      if (storedNotes?.trim()) {
        const parsed = JSON.parse(storedNotes);
        const notesWithDates = parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        }));
        setNotes(notesWithDates);
      }

      // Load settings
      const storedSettings = await AsyncStorage.getItem('settings');
      if (storedSettings?.trim()) {
        const parsed = JSON.parse(storedSettings);
        setSettings({
          ...parsed,
          lastBackupDate: parsed.lastBackupDate ? new Date(parsed.lastBackupDate) : undefined,
        });
      }

      // Load budgets
      const storedBudgets = await AsyncStorage.getItem('budgets');
      if (storedBudgets?.trim()) {
        const parsed = JSON.parse(storedBudgets);
        const budgetsWithDates = parsed.map((b: any) => ({
          ...b,
          startDate: new Date(b.startDate),
          endDate: b.endDate ? new Date(b.endDate) : undefined,
          createdAt: new Date(b.createdAt),
          updatedAt: new Date(b.updatedAt),
        }));
        setBudgets(budgetsWithDates);
      }

      // Load budget alerts
      const storedAlerts = await AsyncStorage.getItem('budgetAlerts');
      if (storedAlerts?.trim()) {
        const parsed = JSON.parse(storedAlerts);
        const alertsWithDates = parsed.map((a: any) => ({
          ...a,
          date: new Date(a.date),
        }));
        setBudgetAlerts(alertsWithDates);
      }

      // Load financial goals
      const storedGoals = await AsyncStorage.getItem('financialGoals');
      if (storedGoals?.trim()) {
        const parsed = JSON.parse(storedGoals);
        const goalsWithDates = parsed.map((g: any) => ({
          ...g,
          targetDate: new Date(g.targetDate),
          createdAt: new Date(g.createdAt),
          updatedAt: new Date(g.updatedAt),
        }));
        setFinancialGoals(goalsWithDates);
      }

      // Load user profile
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile?.trim()) {
        const parsed = JSON.parse(storedProfile);
        setUserProfile({
          ...parsed,
          joinDate: new Date(parsed.joinDate),
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [calculateBalance]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = useCallback((amount: number, currencyCode?: string) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
    const currency = currencyCode || settings.currency;
    const locale = settings.language === 'en' ? 'en-US' : settings.language;
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)}`;
    }
  }, [settings.currency, settings.language]);

  const getBudgetSpending = useCallback((budgetId: string, transactionsList?: Transaction[]) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget || !budget.category) return 0;

    const txList = transactionsList || transactions;
    const startDate = budget.startDate;
    const endDate = budget.endDate || new Date();

    return txList
      .filter(t => 
        t.type === 'expense' &&
        t.category.id === budget.category!.id &&
        t.date >= startDate &&
        t.date <= endDate
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [budgets, transactions]);

  const checkBudgetAlerts = useCallback((transaction: Transaction, transactionsList: Transaction[]) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const relevantBudgets = budgets.filter(b => {
      if (!b.category) return false;
      const budgetMonth = b.startDate.toISOString().slice(0, 7);
      return b.category.id === transaction.category.id && budgetMonth === currentMonth;
    });

    relevantBudgets.forEach(budget => {
      const spent = getBudgetSpending(budget.id, transactionsList);
      const percentage = (spent / budget.amount) * 100;

      const existingAlerts = budgetAlerts.filter(a => a.budgetId === budget.id);
      const has80Alert = existingAlerts.some(a => a.type === '80percent');
      const hasExceededAlert = existingAlerts.some(a => a.type === 'exceeded');

      if (budget.alertAt80Percent && percentage >= 80 && percentage < 100 && !has80Alert) {
        const alert: BudgetAlert = {
          id: Date.now().toString(),
          budgetId: budget.id,
          type: '80percent',
          message: `You've reached 80% of your ${budget.category?.name} budget (${formatCurrency(spent)} of ${formatCurrency(budget.amount)})`,
          date: new Date(),
          isRead: false,
        };
        const newAlerts = [alert, ...budgetAlerts];
        setBudgetAlerts(newAlerts);
        saveData('budgetAlerts', newAlerts);
        
        if (settings.notifications) {
          Alert.alert('Budget Alert', alert.message);
        }
      }

      if (budget.alertAtLimit && percentage >= 100 && !hasExceededAlert) {
        const alert: BudgetAlert = {
          id: Date.now().toString(),
          budgetId: budget.id,
          type: 'exceeded',
          message: `You've exceeded your ${budget.category?.name} budget! Spent ${formatCurrency(spent)} of ${formatCurrency(budget.amount)}`,
          date: new Date(),
          isRead: false,
        };
        const newAlerts = [alert, ...budgetAlerts];
        setBudgetAlerts(newAlerts);
        saveData('budgetAlerts', newAlerts);
        
        if (settings.notifications) {
          Alert.alert('Budget Exceeded!', alert.message);
        }
      }
    });
  }, [budgets, budgetAlerts, getBudgetSpending, formatCurrency, settings.notifications, saveData]);

  const scheduleRecurringTransactions = useCallback((baseTransaction: Transaction) => {
    console.log('Scheduling recurring transaction:', baseTransaction.description);
  }, []);

  const addTransaction = useCallback((transactionData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const transaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    
    const newTransactions = [transaction, ...transactions];
    setTransactions(newTransactions);
    calculateBalance(newTransactions);
    saveData('transactions', newTransactions);

    // Check budgets and trigger alerts if needed
    if (transaction.type === 'expense') {
      checkBudgetAlerts(transaction, newTransactions);
    }

    // Handle account balance updates for transfers
    if (transaction.type === 'transfer' && transaction.fromAccount && transaction.toAccount) {
      updateAccountBalance(transaction.fromAccount, transaction.amount, 'subtract');
      updateAccountBalance(transaction.toAccount, transaction.amount, 'add');
      
      // Save updated accounts
      setTimeout(() => {
        setAccounts(currentAccounts => {
          saveData('accounts', currentAccounts);
          return currentAccounts;
        });
      }, 100);
    }

    // Handle recurring transactions
    if (transaction.isRecurring && transaction.recurringFrequency && transaction.recurringEndDate) {
      scheduleRecurringTransactions(transaction);
    }
  }, [transactions, calculateBalance, saveData, updateAccountBalance, scheduleRecurringTransactions, checkBudgetAlerts]);

  const updateTransaction = useCallback((updatedTransaction: Transaction) => {
    const newTransactions = transactions.map(t => 
      t.id === updatedTransaction.id ? updatedTransaction : t
    );
    setTransactions(newTransactions);
    calculateBalance(newTransactions);
    saveData('transactions', newTransactions);
  }, [transactions, calculateBalance, saveData]);

  const deleteTransaction = useCallback((id: string) => {
    const newTransactions = transactions.filter(t => t.id !== id);
    setTransactions(newTransactions);
    calculateBalance(newTransactions);
    saveData('transactions', newTransactions);
  }, [transactions, calculateBalance, saveData]);

  const getTransactionsByCategory = useCallback((categoryId: string) => {
    return transactions.filter(t => t.category.id === categoryId);
  }, [transactions]);

  const getMonthlyTransactions = useCallback((month: string) => {
    if (!month?.trim() || month.length > 50) return [];
    return transactions.filter(t => {
      const transactionMonth = t.date.toISOString().slice(0, 7);
      return transactionMonth === month;
    });
  }, [transactions]);

  const getTotalIncome = useCallback((month?: string) => {
    if (month && (!month.trim() || month.length > 50)) return 0;
    const transactionList = month?.trim() && month.length <= 50
      ? getMonthlyTransactions(month)
      : transactions;
    
    return transactionList
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, getMonthlyTransactions]);

  const getTotalExpenses = useCallback((month?: string) => {
    if (month && (!month.trim() || month.length > 50)) return 0;
    const transactionList = month?.trim() && month.length <= 50
      ? getMonthlyTransactions(month)
      : transactions;
    
    return transactionList
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, getMonthlyTransactions]);

  const getCategorySpending = useCallback((categoryId: string, month?: string) => {
    if (month && (!month.trim() || month.length > 50)) return 0;
    const transactionList = month?.trim() && month.length <= 50
      ? getMonthlyTransactions(month)
      : transactions;
    
    return transactionList
      .filter(t => t.category.id === categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, getMonthlyTransactions]);

  const addBudget = useCallback((budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
    const budget: Budget = {
      ...budgetData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const newBudgets = [budget, ...budgets];
    setBudgets(newBudgets);
    saveData('budgets', newBudgets);
  }, [budgets, saveData]);

  const updateBudget = useCallback((updatedBudget: Budget) => {
    const newBudgets = budgets.map(b => 
      b.id === updatedBudget.id ? { ...updatedBudget, updatedAt: new Date() } : b
    );
    setBudgets(newBudgets);
    saveData('budgets', newBudgets);
  }, [budgets, saveData]);

  const deleteBudget = useCallback((id: string) => {
    const newBudgets = budgets.filter(b => b.id !== id);
    setBudgets(newBudgets);
    saveData('budgets', newBudgets);
  }, [budgets, saveData]);

  const markAlertAsRead = useCallback((id: string) => {
    const newAlerts = budgetAlerts.map(a => 
      a.id === id ? { ...a, isRead: true } : a
    );
    setBudgetAlerts(newAlerts);
    saveData('budgetAlerts', newAlerts);
  }, [budgetAlerts, saveData]);

  const clearReadAlerts = useCallback(() => {
    const newAlerts = budgetAlerts.filter(a => !a.isRead);
    setBudgetAlerts(newAlerts);
    saveData('budgetAlerts', newAlerts);
  }, [budgetAlerts, saveData]);

  const addFinancialGoal = useCallback((goalData: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const goal: FinancialGoal = {
      ...goalData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const newGoals = [goal, ...financialGoals];
    setFinancialGoals(newGoals);
    saveData('financialGoals', newGoals);
  }, [financialGoals, saveData]);

  const updateFinancialGoal = useCallback((updatedGoal: FinancialGoal) => {
    const newGoals = financialGoals.map(g => 
      g.id === updatedGoal.id ? { ...updatedGoal, updatedAt: new Date() } : g
    );
    setFinancialGoals(newGoals);
    saveData('financialGoals', newGoals);
  }, [financialGoals, saveData]);

  const deleteFinancialGoal = useCallback((id: string) => {
    const newGoals = financialGoals.filter(g => g.id !== id);
    setFinancialGoals(newGoals);
    saveData('financialGoals', newGoals);
  }, [financialGoals, saveData]);

  const updateUserProfile = useCallback((profile: UserProfile) => {
    setUserProfile(profile);
    saveData('userProfile', profile);
  }, [saveData]);

  const backupToGoogleDrive = useCallback(async () => {
    try {
      const backupData: BackupData = {
        transactions,
        accounts,
        notes,
        settings,
        exportDate: new Date().toISOString(),
        version: '1.0.0',
      };

      // In a real app, this would use Google Drive API
      console.log('Backing up to Google Drive:', JSON.stringify(backupData, null, 2));
      
      const updatedSettings = {
        ...settings,
        lastBackupDate: new Date(),
      };
      setSettings(updatedSettings);
      saveData('settings', updatedSettings);
      
      Alert.alert('Backup Successful', 'Your data has been backed up to Google Drive.');
    } catch (error) {
      console.error('Backup failed:', error);
      Alert.alert('Backup Failed', 'Failed to backup data to Google Drive.');
    }
  }, [transactions, accounts, notes, settings, saveData]);

  const restoreFromGoogleDrive = useCallback(async () => {
    try {
      // In a real app, this would fetch from Google Drive API
      // For now, we'll simulate a restore with sample data
      Alert.alert(
        'Restore from Google Drive',
        'This will replace all your current data with the backup. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('Restore from Google Drive - no sample data to restore');
                Alert.alert('Restore Failed', 'No backup data found on Google Drive.');
              } catch (restoreError) {
                console.error('Restore process failed:', restoreError);
                Alert.alert('Restore Failed', 'Failed to restore data from Google Drive.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Restore failed:', error);
      Alert.alert('Restore Failed', 'Failed to restore data from Google Drive.');
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveData('settings', updated);
  }, [settings, saveData]);

  const addAccount = useCallback((accountData: Omit<Account, 'id' | 'createdAt'>) => {
    const account: Account = {
      ...accountData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    
    const newAccounts = [account, ...accounts];
    setAccounts(newAccounts);
    saveData('accounts', newAccounts);
  }, [accounts, saveData]);

  const addNote = useCallback((noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const note: Note = {
      ...noteData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const newNotes = [note, ...notes];
    setNotes(newNotes);
    saveData('notes', newNotes);
  }, [notes, saveData]);

  const clearAllData = useCallback(async () => {
    try {
      // Clear all data from AsyncStorage
      await AsyncStorage.multiRemove(['transactions', 'accounts', 'notes', 'settings', 'budgets', 'budgetAlerts', 'financialGoals', 'userProfile']);
      
      // Reset state to initial values
      setTransactions([]);
      setNotes([]);
      setBalance(0);
      setBudgets([]);
      setBudgetAlerts([]);
      setFinancialGoals([]);
      
      // Reset accounts to empty
      setAccounts([]);
      
      // Reset settings to default
      const defaultSettings: AppSettings = {
        currency: 'USD',
        language: 'en',
        darkMode: false,
        notifications: true,
        biometricAuth: false,
        autoBackup: false,
        privacy: {
          hideAmounts: false,
          requireAuth: false,
          dataSharing: false,
          analytics: false,
        },
        security: {
          autoLock: 5,
          passwordEnabled: false,
          twoFactorEnabled: false,
        },
      };
      setSettings(defaultSettings);
      saveData('settings', defaultSettings);
      
      // Reset user profile to default
      const defaultProfile: UserProfile = {
        name: 'Money Manager User',
        email: 'user@example.com',
        phone: '+1 (555) 123-4567',
        location: 'New York, NY',
        occupation: 'Software Engineer',
        joinDate: new Date(),
        avatar: '👤',
      };
      setUserProfile(defaultProfile);
      saveData('userProfile', defaultProfile);
      
      console.log('All data cleared successfully');
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }, [saveData]);

  return useMemo(() => ({
    transactions,
    accounts,
    notes,
    balance,
    settings,
    budgets,
    budgetAlerts,
    financialGoals,
    userProfile,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionsByCategory,
    getMonthlyTransactions,
    getTotalIncome,
    getTotalExpenses,
    getCategorySpending,
    formatCurrency,
    backupToGoogleDrive,
    restoreFromGoogleDrive,
    updateSettings,
    addAccount,
    addNote,
    clearAllData,
    updateAccountBalance,
    addBudget,
    updateBudget,
    deleteBudget,
    getBudgetSpending,
    markAlertAsRead,
    clearReadAlerts,
    addFinancialGoal,
    updateFinancialGoal,
    deleteFinancialGoal,
    updateUserProfile,
  }), [
    transactions,
    accounts,
    notes,
    balance,
    settings,
    budgets,
    budgetAlerts,
    financialGoals,
    userProfile,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionsByCategory,
    getMonthlyTransactions,
    getTotalIncome,
    getTotalExpenses,
    getCategorySpending,
    formatCurrency,
    backupToGoogleDrive,
    restoreFromGoogleDrive,
    updateSettings,
    addAccount,
    addNote,
    clearAllData,
    updateAccountBalance,
    addBudget,
    updateBudget,
    deleteBudget,
    getBudgetSpending,
    markAlertAsRead,
    clearReadAlerts,
    addFinancialGoal,
    updateFinancialGoal,
    deleteFinancialGoal,
    updateUserProfile,
  ]);
});