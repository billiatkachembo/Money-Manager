import { Transaction, Budget, BudgetAlert } from '@/types/transaction';
import { computeBudgetSpendingForDate, getActiveBudgets } from '@/src/domain/budgeting';

export interface BudgetUsage {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
}

export function computeBudgetSpending(
  budget: Budget,
  transactions: Transaction[],
  month: string
): number {
  const referenceDate = new Date(`${month}-01T00:00:00.000Z`);
  return computeBudgetSpendingForDate(budget, transactions, referenceDate);
}

export function computeAllBudgetUsages(
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): BudgetUsage[] {
  return budgets.map(budget => {
    const spent = computeBudgetSpending(budget, transactions, month);
    const remaining = Math.max(0, budget.amount - spent);
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    let status: BudgetUsage['status'] = 'safe';
    if (percentage >= 100) status = 'exceeded';
    else if (percentage >= 80) status = 'warning';

    return {
      budgetId: budget.id,
      categoryId: budget.category?.id ?? '',
      categoryName: budget.category?.name ?? 'Unknown',
      budgetAmount: budget.amount,
      spent,
      remaining,
      percentage,
      status,
    };
  });
}

export function checkBudgetThresholds(
  budget: Budget,
  spent: number,
  existingAlerts: BudgetAlert[]
): { needsWarning: boolean; needsExceeded: boolean } {
  const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const budgetAlerts = existingAlerts.filter(a => a.budgetId === budget.id);
  const has80Alert = budgetAlerts.some(a => a.type === '80percent');
  const hasExceededAlert = budgetAlerts.some(a => a.type === 'exceeded');

  return {
    needsWarning: budget.alertAt80Percent && percentage >= 80 && percentage < 100 && !has80Alert,
    needsExceeded: budget.alertAtLimit && percentage >= 100 && !hasExceededAlert,
  };
}

export function getBudgetRiskSummary(
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): { overCount: number; nearCount: number; safeCount: number; total: number } {
  let overCount = 0;
  let nearCount = 0;
  let safeCount = 0;

  const activeBudgets = getActiveBudgets(
    budgets,
    new Date(`${month}-01T00:00:00.000Z`)
  );

  for (const budget of activeBudgets) {
    const spent = computeBudgetSpending(budget, transactions, month);
    const pct = budget.amount > 0 ? spent / budget.amount : 0;
    if (pct >= 1) overCount++;
    else if (pct >= 0.8) nearCount++;
    else safeCount++;
  }

  return { overCount, nearCount, safeCount, total: activeBudgets.length };
}
