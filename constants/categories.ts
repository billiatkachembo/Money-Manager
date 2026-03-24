import { Transaction, TransactionCategory } from '@/types/transaction';
import { enqueueWrite, STORAGE_KEYS, safeReadJSON, safeWriteJSON } from '@/lib/storage';
type TextRecognitionModule = {
  recognize: (imageUri: string) => Promise<{ text?: string | null }>;
};

async function recognizeReceiptText(imageUri: string): Promise<string> {
  try {
    const module = await import('@react-native-ml-kit/text-recognition');
    const textRecognition = (module as unknown as { default?: TextRecognitionModule }).default;

    if (!textRecognition?.recognize) {
      throw new Error('Text recognition module unavailable');
    }

    const result = await textRecognition.recognize(imageUri);
    return result?.text?.trim() ?? '';
  } catch {
    throw new Error(
      'Receipt OCR requires a development build. Expo Go can open the app, but receipt scanning is unavailable there.'
    );
  }
}

/* ----------------------------- Currency ----------------------------- */
export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: 'Ã¢â€šÂ¬', name: 'Euro' },
  { code: 'GBP', symbol: 'Ã‚Â£', name: 'British Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'NGN', symbol: 'Ã¢â€šÂ¦', name: 'Nigerian Naira' },
  // add more currencies as needed
];

export function findCurrencyOption(code?: string | null): CurrencyOption {
  if (!code) return CURRENCY_OPTIONS[0]; // default ZMW
  const normalized = code.trim().toUpperCase();
  return CURRENCY_OPTIONS.find((c) => c.code === normalized) ?? CURRENCY_OPTIONS[0];
}

/* --------------------------- Receipt OCR --------------------------- */
export interface ReceiptData {
  amount?: number;
  merchant?: string;
  date?: string;
  currency?: CurrencyOption;
}

const AMOUNT_REGEX = /\b\d{1,6}\.\d{2}\b/g;
const DATE_REGEXES = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{2}\/\d{2}\/\d{4}\b/,
  /\b\d{2}-\d{2}-\d{4}\b/,
];

const pad2 = (v: number) => v.toString().padStart(2, '0');

export function normalizeDate(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/;
  if (isoMatch.test(dateString)) return dateString;

  const m = dateString.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (!m) return undefined;

  let [_, part1, part2, year] = m;
  let month = Number(part1), day = Number(part2), y = Number(year);
  const part1Num = Number(part1);
  const part2Num = Number(part2);
  if (part1Num > 12 && part2Num <= 12) [month, day] = [Number(part2), Number(part1)];
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

function extractAmount(text: string): number | undefined {
  const matches = text.match(AMOUNT_REGEX) ?? [];
  const nums = matches.map(parseFloat).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : undefined;
}

function extractDate(text: string): string | undefined {
  for (const regex of DATE_REGEXES) {
    const m = text.match(regex);
    if (m?.[0]) return m[0];
  }
  return undefined;
}

function extractMerchant(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => /[A-Za-z]/.test(l)) ?? lines[0];
}

export async function runReceiptOcr(imageUri: string): Promise<ReceiptData & { rawText: string }> {
  const rawText = await recognizeReceiptText(imageUri);
  return {
    rawText,
    amount: extractAmount(rawText),
    merchant: extractMerchant(rawText),
    date: normalizeDate(extractDate(rawText)),
    currency: findCurrencyOption('ZMW'),
  };
}

/* --------------------------- Categories --------------------------- */
export const MODAL_EXPENSE_CATEGORIES: TransactionCategory[] = [
  { id: 'housing', name: 'Housing', icon: 'Home', color: '#FF6B6B' },
  { id: 'utilities', name: 'Utilities', icon: 'Lightbulb', color: '#F59E0B' },
  { id: 'groceries', name: 'Groceries', icon: 'ShoppingBag', color: '#FFD166' },
  { id: 'dining', name: 'Dining Out', icon: 'Utensils', color: '#EF476F' },
  { id: 'transport', name: 'Transport', icon: 'Car', color: '#06D6A0' },
  { id: 'fuel', name: 'Fuel', icon: 'Fuel', color: '#14B8A6' },
  { id: 'phone-internet', name: 'Phone & Internet', icon: 'Wifi', color: '#0EA5E9' },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'RefreshCw', color: '#8B5CF6' },
  { id: 'entertainment', name: 'Entertainment', icon: 'Film', color: '#7209B7' },
  { id: 'education', name: 'Education', icon: 'BookOpen', color: '#3B82F6' },
  { id: 'clothing', name: 'Clothing', icon: 'Shirt', color: '#EC4899' },
  { id: 'personal-care', name: 'Personal Care', icon: 'Scissors', color: '#F472B6' },
  { id: 'travel', name: 'Travel', icon: 'Plane', color: '#38BDF8' },
  { id: 'family', name: 'Family', icon: 'Users', color: '#FB7185' },
  { id: 'gifts-donations', name: 'Gifts & Donations', icon: 'Gift', color: '#F43F5E' },
  { id: 'health', name: 'Health', icon: 'Heart', color: '#FF595E' },
  { id: 'insurance', name: 'Insurance', icon: 'Shield', color: '#073B4C' },
  { id: 'taxes-fees', name: 'Taxes & Fees', icon: 'Receipt', color: '#64748B' },
  { id: 'maintenance', name: 'Maintenance', icon: 'Wrench', color: '#F97316' },
  { id: 'farm-labor', name: 'Farm Labor', icon: 'Users', color: '#84CC16' },
  { id: 'livestock', name: 'Livestock', icon: 'PawPrint', color: '#A16207' },
  { id: 'fertilizers', name: 'Fertilizers', icon: 'Leaf', color: '#34D399' },
  { id: 'seeds', name: 'Seeds & Plants', icon: 'Sprout', color: '#22C55E' },
  { id: 'farm-equipment', name: 'Farm Equipment', icon: 'Tractor', color: '#65A30D' },
  { id: 'debt', name: 'Debt', icon: 'Landmark', color: '#64748B' },
  { id: 'other', name: 'Other', icon: 'MoreHorizontal', color: '#94A3B8' },
];

