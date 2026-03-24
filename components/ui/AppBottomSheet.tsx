import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  maxHeight?: number;
  actions?: AppBottomSheetAction[];
  footer?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

function resolveSnapPoint(value: string | number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(280, Math.min(SCREEN_HEIGHT, value));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.endsWith('%')) {
      const percentage = Number.parseFloat(trimmed.slice(0, -1));
      if (Number.isFinite(percentage)) {
        return Math.max(280, Math.min(SCREEN_HEIGHT, (percentage / 100) * SCREEN_HEIGHT));
      }
    }

    const absolute = Number.parseFloat(trimmed);
    if (Number.isFinite(absolute)) {
      return Math.max(280, Math.min(SCREEN_HEIGHT, absolute));
    }
  }

  return Math.round(SCREEN_HEIGHT * 0.6);
}

export function AppBottomSheet({
  visible,
  title,
  snapPoints,
  initialSnapIndex = 0,
  maxHeight,
  actions,
  footer,
  onClose,
  children,
}: AppBottomSheetProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const resolvedSnapPoints = useMemo(() => snapPoints ?? ['45%', '75%'], [snapPoints]);
  const sheetHeight = useMemo(() => {
    const preferred = resolvedSnapPoints[Math.min(initialSnapIndex, resolvedSnapPoints.length - 1)];
    const resolvedHeight = resolveSnapPoint(preferred);
    return typeof maxHeight === 'number' && Number.isFinite(maxHeight)
      ? Math.max(0, Math.min(resolvedHeight, maxHeight))
      : resolvedHeight;
  }, [initialSnapIndex, maxHeight, resolvedSnapPoints]);

  const translateY = useRef(new Animated.Value(sheetHeight + 48)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const headerBackground = theme.isDark ? '#0B1120' : '#0F172A';
  const headerText = '#F8FAFC';

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(sheetHeight + 48);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          mass: 0.9,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!mounted) {
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: sheetHeight + 48,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [backdropOpacity, mounted, sheetHeight, translateY, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}> 
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.header, { backgroundColor: headerBackground }]}> 
            <Text style={[styles.title, { color: headerText }]}>{title}</Text>
            <View style={styles.actionRow}>
              {(actions ?? []).map((action, index) => {
                const Icon = action.icon;
                return (
                  <Pressable
                    key={`${title}-action-${index}`}
                    onPress={action.onPress}
                    accessibilityLabel={action.accessibilityLabel}
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                  >
                    <Icon size={18} color={headerText} />
                  </Pressable>
                );
              })}
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close"
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              >
                <X size={18} color={headerText} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.content}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
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
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionButtonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  divider: {
    height: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
