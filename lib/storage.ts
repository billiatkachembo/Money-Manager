import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

const SCHEMA_VERSION_KEY = '__schema_version__';
const CURRENT_SCHEMA_VERSION = 1;

const FLUSH_DELAY_ACTIVE_MS = 250;
const FLUSH_DELAY_BACKGROUND_MS = 800;
const MAX_QUEUE_SIZE = 500;
const MAX_WRITE_RETRIES = 3;

const CRITICAL_STORAGE_KEYS = new Set<string>([
  'transactions',
  'accounts',
  'budgets',
  'budgetAlerts',
  'financialGoals',
  'settings',
]);

type QueuePriority = 'normal' | 'critical';
type StorageErrorType = 'recoverable' | 'fatal';
type StorageLogLevel = 'debug' | 'info' | 'warn' | 'error';
type StorageLogger = (
  level: StorageLogLevel,
  message: string,
  meta?: Record<string, unknown>
) => void;

export interface StorageErrorEvent {
  key: string;
  error: unknown;
  type: StorageErrorType;
  retryCount: number;
  willRetry: boolean;
}

export interface EnqueueWriteOptions {
  immediate?: boolean;
  priority?: QueuePriority;
}

export interface BatchWriteOptions {
  verifyReadBack?: boolean;
}

export interface SafeWriteJSONOptions extends EnqueueWriteOptions {
  queued?: boolean;
}

export interface StorageLoggingOptions {
  enabled?: boolean;
  logger?: StorageLogger | null;
}

interface WriteQueueCallback {
  resolve: () => void;
  reject: (error: Error) => void;
}

interface WriteQueueItem {
  key: string;
  value: string;
  retries: number;
  priority: QueuePriority;
  callbacks: WriteQueueCallback[];
}

let writeQueue: WriteQueueItem[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let appState: AppStateStatus = AppState.currentState;
let appStateSubscription: NativeEventSubscription | null = null;
let storageLogger: StorageLogger | null = null;
let loggingEnabled = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const writeErrorListeners = new Set<(event: StorageErrorEvent) => void>();

function log(level: StorageLogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!loggingEnabled) return;

  if (storageLogger) {
    storageLogger(level, message, meta);
    return;
  }

  const payload = meta ? [message, meta] : [message];
  if (level === 'error') console.error('[Storage]', ...payload);
  else if (level === 'warn') console.warn('[Storage]', ...payload);
  else if (level === 'info') console.log('[Storage]', ...payload);
  else if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[Storage]', ...payload);
}

function categorizeWriteError(error: unknown): StorageErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (
    message.includes('quota') ||
    message.includes('disk') ||
    message.includes('full') ||
    message.includes('read-only') ||
    message.includes('readonly')
  ) {
    return 'fatal';
  }
  return 'recoverable';
}

function emitWriteError(event: StorageErrorEvent): void {
  writeErrorListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (listenerError) {
      log('warn', 'Write error listener threw', { listenerError });
    }
  });
}

function getFlushDelay(): number {
  return appState === 'active' ? FLUSH_DELAY_ACTIVE_MS : FLUSH_DELAY_BACKGROUND_MS;
}

function clearFlushTimer(): void {
  if (!flushTimer) return;
  clearTimeout(flushTimer);
  flushTimer = null;
}

function scheduleFlush(delayMs = getFlushDelay()): void {
  clearFlushTimer();
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, delayMs);
}

function resolveItemCallbacks(item: WriteQueueItem): void {
  for (const callback of item.callbacks) {
    callback.resolve();
  }
}

function rejectItemCallbacks(item: WriteQueueItem, error: Error): void {
  for (const callback of item.callbacks) {
    callback.reject(error);
  }
}

function evictQueueItemForCapacity(): void {
  if (writeQueue.length < MAX_QUEUE_SIZE) return;

  const evictIndex = writeQueue.findIndex((item) => item.priority !== 'critical');
  const indexToRemove = evictIndex >= 0 ? evictIndex : 0;
  const [removed] = writeQueue.splice(indexToRemove, 1);
  if (!removed) return;

  const overflowError = new Error(`Write queue overflow. Dropped key: ${removed.key}`);
  rejectItemCallbacks(removed, overflowError);
  emitWriteError({
    key: removed.key,
    error: overflowError,
    type: 'fatal',
    retryCount: removed.retries,
    willRetry: false,
  });
  log('warn', 'Dropped queued write due to capacity limit', {
    key: removed.key,
    queueSize: writeQueue.length,
  });
}

function upsertQueueItem(
  key: string,
  value: string,
  priority: QueuePriority,
  callback: WriteQueueCallback
): void {
  const existingIndex = writeQueue.findIndex((item) => item.key === key);

  if (existingIndex >= 0) {
    const existing = writeQueue[existingIndex];
    existing.value = value;
    existing.retries = 0;
    existing.priority =
      existing.priority === 'critical' || priority === 'critical' ? 'critical' : 'normal';
    existing.callbacks.push(callback);
    if (existing.priority === 'critical' && existingIndex > 0) {
      writeQueue.splice(existingIndex, 1);
      writeQueue.unshift(existing);
    }
    return;
  }

  evictQueueItemForCapacity();

  const item: WriteQueueItem = {
    key,
    value,
    retries: 0,
    priority,
    callbacks: [callback],
  };

  if (priority === 'critical') writeQueue.unshift(item);
  else writeQueue.push(item);
}

