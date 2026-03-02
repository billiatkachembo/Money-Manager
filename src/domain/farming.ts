import {
  FarmCategoryBreakdown,
  SeasonalFarmSummary,
  Transaction,
} from '../../types/transaction';

const FARM_EXPENSE_KEYWORDS = [
  'seeds',
  'plants',
  'livestock feed',
  'farm equipment',
  'fertilizers',
  'pesticides',
  'irrigation',
  'veterinary',
  'labor costs',
  'farm maintenance',
  'storage',
  'packaging',
  'land rent',
  'insurance',
];

const FARM_INCOME_KEYWORDS = [
  'crop sales',
  'livestock sales',
  'dairy products',
  'government subsidy',
];

function toCategoryKey(transaction: Transaction): string {
  const categoryName = transaction.category?.name ?? '';
  return categoryName.trim().toLowerCase();
}

export function isFarmExpense(transaction: Transaction): boolean {
  if (transaction.type !== 'expense') {
    return false;
  }

  const category = toCategoryKey(transaction);
  return FARM_EXPENSE_KEYWORDS.some((keyword) => category.includes(keyword));
}

export function isFarmIncome(transaction: Transaction): boolean {
  if (transaction.type !== 'income') {
    return false;
  }

  const category = toCategoryKey(transaction);
  return FARM_INCOME_KEYWORDS.some((keyword) => category.includes(keyword));
}

function getSeason(monthIndex: number): SeasonalFarmSummary['season'] {
  if (monthIndex >= 2 && monthIndex <= 4) {
    return 'spring';
  }
  if (monthIndex >= 5 && monthIndex <= 7) {
    return 'summer';
  }
  if (monthIndex >= 8 && monthIndex <= 10) {
    return 'autumn';
  }

  return 'winter';
}

function isInSameSeason(date: Date, reference: Date): boolean {
  const season = getSeason(reference.getMonth());
  const transactionSeason = getSeason(date.getMonth());

  if (season !== transactionSeason) {
    return false;
  }

  // Winter spans years. Keep December with the following Jan/Feb cycle.
  if (season !== 'winter') {
    return date.getFullYear() === reference.getFullYear();
  }

  const refYear = reference.getMonth() === 11 ? reference.getFullYear() + 1 : reference.getFullYear();
  const txYear = date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
  return refYear === txYear;
}

export function getFarmProfitEstimate(farmIncome: number, farmExpenses: number): number {
  return farmIncome - farmExpenses;
}

export function getFarmCostBreakdown(transactions: Transaction[]): FarmCategoryBreakdown[] {
  const costs = new Map<string, FarmCategoryBreakdown>();

  for (const transaction of transactions) {
    if (!isFarmExpense(transaction)) {
      continue;
    }

    const key = transaction.category.id;
    const existing = costs.get(key);
    if (existing) {
      existing.amount += transaction.amount;
    } else {
      costs.set(key, {
        categoryId: transaction.category.id,
        categoryName: transaction.category.name,
        amount: transaction.amount,
        ratio: 0,
      });
    }
  }

  const rows = Array.from(costs.values()).sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return rows.map((row) => ({
    ...row,
    ratio: total > 0 ? row.amount / total : 0,
  }));
}

export function getSeasonalFarmSummary(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): SeasonalFarmSummary {
  const seasonalTransactions = transactions.filter((transaction) =>
    isInSameSeason(transaction.date, referenceDate)
  );

  const farmIncome = seasonalTransactions
    .filter(isFarmIncome)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const farmExpenses = seasonalTransactions
    .filter(isFarmExpense)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    season: getSeason(referenceDate.getMonth()),
    farmIncome,
    farmExpenses,
    farmProfit: getFarmProfitEstimate(farmIncome, farmExpenses),
    costBreakdown: getFarmCostBreakdown(seasonalTransactions),
  };
}
