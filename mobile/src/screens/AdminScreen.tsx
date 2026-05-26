import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Card, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function AdminScreen() {
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getAdminMetrics();
      setMetrics(response.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const items = [
    ['المستخدمون', metrics?.users ?? metrics?.totalUsers ?? '-'],
    ['المحامون', metrics?.lawyers ?? metrics?.totalLawyers ?? '-'],
    ['القضايا', metrics?.cases ?? metrics?.totalCases ?? '-'],
    ['المعاملات', metrics?.transactions ?? metrics?.totalTransactions ?? '-'],
  ];

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="لوحة الإدارة" subtitle="نسخة جوال مختصرة للمتابعة السريعة." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {items.map(([label, value]) => (
            <Card key={label}>
              <View style={{ width: 130 }}>
                <Text style={{ color: colors.gold, fontSize: 26, fontWeight: '900', textAlign: 'right' }}>{value}</Text>
                <Text style={{ color: colors.muted, textAlign: 'right' }}>{label}</Text>
              </View>
            </Card>
          ))}
        </View>
        <Card>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' }}>المراجعات القادمة</Text>
          <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 8, textAlign: 'right' }}>
            سيتم نقل إدارة KYC، الخدمات القانونية، الدعم، والتصدير في الخطوات التالية.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

