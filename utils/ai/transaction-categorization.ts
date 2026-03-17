import { TransactionCategory, TransactionType, MerchantProfile } from '@/types/transaction';
import {
  ALL_CATEGORIES,
  MODAL_EXPENSE_CATEGORIES,
  MODAL_INCOME_CATEGORIES,
  resolveCanonicalCategory,
} from '@/constants/categories';
import { findMerchantCategory, normalizeMerchantName } from '@/utils/ai/merchant-intelligence';

export const CATEGORY_RULES: Record<string, string[]> = {
  groceries: ['walmart', 'aldi', 'supermarket', 'grocery', 'market', 'whole foods'],
  dining: ['restaurant', 'cafe', 'pizza', 'starbucks', 'burger', 'kfc', 'mcdonald'],
  transport: ['uber', 'taxi', 'fuel', 'gas', 'lyft', 'bolt', 'bus', 'train'],
  entertainment: ['netflix', 'spotify', 'cinema', 'movie', 'hulu', 'showmax'],
  subscriptions: ['subscription', 'membership', 'apple', 'google', 'icloud', 'prime'],
  health: ['pharmacy', 'clinic', 'hospital', 'doctor', 'medical'],
  housing: ['rent', 'mortgage', 'landlord', 'property'],
};

const RULE_CATEGORY_MAP: Record<string, string> = {
  groceries: 'groceries',
  dining: 'dining',
  transport: 'transport',
  entertainment: 'entertainment',
  subscriptions: 'entertainment',
  health: 'health',
  housing: 'housing',
};

const INCOME_RULES: Record<string, string[]> = {
  salary: ['salary', 'payroll', 'wage', 'pay'],
  business: ['business', 'invoice', 'client', 'sales'],
  freelance: ['freelance', 'contract', 'gig'],
  gift: ['gift', 'bonus', 'reward', 'tip'],
  interest: ['interest', 'dividend'],
};

const INCOME_RULE_CATEGORY_MAP: Record<string, string> = {
  salary: 'salary',
  business: 'business',
  freelance: 'freelance',
  gift: 'gift',
  interest: 'other-income',
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCategoryById(id: string | null | undefined): TransactionCategory | null {
  if (!id) {
    return null;
  }
  return ALL_CATEGORIES.find((category) => category.id === id) ?? null;
}

function matchRule(text: string, rules: Record<string, string[]>): string | null {
  for (const [ruleKey, keywords] of Object.entries(rules)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return ruleKey;
    }
  }
  return null;
}

export function autoCategorizeTransaction(input: {
  description?: string;
  merchant?: string;
  type: TransactionType;
  merchantProfiles: MerchantProfile[];
}): TransactionCategory | null {
  if (input.type === 'transfer' || input.type === 'debt') {
    return null;
  }

  const combined = [input.description, input.merchant].filter(Boolean).join(' ');
  const normalized = normalizeText(combined);

  if (!normalized) {
    return null;
  }

  const merchantHint = normalizeMerchantName(input.merchant ?? input.description ?? '');
  const learnedCategoryId = merchantHint
    ? findMerchantCategory(merchantHint, input.merchantProfiles)
    : undefined;
  const learnedCategory = findCategoryById(learnedCategoryId);
  if (learnedCategory) {
    return learnedCategory;
  }

  if (input.type === 'income') {
    const ruleKey = matchRule(normalized, INCOME_RULES);
    if (ruleKey) {
      const mapped = findCategoryById(INCOME_RULE_CATEGORY_MAP[ruleKey]);
      if (mapped) {
        return mapped;
      }
    }
    return MODAL_INCOME_CATEGORIES[0] ?? resolveCanonicalCategory({ id: 'other-income' });
  }

  const expenseRuleKey = matchRule(normalized, CATEGORY_RULES);
  if (expenseRuleKey) {
    const mapped = findCategoryById(RULE_CATEGORY_MAP[expenseRuleKey]);
    if (mapped) {
      return mapped;
    }
  }

  return MODAL_EXPENSE_CATEGORIES[0] ?? resolveCanonicalCategory({ id: 'other' });
}
