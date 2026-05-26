import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Card, Heading, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function HomeScreen() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getDashboard();
      setDashboard(response.data);
    } catch {
      setDashboard(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = dashboard?.summary || {};

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title={`مرحباً، ${user?.name || 'أهلاً'}`} subtitle="ملخص سريع لأهم الملفات والإجراءات القانونية." />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Metric label="القضايا" value={summary.activeCases ?? '-'} />
          <Metric label="المستندات" value={summary.totalDocuments ?? '-'} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Metric label="بانتظارك" value={summary.actionRequiredCases ?? '-'} />
          <Metric label="الرصيد" value={summary.accountBalance ?? '-'} />
        </View>
        <Card>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'right' }}>الإجراءات السريعة</Text>
          {['اسأل المساعد القانوني', 'ابحث عن محامي', 'افتح قضية جديدة', 'راجع المستندات'].map((item) => (
            <Text key={item} style={{ color: colors.muted, marginTop: 12, textAlign: 'right' }}>{item}</Text>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <View style={{ width: 130 }}>
        <Text style={{ color: colors.gold, fontSize: 24, fontWeight: '900', textAlign: 'right' }}>{value}</Text>
        <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>{label}</Text>
      </View>
    </Card>
  );
}

