import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Plus } from 'lucide-react-native';
import { Account, AccountTypeDefinition, AccountTypeGroup } from '@/types/transaction';
import {
  ACCOUNT_TYPE_GROUPS,
  getAccountTypeDefinition,
  getAccountTypeIcon,
  getDefaultAccountColorForGroup,
  getDefaultAccountColorForType,
  getDefaultAccountIconForGroup,
} from '@/constants/account-types';
import { useTheme } from '@/store/theme-store';
import { useTransactionStore } from '@/store/transaction-store';
import { formatDateWithWeekday } from '@/utils/date';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { useI18n } from '@/src/i18n';

export interface QuickAccountCreateInput extends Omit<Account, 'id' | 'createdAt'> {
  initialBalanceDate?: Date;
}

interface QuickAccountCreateModalProps {
  visible: boolean;
  currency: string;
  initialType?: Account['type'];
  onClose: () => void;
  onSubmit: (account: QuickAccountCreateInput) => void;
}

function mergeDateWithExistingTime(nextDate: Date, referenceDate: Date): Date {
  const merged = new Date(nextDate);
  merged.setHours(
    referenceDate.getHours(),
    referenceDate.getMinutes(),
    referenceDate.getSeconds(),
    referenceDate.getMilliseconds()
  );
  return merged;
}

function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const hasNegative = cleaned.startsWith('-');
  const normalized = cleaned.replace(/-/g, '');
  const parts = normalized.split('.');
  const whole = parts[0] ?? '';
  const decimal = parts.slice(1).join('');
  return `${hasNegative ? '-' : ''}${parts.length > 1 ? `${whole}.${decimal}` : whole}`;
}

function sortAccountTypeDefinitions(definitions: AccountTypeDefinition[]): AccountTypeDefinition[] {
  const groupOrder = new Map(ACCOUNT_TYPE_GROUPS.map((group, index) => [group.key, index]));
  return [...definitions].sort((left, right) => {
    const groupDelta = (groupOrder.get(left.group) ?? 99) - (groupOrder.get(right.group) ?? 99);
    if (groupDelta !== 0) {
      return groupDelta;
    }

    if (left.isCustom !== right.isCustom) {
      return Number(left.isCustom) - Number(right.isCustom);
    }

    return left.label.localeCompare(right.label);
  });
}

