import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, KeyValue, Pill, Screen, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

export function BillingScreen() {
  const [settings, setSettings] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [amount, setAmount] = useState('25000');
  const [promo, setPromo] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [settingsResponse, dashboardResponse] = await Promise.all([
        apiClient.getSettings(),
        apiClient.getDashboard().catch(() => ({ data: null })),
      ]);
      setSettings(settingsResponse.data);
      setDashboard(dashboardResponse.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const topUp = async () => {
    setLoading(true);
    setMessage('');
    try {
      await apiClient.addCreditBalance({ amount: Number(amount) || 0, paymentMethod: 'زين كاش', note: 'Mobile top-up' });
      setMessage('تمت إضافة الرصيد بنجاح.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تنفيذ العملية.');
    } finally {
      setLoading(false);
    }
  };

  const applyPromo = async () => {
    if (!promo.trim()) return;
    setLoading(true);
    try {
      const response = await apiClient.applyPromoCode(promo.trim());
      setMessage(response.data.message || `تم تطبيق خصم ${response.data.discountAmount}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'الكود غير صالح.');
    } finally {
      setLoading(false);
    }
  };

  const balance = settings?.profile?.accountBalance ?? settings?.billing?.balance ?? 0;
  const payments = dashboard?.payments || [];
  const totalPaid = payments.reduce((sum: number, item: any) => {
    const amountNumber = Number(String(item.amount || '').replace(/[^\d.]/g, ''));
    return sum + (Number.isFinite(amountNumber) ? amountNumber : 0);
  }, 0);

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="الفواتير والمحفظة" subtitle="إدارة الرصيد، المدفوعات، وكود الخصم." />
        <Card>
          <Text style={{ color: colors.muted, textAlign: 'right' }}>الرصيد الحالي</Text>
          <Text style={{ color: colors.gold, fontSize: 34, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{balance}</Text>
          <Pill label="محفظة المنصة" tone="green" />
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <KeyValue label="عمليات حديثة" value={payments.length} />
            <KeyValue label="إجمالي ظاهر" value={`${totalPaid.toLocaleString('en-US')} د.ع`} />
          </View>
        </Card>
        <Card>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 10, textAlign: 'right' }}>شحن الرصيد</Text>
          <Field value={amount} onChangeText={setAmount} placeholder="المبلغ" />
          <Button title="إضافة رصيد" onPress={topUp} loading={loading} />
        </Card>
        <Card>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 10, textAlign: 'right' }}>كود الخصم</Text>
          <Field value={promo} onChangeText={setPromo} placeholder="أدخل كود الخصم" />
          <Button title="تطبيق الكود" onPress={applyPromo} loading={loading} variant="secondary" />
        </Card>
        {message ? <Text style={{ color: colors.navy, fontWeight: '800', textAlign: 'center' }}>{message}</Text> : null}
        <SectionTitle title="سجل العمليات" />
        {payments.map((item: any) => (
          <Card key={item.id}>
            <Pill label={item.status || 'عملية'} tone={item.status === 'مدفوع' ? 'green' : 'gold'} />
            <Text style={{ color: colors.ink, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.label}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.amount} · {item.date}</Text>
          </Card>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </Screen>
  );
}
