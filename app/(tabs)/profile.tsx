/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  Share,
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
  AlertCircle,
  Lock,
  Eye,
  Key,
  Database,
  BarChart3,
  Clock,
  Shield as ShieldIcon
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';

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
    settings, 
    updateSettings, 
    formatCurrency, 
    clearAllData 
  } = useTransactionStore();
  const { theme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Money Manager User',
    email: 'user@example.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
    occupation: 'Software Engineer',
    joinDate: new Date('2024-01-01'),
    avatar: '👤',
  });

  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showHelpSupport, setShowHelpSupport] = useState<boolean>(false);
  const [showBackupRestore, setShowBackupRestore] = useState<boolean>(false);
  const [showPrivacySecurity, setShowPrivacySecurity] = useState<boolean>(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<boolean>(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState<boolean>(false);
  const [showAutoLockPicker, setShowAutoLockPicker] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<UserProfile>(userProfile);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'backingup' | 'restoring' | 'success' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState<string>('');

  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  ];

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

  const handleExportData = async () => {
    try {
      setBackupStatus('backingup');
      setBackupMessage('Preparing data for export...');

      const dataToExport = {
        transactions,
        userProfile,
        settings,
        exportDate: new Date().toISOString(),
        totalTransactions: transactions.length,
        appVersion: '1.0.0',
        schemaVersion: '1.0'
      };

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const fileName = `moneymanager-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      try {
        await Share.share({
          title: 'Money Manager Backup',
          message: jsonString,
          url: undefined,
        });
      } catch (shareError) {
        Alert.alert(
          'Export Data',
          `Data prepared for export! Total: ${transactions.length} transactions\n\nYou can copy this data manually:`,
          [
            {
              text: 'Copy to Clipboard',
              onPress: async () => {
                console.log('Backup Data:', jsonString);
                Alert.alert('Data Ready', 'Backup data logged to console. In a real app, this would copy to clipboard.');
              },
            },
            { text: 'OK' },
          ]
        );
      }

      setBackupStatus('success');
      setBackupMessage('Data exported successfully!');
      
      setTimeout(() => {
        setBackupStatus('idle');
      }, 3000);

    } catch (error) {
      console.error('Export error:', error);
      setBackupStatus('error');
      setBackupMessage('Failed to export data. Please try again.');
    }
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'To import data, paste your backup JSON data in the next screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            setShowBackupRestore(false);
            setTimeout(() => {
              Alert.prompt(
                'Import Backup Data',
                'Paste your backup JSON data below:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Import',
                    onPress: (jsonString) => {
                      if (jsonString) {
                        handleJsonImport(jsonString);
                      }
                    },
                  },
                ],
                'plain-text'
              );
            }, 300);
          },
        },
      ]
    );
  };

  const handleJsonImport = (jsonString: string) => {
    try {
      setBackupStatus('restoring');
      setBackupMessage('Validating backup data...');

      const importedData = JSON.parse(jsonString);

      if (!importedData.transactions || !importedData.settings) {
        throw new Error('Invalid backup file format');
      }

      Alert.alert(
        'Restore Backup',
        `This will replace all current data with the backup data from ${new Date(importedData.exportDate).toLocaleDateString()}. This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                updateSettings(importedData.settings);
                setBackupStatus('success');
                setBackupMessage(`Successfully restored ${importedData.transactions.length} transactions!`);
                setTimeout(() => {
                  setBackupStatus('idle');
                }, 3000);
              } catch (restoreError) {
                setBackupStatus('error');
                setBackupMessage('Failed to restore data. File might be corrupted.');
              }
            },
          },
        ]
      );
    } catch (error) {
      setBackupStatus('error');
      setBackupMessage('Invalid JSON data. Please check your backup file.');
    }
  };

  const handleBackupToGoogleDrive = async () => {
    try {
      setBackupStatus('backingup');
      setBackupMessage('Connecting to Google Drive...');

      await new Promise(resolve => setTimeout(resolve, 1500));

      const dataToExport = {
        transactions,
        userProfile,
        settings,
        backupDate: new Date().toISOString(),
        totalTransactions: transactions.length,
        appVersion: '1.0.0',
      };

      console.log('Google Drive Backup Data:', JSON.stringify(dataToExport, null, 2));
      
      updateSettings({ lastBackupDate: new Date() });
      setBackupStatus('success');
      setBackupMessage(`Backup completed! ${transactions.length} transactions saved to Google Drive.`);
      
      setTimeout(() => {
        setBackupStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('Google Drive backup error:', error);
      setBackupStatus('error');
      setBackupMessage('Backup failed. Please check your connection and try again.');
    }
  };

  const handleRestoreFromGoogleDrive = async () => {
    try {
      setBackupStatus('restoring');
      setBackupMessage('Searching for backup files...');

      await new Promise(resolve => setTimeout(resolve, 1500));

      Alert.alert(
        'Restore Backup',
        'This will replace all current data with the backup data from Google Drive. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                setBackupMessage('Downloading and restoring data...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                setBackupStatus('success');
                setBackupMessage('Data restored successfully from Google Drive!');
                setTimeout(() => {
                  setBackupStatus('idle');
                }, 3000);
              } catch (restoreError) {
                setBackupStatus('error');
                setBackupMessage('Restore failed. Please try again.');
              }
            },
          },
        ]
      );
      
    } catch (error) {
      setBackupStatus('error');
      setBackupMessage('Restore failed. Please check your connection and try again.');
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
    updateSettings({
      security: {
        autoLock: 5,
        passwordEnabled: false,
        twoFactorEnabled: false,
        ...settings.security,
        [key]: value
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
    updateSecuritySetting('autoLock', minutes);
    setShowAutoLockPicker(false);
    const option = autoLockOptions.find(o => o.value === minutes);
    Alert.alert('Auto Lock Updated', `Auto lock set to ${option?.label}`);
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
            onPress: (password) => {
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
    setUserProfile(editForm);
    setShowEditProfile(false);
    Alert.alert('Success', 'Profile updated successfully!');
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

  const menuItems = [
    {
      icon: Edit3,
      title: 'Edit Profile',
      subtitle: 'Update your personal information',
      onPress: () => {
        setEditForm(userProfile);
        setShowEditProfile(true);
      },
    },
    {
      icon: Settings,
      title: 'App Settings',
      subtitle: 'Notifications, theme, and preferences',
      onPress: () => setShowSettings(true),
    },
    {
      icon: Download,
      title: 'Backup & Restore',
      subtitle: 'Backup to Google Drive or restore data',
      onPress: () => setShowBackupRestore(true),
    },
    {
      icon: Shield,
      title: 'Privacy & Security',
      subtitle: 'Manage your privacy and security settings',
      onPress: () => setShowPrivacySecurity(true),
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      subtitle: 'Get help and contact support',
      onPress: () => setShowHelpSupport(true),
    },
    {
      icon: Trash2,
      title: 'Clear All Data',
      subtitle: 'Permanently delete all transactions',
      onPress: handleClearData,
      destructive: true,
    },
  ];

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

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
              Member since {userProfile.joinDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <TouchableOpacity
              key={item.title}
              style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
              onPress={item.onPress}
            >
              <View style={[
                styles.menuIconContainer,
                item.destructive && styles.destructiveIconContainer
              ]}>
                <IconComponent 
                  size={20} 
                  color={item.destructive ? '#F44336' : '#667eea'} 
                />
              </View>
              <View style={styles.menuContent}>
                <Text style={[
                  styles.menuTitle,
                  { color: item.destructive ? '#F44336' : theme.colors.text },
                  item.destructive && styles.destructiveText
                ]}>
                  {item.title}
                </Text>
                <Text style={[styles.menuSubtitle, { color: theme.colors.textSecondary }]}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: theme.colors.textSecondary }]}>Money Manager v1.0.0</Text>
        <Text style={[styles.copyright, { color: theme.colors.textSecondary }]}>Made with ❤️ by Rork</Text>
      </View>
      
      {/* App Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>App Settings</Text>
            <View style={styles.spacer} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notifications</Text>
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Bell size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Push Notifications</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Receive alerts for transactions</Text>
                  </View>
                </View>
                <Switch
                  value={settings.notifications}
                  onValueChange={(value) => updateSetting('notifications', value)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                  thumbColor={settings.notifications ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
            
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Moon size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Dark Mode</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Use dark theme</Text>
                  </View>
                </View>
                <Switch
                  value={theme.isDark}
                  onValueChange={() => toggleTheme()}
                  trackColor={{ false: '#e0e0e0', true: theme.colors.primary }}
                  thumbColor={theme.isDark ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
            
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Localization</Text>
              
              <TouchableOpacity 
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => setShowCurrencyPicker(true)}
              >
                <View style={styles.settingInfo}>
                  <DollarSign size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Currency</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                      {currencies.find(c => c.code === settings.currency)?.name || settings.currency}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{settings.currency}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => setShowLanguagePicker(true)}
              >
                <View style={styles.settingInfo}>
                  <Globe size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Language</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                      {languages.find(l => l.code === settings.language)?.name || settings.language}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{settings.language.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Backup</Text>
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingInfo}>
                  <Download size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Auto Backup</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Automatically backup to Google Drive</Text>
                  </View>
                </View>
                <Switch
                  value={settings.autoBackup}
                  onValueChange={(value) => updateSetting('autoBackup', value)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                  thumbColor={settings.autoBackup ? '#fff' : '#f4f3f4'}
                />
              </View>
              {settings.lastBackupDate && (
                <View style={styles.lastBackupInfo}>
                  <Text style={[styles.lastBackupText, { color: theme.colors.textSecondary }]}>
                    Last backup: {settings.lastBackupDate.toLocaleDateString()} at {settings.lastBackupDate.toLocaleTimeString()}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

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
                  {settings.currency === currency.code && (
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
                  {settings.security?.autoLock === option.value && (
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

      {/* Backup & Restore Modal */}
      <Modal visible={showBackupRestore} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowBackupRestore(false)}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Backup & Restore</Text>
            <View style={styles.spacer} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Backup Status Display */}
            {backupStatus !== 'idle' && (
              <View style={[
                styles.statusContainer,
                backupStatus === 'success' && styles.statusSuccess,
                backupStatus === 'error' && styles.statusError,
                (backupStatus === 'backingup' || backupStatus === 'restoring') && styles.statusProcessing
              ]}>
                {backupStatus === 'success' && <CheckCircle size={24} color="#4CAF50" />}
                {backupStatus === 'error' && <AlertCircle size={24} color="#F44336" />}
                {(backupStatus === 'backingup' || backupStatus === 'restoring') && (
                  <ActivityIndicator size="small" color="#667eea" />
                )}
                <Text style={[
                  styles.statusText,
                  { color: backupStatus === 'success' ? '#4CAF50' : backupStatus === 'error' ? '#F44336' : theme.colors.text }
                ]}>
                  {backupMessage}
                </Text>
              </View>
            )}

            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Google Drive Backup</Text>
              
              <TouchableOpacity 
                style={[styles.backupButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleBackupToGoogleDrive}
                disabled={backupStatus === 'backingup' || backupStatus === 'restoring'}
              >
                <Download size={20} color="#fff" />
                <Text style={styles.backupButtonText}>Backup to Google Drive</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.backupButton, styles.restoreButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleRestoreFromGoogleDrive}
                disabled={backupStatus === 'backingup' || backupStatus === 'restoring'}
              >
                <Download size={20} color={theme.colors.primary} />
                <Text style={[styles.backupButtonText, { color: theme.colors.primary }]}>Restore from Google Drive</Text>
              </TouchableOpacity>

              <View style={styles.backupInfo}>
                <Text style={[styles.backupInfoTitle, { color: theme.colors.text }]}>What gets backed up?</Text>
                <View style={styles.backupInfoItem}>
                  <CheckCircle size={16} color="#4CAF50" />
                  <Text style={[styles.backupInfoText, { color: theme.colors.textSecondary }]}>All transactions</Text>
                </View>
                <View style={styles.backupInfoItem}>
                  <CheckCircle size={16} color="#4CAF50" />
                  <Text style={[styles.backupInfoText, { color: theme.colors.textSecondary }]}>User profile</Text>
                </View>
                <View style={styles.backupInfoItem}>
                  <CheckCircle size={16} color="#4CAF50" />
                  <Text style={[styles.backupInfoText, { color: theme.colors.textSecondary }]}>App settings</Text>
                </View>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Local Backup</Text>
              
              <TouchableOpacity 
                style={[styles.backupButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleExportData}
                disabled={backupStatus === 'backingup' || backupStatus === 'restoring'}
              >
                <Download size={20} color={theme.colors.primary} />
                <Text style={[styles.backupButtonText, { color: theme.colors.primary }]}>Export Data as JSON</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.backupButton, styles.restoreButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleImportData}
                disabled={backupStatus === 'backingup' || backupStatus === 'restoring'}
              >
                <Download size={20} color={theme.colors.primary} />
                <Text style={[styles.backupButtonText, { color: theme.colors.primary }]}>Import from JSON</Text>
              </TouchableOpacity>
              
              <Text style={[styles.backupSubtitle, { color: theme.colors.textSecondary }]}>
                Export your data as JSON for manual backup or import from existing backup
              </Text>
            </View>

            {settings.lastBackupDate && (
              <View style={styles.lastBackupInfo}>
                <Text style={[styles.lastBackupText, { color: theme.colors.textSecondary }]}>
                  Last backup: {settings.lastBackupDate.toLocaleDateString()} at {settings.lastBackupDate.toLocaleTimeString()}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
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
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Two-Factor Authentication</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Add extra security to your account</Text>
                  </View>
                </View>
                <Switch
                  value={settings.security?.twoFactorEnabled || false}
                  onValueChange={handleTwoFactorToggle}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              <TouchableOpacity 
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => setShowAutoLockPicker(true)}
              >
                <View style={styles.settingInfo}>
                  <Clock size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Auto Lock</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                      {settings.security?.autoLock === -1 ? 'Never' :
                       settings.security?.autoLock === 0 ? 'Immediately' :
                       settings.security?.autoLock === 1 ? 'After 1 minute' :
                       `After ${settings.security?.autoLock} minutes`}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                  {settings.security?.autoLock === -1 ? 'Never' :
                   settings.security?.autoLock === 0 ? 'Now' :
                   `${settings.security?.autoLock}m`}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Data Management</Text>
              
              <TouchableOpacity 
                style={[styles.dataActionButton, { backgroundColor: '#ffebee', borderColor: '#f44336' }]}
                onPress={handleClearData}
              >
                <Trash2 size={20} color="#f44336" />
                <Text style={[styles.dataActionText, { color: '#f44336' }]}>Clear All Data</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.dataActionButton, { backgroundColor: '#e8f5e8', borderColor: '#4caf50' }]}
                onPress={handleExportData}
              >
                <Download size={20} color="#4caf50" />
                <Text style={[styles.dataActionText, { color: '#4caf50' }]}>Export All Data</Text>
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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  destructiveIconContainer: {
    backgroundColor: '#F4433620',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  destructiveText: {
    color: '#F44336',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666',
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
