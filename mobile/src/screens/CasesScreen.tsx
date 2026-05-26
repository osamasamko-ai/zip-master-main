import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { apiClient } from '../api/client';
import { Card, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function CasesScreen() {
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

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="قضاياي" subtitle="متابعة الملفات، المراحل، والمستندات المطلوبة." />
        {cases.length === 0 ? (
          <Card>
            <Text style={{ color: colors.muted, textAlign: 'right' }}>لا توجد قضايا بعد.</Text>
          </Card>
        ) : cases.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{item.title}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.status} · {item.nextStep || 'لا توجد خطوة حالية'}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

