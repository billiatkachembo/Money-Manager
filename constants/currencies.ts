export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'NGN', symbol: 'NGN', name: 'Nigerian Naira' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc' },
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula' },
  { code: 'GHS', symbol: 'GHc', name: 'Ghanaian Cedi' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
  { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha' },
  { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical' },
  { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar' },
  { code: 'AOA', symbol: 'Kz', name: 'Angolan Kwanza' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
  { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc' },
  { code: 'EGP', symbol: 'EGP', name: 'Egyptian Pound' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  { code: 'TND', symbol: 'TND', name: 'Tunisian Dinar' },
  { code: 'DZD', symbol: 'DZD', name: 'Algerian Dinar' },
  { code: 'LYD', symbol: 'LYD', name: 'Libyan Dinar' },
  { code: 'SDG', symbol: 'SDG', name: 'Sudanese Pound' },
  { code: 'SOS', symbol: 'SOS', name: 'Somali Shilling' },
  { code: 'SLL', symbol: 'Le', name: 'Sierra Leonean Leone' },
  { code: 'MUR', symbol: 'Rs', name: 'Mauritian Rupee' },
  { code: 'SCR', symbol: 'SR', name: 'Seychellois Rupee' },
  { code: 'CVE', symbol: 'Esc', name: 'Cape Verdean Escudo' },
  { code: 'CDF', symbol: 'FC', name: 'Congolese Franc' },
  { code: 'GMD', symbol: 'D', name: 'Gambian Dalasi' },
  { code: 'GNF', symbol: 'FG', name: 'Guinean Franc' },
  { code: 'LRD', symbol: 'L$', name: 'Liberian Dollar' },
  { code: 'MRU', symbol: 'UM', name: 'Mauritanian Ouguiya' },
  { code: 'SZL', symbol: 'E', name: 'Swazi Lilangeni' },
  { code: 'LSL', symbol: 'L', name: 'Lesotho Loti' },
  { code: 'DJF', symbol: 'Fdj', name: 'Djiboutian Franc' },
  { code: 'KMF', symbol: 'CF', name: 'Comorian Franc' },
  { code: 'MGA', symbol: 'Ar', name: 'Malagasy Ariary' },
  { code: 'BIF', symbol: 'FBu', name: 'Burundian Franc' },
  { code: 'STN', symbol: 'Db', name: 'Sao Tome and Principe Dobra' },
  { code: 'ERN', symbol: 'Nfk', name: 'Eritrean Nakfa' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: 'EUR', name: 'Euro' },
  { code: 'GBP', symbol: 'GBP', name: 'British Pound' },
  { code: 'JPY', symbol: 'JPY', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', symbol: 'Rs', name: 'Indian Rupee' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
];

export function findCurrencyOption(code: string | undefined | null): CurrencyOption | undefined {
  const normalized = (code ?? '').trim().toUpperCase();
  return CURRENCY_OPTIONS.find((currency) => currency.code === normalized);
}
