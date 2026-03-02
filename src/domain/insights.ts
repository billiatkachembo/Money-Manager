import { Insight, InsightSeverity } from '../../types/transaction';

export interface InsightContext {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
  previousMonthlyNet: number;
  savingsRate: number;
  budgetAdherence: number;
  budgetRisk: number;
  bufferMonths: number;
  expenseCV: number;
  incomeCV: number;
  transferRatio: number;
  recurringCommitmentRatio: number;
  microExpenseRatio: number;
  expenseSpikeRatio: number;
  incomeDropRatio: number;
  daysSinceIncome: number;
  debtToIncomeRatio: number;
  farmProfit: number;
  farmExpenseRatio: number;
  farmFertilizerShare: number;
  seasonalFarmDelta: number;
  positiveNetStreak: number;
}

export type InsightRule = (data: InsightContext) => Insight | null;

function createInsight(
  id: string,
  title: string,
  message: string,
  severity: InsightSeverity,
  confidence: number
): Insight {
  return {
    id,
    title,
    message,
    severity,
    confidence,
  };
}

export const negativeCashFlowRule: InsightRule = (data) => {
  if (data.monthlyNet < 0) {
    return createInsight(
      'negative-cashflow',
      'Negative cash flow',
      'Your expenses exceeded income this month.',
      'warning',
      0.9
    );
  }

  return null;
};

const severeNegativeCashFlowRule: InsightRule = (data) => {
  if (data.monthlyIncome > 0 && data.monthlyNet / data.monthlyIncome <= -0.2) {
    return createInsight(
      'severe-negative-cashflow',
      'High cash burn',
      'Your net cash flow is deeply negative this month.',
      'critical',
      0.95
    );
  }

  return null;
};

const lowSavingsRateRule: InsightRule = (data) => {
  if (data.savingsRate < 0.1) {
    return createInsight(
      'low-savings-rate',
      'Low savings rate',
      'Try to save at least 10% of monthly income.',
      'warning',
      0.85
    );
  }

  return null;
};

const strongSavingsRateRule: InsightRule = (data) => {
  if (data.savingsRate >= 0.2) {
    return createInsight(
      'strong-savings-rate',
      'Savings momentum',
      'You are saving at least 20% of income. Keep this habit.',
      'info',
      0.75
    );
  }

  return null;
};

const budgetOverrunRule: InsightRule = (data) => {
  if (data.budgetRisk > 1) {
    return createInsight(
      'budget-overrun',
      'Budget overrun',
      'Current spending is above your monthly budget limits.',
      'warning',
      0.9
    );
  }

  return null;
};

const budgetCriticalRule: InsightRule = (data) => {
  if (data.budgetRisk > 1.2) {
    return createInsight(
      'budget-critical',
      'Budget risk is critical',
      'Spending is more than 120% of budget. Cut non-essential costs now.',
      'critical',
      0.93
    );
  }

  return null;
};

const thinEmergencyBufferRule: InsightRule = (data) => {
  if (data.bufferMonths < 1) {
    return createInsight(
      'thin-buffer',
      'Emergency buffer is thin',
      'You currently have less than one month of expense coverage.',
      'warning',
      0.86
    );
  }

  return null;
};

const noEmergencyBufferRule: InsightRule = (data) => {
  if (data.bufferMonths < 0.25) {
    return createInsight(
      'no-buffer',
      'Emergency reserve is too low',
      'Your emergency reserve is critically low.',
      'critical',
      0.92
    );
  }

  return null;
};

const expenseVolatilityRule: InsightRule = (data) => {
  if (data.expenseCV > 0.5) {
    return createInsight(
      'expense-volatility',
      'Expenses are unstable',
      'Large swings in spending make planning difficult.',
      'warning',
      0.8
    );
  }

  return null;
};

const incomeVolatilityRule: InsightRule = (data) => {
  if (data.incomeCV > 0.5) {
    return createInsight(
      'income-volatility',
      'Income is unstable',
      'Income swings are high. Build a larger safety buffer.',
      'warning',
      0.78
    );
  }

  return null;
};

const incomeDropRule: InsightRule = (data) => {
  if (data.incomeDropRatio > 0 && data.incomeDropRatio < 0.8) {
    return createInsight(
      'income-drop',
      'Income dropped',
      'This month income is materially below recent levels.',
      'warning',
      0.87
    );
  }

  return null;
};

const expenseSpikeRule: InsightRule = (data) => {
  if (data.expenseSpikeRatio > 1.3) {
    return createInsight(
      'expense-spike',
      'Expense spike detected',
      'Spending jumped above your recent baseline.',
      'warning',
      0.82
    );
  }

  return null;
};

