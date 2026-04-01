import Papa from 'papaparse';
import { Account, AccountTypeDefinition, AccountTypeGroup } from '@/types/transaction';
import { ACCOUNT_TYPE_GROUPS, getAccountTypeDefinition } from '@/constants/account-types';

const groupLabelByKey = new Map<AccountTypeGroup, string>(ACCOUNT_TYPE_GROUPS.map((group) => [group.key, group.label]));

const formatIsoDate = (value: Date): string => {
  const safeDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(safeDate.getTime()) ? '' : safeDate.toISOString();
};

const roundCurrency = (value: number): string => (Math.round(value * 100) / 100).toFixed(2);

const isLiabilityGroup = (group: AccountTypeGroup): boolean => group === 'credit';

const getDisplayBalance = (account: Account, definition: AccountTypeDefinition): number =>
  isLiabilityGroup(definition.group) ? -Math.abs(account.balance) : account.balance;

interface AccountCsvActivitySummary {
  income: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  debtIn: number;
  debtOut: number;
  debtPayments: number;
}

interface ExportAccountsToCsvOptions {
  accountTypeDefinitions?: AccountTypeDefinition[];
  activityByAccountId?: Map<string, AccountCsvActivitySummary>;
  exportedAt?: Date;
}

export const exportAccountsToCsv = (accounts: Account[], options: ExportAccountsToCsvOptions = {}): string => {
  const exportedAt = options.exportedAt ?? new Date();

  const rows = accounts.map((account, index) => {
    const definition = getAccountTypeDefinition(account.type, options.accountTypeDefinitions);
    const activity = options.activityByAccountId?.get(account.id);
    const displayBalance = getDisplayBalance(account, definition);
    const netActivity = (activity?.income ?? 0) - (activity?.expenses ?? 0);

    return {
      'Exported At': formatIsoDate(exportedAt),
      'Row': String(index + 1),
      'Account ID': account.id,
      'Account Name': account.name,
      'Account Type': definition.label,
      'Account Group': groupLabelByKey.get(definition.group) ?? definition.group,
      'Type Key': account.type,
      'Balance': roundCurrency(displayBalance),
      'Balance Direction': displayBalance < 0 ? 'liability' : 'asset',
      'Status': account.isActive ? 'Active' : 'Hidden',
      'Currency': account.currency ?? '',
      'Income Total': roundCurrency(activity?.income ?? 0),
      'Expense Total': roundCurrency(activity?.expenses ?? 0),
      'Transfer In Total': roundCurrency(activity?.transfersIn ?? 0),
      'Transfer Out Total': roundCurrency(activity?.transfersOut ?? 0),
      'Debt In Total': roundCurrency(activity?.debtIn ?? 0),
      'Debt Out Total': roundCurrency(activity?.debtOut ?? 0),
      'Debt Payments Total': roundCurrency(activity?.debtPayments ?? 0),
      'Net Income vs Expense': roundCurrency(netActivity),
      'Color': account.color ?? '',
      'Icon': account.icon ?? '',
      'Created At': formatIsoDate(account.createdAt),
    };
  });

  return Papa.unparse(rows, {
    quotes: true,
    delimiter: ',',
  });
};
