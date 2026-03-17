import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/store/theme-store';

interface MenuGridItem {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface MenuGridProps {
  title: string;
  items: MenuGridItem[];
}

export function MenuGrid({ title, items }: MenuGridProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <View style={styles.grid}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.title}
              style={[styles.tile, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={item.onPress}
              activeOpacity={0.86}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '12' }]}>
                <Icon size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.tileTitle, { color: theme.colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.tileSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                {item.subtitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  tile: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tileSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
});
