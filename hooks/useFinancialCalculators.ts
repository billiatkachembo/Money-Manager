import { useReducer, useState } from 'react';
import { Alert } from 'react-native';
import {
  calculateInvestmentGrowth,
  calculateLoanPayment,
  calculateSavingsGoal,
  safeNumber,
  simulateDebtPayoff,
} from '@/utils/finance-calculations';

export type CalculatorKey = 'loan' | 'investment' | 'savings' | 'debt';

export interface CalculatorForm {
  loanAmount: string;
  interestRate: string;
  loanTerm: string;
  principal: string;
  rateOfReturn: string;
  years: string;
  currentSavings: string;
  monthlyContribution: string;
  targetAmount: string;
  timeframe: string;
  debtAmount: string;
  monthlyPayment: string;
  extraPayment: string;
}

export type CalculatorResult = {
  title: string;
  [key: string]: string | number;
};

const initialCalculatorForm: CalculatorForm = {
  loanAmount: '',
  interestRate: '',
  loanTerm: '',
  principal: '',
  rateOfReturn: '',
  years: '',
  currentSavings: '',
  monthlyContribution: '',
  targetAmount: '',
  timeframe: '',
  debtAmount: '',
  monthlyPayment: '',
  extraPayment: '',
};

type CalculatorAction =
  | { type: 'SET_FIELD'; field: keyof CalculatorForm; value: string }
  | { type: 'RESET' };

function calculatorReducer(state: CalculatorForm, action: CalculatorAction): CalculatorForm {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESET':
      return initialCalculatorForm;
    default:
      return state;
  }
}

interface UseFinancialCalculatorsOptions {
  formatCurrency: (value: number) => string;
  averageDebtInterestRate?: number;
}

