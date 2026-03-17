import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { HelpCircle, MessageCircle, Mail, ExternalLink, Info } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

interface HelpSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HelpSupportModal({ visible, onClose }: HelpSupportModalProps) {
  const theme = useTheme().theme;

  const openEmailSupport = () => {
    const subject = encodeURIComponent('Money Manager Support Request');
    const body = encodeURIComponent(`Hello Support Team,\\n\\nI need help with:\\n\\n\\nApp Version: 1.0.0\\nDevice: ${Platform.OS}\\n`);
    Linking.openURL(`mailto:support@moneymanager.com?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Error', 'Could not open email app. Please send email to support@moneymanager.com');
    });
  };

  const openFAQ = () => {
    Alert.alert('FAQ', 'Frequently Asked Questions would be displayed here.');
  };

  const openContactForm = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact support?',
      [
        { text: 'Email', onPress: openEmailSupport },
        { text: 'Phone', onPress: () => Linking.openURL('tel:+15551234567') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
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
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
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
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
  },
});
