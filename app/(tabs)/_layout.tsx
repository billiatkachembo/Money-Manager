import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Home, List, BarChart3, User, Calendar, CreditCard, FileText, Target, LucideIcon } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/store/theme-store';

import HomeScreen from './home';
import TransactionsScreen from './transactions';
import AnalyticsScreen from './analytics';
import ProfileScreen from './profile';
import CalendarScreen from './calendar';
import AccountsScreen from './accounts';
import NotesScreen from './notes';
import PlanningScreen from './planning';

type TabType = 'home' | 'transactions' | 'analytics' | 'profile' | 'calendar' | 'accounts' | 'notes' | 'planning';

interface TabItem {
  key: TabType;
  title: string;
  icon: LucideIcon;
  component: React.ComponentType;
}

const topTabs: TabItem[] = [
  { key: 'home', title: 'Home', icon: Home, component: HomeScreen },
  { key: 'transactions', title: 'Transactions', icon: List, component: TransactionsScreen },
  { key: 'analytics', title: 'Analytics', icon: BarChart3, component: AnalyticsScreen },
  { key: 'profile', title: 'Profile', icon: User, component: ProfileScreen },
];

const bottomTabs: TabItem[] = [
  { key: 'calendar', title: 'Calendar', icon: Calendar, component: CalendarScreen },
  { key: 'accounts', title: 'Accounts', icon: CreditCard, component: AccountsScreen },
  { key: 'notes', title: 'Notes', icon: FileText, component: NotesScreen },
  { key: 'planning', title: 'Planning', icon: Target, component: PlanningScreen },
];

const allTabs = [...topTabs, ...bottomTabs];

export default function TabLayout() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  const ActiveComponent = allTabs.find(tab => tab.key === activeTab)?.component || HomeScreen;
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    topNavContainer: {
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingBottom: 12,
    },
    topTabsGrid: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 16,
      gap: 8,
    },
    topTabItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    activeTopTabItem: {
      backgroundColor: theme.colors.primary + '10',
      borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    topTabLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    activeTopTabLabel: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    bottomTabsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.isDark ? theme.colors.surface : '#fafbfc',
    },
    bottomTabItem: {
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 14,
      minWidth: 90,
      flex: 1,
      marginHorizontal: 4,
    },
    activeBottomTabItem: {
      backgroundColor: theme.colors.primary + '15',
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    bottomTabLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    activeBottomTabLabel: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
  });
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={[styles.topNavContainer, { paddingTop: insets.top }]}>
        {/* Top 4 Tabs */}
        <View style={styles.topTabsGrid}>
          {topTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const IconComponent = tab.icon;
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.topTabItem,
                  isActive && styles.activeTopTabItem
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <IconComponent 
                  size={22} 
                  color={isActive ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.topTabLabel,
                  isActive && styles.activeTopTabLabel
                ]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Bottom Tabs Row */}
        <View style={styles.bottomTabsContainer}>
          {bottomTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const IconComponent = tab.icon;
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.bottomTabItem,
                  isActive && styles.activeBottomTabItem
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <IconComponent 
                  size={18} 
                  color={isActive ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <Text style={[
                  styles.bottomTabLabel,
                  isActive && styles.activeBottomTabLabel
                ]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        <ActiveComponent />
      </View>
    </SafeAreaView>
  );
}

