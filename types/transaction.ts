export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: TransactionCategory;
  type: 'income' | 'expense' | 'transfer';
  date: Date;
  createdAt: Date;
  fromAccount?: string;
  toAccount?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurringEndDate?: Date;
  parentTransactionId?: string;
  tags?: string[];
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