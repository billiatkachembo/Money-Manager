import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTransactionStore } from '@/store/transaction-store';
import { useTheme } from '@/store/theme-store';
// import { UserProfile } from '../../../types/transaction'; // adjust path

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { theme } = useTheme();
  const { userProfile, updateUserProfile } = useTransactionStore();
  const [editForm, setEditForm] = useState<any>(userProfile);

  useEffect(() => {
    setEditForm(userProfile);
  }, [userProfile, visible]);

  const handleSaveProfile = () => {
    updateUserProfile(editForm);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
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
              onChangeText={(text) => setEditForm((prev: any) => ({ ...prev, name: text }))}
              placeholder="Enter your full name"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Email</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={editForm.email}
              onChangeText={(text) => setEditForm((prev: any) => ({ ...prev, email: text }))}
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
              onChangeText={(text) => setEditForm((prev: any) => ({ ...prev, phone: text }))}
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
              onChangeText={(text) => setEditForm((prev: any) => ({ ...prev, location: text }))}
              placeholder="Enter your location"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.colors.text }]}>Occupation</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={editForm.occupation}
              onChangeText={(text) => setEditForm((prev: any) => ({ ...prev, occupation: text }))}
              placeholder="Enter your occupation"
              placeholderTextColor={theme.colors.textSecondary}
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
    backgroundColor: 'white',
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
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
});
