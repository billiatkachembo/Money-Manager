import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { FileText, Plus } from 'lucide-react-native';
import { TransactionProvider, useTransactionStore } from '@/store/transaction-store';
import { ThemeProvider, useTheme } from '@/store/theme-store';
import { useQuickActionsStore } from '@/store/quick-actions-store';
import { useTabNavigationStore } from '@/store/tab-navigation-store';
import {
  disableDailyReminderAsync,
  disableQuickAddNotificationAsync,
  enableDailyReminderAsync,
  enableQuickAddNotificationAsync,
  QUICK_ADD_ACTION_ID,
  QUICK_ADD_NOTIFICATION_SOURCE,
  QUICK_SEARCH_ACTION_ID,
  QUICK_TRANSACTIONS_ACTION_ID,
} from '@/src/notifications/quick-add-notification';
import { AppTooltipHost } from '@/components/ui/AppTooltipHost';
import { installAlertTooltipBridge } from '@/src/ui/alert-tooltip-bridge';
import { showAppTooltip } from '@/store/app-tooltip-store';

SplashScreen.preventAutoHideAsync();


function QuickAddNotificationManager() {
  if (Platform.OS === 'web') {
    return null;
  }

  const lastHandledId = useRef<string | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const { theme } = useTheme();
  const { settings, isHydrated } = useTransactionStore();
  const { triggerQuickAdd, triggerSearch } = useQuickActionsStore();
  const setActiveTab = useTabNavigationStore((state) => state.setActiveTab);
  const openNotesComposer = useTabNavigationStore((state) => state.openNotesComposer);

  const clearLastResponse = useCallback(() => {
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, []);

  const closeQuickCreate = useCallback(() => {
    setShowQuickCreate(false);
  }, []);

  const handleOpenTransaction = useCallback(() => {
    setShowQuickCreate(false);
    setActiveTab('home');
    triggerQuickAdd();
    clearLastResponse();
  }, [clearLastResponse, setActiveTab, triggerQuickAdd]);

  const handleOpenNote = useCallback(() => {
    setShowQuickCreate(false);
    openNotesComposer();
    clearLastResponse();
  }, [clearLastResponse, openNotesComposer]);

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as { source?: string } | undefined;
    if (data?.source !== QUICK_ADD_NOTIFICATION_SOURCE) {
      return;
    }

    const actionId = response.actionIdentifier;
    const requestId = response.notification.request.identifier;
    const responseKey = `${requestId}:${actionId}`;
    if (lastHandledId.current === responseKey) {
      return;
    }
    lastHandledId.current = responseKey;

    if (actionId === QUICK_SEARCH_ACTION_ID) {
      setShowQuickCreate(false);
      setActiveTab('transactions');
      triggerSearch();
      clearLastResponse();
      return;
    }

    if (actionId === QUICK_TRANSACTIONS_ACTION_ID) {
      setShowQuickCreate(false);
      setActiveTab('transactions');
      clearLastResponse();
      return;
    }

    if (actionId === QUICK_ADD_ACTION_ID) {
      setShowQuickCreate(true);
      clearLastResponse();
      return;
    }

    if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      setShowQuickCreate(false);
      setActiveTab('home');
      clearLastResponse();
    }
  }, [clearLastResponse, setActiveTab, triggerSearch]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (settings.quickAddNotificationEnabled) {
      void enableQuickAddNotificationAsync({ requestPermission: false });
      return;
    }

    setShowQuickCreate(false);
    void disableQuickAddNotificationAsync();
  }, [isHydrated, settings.quickAddNotificationEnabled]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (settings.dailyReminderEnabled) {
      const reminderTime = settings.dailyReminderTime ?? '18:00';
      void enableDailyReminderAsync(reminderTime, { requestPermission: false });
      return;
    }

    void disableDailyReminderAsync();
  }, [isHydrated, settings.dailyReminderEnabled, settings.dailyReminderTime]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [handleResponse]);

  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (lastResponse) {
      handleResponse(lastResponse);
    }
  }, [handleResponse, lastResponse]);

  return (
    <>
      <Modal transparent visible={showQuickCreate} animationType="fade" onRequestClose={closeQuickCreate}>
        <Pressable style={styles.quickCreateBackdrop} onPress={closeQuickCreate}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.quickCreateSheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.isDark ? '#000000' : '#0f172a',
              },
            ]}
          >
            <Text style={[styles.quickCreateEyebrow, { color: theme.colors.primary }]}>Quick Add</Text>
            <Text style={[styles.quickCreateTitle, { color: theme.colors.text }]}>Choose what you want to create</Text>
            <Text style={[styles.quickCreateSubtitle, { color: theme.colors.textSecondary }]}>Use the notification shortcuts like a tiny launcher for the app.</Text>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenTransaction}
              style={[styles.quickCreateAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
            >
              <View style={[styles.quickCreateIconWrap, { backgroundColor: theme.colors.primary + '14' }]}>
                <Plus size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.quickCreateActionText}>
                <Text style={[styles.quickCreateActionTitle, { color: theme.colors.text }]}>Add transaction</Text>
                <Text style={[styles.quickCreateActionSubtitle, { color: theme.colors.textSecondary }]}>Open the transaction form right away.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenNote}
              style={[styles.quickCreateAction, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
            >
              <View style={[styles.quickCreateIconWrap, { backgroundColor: theme.colors.primary + '14' }]}>
                <FileText size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.quickCreateActionText}>
                <Text style={[styles.quickCreateActionTitle, { color: theme.colors.text }]}>Add note</Text>
                <Text style={[styles.quickCreateActionSubtitle, { color: theme.colors.textSecondary }]}>Jump straight into a new note.</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type WebRuntimeBridge = typeof globalThis & {
  location?: {
    href: string;
    pathname: string;
    search: string;
    hash: string;
  };
  history?: {
    replaceState: (data: unknown, unused: string, url?: string | URL | null) => void;
  };
  document?: {
    title?: string;
  };
};

type PcManagerHandoffPayload = {
  themeMode?: 'system' | 'light' | 'dark';
  settings?: {
    currency?: string;
    language?: string;
  };
  userProfile?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    occupation?: string;
    joinDate?: string;
    avatar?: string;
  };
};