export function QuickAccountCreateModal({
  visible,
  currency,
  initialType = 'checking',
  onClose,
  onSubmit,
}: QuickAccountCreateModalProps) {
  const { theme } = useTheme();
  const { accountTypeDefinitions, saveCustomAccountType } = useTransactionStore();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>(initialType);
  const [selectedTypeGroup, setSelectedTypeGroup] = useState<AccountTypeGroup>('cash_bank');
  const [customTypeName, setCustomTypeName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState<Date>(() => new Date());
  const [showOpeningBalanceDatePicker, setShowOpeningBalanceDatePicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowOpeningBalanceDatePicker(false);
      return;
    }

    const initialDefinition = getAccountTypeDefinition(initialType, accountTypeDefinitions);
    setName('');
    setType(initialDefinition.type);
    setSelectedTypeGroup(initialDefinition.group);
    setCustomTypeName('');
    setOpeningBalance('0');
    setOpeningBalanceDate(new Date());
    setShowOpeningBalanceDatePicker(false);
  }, [accountTypeDefinitions, initialType, visible]);

  const sortedAccountTypeDefinitions = useMemo(
    () => sortAccountTypeDefinitions(accountTypeDefinitions),
    [accountTypeDefinitions]
  );

  const typeOptionsForSelectedGroup = useMemo(
    () => sortedAccountTypeDefinitions.filter((entry) => entry.group === selectedTypeGroup),
    [selectedTypeGroup, sortedAccountTypeDefinitions]
  );

  const selectedTypeDefinition = useMemo(
    () => getAccountTypeDefinition(type, accountTypeDefinitions),
    [accountTypeDefinitions, type]
  );

  const selectedTypeColor = useMemo(
    () => selectedTypeDefinition.color || getDefaultAccountColorForType(type, accountTypeDefinitions),
    [accountTypeDefinitions, selectedTypeDefinition.color, type]
  );

  const snapPoints = useMemo<Array<string | number>>(
    () => (showOpeningBalanceDatePicker && Platform.OS === 'ios' ? ['90%'] : ['78%']),
    [showOpeningBalanceDatePicker]
  );

  const handleSelectType = (nextType: Account['type']) => {
    const definition = getAccountTypeDefinition(nextType, accountTypeDefinitions);
    setType(definition.type);
    setSelectedTypeGroup(definition.group);
  };

  const handleSaveCustomType = () => {
    const label = customTypeName.trim();
    if (!label) {
      Alert.alert(t('common.error'), 'Enter an account type name first.');
      return;
    }

    const definition = saveCustomAccountType({
      label,
      group: selectedTypeGroup,
      icon: getDefaultAccountIconForGroup(selectedTypeGroup),
      color: getDefaultAccountColorForGroup(selectedTypeGroup),
    });

    setType(definition.type);
    setSelectedTypeGroup(definition.group);
    setCustomTypeName('');
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('quickAccount.validationName'));
      return;
    }

    const parsedBalance = Number(openingBalance);
    if (!Number.isFinite(parsedBalance)) {
      Alert.alert(t('common.error'), t('quickAccount.validationBalance'));
      return;
    }

    onSubmit({
      name: name.trim(),
      type: selectedTypeDefinition.type,
      balance: parsedBalance,
      currency: currency || 'ZMW',
      color: selectedTypeColor,
      icon: selectedTypeDefinition.icon,
      isActive: true,
      initialBalanceDate: openingBalanceDate,
    });
  };

  return (
    <AppBottomSheet
      visible={visible}
      title={t('quickAccount.newAccount')}
      snapPoints={snapPoints}
      initialSnapIndex={0}
      onClose={onClose}
      footer={
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          activeOpacity={0.88}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>{t('quickAccount.saveAccount')}</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.introText, { color: theme.colors.textSecondary }]}>{t('quickAccount.intro')}</Text>

        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t('quickAccount.accountName')}</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
          ]}
          value={name}
          onChangeText={setName}
          placeholder={t('quickAccount.accountNamePlaceholder')}
          placeholderTextColor={theme.colors.textSecondary}
          autoCapitalize="words"
        />

        <View style={styles.inlineFieldsRow}>
          <View style={styles.inlineFieldBlock}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t('quickAccount.openingBalance')}</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
              ]}
              value={openingBalance}
              onChangeText={(value) => setOpeningBalance(sanitizeAmountInput(value))}
              placeholder="0"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.inlineFieldBlock}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t('common.currency')}</Text>
            <View
              style={[
                styles.input,
                styles.readonlyField,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.readonlyValue, { color: theme.colors.text }]}>{currency || 'ZMW'}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t('quickAccount.openingBalanceDate')}</Text>
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
        <Text style={[styles.formHint, { color: theme.colors.textSecondary }]}>{t('quickAccount.openingBalanceHint')}</Text>

        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t('quickAccount.accountType')}</Text>
        <Text style={[styles.typeHelperText, { color: theme.colors.textSecondary }]}>Choose a saved type or create your own.</Text>

        <View style={styles.groupRow}>
          {ACCOUNT_TYPE_GROUPS.map((group) => {
            const isSelected = group.key === selectedTypeGroup;
            return (
              <TouchableOpacity
                key={group.key}
                activeOpacity={0.88}
                onPress={() => setSelectedTypeGroup(group.key)}
                style={[
                  styles.groupChip,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.groupChipText, { color: isSelected ? '#FFFFFF' : theme.colors.text }]}> 
                  {group.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.typeGrid}>
          {typeOptionsForSelectedGroup.map((entry) => {
            const Icon = getAccountTypeIcon(entry.icon, entry.type);
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
                onPress={() => handleSelectType(entry.type)}
                activeOpacity={0.9}
              >
                <View
                  style={[
                    styles.typeIconWrap,
                    { backgroundColor: isSelected ? theme.colors.primary + '18' : theme.colors.background },
                  ]}
                >
                  <Icon size={18} color={isSelected ? theme.colors.primary : entry.color} />
                </View>
                <Text style={[styles.typeCardTitle, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                  {entry.label}
                </Text>
                <Text style={[styles.typeCardDescription, { color: theme.colors.textSecondary }]}>
                  {entry.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.customTypePanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <Text style={[styles.customTypeTitle, { color: theme.colors.text }]}>Need another type?</Text>
          <Text style={[styles.customTypeText, { color: theme.colors.textSecondary }]}>Save a custom type and reuse it next time.</Text>
          <TextInput
            style={[
              styles.input,
              styles.customTypeInput,
              { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border },
            ]}
            value={customTypeName}
            onChangeText={setCustomTypeName}
            placeholder="Custom account type"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={[
              styles.customTypeButton,
              {
                backgroundColor: customTypeName.trim() ? theme.colors.primary : theme.colors.border,
              },
            ]}
            activeOpacity={0.88}
            onPress={handleSaveCustomType}
            disabled={!customTypeName.trim()}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.customTypeButtonText}>Add Type</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 8,
  },
  introText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  inlineFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineFieldBlock: {
    flex: 1,
  },
  readonlyField: {
    justifyContent: 'center',
  },
  readonlyValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateFieldButton: {
    justifyContent: 'center',
  },
  dateFieldValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  formHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  typeHelperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  groupChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
    marginBottom: 8,
  },
  typeCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  typeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  typeCardDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  customTypePanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  customTypeTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  customTypeText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  customTypeInput: {
    marginTop: 12,
  },
  customTypeButton: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  customTypeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  saveButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
