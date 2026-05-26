import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Field, Heading, KeyValue, Pill, Screen, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

export function AdminScreen() {
  const [tab, setTab] = useState<'overview' | 'kyc' | 'users' | 'billing' | 'support' | 'services'>('overview');
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [kyc, setKyc] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [serviceTitle, setServiceTitle] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [metricsResponse, usersResponse, kycResponse, transactionsResponse, ticketsResponse, servicesResponse] = await Promise.all([
        apiClient.getAdminMetrics(),
        apiClient.getAdminUsers().catch(() => ({ data: [] })),
        apiClient.getAdminKyc().catch(() => ({ data: [] })),
        apiClient.getAdminTransactions().catch(() => ({ data: [] })),
        apiClient.getAdminSupportTickets().catch(() => ({ data: [] })),
        apiClient.getAdminLegalServices().catch(() => ({ data: [] })),
      ]);
      setMetrics(metricsResponse.data);
      setUsers(usersResponse.data || []);
      setKyc(kycResponse.data || []);
      setTransactions(transactionsResponse.data || []);
      setTickets(ticketsResponse.data || []);
      setServices(servicesResponse.data || []);
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
  const tabs = [
    ['overview', 'نظرة'] as const,
    ['kyc', 'KYC'] as const,
    ['users', 'المستخدمون'] as const,
    ['billing', 'المالية'] as const,
    ['support', 'الدعم'] as const,
    ['services', 'الخدمات'] as const,
  ];
  const pendingKyc = useMemo(() => kyc.filter((item) => item.status === 'pending' || item.status === 'review'), [kyc]);

  const updateKyc = async (id: string, nextStatus: string) => {
    await apiClient.updateAdminKyc(id, nextStatus);
    await load();
  };

  const closeTicket = async (id: string) => {
    await apiClient.updateAdminSupportTicket(id, { status: 'closed' });
    await load();
  };

  const addService = async () => {
    if (!serviceTitle.trim()) return;
    setStatus('');
    try {
      await apiClient.addAdminLegalService({
        title: serviceTitle.trim(),
        description: 'خدمة مضافة من تطبيق الجوال.',
        price: servicePrice || 'غير محدد',
        time: 'حسب الطلب',
        category: 'عام',
        icon: 'scale',
        color: 'blue',
        active: true,
      });
      setServiceTitle('');
      setServicePrice('');
      await load();
      setStatus('تمت إضافة الخدمة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة الخدمة.');
    }
  };

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
            {tabs.map(([key, label]) => (
              <Pressable key={key} onPress={() => setTab(key)} style={{ backgroundColor: tab === key ? colors.navy : '#fff', borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: tab === key ? '#fff' : colors.ink, fontWeight: '900' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {tab === 'overview' ? (
          <>
            <SectionTitle title="مركز المراجعة" />
            <Card>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <KeyValue label="KYC معلق" value={pendingKyc.length} />
                <KeyValue label="تذاكر الدعم" value={tickets.length} />
                <KeyValue label="الخدمات" value={services.length} />
              </View>
            </Card>
            <Button title="تنظيف كاش الإدارة" onPress={() => apiClient.clearAdminCache().then(() => setStatus('تم تنظيف الكاش.'))} variant="secondary" />
          </>
        ) : null}
        {tab === 'kyc' ? (
          <>
            {kyc.length === 0 ? <EmptyState title="لا توجد طلبات KYC" /> : null}
            {kyc.slice(0, 12).map((item) => (
              <Card key={item.id}>
                <Pill label={item.status || 'pending'} tone={item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'gold'} />
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.name || item.userName || item.user?.name || 'طلب تحقق'}</Text>
                <Text style={{ color: colors.muted, marginVertical: 8, textAlign: 'right' }}>{item.email || item.user?.email || item.type || 'مراجعة هوية'}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Button title="رفض" onPress={() => updateKyc(item.id, 'rejected')} variant="secondary" /></View>
                  <View style={{ flex: 1 }}><Button title="قبول" onPress={() => updateKyc(item.id, 'approved')} /></View>
                </View>
              </Card>
            ))}
          </>
        ) : null}
        {tab === 'users' ? users.slice(0, 15).map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.ink, fontWeight: '900', textAlign: 'right' }}>{item.name}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.email} · {item.role}</Text>
          </Card>
        )) : null}
        {tab === 'billing' ? transactions.slice(0, 15).map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.ink, fontWeight: '900', textAlign: 'right' }}>{item.label}</Text>
            <Text style={{ color: colors.gold, marginTop: 6, textAlign: 'right' }}>{item.amount} · {item.status}</Text>
          </Card>
        )) : null}
        {tab === 'support' ? tickets.slice(0, 12).map((item) => (
          <Card key={item.id}>
            <Pill label={item.status || 'open'} tone={item.status === 'closed' ? 'green' : 'red'} />
            <Text style={{ color: colors.ink, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.subject || item.title}</Text>
            <Text style={{ color: colors.muted, lineHeight: 22, marginVertical: 8, textAlign: 'right' }}>{item.message || item.description}</Text>
            <Button title="إغلاق التذكرة" onPress={() => closeTicket(item.id)} variant="secondary" />
          </Card>
        )) : null}
        {tab === 'services' ? (
          <>
            <Card>
              <Field value={serviceTitle} onChangeText={setServiceTitle} placeholder="اسم الخدمة" />
              <Field value={servicePrice} onChangeText={setServicePrice} placeholder="السعر" />
              <Button title="إضافة خدمة" onPress={addService} />
            </Card>
            {services.slice(0, 12).map((item) => (
              <Card key={item.id}>
                <Text style={{ color: colors.ink, fontWeight: '900', textAlign: 'right' }}>{item.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.price} · {item.category}</Text>
              </Card>
            ))}
          </>
        ) : null}
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', marginVertical: 10, textAlign: 'center' }}>{status}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
