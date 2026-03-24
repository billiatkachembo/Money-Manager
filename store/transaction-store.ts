
import createContextHook from '@nkzw/create-context-hook';
import { Alert, Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Account,
  Budget,
  BudgetAlert,
  DebtAccount,
  FinancialGoal,
  FinancialHealthMetrics,
  Insight,
  MerchantProfile,
  Note,
  RecurringRule,
  SeasonalFarmSummary,
  Transaction,
  TransactionCategory,
  UserProfile,
} from '@/types/transaction';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, findMatchingCategory, mergeCategories, resolveCanonicalCategory } from '@/constants/categories';
import { findCurrencyOption } from '@/constants/currencies';
import { resolveLanguageLocale } from '@/constants/languages';
import { parseDateValue } from '@/utils/date';
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
import { computeDebtLedger } from '@/src/domain/debt-ledger';
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
import { computeFinancialIntelligence } from '@/src/domain/financial-intelligence';
import {
  getFarmCostBreakdown,
  getSeasonalFarmSummary,
} from '@/src/domain/farming';
import { learnMerchantCategory as learnMerchantCategoryInternal } from '@/utils/ai/merchant-intelligence';
import { autoCategorizeTransaction } from '@/utils/ai/transaction-categorization';
import {
  clearDriveAuth,
  downloadBackupFile,
  getOrCreateBackupFolder,
  isTokenValid,
  listBackupFiles,
  loadDriveAuth,
  refreshAccessToken,
  saveDriveAuth,
  uploadBackupFile,
} from '@/lib/google-drive';

