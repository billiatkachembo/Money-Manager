import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransferLegs, deriveAccountBalance, recomputeAllBalances, validateLedgerIntegrity } from '../../src/domain/ledger';
import { computeDebtPortfolioTotals } from '../../src/domain/debt-portfolio';
import {
  computeBehaviorMetrics,
  computeCategoryBreakdown,
  computeExpenseCategoryBreakdown,
  computeExpenseDistribution,
  computeNetWorthProgress,
  computeQuickStats,
} from '../../src/domain/analytics';
import type { Account, Budget, Transaction, TransactionCategory } from '../../types/transaction';

const TRANSFER_CATEGORY: TransactionCategory = {
  id: 'transfer',
  name: 'Transfer',
  icon: 'arrow-right-left',
  color: '#64748B',
};

function makeCategory(id: string, name: string, color = '#2563EB'): TransactionCategory {
  return { id, name, icon: 'dot', color };
}

function makeAccount(id: string, type: Account['type'], createdAt = '2026-01-01T08:00:00.000Z'): Account {
  return {
    id,
    name: id,
    type,
    balance: 0,
    currency: 'USD',
    color: '#0F172A',
    icon: 'wallet',
    isActive: true,
    createdAt: new Date(createdAt),
  };
}

function makeTransaction(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'date' | 'category'>): Transaction {
  return {
    description: 'test transaction',
    createdAt: overrides.date,
    ...overrides,
  } as Transaction;
}

test('ledger balance calculation handles income, expenses, transfers, and debt directions', () => {
  const checking = makeAccount('checking', 'checking');
  const savings = makeAccount('savings', 'savings');

  const salary = makeTransaction({
    id: 'tx-income',
    type: 'income',
    amount: 1000,
    date: new Date('2026-01-05T10:00:00.000Z'),
    toAccountId: checking.id,
    toAccount: checking.id,
    category: makeCategory('salary', 'Salary', '#22C55E'),
  });

  const groceries = makeTransaction({
    id: 'tx-expense',
    type: 'expense',
    amount: 200,
    date: new Date('2026-01-08T10:00:00.000Z'),
    fromAccountId: checking.id,
    fromAccount: checking.id,
    category: makeCategory('food', 'Food', '#EF4444'),
  });

  const transfer = createTransferLegs({
    amount: 300,
    date: new Date('2026-01-12T10:00:00.000Z'),
    description: 'Move to savings',
    category: TRANSFER_CATEGORY,
    fromAccountId: checking.id,
    toAccountId: savings.id,
    idFactory: (() => {
      let i = 0;
      return () => `transfer-${++i}`;
    })(),
  });

  const borrowed = makeTransaction({
    id: 'tx-borrowed',
    type: 'debt',
    amount: 500,
    date: new Date('2026-01-15T10:00:00.000Z'),
    debtDirection: 'borrowed',
    toAccountId: checking.id,
    toAccount: checking.id,
    category: makeCategory('personal-loan', 'Personal Loan', '#F97316'),
  });

  const lent = makeTransaction({
    id: 'tx-lent',
    type: 'debt',
    amount: 150,
    date: new Date('2026-01-18T10:00:00.000Z'),
    debtDirection: 'lent',
    fromAccountId: checking.id,
    fromAccount: checking.id,
    category: makeCategory('family-friends', 'Family & Friends', '#F59E0B'),
  });

  const transactions = [salary, groceries, transfer.debit, transfer.credit, borrowed, lent];

  assert.equal(deriveAccountBalance(checking.id, transactions), 850);
  assert.equal(deriveAccountBalance(savings.id, transactions), 300);

  const validation = validateLedgerIntegrity(transactions);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});


