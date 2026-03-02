
import createContextHook from '@nkzw/create-context-hook';
import { Alert } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Account,
  Budget,
  BudgetAlert,
  FinancialGoal,
  FinancialHealthMetrics,
  Insight,
  Note,
  RecurringRule,
  SeasonalFarmSummary,
  Transaction,
  TransactionCategory,
  UserProfile,
} from '@/types/transaction';
import {
  AppSettings,
  PersistedState,
  clearPersistedState,
  loadPersistedState,
  savePersistedPatch,
} from '@/src/storage/app-storage';
import {
  createTransferLegs,
  deleteTransferPair,
  getFromAccountId,
  getToAccountId,
  isVisibleTransaction,
  recomputeAllBalances,
  validateLedgerIntegrity,
} from '@/src/domain/ledger';
import {
  createRecurringRuleFromTransaction,
  materializeRecurringTransactions,
} from '@/src/domain/recurring';
import {
  computeFinancialHealthMetrics,
  computeFinancialHealthScore,
} from '@/src/domain/financial-health';
import { computeInsights } from '@/src/domain/insights';
import { computeBehaviorMetrics } from '@/src/domain/analytics';
import {
  getFarmCostBreakdown,
  getSeasonalFarmSummary,
} from '@/src/domain/farming';

interface BackupData {
  transactions: Transaction[];
  accounts: Account[];
  notes: Note[];
  settings: AppSettings;
  recurringRules: RecurringRule[];
  exportDate: string;
  version: string;
}

interface HomeSnapshot {
  netBalance: number;
  monthlyCashFlow: number;
  budgetRisk: number;
  financialHealthScore: number;
  insightOfWeek: Insight | null;
  recentTransactions: Transaction[];
}

const TRANSFER_CATEGORY: TransactionCategory = {
  id: 'transfer',
  name: 'Transfer',
  icon: 'ArrowLeftRight',
  color: '#667eea',
};

const OPENING_BALANCE_CATEGORY: TransactionCategory = {
  id: 'opening-balance',
  name: 'Opening Balance',
  icon: 'Landmark',
  color: '#9CA3AF',
};

const DEFAULT_SETTINGS: AppSettings = {
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

const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Money Manager User',
  email: 'user@example.com',
  phone: '+1 (555) 123-4567',
  location: 'New York, NY',
  occupation: 'Farmer',
  joinDate: new Date('2024-01-01T00:00:00.000Z'),
  avatar: 'U',
};

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function parseDate(value: Date | string | undefined): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function sortByDateDesc(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => right.date.getTime() - left.date.getTime());
}

function normalizeTransaction(transaction: Transaction): Transaction {
  const fromAccountId = transaction.fromAccountId ?? transaction.fromAccount;
  const toAccountId = transaction.toAccountId ?? transaction.toAccount;

  return {
    ...transaction,
    date: parseDate(transaction.date),
    createdAt: parseDate(transaction.createdAt),
    updatedAt: transaction.updatedAt ? parseDate(transaction.updatedAt) : undefined,
    recurringEndDate: transaction.recurringEndDate ? parseDate(transaction.recurringEndDate) : undefined,
    fromAccount: fromAccountId,
    toAccount: toAccountId,
    fromAccountId,
    toAccountId,
  };
}

function computeNetBalance(transactions: Transaction[]): number {
  return Math.round(
    transactions.reduce((sum, transaction) => {
      if (transaction.type === 'income') {
        return sum + transaction.amount;
      }

      if (transaction.type === 'expense') {
        return sum - transaction.amount;
      }

      return sum;
    }, 0) * 100
  ) / 100;
}

function normalizeRule(rule: RecurringRule): RecurringRule {
  return {
    ...rule,
    template: {
      ...rule.template,
      createdAt: parseDate(rule.template.createdAt),
      updatedAt: rule.template.updatedAt ? parseDate(rule.template.updatedAt) : undefined,
      recurringEndDate: rule.template.recurringEndDate
        ? parseDate(rule.template.recurringEndDate)
        : undefined,
      fromAccountId: rule.template.fromAccountId ?? rule.template.fromAccount,
      toAccountId: rule.template.toAccountId ?? rule.template.toAccount,
    },
  };
}

