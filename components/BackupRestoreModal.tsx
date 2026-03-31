import { memo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  CheckCircle,
  AlertCircle,
  Download,
  Database,
  UploadCloud,
  DownloadCloud,
} from 'lucide-react-native';
import { formatDateTimeWithWeekday } from '@/utils/date';

type BackupState = 'idle' | 'backingup' | 'restoring' | 'success' | 'error';

export interface BackupHistoryItem {
  timestamp: number;
  filename: string;
}

interface ThemeLike {
  colors: {
    background: string;
    border: string;
    text: string;
    textSecondary: string;
    surface: string;
    primary: string;
  };
}

interface BackupRestoreModalProps {
  show: boolean;
  setShow: (show: boolean) => void;
  theme: ThemeLike;
  backupStatus: BackupState;
  backupMessage: string;
  driveConnected?: boolean;
  driveAccountLabel?: string;
  googleDriveAvailable?: boolean;
  googleDriveUnavailableReason?: string;
  onConnectDrive?: () => void;
  onDisconnectDrive?: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onExportCsv: () => void;
  onImportCsv: () => void;
  onBackupToGoogleDrive: () => void;
  onRestoreFromGoogleDrive: () => void;
  backupHistory?: BackupHistoryItem[];
  onRestoreHistoryItem?: (item: BackupHistoryItem) => void;
}

interface BackupActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  textColor?: string;
}

