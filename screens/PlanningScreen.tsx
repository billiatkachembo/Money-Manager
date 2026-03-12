import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Calculator, PiggyBank, Target } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useFinancialCalculators } from '@/hooks/useFinancialCalculators';
import { GoalsSection } from '@/components/planning/GoalsSection';
import { BudgetsSection } from '@/components/planning/BudgetsSection';
import { CalculatorsSection } from '@/components/planning/CalculatorsSection';
import { CalculatorModal } from '@/components/planning/CalculatorModal';

export default function PlanningScreen() {
  const { theme } = useTheme();
  const { formatCurrency, settings } = useTransactionStore();
  const [activeSection, setActiveSection] = useState<'goals' | 'budgets' | 'calculator'>('goals');

  const calculators = useFinancialCalculators({
    formatCurrency,
    averageDebtInterestRate: settings.averageDebtInterestRate,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.tabContainer,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Goals tab"
          style={({ pressed }) => [
            styles.tab,
            activeSection === 'goals' && styles.activeTab,
            pressed && styles.tabPressed,
          ]}
          onPress={() => setActiveSection('goals')}
        >
          <Target
            size={20}
            color={activeSection === 'goals' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeSection === 'goals' ? theme.colors.primary : theme.colors.textSecondary,
              },
              activeSection === 'goals' && { fontWeight: '600' },
            ]}
          >
            Goals
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Budgets tab"
          style={({ pressed }) => [
            styles.tab,
            activeSection === 'budgets' && styles.activeTab,
            pressed && styles.tabPressed,
          ]}
          onPress={() => setActiveSection('budgets')}
        >
          <PiggyBank
            size={20}
            color={activeSection === 'budgets' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeSection === 'budgets' ? theme.colors.primary : theme.colors.textSecondary,
              },
              activeSection === 'budgets' && { fontWeight: '600' },
            ]}
          >
            Budgets
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tools tab"
          style={({ pressed }) => [
            styles.tab,
            activeSection === 'calculator' && styles.activeTab,
            pressed && styles.tabPressed,
          ]}
          onPress={() => setActiveSection('calculator')}
        >
          <Calculator
            size={20}
            color={activeSection === 'calculator' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeSection === 'calculator' ? theme.colors.primary : theme.colors.textSecondary,
              },
              activeSection === 'calculator' && { fontWeight: '600' },
            ]}
          >
            Tools
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeSection === 'goals' && <GoalsSection />}
        {activeSection === 'budgets' && <BudgetsSection />}
        {activeSection === 'calculator' && (
          <CalculatorsSection onOpenCalculator={calculators.openCalculator} />
        )}
      </ScrollView>

      <CalculatorModal
        activeCalculator={calculators.activeCalculator}
        calculatorForm={calculators.calculatorForm}
        calculatorResult={calculators.calculatorResult}
        onClose={calculators.closeCalculator}
        onFieldChange={calculators.setField}
        onCalculate={(calculator) => calculators.calculateByType[calculator]()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  tabPressed: {
    opacity: 0.75,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
});
