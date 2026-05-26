import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, Screen, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function SettingsScreen() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [prefs, setPrefs] = useState({
    pushNotifications: true,
    emailAlerts: true,
    billingReminders: true,
    securityAlerts: true,
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.getSettings().then((response) => {
      const profile = response.data?.profile;
      if (profile?.name) setName(profile.name);
      if (profile?.email) setEmail(profile.email);
      if (profile?.phone) setPhone(profile.phone);
      if (profile?.location) setLocation(profile.location);
      setPrefs({
        pushNotifications: Boolean(profile?.pushNotifications ?? true),
        emailAlerts: Boolean(profile?.emailAlerts ?? true),
        billingReminders: Boolean(profile?.billingReminders ?? true),
        securityAlerts: Boolean(profile?.securityAlerts ?? true),
      });
    }).catch(() => undefined);
  }, []);

  const save = async () => {
    setLoading(true);
    setStatus('');
    try {
      await apiClient.updateSettingsProfile({ name, email, phone, location });
      await apiClient.updateSettingsPreferences(prefs);
      setStatus('تم حفظ الإعدادات.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setLoading(true);
    setStatus('');
    try {
      await apiClient.updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setStatus('تم تحديث كلمة المرور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحديث كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <Screen>
      <ScrollView>
        <Heading title="الإعدادات" subtitle="إدارة بيانات الحساب والتفضيلات الأساسية." />
        <Card>
          <Field value={name} onChangeText={setName} placeholder="الاسم" />
          <Field value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" />
          <Field value={phone} onChangeText={setPhone} placeholder="رقم الهاتف" />
          <Field value={location} onChangeText={setLocation} placeholder="الموقع" />
          <Button title="حفظ التغييرات" onPress={save} loading={loading} />
        </Card>
        <SectionTitle title="التنبيهات" />
        <Card>
          <Toggle label="إشعارات الجوال" value={prefs.pushNotifications} onPress={() => togglePref('pushNotifications')} />
          <Toggle label="تنبيهات البريد" value={prefs.emailAlerts} onPress={() => togglePref('emailAlerts')} />
          <Toggle label="تذكير الفواتير" value={prefs.billingReminders} onPress={() => togglePref('billingReminders')} />
          <Toggle label="تنبيهات الأمان" value={prefs.securityAlerts} onPress={() => togglePref('securityAlerts')} />
        </Card>
        <SectionTitle title="كلمة المرور" />
        <Card>
          <Field value={currentPassword} onChangeText={setCurrentPassword} placeholder="كلمة المرور الحالية" secureTextEntry />
          <Field value={newPassword} onChangeText={setNewPassword} placeholder="كلمة المرور الجديدة" secureTextEntry />
          <Button title="تحديث كلمة المرور" onPress={changePassword} loading={loading} variant="secondary" />
        </Card>
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', textAlign: 'center' }}>{status}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function Toggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
      <View style={{ backgroundColor: value ? colors.green : '#d0d5dd', borderRadius: 999, height: 28, justifyContent: 'center', padding: 3, width: 52 }}>
        <View style={{ alignSelf: value ? 'flex-end' : 'flex-start', backgroundColor: '#fff', borderRadius: 999, height: 22, width: 22 }} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right' }}>{label}</Text>
    </Pressable>
  );
}
