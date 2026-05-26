import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function LawyersScreen() {
  const [query, setQuery] = useState('');
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getLawyers(query);
      setLawyers(response.data || []);
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
        <Heading title="المحامين" subtitle="ابحث حسب الاسم، التخصص، أو المدينة." />
        <Field value={query} onChangeText={setQuery} placeholder="بحث" />
        <Button title="بحث" onPress={load} loading={refreshing} />
        <View style={{ height: 12 }} />
        {lawyers.map((lawyer) => (
          <Card key={lawyer.id}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{lawyer.name}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{lawyer.specialty} · {lawyer.location}</Text>
            <Text style={{ color: colors.gold, marginTop: 8, textAlign: 'right' }}>★ {lawyer.rating} · {lawyer.consultationFee}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

