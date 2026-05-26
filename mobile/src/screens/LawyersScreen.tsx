import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

type SortMode = 'best' | 'rating' | 'response';
type RouteKey =
  | 'lawyers'
  | 'cases'
  | 'ai'
  | 'messages'
  | 'legal'
  | 'contract'
  | 'billing'
  | 'following'
  | 'support'
  | 'settings'
  | 'intelligence'
  | 'pro'
  | 'admin'
  | 'profile'
  | 'feed'
  | 'home'
  | 'more';

type LawyersScreenProps = {
  onOpen?: (route: RouteKey) => void;
};

const paymentMethods = [
  { id: 'zain-cash', label: 'زين كاش', subtitle: 'تأكيد فوري وآمن', icon: 'phone-portrait-outline' as const, recommended: true },
  { id: 'card', label: 'بطاقة مصرفية', subtitle: 'Visa / Mastercard', icon: 'card-outline' as const },
  { id: 'wallet-balance', label: 'رصيد المنصة', subtitle: 'خصم مباشر من محفظتك', icon: 'wallet-outline' as const },
];

export function LawyersScreen({ onOpen }: LawyersScreenProps) {
  const [query, setQuery] = useState('');
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [status, setStatus] = useState('');
  const [loadError, setLoadError] = useState('');
  const [specialty, setSpecialty] = useState('الكل');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [consultationLawyer, setConsultationLawyer] = useState<any | null>(null);
  const [consultationNote, setConsultationNote] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(paymentMethods[0].id);
  const [isStartingConsultation, setIsStartingConsultation] = useState(false);
  const [consultationError, setConsultationError] = useState('');
  const [consultationSuccess, setConsultationSuccess] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = async () => {
    setRefreshing(true);
    setLoadError('');
    try {
      const [lawyersResponse, followingResponse] = await Promise.all([
        apiClient.getLawyers(),
        apiClient.getFollowing().catch(() => ({ data: [] })),
      ]);
      const nextLawyers = lawyersResponse.data || [];
      setLawyers(nextLawyers);
      setFollowedIds((followingResponse.data || []).map((item: any) => item.id));
      setSelectedLawyerId((current) => current || nextLawyers[0]?.id || '');
    } catch {
      setLoadError('تعذر تحميل قائمة المحامين حالياً. حاول تحديث الصفحة.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const specialties = useMemo<string[]>(() => {
    const values = lawyers.map((lawyer) => String(lawyer.specialty || '')).filter(Boolean);
    return ['الكل', ...Array.from(new Set<string>(values))];
  }, [lawyers]);

  const filteredLawyers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = lawyers.filter((lawyer) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        String(lawyer.name || '').toLowerCase().includes(normalizedQuery) ||
        String(lawyer.specialty || '').toLowerCase().includes(normalizedQuery) ||
        String(lawyer.location || '').toLowerCase().includes(normalizedQuery);
      const matchesSpecialty = specialty === 'الكل' || lawyer.specialty === specialty;
      const matchesVerified = !verifiedOnly || lawyer.verified;
      const matchesOnline = !onlineOnly || lawyer.isOnline;

      return matchesQuery && matchesSpecialty && matchesVerified && matchesOnline;
    });

    return next.sort((left, right) => {
      if (sortMode === 'rating') return (right.rating || 0) - (left.rating || 0);
      if (sortMode === 'response') return Number(right.isOnline) - Number(left.isOnline) || (right.followers || 0) - (left.followers || 0);

      const leftFollowed = followedIds.includes(left.id) ? 1 : 0;
      const rightFollowed = followedIds.includes(right.id) ? 1 : 0;
      if (leftFollowed !== rightFollowed) return rightFollowed - leftFollowed;
      if (left.verified !== right.verified) return Number(right.verified) - Number(left.verified);
      if (left.isOnline !== right.isOnline) return Number(right.isOnline) - Number(left.isOnline);
      return (right.rating || 0) - (left.rating || 0);
    });
  }, [followedIds, lawyers, onlineOnly, query, sortMode, specialty, verifiedOnly]);

  useEffect(() => {
    if (!filteredLawyers.some((lawyer) => lawyer.id === selectedLawyerId)) {
      setSelectedLawyerId(filteredLawyers[0]?.id || '');
    }
  }, [filteredLawyers, selectedLawyerId]);

  const selectedLawyer = filteredLawyers.find((lawyer) => lawyer.id === selectedLawyerId) || filteredLawyers[0] || null;
  const recommendedLawyer = filteredLawyers[0] || null;
  const highestRatedLawyer = filteredLawyers.reduce((best, lawyer) => (!best || (lawyer.rating || 0) > (best.rating || 0) ? lawyer : best), null);
  const activeFilterCount = [query.trim().length > 0, specialty !== 'الكل', verifiedOnly, onlineOnly, sortMode !== 'best'].filter(Boolean).length;
  const onlineCount = filteredLawyers.filter((lawyer) => lawyer.isOnline).length;
  const verifiedCount = filteredLawyers.filter((lawyer) => lawyer.verified).length;

  const resetFilters = () => {
    setQuery('');
    setSpecialty('الكل');
    setVerifiedOnly(false);
    setOnlineOnly(false);
    setSortMode('best');
  };

  const activeFilters = [
    query.trim() ? `بحث: ${query.trim()}` : '',
    specialty !== 'الكل' ? specialty : '',
    verifiedOnly ? 'موثقون فقط' : '',
    onlineOnly ? 'متاحون الآن' : '',
    sortMode !== 'best' ? sortModeLabel(sortMode) : '',
  ].filter(Boolean);

  const toggleFollow = async (lawyer: any) => {
    const isFollowing = followedIds.includes(lawyer.id);
    setBusyId(lawyer.id);
    setStatus('');
    setFollowedIds((current) => (isFollowing ? current.filter((id) => id !== lawyer.id) : [...current, lawyer.id]));
    setLawyers((current) =>
      current.map((item) =>
        item.id === lawyer.id ? { ...item, followers: Math.max(0, (item.followers || 0) + (isFollowing ? -1 : 1)) } : item,
      ),
    );

    try {
      if (isFollowing) {
        await apiClient.unfollowLawyer(lawyer.id);
      } else {
        await apiClient.followLawyer(lawyer.id);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحديث المتابعة.');
      setFollowedIds((current) => (isFollowing ? [...current, lawyer.id] : current.filter((id) => id !== lawyer.id)));
    } finally {
      setBusyId('');
    }
  };

  const openConsultation = (lawyer: any) => {
    setConsultationLawyer(lawyer);
    setConsultationNote('');
    setSelectedPaymentMethod(paymentMethods[0].id);
    setConsultationError('');
    setConsultationSuccess('');
  };

  const startConsultation = async () => {
    if (!consultationLawyer) return;
    setIsStartingConsultation(true);
    setConsultationError('');
    setConsultationSuccess('');

    try {
      const method = paymentMethods.find((item) => item.id === selectedPaymentMethod);
      await apiClient.startLawyerConsultation(consultationLawyer.id, {
        paymentMethod: method?.label || selectedPaymentMethod,
        note: consultationNote.trim() || undefined,
      });
      setConsultationSuccess(`تم تأكيد الدفع وفتح استشارة جديدة مع ${consultationLawyer.name}.`);
      setTimeout(() => {
        setConsultationLawyer(null);
        onOpen?.('messages');
      }, 700);
    } catch (error) {
      setConsultationError(error instanceof Error ? error.message : 'تعذر بدء الاستشارة حالياً. حاول مرة أخرى.');
    } finally {
      setIsStartingConsultation(false);
    }
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="scale-outline" size={22} color={colors.gold} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.kicker}>دليل المحامين</Text>
              <Text style={styles.heroTitle}>اختر المحامي المناسب بسرعة</Text>
              <Text style={styles.mutedText}>بحث، فلاتر، مقارنة، واستشارة مدفوعة من شاشة واحدة.</Text>
            </View>
          </View>

          <View style={styles.searchShell}>
            {query ? (
              <Pressable onPress={() => setQuery('')} style={styles.searchClear}>
                <Ionicons name="close" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
            <TextInput
              autoCapitalize="none"
              onChangeText={setQuery}
              placeholder="ابحث باسم، تخصص، أو مدينة"
              placeholderTextColor="#98a2b3"
              style={styles.searchInput}
              value={query}
            />
            <Ionicons name="search-outline" size={19} color={colors.navy} />
          </View>

          <View style={styles.heroStatsRow}>
            <MiniStat label="النتائج" value={filteredLawyers.length} />
            <MiniStat label="متاحون" value={onlineCount} />
            <MiniStat label="موثقون" value={verifiedCount} />
          </View>
        </View>

        <View style={styles.recommendationPanel}>
          <View style={styles.recommendationHeader}>
            <Pressable onPress={() => setFiltersOpen((current) => !current)} style={styles.filterButton}>
              <Ionicons name="options-outline" size={18} color={colors.navy} />
              <Text style={styles.filterButtonText}>{filtersOpen ? 'إخفاء الفلاتر' : 'الفلاتر'}</Text>
              {activeFilterCount > 0 ? (
                <View style={styles.filterCount}>
                  <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.kicker}>أفضل تطابق</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{recommendedLawyer?.name || 'بانتظار النتائج'}</Text>
              <Text style={styles.mutedText} numberOfLines={1}>
                {highestRatedLawyer ? `أعلى تقييم: ${highestRatedLawyer.name} · ${Number(highestRatedLawyer.rating || 0).toFixed(1)}` : 'اسحب للتحديث عند الحاجة'}
              </Text>
            </View>
          </View>

          {recommendedLawyer ? (
            <Pressable onPress={() => setSelectedLawyerId(recommendedLawyer.id)} style={styles.recommendedCard}>
              <Pill label="مقترح" tone="gold" />
              <Text style={styles.cardTitle}>{recommendedLawyer.name}</Text>
              <Text style={styles.mutedText}>{recommendedLawyer.specialty} · {recommendedLawyer.responseTime || recommendedLawyer.availability}</Text>
            </Pressable>
          ) : null}
        </View>

        {filtersOpen ? (
        <Card>
          <Text style={styles.controlLabel}>التخصص</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {specialties.map((item) => (
              <FilterChip key={item} label={item} active={specialty === item} onPress={() => setSpecialty(item)} />
            ))}
          </ScrollView>

          <Text style={styles.controlLabel}>ترتيب النتائج</Text>
          <View style={styles.gridThree}>
            <FilterChip label="أفضل تطابق" active={sortMode === 'best'} onPress={() => setSortMode('best')} />
            <FilterChip label="الأعلى تقييماً" active={sortMode === 'rating'} onPress={() => setSortMode('rating')} />
            <FilterChip label="الأسرع تفاعلاً" active={sortMode === 'response'} onPress={() => setSortMode('response')} />
          </View>

          <View style={styles.gridTwo}>
            <ToggleChip label="الموثقون فقط" active={verifiedOnly} onPress={() => setVerifiedOnly((current) => !current)} />
            <ToggleChip label="المتاحون الآن" active={onlineOnly} onPress={() => setOnlineOnly((current) => !current)} />
          </View>
          <Button title="مسح الفلاتر" onPress={resetFilters} variant="secondary" />
        </Card>
        ) : null}

        {activeFilters.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilterRow}>
            {activeFilters.map((item) => (
              <View key={item} style={styles.activeFilterPill}>
                <Text style={styles.activeFilterText}>{item}</Text>
              </View>
            ))}
            <Pressable onPress={resetFilters} style={styles.clearFilterPill}>
              <Ionicons name="refresh-outline" size={14} color={colors.red} />
              <Text style={styles.clearFilterText}>مسح</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {status ? <Text style={styles.status}>{status}</Text> : null}
        {loadError ? <EmptyState title="تعذر تحميل المحامين" note={loadError} /> : null}
        {refreshing && lawyers.length === 0 ? (
          <Card>
            <ActivityIndicator color={colors.gold} />
          </Card>
        ) : null}

        {filteredLawyers.length === 0 && !refreshing ? (
          <EmptyState title="لا توجد نتائج مطابقة" note="جرّب تغيير الكلمات المفتاحية أو مسح الفلاتر للوصول إلى محامين أكثر." />
        ) : null}

        {filteredLawyers.length > 0 ? (
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>المحامون المطابقون</Text>
            <Text style={styles.resultMeta}>{filteredLawyers.length.toLocaleString('ar-IQ')} نتيجة · {sortModeLabel(sortMode)}</Text>
          </View>
        ) : null}

        {filteredLawyers.map((lawyer, index) => (
          <LawyerCard
            key={lawyer.id}
            best={index === 0 && sortMode === 'best'}
            busy={busyId === lawyer.id}
            followed={followedIds.includes(lawyer.id)}
            lawyer={lawyer}
            selected={selectedLawyer?.id === lawyer.id}
            onConsult={() => openConsultation(lawyer)}
            onFollow={() => toggleFollow(lawyer)}
            onOpenCase={() => onOpen?.('cases')}
            onOpenProfile={() => onOpen?.('profile')}
            onSelect={() => setSelectedLawyerId(lawyer.id)}
          />
        ))}

        <SelectedLawyerSummary
          lawyer={selectedLawyer}
          onConsult={() => selectedLawyer && openConsultation(selectedLawyer)}
          onOpenCase={() => onOpen?.('cases')}
          onOpenProfile={() => onOpen?.('profile')}
        />
      </ScrollView>

      <ConsultationModal
        error={consultationError}
        lawyer={consultationLawyer}
        loading={isStartingConsultation}
        note={consultationNote}
        paymentMethod={selectedPaymentMethod}
        success={consultationSuccess}
        onCancel={() => !isStartingConsultation && setConsultationLawyer(null)}
        onChangeNote={setConsultationNote}
        onChangePayment={setSelectedPaymentMethod}
        onConfirm={startConsultation}
      />
    </Screen>
  );
}

function LawyerCard({
  lawyer,
  selected,
  best,
  followed,
  busy,
  onSelect,
  onConsult,
  onFollow,
  onOpenCase,
  onOpenProfile,
}: {
  lawyer: any;
  selected: boolean;
  best: boolean;
  followed: boolean;
  busy: boolean;
  onSelect: () => void;
  onConsult: () => void;
  onFollow: () => void;
  onOpenCase: () => void;
  onOpenProfile: () => void;
}) {
  const readiness = Math.min(100, Math.round(((lawyer.rating || 0) / 5) * 72 + (lawyer.isOnline ? 14 : 0) + (lawyer.verified ? 14 : 0)));

  return (
    <Pressable onPress={onSelect} style={[styles.lawyerCard, selected && styles.lawyerCardSelected]}>
      <View style={styles.cardAccentRow}>
        <View style={[styles.cardAccent, selected && styles.cardAccentActive]} />
      </View>

      <View style={styles.lawyerTopRow}>
        <Pressable onPress={onFollow} style={[styles.saveButton, followed && styles.saveButtonActive]}>
          <Ionicons name={followed ? 'bookmark' : 'bookmark-outline'} size={18} color={followed ? colors.gold : colors.muted} />
        </Pressable>

        <View style={styles.flex}>
          <View style={styles.badgeRow}>
            {best ? <Pill label="أفضل تطابق" tone="gold" /> : null}
            {lawyer.verified ? <Pill label="موثق" tone="blue" /> : null}
            <Pill label={lawyer.isOnline ? 'متاح الآن' : 'حسب الجدول'} tone={lawyer.isOnline ? 'green' : 'neutral'} />
          </View>

          <View style={styles.lawyerHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{String(lawyer.name || 'م').charAt(0)}</Text>
              <View style={[styles.onlineDot, lawyer.isOnline ? styles.onlineDotActive : styles.onlineDotIdle]} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.lawyerName} numberOfLines={1}>{lawyer.name}</Text>
              <Text style={styles.specialtyLine} numberOfLines={1}>{lawyer.specialty} · {lawyer.location}</Text>
              <Text style={styles.tagline} numberOfLines={2}>{lawyer.tagline || lawyer.bio}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.scoreStrip}>
        <View style={styles.scoreItem}>
          <Ionicons name="star" size={15} color={colors.gold} />
          <Text style={styles.scoreValue}>{Number(lawyer.rating || 0).toFixed(1)}</Text>
          <Text style={styles.scoreLabel}>التقييم</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Ionicons name="people-outline" size={15} color={colors.navy} />
          <Text style={styles.scoreValue}>{Number(lawyer.followers || 0).toLocaleString('ar-IQ')}</Text>
          <Text style={styles.scoreLabel}>متابع</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Ionicons name="chatbubbles-outline" size={15} color={colors.navy} />
          <Text style={styles.scoreValue}>{Number(lawyer.reviewCount || 0).toLocaleString('ar-IQ')}</Text>
          <Text style={styles.scoreLabel}>مراجعة</Text>
        </View>
      </View>

      <View style={styles.factGrid}>
        <Fact icon="time-outline" label="الرد" value={lawyer.responseTime || lawyer.availability} />
        <Fact icon="briefcase-outline" label="الخبرة" value={lawyer.experience} />
        <Fact icon="folder-open-outline" label="القضايا" value={lawyer.casesHandled} />
        <Fact icon="pulse-outline" label="الجاهزية" value={`${readiness}%`} />
      </View>

      <View style={styles.pricePanel}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>سعر الاستشارة</Text>
          <Text style={styles.priceText} numberOfLines={1}>{lawyer.consultationFee || 'غير محدد'}</Text>
          <Text style={styles.availabilityHint}>{lawyer.isOnline ? 'جاهز للاستشارة الآن' : 'يفضل فتح قضية منظمة'}</Text>
        </View>
        <Pressable onPress={onConsult} style={styles.consultButton}>
          <Ionicons name="card-outline" size={17} color="#fff" />
          <Text style={styles.consultButtonText}>استشارة</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${readiness}%` }]} />
      </View>

      <View style={styles.mobileActionRow}>
        <CardAction icon="person-outline" label="الملف" onPress={onOpenProfile} />
        <CardAction icon="folder-open-outline" label="قضية" onPress={onOpenCase} />
        <CardAction
          icon={followed ? 'checkmark-circle-outline' : 'add-circle-outline'}
          label={busy ? 'جار...' : followed ? 'محفوظ' : 'متابعة'}
          onPress={onFollow}
          active={followed}
        />
      </View>
    </Pressable>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | number }) {
  return (
    <View style={styles.factItem}>
      <Ionicons name={icon} size={16} color={colors.navy} />
      <View style={styles.flex}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue} numberOfLines={1}>{value || '-'}</Text>
      </View>
    </View>
  );
}

function CardAction({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.cardAction, active && styles.cardActionActive]}>
      <Ionicons name={icon} size={17} color={active ? colors.gold : colors.navy} />
      <Text style={[styles.cardActionText, active && styles.cardActionTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SelectedLawyerSummary({ lawyer, onConsult, onOpenCase, onOpenProfile }: { lawyer: any | null; onConsult: () => void; onOpenCase: () => void; onOpenProfile: () => void }) {
  if (!lawyer) {
    return <EmptyState title="اختر محامياً لعرض الملخص السريع" note="سيظهر هنا أفضل إجراء، الرسوم، والتخصص." />;
  }

  return (
    <Card>
      <Text style={styles.kicker}>Top Match</Text>
      <Text style={styles.heroTitle}>{lawyer.name}</Text>
      <Text style={styles.mutedText}>{lawyer.tagline}</Text>
      <View style={styles.infoGrid}>
        <Info label="التخصص" value={lawyer.specialty} />
        <Info label="الدليل الاجتماعي" value={`${Number(lawyer.followers || 0).toLocaleString('ar-IQ')} متابع`} />
        <Info label="التقييم" value={`${Number(lawyer.rating || 0).toFixed(1)} / 5`} />
        <Info label="الاستشارة" value={lawyer.consultationFee} />
      </View>
      <Text style={styles.cardTitle}>أفضل خطوة الآن</Text>
      <Text style={styles.mutedText}>{lawyer.isOnline ? 'ابدأ استشارة سريعة لتأكيد التوفر' : 'افتح قضية وحدد هذا المحامي من البداية'}</Text>
      <View style={styles.actionRow}>
        <Button title="استشارة مدفوعة" onPress={onConsult} />
        <Button title="افتح قضية" onPress={onOpenCase} variant="secondary" />
        <Button title="عرض الملف" onPress={onOpenProfile} variant="secondary" />
      </View>
    </Card>
  );
}

function ConsultationModal({
  lawyer,
  note,
  paymentMethod,
  loading,
  error,
  success,
  onCancel,
  onChangeNote,
  onChangePayment,
  onConfirm,
}: {
  lawyer: any | null;
  note: string;
  paymentMethod: string;
  loading: boolean;
  error: string;
  success: string;
  onCancel: () => void;
  onChangeNote: (value: string) => void;
  onChangePayment: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="slide" transparent visible={Boolean(lawyer)} onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <Pressable onPress={onCancel} style={styles.closeButton}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.kicker}>Consultation Checkout</Text>
                <Text style={styles.heroTitle}>ابدأ الاستشارة خلال أقل من دقيقة</Text>
                <Text style={styles.mutedText}>اختر طريقة الدفع، ثم يتم إنشاء المحادثة وتحويلك مباشرة إلى الرسائل.</Text>
              </View>
            </View>

            {lawyer ? (
              <Card>
                <Text style={styles.cardTitle}>{lawyer.name}</Text>
                <Text style={styles.mutedText}>{lawyer.specialty}</Text>
                <Text style={styles.balance}>{lawyer.consultationFee}</Text>
                <Info label="التأكيد" value="فوري" />
                <Info label="قناة التواصل" value="محادثة خاصة" />
                <Info label="اسم الملف" value="استشارة" />
              </Card>
            ) : null}

            <Text style={styles.controlLabel}>اختر طريقة الدفع</Text>
            {paymentMethods.map((method) => (
              <Pressable key={method.id} onPress={() => onChangePayment(method.id)} style={[styles.paymentOption, paymentMethod === method.id && styles.paymentOptionActive]}>
                <Ionicons name={method.icon} size={22} color={colors.navy} />
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{method.label}</Text>
                  <Text style={styles.mutedText}>{method.subtitle}</Text>
                </View>
                {method.recommended ? <Pill label="موصى به" tone="gold" /> : null}
              </Pressable>
            ))}

            <Text style={styles.controlLabel}>رسالة البدء للمحامي</Text>
            <TextInput
              multiline
              onChangeText={onChangeNote}
              placeholder="مثال: أحتاج استشارة عاجلة حول عقد إيجار تجاري..."
              placeholderTextColor="#98a2b3"
              style={styles.noteInput}
              value={note}
            />

            {error ? <Text style={[styles.status, styles.error]}>{error}</Text> : null}
            {success ? <Text style={[styles.status, styles.success]}>{success}</Text> : null}

            <View style={styles.actionRow}>
              <Button title="إلغاء" onPress={onCancel} variant="secondary" />
              <Button title={loading ? 'جارٍ تأكيد الدفع...' : 'ادفع وابدأ المحادثة'} onPress={onConfirm} loading={loading} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? '#fff' : colors.navy} />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString('ar-IQ') : value}</Text>
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value?: string | number }) {
  return (
    <View style={styles.info}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value || '-'}</Text>
    </View>
  );
}

function sortModeLabel(sortMode: SortMode) {
  if (sortMode === 'rating') return 'الأعلى تقييماً';
  if (sortMode === 'response') return 'الأسرع تفاعلاً';
  return 'أفضل تطابق';
}

const styles = StyleSheet.create({
  activeFilterPill: {
    backgroundColor: '#eef2f6',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  activeFilterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 10,
  },
  activeFilterText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  actionRow: {
    gap: 10,
    marginTop: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  availabilityHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
  balance: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  cardAccent: {
    backgroundColor: colors.line,
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  cardAccentActive: {
    backgroundColor: colors.navy,
  },
  cardAccentRow: {
    flexDirection: 'row-reverse',
    marginBottom: 12,
  },
  cardAction: {
    alignItems: 'center',
    backgroundColor: '#eef2f6',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  cardActionActive: {
    backgroundColor: '#fff6df',
  },
  cardActionText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  cardActionTextActive: {
    color: colors.ink,
  },
  chip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 12,
  },
  chipText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  chipTextActive: {
    color: '#fff',
  },
  closeButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  controlLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 12,
    textAlign: 'right',
  },
  error: {
    color: colors.red,
  },
  clearFilterPill: {
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderColor: '#fecdca',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  clearFilterText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '900',
  },
  consultButton: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  consultButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  factGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  factItem: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexDirection: 'row-reverse',
    flexGrow: 1,
    gap: 8,
    minHeight: 54,
    padding: 9,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  factValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'right',
  },
  feeBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 12,
    padding: 10,
  },
  flex: {
    flex: 1,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: '#eef2f6',
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  filterButtonText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  filterCount: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
  },
  filterCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  goldText: {
    color: colors.gold,
    fontWeight: '900',
    textAlign: 'right',
  },
  gridThree: {
    gap: 8,
  },
  gridTwo: {
    gap: 8,
    marginVertical: 10,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: 8,
    textAlign: 'right',
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#fff6df',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  heroPanel: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  heroStatsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  info: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
  },
  infoGrid: {
    gap: 8,
    marginTop: 12,
  },
  infoValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
  },
  inlineButton: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  inlineButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  lawyerHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  lawyerCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  lawyerCardSelected: {
    borderColor: colors.navy,
    shadowColor: colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  lawyerName: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  lawyerTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    backgroundColor: '#f8fafc',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 1,
    padding: 10,
  },
  metricsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  miniStat: {
    backgroundColor: '#eef2f6',
    borderRadius: 8,
    flexBasis: '30%',
    flexGrow: 1,
    padding: 10,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 24, 40, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalPanel: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    maxHeight: '90%',
    padding: 14,
    width: '94%',
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 5,
    textAlign: 'right',
  },
  noteInput: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 96,
    padding: 12,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  onlineDot: {
    borderColor: '#fff',
    borderRadius: 999,
    borderWidth: 2,
    bottom: -1,
    height: 14,
    left: -1,
    position: 'absolute',
    width: 14,
  },
  onlineDotActive: {
    backgroundColor: colors.green,
  },
  onlineDotIdle: {
    backgroundColor: '#98a2b3',
  },
  paymentOption: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 8,
    padding: 12,
  },
  paymentOptionActive: {
    borderColor: colors.navy,
    backgroundColor: '#f8fafc',
  },
  pricePanel: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 12,
    marginTop: 12,
    padding: 12,
  },
  priceText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
  },
  progressFill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: '#eef2f6',
    borderRadius: 999,
    height: 7,
    marginTop: 8,
    overflow: 'hidden',
  },
  recommendedCard: {
    backgroundColor: 'rgba(184,137,46,0.08)',
    borderColor: 'rgba(184,137,46,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  recommendationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  recommendationPanel: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 2,
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  resultTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  selectedBar: {
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
  },
  selectedBarActive: {
    backgroundColor: colors.navy,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  saveButtonActive: {
    backgroundColor: '#fff6df',
    borderColor: '#fedf89',
  },
  scoreDivider: {
    backgroundColor: colors.line,
    height: 34,
    width: 1,
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  scoreStrip: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
    padding: 10,
  },
  scoreValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  searchClear: {
    alignItems: 'center',
    backgroundColor: '#eef2f6',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    textAlign: 'right',
  },
  searchShell: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  smallText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'right',
  },
  socialRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 12,
  },
  status: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  success: {
    color: colors.green,
  },
  mobileActionRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  specialtyLine: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
  },
  tagline: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'right',
  },
  toggle: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  toggleActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
});
