import { Transaction } from '@/types/transaction';

export const FARM_EXPENSE_CATEGORY_IDS = [
  '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
];

export const FARM_INCOME_CATEGORY_IDS = [
  '23', '24', '25',
];

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
const SEASON_ORDER = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

type SeasonName = (typeof SEASON_ORDER)[number];

export interface SeasonalFarmUsage {
  season: string;
  year: number;
  income: number;
  expenses: number;
  profit: number;
  costBreakdown: { category: string; amount: number; percentage: number }[];
  topCrops: { name: string; revenue: number }[];
}

export interface SeasonalFarmTrend {
  budgeted?: number;
  seasonalUsage: SeasonalFarmUsage[];
  projectedNextSeason?: SeasonalFarmUsage;
  willExceedExpenses?: boolean;
}

export interface FarmSummary {
  season: string;
  totalFarmIncome: number;
  totalFarmExpenses: number;
  profit: number;
  costBreakdown: { category: string; amount: number; percentage: number }[];
  topCrops: { name: string; revenue: number }[];
}

function toValidDate(value: Date | string): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeAmount(amount: number): number {
  return Number.isFinite(amount) ? amount : 0;
}

function safeCategoryName(transaction: Transaction): string {
  const name = transaction.category?.name?.trim();
  return name ? name : 'Uncategorized';
}

function getRangeDays(range: { start: Date; end: Date }): number {
  const days = Math.floor((range.end.getTime() - range.start.getTime()) / MILLIS_PER_DAY) + 1;
  return Math.max(days, 1);
}

function getNextSeason(currentSeason: string, currentYear: number): { season: SeasonName; year: number } {
  const index = SEASON_ORDER.indexOf(currentSeason as SeasonName);
  const currentIndex = index >= 0 ? index : 0;
  const nextIndex = (currentIndex + 1) % SEASON_ORDER.length;
  return {
    season: SEASON_ORDER[nextIndex],
    year: currentYear + (nextIndex === 0 ? 1 : 0),
  };
}

export function isFarmTransaction(tx: Transaction): boolean {
  return (
    FARM_EXPENSE_CATEGORY_IDS.includes(tx.category.id) ||
    FARM_INCOME_CATEGORY_IDS.includes(tx.category.id)
  );
}

export function getSeason(date: Date): string {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Autumn';
  return 'Winter';
}

export function getSeasonDateRange(season: string, year: number): { start: Date; end: Date } {
  switch (season) {
    case 'Spring':
      return { start: new Date(year, 2, 1), end: new Date(year, 5, 0) };
    case 'Summer':
      return { start: new Date(year, 5, 1), end: new Date(year, 8, 0) };
    case 'Autumn':
      return { start: new Date(year, 8, 1), end: new Date(year, 11, 0) };
    case 'Winter':
    default:
      return { start: new Date(year, 11, 1), end: new Date(year + 1, 2, 0) };
  }
}

export function getSeasonalFarmSummary(
  transactions: Transaction[],
  season?: string,
  year?: number
): FarmSummary {
  const now = new Date();
  const targetSeason = season ?? getSeason(now);
  const targetYear = year ?? now.getFullYear();
  const { start, end } = getSeasonDateRange(targetSeason, targetYear);

  const farmTxs = transactions.filter(tx => {
    if (!isFarmTransaction(tx)) return false;
    const d = toValidDate(tx.date);
    if (!d) return false;
    return d >= start && d <= end;
  });

  const totalFarmIncome = farmTxs
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + safeAmount(t.amount), 0);

  const totalFarmExpenses = farmTxs
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + safeAmount(t.amount), 0);

  const catMap = new Map<string, number>();
  farmTxs
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const key = safeCategoryName(t);
      catMap.set(key, (catMap.get(key) || 0) + safeAmount(t.amount));
    });

  const costBreakdown = Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalFarmExpenses > 0 ? (amount / totalFarmExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const incomeMap = new Map<string, number>();
  farmTxs
    .filter(t => t.type === 'income')
    .forEach(t => {
      const key = safeCategoryName(t);
      incomeMap.set(key, (incomeMap.get(key) || 0) + safeAmount(t.amount));
    });

  const topCrops = Array.from(incomeMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    season: targetSeason,
    totalFarmIncome,
    totalFarmExpenses,
    profit: totalFarmIncome - totalFarmExpenses,
    costBreakdown,
    topCrops,
  };
}

