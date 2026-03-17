import { Budget, DebtAccount, Insight, Transaction } from '../../types/transaction';
import { roundCurrency } from './ledger';

export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  averageMonthlySpending: number;
  spendingVariance: number;
  highestMonth: number;
  lowestMonth: number;
  suggestedBudget: number;
  currentBudget?: number;
  monthsAnalyzed: number;
  exceededMonths: number;
  underspentMonths: number;
  note: string;
}

export interface CashflowRunway {
  dailyBurnRate: number;
  daysUntilEmpty: number | null;
  remainingDaysInMonth: number;
  willRunOut: boolean;
}

export interface NetWorthSimulationPoint {
  year: number;
  netWorth: number;
  contributions: number;
  growth: number;
}

export interface NetWorthSimulation {
  years: number;
  annualReturn: number;
  monthlySavings: number;
  currentNetWorth: number;
  futureValue: number;
  totalContributions: number;
  investmentGrowth: number;
  points: NetWorthSimulationPoint[];
}

export interface DebtPayoffSummary {
  strategy: 'snowball' | 'avalanche';
  months: number;
  totalInterest: number;
  totalPaid: number;
}

export interface DebtPayoffPlan {
  totalDebt: number;
  extraPayment: number;
  snowball: DebtPayoffSummary;
  avalanche: DebtPayoffSummary;
  recommendedStrategy: 'snowball' | 'avalanche';
  interestSaved: number;
  monthsSaved: number;
}

export interface MilestoneProgress {
  milestones: number[];
  currentNetWorth: number;
  nextMilestone: number | null;
  progressRatio: number;
  estimatedYears: number | null;
  achievedMilestones: number[];
}

