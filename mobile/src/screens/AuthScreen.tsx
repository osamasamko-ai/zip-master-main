import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Button, Field, Heading, Screen, styles } from '../components/ui';
import { Role } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function AuthScreen() {
  const { login, register, isLoading, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('password123');

  const submit = async () => {
    if (mode === 'login') {
      await login(email.trim(), password);
    } else {
      await register(email.trim(), password, name.trim() || email.trim(), role);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <Heading
          title="القسطاس الذكي"
          subtitle="منصة قانونية للجوال: قضايا، محامين، مستندات، ومساعد قانوني ذكي."
        />

        {mode === 'register' ? <Field value={name} onChangeText={setName} placeholder="الاسم الكامل" /> : null}
        <Field value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" />
        <Field value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry />

        {mode === 'register' ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['user', 'pro'] as Role[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => setRole(item)}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: role === item ? colors.gold : colors.line,
                  padding: 12,
                  backgroundColor: role === item ? '#fff8e8' : '#fff',
                }}
              >
                <Text style={{ color: colors.ink, fontWeight: '800', textAlign: 'center' }}>
                  {item === 'pro' ? 'محامي' : 'مستخدم'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {error ? <Text style={{ color: colors.red, marginBottom: 12, textAlign: 'right' }}>{error}</Text> : null}

        <Button title={mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'} onPress={submit} loading={isLoading} />
        <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ padding: 16 }}>
          <Text style={{ color: colors.navy, fontWeight: '800', textAlign: 'center' }}>
            {mode === 'login' ? 'إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}
