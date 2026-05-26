import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthUser } from '../api/client';
import { Card, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export type MoreRoute =
  | 'feed'
  | 'legal'
  | 'contract'
  | 'billing'
  | 'following'
  | 'support'
  | 'settings'
  | 'pro'
  | 'admin';

type Item = {
  key: MoreRoute;
  title: string;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles?: AuthUser['role'][];
};

const items: Item[] = [
  { key: 'feed', title: 'المجتمع القانوني', note: 'منشورات وأسئلة وتحديثات', icon: 'newspaper-outline' },
  { key: 'legal', title: 'المستندات', note: 'مكتبة قانونية وعقود محفوظة', icon: 'document-text-outline' },
  { key: 'contract', title: 'منشئ العقود', note: 'إنشاء وحفظ مسودات العقود', icon: 'create-outline' },
  { key: 'billing', title: 'الفواتير', note: 'الرصيد، الخصومات، والمدفوعات', icon: 'wallet-outline' },
  { key: 'following', title: 'المتابَعون', note: 'محامون تتابعهم', icon: 'star-outline' },
  { key: 'support', title: 'الدعم', note: 'طلبات ومساعدة فنية', icon: 'headset-outline' },
  { key: 'settings', title: 'الإعدادات', note: 'الحساب والتفضيلات', icon: 'settings-outline' },
  { key: 'pro', title: 'مساحة المحامي', note: 'عملاء وقضايا مهنية', icon: 'briefcase-outline', roles: ['pro', 'admin'] },
  { key: 'admin', title: 'الإدارة', note: 'مؤشرات ومراجعات المنصة', icon: 'shield-checkmark-outline', roles: ['admin'] },
];

export function MoreScreen({ user, onOpen }: { user: AuthUser; onOpen: (route: MoreRoute) => void }) {
  const visibleItems = items.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <Screen>
      <ScrollView>
        <Heading title="المزيد" subtitle="كل أدوات المنصة في مكان واحد، بتجربة مناسبة للجوال." />
        {visibleItems.map((item) => (
          <Pressable key={item.key} onPress={() => onOpen(item.key)}>
            <Card>
              <View style={{ alignItems: 'center', flexDirection: 'row-reverse', gap: 12 }}>
                <View style={{ alignItems: 'center', backgroundColor: '#eef2f6', borderRadius: 8, height: 42, justifyContent: 'center', width: 42 }}>
                  <Ionicons name={item.icon} size={22} color={colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>{item.note}</Text>
                </View>
                <Ionicons name="chevron-back" size={20} color={colors.muted} />
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

