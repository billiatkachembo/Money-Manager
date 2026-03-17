import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/store/theme-store';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 12,
  },
});
