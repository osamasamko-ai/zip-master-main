import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthUser } from '../api/client';
import { Screen } from '../components/ui';
import { colors } from '../theme/colors';

export type MoreRoute =
  | 'plan'
  | 'ai'
  | 'messages'
  | 'feed'
  | 'legal'
  | 'contract'
  | 'billing'
  | 'following'
  | 'support'
  | 'settings'
  | 'intelligence'
  | 'pro'
  | 'caseStore'
  | 'admin'
  | 'profile';

type GroupKey = 'all' | 'work' | 'account';

type Item = {
  key: MoreRoute;
  title: string;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
  group: GroupKey;
  roles?: AuthUser['role'][];
};

const items: Item[] = [
  { key: 'plan', title: 'ابنِ خطة قضيتك', note: 'حوّل المشكلة إلى خطوات ومستندات', icon: 'git-branch-outline', group: 'work' },
  { key: 'messages', title: 'تابع المحادثات', note: 'رسائلك مع المحامين والدعم', icon: 'chatbubbles-outline', group: 'work' },
  { key: 'ai', title: 'اسأل المساعد الذكي', note: 'أسئلة قانونية وصياغة أولية', icon: 'sparkles-outline', group: 'work' },
  { key: 'feed', title: 'شارك في المجتمع', note: 'منشورات وأسئلة وتحديثات', icon: 'newspaper-outline', group: 'work' },
  { key: 'legal', title: 'افتح المكتبة القانونية', note: 'مستندات وقوالب قانونية جاهزة', icon: 'document-text-outline', group: 'work' },
  { key: 'contract', title: 'أنشئ عقداً جديداً', note: 'إنشاء وحفظ مسودات العقود', icon: 'create-outline', group: 'work' },
  { key: 'billing', title: 'راجع المدفوعات', note: 'الرصيد والفواتير والعمليات', icon: 'wallet-outline', group: 'account' },
  { key: 'following', title: 'محامون أتابعهم', note: 'وصول سريع للمفضلين لديك', icon: 'star-outline', group: 'account' },
  { key: 'support', title: 'اطلب المساعدة', note: 'طلبات ودعم فني سريع', icon: 'headset-outline', group: 'account' },
  { key: 'settings', title: 'اضبط حسابك', note: 'البيانات والتفضيلات والتنبيهات', icon: 'settings-outline', group: 'account' },
  { key: 'intelligence', title: 'اكتشف التنبيهات الذكية', note: 'اقتراحات مخصصة لما يحتاج انتباهك', icon: 'analytics-outline', group: 'work' },
  { key: 'profile', title: 'اعرض ملفي', note: 'الملف الشخصي وبيانات الحساب', icon: 'person-outline', group: 'account' },
  { key: 'pro', title: 'ادخل مكتب المحامي', note: 'عملاء وقضايا ومهام مهنية', icon: 'briefcase-outline', roles: ['pro', 'admin'], group: 'work' },
  { key: 'caseStore', title: 'تصفح فرص القضايا', note: 'قضايا مرتبة حسب أفضل فرصة لك', icon: 'trophy-outline', roles: ['pro', 'admin'], group: 'work' },
  { key: 'admin', title: 'راقب لوحة التحكم', note: 'مؤشرات ومراجعات المنصة', icon: 'shield-checkmark-outline', roles: ['admin'], group: 'work' },
];

const filters: Array<{ key: GroupKey; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'work', label: 'العمل' },
  { key: 'account', label: 'الحساب' },
];

export function MoreScreen({ user, primaryRoutes, onOpen }: { user: AuthUser; primaryRoutes: string[]; onOpen: (route: MoreRoute) => void }) {
  const [filter, setFilter] = useState<GroupKey>('all');
  const primaryRouteSet = useMemo(() => new Set(primaryRoutes), [primaryRoutes]);
  const visibleItems = useMemo(
    () => items.filter((item) => !primaryRouteSet.has(item.key) && (!item.roles || item.roles.includes(user.role)) && (filter === 'all' || item.group === filter)),
    [filter, primaryRouteSet, user.role],
  );
  const primaryItems = visibleItems.slice(0, 3);
  const restItems = visibleItems.slice(3);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{String(user.name || 'م').charAt(0)}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>الخدمات</Text>
            <Text style={styles.subtitle}>{user.name} · {user.role === 'admin' ? 'مدير' : user.role === 'pro' ? 'محامي' : 'عميل'}</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {filters.map((item) => (
            <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterChip, filter === item.key && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {primaryItems.length > 0 ? (
          <View style={styles.quickGrid}>
            {primaryItems.map((item) => (
              <Pressable key={item.key} onPress={() => onOpen(item.key)} style={styles.quickCard}>
                <View style={styles.quickIcon}><Ionicons name={item.icon} size={21} color={colors.navy} /></View>
                <Text style={styles.quickTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.quickNote} numberOfLines={2}>{item.note}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>كل الخدمات</Text>
        {restItems.map((item) => (
          <Pressable key={item.key} onPress={() => onOpen(item.key)} style={styles.row}>
            <Ionicons name="chevron-back" size={18} color={colors.subtle} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowNote}>{item.note}</Text>
            </View>
            <View style={styles.rowIcon}><Ionicons name={item.icon} size={20} color={colors.navy} /></View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  headerText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  filterRow: {
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 4,
    marginBottom: 12,
    padding: 4,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.paper,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  filterTextActive: {
    color: colors.navy,
  },
  quickGrid: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
  },
  quickCard: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 126,
    padding: 11,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: colors.goldTint,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    marginBottom: 9,
    width: 38,
  },
  quickTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  quickNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'right',
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    minHeight: 68,
    padding: 11,
  },
  rowText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  rowNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});
