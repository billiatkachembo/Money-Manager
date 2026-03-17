import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { CreditCard, Landmark, PiggyBank, TrendingUp, Wallet, Maximize2, Pencil } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/store/theme-store';
import { Account } from '@/types/transaction';
import { AppBottomSheet, AppBottomSheetAction } from '@/components/ui/AppBottomSheet';

interface AccountSelectorSheetProps {
  visible: boolean;
  accounts: Account[];
  selectedAccountId?: string;
  title?: string;
  onSelect: (account: Account) => void;
  onClose: () => void;
  onExpand?: () => void;
  onEdit?: () => void;
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
  title = 'Accounts',
  onSelect,
  onClose,
  onExpand,
  onEdit,
}: AccountSelectorSheetProps) {
  const { theme } = useTheme();

  const actions = useMemo<AppBottomSheetAction[]>(() => {
    const next: AppBottomSheetAction[] = [];
    if (onExpand) {
      next.push({
        icon: Maximize2,
        onPress: onExpand,
        accessibilityLabel: 'Open accounts',
      });
    }
    if (onEdit) {
      next.push({
        icon: Pencil,
        onPress: onEdit,
        accessibilityLabel: 'Edit accounts',
      });
    }
    return next;
  }, [onEdit, onExpand]);

  const handleSelect = (account: Account) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect(account);
    onClose();
  };

  const cardBackground = theme.colors.card ?? theme.colors.surface;

  return (
    <AppBottomSheet
      visible={visible}
      title={title}
      snapPoints={['75%']}
      initialSnapIndex={0}
      actions={actions}
      onClose={onClose}
    >
      {accounts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No accounts available</Text>
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  accountTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    minHeight: 96,
  },
  accountTileSelected: {
    borderWidth: 2,
  },
  accountTilePressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  accountLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
