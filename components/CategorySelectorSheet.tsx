import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import * as Icons from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { TransactionCategory } from '@/types/transaction';
import { findMatchingCategory } from '@/constants/categories';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { useI18n } from '@/src/i18n';

interface CategorySelectorSheetProps {
  visible: boolean;
  categories: TransactionCategory[];
  selectedCategoryId?: string;
  title?: string;
  maxHeight?: number;
  onSelect: (category: TransactionCategory) => void;
  onCreateCategory?: (name: string) => void;
  onClose: () => void;
}

export function CategorySelectorSheet({
  visible,
  categories,
  selectedCategoryId,
  title,
  maxHeight,
  onSelect,
  onCreateCategory,
  onClose,
}: CategorySelectorSheetProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const trimmedQuery = query.trim();

  const filteredCategories = useMemo(() => {
    if (!trimmedQuery) {
      return categories;
    }

    const normalizedQuery = trimmedQuery.toLowerCase();
    return categories.filter((category) => category.name.toLowerCase().includes(normalizedQuery));
  }, [categories, trimmedQuery]);

  const existingMatch = useMemo(
    () => findMatchingCategory(categories, trimmedQuery),
    [categories, trimmedQuery]
  );

  const canCreateCategory = Boolean(onCreateCategory && trimmedQuery && !existingMatch);
  const resolvedTitle = title ?? t('common.category');

  return (
    <AppBottomSheet
      visible={visible}
      title={resolvedTitle}
      snapPoints={['60%', '75%']}
      initialSnapIndex={0}
      maxHeight={maxHeight}
      onClose={onClose}
    >
      <View
        style={[
          styles.searchBox,
          { backgroundColor: theme.colors.card ?? theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Icons.Search size={16} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('categorySheet.searchPlaceholder')}
          placeholderTextColor={theme.colors.textSecondary}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Icons.X size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {canCreateCategory ? (
        <Pressable
          style={[styles.createButton, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary }]}
          onPress={() => {
            onCreateCategory?.(trimmedQuery);
            setQuery('');
          }}
        >
          <View style={[styles.createIconBadge, { backgroundColor: theme.colors.primary }]}> 
            <Icons.Plus size={16} color="#fff" />
          </View>
          <View style={styles.createTextWrap}>
            <Text style={[styles.createTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {t('categorySheet.add', { name: trimmedQuery })}
            </Text>
            <Text style={[styles.createHint, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {t('categorySheet.addHint')}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {filteredCategories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}> 
            {trimmedQuery
              ? canCreateCategory
                ? t('categorySheet.createThisCategory')
                : t('categorySheet.noneFound')
              : t('categorySheet.noneAvailable')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          keyboardShouldPersistTaps="handled"
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  createIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTextWrap: {
    flex: 1,
  },
  createTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  createHint: {
    fontSize: 12,
    marginTop: 2,
  },
  gridContent: {
    paddingTop: 4,
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