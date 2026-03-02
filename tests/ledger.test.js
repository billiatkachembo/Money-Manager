const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTransferLegs,
  deriveAccountBalance,
  recomputeAllBalances,
  validateLedgerIntegrity,
} = require('../.tmp-tests/src/domain/ledger.js');

const category = {
  id: 'general',
  name: 'General',
  icon: 'Circle',
  color: '#111111',
};

function buildAccount(id) {
  return {
    id,
    name: id.toUpperCase(),
    type: 'checking',
    balance: 0,
    currency: 'USD',
    color: '#667eea',
    icon: '$',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

test('ledger: transfer symmetry and integrity', () => {
  const pair = createTransferLegs({
    amount: 250,
    date: new Date('2026-01-10T00:00:00.000Z'),
    description: 'Move funds',
    category,
    fromAccountId: 'a',
    toAccountId: 'b',
    idFactory: (() => {
      let i = 0;
      return () => `id-${++i}`;
    })(),
  });

  const transactions = [pair.debit, pair.credit];

  assert.equal(deriveAccountBalance('a', transactions), -250);
  assert.equal(deriveAccountBalance('b', transactions), 250);

  const integrity = validateLedgerIntegrity(transactions);
  assert.equal(integrity.valid, true);
  assert.deepEqual(integrity.issues, []);
});

test('ledger: rebuild consistency', () => {
  const pair = createTransferLegs({
    amount: 40,
    date: new Date('2026-01-04T00:00:00.000Z'),
    description: 'Transfer',
    category,
    fromAccountId: 'a',
    toAccountId: 'b',
  });

  const transactions = [
    {
      id: 'income-1',
      amount: 500,
      description: 'Income',
      category,
      type: 'income',
      date: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      toAccountId: 'a',
      toAccount: 'a',
    },
    {
      id: 'expense-1',
      amount: 100,
      description: 'Expense',
      category,
      type: 'expense',
      date: new Date('2026-01-03T00:00:00.000Z'),
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      fromAccountId: 'a',
      fromAccount: 'a',
    },
    pair.debit,
    pair.credit,
  ];

  const accounts = [buildAccount('a'), buildAccount('b')];
  const first = recomputeAllBalances(accounts, transactions);
  const second = recomputeAllBalances(accounts, transactions);

  assert.deepEqual(first, second);
});

test('ledger: edit and delete trigger deterministic recompute', () => {
  const account = buildAccount('a');

  const base = {
    id: 'expense-1',
    amount: 50,
    description: 'Base expense',
    category,
    type: 'expense',
    date: new Date('2026-01-02T00:00:00.000Z'),
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    fromAccountId: 'a',
    fromAccount: 'a',
  };

  const afterCreate = recomputeAllBalances([account], [base]);
  assert.equal(afterCreate[0].balance, -50);

  const edited = { ...base, amount: 80 };
  const afterEdit = recomputeAllBalances([account], [edited]);
  assert.equal(afterEdit[0].balance, -80);

  const afterDelete = recomputeAllBalances([account], []);
  assert.equal(afterDelete[0].balance, 0);
});
