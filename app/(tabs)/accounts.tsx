import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { Plus, PiggyBank, Pencil, Trash2, Wallet, CreditCard, TrendingUp, Landmark } from 'lucide-react-native';
import { Account, Transaction } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { formatDateDDMMYYYY } from '@/utils/date';

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

function formatSignedCurrency(formatCurrency: (value: number) => string, value: number): string {
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}${formatCurrency(Math.abs(value))}`;
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
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);

  const orderedAccounts = useMemo(
    () => [...accounts].sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name)),
    [accounts]
  );

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
    setShowModal(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setName(account.name);
    setType(account.type);
    setBalance(String(account.balance));
    setColor(account.color ?? getDefaultAccountColor(account.type));
    setIsActive(account.isActive);
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
    });
    resetForm();
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

    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(safeDate);
    return `${formatDateDDMMYYYY(safeDate)} ${time}`;
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
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.summaryMetricsRow}>
          <View style={styles.summaryMetric}>
            <Text style={[styles.summaryMetricLabel, { color: theme.colors.textSecondary }]}>Net Worth</Text>
            <Text style={[styles.summaryMetricValue, { color: theme.colors.primary }]}>
              {formatCurrency(netWorthTotal)}
            </Text>
          </View>
          <View style={styles.summaryMetric}>
            <Text style={[styles.summaryMetricLabel, { color: theme.colors.textSecondary }]}>Liabilities</Text>
            <Text style={[styles.summaryMetricValue, { color: theme.colors.error }]}>
              {formatCurrency(liabilitiesTotal)}
            </Text>
          </View>
          <View style={styles.summaryMetric}>
            <Text style={[styles.summaryMetricLabel, { color: theme.colors.textSecondary }]}>Total</Text>
            <Text style={[styles.summaryMetricValue, { color: theme.colors.text }]}>
              {formatCurrency(netTotal)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryChangeRow}>
          <Text
            style={[
              styles.summaryChange,
              { color: netWorthChangeToday >= 0 ? theme.colors.success : theme.colors.error },
            ]}
          >
            {formatSignedCurrency(formatCurrency, netWorthChangeToday)} today
          </Text>
          <Text
            style={[
              styles.summaryChange,
              { color: netWorthChangeMonth >= 0 ? theme.colors.success : theme.colors.error },
            ]}
          >
            {formatSignedCurrency(formatCurrency, netWorthChangeMonth)} this month
          </Text>
        </View>
        <Text style={[styles.summaryMeta, { color: theme.colors.textSecondary }]}> 
          Total earned - spent {formatSignedCurrency(formatCurrency, lifetimeNetCashFlow)}
        </Text>
        <Text style={[styles.summarySub, { color: theme.colors.textSecondary }]}> 
          {activeAccounts.length} active account{activeAccounts.length === 1 ? '' : 's'}, {savingsAccounts.length} savings account{savingsAccounts.length === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]} onPress={() => openCreateAccount()}>
          <Plus size={18} color="white" />
          <Text style={styles.primaryButtonText}>Add Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: theme.colors.surface, borderColor: '#16A34A' }]}
          onPress={() => openCreateAccount('savings')}
        >
          <PiggyBank size={18} color="#16A34A" />
          <Text style={[styles.secondaryButtonText, { color: '#16A34A' }]}>Add Savings</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Savings can be added here directly. Choose Add Savings or select the Savings type in the account form.</Text>

      {orderedAccounts.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <PiggyBank size={28} color={theme.colors.primary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No accounts yet</Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Create a checking, savings, credit, investment, or cash account to start tracking balances.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {groupedAccounts.map((group) => (
            <View key={group.key} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupTitle, { color: theme.colors.textSecondary }]}>{group.label}</Text>
                <Text style={[styles.groupTotal, { color: theme.colors.textSecondary }]}>{formatCurrency(group.total)}</Text>
              </View>
              {group.accounts.map((account) => {
                const flow = getAccountFlow(account.id);
                const typeMeta = ACCOUNT_TYPE_OPTIONS.find((entry) => entry.type === account.type);
                const TypeIcon = typeMeta?.icon ?? Wallet;
                const accentColor = account.color ?? getDefaultAccountColor(account.type);

                return (
                  <TouchableOpacity
                    key={account.id}
                    activeOpacity={0.9}
                    onPress={() => setDetailAccount(account)}
                    style={[
                      styles.card,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      !account.isActive && styles.cardMuted,
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <View style={styles.accountIdentity}>
                        <View style={[styles.accountBadge, { backgroundColor: withAlphaColor(accentColor, '22') }]}> 
                          <TypeIcon size={18} color={accentColor} />
                        </View>
                        <View style={styles.accountMeta}>
                          <Text style={[styles.name, { color: theme.colors.text }]}>{account.name}</Text>
                          <View style={styles.typeRow}>
                            <Text style={[styles.type, { color: theme.colors.textSecondary }]}>
                              {typeMeta?.label ?? account.type}
                            </Text>
                            {!account.isActive && (
                              <View style={[styles.hiddenPill, { backgroundColor: theme.colors.border }]}>
                                <Text style={[styles.hiddenPillText, { color: theme.colors.textSecondary }]}>Hidden</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.iconButton} onPress={() => openEdit(account)}>
                          <Pencil size={16} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconButton} onPress={() => removeAccount(account.id, account.name)}>
                          <Trash2 size={16} color={theme.colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={[styles.balance, { color: theme.colors.text }]}>{formatCurrency(account.balance)}</Text>

                    <View style={styles.flowRow}>
                      <Text style={[styles.flowText, { color: theme.colors.success }]}>Income {formatCurrency(flow.income)}</Text>
                      <Text style={[styles.flowText, { color: theme.colors.error }]}>Expense {formatCurrency(flow.expenses)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
                    <Text style={[styles.detailBalance, { color: theme.colors.text }]}>
                      {formatCurrency(detailAccount.balance)}
                    </Text>
                    <View style={styles.detailStatsRow}>
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                        <Text style={[styles.detailStatValue, { color: theme.colors.success }]}>
                          +{formatCurrency(detailFlow.income)}
                        </Text>
                      </View>
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatLabel, { color: theme.colors.textSecondary }]}>Expense</Text>
                        <Text style={[styles.detailStatValue, { color: theme.colors.error }]}>
                          -{formatCurrency(detailFlow.expenses)}
                        </Text>
                      </View>
                      <View style={styles.detailStat}>
                        <Text style={[styles.detailStatLabel, { color: theme.colors.textSecondary }]}>Net transfers</Text>
                        <Text
                          style={[
                            styles.detailStatValue,
                            { color: detailNetTransfers >= 0 ? theme.colors.success : theme.colors.warning },
                          ]}
                        >
                          {formatSignedCurrency(formatCurrency, detailNetTransfers)}
                        </Text>
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
                    <Text style={[styles.activityAmount, { color: getActivityAmountColor(item) }]}>
                      {item.direction === 'incoming' ? '+' : '-'}{formatCurrency(item.transaction.amount)}
                    </Text>
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
              <Text style={[styles.formHint, { color: theme.colors.textSecondary }]}>This is only used once when the account is created.</Text>
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
  summaryCard: {
    margin: 16,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryMetric: { flex: 1 },
  summaryMetricLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  summaryMetricValue: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  summaryChangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  summaryChange: { fontSize: 12, fontWeight: '700' },
  summaryMeta: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  summarySub: { fontSize: 12, marginTop: 6 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: 'white', fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
  },
  secondaryButtonText: { fontWeight: '700' },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  emptyState: {
    margin: 16,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  groupSection: { marginBottom: 8 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  groupTotal: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  cardMuted: { opacity: 0.7 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  accountBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountMeta: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  type: { fontSize: 12, textTransform: 'capitalize' },
  hiddenPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  hiddenPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actions: { flexDirection: 'row', gap: 12, marginLeft: 12 },
  iconButton: { padding: 4 },
  balance: { fontSize: 24, fontWeight: '800', marginTop: 14, marginBottom: 10 },
  flowRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, gap: 12 },
  flowText: { flex: 1, fontSize: 12, fontWeight: '700' },
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






























