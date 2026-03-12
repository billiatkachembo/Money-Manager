import { MODAL_EXPENSE_CATEGORIES, MODAL_INCOME_CATEGORIES } from '@/constants/modal-categories';
import { MerchantProfile, TransactionCategory } from '@/types/transaction';
import { findMerchantCategory } from './merchant-intelligence';

export interface ClassificationResult {
  categoryId: string;
  confidence: number;
}

export interface DebtIntent {
  type: 'expense' | 'debt';
  direction?: 'borrowed' | 'lent';
  debtPayment?: boolean;
}

export interface ReceiptAiResult {
  categoryId: string;
  confidence: number;
  source: 'merchant_memory' | 'ai_classifier' | 'fallback';
  debtIntent: DebtIntent | null;
}

const CATEGORY_RULES: Array<{ keywords: string[]; categoryId: string; confidence: number }> = [
  { keywords: ['fuel', 'petrol', 'total service', 'shell', 'chevron', 'gas'], categoryId: 'transport', confidence: 0.9 },
  { keywords: ['shoprite', 'supermarket', 'groceries', 'grocery', 'market'], categoryId: 'groceries', confidence: 0.9 },
  { keywords: ['restaurant', 'cafe', 'coffee', 'dining', 'food', 'pizza'], categoryId: 'dining', confidence: 0.88 },
  { keywords: ['pharmacy', 'clinic', 'hospital', 'medical'], categoryId: 'health', confidence: 0.85 },
  { keywords: ['fertilizer', 'agro', 'agriculture'], categoryId: 'fertilizers', confidence: 0.9 },
  { keywords: ['seed', 'seeds', 'seedling', 'nursery', 'plant'], categoryId: 'seeds', confidence: 0.9 },
  { keywords: ['subscription', 'netflix', 'spotify'], categoryId: 'subscriptions', confidence: 0.85 },
];

function pickCategory(categoryId: string, categories: TransactionCategory[]): TransactionCategory | undefined {
  return categories.find((category) => category.id === categoryId);
}

export function classifyReceipt(merchant?: string, rawText?: string): ClassificationResult {
  const text = `${merchant ?? ''} ${rawText ?? ''}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return { categoryId: rule.categoryId, confidence: rule.confidence };
    }
  }

  return { categoryId: 'other', confidence: 0.4 };
}

export function detectDebtIntent(text: string): DebtIntent | null {
  const t = text.toLowerCase();

  if (t.includes('loan repayment') || t.includes('installment') || t.includes('repayment')) {
    return { type: 'expense', debtPayment: true };
  }

  if (t.includes('loan received') || t.includes('disbursement') || t.includes('borrowed')) {
    return { type: 'debt', direction: 'borrowed' };
  }

  if (t.includes('loan given') || t.includes('lent') || t.includes('loan issued')) {
    return { type: 'debt', direction: 'lent' };
  }

  return null;
}

export function autoCategorizeTransaction(
  merchant: string | undefined,
  rawText: string | undefined,
  merchants: MerchantProfile[]
): { categoryId: string; confidence: number; source: ReceiptAiResult['source'] } {
  if (merchant) {
    const merchantCategory = findMerchantCategory(merchant, merchants);
    if (merchantCategory) {
      return { categoryId: merchantCategory, confidence: 1, source: 'merchant_memory' };
    }
  }

  const ai = classifyReceipt(merchant, rawText);
  const source: ReceiptAiResult['source'] = ai.confidence >= 0.5 ? 'ai_classifier' : 'fallback';
  return { categoryId: ai.categoryId, confidence: ai.confidence, source };
}

export function aiAnalyzeReceipt(
  merchant: string | undefined,
  rawText: string | undefined,
  merchants: MerchantProfile[]
): ReceiptAiResult {
  const { categoryId, confidence, source } = autoCategorizeTransaction(merchant, rawText, merchants);
  const debtIntent = detectDebtIntent(rawText ?? '');
  return { categoryId, confidence, source, debtIntent };
}

export function resolveAiCategory(
  categoryId: string,
  type: 'income' | 'expense' | 'debt'
): TransactionCategory {
  const categories = type === 'income' ? MODAL_INCOME_CATEGORIES : MODAL_EXPENSE_CATEGORIES;
  return pickCategory(categoryId, categories) ?? categories.find((category) => category.id === 'other') ?? categories[0];
}
