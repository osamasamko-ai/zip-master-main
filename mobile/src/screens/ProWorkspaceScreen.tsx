import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, EmptyState, Screen, SkeletonCard, Toast } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { colors } from '../theme/colors';

type Tab = 'overview' | 'cases' | 'messages' | 'documents' | 'earnings' | 'operations' | 'account';
type CaseFilter = 'all' | 'urgent' | 'pinned' | 'billing';
type InboxFilter = 'all' | 'unread' | 'urgent' | 'waiting';
type VaultFilter = 'all' | 'needs-review' | 'signed' | 'confidential';
type SavedView = 'today-work' | 'urgent-today' | 'awaiting-reply' | 'needs-review';
type Composer = 'case' | 'appointment' | 'vault' | 'reply' | 'note' | 'doc-note' | 'workbench' | null;

const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'overview', label: 'اليوم', icon: 'grid-outline' },
  { id: 'cases', label: 'القضايا', icon: 'briefcase-outline' },
  { id: 'messages', label: 'الرسائل', icon: 'mail-outline' },
  { id: 'documents', label: 'الوثائق', icon: 'folder-open-outline' },
  { id: 'earnings', label: 'الأرباح', icon: 'wallet-outline' },
  { id: 'operations', label: 'تشغيل', icon: 'sparkles-outline' },
  { id: 'account', label: 'الحساب', icon: 'person-circle-outline' },
];

const aiSuggestions = [
  'تلخيص حالة القضية الأخيرة',
  'صياغة رد قانوني على رسالة العميل',
  'استخراج المخاطر القانونية من مستند',
  'تحضير نقاط اجتماع العميل القادم',
];

