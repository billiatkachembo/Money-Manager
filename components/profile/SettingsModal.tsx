import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { Download, Shield, Edit3, Globe, Moon, Trash2, Bell, Database, Clock } from 'lucide-react-native';
import { Alert } from 'react-native';
import { Modal } from 'react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { BackupRestoreModal } from '../BackupRestoreModal';
// import CurrencyPickerModal from './CurrencyPickerModal';
// import LanguagePickerModal from './LanguagePickerModal';
// import AutoLockPickerModal from './AutoLockPickerModal';
// import PrivacySecurityModal from './PrivacySecurityModal';

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
  userProfile: any;
  languages: Array<{ code: string; name: string }>;
  onShowLanguagePicker: () => void;
  onShowCurrencyPicker: () => void;
  onShowAutoLockPicker: () => void;
}

export function SettingsModal({ visible, onClose, theme, settings, updateSettings, openEditProfile, toggleTheme, onClearData, onBackupRestore, onPrivacySecurity, userProfile, languages, onShowLanguagePicker, onShowCurrencyPicker, onShowAutoLockPicker }: SettingsModalProps) {

  const updateSetting = (key: string, value: any) => {
    if (key === 'darkMode') {
      toggleTheme();
    } else {
      updateSettings({ [key]: value });
    }
  };

  const handleClearData = onClearData;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Done</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>App Settings</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Notifications Section */}
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
                value={!!settings.notifications}
                onValueChange={(value) => updateSetting('notifications', value)}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>
          </View>

          {/* Profile */}
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Profile</Text>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Edit3 size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Edit Profile</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Update your personal details</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Globe size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Language</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{languages.find(l => l.code === settings.language)?.name ?? 'English'}</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{settings.language?.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy & Backup */}
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Privacy & Backup</Text>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Download size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Backup Center</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>JSON, CSV, Drive backups</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Shield size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Privacy</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Security controls</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Trash2 size={20} color="#F44336" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: '#F44336' }]}>Clear Data</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Delete all data</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: '#F44336' }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Backup */}
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Backup</Text>
            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Download size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Auto Backup</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Google Drive auto backup</Text>
                </View>
              </View>
              <Switch
                value={!!settings.autoBackup}
                onValueChange={(value) => updateSetting('autoBackup', value)}
              />
            </View>
            {settings.lastBackupDate && (
              <View style={styles.lastBackupInfo}>
                <Text style={[styles.lastBackupText, { color: theme.colors.textSecondary }]}>
                  Last backup: {new Date(settings.lastBackupDate).toLocaleDateString()}
                </Text>
              </View>
            )}
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
    padding: 16,
  },
  settingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
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
