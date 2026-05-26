import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Heading, KeyValue, Pill, Screen, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    apiClient.getSettings().then((response) => setSettings(response.data)).catch(() => undefined);
  }, []);

  const profile = settings?.profile || user;
  const completionItems = [
    Boolean(profile?.name),
    Boolean(profile?.email),
    Boolean(profile?.phone),
    Boolean(profile?.location),
    Boolean(profile?.bio || profile?.roleDescription),
  ];
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  return (
    <Screen>
      <ScrollView>
        <Heading title="الملف الشخصي" subtitle="بيانات الحساب، التحقق، واكتمال الملف." />
        <Card>
          <Pill label={user?.verified ? 'حساب موثق' : 'التحقق غير مكتمل'} tone={user?.verified ? 'green' : 'gold'} />
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 10, textAlign: 'right' }}>{profile?.name}</Text>
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>{profile?.email}</Text>
          <Text style={{ color: colors.gold, marginTop: 8, textAlign: 'right' }}>{profile?.role || user?.role}</Text>
        </Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card>
            <View style={{ width: 130 }}>
              <KeyValue label="اكتمال الملف" value={`${completion}%`} />
            </View>
          </Card>
          <Card>
            <View style={{ width: 130 }}>
              <KeyValue label="الرصيد" value={profile?.accountBalance ?? 0} />
            </View>
          </Card>
        </View>
        <SectionTitle title="حالة التحقق" />
        <Card>
          <KeyValue label="الهوية الوطنية" value={profile?.nationalIdVerified ? 'موثقة' : 'بانتظار الرفع'} />
          <Text>{'\n'}</Text>
          <KeyValue label="رخصة المحامي" value={profile?.lawyerLicenseVerified ? 'موثقة' : user?.role === 'pro' ? 'بانتظار الرفع' : 'غير مطلوبة'} />
          <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 12, textAlign: 'right' }}>
            رفع الصور والملفات سيتم إضافته كتدفق جوال مخصص لاحقاً، مع إعادة استخدام نفس مسار الوسائط في الخادم.
          </Text>
        </Card>
        <SectionTitle title="نبذة الحساب" />
        <Card>
          <Text style={{ color: colors.muted, lineHeight: 22, textAlign: 'right' }}>
            {profile?.bio || profile?.roleDescription || 'لم يتم إضافة نبذة بعد. يمكنك تعديل بياناتك من الإعدادات.'}
          </Text>
        </Card>
        <Button title="تسجيل الخروج" onPress={logout} variant="secondary" />
      </ScrollView>
    </Screen>
  );
}
