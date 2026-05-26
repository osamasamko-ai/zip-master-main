import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Field, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function LawyersScreen() {
  const [query, setQuery] = useState('');
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');

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

  const toggleFollow = async (lawyer: any) => {
    setBusyId(lawyer.id);
    setStatus('');
    try {
      if (lawyer.isFollowing) {
        await apiClient.unfollowLawyer(lawyer.id);
      } else {
        await apiClient.followLawyer(lawyer.id);
      }
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحديث المتابعة.');
    } finally {
      setBusyId('');
    }
  };

  const consult = async (lawyer: any) => {
    setBusyId(lawyer.id);
    setStatus('');
    try {
      await apiClient.startLawyerConsultation(lawyer.id, {
        paymentMethod: 'محفظة المنصة',
        note: note || `أرغب ببدء استشارة مع ${lawyer.name}.`,
      });
      setNote('');
      setStatus(`تم فتح استشارة مع ${lawyer.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر بدء الاستشارة.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="المحامين" subtitle="ابحث حسب الاسم، التخصص، أو المدينة." />
        <Field value={query} onChangeText={setQuery} placeholder="بحث" />
        <Field value={note} onChangeText={setNote} placeholder="ملاحظة الاستشارة الاختيارية" />
        <Button title="بحث" onPress={load} loading={refreshing} />
        <View style={{ height: 12 }} />
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>{status}</Text> : null}
        {lawyers.length === 0 ? <EmptyState title="لا توجد نتائج" note="جرّب البحث باسم آخر أو اسحب للتحديث." /> : null}
        {lawyers.map((lawyer) => (
          <Card key={lawyer.id}>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Pill label={lawyer.verified ? 'موثق' : 'قيد التحقق'} tone={lawyer.verified ? 'green' : 'gold'} />
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{lawyer.name}</Text>
              <Text style={{ color: colors.muted, textAlign: 'right' }}>{lawyer.specialty} · {lawyer.location}</Text>
              <Text style={{ color: colors.muted, lineHeight: 21, textAlign: 'right' }}>{lawyer.tagline || lawyer.bio}</Text>
              <Text style={{ color: colors.gold, fontWeight: '900', textAlign: 'right' }}>★ {lawyer.rating} · {lawyer.consultationFee}</Text>
              <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                <View style={{ flex: 1 }}>
                  <Button title={lawyer.isFollowing ? 'إلغاء المتابعة' : 'متابعة'} onPress={() => toggleFollow(lawyer)} loading={busyId === lawyer.id} variant="secondary" />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="استشارة" onPress={() => consult(lawyer)} loading={busyId === lawyer.id} />
                </View>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
