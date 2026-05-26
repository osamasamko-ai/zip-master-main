import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function BillingScreen() {
  const [settings, setSettings] = useState<any>(null);
  const [amount, setAmount] = useState('25000');
  const [promo, setPromo] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const response = await apiClient.getSettings();
    setSettings(response.data);
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

  return (
    <Screen>
      <ScrollView>
        <Heading title="الفواتير والمحفظة" subtitle="إدارة الرصيد، المدفوعات، وكود الخصم." />
        <Card>
          <Text style={{ color: colors.muted, textAlign: 'right' }}>الرصيد الحالي</Text>
          <Text style={{ color: colors.gold, fontSize: 34, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{balance}</Text>
          <Pill label="محفظة المنصة" tone="green" />
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
        <View style={{ height: 20 }} />
      </ScrollView>
    </Screen>
  );
}