const transferHeavyRule: InsightRule = (data) => {
  if (data.transferRatio > 0.6) {
    return createInsight(
      'transfer-heavy',
      'Frequent internal transfers',
      'You moved a high share of money between accounts this month.',
      'info',
      0.65
    );
  }

  return null;
};

const recurringLoadRule: InsightRule = (data) => {
  if (data.recurringCommitmentRatio > 0.65) {
    return createInsight(
      'recurring-load',
      'Recurring commitments are high',
      'Fixed recurring transactions are taking a large share of income.',
      'warning',
      0.84
    );
  }

  return null;
};

const microExpenseLeakRule: InsightRule = (data) => {
  if (data.microExpenseRatio > 0.35) {
    return createInsight(
      'micro-expense-leak',
      'Small expenses add up',
      'Many low-value expenses are accumulating over the month.',
      'info',
      0.72
    );
  }

  return null;
};

const noRecentIncomeRule: InsightRule = (data) => {
  if (data.daysSinceIncome > 45) {
    return createInsight(
      'no-recent-income',
      'No recent income',
      'No income has been recorded for over 45 days.',
      'critical',
      0.9
    );
  }

  return null;
};

const debtPressureRule: InsightRule = (data) => {
  if (data.debtToIncomeRatio > 0.5) {
    return createInsight(
      'debt-pressure',
      'Debt pressure is high',
      'Outstanding debt relative to income is elevated.',
      'warning',
      0.81
    );
  }

  return null;
};

const farmProfitNegativeRule: InsightRule = (data) => {
  if (data.farmProfit < 0) {
    return createInsight(
      'farm-negative-profit',
      'Farm operations are in loss',
      'Farm-related expenses are currently above farm income.',
      'warning',
      0.88
    );
  }

  return null;
};

const farmExpenseDominanceRule: InsightRule = (data) => {
  if (data.farmExpenseRatio > 0.7) {
    return createInsight(
      'farm-expense-dominance',
      'Farm costs dominate spending',
      'Farm operations account for most of your current spending.',
      'info',
      0.67
    );
  }

  return null;
};

const fertilizerConcentrationRule: InsightRule = (data) => {
  if (data.farmFertilizerShare > 0.35) {
    return createInsight(
      'fertilizer-concentration',
      'High fertilizer concentration',
      'A large share of farm costs is concentrated in fertilizers.',
      'warning',
      0.73
    );
  }

  return null;
};

const seasonalFarmDownturnRule: InsightRule = (data) => {
  if (data.seasonalFarmDelta < -0.2) {
    return createInsight(
      'seasonal-farm-downturn',
      'Seasonal farm dip',
      'Farm performance is down versus the previous comparable season.',
      'warning',
      0.74
    );
  }

  return null;
};

const positiveNetStreakRule: InsightRule = (data) => {
  if (data.positiveNetStreak >= 3) {
    return createInsight(
      'positive-net-streak',
      'Consistent positive flow',
      'You have maintained positive monthly net cash flow for several months.',
      'info',
      0.7
    );
  }

  return null;
};

export const INSIGHT_RULES: InsightRule[] = [
  negativeCashFlowRule,
  severeNegativeCashFlowRule,
  lowSavingsRateRule,
  strongSavingsRateRule,
  budgetOverrunRule,
  budgetCriticalRule,
  thinEmergencyBufferRule,
  noEmergencyBufferRule,
  expenseVolatilityRule,
  incomeVolatilityRule,
  incomeDropRule,
  expenseSpikeRule,
  transferHeavyRule,
  recurringLoadRule,
  microExpenseLeakRule,
  noRecentIncomeRule,
  debtPressureRule,
  farmProfitNegativeRule,
  farmExpenseDominanceRule,
  fertilizerConcentrationRule,
  seasonalFarmDownturnRule,
  positiveNetStreakRule,
];

function severityRank(severity: InsightSeverity): number {
  if (severity === 'critical') {
    return 3;
  }
  if (severity === 'warning') {
    return 2;
  }

  return 1;
}

export function computeInsights(data: InsightContext, limit = 5): Insight[] {
  const map = new Map<string, Insight>();

  for (const rule of INSIGHT_RULES) {
    const insight = rule(data);
    if (!insight) {
      continue;
    }

    const current = map.get(insight.id);
    if (!current || current.confidence < insight.confidence) {
      map.set(insight.id, insight);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      if (severityDiff !== 0) {
        return severityDiff;
      }

      return b.confidence - a.confidence;
    })
    .slice(0, Math.max(1, limit));
}
