import { TransactionCategory } from '@/types/transaction';

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  { id: '1', name: 'Food & Dining', icon: 'Utensils', color: '#FF6B6B' },
  { id: '2', name: 'Transportation', icon: 'Car', color: '#4ECDC4' },
  { id: '3', name: 'Shopping', icon: 'ShoppingBag', color: '#45B7D1' },
  { id: '4', name: 'Entertainment', icon: 'Film', color: '#96CEB4' },
  { id: '5', name: 'Bills & Utilities', icon: 'Zap', color: '#FFEAA7' },
  { id: '6', name: 'Healthcare', icon: 'Heart', color: '#DDA0DD' },
  { id: '7', name: 'Education', icon: 'Book', color: '#98D8C8' },
  { id: '8', name: 'Travel', icon: 'Plane', color: '#F7DC6F' },
  { id: '9', name: 'Seeds & Plants', icon: 'Sprout', color: '#88B04B' },
  { id: '10', name: 'Livestock Feed', icon: 'Beef', color: '#D4A574' },
  { id: '11', name: 'Farm Equipment', icon: 'Tractor', color: '#E67E22' },
  { id: '12', name: 'Fertilizers', icon: 'Droplets', color: '#7CB342' },
  { id: '13', name: 'Pesticides', icon: 'Bug', color: '#C0392B' },
  { id: '14', name: 'Irrigation', icon: 'Waves', color: '#3498DB' },
  { id: '15', name: 'Veterinary', icon: 'Stethoscope', color: '#9B59B6' },
  { id: '16', name: 'Labor Costs', icon: 'Users', color: '#16A085' },
  { id: '17', name: 'Farm Maintenance', icon: 'Wrench', color: '#95A5A6' },
  { id: '18', name: 'Storage & Packaging', icon: 'Package', color: '#D35400' },
  { id: '19', name: 'Land Rent', icon: 'Home', color: '#8E44AD' },
  { id: '20', name: 'Insurance', icon: 'Shield', color: '#2980B9' },
  { id: '21', name: 'Other', icon: 'MoreHorizontal', color: '#BDC3C7' },
];

export const INCOME_CATEGORIES: TransactionCategory[] = [
  { id: '22', name: 'Salary', icon: 'Briefcase', color: '#2ECC71' },
  { id: '23', name: 'Crop Sales', icon: 'Wheat', color: '#F39C12' },
  { id: '24', name: 'Livestock Sales', icon: 'Beef', color: '#27AE60' },
  { id: '25', name: 'Dairy Products', icon: 'Milk', color: '#ECF0F1' },
  { id: '26', name: 'Freelance', icon: 'Laptop', color: '#1ABC9C' },
  { id: '27', name: 'Investment', icon: 'TrendingUp', color: '#16A085' },
  { id: '28', name: 'Government Subsidy', icon: 'Landmark', color: '#3498DB' },
  { id: '29', name: 'Gift', icon: 'Gift', color: '#58D68D' },
  { id: '30', name: 'Other Income', icon: 'PlusCircle', color: '#82E0AA' },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];