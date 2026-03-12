import { DebtAccount, Transaction } from '../../types/transaction';

function normalizeCounterparty(value?: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPositiveAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function computeDebtLedger(transactions: Transaction[]): DebtAccount[] {
  const ledger = new Map<string, DebtAccount>();

  for (const transaction of transactions) {
    if (transaction.type !== 'debt') {
      continue;
    }

    if (!transaction.debtDirection || !isPositiveAmount(transaction.amount)) {
      continue;
    }

    const counterparty = transaction.counterparty || transaction.merchant || transaction.description || 'Unknown';
    const normalized = normalizeCounterparty(counterparty) || 'unknown';
    const key = `${transaction.debtDirection}:${normalized}`;

    const existing = ledger.get(key);
    if (existing) {
      existing.balance = Math.round((existing.balance + transaction.amount) * 100) / 100;
      if (transaction.interestRate !== undefined) {
        existing.interestRate = transaction.interestRate;
      }
      if (transaction.dueDate) {
        existing.dueDate = transaction.dueDate;
      }
      if (!existing.updatedAt || transaction.date > existing.updatedAt) {
        existing.updatedAt = transaction.date;
      }
      continue;
    }

    ledger.set(key, {
      id: `debt-${transaction.debtDirection}-${normalized}`,
      counterparty,
      balance: Math.round(transaction.amount * 100) / 100,
      direction: transaction.debtDirection,
      interestRate: transaction.interestRate,
      dueDate: transaction.dueDate,
      updatedAt: transaction.date,
    });
  }

  return Array.from(ledger.values()).sort((a, b) => b.balance - a.balance);
}
