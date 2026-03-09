import { Transaction, Budget, FinancialHealthMetrics } from '@/types/transaction';
import { getMonthlyIncome, getMonthlyExpenses } from './ledger';

type HealthMetrics = FinancialHealthMetrics;

/** Clamp a number to [min, max] */
export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

/** Compute overall financial health score from metrics */
export function computeFinancialHealthScore(metrics: HealthMetrics): number {
  const normalizedSavings = clamp((metrics.savingsRate + 0.5) / 0.5);
  const normalizedBuffer = clamp(metrics.bufferMonths / 6);
  const normalizedExpense = clamp(1 - metrics.expenseCV);
  const normalizedIncome = clamp(1 - metrics.incomeCV);

  const score =
    30 * normalizedSavings +
    25 * metrics.budgetAdherence +
    20 * normalizedBuffer +
    15 * normalizedExpense +
    10 * normalizedIncome;

  return Math.round(clamp(score, 0, 100));
}

/** Compute coefficient of variation (std dev / mean) */
export function computeCoefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;

  const nonZero = values.filter(v => v > 0);
  if (nonZero.length < 2) return 0;

  const mean = nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length;
  if (mean === 0) return 0;

  const variance = nonZero.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nonZero.length;
  return Math.sqrt(variance) / mean;
}

/** Derive health metrics from transactions, budgets, and total balance */
export function deriveHealthMetrics(
  transactions: Transaction[],
  budgets: Budget[],
  totalBalance: number
): HealthMetrics {
  const now = new Date();
  const months: string[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  const monthlyIncomes = months.map(m => getMonthlyIncome(transactions, m));
  const monthlyExpenses = months.map(m => getMonthlyExpenses(transactions, m));

  const totalIncome = monthlyIncomes.reduce((a, b) => a + b, 0);
  const totalExpense = monthlyExpenses.reduce((a, b) => a + b, 0);

  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

  // Budget adherence for current month
  let budgetAdherence = 1;
  if (budgets.length > 0) {
    const currentMonth = now.toISOString().slice(0, 7);
    const withinBudgetCount = budgets.reduce((count, budget) => {
      const categoryId = budget.category?.id;
      if (!categoryId) return count;

      const spent = transactions
        .filter(t => t.type === 'expense' && t.category.id === categoryId)
        .filter(t => (t.date instanceof Date ? t.date : new Date(t.date)).toISOString().slice(0, 7) === currentMonth)
        .reduce((sum, t) => sum + t.amount, 0);

      return spent <= budget.amount ? count + 1 : count;
    }, 0);

    budgetAdherence = withinBudgetCount / budgets.length;
  }

  const avgMonthlyExpense = totalExpense / Math.max(months.length, 1);
  const bufferMonths = avgMonthlyExpense > 0 ? totalBalance / avgMonthlyExpense : 6;

  const expenseCV = computeCoefficientOfVariation(monthlyExpenses);
  const incomeCV = computeCoefficientOfVariation(monthlyIncomes);

  return {
    savingsRate: clamp(savingsRate, -1, 1),
    budgetAdherence: clamp(budgetAdherence),
    bufferMonths: Math.max(0, bufferMonths),
    expenseCV,
    incomeCV
  };
}

/** Map numeric score to human-readable label */
export function getHealthScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Needs Work';
  return 'Critical';
}

/** Map numeric score to color code */
export function getHealthScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}
