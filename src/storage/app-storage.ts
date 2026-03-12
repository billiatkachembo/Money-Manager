import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Account,
  Budget,
  BudgetAlert,
  FinancialGoal,
  MerchantProfile,
  Note,
  RecurringRule,
  Transaction,
  UserProfile,
} from '../../types/transaction';

export interface AppSettings {
  currency: string;
  language: string;
  darkMode: boolean;
  notifications: boolean;
  biometricAuth: boolean;
  autoBackup: boolean;
  lastBackupDate?: Date;
  firstUsedAt?: Date;
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

export interface PersistedState {
  transactions: Transaction[];
  accounts: Account[];
  notes: Note[];
  settings: AppSettings;
  budgets: Budget[];
  budgetAlerts: BudgetAlert[];
  financialGoals: FinancialGoal[];
  userProfile: UserProfile;
  recurringRules: RecurringRule[];
  merchantProfiles: MerchantProfile[];
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiGet(keys: string[]): Promise<readonly [string, string | null][]>;
  multiSet(entries: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export const STORAGE_KEYS = {
  transactions: 'transactions',
  accounts: 'accounts',
  notes: 'notes',
  settings: 'settings',
  budgets: 'budgets',
  budgetAlerts: 'budgetAlerts',
  financialGoals: 'financialGoals',
  userProfile: 'userProfile',
  recurringRules: 'recurringRules',
  merchantProfiles: 'merchantProfiles',
} as const;

const ALL_KEYS = Object.values(STORAGE_KEYS);

const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  multiGet: (keys) => AsyncStorage.multiGet(keys),
  multiSet: (entries) => AsyncStorage.multiSet(entries),
  multiRemove: (keys) => AsyncStorage.multiRemove(keys),
};

function parseDate(value: string | Date | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

function serializeDate(value: string | Date | undefined, fallback?: Date): string | undefined {
  const safeDate = parseDate(value) ?? fallback;
  return safeDate ? safeDate.toISOString() : undefined;
}

function serializeTransactions(transactions: Transaction[]): unknown[] {
  return transactions.map((transaction) => ({
    ...transaction,
    date: transaction.date.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt?.toISOString(),
    recurringEndDate: transaction.recurringEndDate?.toISOString(),
    dueDate: transaction.dueDate?.toISOString(),
  }));
}

function deserializeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const date = parseDate(candidate.date as string);
      const createdAt = parseDate(candidate.createdAt as string);
      if (!date || !createdAt) {
        return null;
      }

      return {
        ...(candidate as unknown as Transaction),
        date,
        createdAt,
        updatedAt: parseDate(candidate.updatedAt as string),
        recurringEndDate: parseDate(candidate.recurringEndDate as string),
        dueDate: parseDate(candidate.dueDate as string),
      } as Transaction;
    })
    .filter((item): item is Transaction => !!item);
}

function serializeAccounts(accounts: Account[]): unknown[] {
  return accounts.map((account) => ({
    ...account,
    createdAt: account.createdAt.toISOString(),
  }));
}

function deserializeAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const createdAt = parseDate(candidate.createdAt as string);
      if (!createdAt) {
        return null;
      }

      return {
        ...(candidate as unknown as Account),
        createdAt,
        balance: Number(candidate.balance ?? 0),
      } as Account;
    })
    .filter((item): item is Account => !!item);
}

function serializeNotes(notes: Note[]): unknown[] {
  return notes.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));
}

function deserializeNotes(raw: unknown): Note[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const createdAt = parseDate(candidate.createdAt as string);
      const updatedAt = parseDate(candidate.updatedAt as string);
      if (!createdAt || !updatedAt) {
        return null;
      }

      return {
        ...(candidate as unknown as Note),
        createdAt,
        updatedAt,
      } as Note;
    })
    .filter((item): item is Note => !!item);
}

