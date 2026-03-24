import { MerchantProfile, Transaction, TransactionCategory } from '@/types/transaction';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories';
import { CURRENCY_OPTIONS } from '@/constants/currencies';
import { aiAnalyzeReceipt, resolveAiCategory } from '@/utils/ai/receipt-ai';
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

export interface ReceiptData {
  amount?: number;
  merchant?: string;
  date?: string;
  currency?: string;
  tags?: string[];
}

const AMOUNT_REGEX = /\b\d{1,6}(?:[.,]\d{2})?\b/g;
const DATE_REGEXES = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{2}\/\d{2}\/\d{4}\b/,
  /\b\d{2}-\d{2}-\d{4}\b/,
];

const pad2 = (v: number) => v.toString().padStart(2, '0');

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SLASH_DASH_DATE_REGEX = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/;

// --- Extractors ---
function extractAmount(rawText: string): number | undefined {
  const matches = rawText.match(AMOUNT_REGEX) ?? [];
  const numbers = matches
    .map((v) => parseFloat(v.replace(',', '.')))
    .filter((v) => Number.isFinite(v));
  if (numbers.length === 0) return undefined;
  return Math.max(...numbers);
}

function extractDate(rawText: string): string | undefined {
  for (const regex of DATE_REGEXES) {
    const match = rawText.match(regex);
    if (match?.[0]) return match[0];
  }
  return undefined;
}

function extractMerchant(rawText: string): string | undefined {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;
  return lines.find((line) => /[A-Za-z]/.test(line)) ?? lines[0];
}

// Optional: simple tag extraction
function extractTags(merchant?: string): string[] | undefined {
  if (!merchant) return undefined;
  const keywords = ['supermarket', 'fuel', 'bank', 'restaurant', 'coffee', 'shop'];
  return keywords.filter((k) => merchant.toLowerCase().includes(k));
}

// --- Normalize date ---
function normalizeReceiptDate(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  if (ISO_DATE_REGEX.test(dateString)) return dateString;
  const match = dateString.match(SLASH_DASH_DATE_REGEX);
  if (!match) return undefined;
  let [part1, part2, year] = [Number(match[1]), Number(match[2]), Number(match[3])];

  if (part1 > 12 && part2 <= 12) [part1, part2] = [part2, part1];
  return `${year}-${pad2(part1)}-${pad2(part2)}`;
}

// --- Map receipt to transaction draft ---
function guessCategory(merchant: string | undefined, type: 'income' | 'expense' = 'expense'): TransactionCategory {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!merchant) return categories[0];
  const found = categories.find((cat) => merchant.toLowerCase().includes(cat.name.toLowerCase()));
  return found ?? categories[0];
}

function guessTransactionType(amount?: number): 'income' | 'expense' {
  if (amount === undefined) return 'expense';
  return amount >= 0 ? 'expense' : 'income';
}

export interface ReceiptAiDraft {
  categoryId: string;
  confidence: number;
  source: 'merchant_memory' | 'ai_classifier' | 'fallback';
  debtIntent: {
    type: 'expense' | 'debt';
    direction?: 'borrowed' | 'lent';
    debtPayment?: boolean;
  } | null;
}

// --- Main OCR parser ---
export async function runReceiptOcr(
  imageUri: string,
  options?: { merchants?: MerchantProfile[] }
): Promise<{ rawText: string; data: ReceiptData; draft: Partial<Transaction>; ai: ReceiptAiDraft }> {
  const rawText = await recognizeReceiptText(imageUri);

  const amount = extractAmount(rawText);
  const date = normalizeReceiptDate(extractDate(rawText));
  const merchant = extractMerchant(rawText);
  const tags = extractTags(merchant);

  const currency = CURRENCY_OPTIONS.find((c) => rawText.includes(c.symbol))?.code ?? 'ZMW';
  const ai = aiAnalyzeReceipt(merchant, rawText, options?.merchants ?? []);

  let type: Transaction['type'] = guessTransactionType(amount);
  if (ai.debtIntent?.type === 'debt') {
    type = 'debt';
  } else if (ai.debtIntent?.type === 'expense') {
    type = 'expense';
  }

  const category = type === 'income'
    ? guessCategory(merchant, 'income')
    : resolveAiCategory(ai.categoryId, type === 'debt' ? 'debt' : 'expense');

  const draft: Partial<Transaction> = {
    amount,
    merchant,
    description: merchant ?? '',
    date: date ? new Date(date) : undefined,
    type,
    category,
    tags,
    currency,
    debtDirection: type === 'debt' ? ai.debtIntent?.direction : undefined,
    counterparty: type === 'debt' ? merchant : undefined,
    debtPayment: type === 'expense' ? ai.debtIntent?.debtPayment : undefined,
    isRecurring: false,
  };

  return { rawText, data: { amount, merchant, date, currency, tags }, draft, ai };
}

export { normalizeReceiptDate };
