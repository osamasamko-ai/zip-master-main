import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Card, Heading, Pill, Screen, SectionTitle } from '../components/ui';
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
  const cases = dashboard?.cases || [];
  const services = dashboard?.services || [];
  const lawyers = dashboard?.lawyers || [];
  const payments = dashboard?.payments || [];

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
        <SectionTitle title="أولويات اليوم" />
        {cases.slice(0, 3).map((item: any) => (
          <Card key={item.id}>
            <Pill label={item.urgency || item.status} tone={item.urgency === 'عالي' ? 'red' : 'gold'} />
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.title}</Text>
            <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 6, textAlign: 'right' }}>{item.nextStep}</Text>
            <Text style={{ color: colors.gold, fontWeight: '800', marginTop: 8, textAlign: 'right' }}>{item.progress}% · {item.lawyer}</Text>
          </Card>
        ))}
        <SectionTitle title="خدمات قانونية" />
        {services.slice(0, 4).map((item: any) => (
          <Card key={item.id}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' }}>{item.title}</Text>
            <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 6, textAlign: 'right' }}>{item.description}</Text>
            <Text style={{ color: colors.gold, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.price} · {item.time}</Text>
          </Card>
        ))}
        <SectionTitle title="محامون مقترحون" />
        {lawyers.slice(0, 3).map((item: any) => (
          <Card key={item.id}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' }}>{item.name}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.specialty} · {item.location}</Text>
            <Text style={{ color: colors.gold, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>★ {item.rating} · {item.consultationFee}</Text>
          </Card>
        ))}
        <SectionTitle title="آخر المدفوعات" />
        {payments.slice(0, 3).map((item: any) => (
          <Card key={item.id}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' }}>{item.label}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.amount} · {item.status}</Text>
          </Card>
        ))}
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
