import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
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

const appFontRegular = 'IBMPlexSansArabic_400Regular';
const appFontMedium = 'IBMPlexSansArabic_500Medium';
const appFontSemiBold = 'IBMPlexSansArabic_600SemiBold';
const appFontBold = 'IBMPlexSansArabic_700Bold';

function fontForWeight(weight?: TextStyle['fontWeight']) {
  const numericWeight = Number(weight);

  if (numericWeight >= 700 || weight === 'bold') return appFontBold;
  if (numericWeight >= 600) return appFontSemiBold;
  if (numericWeight >= 500) return appFontMedium;
  return appFontRegular;
}

function withAppFont(style: unknown) {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;

  if (flattened?.fontFamily) {
    return style;
  }

  const fontFamily = fontForWeight(flattened?.fontWeight);

  return [style, { fontFamily, fontWeight: 'normal' as const }];
}

function applyDefaultFont(Component: typeof Text | typeof TextInput) {
  const componentWithRender = Component as unknown as {
    render?: (props: Record<string, unknown>, ref: unknown) => React.ReactElement;
  };
  const originalRender = componentWithRender.render;

  if (!originalRender) return;

  componentWithRender.render = function renderWithAppFont(props, ref) {
    return originalRender.call(this, { ...props, style: withAppFont(props?.style) }, ref);
  };
}

applyDefaultFont(Text);
applyDefaultFont(TextInput);

type TabKey = 'home' | 'lawyers' | 'cases' | 'ai' | 'messages' | 'more';
type RouteKey = TabKey | MoreRoute | 'profile';

const tabs: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'الرئيسية', icon: 'home-outline', activeIcon: 'home' },
  { key: 'lawyers', label: 'المحامين', icon: 'people-outline', activeIcon: 'people' },
  { key: 'cases', label: 'القضايا', icon: 'briefcase-outline', activeIcon: 'briefcase' },
  { key: 'ai', label: 'الذكاء', icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { key: 'messages', label: 'الرسائل', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  { key: 'more', label: 'المزيد', icon: 'grid-outline', activeIcon: 'grid' },
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
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              hitSlop={6}
              onPress={() => setActiveRoute(tab.key)}
              style={({ pressed }) => [styles.tab, isActive && styles.activeTab, pressed && styles.pressedTab]}
            >
              <View style={[styles.tabIconWrap, isActive && styles.activeTabIconWrap]}>
                <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={isActive ? 21 : 20} color={isActive ? colors.navy : colors.muted} />
              </View>
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
      return <LawyersScreen onOpen={setRoute} />;
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
      return <ProfileScreen onOpen={setRoute} />;
    case 'home':
    default:
      return <HomeScreen onOpen={setRoute} />;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaProvider>
    );
  }

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
  loading: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderTopWidth: 1,
    elevation: 14,
    flexDirection: 'row-reverse',
    gap: 3,
    paddingBottom: 9,
    paddingHorizontal: 8,
    paddingTop: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  activeTab: {
    backgroundColor: colors.blueTint,
  },
  pressedTab: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  tabIconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 31,
    justifyContent: 'center',
    width: 44,
  },
  activeTabIconWrap: {
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.paper,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: '800',
    lineHeight: 14,
    maxWidth: 58,
    textAlign: 'center',
  },
  activeTabLabel: {
    color: colors.navy,
    fontWeight: '900',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
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
