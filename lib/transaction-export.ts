import Papa from 'papaparse';
import { resolveCanonicalCategory } from '@/constants/categories';
import type { Transaction } from '@/types/transaction';

export type TransactionExportPreset = 'month_to_date' | 'last_month' | 'year_to_date' | 'last_year' | 'totals';
export type TransactionExportFormat = 'csv' | 'excel';

export interface TransactionExportPresetOption {
  key: TransactionExportPreset;
  label: string;
  description: string;
}

interface TransactionExportWindow {
  startDate?: Date;
  endDate?: Date;
  label: string;
  description: string;
}

interface TransactionExportSummary {
  transactionCount: number;
  income: number;
  expenses: number;
  transfers: number;
  debt: number;
  net: number;
}

interface PreparedTransactionExport {
  filteredTransactions: Transaction[];
  summary: TransactionExportSummary;
  window: TransactionExportWindow;
}

export const TRANSACTION_EXPORT_PRESET_OPTIONS: TransactionExportPresetOption[] = [
  {
    key: 'month_to_date',
    label: 'Monthly',
    description: 'From the start of this month to today',
  },
  {
    key: 'last_month',
    label: 'Last Month',
    description: 'The previous full calendar month',
  },
  {
    key: 'year_to_date',
    label: 'Annually',
    description: 'From the start of this year to today',
  },
  {
    key: 'last_year',
    label: 'Last Year',
    description: 'The previous full calendar year',
  },
  {
    key: 'totals',
    label: 'Totals Only',
    description: 'Summary totals without transaction rows',
  },
];

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(value: Date): Date {
  return new Date(value.getFullYear(), 0, 1);
}