export function ProWorkspaceScreen() {
  const [workspace, setWorkspace] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [composer, setComposer] = useState<Composer>(null);
  const [savedView, setSavedView] = useState<SavedView>('today-work');
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [timerCaseId, setTimerCaseId] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [replyDraft, setReplyDraft] = useState('');
  const [workbenchReply, setWorkbenchReply] = useState('');
  const [caseNote, setCaseNote] = useState('');
  const [docReviewNote, setDocReviewNote] = useState('');
  const [aiPrompt, setAiPrompt] = useState(aiSuggestions[0]);
  const [aiResponse, setAiResponse] = useState('اختر أمراً ذكياً لتظهر هنا خلاصة تنفيذية مختصرة.');
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseClient, setNewCaseClient] = useState('');
  const [newCaseMatter, setNewCaseMatter] = useState('');
  const [newCasePriority, setNewCasePriority] = useState('Medium');
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');

  const load = async (initial = false) => {
    if (initial) setInitialLoading(true);
    setRefreshing(true);
    try {
      const response = await apiClient.getProWorkspace();
      setWorkspace(response.data);
      const firstCase = response.data?.cases?.[0];
      const firstDoc = response.data?.vaultDocs?.[0];
      const firstMsg = response.data?.inboxMessages?.[0];
      setSelectedCaseId((current) => current || firstCase?.id || '');
      setSelectedDocId((current) => current || firstDoc?.id || '');
      setSelectedMessageId((current) => current || firstMsg?.id || '');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحميل مساحة المحامي.');
    } finally {
      setRefreshing(false);
      if (initial) setInitialLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, []);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = setInterval(() => setTimerSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

  const cases = workspace?.cases || [];
  const appointments = workspace?.appointments || [];
  const clients = workspace?.clients || [];
  const tasks = workspace?.teamTasks || [];
  const messages = workspace?.inboxMessages || [];
  const docs = workspace?.vaultDocs || [];
  const timeline = workspace?.caseTimeline || [];
  const deadlines = workspace?.deadlineReminders || [];
  const summary = workspace?.summary || {};

  const selectedCase = cases.find((item: any) => item.id === selectedCaseId) || cases[0];
  const selectedMessage = messages.find((item: any) => item.id === selectedMessageId) || messages[0];
  const selectedDoc = docs.find((item: any) => item.id === selectedDocId) || docs[0];

  const urgentCases = cases.filter((item: any) => item.status === 'At Risk' || item.priority === 'High' || item.riskScore >= 70);
  const pinnedCases = cases.filter((item: any) => item.isPinned);
  const billingCases = cases.filter((item: any) => (item.outstandingInvoice || 0) > 0);
  const unreadMessages = messages.filter((item: any) => item.unread);
  const waitingMessages = messages.filter((item: any) => item.awaitingResponse);
  const urgentMessages = messages.filter((item: any) => item.priority === 'High');
  const docsReview = docs.filter((item: any) => item.status === 'Needs Review');
  const signedDocs = docs.filter((item: any) => item.status === 'Signed');
  const confidentialDocs = docs.filter((item: any) => item.confidential);
  const selectedCaseMessages = messages.filter((item: any) => item.caseId === selectedCase?.id || item.caseTitle === selectedCase?.title);
  const selectedCaseDocs = docs.filter((item: any) => item.caseTitle === selectedCase?.title || item.caseId === selectedCase?.id);
  const selectedCaseTimeline = timeline.filter((item: any) => !item.caseId || item.caseId === selectedCase?.id || item.caseTitle === selectedCase?.title);
  const selectedCaseDeadlines = deadlines.filter((item: any) => item.caseId === selectedCase?.id || item.caseTitle === selectedCase?.title);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((item: any) => {
      const matchesSearch = !q || [item.title, item.client, item.matter].some((value) => String(value || '').toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (caseFilter === 'urgent') return urgentCases.some((caseItem: any) => caseItem.id === item.id);
      if (caseFilter === 'pinned') return item.isPinned;
      if (caseFilter === 'billing') return (item.outstandingInvoice || 0) > 0;
      return true;
    });
  }, [billingCases.length, caseFilter, cases, search, urgentCases]);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((item: any) => {
      const matchesSearch = !q || [item.name, item.text, item.caseTitle, item.channel].some((value) => String(value || '').toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (inboxFilter === 'unread') return item.unread;
      if (inboxFilter === 'urgent') return item.priority === 'High';
      if (inboxFilter === 'waiting') return item.awaitingResponse;
      return true;
    });
  }, [inboxFilter, messages, search]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((item: any) => {
      const matchesSearch = !q || [item.name, item.caseTitle, item.owner].some((value) => String(value || '').toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (vaultFilter === 'needs-review') return item.status === 'Needs Review';
      if (vaultFilter === 'signed') return item.status === 'Signed';
      if (vaultFilter === 'confidential') return item.confidential;
      return true;
    });
  }, [docs, search, vaultFilter]);

  const savedViews = [
    { id: 'today-work' as const, label: 'طابور اليوم', count: cases.length, tab: 'cases' as Tab, filter: 'all' as CaseFilter },
    { id: 'urgent-today' as const, label: 'العاجلة', count: urgentCases.length, tab: 'cases' as Tab, filter: 'urgent' as CaseFilter },
    { id: 'awaiting-reply' as const, label: 'بانتظار رد', count: waitingMessages.length, tab: 'messages' as Tab },
    { id: 'needs-review' as const, label: 'وثائق معلقة', count: docsReview.length, tab: 'documents' as Tab },
  ];

  const openSavedView = (view: (typeof savedViews)[number]) => {
    setSavedView(view.id);
    setActiveTab(view.tab);
    if (view.id === 'urgent-today') setCaseFilter('urgent');
    if (view.id === 'today-work') setCaseFilter('all');
    if (view.id === 'awaiting-reply') setInboxFilter('waiting');
    if (view.id === 'needs-review') setVaultFilter('needs-review');
  };

  const createCase = async () => {
    if (!newCaseTitle.trim() || !newCaseClient.trim() || !newCaseMatter.trim()) {
      setStatus('أدخل عنوان القضية والعميل والموضوع.');
      return;
    }
    setBusy('case');
    try {
      const response = await apiClient.createProCase({ title: newCaseTitle.trim(), client: newCaseClient.trim(), matter: newCaseMatter.trim(), priority: newCasePriority });
      setWorkspace(response.data);
      setNewCaseTitle('');
      setNewCaseClient('');
      setNewCaseMatter('');
      setComposer(null);
      setStatus('تم إنشاء القضية.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إنشاء القضية.');
    } finally {
      setBusy('');
    }
  };

  const createAppointment = async () => {
    if (!appointmentTitle.trim() || !appointmentTime.trim()) {
      setStatus('أدخل عنوان الموعد والوقت.');
      return;
    }
    setBusy('appointment');
    try {
      const response = await apiClient.createProAppointment({ title: appointmentTitle.trim(), time: appointmentTime.trim(), client: selectedCase?.client || newCaseClient || 'عميل', type: 'video', caseId: selectedCase?.id || null });
      setWorkspace(response.data);
      setAppointmentTitle('');
      setAppointmentTime('');
      setComposer(null);
      setStatus('تم حفظ الموعد.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر حفظ الموعد.');
    } finally {
      setBusy('');
    }
  };

  const uploadVault = async () => {
    setBusy('vault');
    try {
      const response = await apiClient.uploadProVaultDocument(selectedCase?.id || null);
      setWorkspace(response.data);
      setActiveTab('documents');
      setComposer(null);
      setStatus('تمت إضافة مستند إلى الخزنة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة المستند.');
    } finally {
      setBusy('');
    }
  };

  const updateMessage = async (message: any, payload: any) => {
    setBusy(`msg-${message.id}`);
    try {
      await apiClient.updateProMessageState(message.id, payload);
      await load(false);
      setStatus('تم تحديث الرسالة.');
    } catch {
      setStatus('تعذر تحديث الرسالة.');
    } finally {
      setBusy('');
    }
  };

  const sendReply = async () => {
    if (!replyDraft.trim() || !selectedMessage) return;
    const targetCaseId = selectedMessage.caseId || selectedCase?.id;
    if (!targetCaseId) return;
    setBusy('reply');
    try {
      await apiClient.addCaseMessage(targetCaseId, replyDraft.trim(), 'lawyer');
      await apiClient.updateProMessageState(selectedMessage.id, { unread: false, awaitingResponse: false });
      setReplyDraft('');
      setComposer(null);
      await load(false);
      setStatus('تم إرسال الرد.');
    } catch {
      setStatus('تعذر إرسال الرد.');
    } finally {
      setBusy('');
    }
  };

  const bulkStatus = async (nextStatus: string) => {
    if (selectedCaseIds.length === 0) return;
    setBusy('bulk');
    try {
      const response = await apiClient.bulkUpdateProCaseStatus(selectedCaseIds, nextStatus);
      if (response.data) setWorkspace(response.data);
      setSelectedCaseIds([]);
      setStatus(`تم تحديث ${selectedCaseIds.length.toLocaleString('ar-IQ')} قضية.`);
    } catch {
      setStatus('تعذر تحديث القضايا المختارة.');
    } finally {
      setBusy('');
    }
  };

  const bulkDelete = async () => {
    if (selectedCaseIds.length === 0) return;
    const previous = cases.filter((item: any) => selectedCaseIds.includes(item.id));
    setWorkspace((current: any) => ({ ...current, cases: cases.filter((item: any) => !selectedCaseIds.includes(item.id)) }));
    setSelectedCaseIds([]);
    setStatus(`تم حذف ${previous.length.toLocaleString('ar-IQ')} قضية. يمكن استعادتها من الويب عند الحاجة.`);
    try {
      await apiClient.bulkDeleteProCases(previous.map((item: any) => item.id));
    } catch {
      setStatus('تعذر تأكيد الحذف من الخادم.');
    }
  };

  const toggleTimer = (caseId: string) => {
    if (timerCaseId === caseId) {
      setTimerRunning((current) => !current);
      return;
    }
    setTimerCaseId(caseId);
    setTimerSeconds(0);
    setTimerRunning(true);
  };

  const updateCaseProgress = async (caseId: string, progress: number) => {
    const normalized = Math.min(100, Math.max(0, progress));
    setBusy(`progress-${caseId}`);
    try {
      await apiClient.updateWorkspaceCaseProgress(caseId, normalized);
      setWorkspace((current: any) => ({ ...current, cases: cases.map((item: any) => item.id === caseId ? { ...item, progress: normalized } : item) }));
      setStatus(`تم حفظ نسبة الإنجاز ${normalized}%.`);
    } catch {
      setStatus('تعذر حفظ نسبة الإنجاز.');
    } finally {
      setBusy('');
    }
  };

  const updateCaseStatus = async (caseId: string, nextStatus: string) => {
    setBusy(`status-${caseId}`);
    try {
      const response = await apiClient.bulkUpdateProCaseStatus([caseId], nextStatus);
      if (response.data) setWorkspace(response.data);
      else setWorkspace((current: any) => ({ ...current, cases: cases.map((item: any) => item.id === caseId ? { ...item, status: nextStatus } : item) }));
      setStatus('تم تحديث حالة القضية.');
    } catch {
      setStatus('تعذر تحديث حالة القضية.');
    } finally {
      setBusy('');
    }
  };

  const savePrivateNote = async () => {
    if (!selectedCase) return;
    setBusy('private-note');
    try {
      await apiClient.updateWorkspaceCasePrivateNote(selectedCase.id, caseNote);
      setWorkspace((current: any) => ({ ...current, cases: cases.map((item: any) => item.id === selectedCase.id ? { ...item, privateNote: caseNote } : item) }));
      setComposer(null);
      setStatus('تم حفظ الملاحظة الخاصة.');
    } catch {
      setStatus('تعذر حفظ الملاحظة الخاصة.');
    } finally {
      setBusy('');
    }
  };

  const sendWorkbenchMessage = async () => {
    if (!workbenchReply.trim() || !selectedCase) return;
    setBusy('workbench-reply');
    try {
      await apiClient.addCaseMessage(selectedCase.id, workbenchReply.trim(), 'lawyer');
      setWorkbenchReply('');
      await load(false);
      setStatus('تم إرسال التحديث داخل القضية.');
    } catch {
      setStatus('تعذر إرسال تحديث القضية.');
    } finally {
      setBusy('');
    }
  };

  const reviewDocument = async (doc: any, nextStatus: 'Reviewed' | 'Needs Review') => {
    const targetCase = cases.find((item: any) => item.id === doc.caseId || item.title === doc.caseTitle) || selectedCase;
    if (!targetCase) return;
    setBusy(`doc-review-${doc.id}`);
    try {
      await apiClient.reviewWorkspaceDocument(targetCase.id, doc.id, nextStatus, docReviewNote || undefined);
      setWorkspace((current: any) => ({ ...current, vaultDocs: docs.map((item: any) => item.id === doc.id ? { ...item, status: nextStatus, actionRequired: docReviewNote || null } : item) }));
      setDocReviewNote('');
      setComposer(null);
      setStatus(nextStatus === 'Reviewed' ? 'تمت مراجعة المستند.' : 'تم طلب مراجعة للمستند.');
    } catch {
      setStatus('تعذر تحديث حالة المستند.');
    } finally {
      setBusy('');
    }
  };

  const openDocument = (doc: any) => {
    const targetUrl = doc.previewUrl || doc.fileUrl || doc.url;
    if (targetUrl) Linking.openURL(targetUrl);
    else setStatus('لا توجد معاينة لهذا المستند.');
  };

  const shareCaseReport = async () => {
    if (!selectedCase) return;
    const report = [
      `تقرير القضية: ${selectedCase.title}`,
      `العميل: ${selectedCase.client}`,
      `الموضوع: ${selectedCase.matter}`,
      `الحالة: ${selectedCase.status}`,
      `التقدم: ${selectedCase.progress || 0}%`,
      `المخاطر: ${selectedCase.riskScore || 0}%`,
      `الفوترة: ${selectedCase.outstandingInvoice || 0}`,
    ].join('\n');
    await Share.share({ title: selectedCase.title, message: report });
    setStatus('تم تجهيز تقرير القضية للمشاركة.');
  };

  const requestWithdrawal = () => {
    if ((summary.availableToWithdraw || 0) <= 0) {
      setStatus('لا يوجد رصيد متاح للسحب حالياً.');
      return;
    }
    setActiveTab('earnings');
    setStatus(`طلب السحب جاهز بقيمة ${(summary.availableToWithdraw || 0).toLocaleString('ar-IQ')}.`);
  };

  const accountAction = (action: 'subscription' | 'payout' | 'profile' | 'invoices') => {
    if (action === 'payout') {
      setActiveTab('earnings');
      setStatus('راجع وسيلة السحب ثم أكد الطلب.');
      return;
    }
    if (action === 'subscription') setStatus('إدارة الاشتراك متاحة من قسم الفوترة في التطبيق/الموقع.');
    if (action === 'profile') setStatus('انتقل إلى الملف الشخصي لتحسين الظهور العام.');
    if (action === 'invoices') setStatus('سجل الفواتير يظهر ضمن الأرباح والمعاملات.');
  };

  const openDeadlineMap = (deadline: any) => {
    const query = encodeURIComponent(`${deadline.court || ''} ${deadline.governorate || ''}`.trim());
    if (query) Linking.openURL(`https://www.google.com/maps/search/${query}`);
  };

  const runAi = () => {
    const caseTitle = selectedCase?.title || 'آخر قضية';
    setAiResponse(`خلاصة ذكية: راجع ${caseTitle}، ابدأ بالرسائل المنتظرة (${waitingMessages.length})، ثم وثائق المراجعة (${docsReview.length}). الإجراء المقترح: جدولة متابعة وإرسال رد مختصر للعميل.`);
  };

  if (initialLoading) {
    return (
      <Screen>
        <SkeletonCard media />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <HeroSection
          icon="briefcase-outline"
          iconColor="#fff"
          kicker="Professional Workspace"
          title="مساحة المحامي"
          subtitle="أهم أعمال اليوم في مكان واحد، مع أوامر سريعة وقوائم مختصرة للجوال."
          refreshing={refreshing}
        >
          <View style={styles.commandGrid}>
            <QuickAction icon="add-circle-outline" label="قضية" onPress={() => { setActiveTab('cases'); setComposer(composer === 'case' ? null : 'case'); }} active={composer === 'case'} />
            <QuickAction icon="calendar-outline" label="موعد" onPress={() => { setActiveTab('operations'); setComposer(composer === 'appointment' ? null : 'appointment'); }} active={composer === 'appointment'} />
            <QuickAction icon="document-attach-outline" label="مستند" onPress={() => { setActiveTab('documents'); setComposer('vault'); uploadVault(); }} active={busy === 'vault'} />
            <QuickAction icon="chatbubble-ellipses-outline" label="رد" onPress={() => { setActiveTab('messages'); setComposer(composer === 'reply' ? null : 'reply'); }} active={composer === 'reply'} />
          </View>
        </HeroSection>

        <Toast message={status} tone={status.includes('تعذر') || status.includes('أدخل') ? 'error' : status.includes('تم') ? 'success' : 'info'} />

        <View style={styles.statsGrid}>
          <Metric label="عاجلة" value={urgentCases.length} tone="red" onPress={() => { setActiveTab('cases'); setCaseFilter('urgent'); }} />
          <Metric label="رسائل" value={unreadMessages.length} tone="blue" onPress={() => { setActiveTab('messages'); setInboxFilter('unread'); }} />
          <Metric label="متاح للسحب" value={Math.round((summary.availableToWithdraw || 0) / 1000)} tone="green" onPress={() => setActiveTab('earnings')} />
          <Metric label="متابعون" value={summary.followers || 0} tone="gold" onPress={() => setActiveTab('account')} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
          {savedViews.map((view) => <SavedChip key={view.id} label={view.label} count={view.count} active={savedView === view.id} onPress={() => openSavedView(view)} />)}
        </ScrollView>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.navy} />
          <TextInput value={search} onChangeText={setSearch} placeholder="بحث في القضايا، الرسائل، الوثائق" placeholderTextColor={colors.subtle} style={styles.searchInput} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map((tab) => <TabChip key={tab.id} tab={tab} active={activeTab === tab.id} onPress={() => setActiveTab(tab.id)} />)}
        </ScrollView>

        {activeTab === 'overview' ? renderOverview() : null}
        {activeTab === 'cases' ? renderCases() : null}
        {activeTab === 'messages' ? renderMessages() : null}
        {activeTab === 'documents' ? renderDocuments() : null}
        {activeTab === 'earnings' ? renderEarnings() : null}
        {activeTab === 'operations' ? renderOperations() : null}
        {activeTab === 'account' ? renderAccount() : null}
      </ScrollView>
    </Screen>
  );

  function renderOverview() {
    return (
      <>
        {selectedCase ? (
          <Card title="الإجراء التالي" note="أعلى ملف يحتاج انتباهك الآن." action="فتح">
            <CaseCard item={urgentCases[0] || selectedCase} selected={false} timerCaseId={timerCaseId} timerRunning={timerRunning} timerSeconds={timerSeconds} onOpen={() => { setSelectedCaseId((urgentCases[0] || selectedCase).id); setActiveTab('cases'); }} onSelect={() => undefined} onTimer={() => toggleTimer((urgentCases[0] || selectedCase).id)} />
          </Card>
        ) : <EmptyState title="لا توجد قضايا بعد" note="أنشئ أول قضية من تبويب القضايا." />}
        <Card title="المواعيد القريبة" note={`${appointments.length.toLocaleString('ar-IQ')} موعد`}>
          {appointments.slice(0, 4).map((item: any) => <InfoRow key={item.id} icon="calendar-outline" title={item.title} note={`${item.client} · ${item.time}`} />)}
          {appointments.length === 0 ? <EmptyState title="لا توجد مواعيد" /> : null}
        </Card>
        <Card title="آخر النشاط" note="مستندات، دفعات، ومواعيد مهمة.">
          {timeline.slice(0, 4).map((item: any) => <InfoRow key={item.id} icon="time-outline" title={item.title} note={`${item.date} · ${item.detail}`} />)}
          {timeline.length === 0 ? <EmptyState title="لا يوجد نشاط حديث" /> : null}
        </Card>
        {selectedCase ? (
          <Card title="ملف مفتوح سريع" note={`${selectedCase.client} · ${selectedCase.matter}`}>
            <View style={styles.statsGrid}>
              <Metric label="رسائل" value={selectedCaseMessages.length} tone="blue" onPress={() => setActiveTab('messages')} />
              <Metric label="وثائق" value={selectedCaseDocs.length} tone="gold" onPress={() => setActiveTab('documents')} />
              <Metric label="فوترة" value={selectedCase.outstandingInvoice || 0} tone="green" onPress={() => setActiveTab('earnings')} />
            </View>
            <View style={styles.inlineActions}>
              <Button title="فتح العمل" variant="secondary" onPress={() => { setActiveTab('cases'); setComposer('workbench'); }} />
              <Button title="تقرير" variant="secondary" onPress={shareCaseReport} />
            </View>
          </Card>
        ) : null}
      </>
    );
  }

  function renderCases() {
    const filters = [
      { id: 'all' as const, label: 'الكل', count: cases.length },
      { id: 'urgent' as const, label: 'العاجلة', count: urgentCases.length },
      { id: 'pinned' as const, label: 'مثبتة', count: pinnedCases.length },
      { id: 'billing' as const, label: 'مالية', count: billingCases.length },
    ];
    return (
      <>
        <View style={styles.sectionHeader}>
          <Pressable onPress={() => setComposer(composer === 'case' ? null : 'case')} style={styles.iconButton}><Ionicons name={composer === 'case' ? 'close-outline' : 'add-outline'} size={19} color={colors.blue} /></Pressable>
          <View>
            <Text style={styles.listTitle}>ملفات العمل</Text>
            <Text style={styles.listNote}>{filteredCases.length.toLocaleString('ar-IQ')} نتيجة حسب الفلتر</Text>
          </View>
        </View>
        {composer === 'case' ? (
          <Card title="قضية جديدة" note="البيانات الضرورية فقط لإنشاء ملف سريع.">
            <Field value={newCaseTitle} onChangeText={setNewCaseTitle} placeholder="عنوان القضية" />
            <Field value={newCaseClient} onChangeText={setNewCaseClient} placeholder="اسم العميل" />
            <Field value={newCaseMatter} onChangeText={setNewCaseMatter} placeholder="موضوع القضية" />
            <View style={styles.segmented}>
              {['High', 'Medium', 'Low'].map((priority) => <SmallChip key={priority} label={priority} active={newCasePriority === priority} onPress={() => setNewCasePriority(priority)} />)}
            </View>
            <Button title="إنشاء قضية" onPress={createCase} loading={busy === 'case'} />
          </Card>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((item) => <FilterChip key={item.id} label={item.label} count={item.count} active={caseFilter === item.id} onPress={() => setCaseFilter(item.id)} />)}
        </ScrollView>
        {selectedCaseIds.length > 0 ? (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkText}>{selectedCaseIds.length.toLocaleString('ar-IQ')} مختارة</Text>
            <Pressable onPress={() => bulkStatus('In Review')} style={styles.bulkButton}><Text style={styles.bulkButtonText}>مراجعة</Text></Pressable>
            <Pressable onPress={() => bulkStatus('Closed')} style={styles.bulkButton}><Text style={styles.bulkButtonText}>إغلاق</Text></Pressable>
            <Pressable onPress={bulkDelete} style={[styles.bulkButton, styles.bulkDanger]}><Text style={[styles.bulkButtonText, styles.bulkDangerText]}>حذف</Text></Pressable>
          </View>
        ) : null}
        {filteredCases.map((item: any) => (
          <View key={item.id}>
            <CaseCard
              item={item}
              selected={selectedCaseIds.includes(item.id)}
              timerCaseId={timerCaseId}
              timerRunning={timerRunning}
              timerSeconds={timerSeconds}
              onOpen={() => { setSelectedCaseId(item.id); setCaseNote(item.privateNote || ''); }}
              onSelect={() => setSelectedCaseIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
              onTimer={() => toggleTimer(item.id)}
            />
            {selectedCase?.id === item.id ? (
              <Card title="مساحة عمل القضية" note="التحكم التفصيلي بدون مغادرة القائمة.">
                <View style={styles.rowWrap}>
                  {['Open', 'In Review', 'At Risk', 'Closed'].map((next) => <SmallChip key={next} label={next} active={item.status === next} onPress={() => updateCaseStatus(item.id, next)} />)}
                </View>
                <View style={styles.progressPanel}>
                  <Text style={styles.infoTitle}>التقدم {item.progress || 0}%</Text>
                  <View style={styles.stepperRow}>
                    <Button title="-10" variant="secondary" loading={busy === `progress-${item.id}`} onPress={() => updateCaseProgress(item.id, (item.progress || 0) - 10)} />
                    <Button title="+10" variant="secondary" loading={busy === `progress-${item.id}`} onPress={() => updateCaseProgress(item.id, (item.progress || 0) + 10)} />
                  </View>
                </View>
                <View style={styles.statsGrid}>
                  <Metric label="مخاطر" value={`${item.riskScore || 0}%`} tone={(item.riskScore || 0) > 70 ? 'red' : 'gold'} />
                  <Metric label="ساعات" value={item.billableHours || 0} tone="blue" />
                  <Metric label="مستحق" value={item.outstandingInvoice || 0} tone="green" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <SmallChip label="رد داخل القضية" active={composer === 'workbench'} onPress={() => setComposer(composer === 'workbench' ? null : 'workbench')} />
                  <SmallChip label="ملاحظة خاصة" active={composer === 'note'} onPress={() => { setCaseNote(item.privateNote || caseNote); setComposer(composer === 'note' ? null : 'note'); }} />
                  <SmallChip label="مستندات القضية" active={false} onPress={() => setActiveTab('documents')} />
                  <SmallChip label="الفوترة" active={false} onPress={() => setActiveTab('earnings')} />
                </ScrollView>
                {composer === 'workbench' ? (
                  <View style={styles.formBlock}>
                    <Field value={workbenchReply} onChangeText={setWorkbenchReply} placeholder="اكتب تحديثاً للعميل داخل القضية" multiline />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {['تمت مراجعة الملف وسأرسل الخطوة التالية.', 'نحتاج مستنداً إضافياً لإكمال الإجراء.', 'تم تحديد موعد المتابعة.'].map((text) => <SmallChip key={text} label={text} active={false} onPress={() => setWorkbenchReply(text)} />)}
                    </ScrollView>
                    <Button title="إرسال داخل القضية" loading={busy === 'workbench-reply'} onPress={sendWorkbenchMessage} />
                  </View>
                ) : null}
                {composer === 'note' ? (
                  <View style={styles.formBlock}>
                    <Field value={caseNote} onChangeText={setCaseNote} placeholder="ملاحظة داخلية لا تظهر للعميل" multiline />
                    <Button title="حفظ الملاحظة" loading={busy === 'private-note'} onPress={savePrivateNote} />
                  </View>
                ) : null}
                <Card title="سجل القضية" note={`${selectedCaseTimeline.length.toLocaleString('ar-IQ')} حدث`}>
                  {selectedCaseTimeline.slice(0, 4).map((entry: any) => <InfoRow key={entry.id} icon={entry.type === 'hearing' ? 'business-outline' : entry.type === 'client' ? 'chatbubbles-outline' : 'document-text-outline'} title={entry.title} note={`${entry.date} · ${entry.detail}`} />)}
                  {selectedCaseTimeline.length === 0 ? <EmptyState title="لا يوجد سجل مرتبط" /> : null}
                </Card>
              </Card>
            ) : null}
          </View>
        ))}
        {filteredCases.length === 0 ? <EmptyState title="لا توجد قضايا مطابقة" /> : null}
      </>
    );
  }

  function renderMessages() {
    const filters = [
      { id: 'all' as const, label: 'الكل', count: messages.length },
      { id: 'unread' as const, label: 'غير مقروء', count: unreadMessages.length },
      { id: 'urgent' as const, label: 'عاجل', count: urgentMessages.length },
      { id: 'waiting' as const, label: 'بانتظار رد', count: waitingMessages.length },
    ];
    return (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((item) => <FilterChip key={item.id} label={item.label} count={item.count} active={inboxFilter === item.id} onPress={() => setInboxFilter(item.id)} />)}
        </ScrollView>
        {filteredMessages.map((item: any) => (
          <Pressable key={item.id} onPress={() => setSelectedMessageId(item.id)} style={[styles.messageCard, selectedMessage?.id === item.id && styles.activeCard]}>
            <View style={styles.rowBetween}>
              <Text style={styles.timeText}>{item.time}</Text>
              <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <Text style={styles.mutedText}>{item.caseTitle} · {item.channel}</Text>
            <Text style={styles.bodyText}>{item.text}</Text>
            <View style={styles.messageMeta}>
              {item.unread ? <Status label="جديدة" tone="blue" /> : null}
              {item.awaitingResponse ? <Status label="متابعة" tone="gold" /> : null}
            </View>
            <View style={styles.inlineActions}>
              <Button title="مقروءة" variant="secondary" onPress={() => updateMessage(item, { unread: false })} loading={busy === `msg-${item.id}`} />
              <Button title={item.awaitingResponse ? 'إغلاق متابعة' : 'متابعة'} variant="secondary" onPress={() => updateMessage(item, { unread: false, awaitingResponse: !item.awaitingResponse })} loading={busy === `msg-${item.id}`} />
            </View>
          </Pressable>
        ))}
        {(composer === 'reply' || selectedMessage) ? <Card title="رد سريع" note={selectedMessage ? `إلى ${selectedMessage.name}` : 'اختر رسالة أولاً'}>
          <Field value={replyDraft} onChangeText={setReplyDraft} placeholder="اكتب ردك للعميل" multiline />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {['اطلعت على رسالتك وسأتابع اليوم.', 'أحتاج مستندات داعمة.', 'الخطوة التالية هي مراجعة الملف.'].map((text) => <SmallChip key={text} label={text} active={false} onPress={() => setReplyDraft(text)} />)}
          </ScrollView>
          <Button title="إرسال الرد" onPress={sendReply} loading={busy === 'reply'} />
        </Card> : null}
      </>
    );
  }

  function renderDocuments() {
    const filters = [
      { id: 'all' as const, label: 'الكل', count: docs.length },
      { id: 'needs-review' as const, label: 'مراجعة', count: docsReview.length },
      { id: 'signed' as const, label: 'موقعة', count: signedDocs.length },
      { id: 'confidential' as const, label: 'سرية', count: confidentialDocs.length },
    ];
    return (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((item) => <FilterChip key={item.id} label={item.label} count={item.count} active={vaultFilter === item.id} onPress={() => setVaultFilter(item.id)} />)}
        </ScrollView>
        <Card title="الخزنة الرقمية" note={`${docs.length.toLocaleString('ar-IQ')} مستند منظم حسب الحالة والسرية.`}>
          <View style={styles.documentSummary}>
            <Metric label="مراجعة" value={docsReview.length} tone="gold" />
            <Metric label="موقعة" value={signedDocs.length} tone="green" />
            <Metric label="سرية" value={confidentialDocs.length} tone="red" />
          </View>
          <Button title="إضافة مستند" onPress={uploadVault} loading={busy === 'vault'} variant="secondary" />
        </Card>
        {filteredDocs.map((doc: any) => (
          <Pressable key={doc.id} onPress={() => setSelectedDocId(doc.id)} style={[styles.docCard, selectedDoc?.id === doc.id && styles.activeCard]}>
            <View style={styles.rowBetween}>
              <Status label={doc.status} tone={doc.status === 'Needs Review' ? 'gold' : doc.status === 'Signed' ? 'green' : 'blue'} />
              <Text style={styles.cardTitle}>{doc.name}</Text>
            </View>
            <Text style={styles.mutedText}>{doc.caseTitle} · {doc.owner} · {doc.size}</Text>
            {doc.confidential ? <Text style={styles.confidential}>سري</Text> : null}
            {selectedDoc?.id === doc.id ? (
              <View style={styles.docActions}>
                <View style={styles.inlineActions}>
                  <Button title="فتح" variant="secondary" onPress={() => openDocument(doc)} />
                  <Button title="تمت المراجعة" variant="secondary" loading={busy === `doc-review-${doc.id}`} onPress={() => reviewDocument(doc, 'Reviewed')} />
                  <Button title="يحتاج تعديل" variant="secondary" loading={busy === `doc-review-${doc.id}`} onPress={() => setComposer(composer === 'doc-note' ? null : 'doc-note')} />
                </View>
                {composer === 'doc-note' ? (
                  <View style={styles.formBlock}>
                    <Field value={docReviewNote} onChangeText={setDocReviewNote} placeholder="ملاحظة المراجعة" multiline />
                    <Button title="حفظ طلب التعديل" loading={busy === `doc-review-${doc.id}`} onPress={() => reviewDocument(doc, 'Needs Review')} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ))}
        {filteredDocs.length === 0 ? <EmptyState title="لا توجد وثائق مطابقة" /> : null}
      </>
    );
  }

  function renderEarnings() {
    const transactions = summary.recentTransactions || [];
    return (
      <>
        <View style={styles.statsGrid}>
          <Metric label="متاح" value={summary.availableToWithdraw || 0} tone="green" />
          <Metric label="معلق" value={summary.pendingRevenue || 0} tone="gold" />
          <Metric label="الشهر" value={summary.monthlyEarnings || 0} tone="blue" />
        </View>
        <Card title="وسائل السحب" note="اختيار وسيلة التحويل المفضلة.">
          {(summary.payoutMethods || []).map((item: any) => <InfoRow key={item.id} icon={item.recommended ? 'checkmark-circle-outline' : 'wallet-outline'} title={item.label} note={`${item.value}${item.recommended ? ' · مفضل' : ''}`} />)}
          <Button title="طلب سحب" onPress={requestWithdrawal} />
          <View style={styles.inlineActions}>
            <Button title="قضايا مالية" variant="secondary" onPress={() => { setActiveTab('cases'); setCaseFilter('billing'); }} />
            <Button title="الحساب" variant="secondary" onPress={() => setActiveTab('account')} />
          </View>
        </Card>
        <Card title="آخر العمليات" note="الإيرادات والسحوبات.">
          {transactions.map((item: any) => <InfoRow key={item.id} icon={item.type === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'} title={item.label} note={`${item.amount} · ${item.status} · ${item.date}`} />)}
          {transactions.length === 0 ? <EmptyState title="لا توجد عمليات بعد" /> : null}
        </Card>
      </>
    );
  }

  function renderOperations() {
    return (
      <>
        <Card title="المساعد الذكي" note="تحليل سريع للقضايا والرسائل والوثائق.">
          <Field value={aiPrompt} onChangeText={setAiPrompt} placeholder="اكتب أمر المساعد" multiline />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {aiSuggestions.map((item) => <SmallChip key={item} label={item} active={aiPrompt === item} onPress={() => setAiPrompt(item)} />)}
          </ScrollView>
          <Button title="تشغيل التحليل" onPress={runAi} />
          <Text style={styles.aiResponse}>{aiResponse}</Text>
        </Card>
        <Pressable onPress={() => setComposer(composer === 'appointment' ? null : 'appointment')} style={styles.actionBanner}>
          <Ionicons name={composer === 'appointment' ? 'close-outline' : 'calendar-outline'} size={19} color={colors.blue} />
          <Text style={styles.actionBannerText}>{composer === 'appointment' ? 'إغلاق نموذج الموعد' : 'جدولة موعد جديد'}</Text>
        </Pressable>
        {composer === 'appointment' ? <Card title="جدولة موعد" note="إضافة موعد سريع من الجوال.">
          <Field value={appointmentTitle} onChangeText={setAppointmentTitle} placeholder="عنوان الموعد" />
          <Field value={appointmentTime} onChangeText={setAppointmentTime} placeholder="الوقت" />
          <Button title="إضافة موعد" onPress={createAppointment} loading={busy === 'appointment'} variant="secondary" />
        </Card> : null}
        <Card title="الفريق والمهام" note={`${tasks.length.toLocaleString('ar-IQ')} مهمة`}>
          {tasks.map((task: any) => <InfoRow key={task.id} icon="checkmark-done-outline" title={task.title} note={`${task.assignee} · ${task.due} · ${task.status}`} />)}
          {tasks.length === 0 ? <EmptyState title="لا توجد مهام فريق" /> : null}
        </Card>
        <Card title="المواعيد والمهل" note={`${deadlines.length.toLocaleString('ar-IQ')} تذكير`}>
          {deadlines.map((item: any) => (
            <View key={item.id} style={styles.deadlineRow}>
              <InfoRow icon="alarm-outline" title={item.title} note={`${item.dueDate} · ${item.urgency} · ${item.court}`} />
              <Button title="الخريطة" variant="secondary" onPress={() => openDeadlineMap(item)} />
            </View>
          ))}
        </Card>
      </>
    );
  }

  function renderAccount() {
    const usage = summary.usage || {};
    return (
      <>
        <Card title="الحساب المهني" note={summary.subscriptionTier || 'basic'}>
          <InfoRow icon="star-outline" title="التقييم" note={`${summary.rating || 0} · ${summary.reviewCount || 0} مراجعة`} />
          <InfoRow icon="people-outline" title="المتابعون" note={`${summary.followers || 0} · ${summary.newFollowersThisWeek || 0} هذا الأسبوع`} />
          <InfoRow icon="briefcase-outline" title="استخدام القضايا" note={`${usage.activeCases || cases.length} / ${usage.caseLimit || '10'}`} />
          <InfoRow icon="sparkles-outline" title="استخدام AI" note={`${usage.aiAssists || 0} / ${usage.aiLimit || '50'}`} />
          <View style={styles.inlineActions}>
            <Button title="الاشتراك" variant="secondary" onPress={() => accountAction('subscription')} />
            <Button title="وسيلة السحب" variant="secondary" onPress={() => accountAction('payout')} />
            <Button title="الملف العام" variant="secondary" onPress={() => accountAction('profile')} />
            <Button title="الفواتير" variant="secondary" onPress={() => accountAction('invoices')} />
          </View>
        </Card>
        <Card title="العملاء" note={`${clients.length.toLocaleString('ar-IQ')} عميل`}>
          {clients.map((client: any) => <InfoRow key={client.id} icon="person-outline" title={client.name} note={`${client.company} · ${client.openCases} ملفات · ${client.status}`} />)}
          {clients.length === 0 ? <EmptyState title="لا يوجد عملاء بعد" /> : null}
        </Card>
      </>
    );
  }
}

function Card({ title, note, action, children }: { title: string; note?: string; action?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {action ? <Text style={styles.cardAction}>{action}</Text> : <View />}
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function QuickAction({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.quickAction, active && styles.quickActionActive]}>
      <Ionicons name={icon} size={18} color={active ? '#fff' : colors.blue} />
      <Text style={[styles.quickActionText, active && styles.quickActionTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, tone, onPress }: { label: string; value: number | string; tone: 'red' | 'blue' | 'green' | 'gold'; onPress?: () => void }) {
  const toneStyle = tone === 'red' ? styles.metricRed : tone === 'blue' ? styles.metricBlue : tone === 'green' ? styles.metricGreen : styles.metricGold;
  return <Pressable onPress={onPress} style={[styles.metric, toneStyle]}><Text style={styles.metricValue}>{formatValue(value)}</Text><Text style={styles.metricLabel}>{label}</Text></Pressable>;
}

function SavedChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.savedChip, active && styles.savedChipActive]}><Text style={[styles.savedLabel, active && styles.savedLabelActive]}>{label}</Text><Text style={[styles.savedCount, active && styles.savedLabelActive]}>{count}</Text></Pressable>;
}

function TabChip({ tab, active, onPress }: { tab: { label: string; icon: keyof typeof Ionicons.glyphMap }; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.tabChip, active && styles.tabChipActive]}><Ionicons name={tab.icon} size={15} color={active ? '#fff' : colors.navy} /><Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text></Pressable>;
}

function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text><Text style={[styles.filterCount, active && styles.filterTextActive]}>{count}</Text></Pressable>;
}

function SmallChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.smallChip, active && styles.smallChipActive]}><Text style={[styles.smallChipText, active && styles.smallChipTextActive]} numberOfLines={1}>{label}</Text></Pressable>;
}