export interface FinancialIntelligence {
  budgetSuggestions: BudgetSuggestion[];
  cashflowRunway: CashflowRunway;
  netWorthSimulation: NetWorthSimulation;
  debtPayoff: DebtPayoffPlan | null;
  milestones: MilestoneProgress;
  insights: Insight[];
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthWindow(months: number, referenceDate: Date): string[] {
  const safeMonths = Math.max(1, Math.min(12, Math.floor(months)));
  return Array.from({ length: safeMonths }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (safeMonths - 1 - index), 1);
    return monthKey(date);
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function resolveBudgetForCategory(budgets: Budget[], categoryId: string): Budget | undefined {
  const matches = budgets.filter((budget) => budget.category?.id === categoryId || budget.categoryId === categoryId);
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

export function computeBudgetSuggestions(
  transactions: Transaction[],
  budgets: Budget[],
  months = 6,
  referenceDate: Date = new Date()
): BudgetSuggestion[] {
  const monthWindow = buildMonthWindow(months, referenceDate);
  const monthIndex = new Map(monthWindow.map((key, index) => [key, index]));
  const categoryMap = new Map<string, { name: string; totals: number[] }>();

  const incomeTotals = new Array(monthWindow.length).fill(0);

  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    const index = monthIndex.get(key);
    if (index === undefined) {
      continue;
    }

    if (transaction.type === 'income') {
      incomeTotals[index] += transaction.amount;
      continue;
    }

    if (transaction.type !== 'expense') {
      continue;
    }

    const categoryId = transaction.category?.id ?? 'uncategorized';
    const existing = categoryMap.get(categoryId);
    if (existing) {
      existing.totals[index] += transaction.amount;
      continue;
    }

    categoryMap.set(categoryId, {
      name: transaction.category?.name ?? 'Uncategorized',
      totals: monthWindow.map((_, offset) => (offset === index ? transaction.amount : 0)),
    });
  }

  const averageMonthlyIncome = incomeTotals.reduce((sum, value) => sum + value, 0) / monthWindow.length;
  const budgetCap = Math.max(0, averageMonthlyIncome * 0.7);

  const suggestions: BudgetSuggestion[] = [];

  categoryMap.forEach((entry, categoryId) => {
    const totals = entry.totals;
    const avg = average(totals);
    const variance = standardDeviation(totals);
    const highest = Math.max(...totals);
    const lowest = Math.min(...totals);

    const currentBudget = resolveBudgetForCategory(budgets, categoryId);
    const budgetAmount = currentBudget?.amount;

    let exceededMonths = 0;
    let underspentMonths = 0;

    if (budgetAmount && budgetAmount > 0) {
      for (const value of totals) {
        if (value > budgetAmount) {
          exceededMonths += 1;
        } else if (value < budgetAmount * 0.7) {
          underspentMonths += 1;
        }
      }
    }

    let suggested = avg * 1.1;
    const exceedRatio = budgetAmount ? exceededMonths / totals.length : 0;
    const underspendRatio = budgetAmount ? underspentMonths / totals.length : 0;

    if (exceedRatio >= 0.4) {
      suggested *= 1.15;
    }

    if (underspendRatio >= 0.6) {
      suggested *= 0.9;
    }

    suggested = roundCurrency(suggested);

    if (suggested <= 0) {
      return;
    }

    let note = `Based on the last ${totals.length} months of spending.`;
    if (exceedRatio >= 0.4) {
      note = 'You exceeded this budget frequently. Suggesting a higher buffer.';
    } else if (underspendRatio >= 0.6) {
      note = 'You underspent consistently. Suggesting a leaner budget.';
    }

    suggestions.push({
      categoryId,
      categoryName: entry.name,
      averageMonthlySpending: roundCurrency(avg),
      spendingVariance: roundCurrency(variance),
      highestMonth: roundCurrency(highest),
      lowestMonth: roundCurrency(lowest),
      suggestedBudget: suggested,
      currentBudget: budgetAmount,
      monthsAnalyzed: totals.length,
      exceededMonths,
      underspentMonths,
      note,
    });
  });

  if (budgetCap > 0) {
    const totalSuggested = suggestions.reduce((sum, item) => sum + item.suggestedBudget, 0);
    if (totalSuggested > budgetCap && totalSuggested > 0) {
      const scale = budgetCap / totalSuggested;
      return suggestions.map((item) => ({
        ...item,
        suggestedBudget: roundCurrency(item.suggestedBudget * scale),
        note: `${item.note} Adjusted to keep budgets within 70% of income.`,
      }));
    }
  }

  return suggestions.sort((a, b) => b.suggestedBudget - a.suggestedBudget);
}

export function computeCashflowRunway(
  balance: number,
  monthlyExpenses: number,
  referenceDate: Date = new Date()
): CashflowRunway {
  const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  const daysPassed = Math.max(1, referenceDate.getDate());
  const remainingDays = Math.max(daysInMonth - referenceDate.getDate() + 1, 1);
  const dailyBurnRate = monthlyExpenses > 0 ? monthlyExpenses / daysPassed : 0;
  const daysUntilEmpty = dailyBurnRate > 0 ? balance / dailyBurnRate : null;
  const willRunOut = daysUntilEmpty !== null ? daysUntilEmpty < remainingDays : false;

  return {
    dailyBurnRate: roundCurrency(dailyBurnRate),
    daysUntilEmpty: daysUntilEmpty !== null ? roundCurrency(daysUntilEmpty) : null,
    remainingDaysInMonth: remainingDays,
    willRunOut,
  };
}

export function simulateNetWorthGrowth(options: {
  currentNetWorth: number;
  monthlySavings: number;
  annualReturn: number;
  years: number;
}): NetWorthSimulation {
  const years = Math.max(1, Math.min(40, Math.floor(options.years)));
  const annualReturn = Math.max(0, options.annualReturn);
  const monthlyRate = annualReturn / 12;
  const points: NetWorthSimulationPoint[] = [];

  for (let year = 0; year <= years; year += 1) {
    const months = year * 12;
    const growthFactor = monthlyRate > 0 ? (1 + monthlyRate) ** months : 1;
    const contributionFactor = monthlyRate > 0
      ? ((1 + monthlyRate) ** months - 1) / monthlyRate
      : months;

    const futureValue = options.currentNetWorth * growthFactor + options.monthlySavings * contributionFactor;
    const contributions = options.monthlySavings * months;
    const growth = futureValue - options.currentNetWorth - contributions;

    points.push({
      year,
      netWorth: roundCurrency(futureValue),
      contributions: roundCurrency(contributions),
      growth: roundCurrency(growth),
    });
  }

  const final = points[points.length - 1];

  return {
    years,
    annualReturn,
    monthlySavings: roundCurrency(options.monthlySavings),
    currentNetWorth: roundCurrency(options.currentNetWorth),
    futureValue: final ? final.netWorth : roundCurrency(options.currentNetWorth),
    totalContributions: final ? final.contributions : 0,
    investmentGrowth: final ? final.growth : 0,
    points,
  };
}

function estimateMonthsToTarget(
  currentNetWorth: number,
  target: number,
  monthlySavings: number,
  annualReturn: number
): number | null {
  if (target <= currentNetWorth) {
    return 0;
  }
  if (monthlySavings <= 0 && annualReturn <= 0) {
    return null;
  }

  const monthlyRate = annualReturn / 12;
  let balance = currentNetWorth;
  let months = 0;

  while (balance < target && months < 600) {
    balance = balance * (1 + monthlyRate) + monthlySavings;
    months += 1;
  }

  return months < 600 ? months : null;
}

export function computeWealthMilestones(
  currentNetWorth: number,
  monthlySavings: number,
  annualReturn: number,
  milestones: number[] = [10000, 25000, 50000, 100000, 250000, 500000, 1000000]
): MilestoneProgress {
  const sorted = milestones.slice().sort((a, b) => a - b);
  const achieved = sorted.filter((value) => currentNetWorth >= value);
  const nextMilestone = sorted.find((value) => value > currentNetWorth) ?? null;
  const progressRatio = nextMilestone ? Math.min(1, currentNetWorth / nextMilestone) : 1;
  const monthsToTarget = nextMilestone
    ? estimateMonthsToTarget(currentNetWorth, nextMilestone, monthlySavings, annualReturn)
    : null;

  return {
    milestones: sorted,
    currentNetWorth: roundCurrency(currentNetWorth),
    nextMilestone,
    progressRatio,
    estimatedYears: monthsToTarget !== null ? roundCurrency(monthsToTarget / 12) : null,
    achievedMilestones: achieved,
  };
}

interface DebtInput {
  id: string;
  balance: number;
  annualRate: number;
  minimumPayment: number;
}

function buildDebtInputs(
  debtAccounts: DebtAccount[],
  defaultAnnualRate: number,
  extraPayment: number
): { debts: DebtInput[]; extraPayment: number } {
  const debts = debtAccounts
    .filter((account) => account.direction === 'borrowed' && account.balance > 0)
    .map((account) => {
      const rate = Number.isFinite(account.interestRate) ? Number(account.interestRate) : defaultAnnualRate;
      const minPayment = Math.max(account.balance * 0.02, 25);
      return {
        id: account.id,
        balance: account.balance,
        annualRate: Math.max(rate, 0),
        minimumPayment: roundCurrency(minPayment),
      };
    });

  return { debts, extraPayment: Math.max(0, extraPayment) };
}

function simulateDebtPayoff(
  debts: DebtInput[],
  strategy: 'snowball' | 'avalanche',
  extraPayment: number,
  maxMonths = 600
): DebtPayoffSummary {
  const items = debts.map((debt) => ({ ...debt }));
  let totalInterest = 0;
  let totalPaid = 0;
  let months = 0;

  const hasBalance = () => items.some((item) => item.balance > 0.01);

  while (hasBalance() && months < maxMonths) {
    for (const item of items) {
      if (item.balance <= 0) {
        continue;
      }
      const interest = item.balance * (item.annualRate / 12);
      item.balance = roundCurrency(item.balance + interest);
      totalInterest += interest;
    }

    const ordered = items
      .filter((item) => item.balance > 0)
      .sort((a, b) => {
        if (strategy === 'snowball') {
          return a.balance - b.balance;
        }
        if (b.annualRate === a.annualRate) {
          return b.balance - a.balance;
        }
        return b.annualRate - a.annualRate;
      });

    for (const item of items) {
      if (item.balance <= 0) {
        continue;
      }
      const payment = Math.min(item.minimumPayment, item.balance);
      item.balance = roundCurrency(item.balance - payment);
      totalPaid += payment;
    }

    if (extraPayment > 0 && ordered.length > 0) {
      const target = ordered[0];
      const extra = Math.min(extraPayment, target.balance);
      target.balance = roundCurrency(target.balance - extra);
      totalPaid += extra;
    }

    months += 1;
  }

  return {
    strategy,
    months,
    totalInterest: roundCurrency(totalInterest),
    totalPaid: roundCurrency(totalPaid),
  };
}

export function computeDebtPayoffPlan(
  debtAccounts: DebtAccount[],
  options: { defaultAnnualRate: number; extraPayment: number } = { defaultAnnualRate: 0.18, extraPayment: 0 }
): DebtPayoffPlan | null {
  const { debts, extraPayment } = buildDebtInputs(
    debtAccounts,
    options.defaultAnnualRate,
    options.extraPayment
  );

  if (debts.length === 0) {
    return null;
  }

  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const snowball = simulateDebtPayoff(debts, 'snowball', extraPayment);
  const avalanche = simulateDebtPayoff(debts, 'avalanche', extraPayment);

  const recommendedStrategy =
    avalanche.months < snowball.months || avalanche.totalInterest < snowball.totalInterest
      ? 'avalanche'
      : 'snowball';

  const interestSaved = roundCurrency(snowball.totalInterest - avalanche.totalInterest);
  const monthsSaved = snowball.months - avalanche.months;

  return {
    totalDebt: roundCurrency(totalDebt),
    extraPayment: roundCurrency(extraPayment),
    snowball,
    avalanche,
    recommendedStrategy,
    interestSaved: roundCurrency(Math.max(0, interestSaved)),
    monthsSaved: Math.max(0, monthsSaved),
  };
}

export function buildFinancialIntelligenceInsights(params: {
  cashflowRunway: CashflowRunway;
  budgetSuggestions: BudgetSuggestion[];
  milestones: MilestoneProgress;
  netWorthSimulation: NetWorthSimulation;
  debtPayoff: DebtPayoffPlan | null;
  formatCurrency: (value: number) => string;
}): Insight[] {
  const insights: Insight[] = [];

  if (params.cashflowRunway.daysUntilEmpty !== null && params.cashflowRunway.willRunOut) {
    const days = Math.max(0, Math.floor(params.cashflowRunway.daysUntilEmpty));
    insights.push({
      id: 'cashflow-runout',
      title: 'Cashflow runway',
      message: `At this pace, your balance could run out in ${days} days.`,
      severity: 'warning',
      confidence: 0.8,
    });
  }

  const topSuggestion = params.budgetSuggestions[0];
  if (topSuggestion) {
    insights.push({
      id: `budget-suggestion-${topSuggestion.categoryId}`,
      title: 'Smart budget suggestion',
      message: `${topSuggestion.categoryName}: suggested ${params.formatCurrency(topSuggestion.suggestedBudget)} based on recent spending.`,
      severity: 'info',
      confidence: 0.7,
    });
  }

  if (params.milestones.nextMilestone) {
    const years = params.milestones.estimatedYears;
    const timeText = years !== null ? `${years} years` : 'an unknown time';
    insights.push({
      id: 'milestone-progress',
      title: 'Wealth milestone',
      message: `You could reach ${params.formatCurrency(params.milestones.nextMilestone)} in about ${timeText}.`,
      severity: 'info',
      confidence: 0.6,
    });
  }

  if (params.debtPayoff && params.debtPayoff.interestSaved > 0) {
    insights.push({
      id: 'debt-optimizer',
      title: 'Debt payoff optimizer',
      message: `Avalanche could save ${params.formatCurrency(params.debtPayoff.interestSaved)} in interest.`,
      severity: 'info',
      confidence: 0.65,
    });
  }

  return insights;
}

export function computeFinancialIntelligence(params: {
  transactions: Transaction[];
  budgets: Budget[];
  debtAccounts: DebtAccount[];
  netBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
  formatCurrency: (value: number) => string;
  averageDebtInterestRate?: number;
  referenceDate?: Date;
}): FinancialIntelligence {
  const referenceDate = params.referenceDate ?? new Date();
  const monthlySavings = Math.max(0, params.monthlyNet);
  const annualReturn = 0.05;

  const budgetSuggestions = computeBudgetSuggestions(params.transactions, params.budgets, 6, referenceDate);
  const cashflowRunway = computeCashflowRunway(params.netBalance, params.monthlyExpenses, referenceDate);
  const netWorthSimulation = simulateNetWorthGrowth({
    currentNetWorth: params.netBalance,
    monthlySavings,
    annualReturn,
    years: 10,
  });
  const debtPayoff = computeDebtPayoffPlan(params.debtAccounts, {
    defaultAnnualRate: params.averageDebtInterestRate ?? 0.18,
    extraPayment: Math.max(0, monthlySavings),
  });
  const milestones = computeWealthMilestones(params.netBalance, monthlySavings, annualReturn);

  const hasTransactions = params.transactions.length > 0;
  const insights = hasTransactions
    ? buildFinancialIntelligenceInsights({
        cashflowRunway,
        budgetSuggestions,
        milestones,
        netWorthSimulation,
        debtPayoff,
        formatCurrency: params.formatCurrency,
      })
    : [];

  return {
    budgetSuggestions,
    cashflowRunway,
    netWorthSimulation,
    debtPayoff,
    milestones,
    insights,
  };
}




