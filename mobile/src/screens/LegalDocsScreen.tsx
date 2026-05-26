import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Card, EmptyState, Field, Heading, Pill, Screen, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

export function LegalDocsScreen() {
  const [docs, setDocs] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'all' | 'contracts' | 'docs'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [docsResponse, contractsResponse] = await Promise.all([
        apiClient.getLegalDocs(),
        apiClient.getUserContracts().catch(() => ({ data: [] })),
      ]);
      setDocs(docsResponse.data || []);
      setContracts(contractsResponse.data || []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredDocs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return docs.filter((doc) => {
      const text = `${doc.title || doc.name || ''} ${doc.summary || doc.description || doc.content || ''}`.toLowerCase();
      return !needle || text.includes(needle);
    });
  }, [docs, query]);

  const filteredContracts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contracts.filter((contract) => {
      const text = `${contract.title || contract.type || ''} ${contract.status || ''}`.toLowerCase();
      return !needle || text.includes(needle);
    });
  }, [contracts, query]);

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="المستندات القانونية" subtitle="مكتبة القوانين والعقود المحفوظة في حسابك." />
        <Field value={query} onChangeText={setQuery} placeholder="بحث في المستندات والعقود" />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[
            ['all', 'الكل'],
            ['contracts', 'العقود'],
            ['docs', 'المكتبة'],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setMode(key as typeof mode)}
              style={{ backgroundColor: mode === key ? colors.navy : '#fff', borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, padding: 10 }}
            >
              <Text style={{ color: mode === key ? '#fff' : colors.ink, fontWeight: '900', textAlign: 'center' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {mode !== 'docs' ? <SectionTitle title="عقودي" /> : null}
        {mode !== 'docs' && filteredContracts.map((contract) => (
          <Card key={contract.id}>
            <Pill label={contract.status || 'محفوظ'} tone="gold" />
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8, textAlign: 'right' }}>
              {contract.title || contract.type || 'عقد قانوني'}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>
              {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString() : 'بدون تاريخ'}
            </Text>
          </Card>
        ))}
        {mode !== 'contracts' ? <SectionTitle title="المكتبة القانونية" /> : null}
        {mode !== 'contracts' && filteredDocs.length === 0 ? <EmptyState title="لا توجد نتائج" note="جرّب كلمة بحث مختلفة أو اسحب للتحديث." /> : null}
        {mode !== 'contracts' && filteredDocs.map((doc, index) => (
          <Card key={doc.id || `${doc.title}-${index}`}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' }}>{doc.title || doc.name}</Text>
            <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 8, textAlign: 'right' }}>
              {doc.summary || doc.description || doc.content || 'مرجع قانوني متاح للمراجعة.'}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