function serializeBudgets(budgets: Budget[]): unknown[] {
  return budgets.map((budget) => ({
    ...budget,
    startDate: budget.startDate.toISOString(),
    endDate: budget.endDate?.toISOString(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  }));
}

function deserializeBudgets(raw: unknown): Budget[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const startDate = parseDate(candidate.startDate as string);
      const createdAt = parseDate(candidate.createdAt as string);
      const updatedAt = parseDate(candidate.updatedAt as string);
      if (!startDate || !createdAt || !updatedAt) {
        return null;
      }

      return {
        ...(candidate as unknown as Budget),
        startDate,
        endDate: parseDate(candidate.endDate as string),
        createdAt,
        updatedAt,
      } as Budget;
    })
    .filter((item): item is Budget => !!item);
}

function serializeBudgetAlerts(alerts: BudgetAlert[]): unknown[] {
  return alerts.map((alert) => ({
    ...alert,
    date: alert.date.toISOString(),
  }));
}

function deserializeBudgetAlerts(raw: unknown): BudgetAlert[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const date = parseDate(candidate.date as string);
      if (!date) {
        return null;
      }

      return {
        ...(candidate as unknown as BudgetAlert),
        date,
      } as BudgetAlert;
    })
    .filter((item): item is BudgetAlert => !!item);
}

function serializeFinancialGoals(goals: FinancialGoal[]): unknown[] {
  return goals.map((goal) => {
    const createdAt = parseDate(goal.createdAt) ?? new Date();
    const updatedAt = parseDate(goal.updatedAt) ?? createdAt;
    const targetDate = parseDate(goal.targetDate) ?? createdAt;

    return {
      ...goal,
      targetDate: serializeDate(targetDate, createdAt),
      createdAt: serializeDate(createdAt),
      updatedAt: serializeDate(updatedAt, createdAt),
    };
  });
}

function deserializeFinancialGoals(raw: unknown): FinancialGoal[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const targetDate = parseDate(candidate.targetDate as string);
      const createdAt = parseDate(candidate.createdAt as string);
      const updatedAt = parseDate(candidate.updatedAt as string);
      if (!targetDate || !createdAt || !updatedAt) {
        return null;
      }

      return {
        ...(candidate as unknown as FinancialGoal),
        targetDate,
        createdAt,
        updatedAt,
      } as FinancialGoal;
    })
    .filter((item): item is FinancialGoal => !!item);
}

function serializeUserProfile(profile: UserProfile): unknown {
  return {
    ...profile,
    joinDate: profile.joinDate.toISOString(),
  };
}

function deserializeUserProfile(raw: unknown, fallback: UserProfile): UserProfile {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const joinDate = parseDate(candidate.joinDate as string);
  if (!joinDate) {
    return fallback;
  }

  return {
    ...(candidate as unknown as UserProfile),
    joinDate,
  };
}

function serializeSettings(settings: AppSettings): unknown {
  return {
    ...settings,
    lastBackupDate: settings.lastBackupDate?.toISOString(),
    firstUsedAt: settings.firstUsedAt?.toISOString(),
  };
}

function deserializeSettings(raw: unknown, fallback: AppSettings): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  return {
    ...(fallback as AppSettings),
    ...(candidate as unknown as AppSettings),
    lastBackupDate: parseDate(candidate.lastBackupDate as string),
    firstUsedAt: parseDate(candidate.firstUsedAt as string),
  };
}

function deserializeRecurringRules(raw: unknown): RecurringRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as RecurringRule;
      if (!candidate.id || !candidate.frequency || !candidate.startDate || !candidate.template) {
        return null;
      }

      return candidate;
    })
    .filter((item): item is RecurringRule => !!item);
}

function serializeMerchantProfiles(merchants: MerchantProfile[]): unknown[] {
  return merchants.map((profile) => ({
    ...profile,
    lastUsed: profile.lastUsed?.toISOString(),
  }));
}

