import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Download,
  Shield,
  Edit3,
  Globe,
  Moon,
  Trash2,
  Bell,
  Clock,
  DollarSign,
  FileText,
  Zap,
  HelpCircle,
  CheckCircle,
  Search,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { formatDateTimeWithWeekday } from '@/utils/date';
import { useI18n } from '@/src/i18n';
import type { CurrencyOption } from '@/constants/currencies';
import type { SupportedLanguageOption } from '@/constants/languages';
import type { ThemeMode } from '@/store/theme-store';
import type { AppNotificationPermissionState } from '@/src/notifications/quick-add-notification';
import { showAppTooltip } from '@/store/app-tooltip-store';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  settings: any;
  updateSettings: (settings: any) => void;
  openEditProfile: () => void;
  themeMode: ThemeMode;
  systemTheme: 'light' | 'dark' | null;
  setThemeMode: (mode: ThemeMode) => void;
  onClearData: () => void;
  onBackupRestore: () => void;
  onOpenPcManager: () => void;
  onPrivacySecurity: () => void;
  onHelpSupport: () => void;
  userProfile: any;
  driveConnected?: boolean;
  driveAccountLabel?: string;
  googleDriveAvailable?: boolean;
  googleDriveUnavailableReason?: string;
  currencies: CurrencyOption[];
  languages: SupportedLanguageOption[];
  onShowAutoLockPicker: () => void;
  onExportTransactions: () => void;
  onQuickAddToggle: (value: boolean) => void | Promise<void>;
  onDailyReminderToggle: (value: boolean) => void | Promise<void>;
  onAutoBackupToggle: (value: boolean) => void | Promise<void>;
  notificationPermissionGranted: boolean;
  notificationPermissionState: AppNotificationPermissionState;
  onEnableNotifications: () => void | Promise<void>;
  reminderTimeLabel: string;
  onShowReminderTimePicker: () => void;
}

type InlinePickerTarget = 'appearance' | null;
type SelectorTarget = 'currency' | 'language' | null;
type SelectorItem = CurrencyOption | SupportedLanguageOption;

function formatCurrencyValue(currency?: Pick<CurrencyOption, 'code' | 'symbol'> | null): string {
  if (!currency) {
    return '';
  }

  return `${currency.code.toUpperCase()} - ${currency.symbol}`;
}

function getSelectorBadgeLabel(value: string | undefined, fallback: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return fallback;
  }

  return normalizedValue.length <= 4 ? normalizedValue : fallback;
}

function getAutoLockLabel(value: number | undefined, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (value === -1) {
    return t('autoLock.never');
  }

  if (value === 0) {
    return t('autoLock.immediately');
  }

  if (value === 1) {
    return t('autoLock.after1Minute');
  }

  return t('autoLock.afterMinutes', { minutes: value ?? 5 });
}

