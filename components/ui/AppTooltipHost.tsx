import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react-native';
import { useTheme } from '@/store/theme-store';
import { AppTooltipItem, AppTooltipTone, useAppTooltipStore } from '@/store/app-tooltip-store';

const tonePalette = (
  tone: AppTooltipTone,
  isDark: boolean,
  colors: {
    primary: string;
    success: string;
    warning: string;
    error: string;
    text: string;
    textSecondary: string;
  }
) => {
  switch (tone) {
    case 'success':
      return {
        accent: colors.success,
        backgroundColor: isDark ? '#052E16' : '#ECFDF5',
        borderColor: isDark ? '#166534' : '#A7F3D0',
        Icon: CheckCircle,
      };
    case 'warning':
      return {
        accent: colors.warning,
        backgroundColor: isDark ? '#3A2A08' : '#FFFBEB',
        borderColor: isDark ? '#854D0E' : '#FDE68A',
        Icon: AlertTriangle,
      };
    case 'error':
      return {
        accent: colors.error,
        backgroundColor: isDark ? '#3B0A0A' : '#FEF2F2',
        borderColor: isDark ? '#991B1B' : '#FECACA',
        Icon: AlertTriangle,
      };
    case 'info':
    default:
      return {
        accent: colors.primary,
        backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
        borderColor: isDark ? '#334155' : '#CBD5E1',
        Icon: Info,
      };
  }
};

export function AppTooltipHost() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const current = useAppTooltipStore((state) => state.current);
  const dismissTooltip = useAppTooltipStore((state) => state.dismissTooltip);
  const [renderedTooltip, setRenderedTooltip] = useState<AppTooltipItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (current) {
      setRenderedTooltip(current);
      opacity.setValue(0);
      translateY.setValue(16);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      timeout = setTimeout(() => {
        dismissTooltip();
      }, current.durationMs);
    } else if (renderedTooltip) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 16,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRenderedTooltip(null);
      });
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [current, dismissTooltip, opacity, renderedTooltip, translateY]);

  const palette = useMemo(() => {
    if (!renderedTooltip) {
      return null;
    }

    return tonePalette(renderedTooltip.tone, theme.isDark, {
      primary: theme.colors.primary,
      success: theme.colors.success,
      warning: theme.colors.warning,
      error: theme.colors.error,
      text: theme.colors.text,
      textSecondary: theme.colors.textSecondary,
    });
  }, [renderedTooltip, theme.colors.error, theme.colors.primary, theme.colors.success, theme.colors.text, theme.colors.textSecondary, theme.colors.warning, theme.isDark]);

  if (!renderedTooltip || !palette) {
    return null;
  }

  const Icon = palette.Icon;

  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      visible
      onRequestClose={dismissTooltip}
    >
      <View pointerEvents="box-none" style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              marginBottom: Math.max(insets.bottom, 16),
              backgroundColor: palette.backgroundColor,
              borderColor: palette.borderColor,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Pressable onPress={dismissTooltip} style={styles.cardInner}>
            <View style={[styles.iconWrap, { borderColor: palette.accent + '33' }]}>
              <Icon size={18} color={palette.accent} />
            </View>
            <View style={styles.copyWrap}>
              {renderedTooltip.title ? (
                <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                  {renderedTooltip.title}
                </Text>
              ) : null}
              <Text style={[styles.message, { color: theme.colors.textSecondary }]}> 
                {renderedTooltip.message}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 14,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
});
