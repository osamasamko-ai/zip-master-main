import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { Screen } from '../components/ui';
import { colors } from '../theme/colors';

type CaseStoreListing = {
  id: string;
  title: string;
  matter: string;
  category: string;
  location?: string;
  clientName?: string;
  clientLocation?: string;
  budget: number;
  readiness: number;
  opportunityScore?: number;
  notes?: string;
  documents?: Array<{ name?: string; url?: string; mimeType?: string; size?: number }>;
  status: string;
  offerStatus?: string | null;
  offerNote?: string | null;
  proposedPrice?: number | null;
  evaluationDuration?: string | null;
  paymentMethod?: string | null;
  requestedDocuments?: string | null;
  suggested?: boolean | number;
  nearby?: boolean | number;
  createdAt?: string;
};

type StoreFilter = 'all' | 'suggested' | 'nearby' | 'unanswered' | 'reviewed';

const filters: Array<{ key: StoreFilter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'suggested', label: 'مقترحة' },
  { key: 'nearby', label: 'قريبة' },
  { key: 'unanswered', label: 'بانتظارك' },
  { key: 'reviewed', label: 'مراجعة' },
];

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('en-US')} د.ع`;
}

function offerLabel(status?: string | null) {
  if (status === 'accepted') return 'مقبولة';
  if (status === 'rejected') return 'مرفوضة';
  return 'بانتظار القرار';
}

function ageLabel(value?: string) {
  if (!value) return 'منشورة حديثاً';
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return 'قبل أقل من ساعة';
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.round(hours / 24)} يوم`;
}

function getOpportunityScore(item: CaseStoreListing) {
  return Math.max(0, Math.min(100, Number(item.opportunityScore || 0)));
}

function getOpportunityLabel(score: number) {
  if (score >= 80) return 'فرصة ممتازة';
  if (score >= 60) return 'فرصة قوية';
  if (score >= 40) return 'فرصة متوسطة';
  return 'تحتاج مراجعة';
}

function getOpportunityReasons(item: CaseStoreListing) {
  const reasons = [];
  if (Boolean(item.suggested)) reasons.push('مناسبة للتخصص');
  if (Boolean(item.nearby)) reasons.push('قريبة');
  if (Number(item.budget || 0) >= 500000) reasons.push('ميزانية جيدة');
  if (Number(item.readiness || 0) >= 65) reasons.push('جاهزية عالية');
  if (item.documents?.length) reasons.push('وثائق مرفوعة');
  return reasons.length ? reasons : ['راجع التفاصيل'];
}

