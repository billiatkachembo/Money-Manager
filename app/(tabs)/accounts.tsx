import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
} from 'lucide-react-native';
import { Account } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

const ACCOUNT_TYPES = [
  { id: 'checking', name: 'Checking', icon: CreditCard, color: '#667eea' },
  { id: 'savings', name: 'Savings', icon: PiggyBank, color: '#4CAF50' },
  { id: 'credit', name: 'Credit Card', icon: CreditCard, color: '#F44336' },
  { id: 'investment', name: 'Investment', icon: TrendingUp, color: '#FF9800' },
  { id: 'cash', name: 'Cash', icon: Wallet, color: '#9C27B0' },
] as const;

const ACCOUNT_COLORS = [
  '#667eea', '#4CAF50', '#F44336', '#FF9800', '#9C27B0',
  '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5'
];

interface AccountInsights {
  accountId: string;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  averageBalance: number;
  monthlyTrend: { month: string; income: number; expenses: number; balance: number }[];
  topCategories: { categoryName: string; amount: number; color: string }[];
  transfersIn: number;
  transfersOut: number;
}

export default function AccountsScreen() {
  const { theme } = useTheme();
  const { transactions, formatCurrency } = useTransactionStore();
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [hideBalances, setHideBalances] = useState<boolean>(false);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as Account['type'],
    balance: '',
    color: ACCOUNT_COLORS[0],
    icon: '💳',
  });

  const getAccountInsights = (accountId: string): AccountInsights => {
    const accountTransactions = transactions.filter((t) => {
      if (t.type === 'transfer') {
        // Handle optional properties with nullish checks
        const fromAccount = t.fromAccount || '';
        const toAccount = t.toAccount || '';
        return fromAccount === accountId || toAccount === accountId;
      }
      return true;
    });

    const totalIncome = accountTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = accountTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersIn = transactions
      .filter((t) => t.type === 'transfer' && t.toAccount === accountId)
      .reduce((sum, t) => sum + t.amount, 0);

    const transfersOut = transactions
      .filter((t) => t.type === 'transfer' && t.fromAccount === accountId)
      .reduce((sum, t) => sum + t.amount, 0);

    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return date.toISOString().slice(0, 7);
    }).reverse();

    const monthlyTrend = last6Months.map(month => {
      const monthTransactions = accountTransactions.filter((t) => {
        return t.date.toISOString().slice(0, 7) === month;
      });

      const income = monthTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = monthTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month,
        income,
        expenses,
        balance: income - expenses,
      };
    });

    const categoryMap = new Map<string, { amount: number; color: string }>();
    accountTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const existing = categoryMap.get(t.category.name) || { amount: 0, color: t.category.color };
        categoryMap.set(t.category.name, {
          amount: existing.amount + t.amount,
          color: t.category.color,
        });
      });

    const topCategories = Array.from(categoryMap.entries())
      .map(([categoryName, data]) => ({
        categoryName,
        amount: data.amount,
        color: data.color,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const account = accounts.find(a => a.id === accountId);
    const avgBalance = account ? account.balance : 0;

    return {
      accountId,
      totalIncome,
      totalExpenses,
      transactionCount: accountTransactions.length,
      averageBalance: avgBalance,
      monthlyTrend,
      topCategories,
      transfersIn,
      transfersOut,
    };
  };

  const getTotalBalance = () => {
    return accounts
      .filter(account => account.isActive)
      .reduce((total, account) => {
        if (account.type === 'credit') {
          return total + account.balance; // Credit balances are negative
        }
        return total + account.balance;
      }, 0);
  };

  const getAccountTypeInfo = (type: Account['type']) => {
    return ACCOUNT_TYPES.find(t => t.id === type) || ACCOUNT_TYPES[0];
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'checking',
      balance: '',
      color: ACCOUNT_COLORS[0],
      icon: '💳',
    });
  };

  const handleAddAccount = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter an account name');
      return;
    }

    const balance = parseFloat(formData.balance) || 0;
    const newAccount: Account = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      type: formData.type,
      balance: formData.type === 'credit' ? -Math.abs(balance) : balance,
      currency: 'USD',
      color: formData.color,
      icon: formData.icon,
      isActive: true,
      createdAt: new Date(),
    };

    setAccounts(prev => [...prev, newAccount]);
    setShowAddModal(false);
    resetForm();
  };

  const handleEditAccount = () => {
    if (!editingAccount || !formData.name.trim()) {
      Alert.alert('Error', 'Please enter an account name');
      return;
    }

    const balance = parseFloat(formData.balance) || 0;
    const updatedAccount: Account = {
      ...editingAccount,
      name: formData.name.trim(),
      type: formData.type,
      balance: formData.type === 'credit' ? -Math.abs(balance) : balance,
      color: formData.color,
      icon: formData.icon,
    };

    setAccounts(prev =>
      prev.map(account =>
        account.id === editingAccount.id ? updatedAccount : account
      )
    );
    setEditingAccount(null);
    resetForm();
  };

  const handleDeleteAccount = (accountId: string) => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setAccounts(prev => prev.filter(account => account.id !== accountId));
          },
        },
      ]
    );
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      balance: Math.abs(account.balance).toString(),
      color: account.color,
      icon: account.icon,
    });
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingAccount(null);
    resetForm();
  };

  const totalBalance = getTotalBalance();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.totalBalanceCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.totalBalanceLabel}>Total Balance</Text>
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setHideBalances(!hideBalances)}
            >
              {hideBalances ? (
                <EyeOff size={20} color="rgba(255, 255, 255, 0.7)" />
              ) : (
                <Eye size={20} color="rgba(255, 255, 255, 0.7)" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[
            styles.totalBalanceAmount,
            totalBalance < 0 && { color: theme.colors.error }
          ]}>
            {hideBalances ? '••••••' : formatCurrency(totalBalance)}
          </Text>
          <Text style={styles.accountCount}>
            {accounts.filter(a => a.isActive).length} active accounts
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.success }]}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={24} color="white" />
          <Text style={styles.addButtonText}>Add Account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.accountsList}>
        {accounts.map((account) => {
          const typeInfo = getAccountTypeInfo(account.type);
          const insights = getAccountInsights(account.id);
          const isExpanded = expandedAccountId === account.id;

          return (
            <View key={account.id} style={[styles.accountCard, { backgroundColor: theme.colors.surface }]}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setExpandedAccountId(isExpanded ? null : account.id)}
              >
                <View style={styles.accountHeader}>
                  <View style={[styles.accountIcon, { backgroundColor: theme.colors.background }]}>
                    <Text style={styles.accountEmoji}>{account.icon}</Text>
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountName, { color: theme.colors.text }]}>{account.name}</Text>
                    <Text style={[styles.accountType, { color: theme.colors.textSecondary }]}>{typeInfo.name}</Text>
                  </View>
                  <View style={styles.accountActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        openEditModal(account);
                      }}
                    >
                      <Edit3 size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteAccount(account.id);
                      }}
                    >
                      <Trash2 size={16} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.accountBalance}>
                  <Text style={[
                    styles.balanceAmount,
                    { color: theme.colors.text },
                    account.balance < 0 && { color: theme.colors.error }
                  ]}>
                    {hideBalances ? '••••••' : (
                      account.type === 'credit' && account.balance < 0
                        ? `-${formatCurrency(Math.abs(account.balance))}`
                        : formatCurrency(account.balance)
                    )}
                  </Text>
                  {account.type === 'credit' && account.balance < 0 && (
                    <Text style={[styles.creditLabel, { color: theme.colors.error }]}>Outstanding Balance</Text>
                  )}
                </View>

                <View style={styles.quickStats}>
                  <View style={styles.quickStatItem}>
                    <Activity size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.quickStatText, { color: theme.colors.textSecondary }]}>  
                      {insights.transactionCount} transactions
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.expandButton}>
                    {isExpanded ? (
                      <ChevronUp size={20} color={theme.colors.primary} />
                    ) : (
                      <ChevronDown size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={[styles.insightsContainer, { borderTopColor: theme.colors.border }]}>
                  <Text style={[styles.insightsTitle, { color: theme.colors.text }]}>Account Insights</Text>
                  
                  <View style={styles.statsGrid}>
                    <View style={[styles.statBox, { backgroundColor: theme.colors.background }]}>
                      <View style={styles.statHeader}>
                        <ArrowUpRight size={16} color="#4CAF50" />
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                      </View>
                      <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                        {formatCurrency(insights.totalIncome)}
                      </Text>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: theme.colors.background }]}>
                      <View style={styles.statHeader}>
                        <ArrowDownRight size={16} color="#F44336" />
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                      </View>
                      <Text style={[styles.statValue, { color: '#F44336' }]}>
                        {formatCurrency(insights.totalExpenses)}
                      </Text>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: theme.colors.background }]}>
                      <View style={styles.statHeader}>
                        <BarChart3 size={16} color={theme.colors.primary} />
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Avg Balance</Text>
                      </View>
                      <Text style={[styles.statValue, { color: theme.colors.text }]}>
                        {formatCurrency(insights.averageBalance)}
                      </Text>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: theme.colors.background }]}>
                      <View style={styles.statHeader}>
                        <TrendingUp size={16} color="#FF9800" />
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Net Flow</Text>
                      </View>
                      <Text style={[
                        styles.statValue,
                        { color: insights.totalIncome - insights.totalExpenses >= 0 ? '#4CAF50' : '#F44336' }
                      ]}>
                        {formatCurrency(insights.totalIncome - insights.totalExpenses)}
                      </Text>
                    </View>
                  </View>

                  {insights.topCategories.length > 0 && (
                    <View style={styles.categorySection}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Spending Categories</Text>
                      {insights.topCategories.map((cat, index) => {
                        const maxAmount = insights.topCategories[0]?.amount || 1;
                        const percentage = (cat.amount / maxAmount) * 100;
                        
                        return (
                          <View key={index} style={styles.categoryItem}>
                            <View style={styles.categoryHeader}>
                              <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                              <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                                {cat.categoryName}
                              </Text>
                              <Text style={[styles.categoryAmount, { color: theme.colors.textSecondary }]}>
                                {formatCurrency(cat.amount)}
                              </Text>
                            </View>
                            <View style={[styles.categoryBarBg, { backgroundColor: theme.colors.border }]}>
                              <View 
                                style={[
                                  styles.categoryBar,
                                  { backgroundColor: cat.color, width: `${percentage}%` }
                                ]} 
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {insights.monthlyTrend.length > 0 && (
                    <View style={styles.trendSection}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>6-Month Trend</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.trendChart}>
                          {insights.monthlyTrend.map((trend, index) => {
                            const maxValue = Math.max(
                              ...insights.monthlyTrend.map(t => Math.max(t.income, t.expenses))
                            ) || 1;
                            const incomeHeight = (trend.income / maxValue) * 80;
                            const expenseHeight = (trend.expenses / maxValue) * 80;
                            const monthName = new Date(trend.month + '-01').toLocaleDateString('en-US', {
                              month: 'short'
                            });

                            return (
                              <View key={index} style={styles.trendColumn}>
                                <View style={styles.trendBars}>
                                  <View style={styles.trendBarContainer}>
                                    <View 
                                      style={[
                                        styles.trendBar,
                                        { height: incomeHeight, backgroundColor: '#4CAF50' }
                                      ]} 
                                    />
                                  </View>
                                  <View style={styles.trendBarContainer}>
                                    <View 
                                      style={[
                                        styles.trendBar,
                                        { height: expenseHeight, backgroundColor: '#F44336' }
                                      ]} 
                                    />
                                  </View>
                                </View>
                                <Text style={[styles.trendLabel, { color: theme.colors.textSecondary }]}>
                                  {monthName}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                      <View style={styles.trendLegend}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                          <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Income</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                          <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Expenses</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {(insights.transfersIn > 0 || insights.transfersOut > 0) && (
                    <View style={styles.transferSection}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Transfers</Text>
                      <View style={styles.transferRow}>
                        <View style={styles.transferItem}>
                          <Text style={[styles.transferLabel, { color: theme.colors.textSecondary }]}>In</Text>
                          <Text style={[styles.transferValue, { color: '#4CAF50' }]}>
                            {formatCurrency(insights.transfersIn)}
                          </Text>
                        </View>
                        <View style={styles.transferItem}>
                          <Text style={[styles.transferLabel, { color: theme.colors.textSecondary }]}>Out</Text>
                          <Text style={[styles.transferValue, { color: '#F44336' }]}>
                            {formatCurrency(insights.transfersOut)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.accountIndicator, { backgroundColor: account.color }]} />
            </View>
          );
        })}
      </View>

      <Modal
        visible={showAddModal || editingAccount !== null}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingAccount ? 'Edit Account' : 'Add Account'}
            </Text>
            <TouchableOpacity
              onPress={editingAccount ? handleEditAccount : handleAddAccount}
            >
              <Text style={[styles.saveButton, { color: theme.colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Account Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Enter account name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Account Type</Text>
              <View style={styles.typeSelector}>
                {ACCOUNT_TYPES.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.typeOption,
                        { backgroundColor: theme.colors.background, borderColor: formData.type === type.id ? theme.colors.primary : 'transparent' }
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, type: type.id }))}
                    >
                      <IconComponent size={20} color={type.color} />
                      <Text style={[styles.typeText, { color: theme.colors.text }]}>{type.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>
                {formData.type === 'credit' ? 'Outstanding Balance' : 'Current Balance'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={formData.balance}
                onChangeText={(text) => setFormData(prev => ({ ...prev, balance: text }))}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Color</Text>
              <View style={styles.colorSelector}>
                {ACCOUNT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      formData.color === color && { borderColor: theme.colors.text }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Icon</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={formData.icon}
                onChangeText={(text) => setFormData(prev => ({ ...prev, icon: text }))}
                placeholder="💳"
                placeholderTextColor={theme.colors.textSecondary}
                maxLength={2}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  totalBalanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  eyeButton: {
    padding: 4,
  },
  totalBalanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  accountCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  accountsList: {
    padding: 16,
    gap: 12,
  },
  accountCard: {
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountEmoji: {
    fontSize: 24,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountType: {
    fontSize: 12,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  accountBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  creditLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  accountIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  typeSelector: {
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  colorSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
  },
  quickStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickStatText: {
    fontSize: 12,
    fontWeight: '500',
  },
  expandButton: {
    padding: 4,
  },
  insightsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    minWidth: '47%',
    padding: 12,
    borderRadius: 12,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  categorySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoryItem: {
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 3,
  },
  trendSection: {
    marginBottom: 20,
  },
  trendChart: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
  },
  trendColumn: {
    alignItems: 'center',
    gap: 8,
  },
  trendBars: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
    height: 80,
  },
  trendBarContainer: {
    width: 20,
    height: 80,
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  trendLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  trendLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  transferSection: {
    marginBottom: 8,
  },
  transferRow: {
    flexDirection: 'row',
    gap: 12,
  },
  transferItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  transferLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  transferValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});