import type { LucideIcon } from 'lucide-react-native';
import {
  AccountType,
  AccountTypeDefinition,
  AccountTypeGroup,
  CustomAccountType,
} from '@/types/transaction';

const FALLBACK_ACCOUNT_COLOR = '#2563EB';

const ACCOUNT_TYPE_GROUP_DEFAULTS: Record<AccountTypeGroup, { icon: string; color: string }> = {
  cash_bank: { icon: 'wallet', color: '#2563EB' },
  savings: { icon: 'piggybank', color: '#16A34A' },
  credit: { icon: 'credit-card', color: '#DC2626' },
  investment: { icon: 'trending-up', color: '#8B5CF6' },
  business: { icon: 'briefcase', color: '#475569' },
  other: { icon: 'wallet', color: '#64748B' },
};

export const ACCOUNT_TYPE_GROUPS: Array<{
  key: AccountTypeGroup;
  label: string;
  description: string;
}> = [
  { key: 'cash_bank', label: 'Cash & Bank', description: 'Wallets, bank accounts, and day-to-day balances' },
  { key: 'savings', label: 'Savings', description: 'Reserves, deposits, and long-term savings pots' },
  { key: 'credit', label: 'Debt & Credit', description: 'Credit cards, loans, and money you owe' },
  { key: 'investment', label: 'Investments', description: 'Growth, retirement, and wealth-building accounts' },
  { key: 'business', label: 'Business', description: 'Business cash, float, and operating funds' },
  { key: 'other', label: 'Other', description: 'Custom account types that do not fit elsewhere' },
];