test('ledger integrity flags invalid transfers, invalid amounts, and invalid dates', () => {
  const invalidDate = new Date('invalid');

  const orphanTransfer = makeTransaction({
    id: 'transfer-orphan',
    type: 'transfer',
    amount: 50,
    date: new Date('2026-01-03T10:00:00.000Z'),
    fromAccountId: 'cash',
    fromAccount: 'cash',
    toAccountId: 'cash',
    toAccount: 'cash',
    category: TRANSFER_CATEGORY,
  });

  const brokenTransfer = createTransferLegs({
    amount: 75,
    date: new Date('2026-01-05T10:00:00.000Z'),
    description: 'Broken transfer',
    category: TRANSFER_CATEGORY,
    fromAccountId: 'checking',
    toAccountId: 'savings',
    transferGroupId: 'broken-group',
    idFactory: (() => {
      let i = 20;
      return () => `broken-${++i}`;
    })(),
  });
  brokenTransfer.credit.amount = 80;

  const invalidTransactions = [
    orphanTransfer,
    brokenTransfer.debit,
    brokenTransfer.credit,
    makeTransaction({
      id: 'invalid-amount',
      type: 'expense',
      amount: 0,
      date: new Date('2026-01-06T10:00:00.000Z'),
      category: makeCategory('food', 'Food', '#EF4444'),
    }),
    makeTransaction({
      id: 'invalid-date',
      type: 'income',
      amount: 20,
      date: invalidDate,
      category: makeCategory('gift', 'Gift', '#22C55E'),
    }),
  ];

  const validation = validateLedgerIntegrity(invalidTransactions);

  assert.equal(validation.valid, false);
  assert(validation.issues.some((issue) => issue.includes('invalid amount')));
  assert(validation.issues.some((issue) => issue.includes('invalid date')));
  assert(validation.issues.some((issue) => issue.includes('same source and destination account')));
  assert(validation.issues.some((issue) => issue.includes('mismatched leg amounts')));
});

test('transfer legs stay balanced and recomputeAllBalances updates every account consistently', () => {
  const checking = makeAccount('checking', 'checking');
  const wallet = makeAccount('wallet', 'cash');
  const savings = makeAccount('savings', 'savings');

  const salary = makeTransaction({
    id: 'salary',
    type: 'income',
    amount: 1200,
    date: new Date('2026-01-01T08:00:00.000Z'),
    toAccountId: checking.id,
    toAccount: checking.id,
    category: makeCategory('salary', 'Salary', '#22C55E'),
  });

  const walletFunding = createTransferLegs({
    amount: 150,
    date: new Date('2026-01-02T08:00:00.000Z'),
    description: 'Cash withdrawal',
    category: TRANSFER_CATEGORY,
    fromAccountId: checking.id,
    toAccountId: wallet.id,
    transferGroupId: 'wallet-transfer',
    idFactory: (() => {
      let i = 30;
      return () => `wallet-transfer-${++i}`;
    })(),
  });

  const savingsFunding = createTransferLegs({
    amount: 300,
    date: new Date('2026-01-03T08:00:00.000Z'),
    description: 'Savings transfer',
    category: TRANSFER_CATEGORY,
    fromAccountId: checking.id,
    toAccountId: savings.id,
    transferGroupId: 'savings-transfer',
    idFactory: (() => {
      let i = 40;
      return () => `savings-transfer-${++i}`;
    })(),
  });

  const groceries = makeTransaction({
    id: 'groceries',
    type: 'expense',
    amount: 90,
    date: new Date('2026-01-04T08:00:00.000Z'),
    fromAccountId: wallet.id,
    fromAccount: wallet.id,
    category: makeCategory('food', 'Food', '#EF4444'),
  });

  const transactions = [salary, walletFunding.debit, walletFunding.credit, savingsFunding.debit, savingsFunding.credit, groceries];
  const balances = recomputeAllBalances([checking, wallet, savings], transactions);
  const balanceById = new Map(balances.map((account) => [account.id, account.balance]));

  assert.equal(walletFunding.debit.transferGroupId, walletFunding.credit.transferGroupId);
  assert.equal(walletFunding.debit.transferLeg, 'debit');
  assert.equal(walletFunding.credit.transferLeg, 'credit');
  assert.equal(walletFunding.debit.isHidden, false);
  assert.equal(walletFunding.credit.isHidden, true);

  assert.equal(balanceById.get(checking.id), 750);
  assert.equal(balanceById.get(wallet.id), 60);
  assert.equal(balanceById.get(savings.id), 300);
  assert.equal(
    balances.reduce((sum, account) => sum + account.balance, 0),
    1110
  );
});

