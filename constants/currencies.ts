export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  region: 'Africa' | 'Americas' | 'Europe' | 'Asia' | 'Oceania' | 'Other';
  isDefault?: boolean; // mark default currency
}

// Updated and extended currency list
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha', region: 'Africa', isDefault: true },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'Africa' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', region: 'Africa' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', region: 'Africa' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', region: 'Africa' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', region: 'Africa' },
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula', region: 'Africa' },
  { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc', region: 'Africa' },
  { code: 'MUR', symbol: '₨', name: 'Mauritian Rupee', region: 'Africa' },
  { code: 'USD', symbol: '$', name: 'US Dollar', region: 'Americas' },
  { code: 'EUR', symbol: '€', name: 'Euro', region: 'Europe' },
  { code: 'GBP', symbol: '£', name: 'British Pound', region: 'Europe' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', region: 'Asia' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', region: 'Asia' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', region: 'Asia' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', region: 'Oceania' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', region: 'Americas' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', region: 'Europe' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', region: 'Asia' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', region: 'Asia' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', region: 'Oceania' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', region: 'Asia' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', region: 'Americas' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', region: 'Americas' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', region: 'Asia' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', region: 'Europe' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', region: 'Europe' },
  { code: 'EGP', symbol: 'EGP', name: 'Egyptian Pound', region: 'Africa' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', region: 'Africa' },
  { code: 'DZD', symbol: 'DZD', name: 'Algerian Dinar', region: 'Africa' },
  { code: 'LYD', symbol: 'LYD', name: 'Libyan Dinar', region: 'Africa' },
  { code: 'TND', symbol: 'TND', name: 'Tunisian Dinar', region: 'Africa' },
];

export const CURRENCY_MAP: Record<string, CurrencyOption> = Object.fromEntries(
  CURRENCY_OPTIONS.map(c => [c.code, c])
);

export function findCurrencyOption(code?: string | null): CurrencyOption {
  if (!code) return CURRENCY_OPTIONS.find(c => c.isDefault)!; // fallback to ZMW
  return CURRENCY_MAP[code.trim().toUpperCase()] ?? CURRENCY_OPTIONS.find(c => c.isDefault)!;
}