export const MODAL_INCOME_CATEGORIES: TransactionCategory[] = [
  { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#10B981' },
  { id: 'bonus', name: 'Bonus', icon: 'BadgeDollarSign', color: '#22C55E' },
  { id: 'freelance', name: 'Freelance', icon: 'Laptop', color: '#8B5CF6' },
  { id: 'business', name: 'Business', icon: 'Building', color: '#F59E0B' },
  { id: 'farming-income', name: 'Farming Income', icon: 'Leaf', color: '#16A34A' },
  { id: 'sales', name: 'Sales', icon: 'Store', color: '#F97316' },
  { id: 'rental-income', name: 'Rental Income', icon: 'Home', color: '#38BDF8' },
  { id: 'interest', name: 'Interest', icon: 'Landmark', color: '#0EA5E9' },
  { id: 'dividends', name: 'Dividends', icon: 'TrendingUp', color: '#6366F1' },
  { id: 'refund', name: 'Refund', icon: 'RotateCcw', color: '#14B8A6' },
  { id: 'allowance', name: 'Allowance', icon: 'Wallet', color: '#EAB308' },
  { id: 'gift', name: 'Gift', icon: 'Gift', color: '#F43F5E' },
  { id: 'other-income', name: 'Other Income', icon: 'MoreHorizontal', color: '#94A3B8' },
];

/** All categories combined for easy import */
export const ALL_CATEGORIES: TransactionCategory[] = [
  ...MODAL_EXPENSE_CATEGORIES,
  ...MODAL_INCOME_CATEGORIES,
];

export function normalizeCategoryLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function getCategoryLookupKeys(category: Pick<TransactionCategory, 'id' | 'name'>): string[] {
  return [category.id, category.name]
    .map((value) => normalizeCategoryLookup(value))
    .filter(Boolean);
}

export function mergeCategories(
  ...collections: Array<ReadonlyArray<TransactionCategory | null | undefined>>
): TransactionCategory[] {
  const merged: TransactionCategory[] = [];
  const seen = new Set<string>();

  for (const collection of collections) {
    for (const category of collection) {
      if (!category?.id || !category?.name?.trim()) {
        continue;
      }

      const normalizedCategory = {
        ...category,
        name: normalizeCategoryName(category.name),
      };
      const lookupKeys = getCategoryLookupKeys(normalizedCategory);

      if (lookupKeys.length === 0 || lookupKeys.some((key) => seen.has(key))) {
        continue;
      }

      merged.push(normalizedCategory);
      lookupKeys.forEach((key) => seen.add(key));
    }
  }

  return merged;
}

export function findMatchingCategory(
  categories: ReadonlyArray<TransactionCategory>,
  value?: Partial<TransactionCategory> | string | null
): TransactionCategory | null {
  if (!value) {
    return null;
  }

  const lookupKeys =
    typeof value === 'string'
      ? [normalizeCategoryLookup(value)].filter(Boolean)
      : getCategoryLookupKeys({
          id: value.id ?? '',
          name: value.name ?? '',
        });

  if (lookupKeys.length === 0) {
    return null;
  }

  return (
    categories.find((category) => {
      const categoryKeys = getCategoryLookupKeys(category);
      return lookupKeys.some((key) => categoryKeys.includes(key));
    }) ?? null
  );
}

export function createCustomCategory(
  name: string,
  type: 'income' | 'expense' | 'debt',
  existingCategories: ReadonlyArray<TransactionCategory> = []
): TransactionCategory {
  const normalizedName = normalizeCategoryName(name);
  const existing = findMatchingCategory(existingCategories, normalizedName);
  if (existing) {
    return existing;
  }

  const baseSlug = normalizeCategoryLookup(normalizedName) || `${type}category`;
  const prefix = type === 'income' ? 'income' : type === 'debt' ? 'debt' : 'expense';
  const existingIds = new Set(
    existingCategories.map((category) => normalizeCategoryLookup(category.id)).filter(Boolean)
  );

  let candidateId = `custom-${prefix}-${baseSlug}`;
  let suffix = 2;
  while (existingIds.has(normalizeCategoryLookup(candidateId))) {
    candidateId = `custom-${prefix}-${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return {
    id: candidateId,
    name: normalizedName,
    icon: 'Tag',
    color: type === 'income' ? '#16A34A' : type === 'debt' ? '#A855F7' : '#F97316',
  };
}

export function resolveCanonicalCategoryId(value?: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeCategoryLookup(value);
  if (!normalized) return null;
  const match = ALL_CATEGORIES.find(
    (category) =>
      normalizeCategoryLookup(category.id) === normalized ||
      normalizeCategoryLookup(category.name) === normalized
  );
  return match ? match.id : null;
}

export function resolveCanonicalCategory(
  category?: Partial<TransactionCategory> | null
): TransactionCategory | null {
  if (!category) return null;
  const id = resolveCanonicalCategoryId(category.id ?? category.name ?? '');
  return id ? ALL_CATEGORIES.find((entry) => entry.id === id) ?? null : null;
}
// Backwards-compatible alias for legacy imports.
export const EXPENSE_CATEGORIES = MODAL_EXPENSE_CATEGORIES;
export const INCOME_CATEGORIES = MODAL_INCOME_CATEGORIES;

/* -------------------- Income/Expense Keyword Detection -------------------- */
// Keywords that hint at income (case-insensitive)
const INCOME_KEYWORDS = [
  'salary', 'wage', 'payroll', 'deposit', 'credit', 'refund', 'reimbursement',
  'gift', 'bonus', 'interest', 'dividend', 'income', 'freelance', 'invoice paid',
  'payment received', 'money in'
];

// Keywords that hint at expense
const EXPENSE_KEYWORDS = [
  'purchase', 'payment', 'debit', 'withdrawal', 'bill', 'fee', 'charge',
  'expense', 'restaurant', 'grocery', 'supermarket', 'gas', 'fuel', 'uber',
  'lyft', 'taxi', 'hotel', 'flight', 'subscription', 'membership', 'fine',
  'penalty', 'checkout', 'total', 'paid', 'sale'
];

/**
 * Determine transaction type based on keywords found in raw text and merchant name.
 * Falls back to amount sign if no strong keyword match.
 */
function detectType(amount: number, rawText: string, merchant?: string): 'income' | 'expense' {
  const combined = (rawText + ' ' + (merchant || '')).toLowerCase();

  // Strong income keyword match
  if (INCOME_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()))) {
    return 'income';
  }
  // Strong expense keyword match
  if (EXPENSE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase()))) {
    return 'expense';
  }
  // Fallback to amount sign (positive amount = expense by default for most receipts)
  return amount > 0 ? 'expense' : 'income';
}

function resolveCategory(type: 'income' | 'expense', merchant?: string): TransactionCategory {
  const categories = type === 'income' ? MODAL_INCOME_CATEGORIES : MODAL_EXPENSE_CATEGORIES;
  // simple heuristic: match merchant name to category
  return categories.find((c) => merchant?.toLowerCase().includes(c.name.toLowerCase())) ?? categories[0];
}

/* --------------------------- Net Worth --------------------------- */
async function updateNetWorth(transactions: Transaction[]): Promise<void> {
  const history = await safeReadJSON<{ date: string; netWorth: number }[]>(STORAGE_KEYS.financialGoals, []);
  const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const netWorth = (history.at(-1)?.netWorth ?? 0) + income - expense;
  history.push({ date: new Date().toISOString(), netWorth });
  await safeWriteJSON(STORAGE_KEYS.financialGoals, history);
}

/* ------------------------- Batch Import ------------------------- */
export async function importReceipts(
  imageUris: string[]
): Promise<{
  transactions: Transaction[];
  skipped: number;
  errors: string[];
}> {
  const transactions: Transaction[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < imageUris.length; i++) {
    try {
      const { amount, merchant, date, rawText, currency } = await runReceiptOcr(imageUris[i]);

      if (!amount || !date) {
        skipped++;
        errors.push(`Receipt ${i + 1} missing amount or date`);
        continue;
      }

      const type = detectType(amount, rawText, merchant);
      const category = resolveCategory(type, merchant);

      const transaction: Transaction = {
        id: `${Date.now()}-${i}`,
        amount: Math.abs(amount), // store absolute amount; type indicates direction
        description: merchant ?? '',
        date: new Date(date),
        type,
        category,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      transactions.push(transaction);
      enqueueWrite(`${STORAGE_KEYS.transactions}:${transaction.id}`, JSON.stringify(transaction));
    } catch (e) {
      skipped++;
      errors.push(`Receipt ${i + 1} OCR failed: ${String(e)}`);
    }
  }

  await updateNetWorth(transactions);
  return { transactions, skipped, errors };
}

