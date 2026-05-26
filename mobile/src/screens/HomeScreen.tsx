import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { Card, EmptyState, Heading, Pill, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type DashboardTab = 'overview' | 'cases' | 'services' | 'assist' | 'documents' | 'schedule' | 'payments';
type HeaderFocus = 'all' | 'urgent' | 'pending';
type HeaderRange = 'today' | 'week' | 'month';
type WorkspaceMode = 'today' | 'urgent' | 'documents' | 'week';
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

type HomeScreenProps = {
  onOpen?: (route: RouteKey) => void;
};

const tabs: Array<{ id: DashboardTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'overview', label: 'الرئيسية', icon: 'home-outline' },
  { id: 'cases', label: 'قضاياي', icon: 'folder-open-outline' },
  { id: 'services', label: 'الخدمات', icon: 'heart-outline' },
  { id: 'assist', label: 'المساعد', icon: 'sparkles-outline' },
  { id: 'documents', label: 'المستندات', icon: 'document-text-outline' },
  { id: 'schedule', label: 'المواعيد', icon: 'calendar-outline' },
  { id: 'payments', label: 'المدفوعات', icon: 'wallet-outline' },
];

const workspaceModes: Array<{ id: WorkspaceMode; label: string; note: string; range: HeaderRange; focus: HeaderFocus; tab: DashboardTab }> = [
  { id: 'today', label: 'اليوم', note: 'أهم ما يحتاج متابعة الآن', range: 'today', focus: 'pending', tab: 'overview' },
  { id: 'urgent', label: 'العاجل', note: 'العناصر الأعلى خطورة', range: 'week', focus: 'urgent', tab: 'overview' },
  { id: 'documents', label: 'المستندات', note: 'الملفات المطلوبة والناقصة', range: 'week', focus: 'pending', tab: 'documents' },
  { id: 'week', label: 'هذا الأسبوع', note: 'المواعيد والتحركات القريبة', range: 'week', focus: 'all', tab: 'schedule' },
];

const quickActions: Array<{ id: string; label: string; note: string; icon: keyof typeof Ionicons.glyphMap; route?: RouteKey; tab?: DashboardTab }> = [
  { id: 'start', label: 'ابدأ خدمة جديدة', note: 'إنشاء طلب أو اختيار خدمة قانونية مناسبة', icon: 'add-circle-outline', route: 'cases' },
  { id: 'upload', label: 'رفع مستند مطلوب', note: 'أرسل الملفات الناقصة لإكمال قضيتك الحالية', icon: 'cloud-upload-outline', tab: 'documents' },
  { id: 'book', label: 'حجز موعد', note: 'نسق جلسة مع محام متخصص للحالة الحالية', icon: 'calendar-outline', route: 'lawyers' },
  { id: 'ai', label: 'اسأل المساعد الذكي', note: 'شرح سريع أو تلخيص للخطوة التالية', icon: 'chatbubbles-outline', route: 'ai' },
  { id: 'contact-support', label: 'تواصل مع الدعم', note: 'للاستفسارات العامة أو المساعدة الفنية', icon: 'headset-outline', route: 'support' },
];