test('debt portfolio totals track borrowed debt, repayments, and amounts lent out', () => {
  const checking = makeAccount('checking', 'checking');

  const borrowed = makeTransaction({
    id: 'debt-borrowed',
    type: 'debt',
    amount: 1000,
    date: new Date('2026-02-01T09:00:00.000Z'),
    debtDirection: 'borrowed',
    toAccountId: checking.id,
    toAccount: checking.id,
    category: makeCategory('business-loan', 'Business Loan', '#F97316'),
  });

  const repayment = makeTransaction({
    id: 'debt-payment',
    type: 'expense',
    amount: 125,
    date: new Date('2026-02-11T09:00:00.000Z'),
    fromAccountId: checking.id,
    fromAccount: checking.id,
    debtPayment: true,
    category: makeCategory('loan-repayment', 'Loan Repayment', '#DC2626'),
  });

  const lent = makeTransaction({
    id: 'debt-lent',
    type: 'debt',
    amount: 300,
    date: new Date('2026-02-14T09:00:00.000Z'),
    debtDirection: 'lent',
    fromAccountId: checking.id,
    fromAccount: checking.id,
    category: makeCategory('family-friends', 'Family & Friends', '#F59E0B'),
  });

  const totals = computeDebtPortfolioTotals([checking], [borrowed, repayment, lent]);

  assert.deepEqual(totals, {
    borrowedPrincipal: 1000,
    borrowedOutstanding: 875,
    lentOutstanding: 300,
    debtRepayments: 125,
  });
});

test('net worth progress starts at the first recorded month and preserves net worth through asset transfers', () => {
  const checking = makeAccount('checking', 'checking');
  const savings = makeAccount('savings', 'savings');

  const januaryIncome = makeTransaction({
    id: 'jan-income',
    type: 'income',
    amount: 1000,
    date: new Date('2026-01-05T10:00:00.000Z'),
    toAccountId: checking.id,
    toAccount: checking.id,
    category: makeCategory('salary', 'Salary', '#22C55E'),
  });

  const februaryExpense = makeTransaction({
    id: 'feb-expense',
    type: 'expense',
    amount: 250,
    date: new Date('2026-02-10T10:00:00.000Z'),
    fromAccountId: checking.id,
    fromAccount: checking.id,
    category: makeCategory('food', 'Food', '#EF4444'),
  });

  const marchTransfer = createTransferLegs({
    amount: 300,
    date: new Date('2026-03-03T10:00:00.000Z'),
    description: 'Save money',
    category: TRANSFER_CATEGORY,
    fromAccountId: checking.id,
    toAccountId: savings.id,
    idFactory: (() => {
      let i = 10;
      return () => `march-transfer-${++i}`;
    })(),
  });

  const progress = computeNetWorthProgress(
    [checking, savings],
    [januaryIncome, februaryExpense, marchTransfer.debit, marchTransfer.credit],
    6,
    new Date('2026-03-31T23:59:59.999Z')
  );

  assert.deepEqual(
    progress.points.map((point) => point.month),
    ['2026-01', '2026-02', '2026-03']
  );
  assert.deepEqual(progress.netWorth, [1000, 750, 750]);
  assert.deepEqual(progress.monthOverMonthChange, [0, -250, 0]);
  assert.equal(progress.currentNetWorth, 750);
});

test('expense breakdown, distribution, and quick stats stay internally consistent', () => {
  const food = makeCategory('food', 'Food', '#F97316');
  const transport = makeCategory('transport', 'Transport', '#3B82F6');
  const books = makeCategory('books', 'Books', '#8B5CF6');
  const health = makeCategory('health', 'Health', '#10B981');
  const incomeCategory = makeCategory('allowance', 'Meal Allowance', '#22C55E');

  const transactions: Transaction[] = [
    makeTransaction({ id: 'income-1', type: 'income', amount: 300, date: new Date('2026-03-01T08:00:00.000Z'), category: incomeCategory }),
    makeTransaction({ id: 'food-1', type: 'expense', amount: 40, date: new Date('2026-03-02T08:00:00.000Z'), category: food }),
    makeTransaction({ id: 'food-2', type: 'expense', amount: 60, date: new Date('2026-03-03T08:00:00.000Z'), category: food }),
    makeTransaction({ id: 'transport-1', type: 'expense', amount: 50, date: new Date('2026-03-04T08:00:00.000Z'), category: transport }),
    makeTransaction({ id: 'books-1', type: 'expense', amount: 30, date: new Date('2026-03-05T08:00:00.000Z'), category: books }),
    makeTransaction({ id: 'health-1', type: 'expense', amount: 20, date: new Date('2026-03-06T08:00:00.000Z'), category: health }),
  ];

  const breakdown = computeExpenseCategoryBreakdown(transactions);
  assert.equal(breakdown[0]?.categoryName, 'Food');
  assert.equal(breakdown[0]?.amount, 100);
  assert.equal(breakdown[0]?.transactionCount, 2);
  assert.equal(breakdown[0]?.share, 0.5);

  const distribution = computeExpenseDistribution(breakdown, 2);
  assert.deepEqual(
    distribution.map((entry) => ({ name: entry.name, amount: entry.amount })),
    [
      { name: 'Food', amount: 100 },
      { name: 'Transport', amount: 50 },
      { name: 'Other', amount: 50 },
    ]
  );

  const quickStats = computeQuickStats(transactions, 5);
  assert.deepEqual(quickStats, {
    transactionCount: 6,
    expenseTransactionCount: 5,
    activeCategories: 4,
    averageDailySpend: 40,
    netAmount: 100,
    income: 300,
    expenses: 200,
  });
});


