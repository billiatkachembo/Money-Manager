export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  region: 'Africa' | 'Americas' | 'Europe' | 'Asia' | 'Oceania' | 'Other';
  isDefault?: boolean;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha', region: 'Africa', isDefault: true },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'Africa' },
  { code: 'NGN', symbol: '?', name: 'Nigerian Naira', region: 'Africa' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', region: 'Africa' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', region: 'Africa' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', region: 'Africa' },
  { code: 'GHS', symbol: '?', name: 'Ghanaian Cedi', region: 'Africa' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', region: 'Africa' },
  { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha', region: 'Africa' },
  { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical', region: 'Africa' },
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula', region: 'Africa' },
  { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar', region: 'Africa' },
  { code: 'SZL', symbol: 'E', name: 'Swazi Lilangeni', region: 'Africa' },
  { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc', region: 'Africa' },
  { code: 'BIF', symbol: 'FBu', name: 'Burundian Franc', region: 'Africa' },
  { code: 'CDF', symbol: 'FC', name: 'Congolese Franc', region: 'Africa' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc', region: 'Africa' },
  { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA Franc', region: 'Africa' },
  { code: 'MUR', symbol: '?', name: 'Mauritian Rupee', region: 'Africa' },
  { code: 'SCR', symbol: 'SR', name: 'Seychellois Rupee', region: 'Africa' },
  { code: 'EGP', symbol: 'E?', name: 'Egyptian Pound', region: 'Africa' },
  { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', region: 'Africa' },
  { code: 'DZD', symbol: 'DA', name: 'Algerian Dinar', region: 'Africa' },
  { code: 'LYD', symbol: 'LD', name: 'Libyan Dinar', region: 'Africa' },
  { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar', region: 'Africa' },
  { code: 'AOA', symbol: 'Kz', name: 'Angolan Kwanza', region: 'Africa' },

  { code: 'USD', symbol: '$', name: 'US Dollar', region: 'Americas' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', region: 'Americas' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', region: 'Americas' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', region: 'Americas' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', region: 'Americas' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', region: 'Americas' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', region: 'Americas' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', region: 'Americas' },

  { code: 'EUR', symbol: '?', name: 'Euro', region: 'Europe' },
  { code: 'GBP', symbol: '?', name: 'British Pound', region: 'Europe' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', region: 'Europe' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', region: 'Europe' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', region: 'Europe' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', region: 'Europe' },
  { code: 'PLN', symbol: 'z?', name: 'Polish Zloty', region: 'Europe' },
  { code: 'CZK', symbol: 'K?', name: 'Czech Koruna', region: 'Europe' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', region: 'Europe' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', region: 'Europe' },
  { code: 'TRY', symbol: '?', name: 'Turkish Lira', region: 'Europe' },
  { code: 'RUB', symbol: '?', name: 'Russian Ruble', region: 'Europe' },
  { code: 'UAH', symbol: '?', name: 'Ukrainian Hryvnia', region: 'Europe' },

  { code: 'JPY', symbol: '?', name: 'Japanese Yen', region: 'Asia' },
  { code: 'CNY', symbol: '?', name: 'Chinese Yuan', region: 'Asia' },
  { code: 'INR', symbol: '?', name: 'Indian Rupee', region: 'Asia' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', region: 'Asia' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', region: 'Asia' },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', region: 'Asia' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', region: 'Asia' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', region: 'Asia' },
  { code: 'ILS', symbol: '?', name: 'Israeli New Shekel', region: 'Asia' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', region: 'Asia' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', region: 'Asia' },
  { code: 'KRW', symbol: '?', name: 'South Korean Won', region: 'Asia' },
  { code: 'THB', symbol: '?', name: 'Thai Baht', region: 'Asia' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', region: 'Asia' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', region: 'Asia' },
  { code: 'PHP', symbol: '?', name: 'Philippine Peso', region: 'Asia' },
  { code: 'VND', symbol: '?', name: 'Vietnamese Dong', region: 'Asia' },
  { code: 'PKR', symbol: '?', name: 'Pakistani Rupee', region: 'Asia' },
  { code: 'BDT', symbol: '?', name: 'Bangladeshi Taka', region: 'Asia' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', region: 'Asia' },

  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', region: 'Oceania' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', region: 'Oceania' },
  { code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar', region: 'Oceania' },
  { code: 'PGK', symbol: 'K', name: 'Papua New Guinean Kina', region: 'Oceania' },
];

export const CURRENCY_MAP: Record<string, CurrencyOption> = Object.fromEntries(
  CURRENCY_OPTIONS.map((currency) => [currency.code, currency])
);

export function findCurrencyOption(code?: string | null): CurrencyOption {
  if (!code) {
    return CURRENCY_OPTIONS.find((currency) => currency.isDefault) ?? CURRENCY_OPTIONS[0];
  }

  return CURRENCY_MAP[code.trim().toUpperCase()] ?? (CURRENCY_OPTIONS.find((currency) => currency.isDefault) ?? CURRENCY_OPTIONS[0]);
}
