import Papa, { ParseResult, Parser, ParseError } from 'papaparse';
import {
  ALL_CATEGORIES,
  normalizeCategoryLookup,
  resolveCanonicalCategory,
  resolveCanonicalCategoryId,
} from '@/constants/categories';
import { Transaction, TransactionCategory } from '@/types/transaction';

export interface ImportedTransactionDraft extends Omit<Transaction, 'id' | 'createdAt'> {}

export interface ParsedCsvResult {
  transactions: ImportedTransactionDraft[];
  importedCount: number;
  skippedCount: number;
  errors: Array<{
    row: number;
    message: string;
    rawData?: Record<string, string>;
  }>;
  warnings: Array<{
    row: number;
    message: string;
    category?: TransactionCategory;
  }>;
}

// Constants
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

const TRUTHY_VALUES = ['true', 'yes', 'y', '1', 'on', 'enabled'];
const FALSY_VALUES = ['false', 'no', 'n', '0', 'off', 'disabled'];
const VALID_TYPES: Transaction['type'][] = ['income', 'expense', 'transfer', 'debt'];
const VALID_FREQUENCIES: Transaction['recurringFrequency'][] = ['daily', 'weekly', 'monthly', 'yearly'];

// Cache for performance
const categoryCache = new Map<string, TransactionCategory>();

// Utility functions
const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const normalizeHeader = (value: string): string => {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const normalizeType = (value: string): Transaction['type'] | null => {
  const normalized = value.trim().toLowerCase();
  return VALID_TYPES.includes(normalized as Transaction['type']) 
    ? (normalized as Transaction['type']) 
    : null;
};

const normalizeDate = (value: string): Date | null => {
  if (!value.trim()) return null;
  
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  
  const formats = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, handler: (m: RegExpMatchArray) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])) },
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, handler: (m: RegExpMatchArray) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])) },
    { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, handler: (m: RegExpMatchArray) => new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])) },
  ];
  
  for (const { regex, handler } of formats) {
    const match = value.match(regex);
    if (match) return handler(match);
  }
  
  return null;
};

const normalizeAmount = (value: string): number | null => {
  if (!value.trim()) return null;
  const cleaned = value.replace(/[$,€£\s]/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
};

const isValidCategory = (category: TransactionCategory): boolean => {
  return !!(category.id && category.name && category.icon && category.color);
};

const resolveCategory = (
  type: Transaction['type'],
  categoryIdRaw: string,
  categoryNameRaw: string,
  categories: TransactionCategory[]
): TransactionCategory => {
  if (type === 'transfer') return TRANSFER_CATEGORY;

  const cacheKey = `${type}:${categoryIdRaw}:${categoryNameRaw}`;
  if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey)!;

  const categoryId = categoryIdRaw.trim();
  const categoryName = categoryNameRaw.trim();
  const canonicalId = resolveCanonicalCategoryId(categoryId) ?? resolveCanonicalCategoryId(categoryName);
  const normalizedName = normalizeCategoryLookup(categoryName);

  if (canonicalId) {
    const canonicalCategory =
      categories.find((category) => category.id === canonicalId) ??
      ALL_CATEGORIES.find((category) => category.id === canonicalId);
    if (canonicalCategory) {
      categoryCache.set(cacheKey, canonicalCategory);
      return canonicalCategory;
    }
  }

  const existing = categories.find(
    (category) =>
      category.id === categoryId ||
      normalizeCategoryLookup(category.name) === normalizedName
  );
  if (existing) {
    categoryCache.set(cacheKey, existing);
    return existing;
  }

  if (!categoryId && !categoryName) {
    const defaultCategory = isIncome ? DEFAULT_INCOME_CATEGORY : DEFAULT_EXPENSE_CATEGORY;
    categoryCache.set(cacheKey, defaultCategory);
    return defaultCategory;
  }

  const canonicalFromPayload = resolveCanonicalCategory({ id: categoryId, name: categoryName });
  if (canonicalFromPayload) {
    categoryCache.set(cacheKey, canonicalFromPayload);
    return canonicalFromPayload;
  }

  const newCategory: TransactionCategory = {
    id: categoryId || slugify(categoryName) || (isIncome ? DEFAULT_INCOME_CATEGORY.id : DEFAULT_EXPENSE_CATEGORY.id),
    name: categoryName || (isIncome ? DEFAULT_INCOME_CATEGORY.name : DEFAULT_EXPENSE_CATEGORY.name),
    icon: isIncome ? DEFAULT_INCOME_CATEGORY.icon : DEFAULT_EXPENSE_CATEGORY.icon,
    color: isIncome ? DEFAULT_INCOME_CATEGORY.color : DEFAULT_EXPENSE_CATEGORY.color,
  };

  categoryCache.set(cacheKey, newCategory);
  return newCategory;
};