function endOfYear(value: Date): Date {
  return new Date(value.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function formatDateToken(value?: Date): string {
  if (!value) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAmount(value: number): string {
  return roundCurrency(value).toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveWindow(preset: TransactionExportPreset, referenceDate: Date): TransactionExportWindow {
  switch (preset) {
    case 'month_to_date':
      return {
        startDate: startOfMonth(referenceDate),
        endDate: endOfDay(referenceDate),
        label: 'Monthly',
        description: 'Month to date',
      };
    case 'last_month': {
      const base = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
      return {
        startDate: startOfMonth(base),
        endDate: endOfMonth(base),
        label: 'Last Month',
        description: 'Previous calendar month',
      };
    }
    case 'year_to_date':
      return {
        startDate: startOfYear(referenceDate),
        endDate: endOfDay(referenceDate),
        label: 'Annually',
        description: 'Year to date',
      };
    case 'last_year': {
      const base = new Date(referenceDate.getFullYear() - 1, 0, 1);
      return {
        startDate: startOfYear(base),
        endDate: endOfYear(base),
        label: 'Last Year',
        description: 'Previous calendar year',
      };
    }
    case 'totals':
    default:
      return {
        label: 'Totals Only',
        description: 'All-time totals',
      };
  }
}

function summarizeTransactions(transactions: Transaction[]): TransactionExportSummary {
  const income = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const transfers = transactions
    .filter((transaction) => transaction.type === 'transfer')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const debt = transactions
    .filter((transaction) => transaction.type === 'debt')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    transactionCount: transactions.length,
    income: roundCurrency(income),
    expenses: roundCurrency(expenses),
    transfers: roundCurrency(transfers),
    debt: roundCurrency(debt),
    net: roundCurrency(income - expenses),
  };
}

function prepareTransactionExport(
  transactions: Transaction[],
  preset: TransactionExportPreset,
  referenceDate: Date = new Date()
): PreparedTransactionExport {
  const window = resolveWindow(preset, referenceDate);
  const filteredTransactions =
    window.startDate && window.endDate
      ? transactions.filter((transaction) => transaction.date >= window.startDate! && transaction.date <= window.endDate!)
      : transactions;

  return {
    filteredTransactions,
    summary: summarizeTransactions(filteredTransactions),
    window,
  };
}

function buildTransactionRows(transactions: Transaction[]) {
  return transactions.map((transaction) => {
    const canonicalCategory = resolveCanonicalCategory(transaction.category);

    return {
      Date: formatDateToken(transaction.date),
      Type: transaction.type,
      Amount: formatAmount(transaction.amount),
      Category: canonicalCategory?.name ?? transaction.category?.name ?? '',
      Subcategory: transaction.subcategory ?? '',
      Description: transaction.description,
      Note: transaction.note ?? '',
      Merchant: transaction.merchant ?? '',
      FromAccount: transaction.fromAccount ?? '',
      ToAccount: transaction.toAccount ?? '',
      DebtDirection: transaction.debtDirection ?? '',
      Counterparty: transaction.counterparty ?? '',
      DebtPayment: transaction.debtPayment ? 'Yes' : 'No',
    };
  });
}

function buildSummaryRow(prepared: PreparedTransactionExport) {
  return {
    Report: prepared.window.label,
    Description: prepared.window.description,
    From: formatDateToken(prepared.window.startDate),
    To: formatDateToken(prepared.window.endDate),
    Transactions: prepared.summary.transactionCount,
    Income: formatAmount(prepared.summary.income),
    Expenses: formatAmount(prepared.summary.expenses),
    Transfers: formatAmount(prepared.summary.transfers),
    Debt: formatAmount(prepared.summary.debt),
    Net: formatAmount(prepared.summary.net),
  };
}

export function exportTransactionsReportCsv(
  transactions: Transaction[],
  preset: TransactionExportPreset,
  referenceDate: Date = new Date()
): string {
  const prepared = prepareTransactionExport(transactions, preset, referenceDate);
  const summaryCsv = Papa.unparse([buildSummaryRow(prepared)], { quotes: true, delimiter: ',' });

  if (preset === 'totals') {
    return `"Summary"\n${summaryCsv}`;
  }

  const transactionRows = buildTransactionRows(prepared.filteredTransactions);
  const detailsCsv = Papa.unparse(transactionRows, { quotes: true, delimiter: ',' });
  return `"Summary"\n${summaryCsv}\n\n"Transactions"\n${detailsCsv}`;
}

export function exportTransactionsReportExcel(
  transactions: Transaction[],
  preset: TransactionExportPreset,
  referenceDate: Date = new Date()
): string {
  const prepared = prepareTransactionExport(transactions, preset, referenceDate);
  const summary = buildSummaryRow(prepared);
  const detailRows = preset === 'totals' ? [] : buildTransactionRows(prepared.filteredTransactions);

  const summaryHeaderCells = Object.keys(summary)
    .map((key) => `<th>${escapeHtml(key)}</th>`)
    .join('');
  const summaryValueCells = Object.values(summary)
    .map((value) => `<td>${escapeHtml(String(value))}</td>`)
    .join('');

  const detailsHeaderCells = detailRows.length > 0
    ? Object.keys(detailRows[0]).map((key) => `<th>${escapeHtml(key)}</th>`).join('')
    : '';
  const detailsRows = detailRows
    .map((row) => `<tr>${Object.values(row).map((value) => `<td>${escapeHtml(String(value))}</td>`).join('')}</tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
      th, td { border: 1px solid #D0D7DE; padding: 8px 10px; font-size: 12px; text-align: left; }
      th { background: #F3F4F6; font-weight: 700; }
      h1, h2 { margin: 0 0 10px; }
      p { margin: 0 0 16px; color: #475569; }
    </style>
  </head>
  <body>
    <h1>Money Manager Export</h1>
    <p>${escapeHtml(prepared.window.label)} - ${escapeHtml(prepared.window.description)}</p>
    <h2>Summary</h2>
    <table>
      <thead><tr>${summaryHeaderCells}</tr></thead>
      <tbody><tr>${summaryValueCells}</tr></tbody>
    </table>
    ${detailRows.length > 0 ? `<h2>Transactions</h2><table><thead><tr>${detailsHeaderCells}</tr></thead><tbody>${detailsRows}</tbody></table>` : ''}
  </body>
</html>`;
}
