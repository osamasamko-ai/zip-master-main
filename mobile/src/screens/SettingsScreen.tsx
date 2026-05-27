import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Screen, Toast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Section = 'profile' | 'notifications' | 'security';

const sections: Array<{ key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'profile', label: 'البيانات', icon: 'person-outline' },
  { key: 'notifications', label: 'التنبيهات', icon: 'notifications-outline' },
  { key: 'security', label: 'الأمان', icon: 'lock-closed-outline' },
];

export function SettingsScreen() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('profile');
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
    if (!currentPassword || !newPassword) {
      setStatus('أدخل كلمة المرور الحالية والجديدة.');
      return;
    }
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}><Ionicons name="settings-outline" size={24} color={colors.gold} /></View>
          <View style={styles.headerText}>
            <Text style={styles.title}>الإعدادات</Text>
            <Text style={styles.subtitle}>إدارة بيانات الحساب والتفضيلات الأساسية.</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {sections.map((section) => (
            <Pressable key={section.key} onPress={() => setActiveSection(section.key)} style={[styles.tab, activeSection === section.key && styles.tabActive]}>
              <Ionicons name={section.icon} size={15} color={activeSection === section.key ? '#fff' : colors.muted} />
              <Text style={[styles.tabText, activeSection === section.key && styles.tabTextActive]}>{section.label}</Text>
            </Pressable>
          ))}
        </View>

        <Toast message={status} tone={status.includes('تم') ? 'success' : 'error'} />

        {activeSection === 'profile' ? (
          <View style={styles.card}>
            <Field label="الاسم" value={name} onChangeText={setName} placeholder="الاسم الكامل" />
            <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" keyboardType="email-address" />
            <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} placeholder="رقم الهاتف" keyboardType="phone-pad" />
            <Field label="الموقع" value={location} onChangeText={setLocation} placeholder="الموقع" />
            <Button title="حفظ التغييرات" onPress={save} loading={loading} />
          </View>
        ) : activeSection === 'notifications' ? (
          <View style={styles.card}>
            <Toggle label="إشعارات الجوال" note="تنبيهات فورية داخل التطبيق" value={prefs.pushNotifications} onPress={() => togglePref('pushNotifications')} />
            <Toggle label="تنبيهات البريد" note="رسائل مهمة على بريدك" value={prefs.emailAlerts} onPress={() => togglePref('emailAlerts')} />
            <Toggle label="تذكير الفواتير" note="قبل الاستحقاق وبعد الدفع" value={prefs.billingReminders} onPress={() => togglePref('billingReminders')} />
            <Toggle label="تنبيهات الأمان" note="تسجيل دخول أو تغيير حساس" value={prefs.securityAlerts} onPress={() => togglePref('securityAlerts')} />
            <Button title="حفظ التفضيلات" onPress={save} loading={loading} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.navy} />
              <Text style={styles.securityText}>استخدم كلمة مرور قوية ومختلفة عن حساباتك الأخرى.</Text>
            </View>
            <Field label="كلمة المرور الحالية" value={currentPassword} onChangeText={setCurrentPassword} placeholder="كلمة المرور الحالية" secureTextEntry />
            <Field label="كلمة المرور الجديدة" value={newPassword} onChangeText={setNewPassword} placeholder="كلمة المرور الجديدة" secureTextEntry />
            <Button title="تحديث كلمة المرور" onPress={changePassword} loading={loading} variant="secondary" />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }: any) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={styles.input}
        textAlign="right"
      />
    </View>
  );
}

function Toggle({ label, note, value, onPress }: { label: string; note: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow}>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleNote}>{note}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 12 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12, marginBottom: 12 },
  headerIcon: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 8, height: 50, justifyContent: 'center', width: 50 },
  headerText: { alignItems: 'flex-end', flex: 1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 21, marginTop: 4, textAlign: 'right' },
  tabs: { backgroundColor: colors.tint, borderRadius: 8, flexDirection: 'row-reverse', gap: 4, marginBottom: 12, padding: 4 },
  tab: { alignItems: 'center', borderRadius: 7, flex: 1, flexDirection: 'row-reverse', gap: 5, justifyContent: 'center', minHeight: 38 },
  tabActive: { backgroundColor: colors.navy },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, padding: 13 },
  fieldBlock: { marginBottom: 10 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 7, textAlign: 'right' },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 50, paddingHorizontal: 12 },
  status: { color: colors.red, fontSize: 12, fontWeight: '900', lineHeight: 20, marginBottom: 10, textAlign: 'center' },
  statusSuccess: { color: colors.green },
  toggleRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 12 },
  toggleTrack: { backgroundColor: colors.line, borderRadius: 999, height: 30, justifyContent: 'center', padding: 3, width: 54 },
  toggleTrackOn: { backgroundColor: colors.green },
  toggleThumb: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, height: 24, width: 24 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleText: { alignItems: 'flex-end', flex: 1 },
  toggleLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  toggleNote: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3, textAlign: 'right' },
  securityNote: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 8, flexDirection: 'row-reverse', gap: 9, marginBottom: 12, padding: 12 },
  securityText: { color: colors.navy, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 20, textAlign: 'right' },
});
