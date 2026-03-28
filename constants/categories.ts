import { Transaction, TransactionCategory } from '@/types/transaction';
import { enqueueWrite, STORAGE_KEYS, safeReadJSON, safeWriteJSON } from '@/lib/storage';
import { findCurrencyOption, type CurrencyOption } from '@/constants/currencies';
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
export const MODAL_DEBT_CATEGORIES: TransactionCategory[] = [
  { id: 'personal-loan', name: 'Personal Loan', icon: 'HandCoins', color: '#8B5CF6' },
  { id: 'business-loan', name: 'Business Loan', icon: 'Building2', color: '#7C3AED' },
  { id: 'mortgage-loan', name: 'Mortgage', icon: 'Home', color: '#6D28D9' },
  { id: 'vehicle-loan', name: 'Vehicle Loan', icon: 'Car', color: '#9333EA' },
  { id: 'student-loan', name: 'Student Loan', icon: 'GraduationCap', color: '#A855F7' },
  { id: 'salary-advance', name: 'Salary Advance', icon: 'Wallet', color: '#C084FC' },
  { id: 'credit-card-balance', name: 'Credit Card Balance', icon: 'CreditCard', color: '#7E22CE' },
  { id: 'overdraft', name: 'Overdraft', icon: 'CircleDollarSign', color: '#6B21A8' },
  { id: 'supplier-credit', name: 'Supplier Credit', icon: 'ReceiptText', color: '#8B5CF6' },
  { id: 'installment-plan', name: 'Installment Plan', icon: 'CalendarClock', color: '#A855F7' },
  { id: 'borrowed-family-friends', name: 'Family & Friends', icon: 'Users', color: '#C084FC' },
  { id: 'other-debt', name: 'Other Debt', icon: 'Landmark', color: '#94A3B8' },
];

/** All categories combined for easy import */
export const ALL_CATEGORIES: TransactionCategory[] = [
  ...MODAL_EXPENSE_CATEGORIES,
  ...MODAL_INCOME_CATEGORIES,
  ...MODAL_DEBT_CATEGORIES,
];
export interface TransactionSubcategory {
  id: string;
  name: string;
}

export type CustomSubcategoryMap = Record<string, TransactionSubcategory[]>;

