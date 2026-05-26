import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Card, EmptyState, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function MessagesScreen() {
  const [cases, setCases] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getWorkspaceCases();
      setCases(response.data || []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const threads = cases
    .map((item) => ({
      case: item,
      lastMessage: [...(item.messages || [])].pop(),
      unread: item.unreadCount || 0,
    }))
    .filter((item) => item.lastMessage);

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="الرسائل" subtitle="صندوق محادثات القضايا والاستشارات." />
        {threads.length === 0 ? <EmptyState title="لا توجد رسائل بعد" note="ابدأ استشارة أو أرسل رسالة من داخل قضية." /> : null}
        {threads.map((thread) => (
          <Card key={thread.case.id}>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              {thread.unread ? <Pill label={`${thread.unread} غير مقروء`} tone="red" /> : <Pill label="مقروء" tone="green" />}
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{thread.case.title}</Text>
              <Text style={{ color: colors.muted, textAlign: 'right' }}>
                {thread.lastMessage.sender === 'user' ? 'أنت' : 'المحامي'}: {thread.lastMessage.text}
              </Text>
              <Text style={{ color: colors.gold, fontWeight: '800', textAlign: 'right' }}>
                {thread.case.lawyer?.name || 'المحامي المسؤول'}
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
