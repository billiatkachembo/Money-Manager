import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Plus, PiggyBank, Pencil, Trash2, Wallet, CreditCard, TrendingUp, Landmark, ChevronRight, Shield, Download } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Account, Transaction } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useTabNavigationStore } from '@/store/tab-navigation-store';
import { exportAccountsToCsv } from '@/lib/account-csv';
import { formatDateTimeWithWeekday, formatDateWithWeekday } from '@/utils/date';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';

const ACCOUNT_TYPE_OPTIONS: Array<{
  type: Account['type'];
  label: string;
  description: string;
  icon: typeof Wallet;
}> = [
  { type: 'checking', label: 'Checking', description: 'Daily income and spending', icon: Wallet },
  { type: 'savings', label: 'Savings', description: 'Emergency funds and goals', icon: PiggyBank },
  { type: 'credit', label: 'Credit', description: 'Cards and short-term debt', icon: CreditCard },
  { type: 'investment', label: 'Investment', description: 'Long-term growth accounts', icon: TrendingUp },
  { type: 'cash', label: 'Cash', description: 'Wallet and petty cash', icon: Landmark },
];

const ACCOUNT_GROUPS: Array<{ key: string; label: string; types: Array<Account['type']> }> = [
  { key: 'cash_bank', label: 'Cash & Bank', types: ['checking', 'cash'] },
  { key: 'savings', label: 'Savings', types: ['savings'] },
  { key: 'credit', label: 'Credit', types: ['credit'] },
  { key: 'investment', label: 'Investments', types: ['investment'] },
];
type AccountSortMode = 'name' | 'balance' | 'newest';

const ACCOUNT_SORT_OPTIONS: Array<{ key: AccountSortMode; label: string }> = [
  { key: 'name', label: 'A-Z' },
  { key: 'balance', label: 'Balance' },
  { key: 'newest', label: 'Newest' },
];

const ACCOUNT_COLOR_OPTIONS = [
  '#2563EB',
  '#16A34A',
  '#0EA5E9',
  '#F59E0B',
  '#EF4444',
  '#F97316',
  '#8B5CF6',
  '#14B8A6',
  '#64748B',
  '#111827',
];

const DEFAULT_ACCOUNT_COLORS: Record<Account['type'], string> = {
  checking: '#2563EB',
  savings: '#16A34A',
  credit: '#EF4444',
  investment: '#8B5CF6',
  cash: '#F59E0B',
};

function getDefaultAccountColor(type: Account['type']): string {
  return DEFAULT_ACCOUNT_COLORS[type] ?? '#2563EB';
}

function withAlphaColor(color: string, alphaHex: string): string {
  if (color.startsWith('#') && color.length === 7) {
    return color + alphaHex;
  }

  if (color.startsWith('#') && color.length === 4) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return '#' + r + r + g + g + b + b + alphaHex;
  }

  return color;
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function mergeDateWithExistingTime(nextDate: Date, referenceDate: Date): Date {
  const merged = new Date(nextDate);
  merged.setHours(referenceDate.getHours(), referenceDate.getMinutes(), referenceDate.getSeconds(), referenceDate.getMilliseconds());
  return merged;
}

