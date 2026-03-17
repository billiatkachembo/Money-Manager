import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const QUICK_ADD_NOTIFICATION_ID = 'quick-add-notification';
export const QUICK_ADD_NOTIFICATION_SOURCE = 'quick-add';
export const QUICK_ADD_NOTIFICATION_CHANNEL_ID = 'quick-add-actions';
export const DAILY_REMINDER_NOTIFICATION_ID = 'daily-reminder';
export const DAILY_REMINDER_CHANNEL_ID = 'daily-reminder';
export const QUICK_ADD_NOTIFICATION_CATEGORY_ID = 'quick-add-actions';
export const QUICK_ADD_ACTION_ID = 'quick-add-action';
export const QUICK_SEARCH_ACTION_ID = 'quick-search-action';

type QuickAddPermissionOptions = {
  requestPermission?: boolean;
};

async function ensurePermissionAsync(requestPermission: boolean): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.status === 'granted') {
    return true;
  }

  if (!requestPermission) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.status === 'granted';
}

async function ensureCategoryAsync(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(QUICK_ADD_NOTIFICATION_CATEGORY_ID, [
      { identifier: QUICK_ADD_ACTION_ID, buttonTitle: 'Quick Add' },
      { identifier: QUICK_SEARCH_ACTION_ID, buttonTitle: 'Search' },
    ]);
  } catch (error) {
    console.warn('Quick Add category unavailable', error);
  }
}

async function ensureChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

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
  if (Platform.OS !== 'android') {
    return;
  }

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

function parseReminderTime(reminderTime: string): { hour: number; minute: number } | null {
  const [hourStr, minuteStr] = reminderTime.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

export async function clearQuickAddNotificationAsync(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(QUICK_ADD_NOTIFICATION_ID);
  } catch (error) {
    // ignore missing notifications
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(QUICK_ADD_NOTIFICATION_ID);
  } catch (error) {
    // ignore missing schedules
  }
}

export async function clearDailyReminderAsync(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(DAILY_REMINDER_NOTIFICATION_ID);
  } catch (error) {
    // ignore missing notifications
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_NOTIFICATION_ID);
  } catch (error) {
    // ignore missing schedules
  }
}

export async function enableQuickAddNotificationAsync(
  options: QuickAddPermissionOptions = {}
): Promise<boolean> {
  const hasPermission = await ensurePermissionAsync(!!options.requestPermission);
  if (!hasPermission) {
    return false;
  }

  await ensureCategoryAsync();
  await ensureChannelAsync();
  await clearQuickAddNotificationAsync();

  await Notifications.scheduleNotificationAsync({
    identifier: QUICK_ADD_NOTIFICATION_ID,
    content: {
      title: 'Quick Add',
      body: 'Add a transaction or search history',
      data: { source: QUICK_ADD_NOTIFICATION_SOURCE },
      categoryIdentifier: QUICK_ADD_NOTIFICATION_CATEGORY_ID,
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.MIN,
    },
    trigger: Platform.OS === 'android' ? { channelId: QUICK_ADD_NOTIFICATION_CHANNEL_ID } : null,
  });

  return true;
}

export async function disableQuickAddNotificationAsync(): Promise<void> {
  await clearQuickAddNotificationAsync();
}

export async function enableDailyReminderAsync(
  reminderTime: string,
  options: QuickAddPermissionOptions = {}
): Promise<boolean> {
  const hasPermission = await ensurePermissionAsync(!!options.requestPermission);
  if (!hasPermission) {
    return false;
  }

  await ensureCategoryAsync();
  await ensureDailyReminderChannelAsync();
  await clearDailyReminderAsync();

  const parsed = parseReminderTime(reminderTime);
  if (!parsed) {
    console.warn('Invalid reminder time format:', reminderTime);
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_NOTIFICATION_ID,
    content: {
      title: 'Daily transaction reminder',
      body: 'Log your transactions to keep your finances up to date.',
      data: { source: QUICK_ADD_NOTIFICATION_SOURCE, reminder: true },
      categoryIdentifier: QUICK_ADD_NOTIFICATION_CATEGORY_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
      channelId: DAILY_REMINDER_CHANNEL_ID,
    },
  });

  return true;
}

export async function disableDailyReminderAsync(): Promise<void> {
  await clearDailyReminderAsync();
}

