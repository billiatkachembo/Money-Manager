import { Account, Budget, DebtAccount, Insight, Transaction } from '../../types/transaction';
import { getAccountTypeDefinition } from '../../constants/account-types';
import { formatDateDDMMYYYY } from '../../utils/date';
import { roundCurrency } from './ledger';
import { computeDebtPortfolioTotals } from './debt-portfolio';

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
  projectedRunOutDate: Date | null;
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDaysToDate(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function normalizePartialMonthTotal(total: number, bucketMonth: string, referenceDate: Date): number {
  if (bucketMonth != monthKey(referenceDate)) {
    return total;
  }

  const daysElapsed = Math.max(1, referenceDate.getDate());
  const daysInMonth = getDaysInMonth(referenceDate);
  const progress = Math.min(1, daysElapsed / daysInMonth);
  return progress >= 1 ? total : total / progress;
}

function isLiquidAccount(account: Account): boolean {
  const definition = getAccountTypeDefinition(account.type);
  return definition.group === 'cash_bank' || definition.group === 'savings';
}

function computeLiquidBalanceFromAccounts(accounts: Account[]): number {
  return roundCurrency(
    accounts
      .filter((account) => account.isActive !== false && isLiquidAccount(account))
      .reduce((sum, account) => sum + Math.max(0, Number(account.balance ?? 0)), 0)
  );
}

function resolveBudgetForCategory(budgets: Budget[], categoryId: string): Budget | undefined {
  const matches = budgets.filter((budget) => budget.category?.id === categoryId || budget.categoryId === categoryId);
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

function roundToNiceTarget(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const steps = [1, 1.5, 2, 2.5, 3, 5, 7.5, 10];
  const step = steps.find((candidate) => normalized <= candidate) ?? 10;
  return roundCurrency(step * magnitude);
}

function computePlanningAnchor(currentNetWorth: number, monthlyIncome: number, monthlyExpenses: number): number {
  const netWorthAnchor = currentNetWorth > 0 ? currentNetWorth / 4 : 0;
  return Math.max(monthlyIncome, monthlyExpenses, netWorthAnchor, 100);
}

export function computeStarterInvestmentTarget(
  currentNetWorth: number,
  monthlyIncome: number,
  monthlyExpenses: number
): number {
  const anchor = computePlanningAnchor(currentNetWorth, monthlyIncome, monthlyExpenses);
  return roundToNiceTarget(Math.max(anchor * 0.25, 100));
}

export function buildWealthMilestoneLadder(
  currentNetWorth: number,
  monthlyIncome: number,
  monthlyExpenses: number
): number[] {
  const anchor = roundToNiceTarget(Math.max(computePlanningAnchor(currentNetWorth, monthlyIncome, monthlyExpenses), 250));
  const ratios = [1, 2, 3, 6, 12, 24, 60];
  const milestones: number[] = [];

  for (const ratio of ratios) {
    const candidate = roundToNiceTarget(anchor * ratio);
    if (candidate > 0 && (milestones.length === 0 || candidate > milestones[milestones.length - 1])) {
      milestones.push(candidate);
    }
  }

  while (milestones.length < ratios.length) {
    const last = milestones[milestones.length - 1] ?? anchor;
    const candidate = roundToNiceTarget(last * 2);
    if (candidate > last) {
      milestones.push(candidate);
      continue;
    }
    milestones.push(roundCurrency(last * 2));
  }

  return milestones;
}

function computeRecentMonthlySnapshot(
  transactions: Transaction[],
  referenceDate: Date,
  months = 3
): { averageIncome: number; averageExpenses: number; averageNet: number } | null {
  const monthWindow = buildMonthWindow(months, referenceDate);
  const monthIndex = new Map(monthWindow.map((key, index) => [key, index]));
  const totals = monthWindow.map(() => ({ income: 0, expenses: 0 }));

  for (const transaction of transactions) {
    if (transaction.type !== 'income' && transaction.type !== 'expense') {
      continue;
    }

    const index = monthIndex.get(monthKey(transaction.date));
    if (index === undefined) {
      continue;
    }

    if (transaction.type === 'income') {
      totals[index].income += transaction.amount;
    } else {
      totals[index].expenses += transaction.amount;
    }
  }

  const hasData = totals.some((entry) => entry.income > 0 || entry.expenses > 0);
  if (!hasData) {
    return null;
  }

  const normalizedTotals = totals.map((entry, index) => {
    const bucketMonth = monthWindow[index] ?? monthKey(referenceDate);
    return {
      income: normalizePartialMonthTotal(entry.income, bucketMonth, referenceDate),
      expenses: normalizePartialMonthTotal(entry.expenses, bucketMonth, referenceDate),
    };
  });

  const divisor = monthWindow.length;
  const income = normalizedTotals.reduce((sum, entry) => sum + entry.income, 0) / divisor;
  const expenses = normalizedTotals.reduce((sum, entry) => sum + entry.expenses, 0) / divisor;

  return {
    averageIncome: roundCurrency(income),
    averageExpenses: roundCurrency(expenses),
    averageNet: roundCurrency(income - expenses),
  };
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
  const safeBalance = Math.max(0, roundCurrency(balance));
  const safeMonthlyExpenses = Math.max(0, roundCurrency(monthlyExpenses));
  const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(daysInMonth - referenceDate.getDate() + 1, 1);
  const dailyBurnRate = safeMonthlyExpenses > 0 ? safeMonthlyExpenses / daysInMonth : 0;
  const rawDaysUntilEmpty = dailyBurnRate > 0 ? safeBalance / dailyBurnRate : null;
  const daysUntilEmpty = rawDaysUntilEmpty !== null ? roundCurrency(rawDaysUntilEmpty) : null;
  const projectedRunOutDate = rawDaysUntilEmpty !== null
    ? addDaysToDate(startOfDay(referenceDate), Math.max(0, Math.ceil(rawDaysUntilEmpty) - 1))
    : null;
  const willRunOut = rawDaysUntilEmpty !== null ? rawDaysUntilEmpty < remainingDays : false;

  return {
    dailyBurnRate: roundCurrency(dailyBurnRate),
    daysUntilEmpty,
    remainingDaysInMonth: remainingDays,
    willRunOut,
    projectedRunOutDate,
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
  const previousMilestone = nextMilestone
    ? sorted
        .slice()
        .reverse()
        .find((value) => value <= currentNetWorth) ?? 0
    : sorted[sorted.length - 1] ?? 0;
  const span = nextMilestone !== null ? nextMilestone - previousMilestone : 0;
  const progressRatio = nextMilestone !== null
    ? span > 0
      ? Math.min(1, Math.max(0, (currentNetWorth - previousMilestone) / span))
      : Math.min(1, Math.max(0, currentNetWorth / nextMilestone))
    : 1;
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

function applyDebtRepaymentsToDebtAccounts(
  debtAccounts: DebtAccount[],
  totalRepayments: number
): DebtAccount[] {
  const safeRepayments = Math.max(0, roundCurrency(totalRepayments));
  if (safeRepayments <= 0) {
    return debtAccounts;
  }

  const borrowedAccounts = debtAccounts.filter((account) => account.direction === 'borrowed' && account.balance > 0);
  const totalBorrowed = borrowedAccounts.reduce((sum, account) => sum + account.balance, 0);
  if (totalBorrowed <= 0) {
    return debtAccounts;
  }

  let remainingReduction = Math.min(safeRepayments, totalBorrowed);
  const balances = new Map<string, number>();

  borrowedAccounts.forEach((account, index) => {
    const isLast = index === borrowedAccounts.length - 1;
    const proportionalReduction = isLast
      ? remainingReduction
      : roundCurrency(safeRepayments * (account.balance / totalBorrowed));
    const reduction = Math.min(account.balance, remainingReduction, Math.max(0, proportionalReduction));
    balances.set(account.id, roundCurrency(account.balance - reduction));
    remainingReduction = roundCurrency(Math.max(0, remainingReduction - reduction));
  });

  return debtAccounts.map((account) => (
    account.direction === 'borrowed' && balances.has(account.id)
      ? { ...account, balance: balances.get(account.id) ?? account.balance }
      : account
  ));
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
      message: `At your recent expense pace, your liquid balance could run out in ${days} days${params.cashflowRunway.projectedRunOutDate ? `, around ${formatDateDDMMYYYY(params.cashflowRunway.projectedRunOutDate)}` : ''}.`,
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
      message: `At your recent saving pace, you could reach ${params.formatCurrency(params.milestones.nextMilestone)} in about ${timeText}.`,
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
  accounts: Account[];
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
  const recentMonthlySnapshot = computeRecentMonthlySnapshot(params.transactions, referenceDate, 3);
  const baselineMonthlyIncome = recentMonthlySnapshot?.averageIncome ?? params.monthlyIncome;
  const baselineMonthlyExpenses = recentMonthlySnapshot?.averageExpenses ?? params.monthlyExpenses;
  const monthlySavings = Math.max(0, recentMonthlySnapshot?.averageNet ?? params.monthlyNet);
  const annualReturn = 0.05;

  const budgetSuggestions = computeBudgetSuggestions(params.transactions, params.budgets, 6, referenceDate);
  const liquidBalance = computeLiquidBalanceFromAccounts(params.accounts);
  const debtPortfolio = computeDebtPortfolioTotals(params.accounts, params.transactions);
  const effectiveNetWorth = roundCurrency(params.netBalance + debtPortfolio.lentOutstanding - debtPortfolio.borrowedOutstanding);
  const cashflowRunway = computeCashflowRunway(liquidBalance, baselineMonthlyExpenses, referenceDate);
  const netWorthSimulation = simulateNetWorthGrowth({
    currentNetWorth: effectiveNetWorth,
    monthlySavings,
    annualReturn,
    years: 10,
  });
  const debtPayoff = computeDebtPayoffPlan(
    applyDebtRepaymentsToDebtAccounts(params.debtAccounts, debtPortfolio.debtRepayments),
    {
      defaultAnnualRate: params.averageDebtInterestRate ?? 0.18,
      extraPayment: Math.max(0, monthlySavings),
    }
  );
  const milestones = computeWealthMilestones(
    effectiveNetWorth,
    monthlySavings,
    0,
    buildWealthMilestoneLadder(effectiveNetWorth, baselineMonthlyIncome, baselineMonthlyExpenses)
  );

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







