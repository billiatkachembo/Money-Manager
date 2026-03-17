import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Eye, Lock, Database, Shield, Clock } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

interface SecuritySettings {
  privacy?: {
    hideAmounts?: boolean;
    requireAuth?: boolean;
    dataSharing?: boolean;
    analytics?: boolean;
  };
  security?: {
    autoLock?: number;
    passwordEnabled?: boolean;
    twoFactorEnabled?: boolean;
  };
}

interface SecuritySectionProps {
  settings: SecuritySettings;
  autoLockLabel: string;
  onToggleHideAmounts: (value: boolean) => void;
  onToggleRequireAuth: (value: boolean) => void;
  onToggleDataSharing: (value: boolean) => void;
  onToggleAnalytics: (value: boolean) => void;
  onTogglePassword: (value: boolean) => void;
  onToggleTwoFactor: (value: boolean) => void;
  onAutoLockPress: () => void;
}

export function SecuritySection({
  settings,
  autoLockLabel,
  onToggleHideAmounts,
  onToggleRequireAuth,
  onToggleDataSharing,
  onToggleAnalytics,
  onTogglePassword,
  onToggleTwoFactor,
  onAutoLockPress,
}: SecuritySectionProps) {
  const { theme } = useTheme();

  const renderRow = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    control: React.ReactNode
  ) => (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}> 
      <View style={styles.rowLeft}>
        {icon}
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>
      {control}
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
      {renderRow(
        <Eye size={20} color={theme.colors.primary} />,
        'Hide Amounts',
        'Mask transaction amounts on main screen',
        <Switch
          value={!!settings.privacy?.hideAmounts}
          onValueChange={onToggleHideAmounts}
          trackColor={{ false: '#e0e0e0', true: theme.colors.primary }}
        />
      )}

      {renderRow(
        <Lock size={20} color={theme.colors.primary} />,
        'Require Authentication',
        'Require PIN or Face ID to open app',
        <Switch
          value={!!settings.privacy?.requireAuth}
          onValueChange={onToggleRequireAuth}
          trackColor={{ false: '#e0e0e0', true: theme.colors.primary }}
        />
      )}

      {renderRow(
        <Database size={20} color={theme.colors.primary} />,
        'Share Usage Data',
        'Help improve the app with anonymous data',
        <Switch
          value={!!settings.privacy?.dataSharing}
          onValueChange={onToggleDataSharing}
          trackColor={{ false: '#e0e0e0', true: theme.colors.primary }}
        />
      )}

      {renderRow(
        <Shield size={20} color={theme.colors.primary} />,
        'Analytics',
        'Allow analytics for better insights',
        <Switch
          value={!!settings.privacy?.analytics}
          onValueChange={onToggleAnalytics}
          trackColor={{ false: '#e0e0e0', true: theme.colors.primary }}
        />
      )}

      {renderRow(
        <Clock size={20} color={theme.colors.primary} />,
        'Auto Lock',
        `Current: ${autoLockLabel}`,
        <TouchableOpacity onPress={onAutoLockPress}>
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>Change</Text>
        </TouchableOpacity>
      )}

      {renderRow(
        <Lock size={20} color={theme.colors.primary} />,
        'App Password',
        'Use a password to open the app',
        <Switch
          value={!!settings.security?.passwordEnabled}
          onValueChange={onTogglePassword}
          trackColor={{ false: '#e0e0e0', true: theme.colors.primary }}
        />
      )}

      {renderRow(
        <Shield size={20} color={theme.colors.primary} />,
        'Two Factor Authentication',
        'Add an extra layer of security',
        <Switch
          value={!!settings.security?.twoFactorEnabled}
          onValueChange={onToggleTwoFactor}
          trackColor={{ false: '#e0e0e0', true: theme.colors.primary }}
        />
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
    flex: 1,
    gap: 12,
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
  linkText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