function buildDefaults(): PersistedState {
  return {
    transactions: [],
    accounts: [],
    notes: [],
    settings: DEFAULT_SETTINGS,
    budgets: [],
    budgetAlerts: [],
    financialGoals: [],
    userProfile: DEFAULT_USER_PROFILE,
    recurringRules: [],
  };
}

export const [TransactionProvider, useTransactionStore] = createContextHook(() => {
  const [ledgerTransactions, setLedgerTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [ledgerIssues, setLedgerIssues] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const visibleTransactions = useMemo(
    () => sortByDateDesc(ledgerTransactions.filter(isVisibleTransaction)),
    [ledgerTransactions]
  );

  const persistPatch = useCallback(async (patch: Partial<PersistedState>) => {
    try {
      await savePersistedPatch(patch);
    } catch (error) {
      console.error('Failed to persist patch:', error);
    }
  }, []);

  const applyLedgerState = useCallback(
    (
      nextTransactions: Transaction[],
      nextAccounts: Account[],
      nextRecurringRules: RecurringRule[],
      extraPatch: Partial<PersistedState> = {}
    ) => {
      const normalized = sortByDateDesc(nextTransactions.map(normalizeTransaction));
      const recomputedAccounts = recomputeAllBalances(nextAccounts, normalized);
      const integrity = validateLedgerIntegrity(normalized);

      setLedgerTransactions(normalized);
      setAccounts(recomputedAccounts);
      setBalance(computeNetBalance(normalized));
      setRecurringRules(nextRecurringRules);
      setLedgerIssues(integrity.issues);

      void persistPatch({
        transactions: normalized,
        accounts: recomputedAccounts,
        recurringRules: nextRecurringRules,
        ...extraPatch,
      });
    },
    [persistPatch]
  );

  const getBudgetSpendingInternal = useCallback(
    (budgetId: string, transactions: Transaction[]): number => {
      const budget = budgets.find((entry) => entry.id === budgetId);
      if (!budget || !budget.category) {
        return 0;
      }

      const startDate = budget.startDate;
      const endDate = budget.endDate ?? new Date();

      return transactions
        .filter(
          (transaction) =>
            transaction.type === 'expense' &&
            transaction.category.id === budget.category?.id &&
            transaction.date >= startDate &&
            transaction.date <= endDate
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    },
    [budgets]
  );

  const formatCurrency = useCallback(
    (amount: number, currencyCode?: string): string => {
      if (!Number.isFinite(amount)) {
        return '$0.00';
      }

      const currency = currencyCode ?? settings.currency;
      const locale = settings.language === 'en' ? 'en-US' : settings.language;

      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return amount.toFixed(2);
      }
    },
    [settings.currency, settings.language]
  );

  const pushBudgetAlerts = useCallback(
    (transaction: Transaction, transactionsAfterMutation: Transaction[]) => {
      if (transaction.type !== 'expense') {
        return;
      }

      const month = monthKey(transaction.date);
      const relevant = budgets.filter(
        (budget) => budget.category?.id === transaction.category.id && monthKey(budget.startDate) === month
      );

      if (relevant.length === 0) {
        return;
      }

      const nextAlerts = [...budgetAlerts];

      for (const budget of relevant) {
        const spent = getBudgetSpendingInternal(budget.id, transactionsAfterMutation);
        const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        const already80 = nextAlerts.some((alert) => alert.budgetId === budget.id && alert.type === '80percent');
        const alreadyExceeded = nextAlerts.some(
          (alert) => alert.budgetId === budget.id && alert.type === 'exceeded'
        );

        if (budget.alertAt80Percent && percent >= 80 && percent < 100 && !already80) {
          nextAlerts.unshift({
            id: generateId(),
            budgetId: budget.id,
            type: '80percent',
            message: `You reached 80% of ${budget.category?.name} budget (${formatCurrency(spent)}).`,
            date: new Date(),
            isRead: false,
          });
        }

        if (budget.alertAtLimit && percent >= 100 && !alreadyExceeded) {
          nextAlerts.unshift({
            id: generateId(),
            budgetId: budget.id,
            type: 'exceeded',
            message: `You exceeded ${budget.category?.name} budget (${formatCurrency(spent)}).`,
            date: new Date(),
            isRead: false,
          });
        }
      }

      if (nextAlerts.length !== budgetAlerts.length) {
        setBudgetAlerts(nextAlerts);
        void persistPatch({ budgetAlerts: nextAlerts });

        if (settings.notifications) {
          Alert.alert('Budget Alert', nextAlerts[0].message);
        }
      }
    },
    [budgetAlerts, budgets, formatCurrency, getBudgetSpendingInternal, persistPatch, settings.notifications]
  );

  const materializeRecurringNow = useCallback(
    (now: Date = new Date()): number => {
      const normalizedRules = recurringRules.map(normalizeRule);
      const { newTransactions, updatedRules } = materializeRecurringTransactions(
        now,
        normalizedRules,
        ledgerTransactions
      );

      if (newTransactions.length === 0) {
        const hasRuleChange =
          JSON.stringify(updatedRules.map((rule) => rule.lastMaterializedAt)) !==
          JSON.stringify(recurringRules.map((rule) => rule.lastMaterializedAt));

        if (hasRuleChange) {
          setRecurringRules(updatedRules);
          void persistPatch({ recurringRules: updatedRules });
        }

        return 0;
      }

      const expanded: Transaction[] = [];

      for (const transaction of newTransactions) {
        const fromAccountId = transaction.fromAccountId ?? transaction.fromAccount;
        const toAccountId = transaction.toAccountId ?? transaction.toAccount;

        if (transaction.type === 'transfer' && fromAccountId && toAccountId) {
          const pair = createTransferLegs({
            amount: transaction.amount,
            date: parseDate(transaction.date),
            description: transaction.description,
            category: transaction.category ?? TRANSFER_CATEGORY,
            fromAccountId,
            toAccountId,
            createdAt: parseDate(transaction.createdAt),
            updatedAt: parseDate(transaction.updatedAt ?? transaction.createdAt),
            recurringId: transaction.recurringId,
            recurringFrequency: transaction.recurringFrequency,
            recurringEndDate: transaction.recurringEndDate,
            isRecurring: transaction.isRecurring,
            parentTransactionId: transaction.parentTransactionId,
            materializedForDate: transaction.materializedForDate,
            tags: transaction.tags,
          });

          expanded.push(pair.debit, pair.credit);
          continue;
        }

        expanded.push(
          normalizeTransaction({
            ...transaction,
            id: transaction.id ?? generateId(),
            createdAt: parseDate(transaction.createdAt),
            updatedAt: parseDate(transaction.updatedAt ?? transaction.createdAt),
            fromAccount: fromAccountId,
            toAccount: toAccountId,
            fromAccountId,
            toAccountId,
          })
        );
      }

      applyLedgerState([...expanded, ...ledgerTransactions], accounts, updatedRules);
      return expanded.length;
    },
    [accounts, applyLedgerState, ledgerTransactions, persistPatch, recurringRules]
  );

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        const defaults = buildDefaults();
        const loaded = await loadPersistedState(defaults);

        if (isCancelled) {
          return;
        }

        const normalizedTransactions = sortByDateDesc(loaded.transactions.map(normalizeTransaction));
        const normalizedRules = loaded.recurringRules.map(normalizeRule);

        const { newTransactions, updatedRules } = materializeRecurringTransactions(
          new Date(),
          normalizedRules,
          normalizedTransactions
        );

        const materialized: Transaction[] = [];
        for (const transaction of newTransactions) {
          const fromAccountId = transaction.fromAccountId ?? transaction.fromAccount;
          const toAccountId = transaction.toAccountId ?? transaction.toAccount;

          if (transaction.type === 'transfer' && fromAccountId && toAccountId) {
            const pair = createTransferLegs({
              amount: transaction.amount,
              date: parseDate(transaction.date),
              description: transaction.description,
              category: transaction.category ?? TRANSFER_CATEGORY,
              fromAccountId,
              toAccountId,
              createdAt: parseDate(transaction.createdAt),
              updatedAt: parseDate(transaction.updatedAt ?? transaction.createdAt),
              recurringId: transaction.recurringId,
              recurringFrequency: transaction.recurringFrequency,
              recurringEndDate: transaction.recurringEndDate,
              isRecurring: transaction.isRecurring,
              parentTransactionId: transaction.parentTransactionId,
              materializedForDate: transaction.materializedForDate,
              tags: transaction.tags,
            });

            materialized.push(pair.debit, pair.credit);
            continue;
          }

          materialized.push(normalizeTransaction(transaction));
        }

        const mergedTransactions = sortByDateDesc([...materialized, ...normalizedTransactions]);
        const recomputedAccounts = recomputeAllBalances(loaded.accounts, mergedTransactions);
        const integrity = validateLedgerIntegrity(mergedTransactions);

        setLedgerTransactions(mergedTransactions);
        setAccounts(recomputedAccounts);
        setNotes(loaded.notes);
        setBalance(computeNetBalance(mergedTransactions));
        setBudgets(loaded.budgets);
        setBudgetAlerts(loaded.budgetAlerts);
        setFinancialGoals(loaded.financialGoals);
        setUserProfile(loaded.userProfile);
        setSettings({ ...DEFAULT_SETTINGS, ...loaded.settings });
        setRecurringRules(updatedRules);
        setLedgerIssues(integrity.issues);
        setIsHydrated(true);

        const rulesChanged =
          JSON.stringify(updatedRules.map((rule) => rule.lastMaterializedAt)) !==
          JSON.stringify(normalizedRules.map((rule) => rule.lastMaterializedAt));

        if (materialized.length > 0 || rulesChanged) {
          await savePersistedPatch({
            transactions: mergedTransactions,
            accounts: recomputedAccounts,
            recurringRules: updatedRules,
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        if (!isCancelled) {
          setIsHydrated(true);
        }
      }
    };

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  const addTransaction = useCallback(
    (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => {
      const now = new Date();
      const fromAccountId = transactionData.fromAccountId ?? transactionData.fromAccount;
      const toAccountId = transactionData.toAccountId ?? transactionData.toAccount;
      const date = parseDate(transactionData.date);

      let nextTransactions = [...ledgerTransactions];
      let primary: Transaction | null = null;

      if (transactionData.type === 'transfer') {
        if (!fromAccountId || !toAccountId) {
          Alert.alert('Invalid transfer', 'Please select both source and destination accounts.');
          return;
        }

        if (fromAccountId === toAccountId) {
          Alert.alert('Invalid transfer', 'Source and destination accounts must be different.');
          return;
        }

        const pair = createTransferLegs({
          amount: transactionData.amount,
          date,
          description: transactionData.description,
          category: transactionData.category ?? TRANSFER_CATEGORY,
          fromAccountId,
          toAccountId,
          createdAt: now,
          updatedAt: now,
          recurringFrequency: transactionData.recurringFrequency,
          recurringEndDate: transactionData.recurringEndDate,
          isRecurring: transactionData.isRecurring,
          parentTransactionId: transactionData.parentTransactionId,
          tags: transactionData.tags,
        });

        nextTransactions = [pair.debit, pair.credit, ...nextTransactions];
        primary = pair.debit;
      } else {
        const transaction: Transaction = normalizeTransaction({
          ...transactionData,
          id: generateId(),
          date,
          createdAt: now,
          updatedAt: now,
          fromAccount: fromAccountId,
          toAccount: toAccountId,
          fromAccountId,
          toAccountId,
        });

        nextTransactions = [transaction, ...nextTransactions];
        primary = transaction;
      }

      let nextRules = recurringRules;
      if (primary?.isRecurring && primary.recurringFrequency) {
        const rule = createRecurringRuleFromTransaction(primary, generateId);
        if (rule) {
          nextRules = [rule, ...nextRules];
        }
      }

      applyLedgerState(nextTransactions, accounts, nextRules);

      if (primary) {
        pushBudgetAlerts(primary, nextTransactions);
      }
    },
    [accounts, applyLedgerState, ledgerTransactions, pushBudgetAlerts, recurringRules]
  );

  const updateTransaction = useCallback(
    (updatedTransaction: Transaction) => {
      const current = ledgerTransactions.find((entry) => entry.id === updatedTransaction.id);
      if (!current) {
        return;
      }

      const normalizedUpdated = normalizeTransaction({
        ...current,
        ...updatedTransaction,
        date: parseDate(updatedTransaction.date),
        updatedAt: new Date(),
      });

      let nextTransactions: Transaction[];

      if (current.type === 'transfer' || normalizedUpdated.type === 'transfer') {
        const groupId = current.transferGroupId ?? normalizedUpdated.transferGroupId;
        const pair = groupId
          ? ledgerTransactions.filter((entry) => entry.transferGroupId === groupId)
          : [current];

        const existingDebit = pair.find((entry) => entry.transferLeg === 'debit');
        const existingCredit = pair.find((entry) => entry.transferLeg === 'credit');

        const fromAccountId =
          normalizedUpdated.fromAccountId ??
          normalizedUpdated.fromAccount ??
          getFromAccountId(existingDebit ?? current) ??
          getFromAccountId(existingCredit ?? current);

        const toAccountId =
          normalizedUpdated.toAccountId ??
          normalizedUpdated.toAccount ??
          getToAccountId(existingDebit ?? current) ??
          getToAccountId(existingCredit ?? current);

        if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
          Alert.alert('Invalid transfer', 'Transfer update requires valid source and destination accounts.');
          return;
        }

        const transferPair = createTransferLegs({
          amount: normalizedUpdated.amount,
          date: normalizedUpdated.date,
          description: normalizedUpdated.description,
          category: normalizedUpdated.category ?? TRANSFER_CATEGORY,
          fromAccountId,
          toAccountId,
          createdAt: current.createdAt,
          updatedAt: new Date(),
          recurringId: normalizedUpdated.recurringId,
          recurringFrequency: normalizedUpdated.recurringFrequency,
          recurringEndDate: normalizedUpdated.recurringEndDate,
          isRecurring: normalizedUpdated.isRecurring,
          parentTransactionId: normalizedUpdated.parentTransactionId,
          materializedForDate: normalizedUpdated.materializedForDate,
          tags: normalizedUpdated.tags,
          transferGroupId: groupId ?? generateId(),
          debitId: existingDebit?.id ?? normalizedUpdated.id,
          creditId: existingCredit?.id,
        });

        const idsToRemove = new Set(pair.map((entry) => entry.id));
        nextTransactions = [
          transferPair.debit,
          transferPair.credit,
          ...ledgerTransactions.filter((entry) => !idsToRemove.has(entry.id)),
        ];
      } else {
        nextTransactions = ledgerTransactions.map((entry) =>
          entry.id === normalizedUpdated.id ? normalizedUpdated : entry
        );
      }

      applyLedgerState(nextTransactions, accounts, recurringRules);
      pushBudgetAlerts(normalizedUpdated, nextTransactions);
    },
    [accounts, applyLedgerState, ledgerTransactions, pushBudgetAlerts, recurringRules]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      const existing = ledgerTransactions.find((entry) => entry.id === id);
      if (!existing) {
        return;
      }

      const nextTransactions = deleteTransferPair(ledgerTransactions, existing);
      applyLedgerState(nextTransactions, accounts, recurringRules);
    },
    [accounts, applyLedgerState, ledgerTransactions, recurringRules]
  );

  const getTransactionsByCategory = useCallback(
    (categoryId: string) => visibleTransactions.filter((transaction) => transaction.category.id === categoryId),
    [visibleTransactions]
  );

  const getMonthlyTransactions = useCallback(
    (month: string): Transaction[] => {
      if (!month?.trim() || month.length > 50) {
        return [];
      }

      return visibleTransactions.filter((transaction) => monthKey(transaction.date) === month);
    },
    [visibleTransactions]
  );

  const getTotalIncome = useCallback(
    (month?: string): number => {
      if (month && (!month.trim() || month.length > 50)) {
        return 0;
      }

      const list = month ? getMonthlyTransactions(month) : visibleTransactions;
      return list.filter((transaction) => transaction.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    },
    [getMonthlyTransactions, visibleTransactions]
  );

  const getTotalExpenses = useCallback(
    (month?: string): number => {
      if (month && (!month.trim() || month.length > 50)) {
        return 0;
      }

      const list = month ? getMonthlyTransactions(month) : visibleTransactions;
      return list.filter((transaction) => transaction.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    },
    [getMonthlyTransactions, visibleTransactions]
  );

  const getCategorySpending = useCallback(
    (categoryId: string, month?: string): number => {
      if (month && (!month.trim() || month.length > 50)) {
        return 0;
      }

      const list = month ? getMonthlyTransactions(month) : visibleTransactions;
      return list
        .filter((transaction) => transaction.type === 'expense' && transaction.category.id === categoryId)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    },
    [getMonthlyTransactions, visibleTransactions]
  );

  const addBudget = useCallback(
    (budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
      const budget: Budget = {
        ...budgetData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const next = [budget, ...budgets];
      setBudgets(next);
      void persistPatch({ budgets: next });
    },
    [budgets, persistPatch]
  );

  const updateBudget = useCallback(
    (updatedBudget: Budget) => {
      const next = budgets.map((budget) =>
        budget.id === updatedBudget.id
          ? {
              ...updatedBudget,
              updatedAt: new Date(),
            }
          : budget
      );

      setBudgets(next);
      void persistPatch({ budgets: next });
    },
    [budgets, persistPatch]
  );

  const deleteBudget = useCallback(
    (id: string) => {
      const next = budgets.filter((budget) => budget.id !== id);
      setBudgets(next);
      void persistPatch({ budgets: next });
    },
    [budgets, persistPatch]
  );

  const getBudgetSpending = useCallback(
    (budgetId: string, transactions?: Transaction[]) => {
      return getBudgetSpendingInternal(budgetId, transactions ?? visibleTransactions);
    },
    [getBudgetSpendingInternal, visibleTransactions]
  );

  const markAlertAsRead = useCallback(
    (id: string) => {
      const next = budgetAlerts.map((alert) => (alert.id === id ? { ...alert, isRead: true } : alert));
      setBudgetAlerts(next);
      void persistPatch({ budgetAlerts: next });
    },
    [budgetAlerts, persistPatch]
  );

  const clearReadAlerts = useCallback(() => {
    const next = budgetAlerts.filter((alert) => !alert.isRead);
    setBudgetAlerts(next);
    void persistPatch({ budgetAlerts: next });
  }, [budgetAlerts, persistPatch]);

  const addFinancialGoal = useCallback(
    (goalData: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
      const goal: FinancialGoal = {
        ...goalData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const next = [goal, ...financialGoals];
      setFinancialGoals(next);
      void persistPatch({ financialGoals: next });
    },
    [financialGoals, persistPatch]
  );

  const updateFinancialGoal = useCallback(
    (updatedGoal: FinancialGoal) => {
      const next = financialGoals.map((goal) =>
        goal.id === updatedGoal.id
          ? {
              ...updatedGoal,
              updatedAt: new Date(),
            }
          : goal
      );

      setFinancialGoals(next);
      void persistPatch({ financialGoals: next });
    },
    [financialGoals, persistPatch]
  );

  const deleteFinancialGoal = useCallback(
    (id: string) => {
      const next = financialGoals.filter((goal) => goal.id !== id);
      setFinancialGoals(next);
      void persistPatch({ financialGoals: next });
    },
    [financialGoals, persistPatch]
  );

  const updateUserProfile = useCallback(
    (profile: UserProfile) => {
      setUserProfile(profile);
      void persistPatch({ userProfile: profile });
    },
    [persistPatch]
  );

  const updateSettings = useCallback(
    (newSettings: Partial<AppSettings>) => {
      const next = {
        ...settings,
        ...newSettings,
      };

      setSettings(next);
      void persistPatch({ settings: next });
    },
    [persistPatch, settings]
  );

  const addAccount = useCallback(
    (accountData: Omit<Account, 'id' | 'createdAt'>) => {
      const id = generateId();
      const openingBalance = Number(accountData.balance ?? 0);

      const account: Account = {
        ...accountData,
        id,
        balance: 0,
        createdAt: new Date(),
      };

      let nextTransactions = [...ledgerTransactions];

      if (openingBalance !== 0) {
        const opening: Transaction = {
          id: generateId(),
          amount: Math.abs(openingBalance),
          description: 'Opening balance',
          category: OPENING_BALANCE_CATEGORY,
          type: openingBalance >= 0 ? 'income' : 'expense',
          date: new Date(),
          createdAt: new Date(),
          fromAccount: openingBalance < 0 ? id : undefined,
          toAccount: openingBalance >= 0 ? id : undefined,
          fromAccountId: openingBalance < 0 ? id : undefined,
          toAccountId: openingBalance >= 0 ? id : undefined,
          isHidden: true,
        };

        nextTransactions = [opening, ...nextTransactions];
      }

      const nextAccounts = [account, ...accounts];
      applyLedgerState(nextTransactions, nextAccounts, recurringRules);
    },
    [accounts, applyLedgerState, ledgerTransactions, recurringRules]
  );

  const updateAccount = useCallback(
    (updatedAccount: Account) => {
      const nextAccounts = accounts.map((account) =>
        account.id === updatedAccount.id
          ? {
              ...updatedAccount,
              balance: account.balance,
            }
          : account
      );

      applyLedgerState(ledgerTransactions, nextAccounts, recurringRules);
    },
    [accounts, applyLedgerState, ledgerTransactions, recurringRules]
  );

  const deleteAccount = useCallback(
    (accountId: string) => {
      const nextAccounts = accounts.filter((account) => account.id !== accountId);
      const nextTransactions = ledgerTransactions.filter((transaction) => {
        const from = getFromAccountId(transaction);
        const to = getToAccountId(transaction);
        return from !== accountId && to !== accountId;
      });

      applyLedgerState(nextTransactions, nextAccounts, recurringRules);
    },
    [accounts, applyLedgerState, ledgerTransactions, recurringRules]
  );

  const addNote = useCallback(
    (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
      const note: Note = {
        ...noteData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const next = [note, ...notes];
      setNotes(next);
      void persistPatch({ notes: next });
    },
    [notes, persistPatch]
  );

  const updateAccountBalance = useCallback(
    (_accountId: string, _amount: number, _operation: 'add' | 'subtract') => {
      // Backward-compatible API. Balances are always ledger-derived.
      const recomputed = recomputeAllBalances(accounts, ledgerTransactions);
      setAccounts(recomputed);
      void persistPatch({ accounts: recomputed });
    },
    [accounts, ledgerTransactions, persistPatch]
  );

  const backupToGoogleDrive = useCallback(async () => {
    try {
      const backupData: BackupData = {
        transactions: ledgerTransactions,
        accounts,
        notes,
        settings,
        recurringRules,
        exportDate: new Date().toISOString(),
        version: '2.0.0',
      };

      console.log('Offline backup payload:', JSON.stringify(backupData));
      const nextSettings = {
        ...settings,
        lastBackupDate: new Date(),
      };
      setSettings(nextSettings);
      await savePersistedPatch({ settings: nextSettings });
      Alert.alert('Backup successful', 'A local backup snapshot was prepared successfully.');
    } catch (error) {
      console.error('Backup failed:', error);
      Alert.alert('Backup failed', 'Unable to create backup snapshot.');
    }
  }, [accounts, ledgerTransactions, notes, recurringRules, settings]);

  const restoreFromGoogleDrive = useCallback(async () => {
    Alert.alert('Restore not available', 'Cloud restore is not enabled in offline mode.');
  }, []);

  const clearAllData = useCallback(async () => {
    try {
      await clearPersistedState();

      const defaults = buildDefaults();
      setLedgerTransactions(defaults.transactions);
      setAccounts(defaults.accounts);
      setNotes(defaults.notes);
      setBalance(0);
      setBudgets(defaults.budgets);
      setBudgetAlerts(defaults.budgetAlerts);
      setFinancialGoals(defaults.financialGoals);
      setUserProfile(defaults.userProfile);
      setSettings(defaults.settings);
      setRecurringRules(defaults.recurringRules);
      setLedgerIssues([]);
      setIsHydrated(true);
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }, []);

  const triggerReconciliation = useCallback(() => {
    const normalizedRules = recurringRules.map(normalizeRule);
    const deduped = new Map<string, Transaction>();

    for (const transaction of ledgerTransactions) {
      const fingerprint = [
        transaction.type,
        transaction.amount.toFixed(2),
        transaction.date.toISOString(),
        transaction.recurringId ?? '',
        transaction.transferGroupId ?? '',
        transaction.transferLeg ?? '',
        transaction.description.trim().toLowerCase(),
      ].join('|');

      if (!deduped.has(fingerprint)) {
        deduped.set(fingerprint, transaction);
      }
    }

    const reconciled = sortByDateDesc(Array.from(deduped.values()));
    applyLedgerState(reconciled, accounts, normalizedRules);
    materializeRecurringNow(new Date());
  }, [accounts, applyLedgerState, ledgerTransactions, materializeRecurringNow, recurringRules]);


  const behaviorMetrics = useMemo(
    () => computeBehaviorMetrics(visibleTransactions, budgets, accounts),
    [accounts, budgets, visibleTransactions]
  );

  const financialHealthMetrics: FinancialHealthMetrics = useMemo(
    () =>
      computeFinancialHealthMetrics({
        monthlyIncome: behaviorMetrics.monthly.map((entry) => entry.income),
        monthlyExpenses: behaviorMetrics.monthly.map((entry) => entry.expenses),
        budgetAdherence: behaviorMetrics.budget.adherence,
        liquidBalance: balance,
      }),
    [balance, behaviorMetrics]
  );

  const financialHealthScore = useMemo(
    () => computeFinancialHealthScore(financialHealthMetrics),
    [financialHealthMetrics]
  );

  const insights = useMemo(
    () =>
      computeInsights(
        {
          ...behaviorMetrics.insightContext,
          savingsRate: financialHealthMetrics.savingsRate,
          budgetAdherence: financialHealthMetrics.budgetAdherence,
          bufferMonths: financialHealthMetrics.bufferMonths,
          expenseCV: financialHealthMetrics.expenseCV,
          incomeCV: financialHealthMetrics.incomeCV,
        },
        10
      ),
    [behaviorMetrics.insightContext, financialHealthMetrics]
  );

  const farmSummary: SeasonalFarmSummary = useMemo(
    () => getSeasonalFarmSummary(visibleTransactions),
    [visibleTransactions]
  );

  const farmCostBreakdown = useMemo(
    () => getFarmCostBreakdown(visibleTransactions),
    [visibleTransactions]
  );

  const homeSnapshot: HomeSnapshot = useMemo(
    () => ({
      netBalance: balance,
      monthlyCashFlow: behaviorMetrics.currentMonth.net,
      budgetRisk: behaviorMetrics.budget.risk,
      financialHealthScore,
      insightOfWeek: insights[0] ?? null,
      recentTransactions: visibleTransactions.slice(0, 5),
    }),
    [balance, behaviorMetrics, financialHealthScore, insights, visibleTransactions]
  );

  return {
    transactions: visibleTransactions,
    allTransactions: ledgerTransactions,
    accounts,
    notes,
    balance,
    settings,
    budgets,
    budgetAlerts,
    financialGoals,
    userProfile,
    recurringRules,
    ledgerIssues,
    isHydrated,
    isLoaded: isHydrated,
    financialHealthMetrics,
    financialHealthScore,
    healthScore: financialHealthScore,
    insights,
    farmSummary,
    farmCostBreakdown,
    homeSnapshot,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    materializeRecurringNow,
    triggerReconciliation,
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
    updateAccount,
    deleteAccount,
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
  };
});

