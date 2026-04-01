import * as Notifications from 'expo-notifications';
import { Appearance, Platform } from 'react-native';

// --- Constants ---
export const QUICK_ADD_NOTIFICATION_ID = 'quick-add-notification';
export const QUICK_ADD_NOTIFICATION_SOURCE = 'quick-add';
export const QUICK_ADD_NOTIFICATION_CHANNEL_ID = 'quick-add-actions';
export const DAILY_REMINDER_NOTIFICATION_PREFIX = 'daily-reminder';
export const DAILY_REMINDER_CHANNEL_ID = 'daily-reminder';
export const QUICK_ADD_NOTIFICATION_CATEGORY_ID = 'quick-add-actions';
export const QUICK_ADD_ACTION_ID = 'quick-add-action';
export const QUICK_SEARCH_ACTION_ID = 'quick-search-action';
export const QUICK_TRANSACTIONS_ACTION_ID = 'quick-transactions-action';

const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web';

export async function getAppNotificationPermissionStateAsync(): Promise<AppNotificationPermissionState> {
  if (!NOTIFICATIONS_SUPPORTED) return 'unsupported';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.status === 'granted') return 'granted';
  if (settings.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestAppNotificationPermissionAsync(): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.status === 'granted';
}

type QuickAddPermissionOptions = { requestPermission?: boolean };

function parseReminderTimeValue(value?: string | null): { hour: number; minute: number } {
  const safe = (value ?? '18:00').split(':');
  const hour = Math.min(23, Math.max(0, Number.parseInt(safe[0] ?? '18', 10) || 18));
  const minute = Math.min(59, Math.max(0, Number.parseInt(safe[1] ?? '0', 10) || 0));
  return { hour, minute };
}
export type AppNotificationPermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

// --- Permission Helpers ---
async function ensurePermissionAsync(requestPermission: boolean): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;

  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.status === 'granted') return true;

  if (!requestPermission) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.status === 'granted';
}

// --- Category & Channel Setup ---
async function ensureCategoryAsync(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(QUICK_ADD_NOTIFICATION_CATEGORY_ID, [
      { identifier: QUICK_ADD_ACTION_ID, buttonTitle: 'Add' },
      { identifier: QUICK_SEARCH_ACTION_ID, buttonTitle: 'Search' },
      { identifier: QUICK_TRANSACTIONS_ACTION_ID, buttonTitle: 'Transactions' },
    ]);
  } catch (error) {
    console.warn('Quick Add category unavailable', error);
  }
}

async function ensureQuickAddChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(QUICK_ADD_NOTIFICATION_CHANNEL_ID, {
      name: 'Quick Actions',
      description: 'Quick add actions',
      importance: Notifications.AndroidImportance.LOW,
      showBadge: false,
      enableLights: false,
      enableVibrate: false,
      vibrationPattern: null,
      sound: null,
    });
  } catch (error) {
    console.warn('Quick Add channel unavailable', error);
  }
}

async function ensureDailyReminderChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(DAILY_REMINDER_CHANNEL_ID, {
      name: 'Daily Reminders',
      description: 'Daily transaction reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
      enableLights: true,
      enableVibrate: true,
    });
  } catch (error) {
    console.warn('Daily reminder channel unavailable', error);
  }
}

// --- Clear Notifications ---
export async function clearNotificationAsync(identifier: string): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;

  try { await Notifications.dismissNotificationAsync(identifier); } catch {}
  try { await Notifications.cancelScheduledNotificationAsync(identifier); } catch {}
}

// --- Quick Add Notifications ---
export async function enableQuickAddNotificationAsync(options: QuickAddPermissionOptions = {}): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;

  const hasPermission = await ensurePermissionAsync(!!options.requestPermission);
  if (!hasPermission) return false;

  await ensureCategoryAsync();
  await ensureQuickAddChannelAsync();
  await clearNotificationAsync(QUICK_ADD_NOTIFICATION_ID);

  const colorScheme = Appearance.getColorScheme();
  const quickAddColor = colorScheme === 'dark' ? '#4AC9FF' : '#667eea';

  await Notifications.scheduleNotificationAsync({
    identifier: QUICK_ADD_NOTIFICATION_ID,
    content: {
      data: { source: QUICK_ADD_NOTIFICATION_SOURCE },
      color: quickAddColor,
      categoryIdentifier: QUICK_ADD_NOTIFICATION_CATEGORY_ID,
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: Platform.OS === 'android' ? { channelId: QUICK_ADD_NOTIFICATION_CHANNEL_ID } : null,
  });

  return true;
}