const parseTags = (value: string): string[] | undefined => {
  const tags = value
    .split(/[|,;]/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
};

const parseBoolean = (value: string): boolean | undefined => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (TRUTHY_VALUES.includes(normalized)) return true;
  if (FALSY_VALUES.includes(normalized)) return false;
  return undefined;
};

const parseRecurringFrequency = (value: string): Transaction['recurringFrequency'] | undefined => {
  const normalized = value.trim().toLowerCase();
  return VALID_FREQUENCIES.includes(normalized as Transaction['recurringFrequency']) 
    ? (normalized as Transaction['recurringFrequency']) 
    : undefined;
};

const getColumnValue = (
  row: Record<string, string>, 
  headerMap: Map<string, string>,
  aliases: string[]
): string => {
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const actualHeader = headerMap.get(normalizedAlias);
    if (actualHeader && row[actualHeader] !== undefined) {
      return row[actualHeader]?.trim() || '';
    }
  }
  return '';
};

const validateRecurringTransaction = (
  isRecurring: boolean | undefined,
  frequency: string,
  endDate: string,
  rowIndex: number
): string[] => {
  const errors: string[] = [];
  
  if (isRecurring) {
    if (!frequency) {
      errors.push(`Row ${rowIndex}: recurring transactions require a frequency (daily/weekly/monthly/yearly)`);
    }
    if (endDate && !normalizeDate(endDate)) {
      errors.push(`Row ${rowIndex}: recurring end date is invalid`);
    }
  }
  
  return errors;
};

const findDuplicateTransaction = (
  transactions: ImportedTransactionDraft[],
  newTransaction: ImportedTransactionDraft
): boolean => {
  return transactions.some(t => 
    t.date.getTime() === newTransaction.date.getTime() &&
    Math.abs(t.amount - newTransaction.amount) < 0.01 &&
    t.description === newTransaction.description &&
    t.type === newTransaction.type
  );
};

interface ProcessRowResult {
  transaction?: ImportedTransactionDraft;
  error?: string;
  warning?: { message: string; category?: TransactionCategory };
}