test('debt portfolio excludes liability-account borrowing from principal and clamps overpayments at zero', () => {
  const checking = makeAccount('checking', 'checking');
  const creditCard = makeAccount('credit-card', 'credit');

  const liabilityBorrowing = makeTransaction({
    id: 'credit-card-borrowing',
    type: 'debt',
    amount: 400,
    date: new Date('2026-02-01T09:00:00.000Z'),
    debtDirection: 'borrowed',
    toAccountId: creditCard.id,
    toAccount: creditCard.id,
    category: makeCategory('credit-card-balance', 'Credit Card Balance', '#F97316'),
  });

  const borrowedCash = makeTransaction({
    id: 'cash-loan',
    type: 'debt',
    amount: 250,
    date: new Date('2026-02-03T09:00:00.000Z'),
    debtDirection: 'borrowed',
    toAccountId: checking.id,
    toAccount: checking.id,
    category: makeCategory('personal-loan', 'Personal Loan', '#F97316'),
  });

  const repayment = makeTransaction({
    id: 'loan-payment',
    type: 'expense',
    amount: 500,
    date: new Date('2026-02-10T09:00:00.000Z'),
    fromAccountId: checking.id,
    fromAccount: checking.id,
    debtPayment: true,
    category: makeCategory('loan-repayment', 'Loan Repayment', '#DC2626'),
  });

  const totals = computeDebtPortfolioTotals([checking, creditCard], [liabilityBorrowing, borrowedCash, repayment]);

  assert.deepEqual(totals, {
    borrowedPrincipal: 250,
    borrowedOutstanding: 0,
    lentOutstanding: 0,
    debtRepayments: 500,
  });
});