export async function disableQuickAddNotificationAsync(): Promise<void> {
  await clearNotificationAsync(QUICK_ADD_NOTIFICATION_ID);
}

// --- Daily Reminder Notifications ---
export async function enableDailyReminderAsync(
  user: { id: string; name?: string; dynamicHour?: number; dynamicMinute?: number; logHour?: number; logMinute?: number },
  getYesterdayTransactionsCount: (userId: string) => Promise<number>,
  options?: QuickAddPermissionOptions
): Promise<boolean>;
export async function enableDailyReminderAsync(
  time: string,
  options?: QuickAddPermissionOptions
): Promise<boolean>;
export async function enableDailyReminderAsync(
  userOrTime: { id: string; name?: string; dynamicHour?: number; dynamicMinute?: number; logHour?: number; logMinute?: number } | string,
  arg2?: ((userId: string) => Promise<number>) | QuickAddPermissionOptions,
  arg3?: QuickAddPermissionOptions
): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;

  const options = (typeof userOrTime === 'string' ? (arg2 as QuickAddPermissionOptions | undefined) : arg3) ?? {};
  const getYesterdayTransactionsCount = typeof userOrTime === 'string' ? undefined : (arg2 as (userId: string) => Promise<number>);

  const hasPermission = await ensurePermissionAsync(!!options.requestPermission);
  if (!hasPermission) return false;

  await ensureCategoryAsync();
  await ensureDailyReminderChannelAsync();

  const isTimeString = typeof userOrTime === 'string';
  const user = isTimeString ? { id: 'default' } : userOrTime;

  if (isTimeString) {
    const { hour, minute } = parseReminderTimeValue(userOrTime);

    await clearNotificationAsync(`${DAILY_REMINDER_NOTIFICATION_PREFIX}_log_${user.id}`);

    await Notifications.scheduleNotificationAsync({
      identifier: `${DAILY_REMINDER_NOTIFICATION_PREFIX}_log_${user.id}`,
      content: { title: 'Money Manager', body: "Don't forget to log your transactions today!", data: { reminderType: 'log' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });

    console.log(`Scheduled log reminder for ${user.id}`);
    return true;
  }

  const userName = user.name || 'there';
  const dynamicHour = user.dynamicHour ?? 9;
  const dynamicMinute = user.dynamicMinute ?? 0;
  const logHour = user.logHour ?? 20;
  const logMinute = user.logMinute ?? 0;

  const transactionsYesterday = getYesterdayTransactionsCount
    ? await getYesterdayTransactionsCount(user.id)
    : 0;

  // Dynamic message
  let dynamicTitle = `Hello ${userName}!`;
  let dynamicBody = '';
  if (transactionsYesterday === 0) dynamicBody = `You haven't logged any transactions yesterday. Let's catch up today!`;
  else if (transactionsYesterday <= 3) dynamicBody = `Good job! You logged ${transactionsYesterday} transactions yesterday. Keep going!`;
  else dynamicBody = `Amazing! You logged ${transactionsYesterday} transactions yesterday. Stay on top of your finances today!`;

  // Clear previous notifications
  await clearNotificationAsync(`${DAILY_REMINDER_NOTIFICATION_PREFIX}_dynamic_${user.id}`);
  await clearNotificationAsync(`${DAILY_REMINDER_NOTIFICATION_PREFIX}_log_${user.id}`);

  // Schedule dynamic message
  await Notifications.scheduleNotificationAsync({
    identifier: `${DAILY_REMINDER_NOTIFICATION_PREFIX}_dynamic_${user.id}`,
    content: { title: dynamicTitle, body: dynamicBody, data: { reminderType: 'dynamic' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: dynamicHour, minute: dynamicMinute },
  });

  // Schedule log reminder
  await Notifications.scheduleNotificationAsync({
    identifier: `${DAILY_REMINDER_NOTIFICATION_PREFIX}_log_${user.id}`,
    content: { title: 'Money Manager', body: "Don't forget to log your transactions today!", data: { reminderType: 'log' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: logHour, minute: logMinute },
  });

  console.log(`Scheduled dynamic notifications for ${userName}`);
  return true;
}

export async function disableDailyReminderAsync(userId: string = 'default'): Promise<void> {
  await clearNotificationAsync(`${DAILY_REMINDER_NOTIFICATION_PREFIX}_dynamic_${userId}`);
  await clearNotificationAsync(`${DAILY_REMINDER_NOTIFICATION_PREFIX}_log_${userId}`);
}