const processRow = (
  row: Record<string, string>,
  rowIndex: number,
  headerMap: Map<string, string>,
  categories: TransactionCategory[]
): ProcessRowResult | null => {
  const dateValue = getColumnValue(row, headerMap, ['date', 'transactiondate', 'transaction date']);
  const typeValue = getColumnValue(row, headerMap, ['type', 'transactiontype', 'transaction type']);
  const amountValue = getColumnValue(row, headerMap, ['amount', 'value', 'price']);
  const descriptionValue = getColumnValue(row, headerMap, ['description', 'memo', 'note', 'payee']);
  const categoryIdValue = getColumnValue(row, headerMap, ['categoryid', 'category id']);
  const categoryNameValue = getColumnValue(row, headerMap, ['categoryname', 'category', 'category name']);
  const fromAccountValue = getColumnValue(row, headerMap, [
    'fromaccount',
    'from account',
    'fromaccountid',
    'from account id',
    'source',
  ]);
  const toAccountValue = getColumnValue(row, headerMap, [
    'toaccount',
    'to account',
    'toaccountid',
    'to account id',
    'destination',
  ]);
  const tagsValue = getColumnValue(row, headerMap, ['tags', 'tag', 'labels']);
  const recurringValue = getColumnValue(row, headerMap, ['isrecurring', 'recurring', 'is recurring']);
  const recurringFrequencyValue = getColumnValue(row, headerMap, ['recurringfrequency', 'frequency', 'recurring frequency']);
  const recurringEndDateValue = getColumnValue(row, headerMap, ['recurringenddate', 'end date', 'recurring end date']);

  const type = normalizeType(typeValue);
  const amount = normalizeAmount(amountValue);
  const date = normalizeDate(dateValue);

  if (!type) {
    return { error: 'Transaction type must be income, expense, transfer, or debt' };
  }

  if (amount === null) {
    return { error: 'Amount must be a valid number' };
  }
  
  if (amount <= 0) {
    return { error: 'Amount must be positive' };
  }

  if (!date) {
    return { error: 'Date is invalid or unsupported format' };
  }

  if (type === 'transfer' && !fromAccountValue && !toAccountValue) {
    return { error: 'Transfer transactions require at least one account' };
  }

  const isRecurring = parseBoolean(recurringValue);
  const recurringErrors = validateRecurringTransaction(
    isRecurring,
    recurringFrequencyValue,
    recurringEndDateValue,
    rowIndex
  );

  if (recurringErrors.length > 0) {
    return { error: recurringErrors.join('; ') };
  }

  const category = resolveCategory(type, categoryIdValue, categoryNameValue, categories);
  
  if (!isValidCategory(category)) {
    return { error: 'Invalid category resolved' };
  }

  const transaction: ImportedTransactionDraft = {
    amount,
    description: descriptionValue || category.name,
    category,
    type,
    date,
    fromAccount: fromAccountValue || undefined,
    toAccount: toAccountValue || undefined,
    tags: parseTags(tagsValue),
    isRecurring,
    recurringFrequency: parseRecurringFrequency(recurringFrequencyValue),
    recurringEndDate: recurringEndDateValue ? normalizeDate(recurringEndDateValue) ?? undefined : undefined,
    updatedAt: new Date(),
  };

  const warning = category.id.startsWith('imported-') 
    ? { message: `Auto-generated category: ${category.name}`, category }
    : undefined;

  return { transaction, warning };
};

export const exportTransactionsToCsv = (transactions: Transaction[]): string => {
  const data = transactions.map((transaction) => {
    const canonicalCategory = resolveCanonicalCategory(transaction.category);

    return {
    date: t.date.toISOString().split('T')[0],
      type: transaction.type,
      amount: transaction.amount.toFixed(2),
      description: transaction.description,
      categoryId: canonicalCategory?.id ?? transaction.category?.id ?? '',
      categoryName: canonicalCategory?.name ?? transaction.category?.name ?? '',
      fromAccount: transaction.fromAccount ?? '',
      toAccount: transaction.toAccount ?? '',
      tags: transaction.tags?.join('|') ?? '',
      isRecurring: transaction.isRecurring ? 'true' : 'false',
      recurringFrequency: transaction.recurringFrequency ?? '',
      recurringEndDate: transaction.recurringEndDate?.toISOString().split('T')[0] ?? '',
    };
  });

  return Papa.unparse(data, {
    quotes: true,
    delimiter: ',',
  });
};