const CATEGORY_SUBCATEGORY_PRESETS: Record<string, TransactionSubcategory[]> = {
  housing: [
    { id: 'rent', name: 'Rent' },
    { id: 'mortgage', name: 'Mortgage' },
    { id: 'repairs', name: 'Repairs' },
    { id: 'security', name: 'Security' },
  ],
  utilities: [
    { id: 'electricity', name: 'Electricity' },
    { id: 'water', name: 'Water' },
    { id: 'gas', name: 'Gas' },
    { id: 'garbage', name: 'Garbage' },
  ],
  groceries: [
    { id: 'staples', name: 'Staples' },
    { id: 'produce', name: 'Produce' },
    { id: 'snacks', name: 'Snacks' },
    { id: 'household-supplies', name: 'Household Supplies' },
  ],
  dining: [
    { id: 'breakfast', name: 'Breakfast' },
    { id: 'lunch', name: 'Lunch' },
    { id: 'dinner', name: 'Dinner' },
    { id: 'beverages', name: 'Beverages' },
  ],
  transport: [
    { id: 'public-transport', name: 'Public Transport' },
    { id: 'taxi-ride-hailing', name: 'Taxi & Ride-hailing' },
    { id: 'school-transport', name: 'School Transport' },
    { id: 'bus-coach', name: 'Bus & Coach' },
    { id: 'parking-tolls', name: 'Parking & Tolls' },
    { id: 'delivery-courier', name: 'Delivery & Courier' },
    { id: 'motorbike-transport', name: 'Motorbike Transport' },
    { id: 'bicycle-upkeep', name: 'Bicycle Upkeep' },
    { id: 'car-rental', name: 'Car Rental' },
    { id: 'maintenance', name: 'Maintenance' },
  ],
  fuel: [
    { id: 'petrol', name: 'Petrol' },
    { id: 'diesel', name: 'Diesel' },
    { id: 'generator-fuel', name: 'Generator Fuel' },
    { id: 'gas-refill', name: 'Gas Refill' },
  ],
  'phone-internet': [
    { id: 'airtime', name: 'Airtime' },
    { id: 'mobile-data', name: 'Mobile Data' },
    { id: 'home-internet', name: 'Home Internet' },
    { id: 'tv-bundle', name: 'TV Bundle' },
  ],
  subscriptions: [
    { id: 'music', name: 'Music' },
    { id: 'video-streaming', name: 'Video Streaming' },
    { id: 'software', name: 'Software' },
    { id: 'cloud-storage', name: 'Cloud Storage' },
  ],
  entertainment: [
    { id: 'movies', name: 'Movies' },
    { id: 'events', name: 'Events' },
    { id: 'games', name: 'Games' },
    { id: 'recreation', name: 'Recreation' },
  ],
  education: [
    { id: 'tuition', name: 'Tuition' },
    { id: 'books', name: 'Books' },
    { id: 'courses', name: 'Courses' },
    { id: 'school-supplies', name: 'School Supplies' },
    { id: 'stationery', name: 'Stationery' },
    { id: 'exam-fees', name: 'Exam Fees' },
    { id: 'laptop-computer', name: 'Laptop / Computer' },
    { id: 'computer-accessories', name: 'Computer Accessories' },
    { id: 'calculator', name: 'Calculator' },
    { id: 'printing-photocopying', name: 'Printing & Photocopying' },
    { id: 'research-materials', name: 'Research Materials' },
    { id: 'student-projects', name: 'Student Projects' },
  ],
  clothing: [
    { id: 'everyday-wear', name: 'Everyday Wear' },
    { id: 'shoes', name: 'Shoes' },
    { id: 'uniforms', name: 'Uniforms' },
    { id: 'accessories', name: 'Accessories' },
  ],
  'personal-care': [
    { id: 'haircare', name: 'Haircare' },
    { id: 'skincare', name: 'Skincare' },
    { id: 'cosmetics', name: 'Cosmetics' },
    { id: 'toiletries', name: 'Toiletries' },
  ],
  travel: [
    { id: 'flights', name: 'Flights' },
    { id: 'accommodation', name: 'Accommodation' },
    { id: 'local-transport', name: 'Local Transport' },
    { id: 'travel-meals', name: 'Travel Meals' },
  ],
  family: [
    { id: 'childcare', name: 'Childcare' },
    { id: 'school-support', name: 'School Support' },
    { id: 'family-support', name: 'Family Support' },
    { id: 'celebrations', name: 'Celebrations' },
  ],
  'gifts-donations': [
    { id: 'gifts', name: 'Gifts' },
    { id: 'charity', name: 'Charity' },
    { id: 'tithe', name: 'Tithe' },
    { id: 'community-support', name: 'Community Support' },
  ],
  health: [
    { id: 'consultation', name: 'Consultation' },
    { id: 'medication', name: 'Medication' },
    { id: 'lab-tests', name: 'Lab Tests' },
    { id: 'hospital-bills', name: 'Hospital Bills' },
    { id: 'dental-care', name: 'Dental Care' },
    { id: 'optical-care', name: 'Optical Care' },
    { id: 'physiotherapy', name: 'Physiotherapy' },
    { id: 'maternity-care', name: 'Maternity Care' },
    { id: 'medical-supplies', name: 'Medical Supplies' },
    { id: 'fitness', name: 'Fitness' },
  ],
  insurance: [
    { id: 'health-cover', name: 'Health Cover' },
    { id: 'vehicle-cover', name: 'Vehicle Cover' },
    { id: 'property-cover', name: 'Property Cover' },
    { id: 'crop-cover', name: 'Crop Cover' },
  ],
  'taxes-fees': [
    { id: 'bank-fees', name: 'Bank Fees' },
    { id: 'government-fees', name: 'Government Fees' },
    { id: 'permit-fees', name: 'Permit Fees' },
    { id: 'tax-payments', name: 'Tax Payments' },
  ],
  maintenance: [
    { id: 'repairs', name: 'Repairs' },
    { id: 'spare-parts', name: 'Spare Parts' },
    { id: 'cleaning', name: 'Cleaning' },
    { id: 'tools', name: 'Tools' },
    { id: 'furniture', name: 'Furniture' },
    { id: 'appliances', name: 'Appliances' },
    { id: 'kitchenware', name: 'Kitchenware' },
    { id: 'bedding-linen', name: 'Bedding & Linen' },
    { id: 'home-decor', name: 'Home Decor' },
    { id: 'storage-organizers', name: 'Storage & Organizers' },
  ],
  'farm-labor': [
    { id: 'casual-labor', name: 'Casual Labor' },
    { id: 'permanent-staff', name: 'Permanent Staff' },
    { id: 'harvest-help', name: 'Harvest Help' },
    { id: 'security', name: 'Security' },
  ],
  livestock: [
    { id: 'feed', name: 'Feed' },
    { id: 'veterinary', name: 'Veterinary' },
    { id: 'breeding', name: 'Breeding' },
    { id: 'housing', name: 'Housing' },
  ],
  fertilizers: [
    { id: 'compound-d', name: 'Compound D' },
    { id: 'urea', name: 'Urea' },
    { id: 'organic', name: 'Organic Fertilizer' },
    { id: 'soil-treatment', name: 'Soil Treatment' },
  ],
  seeds: [
    { id: 'maize-seed', name: 'Maize Seed' },
    { id: 'vegetable-seed', name: 'Vegetable Seed' },
    { id: 'seedlings', name: 'Seedlings' },
    { id: 'fruit-seed', name: 'Fruit Seed' },
  ],
  'farm-equipment': [
    { id: 'tractor-hire', name: 'Tractor Hire' },
    { id: 'irrigation', name: 'Irrigation' },
    { id: 'implements', name: 'Implements' },
    { id: 'equipment-repairs', name: 'Equipment Repairs' },
  ],
  debt: [
    { id: 'loan-repayment', name: 'Loan Repayment' },
    { id: 'interest-payment', name: 'Interest Payment' },
    { id: 'service-fee', name: 'Service Fee' },
    { id: 'penalty', name: 'Penalty' },
  ],
  other: [
    { id: 'miscellaneous', name: 'Miscellaneous' },
    { id: 'one-off', name: 'One-off' },
    { id: 'emergency', name: 'Emergency' },
    { id: 'uncategorized', name: 'Uncategorized' },
  ],
  salary: [
    { id: 'base-pay', name: 'Base Pay' },
    { id: 'overtime', name: 'Overtime' },
    { id: 'commission', name: 'Commission' },
    { id: 'back-pay', name: 'Back Pay' },
  ],
  bonus: [
    { id: 'performance-bonus', name: 'Performance Bonus' },
    { id: 'referral-bonus', name: 'Referral Bonus' },
    { id: 'holiday-bonus', name: 'Holiday Bonus' },
    { id: 'incentive', name: 'Incentive' },
  ],
  freelance: [
    { id: 'consulting', name: 'Consulting' },
    { id: 'design', name: 'Design' },
    { id: 'development', name: 'Development' },
    { id: 'writing', name: 'Writing' },
  ],
  business: [
    { id: 'shop-sales', name: 'Shop Sales' },
    { id: 'service-income', name: 'Service Income' },
    { id: 'online-sales', name: 'Online Sales' },
    { id: 'wholesale', name: 'Wholesale' },
  ],
  'farming-income': [
    { id: 'crop-sales', name: 'Crop Sales' },
    { id: 'livestock-sales', name: 'Livestock Sales' },
    { id: 'produce-sales', name: 'Produce Sales' },
    { id: 'farm-contract', name: 'Farm Contract' },
  ],
  sales: [
    { id: 'retail', name: 'Retail' },
    { id: 'reseller-margin', name: 'Reseller Margin' },
    { id: 'direct-sales', name: 'Direct Sales' },
    { id: 'bulk-orders', name: 'Bulk Orders' },
  ],
  'rental-income': [
    { id: 'house-rent', name: 'House Rent' },
    { id: 'shop-rent', name: 'Shop Rent' },
    { id: 'equipment-rent', name: 'Equipment Rent' },
    { id: 'land-lease', name: 'Land Lease' },
  ],
  interest: [
    { id: 'savings-interest', name: 'Savings Interest' },
    { id: 'fixed-deposit', name: 'Fixed Deposit' },
    { id: 'bond-interest', name: 'Bond Interest' },
    { id: 'mobile-money-interest', name: 'Mobile Money Interest' },
  ],
  dividends: [
    { id: 'cash-dividend', name: 'Cash Dividend' },
    { id: 'cooperative-payout', name: 'Cooperative Payout' },
    { id: 'share-profit', name: 'Share Profit' },
    { id: 'investment-distribution', name: 'Investment Distribution' },
  ],
  refund: [
    { id: 'purchase-refund', name: 'Purchase Refund' },
    { id: 'tax-refund', name: 'Tax Refund' },
    { id: 'reimbursement', name: 'Reimbursement' },
    { id: 'cashback', name: 'Cashback' },
  ],
  allowance: [
    { id: 'meal-allowance', name: 'Meal Allowance' },
    { id: 'transport-allowance', name: 'Transport Allowance' },
    { id: 'housing-allowance', name: 'Housing Allowance' },
    { id: 'school-allowance', name: 'School Allowance' },
  ],
  gift: [
    { id: 'family-gift', name: 'Family Gift' },
    { id: 'support', name: 'Support' },
    { id: 'celebration-gift', name: 'Celebration Gift' },
    { id: 'grant', name: 'Grant' },
  ],
  'other-income': [
    { id: 'side-hustle', name: 'Side Hustle' },
    { id: 'royalty', name: 'Royalty' },
    { id: 'windfall', name: 'Windfall' },
    { id: 'miscellaneous', name: 'Miscellaneous' },
  ],
};

