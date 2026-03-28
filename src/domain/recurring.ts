import { RecurringFrequency, RecurringRule, Transaction } from '../../types/transaction';

export interface MaterializeRecurringResult {
  newTransactions: Transaction[];
  updatedRules: RecurringRule[];
}

function defaultIdFactory(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function getNextOccurrence(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);

  switch (frequency) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'yearly':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }

  return next;
}

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createRecurringRuleFromTransaction(
  transaction: Transaction,
  idFactory: () => string = defaultIdFactory
): RecurringRule | null {
  if (!transaction.isRecurring || !transaction.recurringFrequency) {
    return null;
  }

  const { id: _id, date: _date, ...template } = transaction;

  return {
    id: idFactory(),
    frequency: transaction.recurringFrequency,
    startDate: transaction.date.toISOString(),
    endDate: transaction.recurringEndDate?.toISOString(),
    lastMaterializedAt: transaction.date.toISOString(),
    template: {
      ...template,
      fromAccountId: template.fromAccountId ?? template.fromAccount,
      toAccountId: template.toAccountId ?? template.toAccount,
    },
  };
}

export function materializeRecurringTransactions(
  now: Date,
  rules: RecurringRule[],
  existing: Transaction[],
  idFactory: () => string = defaultIdFactory
): MaterializeRecurringResult {
  const newTransactions: Transaction[] = [];
  const updatedRules: RecurringRule[] = [];

  for (const rule of rules) {
    let cursor = new Date(rule.lastMaterializedAt ?? rule.startDate);
    const end = rule.endDate ? new Date(rule.endDate) : null;

    while (true) {
      const next = getNextOccurrence(cursor, rule.frequency);
      if (next > now) {
        break;
      }

      if (end && next > end) {
        break;
      }

      const occurrenceDay = toIsoDay(next);
      const exists = existing.some(
        (transaction) => transaction.recurringId === rule.id && toIsoDay(transaction.date) === occurrenceDay
      );

      if (!exists) {
        newTransactions.push({
          ...rule.template,
          id: idFactory(),
          date: next,
          createdAt: new Date(),
          updatedAt: new Date(),
          recurringId: rule.id,
          materializedForDate: occurrenceDay,
        });
      }

      cursor = next;
    }

    updatedRules.push({
      ...rule,
      lastMaterializedAt: cursor.toISOString(),
    });
  }

  return { newTransactions, updatedRules };
}