export function HomeScreen({ onOpen }: HomeScreenProps) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('today');
  const [headerFocus, setHeaderFocus] = useState<HeaderFocus>('all');
  const [headerRange, setHeaderRange] = useState<HeaderRange>('week');
  const [serviceCategory, setServiceCategory] = useState('الكل');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [showInsight, setShowInsight] = useState(true);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getDashboard();
      setDashboard(response.data);
    } catch {
      setDashboard(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = dashboard?.summary || {};
  const cases = dashboard?.cases || [];
  const documents = dashboard?.documents || [];
  const schedule = dashboard?.schedule || [];
  const payments = dashboard?.payments || [];
  const services = dashboard?.services || [];
  const lawyers = dashboard?.lawyers || [];
  const availableBalance = summary.accountBalance ?? user?.accountBalance ?? 0;
  const requiredDocuments = useMemo(() => documents.filter((doc: any) => doc.status === 'مطلوب'), [documents]);
  const pendingPayments = useMemo(() => payments.filter((item: any) => item.status !== 'مدفوع'), [payments]);
  const selectedCase = useMemo(() => cases.find((item: any) => item.id === selectedCaseId) ?? cases[0], [cases, selectedCaseId]);
  const selectedLawyer = useMemo(() => lawyers.find((item: any) => item.id === selectedLawyerId) ?? lawyers[0], [lawyers, selectedLawyerId]);
  const isInitialLoading = refreshing && !dashboard;
  const isFirstTimeUser = !isInitialLoading && cases.length === 0 && documents.length === 0 && schedule.length === 0 && payments.length === 0;

  const serviceCategories = useMemo<string[]>(
    () => {
      const categories = services.map((item: any) => String(item.category || '')).filter(Boolean);
      return ['الكل', ...Array.from(new Set<string>(categories))];
    },
    [services],
  );
  const filteredServices = useMemo(() => {
    if (serviceCategory === 'الكل') return services;
    return services.filter((item: any) => item.category === serviceCategory);
  }, [serviceCategory, services]);

  const stats = useMemo(() => {
    const activeCases = summary.activeCases ?? cases.length;
    const actionRequiredCases = summary.actionRequiredCases ?? cases.filter((item: any) => item.status === 'بانتظارك' || item.unread).length;
    const pendingDocuments = summary.requiredDocuments ?? requiredDocuments.length;
    const totalDocuments = summary.totalDocuments ?? documents.length;
    const fileHealth = summary.fileHealth ?? (totalDocuments > 0 ? Math.round((documents.filter((item: any) => item.status === 'مكتمل').length / totalDocuments) * 100) : 0);

    return [
      { label: 'القضايا النشطة', value: activeCases, note: actionRequiredCases > 0 ? `${actionRequiredCases} تحتاج إجراء` : 'كل القضايا تحت المتابعة', icon: 'briefcase-outline' as const, tab: 'cases' as const },
      { label: 'المستندات المطلوبة', value: pendingDocuments, note: pendingDocuments > 0 ? 'جاهزة للرفع الآن' : 'لا توجد مستندات مطلوبة', icon: 'document-attach-outline' as const, tab: 'documents' as const },
      { label: 'صحة الملف', value: `${fileHealth}%`, note: totalDocuments > 0 ? 'جاهزية الملف القانوني' : 'أضف أول مستند لبدء التقييم', icon: 'pulse-outline' as const, tab: 'documents' as const },
      { label: 'الرصيد', value: availableBalance, note: 'IQD متاح', icon: 'wallet-outline' as const, tab: 'payments' as const },
    ];
  }, [availableBalance, cases, documents, requiredDocuments.length, summary]);

  const priorityQueue = useMemo(() => {
    const items: any[] = [];

    requiredDocuments.forEach((doc: any, index: number) => {
      items.push({
        id: `document-${doc.id}`,
        title: `رفع ${doc.name}`,
        note: `${doc.caseName} يحتاج هذا المستند لإكمال المسار الحالي.`,
        reason: index === 0 ? 'تأخير المستند ينعكس مباشرة على تقدم القضية.' : 'رفع المستند الآن يقلل التأخير التشغيلي.',
        cta: 'فتح المستندات',
        kind: 'document',
        level: index === 0 ? 'critical' : 'high',
        score: 100 - index,
        icon: 'cloud-upload-outline' as const,
        tab: 'documents' as DashboardTab,
      });
    });

    cases.forEach((item: any, index: number) => {
      if (item.status === 'بانتظارك' || item.unread) {
        items.push({
          id: `case-${item.id}`,
          title: item.unread ? `تحديث جديد في ${item.title}` : `إجراء مطلوب في ${item.title}`,
          note: item.nextStep,
          reason: item.unread ? 'هناك تحديث جديد قد يغير الخطوة التالية.' : 'هذه القضية متوقفة على تدخل منك.',
          cta: 'فتح القضية',
          kind: item.unread ? 'message' : 'case',
          level: item.unread ? 'high' : 'medium',
          score: item.unread ? 88 - index : 74 - index,
          icon: item.unread ? ('mail-unread-outline' as const) : ('folder-open-outline' as const),
          tab: 'cases' as DashboardTab,
          caseId: item.id,
        });
      }
    });

    schedule.slice(0, 2).forEach((item: any, index: number) => {
      items.push({
        id: `schedule-${item.id}`,
        title: item.title,
        note: `موعد قريب: ${item.time}`,
        reason: 'المراجعة المبكرة للموعد تقلل مفاجآت اللحظة الأخيرة.',
        cta: 'عرض الموعد',
        kind: 'schedule',
        level: index === 0 ? 'medium' : 'low',
        score: 66 - index,
        icon: 'calendar-outline' as const,
        tab: 'schedule' as DashboardTab,
      });
    });

    pendingPayments.forEach((item: any, index: number) => {
      items.push({
        id: `payment-${item.id}`,
        title: item.label,
        note: `${item.amount} · ${item.date}`,
        reason: 'معالجة الدفعة الآن تمنع أي تأخير إداري أو تشغيلي.',
        cta: 'فتح المدفوعات',
        kind: 'payment',
        level: 'medium',
        score: 58 - index,
        icon: 'wallet-outline' as const,
        tab: 'payments' as DashboardTab,
      });
    });

    return items.sort((left, right) => right.score - left.score);
  }, [cases, pendingPayments, requiredDocuments, schedule]);

  const rangeLimit = headerRange === 'today' ? 3 : headerRange === 'week' ? 5 : 8;
  const filteredPriorityQueue = useMemo(() => {
    return priorityQueue
      .filter((item) => {
        if (headerFocus === 'all') return true;
        if (headerFocus === 'urgent') return item.level === 'critical' || item.level === 'high';
        return item.kind === 'document' || item.kind === 'case' || item.kind === 'message';
      })
      .slice(0, rangeLimit);
  }, [headerFocus, priorityQueue, rangeLimit]);

  const topPriority = filteredPriorityQueue[0] ?? priorityQueue[0];
  const timeline = useMemo(() => {
    const caseEvents = cases.slice(0, 3).map((item: any) => ({
      id: `case-${item.id}`,
      title: item.title,
      note: item.nextStep,
      meta: item.deadline,
      icon: 'scale-outline' as const,
      tab: 'cases' as DashboardTab,
      caseId: item.id,
    }));
    const documentEvents = requiredDocuments.slice(0, 2).map((doc: any) => ({
      id: `doc-${doc.id}`,
      title: doc.name,
      note: `مستند مطلوب في ${doc.caseName}`,
      meta: doc.updatedAt,
      icon: 'alert-circle-outline' as const,
      tab: 'documents' as DashboardTab,
    }));
    const scheduleEvents = schedule.slice(0, 2).map((item: any) => ({
      id: `schedule-${item.id}`,
      title: item.title,
      note: item.caseName,
      meta: item.time,
      icon: 'calendar-outline' as const,
      tab: 'schedule' as DashboardTab,
    }));
    const paymentEvents = payments.slice(0, 1).map((item: any) => ({
      id: `payment-${item.id}`,
      title: item.label,
      note: item.status,
      meta: item.date,
      icon: 'wallet-outline' as const,
      tab: 'payments' as DashboardTab,
    }));
    return [...documentEvents, ...caseEvents, ...scheduleEvents, ...paymentEvents].slice(0, rangeLimit);
  }, [cases, payments, rangeLimit, requiredDocuments, schedule]);

  const executiveSummary = useMemo(() => {
    const parts: string[] = [];
    if (requiredDocuments.length > 0) parts.push(`لديك ${requiredDocuments.length} مستندات مطلوبة`);
    const unreadCases = cases.filter((item: any) => item.unread).length;
    if (unreadCases > 0) parts.push(`${unreadCases} تحديثات جديدة من المحامي`);
    if (schedule.length > 0) parts.push(`أقرب موعد: ${schedule[0].time}`);
    if (parts.length === 0) return 'وضعك القانوني مستقر حالياً. يمكنك استكشاف الخدمات أو تجهيز ملفك بصورة أفضل.';
    return `${parts.join('، ')}. ابدأ بالأولوية الأعلى للحفاظ على سير ملفك بسلاسة.`;
  }, [cases, requiredDocuments.length, schedule]);

  const applyWorkspaceMode = (mode: WorkspaceMode) => {
    const nextMode = workspaceModes.find((item) => item.id === mode);
    if (!nextMode) return;
    setWorkspaceMode(mode);
    setHeaderRange(nextMode.range);
    setHeaderFocus(nextMode.focus);
    setActiveTab(nextMode.tab);
  };

  const openTab = (tab: DashboardTab, caseId?: string) => {
    if (caseId) setSelectedCaseId(caseId);
    setActiveTab(tab);
  };

  const openRoute = (route?: RouteKey) => {
    if (route) onOpen?.(route);
  };

  const greeting = getGreeting();

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        <Heading
          title={`${greeting}، ${user?.name?.split(' ')[0] || 'أهلاً'}`}
          subtitle={activeTab === 'overview' ? 'مركز عملياتك القانوني: أولويات، قضايا، مستندات، مواعيد، ومدفوعات في مكان واحد.' : tabMeta(activeTab)}
        />

        {showInsight ? (
          <Card>
            <View style={localStyles.insightHeader}>
              <Pressable onPress={() => setShowInsight(false)} style={localStyles.iconButton}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
              <View style={localStyles.rowEnd}>
                <View style={localStyles.sparkIcon}>
                  <Ionicons name="sparkles" size={18} color={colors.gold} />
                </View>
                <View style={localStyles.flex}>
                  <Text style={localStyles.kicker}>توصية ذكية</Text>
                  <Text style={localStyles.insightText}>{topPriority?.reason ?? executiveSummary}</Text>
                </View>
              </View>
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={localStyles.headerRow}>
            <Pill label="آخر مزامنة: الآن" tone="blue" />
            <Text style={localStyles.headerTitle}>{tabs.find((item) => item.id === activeTab)?.label}</Text>
          </View>
          <Text style={localStyles.summary}>{executiveSummary}</Text>
          <PrimaryAction
            title={topPriority?.cta ?? 'فتح القضايا'}
            icon={topPriority?.icon ?? 'folder-open-outline'}
            onPress={() => (topPriority ? openTab(topPriority.tab, topPriority.caseId) : openTab('cases'))}
          />
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.tabStrip}>
          {tabs.map((tab) => (
            <Chip
              key={tab.id}
              label={tab.label}
              icon={tab.icon}
              active={activeTab === tab.id}
              onPress={() => setActiveTab(tab.id)}
            />
          ))}
        </ScrollView>

        <View style={localStyles.metricsGrid}>
          {stats.map((stat) => (
            <Pressable key={stat.label} onPress={() => openTab(stat.tab)} style={localStyles.metricCard}>
              <Ionicons name={stat.icon} size={20} color={colors.gold} />
              <Text style={localStyles.metricValue}>{formatValue(stat.value)}</Text>
              <Text style={localStyles.metricLabel}>{stat.label}</Text>
              <Text style={localStyles.metricNote}>{stat.note}</Text>
            </Pressable>
          ))}
        </View>

        {isInitialLoading ? (
          <Card>
            <ActivityIndicator color={colors.gold} />
          </Card>
        ) : activeTab === 'overview' ? (
          renderOverview()
        ) : activeTab === 'cases' ? (
          renderCases()
        ) : activeTab === 'services' ? (
          renderServices()
        ) : activeTab === 'assist' ? (
          renderAssist()
        ) : activeTab === 'documents' ? (
          renderDocuments()
        ) : activeTab === 'schedule' ? (
          renderSchedule()
        ) : (
          renderPayments()
        )}
      </ScrollView>
    </Screen>
  );

  function renderOverview() {
    if (isFirstTimeUser) {
      return (
        <>
          <Card>
            <Text style={localStyles.heroTitle}>ابدأ من لوحة قانونية جاهزة لتنظيم أول خطوة</Text>
            <Text style={localStyles.mutedText}>لا توجد قضايا أو مستندات بعد. افتح أول طلب، استكشف الخدمات، أو اختر محامياً مناسباً لتبدأ بثقة.</Text>
            <PrimaryAction title="ابدأ طلبك الأول" icon="add-circle-outline" onPress={() => openRoute('cases')} />
          </Card>
          <EmptyState title="لا توجد قضايا مفتوحة بعد" note="عند فتح أول قضية ستظهر هنا الأولويات، التقدم، والخطوات التالية." />
          <EmptyState title="مجلد المستندات بانتظار أول ملف" note="ابدأ برفع مستند أساسي أو اختر خدمة قانونية وسيتم إعداد المتطلبات." />
        </>
      );
    }

    return (
      <>
        <Card>
          <Text style={localStyles.kicker}>Next Best Action</Text>
          <Text style={localStyles.heroTitle}>{topPriority?.title ?? 'مسارك القانوني تحت السيطرة'}</Text>
          <Text style={localStyles.mutedText}>{topPriority?.note ?? 'لا توجد عناصر حرجة حالياً.'}</Text>
          <View style={localStyles.actionRow}>
            <PrimaryAction title={topPriority?.cta ?? 'فتح القضايا'} icon={topPriority?.icon ?? 'folder-open-outline'} onPress={() => (topPriority ? openTab(topPriority.tab, topPriority.caseId) : openTab('cases'))} />
            <SecondaryAction title="اطلب تلخيصاً من AI" icon="sparkles-outline" onPress={() => openRoute('ai')} />
          </View>
        </Card>

        <Section title="أوضاع العمل">
          <View style={localStyles.gridTwo}>
            {workspaceModes.map((mode) => (
              <Pressable key={mode.id} onPress={() => applyWorkspaceMode(mode.id)} style={[localStyles.modeCard, workspaceMode === mode.id && localStyles.modeCardActive]}>
                <Text style={[localStyles.modeTitle, workspaceMode === mode.id && localStyles.modeTitleActive]}>{mode.label}</Text>
                <Text style={[localStyles.modeNote, workspaceMode === mode.id && localStyles.modeNoteActive]}>{mode.note}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="أولويات اليوم">
          {filteredPriorityQueue.length > 0 ? filteredPriorityQueue.map((item) => (
            <PriorityCard key={item.id} item={item} onPress={() => openTab(item.tab, item.caseId)} />
          )) : <EmptyState title="لا توجد إجراءات حالية" note="عند وصول تحديث جديد أو مستند مطلوب سيظهر هنا مباشرة." />}
        </Section>

        <Section title="المسارات السريعة">
          <View style={localStyles.gridTwo}>
            {quickActions.map((action) => (
              <QuickAction key={action.id} action={action} onPress={() => (action.tab ? openTab(action.tab) : openRoute(action.route))} />
            ))}
          </View>
        </Section>

        <Section title="الخط الزمني القانوني">
          {timeline.length > 0 ? timeline.map((item) => (
            <TimelineCard key={item.id} item={item} onPress={() => openTab(item.tab, item.caseId)} />
          )) : <EmptyState title="لا يوجد خط زمني بعد" note="ستظهر التحديثات والمهام والمواعيد هنا بعد بدء أول ملف." />}
        </Section>

        <Section title="مطلوب منك الآن">
          {requiredDocuments.length > 0 ? requiredDocuments.slice(0, 3).map((doc: any) => <DocumentCard key={doc.id} doc={doc} compact />) : <EmptyState title="لا توجد مستندات حرجة" note="كل شيء مستقر في هذا القسم حالياً." />}
          {schedule[0] ? <ScheduleCard item={schedule[0]} /> : null}
        </Section>
      </>
    );
  }

  function renderCases() {
    return (
      <>
        <Section title="خريطة الطريق والتقدم">
          {selectedCase?.milestones ? (
            <Card>
              {selectedCase.milestones.map((milestone: any, index: number) => (
                <View key={milestone.id} style={localStyles.milestoneRow}>
                  <View style={[localStyles.milestoneDot, milestone.status === 'completed' && localStyles.doneDot, milestone.status === 'current' && localStyles.currentDot]}>
                    <Text style={localStyles.milestoneNumber}>{milestone.status === 'completed' ? '✓' : index + 1}</Text>
                  </View>
                  <Text style={localStyles.milestoneText}>{milestone.label}</Text>
                </View>
              ))}
            </Card>
          ) : null}
          {cases.length > 0 ? cases.map((item: any) => (
            <Pressable key={item.id} onPress={() => setSelectedCaseId(item.id)}>
              <Card>
                <Pill label={item.urgency || item.status} tone={item.urgency === 'عالي' ? 'red' : 'gold'} />
                <Text style={localStyles.cardTitle}>{item.title}</Text>
                <Text style={localStyles.mutedText}>{item.nextStep}</Text>
                <Text style={localStyles.goldText}>{item.progress}% · {item.lawyer} · {item.deadline}</Text>
              </Card>
            </Pressable>
          )) : <EmptyState title="لا توجد قضايا لعرضها بعد" note="عند إنشاء أول قضية ستظهر هنا خريطة الطريق ونسبة التقدم." />}
        </Section>

        {selectedCase ? (
          <Section title="تفاصيل القضية">
            <InfoCard label="القضية" value={selectedCase.title} note={selectedCase.subtitle} />
            <InfoCard label="الخطوة التالية" value={selectedCase.nextStep} />
            <InfoCard label="المحامي" value={selectedCase.lawyer} />
            <InfoCard label="الموعد أو المهلة" value={selectedCase.deadline} />
          </Section>
        ) : null}
      </>
    );
  }

  function renderServices() {
    return (
      <>
        <Card>
          <Text style={localStyles.cardTitle}>كيف تبدأ؟</Text>
          <Text style={localStyles.mutedText}>اختر نوع الخدمة، راجع المحامين المقترحين، ثم احجز الموعد أو ارفع المتطلبات لبدء الإجراء.</Text>
        </Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.tabStrip}>
          {serviceCategories.map((category) => (
            <Chip key={category} label={String(category)} active={serviceCategory === category} onPress={() => setServiceCategory(String(category))} />
          ))}
        </ScrollView>
        <Section title="الخدمات القانونية المتاحة">
          {filteredServices.length > 0 ? filteredServices.map((service: any) => (
            <Card key={service.id}>
              <Pill label={service.category || 'خدمة'} tone="gold" />
              <Text style={localStyles.cardTitle}>{service.title}</Text>
              <Text style={localStyles.mutedText}>{service.description}</Text>
              <Text style={localStyles.goldText}>{service.price} · {service.time}</Text>
              <Text style={localStyles.smallText}>{service.lawyerName || 'محامي الخدمة'} · {service.lawyerSpecialty || 'التخصص المناسب'}</Text>
              <PrimaryAction title="بدء الطلب" icon="arrow-back-outline" onPress={() => openRoute('cases')} />
            </Card>
          )) : <EmptyState title="لا توجد خدمات في هذا التصنيف" note="جرّب تصنيفاً آخر أو انتقل إلى قائمة المحامين." />}
        </Section>
        {renderLawyerFinder()}
      </>
    );
  }

  function renderAssist() {
    const prompts = [
      'ما هي الخطوة التالية في عقد الإيجار التجاري؟',
      'لخص لي ملاحظات العلامة التجارية بلغة بسيطة',
      'ما المستندات الناقصة في المطالبة المالية؟',
      'هل يوجد موعد قريب يحتاج حضوري؟',
    ];

    return (
      <>
        <Card>
          <View style={localStyles.assistHero}>
            <Ionicons name="sparkles" size={28} color={colors.gold} />
            <Text style={localStyles.heroTitle}>اسأل عن قضيتك مباشرة</Text>
            <Text style={localStyles.mutedText}>افتح AI Chat لطلب شرح مبسط، تلخيص مستند، أو معرفة الخطوة التالية.</Text>
            <PrimaryAction title="فتح AI Chat" icon="chatbubbles-outline" onPress={() => openRoute('ai')} />
          </View>
        </Card>
        <Section title="أسئلة جاهزة">
          {prompts.map((prompt) => (
            <Pressable key={prompt} onPress={() => openRoute('ai')}>
              <Card>
                <Text style={localStyles.cardTitle}>{prompt}</Text>
              </Card>
            </Pressable>
          ))}
        </Section>
        <Section title="اختصارات مفيدة">
          <InfoCard label="القضية الحالية" value={selectedCase?.title || 'لا يوجد ملف مختار'} />
          <InfoCard label="أفضل سؤال الآن" value="ما الذي يجب أن أرسله اليوم؟" />
        </Section>
      </>
    );
  }

  function renderDocuments() {
    return (
      <>
        <Section title="المستندات">
          <View style={localStyles.gridTwo}>
            <MiniStat label="مستندات مطلوبة" value={requiredDocuments.length} tone="red" />
            <MiniStat label="آخر متابعة" value={selectedCase?.title || 'لا توجد'} note={selectedCase?.nextStep} />
          </View>
          {documents.length > 0 ? documents.map((doc: any) => <DocumentCard key={doc.id} doc={doc} />) : <EmptyState title="لا توجد مستندات بعد" note="عندما ترفع أول ملف أو تبدأ خدمة قانونية ستظهر هنا المستندات المطلوبة والمكتملة." />}
        </Section>
      </>
    );
  }

  function renderSchedule() {
    return (
      <Section title="المواعيد والتذكيرات">
        <View style={localStyles.gridTwo}>
          <MiniStat label="المواعيد" value={schedule.length} />
          <MiniStat label="تذكيرات هامة" value={Math.min(schedule.length, 2)} />
        </View>
        {schedule.length > 0 ? schedule.map((item: any) => <ScheduleCard key={item.id} item={item} />) : <EmptyState title="لا توجد مواعيد حالياً" note="عند تنسيق جلسة أو اقتراب مهلة مهمة ستظهر هنا." />}
      </Section>
    );
  }

  function renderPayments() {
    return (
      <>
        <Card>
          <Text style={localStyles.kicker}>الرصيد المتاح</Text>
          <Text style={localStyles.balance}>{formatValue(availableBalance)} IQD</Text>
          <PrimaryAction title="إضافة رصيد" icon="add-circle-outline" onPress={() => openRoute('billing')} />
        </Card>
        <Section title="المدفوعات والمحفظة">
          {payments.length > 0 ? payments.map((item: any) => (
            <Card key={item.id}>
              <Pill label={item.status} tone={item.status === 'مدفوع' ? 'green' : 'gold'} />
              <Text style={localStyles.cardTitle}>{item.label}</Text>
              <Text style={localStyles.mutedText}>{item.date}</Text>
              <Text style={localStyles.goldText}>{item.amount}</Text>
            </Card>
          )) : <EmptyState title="لا توجد حركة مالية بعد" note="بمجرد دفع استشارة أو شحن الرصيد ستظهر هنا الفواتير وسجل المصروفات." />}
        </Section>
        <Section title="طرق الدفع">
          <View style={localStyles.gridTwo}>
            <InfoCard label="طريقة دفع" value="زين كاش" />
            <InfoCard label="بطاقات" value="كي كارد / ماستر" />
          </View>
        </Section>
      </>
    );
  }

  function renderLawyerFinder() {
    return (
      <Section title="ابحث عن محامٍ من القائمة">
        {lawyers.length > 0 ? lawyers.slice(0, 6).map((lawyer: any) => (
          <Pressable key={lawyer.id} onPress={() => setSelectedLawyerId(lawyer.id)}>
            <Card>
              <View style={localStyles.lawyerHeader}>
                <View style={localStyles.avatar}>
                  <Text style={localStyles.avatarText}>{String(lawyer.name || 'م').charAt(0)}</Text>
                </View>
                <View style={localStyles.flex}>
                  <Text style={localStyles.cardTitle}>{lawyer.name}</Text>
                  <Text style={localStyles.mutedText}>{lawyer.tagline || `${lawyer.specialty} · ${lawyer.location}`}</Text>
                </View>
              </View>
              <View style={localStyles.lawyerMeta}>
                <Pill label={lawyer.specialty} tone="blue" />
                <Pill label={`${lawyer.rating} ★`} tone="gold" />
                <Pill label={lawyer.availability || lawyer.consultationFee} />
              </View>
              <View style={localStyles.actionRow}>
                <SecondaryAction title="الملف" icon="person-outline" onPress={() => openRoute('profile')} />
                <PrimaryAction title="تواصل" icon="chatbubble-outline" onPress={() => openRoute('messages')} />
              </View>
            </Card>
          </Pressable>
        )) : <EmptyState title="لا توجد قائمة محامين حالياً" note="جرّب تحديث الصفحة أو افتح صفحة المحامين الكاملة." />}
        {selectedLawyer ? (
          <Card>
            <Text style={localStyles.cardTitle}>تفاصيل المحامي المختار</Text>
            <Text style={localStyles.mutedText}>{selectedLawyer.name} · {selectedLawyer.specialty} · {selectedLawyer.location}</Text>
            <Text style={localStyles.goldText}>{selectedLawyer.experience} · {selectedLawyer.consultationFee}</Text>
            <PrimaryAction title={`افتح قضية مع ${selectedLawyer.name}`} icon="briefcase-outline" onPress={() => openRoute('cases')} />
          </Card>
        ) : null}
      </Section>
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={localStyles.section}>
      <Text style={localStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable onPress={onPress} style={[localStyles.chip, active && localStyles.chipActive]}>
      {icon ? <Ionicons name={icon} size={16} color={active ? '#fff' : colors.navy} /> : null}
      <Text style={[localStyles.chipText, active && localStyles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryAction({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={localStyles.primaryAction}>
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={localStyles.primaryActionText}>{title}</Text>
    </Pressable>
  );
}

function SecondaryAction({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={localStyles.secondaryAction}>
      <Ionicons name={icon} size={18} color={colors.navy} />
      <Text style={localStyles.secondaryActionText}>{title}</Text>
    </Pressable>
  );
}

function PriorityCard({ item, onPress }: { item: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={localStyles.priorityHeader}>
          <Pill label={levelLabel(item.level)} tone={item.level === 'critical' ? 'red' : item.level === 'high' ? 'gold' : 'blue'} />
          <Ionicons name={item.icon} size={22} color={colors.gold} />
        </View>
        <Text style={localStyles.cardTitle}>{item.title}</Text>
        <Text style={localStyles.mutedText}>{item.note}</Text>
        <Text style={localStyles.smallText}>{item.reason}</Text>
      </Card>
    </Pressable>
  );
}

function TimelineCard({ item, onPress }: { item: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={localStyles.timelineRow}>
          <View style={localStyles.timelineIcon}>
            <Ionicons name={item.icon} size={20} color={colors.navy} />
          </View>
          <View style={localStyles.flex}>
            <Text style={localStyles.cardTitle}>{item.title}</Text>
            <Text style={localStyles.mutedText}>{item.note}</Text>
            <Text style={localStyles.smallText}>{item.meta}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function QuickAction({ action, onPress }: { action: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={localStyles.quickCard}>
      <Ionicons name={action.icon} size={22} color={colors.navy} />
      <Text style={localStyles.quickTitle}>{action.label}</Text>
      <Text style={localStyles.quickNote}>{action.note}</Text>
    </Pressable>
  );
}

function DocumentCard({ doc, compact }: { doc: any; compact?: boolean }) {
  return (
    <Card>
      <Pill label={doc.status} tone={doc.status === 'مطلوب' ? 'red' : doc.status === 'مكتمل' ? 'green' : 'blue'} />
      <Text style={localStyles.cardTitle}>{doc.name}</Text>
      <Text style={localStyles.mutedText}>{doc.caseName}</Text>
      {!compact ? <Text style={localStyles.smallText}>{doc.type} · {doc.updatedAt}</Text> : null}
    </Card>
  );
}

function ScheduleCard({ item }: { item: any }) {
  return (
    <Card>
      <Pill label={item.type || 'موعد'} tone="gold" />
      <Text style={localStyles.cardTitle}>{item.title}</Text>
      <Text style={localStyles.mutedText}>مرتبط بـ: {item.caseName}</Text>
      <Text style={localStyles.goldText}>{item.time}</Text>
    </Card>
  );
}

function MiniStat({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: 'red' }) {
  return (
    <View style={[localStyles.miniStat, tone === 'red' && localStyles.miniStatRed]}>
      <Text style={[localStyles.metricValue, tone === 'red' && localStyles.redText]}>{formatValue(value)}</Text>
      <Text style={localStyles.metricLabel}>{label}</Text>
      {note ? <Text style={localStyles.metricNote}>{note}</Text> : null}
    </View>
  );
}

function InfoCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <Card>
      <Text style={localStyles.kicker}>{label}</Text>
      <Text style={localStyles.cardTitle}>{value}</Text>
      {note ? <Text style={localStyles.mutedText}>{note}</Text> : null}
    </Card>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 18) return 'طاب يومك';
  return 'مساء الخير';
}

function tabMeta(tab: DashboardTab) {
  const meta = {
    overview: 'الصورة العامة وأهم الإجراءات.',
    cases: 'خريطة الطريق ومتابعة الإجراءات.',
    services: 'استعراض وطلب الخدمات القانونية.',
    assist: 'AI Chat والمسارات السريعة.',
    documents: 'الملفات المطلوبة والمرفوعة.',
    schedule: 'الجلسات، التذكيرات، والمواعيد القادمة.',
    payments: 'الرصيد، الفواتير، والتكاليف.',
  };
  return meta[tab];
}

function levelLabel(level: string) {
  if (level === 'critical') return 'حرج';
  if (level === 'high') return 'عالٍ';
  if (level === 'medium') return 'متوسط';
  return 'منخفض';
}

function formatValue(value: string | number) {
  if (typeof value === 'number') return value.toLocaleString('ar-IQ');
  return value;
}

const localStyles = StyleSheet.create({
  actionRow: {
    gap: 10,
    marginTop: 12,
  },
  assistHero: {
    alignItems: 'flex-end',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  balance: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  chipTextActive: {
    color: '#fff',
  },
  currentDot: {
    backgroundColor: colors.gold,
  },
  doneDot: {
    backgroundColor: colors.green,
  },
  flex: {
    flex: 1,
  },
  goldText: {
    color: colors.gold,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  gridTwo: {
    gap: 10,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: 8,
    textAlign: 'right',
  },
  iconButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  insightHeader: {
    gap: 10,
  },
  insightText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'right',
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
  lawyerMeta: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metricCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    marginBottom: 10,
    minHeight: 132,
    padding: 12,
  },
  metricLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },
  metricNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
  },
  metricValue: {
    color: colors.gold,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  metricsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  milestoneDot: {
    alignItems: 'center',
    backgroundColor: '#d0d5dd',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  milestoneNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  milestoneRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 10,
  },
  milestoneText: {
    color: colors.ink,
    flex: 1,
    fontWeight: '800',
    textAlign: 'right',
  },
  miniStat: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  miniStatRed: {
    backgroundColor: '#fff1f0',
    borderColor: '#fecdca',
  },
  modeCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  modeCardActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  modeNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
  },
  modeNoteActive: {
    color: '#e4e7ec',
  },
  modeTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  modeTitleActive: {
    color: '#fff',
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 22,
    marginTop: 6,
    textAlign: 'right',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  priorityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  quickNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
  },
  quickTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  redText: {
    color: colors.red,
  },
  rowEnd: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: '#eef2f6',
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 8,
    textAlign: 'right',
  },
  smallText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'right',
  },
  sparkIcon: {
    alignItems: 'center',
    backgroundColor: '#fff6df',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  summary: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: 12,
    textAlign: 'right',
  },
  tabStrip: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 12,
  },
  timelineIcon: {
    alignItems: 'center',
    backgroundColor: '#eef2f6',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  timelineRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 12,
  },
});
