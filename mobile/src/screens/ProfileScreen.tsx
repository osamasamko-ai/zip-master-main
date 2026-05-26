import React from 'react';
import { Text } from 'react-native';
import { Button, Card, Heading, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <Screen>
      <Heading title="الملف الشخصي" subtitle="بيانات الحساب والجلسة الحالية." />
      <Card>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{user?.name}</Text>
        <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>{user?.email}</Text>
        <Text style={{ color: colors.gold, marginTop: 8, textAlign: 'right' }}>{user?.role}</Text>
      </Card>
      <Button title="تسجيل الخروج" onPress={logout} variant="secondary" />
    </Screen>
  );
}

