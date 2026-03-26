import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import type { CalculatorKey } from '@/hooks/useFinancialCalculators';
import { CALCULATOR_CONFIG, CALCULATOR_ORDER } from '@/components/planning/calculatorConfig';

interface CalculatorsSectionProps {
  onOpenCalculator: (calculator: CalculatorKey) => void;
}

export function CalculatorsSection({ onOpenCalculator }: CalculatorsSectionProps) {
  const { theme } = useTheme();
  const iconBackground = theme.colors.primary + '14';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Financial Calculators</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}
        >
          Plan and optimize your finances
        </Text>
      </View>

      <View style={styles.calculatorGrid}>
        {CALCULATOR_ORDER.map((key) => {
          const config = CALCULATOR_CONFIG[key].card;
          const Icon = config.icon;
          const accentColor = theme.colors[config.accent];

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.calculatorCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${config.title} calculator`}
              onPress={() => onOpenCalculator(key)}
            >
              <View style={[styles.calculatorIconContainer, { backgroundColor: iconBackground }]}>
                <Icon size={28} color={accentColor} />
              </View>
              <Text style={[styles.calculatorTitle, { color: theme.colors.text }]}>{config.title}</Text>
              <Text style={[styles.calculatorDescription, { color: theme.colors.textSecondary }]}
              >
                {config.description}
              </Text>
              <ChevronRight size={20} color={theme.colors.textSecondary} style={styles.calculatorArrow} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  calculatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  calculatorCard: {
    borderRadius: 16,
    padding: 20,
    flexBasis: '48%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  calculatorIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  calculatorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  calculatorDescription: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  calculatorArrow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