export const BUILT_IN_ACCOUNT_TYPE_DEFINITIONS: AccountTypeDefinition[] = [
  {
    type: 'checking',
    label: 'Checking',
    description: 'Daily income and spending',
    group: 'cash_bank',
    icon: 'wallet',
    color: '#2563EB',
  },
  {
    type: 'current_account',
    label: 'Current Account',
    description: 'Primary bank account for everyday business or household use',
    group: 'cash_bank',
    icon: 'landmark',
    color: '#1D4ED8',
  },
  {
    type: 'cash',
    label: 'Cash',
    description: 'Wallet, till, and petty cash',
    group: 'cash_bank',
    icon: 'landmark',
    color: '#F59E0B',
  },
  {
    type: 'prepaid_card',
    label: 'Prepaid Card',
    description: 'Preloaded cards for controlled spending',
    group: 'cash_bank',
    icon: 'credit-card',
    color: '#F97316',
  },
  {
    type: 'e_wallet',
    label: 'E-Wallet',
    description: 'Online wallets and app-based payment balances',
    group: 'cash_bank',
    icon: 'smartphone',
    color: '#06B6D4',
  },
  {
    type: 'merchant_till',
    label: 'Merchant Till',
    description: 'Shop till, float, and point-of-sale balances',
    group: 'cash_bank',
    icon: 'wallet',
    color: '#0F766E',
  },
  {
    type: 'mobile_money',
    label: 'Mobile Money',
    description: 'Mobile wallet balances and transfers',
    group: 'cash_bank',
    icon: 'smartphone',
    color: '#0EA5E9',
  },
  {
    type: 'savings',
    label: 'Savings',
    description: 'Emergency funds and goal reserves',
    group: 'savings',
    icon: 'piggybank',
    color: '#16A34A',
  },
  {
    type: 'fixed_deposit',
    label: 'Fixed Deposit',
    description: 'Locked savings and term deposits',
    group: 'savings',
    icon: 'piggybank',
    color: '#14B8A6',
  },
  {
    type: 'money_market',
    label: 'Money Market',
    description: 'High-yield reserve and treasury-style savings balances',
    group: 'savings',
    icon: 'piggybank',
    color: '#059669',
  },
  {
    type: 'sacco',
    label: 'SACCO',
    description: 'Cooperative savings and member contribution accounts',
    group: 'savings',
    icon: 'landmark',
    color: '#22C55E',
  },
  {
    type: 'credit',
    label: 'Credit Card',
    description: 'Cards and revolving credit balances',
    group: 'credit',
    icon: 'credit-card',
    color: '#EF4444',
  },
  {
    type: 'loan',
    label: 'Loan',
    description: 'Formal borrowing and repayment accounts',
    group: 'credit',
    icon: 'landmark',
    color: '#DC2626',
  },
  {
    type: 'mortgage',
    label: 'Mortgage',
    description: 'Home or property financing balances',
    group: 'credit',
    icon: 'landmark',
    color: '#B91C1C',
  },
  {
    type: 'overdraft',
    label: 'Overdraft',
    description: 'Negative current-account facility and short-term borrowing',
    group: 'credit',
    icon: 'credit-card',
    color: '#F43F5E',
  },
  {
    type: 'buy_now_pay_later',
    label: 'Buy Now Pay Later',
    description: 'Installment and pay-later balances',
    group: 'credit',
    icon: 'credit-card',
    color: '#FB7185',
  },
  {
    type: 'investment',
    label: 'Investment',
    description: 'Stocks, bonds, funds, and other growth assets',
    group: 'investment',
    icon: 'trending-up',
    color: '#8B5CF6',
  },
  {
    type: 'brokerage',
    label: 'Brokerage',
    description: 'Trading and investment dealing accounts',
    group: 'investment',
    icon: 'trending-up',
    color: '#7C3AED',
  },
  {
    type: 'crypto_wallet',
    label: 'Crypto Wallet',
    description: 'Digital-asset and token balances',
    group: 'investment',
    icon: 'shield',
    color: '#9333EA',
  },
  {
    type: 'unit_trust',
    label: 'Unit Trust',
    description: 'Managed funds and pooled investment products',
    group: 'investment',
    icon: 'trending-up',
    color: '#A855F7',
  },
  {
    type: 'retirement',
    label: 'Retirement',
    description: 'Pension and retirement-focused savings',
    group: 'investment',
    icon: 'shield',
    color: '#7C3AED',
  },
  {
    type: 'insurance',
    label: 'Insurance',
    description: 'Policy-linked cash values and cover funds',
    group: 'investment',
    icon: 'shield',
    color: '#0F766E',
  },
  {
    type: 'business',
    label: 'Business',
    description: 'Business cash, float, and merchant balances',
    group: 'business',
    icon: 'briefcase',
    color: '#475569',
  },
  {
    type: 'accounts_receivable',
    label: 'Accounts Receivable',
    description: 'Customer balances and money due to your business',
    group: 'business',
    icon: 'briefcase',
    color: '#334155',
  },
  {
    type: 'other',
    label: 'Other',
    description: 'Any other balance you want to track',
    group: 'other',
    icon: 'wallet',
    color: '#64748B',
  },
];

let accountTypeIconComponents: Record<string, LucideIcon> | null = null;

function getAccountTypeIconComponents(): Record<string, LucideIcon> {
  if (accountTypeIconComponents) {
    return accountTypeIconComponents;
  }

  const {
    Briefcase,
    CreditCard,
    Landmark,
    PiggyBank,
    Shield,
    Smartphone,
    TrendingUp,
    Wallet,
  } = require('lucide-react-native') as typeof import('lucide-react-native');

  accountTypeIconComponents = {
    wallet: Wallet,
    landmark: Landmark,
    piggybank: PiggyBank,
    'credit-card': CreditCard,
    'trending-up': TrendingUp,
    smartphone: Smartphone,
    shield: Shield,
    briefcase: Briefcase,
  };

  return accountTypeIconComponents;
}

function normalizeIconKey(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function titleCasePart(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeAccountType(value: string): string {
  const cleaned = value.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) {
    return 'Custom';
  }

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => titleCasePart(part.toLowerCase()))
    .join(' ');
}

export function normalizeAccountTypeValue(value: string): AccountType {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return (normalized || 'other') as AccountType;
}

