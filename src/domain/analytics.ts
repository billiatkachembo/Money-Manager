import { Account, Budget, Transaction } from '../../types/transaction';
import {
  getFarmCostBreakdown,
  isFarmExpense,
  isFarmIncome,
} from './farming';
import { InsightContext } from './insights';
import { computeBudgetSpendingForDate, getActiveBudgets } from './budgeting';

export interface MonthlySummary {
  month: string;
  income: number;
  expenses: number;
  transfers: number;
  net: number;
}

export interface BudgetSummary {
  adherence: number;
  risk: number;
}

export interface ExpenseCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color: string;
  amount: number;
  share: number;
  transactionCount: number;
}

export interface ExpenseDistributionSlice {
  name: string;
  amount: number;
  color: string;
  share: number;
}

export interface AnalyticsQuickStats {
  transactionCount: number;
  expenseTransactionCount: number;
  activeCategories: number;
  averageDailySpend: number;
  netAmount: number;
  income: number;
  expenses: number;
}

export interface BehaviorMetrics {
  monthly: MonthlySummary[];
  currentMonth: MonthlySummary;
  budget: BudgetSummary;
  insightContext: InsightContext;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthWindow(months: number, referenceDate: Date): string[] {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (months - 1 - index), 1);
    return monthKey(date);
  });
}

function computeMonthlySummaries(
  transactions: Transaction[],
  months: number,
  referenceDate: Date
): MonthlySummary[] {
  const keys = buildMonthWindow(months, referenceDate);
  const map = new Map<string, MonthlySummary>(
    keys.map((month) => [
      month,
      {
        month,
        income: 0,
        expenses: 0,
        transfers: 0,
        net: 0,
      },
    ])
  );

  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    const target = map.get(key);
    if (!target) {
      continue;
    }

    if (transaction.type === 'income') {
      target.income += transaction.amount;
    } else if (transaction.type === 'expense') {
      target.expenses += transaction.amount;
    } else {
      target.transfers += transaction.amount;
    }
  }

  return keys.map((key) => {
    const summary = map.get(key)!;
    return {
      ...summary,
      net: summary.income - summary.expenses,
    };
  });
}

