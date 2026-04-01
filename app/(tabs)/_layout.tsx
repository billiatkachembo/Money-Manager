import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Home, List, BarChart3, User, Calendar, CreditCard, FileText, Target, LucideIcon } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/store/theme-store';
import { AppTab, useTabNavigationStore } from '@/store/tab-navigation-store';
import { useI18n } from '@/src/i18n';

import HomeScreen from './home';
import TransactionsScreen from './transactions';
import AnalyticsScreen from './analytics';
import ProfileScreen from './profile';
import CalendarScreen from './calendar';
import AccountsScreen from './accounts';
import NotesScreen from './notes';
import PlanningScreen from './planning';

interface TabItem {
  key: AppTab;
  title: string;
  icon: LucideIcon;
  component: React.ComponentType;
}

export default function TabLayout() {
  const activeTab = useTabNavigationStore((state) => state.activeTab);
  const setActiveTab = useTabNavigationStore((state) => state.setActiveTab);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useI18n();

  const topTabs: TabItem[] = [
    { key: 'accounts', title: t('tabs.accounts'), icon: CreditCard, component: AccountsScreen },
    { key: 'analytics', title: t('tabs.analytics'), icon: BarChart3, component: AnalyticsScreen },
    { key: 'planning', title: t('tabs.planning'), icon: Target, component: PlanningScreen },
    { key: 'notes', title: t('tabs.notes'), icon: FileText, component: NotesScreen },
  ];

  const bottomTabs: TabItem[] = [
    { key: 'home', title: t('tabs.home'), icon: Home, component: HomeScreen },
    { key: 'transactions', title: t('tabs.transactions'), icon: List, component: TransactionsScreen },
    { key: 'calendar', title: t('tabs.calendar'), icon: Calendar, component: CalendarScreen },
    { key: 'profile', title: t('tabs.profile'), icon: User, component: ProfileScreen },
  ];

  const allTabs = [...topTabs, ...bottomTabs];
  const ActiveComponent = allTabs.find((tab) => tab.key === activeTab)?.component || HomeScreen;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    topNavShell: {
      backgroundColor: theme.colors.background,
      paddingTop: insets.top + 2,
      paddingBottom: 4,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    topNavTrack: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: 4,
    },
    topTabItem: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    activeTopTabItem: {},
    topTabLabel: {
      marginTop: 3,
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    activeTopTabLabel: {
      color: theme.colors.primary,
    },
    topActiveIndicator: {
      marginTop: 4,
      width: 18,
      height: 3,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    content: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    bottomNavShell: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 6,
      paddingBottom: Math.max(insets.bottom, 8),
      paddingHorizontal: 10,
    },
    bottomNavRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    bottomTabItem: {
      flex: 1,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    activeBottomTabItem: {},
    bottomTabLabel: {
      marginTop: 3,
      fontSize: 10,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    activeBottomTabLabel: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    bottomActiveIndicator: {
      marginTop: 4,
      width: 18,
      height: 3,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    transactionIconImage: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
  });

  const renderTopTab = (tab: TabItem) => {
    const isActive = activeTab === tab.key;
    const IconComponent = tab.icon;

    return (
      <TouchableOpacity
        key={tab.key}
        style={[styles.topTabItem, isActive && styles.activeTopTabItem]}
        onPress={() => setActiveTab(tab.key)}
        activeOpacity={0.88}
      >
        <IconComponent
          size={17}
          color={isActive ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text
          style={[styles.topTabLabel, isActive && styles.activeTopTabLabel]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {tab.title}
        </Text>
        {isActive ? <View style={styles.topActiveIndicator} /> : null}
      </TouchableOpacity>
    );
  };

  const renderBottomTab = (tab: TabItem) => {
    const isActive = activeTab === tab.key;
    const IconComponent = tab.icon;

    return (
      <TouchableOpacity
        key={tab.key}
        style={[styles.bottomTabItem, isActive && styles.activeBottomTabItem]}
        onPress={() => setActiveTab(tab.key)}
        activeOpacity={0.88}
      >
        {tab.key === 'transactions' ? (
        <Image
          source={require('../../assets/images/icon.png')}
          style={[styles.transactionIconImage, { tintColor: isActive ? theme.colors.primary : theme.colors.textSecondary }]}
        />
      ) : (
        <IconComponent
          size={18}
          color={isActive ? theme.colors.primary : theme.colors.textSecondary}
        />
      )}
        <Text
          style={[styles.bottomTabLabel, isActive && styles.activeBottomTabLabel]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {tab.title}
        </Text>
        {isActive ? <View style={styles.bottomActiveIndicator} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.topNavShell}>
        <View style={styles.topNavTrack}>
          {topTabs.map(renderTopTab)}
        </View>
      </View>

      <View style={styles.content}>
        <ActiveComponent />
      </View>

      <View style={styles.bottomNavShell}>
        <View style={styles.bottomNavRow}>
          {bottomTabs.map(renderBottomTab)}
        </View>
      </View>
    </SafeAreaView>
  );
}
