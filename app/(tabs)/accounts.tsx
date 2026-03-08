import React, { useMemo, useState } from 'react';
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
import { Plus, PiggyBank, Pencil, Trash2, Wallet, CreditCard, TrendingUp, Landmark } from 'lucide-react-native';
import { Account, Transaction } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

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
    netBalance,
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

  const orderedAccounts = useMemo(
    () => [...accounts].sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name)),
    [accounts]
  );

  const activeAccounts = useMemo(
    () => orderedAccounts.filter((account) => account.isActive),
    [orderedAccounts]
  );

  const savingsAccounts = useMemo(
    () => activeAccounts.filter((account) => account.type === 'savings'),
    [activeAccounts]
  );

  const resetForm = () => {
    setName('');
    setType('checking');
    setBalance('0');
    setEditing(null);
    setShowModal(false);
  };

  const openCreateAccount = (initialType: Account['type'] = 'checking') => {
    setEditing(null);
    setName('');
    setType(initialType);
    setBalance('0');
    setShowModal(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setName(account.name);
    setType(account.type);
    setBalance(String(account.balance));
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
        color: editing.color,
        icon: editing.icon,
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
      color: type === 'savings' ? '#16A34A' : '#667eea',
      icon: type,
      isActive: true,
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

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
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
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Net Balance</Text>
        <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{formatCurrency(netBalance)}</Text>
        <Text style={[styles.summaryMeta, { color: theme.colors.textSecondary }]}>
          Lifetime Net Cash Flow {lifetimeNetCashFlow > 0 ? '+' : lifetimeNetCashFlow < 0 ? '-' : ''}{formatCurrency(Math.abs(lifetimeNetCashFlow))}
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
          {orderedAccounts.map((account) => {
            const flow = getAccountFlow(account.id);
            const activity = flow.transactions;
            const typeMeta = ACCOUNT_TYPE_OPTIONS.find((entry) => entry.type === account.type);
            const TypeIcon = typeMeta?.icon ?? Wallet;

            return (
              <View
                key={account.id}
                style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <View style={styles.rowBetween}>
                  <View style={styles.accountIdentity}>
                    <View style={[styles.accountBadge, { backgroundColor: account.type === 'savings' ? '#DCFCE7' : theme.colors.background }]}> 
                      <TypeIcon size={18} color={account.type === 'savings' ? '#16A34A' : theme.colors.primary} />
                    </View>
                    <View style={styles.accountMeta}>
                      <Text style={[styles.name, { color: theme.colors.text }]}>{account.name}</Text>
                      <Text style={[styles.type, { color: theme.colors.textSecondary }]}>
                        {typeMeta?.label ?? account.type}
                      </Text>
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
                <View style={styles.flowRow}>
                  <Text style={[styles.flowText, { color: theme.colors.success }]}>Transfers in {formatCurrency(flow.transfersIn)}</Text>
                  <Text style={[styles.flowText, { color: theme.colors.warning }]}>Transfers out {formatCurrency(flow.transfersOut)}</Text>
                </View>

                {activity.length > 0 && (
                  <View style={[styles.activitySection, { borderTopColor: theme.colors.border }]}>
                    <Text style={[styles.activityTitle, { color: theme.colors.textSecondary }]}>Transactions</Text>
                    {activity.map((entry, index) => (
                      <View
                        key={`${account.id}-${entry.transaction.id}-${entry.direction}`}
                        style={[
                          styles.activityRow,
                          index > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: theme.colors.border,
                          },
                        ]}
                      >
                        <View style={styles.activityInfo}>
                          <Text style={[styles.activityName, { color: theme.colors.text }]}>
                            {getActivityTitle(account.id, entry)}
                          </Text>
                          <Text style={[styles.activityMeta, { color: theme.colors.textSecondary }]}>
                            {entry.transaction.category.name} - {formatTimestamp(entry.transaction.date)}
                          </Text>
                        </View>
                        <Text style={[styles.activityAmount, { color: getActivityAmountColor(entry) }]}>
                          {entry.direction === 'incoming' ? '+' : '-'}{formatCurrency(entry.transaction.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

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
  summaryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { fontSize: 30, fontWeight: '800', marginTop: 4 },
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
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
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
  type: { fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
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