export function CaseStoreScreen({ onOpen }: { onOpen: (route: 'cases') => void }) {
  const [listings, setListings] = useState<CaseStoreListing[]>([]);
  const [selected, setSelected] = useState<CaseStoreListing | null>(null);
  const [filter, setFilter] = useState<StoreFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [note, setNote] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [evaluationDuration, setEvaluationDuration] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [requestedDocuments, setRequestedDocuments] = useState('');
  const [responding, setResponding] = useState<'accept' | 'reject' | ''>('');
  const [notice, setNotice] = useState('');

  const loadListings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.getLawyerCaseMarketplaceListings();
      const next = response.data || [];
      setListings(next);
      setSelected((current) => {
        if (!next.length) return null;
        if (!current) return next[0];
        return next.find((item) => item.id === current.id) || next[0];
      });
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل متجر القضايا.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    setReviewed(Boolean(selected?.offerStatus));
    setNote(selected?.offerNote || '');
    setProposedPrice(selected?.proposedPrice ? String(selected.proposedPrice) : selected?.budget ? String(selected.budget) : '');
    setEvaluationDuration(selected?.evaluationDuration || '');
    setPaymentMethod(selected?.paymentMethod || '');
    setRequestedDocuments(selected?.requestedDocuments || '');
    setNotice('');
  }, [selected?.id]);

  const stats = useMemo(() => {
    return {
      open: listings.filter((item) => item.status === 'open').length,
      waiting: listings.filter((item) => !item.offerStatus && item.status === 'open').length,
      suggested: listings.filter((item) => Boolean(item.suggested)).length,
      best: listings.reduce((max, item) => Math.max(max, getOpportunityScore(item)), 0),
    };
  }, [listings]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return listings.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.title?.toLowerCase().includes(normalized) ||
        item.category?.toLowerCase().includes(normalized) ||
        item.matter?.toLowerCase().includes(normalized) ||
        item.location?.toLowerCase().includes(normalized);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'suggested' && Boolean(item.suggested)) ||
        (filter === 'nearby' && Boolean(item.nearby)) ||
        (filter === 'unanswered' && !item.offerStatus && item.status === 'open') ||
        (filter === 'reviewed' && Boolean(item.offerStatus));
      return matchesQuery && matchesFilter;
    }).sort((first, second) => getOpportunityScore(second) - getOpportunityScore(first));
  }, [filter, listings, query]);

  const respond = async (decision: 'accept' | 'reject') => {
    if (!selected) return;
    if (decision === 'accept' && !reviewed) {
      setNotice('أكد مراجعة التفاصيل والوثائق قبل قبول الدعوى.');
      return;
    }
    const normalizedPrice = Number(proposedPrice.replace(/[^\d.]/g, ''));
    if (decision === 'accept' && (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || !evaluationDuration.trim() || !paymentMethod.trim())) {
      setNotice('أكمل السعر المقترح ومدة التقييم وطريقة الدفع قبل تقديم العرض.');
      return;
    }

    setResponding(decision);
    setNotice('');
    try {
      const response = await apiClient.respondToCaseMarketplaceListing(selected.id, {
        decision,
        note,
        proposedPrice: normalizedPrice,
        evaluationDuration,
        paymentMethod,
        requestedDocuments,
      });
      setNotice(response.message || (decision === 'accept' ? 'تم فتح غرفة تفاوض أولية.' : 'تم تسجيل الرفض.'));
      await loadListings();
    } catch (err: any) {
      setNotice(err?.message || 'تعذر حفظ القرار.');
    } finally {
      setResponding('');
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="storefront-outline" size={24} color={colors.gold} />
          </View>
          <Text style={styles.eyebrow}>Lawyer Opportunities</Text>
          <Text style={styles.title}>فرص المحامين</Text>
          <Text style={styles.subtitle}>القضايا مرتبة حسب القرب، التخصص، الميزانية، وجاهزية ملف العميل.</Text>
          <View style={styles.stats}>
            <Stat label="متاحة" value={stats.open} />
            <Stat label="بانتظارك" value={stats.waiting} />
            <Stat label="أفضل فرصة" value={stats.best} suffix="%" />
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.subtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="بحث بالتصنيف أو المدينة أو التفاصيل"
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((item) => (
            <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterChip, filter === item.key && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.navy} />
            <Text style={styles.loadingText}>جار تحميل القضايا...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={loadListings} style={styles.retryButton}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.caseList}>
            {filtered.length ? (
              filtered.map((item) => (
                <CaseCard key={item.id} item={item} active={selected?.id === item.id} onPress={() => setSelected(item)} />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="folder-open-outline" size={34} color={colors.subtle} />
                <Text style={styles.emptyTitle}>لا توجد قضايا مطابقة</Text>
              </View>
            )}
          </View>
        )}

        {selected ? (
          <View style={styles.reviewPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.badges}>
                {Boolean(selected.suggested) ? <Badge label="مقترحة" tone="gold" /> : null}
                {Boolean(selected.nearby) ? <Badge label="قريبة" tone="blue" /> : null}
                <Badge label={offerLabel(selected.offerStatus)} tone={selected.offerStatus === 'accepted' ? 'green' : selected.offerStatus === 'rejected' ? 'red' : 'neutral'} />
              </View>
              <Text style={styles.panelCategory}>{selected.category || 'دعوى عامة'}</Text>
              <Text style={styles.panelTitle}>{selected.title}</Text>
              <Text style={styles.panelAge}>{ageLabel(selected.createdAt)}</Text>
            </View>

            <View style={styles.metricsGrid}>
              <Metric label="درجة الفرصة" value={`${getOpportunityScore(selected)}%`} />
              <Metric label="المبلغ" value={formatMoney(selected.budget)} />
              <Metric label="الجاهزية" value={`${selected.readiness || 0}%`} />
              <Metric label="الوثائق" value={`${selected.documents?.length || 0}`} />
            </View>

            <View style={styles.opportunityPanel}>
              <Text style={styles.opportunityTitle}>{getOpportunityLabel(getOpportunityScore(selected))}</Text>
              <View style={styles.scoreTrack}>
                <View style={[styles.scoreFill, { width: `${getOpportunityScore(selected)}%` }]} />
              </View>
              <View style={styles.cardBadges}>
                {getOpportunityReasons(selected).map((reason) => <Badge key={reason} label={reason} tone="neutral" />)}
              </View>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>تفاصيل الدعوى</Text>
              <Text style={styles.detailText}>{selected.matter}</Text>
              {selected.notes ? (
                <>
                  <Text style={styles.sectionTitle}>ملاحظات العميل</Text>
                  <Text style={styles.detailText}>{selected.notes}</Text>
                </>
              ) : null}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>وثائق المراجعة</Text>
              {selected.documents?.length ? (
                selected.documents.map((doc, index) => (
                  <Pressable
                    key={`${doc.url || doc.name}-${index}`}
                    onPress={() => doc.url && Linking.openURL(apiClient.getMediaUrl(doc.url))}
                    style={styles.documentRow}
                  >
                    <Ionicons name="open-outline" size={18} color={colors.navy} />
                    <View style={styles.documentText}>
                      <Text style={styles.documentTitle} numberOfLines={1}>{doc.name || `وثيقة ${index + 1}`}</Text>
                      <Text style={styles.documentMeta} numberOfLines={1}>{doc.mimeType || 'ملف مرفوع'}</Text>
                    </View>
                    <Ionicons name="document-text-outline" size={21} color={colors.gold} />
                  </Pressable>
                ))
              ) : (
                <Text style={styles.emptyNote}>لا توجد وثائق مرفوعة لهذه الدعوى.</Text>
              )}
            </View>

            <View style={styles.decisionCard}>
              <Pressable
                disabled={Boolean(selected.offerStatus)}
                onPress={() => setReviewed((current) => !current)}
                style={[styles.reviewCheck, reviewed && styles.reviewCheckActive]}
              >
                <Ionicons name={reviewed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={reviewed ? colors.green : colors.subtle} />
                <Text style={styles.reviewText}>راجعت تفاصيل الدعوى والوثائق والمبلغ المقترح</Text>
              </Pressable>
              <TextInput
                value={note}
                onChangeText={setNote}
                editable={!selected.offerStatus}
                multiline
                placeholder="ملاحظة للعميل قبل القبول أو الرفض..."
                placeholderTextColor={colors.subtle}
                style={styles.noteInput}
                textAlign="right"
              />
              <View style={styles.offerGrid}>
                <TextInput
                  value={proposedPrice}
                  onChangeText={setProposedPrice}
                  editable={!selected.offerStatus}
                  keyboardType="numeric"
                  placeholder="السعر المقترح"
                  placeholderTextColor={colors.subtle}
                  style={styles.offerInput}
                  textAlign="right"
                />
                <TextInput
                  value={evaluationDuration}
                  onChangeText={setEvaluationDuration}
                  editable={!selected.offerStatus}
                  placeholder="مدة التقييم"
                  placeholderTextColor={colors.subtle}
                  style={styles.offerInput}
                  textAlign="right"
                />
                <TextInput
                  value={paymentMethod}
                  onChangeText={setPaymentMethod}
                  editable={!selected.offerStatus}
                  placeholder="طريقة الدفع"
                  placeholderTextColor={colors.subtle}
                  style={styles.offerInput}
                  textAlign="right"
                />
              </View>
              <TextInput
                value={requestedDocuments}
                onChangeText={setRequestedDocuments}
                editable={!selected.offerStatus}
                multiline
                placeholder="وثائق إضافية مطلوبة..."
                placeholderTextColor={colors.subtle}
                style={styles.noteInput}
                textAlign="right"
              />
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  disabled={Boolean(selected.offerStatus || responding)}
                  onPress={() => respond('reject')}
                  style={[styles.actionButton, styles.rejectButton, (selected.offerStatus || responding) && styles.disabled]}
                >
                  <Text style={styles.rejectText}>{responding === 'reject' ? 'جار الرفض...' : 'رفض'}</Text>
                </Pressable>
                <Pressable
                  disabled={Boolean(selected.offerStatus || responding)}
                  onPress={() => respond('accept')}
                  style={[styles.actionButton, styles.acceptButton, (selected.offerStatus || responding) && styles.disabled]}
                >
                  <Text style={styles.acceptText}>{responding === 'accept' ? 'جار فتح التفاوض...' : 'قبول مبدئي'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString('ar-IQ')}{suffix}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CaseCard({ item, active, onPress }: { item: CaseStoreListing; active: boolean; onPress: () => void }) {
  const score = getOpportunityScore(item);
  return (
    <Pressable onPress={onPress} style={[styles.caseCard, active && styles.caseCardActive]}>
      <View style={styles.cardTop}>
        <Badge label={`${score}%`} tone={score >= 60 ? 'gold' : 'neutral'} />
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, active && styles.cardTitleActive]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.cardMeta, active && styles.cardMetaActive]}>{getOpportunityLabel(score)} · {formatMoney(item.budget)}</Text>
        </View>
      </View>
      <Text style={[styles.cardMatter, active && styles.cardMatterActive]} numberOfLines={2}>{item.matter}</Text>
      <View style={[styles.scoreTrack, active && styles.scoreTrackActive]}>
        <View style={[styles.scoreFill, { width: `${score}%` }]} />
      </View>
      <View style={styles.cardBadges}>
        {getOpportunityReasons(item).slice(0, 3).map((reason) => <Badge key={reason} label={reason} tone="neutral" />)}
        <Badge label={`${item.documents?.length || 0} وثائق`} tone="neutral" />
      </View>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'neutral' | 'gold' | 'blue' | 'green' | 'red' }) {
  const toneStyle = {
    neutral: styles.badgeNeutral,
    gold: styles.badgeGold,
    blue: styles.badgeBlue,
    green: styles.badgeGreen,
    red: styles.badgeRed,
  }[tone];
  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 22,
  },
  hero: {
    alignItems: 'flex-end',
    backgroundColor: colors.navy,
    borderRadius: 8,
    marginBottom: 12,
    padding: 16,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 12,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
    marginTop: 5,
    textAlign: 'right',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'right',
  },
  stats: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  stat: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    flex: 1,
    padding: 11,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 8,
    minHeight: 50,
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  filterChipActive: {
    backgroundColor: colors.navy,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  filterTextActive: {
    color: '#fff',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
    padding: 22,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: colors.redTint,
    borderRadius: 8,
    marginBottom: 12,
    padding: 16,
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  caseList: {
    gap: 10,
    marginBottom: 12,
  },
  caseCard: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 13,
  },
  caseCardActive: {
    backgroundColor: colors.navy,
  },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  cardText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  cardTitleActive: {
    color: '#fff',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  cardMetaActive: {
    color: 'rgba(255,255,255,0.65)',
  },
  cardMatter: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'right',
  },
  cardMatterActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  scoreTrack: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 7,
    marginTop: 10,
    overflow: 'hidden',
    width: '100%',
  },
  scoreTrackActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  scoreFill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    height: '100%',
  },
  cardBadges: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeNeutral: {
    backgroundColor: colors.tint,
  },
  badgeGold: {
    backgroundColor: colors.goldTint,
  },
  badgeBlue: {
    backgroundColor: colors.blueTint,
  },
  badgeGreen: {
    backgroundColor: colors.greenTint,
  },
  badgeRed: {
    backgroundColor: colors.redTint,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 24,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },
  emptyNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },
  reviewPanel: {
    gap: 12,
  },
  panelHeader: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 15,
  },
  badges: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  panelCategory: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 12,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginTop: 4,
    textAlign: 'right',
  },
  panelAge: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  metricsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  opportunityPanel: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 14,
  },
  opportunityTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  metric: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderRadius: 8,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  detailCard: {
    alignItems: 'stretch',
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'right',
  },
  detailText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 10,
    textAlign: 'right',
  },
  documentRow: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    minHeight: 58,
    padding: 11,
  },
  documentText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  documentTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  documentMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  decisionCard: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 14,
  },
  reviewCheck: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 12,
  },
  reviewCheckActive: {
    backgroundColor: colors.greenTint,
  },
  reviewText: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 21,
    textAlign: 'right',
  },
  noteInput: {
    backgroundColor: colors.tint,
    borderRadius: 8,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    minHeight: 96,
    marginTop: 10,
    padding: 12,
    textAlignVertical: 'top',
  },
  offerGrid: {
    gap: 8,
    marginTop: 10,
  },
  offerInput: {
    backgroundColor: colors.tint,
    borderRadius: 8,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  notice: {
    backgroundColor: colors.goldTint,
    borderRadius: 8,
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 10,
    padding: 10,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: colors.redTint,
  },
  acceptButton: {
    backgroundColor: colors.green,
  },
  rejectText: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '900',
  },
  acceptText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.5,
  },
});
