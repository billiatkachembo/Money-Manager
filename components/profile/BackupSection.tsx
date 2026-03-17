import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Database, Download, Upload } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

interface BackupSectionProps {
  lastBackupText?: string;
  onOpenBackup: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function BackupSection({ lastBackupText, onOpenBackup, onExport, onImport }: BackupSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Database size={18} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.text }]}>Backup & Restore</Text>
        </View>
        <TouchableOpacity onPress={onOpenBackup}>
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>Open</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Keep your data safe and portable.</Text>
      {lastBackupText ? (
        <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>{lastBackupText}</Text>
      ) : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
          onPress={onExport}
        >
          <Download size={16} color="#fff" />
          <Text style={styles.actionText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={onImport}
        >
          <Upload size={16} color={theme.colors.text} />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>Import</Text>
        </TouchableOpacity>
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
