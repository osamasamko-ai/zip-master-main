import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { EmptyState, Pill, Screen } from '../components/ui';
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.navy} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}><Ionicons name="document-text-outline" size={24} color={colors.gold} /></View>
          <View style={styles.headerText}>
            <Text style={styles.title}>المستندات القانونية</Text>
            <Text style={styles.subtitle}>{contracts.length} عقد · {docs.length} مرجع قانوني</Text>
          </View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.subtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="بحث في المستندات والعقود"
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
            textAlign="right"
          />
        </View>

        <View style={styles.modeRow}>
          {[
            ['all', 'الكل'],
            ['contracts', 'العقود'],
            ['docs', 'المكتبة'],
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => setMode(key as typeof mode)} style={[styles.mode, mode === key && styles.modeActive]}>
              <Text style={[styles.modeText, mode === key && styles.modeTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {mode !== 'docs' ? (
          <Section title="عقودي" count={filteredContracts.length}>
            {filteredContracts.length === 0 ? <EmptyState title="لا توجد عقود" note="العقود التي تحفظها ستظهر هنا." /> : null}
            {filteredContracts.map((contract) => (
              <View key={contract.id} style={styles.card}>
                <Pill label={contract.status || 'محفوظ'} tone="gold" />
                <Text style={styles.cardTitle}>{contract.title || contract.type || 'عقد قانوني'}</Text>
                <Text style={styles.cardMeta}>{contract.createdAt ? new Date(contract.createdAt).toLocaleDateString('ar-IQ') : 'بدون تاريخ'}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {mode !== 'contracts' ? (
          <Section title="المكتبة القانونية" count={filteredDocs.length}>
            {filteredDocs.length === 0 ? <EmptyState title="لا توجد نتائج" note="جرّب كلمة بحث مختلفة أو اسحب للتحديث." /> : null}
            {filteredDocs.map((doc, index) => (
              <View key={doc.id || `${doc.title}-${index}`} style={styles.card}>
                <Text style={styles.cardTitle}>{doc.title || doc.name}</Text>
                <Text style={styles.bodyText}>{doc.summary || doc.description || doc.content || 'مرجع قانوني متاح للمراجعة.'}</Text>
              </View>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.count}><Text style={styles.countText}>{count}</Text></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 12 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12, marginBottom: 12 },
  headerIcon: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 8, height: 50, justifyContent: 'center', width: 50 },
  headerText: { alignItems: 'flex-end', flex: 1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900', textAlign: 'right' },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  search: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, marginBottom: 10, minHeight: 50, paddingHorizontal: 12 },
  searchInput: { color: colors.ink, flex: 1, fontSize: 14, minHeight: 48 },
  modeRow: { backgroundColor: colors.tint, borderRadius: 8, flexDirection: 'row-reverse', gap: 4, marginBottom: 12, padding: 4 },
  mode: { alignItems: 'center', borderRadius: 7, flex: 1, minHeight: 38, justifyContent: 'center' },
  modeActive: { backgroundColor: colors.navy },
  modeText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  modeTextActive: { color: '#fff' },
  section: { marginBottom: 8 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  count: { backgroundColor: colors.tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  countText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  card: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginBottom: 8, padding: 13 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 7, textAlign: 'right' },
  cardMeta: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 5, textAlign: 'right' },
  bodyText: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 22, marginTop: 8, textAlign: 'right' },
});
