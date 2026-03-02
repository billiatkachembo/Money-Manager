import { Transaction, Account } from '@/types/transaction';
import { deriveAccountBalance, validateLedgerIntegrity } from './ledger';

export type ReconciliationIssueType =
  | 'balance_drift'
  | 'orphaned_transfer'
  | 'duplicate_transaction'
  | 'missing_transfer_leg'
  | 'negative_account_balance'
  | 'invalid_amount';

export interface ReconciliationIssue {
  type: ReconciliationIssueType;
  severity: 'auto_fix' | 'warning';
  message: string;
  transactionId?: string;
  accountId?: string;
}

export interface ReconciliationResult {
  issues: ReconciliationIssue[];
  autoFixed: number;
  warnings: number;
  correctedAccounts: Account[];
  deduplicatedTransactions: Transaction[];
  ranAt: string;
}

function findExactDuplicates(transactions: Transaction[]): Set<string> {
  const seen = new Map<string, string>();
  const duplicateIds = new Set<string>();

  for (const tx of transactions) {
    const dateStr = tx.date instanceof Date ? tx.date.toISOString().slice(0, 10) : new Date(tx.date).toISOString().slice(0, 10);
    const key = `${tx.type}|${tx.amount}|${dateStr}|${tx.category.id}|${tx.description}|${tx.fromAccount ?? ''}|${tx.toAccount ?? ''}`;

    if (seen.has(key)) {
      duplicateIds.add(tx.id);
    } else {
      seen.set(key, tx.id);
    }
  }

  return duplicateIds;
}

function detectBalanceDrift(
  accounts: Account[],
  transactions: Transaction[]
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  for (const account of accounts) {
    const derived = deriveAccountBalance(account.id, transactions);
    if (Math.abs(account.balance - derived) > 0.005) {
      issues.push({
        type: 'balance_drift',
        severity: 'auto_fix',
        message: `Account "${account.name}" cached balance (${account.balance.toFixed(2)}) differs from derived (${derived.toFixed(2)})`,
        accountId: account.id,
      });
    }
  }

  return issues;
}

function detectOrphanedTransfers(transactions: Transaction[]): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  for (const tx of transactions) {
    if (tx.type !== 'transfer') continue;

    if (!tx.fromAccount || !tx.toAccount) {
      issues.push({
        type: 'orphaned_transfer',
        severity: 'warning',
        message: `Transfer "${tx.description}" (${tx.id}) missing ${!tx.fromAccount ? 'source' : 'destination'} account`,
        transactionId: tx.id,
      });
    }

    if (tx.fromAccount && tx.toAccount && tx.fromAccount === tx.toAccount) {
      issues.push({
        type: 'missing_transfer_leg',
        severity: 'warning',
        message: `Transfer "${tx.description}" (${tx.id}) has same source and destination`,
        transactionId: tx.id,
      });
    }
  }

  return issues;
}

function detectInvalidAmounts(transactions: Transaction[]): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  for (const tx of transactions) {
    if (tx.amount <= 0 || !isFinite(tx.amount)) {
      issues.push({
        type: 'invalid_amount',
        severity: 'warning',
        message: `Transaction "${tx.description}" (${tx.id}) has invalid amount: ${tx.amount}`,
        transactionId: tx.id,
      });
    }
  }

  return issues;
}

function detectNegativeBalances(
  accounts: Account[],
  transactions: Transaction[]
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  for (const account of accounts) {
    if (account.type === 'credit') continue;
    const derived = deriveAccountBalance(account.id, transactions);
    if (derived < -0.005) {
      issues.push({
        type: 'negative_account_balance',
        severity: 'warning',
        message: `Account "${account.name}" has negative balance: ${derived.toFixed(2)}`,
        accountId: account.id,
      });
    }
  }

  return issues;
}

export function runReconciliation(
  transactions: Transaction[],
  accounts: Account[]
): ReconciliationResult {
  const allIssues: ReconciliationIssue[] = [];
  let autoFixed = 0;

  const duplicateIds = findExactDuplicates(transactions);
  for (const id of duplicateIds) {
    allIssues.push({
      type: 'duplicate_transaction',
      severity: 'auto_fix',
      message: `Duplicate transaction removed: ${id}`,
      transactionId: id,
    });
  }

  const deduplicatedTransactions = transactions.filter(tx => !duplicateIds.has(tx.id));
  autoFixed += duplicateIds.size;

  const driftIssues = detectBalanceDrift(accounts, deduplicatedTransactions);
  allIssues.push(...driftIssues);

  const correctedAccounts = accounts.map(acc => {
    const derived = deriveAccountBalance(acc.id, deduplicatedTransactions);
    if (Math.abs(acc.balance - derived) > 0.005) {
      autoFixed++;
      return { ...acc, balance: derived };
    }
    return acc;
  });

  allIssues.push(...detectOrphanedTransfers(deduplicatedTransactions));
  allIssues.push(...detectInvalidAmounts(deduplicatedTransactions));
  allIssues.push(...detectNegativeBalances(correctedAccounts, deduplicatedTransactions));

  const ledgerCheck = validateLedgerIntegrity(deduplicatedTransactions);
  if (!ledgerCheck.valid) {
    console.warn('[Reconciliation] Ledger integrity issues:', ledgerCheck.issues);
  }

  const warnings = allIssues.filter(i => i.severity === 'warning').length;

  console.log(`[Reconciliation] Complete: ${autoFixed} auto-fixed, ${warnings} warnings, ${allIssues.length} total issues`);

  return {
    issues: allIssues,
    autoFixed,
    warnings,
    correctedAccounts,
    deduplicatedTransactions,
    ranAt: new Date().toISOString(),
  };
}
