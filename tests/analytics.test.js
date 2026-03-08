const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeExpenseCategoryBreakdown,
  computeExpenseDistribution,
  computeQuickStats,
} = require('../.tmp-tests/src/domain/analytics.js');

const groceriesCategory = {
  id: 'groceries',
  name: 'Groceries',
  icon: 'ShoppingCart',
  color: '#10B981',
};

const fuelCategory = {
  id: 'fuel',
  name: 'Fuel',
  icon: 'Fuel',
  color: '#F59E0B',
};

const utilitiesCategory = {
  id: 'utilities',
  name: 'Utilities',
  icon: 'Zap',
  color: '#3B82F6',
};

function transaction({
  id,
  amount,
  category,
  type = 'expense',
  date = '2026-03-10T12:00:00.000Z',
}) {
  const timestamp = new Date(date);

  return {
    id,
    amount,
    category,
    type,
    description: category.name,
    date: timestamp,
    createdAt: timestamp,
  };
}

test('analytics: category breakdown groups expenses by category and preserves share', () => {
  const breakdown = computeExpenseCategoryBreakdown([
    transaction({ id: 'expense-1', amount: 100, category: fuelCategory }),
    transaction({ id: 'expense-2', amount: 50, category: groceriesCategory }),
    transaction({ id: 'expense-3', amount: 25, category: groceriesCategory }),
    transaction({ id: 'income-1', amount: 300, category: groceriesCategory, type: 'income' }),
  ]);

  assert.equal(breakdown.length, 2);
  assert.equal(breakdown[0].categoryId, 'fuel');
  assert.equal(breakdown[0].amount, 100);
  assert.ok(Math.abs(breakdown[0].share - (100 / 175)) < 1e-9);
  assert.equal(breakdown[1].categoryId, 'groceries');
  assert.equal(breakdown[1].transactionCount, 2);
  assert.ok(Math.abs(breakdown[1].share - (75 / 175)) < 1e-9);
});

test('analytics: expense distribution collapses lower-ranked categories into Other', () => {
  const distribution = computeExpenseDistribution(
    computeExpenseCategoryBreakdown([
      transaction({ id: 'expense-1', amount: 100, category: fuelCategory }),
      transaction({ id: 'expense-2', amount: 50, category: groceriesCategory }),
      transaction({ id: 'expense-3', amount: 25, category: utilitiesCategory }),
    ]),
    2
  );

  assert.equal(distribution.length, 3);
  assert.equal(distribution[0].name, 'Fuel');
  assert.equal(distribution[1].name, 'Groceries');
  assert.equal(distribution[2].name, 'Other');
  assert.equal(distribution[2].amount, 25);
  assert.ok(Math.abs(distribution[2].share - (25 / 175)) < 1e-9);
});

test('analytics: quick stats are based on the supplied period transactions', () => {
  const stats = computeQuickStats([
    transaction({ id: 'expense-1', amount: 100, category: fuelCategory }),
    transaction({ id: 'expense-2', amount: 50, category: groceriesCategory }),
    transaction({ id: 'expense-3', amount: 25, category: groceriesCategory }),
    transaction({ id: 'income-1', amount: 300, category: groceriesCategory, type: 'income' }),
    transaction({ id: 'transfer-1', amount: 75, category: utilitiesCategory, type: 'transfer' }),
  ], 15);

  assert.equal(stats.transactionCount, 5);
  assert.equal(stats.expenseTransactionCount, 3);
  assert.equal(stats.activeCategories, 2);
  assert.ok(Math.abs(stats.averageDailySpend - (175 / 15)) < 1e-9);
  assert.equal(stats.netAmount, 125);
  assert.equal(stats.income, 300);
  assert.equal(stats.expenses, 175);
});
