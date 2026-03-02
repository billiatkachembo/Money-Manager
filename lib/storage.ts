import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEMA_VERSION_KEY = '__schema_version__';
const CURRENT_SCHEMA_VERSION = 1;

interface WriteQueueItem {
  key: string;
  value: string;
}

let writeQueue: WriteQueueItem[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY = 300;

async function flushQueue(): Promise<void> {
  if (writeQueue.length === 0) return;

  const batch = [...writeQueue];
  writeQueue = [];

  try {
    const pairs: [string, string][] = batch.map(item => [item.key, item.value]);
    await AsyncStorage.multiSet(pairs);
    console.log(`[Storage] Flushed ${batch.length} writes`);
  } catch (error) {
    console.error('[Storage] Batch flush failed:', error);
    writeQueue = [...batch, ...writeQueue];
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushQueue();
    flushTimer = null;
  }, FLUSH_DELAY);
}

export function enqueueWrite(key: string, value: string): void {
  const existingIndex = writeQueue.findIndex(item => item.key === key);
  if (existingIndex >= 0) {
    writeQueue[existingIndex] = { key, value };
  } else {
    writeQueue.push({ key, value });
  }
  scheduleFlush();
}

export async function batchWrite(items: { key: string; value: string }[]): Promise<void> {
  try {
    const pairs: [string, string][] = items.map(i => [i.key, i.value]);
    await AsyncStorage.multiSet(pairs);
    console.log(`[Storage] Batch wrote ${items.length} items`);
  } catch (error) {
    console.error('[Storage] Batch write failed:', error);
  }
}

export async function batchRead(keys: string[]): Promise<Map<string, string | null>> {
  try {
    const results = await AsyncStorage.multiGet(keys);
    const dataMap = new Map<string, string | null>();
    for (const [key, value] of results) {
      dataMap.set(key, value);
    }
    return dataMap;
  } catch (error) {
    console.error('[Storage] Batch read failed:', error);
    return new Map();
  }
}

export async function safeReadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw?.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[Storage] Failed to read/parse ${key}:`, error);
    return fallback;
  }
}

export async function safeWriteJSON(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to write ${key}:`, error);
    return false;
  }
}

export async function checkSchemaVersion(): Promise<{ version: number; needsMigration: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    const version = raw ? parseInt(raw, 10) : 0;
    return {
      version,
      needsMigration: version < CURRENT_SCHEMA_VERSION,
    };
  } catch {
    return { version: 0, needsMigration: true };
  }
}

export async function setSchemaVersion(version: number = CURRENT_SCHEMA_VERSION): Promise<void> {
  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, version.toString());
}

export async function atomicMultiUpdate(
  updates: { key: string; value: string }[]
): Promise<boolean> {
  try {
    const pairs: [string, string][] = updates.map(u => [u.key, u.value]);
    await AsyncStorage.multiSet(pairs);
    return true;
  } catch (error) {
    console.error('[Storage] Atomic multi-update failed:', error);
    return false;
  }
}

export async function forceFlush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushQueue();
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
  lastReconciliation: 'lastReconciliation',
} as const;