interface BackupData {
  transactions: Transaction[];
  accounts: Account[];
  notes: Note[];
  settings: AppSettings;
  recurringRules: RecurringRule[];
  merchantProfiles: MerchantProfile[];
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

type NewAccountInput = Omit<Account, 'id' | 'createdAt'> & {
  initialBalanceDate?: Date;
};

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

const FALLBACK_EXPENSE_CATEGORY =
  resolveCanonicalCategory({ id: 'other' }) ?? EXPENSE_CATEGORIES[0];
const FALLBACK_INCOME_CATEGORY =
  resolveCanonicalCategory({ id: 'other-income' }) ?? INCOME_CATEGORIES[0];
const FALLBACK_DEBT_CATEGORY =
  resolveCanonicalCategory({ id: 'debt' }) ?? EXPENSE_CATEGORIES.find((category) => category.id === 'debt') ?? FALLBACK_EXPENSE_CATEGORY;

function resolveTransactionCategory(
  transactionData: Omit<Transaction, 'id' | 'createdAt'>,
  merchantProfiles: MerchantProfile[],
  availableCategories: ReadonlyArray<TransactionCategory> = []
): TransactionCategory | null {
  if (transactionData.type === 'transfer') {
    return TRANSFER_CATEGORY;
  }

  const matchingCategory = findMatchingCategory(availableCategories, transactionData.category);

  if (transactionData.type === 'debt') {
    return (
      resolveCanonicalCategory(transactionData.category) ??
      matchingCategory ??
      transactionData.category ??
      FALLBACK_DEBT_CATEGORY
    );
  }

  const canonical = resolveCanonicalCategory(transactionData.category);
  if (canonical) {
    return canonical;
  }

  if (matchingCategory) {
    return matchingCategory;
  }

  if (transactionData.category?.id && transactionData.category.name) {
    return transactionData.category;
  }

  const autoCategory = autoCategorizeTransaction({
    description: transactionData.description,
    merchant: transactionData.merchant,
    type: transactionData.type,
    merchantProfiles,
    availableCategories,
  });
  if (autoCategory) {
    return autoCategory;
  }

  return transactionData.type === 'income' ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY;
}

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'USD',
  language: 'en',
  darkMode: false,
  notifications: true,
  quickAddNotificationEnabled: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '18:00',
  biometricAuth: false,
  autoBackup: false,
  averageDebtInterestRate: 0.18,
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

const AUTO_BACKUP_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_BACKUP_DEBOUNCE_MS = 45 * 1000;

const GOOGLE_CLIENT_IDS = {
  expo: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID?.trim() || null,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || null,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || null,
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null,
};

function resolveGoogleClientId(): string | null {
  if (Platform.OS === 'ios') {
    return (
      GOOGLE_CLIENT_IDS.ios ??
      GOOGLE_CLIENT_IDS.web ??
      GOOGLE_CLIENT_IDS.android ??
      GOOGLE_CLIENT_IDS.expo ??
      null
    );
  }

  if (Platform.OS === 'android') {
    return (
      GOOGLE_CLIENT_IDS.android ??
      GOOGLE_CLIENT_IDS.web ??
      GOOGLE_CLIENT_IDS.ios ??
      GOOGLE_CLIENT_IDS.expo ??
      null
    );
  }

  return (
    GOOGLE_CLIENT_IDS.web ??
    GOOGLE_CLIENT_IDS.ios ??
    GOOGLE_CLIENT_IDS.android ??
    GOOGLE_CLIENT_IDS.expo ??
    null
  );
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function parseDate(value: Date | string | undefined): Date {
  return parseDateValue(value) ?? new Date();
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

function computeActiveAccountNetBalance(accounts: Account[]): number {
  return Math.round(
    accounts
      .filter((account) => account.isActive)
      .reduce((sum, account) => sum + account.balance, 0) * 100
  ) / 100;
}

function parseOptionalDate(value: Date | string | undefined): Date | undefined {
  return parseDateValue(value);
}

function sortNotesByUpdatedAtDesc(noteList: Note[]): Note[] {
  return [...noteList].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

function normalizeAccount(account: Account): Account {
  return {
    ...account,
    balance: Number(account.balance ?? 0),
    createdAt: parseDate(account.createdAt),
  };
}

function normalizeNote(note: Note): Note {
  return {
    ...note,
    createdAt: parseDate(note.createdAt),
    updatedAt: parseDate(note.updatedAt),
  };
}

function normalizeBudget(budget: Budget): Budget {
  return {
    ...budget,
    amount: Number(budget.amount ?? 0),
    startDate: parseDate(budget.startDate),
    endDate: parseOptionalDate(budget.endDate),
    createdAt: parseDate(budget.createdAt),
    updatedAt: parseDate(budget.updatedAt),
  };
}

function normalizeBudgetAlert(alert: BudgetAlert): BudgetAlert {
  return {
    ...alert,
    date: parseDate(alert.date),
  };
}

function normalizeFinancialGoal(goal: FinancialGoal): FinancialGoal {
  return {
    ...goal,
    targetAmount: Number(goal.targetAmount ?? 0),
    currentAmount: Number(goal.currentAmount ?? 0),
    targetDate: parseDate(goal.targetDate),
    createdAt: parseDate(goal.createdAt),
    updatedAt: parseDate(goal.updatedAt),
  };
}

function normalizeMerchantProfile(profile: MerchantProfile): MerchantProfile {
  return {
    ...profile,
    lastUsed: parseOptionalDate(profile.lastUsed),
  };
}


function normalizeUserProfileData(profile: Partial<UserProfile> | UserProfile | undefined): UserProfile {
  const merged = {
    ...DEFAULT_USER_PROFILE,
    ...profile,
  };

  return {
    ...merged,
    joinDate: parseDate(profile?.joinDate ?? merged.joinDate),
  };
}

function normalizeSettingsData(value: Partial<AppSettings> | AppSettings | undefined): AppSettings {
  const defaultPrivacy = DEFAULT_SETTINGS.privacy ?? {
    hideAmounts: false,
    requireAuth: false,
    dataSharing: false,
    analytics: false,
  };

  const defaultSecurity = DEFAULT_SETTINGS.security ?? {
    autoLock: 5,
    passwordEnabled: false,
    twoFactorEnabled: false,
  };

  const privacy = {
    hideAmounts: value?.privacy?.hideAmounts ?? defaultPrivacy.hideAmounts,
    requireAuth: value?.privacy?.requireAuth ?? defaultPrivacy.requireAuth,
    dataSharing: value?.privacy?.dataSharing ?? defaultPrivacy.dataSharing,
    analytics: value?.privacy?.analytics ?? defaultPrivacy.analytics,
  };

  const security = {
    autoLock: value?.security?.autoLock ?? defaultSecurity.autoLock,
    passwordEnabled: value?.security?.passwordEnabled ?? defaultSecurity.passwordEnabled,
    twoFactorEnabled: value?.security?.twoFactorEnabled ?? defaultSecurity.twoFactorEnabled,
  };

  const quickAddNotificationEnabled =
    typeof value?.quickAddNotificationEnabled === 'boolean'
      ? value.quickAddNotificationEnabled
      : DEFAULT_SETTINGS.quickAddNotificationEnabled;

  const dailyReminderEnabled = value?.dailyReminderEnabled ?? DEFAULT_SETTINGS.dailyReminderEnabled!;
  const dailyReminderTime = value?.dailyReminderTime ?? DEFAULT_SETTINGS.dailyReminderTime!;

  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...value,
    quickAddNotificationEnabled,
    dailyReminderEnabled,
    dailyReminderTime,
    privacy,
    security,
  };

  return {
    ...merged,
    lastBackupDate: parseOptionalDate(value?.lastBackupDate),
    firstUsedAt: parseOptionalDate(value?.firstUsedAt),
  };
}

function buildTransactionImportKey(
  transaction: Pick<
    Transaction,
    'amount' | 'date' | 'description' | 'type' | 'category' | 'fromAccount' | 'toAccount' | 'fromAccountId' | 'toAccountId'
  >
): string {
  const fromAccountId = transaction.fromAccountId ?? transaction.fromAccount ?? '';
  const toAccountId = transaction.toAccountId ?? transaction.toAccount ?? '';
  const categoryId = transaction.type === 'transfer' ? TRANSFER_CATEGORY.id : transaction.category?.id ?? '';

  return [
    transaction.type,
    transaction.amount.toFixed(2),
    parseDate(transaction.date).toISOString(),
    transaction.description.trim().toLowerCase(),
    categoryId,
    fromAccountId,
    toAccountId,
  ].join('|');
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
    merchantProfiles: [],
    customExpenseCategories: [],
    customIncomeCategories: [],
  };
}

export const [TransactionProvider, useTransactionStore] = createContextHook(() => {
  const [ledgerTransactions, setLedgerTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [merchantProfiles, setMerchantProfiles] = useState<MerchantProfile[]>([]);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<TransactionCategory[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<TransactionCategory[]>([]);
  const [ledgerIssues, setLedgerIssues] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const autoBackupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoBackupInFlightRef = useRef(false);
  const autoRestoreAttemptedRef = useRef(false);

  const visibleTransactions = useMemo(
    () => sortByDateDesc(ledgerTransactions.filter(isVisibleTransaction)),
    [ledgerTransactions]
  );

  const expenseCategories = useMemo(() => {
    const categoriesFromTransactions = visibleTransactions
      .filter((transaction) => transaction.type === 'expense' || transaction.type === 'debt')
      .map((transaction) => transaction.category);

    const categoriesFromBudgets = budgets.map((budget) => budget.category);

    return mergeCategories(
      EXPENSE_CATEGORIES,
      customExpenseCategories,
      categoriesFromTransactions,
      categoriesFromBudgets
    );
  }, [budgets, customExpenseCategories, visibleTransactions]);

  const incomeCategories = useMemo(() => {
    const categoriesFromTransactions = visibleTransactions
      .filter((transaction) => transaction.type === 'income')
      .map((transaction) => transaction.category);

    return mergeCategories(INCOME_CATEGORIES, customIncomeCategories, categoriesFromTransactions);
  }, [customIncomeCategories, visibleTransactions]);

  const budgetCategories = useMemo(() => expenseCategories, [expenseCategories]);

  const lifetimeNetCashFlow = useMemo(
    () => computeNetBalance(ledgerTransactions),
    [ledgerTransactions]
  );

  const netBalance = useMemo(
    () => computeActiveAccountNetBalance(accounts),
    [accounts]
  );

  const debtAccounts = useMemo(

    () => computeDebtLedger(ledgerTransactions),
    [ledgerTransactions]
  );


  const persistPatch = useCallback(async (patch: Partial<PersistedState>) => {
    try {
      await savePersistedPatch(patch);
    } catch (error) {
      console.error('Failed to persist patch:', error);
    }
  }, []);

  const getValidDriveAccessToken = useCallback(async (): Promise<string | null> => {
    const stored = await loadDriveAuth();
    if (!stored) {
      return null;
    }

    if (isTokenValid(stored)) {
      return stored.accessToken;
    }

    if (!stored.refreshToken) {
      return null;
    }

    const clientId = resolveGoogleClientId();
    if (!clientId) {
      return null;
    }

    try {
      const refreshed = await refreshAccessToken(stored.refreshToken, clientId);
      const nextAuth = {
        accessToken: refreshed.accessToken,
        refreshToken: stored.refreshToken,
      };
      await saveDriveAuth(nextAuth, refreshed.expiresIn);
      return refreshed.accessToken;
    } catch (error) {
      console.error('Failed to refresh Google Drive token:', error);
      await clearDriveAuth();
      return null;
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

      const currencyOption = findCurrencyOption(currencyCode ?? settings.currency);
      const symbol = currencyOption.symbol;
      const locale = resolveLanguageLocale(settings.language);

      try {
        const numberPart = new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
        return `${symbol} ${numberPart}`;
      } catch {
        return `${symbol} ${amount.toFixed(2)}`;
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
        const alreadyCritical = nextAlerts.some(
          (alert) => alert.budgetId === budget.id && alert.type === 'critical'
        );

        if (budget.alertAtLimit && percent >= 120 && !alreadyCritical) {
          nextAlerts.unshift({
            id: generateId(),
            budgetId: budget.id,
            type: 'critical',
            message: `Critical: ${budget.category?.name} budget is above 120% (${formatCurrency(spent)}).`,
            date: new Date(),
            isRead: false,
          });
        }

        if (budget.alertAtLimit && percent >= 100 && percent < 120 && !alreadyExceeded) {
          nextAlerts.unshift({
            id: generateId(),
            budgetId: budget.id,
            type: 'exceeded',
            message: `You exceeded ${budget.category?.name} budget (${formatCurrency(spent)}).`,
            date: new Date(),
            isRead: false,
          });
        }

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

        const normalizedSettings = normalizeSettingsData(loaded.settings);
        const normalizedUserProfile = normalizeUserProfileData(loaded.userProfile);
        const earliestTransactionDate = mergedTransactions.length
          ? mergedTransactions[mergedTransactions.length - 1].date
          : undefined;
        const joinDateCandidate =
          normalizedUserProfile.joinDate.getTime() === DEFAULT_USER_PROFILE.joinDate.getTime()
            ? undefined
            : normalizedUserProfile.joinDate;
        const existingFirstUsedAt = normalizedSettings.firstUsedAt;
        const shouldUpdateFirstUsedAt =
          !existingFirstUsedAt ||
          existingFirstUsedAt.getTime() === DEFAULT_USER_PROFILE.joinDate.getTime();
        const inferredFirstUsedAt = earliestTransactionDate ?? joinDateCandidate ?? new Date();
        const nextFirstUsedAt = shouldUpdateFirstUsedAt ? inferredFirstUsedAt : existingFirstUsedAt;
        const shouldUpdateJoinDate =
          !loaded.userProfile?.joinDate ||
          normalizedUserProfile.joinDate.getTime() === DEFAULT_USER_PROFILE.joinDate.getTime();
        const nextSettings = shouldUpdateFirstUsedAt
          ? { ...normalizedSettings, firstUsedAt: nextFirstUsedAt }
          : normalizedSettings;
        const nextUserProfile = shouldUpdateJoinDate
          ? { ...normalizedUserProfile, joinDate: nextFirstUsedAt }
          : normalizedUserProfile;

        setLedgerTransactions(mergedTransactions);
        setAccounts(recomputedAccounts);
        setNotes(loaded.notes);
        setBudgets(loaded.budgets);
        setBudgetAlerts(loaded.budgetAlerts);
        setFinancialGoals(loaded.financialGoals);
        setUserProfile(nextUserProfile);
        setSettings(nextSettings);
        setRecurringRules(updatedRules);
        setMerchantProfiles(loaded.merchantProfiles);
        setCustomExpenseCategories(loaded.customExpenseCategories);
        setCustomIncomeCategories(loaded.customIncomeCategories);
        setLedgerIssues(integrity.issues);
        setIsHydrated(true);

        if (shouldUpdateFirstUsedAt || shouldUpdateJoinDate) {
          await savePersistedPatch({
            settings: nextSettings,
            userProfile: nextUserProfile,
          });
        }

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
      const availableCategories = transactionData.type === 'income' ? incomeCategories : expenseCategories;
      const resolvedCategory = resolveTransactionCategory(transactionData, merchantProfiles, availableCategories);

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
          category: resolvedCategory ?? TRANSFER_CATEGORY,
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
          category: resolvedCategory ?? transactionData.category ?? FALLBACK_EXPENSE_CATEGORY,
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

      if (primary && primary.type !== 'transfer' && primary.category?.id) {
        const merchantLabel = primary.merchant ?? primary.description;
        if (merchantLabel) {
          const nextProfiles = learnMerchantCategoryInternal(merchantLabel, primary.category.id, merchantProfiles);
          if (nextProfiles !== merchantProfiles) {
            setMerchantProfiles(nextProfiles);
            void persistPatch({ merchantProfiles: nextProfiles });
          }
        }
      }

      if (primary) {
        pushBudgetAlerts(primary, nextTransactions);
      }
    },
    [accounts, applyLedgerState, expenseCategories, incomeCategories, ledgerTransactions, merchantProfiles, persistPatch, pushBudgetAlerts, recurringRules]
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

      const previousCategoryId = current.category?.id;
      const nextCategoryId = normalizedUpdated.category?.id;
      if (nextCategoryId && nextCategoryId !== previousCategoryId) {
        const merchantLabel = normalizedUpdated.merchant ?? normalizedUpdated.description;
        if (merchantLabel) {
          const nextProfiles = learnMerchantCategoryInternal(merchantLabel, nextCategoryId, merchantProfiles);
          if (nextProfiles !== merchantProfiles) {
            setMerchantProfiles(nextProfiles);
            void persistPatch({ merchantProfiles: nextProfiles });
          }
        }
      }

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
    [accounts, applyLedgerState, expenseCategories, incomeCategories, ledgerTransactions, merchantProfiles, persistPatch, pushBudgetAlerts, recurringRules]
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

  const getBudgetCategories = useCallback(() => budgetCategories, [budgetCategories]);

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

  const learnMerchantCategory = useCallback(
    (merchant: string, categoryId: string) => {
      if (!merchant?.trim() || !categoryId) {
        return;
      }

      const next = learnMerchantCategoryInternal(merchant, categoryId, merchantProfiles);
      setMerchantProfiles(next);
      void persistPatch({ merchantProfiles: next });
    },
    [merchantProfiles, persistPatch]
  );

  const saveCustomCategory = useCallback(
    (category: TransactionCategory, type: 'income' | 'expense' | 'debt') => {
      const isIncomeCategory = type === 'income';
      const availableCategories = isIncomeCategory ? incomeCategories : expenseCategories;
      const existingCategory = findMatchingCategory(availableCategories, category);
      if (existingCategory) {
        return existingCategory;
      }

      const currentCustomCategories = isIncomeCategory ? customIncomeCategories : customExpenseCategories;
      const nextCustomCategories = mergeCategories(currentCustomCategories, [category]);
      const savedCategory = findMatchingCategory(nextCustomCategories, category) ?? category;

      if (nextCustomCategories.length === currentCustomCategories.length) {
        return savedCategory;
      }

      if (isIncomeCategory) {
        setCustomIncomeCategories(nextCustomCategories);
        void persistPatch({ customIncomeCategories: nextCustomCategories });
      } else {
        setCustomExpenseCategories(nextCustomCategories);
        void persistPatch({ customExpenseCategories: nextCustomCategories });
      }

      return savedCategory;
    },
    [customExpenseCategories, customIncomeCategories, expenseCategories, incomeCategories, persistPatch]
  );

  const addAccountsBatch = useCallback(
    (accountDataList: NewAccountInput[]) => {
      if (accountDataList.length === 0) {
        return [] as Account[];
      }

      const nextAccounts: Account[] = [];
      const openingTransactions: Transaction[] = [];

      for (const accountData of accountDataList) {
        const id = generateId();
        const { initialBalanceDate, ...nextAccountData } = accountData;
        const openingDate = parseDateValue(initialBalanceDate) ?? new Date();
        const createdAt = openingDate;
        const openingBalanceRaw = Number(nextAccountData.balance ?? 0);
        const openingBalance = Number.isFinite(openingBalanceRaw) ? openingBalanceRaw : 0;

        const createdAccount: Account = {
          ...nextAccountData,
          id,
          balance: 0,
          createdAt,
        };

        nextAccounts.push(createdAccount);

        if (openingBalance === 0) {
          continue;
        }

        openingTransactions.push({
          id: generateId(),
          amount: Math.abs(openingBalance),
          description: 'Opening balance',
          category: OPENING_BALANCE_CATEGORY,
          type: openingBalance >= 0 ? 'income' : 'expense',
          date: openingDate,
          createdAt: openingDate,
          fromAccount: openingBalance < 0 ? id : undefined,
          toAccount: openingBalance >= 0 ? id : undefined,
          fromAccountId: openingBalance < 0 ? id : undefined,
          toAccountId: openingBalance >= 0 ? id : undefined,
          isHidden: true,
        });
      }

      applyLedgerState(
        [...openingTransactions, ...ledgerTransactions],
        [...nextAccounts, ...accounts],
        recurringRules
      );

      return nextAccounts;
    },
    [accounts, applyLedgerState, ledgerTransactions, recurringRules]
  );

  const addAccount = useCallback(
    (accountData: NewAccountInput) => {
      return addAccountsBatch([accountData])[0] ?? null;
    },
    [addAccountsBatch]
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

      const next = sortNotesByUpdatedAtDesc([note, ...notes]);
      setNotes(next);
      void persistPatch({ notes: next });
    },
    [notes, persistPatch]
  );

  const updateNote = useCallback(
    (updatedNote: Note) => {
      const next = sortNotesByUpdatedAtDesc(
        notes.map((note) =>
          note.id === updatedNote.id
            ? {
                ...note,
                ...normalizeNote(updatedNote),
                createdAt: note.createdAt,
                updatedAt: new Date(),
              }
            : note
        )
      );

      setNotes(next);
      void persistPatch({ notes: next });
    },
    [notes, persistPatch]
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      const next = notes.filter((note) => note.id !== noteId);
      setNotes(next);
      void persistPatch({ notes: next });
    },
    [notes, persistPatch]
  );

  const importTransactionsBatch = useCallback(
    (transactionDataList: Array<Omit<Transaction, 'id' | 'createdAt'>>) => {
      if (transactionDataList.length === 0) {
        return { importedCount: 0, skippedCount: 0 };
      }

      const existingKeys = new Set(
        visibleTransactions
          .filter((transaction) => transaction.type !== 'transfer' || transaction.transferLeg !== 'credit')
          .map((transaction) => buildTransactionImportKey(transaction))
      );

      let nextTransactions = [...ledgerTransactions];
      let nextRecurringRules = [...recurringRules];
      let importedCount = 0;
      let skippedCount = 0;

      for (const transactionData of transactionDataList) {
        const amount = Number(transactionData.amount);
        const date = parseDate(transactionData.date);
        const description = transactionData.description?.trim() || 'Imported transaction';
        const fromAccountId = transactionData.fromAccountId ?? transactionData.fromAccount;
        const toAccountId = transactionData.toAccountId ?? transactionData.toAccount;
        const recurringEndDate = parseOptionalDate(transactionData.recurringEndDate);
        const updatedAt = parseOptionalDate(transactionData.updatedAt) ?? date;
        const availableCategories = transactionData.type === 'income' ? incomeCategories : expenseCategories;
        const resolvedCategory = resolveTransactionCategory(transactionData, merchantProfiles, availableCategories);

        if (!Number.isFinite(amount) || amount <= 0) {
          skippedCount += 1;
          continue;
        }

        if (
          transactionData.type === 'transfer' &&
          (!fromAccountId || !toAccountId || fromAccountId === toAccountId)
        ) {
          skippedCount += 1;
          continue;
        }

        if (transactionData.type !== 'transfer' && !resolvedCategory) {
          skippedCount += 1;
          continue;
        }

        const importKey = buildTransactionImportKey({
          ...transactionData,
          amount,
          date,
          description,
          category: resolvedCategory ?? TRANSFER_CATEGORY,
          fromAccount: fromAccountId,
          toAccount: toAccountId,
          fromAccountId,
          toAccountId,
        });

        if (existingKeys.has(importKey)) {
          skippedCount += 1;
          continue;
        }

        existingKeys.add(importKey);
        let primaryTransaction: Transaction;

        if (transactionData.type === 'transfer') {
          const pair = createTransferLegs({
            amount,
            date,
            description,
            category: resolvedCategory ?? TRANSFER_CATEGORY,
            fromAccountId: fromAccountId!,
            toAccountId: toAccountId!,
            createdAt: date,
            updatedAt,
            recurringId: transactionData.recurringId,
            recurringFrequency: transactionData.recurringFrequency,
            recurringEndDate,
            isRecurring: transactionData.isRecurring,
            parentTransactionId: transactionData.parentTransactionId,
            materializedForDate: transactionData.materializedForDate,
            tags: transactionData.tags,
          });

          nextTransactions = [pair.debit, pair.credit, ...nextTransactions];
          primaryTransaction = pair.debit;
        } else {
          primaryTransaction = normalizeTransaction({
            ...transactionData,
            id: generateId(),
            amount,
            description,
            date,
            createdAt: date,
            updatedAt,
            recurringEndDate,
            category: resolvedCategory ?? transactionData.category ?? FALLBACK_EXPENSE_CATEGORY,
            fromAccount: fromAccountId,
            toAccount: toAccountId,
            fromAccountId,
            toAccountId,
          });

          nextTransactions = [primaryTransaction, ...nextTransactions];
        }

        const recurringRule = createRecurringRuleFromTransaction(primaryTransaction, generateId);
        if (recurringRule) {
          nextRecurringRules = [recurringRule, ...nextRecurringRules];
        }

        importedCount += 1;
      }

      if (importedCount > 0) {
        applyLedgerState(nextTransactions, accounts, nextRecurringRules);
      }

      return { importedCount, skippedCount };
    },
    [accounts, applyLedgerState, expenseCategories, incomeCategories, ledgerTransactions, merchantProfiles, recurringRules, visibleTransactions]
  );

  const restoreBackupSnapshot = useCallback(
    async (snapshot: Partial<PersistedState>) => {
      const defaults = buildDefaults();
      const nextTransactions = sortByDateDesc(
        (Array.isArray(snapshot.transactions) ? snapshot.transactions : defaults.transactions).map(normalizeTransaction)
      );
      const nextAccounts = recomputeAllBalances(
        (Array.isArray(snapshot.accounts) ? snapshot.accounts : defaults.accounts).map(normalizeAccount),
        nextTransactions
      );
      const nextNotes = sortNotesByUpdatedAtDesc(
        (Array.isArray(snapshot.notes) ? snapshot.notes : defaults.notes).map(normalizeNote)
      );
      const nextSettings = normalizeSettingsData(snapshot.settings ?? defaults.settings);
      const nextBudgets = (Array.isArray(snapshot.budgets) ? snapshot.budgets : defaults.budgets).map(normalizeBudget);
      const nextBudgetAlerts = (Array.isArray(snapshot.budgetAlerts) ? snapshot.budgetAlerts : defaults.budgetAlerts).map(normalizeBudgetAlert);
      const nextFinancialGoals = (
        Array.isArray(snapshot.financialGoals) ? snapshot.financialGoals : defaults.financialGoals
      ).map(normalizeFinancialGoal);
      const nextUserProfile = normalizeUserProfileData(snapshot.userProfile ?? defaults.userProfile);
      const nextRecurringRules = (
        Array.isArray(snapshot.recurringRules) ? snapshot.recurringRules : defaults.recurringRules
      ).map(normalizeRule);
      const nextMerchantProfiles = (
        Array.isArray(snapshot.merchantProfiles) ? snapshot.merchantProfiles : defaults.merchantProfiles
      ).map(normalizeMerchantProfile);
      const nextCustomExpenseCategories = mergeCategories(
        Array.isArray(snapshot.customExpenseCategories)
          ? snapshot.customExpenseCategories
          : defaults.customExpenseCategories
      );
      const nextCustomIncomeCategories = mergeCategories(
        Array.isArray(snapshot.customIncomeCategories)
          ? snapshot.customIncomeCategories
          : defaults.customIncomeCategories
      );
      const integrity = validateLedgerIntegrity(nextTransactions);

      setLedgerTransactions(nextTransactions);
      setAccounts(nextAccounts);
      setNotes(nextNotes);
      setBudgets(nextBudgets);
      setBudgetAlerts(nextBudgetAlerts);
      setFinancialGoals(nextFinancialGoals);
      setUserProfile(nextUserProfile);
      setSettings(nextSettings);
      setMerchantProfiles(nextMerchantProfiles);
      setCustomExpenseCategories(nextCustomExpenseCategories);
      setCustomIncomeCategories(nextCustomIncomeCategories);
      setRecurringRules(nextRecurringRules);
      setLedgerIssues(integrity.issues);
      setIsHydrated(true);

      await savePersistedPatch({
        transactions: nextTransactions,
        accounts: nextAccounts,
        notes: nextNotes,
        settings: nextSettings,
        budgets: nextBudgets,
        budgetAlerts: nextBudgetAlerts,
        financialGoals: nextFinancialGoals,
        userProfile: nextUserProfile,
        recurringRules: nextRecurringRules,
        merchantProfiles: nextMerchantProfiles,
        customExpenseCategories: nextCustomExpenseCategories,
        customIncomeCategories: nextCustomIncomeCategories,
      });
    },
    []
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

  const buildDriveBackupPayload = useCallback(
    (exportedAt: Date) => ({
      transactions: ledgerTransactions,
      accounts,
      notes,
      settings,
      budgets,
      budgetAlerts,
      financialGoals,
      userProfile,
      recurringRules,
      merchantProfiles,
      customExpenseCategories,
      customIncomeCategories,
      exportDate: exportedAt.toISOString(),
      totalTransactions: ledgerTransactions.length,
      appVersion: '2.0.0',
      schemaVersion: '2.0',
    }),
    [
      accounts,
      budgetAlerts,
      budgets,
      financialGoals,
      ledgerTransactions,
      customExpenseCategories,
      customIncomeCategories,
      merchantProfiles,
      notes,
      recurringRules,
      settings,
      userProfile,
    ]
  );

  const performDriveBackup = useCallback(
    async (options?: { showAlert?: boolean }) => {
      if (autoBackupInFlightRef.current) {
        return false;
      }

      autoBackupInFlightRef.current = true;

      try {
        const accessToken = await getValidDriveAccessToken();
        if (!accessToken) {
          if (options?.showAlert) {
            Alert.alert('Google Drive not connected', 'Sign in to Google Drive to enable backups.');
          }
          return false;
        }

        const folderId = await getOrCreateBackupFolder(accessToken, 'Money Manager Backups');
        const exportedAt = new Date();
        const payload = buildDriveBackupPayload(exportedAt);
        const jsonString = JSON.stringify(payload);
        const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
        const backupFileName = `money-manager-drive-backup-${timestamp}.json`;

        await uploadBackupFile(accessToken, backupFileName, jsonString, folderId);

        const nextSettings = {
          ...settings,
          lastBackupDate: exportedAt,
        };
        setSettings(nextSettings);
        await persistPatch({ settings: nextSettings });

        if (options?.showAlert) {
          Alert.alert('Backup successful', 'Your Google Drive backup is ready.');
        }
        return true;
      } catch (error) {
        console.error('Google Drive backup error:', error);
        if (options?.showAlert) {
          Alert.alert(
            'Backup failed',
            error instanceof Error ? error.message : 'Backup failed. Please try again.'
          );
        }
        return false;
      } finally {
        autoBackupInFlightRef.current = false;
      }
    },
    [buildDriveBackupPayload, getValidDriveAccessToken, persistPatch, settings]
  );

  const isLocalDataEmpty = useMemo(
    () =>
      ledgerTransactions.length === 0 &&
      accounts.length === 0 &&
      notes.length === 0 &&
      budgets.length === 0 &&
      budgetAlerts.length === 0 &&
      financialGoals.length === 0 &&
      recurringRules.length === 0 &&
      customExpenseCategories.length === 0 &&
      customIncomeCategories.length === 0,
    [
      accounts.length,
      budgetAlerts.length,
      budgets.length,
      customExpenseCategories.length,
      customIncomeCategories.length,
      financialGoals.length,
      ledgerTransactions.length,
      notes.length,
      recurringRules.length,
    ]
  );

  const attemptAutoRestoreFromDrive = useCallback(
    async (options?: { force?: boolean }): Promise<boolean> => {
      if (!isLocalDataEmpty) {
        return false;
      }

      if (autoRestoreAttemptedRef.current && !options?.force) {
        return false;
      }

      autoRestoreAttemptedRef.current = true;

      try {
        const accessToken = await getValidDriveAccessToken();
        if (!accessToken) {
          autoRestoreAttemptedRef.current = options?.force ? true : false;
          return false;
        }

        const folderId = await getOrCreateBackupFolder(accessToken, 'Money Manager Backups');
        const files = await listBackupFiles(accessToken, folderId);
        if (!files.length) {
          return false;
        }

        const latest = files[0];
        const jsonString = await downloadBackupFile(accessToken, latest.id);
        const importedData = JSON.parse(jsonString);
        await restoreBackupSnapshot(importedData);
        return true;
      } catch (error) {
        console.error('Auto restore error:', error);
        if (!options?.force) {
          autoRestoreAttemptedRef.current = false;
        }
        return false;
      }
    },
    [getValidDriveAccessToken, isLocalDataEmpty, restoreBackupSnapshot]
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void attemptAutoRestoreFromDrive();
  }, [attemptAutoRestoreFromDrive, isHydrated]);

  const transactionFingerprint = useMemo(() => {
    if (ledgerTransactions.length === 0) {
      return 'empty';
    }

    const latest = ledgerTransactions[0];
    const marker = latest.updatedAt ?? latest.createdAt ?? latest.date;
    return `${ledgerTransactions.length}-${marker.toISOString()}`;
  }, [ledgerTransactions]);

  useEffect(() => {
    if (!isHydrated || !settings.autoBackup) {
      return;
    }

    if (ledgerTransactions.length === 0) {
      return;
    }

    const lastBackupAt = settings.lastBackupDate?.getTime() ?? 0;
    if (Date.now() - lastBackupAt < AUTO_BACKUP_MIN_INTERVAL_MS) {
      return;
    }

    if (autoBackupTimeoutRef.current) {
      clearTimeout(autoBackupTimeoutRef.current);
    }

    autoBackupTimeoutRef.current = setTimeout(() => {
      void performDriveBackup();
    }, AUTO_BACKUP_DEBOUNCE_MS);

    return () => {
      if (autoBackupTimeoutRef.current) {
        clearTimeout(autoBackupTimeoutRef.current);
      }
    };
  }, [
    isHydrated,
    ledgerTransactions.length,
    performDriveBackup,
    settings.autoBackup,
    settings.lastBackupDate,
    transactionFingerprint,
  ]);

  const backupToGoogleDrive = useCallback(async () => {
    await performDriveBackup({ showAlert: true });
  }, [performDriveBackup]);

  const restoreFromGoogleDrive = useCallback(async () => {
    if (!isLocalDataEmpty) {
      Alert.alert(
        'Restore blocked',
        'Clear local data before restoring from Google Drive to avoid overwriting existing transactions.'
      );
      return;
    }

    const restored = await attemptAutoRestoreFromDrive({ force: true });
    if (!restored) {
      Alert.alert('Restore failed', 'No Google Drive backup was restored.');
    }
  }, [attemptAutoRestoreFromDrive, isLocalDataEmpty]);

  const clearAllData = useCallback(async () => {
    try {
      await clearPersistedState();

      const defaults = buildDefaults();
      setLedgerTransactions(defaults.transactions);
      setAccounts(defaults.accounts);
      setNotes(defaults.notes);
      setBudgets(defaults.budgets);
      setBudgetAlerts(defaults.budgetAlerts);
      setFinancialGoals(defaults.financialGoals);
      setUserProfile(defaults.userProfile);
      setSettings(defaults.settings);
      setRecurringRules(defaults.recurringRules);
      setMerchantProfiles(defaults.merchantProfiles);
      setCustomExpenseCategories(defaults.customExpenseCategories);
      setCustomIncomeCategories(defaults.customIncomeCategories);
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
        liquidBalance: netBalance,
      }),
    [behaviorMetrics, netBalance]
  );

  const financialHealthScore = useMemo(
    () => computeFinancialHealthScore(financialHealthMetrics),
    [financialHealthMetrics]
  );

  const baseInsights = useMemo(
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

  const financialIntelligence = useMemo(
    () =>
      computeFinancialIntelligence({
        transactions: visibleTransactions,
        budgets,
        debtAccounts,
        netBalance,
        monthlyIncome: behaviorMetrics.currentMonth.income,
        monthlyExpenses: behaviorMetrics.currentMonth.expenses,
        monthlyNet: behaviorMetrics.currentMonth.net,
        formatCurrency,
        averageDebtInterestRate: settings.averageDebtInterestRate,
        referenceDate: new Date(),
      }),
    [
      behaviorMetrics.currentMonth.expenses,
      behaviorMetrics.currentMonth.income,
      behaviorMetrics.currentMonth.net,
      budgets,
      debtAccounts,
      formatCurrency,
      netBalance,
      settings.averageDebtInterestRate,
      visibleTransactions,
    ]
  );

  const insights = useMemo(() => {
    if (financialIntelligence.insights.length === 0) {
      return baseInsights;
    }
    const map = new Map<string, Insight>();
    for (const insight of baseInsights) {
      map.set(insight.id, insight);
    }
    for (const insight of financialIntelligence.insights) {
      if (!map.has(insight.id)) {
        map.set(insight.id, insight);
      }
    }
    return Array.from(map.values());
  }, [baseInsights, financialIntelligence.insights]);

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
      netBalance,
      lifetimeNetCashFlow,
      monthlyCashFlow: behaviorMetrics.currentMonth.net,
      budgetRisk: behaviorMetrics.budget.risk,
      financialHealthScore,
      insightOfWeek: insights[0] ?? null,
      recentTransactions: visibleTransactions.slice(0, 5),
    }),
    [behaviorMetrics, financialHealthScore, insights, lifetimeNetCashFlow, netBalance, visibleTransactions]
  );

  return {
    transactions: visibleTransactions,
    allTransactions: ledgerTransactions,
    accounts,
    notes,
    balance: lifetimeNetCashFlow,
    netBalance,
    lifetimeNetCashFlow,
    debtAccounts,
    settings,
    merchantProfiles,
    budgets,
    expenseCategories,
    incomeCategories,
    saveCustomCategory,
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
    financialIntelligence,
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
    restoreBackupSnapshot,
    importTransactionsBatch,
    updateSettings,
    learnMerchantCategory,
    addAccountsBatch,
    addAccount,
    updateAccount,
    deleteAccount,
    addNote,
    updateNote,
    deleteNote,
    clearAllData,
    updateAccountBalance,
    addBudget,
    updateBudget,
    deleteBudget,
    getBudgetSpending,
    getBudgetCategories,
    markAlertAsRead,
    clearReadAlerts,
    addFinancialGoal,
    updateFinancialGoal,
    deleteFinancialGoal,
    updateUserProfile,
    attemptAutoRestoreFromDrive,
  };
});












































































