import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Field, Heading, Pill, Screen, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

export function CasesScreen() {
  const [cases, setCases] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newMatter, setNewMatter] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getWorkspaceCases();
      setCases(response.data || []);
      setSelectedId((current) => current || response.data?.[0]?.id || '');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedCase = cases.find((item) => item.id === selectedId) || cases[0];

  const createCase = async () => {
    if (!newTitle.trim()) return;
    const firstLawyerId = cases[0]?.lawyerId || cases[0]?.lawyer?.id;
    if (!firstLawyerId) {
      setStatus('اختر محامياً من شاشة المحامين أولاً لإنشاء قضية جديدة.');
      return;
    }

    setLoading(true);
    setStatus('');
    try {
      const response = await apiClient.createWorkspaceCase({
        title: newTitle.trim(),
        matter: newMatter.trim() || 'طلب قانوني جديد',
        lawyerId: firstLawyerId,
        caseType: 'عام',
      });
      setNewTitle('');
      setNewMatter('');
      await load();
      setSelectedId(response.data?.id || '');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إنشاء القضية.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedCase || !message.trim()) return;
    setLoading(true);
    setStatus('');
    try {
      await apiClient.addCaseMessage(selectedCase.id, message.trim());
      setMessage('');
      await load();
      setStatus('تم إرسال الرسالة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إرسال الرسالة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="قضاياي" subtitle="متابعة الملفات، المراحل، والمستندات المطلوبة." />
        <Card>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 10, textAlign: 'right' }}>فتح ملف جديد</Text>
          <Field value={newTitle} onChangeText={setNewTitle} placeholder="عنوان القضية" />
          <Field value={newMatter} onChangeText={setNewMatter} placeholder="وصف مختصر" />
          <Button title="إنشاء قضية" onPress={createCase} loading={loading} />
        </Card>
        {status ? <Text style={{ color: colors.navy, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>{status}</Text> : null}
        {cases.length === 0 ? <EmptyState title="لا توجد قضايا بعد" note="يمكنك بدء استشارة من شاشة المحامين أو إنشاء ملف جديد بعد اختيار محامٍ." /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
            {cases.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedId(item.id)}
                style={{
                  backgroundColor: selectedCase?.id === item.id ? colors.navy : '#fff',
                  borderColor: colors.line,
                  borderRadius: 8,
                  borderWidth: 1,
                  minWidth: 150,
                  padding: 12,
                }}
              >
                <Text style={{ color: selectedCase?.id === item.id ? '#fff' : colors.ink, fontWeight: '900', textAlign: 'right' }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: selectedCase?.id === item.id ? '#d0d5dd' : colors.muted, marginTop: 4, textAlign: 'right' }}>
                  {item.statusText || item.status}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {selectedCase ? (
          <>
            <Card>
              <Pill label={selectedCase.statusText || selectedCase.status} tone={selectedCase.status === 'active' ? 'green' : 'gold'} />
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 10, textAlign: 'right' }}>{selectedCase.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>
                المحامي: {selectedCase.lawyer?.name || selectedCase.lawyer || 'غير محدد'}
              </Text>
              <Text style={{ color: colors.gold, fontSize: 18, fontWeight: '900', marginTop: 10, textAlign: 'right' }}>
                التقدم {selectedCase.progress ?? 0}%
              </Text>
            </Card>
            <SectionTitle title="المستندات" />
            {(selectedCase.documents || []).slice(0, 4).map((doc: any) => (
              <Card key={doc.id}>
                <Text style={{ color: colors.ink, fontWeight: '900', textAlign: 'right' }}>{doc.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{doc.type} · {doc.size}</Text>
              </Card>
            ))}
            <SectionTitle title="الرسائل" />
            {(selectedCase.messages || []).slice(-5).map((item: any) => (
              <Card key={item.id}>
                <Text style={{ color: item.sender === 'user' ? colors.navy : colors.gold, fontWeight: '900', textAlign: 'right' }}>
                  {item.sender === 'user' ? 'أنت' : 'المحامي'}
                </Text>
                <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 6, textAlign: 'right' }}>{item.text}</Text>
              </Card>
            ))}
            <Card>
              <Field value={message} onChangeText={setMessage} placeholder="رسالة داخل القضية" />
              <Button title="إرسال" onPress={sendMessage} loading={loading} />
            </Card>
            <SectionTitle title="خط الزمن" />
            {(selectedCase.timeline || []).slice(0, 5).map((item: any) => (
              <Card key={item.id}>
                <Text style={{ color: colors.ink, fontWeight: '900', textAlign: 'right' }}>{item.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{item.date} · {item.detail}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
