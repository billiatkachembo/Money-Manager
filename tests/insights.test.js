const test = require('node:test');
const assert = require('node:assert/strict');

const { computeInsights } = require('../.tmp-tests/src/domain/insights.js');

function baseContext() {
  return {
    monthlyIncome: 1000,
    monthlyExpenses: 800,
    monthlyNet: 200,
    previousMonthlyNet: 150,
    savingsRate: 0.2,
    budgetAdherence: 0.9,
    budgetRisk: 0.8,
    bufferMonths: 3,
    expenseCV: 0.2,
    incomeCV: 0.2,
    transferRatio: 0.1,
    recurringCommitmentRatio: 0.3,
    microExpenseRatio: 0.1,
    expenseSpikeRatio: 1,
    incomeDropRatio: 1,
    daysSinceIncome: 5,
    debtToIncomeRatio: 0.1,
    farmProfit: 100,
    farmExpenseRatio: 0.2,
    farmFertilizerShare: 0.1,
    seasonalFarmDelta: 0.1,
    positiveNetStreak: 2,
  };
}

test('insights: negative cash flow rule triggers with warning severity', () => {
  const ctx = baseContext();
  ctx.monthlyNet = -25;
  ctx.monthlyExpenses = 1025;
  ctx.savingsRate = -0.025;

  const insights = computeInsights(ctx, 10);
  const negative = insights.find((entry) => entry.id === 'negative-cashflow');

  assert.ok(negative);
  assert.equal(negative.severity, 'warning');
});

test('insights: critical severity is prioritized in output ordering', () => {
  const ctx = baseContext();
  ctx.monthlyNet = -300;
  ctx.monthlyExpenses = 1300;
  ctx.budgetRisk = 1.35;
  ctx.daysSinceIncome = 60;

  const insights = computeInsights(ctx, 10);

  assert.ok(insights.length > 0);
  assert.equal(insights[0].severity, 'critical');
  assert.ok(insights.some((entry) => entry.id === 'budget-critical'));
});