function WebPcManagerHandoffManager() {
  const appliedRef = useRef(false);
  const { userProfile, updateSettings, updateUserProfile } = useTransactionStore();
  const { setThemeMode } = useTheme();

  useEffect(() => {
    const webRuntime = globalThis as WebRuntimeBridge;

    if (Platform.OS !== 'web' || !webRuntime.location?.href || appliedRef.current) {
      return;
    }

    let currentUrl: URL;

    try {
      currentUrl = new URL(webRuntime.location.href);
    } catch (error) {
      return;
    }

    const rawPayload = currentUrl.searchParams.get('pc_manager_handoff');
    if (!rawPayload) {
      return;
    }

    appliedRef.current = true;

    try {
      const payload = JSON.parse(rawPayload) as PcManagerHandoffPayload;
      const nextSettings: Record<string, string> = {};

      if (typeof payload.settings?.currency === 'string' && payload.settings.currency.trim()) {
        nextSettings.currency = payload.settings.currency.trim().toUpperCase();
      }

      if (typeof payload.settings?.language === 'string' && payload.settings.language.trim()) {
        nextSettings.language = payload.settings.language.trim().toLowerCase();
      }

      if (Object.keys(nextSettings).length > 0) {
        updateSettings(nextSettings);
      }

      if (payload.userProfile) {
        const parsedJoinDate = payload.userProfile.joinDate ? new Date(payload.userProfile.joinDate) : userProfile.joinDate;
        const safeJoinDate = Number.isNaN(parsedJoinDate.getTime()) ? userProfile.joinDate : parsedJoinDate;

        updateUserProfile({
          ...userProfile,
          ...(typeof payload.userProfile.name === 'string' ? { name: payload.userProfile.name } : {}),
          ...(typeof payload.userProfile.email === 'string' ? { email: payload.userProfile.email } : {}),
          ...(typeof payload.userProfile.phone === 'string' ? { phone: payload.userProfile.phone } : {}),
          ...(typeof payload.userProfile.location === 'string' ? { location: payload.userProfile.location } : {}),
          ...(typeof payload.userProfile.occupation === 'string' ? { occupation: payload.userProfile.occupation } : {}),
          ...(typeof payload.userProfile.avatar === 'string' ? { avatar: payload.userProfile.avatar } : {}),
          joinDate: safeJoinDate,
        });
      }

      if (payload.themeMode === 'system' || payload.themeMode === 'light' || payload.themeMode === 'dark') {
        setThemeMode(payload.themeMode);
      }

      showAppTooltip({
        tone: 'success',
        title: 'PC Manager',
        message: 'Your profile and preferences are ready on web.',
      });
    } catch (error) {
      // Ignore malformed handoff payloads and just clear the parameter below.
    }

    currentUrl.searchParams.delete('pc_manager_handoff');
    const cleanedPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` || '/';
    webRuntime.history?.replaceState({}, webRuntime.document?.title ?? '', cleanedPath);
  }, [setThemeMode, updateSettings, updateUserProfile, userProfile]);

  return null;
}

function RootLayoutNav() {
  const { theme } = useTheme();

  useEffect(() => installAlertTooltipBridge(), []);

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <WebPcManagerHandoffManager />
      <QuickAddNotificationManager />
      <Stack initialRouteName="index" screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <AppTooltipHost />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  quickCreateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  quickCreateSheet: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  quickCreateEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  quickCreateTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  quickCreateSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 18,
  },
  quickCreateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  quickCreateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  quickCreateActionText: {
    flex: 1,
  },
  quickCreateActionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  quickCreateActionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <TransactionProvider>
        <GestureHandlerRootView style={styles.container}>
          <BottomSheetModalProvider>
            <RootLayoutNav />
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </TransactionProvider>
    </ThemeProvider>
  );
}