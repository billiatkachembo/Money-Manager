import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';

export interface AppBottomSheetAction {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface AppBottomSheetProps {
  visible: boolean;
  title: string;
  snapPoints?: Array<string | number>;
  initialSnapIndex?: number;
  actions?: AppBottomSheetAction[];
  footer?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

export function AppBottomSheet({
  visible,
  title,
  snapPoints,
  initialSnapIndex = 0,
  actions,
  footer,
  onClose,
  children,
}: AppBottomSheetProps) {
  const { theme } = useTheme();
  const resolvedSnapPoints = useMemo(() => snapPoints ?? ['45%', '75%'], [snapPoints]);
  const headerBackground = theme.isDark ? '#0B1120' : '#0F172A';
  const headerText = '#F8FAFC';

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index < 0) {
        onClose();
      }
    },
    [onClose]
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      >
        <BlurView
          intensity={theme.isDark ? 32 : 18}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </BottomSheetBackdrop>
    ),
    [theme.isDark]
  );

  return (
    <BottomSheet
      index={visible ? initialSnapIndex : -1}
      snapPoints={resolvedSnapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBackground, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
    >
      <View style={[styles.header, { backgroundColor: headerBackground }]}
      >
        <Text style={[styles.title, { color: headerText }]}>{title}</Text>
        <View style={styles.actionRow}>
          {(actions ?? []).map((action, index) => {
            const Icon = action.icon;
            return (
              <Pressable
                key={`${title}-action-${index}`}
                onPress={action.onPress}
                accessibilityLabel={action.accessibilityLabel}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Icon size={18} color={headerText} />
              </Pressable>
            );
          })}
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <X size={18} color={headerText} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionButtonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});

