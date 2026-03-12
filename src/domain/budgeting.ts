import { Budget, Transaction } from '../../types/transaction';

export interface BudgetWindow {
  start: Date;
  end: Date;
}

function normalizeDate(value: Date | string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addMonths(date: Date, count: number): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + count);
  const daysInTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, daysInTargetMonth));
  return next;
}

function addYears(date: Date, count: number): Date {
  const next = new Date(date);
  const month = next.getMonth();
  const day = next.getDate();
  next.setDate(1);
  next.setFullYear(next.getFullYear() + count);
  next.setMonth(month);
  const daysInTargetMonth = new Date(next.getFullYear(), month + 1, 0).getDate();
  next.setDate(Math.min(day, daysInTargetMonth));
  return next;
}

function addBudgetPeriod(date: Date, period: Budget['period']): Date {
  const next = new Date(date);

  if (period === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (period === 'yearly') {
    return addYears(next, 1);
  }

  return addMonths(next, 1);
}

export function getBudgetWindow(budget: Budget, referenceDate: Date = new Date()): BudgetWindow | null {
  const budgetStart = normalizeDate(budget.startDate);
  const rawReference = normalizeDate(referenceDate);
  const rawBudgetEnd = normalizeDate(budget.endDate);

  if (!budgetStart || !rawReference) {
    return null;
  }

  const start = startOfDay(budgetStart);
  const reference = rawReference;
  const budgetEnd = rawBudgetEnd ? endOfDay(rawBudgetEnd) : null;

  if (reference < start) {
    return null;
  }

  if (budgetEnd && reference > budgetEnd) {
    return null;
  }

  let windowStart = start;
  let nextWindowStart = addBudgetPeriod(windowStart, budget.period);

  while (nextWindowStart <= reference && (!budgetEnd || windowStart <= budgetEnd)) {
    windowStart = nextWindowStart;
    nextWindowStart = addBudgetPeriod(windowStart, budget.period);
  }

  let windowEnd = new Date(nextWindowStart.getTime() - 1);
  if (budgetEnd && windowEnd > budgetEnd) {
    windowEnd = budgetEnd;
  }

  return {
    start: windowStart,
    end: windowEnd,
  };
}

export function isBudgetActive(budget: Budget, referenceDate: Date = new Date()): boolean {
  return getBudgetWindow(budget, referenceDate) !== null;
}

export function getActiveBudgets(budgets: Budget[], referenceDate: Date = new Date()): Budget[] {
  return budgets.filter((budget) => isBudgetActive(budget, referenceDate));
}

export function computeBudgetSpendingForDate(
  budget: Budget,
  transactions: Transaction[],
  referenceDate: Date = new Date()
): number {
  const window = getBudgetWindow(budget, referenceDate);
  const categoryId = budget.categoryId || budget.category?.id;

  if (!window || !categoryId) {
    return 0;
  }

  return transactions
    .filter((transaction) => {
      const transactionDate = normalizeDate(transaction.date);
      if (!transactionDate) {
        return false;
      }

      return (
        transaction.type === 'expense' &&
        transaction.category.id === categoryId &&
        transactionDate >= window.start &&
        transactionDate <= window.end
      );
    })
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}
