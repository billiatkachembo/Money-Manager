import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle, Clock } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

interface AutoLockPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (minutes: number) => void;
  selectedValue: number;
}

const autoLockOptions = [
  { value: 0, label: 'Immediately' },
  { value: 1, label: 'After 1 minute' },
  { value: 5, label: 'After 5 minutes' },
  { value: 10, label: 'After 10 minutes' },
  { value: 30, label: 'After 30 minutes' },
  { value: -1, label: 'Never' },
];

export function AutoLockPickerModal({
  visible,
  onClose,
  onSelect,
  selectedValue,
}: AutoLockPickerModalProps) {
  const theme = useTheme().theme;

  const handleAutoLockSelect = (minutes: number) => {
    onSelect(minutes);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
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
                {selectedValue === option.value && (
                  <CheckCircle size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity 
            style={[styles.pickerCancel, { backgroundColor: theme.colors.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.pickerCancelText, { color: theme.colors.text }]}>Cancel</Text>
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
});

