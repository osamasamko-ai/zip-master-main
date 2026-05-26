import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function FollowingScreen() {
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getFollowing();
      setLawyers(response.data || []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unfollow = async (id: string) => {
    await apiClient.unfollowLawyer(id);
    await load();
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="المتابَعون" subtitle="المحامون الذين تتابع نشاطهم وتحديثاتهم." />
        {lawyers.length === 0 ? <EmptyState title="لا تتابع أي محامٍ بعد" note="اذهب إلى دليل المحامين وابدأ المتابعة." /> : null}
        {lawyers.map((lawyer) => (
          <Card key={lawyer.id}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{lawyer.name}</Text>
            <Text style={{ color: colors.muted, marginBottom: 12, marginTop: 6, textAlign: 'right' }}>{lawyer.specialty} · {lawyer.location}</Text>
            <Button title="إلغاء المتابعة" onPress={() => unfollow(lawyer.id)} variant="secondary" />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

