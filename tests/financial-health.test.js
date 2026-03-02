const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeFinancialHealthScore,
  clamp,
} = require('../.tmp-tests/src/domain/financial-health.js');

test('financial health: score remains within 0..100 bounds', () => {
  const low = computeFinancialHealthScore({
    savingsRate: -5,
    budgetAdherence: -2,
    bufferMonths: -1,
    expenseCV: 10,
    incomeCV: 10,
  });

  const high = computeFinancialHealthScore({
    savingsRate: 5,
    budgetAdherence: 5,
    bufferMonths: 50,
    expenseCV: -5,
    incomeCV: -5,
  });

  assert.ok(low >= 0 && low <= 100);
  assert.ok(high >= 0 && high <= 100);
});

test('financial health: weight correctness follows formula', () => {
  const score = computeFinancialHealthScore({
    savingsRate: 0,
    budgetAdherence: 0.5,
    bufferMonths: 3,
    expenseCV: 0.2,
    incomeCV: 0.3,
  });

  assert.equal(score, 72);
});

test('financial health: clamp helper works deterministically', () => {
  assert.equal(clamp(-2), 0);
  assert.equal(clamp(0.4), 0.4);
  assert.equal(clamp(4), 1);
});
