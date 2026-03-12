/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  TextInput,
  Switch,
  Alert,
  Linking,
  Platform,
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
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { ALL_CATEGORIES } from '@/constants/categories';
import { CURRENCY_OPTIONS } from '@/constants/currencies';
import { exportTransactionsToCsv, parseTransactionsFromCsv } from '@/lib/transaction-csv';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BackupRestoreModal, type BackupHistoryItem } from '@/components/BackupRestoreModal';
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

WebBrowser.maybeCompleteAuthSession();

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
    updateSettings, 
    updateUserProfile,
    restoreBackupSnapshot,
    importTransactionsBatch,
    formatCurrency, 
    clearAllData 
  } = useTransactionStore();
  const { theme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showHelpSupport, setShowHelpSupport] = useState<boolean>(false);
  const [showBackupRestore, setShowBackupRestore] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showPrivacySecurity, setShowPrivacySecurity] = useState<boolean>(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<boolean>(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState<boolean>(false);
  const [showAutoLockPicker, setShowAutoLockPicker] = useState<boolean>(false);
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importText, setImportText] = useState<string>('');
  const [editForm, setEditForm] = useState<UserProfile>(userProfile);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'backingup' | 'restoring' | 'success' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState<string>('');
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);

  const googleClientIds = {
    expo: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  };

  const redirectUri = makeRedirectUri({ scheme: 'myapp' });
  const useProxy = Constants.appOwnership === 'expo';

  const [googleAuthRequest, , promptGoogleAuth] = Google.useAuthRequest({
    expoClientId: googleClientIds.expo,
    iosClientId: googleClientIds.ios,
    androidClientId: googleClientIds.android,
    webClientId: googleClientIds.web,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    redirectUri,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  });

  const [driveAuth, setDriveAuth] = useState<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  } | null>(null);

  const currencies = CURRENCY_OPTIONS;

  const importCategories = useMemo(() => {
    const map = new Map<string, (typeof ALL_CATEGORIES)[number]>();

    [...ALL_CATEGORIES, ...transactions.map((transaction) => transaction.category), ...budgets.map((budget) => budget.category)]
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

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
  ];

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
  const selectedCurrencyCode = (settings.currency || 'ZMW').toUpperCase();

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
        fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
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

      const exportDate = importedData.exportDate ? new Date(importedData.exportDate) : null;
      const exportLabel = exportDate && !Number.isNaN(exportDate.getTime())
        ? exportDate.toLocaleDateString()
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
  const handleBackupToGoogleDrive = async () => {
    try {
      setBackupStatus('backingup');
      setBackupMessage('Preparing Google Drive backup...');

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
        exportDate: exportedAt.toISOString(),
        totalTransactions: transactions.length,
        appVersion: '2.0.0',
        schemaVersion: '2.0',
      };

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
      const backupFileName = `money-manager-drive-backup-${timestamp}.json`;

      await shareFilePayload(
        'Money Manager Drive Backup',
        backupFileName,
        jsonString,
        'application/json',
        'Backup ready. Choose Google Drive to upload the file.',
        () => {
          updateSettings({ lastBackupDate: exportedAt });
          setBackupHistory((previous) => [
            { timestamp: exportedAt.getTime(), filename: backupFileName },
            ...previous,
          ].slice(0, 5));
        }
      );
    } catch (error) {
      console.error('Google Drive backup error:', error);
      setBackupStatus('error');
      setBackupMessage('Backup failed. Please check your connection and try again.');
    }
  };

  const handleRestoreFromGoogleDrive = async () => {
    try {
      Alert.alert(
        'Restore from Google Drive',
        'Download the backup JSON from Google Drive, then use Import JSON to restore it. A file picker is available after installing expo-document-picker.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Import', onPress: () => openImportModal('json') },
        ]
      );
    } catch (error) {
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Restore failed. Please try again.');
    }
  };

  const updateSetting = (key: string, value: any) => {
    if (key === 'darkMode') {
      toggleTheme();
    } else {
      updateSettings({ [key]: value });
    }
  };

  const updatePrivacySetting = (key: string, value: any) => {
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

  const updateSecuritySetting = (key: string, value: any) => {
    const nextValue = key === 'autoLock' ? normalizeAutoLockValue(value) : value;

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

  const handleCurrencySelect = (currencyCode: string) => {
    updateSetting('currency', currencyCode);
    setShowCurrencyPicker(false);
    Alert.alert('Currency Updated', `Currency changed to ${currencyCode}`);
  };

  const handleLanguageSelect = (languageCode: string) => {
    updateSetting('language', languageCode);
    setShowLanguagePicker(false);
    Alert.alert('Language Updated', `Language changed to ${languages.find(l => l.code === languageCode)?.name}`);
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

  const handlePasswordToggle = (value: boolean) => {
    if (value) {
      Alert.prompt(
        'Set App Password',
        'Enter a password to protect your app:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Password',
            onPress: (password?: string) => {
              if (password && password.length >= 4) {
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
    } else {
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
    }
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

  const menuItems: Array<{ icon: typeof Settings; title: string; onPress: () => void; destructive?: boolean }> = [
    {
      icon: Settings,
      title: 'Settings',
      onPress: () => setShowSettings(true),
    },
    {
      icon: HelpCircle,
      title: 'Support',
      onPress: () => setShowHelpSupport(true),
    },
    {
      icon: Moon,
      title: 'Toggle Theme',
      onPress: toggleTheme,
    },
    {
      icon: DollarSign,
      title: 'Currency',
      onPress: () => setShowCurrencyPicker(true),
    },
    {
      icon: Clock,
      title: 'Auto Lock',
      onPress: () => setShowAutoLockPicker(true),
    },
    {
      icon: Download,
      title: 'Export JSON',
      onPress: handleExportData,
    },
    {
      icon: Database,
      title: 'Import JSON',
      onPress: handleImportData,
    },
    {
      icon: Download,
      title: 'Export CSV',
      onPress: handleExportCsv,
    },
    {
      icon: Database,
      title: 'Import CSV',
      onPress: handleImportCsv,
    },
    {
      icon: Download,
      title: 'Drive Backup',
      onPress: handleBackupToGoogleDrive,
    },
    {
      icon: Database,
      title: 'Drive Restore',
      onPress: handleRestoreFromGoogleDrive,
    },
    {
      icon: Mail,
      title: 'Email Support',
      onPress: openEmailSupport,
    },
  ];

  const MENU_GRID_COLUMNS = 3;
  const MENU_GRID_ROWS = Math.max(1, Math.ceil(menuItems.length / MENU_GRID_COLUMNS));
  const MENU_GRID_SIZE = MENU_GRID_COLUMNS * MENU_GRID_ROWS;
  const menuGridItems = [
    ...menuItems,
    ...Array.from({ length: Math.max(0, MENU_GRID_SIZE - menuItems.length) }, () => null),
  ];

  const totalIncome = transactions
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.avatarContainer}>
          <User size={32} color="#667eea" />
        </View>
        <Text style={[styles.name, { color: theme.colors.text }]}>{userProfile.name}</Text>
        <Text style={[styles.email, { color: theme.colors.textSecondary }]}>{userProfile.email}</Text>
        <View style={styles.profileDetails}>
          <View style={styles.profileDetailItem}>
            <MapPin size={12} color="#666" />
            <Text style={[styles.profileDetailText, { color: theme.colors.textSecondary }]}>{userProfile.location}</Text>
          </View>
          <View style={styles.profileDetailItem}>
            <Briefcase size={12} color="#666" />
            <Text style={[styles.profileDetailText, { color: theme.colors.textSecondary }]}>{userProfile.occupation}</Text>
          </View>
          <View style={styles.profileDetailItem}>
            <Calendar size={12} color="#666" />
            <Text style={[styles.profileDetailText, { color: theme.colors.textSecondary }]}>
              Member since {memberSinceDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Card */}
      <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.statsTitle, { color: theme.colors.text }]}>Your Statistics</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{transactions.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Transactions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.incomeText]}>
              {settings.privacy?.hideAmounts ? '***' : formatCurrency(totalIncome)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Income</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.expenseText]}>
              {settings.privacy?.hideAmounts ? '***' : formatCurrency(totalExpenses)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Expenses</Text>
          </View>
        </View>
      </View>

      {/* Menu Section */}
      <View style={[styles.menuSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.menuSectionTitle, { color: theme.colors.text }]}>More</Text>
        <View style={styles.menuGrid}>
          {menuGridItems.map((item, index) => {
            if (!item) {
              return <View key={`placeholder-${index}`} style={styles.menuTilePlaceholder} />;
            }

            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.title}
                style={[
                  styles.menuTile,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  item.destructive && styles.menuTileDestructive,
                ]}
                onPress={item.onPress}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.menuTileIcon,
                    { backgroundColor: item.destructive ? '#F4433620' : theme.colors.primary + '1F' },
                  ]}
                >
                  <IconComponent size={20} color={item.destructive ? '#F44336' : theme.colors.primary} />
                </View>
                <Text
                  style={[styles.menuTileTitle, { color: item.destructive ? '#F44336' : theme.colors.text }]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: theme.colors.textSecondary }]}>Money Manager v1.0.0</Text>
        <Text style={[styles.copyright, { color: theme.colors.textSecondary }]}>Made with Billiat</Text>
      </View>
      
{/* App Settings Modal */}
<Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
  <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
    
    <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
      <TouchableOpacity onPress={() => setShowSettings(false)}>
        <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>
          Done
        </Text>
      </TouchableOpacity>

      <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
        App Settings
      </Text>
                
      <View style={styles.spacer} />
    </View>

    <ScrollView style={styles.modalContent}>

      {/* Notifications Section */}
<View style={styles.settingsSection}>
  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
    Notifications
  </Text>

  <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
    <View style={styles.settingInfo}>
      <Bell size={20} color="#667eea" />

      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
          Push Notifications
        </Text>
        <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
          Receive alerts for transactions
        </Text>
      </View>
    </View>

    <Switch
      value={!!settings.notifications}
      onValueChange={(value) => updateSetting("notifications", value)}
      trackColor={{ false: "#e0e0e0", true: "#667eea" }}
      thumbColor={settings.notifications ? "#fff" : "#f4f3f4"}
      ios_backgroundColor="#e0e0e0"
    />
  </View>
</View>

      {/* Profile */}
      <View style={styles.settingsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Profile
        </Text>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => openSettingsDestination(openEditProfile)}
        >
          <View style={styles.settingInfo}>
            <Edit3 size={20} color="#667eea" />

            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                Edit Profile
              </Text>

              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                Update your personal details
              </Text>
            </View>
          </View>

          <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
            Open
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => openSettingsDestination(() => setShowLanguagePicker(true))}
        >
          <View style={styles.settingInfo}>
            <Globe size={20} color="#667eea" />

            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                Language
              </Text>

              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {languages.find(l => l.code === settings.language)?.name ?? settings.language}
              </Text>
            </View>
          </View>

          <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
            {settings.language?.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Privacy & Backup */}
      <View style={styles.settingsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Privacy & Backup
        </Text>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => openSettingsDestination(() => setShowBackupRestore(true))}
        >
          <View style={styles.settingInfo}>
            <Download size={20} color="#667eea" />

            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                Backup Center
              </Text>

              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                Manage JSON, CSV, and Drive backups (via share sheet)
              </Text>
            </View>
          </View>

          <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
            Open
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => openSettingsDestination(() => setShowPrivacySecurity(true))}
        >
          <View style={styles.settingInfo}>
            <Shield size={20} color="#667eea" />

            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                Privacy
              </Text>

              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                Review privacy and security controls
              </Text>
            </View>
          </View>

          <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
            Open
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => {
            setShowSettings(false);
            setTimeout(handleClearData, 250);
          }}
        >
          <View style={styles.settingInfo}>
            <Trash2 size={20} color="#F44336" />

            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: "#F44336" }]}>
                Clear Data
              </Text>

              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                Permanently delete transactions and accounts
              </Text>
            </View>
          </View>

          <Text style={[styles.settingValue, { color: "#F44336" }]}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>

      {/* Backup */}
      <View style={styles.settingsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Backup
        </Text>

        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingInfo}>
            <Download size={20} color="#667eea" />

            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                Auto Backup
              </Text>

              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                Automatically backup to Google Drive
              </Text>
            </View>
          </View>

          <Switch
            value={!!settings.autoBackup}
            onValueChange={(value) => updateSetting("autoBackup", value)}
            trackColor={{ false: "#e0e0e0", true: "#667eea" }}
            thumbColor={settings.autoBackup ? "#fff" : "#f4f3f4"}
          />
        </View>

        {settings.lastBackupDate && (
          <View style={styles.lastBackupInfo}>
            <Text style={[styles.lastBackupText, { color: theme.colors.textSecondary }]}>
              Last backup: {settings.lastBackupDate.toLocaleDateString()} at{" "}
              {settings.lastBackupDate.toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>

    </ScrollView>
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
        onBackupToGoogleDrive={handleBackupToGoogleDrive}
        onRestoreFromGoogleDrive={handleRestoreFromGoogleDrive}
        backupHistory={backupHistory}
        onRestoreHistoryItem={handleRestoreFromHistoryItem}
      />

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} animationType="slide" transparent={true}>
        <View style={[styles.pickerModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.pickerModal, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Select Currency</Text>
            <ScrollView style={styles.pickerList}>
              {currencies.map((currency) => (
                <TouchableOpacity
                  key={currency.code}
                  style={[styles.pickerItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => handleCurrencySelect(currency.code)}
                >
                  <Text style={[styles.pickerItemText, { color: theme.colors.text }]}>
                    {currency.symbol} {currency.name} ({currency.code})
                  </Text>
                  {selectedCurrencyCode === currency.code && (
                    <CheckCircle size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.pickerCancel, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowCurrencyPicker(false)}
            >
              <Text style={[styles.pickerCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLanguagePicker} animationType="slide" transparent={true}>
        <View style={[styles.pickerModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.pickerModal, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Select Language</Text>
            <ScrollView style={styles.pickerList}>
              {languages.map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[styles.pickerItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => handleLanguageSelect(language.code)}
                >
                  <Text style={[styles.pickerItemText, { color: theme.colors.text }]}>
                    {language.name}
                  </Text>
                  {settings.language === language.code && (
                    <CheckCircle size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.pickerCancel, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowLanguagePicker(false)}
            >
              <Text style={[styles.pickerCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                  ? 'Paste a full Money Manager backup payload to replace the current app data.'
                  : 'Paste CSV with headers. Supported columns include date/timestamp, type, amount or total, description, categoryId/categoryName, accounts, transfer/debt fields, currency, tags, createdAt, and updatedAt.'}
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  statsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  incomeText: {
    color: '#4CAF50',
  },
  expenseText: {
    color: '#F44336',
  },
  menuSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  menuTile: {
    width: '31.8%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  menuTileDestructive: {
    borderColor: '#F4433660',
  },
  menuTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuTileTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  menuTilePlaceholder: {
    width: '31.8%',
    aspectRatio: 1,
    borderRadius: 14,
    opacity: 0,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
  },
  version: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  copyright: {
    fontSize: 12,
    color: '#999',
  },
  profileDetails: {
    marginTop: 12,
    gap: 6,
  },
  profileDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileDetailText: {
    fontSize: 12,
    color: '#666',
  },
  modalContainer: {
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
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  restoreButton: {
    backgroundColor: 'transparent',
  },
  backupButtonText: {
    fontSize: 16,
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
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importFormatButtonText: {
    fontSize: 13,
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


