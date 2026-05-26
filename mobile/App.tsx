import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthUser } from './src/api/client';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AdminScreen } from './src/screens/AdminScreen';
import { AiChatScreen } from './src/screens/AiChatScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { BillingScreen } from './src/screens/BillingScreen';
import { CasesScreen } from './src/screens/CasesScreen';
import { ContractWizardScreen } from './src/screens/ContractWizardScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { FollowingScreen } from './src/screens/FollowingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { IntelligenceScreen } from './src/screens/IntelligenceScreen';
import { LawyersScreen } from './src/screens/LawyersScreen';
import { LegalDocsScreen } from './src/screens/LegalDocsScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { MoreRoute, MoreScreen } from './src/screens/MoreScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProWorkspaceScreen } from './src/screens/ProWorkspaceScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { colors } from './src/theme/colors';

type TabKey = 'home' | 'lawyers' | 'cases' | 'ai' | 'messages' | 'more';
type RouteKey = TabKey | MoreRoute | 'profile';

const tabs: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'الرئيسية', icon: 'home-outline' },
  { key: 'lawyers', label: 'المحامين', icon: 'people-outline' },
  { key: 'cases', label: 'القضايا', icon: 'briefcase-outline' },
  { key: 'ai', label: 'الذكاء', icon: 'sparkles-outline' },
  { key: 'messages', label: 'الرسائل', icon: 'chatbubbles-outline' },
  { key: 'more', label: 'المزيد', icon: 'grid-outline' },
];

function Shell() {
  const { user } = useAuth();
  const [activeRoute, setActiveRoute] = useState<RouteKey>('home');

  if (!user) return <AuthScreen />;

  return (
    <SafeAreaView style={styles.safeArea}>
      {!tabs.some((tab) => tab.key === activeRoute) ? (
        <View style={styles.topBar}>
          <Pressable onPress={() => setActiveRoute('more')} style={styles.backButton}>
            <Ionicons name="chevron-forward" size={20} color={colors.navy} />
            <Text style={styles.backText}>رجوع</Text>
          </Pressable>
          <Text style={styles.topTitle}>القسطاس الذكي</Text>
        </View>
      ) : null}
      <View style={styles.content}>{renderScreen(activeRoute, user, setActiveRoute)}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeRoute === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveRoute(tab.key)} style={styles.tab}>
              <Ionicons name={tab.icon} size={22} color={isActive ? colors.gold : colors.muted} />
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function renderScreen(route: RouteKey, user: AuthUser, setRoute: (route: RouteKey) => void) {
  switch (route) {
    case 'lawyers':
      return <LawyersScreen />;
    case 'cases':
      return <CasesScreen />;
    case 'ai':
      return <AiChatScreen />;
    case 'messages':
      return <MessagesScreen />;
    case 'more':
      return <MoreScreen user={user} onOpen={setRoute} />;
    case 'feed':
      return <FeedScreen />;
    case 'legal':
      return <LegalDocsScreen />;
    case 'contract':
      return <ContractWizardScreen />;
    case 'billing':
      return <BillingScreen />;
    case 'following':
      return <FollowingScreen />;
    case 'support':
      return <SupportScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'intelligence':
      return <IntelligenceScreen />;
    case 'pro':
      return <ProWorkspaceScreen />;
    case 'admin':
      return <AdminScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'home':
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Shell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: colors.paper,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row-reverse',
    paddingBottom: 6,
    paddingTop: 8,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: colors.gold,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 4,
  },
  backText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  topTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
});
