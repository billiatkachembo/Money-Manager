import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, Platform } from 'react-native';
import { Eye, Lock, Database, BarChart3, Smartphone, Key, Shield } from 'lucide-react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';

interface PrivacySecurityModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacySecurityModal({ visible, onClose }: PrivacySecurityModalProps) {
  const theme = useTheme().theme;
  const { settings, updateSettings } = useTransactionStore();

  const updatePrivacySetting = (key: string, value: any) => {
    updateSettings({
      privacy: {
        hideAmounts: settings.privacy?.hideAmounts ?? false,
        requireAuth: settings.privacy?.requireAuth ?? false,
        dataSharing: settings.privacy?.dataSharing ?? false,
        analytics: settings.privacy?.analytics ?? false,
        [key]: value
      }
    });
  };

  const updateSecuritySetting = (key: string, value: any) => {
    updateSettings({
      security: {
        autoLock: settings.security?.autoLock ?? 5,
        passwordEnabled: settings.security?.passwordEnabled ?? false,
        twoFactorEnabled: settings.security?.twoFactorEnabled ?? false,
        [key]: value
      }
    });
  };

  const handleBiometricAuthToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Biometric Authentication',
        'This will enable fingerprint or face ID authentication for the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => updateSecuritySetting('biometricAuth', true) },
        ]
      );
    } else {
      updateSecuritySetting('biometricAuth', false);
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
          { text: 'Disable', style: 'destructive', onPress: () => updateSecuritySetting('passwordEnabled', false) },
        ]
      );
    }
  };

  const handleTwoFactorToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Two-Factor Authentication',
        'This will add an extra layer of security to your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => {
              updateSecuritySetting('twoFactorEnabled', true);
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
          { text: 'Disable', style: 'destructive', onPress: () => updateSecuritySetting('twoFactorEnabled', false) },
        ]
      );
    }
  };

  const twoFactorEnabled = settings?.security?.twoFactorEnabled ?? false;

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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Share anonymous usage data</Text>
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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Help improve the app</Text>
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
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Fingerprint or Face ID</Text>
                </View>
              </View>
              <Switch
                value={settings.biometricAuth || false}
                onValueChange={handleBiometricAuthToggle}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>

            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingInfo}>
                <Key size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>App Password</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Protect app with password</Text>
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
                <Shield size={20} color="#667eea" />
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Two-Factor Authentication</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>Extra account security</Text>
                </View>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={handleTwoFactorToggle}
                trackColor={{ false: '#e0e0e0', true: '#667eea' }}
              />
            </View>
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
});
