import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { TransactionProvider, useTransactionStore } from "@/store/transaction-store";
import { ThemeProvider, useTheme } from "@/store/theme-store";
import { useQuickActionsStore } from "@/store/quick-actions-store";
import {
  disableDailyReminderAsync,
  disableQuickAddNotificationAsync,
  enableDailyReminderAsync,
  enableQuickAddNotificationAsync,
  QUICK_ADD_ACTION_ID,
  QUICK_ADD_NOTIFICATION_SOURCE,
  QUICK_SEARCH_ACTION_ID,
} from "@/src/notifications/quick-add-notification";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function QuickAddNotificationManager() {
  const router = useRouter();
  const segments = useSegments();
  const lastHandledId = useRef<string | null>(null);
  const { settings, isHydrated } = useTransactionStore();
  const { triggerQuickAdd, triggerSearch } = useQuickActionsStore();

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as { source?: string } | undefined;
    if (data?.source !== QUICK_ADD_NOTIFICATION_SOURCE) {
      return;
    }

    const actionId = response.actionIdentifier;
    const shouldSearch = actionId === QUICK_SEARCH_ACTION_ID;
    const shouldQuickAdd =
      actionId === QUICK_ADD_ACTION_ID || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER;

    if (!shouldSearch && !shouldQuickAdd) {
      return;
    }

    const requestId = response.notification.request.identifier;
    if (lastHandledId.current === requestId && actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    lastHandledId.current = requestId;

    if (shouldSearch) {
      triggerSearch();
      if (segments[0] !== '(tabs)' || segments[1] !== 'transactions') {
        router.replace('/(tabs)/transactions');
      }
    } else {
      triggerQuickAdd();
      if (segments[0] !== '(tabs)' || segments[1] !== 'home') {
        router.replace('/(tabs)/home');
      }
    }

    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [router, segments, triggerQuickAdd, triggerSearch]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (settings.quickAddNotificationEnabled) {
      void enableQuickAddNotificationAsync({ requestPermission: false });
      return;
    }

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

  return null;
}

function RootLayoutNav() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <QuickAddNotificationManager />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TransactionProvider>
            <GestureHandlerRootView style={styles.container}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </TransactionProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}










