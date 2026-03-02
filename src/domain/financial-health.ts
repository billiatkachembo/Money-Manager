import { FinancialHealthMetrics } from '../../types/transaction';

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function computeFinancialHealthScore(metrics: FinancialHealthMetrics): number {
  const normalizedSavings = clamp((metrics.savingsRate + 0.5) / 0.5);
  const normalizedBuffer = clamp(metrics.bufferMonths / 6);
  const normalizedExpense = clamp(1 - metrics.expenseCV);
  const normalizedIncome = clamp(1 - metrics.incomeCV);

  const score =
    30 * normalizedSavings +
    25 * clamp(metrics.budgetAdherence) +
    20 * normalizedBuffer +
    15 * normalizedExpense +
    10 * normalizedIncome;

  return Math.round(clamp(score / 100, 0, 1) * 100);
}

export function computeCoefficientOfVariation(series: number[]): number {
  if (series.length === 0) {
    return 1;
  }

  const mean = series.reduce((sum, value) => sum + value, 0) / series.length;
  if (mean <= 0) {
    return 1;
  }

  const variance =
    series.reduce((sum, value) => {
      const deviation = value - mean;
      return sum + deviation * deviation;
    }, 0) / series.length;

  const stdDev = Math.sqrt(variance);
  return stdDev / mean;
}

export interface FinancialHealthMetricInput {
  monthlyIncome: number[];
  monthlyExpenses: number[];
  budgetAdherence: number;
  liquidBalance: number;
}

export function computeFinancialHealthMetrics(input: FinancialHealthMetricInput): FinancialHealthMetrics {
  const incomeAverage =
    input.monthlyIncome.length > 0
      ? input.monthlyIncome.reduce((sum, value) => sum + value, 0) / input.monthlyIncome.length
      : 0;

  const expenseAverage =
    input.monthlyExpenses.length > 0
      ? input.monthlyExpenses.reduce((sum, value) => sum + value, 0) / input.monthlyExpenses.length
      : 0;

  const savingsRate = incomeAverage > 0 ? (incomeAverage - expenseAverage) / incomeAverage : -1;
  const bufferMonths = expenseAverage > 0 ? input.liquidBalance / expenseAverage : 0;

  return {
    savingsRate,
    budgetAdherence: clamp(input.budgetAdherence),
    bufferMonths,
    expenseCV: computeCoefficientOfVariation(input.monthlyExpenses),
    incomeCV: computeCoefficientOfVariation(input.monthlyIncome),
  };
}