const CATEGORY_SUBCATEGORY_ALIASES: Record<string, string> = {
  food: 'dining',
  meal: 'dining',
  meals: 'dining',
  diningout: 'dining',
  grocery: 'groceries',
  groceries: 'groceries',
  household: 'maintenance',
  homeitems: 'maintenance',
  transportation: 'transport',
  medical: 'health',
  healthcare: 'health',
  internet: 'phone-internet',
  airtime: 'phone-internet',
  subscription: 'subscriptions',
  clothes: 'clothing',
  personalcare: 'personal-care',
  gifts: 'gifts-donations',
  donations: 'gifts-donations',
  taxes: 'taxes-fees',
  fees: 'taxes-fees',
  farmlabor: 'farm-labor',
  fertilizer: 'fertilizers',
  loan: 'debt',
  farmingincome: 'farming-income',
  rentalincome: 'rental-income',
  otherincome: 'other-income',
};

function resolveCategorySubcategoryPresetKey(
  category?: Pick<TransactionCategory, 'id' | 'name'> | null
): string | null {
  if (!category) {
    return null;
  }

  const candidates = [category.id, category.name]
    .map((value) => normalizeCategoryLookup(value ?? ''))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (CATEGORY_SUBCATEGORY_PRESETS[candidate]) {
      return candidate;
    }

    const aliasMatch = CATEGORY_SUBCATEGORY_ALIASES[candidate];
    if (aliasMatch && CATEGORY_SUBCATEGORY_PRESETS[aliasMatch]) {
      return aliasMatch;
    }
  }

  return null;
}