test('behavior metrics keep a 6-month window and compute current-month totals against the reference date', () => {
  const checking = makeAccount('checking', 'checking');
  const food = makeCategory('food', 'Food', '#EF4444');
  const books = makeCategory('books', 'Books', '#8B5CF6');
  const salary = makeCategory('salary', 'Salary', '#22C55E');
  const budget: Budget = {
    id: 'budget-food',
    categoryId: food.id,
    category: food,
    amount: 200,
    period: 'monthly',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: undefined,
    alertAt80Percent: true,
    alertAtLimit: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const transactions = [
    makeTransaction({ id: 'oct-income', type: 'income', amount: 100, date: new Date('2025-10-10T08:00:00.000Z'), toAccountId: checking.id, toAccount: checking.id, category: salary }),
    makeTransaction({ id: 'nov-expense', type: 'expense', amount: 20, date: new Date('2025-11-12T08:00:00.000Z'), fromAccountId: checking.id, fromAccount: checking.id, category: books }),
    makeTransaction({ id: 'dec-income', type: 'income', amount: 100, date: new Date('2025-12-01T08:00:00.000Z'), toAccountId: checking.id, toAccount: checking.id, category: salary }),
    makeTransaction({ id: 'jan-expense', type: 'expense', amount: 30, date: new Date('2026-01-05T08:00:00.000Z'), fromAccountId: checking.id, fromAccount: checking.id, category: food }),
    makeTransaction({ id: 'feb-income', type: 'income', amount: 120, date: new Date('2026-02-07T08:00:00.000Z'), toAccountId: checking.id, toAccount: checking.id, category: salary }),
    makeTransaction({ id: 'mar-income', type: 'income', amount: 150, date: new Date('2026-03-02T08:00:00.000Z'), toAccountId: checking.id, toAccount: checking.id, category: salary }),
    makeTransaction({ id: 'mar-expense-1', type: 'expense', amount: 40, date: new Date('2026-03-04T08:00:00.000Z'), fromAccountId: checking.id, fromAccount: checking.id, category: food }),
    makeTransaction({ id: 'mar-expense-2', type: 'expense', amount: 10, date: new Date('2026-03-18T08:00:00.000Z'), fromAccountId: checking.id, fromAccount: checking.id, category: books }),
  ];

  const metrics = computeBehaviorMetrics(transactions, [budget], [checking], new Date('2026-03-31T23:59:59.999Z'));

  assert.deepEqual(
    metrics.monthly.map((entry) => entry.month),
    ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']
  );
  assert.deepEqual(metrics.currentMonth, {
    month: '2026-03',
    income: 150,
    expenses: 50,
    transfers: 0,
    net: 100,
  });
  assert.equal(metrics.budget.adherence, 1);
  assert.equal(metrics.budget.risk, 0.25);
  assert.equal(metrics.insightContext.monthlyIncome, 150);
  assert.equal(metrics.insightContext.monthlyExpenses, 50);
});

test('net worth progress starts from the first recorded account month when history is shorter than the default window', () => {
  const checking = makeAccount('checking', 'checking', '2026-01-01T08:00:00.000Z');
  const savings = makeAccount('savings', 'savings', '2026-02-01T08:00:00.000Z');

  const transactions = [
    makeTransaction({
      id: 'jan-income',
      type: 'income',
      amount: 500,
      date: new Date('2026-01-03T10:00:00.000Z'),
      toAccountId: checking.id,
      toAccount: checking.id,
      category: makeCategory('salary', 'Salary', '#22C55E'),
    }),
    ...Object.values(
      createTransferLegs({
        amount: 200,
        date: new Date('2026-02-10T10:00:00.000Z'),
        description: 'Build savings',
        category: TRANSFER_CATEGORY,
        fromAccountId: checking.id,
        toAccountId: savings.id,
        idFactory: (() => {
          let i = 90;
          return () => `nw-transfer-${++i}`;
        })(),
      })
    ),
    makeTransaction({
      id: 'mar-expense',
      type: 'expense',
      amount: 75,
      date: new Date('2026-03-15T10:00:00.000Z'),
      fromAccountId: checking.id,
      fromAccount: checking.id,
      category: makeCategory('food', 'Food', '#EF4444'),
    }),
  ];

  const progress = computeNetWorthProgress([checking, savings], transactions, 6, new Date('2026-03-31T23:59:59.999Z'));

  assert.deepEqual(progress.points.map((point) => point.month), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(progress.netWorth, [500, 500, 425]);
  assert.equal(progress.baselineNetWorth, 500);
  assert.equal(progress.currentNetWorth, 425);
});

test('category totals stay aligned across income and expense breakdown views', () => {
  const salary = makeCategory('salary', 'Salary', '#22C55E');
  const allowance = makeCategory('allowance', 'Meal Allowance', '#3B82F6');
  const food = makeCategory('food', 'Food', '#F97316');
  const transport = makeCategory('transport', 'Transport', '#8B5CF6');

  const transactions = [
    makeTransaction({ id: 'income-salary', type: 'income', amount: 800, date: new Date('2026-03-01T08:00:00.000Z'), category: salary }),
    makeTransaction({ id: 'income-allowance', type: 'income', amount: 200, date: new Date('2026-03-02T08:00:00.000Z'), category: allowance }),
    makeTransaction({ id: 'expense-food', type: 'expense', amount: 120, date: new Date('2026-03-03T08:00:00.000Z'), category: food }),
    makeTransaction({ id: 'expense-transport', type: 'expense', amount: 80, date: new Date('2026-03-04T08:00:00.000Z'), category: transport }),
  ];

  const incomeBreakdown = computeCategoryBreakdown(transactions, 'income');
  const expenseBreakdown = computeExpenseCategoryBreakdown(transactions);
  const expenseDistribution = computeExpenseDistribution(expenseBreakdown, 6);
  const quickStats = computeQuickStats(transactions, 4);

  assert.equal(incomeBreakdown.reduce((sum, item) => sum + item.amount, 0), quickStats.income);
  assert.equal(expenseBreakdown.reduce((sum, item) => sum + item.amount, 0), quickStats.expenses);
  assert.equal(expenseDistribution.reduce((sum, item) => sum + item.amount, 0), quickStats.expenses);
  assert.equal(expenseBreakdown.reduce((sum, item) => sum + item.share, 0), 1);
});
