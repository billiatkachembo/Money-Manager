import { Transaction, Account } from '@/types/transaction';

export interface LedgerHealthReport {
  valid: boolean;
  issues: string[];
  orphanedTransfers: string[];
  duplicateIds: string[];
  invalidAmounts: string[];
  transferIntegrityOk: boolean;
}

export function deriveAccountBalance(
  accountId: string,
  transactions: Transaction[]
): number {
  let balance = 0;

  for (const tx of transactions) {
    if (tx.type === 'income' && tx.toAccount === accountId) {
      balance += tx.amount;
    }

    if (tx.type === 'expense' && tx.fromAccount === accountId) {
      balance -= tx.amount;
    }

    if (tx.type === 'transfer') {
      if (tx.toAccount === accountId) balance += tx.amount;
      if (tx.fromAccount === accountId) balance -= tx.amount;
    }
  }

  return balance;
}

export function deriveNetBalance(transactions: Transaction[]): number {
  let balance = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      balance += tx.amount;
    } else if (tx.type === 'expense') {
      balance -= tx.amount;
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
    if (tx.amount <= 0) {
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
    if (!isFinite(tx.amount) || tx.amount <= 0) {
      invalidAmounts.push(tx.id);
      issues.push(`Transaction ${tx.id} has invalid amount: ${tx.amount}`);
    }

    if (tx.type === 'transfer') {
      if (!tx.fromAccount || !tx.toAccount) {
        orphanedTransfers.push(tx.id);
        issues.push(`Transfer ${tx.id} missing account reference`);
      } else {
        if (!accountIds.has(tx.fromAccount)) {
          orphanedTransfers.push(tx.id);
          issues.push(`Transfer ${tx.id} references non-existent source account: ${tx.fromAccount}`);
        }
        if (!accountIds.has(tx.toAccount)) {
          orphanedTransfers.push(tx.id);
          issues.push(`Transfer ${tx.id} references non-existent destination account: ${tx.toAccount}`);
        }
        if (tx.fromAccount === tx.toAccount) {
          issues.push(`Transfer ${tx.id} same source and destination account`);
        }
      }
    }
  }

  let transferIntegrityOk = true;
  const transferSum = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'transfer') continue;
    if (tx.fromAccount) {
      transferSum.set(tx.fromAccount, (transferSum.get(tx.fromAccount) || 0) - tx.amount);
    }
    if (tx.toAccount) {
      transferSum.set(tx.toAccount, (transferSum.get(tx.toAccount) || 0) + tx.amount);
    }
  }
  let totalTransferNet = 0;
  for (const [, val] of transferSum) {
    totalTransferNet += val;
  }
  if (Math.abs(totalTransferNet) > 0.005) {
    transferIntegrityOk = false;
    issues.push(`Transfer integrity violation: net transfer sum is ${totalTransferNet.toFixed(4)}, expected 0`);
  }

  return {
    valid: issues.length === 0,
    issues,
    orphanedTransfers: [...new Set(orphanedTransfers)],
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
    if (Math.abs(acc.balance - derived) > 0.005) {
      driftedAccounts.push({ id: acc.id, cached: acc.balance, derived });
    }
  }

  return { drifted: driftedAccounts.length > 0, driftedAccounts };
}

export function getMonthlyNetCashFlow(
  transactions: Transaction[],
  month: string
): number {
  let income = 0;
  let expenses = 0;

  for (const tx of transactions) {
    const txMonth = tx.date instanceof Date
      ? tx.date.toISOString().slice(0, 7)
      : new Date(tx.date).toISOString().slice(0, 7);

    if (txMonth !== month) continue;

    if (tx.type === 'income') income += tx.amount;
    if (tx.type === 'expense') expenses += tx.amount;
  }

  return income - expenses;
}

export function getMonthlyIncome(
  transactions: Transaction[],
  month: string
): number {
  let total = 0;
  for (const tx of transactions) {
    const txMonth = tx.date instanceof Date
      ? tx.date.toISOString().slice(0, 7)
      : new Date(tx.date).toISOString().slice(0, 7);
    if (txMonth === month && tx.type === 'income') {
      total += tx.amount;
    }
  }
  return total;
}

export function getMonthlyExpenses(
  transactions: Transaction[],
  month: string
): number {
  let total = 0;
  for (const tx of transactions) {
    const txMonth = tx.date instanceof Date
      ? tx.date.toISOString().slice(0, 7)
      : new Date(tx.date).toISOString().slice(0, 7);
    if (txMonth === month && tx.type === 'expense') {
      total += tx.amount;
    }
  }
  return total;
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

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = d.toISOString().slice(0, 7);
    months.push(month);

    const inc = getMonthlyIncome(transactions, month);
    const exp = getMonthlyExpenses(transactions, month);
    income.push(inc);
    expenses.push(exp);
    net.push(inc - exp);
  }

  return { months, income, expenses, net };
}
