import Papa from 'papaparse';
import { Account } from '@/types/transaction';

const formatIsoDate = (value: Date): string => {
  const safeDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(safeDate.getTime()) ? '' : safeDate.toISOString();
};

export const exportAccountsToCsv = (accounts: Account[]): string => {
  const rows = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance.toFixed(2),
    currency: account.currency ?? '',
    status: account.isActive ? 'active' : 'hidden',
    isActive: account.isActive ? 'true' : 'false',
    color: account.color ?? '',
    icon: account.icon ?? '',
    createdAt: formatIsoDate(account.createdAt),
  }));

  return Papa.unparse(rows, {
    quotes: true,
    delimiter: ',',
  });
};
