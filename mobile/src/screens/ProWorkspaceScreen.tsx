import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Field, Heading, KeyValue, Pill, Screen, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

export function ProWorkspaceScreen() {
  const [workspace, setWorkspace] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [matter, setMatter] = useState('');
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

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
  const summary = workspace?.summary || {};
  const inboxMessages = workspace?.inboxMessages || [];
  const vaultDocs = workspace?.vaultDocs || [];

  const createCase = async () => {
    if (!title.trim() || !client.trim()) return;
    setLoading(true);
    setStatus('');
    try {
      const response = await apiClient.createProCase({
        title: title.trim(),
        client: client.trim(),
        matter: matter.trim() || 'ملف عميل جديد',
        priority: 'Medium',
      });
      setWorkspace(response.data);
      setTitle('');
      setClient('');
      setMatter('');
      setStatus('تم إنشاء ملف العميل.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إنشاء الملف.');
    } finally {
      setLoading(false);
    }
  };

  const createAppointment = async () => {
    if (!appointmentTitle.trim()) return;
    setLoading(true);
    setStatus('');
    try {
      const response = await apiClient.createProAppointment({
        title: appointmentTitle.trim(),
        time: appointmentTime.trim() || 'هذا الأسبوع',
        client: client.trim() || cases[0]?.clientName || cases[0]?.client?.name || 'عميل',
        type: 'متابعة',
        caseId: cases[0]?.id || null,
      });
      setWorkspace(response.data);
      setAppointmentTitle('');
      setAppointmentTime('');
      setStatus('تمت إضافة الموعد.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة الموعد.');
    } finally {
      setLoading(false);
    }
  };

  const uploadVault = async () => {
    setLoading(true);
    setStatus('');
    try {
      const response = await apiClient.uploadProVaultDocument(cases[0]?.id || null);
      setWorkspace(response.data);
      setStatus('تمت إضافة مستند تجريبي إلى الخزنة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة المستند.');
    } finally {
      setLoading(false);
    }
  };

  const closeMessage = async (id: string) => {
    setLoading(true);
    try {
      await apiClient.updateProMessageState(id, { unread: false, awaitingResponse: false });
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="مساحة المحامي" subtitle="ملخص العملاء، القضايا، المواعيد، والمهام المهنية." />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Metric label="القضايا" value={cases.length} />
          <Metric label="المواعيد" value={appointments.length} />
        </View>
        <Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <KeyValue label="قابل للسحب" value={summary.availableToWithdraw ?? 0} />
            <KeyValue label="التقييم" value={summary.rating ?? 0} />
            <KeyValue label="المتابعون" value={summary.followers ?? 0} />
          </View>
        </Card>
        <SectionTitle title="إضافة ملف عميل" />
        <Card>
          <Field value={title} onChangeText={setTitle} placeholder="عنوان القضية" />
          <Field value={client} onChangeText={setClient} placeholder="اسم العميل" />
          <Field value={matter} onChangeText={setMatter} placeholder="موضوع القضية" />
          <Button title="إنشاء ملف" onPress={createCase} loading={loading} />
        </Card>
        <SectionTitle title="جدولة موعد" />
        <Card>
          <Field value={appointmentTitle} onChangeText={setAppointmentTitle} placeholder="عنوان الموعد" />
          <Field value={appointmentTime} onChangeText={setAppointmentTime} placeholder="الوقت" />
          <Button title="إضافة موعد" onPress={createAppointment} loading={loading} variant="secondary" />
        </Card>
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>{status}</Text> : null}
        <SectionTitle title="صندوق المحامي" />
        {inboxMessages.slice(0, 4).map((item: any) => (
          <Card key={item.id}>
            <Pill label={item.awaitingResponse ? 'بانتظار رد' : 'متابعة'} tone={item.awaitingResponse ? 'red' : 'gold'} />
            <Text style={{ color: colors.ink, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>{item.client || item.sender || 'عميل'}</Text>
            <Text style={{ color: colors.muted, lineHeight: 22, marginVertical: 8, textAlign: 'right' }}>{item.text || item.message}</Text>
            <Button title="تعليم كمنجز" onPress={() => closeMessage(item.id)} loading={loading} variant="secondary" />
          </Card>
        ))}
        <SectionTitle title="الخزنة" />
        <Card>
          <Text style={{ color: colors.muted, marginBottom: 10, textAlign: 'right' }}>
            {vaultDocs.length} مستند في خزنة المكتب.
          </Text>
          <Button title="إضافة مستند تجريبي" onPress={uploadVault} loading={loading} variant="secondary" />
        </Card>
        <SectionTitle title="القضايا" />
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
