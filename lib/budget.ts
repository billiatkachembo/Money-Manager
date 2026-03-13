import { Transaction, Budget } from '@/types/transaction';
import { computeBudgetSpendingForDate, getActiveBudgets } from '@/src/domain/budgeting';

export interface MonthlyBudgetUsage {
  month: string; // "YYYY-MM"
  spent: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
}

export interface BudgetTrend {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  monthlyUsages: MonthlyBudgetUsage[];
  projected?: MonthlyBudgetUsage; // prediction for current month if applicable
  willExceed?: boolean; // true if projected > budget
}

/** Helpers */
const computePercentage = (spent: number, budgetAmount: number): number =>
  budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

const getBudgetStatus = (percentage: number): 'safe' | 'warning' | 'exceeded' =>
  percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'safe';

export function getBudgetRiskSummary(
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): { overCount: number; nearCount: number; safeCount: number; total: number } {
  const referenceDate = new Date(`${month}-01T00:00:00.000Z`);
  const activeBudgets = getActiveBudgets(budgets, referenceDate);

  let overCount = 0;
  let nearCount = 0;
  let safeCount = 0;

  for (const budget of activeBudgets) {
    const spent = computeBudgetSpendingForDate(budget, transactions, referenceDate);
    const percentage = computePercentage(spent, budget.amount);

    if (percentage >= 100) {
      overCount += 1;
    } else if (percentage >= 80) {
      nearCount += 1;
    } else {
      safeCount += 1;
    }
  }

  return {
    overCount,
    nearCount,
    safeCount,
    total: activeBudgets.length,
  };
}
/**
 * Compute multi-month budget usage + projected alerts
 * @param budgets - all budgets
 * @param transactions - all transactions
 * @param months - array of "YYYY-MM" strings
 */
export function computeBudgetDashboard(
  budgets: Budget[],
  transactions: Transaction[],
  months: string[]
): BudgetTrend[] {
  const today = new Date();
  const currentMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;

  return budgets.map((budget) => {
    const monthlyUsages: MonthlyBudgetUsage[] = months.map((month) => {
      const referenceDate = new Date(`${month}-01T00:00:00.000Z`);
      const spent = computeBudgetSpendingForDate(budget, transactions, referenceDate);
      const percentage = computePercentage(spent, budget.amount);
      const status = getBudgetStatus(percentage);
      return { month, spent, percentage, status };
    });

    // Predict for current month if included
    let projected: MonthlyBudgetUsage | undefined;
    let willExceed = false;

    if (months.includes(currentMonth)) {
      const referenceDate = new Date(`${currentMonth}-01T00:00:00.000Z`);
      const spentSoFar = computeBudgetSpendingForDate(budget, transactions, referenceDate);
      const dayOfMonth = today.getUTCDate();
      const daysInMonth = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 0).getUTCDate();
      const dailyAverage = spentSoFar / dayOfMonth;
      const projectedSpent = dailyAverage * daysInMonth;
      const projectedPercentage = computePercentage(projectedSpent, budget.amount);
      const status = getBudgetStatus(projectedPercentage);

      projected = {
        month: currentMonth,
        spent: projectedSpent,
        percentage: projectedPercentage,
        status,
      };
      willExceed = projectedSpent >= budget.amount;
    }

    return {
      budgetId: budget.id,
      categoryId: budget.category?.id ?? '',
      categoryName: budget.category?.name ?? 'Unknown',
      monthlyUsages,
      projected,
      willExceed,
    };
  });
}
