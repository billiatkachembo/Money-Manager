import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { CreditCard, Landmark, PiggyBank, TrendingUp, Wallet, Maximize2, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/store/theme-store';
import { Account } from '@/types/transaction';
import { AppBottomSheet, AppBottomSheetAction } from '@/components/ui/AppBottomSheet';
import { useI18n } from '@/src/i18n';

interface AccountSelectorSheetProps {
  visible: boolean;
  accounts: Account[];
  selectedAccountId?: string;
  title?: string;
  maxHeight?: number;
  onSelect: (account: Account) => void;
  onClose: () => void;
  onExpand?: () => void;
  onCreateAccount?: () => void;
}

const ACCOUNT_TYPE_ICONS = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  cash: Landmark,
} as const;

export function AccountSelectorSheet({
  visible,
  accounts,
  selectedAccountId,
  title,
  maxHeight,
  onSelect,
  onClose,
  onExpand,
  onCreateAccount,
}: AccountSelectorSheetProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const actions = useMemo<AppBottomSheetAction[]>(() => {
    const next: AppBottomSheetAction[] = [];
    if (onCreateAccount) {
      next.push({
        icon: Plus,
        onPress: onCreateAccount,
        accessibilityLabel: t('accountSheet.accessibility.createAccount'),
      });
    }
    if (onExpand) {
      next.push({
        icon: Maximize2,
        onPress: onExpand,
        accessibilityLabel: t('accountSheet.accessibility.openAccounts'),
      });
    }
    return next;
  }, [onCreateAccount, onExpand, t]);

  const handleSelect = (account: Account) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect(account);
    onClose();
  };

  const cardBackground = theme.colors.card ?? theme.colors.surface;

  return (
    <AppBottomSheet
      visible={visible}
      title={title ?? t('common.accounts')}
      snapPoints={['75%']}
      initialSnapIndex={0}
      maxHeight={maxHeight}
      actions={actions}
      onClose={onClose}
    >
      {accounts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>{t('accountSheet.noneAvailable')}</Text>
          {onCreateAccount ? (
            <Pressable
              style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
              onPress={onCreateAccount}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.createButtonText}>{t('accountSheet.createAccount')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedAccountId;
            const AccountIcon = ACCOUNT_TYPE_ICONS[item.type] ?? Wallet;
            const accentColor = item.color || theme.colors.primary;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.accountTile,
                  { backgroundColor: cardBackground, borderColor: theme.colors.border },
                  isSelected && styles.accountTileSelected,
                  isSelected && { borderColor: theme.colors.primary },
                  pressed && styles.accountTilePressed,
                ]}
                onPress={() => handleSelect(item)}
              >
                <View style={[styles.accountIcon, { backgroundColor: accentColor + '20' }]}>
                  <AccountIcon size={18} color={accentColor} />
                </View>
                <Text style={[styles.accountLabel, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  gridContent: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  gridRow: {
    gap: 14,
    marginBottom: 14,
  },
  accountTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 18,
    alignItems: 'center',
    minHeight: 114,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  accountTileSelected: {
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  accountTilePressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  accountLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  createButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