export function SettingsModal({
  visible,
  onClose,
  theme,
  settings,
  updateSettings,
  openEditProfile,
  themeMode,
  systemTheme,
  setThemeMode,
  onClearData,
  onBackupRestore,
  onOpenPcManager,
  onPrivacySecurity,
  onHelpSupport,
  userProfile,
  driveConnected,
  driveAccountLabel,
  googleDriveAvailable = true,
  googleDriveUnavailableReason,
  currencies,
  languages,
  onShowAutoLockPicker,
  onExportTransactions,
  onQuickAddToggle,
  onDailyReminderToggle,
  onAutoBackupToggle,
  notificationPermissionGranted,
  notificationPermissionState,
  onEnableNotifications,
  reminderTimeLabel,
  onShowReminderTimePicker,
}: SettingsModalProps) {
  const [activePicker, setActivePicker] = useState<InlinePickerTarget>(null);
  const [selectorTarget, setSelectorTarget] = useState<SelectorTarget>(null);
  const [selectorQuery, setSelectorQuery] = useState('');
  const { t } = useI18n();

  const updateSetting = (key: string, value: any) => {
    updateSettings({ [key]: value });
  };

  const selectedLanguageCode = (settings.language ?? languages[0]?.code ?? 'en').toLowerCase();
  const selectedLanguage = useMemo(
    () => languages.find((language) => language.code.toLowerCase() === selectedLanguageCode) ?? languages[0] ?? null,
    [languages, selectedLanguageCode]
  );
  const selectedLanguageLabel = selectedLanguage?.name ?? 'English';
  const selectedCurrencyCode = (settings.currency ?? 'ZMW').toUpperCase();
  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.code.toUpperCase() === selectedCurrencyCode) ?? null,
    [currencies, selectedCurrencyCode]
  );
  const autoLockLabel = getAutoLockLabel(settings.security?.autoLock, t);
  const systemThemeLabel = systemTheme === 'dark' ? 'Dark' : 'Light';
  const selectedAppearanceModeLabel = themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light';
  const selectedAppearanceLabel = themeMode === 'system'
    ? `System (${systemThemeLabel})`
    : selectedAppearanceModeLabel;
  const pickerBackground = theme.isDark ? '#111827' : '#FFFFFF';
  const pickerHighlight = theme.isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC';
  const subtleSurface = theme.isDark ? 'rgba(15,23,42,0.72)' : '#F8FAFC';
  const selectorPlaceholderColor = theme.isDark ? '#64748B' : '#94A3B8';
  const selectorTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotificationPermissionPrompt = !notificationPermissionGranted && notificationPermissionState !== 'unsupported';
  const notificationPermissionPromptText = notificationPermissionState === 'denied'
    ? Platform.OS !== 'web'
      ? 'Allow notifications in device settings so reminders and quick actions can work.'
      : 'Allow browser notifications. Daily reminders remain available on mobile.'
    : Platform.OS !== 'web'
      ? 'Enable notifications before turning on quick add and daily reminders.'
      : 'Enable browser notifications. Daily reminders remain available on mobile.';
  const quickAddSubtitle = Platform.OS === 'web'
    ? 'Notification shortcuts are available on Android and iOS.'
    : !notificationPermissionGranted
      ? 'Enable notifications first to turn on Quick Add shortcuts.'
      : t('settings.quickAdd.subtitle');
  const dailyReminderSubtitle = Platform.OS === 'web'
    ? 'Scheduled reminders are available on Android and iOS.'
    : !notificationPermissionGranted
      ? 'Enable notifications first to turn on daily reminders.'
      : t('settings.dailyReminder.subtitle');
  const backupCenterSubtitle = !googleDriveAvailable
    ? googleDriveUnavailableReason ?? 'Google Drive automation is unavailable in this build.'
    : driveConnected
      ? driveAccountLabel ?? 'Google Drive connected'
      : t('settings.backupCenter.subtitle');
  const backupCenterValue = !googleDriveAvailable ? 'Unavailable' : driveConnected ? 'Drive' : 'Setup';
  const autoBackupSubtitle = !googleDriveAvailable
    ? googleDriveUnavailableReason ?? 'Google Drive automation is unavailable in this build.'
    : driveConnected
      ? t('settings.autoBackup.subtitle')
      : 'Connect Google Drive in Backup Center first.';
  const autoRestoreValue = !googleDriveAvailable ? 'Unavailable' : driveConnected ? 'Ready' : 'Needs Drive';
  const automationSummaryText = settings.lastBackupDate
    ? t('settings.lastBackup', { date: formatDateTimeWithWeekday(new Date(settings.lastBackupDate)) })
    : !googleDriveAvailable
      ? googleDriveUnavailableReason ?? 'Google Drive automation is unavailable in this build.'
      : settings.autoBackup
        ? 'Automatic backups are on and will sync your next changes.'
        : driveConnected
          ? 'Automatic restore is ready when the app opens with no local data.'
          : 'Connect Google Drive to enable automatic backup and restore.';

  const userInitials = useMemo(() => {
    const source = userProfile?.name?.trim() || t('settings.title');
    return (
      source
        .split(/\s+/)
        .slice(0, 2)
        .map((part: string) => part.charAt(0).toUpperCase())
        .join('') || 'MM'
    );
  }, [t, userProfile?.name]);

  useEffect(() => {
    if (visible) {
      return;
    }

    setActivePicker(null);
    setSelectorTarget(null);
    setSelectorQuery('');
  }, [visible]);

  useEffect(() => {
    return () => {
      if (selectorTooltipTimeoutRef.current) {
        clearTimeout(selectorTooltipTimeoutRef.current);
      }
    };
  }, []);

  const toggleInlinePicker = (target: Exclude<InlinePickerTarget, null>) => {
    setSelectorTarget(null);
    setSelectorQuery('');
    setActivePicker((current) => (current === target ? null : target));
  };

  const openSelector = (target: Exclude<SelectorTarget, null>) => {
    setActivePicker(null);
    setSelectorQuery('');
    setSelectorTarget(target);
  };

  const closeSelector = () => {
    setSelectorTarget(null);
    setSelectorQuery('');
  };

  const showSelectorTooltip = (payload: { title: string; message: string }) => {
    if (selectorTooltipTimeoutRef.current) {
      clearTimeout(selectorTooltipTimeoutRef.current);
    }

    selectorTooltipTimeoutRef.current = setTimeout(() => {
      showAppTooltip({
        tone: 'success',
        title: payload.title,
        message: payload.message,
      });
      selectorTooltipTimeoutRef.current = null;
    }, 180);
  };

  const normalizedSelectorQuery = selectorQuery.trim().toLowerCase();
  const filteredCurrencies = useMemo(() => {
    if (!normalizedSelectorQuery) {
      return currencies;
    }

    return currencies.filter((currency) => {
      const searchableValue = [currency.code, currency.name, currency.symbol, currency.region].join(' ').toLowerCase();
      return searchableValue.includes(normalizedSelectorQuery);
    });
  }, [currencies, normalizedSelectorQuery]);

  const filteredLanguages = useMemo(() => {
    if (!normalizedSelectorQuery) {
      return languages;
    }

    return languages.filter((language) => {
      const searchableValue = [language.code, language.name, language.englishName ?? ''].join(' ').toLowerCase();
      return searchableValue.includes(normalizedSelectorQuery);
    });
  }, [languages, normalizedSelectorQuery]);

  const sortedCurrencies = useMemo(
    () => [...filteredCurrencies].sort((left, right) => {
      const leftSelected = left.code.toUpperCase() === selectedCurrencyCode;
      const rightSelected = right.code.toUpperCase() === selectedCurrencyCode;
      if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1;
      }

      if (!!left.isDefault !== !!right.isDefault) {
        return left.isDefault ? -1 : 1;
      }

      const regionCompare = left.region.localeCompare(right.region);
      if (regionCompare !== 0) {
        return regionCompare;
      }

      return left.name.localeCompare(right.name);
    }),
    [filteredCurrencies, selectedCurrencyCode]
  );

  const sortedLanguages = useMemo(
    () => [...filteredLanguages].sort((left, right) => {
      const leftSelected = left.code.toLowerCase() === selectedLanguageCode;
      const rightSelected = right.code.toLowerCase() === selectedLanguageCode;
      if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    }),
    [filteredLanguages, selectedLanguageCode]
  );

  const selectorItems: SelectorItem[] = selectorTarget === 'currency' ? sortedCurrencies : sortedLanguages;

  const quickActions = [
    { key: 'profile', title: 'Profile', Icon: Edit3, color: '#6366F1', onPress: openEditProfile },
    { key: 'pc_manager', title: 'PC Manager', Icon: Globe, color: '#2563EB', onPress: onOpenPcManager },
    { key: 'backup', title: 'Backup', Icon: Download, color: '#0EA5E9', onPress: onBackupRestore },
    { key: 'export', title: 'Export', Icon: FileText, color: '#F97316', onPress: onExportTransactions },
    { key: 'privacy', title: 'Privacy', Icon: Shield, color: '#14B8A6', onPress: onPrivacySecurity },
    { key: 'help', title: 'Help', Icon: HelpCircle, color: '#F59E0B', onPress: onHelpSupport },
  ];

  const handleCurrencySelect = (currencyCode: string) => {
    const normalizedCurrencyCode = currencyCode.toUpperCase();
    const currencyName = currencies.find((currency) => currency.code.toUpperCase() === normalizedCurrencyCode)?.name ?? normalizedCurrencyCode;
    updateSettings({ currency: normalizedCurrencyCode });
    closeSelector();
    showSelectorTooltip({
      title: t('settings.currency.title'),
      message: t('settings.currencyUpdated', { code: `${normalizedCurrencyCode} (${currencyName})` }),
    });
  };

  const handleLanguageSelect = (languageCode: string) => {
    const normalizedLanguageCode = languageCode.toLowerCase();
    const languageName = languages.find((language) => language.code.toLowerCase() === normalizedLanguageCode)?.name ?? normalizedLanguageCode.toUpperCase();
    updateSettings({ language: normalizedLanguageCode });
    closeSelector();
    showSelectorTooltip({
      title: t('settings.language.title'),
      message: t('settings.languageUpdated', { name: languageName }),
    });
  };

  const handleAppearanceSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    setActivePicker(null);
    showAppTooltip({
      tone: 'success',
      title: 'Appearance',
      message:
        mode === 'system'
          ? `Appearance now follows your device (${systemThemeLabel}).`
          : `${mode === 'dark' ? 'Dark' : 'Light'} mode enabled.`,
    });
  };

  const renderAppearancePicker = () => {
    if (activePicker !== 'appearance') {
      return null;
    }

    const appearanceOptions: Array<{ key: ThemeMode; label: string; hint: string }> = [
      { key: 'system', label: 'System', hint: `Currently ${systemThemeLabel}` },
      { key: 'light', label: 'Light', hint: 'Always use the light theme' },
      { key: 'dark', label: 'Dark', hint: 'Always use the dark theme' },
    ];

    return (
      <View style={[styles.inlinePicker, { backgroundColor: pickerBackground, borderColor: theme.colors.border }]}> 
        <View style={[styles.inlinePickerArrow, { backgroundColor: pickerBackground, borderColor: theme.colors.border }]} />
        <View style={styles.inlinePickerList}>
          {appearanceOptions.map((option, index) => {
            const isSelected = themeMode === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.inlinePickerItem,
                  index < appearanceOptions.length - 1 && { borderBottomColor: theme.colors.border },
                  isSelected && { backgroundColor: pickerHighlight },
                ]}
                onPress={() => handleAppearanceSelect(option.key)}
                activeOpacity={0.85}
              >
                <View style={styles.inlinePickerTextWrap}>
                  <Text style={[styles.inlinePickerPrimary, { color: theme.colors.text }]}>{option.label}</Text>
                  <Text style={[styles.inlinePickerSecondary, { color: theme.colors.textSecondary }]}>{option.hint}</Text>
                </View>
                {isSelected ? <CheckCircle size={18} color={theme.colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSelectorModal = () => {
    if (!selectorTarget) {
      return null;
    }

    const isCurrencySelector = selectorTarget === 'currency';
    const items = selectorItems;
    const title = isCurrencySelector ? t('settings.currency.title') : t('settings.language.title');
    const subtitle = isCurrencySelector
      ? 'Search by name, code, symbol, or region'
      : 'Search by language name or code';

    return (
      <Modal
        transparent
        visible
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeSelector}
      >
        <View style={styles.selectorOverlay}>
          <Pressable style={styles.selectorBackdrop} onPress={closeSelector} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.selectorKeyboardAvoider}
          >
            <View style={[styles.selectorCard, { backgroundColor: pickerBackground, borderColor: theme.colors.border }]}> 
              <View style={[styles.selectorHeader, { borderBottomColor: theme.colors.border }]}> 
                <View style={styles.selectorHeaderTextWrap}>
                  <Text style={[styles.selectorTitle, { color: theme.colors.text }]}>{title}</Text>
                  <Text style={[styles.selectorSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
                </View>
                <TouchableOpacity style={styles.selectorCloseButton} onPress={closeSelector} activeOpacity={0.8}>
                  <X size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.selectorSearchWrap, { borderBottomColor: theme.colors.border }]}> 
                <View style={[styles.selectorSearchInputWrap, { backgroundColor: pickerHighlight, borderColor: theme.colors.border }]}> 
                  <Search size={16} color={theme.colors.textSecondary} />
                  <TextInput
                    value={selectorQuery}
                    onChangeText={setSelectorQuery}
                    placeholder={isCurrencySelector ? 'Search currencies, codes, or regions' : 'Search languages'}
                    placeholderTextColor={selectorPlaceholderColor}
                    style={[styles.selectorSearchInput, { color: theme.colors.text }]}
                    autoCorrect={false}
                    autoCapitalize="none"
                    keyboardAppearance={theme.isDark ? 'dark' : 'light'}
                    returnKeyType="search"
                  />
                </View>
              </View>

              {items.length === 0 ? (
                <View style={styles.selectorEmptyState}>
                  <Text style={[styles.selectorEmptyTitle, { color: theme.colors.text }]}>Nothing matched</Text>
                  <Text style={[styles.selectorEmptySubtitle, { color: theme.colors.textSecondary }]}> 
                    Try a different code or keyword.
                  </Text>
                </View>
              ) : (
                <FlatList<SelectorItem>
                  data={items}
                  keyExtractor={(item) => item.code}
                  style={styles.selectorList}
                  contentContainerStyle={styles.selectorListContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  renderItem={({ item }) => {
                    const key = item.code;
                    const isSelected = isCurrencySelector
                      ? selectedCurrencyCode === item.code.toUpperCase()
                      : selectedLanguageCode === item.code.toLowerCase();
                    const currencyItem = isCurrencySelector ? (item as CurrencyOption) : null;
                    const languageItem = !isCurrencySelector ? (item as SupportedLanguageOption) : null;
                    const badgeLabel = currencyItem
                      ? getSelectorBadgeLabel(currencyItem.symbol, currencyItem.code.toUpperCase())
                      : item.code.toUpperCase();
                    const primary = item.name;
                    const secondary = currencyItem
                      ? `${currencyItem.code.toUpperCase()} - ${currencyItem.region} - ${currencyItem.symbol}`
                      : `${item.code.toUpperCase()}${languageItem?.englishName && languageItem.englishName !== languageItem.name ? ` - ${languageItem.englishName}` : ''}`;

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.selectorItem,
                          { borderBottomColor: theme.colors.border },
                          isSelected && { backgroundColor: pickerHighlight },
                        ]}
                        onPress={() => {
                          if (isCurrencySelector) {
                            handleCurrencySelect(item.code);
                          } else {
                            handleLanguageSelect(item.code);
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={styles.selectorItemMain}>
                          <View
                            style={[
                              styles.selectorItemBadge,
                              {
                                backgroundColor: isSelected ? theme.colors.primary + '18' : pickerHighlight,
                                borderColor: isSelected ? theme.colors.primary + '34' : theme.colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.selectorItemBadgeText,
                                { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                              ]}
                            >
                              {badgeLabel}
                            </Text>
                          </View>
                          <View style={styles.selectorItemTextWrap}>
                            <Text style={[styles.selectorItemTitle, { color: theme.colors.text }]} numberOfLines={1}>{primary}</Text>
                            <Text style={[styles.selectorItemSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>{secondary}</Text>
                          </View>
                        </View>
                        {isSelected ? (
                          <CheckCircle size={18} color={theme.colors.primary} />
                        ) : (
                          <ChevronRight size={16} color={theme.colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}> 
          <View style={styles.modalHeaderTextWrap}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('settings.title')}</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>Cleaner controls and faster access</Text>
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={[styles.doneButtonText, { color: theme.colors.text }]}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={activePicker === null && selectorTarget === null}
          contentContainerStyle={styles.modalContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.settingsHero}>
            <View style={styles.settingsHeroTop}>
              <View style={[styles.settingsAvatar, { backgroundColor: theme.colors.primary + '18' }]}> 
                <Text style={[styles.settingsAvatarText, { color: theme.colors.primary }]}>{userInitials}</Text>
              </View>
              <View style={styles.settingsHeroTextWrap}>
                <Text style={[styles.settingsHeroTitle, { color: theme.colors.text }]}>{userProfile?.name?.trim() || t('settings.title')}</Text>
                <Text style={[styles.settingsHeroSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {userProfile?.email?.trim() || 'Manage preferences, privacy, and backups.'}
                </Text>
              </View>
            </View>
            <View style={styles.settingsMetaRow}>
              <View style={[styles.settingsMetaChip, { backgroundColor: subtleSurface, borderColor: theme.colors.border }]}>
                <Text style={[styles.settingsMetaLabel, { color: theme.colors.textSecondary }]}>Currency</Text>
                <Text style={[styles.settingsMetaValue, { color: theme.colors.text }]}>{formatCurrencyValue(selectedCurrency) || selectedCurrencyCode}</Text>
              </View>
              <View style={[styles.settingsMetaChip, { backgroundColor: subtleSurface, borderColor: theme.colors.border }]}>
                <Text style={[styles.settingsMetaLabel, { color: theme.colors.textSecondary }]}>Language</Text>
                <Text style={[styles.settingsMetaValue, { color: theme.colors.text }]}>{selectedLanguage?.name ?? selectedLanguageCode.toUpperCase()}</Text>
              </View>
              <View style={[styles.settingsMetaChip, { backgroundColor: subtleSurface, borderColor: theme.colors.border }]}>
                <Text style={[styles.settingsMetaLabel, { color: theme.colors.textSecondary }]}>Theme</Text>
                <Text style={[styles.settingsMetaValue, { color: theme.colors.text }]}>{selectedAppearanceModeLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.textSecondary }]}>Quick Access</Text>
            <View style={styles.quickActionGrid}>
              {quickActions.map((action) => {
                const Icon = action.Icon;
                return (
                  <TouchableOpacity key={action.key} style={styles.quickActionItem} onPress={action.onPress} activeOpacity={0.85}>
                    <View style={[styles.quickActionIconWrap, { backgroundColor: action.color + '18' }]}> 
                      <Icon size={18} color={action.color} />
                    </View>
                    <Text style={[styles.quickActionTitle, { color: theme.colors.text }]} numberOfLines={2}>
                      {action.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notifications & Reminders</Text>
            <View style={styles.settingsList}>
              {showNotificationPermissionPrompt ? (
                <TouchableOpacity
                  style={[
                    styles.notificationPermissionPanel,
                    {
                      borderColor: theme.colors.primary + '26',
                      backgroundColor: theme.colors.primary + '0F',
                    },
                  ]}
                  onPress={onEnableNotifications}
                  activeOpacity={0.85}
                >
                  <View style={styles.notificationPermissionPanelInfo}>
                    <View style={[styles.notificationPermissionPanelIcon, { backgroundColor: theme.colors.primary + '18' }]}>
                      <Bell size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.notificationPermissionPanelTextWrap}>
                      <Text style={[styles.notificationPermissionPanelTitle, { color: theme.colors.text }]}>Enable notifications</Text>
                      <Text style={[styles.notificationPermissionPanelSubtitle, { color: theme.colors.textSecondary }]}>{notificationPermissionPromptText}</Text>
                    </View>
                  </View>
                  <View style={[styles.notificationPermissionPanelButton, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.notificationPermissionPanelButtonText}>Enable</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
                <View style={styles.settingInfo}>
                  <Bell size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.budgetAlerts.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.budgetAlerts.subtitle')}</Text>
                  </View>
                </View>
                <Switch
                  value={!!settings.notifications}
                  onValueChange={(value) => updateSetting('notifications', value)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
                <View style={styles.settingInfo}>
                  <Zap size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.quickAdd.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{quickAddSubtitle}</Text>
                  </View>
                </View>
                <Switch
                  value={!!settings.quickAddNotificationEnabled}
                  onValueChange={onQuickAddToggle}
                  disabled={Platform.OS === 'web' || !notificationPermissionGranted}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
                <View style={styles.settingInfo}>
                  <Bell size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.dailyReminder.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{dailyReminderSubtitle}</Text>
                  </View>
                </View>
                <Switch
                  value={!!settings.dailyReminderEnabled}
                  onValueChange={onDailyReminderToggle}
                  disabled={Platform.OS === 'web' || !notificationPermissionGranted}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>

              {settings.dailyReminderEnabled && Platform.OS !== 'web' && notificationPermissionGranted ? (
                <TouchableOpacity
                  style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                  onPress={onShowReminderTimePicker}
                  activeOpacity={0.8}
                >
                  <View style={styles.settingInfo}>
                    <Clock size={20} color="#667eea" />
                    <View style={styles.settingText}>
                      <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.reminderTime.title')}</Text>
                      <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.reminderTime.subtitle')}</Text>
                    </View>
                  </View>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{reminderTimeLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Preferences</Text>
            <View style={styles.settingsList}>
              <View style={[styles.settingItemStack, activePicker === 'appearance' && styles.settingItemStackActive]}>
                <TouchableOpacity
                  style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => toggleInlinePicker('appearance')}
                  activeOpacity={0.8}
                >
                  <View style={styles.settingInfo}>
                    <Moon size={20} color="#667eea" />
                    <View style={styles.settingText}>
                      <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Appearance</Text>
                      <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Follow system, light, or dark appearance</Text>
                    </View>
                  </View>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{selectedAppearanceLabel}</Text>
                </TouchableOpacity>
                {renderAppearancePicker()}
              </View>

              <View style={styles.settingItemStack}>
                <TouchableOpacity
                  style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => openSelector('currency')}
                  activeOpacity={0.8}
                >
                  <View style={styles.settingInfo}>
                    <DollarSign size={20} color="#667eea" />
                    <View style={styles.settingText}>
                      <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.currency.title')}</Text>
                      <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                        {selectedCurrency ? `${selectedCurrency.name} - ${selectedCurrency.region}` : t('settings.currency.subtitle')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.settingValueWrap}>
                    <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}> 
                      {formatCurrencyValue(selectedCurrency) || selectedCurrencyCode}
                    </Text>
                    <ChevronRight size={16} color={theme.colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.settingItemStack}>
                <TouchableOpacity
                  style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => openSelector('language')}
                  activeOpacity={0.8}
                >
                  <View style={styles.settingInfo}>
                    <Globe size={20} color="#667eea" />
                    <View style={styles.settingText}>
                      <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.language.title')}</Text>
                      <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{selectedLanguageLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.settingValueWrap}>
                    <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{selectedLanguageCode.toUpperCase()}</Text>
                    <ChevronRight size={16} color={theme.colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>


                    <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Backup & Automation</Text>
            <View style={styles.settingsList}>
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={onBackupRestore}
                activeOpacity={0.8}
              >
                <View style={styles.settingInfo}>
                  <Download size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.backupCenter.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{backupCenterSubtitle}</Text>
                  </View>
                </View>
                <View style={styles.settingValueWrap}>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{backupCenterValue}</Text>
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
                <View style={styles.settingInfo}>
                  <Download size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.autoBackup.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{autoBackupSubtitle}</Text>
                  </View>
                </View>
                <Switch
                  value={!!settings.autoBackup}
                  onValueChange={onAutoBackupToggle}
                  disabled={!googleDriveAvailable}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                />
              </View>
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
                <View style={styles.settingInfo}>
                  <Clock size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Auto Restore</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Restores the latest Google Drive backup when the app starts empty.</Text>
                  </View>
                </View>
                <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{autoRestoreValue}</Text>
              </View>
              <View style={[styles.lastBackupInfo, { borderTopColor: theme.colors.border }]}>
                <Text style={[styles.lastBackupText, { color: theme.colors.textSecondary }]}>{automationSummaryText}</Text>
              </View>
            </View>
          </View>

<View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Danger Zone</Text>
            <View style={styles.settingsList}>
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={onClearData}
                activeOpacity={0.8}
              >
                <View style={styles.settingInfo}>
                  <Trash2 size={20} color="#F44336" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: '#F44336' }]}>{t('settings.clearData.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.clearData.subtitle')}</Text>
                  </View>
                </View>
                <Text style={[styles.settingValue, { color: '#F44336' }]}>{t('common.reset')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        {renderSelectorModal()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  doneButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modalContentContainer: {
    paddingTop: 18,
    paddingBottom: 34,
  },
  settingsHero: {
    paddingHorizontal: 2,
    paddingBottom: 4,
    marginBottom: 18,
  },
  settingsHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingsAvatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  settingsHeroTextWrap: {
    flex: 1,
  },
  settingsHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  settingsHeroSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  settingsMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  settingsMetaChip: {
    minWidth: '30%',
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  settingsMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 4,
  },
  settingsMetaValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingsSection: {
    marginBottom: 24,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 20,
  },
  quickActionItem: {
    width: '31%',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
  settingsList: {},
  settingItemStack: {
    position: 'relative',
  },
  settingItemStackActive: {
    zIndex: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 15,
    borderBottomWidth: 1,
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
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  settingSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  settingValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 12,
  },
  notificationPermissionPanel: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 12,
  },
  notificationPermissionPanelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationPermissionPanelIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationPermissionPanelTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  notificationPermissionPanelTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  notificationPermissionPanelSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 2,
  },
  notificationPermissionPanelButton: {
    alignSelf: 'flex-start',
    minWidth: 84,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 46,
  },
  notificationPermissionPanelButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  inlinePicker: {
    position: 'absolute',
    top: '100%',
    right: 0,
    left: 24,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 24,
    overflow: 'hidden',
  },
  inlinePickerArrow: {
    position: 'absolute',
    top: -8,
    right: 24,
    width: 16,
    height: 16,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  inlinePickerList: {
    maxHeight: 360,
  },
  inlinePickerListContent: {
    paddingBottom: 8,
  },
  inlinePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  inlinePickerTextWrap: {
    flex: 1,
  },
  inlinePickerPrimary: {
    fontSize: 14,
    fontWeight: '600',
  },
  inlinePickerSecondary: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  selectorOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  selectorKeyboardAvoider: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  selectorCard: {
    width: '100%',
    maxHeight: '78%',
    minHeight: 320,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 18,
    overflow: 'hidden',
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  selectorHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  selectorSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  selectorCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorSearchWrap: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  selectorSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  selectorList: {
    flexGrow: 0,
    minHeight: 180,
  },
  selectorListContent: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  selectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  selectorItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  selectorItemBadge: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorItemBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  selectorItemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  selectorItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectorItemSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  selectorEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  selectorEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  selectorEmptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
  },
  lastBackupInfo: {
    paddingHorizontal: 2,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
  },
  lastBackupText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

