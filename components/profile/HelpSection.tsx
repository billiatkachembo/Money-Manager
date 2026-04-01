import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ExternalLink, HelpCircle, Mail, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

interface HelpSectionProps {
  onFaq: () => void;
  onContact: () => void;
  onEmail: () => void;
}

export function HelpSection({ onFaq, onContact, onEmail }: HelpSectionProps) {
  const { theme } = useTheme();

  const renderItem = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.rowLeft}>
        {icon}
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>
      <ExternalLink size={16} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
      {renderItem(
        <HelpCircle size={20} color={theme.colors.primary} />,
        'FAQ & Documentation',
        'Find answers to common questions',
        onFaq
      )}
      {renderItem(
        <MessageCircle size={20} color={theme.colors.primary} />,
        'Contact Support',
        'Get help from our support team',
        onContact
      )}
      {renderItem(
        <Mail size={20} color={theme.colors.primary} />,
        'Email Support',
        'app.moneymanager.mm@gmail.com',
        onEmail
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