export function getFarmProfitEstimate(
  farmIncome: number,
  farmExpenses: number
): number {
  return farmIncome - farmExpenses;
}

export function getFarmCostBreakdown(
  transactions: Transaction[],
  month?: string
): { category: string; amount: number; percentage: number }[] {
  const farmExpenses = transactions.filter(t => {
    if (t.type !== 'expense') return false;
    if (!FARM_EXPENSE_CATEGORY_IDS.includes(t.category.id)) return false;

    if (month) {
      const parsed = toValidDate(t.date);
      if (!parsed) return false;
      const txMonth = parsed.toISOString().slice(0, 7);
      return txMonth === month;
    }
    return true;
  });

  const total = farmExpenses.reduce((s, t) => s + safeAmount(t.amount), 0);
  const catMap = new Map<string, number>();

  for (const t of farmExpenses) {
    const key = safeCategoryName(t);
    catMap.set(key, (catMap.get(key) || 0) + safeAmount(t.amount));
  }

  return Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function hasFarmActivity(transactions: Transaction[]): boolean {
  return transactions.some(tx => isFarmTransaction(tx));
}

export function computeSeasonalFarmTrends(
  transactions: Transaction[],
  seasons: string[],
  year?: number
): SeasonalFarmTrend {
  const currentYear = year ?? new Date().getFullYear();
  const normalizedSeasons = seasons.filter((season) => season.trim().length > 0);

  if (normalizedSeasons.length === 0) {
    return {
      seasonalUsage: [],
      projectedNextSeason: undefined,
      willExceedExpenses: false,
    };
  }

  const seasonalUsage: SeasonalFarmUsage[] = normalizedSeasons.map((season) => {
    const { start, end } = getSeasonDateRange(season, currentYear);

    const farmTxs = transactions.filter((tx) => {
      if (!isFarmTransaction(tx)) return false;
      const parsedDate = toValidDate(tx.date);
      if (!parsedDate) return false;
      return parsedDate >= start && parsedDate <= end;
    });

    const incomeTxs = farmTxs.filter((tx) => tx.type === 'income');
    const expenseTxs = farmTxs.filter((tx) => tx.type === 'expense');

    const totalIncome = incomeTxs.reduce((sum, tx) => sum + safeAmount(tx.amount), 0);
    const totalExpenses = expenseTxs.reduce((sum, tx) => sum + safeAmount(tx.amount), 0);

    const categoryTotals = new Map<string, number>();
    expenseTxs.forEach((tx) => {
      const key = safeCategoryName(tx);
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + safeAmount(tx.amount));
    });

    const costBreakdown = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const incomeTotals = new Map<string, number>();
    incomeTxs.forEach((tx) => {
      const key = safeCategoryName(tx);
      incomeTotals.set(key, (incomeTotals.get(key) || 0) + safeAmount(tx.amount));
    });

    const topCrops = Array.from(incomeTotals.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      season,
      year: currentYear,
      income: totalIncome,
      expenses: totalExpenses,
      profit: totalIncome - totalExpenses,
      costBreakdown,
      topCrops,
    };
  });

  const lastSeasonUsage = seasonalUsage[seasonalUsage.length - 1];
  const { season: nextSeason, year: nextSeasonYear } = getNextSeason(lastSeasonUsage.season, lastSeasonUsage.year);

  const lastSeasonRange = getSeasonDateRange(lastSeasonUsage.season, lastSeasonUsage.year);
  const nextSeasonRange = getSeasonDateRange(nextSeason, nextSeasonYear);
  const lastSeasonDays = getRangeDays(lastSeasonRange);
  const nextSeasonDays = getRangeDays(nextSeasonRange);

  const dailyIncomeAvg = lastSeasonUsage.income / lastSeasonDays;
  const dailyExpensesAvg = lastSeasonUsage.expenses / lastSeasonDays;

  const projectedNextSeason: SeasonalFarmUsage = {
    season: nextSeason,
    year: nextSeasonYear,
    income: dailyIncomeAvg * nextSeasonDays,
    expenses: dailyExpensesAvg * nextSeasonDays,
    profit: (dailyIncomeAvg - dailyExpensesAvg) * nextSeasonDays,
    costBreakdown: [],
    topCrops: [],
  };

  return {
    seasonalUsage,
    projectedNextSeason,
    willExceedExpenses: projectedNextSeason.expenses > projectedNextSeason.income,
  };
}
