import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { SUPPORTED_LANGUAGES } from '@/constants/languages';
import { useI18n } from '@/src/i18n';

interface LanguagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (languageCode: string) => void;
  selectedLanguage: string;
}

const languages = SUPPORTED_LANGUAGES;

export function LanguagePickerModal({
  visible,
  onClose,
  onSelect,
  selectedLanguage,
}: LanguagePickerModalProps) {
  const theme = useTheme().theme;
  const { t } = useI18n();

  const handleLanguageSelect = (languageCode: string) => {
    onSelect(languageCode);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={[styles.pickerModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.pickerModal, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>{t('settings.language.title')}</Text>
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
                {selectedLanguage === language.code && (
                  <CheckCircle size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.pickerCancel, { backgroundColor: theme.colors.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.pickerCancelText, { color: theme.colors.text }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
