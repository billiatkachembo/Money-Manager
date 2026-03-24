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
import {
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { Account } from '@/types/transaction';
import { useTheme } from '@/store/theme-store';
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

export function QuickAccountCreateModal({
  visible,
  currency,
  initialType = 'checking',
  onClose,
  onSubmit,
}: QuickAccountCreateModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>(initialType);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState<Date>(() => new Date());
  const [showOpeningBalanceDatePicker, setShowOpeningBalanceDatePicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowOpeningBalanceDatePicker(false);
      return;
    }

    setName('');
    setType(initialType);
    setOpeningBalance('0');
    setOpeningBalanceDate(new Date());
    setShowOpeningBalanceDatePicker(false);
  }, [initialType, visible]);

  const selectedTypeColor = useMemo(() => getDefaultAccountColor(type), [type]);
  const snapPoints = useMemo<Array<string | number>>(
    () => (showOpeningBalanceDatePicker && Platform.OS === 'ios' ? ['82%'] : ['62%']),
    [showOpeningBalanceDatePicker]
  );

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
      type,
      balance: parsedBalance,
      currency: currency || 'ZMW',
      color: selectedTypeColor,
      icon: type,
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
                activeOpacity={0.9}
              >
                <View
                  style={[
                    styles.typeIconWrap,
                    { backgroundColor: isSelected ? theme.colors.primary + '18' : theme.colors.background },
                  ]}
                >
                  <Icon size={18} color={isSelected ? theme.colors.primary : theme.colors.textSecondary} />
                </View>
                <Text style={[styles.typeCardTitle, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                  {t(`quickAccount.type.${entry.type}.label`)}
                </Text>
                <Text style={[styles.typeCardDescription, { color: theme.colors.textSecondary }]}> 
                  {t(`quickAccount.type.${entry.type}.description`)}
                </Text>
              </TouchableOpacity>
            );
          })}
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
    paddingBottom: 4,
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
