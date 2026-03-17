import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
import { ALL_CATEGORIES } from '@/constants/categories';

interface ImportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ImportModal({ visible, onClose }: ImportModalProps) {
  const theme = useTheme().theme;
  const {
    transactions,
    budgets,
    importTransactionsBatch,
  } = useTransactionStore();
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importText, setImportText] = useState('');

  const importCategories = React.useMemo(() => {
    const map = new Map();
    [...ALL_CATEGORIES, ...transactions.map((t: any) => t.category), ...budgets.map((b: any) => b.category)]
      .filter(Boolean)
      .forEach((category: any) => map.set(category.id, category));
    return Array.from(map.values());
  }, [transactions, budgets]);

  const submitImportPayload = () => {
    if (!importText.trim()) {
      Alert.alert('Import Data', `Paste ${importFormat.toUpperCase()} content to continue.`);
      return;
    }

    // Handle JSON/CSV import logic here
    Alert.alert('Import', 'Import functionality would be implemented here.');
    setImportText('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => {
            onClose();
            setImportText('');
          }}>
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
                ? 'Paste backup JSON payload to replace app data.'
                : 'Paste CSV with headers: date, type, amount, description, category...'}
            </Text>

            <TextInput
              style={[
                styles.importTextInput,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              value={importText}
              onChangeText={setImportText}
              placeholder={importFormat === 'json' ? 'Paste JSON here...' : 'Paste CSV here...'}
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    minHeight: 240,
    textAlignVertical: 'top',
  },
});
