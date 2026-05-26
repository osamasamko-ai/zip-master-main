import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Card, EmptyState, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function ProWorkspaceScreen() {
  const [workspace, setWorkspace] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getProWorkspace();
      setWorkspace(response.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cases = workspace?.cases || workspace?.activeCases || [];
  const appointments = workspace?.appointments || [];

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="مساحة المحامي" subtitle="ملخص العملاء، القضايا، المواعيد، والمهام المهنية." />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Metric label="القضايا" value={cases.length} />
          <Metric label="المواعيد" value={appointments.length} />
        </View>
        {cases.length === 0 ? <EmptyState title="لا توجد قضايا مهنية حالياً" note="ستظهر طلبات العملاء هنا." /> : null}
        {cases.slice(0, 8).map((item: any) => (
          <Card key={item.id}>
            <Pill label={item.status || 'نشط'} tone="green" />
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.title}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.clientName || item.client?.name || 'عميل'}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <View style={{ width: 130 }}>
        <Text style={{ color: colors.gold, fontSize: 28, fontWeight: '900', textAlign: 'right' }}>{value}</Text>
        <Text style={{ color: colors.muted, textAlign: 'right' }}>{label}</Text>
      </View>
    </Card>
  );
}