function formatSignedCurrency(formatCurrency: (value: number) => string, value: number): string {
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

function formatFileTimestamp(value: Date): string {
  const safeDate = value instanceof Date ? value : new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');

  return `${safeDate.getFullYear()}${pad(safeDate.getMonth() + 1)}${pad(safeDate.getDate())}-${pad(safeDate.getHours())}${pad(safeDate.getMinutes())}${pad(safeDate.getSeconds())}`;
}

function getFromAccountId(transaction: Transaction): string | undefined {
  return transaction.fromAccountId ?? transaction.fromAccount;
}

function getToAccountId(transaction: Transaction): string | undefined {
  return transaction.toAccountId ?? transaction.toAccount;
}

function computeTransactionNetWorthImpact(
  transaction: Transaction,
  activeAccountIds: Set<string>
): number {
  const fromAccountId = getFromAccountId(transaction);
  const toAccountId = getToAccountId(transaction);
  const debit = fromAccountId && activeAccountIds.has(fromAccountId) ? transaction.amount : 0;
  const credit = toAccountId && activeAccountIds.has(toAccountId) ? transaction.amount : 0;
  return roundCurrency(credit - debit);
}
interface AccountActivityEntry {
  transaction: Transaction;
  direction: 'incoming' | 'outgoing';
}

interface AccountActivitySummary {
  income: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  transactions: AccountActivityEntry[];
}

const EMPTY_ACCOUNT_ACTIVITY: AccountActivitySummary = {
  income: 0,
  expenses: 0,
  transfersIn: 0,
  transfersOut: 0,
  transactions: [],
};

export default function AccountsScreen() {
  const { theme } = useTheme();
  const openAccountComposerAt = useTabNavigationStore((state) => state.openAccountComposerAt);
  const consumeAccountsComposer = useTabNavigationStore((state) => state.consumeAccountsComposer);
  const {
    accounts,
    transactions,
    lifetimeNetCashFlow,
    settings,
    formatCurrency,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useTransactionStore();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('checking');
  const [balance, setBalance] = useState('0');
  const [color, setColor] = useState<string>(getDefaultAccountColor('checking'));
  const [isActive, setIsActive] = useState(true);
  const [sortMode, setSortMode] = useState<AccountSortMode>('name');
  const [openingBalanceDate, setOpeningBalanceDate] = useState<Date>(() => new Date());
  const [showOpeningBalanceDatePicker, setShowOpeningBalanceDatePicker] = useState(false);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [isExportingAccounts, setIsExportingAccounts] = useState(false);

  const orderedAccounts = useMemo(() => {
    const compareNames = (left: Account, right: Account) => left.name.localeCompare(right.name);

    return [...accounts].sort((left, right) => {
      const activeDelta = Number(right.isActive) - Number(left.isActive);
      if (activeDelta !== 0) {
        return activeDelta;
      }

      if (sortMode === 'balance') {
        const balanceDelta = right.balance - left.balance;
        if (balanceDelta !== 0) {
          return balanceDelta;
        }
      }

      if (sortMode === 'newest') {
        const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();
        if (createdAtDelta !== 0) {
          return createdAtDelta;
        }
      }

      return compareNames(left, right);
    });
  }, [accounts, sortMode]);

  const activeAccounts = useMemo(
    () => orderedAccounts.filter((account) => account.isActive),
    [orderedAccounts]
  );

  const { netWorthTotal, liabilitiesTotal, netTotal } = useMemo(() => {
    let netWorth = 0;
    let liabilities = 0;

    for (const account of activeAccounts) {
      if (account.type === 'credit') {
        liabilities += Math.abs(account.balance);
        continue;
      }

      if (account.balance < 0) {
        liabilities += Math.abs(account.balance);
      } else {
        netWorth += account.balance;
      }
    }

    const roundedNetWorth = roundCurrency(netWorth);
    const roundedLiabilities = roundCurrency(liabilities);

    return {
      netWorthTotal: roundedNetWorth,
      liabilitiesTotal: roundedLiabilities,
      netTotal: roundCurrency(roundedNetWorth - roundedLiabilities),
    };
  }, [activeAccounts]);

  const savingsAccounts = useMemo(
    () => activeAccounts.filter((account) => account.type === 'savings'),
    [activeAccounts]
  );

  const activeAccountIds = useMemo(
    () => new Set(activeAccounts.map((account) => account.id)),
    [activeAccounts]
  );

  const netWorthChangeToday = useMemo(() => {
    const today = startOfDay(new Date());
    const change = transactions.reduce((sum, transaction) => {
      if (transaction.date < today) {
        return sum;
      }
      return sum + computeTransactionNetWorthImpact(transaction, activeAccountIds);
    }, 0);
    return roundCurrency(change);
  }, [activeAccountIds, transactions]);

  const netWorthChangeMonth = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const change = transactions.reduce((sum, transaction) => {
      if (transaction.date < monthStart) {
        return sum;
      }
      return sum + computeTransactionNetWorthImpact(transaction, activeAccountIds);
    }, 0);
    return roundCurrency(change);
  }, [activeAccountIds, transactions]);
  const savingsReserveTotal = useMemo(
    () => roundCurrency(savingsAccounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0)),
    [savingsAccounts]
  );

  const hiddenAccountsCount = orderedAccounts.length - activeAccounts.length;

  const heroGradientColors = useMemo<readonly [string, string, string]>(
    () =>
      theme.isDark
        ? ['#0F172A', withAlphaColor(theme.colors.primary, '40'), '#111827']
        : ['#FFFFFF', withAlphaColor(theme.colors.primary, '12'), '#EFF6FF'],
    [theme.colors.primary, theme.isDark]
  );

  const groupedAccounts = useMemo(() => {
    const usedTypes = new Set<Account['type']>();
    const groups = ACCOUNT_GROUPS.map((group) => {
      const accountsForGroup = orderedAccounts.filter((account) => group.types.includes(account.type));
      group.types.forEach((type) => usedTypes.add(type));
      const total = roundCurrency(accountsForGroup.reduce((sum, account) => sum + account.balance, 0));
      return { ...group, accounts: accountsForGroup, total };
    });

    const otherAccounts = orderedAccounts.filter((account) => !usedTypes.has(account.type));
    if (otherAccounts.length > 0) {
      const total = roundCurrency(otherAccounts.reduce((sum, account) => sum + account.balance, 0));
      groups.push({ key: 'other', label: 'Other', types: [], accounts: otherAccounts, total });
    }

    return groups.filter((group) => group.accounts.length > 0);
  }, [orderedAccounts]);

  const resetForm = () => {
    setName('');
    setType('checking');
    setBalance('0');
    setColor(getDefaultAccountColor('checking'));
    setIsActive(true);
    setOpeningBalanceDate(new Date());
    setShowOpeningBalanceDatePicker(false);
    setEditing(null);
    setShowModal(false);
  };

  const openCreateAccount = (initialType: Account['type'] = 'checking') => {
    setEditing(null);
    setName('');
    setType(initialType);
    setBalance('0');
    setColor(getDefaultAccountColor(initialType));
    setIsActive(true);
    setOpeningBalanceDate(new Date());
    setShowOpeningBalanceDatePicker(false);
    setShowModal(true);
  };

  useEffect(() => {
    if (!openAccountComposerAt) {
      return;
    }

    openCreateAccount();
    consumeAccountsComposer();
  }, [consumeAccountsComposer, openAccountComposerAt]);

  const openEdit = (account: Account) => {
    setEditing(account);
    setName(account.name);
    setType(account.type);
    setBalance(String(account.balance));
    setColor(account.color ?? getDefaultAccountColor(account.type));
    setIsActive(account.isActive);
    setOpeningBalanceDate(new Date(account.createdAt));
    setShowOpeningBalanceDatePicker(false);
    setShowModal(true);
  };

  const saveAccount = () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Account name is required.');
      return;
    }

    if (editing) {
      updateAccount({
        ...editing,
        name: name.trim(),
        type,
        color: color || getDefaultAccountColor(type),
        icon: editing.icon,
        isActive,
      });
      resetForm();
      return;
    }

    const parsed = Number(balance);
    if (!Number.isFinite(parsed)) {
      Alert.alert('Validation', 'Please enter a valid opening balance.');
      return;
    }

    addAccount({
      name: name.trim(),
      type,
      balance: parsed,
      currency: settings.currency || 'ZMW',
      color: color || getDefaultAccountColor(type),
      icon: type,
      isActive,
      initialBalanceDate: openingBalanceDate,
    });
    resetForm();
  };

  const handleExportAccountsCsv = async () => {
    if (isExportingAccounts || orderedAccounts.length === 0) {
      return;
    }

    setIsExportingAccounts(true);

    try {
      const csvContent = exportAccountsToCsv(orderedAccounts);
      const fileName = `money-manager-accounts-${formatFileTimestamp(new Date())}.csv`;
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      let exportUri: string | null = null;

      if (baseDir) {
        exportUri = `${baseDir}${fileName}`;
        await FileSystem.writeAsStringAsync(exportUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permission.granted && permission.directoryUri) {
          const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permission.directoryUri,
            fileName,
            'text/csv'
          );
          await FileSystem.writeAsStringAsync(destinationUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          Alert.alert('Accounts saved', 'Your accounts were exported as a CSV file.');
          return;
        }
      }

      if (!exportUri) {
        throw new Error('CSV export is not available on this device.');
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is not available on this device.');
      }

      await Sharing.shareAsync(exportUri, {
        dialogTitle: 'Export accounts CSV',
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
      Alert.alert('Accounts ready', 'Your accounts CSV is ready to save or share.');
    } catch (error) {
      console.error('Failed to export accounts CSV:', error);
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Unable to export accounts right now. Please try again.'
      );
    } finally {
      setIsExportingAccounts(false);
    }
  };

  const removeAccount = (accountId: string, accountName: string) => {
    Alert.alert('Delete account', `Delete ${accountName} and every related transaction?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteAccount(accountId),
      },
    ]);
  };

  const accountNameById = useMemo(
    () => new Map(orderedAccounts.map((account) => [account.id, account.name])),
    [orderedAccounts]
  );

  const accountActivityById = useMemo(() => {
    const map = new Map<string, AccountActivitySummary>();

    const ensureSummary = (accountId: string): AccountActivitySummary => {
      const existing = map.get(accountId);
      if (existing) {
        return existing;
      }

      const next: AccountActivitySummary = {
        income: 0,
        expenses: 0,
        transfersIn: 0,
        transfersOut: 0,
        transactions: [],
      };
      map.set(accountId, next);
      return next;
    };

    for (const transaction of transactions) {
      const fromAccountId = transaction.fromAccountId ?? transaction.fromAccount;
      const toAccountId = transaction.toAccountId ?? transaction.toAccount;

      if (transaction.type === 'income' && toAccountId) {
        const summary = ensureSummary(toAccountId);
        summary.income += transaction.amount;
        summary.transactions.push({ transaction, direction: 'incoming' });
        continue;
      }

      if (transaction.type === 'expense' && fromAccountId) {
        const summary = ensureSummary(fromAccountId);
        summary.expenses += transaction.amount;
        summary.transactions.push({ transaction, direction: 'outgoing' });
        continue;
      }

      if (transaction.type === 'transfer') {
        if (fromAccountId) {
          const summary = ensureSummary(fromAccountId);
          summary.transfersOut += transaction.amount;
          summary.transactions.push({ transaction, direction: 'outgoing' });
        }

        if (toAccountId) {
          const summary = ensureSummary(toAccountId);
          summary.transfersIn += transaction.amount;
          summary.transactions.push({ transaction, direction: 'incoming' });
        }
      }
    }

    for (const summary of map.values()) {
      summary.transactions.sort(
        (left, right) => right.transaction.date.getTime() - left.transaction.date.getTime()
      );
    }

    return map;
  }, [transactions]);

  const getAccountFlow = (accountId: string): AccountActivitySummary => {
    return accountActivityById.get(accountId) ?? EMPTY_ACCOUNT_ACTIVITY;
  };

  const detailFlow = detailAccount ? getAccountFlow(detailAccount.id) : EMPTY_ACCOUNT_ACTIVITY;
  const detailNetTransfers = detailFlow.transfersIn - detailFlow.transfersOut;
  const detailTypeMeta = detailAccount
    ? ACCOUNT_TYPE_OPTIONS.find((entry) => entry.type === detailAccount.type)
    : undefined;

  const formatTimestamp = (date: Date) => {
    const safeDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(safeDate.getTime())) {
      return '';
    }

    return formatDateTimeWithWeekday(safeDate);
  };

  const getActivityTitle = (accountId: string, entry: AccountActivityEntry) => {
    if (entry.transaction.type !== 'transfer') {
      return entry.transaction.description.trim() || entry.transaction.category.name;
    }

    const fromAccountId = entry.transaction.fromAccountId ?? entry.transaction.fromAccount;
    const toAccountId = entry.transaction.toAccountId ?? entry.transaction.toAccount;
    const otherAccountId = accountId === fromAccountId ? toAccountId : fromAccountId;
    const otherAccountName = otherAccountId
      ? accountNameById.get(otherAccountId) ?? 'Unknown account'
      : 'Unknown account';

    return accountId === fromAccountId
      ? `Transfer to ${otherAccountName}`
      : `Transfer from ${otherAccountName}`;
  };

  const getActivityAmountColor = (entry: AccountActivityEntry) => {
    if (entry.transaction.type === 'income') {
      return theme.colors.success;
    }

    if (entry.transaction.type === 'expense') {
      return theme.colors.error;
    }

    return entry.direction === 'incoming' ? theme.colors.success : theme.colors.warning;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={heroGradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.summaryCard, { borderColor: theme.colors.border }]}
      >
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroEyebrow, { color: theme.isDark ? '#BFDBFE' : theme.colors.primary }]}>Portfolio</Text>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Accounts</Text>
            <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>Monitor balances, liabilities, and cash position from one place.</Text>
          </View>
          <View
            style={[
              styles.heroBadge,
              {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFFCC',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Shield size={14} color={theme.colors.primary} />
            <Text style={[styles.heroBadgeText, { color: theme.colors.text }]}>{activeAccounts.length} active</Text>
          </View>
        </View>

        <AdaptiveAmountText style={[styles.heroValue, { color: theme.colors.text }]} minFontSize={20} value={formatCurrency(netTotal)} />
        <Text style={[styles.heroValueMeta, { color: theme.colors.textSecondary }]}>Total portfolio value</Text>

        <View style={styles.summaryHighlightsGrid}>
          <View
            style={[
              styles.summaryHighlightCard,
              {
                backgroundColor: theme.isDark ? 'rgba(15,23,42,0.38)' : '#FFFFFFCC',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryHighlightLabel, { color: theme.colors.textSecondary }]}>Assets</Text>
            <AdaptiveAmountText style={[styles.summaryHighlightValue, { color: theme.colors.text }]} minFontSize={14} value={formatCurrency(netWorthTotal)} />
            <Text style={[styles.summaryHighlightSub, { color: theme.colors.textSecondary }]}>{activeAccounts.length} tracked account{activeAccounts.length === 1 ? '' : 's'}</Text>
          </View>
          <View
            style={[
              styles.summaryHighlightCard,
              {
                backgroundColor: theme.isDark ? 'rgba(15,23,42,0.38)' : '#FFFFFFCC',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryHighlightLabel, { color: theme.colors.textSecondary }]}>Liabilities</Text>
            <AdaptiveAmountText style={[styles.summaryHighlightValue, { color: theme.colors.error }]} minFontSize={14} value={formatCurrency(liabilitiesTotal)} />
            <Text style={[styles.summaryHighlightSub, { color: theme.colors.textSecondary }]}>Credit and negative balances</Text>
          </View>
          <View
            style={[
              styles.summaryHighlightCard,
              {
                backgroundColor: theme.isDark ? 'rgba(15,23,42,0.38)' : '#FFFFFFCC',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryHighlightLabel, { color: theme.colors.textSecondary }]}>Today</Text>
                          <AdaptiveAmountText
                style={[
                  styles.summaryHighlightValue,
                  { color: netWorthChangeToday >= 0 ? theme.colors.success : theme.colors.error },
                ]}
                minFontSize={14}
                value={formatSignedCurrency(formatCurrency, netWorthChangeToday)}
              />
            <Text style={[styles.summaryHighlightSub, { color: theme.colors.textSecondary }]}>Portfolio movement</Text>
          </View>
          <View
            style={[
              styles.summaryHighlightCard,
              {
                backgroundColor: theme.isDark ? 'rgba(15,23,42,0.38)' : '#FFFFFFCC',
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryHighlightLabel, { color: theme.colors.textSecondary }]}>This Month</Text>
                          <AdaptiveAmountText
                style={[
                  styles.summaryHighlightValue,
                  { color: netWorthChangeMonth >= 0 ? theme.colors.success : theme.colors.error },
                ]}
                minFontSize={14}
                value={formatSignedCurrency(formatCurrency, netWorthChangeMonth)}
              />
            <Text style={[styles.summaryHighlightSub, { color: theme.colors.textSecondary }]}>Month-to-date change</Text>
          </View>
        </View>

        <View style={[styles.summaryFooterRow, { borderTopColor: theme.colors.border }]}> 
          <View style={styles.summaryFooterBlock}>
            <Text style={[styles.summaryFooterLabel, { color: theme.colors.textSecondary }]}>Lifetime net cash flow</Text>
                        <AdaptiveAmountText
              style={[
                styles.summaryFooterValue,
                { color: lifetimeNetCashFlow >= 0 ? theme.colors.success : theme.colors.error },
              ]}
              minFontSize={12}
              value={formatSignedCurrency(formatCurrency, lifetimeNetCashFlow)}
            />
          </View>
          <View style={styles.summaryFooterBlock}>
            <Text style={[styles.summaryFooterLabel, { color: theme.colors.textSecondary }]}>Savings reserve</Text>
            <AdaptiveAmountText style={[styles.summaryFooterValue, { color: theme.colors.text }]} minFontSize={12} value={formatCurrency(savingsReserveTotal)} />
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.actionPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.actionPanelEyebrow, { color: theme.colors.primary }]}>Manage</Text>
        <Text style={[styles.actionPanelTitle, { color: theme.colors.text }]}>Create and export accounts</Text>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]} onPress={() => openCreateAccount()}>
            <Plus size={18} color="white" />
            <View style={styles.actionButtonTextWrap}>
              <Text style={styles.primaryButtonText}>Add Account</Text>
              <Text style={styles.primaryButtonSubtext}>Checking, cash, credit, or investment</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC',
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => openCreateAccount('savings')}
          >
            <PiggyBank size={18} color="#16A34A" />
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Add Savings</Text>
              <Text style={[styles.secondaryButtonSubtext, { color: theme.colors.textSecondary }]}>Emergency and goal accounts</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Export accounts as CSV"
          activeOpacity={0.85}
          style={[
            styles.exportButton,
            {
              backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC',
              borderColor: theme.colors.border,
              opacity: isExportingAccounts || orderedAccounts.length === 0 ? 0.62 : 1,
            },
          ]}
          onPress={handleExportAccountsCsv}
          disabled={isExportingAccounts || orderedAccounts.length === 0}
        >
          <Download
            size={18}
            color={
              isExportingAccounts || orderedAccounts.length === 0
                ? theme.colors.textSecondary
                : theme.colors.primary
            }
          />
          <View style={styles.actionButtonTextWrap}>
            <Text style={[styles.exportButtonText, { color: theme.colors.text }]}>
              {isExportingAccounts ? 'Preparing CSV...' : 'Export Accounts CSV'}
            </Text>
            <Text style={[styles.exportButtonSubtext, { color: theme.colors.textSecondary }]}>
              {orderedAccounts.length === 0
                ? 'Add at least one account before exporting.'
                : 'Download or share your account list as a CSV file.'}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.actionNote, { color: theme.colors.textSecondary }]}> 
          {hiddenAccountsCount > 0
            ? `${hiddenAccountsCount} account${hiddenAccountsCount === 1 ? '' : 's'} hidden from totals.`
            : 'All accounts are currently included in totals.'}
        </Text>
      </View>

      {orderedAccounts.length > 0 ? (
        <View style={[styles.sortPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.sortPanelHeader}>
            <Text style={[styles.sortPanelTitle, { color: theme.colors.text }]}>Sort Accounts</Text>
            <Text style={[styles.sortPanelMeta, { color: theme.colors.textSecondary }]}>Active accounts stay first</Text>
          </View>
          <View style={styles.sortChipsRow}>
            {ACCOUNT_SORT_OPTIONS.map((option) => {
              const isSelected = sortMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.85}
                  onPress={() => setSortMode(option.key)}
                  style={[
                    styles.sortChip,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primary
                        : theme.isDark
                          ? theme.colors.background
                          : '#FFFFFF',
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {orderedAccounts.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={[styles.emptyStateIconWrap, { backgroundColor: withAlphaColor(theme.colors.primary, theme.isDark ? '22' : '12') }]}> 
            <PiggyBank size={30} color={theme.colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No accounts yet</Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Create a checking, savings, credit, investment, or cash account to start tracking your full portfolio.</Text>
        </View>
      ) : (
        <View style={styles.groupList}>
          {groupedAccounts.map((group) => (
            <View key={group.key} style={[styles.groupPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <View style={styles.groupPanelHeader}>
                <View style={styles.groupPanelCopy}>
                  <Text style={[styles.groupPanelEyebrow, { color: theme.colors.textSecondary }]}>{group.label}</Text>
                  <Text style={[styles.groupPanelTitle, { color: theme.colors.text }]}>
                    {group.accounts.length} account{group.accounts.length === 1 ? '' : 's'}
                  </Text>
                  <Text style={[styles.groupPanelMeta, { color: theme.colors.textSecondary }]}>
                    {group.accounts.some((account) => !account.isActive)
                      ? `${group.accounts.filter((account) => !account.isActive).length} hidden from totals`
                      : 'All accounts visible in totals'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.groupPanelTotalWrap,
                    {
                      backgroundColor: theme.isDark ? theme.colors.background : '#FFFFFF',
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.groupPanelTotalLabel, { color: theme.colors.textSecondary }]}>Group total</Text>
                                    <AdaptiveAmountText
                    style={[
                      styles.groupPanelTotalValue,
                      { color: group.total < 0 ? theme.colors.error : theme.colors.text },
                    ]}
                    minFontSize={12}
                    value={formatCurrency(group.total)}
                  />
                </View>
              </View>

              <View style={styles.accountStack}>
                {group.accounts.map((account) => {
                  const flow = getAccountFlow(account.id);
                  const typeMeta = ACCOUNT_TYPE_OPTIONS.find((entry) => entry.type === account.type);
                  const TypeIcon = typeMeta?.icon ?? Wallet;
                  const accentColor = account.color ?? getDefaultAccountColor(account.type);
                  const transferNet = roundCurrency(flow.transfersIn - flow.transfersOut);
                  const inflowTotal = roundCurrency(flow.income + flow.transfersIn);
                  const outflowTotal = roundCurrency(flow.expenses + flow.transfersOut);

                  return (
                    <TouchableOpacity
                      key={account.id}
                      activeOpacity={0.92}
                      onPress={() => setDetailAccount(account)}
                      style={[
                        styles.card,
                        {
                          backgroundColor: theme.isDark ? theme.colors.background : '#FFFFFF',
                          borderColor: theme.colors.border,
                        },
                        !account.isActive && styles.cardMuted,
                      ]}
                    >
                      <View style={[styles.accountAccentBar, { backgroundColor: accentColor }]} />
                      <View style={styles.accountCardBody}>
                        <View style={styles.accountCardTop}>
                          <View style={styles.accountIdentity}>
                            <View
                              style={[
                                styles.accountBadge,
                                {
                                  backgroundColor: withAlphaColor(accentColor, theme.isDark ? '24' : '16'),
                                  borderColor: withAlphaColor(accentColor, '44'),
                                },
                              ]}
                            >
                              <TypeIcon size={18} color={accentColor} />
                            </View>
                            <View style={styles.accountMeta}>
                              <Text style={[styles.name, { color: theme.colors.text }]}>{account.name}</Text>
                              <Text style={[styles.accountDescription, { color: theme.colors.textSecondary }]}> 
                                {typeMeta?.description ?? 'Track this account balance over time.'}
                              </Text>
                              <View style={styles.accountTagRow}>
                                <View
                                  style={[
                                    styles.accountTypeChip,
                                    { backgroundColor: withAlphaColor(accentColor, theme.isDark ? '22' : '12') },
                                  ]}
                                >
                                  <Text style={[styles.accountTypeChipText, { color: accentColor }]}>
                                    {typeMeta?.label ?? account.type}
                                  </Text>
                                </View>
                                {!account.isActive ? (
                                  <View style={[styles.hiddenPill, { backgroundColor: theme.colors.border }]}> 
                                    <Text style={[styles.hiddenPillText, { color: theme.colors.textSecondary }]}>Hidden</Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>

                          <View style={styles.actions}>
                            <TouchableOpacity
                              style={[
                                styles.iconButtonSurface,
                                {
                                  backgroundColor: theme.isDark ? theme.colors.surface : '#F8FAFC',
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              onPress={(event) => {
                                event.stopPropagation?.();
                                openEdit(account);
                              }}
                            >
                              <Pencil size={16} color={theme.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.iconButtonSurface,
                                {
                                  backgroundColor: theme.isDark ? theme.colors.surface : '#F8FAFC',
                                  borderColor: theme.colors.border,
                                },
                              ]}
                              onPress={(event) => {
                                event.stopPropagation?.();
                                removeAccount(account.id, account.name);
                              }}
                            >
                              <Trash2 size={16} color={theme.colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.accountBalanceRow}>
                          <Text style={[styles.accountBalanceLabel, { color: theme.colors.textSecondary }]}>Available balance</Text>
                                                    <AdaptiveAmountText
                            style={[
                              styles.balance,
                              { color: account.balance < 0 ? theme.colors.error : theme.colors.text },
                            ]}
                            minFontSize={18}
                            value={formatCurrency(account.balance)}
                          />
                        </View>

                        <View style={styles.accountStatsRow}>
                          <View
                            style={[
                              styles.accountStatChip,
                              {
                                backgroundColor: theme.isDark ? theme.colors.surface : '#F8FAFC',
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            <Text style={[styles.accountStatLabel, { color: theme.colors.textSecondary }]}>Received</Text>
                            <AdaptiveAmountText style={[styles.accountStatValue, { color: theme.colors.success }]} minFontSize={10} value={formatCurrency(inflowTotal)} />
                          </View>
                          <View
                            style={[
                              styles.accountStatChip,
                              {
                                backgroundColor: theme.isDark ? theme.colors.surface : '#F8FAFC',
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            <Text style={[styles.accountStatLabel, { color: theme.colors.textSecondary }]}>Spent</Text>
                            <AdaptiveAmountText style={[styles.accountStatValue, { color: theme.colors.error }]} minFontSize={10} value={formatCurrency(outflowTotal)} />
                          </View>
                          <View
                            style={[
                              styles.accountStatChip,
                              {
                                backgroundColor: theme.isDark ? theme.colors.surface : '#F8FAFC',
                                borderColor: theme.colors.border,
                              },
                            ]}
                          >
                            <Text style={[styles.accountStatLabel, { color: theme.colors.textSecondary }]}>Net transfers</Text>
                                                        <AdaptiveAmountText
                              style={[
                                styles.accountStatValue,
                                { color: transferNet >= 0 ? theme.colors.success : theme.colors.warning },
                              ]}
                              minFontSize={10}
                              value={formatSignedCurrency(formatCurrency, transferNet)}
                            />
                          </View>
                        </View>

                        <View style={[styles.accountFooterRow, { borderTopColor: theme.colors.border }]}> 
                          <Text style={[styles.accountFooterText, { color: theme.colors.textSecondary }]}>
                            {account.isActive ? 'Included in portfolio totals' : 'Hidden from portfolio totals'}
                          </Text>
                          <View style={styles.accountFooterLink}>
                            <Text style={[styles.accountFooterLinkText, { color: accentColor }]}>Open details</Text>
                            <ChevronRight size={14} color={accentColor} />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
      <Modal
        visible={!!detailAccount}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailAccount(null)}
      >
        <View style={[styles.detailModal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={() => setDetailAccount(null)}>
              <Text style={[styles.modalButton, { color: theme.colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Account Details</Text>
            {detailAccount ? (
              <TouchableOpacity
                onPress={() => {
                  setDetailAccount(null);
                  openEdit(detailAccount);
                }}
              >
                <Text style={[styles.modalButton, { color: theme.colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.modalSpacer} />
            )}
          </View>

          {detailAccount ? (
            <FlatList
              data={detailFlow.transactions}
              keyExtractor={(entry) => `${detailAccount.id}-${entry.transaction.id}-${entry.direction}`}
              contentContainerStyle={styles.detailContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View>
                  <View
                    style={[
                      styles.detailCard,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    ]}
                  >
                    <Text style={[styles.detailName, { color: theme.colors.text }]}>{detailAccount.name}</Text>
                    <Text style={[styles.detailType, { color: theme.colors.textSecondary }]}>
                      {detailTypeMeta?.label ?? detailAccount.type}
                    </Text>
                                        <AdaptiveAmountText
                      style={[styles.detailBalance, { color: theme.colors.text }]}
                      minFontSize={18}
                      value={formatCurrency(detailAccount.balance)}
                    />
                    <View style={styles.detailStatsRow}>
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                                                <AdaptiveAmountText
                          style={[styles.detailStatValue, { color: theme.colors.success }]}
                          minFontSize={11}
                          value={'+'.concat(formatCurrency(detailFlow.income))}
                        />
                      </View>
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatLabel, { color: theme.colors.textSecondary }]}>Expense</Text>
                                                <AdaptiveAmountText
                          style={[styles.detailStatValue, { color: theme.colors.error }]}
                          minFontSize={11}
                          value={'-'.concat(formatCurrency(detailFlow.expenses))}
                        />
                      </View>
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatLabel, { color: theme.colors.textSecondary }]}>Net transfers</Text>
                                                <AdaptiveAmountText
                          style={[
                            styles.detailStatValue,
                            { color: detailNetTransfers >= 0 ? theme.colors.success : theme.colors.warning },
                          ]}
                          minFontSize={11}
                          value={formatSignedCurrency(formatCurrency, detailNetTransfers)}
                        />
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.detailSectionTitle, { color: theme.colors.textSecondary }]}>Transactions</Text>
                </View>
              }
              ListEmptyComponent={
                <View style={[styles.emptyState, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No activity yet</Text>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    Start adding transactions to see activity for this account.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.detailActivityCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={styles.activityRow}>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityName, { color: theme.colors.text }]}>
                        {getActivityTitle(detailAccount.id, item)}
                      </Text>
                      <Text style={[styles.activityMeta, { color: theme.colors.textSecondary }]}>
                        {item.transaction.category.name} - {formatTimestamp(item.transaction.date)}
                      </Text>
                    </View>
                                        <AdaptiveAmountText
                      style={[styles.activityAmount, { color: getActivityAmountColor(item) }]}
                      minFontSize={11}
                      value={(item.direction === 'incoming' ? '+' : '-').concat(formatCurrency(item.transaction.amount))}
                    />
                  </View>
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <View style={[styles.modal, { backgroundColor: theme.colors.background }]}> 
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={resetForm}>
              <Text style={[styles.modalButton, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}> 
              {editing ? 'Edit Account' : 'New Account'}
            </Text>
            <TouchableOpacity onPress={saveAccount}>
              <Text style={[styles.modalButton, { color: theme.colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Account Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Account name"
            placeholderTextColor={theme.colors.textSecondary}
          />

          {!editing ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Opening Balance</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={balance}
                onChangeText={setBalance}
                placeholder="Opening balance"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Opening Balance Date</Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.dateFieldButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: showOpeningBalanceDatePicker ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={() => setShowOpeningBalanceDatePicker((current) => !current)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dateFieldValue, { color: theme.colors.text }]}>
                  {formatDateWithWeekday(openingBalanceDate)}
                </Text>
              </TouchableOpacity>
              {showOpeningBalanceDatePicker ? (
                <DateTimePicker
                  value={openingBalanceDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, selectedDate) => {
                    if (Platform.OS === 'android') {
                      setShowOpeningBalanceDatePicker(false);
                    }

                    if (selectedDate) {
                      setOpeningBalanceDate((current) => mergeDateWithExistingTime(selectedDate, current));
                    }
                  }}
                />
              ) : null}
              <Text style={[styles.formHint, { color: theme.colors.textSecondary }]}>The opening balance will be recorded on this date and used only once when the account is created.</Text>
            </>
          ) : (
            <View style={[styles.infoBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
              <Text style={[styles.infoBannerText, { color: theme.colors.textSecondary }]}>Current balance is ledger-derived. Edit the account details here, then use transactions or transfers to change the balance.</Text>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Account Type</Text>
          <View style={styles.typeGrid}>
            {ACCOUNT_TYPE_OPTIONS.map((entry) => {
              const Icon = entry.icon;
              const isSelected = type === entry.type;
              return (
                <TouchableOpacity
                  key={entry.type}
                  style={[
                    styles.typeCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => setType(entry.type)}
                >
                  <View style={[styles.typeIconWrap, { backgroundColor: isSelected ? theme.colors.primary + '18' : theme.colors.background }]}> 
                    <Icon size={18} color={isSelected ? theme.colors.primary : theme.colors.textSecondary} />
                  </View>
                  <Text style={[styles.typeCardTitle, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>{entry.label}</Text>
                  <Text style={[styles.typeCardDescription, { color: theme.colors.textSecondary }]}>{entry.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Account Color</Text>
          <View style={styles.colorRow}>
            {ACCOUNT_COLOR_OPTIONS.map((option) => {
              const selected = color === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setColor(option)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: option, borderColor: selected ? theme.colors.primary : 'transparent' },
                  ]}
                >
                  {selected ? <View style={styles.colorSwatchInner} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.formHint, { color: theme.colors.textSecondary }]}>Choose a color to spot this account quickly.</Text>

          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Visibility</Text>
          <View style={[styles.visibilityRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.visibilityText}>
              <Text style={[styles.visibilityTitle, { color: theme.colors.text }]}>Include in net worth</Text>
              <Text style={[styles.visibilityHint, { color: theme.colors.textSecondary }]}>
                Toggle off to hide this account from totals and dashboard.
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor={'#ffffff'}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 28 },
  summaryCard: {
    margin: 16,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 280,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '900',
    marginTop: 18,
  },
  heroValueMeta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  summaryHighlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  summaryHighlightCard: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  summaryHighlightLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryHighlightValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  summaryHighlightSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  summaryFooterRow: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
  },
  summaryFooterBlock: {
    flex: 1,
  },
  summaryFooterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryFooterValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  actionPanel: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  actionPanelEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  actionPanelTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButtonSubtext: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButtonSubtext: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  exportButton: {
    marginTop: 12,
    borderRadius: 18,
    padding: 14,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  exportButtonSubtext: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  actionButtonTextWrap: {
    flex: 1,
  },
  actionNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  sortPanel: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  sortPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sortPanelTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sortPanelMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  sortChip: {
    minWidth: 82,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    margin: 16,
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyStateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
  groupList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 16,
  },
  groupPanel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  groupPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  groupPanelCopy: {
    flex: 1,
  },
  groupPanelEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  groupPanelTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  groupPanelMeta: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  groupPanelTotalWrap: {
    minWidth: 108,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  groupPanelTotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  groupPanelTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  accountStack: {
    gap: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardMuted: {
    opacity: 0.72,
  },
  accountAccentBar: {
    height: 4,
    width: '100%',
  },
  accountCardBody: {
    padding: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountIdentity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  accountBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  accountMeta: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
  },
  accountDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  accountTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  accountTypeChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  accountTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hiddenPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  hiddenPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  iconButtonSurface: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  accountBalanceRow: {
    marginTop: 18,
  },
  accountBalanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  accountStatChip: {
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    minWidth: 90,
  },
  accountStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  accountStatValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  accountFooterRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountFooterText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  accountFooterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accountFooterLinkText: {
    fontSize: 12,
    fontWeight: '800',
  },
  activitySection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  activityTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 13,
    fontWeight: '600',
  },
  activityMeta: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailModal: { flex: 1, padding: 16 },
  detailContent: { paddingBottom: 24 },
  detailCard: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 16 },
  detailName: { fontSize: 20, fontWeight: '700' },
  detailType: { fontSize: 12, textTransform: 'capitalize', marginTop: 4 },
  detailBalance: { fontSize: 28, fontWeight: '800', marginTop: 12, marginBottom: 12 },
  detailStatsRow: { flexDirection: 'row', gap: 12 },
  detailStat: { flex: 1 },
  detailStatLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  detailStatValue: { fontSize: 14, fontWeight: '700' },
  detailSectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  detailActivityCard: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 10 },
  modalSpacer: { width: 60 },

  modal: { flex: 1, padding: 16 },
  modalButton: { fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  dateFieldButton: {
    justifyContent: 'center',
  },
  dateFieldValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  formHint: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  visibilityText: {
    flex: 1,
    marginRight: 12,
  },
  visibilityTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  visibilityHint: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  infoBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
  },
  infoBannerText: {
    fontSize: 13,
    lineHeight: 19,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  typeCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  typeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  typeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  typeCardDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
});
































