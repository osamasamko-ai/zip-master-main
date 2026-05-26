import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function SettingsScreen() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.getSettings().then((response) => {
      const profile = response.data?.profile;
      if (profile?.name) setName(profile.name);
      if (profile?.email) setEmail(profile.email);
    }).catch(() => undefined);
  }, []);

  const save = async () => {
    setLoading(true);
    setStatus('');
    try {
      await apiClient.updateSettingsProfile({ name, email });
      setStatus('تم حفظ الإعدادات.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView>
        <Heading title="الإعدادات" subtitle="إدارة بيانات الحساب والتفضيلات الأساسية." />
        <Card>
          <Field value={name} onChangeText={setName} placeholder="الاسم" />
          <Field value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" />
          <Button title="حفظ التغييرات" onPress={save} loading={loading} />
        </Card>
        <Card>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' }}>الأمان والخصوصية</Text>
          <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 8, textAlign: 'right' }}>
            إدارة كلمة المرور والجلسات ستكون في المرحلة التالية من التطبيق.
          </Text>
        </Card>
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', textAlign: 'center' }}>{status}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

