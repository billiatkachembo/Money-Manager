import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import * as Icons from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { TransactionCategory } from '@/types/transaction';
import {
  findMatchingCategory,
  type TransactionSubcategory,
} from '@/constants/categories';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { useI18n } from '@/src/i18n';

interface CategorySelectorSheetProps {
  visible: boolean;
  categories: TransactionCategory[];
  selectedCategoryId?: string;
  selectedSubcategory?: string;
  title?: string;
  maxHeight?: number;
  onSelect: (category: TransactionCategory, subcategory?: string) => void;
  onCreateCategory?: (name: string) => void;
  onCreateSubcategory?: (category: TransactionCategory, name: string) => void;
  getSubcategories?: (category: TransactionCategory) => TransactionSubcategory[];
  onClose: () => void;
}

function normalizeValue(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

export function CategorySelectorSheet({
  visible,
  categories,
  selectedCategoryId,
  selectedSubcategory,
  title,
  maxHeight,
  onSelect,
  onCreateCategory,
  onCreateSubcategory,
  getSubcategories,
  onClose,
}: CategorySelectorSheetProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setActiveCategoryId(null);
      return;
    }
  }, [categories, getSubcategories, selectedCategoryId, visible]);

  const trimmedQuery = query.trim();

  const filteredCategories = useMemo(() => {
    if (!trimmedQuery) {
      return categories;
    }

    const normalizedQuery = trimmedQuery.toLowerCase();
    return categories.filter((category) => {
      if (category.name.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      return (getSubcategories?.(category) ?? []).some((subcategory) =>
        subcategory.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categories, getSubcategories, trimmedQuery]);

  const activeCategory = useMemo(() => {
    return filteredCategories.find((category) => category.id === activeCategoryId) ?? null;
  }, [activeCategoryId, filteredCategories]);

  const activeSubcategories = useMemo(() => {
    if (!activeCategory) {
      return [];
    }

    const allSubcategories = getSubcategories?.(activeCategory) ?? [];
    if (!trimmedQuery) {
      return allSubcategories;
    }

    const normalizedQuery = trimmedQuery.toLowerCase();
    const filtered = allSubcategories.filter((subcategory) =>
      subcategory.name.toLowerCase().includes(normalizedQuery)
    );

    return filtered.length > 0 ? filtered : allSubcategories;
  }, [activeCategory, getSubcategories, trimmedQuery]);

  const existingMatch = useMemo(
    () => findMatchingCategory(categories, trimmedQuery),
    [categories, trimmedQuery]
  );

  const activeCategoryAllSubcategories = useMemo(
    () => (activeCategory ? getSubcategories?.(activeCategory) ?? [] : []),
    [activeCategory, getSubcategories]
  );
  const normalizedQueryValue = normalizeValue(trimmedQuery);
  const hasMatchingSubcategory = activeCategoryAllSubcategories.some((subcategory) =>
    normalizeValue(subcategory.name) === normalizedQueryValue
  );
  const canCreateSubcategory = Boolean(
    onCreateSubcategory && activeCategory && trimmedQuery && !hasMatchingSubcategory
  );
  const canCreateCategory = Boolean(onCreateCategory && trimmedQuery && !existingMatch && !activeCategory);
  const resolvedTitle = title ?? t('common.category');
  const showSplitSelector = Boolean(onCreateSubcategory) || filteredCategories.some(
    (category) => (getSubcategories?.(category)?.length ?? 0) > 0
  );
  const normalizedSelectedSubcategory = normalizeValue(selectedSubcategory);

  return (
    <AppBottomSheet
      visible={visible}
      title={resolvedTitle}
      snapPoints={['60%', '78%']}
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
          style={[
            styles.createButton,
            { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary },
          ]}
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
      ) : showSplitSelector ? (
        <View style={styles.splitContainer}>
          <View
            style={[
              styles.categoryPane,
              { backgroundColor: theme.colors.card ?? theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.categoryPaneContent}
              renderItem={({ item }) => {
                const IconComponent = (Icons as any)[item.icon] || Icons.Circle;
                const itemSubcategories = getSubcategories?.(item) ?? [];
                const hasSubcategories = itemSubcategories.length > 0;
                const isSelected = item.id === selectedCategoryId;
                const isActive = item.id === activeCategory?.id;
                const isHighlighted = hasSubcategories ? isActive : isSelected;

                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.categoryRow,
                      {
                        backgroundColor: isHighlighted ? theme.colors.primary + '12' : 'transparent',
                        borderColor: isHighlighted ? theme.colors.primary : 'transparent',
                      },
                      pressed && styles.categoryRowPressed,
                    ]}
                    onPress={() => {
                      if (showSplitSelector) {
                        setActiveCategoryId(item.id);
                        return;
                      }

                      if (hasSubcategories) {
                        setActiveCategoryId(item.id);
                        return;
                      }

                      onSelect(item);
                    }}
                  >
                    <View style={[styles.categoryRowIcon, { backgroundColor: item.color + '20' }]}>
                      <IconComponent size={16} color={item.color} />
                    </View>
                    <View style={styles.categoryRowTextWrap}>
                      <Text style={[styles.categoryRowLabel, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isSelected && selectedSubcategory ? (
                        <Text
                          style={[styles.categoryRowMeta, { color: theme.colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {selectedSubcategory}
                        </Text>
                      ) : null}
                    </View>
                    {showSplitSelector || hasSubcategories ? (
                      <Icons.ChevronRight
                        size={16}
                        color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                      />
                    ) : isSelected ? (
                      <Icons.Check size={16} color={theme.colors.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>

          <View style={[styles.subcategoryPane, { borderColor: theme.colors.border }]}> 
            {activeCategory ? (
              <>
                <View style={styles.subcategoryHeader}>
                  <Text style={[styles.subcategoryTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {activeCategory.name}
                  </Text>
                  <Text style={[styles.subcategoryHint, { color: theme.colors.textSecondary }]}>
                    {activeCategoryAllSubcategories.length > 0
                      ? 'Choose a subcategory'
                      : canCreateSubcategory
                        ? 'Create a custom subcategory for this category.'
                        : 'Search to add a custom subcategory or select this category directly.'}
                  </Text>
                </View>
                {activeCategoryAllSubcategories.length === 0 ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.subcategoryRow,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.card ?? theme.colors.surface },
                      pressed && styles.categoryRowPressed,
                    ]}
                    onPress={() => onSelect(activeCategory)}
                  >
                    <Text style={[styles.subcategoryLabel, { color: theme.colors.text }]} numberOfLines={1}>
                      Use {activeCategory.name}
                    </Text>
                    {activeCategory.id === selectedCategoryId && !selectedSubcategory ? (
                      <Icons.Check size={16} color={theme.colors.primary} />
                    ) : null}
                  </Pressable>
                ) : null}
                {canCreateSubcategory ? (
                  <Pressable
                    style={[
                      styles.createButton,
                      { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary },
                    ]}
                    onPress={() => {
                      onCreateSubcategory?.(activeCategory, trimmedQuery);
                      setQuery('');
                    }}
                  >
                    <View style={[styles.createIconBadge, { backgroundColor: theme.colors.primary }]}>
                      <Icons.Plus size={16} color="#fff" />
                    </View>
                    <View style={styles.createTextWrap}>
                      <Text style={[styles.createTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        Add "{trimmedQuery}"
                      </Text>
                      <Text style={[styles.createHint, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        Save it under {activeCategory.name}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                {activeSubcategories.length > 0 ? (
                  <FlatList
                    data={activeSubcategories}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.subcategoryContent}
                    renderItem={({ item }) => {
                      const isSelected =
                        activeCategory.id === selectedCategoryId &&
                        normalizeValue(item.name) === normalizedSelectedSubcategory;

                      return (
                        <Pressable
                          style={({ pressed }) => [
                            styles.subcategoryRow,
                            {
                              backgroundColor: isSelected ? theme.colors.primary + '12' : 'transparent',
                              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                            },
                            pressed && styles.categoryRowPressed,
                          ]}
                          onPress={() => onSelect(activeCategory, item.name)}
                        >
                          <Text style={[styles.subcategoryLabel, { color: theme.colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {isSelected ? <Icons.Check size={16} color={theme.colors.primary} /> : null}
                        </Pressable>
                      );
                    }}
                  />
                ) : !canCreateSubcategory ? (
                  <View style={styles.subcategoryEmptyState}>
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}> 
                      Choose this category directly or search to add a custom subcategory.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.subcategoryEmptyState}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}> 
                  Select a category to view or create subcategories.
                </Text>
              </View>
            )}
          </View>
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
                onPress={() => onSelect(item)}
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
  splitContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    minHeight: 280,
  },
  categoryPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryPaneContent: {
    padding: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  categoryRowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  categoryRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  categoryRowLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryRowMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  subcategoryPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  subcategoryHeader: {
    paddingBottom: 8,
    marginBottom: 8,
  },
  subcategoryTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  subcategoryHint: {
    fontSize: 12,
    marginTop: 2,
  },
  subcategoryContent: {
    paddingBottom: 8,
  },
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  subcategoryLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  subcategoryEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
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
    textAlign: 'center',
  },
});