function computeBudgetSummary(
  budgets: Budget[],
  transactions: Transaction[],
  referenceDate: Date
): BudgetSummary {
  if (budgets.length === 0) {
    return {
      adherence: 1,
      risk: 0,
    };
  }

  const activeBudgets = getActiveBudgets(budgets, referenceDate);
  if (activeBudgets.length === 0) {
    return {
      adherence: 1,
      risk: 0,
    };
  }

  let adherenceTotal = 0;
  let totalBudget = 0;
  let totalSpent = 0;

  for (const budget of activeBudgets) {
    const spent = computeBudgetSpendingForDate(budget, transactions, referenceDate);

    totalBudget += budget.amount;
    totalSpent += spent;

    const overage = Math.max(0, spent - budget.amount);
    const adherence = budget.amount > 0 ? 1 - overage / budget.amount : 1;
    adherenceTotal += Math.max(0, adherence);
  }

  return {
    adherence: adherenceTotal / activeBudgets.length,
    risk: totalBudget > 0 ? totalSpent / totalBudget : 0,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function sumTransactions(transactions: Transaction[], type: Transaction['type']): number {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]): number {
  const meaningful = values.filter((value) => value > 0);
  if (meaningful.length < 2) {
    return 0;
  }

  const mean = average(meaningful);
  if (mean <= 0) {
    return 0;
  }

  return standardDeviation(meaningful) / mean;
}

function computePositiveNetStreak(monthly: MonthlySummary[]): number {
  let streak = 0;

  for (let index = monthly.length - 1; index >= 0; index -= 1) {
    if (monthly[index].net > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function computeLiquidBalance(accounts: Account[]): number {
  return accounts
    .filter((account) => account.type !== 'credit' && account.isActive !== false)
    .reduce((sum, account) => sum + Math.max(0, account.balance), 0);
}

export function computeExpenseCategoryBreakdown(
  transactions: Transaction[]
): ExpenseCategoryBreakdown[] {
  const expenseTransactions = transactions.filter((transaction) => transaction.type === 'expense');
  const totalExpenses = expenseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const grouped = new Map<string, ExpenseCategoryBreakdown>();

  for (const transaction of expenseTransactions) {
    const categoryId = transaction.category?.id?.trim() || 'uncategorized';
    const current = grouped.get(categoryId);

    if (current) {
      current.amount += transaction.amount;
      current.transactionCount += 1;
      continue;
    }

    grouped.set(categoryId, {
      categoryId,
      categoryName: transaction.category?.name?.trim() || 'Uncategorized',
      color: transaction.category?.color || '#94A3B8',
      amount: transaction.amount,
      share: 0,
      transactionCount: 1,
    });
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      share: ratio(entry.amount, totalExpenses),
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function computeExpenseDistribution(
  breakdown: ExpenseCategoryBreakdown[],
  limit = 5
): ExpenseDistributionSlice[] {
  if (breakdown.length === 0) {
    return [];
  }

  const safeLimit = Math.max(1, limit);
  const totalExpenses = breakdown.reduce((sum, entry) => sum + entry.amount, 0);
  const topCategories = breakdown.slice(0, safeLimit).map((entry) => ({
    name: entry.categoryName,
    amount: entry.amount,
    color: entry.color,
    share: entry.share,
  }));
  const otherAmount = breakdown
    .slice(safeLimit)
    .reduce((sum, entry) => sum + entry.amount, 0);

  if (otherAmount <= 0) {
    return topCategories;
  }

  return [
    ...topCategories,
    {
      name: 'Other',
      amount: otherAmount,
      color: '#94A3B8',
      share: ratio(otherAmount, totalExpenses),
    },
  ];
}

export function computeQuickStats(
  transactions: Transaction[],
  elapsedDays = 1
): AnalyticsQuickStats {
  const safeElapsedDays = Math.max(1, elapsedDays);
  const expenses = sumTransactions(transactions, 'expense');
  const income = sumTransactions(transactions, 'income');
  const expenseBreakdown = computeExpenseCategoryBreakdown(transactions);

  return {
    transactionCount: transactions.length,
    expenseTransactionCount: transactions.filter((transaction) => transaction.type === 'expense').length,
    activeCategories: expenseBreakdown.length,
    averageDailySpend: expenses / safeElapsedDays,
    netAmount: income - expenses,
    income,
    expenses,
  };
}

export function computeBehaviorMetrics(
  transactions: Transaction[],
  budgets: Budget[],
  accounts: Account[],
  now: Date = new Date()
): BehaviorMetrics {
  const monthly = computeMonthlySummaries(transactions, 6, now);
  const currentMonth = monthly[monthly.length - 1] ?? {
    month: monthKey(now),
    income: 0,
    expenses: 0,
    transfers: 0,
    net: 0,
  };

  const budget = computeBudgetSummary(budgets, transactions, now);
  const previousMonths = monthly.slice(0, Math.max(0, monthly.length - 1));
  const previousExpenseAverage = average(previousMonths.map((entry) => entry.expenses).filter((value) => value > 0));
  const previousIncomeAverage = average(previousMonths.map((entry) => entry.income).filter((value) => value > 0));

  const currentMonthTransactions = transactions.filter((transaction) => monthKey(transaction.date) === currentMonth.month);
  const recurringExpense = currentMonthTransactions
    .filter((transaction) => transaction.type === 'expense' && transaction.isRecurring)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const expenseTransactions = currentMonthTransactions.filter((transaction) => transaction.type === 'expense');
  const microExpenseCount = expenseTransactions.filter((transaction) => transaction.amount <= 10).length;

  const mostRecentIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .sort((left, right) => right.date.getTime() - left.date.getTime())[0];

  const daysSinceIncome = mostRecentIncome
    ? Math.floor((now.getTime() - mostRecentIncome.date.getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  const totalTurnover = currentMonth.income + currentMonth.expenses + currentMonth.transfers;
  const debt = accounts
    .filter((account) => account.type === 'credit')
    .reduce((sum, account) => sum + Math.abs(Math.min(0, account.balance)), 0);

  const farmExpenseThisMonth = currentMonthTransactions
    .filter(isFarmExpense)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const farmIncomeThisMonth = currentMonthTransactions
    .filter(isFarmIncome)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const farmCostBreakdown = getFarmCostBreakdown(currentMonthTransactions);
  const fertilizerShare =
    farmCostBreakdown.find((entry) => entry.categoryName.toLowerCase().includes('fertilizer'))?.ratio ?? 0;

  const previousFarmNet = previousMonths
    .map((entry) => {
      const monthTransactions = transactions.filter((transaction) => monthKey(transaction.date) === entry.month);
      const income = monthTransactions.filter(isFarmIncome).reduce((sum, transaction) => sum + transaction.amount, 0);
      const expenses = monthTransactions.filter(isFarmExpense).reduce((sum, transaction) => sum + transaction.amount, 0);
      return income - expenses;
    })
    .slice(-3);

  const averagePreviousFarmNet = average(previousFarmNet);
  const currentFarmNet = farmIncomeThisMonth - farmExpenseThisMonth;
  const farmLossRatio = currentFarmNet < 0
    ? Math.abs(currentFarmNet) / Math.max(farmIncomeThisMonth > 0 ? farmIncomeThisMonth : farmExpenseThisMonth, 1)
    : 0;
  const liquidBalance = computeLiquidBalance(accounts);
  const savingsRate = currentMonth.income > 0 ? Math.min(currentMonth.net / currentMonth.income, 1) : 0;
  const debtIncomeBase = currentMonth.income > 0 ? currentMonth.income : previousIncomeAverage;

  const insightContext: InsightContext = {
    monthlyIncome: currentMonth.income,
    monthlyExpenses: currentMonth.expenses,
    monthlyNet: currentMonth.net,
    previousMonthlyNet: previousMonths.length > 0 ? previousMonths[previousMonths.length - 1].net : 0,
    savingsRate,
    budgetAdherence: budget.adherence,
    budgetRisk: budget.risk,
    bufferMonths: currentMonth.expenses > 0 ? liquidBalance / currentMonth.expenses : 0,
    expenseCV: coefficientOfVariation(monthly.map((entry) => entry.expenses)),
    incomeCV: coefficientOfVariation(monthly.map((entry) => entry.income)),
    transferRatio: ratio(currentMonth.transfers, totalTurnover),
    recurringCommitmentRatio: currentMonth.income > 0 ? recurringExpense / currentMonth.income : 0,
    microExpenseRatio: ratio(microExpenseCount, expenseTransactions.length),
    expenseSpikeRatio: previousExpenseAverage > 0 ? currentMonth.expenses / previousExpenseAverage : 1,
    incomeDropRatio: previousIncomeAverage > 0 ? currentMonth.income / previousIncomeAverage : 1,
    daysSinceIncome,
    debtToIncomeRatio: debtIncomeBase > 0 ? debt / debtIncomeBase : debt > 0 ? 1 : 0,
    farmProfit: currentFarmNet,
    farmLossRatio,
    farmExpenseRatio: ratio(farmExpenseThisMonth, Math.max(currentMonth.expenses, 1)),
    farmFertilizerShare: fertilizerShare,
    seasonalFarmDelta: averagePreviousFarmNet !== 0
      ? (currentFarmNet - averagePreviousFarmNet) / Math.max(Math.abs(averagePreviousFarmNet), 1)
      : 0,
    positiveNetStreak: computePositiveNetStreak(monthly),
  };

  return {
    monthly,
    currentMonth,
    budget,
    insightContext,
  };
}
