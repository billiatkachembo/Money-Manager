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
import { Plus, Pencil, Trash2 } from 'lucide-react-native';
import { Account } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';

const ACCOUNT_TYPES: Account['type'][] = ['checking', 'savings', 'credit', 'investment', 'cash'];

export default function AccountsScreen() {
  const { theme } = useTheme();
  const {
    accounts,
    transactions,
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

  const totalBalance = useMemo(
    () => accounts.filter((account) => account.isActive).reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  const resetForm = () => {
    setName('');
    setType('checking');
    setBalance('0');
    setEditing(null);
    setShowModal(false);
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

    const parsed = Number(balance);
    if (!Number.isFinite(parsed)) {
      Alert.alert('Validation', 'Please enter a valid starting balance.');
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

    addAccount({
      name: name.trim(),
      type,
      balance: parsed,
      currency: 'USD',
      color: '#667eea',
      icon: '$',
      isActive: true,
    });
    resetForm();
  };

  const removeAccount = (accountId: string) => {
    Alert.alert('Delete account', 'Delete this account and related transactions?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteAccount(accountId),
      },
    ]);
  };

  const getAccountFlow = (accountId: string) => {
    const income = transactions
      .filter((transaction) => transaction.type === 'income')
      .filter((transaction) => (transaction.toAccountId ?? transaction.toAccount) === accountId)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const expenses = transactions
      .filter((transaction) => transaction.type === 'expense')
      .filter((transaction) => (transaction.fromAccountId ?? transaction.fromAccount) === accountId)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const transfersIn = transactions
      .filter((transaction) => transaction.type === 'transfer')
      .filter((transaction) => (transaction.toAccountId ?? transaction.toAccount) === accountId)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const transfersOut = transactions
      .filter((transaction) => transaction.type === 'transfer')
      .filter((transaction) => (transaction.fromAccountId ?? transaction.fromAccount) === accountId)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return { income, expenses, transfersIn, transfersOut };
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}> 
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Net Balance</Text>
        <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{formatCurrency(totalBalance)}</Text>
        <Text style={[styles.summarySub, { color: theme.colors.textSecondary }]}> 
          {accounts.length} accounts (ledger-derived balances)
        </Text>
      </View>

      <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]} onPress={() => setShowModal(true)}>
        <Plus size={18} color="white" />
        <Text style={styles.addButtonText}>Add Account</Text>
      </TouchableOpacity>

      <View style={styles.list}>
        {accounts.map((account) => {
          const flow = getAccountFlow(account.id);
          return (
            <View key={account.id} style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
              <View style={styles.rowBetween}>
                <View>
                  <Text style={[styles.name, { color: theme.colors.text }]}>{account.name}</Text>
                  <Text style={[styles.type, { color: theme.colors.textSecondary }]}>{account.type}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => openEdit(account)}>
                    <Pencil size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeAccount(account.id)}>
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
                <Text style={[styles.flowText, { color: theme.colors.success }]}>In {formatCurrency(flow.transfersIn)}</Text>
                <Text style={[styles.flowText, { color: theme.colors.warning }]}>Out {formatCurrency(flow.transfersOut)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
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

          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Account name"
            placeholderTextColor={theme.colors.textSecondary}
          />

          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={balance}
            onChangeText={setBalance}
            placeholder="Opening balance"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="numeric"
          />

          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((entry) => (
              <TouchableOpacity
                key={entry}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: type === entry ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={() => setType(entry)}
              >
                <Text style={{ color: type === entry ? theme.colors.primary : theme.colors.textSecondary }}>{entry}</Text>
              </TouchableOpacity>
            ))}
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
    borderRadius: 14,
    padding: 16,
  },
  summaryLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  summaryValue: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  summarySub: { fontSize: 12, marginTop: 4 },
  addButton: {
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addButtonText: { color: 'white', fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, padding: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 16, fontWeight: '700' },
  type: { fontSize: 12, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 12 },
  balance: { fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  flowRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  flowText: { fontSize: 12, fontWeight: '600' },
  modal: { flex: 1, padding: 16, gap: 12 },
  modalButton: { fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
