import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Eye, Lock, Database, BarChart3, Smartphone, Key, Shield, Clock } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

interface PrivacySecurityModalProps {
  visible: boolean;
  onClose: () => void;
  settings: any;
  twoFactorEnabled: boolean;
  autoLockLabel: string;
  autoLockShort: string;
  updatePrivacySetting: (key: string, value: boolean) => void;
  onBiometricAuthToggle: (value: boolean) => void;
  onPasswordToggle: (value: boolean) => void;
  onTwoFactorToggle: (value: boolean) => void;
  onShowAutoLockPicker: () => void;
}

export function PrivacySecurityModal({
  visible,
  onClose,
  settings,
  twoFactorEnabled,
  autoLockLabel,
  autoLockShort,
  updatePrivacySetting,
  onBiometricAuthToggle,
  onPasswordToggle,
  onTwoFactorToggle,
  onShowAutoLockPicker,
}: PrivacySecurityModalProps) {
  const theme = useTheme().theme;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Require PIN or biometrics before opening the app</Text>
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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Share anonymous usage data to improve the app</Text>
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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Help improve the product with anonymous usage insights</Text>
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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Use fingerprint or face ID when supported</Text>
                </View>
              </View>
              <Switch
                value={settings.biometricAuth || false}
                onValueChange={onBiometricAuthToggle}
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
                onValueChange={onPasswordToggle}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>

            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Shield size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Two-Factor Authentication</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Add extra security to your account</Text>
                </View>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={onTwoFactorToggle}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
              onPress={onShowAutoLockPicker}
              activeOpacity={0.85}
            >
              <View style={styles.settingInfo}>
                <Clock size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Auto Lock</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{autoLockLabel}</Text>
                </View>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>{autoLockShort}</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
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
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
