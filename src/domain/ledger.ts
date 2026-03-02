import { Account, Transaction, TransactionCategory } from '../../types/transaction';

export interface LedgerValidationResult {
  valid: boolean;
  issues: string[];
}

export interface CreateTransferLegsArgs {
  amount: number;
  date: Date;
  description: string;
  category: TransactionCategory;
  fromAccountId: string;
  toAccountId: string;
  createdAt?: Date;
  updatedAt?: Date;
  recurringId?: string;
  recurringFrequency?: Transaction['recurringFrequency'];
  recurringEndDate?: Date;
  isRecurring?: boolean;
  parentTransactionId?: string;
  materializedForDate?: string;
  tags?: string[];
  transferGroupId?: string;
  debitId?: string;
  creditId?: string;
  idFactory?: () => string;
}

const EPSILON = 1e-6;

export function getFromAccountId(transaction: Transaction): string | undefined {
  return transaction.fromAccountId ?? transaction.fromAccount;
}

export function getToAccountId(transaction: Transaction): string | undefined {
  return transaction.toAccountId ?? transaction.toAccount;
}

export function isVisibleTransaction(transaction: Transaction): boolean {
  return !transaction.isHidden;
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPositiveFiniteAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function deriveAccountBalance(accountId: string, transactions: Transaction[]): number {
  let balance = 0;

  for (const tx of transactions) {
    if (!isPositiveFiniteAmount(tx.amount)) {
      continue;
    }

    const from = getFromAccountId(tx);
    const to = getToAccountId(tx);

    if (tx.type === 'income' && to === accountId) {
      balance += tx.amount;
    }

    if (tx.type === 'expense' && from === accountId) {
      balance -= tx.amount;
    }

    if (tx.type === 'transfer') {
      if (tx.transferLeg === 'debit') {
        if (from === accountId) {
          balance -= tx.amount;
        }
      } else if (tx.transferLeg === 'credit') {
        if (to === accountId) {
          balance += tx.amount;
        }
      } else {
        if (to === accountId) {
          balance += tx.amount;
        }
        if (from === accountId) {
          balance -= tx.amount;
        }
      }
    }
  }

  return roundCurrency(balance);
}

export function recomputeAllBalances(accounts: Account[], transactions: Transaction[]): Account[] {
  return accounts.map((account) => ({
    ...account,
    balance: deriveAccountBalance(account.id, transactions),
  }));
}

function defaultIdFactory(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function createTransferLegs(args: CreateTransferLegsArgs): { debit: Transaction; credit: Transaction } {
  const idFactory = args.idFactory ?? defaultIdFactory;
  const transferGroupId = args.transferGroupId ?? idFactory();
  const createdAt = args.createdAt ?? new Date();
  const updatedAt = args.updatedAt ?? createdAt;

  const base: Omit<Transaction, 'id' | 'transferLeg' | 'isHidden'> = {
    amount: args.amount,
    description: args.description,
    category: args.category,
    type: 'transfer',
    date: args.date,
    createdAt,
    updatedAt,
    fromAccount: args.fromAccountId,
    toAccount: args.toAccountId,
    fromAccountId: args.fromAccountId,
    toAccountId: args.toAccountId,
    transferGroupId,
    recurringId: args.recurringId,
    recurringFrequency: args.recurringFrequency,
    recurringEndDate: args.recurringEndDate,
    isRecurring: args.isRecurring,
    parentTransactionId: args.parentTransactionId,
    materializedForDate: args.materializedForDate,
    tags: args.tags,
  };

  const debit: Transaction = {
    ...base,
    id: args.debitId ?? idFactory(),
    transferLeg: 'debit',
    isHidden: false,
  };

  const credit: Transaction = {
    ...base,
    id: args.creditId ?? idFactory(),
    transferLeg: 'credit',
    isHidden: true,
  };

  return { debit, credit };
}

export function validateLedgerIntegrity(transactions: Transaction[]): LedgerValidationResult {
  const issues: string[] = [];
  const transferGroups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (!isPositiveFiniteAmount(transaction.amount)) {
      issues.push(`Transaction ${transaction.id} has invalid amount`);
    }

    if (Number.isNaN(transaction.date.getTime())) {
      issues.push(`Transaction ${transaction.id} has invalid date`);
    }

    if (transaction.type !== 'transfer') {
      continue;
    }

    const from = getFromAccountId(transaction);
    const to = getToAccountId(transaction);

    if (transaction.transferGroupId) {
      const group = transferGroups.get(transaction.transferGroupId) ?? [];
      group.push(transaction);
      transferGroups.set(transaction.transferGroupId, group);
      continue;
    }

    if (!from || !to) {
      issues.push(`Transfer ${transaction.id} missing account`);
      continue;
    }

    if (from === to) {
      issues.push(`Transfer ${transaction.id} has same source and destination account`);
    }
  }

  for (const [groupId, legs] of transferGroups.entries()) {
    if (legs.length !== 2) {
      issues.push(`Transfer group ${groupId} expected 2 legs but found ${legs.length}`);
      continue;
    }

    const debit = legs.find((leg) => leg.transferLeg === 'debit');
    const credit = legs.find((leg) => leg.transferLeg === 'credit');

    if (!debit || !credit) {
      issues.push(`Transfer group ${groupId} must contain one debit and one credit leg`);
      continue;
    }

    if (Math.abs(debit.amount - credit.amount) > EPSILON) {
      issues.push(`Transfer group ${groupId} has mismatched leg amounts`);
    }

    const from = getFromAccountId(debit) ?? getFromAccountId(credit);
    const to = getToAccountId(debit) ?? getToAccountId(credit);

    if (!from || !to) {
      issues.push(`Transfer group ${groupId} missing account linkage`);
      continue;
    }

    if (from === to) {
      issues.push(`Transfer group ${groupId} has same source and destination account`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function replaceTransactionsByIds(
  transactions: Transaction[],
  idsToReplace: Set<string>,
  replacements: Transaction[]
): Transaction[] {
  const next = transactions.filter((transaction) => !idsToReplace.has(transaction.id));
  return [...replacements, ...next].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function deleteTransferPair(transactions: Transaction[], transaction: Transaction): Transaction[] {
  if (transaction.type !== 'transfer') {
    return transactions.filter((entry) => entry.id !== transaction.id);
  }

  const groupId = transaction.transferGroupId;
  if (!groupId) {
    return transactions.filter((entry) => entry.id !== transaction.id);
  }

  return transactions.filter((entry) => entry.transferGroupId !== groupId);
}
