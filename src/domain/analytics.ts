import { Account, Budget, Transaction } from '../../types/transaction';
import {
  getFarmCostBreakdown,
  getSeasonalFarmSummary,
  isFarmExpense,
  isFarmIncome,
} from './farming';
import { InsightContext } from './insights';

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

export interface BehaviorMetrics {
  monthly: MonthlySummary[];
  currentMonth: MonthlySummary;
  budget: BudgetSummary;
  insightContext: InsightContext;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function buildMonthWindow(months: number, referenceDate: Date): string[] {
  const entries: string[] = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
    date.setUTCMonth(date.getUTCMonth() - index);
    entries.push(monthKey(date));
  }

  return entries;
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

  const month = monthKey(referenceDate);
  const activeBudgets = budgets.filter((budget) => monthKey(budget.startDate) === month);
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
    const spent = transactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.category.id === budget.categoryId &&
          monthKey(transaction.date) === month
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);

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

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  const previousExpenseAverage = average(previousMonths.map((entry) => entry.expenses));
  const previousIncomeAverage = average(previousMonths.map((entry) => entry.income));

  const recurringExpense = transactions
    .filter((transaction) => transaction.type === 'expense' && transaction.isRecurring)
    .filter((transaction) => monthKey(transaction.date) === currentMonth.month)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const expenseTransactions = transactions.filter(
    (transaction) => transaction.type === 'expense' && monthKey(transaction.date) === currentMonth.month
  );
  const microExpenseCount = expenseTransactions.filter((transaction) => transaction.amount <= 10).length;

  const mostRecentIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .sort((left, right) => right.date.getTime() - left.date.getTime())[0];

  const daysSinceIncome = mostRecentIncome
    ? Math.floor((now.getTime() - mostRecentIncome.date.getTime()) / (1000 * 60 * 60 * 24))
    : 365;

  const totalTurnover = currentMonth.income + currentMonth.expenses + currentMonth.transfers;
  const debt = accounts
    .filter((account) => account.type === 'credit')
    .reduce((sum, account) => sum + Math.abs(Math.min(0, account.balance)), 0);

  const seasonalFarmSummary = getSeasonalFarmSummary(transactions, now);
  const farmExpenseThisMonth = transactions
    .filter((transaction) => monthKey(transaction.date) === currentMonth.month)
    .filter(isFarmExpense)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const farmIncomeThisMonth = transactions
    .filter((transaction) => monthKey(transaction.date) === currentMonth.month)
    .filter(isFarmIncome)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const farmCostBreakdown = getFarmCostBreakdown(transactions);
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

  const insightContext: InsightContext = {
    monthlyIncome: currentMonth.income,
    monthlyExpenses: currentMonth.expenses,
    monthlyNet: currentMonth.net,
    previousMonthlyNet: previousMonths.length > 0 ? previousMonths[previousMonths.length - 1].net : 0,
    savingsRate: ratio(currentMonth.net, Math.max(currentMonth.income, 1)),
    budgetAdherence: budget.adherence,
    budgetRisk: budget.risk,
    bufferMonths: ratio(
      accounts.reduce((sum, account) => sum + account.balance, 0),
      Math.max(currentMonth.expenses, 1)
    ),
    expenseCV: 0,
    incomeCV: 0,
    transferRatio: ratio(currentMonth.transfers, totalTurnover),
    recurringCommitmentRatio: ratio(recurringExpense, Math.max(currentMonth.income, 1)),
    microExpenseRatio: ratio(microExpenseCount, expenseTransactions.length),
    expenseSpikeRatio: ratio(currentMonth.expenses, Math.max(previousExpenseAverage, 1)),
    incomeDropRatio: ratio(currentMonth.income, Math.max(previousIncomeAverage, 1)),
    daysSinceIncome,
    debtToIncomeRatio: ratio(debt, Math.max(currentMonth.income, 1)),
    farmProfit: seasonalFarmSummary.farmProfit,
    farmExpenseRatio: ratio(farmExpenseThisMonth, Math.max(currentMonth.expenses, 1)),
    farmFertilizerShare: fertilizerShare,
    seasonalFarmDelta: ratio(currentFarmNet - averagePreviousFarmNet, Math.max(Math.abs(averagePreviousFarmNet), 1)),
    positiveNetStreak: computePositiveNetStreak(monthly),
  };

  return {
    monthly,
    currentMonth,
    budget,
    insightContext,
  };
}
