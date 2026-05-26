import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { apiClient } from '../api/client';
import { Card, EmptyState, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function LegalDocsScreen() {
  const [docs, setDocs] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
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

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="المستندات القانونية" subtitle="مكتبة القوانين والعقود المحفوظة في حسابك." />
        {contracts.map((contract) => (
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
        {docs.length === 0 ? <EmptyState title="لا توجد وثائق قانونية" note="سيتم عرض المكتبة القانونية هنا عند توفرها." /> : null}
        {docs.map((doc, index) => (
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

