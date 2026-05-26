import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function SupportScreen() {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setStatus('');
    try {
      await apiClient.sendSupportRequest({
        name: user?.name || 'Mobile user',
        phone,
        subject: subject || 'طلب دعم من التطبيق',
        message,
      });
      setStatus('تم إرسال طلب الدعم بنجاح.');
      setSubject('');
      setMessage('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إرسال الطلب.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView>
        <Heading title="الدعم" subtitle="أرسل طلب مساعدة أو بلاغاً لفريق المنصة." />
        <Card>
          <Field value={phone} onChangeText={setPhone} placeholder="رقم الهاتف" />
          <Field value={subject} onChangeText={setSubject} placeholder="الموضوع" />
          <Field value={message} onChangeText={setMessage} placeholder="اكتب تفاصيل الطلب" />
          <Button title="إرسال الطلب" onPress={submit} loading={loading} />
        </Card>
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', textAlign: 'center' }}>{status}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