export const parseTransactionsFromCsvAsync = (
  file: File,
  categories: TransactionCategory[] = ALL_CATEGORIES,
  options?: {
    onProgress?: (progress: number) => void;
    chunkSize?: number;
  }
): Promise<ParsedCsvResult> => {
  return new Promise((resolve) => {
    const transactions: ImportedTransactionDraft[] = [];
    const errors: ParsedCsvResult['errors'] = [];
    const warnings: ParsedCsvResult['warnings'] = [];
    let skippedCount = 0;
    let currentRow = 0;
    
    categoryCache.clear();

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"',
      
      chunk: (results: ParseResult<Record<string, string>>, parser: Parser) => {
        parser.pause();
        
        const { data, errors: parseErrors, meta } = results;
        
        parseErrors.forEach((error: ParseError) => {
          errors.push({
            row: error.row !== undefined ? error.row + 1 : 0,
            message: `CSV parsing error: ${error.message}`,
          });
        });

        const headerMap = new Map<string, string>();
        meta.fields?.forEach((field: string) => {
          headerMap.set(normalizeHeader(field), field);
        });

        const requiredHeaders = ['date', 'type', 'amount'];
        const missingHeaders = requiredHeaders.filter(h => !headerMap.has(normalizeHeader(h)));

        if (missingHeaders.length > 0 && currentRow === 0) {
          errors.push({
            row: 0,
            message: `Missing required headers: ${missingHeaders.join(', ')}`,
          });
          parser.abort();
          resolve({
            transactions: [],
            importedCount: 0,
            skippedCount: 0,
            errors,
            warnings,
          });
          return;
        }

        data.forEach((row: Record<string, string>) => {
          currentRow++;
          
          const result = processRow(row, currentRow, headerMap, categories);
          
          if (result?.error) {
            skippedCount++;
            errors.push({
              row: currentRow,
              message: result.error,
              rawData: row,
            });
          } else if (result?.transaction) {
            if (findDuplicateTransaction(transactions, result.transaction)) {
              skippedCount++;
              errors.push({
                row: currentRow,
                message: 'Duplicate transaction detected',
                rawData: row,
              });
            } else {
              transactions.push(result.transaction);
              if (result.warning) {
                warnings.push({
                  row: currentRow,
                  message: result.warning.message,
                  category: result.warning.category,
                });
              }
            }
          }
        });

        if (options?.onProgress && file.size > 0) {
          options.onProgress(Math.min(100, (meta.cursor / file.size) * 100));
        }

        parser.resume();
      },

      complete: () => {
        options?.onProgress?.(100);
        resolve({
          transactions,
          importedCount: transactions.length,
          skippedCount,
          errors,
          warnings,
        });
      },

      error: (error: Error) => {
        errors.push({
          row: 0,
          message: `Fatal parsing error: ${error.message}`,
        });
        resolve({
          transactions: [],
          importedCount: 0,
          skippedCount,
          errors,
          warnings,
        });
      },
    });
  });
};

export const parseTransactionsFromCsv = (
  text: string,
  categories: TransactionCategory[] = ALL_CATEGORIES
): ParsedCsvResult => {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    delimiter: ',',
    quoteChar: '"',
    escapeChar: '"',
  });

  const transactions: ImportedTransactionDraft[] = [];
  const errors: ParsedCsvResult['errors'] = [];
  const warnings: ParsedCsvResult['warnings'] = [];
  let skippedCount = 0;

  categoryCache.clear();

  result.errors.forEach((error: ParseError) => {
    errors.push({
      row: error.row !== undefined ? error.row + 1 : 0,
      message: `CSV parsing error: ${error.message}`,
    });
  });

  const headerMap = new Map<string, string>();
  result.meta.fields?.forEach((field: string) => {
    headerMap.set(normalizeHeader(field), field);
  });

  const requiredHeaders = ['date', 'type', 'amount'];
  const missingHeaders = requiredHeaders.filter(h => !headerMap.has(normalizeHeader(h)));

  if (missingHeaders.length > 0) {
    return {
      transactions: [],
      importedCount: 0,
      skippedCount: 0,
      errors: [{
        row: 0,
        message: `Missing required headers: ${missingHeaders.join(', ')}`,
      }],
      warnings: [],
    };
  }

  result.data.forEach((row: Record<string, string>, index: number) => {
    const rowIndex = index + 1;
    
    const rowResult = processRow(row, rowIndex, headerMap, categories);
    
    if (rowResult?.error) {
      skippedCount++;
      errors.push({
        row: rowIndex,
        message: rowResult.error,
        rawData: row,
      });
    } else if (rowResult?.transaction) {
      if (findDuplicateTransaction(transactions, rowResult.transaction)) {
        skippedCount++;
        errors.push({
          row: rowIndex,
          message: 'Duplicate transaction detected',
          rawData: row,
        });
      } else {
        transactions.push(rowResult.transaction);
        if (rowResult.warning) {
          warnings.push({
            row: rowIndex,
            message: rowResult.warning.message,
            category: rowResult.warning.category,
          });
        }
      }
    }
  });

  return {
    transactions,
    importedCount: transactions.length,
    skippedCount,
    errors,
    warnings,
  };
};

export type { Transaction, TransactionCategory } from '@/types/transaction';