export function useFinancialCalculators({
  formatCurrency,
  averageDebtInterestRate,
}: UseFinancialCalculatorsOptions) {
  const [activeCalculator, setActiveCalculator] = useState<CalculatorKey | null>(null);
  const [calculatorResult, setCalculatorResult] = useState<CalculatorResult | null>(null);
  const [calculatorForm, dispatch] = useReducer(calculatorReducer, initialCalculatorForm);

  const setField = (field: keyof CalculatorForm, value: string) => {
    dispatch({ type: 'SET_FIELD', field, value });
  };

  const resetForm = () => {
    dispatch({ type: 'RESET' });
  };

  const openCalculator = (calculator: CalculatorKey) => {
    setActiveCalculator(calculator);
    setCalculatorResult(null);
    resetForm();
  };

  const closeCalculator = () => {
    setActiveCalculator(null);
    setCalculatorResult(null);
  };

  const calculateLoan = () => {
    const principal = safeNumber(calculatorForm.loanAmount);
    const annualRatePercent = safeNumber(calculatorForm.interestRate);
    const years = safeNumber(calculatorForm.loanTerm);
    const months = years * 12;

    if (principal <= 0 || months <= 0) {
      Alert.alert('Error', 'Please enter loan amount and term');
      return;
    }

    const annualRate = annualRatePercent / 100;
    const result = calculateLoanPayment(principal, annualRate, months);

    setCalculatorResult({
      title: 'Loan Calculator Results',
      monthlyPayment: formatCurrency(result.monthlyPayment),
      totalPayment: formatCurrency(result.totalPayment),
      totalInterest: formatCurrency(result.totalInterest),
    });
  };

  const calculateInvestment = () => {
    const principal = safeNumber(calculatorForm.principal);
    const annualRatePercent = safeNumber(calculatorForm.rateOfReturn);
    const years = safeNumber(calculatorForm.years);

    if (principal <= 0 || years <= 0) {
      Alert.alert('Error', 'Please enter all investment details');
      return;
    }

    const annualRate = annualRatePercent / 100;
    const result = calculateInvestmentGrowth(principal, annualRate, years);

    setCalculatorResult({
      title: 'Investment Growth Results',
      futureValue: formatCurrency(result.futureValue),
      totalInterest: formatCurrency(result.totalInterest),
      annualGrowth: `${(result.annualGrowth * 100).toFixed(2)}%`,
      years,
      compounding: 'Monthly',
    });
  };

  const calculateSavings = () => {
    const current = safeNumber(calculatorForm.currentSavings);
    const monthly = safeNumber(calculatorForm.monthlyContribution);
    const target = safeNumber(calculatorForm.targetAmount);
    const years = safeNumber(calculatorForm.timeframe);
    const months = years * 12;

    if (target <= 0 || months <= 0) {
      Alert.alert('Error', 'Please enter target amount and timeframe');
      return;
    }

    const result = calculateSavingsGoal(current, monthly, target, months);

    if (monthly > 0) {
      setCalculatorResult({
        title: 'Savings Goal Analysis',
        monthlyContribution: formatCurrency(monthly),
        monthsNeeded: Math.ceil(result.monthsNeeded),
        yearsNeeded: (result.monthsNeeded / 12).toFixed(1),
        totalContribution: formatCurrency(monthly * result.monthsNeeded),
      });
    } else {
      setCalculatorResult({
        title: 'Savings Goal Analysis',
        monthlyRequired: formatCurrency(result.monthlyRequired),
        totalMonths: months,
        totalYears: (months / 12).toFixed(1),
        finalAmount: formatCurrency(target),
      });
    }
  };

  const calculateDebtPayoff = () => {
    const principal = safeNumber(calculatorForm.debtAmount);
    const monthly = safeNumber(calculatorForm.monthlyPayment);
    const extra = safeNumber(calculatorForm.extraPayment);
    const annualRate = averageDebtInterestRate ?? 0.18;

    if (principal <= 0 || monthly <= 0) {
      Alert.alert('Error', 'Please enter debt amount and monthly payment');
      return;
    }

    const extraPayment = extra > 0 ? extra : 0;
    const totalPayment = monthly + extraPayment;
    const minimumInterestOnlyPayment = principal * (annualRate / 12);
    if (totalPayment <= minimumInterestOnlyPayment) {
      Alert.alert('Error', 'Monthly payment is too low to reduce this debt balance');
      return;
    }

    const scenarioWithExtra = simulateDebtPayoff(principal, totalPayment, annualRate, 480);
    if (!scenarioWithExtra.paidOff) {
      Alert.alert('Error', 'Unable to calculate payoff with the entered values');
      return;
    }

    const baselineScenario = simulateDebtPayoff(principal, monthly, annualRate, 480);

    const result: CalculatorResult = {
      title: 'Debt Payoff Analysis',
      totalMonths: scenarioWithExtra.totalMonths,
      totalYears: (scenarioWithExtra.totalMonths / 12).toFixed(1),
      totalInterest: formatCurrency(scenarioWithExtra.totalInterest),
      totalPaid: formatCurrency(principal + scenarioWithExtra.totalInterest),
      payoffDate: new Date(
        new Date().setMonth(new Date().getMonth() + scenarioWithExtra.totalMonths)
      ).toLocaleDateString(),
    };

    if (extraPayment > 0 && baselineScenario.paidOff) {
      const interestSaved = baselineScenario.totalInterest - scenarioWithExtra.totalInterest;
      const monthsSaved = baselineScenario.totalMonths - scenarioWithExtra.totalMonths;
      if (interestSaved > 0) {
        result.interestSaved = formatCurrency(interestSaved);
      }
      if (monthsSaved > 0) {
        result.monthsSaved = monthsSaved;
      }
    }

    setCalculatorResult(result);
  };

  const calculateByType: Record<CalculatorKey, () => void> = {
    loan: calculateLoan,
    investment: calculateInvestment,
    savings: calculateSavings,
    debt: calculateDebtPayoff,
  };

  return {
    activeCalculator,
    calculatorForm,
    calculatorResult,
    openCalculator,
    closeCalculator,
    setField,
    calculateByType,
  };
}
