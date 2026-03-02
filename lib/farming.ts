import { Transaction, FarmSummary } from '@/types/transaction';

export const FARM_EXPENSE_CATEGORY_IDS = [
  '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
];

export const FARM_INCOME_CATEGORY_IDS = [
  '23', '24', '25',
];

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
    const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
    return d >= start && d <= end;
  });

  const totalFarmIncome = farmTxs
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const totalFarmExpenses = farmTxs
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const catMap = new Map<string, number>();
  farmTxs
    .filter(t => t.type === 'expense')
    .forEach(t => {
      catMap.set(t.category.name, (catMap.get(t.category.name) || 0) + t.amount);
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
      incomeMap.set(t.category.name, (incomeMap.get(t.category.name) || 0) + t.amount);
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
      const txMonth = (t.date instanceof Date ? t.date : new Date(t.date)).toISOString().slice(0, 7);
      return txMonth === month;
    }
    return true;
  });

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

export function hasFarmActivity(transactions: Transaction[]): boolean {
  return transactions.some(tx => isFarmTransaction(tx));
}
