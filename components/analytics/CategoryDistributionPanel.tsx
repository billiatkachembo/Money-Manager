import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { FinanceDonutChart } from '@/components/charts/FinanceCharts';
import { useTheme } from '@/store/theme-store';
import { AdaptiveAmountText } from '@/components/ui/AdaptiveAmountText';
import type { CategoryDistributionSlice } from '@/src/domain/analytics';

export interface DistributionSection {
  key: string;
  label: string;
  total: number;
  items: CategoryDistributionSlice[];
}

interface CategoryDistributionPanelProps {
  sections: DistributionSection[];
  formatCurrency: (value: number) => string;
  emptyMessage: string;
  initialSectionKey?: string;
}

function formatPercentage(value: number): string {
  const percent = Math.max(0, Math.min(100, value * 100));
  const rounded = percent >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function getSectionAccent(sectionKey: string | null | undefined, defaultAccent: string): string {
  if (sectionKey === 'income') {
    return '#3B82F6';
  }

  return defaultAccent;
}

export function CategoryDistributionPanel({
  sections,
  formatCurrency,
  emptyMessage,
  initialSectionKey,
}: CategoryDistributionPanelProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const availableSections = useMemo(() => sections.filter((section) => section.items.length > 0), [sections]);
  const fallbackSectionKey =
    (initialSectionKey && sections.some((section) => section.key === initialSectionKey) ? initialSectionKey : null) ??
    availableSections[0]?.key ??
    sections[0]?.key ??
    null;
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(fallbackSectionKey);
  const [focusedItemName, setFocusedItemName] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSectionKey((current) => (current && sections.some((section) => section.key === current) ? current : fallbackSectionKey));
  }, [fallbackSectionKey, sections]);

  const activeSection = useMemo(() => {
    if (!selectedSectionKey) {
      return sections[0] ?? null;
    }

    return sections.find((section) => section.key === selectedSectionKey) ?? sections[0] ?? null;
  }, [sections, selectedSectionKey]);

  useEffect(() => {
    if (!activeSection || activeSection.items.length === 0) {
      setFocusedItemName(null);
      return;
    }

    setFocusedItemName((current) =>
      current && activeSection.items.some((item) => item.name === current) ? current : activeSection.items[0].name
    );
  }, [activeSection]);

  const chartSize = Math.min(Math.max(width - 72, 280), 360);
  const chartData = useMemo(
    () =>
      (activeSection?.items ?? []).map((item) => ({
        key: item.name,
        label: item.name,
        value: item.amount,
        color: item.color,
      })),
    [activeSection]
  );
  const focusedItem = useMemo(() => {
    if (!activeSection || activeSection.items.length === 0) {
      return null;
    }

    return activeSection.items.find((item) => item.name === focusedItemName) ?? activeSection.items[0] ?? null;
  }, [activeSection, focusedItemName]);
  const hasAnyData = availableSections.length > 0;

  return (
    <View>
      <View style={[styles.tabRow, { borderBottomColor: theme.colors.border }]}> 
        {sections.map((section) => {
          const isActive = activeSection?.key === section.key;
          const isDisabled = section.items.length === 0;
          const accentColor = getSectionAccent(section.key, theme.colors.primary);

          return (
            <TouchableOpacity
              key={section.key}
              activeOpacity={0.88}
              onPress={() => setSelectedSectionKey(section.key)}
              style={styles.tabButton}
              disabled={!hasAnyData}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: isActive ? theme.colors.text : theme.colors.textSecondary,
                    opacity: isDisabled ? 0.45 : 1,
                  },
                ]}
              >
                {section.label}
              </Text>
              <AdaptiveAmountText
                style={[
                  styles.tabButtonValue,
                  {
                    color: isActive ? accentColor : theme.colors.textSecondary,
                    opacity: isDisabled ? 0.55 : 0.88,
                  },
                ]}
                minFontSize={11}
                value={formatCurrency(section.total)}
              />
              <View
                style={[
                  styles.tabIndicator,
                  { backgroundColor: isActive && !isDisabled ? accentColor : 'transparent' },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {!hasAnyData ? (
        <View
          style={[
            styles.emptyWrap,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC',
            },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No data</Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>{emptyMessage}</Text>
        </View>
      ) : activeSection && activeSection.items.length > 0 ? (
        <>
          <View
            style={[
              styles.chartSurface,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.isDark ? theme.colors.background : '#FCFCFD',
              },
            ]}
          >
            <FinanceDonutChart
              size={chartSize}
              slices={chartData}
              focusedKey={focusedItem?.name ?? null}
              onSelect={setFocusedItemName}
              trackColor={theme.colors.border}
              centerColor={theme.isDark ? theme.colors.background : '#FCFCFD'}
              variant="pie"
              showCallouts
              labelColor={theme.colors.text}
            />
          </View>

          <View style={styles.listWrap}>
            {activeSection.items.map((item) => {
              const isFocused = focusedItem?.name === item.name;
              return (
                <TouchableOpacity
                  key={`${activeSection.key}-${item.name}`}
                  activeOpacity={0.85}
                  onPress={() => setFocusedItemName(item.name)}
                  style={[
                    styles.listRow,
                    {
                      borderBottomColor: theme.colors.border,
                      backgroundColor: isFocused ? (theme.isDark ? '#181C25' : '#F8FAFC') : 'transparent',
                    },
                  ]}
                >
                  <View style={[styles.badge, { backgroundColor: item.color }]}>
                    <Text style={styles.badgeText}>{formatPercentage(item.share)}</Text>
                  </View>
                  <Text style={[styles.listName, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <AdaptiveAmountText
                    style={[styles.listAmount, { color: theme.colors.text }]}
                    minFontSize={11}
                    value={formatCurrency(item.amount)}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <View
          style={[
            styles.emptyWrap,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.isDark ? theme.colors.background : '#F8FAFC',
            },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No {activeSection?.label.toLowerCase() ?? 'data'}</Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>There is no data in this view yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    marginBottom: 18,
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 0,
    gap: 4,
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  tabButtonValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  tabIndicator: {
    width: '100%',
    height: 3,
    borderRadius: 999,
    marginTop: 10,
  },
  chartSurface: {
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  listWrap: {
    marginTop: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  badge: {
    minWidth: 46,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  listName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  listAmount: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  emptyWrap: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
});
