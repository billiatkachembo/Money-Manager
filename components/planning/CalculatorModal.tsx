import React from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import type { CalculatorForm, CalculatorKey, CalculatorResult } from '@/hooks/useFinancialCalculators';
import { CALCULATOR_CONFIG } from '@/components/planning/calculatorConfig';

interface CalculatorModalProps {
  activeCalculator: CalculatorKey | null;
  calculatorForm: CalculatorForm;
  calculatorResult: CalculatorResult | null;
  onClose: () => void;
  onFieldChange: (field: keyof CalculatorForm, value: string) => void;
  onCalculate: (calculator: CalculatorKey) => void;
}

export function CalculatorModal({
  activeCalculator,
  calculatorForm,
  calculatorResult,
  onClose,
  onFieldChange,
  onCalculate,
}: CalculatorModalProps) {
  const { theme } = useTheme();

  if (!activeCalculator) {
    return null;
  }

  const calculator = CALCULATOR_CONFIG[activeCalculator];

  return (
    <Modal visible={!!activeCalculator} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}
        >
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close calculator" onPress={onClose}>
            <X size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{calculator.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}
          >
            {calculator.description}
          </Text>

          <View style={styles.calculatorForm}>
            {calculator.fields.map((field) => {
              const Icon = field.icon;
              return (
                <View key={field.key} style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <Icon size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.inputLabelText, { color: theme.colors.text }]}>
                      {field.label}
                    </Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder={field.placeholder}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={calculatorForm[field.key]}
                    onChangeText={(text) => onFieldChange(field.key, text)}
                    keyboardType={field.keyboardType ?? 'numeric'}
                  />
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.calculateButton, { backgroundColor: theme.colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={`Calculate ${calculator.title}`}
            onPress={() => onCalculate(activeCalculator)}
          >
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </TouchableOpacity>

          {calculatorResult && (
            <View
              style={[
                styles.resultContainer,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                {calculatorResult.title}
              </Text>
              {Object.entries(calculatorResult).map(([key, value]) => {
                if (key === 'title') return null;
                return (
                  <View key={key} style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: theme.colors.textSecondary }]}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}:
                    </Text>
                    <Text style={[styles.resultValue, { color: theme.colors.text }]}>
                      {String(value)}
                    </Text>
                  </View>
                );
              })}
              <TouchableOpacity
                style={[styles.saveResultButton, { borderColor: theme.colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Save calculator result"
                onPress={() => {
                  Alert.alert('Save Result', 'This feature will save the calculation result to your notes');
                }}
              >
                <Text style={[styles.saveResultText, { color: theme.colors.primary }]}>Save to Notes</Text>
              </TouchableOpacity>
            </View>
          )}
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
    textAlign: 'center',
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
  },
  calculatorForm: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  calculateButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  calculateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  resultLabel: {
    fontSize: 14,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveResultButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  saveResultText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
