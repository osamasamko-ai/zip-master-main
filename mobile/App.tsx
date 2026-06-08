import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { apiClient, AuthUser } from './src/api/client';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AdminScreen } from './src/screens/AdminScreen';
import { AiChatScreen } from './src/screens/AiChatScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { BillingScreen } from './src/screens/BillingScreen';
import { CasesScreen } from './src/screens/CasesScreen';
import { CaseStoreScreen } from './src/screens/CaseStoreScreen';
import { ContractWizardScreen } from './src/screens/ContractWizardScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { FollowingScreen } from './src/screens/FollowingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { IntelligenceScreen } from './src/screens/IntelligenceScreen';
import { LawyersScreen } from './src/screens/LawyersScreen';
import { LegalActionPlanScreen } from './src/screens/LegalActionPlanScreen';
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

type PrimaryRouteKey = 'home' | 'plan' | 'lawyers' | 'cases' | 'pro' | 'caseStore' | 'admin';
type TabKey = PrimaryRouteKey | 'more';
type RouteKey = TabKey | MoreRoute | 'profile';
type TabItem = { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap };

const primaryTabConfig: Record<PrimaryRouteKey, TabItem> = {
  home: { key: 'home', label: 'لوحتي', icon: 'home-outline', activeIcon: 'home' },
  plan: { key: 'plan', label: 'خطتي', icon: 'git-branch-outline', activeIcon: 'git-branch' },
  lawyers: { key: 'lawyers', label: 'ابحث', icon: 'people-outline', activeIcon: 'people' },
  cases: { key: 'cases', label: 'ملفاتي', icon: 'briefcase-outline', activeIcon: 'briefcase' },
  pro: { key: 'pro', label: 'مكتبي', icon: 'business-outline', activeIcon: 'business' },
  caseStore: { key: 'caseStore', label: 'فرص', icon: 'trophy-outline', activeIcon: 'trophy' },
  admin: { key: 'admin', label: 'تحكم', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
};

const moreTab: TabItem = {
  key: 'more',
  label: 'الخدمات',
  icon: 'grid-outline',
  activeIcon: 'grid',
};

const chromeHideThreshold = 18;

function getPrimaryRoutesForRole(role: AuthUser['role']): PrimaryRouteKey[] {
  if (role === 'admin') return ['home', 'cases', 'lawyers', 'admin'];
  if (role === 'pro') return ['home', 'cases', 'lawyers', 'pro'];
  return ['home', 'plan', 'cases', 'lawyers'];
}

function Shell() {
  const { user } = useAuth();
  const [activeRoute, setActiveRoute] = useState<RouteKey>('home');
  const [chromeHidden, setChromeHidden] = useState(false);
  const touchStartY = useRef(0);
  const chromeProgress = useRef(new Animated.Value(0)).current;
  const primaryRoutes = useMemo(() => (user ? getPrimaryRoutesForRole(user.role) : []), [user?.role]);
  const tabs = useMemo(() => [...primaryRoutes.map((route) => primaryTabConfig[route]), moreTab], [primaryRoutes]);
  const tabKeys = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs]);
  const hasTopBar = !tabKeys.has(activeRoute as TabKey);

  const setChromeVisibility = (hidden: boolean) => {
    setChromeHidden((current) => {
      if (current === hidden) return current;
      Animated.timing(chromeProgress, {
        duration: 210,
        toValue: hidden ? 1 : 0,
        useNativeDriver: true,
      }).start();
      return hidden;
    });
  };

  useEffect(() => {
    if (!user) return undefined;
    const timer = setTimeout(() => {
      void Promise.allSettled([
        apiClient.getDashboard(),
        apiClient.getWorkspaceCases(),
        apiClient.getLawyers(),
        apiClient.getFeedPosts('all', { limit: 8, offset: 0 }),
        apiClient.getFeedStories('all'),
        apiClient.getIntelligence(),
      ]);
    }, 450);

    return () => clearTimeout(timer);
  }, [user?.id]);

  useEffect(() => {
    setChromeVisibility(false);
  }, [activeRoute]);

  if (!user) return <AuthScreen />;

  return (
    <SafeAreaView style={styles.safeArea}>
      {hasTopBar ? (
        <Animated.View
          pointerEvents={chromeHidden ? 'none' : 'auto'}
          style={[
            styles.topBar,
            {
              opacity: chromeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ translateY: chromeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -62] }) }],
            },
          ]}
        >
          <Pressable onPress={() => setActiveRoute('more')} style={styles.backButton}>
            <Ionicons name="chevron-forward" size={20} color={colors.navy} />
            <Text style={styles.backText}>رجوع</Text>
          </Pressable>
          <View style={styles.brandLockup}>
            <View style={styles.brandMark}>
              <FontAwesome5 name="balance-scale" size={14} color={colors.gold} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandTitle}>القسطاس</Text>
              <Text style={styles.brandSubtitle}>Smart Legal Platform</Text>
            </View>
          </View>
        </Animated.View>
      ) : null}
      <View
        onTouchMove={(event) => {
          const dy = event.nativeEvent.pageY - touchStartY.current;
          if (dy < -chromeHideThreshold) setChromeVisibility(true);
          if (dy > chromeHideThreshold) setChromeVisibility(false);
        }}
        onTouchStart={(event) => {
          touchStartY.current = event.nativeEvent.pageY;
        }}
        style={[styles.content, hasTopBar && !chromeHidden && styles.contentWithTopBar, !chromeHidden && styles.contentWithTabBar]}
      >
        {renderScreen(activeRoute, user, setActiveRoute, primaryRoutes)}
      </View>
      <Animated.View
        pointerEvents={chromeHidden ? 'none' : 'auto'}
        style={[
          styles.tabBar,
          {
            opacity: chromeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ translateY: chromeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 96] }) }],
          },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeRoute === tab.key || (tab.key === 'more' && !tabKeys.has(activeRoute as TabKey));
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
      </Animated.View>
    </SafeAreaView>
  );
}

function renderScreen(route: RouteKey, user: AuthUser, setRoute: (route: RouteKey) => void, primaryRoutes: PrimaryRouteKey[]) {
  switch (route) {
    case 'lawyers':
      return <LawyersScreen onOpen={setRoute} />;
    case 'plan':
      return <LegalActionPlanScreen onOpen={setRoute} />;
    case 'cases':
      return <CasesScreen />;
    case 'ai':
      return <AiChatScreen />;
    case 'messages':
      return <MessagesScreen />;
    case 'more':
      return <MoreScreen user={user} primaryRoutes={primaryRoutes} onOpen={setRoute} />;
    case 'feed':
      return <FeedScreen onOpen={setRoute} />;
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
    case 'caseStore':
      return <CaseStoreScreen onOpen={setRoute} />;
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
  contentWithTabBar: {
    paddingBottom: 76,
  },
  contentWithTopBar: {
    paddingTop: 54,
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
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
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
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
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
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 9,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    width: 36,
  },
  brandText: {
    alignItems: 'flex-end',
  },
  brandTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  brandSubtitle: {
    color: colors.subtle,
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 11,
    textTransform: 'uppercase',
  },
});
