import { Account, Transaction } from '../../types/transaction';
import { getAccountTypeDefinition } from '../../constants/account-types';
import { roundCurrency } from './ledger';

export interface DebtPortfolioTotals {
  borrowedPrincipal: number;
  borrowedOutstanding: number;
  lentOutstanding: number;
  debtRepayments: number;
}

function getToAccountId(transaction: Transaction): string | undefined {
  return transaction.toAccountId ?? transaction.toAccount;
}

function isLiabilityAccount(account: Account | undefined): boolean {
  if (!account) {
    return false;
  }

  return getAccountTypeDefinition(account.type).group === 'credit';
}

export function computeDebtPortfolioTotals(
  accounts: Account[],
  transactions: Transaction[]
): DebtPortfolioTotals {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  let borrowedPrincipal = 0;
  let lentOutstanding = 0;
  let debtRepayments = 0;

  for (const transaction of transactions) {
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
      continue;
    }

    if (transaction.type === 'debt') {
      if (transaction.debtDirection === 'borrowed') {
        const targetAccount = accountById.get(getToAccountId(transaction) ?? '');
        if (!isLiabilityAccount(targetAccount)) {
          borrowedPrincipal += transaction.amount;
        }
      } else if (transaction.debtDirection === 'lent') {
        lentOutstanding += transaction.amount;
      }
      continue;
    }

    if (transaction.type === 'expense' && transaction.debtPayment) {
      debtRepayments += transaction.amount;
    }
  }

  return {
    borrowedPrincipal: roundCurrency(borrowedPrincipal),
    borrowedOutstanding: roundCurrency(Math.max(0, borrowedPrincipal - debtRepayments)),
    lentOutstanding: roundCurrency(lentOutstanding),
    debtRepayments: roundCurrency(debtRepayments),
  };
}