const BackupActionButton = memo(function BackupActionButton({
  icon,
  label,
  onPress,
  disabled = false,
  containerStyle,
  textColor = '#FFFFFF',
}: BackupActionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, containerStyle, disabled && styles.actionButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {icon}
      <Text style={[styles.actionButtonText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
});

export const BackupRestoreModal = memo(function BackupRestoreModal({
  show,
  setShow,
  theme,
  backupStatus,
  backupMessage,
  driveConnected,
  driveAccountLabel,
  googleDriveAvailable = true,
  googleDriveUnavailableReason,
  onConnectDrive,
  onDisconnectDrive,
  onExportData,
  onImportData,
  onExportCsv,
  onImportCsv,
  onBackupToGoogleDrive,
  onRestoreFromGoogleDrive,
  backupHistory = [],
  onRestoreHistoryItem,
}: BackupRestoreModalProps) {
  const isProcessing = backupStatus === 'backingup' || backupStatus === 'restoring';
  const isDriveConnected = Boolean(driveConnected);
  const isGoogleDriveAvailable = googleDriveAvailable;
  const driveStatusLabel = driveAccountLabel ?? (isDriveConnected ? 'Connected' : isGoogleDriveAvailable ? 'No account connected' : 'Unavailable in this build');
  const disableDriveConnect = isProcessing || (!isDriveConnected && !isGoogleDriveAvailable) || (!onConnectDrive && !onDisconnectDrive);
  const disableDriveTransfer = isProcessing || !isGoogleDriveAvailable;

  return (
    <Modal
      visible={show}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => setShow(false)}>
            <Text style={[styles.headerAction, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Backup & Restore</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content}>
          {backupStatus !== 'idle' ? (
            <View
              style={[
                styles.statusContainer,
                backupStatus === 'success'
                  ? styles.statusSuccess
                  : backupStatus === 'error'
                    ? styles.statusError
                    : styles.statusInfo,
              ]}
            >
              {backupStatus === 'success' ? (
                <CheckCircle size={20} color="#2E7D32" />
              ) : backupStatus === 'error' ? (
                <AlertCircle size={20} color="#C62828" />
              ) : (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              )}
              <Text style={[styles.statusText, { color: theme.colors.text }]}>{backupMessage}</Text>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Backup Accounts</Text>
          <Text style={[styles.sectionHint, { color: theme.colors.textSecondary }]}>
            {googleDriveUnavailableReason ?? 'Connect a Google Drive account to enable automatic backups.'}
          </Text>
          <View style={[styles.accountRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
            <View style={styles.accountInfo}>
              <View style={[styles.accountIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <UploadCloud size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.accountText}>
                <Text style={[styles.accountTitle, { color: theme.colors.text }]}>Google Drive</Text>
                <Text style={[styles.accountSubtitle, { color: theme.colors.textSecondary }]}>
                  {driveStatusLabel}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.accountAction,
                {
                  backgroundColor: isDriveConnected ? theme.colors.surface : theme.colors.primary,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={isDriveConnected ? onDisconnectDrive : onConnectDrive}
              disabled={disableDriveConnect}
            >
              <Text style={[
                styles.accountActionText,
                { color: isDriveConnected ? theme.colors.primary : '#FFFFFF' },
              ]}>
                {isDriveConnected ? 'Disconnect' : isGoogleDriveAvailable ? 'Add account' : 'Unavailable'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Cloud Backup</Text>
          <Text style={[styles.sectionHint, { color: theme.colors.textSecondary }]}>
            {isGoogleDriveAvailable
              ? 'Creates a full JSON snapshot and uploads it directly to Google Drive.'
              : 'Cloud backup is unavailable until Google Drive authentication is available in this build.'}
          </Text>
          <BackupActionButton
            icon={<UploadCloud size={20} color="#FFFFFF" />}
            label="Backup to Google Drive"
            onPress={onBackupToGoogleDrive}
            disabled={disableDriveTransfer}
            containerStyle={{ backgroundColor: theme.colors.primary }}
          />
          <BackupActionButton
            icon={<DownloadCloud size={20} color={theme.colors.primary} />}
            label="Restore from Google Drive"
            onPress={onRestoreFromGoogleDrive}
            disabled={disableDriveTransfer}
            containerStyle={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
            textColor={theme.colors.primary}
          />

          <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: theme.colors.text }]}>Local Backup</Text>
          <Text style={[styles.sectionHint, { color: theme.colors.textSecondary }]}>
            Full app snapshot including accounts, budgets, goals, notes, and settings.
          </Text>
          <BackupActionButton
            icon={<Download size={20} color={theme.colors.primary} />}
            label="Export Full Backup JSON"
            onPress={onExportData}
            disabled={isProcessing}
            containerStyle={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
            textColor={theme.colors.primary}
          />
          <BackupActionButton
            icon={<Database size={20} color={theme.colors.primary} />}
            label="Import Full Backup JSON"
            onPress={onImportData}
            disabled={isProcessing}
            containerStyle={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
            textColor={theme.colors.primary}
          />

          <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: theme.colors.text }]}>Transactions Export</Text>
          <Text style={[styles.sectionHint, { color: theme.colors.textSecondary }]}>
            Export month-to-date, last month, year-to-date, last year, or totals only as CSV or Excel.
          </Text>
          <BackupActionButton
            icon={<Download size={20} color={theme.colors.primary} />}
            label="Export Transactions CSV / Excel"
            onPress={onExportCsv}
            disabled={isProcessing}
            containerStyle={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
            textColor={theme.colors.primary}
          />
          <BackupActionButton
            icon={<Database size={20} color={theme.colors.primary} />}
            label="Import Transactions CSV"
            onPress={onImportCsv}
            disabled={isProcessing}
            containerStyle={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
            textColor={theme.colors.primary}
          />

          <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: theme.colors.text }]}>Backup History</Text>
          {backupHistory.length === 0 ? (
            <Text style={[styles.emptyHistoryText, { color: theme.colors.textSecondary }]}>
              No backup entries yet.
            </Text>
          ) : (
            backupHistory.map((item) => (
              <View key={item.timestamp} style={styles.historyRow}>
                <Text style={[styles.historyDate, { color: theme.colors.textSecondary }]}>
                  {formatDateTimeWithWeekday(new Date(item.timestamp))}
                </Text>
                <TouchableOpacity
                  onPress={() => onRestoreHistoryItem?.(item)}
                  disabled={!onRestoreHistoryItem || isProcessing}
                >
                  <Text style={[styles.historyAction, { color: theme.colors.primary }]}>Restore</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
});

BackupRestoreModal.displayName = 'BackupRestoreModal';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 56,
  },
  content: {
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  statusSuccess: {
    backgroundColor: '#E8F5E9',
  },
  statusError: {
    backgroundColor: '#FFEBEE',
  },
  statusInfo: {
    backgroundColor: '#E3F2FD',
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12,
    marginTop: -2,
    marginBottom: 8,
    lineHeight: 16,
  },
  sectionSpacing: {
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 7,
    marginVertical: 4,
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountText: {
    flex: 1,
  },
  accountTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  accountSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  accountAction: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  accountActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHistoryText: {
    fontSize: 13,
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  historyDate: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  historyAction: {
    fontSize: 13,
    fontWeight: '600',
  },
});






