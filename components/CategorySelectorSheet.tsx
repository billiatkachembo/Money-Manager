import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import * as Icons from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { TransactionCategory } from '@/types/transaction';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';

interface CategorySelectorSheetProps {
  visible: boolean;
  categories: TransactionCategory[];
  selectedCategoryId?: string;
  title?: string;
  onSelect: (category: TransactionCategory) => void;
  onClose: () => void;
}

export function CategorySelectorSheet({
  visible,
  categories,
  selectedCategoryId,
  title = 'Category',
  onSelect,
  onClose,
}: CategorySelectorSheetProps) {
  const { theme } = useTheme();

  return (
    <AppBottomSheet
      visible={visible}
      title={title}
      snapPoints={['60%', '75%']}
      initialSnapIndex={0}
      onClose={onClose}
    >
      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No categories available</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedCategoryId;
            const IconComponent = (Icons as any)[item.icon] || Icons.Circle;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.categoryTile,
                  { backgroundColor: theme.colors.card ?? theme.colors.surface, borderColor: theme.colors.border },
                  isSelected && {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primary + '12',
                  },
                  pressed && styles.categoryTilePressed,
                ]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: item.color + '20' }]}>
                  <IconComponent size={18} color={item.color} />
                </View>
                <Text style={[styles.categoryLabel, { color: theme.colors.text }]} numberOfLines={1}>
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
  categoryTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    minWidth: 96,
  },
  categoryTilePressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
