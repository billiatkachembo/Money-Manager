const test = require('node:test');
const assert = require('node:assert/strict');

const {
  materializeRecurringTransactions,
} = require('../.tmp-tests/src/domain/recurring.js');

const category = {
  id: 'rent',
  name: 'Rent',
  icon: 'Home',
  color: '#445566',
};

function createRule(overrides = {}) {
  return {
    id: 'rule-1',
    frequency: 'monthly',
    startDate: '2026-01-01T00:00:00.000Z',
    lastMaterializedAt: '2026-01-01T00:00:00.000Z',
    template: {
      amount: 100,
      description: 'Recurring rent',
      category,
      type: 'expense',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      fromAccountId: 'cash',
      fromAccount: 'cash',
      isRecurring: true,
      recurringFrequency: 'monthly',
    },
    ...overrides,
  };
}

test('recurring: idempotency', () => {
  const idFactory = (() => {
    let i = 0;
    return () => `tx-${++i}`;
  })();

  const first = materializeRecurringTransactions(
    new Date('2026-04-15T00:00:00.000Z'),
    [createRule()],
    [],
    idFactory
  );

  assert.equal(first.newTransactions.length, 3);

  const second = materializeRecurringTransactions(
    new Date('2026-04-15T00:00:00.000Z'),
    first.updatedRules,
    first.newTransactions,
    idFactory
  );

  assert.equal(second.newTransactions.length, 0);
});

test('recurring: missed openings are materialized', () => {
  const dailyRule = createRule({
    id: 'daily-rule',
    frequency: 'daily',
    startDate: '2026-01-01T00:00:00.000Z',
    lastMaterializedAt: '2026-01-01T00:00:00.000Z',
  });

  const result = materializeRecurringTransactions(
    new Date('2026-01-05T00:00:00.000Z'),
    [dailyRule],
    [],
    (() => {
      let i = 0;
      return () => `daily-${++i}`;
    })()
  );

  assert.equal(result.newTransactions.length, 4);
});

test('recurring: end date enforcement', () => {
  const bounded = createRule({
    frequency: 'daily',
    endDate: '2026-01-03T00:00:00.000Z',
  });

  const result = materializeRecurringTransactions(
    new Date('2026-01-10T00:00:00.000Z'),
    [bounded],
    [],
    (() => {
      let i = 0;
      return () => `bounded-${++i}`;
    })()
  );

  assert.equal(result.newTransactions.length, 2);
  assert.ok(result.newTransactions.every((tx) => tx.date <= new Date('2026-01-03T00:00:00.000Z')));
});