function Field({ value, onChangeText, placeholder, multiline }: { value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle} multiline={multiline} style={[styles.input, multiline && styles.multiline]} textAlign="right" />;
}

function CaseCard({ item, selected, timerCaseId, timerRunning, timerSeconds, onOpen, onSelect, onTimer }: any) {
  return (
    <Pressable onPress={onOpen} style={[styles.caseCard, selected && styles.activeCard]}>
      <View style={styles.rowBetween}>
        <Pressable onPress={onSelect} style={[styles.selectDot, selected && styles.selectDotActive]} />
        <Status label={item.status || 'Open'} tone={item.priority === 'High' || item.status === 'At Risk' ? 'red' : item.status === 'Closed' ? 'green' : 'blue'} />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.mutedText}>{item.client} · {item.matter}</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, item.progress || 0))}%` }]} /></View>
      <View style={styles.rowBetween}>
        <Pressable onPress={onTimer} style={styles.timerButton}><Ionicons name={timerCaseId === item.id && timerRunning ? 'pause-outline' : 'play-outline'} size={15} color={colors.blue} /><Text style={styles.timerText}>{timerCaseId === item.id ? formatTimer(timerSeconds) : 'توقيت'}</Text></Pressable>
        <Text style={styles.mutedText}>{item.nextDeadline}</Text>
      </View>
    </Pressable>
  );
}

function InfoRow({ icon, title, note }: { icon: keyof typeof Ionicons.glyphMap; title: string; note: string }) {
  return <View style={styles.infoRow}><View style={styles.infoIcon}><Ionicons name={icon} size={17} color={colors.blue} /></View><View style={styles.flex}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.infoNote}>{note}</Text></View></View>;
}

function Status({ label, tone }: { label: string; tone: 'red' | 'green' | 'blue' | 'gold' }) {
  const style = tone === 'red' ? styles.statusRed : tone === 'green' ? styles.statusGreen : tone === 'gold' ? styles.statusGold : styles.statusBlue;
  return <Text style={[styles.statusBadge, style]}>{label}</Text>;
}

function formatValue(value: number | string) {
  if (typeof value === 'number') return value.toLocaleString('ar-IQ');
  return value;
}

function formatTimer(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  activeCard: { borderColor: colors.blue, borderWidth: 1 },
  actionBanner: { alignItems: 'center', backgroundColor: colors.blueTint, borderColor: '#cfe2ff', borderRadius: 8, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, marginBottom: 10, padding: 12 },
  actionBannerText: { color: colors.blue, flex: 1, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  aiResponse: { backgroundColor: colors.blueTint, borderRadius: 8, color: colors.ink, fontSize: 12, fontWeight: '800', lineHeight: 20, marginTop: 10, padding: 10, textAlign: 'right' },
  bodyText: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 22, marginTop: 8, textAlign: 'right' },
  bulkBar: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 8, flexDirection: 'row-reverse', gap: 8, marginBottom: 10, padding: 10 },
  bulkButton: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  bulkButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  bulkDanger: { backgroundColor: colors.redTint },
  bulkDangerText: { color: colors.red },
  bulkText: { color: '#fff', flex: 1, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  card: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, elevation: 2, marginBottom: 12, padding: 13, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18 },
  cardAction: { color: colors.blue, fontSize: 12, fontWeight: '900', paddingTop: 2 },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 8, textAlign: 'right' },
  caseCard: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, elevation: 1, marginBottom: 10, padding: 12, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12 },
  chipRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  commandGrid: { flexDirection: 'row-reverse', gap: 8, marginTop: 14 },
  confidential: { alignSelf: 'flex-end', backgroundColor: colors.redTint, borderRadius: 999, color: colors.red, fontSize: 11, fontWeight: '900', marginTop: 8, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4 },
  content: { paddingBottom: 20 },
  deadlineRow: { borderBottomColor: colors.line, borderBottomWidth: 1, paddingBottom: 8 },
  docCard: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginBottom: 10, padding: 12 },
  docActions: { marginTop: 10 },
  documentSummary: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  filterChip: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: 'row-reverse', gap: 6, minHeight: 36, paddingHorizontal: 11 },
  filterChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterCount: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  filterText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#fff' },
  flex: { flex: 1 },
  formBlock: { backgroundColor: colors.surface, borderRadius: 8, marginTop: 10, padding: 10 },
  iconButton: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  infoIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  infoNote: { color: colors.muted, fontSize: 11, fontWeight: '700', lineHeight: 18, marginTop: 3, textAlign: 'right' },
  infoRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10, paddingVertical: 9 },
  infoTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  inlineActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 48, marginBottom: 9, paddingHorizontal: 12 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: '900', textAlign: 'right' },
  listNote: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 2, textAlign: 'right' },
  listTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  messageCard: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginBottom: 10, padding: 12 },
  messageMeta: { flexDirection: 'row-reverse', gap: 6, marginTop: 8 },
  metric: { alignItems: 'flex-end', borderRadius: 8, flex: 1, minHeight: 70, justifyContent: 'center', padding: 9 },
  metricBlue: { backgroundColor: colors.blueTint },
  metricGold: { backgroundColor: colors.goldTint },
  metricGreen: { backgroundColor: colors.greenTint },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  metricRed: { backgroundColor: colors.redTint },
  metricValue: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  multiline: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' },
  mutedText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 19, marginTop: 5, textAlign: 'right' },
  progressFill: { backgroundColor: colors.blue, borderRadius: 999, height: '100%' },
  progressPanel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 10 },
  progressTrack: { backgroundColor: colors.tint, borderRadius: 999, height: 7, marginVertical: 10, overflow: 'hidden' },
  quickAction: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 58, justifyContent: 'center', paddingHorizontal: 6 },
  quickActionActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  quickActionText: { color: colors.ink, fontSize: 11, fontWeight: '900', marginTop: 4 },
  quickActionTextActive: { color: '#fff' },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  savedChip: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, minWidth: 116, padding: 10 },
  savedChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  savedCount: { color: colors.muted, fontSize: 16, fontWeight: '900', marginTop: 3, textAlign: 'right' },
  savedLabel: { color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  savedLabelActive: { color: '#fff' },
  savedRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  searchBox: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, marginBottom: 10, paddingHorizontal: 12 },
  searchInput: { color: colors.ink, flex: 1, minHeight: 44, textAlign: 'right' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionNote: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 19, marginTop: 4, textAlign: 'right' },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  segmented: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  selectDot: { borderColor: colors.line, borderRadius: 999, borderWidth: 2, height: 22, width: 22 },
  selectDotActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  smallChip: { backgroundColor: colors.tint, borderRadius: 999, justifyContent: 'center', minHeight: 34, maxWidth: 210, paddingHorizontal: 11 },
  smallChipActive: { backgroundColor: colors.blue },
  smallChipText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  smallChipTextActive: { color: '#fff' },
  statsGrid: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  stepperRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  statusBadge: { borderRadius: 999, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  statusBlue: { backgroundColor: colors.blueTint, color: colors.blue },
  statusGold: { backgroundColor: colors.goldTint, color: colors.gold },
  statusGreen: { backgroundColor: colors.greenTint, color: colors.green },
  statusRed: { backgroundColor: colors.redTint, color: colors.red },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 21, marginTop: 5, textAlign: 'right' },
  tabChip: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: 'row-reverse', gap: 5, minHeight: 38, paddingHorizontal: 12 },
  tabChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  tabRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 12 },
  tabText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  timeText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  timerButton: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, flexDirection: 'row-reverse', gap: 4, paddingHorizontal: 10, paddingVertical: 7 },
  timerText: { color: colors.blue, fontSize: 11, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900', textAlign: 'right' },
});
