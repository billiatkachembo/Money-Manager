import { Transaction, Account } from '@/types/transaction';

const CURRENCY_EPSILON = 0.005;

export interface LedgerHealthReport {
  valid: boolean;
  issues: string[];
  orphanedTransfers: string[];
  partialOrphanedTransfers: string[];
  duplicateIds: string[];
  invalidAmounts: string[];
  transferIntegrityOk: boolean;
}

interface MonthlyTotals {
  income: number;
  expenses: number;
}

function parseTransactionDate(date: Date | string): Date | null {
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMonthKey(date: Date | string): string | null {
  const parsed = parseTransactionDate(date);
  if (!parsed) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function safeAmount(amount: number): number {
  return Number.isFinite(amount) ? amount : 0;
}

function computeMonthlyTotals(transactions: Transaction[], month: string): MonthlyTotals {
  let income = 0;
  let expenses = 0;

  for (const tx of transactions) {
    const txMonth = toMonthKey(tx.date);
    if (txMonth !== month) continue;

    const amount = safeAmount(tx.amount);
    if (tx.type === 'income') income += amount;
    if (tx.type === 'expense') expenses += amount;
  }

  return { income, expenses };
}

function aggregateMonthlyTotals(transactions: Transaction[]): Map<string, MonthlyTotals> {
  const totals = new Map<string, MonthlyTotals>();

  for (const tx of transactions) {
    if (tx.type !== 'income' && tx.type !== 'expense') continue;
    const month = toMonthKey(tx.date);
    if (!month) continue;

    const current = totals.get(month) ?? { income: 0, expenses: 0 };
    const amount = safeAmount(tx.amount);

    if (tx.type === 'income') current.income += amount;
    if (tx.type === 'expense') current.expenses += amount;

    totals.set(month, current);
  }

  return totals;
}

export function deriveAccountBalance(
  accountId: string,
  transactions: Transaction[]
): number {
  let balance = 0;

  for (const tx of transactions) {
    const amount = safeAmount(tx.amount);

    if (tx.type === 'income' && tx.toAccount === accountId) {
      balance += amount;
    }

    if (tx.type === 'expense' && tx.fromAccount === accountId) {
      balance -= amount;
    }

    if (tx.type === 'transfer') {
      if (tx.toAccount === accountId) balance += amount;
      if (tx.fromAccount === accountId) balance -= amount;
    }
  }

  return balance;
}

export function deriveNetBalance(transactions: Transaction[]): number {
  let balance = 0;

  for (const tx of transactions) {
    const amount = safeAmount(tx.amount);

    if (tx.type === 'income') {
      balance += amount;
    } else if (tx.type === 'expense') {
      balance -= amount;
    }
  }

  return balance;
}

export function recomputeAllBalances(
  accounts: Account[],
  transactions: Transaction[]
): Account[] {
  return accounts.map(acc => ({
    ...acc,
    balance: deriveAccountBalance(acc.id, transactions),
  }));
}

export interface LedgerValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateLedgerIntegrity(
  transactions: Transaction[]
): LedgerValidationResult {
  const issues: string[] = [];

  for (const tx of transactions) {
    if (!Number.isFinite(tx.amount) || tx.amount <= 0) {
      issues.push(`Transaction ${tx.id} has non-positive amount: ${tx.amount}`);
    }

    if (tx.type === 'transfer') {
      if (!tx.fromAccount || !tx.toAccount) {
        issues.push(`Transfer ${tx.id} missing account`);
      }

      if (tx.fromAccount === tx.toAccount) {
        issues.push(`Transfer ${tx.id} same account`);
      }
    }

    if (!tx.id) {
      issues.push('Transaction found with empty id');
    }

    if (!tx.date) {
      issues.push(`Transaction ${tx.id} has no date`);
    } else if (!parseTransactionDate(tx.date)) {
      issues.push(`Transaction ${tx.id} has invalid date`);
    }
  }

  const idSet = new Set<string>();
  for (const tx of transactions) {
    if (idSet.has(tx.id)) {
      issues.push(`Duplicate transaction id: ${tx.id}`);
    }
    idSet.add(tx.id);
  }

  return { valid: issues.length === 0, issues };
}

export function deepLedgerAudit(
  transactions: Transaction[],
  accounts: Account[]
): LedgerHealthReport {
  const issues: string[] = [];
  const orphanedTransfers: string[] = [];
  const partialOrphanedTransfers: string[] = [];
  const duplicateIds: string[] = [];
  const invalidAmounts: string[] = [];
  const accountIds = new Set(accounts.map(a => a.id));

  const idCounts = new Map<string, number>();
  for (const tx of transactions) {
    idCounts.set(tx.id, (idCounts.get(tx.id) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      duplicateIds.push(id);
      issues.push(`Duplicate transaction id: ${id} (${count} occurrences)`);
    }
  }

  for (const tx of transactions) {
    if (!Number.isFinite(tx.amount) || tx.amount <= 0) {
      invalidAmounts.push(tx.id);
      issues.push(`Transaction ${tx.id} has invalid amount: ${tx.amount}`);
    }

    if (tx.type === 'transfer') {
      const sourceAccount = tx.fromAccount;
      const destinationAccount = tx.toAccount;

      const missingSource = !sourceAccount;
      const missingDestination = !destinationAccount;
      const unknownSource = sourceAccount ? !accountIds.has(sourceAccount) : false;
      const unknownDestination = destinationAccount ? !accountIds.has(destinationAccount) : false;

      const sourceBroken = missingSource || unknownSource;
      const destinationBroken = missingDestination || unknownDestination;

      if (sourceBroken || destinationBroken) {
        orphanedTransfers.push(tx.id);
      }

      if ((sourceBroken ? 1 : 0) + (destinationBroken ? 1 : 0) === 1) {
        partialOrphanedTransfers.push(tx.id);
      }

      if (missingSource) {
        issues.push(`Transfer ${tx.id} missing source account reference`);
      } else if (unknownSource) {
        issues.push(`Transfer ${tx.id} references non-existent source account: ${sourceAccount}`);
      }

      if (missingDestination) {
        issues.push(`Transfer ${tx.id} missing destination account reference`);
      } else if (unknownDestination) {
        issues.push(`Transfer ${tx.id} references non-existent destination account: ${destinationAccount}`);
      }

      if (!missingSource && !missingDestination && sourceAccount === destinationAccount) {
        issues.push(`Transfer ${tx.id} same source and destination account`);
      }
    }
  }

  let transferIntegrityOk = true;
  const transferSum = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'transfer') continue;
    const amount = safeAmount(tx.amount);
    if (tx.fromAccount) {
      transferSum.set(tx.fromAccount, (transferSum.get(tx.fromAccount) || 0) - amount);
    }
    if (tx.toAccount) {
      transferSum.set(tx.toAccount, (transferSum.get(tx.toAccount) || 0) + amount);
    }
  }
  let totalTransferNet = 0;
  for (const [, val] of transferSum) {
    totalTransferNet += val;
  }
  if (Math.abs(totalTransferNet) > CURRENCY_EPSILON) {
    transferIntegrityOk = false;
    issues.push(`Transfer integrity violation: net transfer sum is ${totalTransferNet.toFixed(4)}, expected 0`);
  }

  return {
    valid: issues.length === 0,
    issues,
    orphanedTransfers: [...new Set(orphanedTransfers)],
    partialOrphanedTransfers: [...new Set(partialOrphanedTransfers)],
    duplicateIds,
    invalidAmounts,
    transferIntegrityOk,
  };
}

export function verifyBalanceDeterminism(
  accounts: Account[],
  transactions: Transaction[]
): { drifted: boolean; driftedAccounts: { id: string; cached: number; derived: number }[] } {
  const driftedAccounts: { id: string; cached: number; derived: number }[] = [];

  for (const acc of accounts) {
    const derived = deriveAccountBalance(acc.id, transactions);
    if (Math.abs(acc.balance - derived) > CURRENCY_EPSILON) {
      driftedAccounts.push({ id: acc.id, cached: acc.balance, derived });
    }
  }

  return { drifted: driftedAccounts.length > 0, driftedAccounts };
}

export function getMonthlyNetCashFlow(
  transactions: Transaction[],
  month: string
): number {
  const totals = computeMonthlyTotals(transactions, month);
  return totals.income - totals.expenses;
}

export function getMonthlyIncome(
  transactions: Transaction[],
  month: string
): number {
  return computeMonthlyTotals(transactions, month).income;
}

export function getMonthlyExpenses(
  transactions: Transaction[],
  month: string
): number {
  return computeMonthlyTotals(transactions, month).expenses;
}

export function getLast6MonthsData(transactions: Transaction[]): {
  months: string[];
  income: number[];
  expenses: number[];
  net: number[];
} {
  const months: string[] = [];
  const income: number[] = [];
  const expenses: number[] = [];
  const net: number[] = [];
  const monthlyTotals = aggregateMonthlyTotals(transactions);

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(month);

    const totals = monthlyTotals.get(month) ?? { income: 0, expenses: 0 };
    const inc = totals.income;
    const exp = totals.expenses;
    income.push(inc);
    expenses.push(exp);
    net.push(inc - exp);
  }

  return { months, income, expenses, net };
}