function deserializeMerchantProfiles(raw: unknown): MerchantProfile[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      if (!candidate.id || !candidate.merchantName || !candidate.normalizedName) {
        return null;
      }

      return {
        ...(candidate as unknown as MerchantProfile),
        lastUsed: parseDate(candidate.lastUsed as string),
      } as MerchantProfile;
    })
    .filter((item): item is MerchantProfile => !!item);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function loadPersistedState(
  defaults: PersistedState,
  adapter: StorageAdapter = asyncStorageAdapter
): Promise<PersistedState> {
  const rows = await adapter.multiGet(ALL_KEYS);
  const map = new Map(rows);

  const rawTransactions = parseJson<unknown>(map.get(STORAGE_KEYS.transactions) ?? null, []);
  const rawAccounts = parseJson<unknown>(map.get(STORAGE_KEYS.accounts) ?? null, []);
  const rawNotes = parseJson<unknown>(map.get(STORAGE_KEYS.notes) ?? null, []);
  const rawSettings = parseJson<unknown>(map.get(STORAGE_KEYS.settings) ?? null, null);
  const rawBudgets = parseJson<unknown>(map.get(STORAGE_KEYS.budgets) ?? null, []);
  const rawBudgetAlerts = parseJson<unknown>(map.get(STORAGE_KEYS.budgetAlerts) ?? null, []);
  const rawGoals = parseJson<unknown>(map.get(STORAGE_KEYS.financialGoals) ?? null, []);
  const rawProfile = parseJson<unknown>(map.get(STORAGE_KEYS.userProfile) ?? null, null);
  const rawRecurring = parseJson<unknown>(map.get(STORAGE_KEYS.recurringRules) ?? null, []);
  const rawMerchants = parseJson<unknown>(map.get(STORAGE_KEYS.merchantProfiles) ?? null, []);

  return {
    transactions: deserializeTransactions(rawTransactions),
    accounts: deserializeAccounts(rawAccounts),
    notes: deserializeNotes(rawNotes),
    settings: deserializeSettings(rawSettings, defaults.settings),
    budgets: deserializeBudgets(rawBudgets),
    budgetAlerts: deserializeBudgetAlerts(rawBudgetAlerts),
    financialGoals: deserializeFinancialGoals(rawGoals),
    userProfile: deserializeUserProfile(rawProfile, defaults.userProfile),
    recurringRules: deserializeRecurringRules(rawRecurring),
    merchantProfiles: deserializeMerchantProfiles(rawMerchants),
  };
}

export async function savePersistedPatch(
  patch: Partial<PersistedState>,
  adapter: StorageAdapter = asyncStorageAdapter
): Promise<void> {
  const entries: [string, string][] = [];

  if (patch.transactions) {
    entries.push([STORAGE_KEYS.transactions, JSON.stringify(serializeTransactions(patch.transactions))]);
  }

  if (patch.accounts) {
    entries.push([STORAGE_KEYS.accounts, JSON.stringify(serializeAccounts(patch.accounts))]);
  }

  if (patch.notes) {
    entries.push([STORAGE_KEYS.notes, JSON.stringify(serializeNotes(patch.notes))]);
  }

  if (patch.settings) {
    entries.push([STORAGE_KEYS.settings, JSON.stringify(serializeSettings(patch.settings))]);
  }

  if (patch.budgets) {
    entries.push([STORAGE_KEYS.budgets, JSON.stringify(serializeBudgets(patch.budgets))]);
  }

  if (patch.budgetAlerts) {
    entries.push([STORAGE_KEYS.budgetAlerts, JSON.stringify(serializeBudgetAlerts(patch.budgetAlerts))]);
  }

  if (patch.financialGoals) {
    entries.push([
      STORAGE_KEYS.financialGoals,
      JSON.stringify(serializeFinancialGoals(patch.financialGoals)),
    ]);
  }

  if (patch.userProfile) {
    entries.push([STORAGE_KEYS.userProfile, JSON.stringify(serializeUserProfile(patch.userProfile))]);
  }

  if (patch.recurringRules) {
    entries.push([STORAGE_KEYS.recurringRules, JSON.stringify(patch.recurringRules)]);
  }

  if (patch.merchantProfiles) {
    entries.push([STORAGE_KEYS.merchantProfiles, JSON.stringify(serializeMerchantProfiles(patch.merchantProfiles))]);
  }

  if (entries.length === 0) {
    return;
  }

  await adapter.multiSet(entries);
}

export async function clearPersistedState(adapter: StorageAdapter = asyncStorageAdapter): Promise<void> {
  await adapter.multiRemove(ALL_KEYS);
}

// Prepared adapter contract for future SQLite-backed repository.
export const storageAdapter = asyncStorageAdapter;
