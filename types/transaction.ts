export type TransactionType = 'income' | 'expense' | 'transfer';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type TransferLeg = 'debit' | 'credit';

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: TransactionCategory;
  type: TransactionType;
  date: Date;
  createdAt: Date;
  fromAccount?: string;
  toAccount?: string;
  fromAccountId?: string;
  toAccountId?: string;
  transferGroupId?: string;
  transferLeg?: TransferLeg;
  isHidden?: boolean;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  recurringEndDate?: Date;
  recurringId?: string;
  materializedForDate?: string;
  parentTransactionId?: string;
  tags?: string[];
  receiptImage?: string;
  updatedAt?: Date;
}

export interface TransactionCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  category?: TransactionCategory;
  amount: number;
  spent?: number;
  period: 'monthly' | 'weekly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  alertAt80Percent: boolean;
  alertAtLimit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAlert {
  id: string;
  budgetId: string;
  type: '80percent' | 'exceeded';
  message: string;
  date: Date;
  isRead: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
  // Cached only. Transaction ledger remains source of truth.
  balance: number;
  currency: string;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: 'financial' | 'goal' | 'reminder' | 'idea' | 'other';
  color: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  category: 'savings' | 'investment' | 'debt' | 'emergency';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  occupation: string;
  joinDate: Date;
  avatar: string;
}

export interface RecurringRule {
  id: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  lastMaterializedAt?: string;
  template: Omit<Transaction, 'id' | 'date'>;
}

export interface FinancialHealthMetrics {
  savingsRate: number;
  budgetAdherence: number;
  bufferMonths: number;
  expenseCV: number;
  incomeCV: number;
}

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface Insight {
  id: string;
  title: string;
  message: string;
  severity: InsightSeverity;
  confidence: number;
}

export interface FarmCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  ratio: number;
}

export interface FarmSummary {
  season: string;
  totalFarmIncome: number;
  totalFarmExpenses: number;
  profit: number;
  costBreakdown: { category: string; amount: number; percentage: number }[];
  topCrops: { name: string; revenue: number }[];
}

export interface SeasonalFarmSummary {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  farmIncome: number;
  farmExpenses: number;
  farmProfit: number;
  costBreakdown: FarmCategoryBreakdown[];
}

