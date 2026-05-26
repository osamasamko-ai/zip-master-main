import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { apiClient } from '../api/client';
import { Card, EmptyState, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function IntelligenceScreen() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getIntelligence();
      setData(response.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const recommendations = data?.recommendations || data?.actions || data?.insights || [];

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="الذكاء التشغيلي" subtitle="اقتراحات مبنية على نشاطك، قضاياك، ومستنداتك." />
        {recommendations.length === 0 ? (
          <EmptyState title="لا توجد تنبيهات حالياً" note="ستظهر هنا الأولويات والاقتراحات عند توفر بيانات كافية." />
        ) : null}
        {recommendations.map((item: any, index: number) => (
          <Card key={item.id || index}>
            <Pill label={item.priority || item.level || 'اقتراح'} tone={item.priority === 'high' ? 'red' : 'blue'} />
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>
              {item.title || item.label || 'اقتراح ذكي'}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 8, textAlign: 'right' }}>
              {item.note || item.description || item.reason || 'راجع هذه النقطة لتحسين سير العمل.'}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

