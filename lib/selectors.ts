import { Transaction, Budget, Account, FinancialGoal, FinancialHealthMetrics } from '@/types/transaction';
import { deriveNetBalance, getMonthlyIncome, getMonthlyExpenses } from './ledger';
import { computeFinancialHealthScore, deriveHealthMetrics } from './health-score';
import { getBudgetRiskSummary } from './budget';
import { hasFarmActivity, getSeasonalFarmSummary, getFarmProfitEstimate, FARM_EXPENSE_CATEGORY_IDS, FARM_INCOME_CATEGORY_IDS } from './farming';
import { generateInsights } from './insights';

type HealthMetrics = FinancialHealthMetrics;

export interface HomeSnapshot {
  netBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  budgetRisk: { overCount: number; nearCount: number; safeCount: number; total: number } | null;
  healthScore: number;
  healthMetrics: HealthMetrics;
  topInsight: { id: string; title: string; message: string; severity: string; confidence: number } | null;
  insightCount: number;
  recentTransactions: Transaction[];
  showFarm: boolean;
  farmSummary: {
    season: string;
    totalFarmIncome: number;
    totalFarmExpenses: number;
    profit: number;
  } | null;
}

export function selectTotalBalance(transactions: Transaction[]): number {
  return deriveNetBalance(transactions);
}

export function selectMonthlyCashFlow(
  transactions: Transaction[],
  month: string
): { income: number; expenses: number; net: number } {
  const income = getMonthlyIncome(transactions, month);
  const expenses = getMonthlyExpenses(transactions, month);
  return { income, expenses, net: income - expenses };
}

export function selectBudgetRisk(
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): { overCount: number; nearCount: number; safeCount: number; total: number } | null {
  if (budgets.length === 0) return null;
  return getBudgetRiskSummary(budgets, transactions, month);
}

export function selectFinancialHealth(
  transactions: Transaction[],
  budgets: Budget[],
  totalBalance: number
): { score: number; metrics: HealthMetrics } {
  const metrics = deriveHealthMetrics(transactions, budgets, totalBalance);
  const score = computeFinancialHealthScore(metrics);
  return { score, metrics };
}

export function selectFarmProfit(transactions: Transaction[], month?: string): number {
  let farmIncome = 0;
  let farmExpenses = 0;

  for (const tx of transactions) {
    if (month) {
      const txMonth = (tx.date instanceof Date ? tx.date : new Date(tx.date)).toISOString().slice(0, 7);
      if (txMonth !== month) continue;
    }

    if (tx.type === 'income' && FARM_INCOME_CATEGORY_IDS.includes(tx.category.id)) {
      farmIncome += tx.amount;
    }
    if (tx.type === 'expense' && FARM_EXPENSE_CATEGORY_IDS.includes(tx.category.id)) {
      farmExpenses += tx.amount;
    }
  }

  return getFarmProfitEstimate(farmIncome, farmExpenses);
}

export function selectFarmCostBreakdown(
  transactions: Transaction[],
  month?: string
): { category: string; amount: number; percentage: number }[] {
  const farmExpenses: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (!FARM_EXPENSE_CATEGORY_IDS.includes(tx.category.id)) continue;

    if (month) {
      const txMonth = (tx.date instanceof Date ? tx.date : new Date(tx.date)).toISOString().slice(0, 7);
      if (txMonth !== month) continue;
    }

    farmExpenses.push(tx);
  }

  const total = farmExpenses.reduce((s, t) => s + t.amount, 0);
  const catMap = new Map<string, number>();

  for (const t of farmExpenses) {
    catMap.set(t.category.name, (catMap.get(t.category.name) || 0) + t.amount);
  }

  return Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function selectHomeSnapshot(
  transactions: Transaction[],
  budgets: Budget[],
  accounts: Account[],
  goals: FinancialGoal[],
  month: string
): HomeSnapshot {
  const netBalance = selectTotalBalance(transactions);
  const cashFlow = selectMonthlyCashFlow(transactions, month);
  const budgetRisk = selectBudgetRisk(budgets, transactions, month);
  const health = selectFinancialHealth(transactions, budgets, netBalance);
  const insights = generateInsights(transactions, budgets, accounts, goals, netBalance);
  const showFarm = hasFarmActivity(transactions);

  let farmSummary = null;
  if (showFarm) {
    const summary = getSeasonalFarmSummary(transactions);
    if (summary.totalFarmIncome > 0 || summary.totalFarmExpenses > 0) {
      farmSummary = {
        season: summary.season,
        totalFarmIncome: summary.totalFarmIncome,
        totalFarmExpenses: summary.totalFarmExpenses,
        profit: summary.profit,
      };
    }
  }

  return {
    netBalance,
    monthlyIncome: cashFlow.income,
    monthlyExpenses: cashFlow.expenses,
    monthlyCashFlow: cashFlow.net,
    budgetRisk,
    healthScore: health.score,
    healthMetrics: health.metrics,
    topInsight: insights.length > 0 ? insights[0] : null,
    insightCount: insights.length,
    recentTransactions: transactions.slice(0, 5),
    showFarm,
    farmSummary,
  };
}
