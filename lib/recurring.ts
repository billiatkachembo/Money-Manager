import { Transaction, RecurringRule, RecurringFrequency } from '@/types/transaction';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function getNextOccurrence(
  date: Date,
  frequency: RecurringFrequency
): Date {
  const next = new Date(date);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

export function materializeRecurringTransactions(
  now: Date,
  rules: RecurringRule[],
  existing: Transaction[]
): { newTransactions: Transaction[]; updatedRules: RecurringRule[] } {
  const newTransactions: Transaction[] = [];
  const updatedRules: RecurringRule[] = [];

  for (const rule of rules) {
    let cursor = new Date(rule.lastMaterializedAt ?? rule.startDate);
    const end = rule.endDate ? new Date(rule.endDate) : null;
    let didAdvance = false;

    const MAX_ITERATIONS = 1000;
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const next = getNextOccurrence(cursor, rule.frequency);

      if (next > now) break;
      if (end && next > end) break;

      const nextDateStr = next.toISOString().slice(0, 10);
      const exists = existing.some(
        t => t.recurringId === rule.id && t.date instanceof Date &&
          t.date.toISOString().slice(0, 10) === nextDateStr
      );

      if (!exists) {
        const alreadyQueued = newTransactions.some(
          t => t.recurringId === rule.id && t.date instanceof Date &&
            t.date.toISOString().slice(0, 10) === nextDateStr
        );

        if (!alreadyQueued) {
          newTransactions.push({
            ...rule.template,
            id: generateId(),
            date: next,
            createdAt: new Date(),
            recurringId: rule.id,
          });
        }
      }

      cursor = next;
      didAdvance = true;
    }

    updatedRules.push({
      ...rule,
      lastMaterializedAt: didAdvance ? cursor.toISOString() : rule.lastMaterializedAt,
    });
  }

  return { newTransactions, updatedRules };
}

export function createRecurringRuleFromTransaction(
  transaction: Transaction
): RecurringRule | null {
  if (!transaction.isRecurring || !transaction.recurringFrequency) {
    return null;
  }

  const dateStr = transaction.date instanceof Date
    ? transaction.date.toISOString()
    : new Date(transaction.date).toISOString();

  const { id: _id, date: _date, createdAt: _createdAt, ...template } = transaction;

  return {
    id: generateId(),
    frequency: transaction.recurringFrequency,
    startDate: dateStr,
    endDate: transaction.recurringEndDate
      ? (transaction.recurringEndDate instanceof Date
          ? transaction.recurringEndDate.toISOString()
          : new Date(transaction.recurringEndDate).toISOString())
      : undefined,
    lastMaterializedAt: dateStr,
    template: template as RecurringRule['template'],
  };
}
