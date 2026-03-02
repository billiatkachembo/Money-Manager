import { Transaction, Budget, HealthMetrics } from '@/types/transaction';
import { getMonthlyIncome, getMonthlyExpenses } from './ledger';

export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

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

export function computeCoefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;

  const nonZero = values.filter(v => v > 0);
  if (nonZero.length < 2) return 0;

  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  if (mean === 0) return 0;

  const variance = nonZero.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / nonZero.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / mean;
}

export function deriveHealthMetrics(
  transactions: Transaction[],
  budgets: Budget[],
  totalBalance: number
): HealthMetrics {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  const monthlyIncomes = months.map(m => getMonthlyIncome(transactions, m));
  const monthlyExpenses = months.map(m => getMonthlyExpenses(transactions, m));

  const totalIncome = monthlyIncomes.reduce((a, b) => a + b, 0);
  const totalExpense = monthlyExpenses.reduce((a, b) => a + b, 0);

  const savingsRate = totalIncome > 0
    ? (totalIncome - totalExpense) / totalIncome
    : 0;

  let budgetAdherence = 1;
  if (budgets.length > 0) {
    const currentMonth = now.toISOString().slice(0, 7);
    let withinBudget = 0;

    for (const budget of budgets) {
      const spent = transactions
        .filter(t => {
          if (t.type !== 'expense') return false;
          const txMonth = (t.date instanceof Date ? t.date : new Date(t.date)).toISOString().slice(0, 7);
          return txMonth === currentMonth && budget.category && t.category.id === budget.category.id;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      if (spent <= budget.amount) {
        withinBudget++;
      }
    }

    budgetAdherence = withinBudget / budgets.length;
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
    incomeCV,
  };
}

export function getHealthScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Needs Work';
  return 'Critical';
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}
