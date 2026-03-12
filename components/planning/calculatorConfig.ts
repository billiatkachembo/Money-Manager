import type React from 'react';
import type { KeyboardTypeOptions } from 'react-native';
import {
  Calendar,
  Clock,
  DollarSign,
  Percent,
  PiggyBank,
  Plus,
  Target,
  TrendingUp,
  Calculator,
} from 'lucide-react-native';
import type { CalculatorForm, CalculatorKey } from '@/hooks/useFinancialCalculators';

export type CalculatorField = {
  label: string;
  key: keyof CalculatorForm;
  placeholder: string;
  icon: React.ElementType;
  keyboardType?: KeyboardTypeOptions;
};

export type CalculatorCardConfig = {
  title: string;
  description: string;
  icon: React.ElementType;
  accent: 'primary' | 'success' | 'warning' | 'error';
};

export type CalculatorConfig = {
  title: string;
  description: string;
  fields: CalculatorField[];
  card: CalculatorCardConfig;
};

export const CALCULATOR_CONFIG: Record<CalculatorKey, CalculatorConfig> = {
  loan: {
    title: 'Loan Calculator',
    description: 'Calculate monthly payments, total interest, and payoff schedule',
    fields: [
      {
        label: 'Loan Amount',
        key: 'loanAmount',
        placeholder: 'e.g., 25000',
        icon: DollarSign,
      },
      {
        label: 'Interest Rate',
        key: 'interestRate',
        placeholder: 'Annual percentage rate',
        icon: Percent,
      },
      {
        label: 'Loan Term',
        key: 'loanTerm',
        placeholder: 'Years',
        icon: Calendar,
      },
    ],
    card: {
      title: 'Loan Calculator',
      description: 'Calculate monthly payments and interest',
      icon: Calculator,
      accent: 'primary',
    },
  },
  investment: {
    title: 'Investment Growth Calculator',
    description: 'Project how your investments will grow over time',
    fields: [
      {
        label: 'Initial Investment',
        key: 'principal',
        placeholder: 'e.g., 10000',
        icon: DollarSign,
      },
      {
        label: 'Rate of Return',
        key: 'rateOfReturn',
        placeholder: 'Annual percentage',
        icon: TrendingUp,
      },
      {
        label: 'Time Period',
        key: 'years',
        placeholder: 'Years',
        icon: Clock,
      },
    ],
    card: {
      title: 'Investment Growth',
      description: 'Project investment returns over time',
      icon: TrendingUp,
      accent: 'success',
    },
  },
  savings: {
    title: 'Savings Goal Calculator',
    description: 'Plan how to reach your savings targets',
    fields: [
      {
        label: 'Current Savings',
        key: 'currentSavings',
        placeholder: 'e.g., 5000',
        icon: PiggyBank,
      },
      {
        label: 'Monthly Contribution',
        key: 'monthlyContribution',
        placeholder: 'e.g., 500',
        icon: DollarSign,
      },
      {
        label: 'Target Amount',
        key: 'targetAmount',
        placeholder: 'e.g., 50000',
        icon: Target,
      },
      {
        label: 'Timeframe',
        key: 'timeframe',
        placeholder: 'Years',
        icon: Calendar,
      },
    ],
    card: {
      title: 'Savings Goal',
      description: 'Calculate how much to save monthly',
      icon: PiggyBank,
      accent: 'warning',
    },
  },
  debt: {
    title: 'Debt Payoff Calculator',
    description: 'Create a plan to eliminate your debt faster',
    fields: [
      {
        label: 'Total Debt',
        key: 'debtAmount',
        placeholder: 'e.g., 15000',
        icon: DollarSign,
      },
      {
        label: 'Monthly Payment',
        key: 'monthlyPayment',
        placeholder: 'e.g., 300',
        icon: DollarSign,
      },
      {
        label: 'Extra Payment (Optional)',
        key: 'extraPayment',
        placeholder: 'e.g., 100',
        icon: Plus,
      },
    ],
    card: {
      title: 'Debt Payoff',
      description: 'Plan your debt elimination strategy',
      icon: DollarSign,
      accent: 'error',
    },
  },
};

export const CALCULATOR_ORDER: CalculatorKey[] = ['loan', 'investment', 'savings', 'debt'];
