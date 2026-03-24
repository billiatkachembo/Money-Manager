import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Modal,
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
  Zap,
  HelpCircle,
  CheckCircle,
} from 'lucide-react-native';
import { formatDateTimeWithWeekday } from '@/utils/date';
import { useI18n } from '@/src/i18n';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  settings: any;
  updateSettings: (settings: any) => void;
  openEditProfile: () => void;
  toggleTheme: () => void;
  onClearData: () => void;
  onBackupRestore: () => void;
  onPrivacySecurity: () => void;
  onHelpSupport: () => void;
  userProfile: any;
  currencies: Array<{ code: string; symbol: string; name: string }>;
  languages: Array<{ code: string; name: string }>;
  onShowAutoLockPicker: () => void;
  onQuickAddToggle: (value: boolean) => void | Promise<void>;
  onDailyReminderToggle: (value: boolean) => void | Promise<void>;
  reminderTimeLabel: string;
  onShowReminderTimePicker: () => void;
}

type InlinePickerTarget = 'currency' | 'language' | null;
type SelectionTooltipTarget = Exclude<InlinePickerTarget, null>;

interface SelectionTooltipState {
  target: SelectionTooltipTarget;
  message: string;
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
  toggleTheme,
  onClearData,
  onBackupRestore,
  onPrivacySecurity,
  onHelpSupport,
  userProfile,
  currencies,
  languages,
  onShowAutoLockPicker,
  onQuickAddToggle,
  onDailyReminderToggle,
  reminderTimeLabel,
  onShowReminderTimePicker,
}: SettingsModalProps) {
  const [activePicker, setActivePicker] = useState<InlinePickerTarget>(null);
  const [selectionTooltip, setSelectionTooltip] = useState<SelectionTooltipState | null>(null);
  const { t } = useI18n();

  const updateSetting = (key: string, value: any) => {
    if (key === 'darkMode') {
      toggleTheme();
      return;
    }

    updateSettings({ [key]: value });
  };

  const selectedLanguageLabel =
    languages.find((language) => language.code === settings.language)?.name ?? languages[0]?.name ?? 'English';
  const selectedCurrencyCode = (settings.currency ?? 'ZMW').toUpperCase();
  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.code.toUpperCase() === selectedCurrencyCode) ?? null,
    [currencies, selectedCurrencyCode]
  );
  const autoLockLabel = getAutoLockLabel(settings.security?.autoLock, t);
  const tooltipBackground = theme.isDark ? '#0F172A' : '#1F2937';
  const pickerBackground = theme.isDark ? '#111827' : '#FFFFFF';
  const pickerHighlight = theme.isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC';

  useEffect(() => {
    if (visible) {
      return;
    }

    setActivePicker(null);
    setSelectionTooltip(null);
  }, [visible]);

  useEffect(() => {
    if (!selectionTooltip) {
      return;
    }

    const timeout = setTimeout(() => {
      setSelectionTooltip(null);
    }, 2200);

    return () => clearTimeout(timeout);
  }, [selectionTooltip]);

  const toggleInlinePicker = (target: SelectionTooltipTarget) => {
    setSelectionTooltip((current) => (current?.target === target ? null : current));
    setActivePicker((current) => (current === target ? null : target));
  };

  const handleCurrencySelect = (currencyCode: string) => {
    updateSettings({ currency: currencyCode });
    setActivePicker(null);
    setSelectionTooltip({
      target: 'currency',
      message: t('settings.currencyUpdated', { code: currencyCode.toUpperCase() }),
    });
  };

  const handleLanguageSelect = (languageCode: string) => {
    const languageName = languages.find((language) => language.code === languageCode)?.name ?? languageCode.toUpperCase();
    updateSettings({ language: languageCode });
    setActivePicker(null);
    setSelectionTooltip({
      target: 'language',
      message: t('settings.languageUpdated', { name: languageName }),
    });
  };

  const renderSelectionTooltip = (target: SelectionTooltipTarget) => {
    if (selectionTooltip?.target !== target) {
      return null;
    }

    return (
      <View pointerEvents="none" style={[styles.selectionTooltip, { backgroundColor: tooltipBackground }]}> 
        <Text style={styles.selectionTooltipText}>{selectionTooltip.message}</Text>
        <View style={[styles.selectionTooltipArrow, { borderTopColor: tooltipBackground }]} />
      </View>
    );
  };

  const renderCurrencyPicker = () => {
    if (activePicker !== 'currency') {
      return null;
    }

    return (
      <View style={[styles.inlinePicker, { backgroundColor: pickerBackground, borderColor: theme.colors.border }]}> 
        <View style={[styles.inlinePickerArrow, { backgroundColor: pickerBackground, borderColor: theme.colors.border }]} />
        <ScrollView
          nestedScrollEnabled
          style={styles.inlinePickerList}
          contentContainerStyle={styles.inlinePickerListContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {currencies.map((currency) => {
            const isSelected = selectedCurrencyCode === currency.code.toUpperCase();
            return (
              <TouchableOpacity
                key={currency.code}
                style={[
                  styles.inlinePickerItem,
                  { borderBottomColor: theme.colors.border },
                  isSelected && { backgroundColor: pickerHighlight },
                ]}
                onPress={() => handleCurrencySelect(currency.code)}
                activeOpacity={0.85}
              >
                <View style={styles.inlinePickerTextWrap}>
                  <Text style={[styles.inlinePickerPrimary, { color: theme.colors.text }]}>
                    {currency.symbol} {currency.name}
                  </Text>
                  <Text style={[styles.inlinePickerSecondary, { color: theme.colors.textSecondary }]}>
                    {currency.code.toUpperCase()}
                  </Text>
                </View>
                {isSelected ? <CheckCircle size={18} color={theme.colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderLanguagePicker = () => {
    if (activePicker !== 'language') {
      return null;
    }

    return (
      <View style={[styles.inlinePicker, { backgroundColor: pickerBackground, borderColor: theme.colors.border }]}> 
        <View style={[styles.inlinePickerArrow, { backgroundColor: pickerBackground, borderColor: theme.colors.border }]} />
        <ScrollView nestedScrollEnabled style={styles.inlinePickerList} showsVerticalScrollIndicator={false}>
          {languages.map((language) => {
            const isSelected = settings.language === language.code;
            return (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.inlinePickerItem,
                  { borderBottomColor: theme.colors.border },
                  isSelected && { backgroundColor: pickerHighlight },
                ]}
                onPress={() => handleLanguageSelect(language.code)}
                activeOpacity={0.85}
              >
                <View style={styles.inlinePickerTextWrap}>
                  <Text style={[styles.inlinePickerPrimary, { color: theme.colors.text }]}>{language.name}</Text>
                  <Text style={[styles.inlinePickerSecondary, { color: theme.colors.textSecondary }]}>
                    {language.code.toUpperCase()}
                  </Text>
                </View>
                {isSelected ? <CheckCircle size={18} color={theme.colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>{t('common.done')}</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('settings.title')}</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView
          style={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={activePicker === null}
          contentContainerStyle={styles.modalContentContainer}
        >
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('settings.section.notifications')}</Text>

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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.quickAdd.subtitle')}</Text>
                </View>
              </View>
              <Switch
                value={!!settings.quickAddNotificationEnabled}
                onValueChange={onQuickAddToggle}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>

            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
              <View style={styles.settingInfo}>
                <Bell size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.dailyReminder.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.dailyReminder.subtitle')}</Text>
                </View>
              </View>
              <Switch
                value={!!settings.dailyReminderEnabled}
                onValueChange={onDailyReminderToggle}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>

            {settings.dailyReminderEnabled ? (
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

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('settings.section.preferences')}</Text>

            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
              <View style={styles.settingInfo}>
                <Moon size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.darkMode.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.darkMode.subtitle')}</Text>
                </View>
              </View>
              <Switch
                value={!!theme.isDark}
                onValueChange={(value) => updateSetting('darkMode', value)}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>

            <View style={[styles.settingItemStack, activePicker === 'currency' && styles.settingItemStackActive]}>
              {renderSelectionTooltip('currency')}
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => toggleInlinePicker('currency')}
                activeOpacity={0.8}
              >
                <View style={styles.settingInfo}>
                  <DollarSign size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.currency.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.currency.subtitle')}</Text>
                  </View>
                </View>
                <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                  {selectedCurrency?.code ?? selectedCurrencyCode}
                </Text>
              </TouchableOpacity>
              {renderCurrencyPicker()}
            </View>

            <View style={[styles.settingItemStack, activePicker === 'language' && styles.settingItemStackActive]}>
              {renderSelectionTooltip('language')}
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => toggleInlinePicker('language')}
                activeOpacity={0.8}
              >
                <View style={styles.settingInfo}>
                  <Globe size={20} color="#667eea" />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.language.title')}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{selectedLanguageLabel}</Text>
                  </View>
                </View>
                <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{settings.language?.toUpperCase()}</Text>
              </TouchableOpacity>
              {renderLanguagePicker()}
            </View>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={onShowAutoLockPicker}
              activeOpacity={0.8}
            >
              <View style={styles.settingInfo}>
                <Clock size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.autoLock.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.autoLock.subtitle')}</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{autoLockLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('settings.section.profile')}</Text>
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={openEditProfile}
              activeOpacity={0.8}
            >
              <View style={styles.settingInfo}>
                <Edit3 size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.editProfile.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.editProfile.subtitle', { accountName: userProfile?.name ?? t('common.account').toLowerCase() })}</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{t('common.open')}</Text>
            </TouchableOpacity>

          </View>

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('settings.section.support')}</Text>
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={onHelpSupport}
              activeOpacity={0.8}
            >
              <View style={styles.settingInfo}>
                <HelpCircle size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.helpSupport.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.helpSupport.subtitle')}</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{t('common.open')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('settings.section.privacyBackup')}</Text>
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={onBackupRestore}
              activeOpacity={0.8}
            >
              <View style={styles.settingInfo}>
                <Download size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.backupCenter.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.backupCenter.subtitle')}</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{t('common.open')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={onPrivacySecurity}
              activeOpacity={0.8}
            >
              <View style={styles.settingInfo}>
                <Shield size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.privacy.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.privacy.subtitle')}</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{t('common.open')}</Text>
            </TouchableOpacity>

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

          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('settings.section.backup')}</Text>
            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}> 
              <View style={styles.settingInfo}>
                <Download size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t('settings.autoBackup.title')}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{t('settings.autoBackup.subtitle')}</Text>
                </View>
              </View>
              <Switch
                value={!!settings.autoBackup}
                onValueChange={(value) => updateSetting('autoBackup', value)}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>
            {settings.lastBackupDate ? (
              <View style={styles.lastBackupInfo}>
                <Text style={[styles.lastBackupText, { color: theme.colors.textSecondary }]}>
                  {t('settings.lastBackup', { date: formatDateTimeWithWeekday(new Date(settings.lastBackupDate)) })}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
  },
  spacer: {
    width: 60,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modalContentContainer: {
    paddingTop: 16,
    paddingBottom: 28,
  },
  settingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
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
    paddingVertical: 16,
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
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectionTooltip: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: '100%',
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 25,
  },
  selectionTooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center',
  },
  selectionTooltipArrow: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
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
  lastBackupInfo: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginTop: 16,
  },
  lastBackupText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