async function flushQueue(): Promise<void> {
  if (isFlushing || writeQueue.length === 0) return;
  isFlushing = true;

  const batch = [...writeQueue];
  writeQueue = [];

  try {
    const pairs: [string, string][] = batch.map((item) => [item.key, item.value]);
    await AsyncStorage.multiSet(pairs);
    batch.forEach(resolveItemCallbacks);
    log('info', 'Flushed storage write queue', { count: batch.length });
  } catch (error) {
    const errorType = categorizeWriteError(error);
    const retryable = errorType === 'recoverable';
    const requeued: WriteQueueItem[] = [];

    for (const item of batch) {
      const nextRetryCount = item.retries + 1;
      const willRetry = retryable && nextRetryCount <= MAX_WRITE_RETRIES;

      emitWriteError({
        key: item.key,
        error,
        type: errorType,
        retryCount: nextRetryCount,
        willRetry,
      });

      if (willRetry) {
        requeued.push({ ...item, retries: nextRetryCount });
      } else {
        rejectItemCallbacks(
          item,
          new Error(`Failed to persist key "${item.key}" after ${item.retries} retries`)
        );
      }
    }

    writeQueue = [...requeued, ...writeQueue];
    log('error', 'Storage queue flush failed', {
      error,
      retryable,
      requeued: requeued.length,
      dropped: batch.length - requeued.length,
    });

    if (requeued.length > 0) {
      const maxRetry = Math.max(...requeued.map((item) => item.retries), 1);
      const backoffDelay = Math.min(getFlushDelay() * (maxRetry + 1), 3000);
      scheduleFlush(backoffDelay);
    }
  } finally {
    isFlushing = false;
  }

  if (writeQueue.length > 0 && !flushTimer) {
    scheduleFlush();
  }
}

function handleAppStateChange(nextState: AppStateStatus): void {
  const previousState = appState;
  appState = nextState;

  // Flush pending writes when app is backgrounded/inactive.
  if (
    previousState === 'active' &&
    (nextState === 'inactive' || nextState === 'background')
  ) {
    void forceFlush();
  }
}

function ensureAppStateListener(): void {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

ensureAppStateListener();

export function configureStorageLogging(options: StorageLoggingOptions): void {
  if (typeof options.enabled === 'boolean') {
    loggingEnabled = options.enabled;
  }
  if (Object.prototype.hasOwnProperty.call(options, 'logger')) {
    storageLogger = options.logger ?? null;
  }
}

export function onStorageWriteError(
  listener: (event: StorageErrorEvent) => void
): () => void {
  writeErrorListeners.add(listener);
  return () => {
    writeErrorListeners.delete(listener);
  };
}

export function getWriteQueueSize(): number {
  return writeQueue.length;
}

export function hasPendingWrites(): boolean {
  return writeQueue.length > 0 || isFlushing;
}

export function enqueueWrite(
  key: string,
  value: string,
  options: EnqueueWriteOptions = {}
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const impliedPriority: QueuePriority = CRITICAL_STORAGE_KEYS.has(key) ? 'critical' : 'normal';
    const priority = options.priority ?? impliedPriority;
    const shouldFlushImmediately = options.immediate === true || priority === 'critical';

    upsertQueueItem(key, value, priority, { resolve, reject });

    if (shouldFlushImmediately) {
      void flushQueue();
      return;
    }
    scheduleFlush();
  });
}

export async function batchWrite(
  items: { key: string; value: string }[],
  options: BatchWriteOptions = {}
): Promise<void> {
  try {
    const pairs: [string, string][] = items.map((item) => [item.key, item.value]);
    await AsyncStorage.multiSet(pairs);

    if (options.verifyReadBack) {
      const keys = items.map((item) => item.key);
      const readBack = await AsyncStorage.multiGet(keys);
      for (const [key, stored] of readBack) {
        const expected = items.find((item) => item.key === key)?.value;
        if (expected !== stored) {
          throw new Error(`Read-back mismatch for key "${key}"`);
        }
      }
    }

    log('info', 'Batch wrote storage items', { count: items.length });
  } catch (error) {
    log('error', 'Batch write failed', { error });
    throw error;
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
    log('error', 'Batch read failed', { error });
    return new Map();
  }
}

export async function safeReadJSON<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw?.trim()) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      log('warn', 'Validation failed for JSON read', { key });
      return fallback;
    }
    return parsed as T;
  } catch (error) {
    log('error', `Failed to read/parse ${key}`, { error });
    return fallback;
  }
}

export async function safeWriteJSON(
  key: string,
  value: unknown,
  options: SafeWriteJSONOptions = {}
): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);
    if (options.queued) {
      await enqueueWrite(key, serialized, {
        immediate: options.immediate,
        priority: options.priority,
      });
      return true;
    }

    await AsyncStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    log('error', `Failed to write ${key}`, { error });
    return false;
  }
}

export async function checkSchemaVersion(): Promise<{ version: number; needsMigration: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    const version = Number.isFinite(parsed) ? parsed : 0;
    return {
      version,
      needsMigration: version < CURRENT_SCHEMA_VERSION,
    };
  } catch {
    return { version: 0, needsMigration: true };
  }
}

export async function setSchemaVersion(
  version: number = CURRENT_SCHEMA_VERSION
): Promise<void> {
  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, version.toString());
}

export async function atomicMultiUpdate(
  updates: { key: string; value: string }[],
  options: BatchWriteOptions = {}
): Promise<boolean> {
  try {
    await batchWrite(updates, { verifyReadBack: options.verifyReadBack });
    return true;
  } catch (error) {
    log('error', 'Atomic multi-update failed', { error });
    return false;
  }
}

export async function forceFlush(): Promise<void> {
  clearFlushTimer();
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

