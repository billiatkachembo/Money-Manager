/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  TextInput,
  Switch,
  Alert,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import {
  User,
  Settings,
  HelpCircle,
  Shield,
  Trash2,
  Download,
  Edit3,
  Bell,
  Moon,
  Globe,
  Smartphone,
  DollarSign,
  MapPin,
  Calendar,
  Briefcase,
  Mail,
  MessageCircle,
  ExternalLink,
  Info,
  CheckCircle,
  Lock,
  Eye,
  Key,
  Database,
  BarChart3,
  Clock,
  Shield as ShieldIcon
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { exchangeCodeAsync, type AuthSessionResult } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { formatDateTimeWithWeekday, formatDateWithWeekday, parseDateValue } from '@/utils/date';
import { ALL_CATEGORIES } from '@/constants/categories';
import { CURRENCY_OPTIONS } from '@/constants/currencies';
import { SUPPORTED_LANGUAGES } from '@/constants/languages';
import { exportTransactionsToCsv, parseTransactionsFromCsv } from '@/lib/transaction-csv';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BackupRestoreModal, type BackupHistoryItem } from '@/components/BackupRestoreModal';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Transaction, Budget } from '@/types/transaction';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';
import { showAppTooltip } from '@/store/app-tooltip-store';
import {
  ProfileHeader,
  ProfileStats,
  MenuGrid,
  AutoLockPickerModal,
  EditProfileModal,
  PrivacySecurityModal,
  HelpSupportModal,
  SettingsModal,
  ImportModal,
} from '@/components/profile';
import { enableQuickAddNotificationAsync, disableQuickAddNotificationAsync, enableDailyReminderAsync, disableDailyReminderAsync, getAppNotificationPermissionStateAsync, requestAppNotificationPermissionAsync, type AppNotificationPermissionState } from '@/src/notifications/quick-add-notification';
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
  type DriveAuthState,
} from '@/lib/google-drive';

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_REMINDER_TIME = '18:00';

function parseReminderTime(value?: string | null): Date {
  const fallback = new Date();
  const [hourString, minuteString] = (value ?? DEFAULT_REMINDER_TIME).split(':');
  const hour = Number.parseInt(hourString ?? '', 10);
  const minute = Number.parseInt(minuteString ?? '', 10);
  const safeHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 18;
  const safeMinute = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0;
  fallback.setHours(safeHour, safeMinute, 0, 0);
  return fallback;
}

function toReminderTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatReminderTime(value?: string | null): string {
  const date = parseReminderTime(value);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function parseExpiresInSeconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function extractGoogleAuthPayload(response: AuthSessionResult | null): {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  code?: string;
} {
  if (!response || response.type !== 'success') {
    return {};
  }

  return {
    accessToken: response.authentication?.accessToken ?? response.params.access_token,
    refreshToken: response.authentication?.refreshToken ?? response.params.refresh_token,
    expiresIn: parseExpiresInSeconds(
      response.authentication?.expiresIn ?? response.params.expires_in
    ),
    code: response.params.code,
  };
}

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  occupation: string;
  joinDate: Date;
  avatar: string;
}

interface AppSettings {
  notifications: boolean;
  quickAddNotificationEnabled: boolean;
  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string;
  darkMode: boolean;
  currency: string;
  language: string;
  biometricAuth: boolean;
  autoBackup: boolean;
  lastBackupDate?: Date;
  firstUsedAt?: Date;
  privacy: {
    hideAmounts: boolean;
    requireAuth: boolean;
    dataSharing: boolean;
    analytics: boolean;
  };
  security: {
    autoLock: number;
    passwordEnabled: boolean;
    twoFactorEnabled: boolean;
  };
}

interface GoogleDriveFile {
  id: string;
  name: string;
  createdTime: string;
}

