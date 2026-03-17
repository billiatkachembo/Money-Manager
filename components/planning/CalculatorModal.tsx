import React from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/store/theme-store';
import type { CalculatorForm, CalculatorKey, CalculatorResult } from '@/hooks/useFinancialCalculators';
import { CALCULATOR_CONFIG } from '@/components/planning/calculatorConfig';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';

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

  const handleCalculatePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onCalculate(activeCalculator);
  };

  return (
    <AppBottomSheet
      visible={!!activeCalculator}
      title={calculator.title}
      snapPoints={['85%']}
      initialSnapIndex={0}
      onClose={onClose}
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
          {calculator.description}
        </Text>

        <View style={styles.calculatorForm}>
          {calculator.fields.map((field) => {
            const Icon = field.icon;
            return (
              <View key={field.key} style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Icon size={18} color={theme.colors.textSecondary} />
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
          onPress={handleCalculatePress}
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
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
  },
  description: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
    textAlign: 'center',
  },
  calculatorForm: {
    gap: 18,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 10,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputLabelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  calculateButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  calculateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.3,
  },
  resultContainer: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  resultLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveResultButton: {
    paddingVertical: 12,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  saveResultText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
