import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AiChatScreen } from './src/screens/AiChatScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { CasesScreen } from './src/screens/CasesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LawyersScreen } from './src/screens/LawyersScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { colors } from './src/theme/colors';

type TabKey = 'home' | 'lawyers' | 'cases' | 'ai' | 'messages' | 'profile';

const tabs: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'الرئيسية', icon: 'home-outline' },
  { key: 'lawyers', label: 'المحامين', icon: 'people-outline' },
  { key: 'cases', label: 'القضايا', icon: 'briefcase-outline' },
  { key: 'ai', label: 'الذكاء', icon: 'sparkles-outline' },
  { key: 'messages', label: 'الرسائل', icon: 'chatbubbles-outline' },
  { key: 'profile', label: 'حسابي', icon: 'person-outline' },
];

function Shell() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  if (!user) return <AuthScreen />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>{renderScreen(activeTab)}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tab}>
              <Ionicons name={tab.icon} size={22} color={isActive ? colors.gold : colors.muted} />
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function renderScreen(tab: TabKey) {
  switch (tab) {
    case 'lawyers':
      return <LawyersScreen />;
    case 'cases':
      return <CasesScreen />;
    case 'ai':
      return <AiChatScreen />;
    case 'messages':
      return <MessagesScreen />;
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
});