function mergeSubcategories(
  ...collections: Array<ReadonlyArray<TransactionSubcategory | null | undefined>>
): TransactionSubcategory[] {
  const merged: TransactionSubcategory[] = [];
  const seen = new Set<string>();

  for (const collection of collections) {
    for (const subcategory of collection) {
      if (!subcategory?.id || !subcategory?.name?.trim()) {
        continue;
      }

      const normalizedName = normalizeCategoryName(subcategory.name);
      const lookupKey = normalizeCategoryLookup(subcategory.id) || normalizeCategoryLookup(normalizedName);
      if (!lookupKey || seen.has(lookupKey)) {
        continue;
      }

      merged.push({
        id: subcategory.id.trim(),
        name: normalizedName,
      });
      seen.add(lookupKey);
    }
  }

  return merged;
}

export function getCategorySubcategories(
  category?: Pick<TransactionCategory, 'id' | 'name'> | null,
  customSubcategoryMap: CustomSubcategoryMap = {}
): TransactionSubcategory[] {
  const presetKey = resolveCategorySubcategoryPresetKey(category);
  const presetSubcategories = presetKey ? CATEGORY_SUBCATEGORY_PRESETS[presetKey] ?? [] : [];
  const customKey = buildCategorySubcategoryKey(category);
  const customSubcategories = customKey ? customSubcategoryMap[customKey] ?? [] : [];

  return mergeSubcategories(presetSubcategories, customSubcategories);
}

export function getExpenseSubcategories(
  category?: Pick<TransactionCategory, 'id' | 'name'> | null
): TransactionSubcategory[] {
  return getCategorySubcategories(category);
}

export function formatCategoryWithSubcategory(
  category?: Pick<TransactionCategory, 'name'> | null,
  subcategory?: string | null
): string {
  const categoryName = category?.name?.trim() ?? '';
  const subcategoryName = subcategory?.trim() ?? '';

  if (!categoryName) {
    return subcategoryName;
  }

  return subcategoryName ? `${categoryName} / ${subcategoryName}` : categoryName;
}

export function normalizeCategoryLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function buildCategorySubcategoryKey(
  category?: Pick<TransactionCategory, 'id' | 'name'> | null
): string | null {
  if (!category) {
    return null;
  }

  const idKey = normalizeCategoryLookup(category.id ?? '');
  const nameKey = normalizeCategoryLookup(category.name ?? '');

  return idKey || nameKey || null;
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

export function createCustomSubcategory(
  name: string,
  existingSubcategories: ReadonlyArray<TransactionSubcategory> = []
): TransactionSubcategory {
  const normalizedName = normalizeCategoryName(name);
  const normalizedLookup = normalizeCategoryLookup(normalizedName);
  const existing = existingSubcategories.find((subcategory) =>
    normalizeCategoryLookup(subcategory.id) === normalizedLookup ||
    normalizeCategoryLookup(subcategory.name) === normalizedLookup
  );
  if (existing) {
    return existing;
  }

  const baseSlug = normalizedLookup || 'subcategory';
  const existingIds = new Set(
    existingSubcategories.map((subcategory) => normalizeCategoryLookup(subcategory.id)).filter(Boolean)
  );

  let candidateId = `custom-subcategory-${baseSlug}`;
  let suffix = 2;
  while (existingIds.has(normalizeCategoryLookup(candidateId))) {
    candidateId = `custom-subcategory-${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return {
    id: candidateId,
    name: normalizedName,
  };
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
export const DEBT_CATEGORIES = MODAL_DEBT_CATEGORIES;

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