export default function ProfileScreen() {
  const {
    transactions,
    allTransactions,
    accounts,
    notes,
    settings,
    budgets,
    budgetAlerts,
    financialGoals,
    userProfile,
    recurringRules,
    merchantProfiles,
    updateSettings,
    updateUserProfile,
    attemptAutoRestoreFromDrive,
    restoreBackupSnapshot,
    importTransactionsBatch,
    formatCurrency,
    clearAllData
  } = useTransactionStore();
  const { theme, toggleTheme, themeMode, systemTheme, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showHelpSupport, setShowHelpSupport] = useState<boolean>(false);
  const [showBackupRestore, setShowBackupRestore] = useState<boolean>(false);
  const [showPrivacySecurity, setShowPrivacySecurity] = useState<boolean>(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [reminderTime, setReminderTime] = useState<Date>(() => parseReminderTime(settings.dailyReminderTime));

  const [editForm, setEditForm] = useState<UserProfile>(userProfile);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importText, setImportText] = useState('');
  const [showAutoLockPicker, setShowAutoLockPicker] = useState(false);

  const [backupStatus, setBackupStatus] = useState<'idle' | 'backingup' | 'restoring' | 'success' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState<string>('');
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [avatarError, setAvatarError] = useState(false);
  const [notificationPermissionState, setNotificationPermissionState] = useState<AppNotificationPermissionState>('undetermined');
  const autoBackupPromptedRef = useRef(false);

  const googleClientIds = useMemo(
    () => ({
      expo: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID?.trim() || null,
      ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || null,
      android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || null,
      web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null,
    }),
    []
  );

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  const authClientIds = {
    ios: googleClientIds.ios ?? 'MISSING_IOS_CLIENT_ID',
    android: googleClientIds.android ?? 'MISSING_ANDROID_CLIENT_ID',
    web: googleClientIds.web ?? 'MISSING_WEB_CLIENT_ID',
  };

  const currentAuthClientId =
    Platform.OS === 'ios'
      ? authClientIds.ios
      : Platform.OS === 'android'
        ? authClientIds.android
        : authClientIds.web;

  const [googleAuthRequest, , promptGoogleAuth] = Google.useAuthRequest({
    clientId: currentAuthClientId,
    iosClientId: authClientIds.ios,
    androidClientId: authClientIds.android,
    webClientId: authClientIds.web,
    shouldAutoExchangeCode: false,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'openid',
      'profile',
      'email',
    ],
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  });

  const [driveAuth, setDriveAuth] = useState<DriveAuthState | null>(null);

  const currencies = CURRENCY_OPTIONS;

  const configuredWebAppUrl = useMemo(() => {
    const envUrl = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
    if (envUrl) {
      return envUrl;
    }

    const webRuntime = globalThis as typeof globalThis & {
      location?: {
        origin?: string;
      };
    };

    if (Platform.OS === 'web' && webRuntime.location?.origin) {
      return webRuntime.location.origin;
    }

    return null;
  }, []);

  const settingsSnapPoints = useMemo(() => ['85%'], []);
  const editorSnapPoints = useMemo(() => ['80%'], []);
  const sheetSnapPoints = useMemo(() => ['70%'], []);
  const pickerSnapPoints = useMemo(() => ['50%'], []);
  const timeSnapPoints = useMemo(() => ['30%'], []);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      >
        <BlurView
          intensity={theme.isDark ? 32 : 24}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </BottomSheetBackdrop>
    ),
    [theme.isDark]
  );

  const importCategories = useMemo(() => {
    const map = new Map<string, (typeof ALL_CATEGORIES)[number]>();

    [...ALL_CATEGORIES, ...transactions.map((transaction: Transaction) => transaction.category), ...budgets.map((budget: Budget) => budget.category)]
      .filter((category): category is (typeof ALL_CATEGORIES)[number] => Boolean(category?.id))
      .forEach((category) => {
        if (!map.has(category.id)) {
          map.set(category.id, category);
        }
      });

    return Array.from(map.values());
  }, [budgets, transactions]);

  useEffect(() => {
    setEditForm(userProfile);
  }, [userProfile]);

  useEffect(() => {
    setAvatarError(false);
  }, [userProfile.avatar]);

  useEffect(() => {
    setReminderTime(parseReminderTime(settings.dailyReminderTime));
  }, [settings.dailyReminderTime]);

  useEffect(() => {
    let isMounted = true;

    const loadDriveAuthState = async () => {
      const stored = await loadDriveAuth();
      if (stored && isMounted) {
        setDriveAuth(stored);
      }
    };

    void loadDriveAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  const languages = SUPPORTED_LANGUAGES;

  const autoLockOptions = [
    { value: 0, label: 'Immediately' },
    { value: 1, label: 'After 1 minute' },
    { value: 5, label: 'After 5 minutes' },
    { value: 10, label: 'After 10 minutes' },
    { value: 30, label: 'After 30 minutes' },
    { value: -1, label: 'Never' },
  ];

  const normalizeAutoLockValue = (value: number | undefined): number => {
    const match = autoLockOptions.find((option) => option.value === value);
    return match?.value ?? 5;
  };

  const getAutoLockLabel = (value: number | undefined, compact = false): string => {
    const minutes = normalizeAutoLockValue(value);

    if (minutes === -1) {
      return 'Never';
    }

    if (minutes === 0) {
      return compact ? 'Now' : 'Immediately';
    }

    if (minutes === 1) {
      return compact ? '1m' : 'After 1 minute';
    }

    return compact ? `${minutes}m` : `After ${minutes} minutes`;
  };
  const twoFactorEnabled = settings?.security?.twoFactorEnabled ?? false;
  const selectedAutoLockValue = normalizeAutoLockValue(settings.security?.autoLock);
  const autoLockLabel = getAutoLockLabel(selectedAutoLockValue);
  const autoLockShort = getAutoLockLabel(selectedAutoLockValue, true);
  const memberSinceDate = settings.firstUsedAt ?? userProfile.joinDate;
  const reminderTimeLabel = formatReminderTime(settings.dailyReminderTime);
  const lastBackupDate = settings.lastBackupDate ? new Date(settings.lastBackupDate) : null;
  const lastBackupText =
    lastBackupDate && !Number.isNaN(lastBackupDate.getTime())
      ? `Last backup ${formatDateTimeWithWeekday(lastBackupDate)}`
      : undefined;

  const activeGoalCount = useMemo(
    () =>
      financialGoals.filter(
        (goal) => Number.isFinite(goal.targetAmount) && goal.targetAmount > 0 && goal.currentAmount < goal.targetAmount
      ).length,
    [financialGoals]
  );
  const activeAccountCount = useMemo(() => accounts.filter((account) => account.isActive).length, [accounts]);
  const currentCurrency = useMemo(
    () => currencies.find((currency) => currency.code.toUpperCase() === (settings.currency ?? '').toUpperCase()) ?? currencies[0],
    [currencies, settings.currency]
  );
  const currentLanguage = useMemo(
    () => languages.find((language) => language.code === settings.language) ?? languages[0],
    [languages, settings.language]
  );
  const driveConnected = Boolean(driveAuth?.accessToken || driveAuth?.refreshToken);
  const notificationPermissionGranted = notificationPermissionState === 'granted';
  const overviewStats = useMemo(
    () => [
      { label: 'Transactions', value: `${transactions.length}` },
      { label: 'Accounts', value: `${activeAccountCount}` },
      { label: 'Notes', value: `${notes.length}` },
      { label: 'Active Goals', value: `${activeGoalCount}` },
    ],
    [activeAccountCount, activeGoalCount, notes.length, transactions.length]
  );
  const profileInfoRows = useMemo(
    () => [
      {
        label: 'Currency',
        helper: currentCurrency.name,
        value: currentCurrency.code,
        icon: DollarSign,
        tint: '#0F766E',
      },
      {
        label: 'Language',
        helper: currentLanguage.englishName,
        value: currentLanguage.name,
        icon: Globe,
        tint: '#7C3AED',
      },
      {
        label: 'Daily Reminder',
        helper: !notificationPermissionGranted
          ? notificationPermissionState === 'denied'
            ? 'Notifications are blocked'
            : notificationPermissionState === 'unsupported'
              ? 'Notifications unavailable here'
              : 'Enable notifications to use reminders'
          : settings.dailyReminderEnabled
            ? 'Scheduled reminder'
            : 'Reminders are off',
        value: settings.dailyReminderEnabled && notificationPermissionGranted ? reminderTimeLabel : 'Off',
        icon: Bell,
        tint: '#EA580C',
      },
      {
        label: 'Backups',
        helper: lastBackupText ?? 'No backup history yet',
        value: driveConnected ? 'Drive' : 'Local',
        icon: Database,
        tint: '#2563EB',
      },
    ],
    [
      currentCurrency.code,
      currentCurrency.name,
      currentLanguage.englishName,
      currentLanguage.name,
      driveConnected,
      lastBackupText,
      notificationPermissionGranted,
      notificationPermissionState,
      reminderTimeLabel,
      settings.dailyReminderEnabled,
    ]
  );
  const driveAccountLabel = driveConnected ? (userProfile.email?.trim() || 'Connected') : undefined;

  const refreshNotificationPermissionState = useCallback(async () => {
    try {
      const nextState = await getAppNotificationPermissionStateAsync();
      setNotificationPermissionState(nextState);
      return nextState;
    } catch {
      setNotificationPermissionState('unsupported');
      return 'unsupported' as const;
    }
  }, []);

  useEffect(() => {
    void refreshNotificationPermissionState();
  }, [refreshNotificationPermissionState]);

  const handleEnableNotificationsPress = async () => {
    const granted = await requestAppNotificationPermissionAsync();
    const nextState = await refreshNotificationPermissionState();

    if (granted) {
      Alert.alert(
        'Notifications enabled',
        Platform.OS === 'web'
          ? 'Browser notifications are enabled. Daily reminders remain mobile-first.'
          : 'You can now enable Quick Add and daily reminders.'
      );
      return;
    }

    Alert.alert(
      nextState === 'unsupported' ? 'Not supported' : 'Notifications disabled',
      Platform.OS === 'web'
        ? 'This browser could not enable notifications for the app.'
        : 'Please allow notifications in your device settings and try again.'
    );
  };


  const resetBackupStatus = () => {
    setTimeout(() => {
      setBackupStatus('idle');
    }, 3000);
  };

  const openImportModal = (format: 'json' | 'csv') => {
    setImportFormat(format);
    setImportText('');

    if (showBackupRestore) {
      setShowBackupRestore(false);
      setTimeout(() => {
        setShowImportModal(true);
      }, 180);
      return;
    }

    setShowImportModal(true);
  };

  const shareFilePayload = async (
    title: string,
    fileName: string,
    content: string,
    mimeType: string,
    successMessage: string,
    onSuccess?: () => void
  ) => {
    try {
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      let fileUri: string | null = null;
      let shouldShare = true;

      if (baseDir) {
        fileUri = `${baseDir}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Storage permission was denied.');
        }
        const directoryUri = permission.directoryUri;
        if (!directoryUri) {
          throw new Error('Storage permission did not return a directory.');
        }
        fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUri,
          fileName,
          mimeType
        );
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        shouldShare = false;
      }

      if (!fileUri) {
        throw new Error('File export is not available on this device.');
      }

      if (shouldShare) {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('File sharing is not available on this device.');
        }

        await Sharing.shareAsync(fileUri, {
          dialogTitle: title,
          mimeType,
          UTI:
            mimeType === 'text/csv'
              ? 'public.comma-separated-values-text'
              : mimeType === 'application/json'
                ? 'public.json'
                : undefined,
        });
      }

      onSuccess?.();
      setBackupStatus('success');
      setBackupMessage(successMessage);
      resetBackupStatus();
    } catch (error) {
      console.error('File export error:', error);
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Failed to export the file. Please try again.');
    }
  };
  const handleExportData = async () => {
    setBackupStatus('backingup');
    setBackupMessage('Preparing JSON backup...');

    const exportedAt = new Date();
    const dataToExport = {
      transactions: allTransactions,
      accounts,
    notes,
      settings,
      budgets,
      budgetAlerts,
      financialGoals,
      userProfile,
      recurringRules,
      merchantProfiles,
      exportDate: exportedAt.toISOString(),
      totalTransactions: transactions.length,
      appVersion: '2.0.0',
      schemaVersion: '2.0',
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
    const backupFileName = `money-manager-backup-${timestamp}.json`;
    await shareFilePayload(
      'Money Manager Backup JSON',
      backupFileName,
      jsonString,
      'application/json',
      'JSON file exported successfully.',
      () => {
        updateSettings({ lastBackupDate: exportedAt });
        setBackupHistory((previous) => [
          { timestamp: exportedAt.getTime(), filename: backupFileName },
          ...previous,
        ].slice(0, 5));
      }
    );
  };

  const handleExportCsv = async () => {
    setBackupStatus('backingup');
    setBackupMessage('Preparing CSV export...');

    const exportedAt = new Date();
    const csvString = exportTransactionsToCsv(transactions);
    const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
    const backupFileName = `money-manager-transactions-${timestamp}.csv`;
    await shareFilePayload(
      'Money Manager Transactions CSV',
      backupFileName,
      csvString,
      'text/csv',
      'CSV file exported successfully.',
      () => {
        updateSettings({ lastBackupDate: exportedAt });
        setBackupHistory((previous) => [
          { timestamp: exportedAt.getTime(), filename: backupFileName },
          ...previous,
        ].slice(0, 5));
      }
    );
  };

  const openExportPrompt = () => {
    Alert.alert('Export Data', 'Choose an export format.', [
      { text: 'Full Backup (JSON)', onPress: handleExportData },
      { text: 'Transactions CSV', onPress: handleExportCsv },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const handleImportData = () => openImportModal('json');
  const handleImportCsv = () => openImportModal('csv');
  const handleRestoreFromHistoryItem = (_item: BackupHistoryItem) => {
    Alert.alert(
      'Restore Backup',
      'Use Import JSON and paste the selected backup payload to restore data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Import',
          onPress: () => openImportModal('json'),
        },
      ]
    );
  };

  const handleJsonImport = async (jsonString: string) => {
    try {
      const importedData = JSON.parse(jsonString);
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Invalid backup file format');
      }

      const hasSupportedKeys = [
        'transactions',
        'accounts',
        'notes',
        'settings',
        'budgets',
        'budgetAlerts',
        'financialGoals',
        'userProfile',
        'recurringRules',
      ].some((key) => key in importedData);

      if (!hasSupportedKeys) {
        throw new Error('This JSON payload does not contain a Money Manager backup.');
      }

      const exportDate = parseDateValue(importedData.exportDate as string | Date | undefined) ?? null;
      const exportLabel = exportDate && !Number.isNaN(exportDate.getTime())
        ? formatDateTimeWithWeekday(exportDate)
        : 'the selected backup';

      Alert.alert(
        'Restore Backup',
        `This will replace your current data with ${exportLabel}. This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                setBackupStatus('restoring');
                setBackupMessage('Restoring backup data...');
                await restoreBackupSnapshot(importedData);
                setShowImportModal(false);
                setImportText('');
                setBackupStatus('success');
                setBackupMessage(
                  `Restored ${Array.isArray(importedData.transactions) ? importedData.transactions.length : 0} transactions from backup.`
                );
                resetBackupStatus();
              } catch (error) {
                console.error('JSON restore error:', error);
                setBackupStatus('error');
                setBackupMessage('Failed to restore the backup. Please verify the file contents.');
              }
            },
          },
        ]
      );
    } catch (error) {
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Invalid JSON data. Please check your backup file.');
    }
  };

  const handleCsvImport = (csvString: string) => {
    try {
      setBackupStatus('restoring');
      setBackupMessage('Parsing CSV transactions...');

      const parsed = parseTransactionsFromCsv(csvString, importCategories);

      if (parsed.transactions.length === 0) {
        const errorMessage = parsed.errors[0]?.message ?? 'No valid transactions found in the CSV payload.';
        throw new Error(errorMessage);
      }

      const result = importTransactionsBatch(parsed.transactions);
      const skippedCount = parsed.skippedCount + result.skippedCount;
      const summaryMessage = skippedCount > 0
        ? `Imported ${result.importedCount} transactions and skipped ${skippedCount} rows.`
        : `Imported ${result.importedCount} transactions from CSV.`;

      setShowImportModal(false);
      setImportText('');
      setBackupStatus('success');
      setBackupMessage(summaryMessage);
      resetBackupStatus();

      if (skippedCount > 0 || parsed.errors.length > 0) {
        const errorPreview = parsed.errors
          .slice(0, 3)
          .map((error) => `Row ${error.row}: ${error.message}`)
          .join('\n');

        Alert.alert(
          'CSV Import Complete',
          errorPreview ? `${summaryMessage}\n\n${errorPreview}` : summaryMessage
        );
      }
    } catch (error) {
      console.error('CSV import error:', error);
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Failed to import CSV transactions.');

      Alert.alert(
        'Import Failed',
        error instanceof Error ? error.message : 'Failed to import CSV transactions.'
      );
    }
  };

  const submitImportPayload = () => {
    if (!importText.trim()) {
      Alert.alert('Import Data', `Paste ${importFormat.toUpperCase()} content to continue.`);
      return;
    }

    if (importFormat === 'json') {
      void handleJsonImport(importText);
      return;
    }

    handleCsvImport(importText);
  };
  const resolveGoogleClientId = useCallback(() => {
    if (Platform.OS === 'ios') {
      return googleClientIds.ios;
    }

    if (Platform.OS === 'android') {
      return googleClientIds.android;
    }

    return googleClientIds.web;
  }, [googleClientIds]);

  const resolveGoogleClientRequirement = useCallback(() => {
    const platformLabel =
      Platform.OS === 'ios'
        ? 'iPhone'
        : Platform.OS === 'android'
          ? 'Android'
          : 'web';

    return {
      clientId: resolveGoogleClientId(),
      platformLabel,
    };
  }, [resolveGoogleClientId]);

  const googleDriveUnavailableReason = useMemo(() => {
    if (isExpoGo) {
      return 'Google Drive requires a development build. Expo Go cannot complete Google OAuth for this app.';
    }

    const { clientId, platformLabel } = resolveGoogleClientRequirement();
    if (!clientId) {
      return platformLabel === 'web'
        ? 'Google Drive backup is not configured for web yet.'
        : `Google Drive backup is not configured for ${platformLabel} yet.`;
    }

    return null;
  }, [isExpoGo, resolveGoogleClientRequirement]);

  const googleDriveAvailable = !googleDriveUnavailableReason;

  const syncGoogleProfile = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Unable to fetch Google profile.');
      }

      const profile = (await response.json()) as Record<string, unknown>;
      if (!profile || typeof profile !== 'object') {
        return;
      }

      updateUserProfile({
        ...userProfile,
        name: (profile.name as string | undefined) ?? userProfile.name,
        email: (profile.email as string | undefined) ?? userProfile.email,
        avatar: (profile.picture as string | undefined) ?? userProfile.avatar,
      });
    } catch (error) {
      console.error('Google profile sync error:', error);
    }
  }, [updateUserProfile, userProfile]);

  const ensureDriveAuth = useCallback(async () => {
    if (isExpoGo) {
      throw new Error(
        'Google Drive requires a development build. Expo Go cannot complete Google OAuth for this app.'
      );
    }

    const { clientId, platformLabel } = resolveGoogleClientRequirement();

    if (!clientId) {
      throw new Error(
        platformLabel === 'web'
          ? 'Google Drive sign-in is not configured for web yet.'
          : `Google Drive sign-in is not configured for ${platformLabel} yet.`
      );
    }

    let stored = driveAuth ?? (await loadDriveAuth());
    if (stored) {
      setDriveAuth(stored);
    }

    if (isTokenValid(stored)) {
      return stored as DriveAuthState;
    }

    if (stored?.refreshToken) {
      try {
        const refreshed = await refreshAccessToken(stored.refreshToken, clientId);
        const nextAuth: DriveAuthState = {
          accessToken: refreshed.accessToken,
          refreshToken: stored.refreshToken,
          expiresAt: refreshed.expiresIn ? Date.now() + refreshed.expiresIn * 1000 : undefined,
        };

        await saveDriveAuth(nextAuth, refreshed.expiresIn);
        setDriveAuth(nextAuth);
        return nextAuth;
      } catch (error) {
        console.error('Google token refresh error:', error);
        await clearDriveAuth();
        setDriveAuth(null);
        stored = null;
      }
    }

    if (!googleAuthRequest) {
      throw new Error('Google authentication is not ready. Please try again.');
    }

    const response = await promptGoogleAuth();
    if (response.type === 'error') {
      throw new Error(
        response.error?.message ||
          response.params?.error_description ||
          response.params?.error ||
          'Google sign-in failed.'
      );
    }

    if (response.type === 'locked') {
      throw new Error('Google sign-in is already in progress.');
    }

    if (response.type !== 'success') {
      throw new Error('Google sign-in was cancelled.');
    }

    let { accessToken, refreshToken, expiresIn, code } = extractGoogleAuthPayload(response);

    if (!accessToken && code) {
      if (!googleAuthRequest.codeVerifier || !googleAuthRequest.redirectUri) {
        throw new Error('Google sign-in completed, but the secure code verifier was unavailable.');
      }

      const exchanged = await exchangeCodeAsync(
        {
          clientId,
          code,
          redirectUri: googleAuthRequest.redirectUri,
          extraParams: {
            code_verifier: googleAuthRequest.codeVerifier,
          },
        },
        Google.discovery
      );

      accessToken = exchanged.accessToken;
      refreshToken = exchanged.refreshToken;
      expiresIn = parseExpiresInSeconds(exchanged.expiresIn);
    }

    if (!accessToken) {
      throw new Error(
        'Google sign-in completed, but no access token was returned. Check your Google OAuth client configuration.'
      );
    }

    const nextAuth: DriveAuthState = {
      accessToken,
      refreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    };

    await saveDriveAuth(nextAuth, expiresIn);
    setDriveAuth(nextAuth);

    return nextAuth;
  }, [
    driveAuth,
    googleAuthRequest,
    isExpoGo,
    loadDriveAuth,
    promptGoogleAuth,
    refreshAccessToken,
    resolveGoogleClientId,
    resolveGoogleClientRequirement,
    saveDriveAuth,
  ]);
  const handleConnectDriveAccount = async () => {
    try {
      setBackupStatus('backingup');
      setBackupMessage('Connecting to Google Drive...');
      const auth = await ensureDriveAuth();
      await syncGoogleProfile(auth.accessToken);
      const stored = await loadDriveAuth();
      if (stored) {
        setDriveAuth(stored);
      }
      setBackupStatus('success');
      setBackupMessage('Google Drive account connected.');
      resetBackupStatus();
    } catch (error) {
      console.error('Google Drive connect error:', error);
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Failed to connect Google Drive.');
    }
  };

  const handleDisconnectDriveAccount = async () => {
    try {
      await clearDriveAuth();
      setDriveAuth(null);
      setBackupStatus('success');
      setBackupMessage('Google Drive account disconnected.');
      resetBackupStatus();
    } catch (error) {
      console.error('Google Drive disconnect error:', error);
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Failed to disconnect Google Drive.');
    }
  };

  useEffect(() => {
    // Reset auto backup prompt flag when setting is disabled
    if (!settings.autoBackup) {
      autoBackupPromptedRef.current = false;
    }
  }, [settings.autoBackup]);

  const handleAutoBackupToggle = async (value: boolean) => {
    if (!value) {
      updateSettings({ autoBackup: false });
      showAppTooltip({
        title: 'Auto backup off',
        message: 'Google Drive automatic backups are turned off.',
        tone: 'info',
      });
      return;
    }

    if (!googleDriveAvailable) {
      updateSettings({ autoBackup: false });
      showAppTooltip({
        title: 'Google Drive unavailable',
        message: googleDriveUnavailableReason ?? 'Google Drive needs more setup before automatic backups can run.',
        tone: 'warning',
        durationMs: 4200,
      });
      return;
    }

    try {
      setBackupStatus('backingup');
      setBackupMessage(driveConnected ? 'Enabling automatic backups...' : 'Connecting Google Drive for automatic backups...');

      const auth = await ensureDriveAuth();
      await syncGoogleProfile(auth.accessToken);
      const stored = await loadDriveAuth();
      if (stored) {
        setDriveAuth(stored);
      }

      updateSettings({ autoBackup: true });
      const willScheduleBackup = allTransactions.length > 0;
      setBackupStatus('success');
      setBackupMessage(
        willScheduleBackup
          ? 'Automatic backups are enabled. A Google Drive backup will start shortly.'
          : 'Automatic backups are enabled. Future changes will sync to Google Drive.'
      );
      resetBackupStatus();
      showAppTooltip({
        title: 'Auto backup on',
        message: willScheduleBackup
          ? 'A Google Drive backup will start automatically in a moment.'
          : 'Future changes will back up automatically to Google Drive.',
        tone: 'success',
      });
    } catch (error) {
      console.error('Auto backup enable error:', error);
      updateSettings({ autoBackup: false });
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Failed to enable automatic backups.');
      showAppTooltip({
        title: 'Auto backup failed',
        message: error instanceof Error ? error.message : 'Failed to enable automatic backups.',
        tone: 'error',
        durationMs: 4200,
      });
    }
  };

  const handleBackupToGoogleDrive = async () => {
    try {
      setBackupStatus('backingup');
      setBackupMessage('Connecting to Google Drive...');

      const auth = await ensureDriveAuth();
      const accessToken = auth.accessToken;
      const folderId = await getOrCreateBackupFolder(accessToken, 'Money Manager Backups');

      setBackupMessage('Uploading backup to Google Drive...');

      const exportedAt = new Date();
      const dataToExport = {
        transactions: allTransactions,
        accounts,
    notes,
        settings,
        budgets,
        budgetAlerts,
        financialGoals,
        userProfile,
        recurringRules,
        merchantProfiles,
        exportDate: exportedAt.toISOString(),
        totalTransactions: transactions.length,
        appVersion: '2.0.0',
        schemaVersion: '2.0',
      };

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
      const backupFileName = `money-manager-drive-backup-${timestamp}.json`;

      await uploadBackupFile(accessToken, backupFileName, jsonString, folderId);

      updateSettings({ lastBackupDate: exportedAt });
      setBackupHistory((previous) => [
        { timestamp: exportedAt.getTime(), filename: backupFileName },
        ...previous,
      ].slice(0, 5));

      setBackupStatus('success');
      setBackupMessage('Backup uploaded to Google Drive.');
      resetBackupStatus();
    } catch (error) {
      console.error('Google Drive backup error:', error);
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Backup failed. Please check your connection and try again.');
    }
  };

  const handleRestoreFromGoogleDrive = async () => {
    try {
      setBackupStatus('restoring');
      setBackupMessage('Connecting to Google Drive...');

      const auth = await ensureDriveAuth();
      const accessToken = auth.accessToken;
      const folderId = await getOrCreateBackupFolder(accessToken, 'Money Manager Backups');
      const files = await listBackupFiles(accessToken, folderId);

      if (!files.length) {
        setBackupStatus('error');
        setBackupMessage('No Google Drive backups found.');
        resetBackupStatus();
        return;
      }

      const latest = files[0];
      setBackupStatus('idle');

      Alert.alert(
        'Restore from Google Drive',
        `Restore backup "${latest.name}"? This will replace your current data.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                setBackupStatus('restoring');
                setBackupMessage('Downloading backup from Google Drive...');
                const jsonString = await downloadBackupFile(accessToken, latest.id);
                const importedData = JSON.parse(jsonString);
                await restoreBackupSnapshot(importedData);
                setBackupStatus('success');
                setBackupMessage('Google Drive backup restored successfully.');
                resetBackupStatus();
              } catch (error) {
                console.error('Google Drive restore error:', error);
                setBackupStatus('error');
                setBackupMessage(error instanceof Error ? error.message : 'Restore failed. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Google Drive restore error:', error);
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Restore failed. Please try again.');
    }
  };

  const updateSetting = (key: string, value: unknown) => {
    if (key === 'darkMode') {
      toggleTheme();
    } else {
      updateSettings({ [key]: value });
    }
  };

  const updatePrivacySetting = (key: string, value: unknown) => {
    updateSettings({
      privacy: {
        hideAmounts: false,
        requireAuth: false,
        dataSharing: false,
        analytics: false,
        ...settings.privacy,
        [key]: value
      }
    });
  };

  const updateSecuritySetting = (key: string, value: unknown) => {
    const nextValue = key === 'autoLock' ? normalizeAutoLockValue(value as number | undefined) : value;

    updateSettings({
      security: {
        autoLock: 5,
        passwordEnabled: false,
        twoFactorEnabled: false,
        ...settings.security,
        [key]: nextValue
      }
    });
  };

  const handleQuickAddToggle = async (value: boolean) => {
    if (value) {
      const enabled = await enableQuickAddNotificationAsync({ requestPermission: true });
      if (!enabled) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications to use Quick Add from the notification bar.'
        );
        updateSettings({ quickAddNotificationEnabled: false });
        return;
      }
    } else {
      await disableQuickAddNotificationAsync();
    }

    updateSettings({ quickAddNotificationEnabled: value });
    void refreshNotificationPermissionState();
  };

  const handleDailyReminderToggle = async (value: boolean) => {
    if (value) {
      const nextTime = settings.dailyReminderTime ?? DEFAULT_REMINDER_TIME;
      const enabled = await enableDailyReminderAsync(nextTime, { requestPermission: true });
      if (!enabled) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications to schedule daily reminders.'
        );
        updateSettings({ dailyReminderEnabled: false });
    void refreshNotificationPermissionState();
        return;
      }

      updateSettings({ dailyReminderEnabled: true, dailyReminderTime: nextTime });
      void refreshNotificationPermissionState();
      return;
    }

    await disableDailyReminderAsync();
    updateSettings({ dailyReminderEnabled: false });
    void refreshNotificationPermissionState();
  };

  const applyReminderTime = async (date: Date) => {
    const nextValue = toReminderTimeValue(date);
    setReminderTime(date);
    updateSettings({ dailyReminderTime: nextValue });

    if (settings.dailyReminderEnabled) {
      const enabled = await enableDailyReminderAsync(nextValue, { requestPermission: false });
      if (!enabled) {
        Alert.alert('Reminder not scheduled', 'Please enable notifications to schedule daily reminders.');
      }
    }
  };

  const handleReminderTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) {
      if (Platform.OS === 'android') {
        setShowReminderTimePicker(false);
      }
      return;
    }

    if (Platform.OS === 'android') {
      setShowReminderTimePicker(false);
      void applyReminderTime(selected);
    } else {
      setReminderTime(selected);
    }
  };

  const handleReminderTimeCancel = () => {
    setReminderTime(parseReminderTime(settings.dailyReminderTime));
    setShowReminderTimePicker(false);
  };

  const handleReminderTimeConfirm = () => {
    setShowReminderTimePicker(false);
    void applyReminderTime(reminderTime);
  };

  const handleDailyReminderActionPress = () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not available on web',
        'Daily reminders are currently available on Android and iOS only.'
      );
      return;
    }

    if (settings.dailyReminderEnabled) {
      setReminderTime(parseReminderTime(settings.dailyReminderTime));
      setShowReminderTimePicker(true);
      return;
    }

    void handleDailyReminderToggle(true);
  };

  const handleAutoLockSelect = (minutes: number) => {
    const normalizedMinutes = normalizeAutoLockValue(minutes);
    updateSecuritySetting('autoLock', normalizedMinutes);
    setShowAutoLockPicker(false);
    Alert.alert('Auto Lock Updated', `Auto lock set to ${getAutoLockLabel(normalizedMinutes)}`);
  };

  const handleBiometricAuthToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Biometric Authentication',
        'This will enable fingerprint or face ID authentication for the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => updateSetting('biometricAuth', true),
          },
        ]
      );
    } else {
      updateSetting('biometricAuth', false);
    }
  };

  const closePasswordPrompt = () => {
    setPasswordDraft('');
    setShowPasswordPrompt(false);
  };

  const submitPasswordPrompt = () => {
    const normalizedPassword = passwordDraft.trim();
    if (normalizedPassword.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters long.');
      return;
    }

    updateSecuritySetting('passwordEnabled', true);
    closePasswordPrompt();
    Alert.alert('Success', 'App password has been set.');
  };

  const handlePasswordToggle = (value: boolean) => {
    if (value) {
      if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
        Alert.prompt(
          'Set App Password',
          'Enter a password to protect your app:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Set Password',
              onPress: (password?: string) => {
                if (password && password.trim().length >= 4) {
                  updateSecuritySetting('passwordEnabled', true);
                  Alert.alert('Success', 'App password has been set.');
                } else {
                  Alert.alert('Error', 'Password must be at least 4 characters long.');
                }
              },
            },
          ],
          'secure-text'
        );
        return;
      }

      setPasswordDraft('');
      setShowPasswordPrompt(true);
      return;
    }

    Alert.alert(
      'Disable App Password',
      'Are you sure you want to disable the app password?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: () => updateSecuritySetting('passwordEnabled', false),
        },
      ]
    );
  };

  const handleTwoFactorToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Two-Factor Authentication',
        'This will add an extra layer of security to your account. You will need to verify your identity using an authentication app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => {
              updateSecuritySetting('twoFactorEnabled', true);
              Alert.alert('2FA Enabled', 'Two-factor authentication has been enabled for your account.');
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Disable Two-Factor Authentication',
        'This will reduce the security of your account. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => updateSecuritySetting('twoFactorEnabled', false),
          },
        ]
      );
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your transactions, accounts, and notes. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'All data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = () => {
    updateUserProfile(editForm);
    setShowEditProfile(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const openEditProfile = () => {
    setEditForm(userProfile);
    setShowEditProfile(true);
  };

  const openSettingsDestination = (action: () => void) => {
    setShowSettings(false);
    setTimeout(action, 250);
  };

  const handleOpenPcManager = useCallback(async () => {
    if (!configuredWebAppUrl) {
      showAppTooltip({
        tone: 'info',
        title: 'PC Manager',
        message: 'Set up the web app address first to open PC Manager from this device.',
      });
      return;
    }

    let targetUrl: URL;

    const webRuntime = globalThis as typeof globalThis & {
      location?: {
        origin?: string;
        assign?: (url: string) => void;
      };
    };

    try {
      targetUrl = Platform.OS === 'web' && webRuntime.location?.origin
        ? new URL(configuredWebAppUrl, webRuntime.location.origin)
        : new URL(configuredWebAppUrl);
    } catch (error) {
      showAppTooltip({
        tone: 'error',
        title: 'PC Manager',
        message: 'The PC Manager web address is not valid yet.',
      });
      return;
    }

    targetUrl.searchParams.set('pc_manager_handoff', JSON.stringify({
      source: 'app',
      userProfile: {
        ...userProfile,
        joinDate: new Date(userProfile.joinDate).toISOString(),
      },
      settings: {
        currency: settings.currency,
        language: settings.language,
      },
      themeMode,
    }));

    const handoffUrl = targetUrl.toString();

    try {
      if (Platform.OS === 'web' && webRuntime.location?.assign) {
        webRuntime.location.assign(handoffUrl);
        return;
      }

      await WebBrowser.openBrowserAsync(handoffUrl);
    } catch (error) {
      try {
        await Linking.openURL(handoffUrl);
      } catch (fallbackError) {
        showAppTooltip({
          tone: 'error',
          title: 'PC Manager',
          message: 'Could not open PC Manager right now. Please try again.',
        });
      }
    }
  }, [configuredWebAppUrl, settings.currency, settings.language, themeMode, userProfile]);

  const openEmailSupport = () => {
    const subject = encodeURIComponent('Money Manager Support Request');
    const body = encodeURIComponent(`Hello Support Team,\n\nI need help with:\n\n\nApp Version: 1.0.0\nDevice: ${Platform.OS}\n`);
    Linking.openURL(`mailto:support@moneymanager.com?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Error', 'Could not open email app. Please send email to support@moneymanager.com');
    });
  };

  const openFAQ = () => {
    Alert.alert('FAQ', 'Frequently Asked Questions would be displayed here in a real app.');
  };

  const openContactForm = () => {
    setShowHelpSupport(false);
    setTimeout(() => {
      Alert.alert(
        'Contact Support',
        'How would you like to contact support?',
        [
          { text: 'Email', onPress: openEmailSupport },
          { text: 'Phone', onPress: () => Linking.openURL('tel:+15551234567') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }, 300);
  };
  const totalIncome = transactions
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.profileHero,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            shadowColor: theme.isDark ? '#000000' : theme.colors.primary,
          },
        ]}
      >
        <View style={styles.heroTopBar}>
          <View
            style={[
              styles.heroBadge,
              { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '28' },
            ]}
          >
            <Text style={[styles.heroBadgeText, { color: theme.colors.primary }]}>Profile</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.headerActionButton,
              { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
            ]}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.85}
          >
            <Settings size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.identityRow}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primary + '16' }]}>
            {userProfile.avatar && userProfile.avatar.startsWith('http') && !avatarError ? (
              <Image
                source={{ uri: userProfile.avatar }}
                style={styles.avatarImage}
                resizeMode="cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <User size={34} color={theme.colors.primary} />
            )}
          </View>

          <View style={styles.identityCopy}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {userProfile.name || 'Your Profile'}
            </Text>
            <Text style={[styles.email, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {userProfile.email || 'Add an email in Settings'}
            </Text>
            <View style={styles.identityChips}>
              {userProfile.occupation ? (
                <View style={[styles.metaChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Briefcase size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.metaChipText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {userProfile.occupation}
                  </Text>
                </View>
              ) : null}
              {userProfile.location ? (
                <View style={[styles.metaChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <MapPin size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.metaChipText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {userProfile.location}
                  </Text>
                </View>
              ) : null}
              {!userProfile.occupation && !userProfile.location ? (
                <View style={[styles.metaChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Info size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.metaChipText, { color: theme.colors.textSecondary }]}>Complete your profile</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.memberRow, { borderTopColor: theme.colors.border }]}>
          <View style={styles.memberMeta}>
            <Calendar size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.memberText, { color: theme.colors.textSecondary }]}>
              Member since {formatDateWithWeekday(memberSinceDate)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.editProfileButton, { backgroundColor: theme.colors.primary }]}
            onPress={openEditProfile}
            activeOpacity={0.88}
          >
            <Edit3 size={14} color="#FFFFFF" />
            <Text style={styles.editProfileButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.profileSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.profileSectionHeader}>
          <View>
            <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>Overview</Text>
            <Text style={[styles.profileSectionSubtitle, { color: theme.colors.textSecondary }]}>
              {budgets.length} budgets | {recurringRules.length} recurring rules
            </Text>
          </View>
        </View>

        <View style={styles.overviewGrid}>
          {overviewStats.map((item) => (
            <View
              key={item.label}
              style={[
                styles.overviewTile,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.overviewTileLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
              <Text style={[styles.overviewTileValue, { color: theme.colors.text }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.moneyRow, { borderTopColor: theme.colors.border }]}>
          <View style={styles.moneyMetric}>
            <Text style={[styles.moneyMetricLabel, { color: theme.colors.textSecondary }]}>Total Income</Text>
            <AdaptiveAmountText
              style={[styles.moneyMetricValue, { color: theme.colors.success }]}
              value={settings.privacy?.hideAmounts ? '***' : formatCurrency(totalIncome)}
            />
          </View>
          <View style={[styles.moneyDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.moneyMetric}>
            <Text style={[styles.moneyMetricLabel, { color: theme.colors.textSecondary }]}>Total Expenses</Text>
            <AdaptiveAmountText
              style={[styles.moneyMetricValue, { color: theme.colors.error }]}
              value={settings.privacy?.hideAmounts ? '***' : formatCurrency(totalExpenses)}
            />
          </View>
        </View>
      </View>

      <View style={[styles.profileSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.profileSectionHeader}>
          <View>
            <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>At a Glance</Text>
            <Text style={[styles.profileSectionSubtitle, { color: theme.colors.textSecondary }]}>
              {theme.isDark ? 'Dark mode active' : 'Light mode active'}
            </Text>
          </View>
        </View>

        <View style={styles.metaList}>
          {profileInfoRows.map((item, index) => {
            const Icon = item.icon;
            const isDailyReminderRow = item.label === 'Daily Reminder';
            const reminderActionLabel = !notificationPermissionGranted
              ? 'Enable'
              : Platform.OS === 'web'
                ? 'Mobile'
                : settings.dailyReminderEnabled
                  ? 'Time'
                  : 'Enable';
            return (
              <View
                key={item.label}
                style={[
                  styles.metaListRow,
                  index < profileInfoRows.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  },
                ]}
              >
                <View style={[styles.metaListIconWrap, { backgroundColor: item.tint + '14' }]}>
                  <Icon size={16} color={item.tint} />
                </View>
                <View style={styles.metaListLabelGroup}>
                  <Text style={[styles.metaListLabel, { color: theme.colors.text }]}>{item.label}</Text>
                  <Text style={[styles.metaListHelper, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {item.helper}
                  </Text>
                </View>
                <View style={styles.metaListRight}>
                  <Text style={[styles.metaListValue, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {item.value}
                  </Text>
                  {isDailyReminderRow ? (
                    <TouchableOpacity
                      style={[
                        styles.metaListActionButton,
                        {
                          backgroundColor: theme.colors.primary + '14',
                          borderColor: theme.colors.primary + '24',
                        },
                      ]}
                      onPress={notificationPermissionGranted ? handleDailyReminderActionPress : handleEnableNotificationsPress}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.metaListActionText, { color: theme.colors.primary }]}>{reminderActionLabel}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
        {!notificationPermissionGranted && notificationPermissionState !== 'unsupported' ? (
          <TouchableOpacity
            style={[
              styles.notificationPermissionPrompt,
              {
                backgroundColor: theme.colors.primary + '10',
                borderColor: theme.colors.primary + '24',
              },
            ]}
            onPress={handleEnableNotificationsPress}
            activeOpacity={0.85}
          >
            <View style={[styles.notificationPermissionPromptIcon, { backgroundColor: theme.colors.primary + '18' }]}>
              <Bell size={16} color={theme.colors.primary} />
            </View>
            <View style={styles.notificationPermissionPromptTextWrap}>
              <Text style={[styles.notificationPermissionPromptTitle, { color: theme.colors.text }]}>Enable notifications</Text>
              <Text style={[styles.notificationPermissionPromptSubtitle, { color: theme.colors.textSecondary }]}>
                {Platform.OS === 'web'
                  ? 'Allow browser notifications. Reminder scheduling remains mobile-first.'
                  : notificationPermissionState === 'denied'
                    ? 'Allow notifications in your device settings for reminders and quick actions.'
                    : 'Turn on notifications for daily reminders and quick actions.'}
              </Text>
            </View>
            <View style={[styles.notificationPermissionPromptBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.notificationPermissionPromptBadgeText}>Enable</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: theme.colors.textSecondary }]}>Money Manager v1.0.0</Text>
        <Text style={[styles.copyright, { color: theme.colors.textSecondary }]}>Designed and developed by Billiat</Text>
      </View>
{/* App Settings Modal */}
<SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        settings={settings}
        updateSettings={updateSettings}
        openEditProfile={() => openSettingsDestination(openEditProfile)}
        themeMode={themeMode}
        systemTheme={systemTheme === 'dark' ? 'dark' : 'light'}
        setThemeMode={setThemeMode}
        onClearData={handleClearData}
        onBackupRestore={() => openSettingsDestination(() => setShowBackupRestore(true))}
        onOpenPcManager={() => openSettingsDestination(() => {
          void handleOpenPcManager();
        })}
        onPrivacySecurity={() => openSettingsDestination(() => setShowPrivacySecurity(true))}
        onHelpSupport={() => openSettingsDestination(() => setShowHelpSupport(true))}
        userProfile={userProfile}
        currencies={currencies}
        languages={languages}
        onShowAutoLockPicker={() => openSettingsDestination(() => setShowAutoLockPicker(true))}
        onQuickAddToggle={handleQuickAddToggle}
        onDailyReminderToggle={handleDailyReminderToggle}
        driveConnected={driveConnected}
        driveAccountLabel={driveAccountLabel}
        googleDriveAvailable={googleDriveAvailable}
        googleDriveUnavailableReason={googleDriveUnavailableReason ?? undefined}
        onAutoBackupToggle={handleAutoBackupToggle}
        notificationPermissionGranted={notificationPermissionGranted}
        notificationPermissionState={notificationPermissionState}
        onEnableNotifications={handleEnableNotificationsPress}
        reminderTimeLabel={reminderTimeLabel}
        onShowReminderTimePicker={() => openSettingsDestination(() => setShowReminderTimePicker(true))}
      />

      {Platform.OS === 'android' && showReminderTimePicker ? (
        <DateTimePicker
          value={reminderTime}
          mode="time"
          display="default"
          onChange={handleReminderTimeChange}
        />
      ) : null}

      <Modal
        visible={Platform.OS === 'ios' && showReminderTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleReminderTimeCancel}
      >
        <View style={[styles.pickerModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.pickerModal, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Reminder Time</Text>
            <DateTimePicker
              value={reminderTime}
              mode="time"
              display="spinner"
              onChange={handleReminderTimeChange}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: theme.colors.surface }]}
                onPress={handleReminderTimeCancel}
              >
                <Text style={[styles.modalActionText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalActionPrimary, { backgroundColor: theme.colors.primary }]}
                onPress={handleReminderTimeConfirm}
              >
                <Text style={styles.modalActionPrimaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPasswordPrompt}
        transparent={true}
        animationType="fade"
        onRequestClose={closePasswordPrompt}
      >
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.colors.text }]}>Set App Password</Text>
            <Text style={[styles.dialogMessage, { color: theme.colors.textSecondary }]}>Enter a password with at least 4 characters.</Text>
            <TextInput
              style={[
                styles.textInput,
                styles.dialogInput,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              value={passwordDraft}
              onChangeText={setPasswordDraft}
              placeholder="Enter password"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitPasswordPrompt}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: theme.colors.surface }]}
                onPress={closePasswordPrompt}
              >
                <Text style={[styles.modalActionText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalActionPrimary, { backgroundColor: theme.colors.primary }]}
                onPress={submitPasswordPrompt}
              >
                <Text style={styles.modalActionPrimaryText}>Set Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BackupRestoreModal
        show={showBackupRestore}
        setShow={setShowBackupRestore}
        theme={theme}
        backupStatus={backupStatus}
        backupMessage={backupMessage}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onExportCsv={handleExportCsv}
        onImportCsv={handleImportCsv}
        onConnectDrive={handleConnectDriveAccount}
        onDisconnectDrive={handleDisconnectDriveAccount}
        driveConnected={driveConnected}
        driveAccountLabel={driveAccountLabel}
        googleDriveAvailable={googleDriveAvailable}
        googleDriveUnavailableReason={googleDriveUnavailableReason ?? undefined}
        onBackupToGoogleDrive={handleBackupToGoogleDrive}
        onRestoreFromGoogleDrive={handleRestoreFromGoogleDrive}
        backupHistory={backupHistory}
        onRestoreHistoryItem={handleRestoreFromHistoryItem}
      />

      {/* Auto Lock Picker Modal */}
      <Modal visible={showAutoLockPicker} animationType="slide" transparent={true}>
        <View style={[styles.pickerModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.pickerModal, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Auto Lock Timer</Text>
            <ScrollView style={styles.pickerList}>
              {autoLockOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pickerItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => handleAutoLockSelect(option.value)}
                >
                  <View style={styles.pickerItemInfo}>
                    <Clock size={16} color="#667eea" />
                    <Text style={[styles.pickerItemText, { color: theme.colors.text }]}>
                      {option.label}
                    </Text>
                  </View>
                  {selectedAutoLockValue === option.value && (
                    <CheckCircle size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.pickerCancel, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowAutoLockPicker(false)}
            >
              <Text style={[styles.pickerCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={showImportModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Import Data</Text>
            <TouchableOpacity onPress={submitImportPayload}>
              <Text style={[styles.saveButton, { color: theme.colors.primary }]}>Import</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Import Format</Text>
              <View style={styles.importFormatRow}>
                {(['json', 'csv'] as const).map((format) => {
                  const isActive = importFormat === format;
                  return (
                    <TouchableOpacity
                      key={format}
                      style={[
                        styles.importFormatButton,
                        { borderColor: isActive ? theme.colors.primary : theme.colors.border },
                        isActive && { backgroundColor: theme.colors.primary + '14' },
                      ]}
                      onPress={() => setImportFormat(format)}
                    >
                      <Text
                        style={[
                          styles.importFormatButtonText,
                          { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                        ]}
                      >
                        {format.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.importHelpText, { color: theme.colors.textSecondary }]}>
                {importFormat === 'json'
                  ? 'Paste a full Money Manager backup payload to replace the current app data. Backup dates can be ISO or DD/MM/YYYY.'
                  : 'Paste CSV with headers. Date fields accept DD/MM/YYYY, DD/MM/YYYY HH:mm, or ISO timestamps. Supported columns include date/timestamp, type, amount or total, description, categoryId/categoryName, accounts, transfer/debt fields, currency, tags, createdAt, and updatedAt.'}
              </Text>

              <TextInput
                style={[
                  styles.textInput,
                  styles.importTextInput,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                value={importText}
                onChangeText={setImportText}
                placeholder={importFormat === 'json' ? 'Paste backup JSON here' : 'Paste transaction CSV here'}
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      {/* Privacy & Security Modal */}
      <Modal visible={showPrivacySecurity} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowPrivacySecurity(false)}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Privacy & Security</Text>
            <View style={styles.spacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Privacy</Text>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Eye size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Hide Amounts</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Mask transaction amounts on main screen</Text>
                  </View>
                </View>
                <Switch
                  value={settings.privacy?.hideAmounts || false}
                  onValueChange={(value) => updatePrivacySetting('hideAmounts', value)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Lock size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Require Authentication</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Require PIN/Face ID to open app</Text>
                  </View>
                </View>
                <Switch
                  value={settings.privacy?.requireAuth || false}
                  onValueChange={(value) => updatePrivacySetting('requireAuth', value)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Database size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Data Sharing</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Share anonymous usage data to improve app</Text>
                  </View>
                </View>
                <Switch
                  value={settings.privacy?.dataSharing || false}
                  onValueChange={(value) => updatePrivacySetting('dataSharing', value)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <BarChart3 size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Analytics</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Help us understand how you use the app</Text>
                  </View>
                </View>
                <Switch
                  value={settings.privacy?.analytics || false}
                  onValueChange={(value) => updatePrivacySetting('analytics', value)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Security</Text>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Smartphone size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Biometric Authentication</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Use fingerprint or face ID</Text>
                  </View>
                </View>
                <Switch
                  value={settings.biometricAuth}
                  onValueChange={handleBiometricAuthToggle}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Key size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>App Password</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Set a password to protect the app</Text>
                  </View>
                </View>
                <Switch
                  value={settings.security?.passwordEnabled || false}
                  onValueChange={handlePasswordToggle}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>



<View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
  <View style={styles.settingInfo}>
    <ShieldIcon size={20} color="#667eea" />

    <View style={styles.settingText}>
      <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
        Two-Factor Authentication
      </Text>

      <Text
        style={[
          styles.settingSubtitle,
          { color: theme.colors.textSecondary }
        ]}
      >
        Add extra security to your account
      </Text>
    </View>
  </View>

  <Switch
    value={twoFactorEnabled}
    onValueChange={handleTwoFactorToggle}
    trackColor={{ false: "#e0e0e0", true: "#667eea" }}
  />
</View>

              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => setShowAutoLockPicker(true)}
              >
                <View style={styles.settingInfo}>
                  <Clock size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                      Auto Lock
                    </Text>
                    <Text
                      style={[
                        styles.settingSubtitle,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {autoLockLabel}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.settingValue,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {autoLockShort}
                </Text>
              </TouchableOpacity>
            </View>


          </ScrollView>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={[styles.saveButton, { color: theme.colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Full Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={editForm.name}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                placeholder="Enter your full name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Email</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={editForm.email}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
                placeholder="Enter your email"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Phone</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={editForm.phone}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
                placeholder="Enter your phone number"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Location</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={editForm.location}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, location: text }))}
                placeholder="Enter your location"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Occupation</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={editForm.occupation}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, occupation: text }))}
                placeholder="Enter your occupation"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal visible={showHelpSupport} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowHelpSupport(false)}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Help & Support</Text>
            <View style={styles.spacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Get Help</Text>

              <TouchableOpacity
                style={[styles.helpItem, { borderBottomColor: theme.colors.border }]}
                onPress={openFAQ}
              >
                <View style={styles.helpItemInfo}>
                  <HelpCircle size={24} color="#667eea" />
                  <View style={styles.helpItemText}>
                    <Text style={[styles.helpItemTitle, { color: theme.colors.text }]}>FAQ & Documentation</Text>
                    <Text style={[styles.helpItemSubtitle, { color: theme.colors.textSecondary }]}>
                      Find answers to common questions
                    </Text>
                  </View>
                </View>
                <ExternalLink size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.helpItem, { borderBottomColor: theme.colors.border }]}
                onPress={openContactForm}
              >
                <View style={styles.helpItemInfo}>
                  <MessageCircle size={24} color="#667eea" />
                  <View style={styles.helpItemText}>
                    <Text style={[styles.helpItemTitle, { color: theme.colors.text }]}>Contact Support</Text>
                    <Text style={[styles.helpItemSubtitle, { color: theme.colors.textSecondary }]}>
                      Get help from our support team
                    </Text>
                  </View>
                </View>
                <ExternalLink size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.helpItem, { borderBottomColor: theme.colors.border }]}
                onPress={openEmailSupport}
              >
                <View style={styles.helpItemInfo}>
                  <Mail size={24} color="#667eea" />
                  <View style={styles.helpItemText}>
                    <Text style={[styles.helpItemTitle, { color: theme.colors.text }]}>Email Support</Text>
                    <Text style={[styles.helpItemSubtitle, { color: theme.colors.textSecondary }]}>
                      support@moneymanager.com
                    </Text>
                  </View>
                </View>
                <ExternalLink size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>App Information</Text>

              <View style={[styles.infoItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Version</Text>
                <Text style={[styles.infoValue, { color: theme.colors.textSecondary }]}>1.0.0</Text>
              </View>

              <View style={[styles.infoItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Build Number</Text>
                <Text style={[styles.infoValue, { color: theme.colors.textSecondary }]}>2024.1.0</Text>
              </View>

              <View style={[styles.infoItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.text }]}>Last Updated</Text>
                <Text style={[styles.infoValue, { color: theme.colors.textSecondary }]}>January 2024</Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Legal</Text>

              <TouchableOpacity style={[styles.legalItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.legalText, { color: theme.colors.text }]}>Privacy Policy</Text>
                <ExternalLink size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.legalItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.legalText, { color: theme.colors.text }]}>Terms of Service</Text>
                <ExternalLink size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.legalItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.legalText, { color: theme.colors.text }]}>Open Source Licenses</Text>
                <ExternalLink size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  profileHero: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 86,
    height: 86,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  email: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  identityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  memberRow: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  memberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
  },
  editProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileSection: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 16,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileSectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overviewTile: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 13,
    gap: 6,
  },
  overviewTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  overviewTileValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  moneyMetric: {
    flex: 1,
  },
  moneyMetricLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  moneyMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  moneyDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  metaList: {
    gap: 0,
  },
  metaListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  metaListIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaListLabelGroup: {
    flex: 1,
    minWidth: 0,
  },
  metaListLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaListHelper: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  metaListValue: {
    maxWidth: 96,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  metaListRight: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 12,
    minWidth: 84,
    flexShrink: 0,
  },
  metaListActionButton: {
    minWidth: 68,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaListActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  notificationPermissionPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  notificationPermissionPromptIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationPermissionPromptTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  notificationPermissionPromptTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  notificationPermissionPromptSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 17,
  },
  notificationPermissionPromptBadge: {
    minWidth: 72,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationPermissionPromptBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  version: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  copyright: {
    fontSize: 12,
  },  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cancelButton: {
    fontSize: 14,
    color: '#666',
  },
  saveButton: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#f8f9fa',
  },
  settingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  spacer: {
    width: 60,
  },
  lastBackupInfo: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginTop: 16,
  },
  lastBackupText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  statusSuccess: {
    backgroundColor: '#4CAF5020',
  },
  statusError: {
    backgroundColor: '#F4433620',
  },
  statusProcessing: {
    backgroundColor: '#667eea20',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 13,
    borderRadius: 10,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  restoreButton: {
    backgroundColor: 'transparent',
  },
  backupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  backupInfo: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginTop: 16,
  },
  backupInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  backupInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  backupInfoText: {
    fontSize: 14,
  },
  backupSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerModal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  pickerItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickerCancel: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  pickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modalActionPrimary: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalActionPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dialogCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  dialogInput: {
    minHeight: 0,
  },
  dataActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
  },
  dataActionButtonDisabled: {
    opacity: 0.6,
  },
  dataActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  helpItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  helpItemText: {
    marginLeft: 12,
    flex: 1,
  },
  helpItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  helpItemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
  },
  importFormatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  importFormatButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importFormatButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  importHelpText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  importTextInput: {
    minHeight: 240,
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  legalText: {
    fontSize: 16,
    fontWeight: '500',
  },
});











