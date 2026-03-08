import { ALL_CATEGORIES } from '@/constants/categories';
import { Transaction, TransactionCategory } from '@/types/transaction';

export interface ImportedTransactionDraft extends Omit<Transaction, 'id' | 'createdAt'> {}

interface ParsedCsvResult {
  transactions: ImportedTransactionDraft[];
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

const TRANSFER_CATEGORY: TransactionCategory = {
  id: 'transfer',
  name: 'Transfer',
  icon: 'ArrowLeftRight',
  color: '#667eea',
};

const DEFAULT_INCOME_CATEGORY: TransactionCategory = {
  id: 'imported-income',
  name: 'Imported Income',
  icon: 'PlusCircle',
  color: '#16A34A',
};

const DEFAULT_EXPENSE_CATEGORY: TransactionCategory = {
  id: 'imported-expense',
  name: 'Imported Expense',
  icon: 'Receipt',
  color: '#DC2626',
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeType(value: string): Transaction['type'] | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'income' || normalized === 'expense' || normalized === 'transfer') {
    return normalized;
  }

  return null;
}

function normalizeDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    if (character !== '\r') {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => value.trim().length > 0));
}

function resolveCategory(
  type: Transaction['type'],
  categoryIdRaw: string,
  categoryNameRaw: string,
  categories: TransactionCategory[]
): TransactionCategory {
  if (type === 'transfer') {
    return TRANSFER_CATEGORY;
  }

  const categoryId = categoryIdRaw.trim();
  const categoryName = categoryNameRaw.trim();
  const normalizedName = categoryName.toLowerCase();

  const existing = categories.find((category) => {
    return category.id === categoryId || category.name.toLowerCase() === normalizedName;
  });

  if (existing) {
    return existing;
  }

  if (!categoryId && !categoryName) {
    return type === 'income' ? DEFAULT_INCOME_CATEGORY : DEFAULT_EXPENSE_CATEGORY;
  }

  return {
    id: categoryId || slugify(categoryName) || (type === 'income' ? DEFAULT_INCOME_CATEGORY.id : DEFAULT_EXPENSE_CATEGORY.id),
    name: categoryName || (type === 'income' ? DEFAULT_INCOME_CATEGORY.name : DEFAULT_EXPENSE_CATEGORY.name),
    icon: type === 'income' ? DEFAULT_INCOME_CATEGORY.icon : DEFAULT_EXPENSE_CATEGORY.icon,
    color: type === 'income' ? DEFAULT_INCOME_CATEGORY.color : DEFAULT_EXPENSE_CATEGORY.color,
  };
}

function parseTags(value: string): string[] | undefined {
  const tags = value
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === 'no' || normalized === '0') {
    return false;
  }

  return undefined;
}

function parseRecurringFrequency(value: string): Transaction['recurringFrequency'] | undefined {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly' || normalized === 'yearly') {
    return normalized as Transaction['recurringFrequency'];
  }

  return undefined;
}

function getColumn(row: string[], map: Map<string, number>, aliases: string[]): string {
  for (const alias of aliases) {
    const index = map.get(alias);
    if (index !== undefined) {
      return row[index] ?? '';
    }
  }

  return '';
}

export function exportTransactionsToCsv(transactions: Transaction[]): string {
  const headers = [
    'date',
    'type',
    'amount',
    'description',
    'categoryId',
    'categoryName',
    'fromAccountId',
    'toAccountId',
    'tags',
    'isRecurring',
    'recurringFrequency',
    'recurringEndDate',
  ];

  const lines = transactions.map((transaction) => {
    const values = [
      transaction.date.toISOString(),
      transaction.type,
      String(transaction.amount),
      transaction.description,
      transaction.category?.id ?? '',
      transaction.category?.name ?? '',
      transaction.fromAccountId ?? transaction.fromAccount ?? '',
      transaction.toAccountId ?? transaction.toAccount ?? '',
      transaction.tags?.join('|') ?? '',
      String(Boolean(transaction.isRecurring)),
      transaction.recurringFrequency ?? '',
      transaction.recurringEndDate?.toISOString() ?? '',
    ];

    return values.map((value) => escapeCsvCell(value)).join(',');
  });

  return [headers.join(','), ...lines].join('\n');
}

export function parseTransactionsFromCsv(
  text: string,
  categories: TransactionCategory[] = ALL_CATEGORIES
): ParsedCsvResult {
  const rows = parseCsv(text.trim());

  if (rows.length < 2) {
    return {
      transactions: [],
      importedCount: 0,
      skippedCount: 0,
      errors: ['CSV must include a header row and at least one transaction row.'],
    };
  }

  const headerMap = new Map(rows[0].map((value, index) => [normalizeHeader(value), index]));
  const transactions: ImportedTransactionDraft[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    if (row.every((value) => !value.trim())) {
      continue;
    }

    const dateValue = getColumn(row, headerMap, ['date', 'transactiondate']);
    const typeValue = getColumn(row, headerMap, ['type', 'transactiontype']);
    const amountValue = getColumn(row, headerMap, ['amount']);
    const descriptionValue = getColumn(row, headerMap, ['description', 'memo', 'note']);
    const categoryIdValue = getColumn(row, headerMap, ['categoryid']);
    const categoryNameValue = getColumn(row, headerMap, ['categoryname', 'category']);
    const fromAccountValue = getColumn(row, headerMap, ['fromaccountid', 'fromaccount']);
    const toAccountValue = getColumn(row, headerMap, ['toaccountid', 'toaccount']);
    const tagsValue = getColumn(row, headerMap, ['tags']);
    const recurringValue = getColumn(row, headerMap, ['isrecurring']);
    const recurringFrequencyValue = getColumn(row, headerMap, ['recurringfrequency']);
    const recurringEndDateValue = getColumn(row, headerMap, ['recurringenddate']);

    const type = normalizeType(typeValue);
    const amount = Number(amountValue);
    const date = normalizeDate(dateValue);

    if (!type) {
      skippedCount += 1;
      errors.push(`Row ${rowIndex + 1}: transaction type must be income, expense, or transfer.`);
      continue;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      skippedCount += 1;
      errors.push(`Row ${rowIndex + 1}: amount must be a positive number.`);
      continue;
    }

    if (!date) {
      skippedCount += 1;
      errors.push(`Row ${rowIndex + 1}: date is invalid.`);
      continue;
    }

    if (type === 'transfer' && (!fromAccountValue.trim() || !toAccountValue.trim())) {
      skippedCount += 1;
      errors.push(`Row ${rowIndex + 1}: transfer rows require fromAccountId and toAccountId.`);
      continue;
    }

    const category = resolveCategory(type, categoryIdValue, categoryNameValue, categories);
    transactions.push({
      amount,
      description: descriptionValue.trim() || category.name,
      category,
      type,
      date,
      fromAccount: fromAccountValue.trim() || undefined,
      toAccount: toAccountValue.trim() || undefined,
      fromAccountId: fromAccountValue.trim() || undefined,
      toAccountId: toAccountValue.trim() || undefined,
      tags: parseTags(tagsValue),
      isRecurring: parseBoolean(recurringValue),
      recurringFrequency: parseRecurringFrequency(recurringFrequencyValue),
      recurringEndDate: recurringEndDateValue.trim() ? normalizeDate(recurringEndDateValue) ?? undefined : undefined,
      updatedAt: date,
    });
  }

  return {
    transactions,
    importedCount: transactions.length,
    skippedCount,
    errors,
  };
}
