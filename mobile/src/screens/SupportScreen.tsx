import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const topics = ['مشكلة في الحساب', 'قضية أو مستند', 'الدفع والفواتير', 'اقتراح تحسين'];

export function SupportScreen() {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState(topics[0]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      setStatus('اكتب تفاصيل الطلب أولاً.');
      return;
    }
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
      setPhone('');
      setMessage('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إرسال الطلب.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}><Ionicons name="headset-outline" size={25} color={colors.gold} /></View>
          <View style={styles.headerText}>
            <Text style={styles.title}>الدعم</Text>
            <Text style={styles.subtitle}>أرسل طلب مساعدة واضح وسنرد عليك بأسرع وقت.</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Info icon="time-outline" title="وقت الرد" text="عادة خلال يوم عمل." />
          <Info icon="shield-checkmark-outline" title="الخصوصية" text="لا تشارك كلمة المرور أو رمز تحقق." />
        </View>

        <Text style={styles.label}>نوع الطلب</Text>
        <View style={styles.topicGrid}>
          {topics.map((topic) => (
            <Pressable key={topic} onPress={() => setSubject(topic)} style={[styles.topic, subject === topic && styles.topicActive]}>
              <Text style={[styles.topicText, subject === topic && styles.topicTextActive]}>{topic}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.formCard}>
          <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} placeholder="اختياري" keyboardType="phone-pad" />
          <Field label="تفاصيل الطلب" value={message} onChangeText={setMessage} placeholder="اشرح المشكلة أو الطلب باختصار" multiline />
          {status ? <Text style={[styles.status, status.includes('بنجاح') && styles.statusSuccess]}>{status}</Text> : null}
          <Button title="إرسال الطلب" onPress={submit} loading={loading} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Info({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={18} color={colors.navy} />
      <View style={styles.infoText}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoNote}>{text}</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: any) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.textArea]}
        textAlign="right"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 12 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12, marginBottom: 12 },
  headerIcon: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 8, height: 50, justifyContent: 'center', width: 50 },
  headerText: { alignItems: 'flex-end', flex: 1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 21, marginTop: 4, textAlign: 'right' },
  infoCard: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 8, marginBottom: 12, padding: 12 },
  infoItem: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10 },
  infoText: { alignItems: 'flex-end', flex: 1 },
  infoTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  infoNote: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  label: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 8, textAlign: 'right' },
  topicGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  topic: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  topicActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  topicText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  topicTextActive: { color: '#fff' },
  formCard: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, padding: 13 },
  fieldBlock: { marginBottom: 10 },
  input: { backgroundColor: '#f8fafc', borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 50, paddingHorizontal: 12 },
  textArea: { minHeight: 118, paddingTop: 12, textAlignVertical: 'top' },
  status: { color: colors.red, fontSize: 12, fontWeight: '900', lineHeight: 20, marginBottom: 10, textAlign: 'center' },
  statusSuccess: { color: colors.green },
});