export function createCustomAccountTypeDefinition(input: {
  label: string;
  description?: string;
  group?: AccountTypeGroup;
  icon?: string;
  color?: string;
}): CustomAccountType {
  const label = input.label.trim();
  const normalizedType = normalizeAccountTypeValue(label);
  const group = input.group ?? 'other';
  const groupDefaults = ACCOUNT_TYPE_GROUP_DEFAULTS[group];

  return {
    type: normalizedType,
    label: label || humanizeAccountType(String(normalizedType)),
    description: input.description?.trim() || 'Custom account type created by you',
    group,
    icon: normalizeIconKey(input.icon) || groupDefaults.icon,
    color: input.color || groupDefaults.color || FALLBACK_ACCOUNT_COLOR,
    createdAt: new Date(),
  };
}

export function mergeAccountTypeDefinitions(
  customAccountTypes: CustomAccountType[] = []
): AccountTypeDefinition[] {
  const merged = new Map<AccountType, AccountTypeDefinition>();

  for (const definition of BUILT_IN_ACCOUNT_TYPE_DEFINITIONS) {
    merged.set(definition.type, definition);
  }

  for (const customType of customAccountTypes) {
    if (!customType?.type || !customType?.label) {
      continue;
    }

    merged.set(customType.type, {
      type: customType.type,
      label: customType.label,
      description: customType.description,
      group: customType.group,
      icon: normalizeIconKey(customType.icon) || 'wallet',
      color: customType.color || FALLBACK_ACCOUNT_COLOR,
      isCustom: true,
    });
  }

  return Array.from(merged.values());
}

export function getAccountTypeDefinition(
  type: AccountType | string | undefined,
  definitions: AccountTypeDefinition[] = BUILT_IN_ACCOUNT_TYPE_DEFINITIONS
): AccountTypeDefinition {
  const normalizedType = normalizeAccountTypeValue(type ?? 'other');
  const matched = definitions.find((definition) => definition.type === normalizedType);

  if (matched) {
    return matched;
  }

  return {
    type: normalizedType,
    label: humanizeAccountType(String(normalizedType)),
    description: 'Custom account type',
    group: 'other',
    icon: 'wallet',
    color: FALLBACK_ACCOUNT_COLOR,
    isCustom: true,
  };
}

export function getDefaultAccountColorForType(
  type: AccountType | string | undefined,
  definitions: AccountTypeDefinition[] = BUILT_IN_ACCOUNT_TYPE_DEFINITIONS
): string {
  return getAccountTypeDefinition(type, definitions).color || FALLBACK_ACCOUNT_COLOR;
}

export function getDefaultAccountColorForGroup(group: AccountTypeGroup): string {
  return ACCOUNT_TYPE_GROUP_DEFAULTS[group]?.color || FALLBACK_ACCOUNT_COLOR;
}

export function getDefaultAccountIconForGroup(group: AccountTypeGroup): string {
  return ACCOUNT_TYPE_GROUP_DEFAULTS[group]?.icon || 'wallet';
}

export function getAccountTypeIcon(
  typeOrIcon: AccountType | string | undefined,
  fallbackTypeOrIcon?: AccountType | string | undefined
): LucideIcon {
  const iconComponents = getAccountTypeIconComponents();
  const walletIcon = iconComponents.wallet;
  const iconKey = normalizeIconKey(typeOrIcon);
  if (iconComponents[iconKey]) {
    return iconComponents[iconKey];
  }

  const fallbackKey = normalizeIconKey(fallbackTypeOrIcon);
  if (iconComponents[fallbackKey]) {
    return iconComponents[fallbackKey];
  }

  const definition = BUILT_IN_ACCOUNT_TYPE_DEFINITIONS.find(
    (entry) => entry.type === normalizeAccountTypeValue(String(typeOrIcon || fallbackTypeOrIcon || 'other'))
  );

  if (definition) {
    return iconComponents[normalizeIconKey(definition.icon)] ?? walletIcon;
  }

  return walletIcon;
}

export function getAccountTypeGroupLabel(group: AccountTypeGroup): string {
  return ACCOUNT_TYPE_GROUPS.find((entry) => entry.key === group)?.label ?? 'Other';
}

