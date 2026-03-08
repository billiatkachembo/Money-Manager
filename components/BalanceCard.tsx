import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

interface BalanceCardProps {
  balance: number;
  income: number;
  expenses: number;
}

export function BalanceCard({ balance, income, expenses }: BalanceCardProps) {
  const { theme } = useTheme();
  const { formatCurrency: formatCurrencyWithSettings } = useTransactionStore();

  const formatCurrency = (amount: number) => {
    const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? Math.abs(amount) : 0;
    return formatCurrencyWithSettings(safeAmount);
  };

  return (
    <LinearGradient
      colors={theme.isDark ? ['#2d2d2d', '#404040'] : ['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.label}>Total Balance</Text>
        <Text style={[styles.balance, balance < 0 && styles.negativeBalance]}>
          {balance < 0 ? '-' : ''}{formatCurrency(balance)}
        </Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <TrendingUp size={14} color="#4CAF50" />
            </View>
            <View>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={styles.statValue}>{formatCurrency(income)}</Text>
            </View>
          </View>
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#FFEBEE' }]}>
              <TrendingDown size={14} color="#F44336" />
            </View>
            <View>
              <Text style={styles.statLabel}>Expenses</Text>
              <Text style={styles.statValue}>{formatCurrency(expenses)}</Text>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  content: {
    padding: 16,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  balance: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  negativeBalance: {
    color: '#FFCDD2',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  statValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

