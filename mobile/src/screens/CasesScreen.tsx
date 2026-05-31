import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { Button, EmptyState, Pill, Screen, SkeletonCard, Toast } from '../components/ui';
import { colors } from '../theme/colors';

type WorkspaceTab = 'summary' | 'documents' | 'chat' | 'financials' | 'resolution';
type SidebarFilter = 'needs_action' | 'in_progress' | 'waiting' | 'completed' | 'all';
type DocFilter = 'all' | 'pending' | 'agency' | 'expired' | 'signed' | 'uploaded' | 'contracts';

const tabs: Array<{ id: WorkspaceTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'summary', label: 'الملخص', icon: 'grid-outline' },
  { id: 'documents', label: 'الوثائق', icon: 'document-text-outline' },
  { id: 'chat', label: 'الرسائل', icon: 'chatbubble-ellipses-outline' },
  { id: 'financials', label: 'المالية', icon: 'wallet-outline' },
  { id: 'resolution', label: 'الإغلاق', icon: 'checkmark-circle-outline' },
];

const caseFilters: Array<{ id: SidebarFilter; label: string }> = [
  { id: 'needs_action', label: 'تحتاج إجراء' },
  { id: 'in_progress', label: 'نشطة' },
  { id: 'waiting', label: 'انتظار' },
  { id: 'completed', label: 'منتهية' },
  { id: 'all', label: 'الكل' },
];

const docFilters: Array<{ id: DocFilter; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'للتوقيع' },
  { id: 'agency', label: 'الوكالة' },
  { id: 'contracts', label: 'العقود' },
  { id: 'signed', label: 'موقعة' },
  { id: 'expired', label: 'منتهية' },
  { id: 'uploaded', label: 'مرفوعة' },
];

const caseTypes = [
  { id: 'civil', label: 'مدنية' },
  { id: 'criminal', label: 'جنائية' },
  { id: 'commercial', label: 'تجارية' },
];

const quickReplies = ['هل هناك تحديث جديد؟', 'تم تجهيز المستندات', 'أحتاج توضيحاً أكثر', 'نعم، أوافق على ذلك'];
const paymentPlans: Array<{ installments: 1 | 2 | 3; title: string; note: string }> = [
  { installments: 1, title: 'دفع كامل', note: 'سداد المتبقي مرة واحدة' },
  { installments: 2, title: 'دفعتان', note: 'تقسيم المتبقي على مرتين' },
  { installments: 3, title: 'ثلاث دفعات', note: 'تقسيم المتبقي على ثلاث مرات' },
];

export function CasesScreen() {
  const [cases, setCases] = useState<any[]>([]);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('summary');
  const [showArchived, setShowArchived] = useState(false);
  const [caseFilter, setCaseFilter] = useState<SidebarFilter>('needs_action');
  const [caseSearch, setCaseSearch] = useState('');
  const [docFilter, setDocFilter] = useState<DocFilter>('all');
  const [docSearch, setDocSearch] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState('');
  const [modal, setModal] = useState<'newCase' | 'field' | 'folder' | 'document' | 'collaborator' | 'delete' | null>(null);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseType, setNewCaseType] = useState('civil');
  const [newCaseAmount, setNewCaseAmount] = useState('');
  const [newCaseLawyerId, setNewCaseLawyerId] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [folderName, setFolderName] = useState('');
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('pdf');
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorName, setCollaboratorName] = useState('');
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<1 | 2 | 3>(1);
  const [paymentStatus, setPaymentStatus] = useState('');

  const load = async (preferredId?: string) => {
    setRefreshing(true);
    try {
      const [caseResponse, lawyerResponse] = await Promise.all([
        apiClient.getWorkspaceCases(),
        apiClient.getLawyers().catch(() => ({ data: [] })),
      ]);
      const nextCases = caseResponse.data || [];
      setCases(nextCases);
      setLawyers(lawyerResponse.data || []);
      setNewCaseLawyerId((current) => current || lawyerResponse.data?.[0]?.id || nextCases[0]?.lawyerId || nextCases[0]?.lawyer?.id || '');
      setSelectedId((current) => {
        if (preferredId && nextCases.some((item: any) => item.id === preferredId)) return preferredId;
        if (current && nextCases.some((item: any) => item.id === current)) return current;
        return nextCases[0]?.id || '';
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحميل القضايا.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedId) || cases[0] || null, [cases, selectedId]);
  const visibleCases = useMemo(() => {
    const normalized = caseSearch.trim().toLowerCase();
    return cases.filter((item) => {
      const archivedOk = showArchived ? item.isArchived : !item.isArchived;
      const pendingDocs = (item.documents || []).filter((doc: any) => doc.actionRequired || doc.expiresAt).length;
      const unread = item.unreadCount || 0;
      const status = String(item.status || '').toLowerCase();
      const matchesFilter =
        caseFilter === 'all' ||
        (caseFilter === 'needs_action' && (pendingDocs > 0 || unread > 0 || item.status === 'pending')) ||
        (caseFilter === 'in_progress' && !['closed', 'completed'].includes(status)) ||
        (caseFilter === 'waiting' && (item.status === 'pending' || String(item.statusText || '').includes('انتظار'))) ||
        (caseFilter === 'completed' && ['closed', 'completed'].includes(status));
      const matchesSearch =
        !normalized ||
        String(item.title || '').toLowerCase().includes(normalized) ||
        String(item.lawyer?.name || item.lawyer || '').toLowerCase().includes(normalized);
      return archivedOk && matchesFilter && matchesSearch;
    });
  }, [caseFilter, caseSearch, cases, showArchived]);

  const workspaceStats = useMemo(() => {
    const pendingDocs = cases.reduce((sum, item) => sum + (item.documents || []).filter((doc: any) => doc.actionRequired || doc.expiresAt).length, 0);
    const unread = cases.reduce((sum, item) => sum + (item.unreadCount || 0), 0);
    const avg = cases.length ? Math.round(cases.reduce((sum, item) => sum + (item.progress || 0), 0) / cases.length) : 0;
    return [
      { label: 'ملفات', value: visibleCases.length, tone: 'blue' as const },
      { label: 'إجراءات', value: pendingDocs, tone: pendingDocs > 0 ? 'gold' as const : 'green' as const },
      { label: 'رسائل', value: unread, tone: unread > 0 ? 'blue' as const : 'neutral' as const },
      { label: 'إنجاز', value: `${avg}%`, tone: 'green' as const },
    ];
  }, [cases, visibleCases.length]);

  const attentionQueue = useMemo(() => {
    return cases
      .map((item) => {
        const pendingDocs = (item.documents || []).filter((doc: any) => doc.actionRequired || doc.expiresAt).length;
        const unread = item.unreadCount || 0;
        return { ...item, pendingDocs, unread, score: pendingDocs * 3 + unread * 2 + (item.status === 'pending' ? 1 : 0) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [cases]);

  const filteredDocuments = useMemo(() => {
    const docs = selectedCase?.documents || [];
    const normalized = docSearch.trim().toLowerCase();
    return docs.filter((doc: any) => {
      const inFolder = activeFolderId ? doc.folderId === activeFolderId : true;
      if (!inFolder) return false;
      if (normalized && !String(doc.name || '').toLowerCase().includes(normalized)) return false;
      if (docFilter === 'pending') return doc.actionRequired === 'بانتظار توقيعك' && !doc.isSigned;
      if (docFilter === 'agency') return isAgencyDocument(doc);
      if (docFilter === 'expired') return Boolean(doc.expiresAt && !doc.isSigned);
      if (docFilter === 'signed') return Boolean(doc.isSigned);
      if (docFilter === 'contracts') return Boolean(doc.tags?.includes('contract'));
      if (docFilter === 'uploaded') return Boolean(doc.uploadedAt);
      return true;
    });
  }, [activeFolderId, docFilter, docSearch, selectedCase]);

  const activeInsights = useMemo(() => {
    if (!selectedCase) return [];
    const docs = selectedCase.documents || [];
    const financials = selectedCase.financials || {};
    const signed = docs.filter((doc: any) => doc.isSigned).length;
    const pending = docs.filter((doc: any) => doc.actionRequired || doc.expiresAt).length;
    const paidPercent = financials.totalAgreed > 0 ? Math.round(((financials.paid || 0) / financials.totalAgreed) * 100) : 0;
    return [
      { label: 'إجراءات', value: pending, icon: 'notifications-outline' as const, tab: 'documents' as WorkspaceTab },
      { label: 'وثائق', value: docs.length, icon: 'folder-open-outline' as const, tab: 'documents' as WorkspaceTab },
      { label: 'موقعة', value: signed, icon: 'create-outline' as const, tab: 'documents' as WorkspaceTab },
      { label: 'السداد', value: `${paidPercent}%`, icon: 'wallet-outline' as const, tab: 'financials' as WorkspaceTab },
    ];
  }, [selectedCase]);

  useEffect(() => {
    setSelectedDocs([]);
    setActiveFolderId(null);
    setDocSearch('');
    setDocFilter('all');
  }, [selectedId]);

  const replaceCase = (nextCase: any) => {
    setCases((current) => current.map((item) => (item.id === nextCase.id ? nextCase : item)));
  };

  const createCase = async () => {
    if (!newCaseTitle.trim() || !newCaseLawyerId) {
      setStatus('اكتب عنوان الملف واختر محامياً أولاً.');
      return;
    }
    setLoading('newCase');
    setStatus('');
    try {
      const caseType = caseTypes.find((item) => item.id === newCaseType)?.label || 'مدنية';
      const response = await apiClient.createWorkspaceCase({
        title: newCaseTitle.trim(),
        matter: caseType,
        lawyerId: newCaseLawyerId,
        totalAgreedFee: Number(newCaseAmount) || 0,
        caseType,
      });
      setModal(null);
      setNewCaseTitle('');
      setNewCaseAmount('');
      await load(response.data?.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إنشاء الملف.');
    } finally {
      setLoading('');
    }
  };

  const archiveCase = async () => {
    if (!selectedCase) return;
    setLoading('archive');
    try {
      const response = await apiClient.toggleWorkspaceCaseArchive(selectedCase.id);
      if (response.data) replaceCase(response.data);
      setStatus(selectedCase.isArchived ? 'تمت إعادة الملف من الأرشيف.' : 'تم نقل الملف إلى الأرشيف.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحديث الأرشيف.');
    } finally {
      setLoading('');
    }
  };

  const deleteCase = async () => {
    if (!selectedCase) return;
    setLoading('delete');
    try {
      await apiClient.deleteWorkspaceCase(selectedCase.id);
      setModal(null);
      await load();
      setStatus('تم حذف الملف.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر حذف الملف.');
    } finally {
      setLoading('');
    }
  };

  const addField = async () => {
    if (!selectedCase || !fieldLabel.trim() || !fieldValue.trim()) return;
    setLoading('field');
    try {
      const response = await apiClient.addCaseCustomField(selectedCase.id, fieldLabel.trim(), fieldValue.trim());
      if (response.data) replaceCase(response.data);
      setFieldLabel('');
      setFieldValue('');
      setModal(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة البيانات.');
    } finally {
      setLoading('');
    }
  };

  const addFolder = async () => {
    if (!selectedCase || !folderName.trim()) return;
    setLoading('folder');
    try {
      const response = await apiClient.addCaseFolder(selectedCase.id, folderName.trim());
      if (response.data) replaceCase(response.data);
      setFolderName('');
      setModal(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إنشاء المجلد.');
    } finally {
      setLoading('');
    }
  };

  const addDocument = async () => {
    if (!selectedCase || !docName.trim()) return;
    setLoading('document');
    try {
      const response = await apiClient.addCaseDocument(selectedCase.id, {
        name: docName.trim(),
        size: 'تمت إضافته من الجوال',
        type: docType,
        folderId: activeFolderId,
        actionRequired: docType === 'agency' ? 'بانتظار توقيعك' : null,
        tags: docType === 'agency' ? ['agency', 'power_of_attorney'] : docType === 'contract' ? ['contract'] : [],
      });
      if (response.data) replaceCase(response.data);
      setDocName('');
      setDocType('pdf');
      setModal(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة الوثيقة.');
    } finally {
      setLoading('');
    }
  };

  const signDocument = async (docId: string) => {
    if (!selectedCase) return;
    setLoading(`sign-${docId}`);
    try {
      const response = await apiClient.signCaseDocument(selectedCase.id, docId);
      if (response.data) replaceCase(response.data);
      setStatus('تم توقيع الوثيقة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر توقيع الوثيقة.');
    } finally {
      setLoading('');
    }
  };

  const moveSelectedDocuments = async (folderId: string | null) => {
    if (!selectedCase || selectedDocs.length === 0) return;
    setLoading('moveDocs');
    try {
      const response = await apiClient.moveCaseDocuments(selectedCase.id, selectedDocs, folderId);
      if (response.data) replaceCase(response.data);
      setSelectedDocs([]);
      setStatus('تم نقل الوثائق.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر نقل الوثائق.');
    } finally {
      setLoading('');
    }
  };

  const addCollaborator = async () => {
    if (!selectedCase || !collaboratorEmail.trim()) return;
    setLoading('collaborator');
    try {
      const response = await apiClient.addCaseCollaborator(selectedCase.id, {
        name: collaboratorName.trim() || collaboratorEmail.trim(),
        email: collaboratorEmail.trim(),
        role: 'user',
        permissions: 'view',
      });
      if (response.data) replaceCase(response.data);
      setCollaboratorName('');
      setCollaboratorEmail('');
      setModal(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة المتعاون.');
    } finally {
      setLoading('');
    }
  };

  const sendMessage = async (text = message) => {
    if (!selectedCase || !text.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const outgoing = text.trim();
    setMessage('');
    setCases((current) => current.map((item) => item.id === selectedCase.id ? { ...item, messages: [...(item.messages || []), { id: tempId, sender: 'user', text: outgoing, time: 'الآن', deliveryState: 'sending', awaitingResponse: true }] } : item));
    try {
      const response = await apiClient.addCaseMessage(selectedCase.id, outgoing);
      if (response.data) replaceCase(response.data);
    } catch {
      setCases((current) => current.map((item) => item.id === selectedCase.id ? { ...item, messages: (item.messages || []).map((msg: any) => msg.id === tempId ? { ...msg, deliveryState: 'failed', time: 'فشل الإرسال' } : msg) } : item));
      setMessage(outgoing);
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocs((current) => current.includes(docId) ? current.filter((id) => id !== docId) : [...current, docId]);
  };

  const createAgencyDocument = () => {
    const existing = (selectedCase?.documents || []).find(isAgencyDocument);
    if (existing) {
      setDocFilter('agency');
      setActiveTab('documents');
      return;
    }
    setDocName(`وكالة المحامي - ${selectedCase?.title || 'ملف'}`);
    setDocType('agency');
    setModal('document');
  };

  const paySelectedInstallment = async () => {
    if (!selectedCase) return;
    setLoading('casePayment');
    setStatus('');
    setPaymentStatus('جارٍ إرسال الدفعة...');
    try {
      const response = await apiClient.payCaseInstallment(selectedCase.id, selectedPaymentPlan);
      if (response.data) replaceCase(response.data);
      const nextMessage = response.message || 'تم تسجيل الدفعة بنجاح.';
      setStatus(nextMessage);
      setPaymentStatus(nextMessage);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'تعذر تنفيذ الدفع.';
      setStatus(nextMessage);
      setPaymentStatus(nextMessage);
    } finally {
      setLoading('');
    }
  };

  const statusTone = selectedCase?.status === 'closed' ? 'green' : selectedCase?.status === 'pending' ? 'gold' : selectedCase?.status === 'review' ? 'blue' : 'neutral';

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(selectedId)} />} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable onPress={() => setModal('newCase')} style={styles.heroAction}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.title}>قضاياي</Text>
              <Text style={styles.subtitle}>إدارة الملفات، الوثائق، الرسائل، الأرشيف، والمتعاونين.</Text>
            </View>
          </View>
          <View style={styles.searchBox}>
            {caseSearch ? <Pressable onPress={() => setCaseSearch('')}><Ionicons name="close" size={17} color={colors.muted} /></Pressable> : null}
            <TextInput value={caseSearch} onChangeText={setCaseSearch} placeholder="ابحث باسم القضية أو المحامي" placeholderTextColor={colors.subtle} style={styles.searchInput} />
            <Ionicons name="search-outline" size={18} color={colors.navy} />
          </View>
        </View>

        <View style={styles.statsRail}>
          {workspaceStats.map((item) => <Stat key={item.label} label={item.label} value={item.value} tone={item.tone} />)}
        </View>

        {attentionQueue.length > 0 ? (
          <View style={styles.attentionBox}>
            <Text style={styles.sectionTitle}>أولوية اليوم</Text>
            {attentionQueue.map((item) => (
              <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setActiveTab(item.pendingDocs > 0 ? 'documents' : 'chat'); if (item.pendingDocs > 0) setDocFilter('pending'); }} style={styles.attentionItem}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.mutedText}>{item.statusText || item.status}</Text>
                </View>
                {item.pendingDocs > 0 ? <Pill label={`${item.pendingDocs} وثائق`} tone="gold" /> : null}
                {item.unread > 0 ? <Pill label={`${item.unread} رسائل`} tone="blue" /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <Pressable onPress={() => setShowArchived((current) => !current)} style={[styles.toolbarButton, showArchived && styles.toolbarButtonActive]}>
            <Ionicons name={showArchived ? 'folder-open-outline' : 'archive-outline'} size={16} color={showArchived ? '#fff' : colors.navy} />
            <Text style={[styles.toolbarText, showArchived && styles.toolbarTextActive]}>{showArchived ? 'الأرشيف' : 'النشطة'}</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {caseFilters.map((item) => <Chip key={item.id} label={item.label} active={caseFilter === item.id} onPress={() => setCaseFilter(item.id)} />)}
          </ScrollView>
        </View>

        {visibleCases.length === 0 && !refreshing ? <EmptyState title="لا توجد قضايا مطابقة" note="جرّب تغيير البحث أو الفلتر، أو افتح ملفاً جديداً." /> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.caseRail}>
          {visibleCases.map((item) => (
            <CasePill key={item.id} item={item} active={selectedCase?.id === item.id} onPress={() => setSelectedId(item.id)} />
          ))}
        </ScrollView>

        <Toast message={status} tone={status.includes('تعذر') ? 'error' : 'success'} />
        {refreshing && cases.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard lines={2} />
            <SkeletonCard media />
          </>
        ) : null}

        {selectedCase ? (
          <>
            <View style={styles.currentCard}>
              <View style={styles.rowBetween}>
                <View style={styles.actionCluster}>
                  <Pressable onPress={archiveCase} style={styles.iconButton}>
                    <Ionicons name={selectedCase.isArchived ? 'folder-open-outline' : 'archive-outline'} size={18} color={colors.navy} />
                  </Pressable>
                  <Pressable onPress={() => setModal('delete')} style={[styles.iconButton, styles.dangerSoft]}>
                    <Ionicons name="trash-outline" size={18} color={colors.red} />
                  </Pressable>
                </View>
                <Pill label={selectedCase.statusText || selectedCase.status} tone={statusTone as any} />
              </View>
              <Text style={styles.caseTitle}>{selectedCase.title}</Text>
              <Text style={styles.mutedText}>المحامي: {selectedCase.lawyer?.name || selectedCase.lawyer || 'غير محدد'} · {selectedCase.progress || 0}% مكتمل</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, selectedCase.progress || 0))}%` }]} /></View>
              <View style={styles.insightGrid}>
                {activeInsights.map((item) => (
                  <Pressable key={item.label} onPress={() => setActiveTab(item.tab)} style={styles.insightCard}>
                    <Ionicons name={item.icon} size={17} color={colors.blue} />
                    <Text style={styles.insightValue}>{formatValue(item.value)}</Text>
                    <Text style={styles.insightLabel}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
              {tabs.map((tab) => (
                <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, activeTab === tab.id && styles.tabActive]}>
                  <Ionicons name={tab.icon} size={16} color={activeTab === tab.id ? '#fff' : colors.navy} />
                  <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {activeTab === 'summary' ? renderSummary() : activeTab === 'documents' ? renderDocuments() : activeTab === 'chat' ? renderChat() : activeTab === 'financials' ? renderFinancials() : renderResolution()}
          </>
        ) : null}
      </ScrollView>

      {renderModals()}
    </Screen>
  );

  function renderSummary() {
    return (
      <>
        <Section title="معلومات الملف" action="إضافة" onAction={() => setModal('field')}>
          {(selectedCase.customFields || []).length === 0 ? <EmptyState title="لا توجد بيانات إضافية" note="أضف المحكمة، رقم الدعوى، أو أي معلومة مهمة." /> : null}
          {(selectedCase.customFields || []).map((field: any) => <InfoRow key={field.id} label={field.label} value={field.value} />)}
        </Section>

        <Section title="المتعاونون" action="دعوة" onAction={() => setModal('collaborator')}>
          {(selectedCase.collaborators || []).length === 0 ? <Text style={styles.mutedText}>لا يوجد متعاونون مضافون لهذا الملف.</Text> : null}
          {(selectedCase.collaborators || []).map((item: any) => (
            <View key={item.id} style={styles.collaboratorRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{String(item.name || item.email || 'م').charAt(0)}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{item.name || item.email}</Text>
                <Text style={styles.mutedText}>{item.permissions === 'edit' ? 'تعديل' : 'عرض'} · {item.lastSeen || 'نشط'}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="خط الزمن">
          {(selectedCase.timeline || []).length === 0 ? <EmptyState title="لا يوجد خط زمني بعد" note="ستظهر الجلسات والتحديثات هنا." /> : null}
          {(selectedCase.timeline || []).slice(0, 8).map((item: any) => <TimelineItem key={item.id} item={item} />)}
        </Section>

        <Section title="سجل الوصول">
          {(selectedCase.accessLogs || []).slice(0, 4).map((item: any) => <InfoRow key={item.id} label={item.action} value={`${item.userName} · ${item.time}`} />)}
          {(selectedCase.accessLogs || []).length === 0 ? <Text style={styles.mutedText}>لا توجد سجلات وصول متاحة.</Text> : null}
        </Section>
      </>
    );
  }

  function renderDocuments() {
    return (
      <>
        <View style={styles.documentToolbar}>
          <Pressable onPress={() => setModal('document')} style={styles.primaryTiny}><Ionicons name="add-outline" size={16} color="#fff" /><Text style={styles.primaryTinyText}>وثيقة</Text></Pressable>
          <Pressable onPress={() => setModal('folder')} style={styles.secondaryTiny}><Ionicons name="folder-outline" size={16} color={colors.navy} /><Text style={styles.secondaryTinyText}>مجلد</Text></Pressable>
          <Pressable onPress={createAgencyDocument} style={styles.secondaryTiny}><Ionicons name="shield-checkmark-outline" size={16} color={colors.navy} /><Text style={styles.secondaryTinyText}>وكالة</Text></Pressable>
        </View>

        <View style={styles.searchBox}>
          <TextInput value={docSearch} onChangeText={setDocSearch} placeholder="ابحث في الوثائق" placeholderTextColor={colors.subtle} style={styles.searchInput} />
          <Ionicons name="search-outline" size={18} color={colors.navy} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {docFilters.map((item) => <Chip key={item.id} label={`${item.label} ${documentCount(item.id)}`} active={docFilter === item.id} onPress={() => setDocFilter(item.id)} />)}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="كل المجلدات" active={!activeFolderId} onPress={() => setActiveFolderId(null)} />
          {(selectedCase.folders || []).map((folder: any) => <Chip key={folder.id} label={folder.name} active={activeFolderId === folder.id} onPress={() => setActiveFolderId(folder.id)} />)}
        </ScrollView>

        {selectedDocs.length > 0 ? (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkText}>تم اختيار {selectedDocs.length.toLocaleString('ar-IQ')} وثيقة</Text>
            <Pressable onPress={() => moveSelectedDocuments(null)} style={styles.secondaryTiny}><Text style={styles.secondaryTinyText}>للرئيسية</Text></Pressable>
            {(selectedCase.folders || []).slice(0, 2).map((folder: any) => (
              <Pressable key={folder.id} onPress={() => moveSelectedDocuments(folder.id)} style={styles.secondaryTiny}><Text style={styles.secondaryTinyText}>{folder.name}</Text></Pressable>
            ))}
          </View>
        ) : null}

        {filteredDocuments.length === 0 ? <EmptyState title="لا توجد وثائق مطابقة" note="غيّر الفلتر أو أضف وثيقة جديدة." /> : null}
        {filteredDocuments.map((doc: any) => (
          <DocumentCard key={doc.id} doc={doc} selected={selectedDocs.includes(doc.id)} loading={loading === `sign-${doc.id}`} onSelect={() => toggleDocSelection(doc.id)} onSign={() => signDocument(doc.id)} onReply={() => sendMessage(`[رد على وثيقة: ${doc.name}]\n\nأحتاج توضيحاً حول هذه الوثيقة.`)} />
        ))}
      </>
    );
  }

  function renderChat() {
    return (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {quickReplies.map((reply) => <Chip key={reply} label={reply} active={false} onPress={() => setMessage(reply)} />)}
        </ScrollView>
        {(selectedCase.messages || []).length === 0 ? <EmptyState title="لا توجد رسائل بعد" note="ابدأ المحادثة مع المحامي من هنا." /> : null}
        {(selectedCase.messages || []).slice(-12).map((item: any) => <MessageItem key={item.id} item={item} />)}
        <View style={styles.composer}>
          <Pressable disabled={!message.trim()} onPress={() => sendMessage()} style={[styles.sendButton, !message.trim() && styles.disabled]}>
            <Ionicons name="send" size={17} color="#fff" />
          </Pressable>
          <TextInput multiline value={message} onChangeText={setMessage} placeholder="رسالة داخل القضية" placeholderTextColor={colors.subtle} style={styles.messageInput} />
        </View>
      </>
    );
  }

  function renderFinancials() {
    const financials = selectedCase.financials || {};
    const total = financials.totalAgreed || 0;
    const paid = financials.paid || 0;
    const due = Math.max(0, total - paid);
    const currentPlan = paymentPlans.find((plan) => plan.installments === selectedPaymentPlan) || paymentPlans[0];
    const currentInstallmentAmount = due <= 0 ? 0 : selectedPaymentPlan === 1 ? due : Math.ceil(due / selectedPaymentPlan);
    return (
      <Section title="المالية">
        <View style={styles.insightGrid}>
          <Stat label="المتفق" value={total} tone="blue" />
          <Stat label="المدفوع" value={paid} tone="green" />
          <Stat label="المتبقي" value={due} tone={due > 0 ? 'gold' : 'green'} />
        </View>
        {due > 0 ? (
          <View style={styles.paymentPlanner}>
            <View style={styles.rowBetween}>
              <Ionicons name="wallet-outline" size={22} color={colors.gold} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>طرق دفع القضية</Text>
                <Text style={styles.mutedText}>اختر السداد الكامل أو قسّم المتبقي على دفعتين أو ثلاث دفعات من المحفظة.</Text>
              </View>
            </View>
            <View style={styles.paymentPlanGrid}>
              {paymentPlans.map((plan) => {
                const amount = plan.installments === 1 ? due : Math.ceil(due / plan.installments);
                const active = selectedPaymentPlan === plan.installments;
                return (
                  <Pressable key={plan.installments} onPress={() => { setSelectedPaymentPlan(plan.installments); setPaymentStatus(''); }} style={[styles.paymentPlanCard, active && styles.paymentPlanCardActive]}>
                    <Text style={[styles.paymentPlanTitle, active && styles.paymentPlanTextActive]}>{plan.title}</Text>
                    <Text style={[styles.paymentPlanAmount, active && styles.paymentPlanTextActive]}>{formatValue(amount)} د.ع</Text>
                    <Text style={[styles.paymentPlanNote, active && styles.paymentPlanTextActive]}>{plan.note}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.paymentSummary}>
              <Text style={styles.infoValue}>{formatValue(currentInstallmentAmount)} د.ع</Text>
              <Text style={styles.infoLabel}>{currentPlan.installments === 1 ? 'سيتم سداد المتبقي بالكامل' : `دفعة حالية ضمن خطة ${currentPlan.title}`}</Text>
            </View>
            {paymentStatus ? <Text style={[styles.paymentStatus, paymentStatus.includes('تعذر') || paymentStatus.includes('غير') || paymentStatus.includes('فشل') ? styles.paymentStatusError : styles.paymentStatusSuccess]}>{paymentStatus}</Text> : null}
            <Button title={loading === 'casePayment' ? 'جارٍ الدفع...' : 'ادفع من المحفظة'} onPress={paySelectedInstallment} loading={loading === 'casePayment'} disabled={currentInstallmentAmount <= 0} />
          </View>
        ) : (
          <View style={styles.paymentComplete}>
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.green} />
            <Text style={styles.cardTitle}>تم سداد القضية بالكامل</Text>
          </View>
        )}
        {(financials.invoices || []).length === 0 ? <EmptyState title="لا توجد فواتير" note="ستظهر الدفعات والفواتير هنا." /> : null}
        {(financials.invoices || []).map((invoice: any) => <InfoRow key={invoice.id} label={`${invoice.amount} IQD`} value={`${invoice.date} · ${invoice.status}`} />)}
      </Section>
    );
  }

  function renderResolution() {
    const closed = selectedCase.status === 'closed';
    return (
      <Section title="الإغلاق والنتيجة">
        <View style={styles.resolutionBox}>
          <Ionicons name={closed ? 'checkmark-circle-outline' : 'flag-outline'} size={30} color={closed ? colors.green : colors.gold} />
          <Text style={styles.caseTitle}>{closed ? 'تم إغلاق القضية' : 'القضية ما زالت قيد العمل'}</Text>
          <Text style={styles.mutedText}>راجع الوثائق، الرسائل، والمالية قبل اعتماد الإغلاق النهائي.</Text>
        </View>
        <InfoRow label="المحامي" value={selectedCase.lawyer?.name || selectedCase.lawyer || 'غير محدد'} />
        <InfoRow label="الوثائق" value={`${(selectedCase.documents || []).length.toLocaleString('ar-IQ')} وثيقة`} />
        <InfoRow label="الحالة" value={selectedCase.statusText || selectedCase.status} />
      </Section>
    );
  }

  function renderModals() {
    return (
      <Modal transparent animationType="slide" visible={Boolean(modal)} onRequestClose={() => setModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.rowBetween}>
                <Pressable onPress={() => setModal(null)} style={styles.iconButton}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
                <Text style={styles.modalTitle}>{modalTitle(modal)}</Text>
              </View>

              {modal === 'newCase' ? (
                <>
                  <Input label="عنوان الملف" value={newCaseTitle} onChangeText={setNewCaseTitle} placeholder="مثال: مطالبة مالية" />
                  <Input label="المبلغ المتفق عليه" value={newCaseAmount} onChangeText={setNewCaseAmount} placeholder="اختياري" keyboardType="numeric" />
                  <Text style={styles.inputLabel}>نوع القضية</Text>
                  <View style={styles.gridTwo}>{caseTypes.map((item) => <Chip key={item.id} label={item.label} active={newCaseType === item.id} onPress={() => setNewCaseType(item.id)} />)}</View>
                  <Text style={styles.inputLabel}>المحامي</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {lawyers.map((lawyer) => <Chip key={lawyer.id} label={lawyer.name} active={newCaseLawyerId === lawyer.id} onPress={() => setNewCaseLawyerId(lawyer.id)} />)}
                  </ScrollView>
                  <Button title="إنشاء الملف" onPress={createCase} loading={loading === 'newCase'} />
                </>
              ) : null}

              {modal === 'field' ? (
                <>
                  <Input label="اسم البيان" value={fieldLabel} onChangeText={setFieldLabel} placeholder="مثال: رقم الدعوى" />
                  <Input label="القيمة" value={fieldValue} onChangeText={setFieldValue} placeholder="مثال: 2026/15" />
                  <Button title="إضافة البيان" onPress={addField} loading={loading === 'field'} />
                </>
              ) : null}

              {modal === 'folder' ? (
                <>
                  <Input label="اسم المجلد" value={folderName} onChangeText={setFolderName} placeholder="مثال: عقود" />
                  <Button title="إنشاء المجلد" onPress={addFolder} loading={loading === 'folder'} />
                </>
              ) : null}

              {modal === 'document' ? (
                <>
                  <Input label="اسم الوثيقة" value={docName} onChangeText={setDocName} placeholder="مثال: وكالة المحامي" />
                  <Text style={styles.inputLabel}>نوع الوثيقة</Text>
                  <View style={styles.gridTwo}>
                    <Chip label="PDF" active={docType === 'pdf'} onPress={() => setDocType('pdf')} />
                    <Chip label="صورة" active={docType === 'image'} onPress={() => setDocType('image')} />
                    <Chip label="عقد" active={docType === 'contract'} onPress={() => setDocType('contract')} />
                    <Chip label="وكالة" active={docType === 'agency'} onPress={() => setDocType('agency')} />
                  </View>
                  <Button title="إضافة الوثيقة" onPress={addDocument} loading={loading === 'document'} />
                </>
              ) : null}

              {modal === 'collaborator' ? (
                <>
                  <Input label="اسم المتعاون" value={collaboratorName} onChangeText={setCollaboratorName} placeholder="اختياري" />
                  <Input label="البريد الإلكتروني" value={collaboratorEmail} onChangeText={setCollaboratorEmail} placeholder="name@example.com" keyboardType="email-address" />
                  <Button title="دعوة متعاون" onPress={addCollaborator} loading={loading === 'collaborator'} />
                </>
              ) : null}

              {modal === 'delete' ? (
                <>
                  <Text style={styles.mutedText}>سيتم حذف الملف الحالي من مساحة العمل. هذا الإجراء حساس، تأكد قبل المتابعة.</Text>
                  <View style={styles.actionRow}>
                    <Button title="إلغاء" onPress={() => setModal(null)} variant="secondary" />
                    <Button title="حذف الملف" onPress={deleteCase} loading={loading === 'delete'} />
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  function documentCount(filter: DocFilter) {
    const docs = selectedCase?.documents || [];
    if (filter === 'pending') return docs.filter((doc: any) => doc.actionRequired === 'بانتظار توقيعك' && !doc.isSigned).length;
    if (filter === 'agency') return docs.filter(isAgencyDocument).length;
    if (filter === 'expired') return docs.filter((doc: any) => doc.expiresAt && !doc.isSigned).length;
    if (filter === 'signed') return docs.filter((doc: any) => doc.isSigned).length;
    if (filter === 'contracts') return docs.filter((doc: any) => doc.tags?.includes('contract')).length;
    if (filter === 'uploaded') return docs.filter((doc: any) => doc.uploadedAt).length;
    return docs.length;
  }
}

function CasePill({ item, active, onPress }: { item: any; active: boolean; onPress: () => void }) {
  const pendingDocs = (item.documents || []).filter((doc: any) => doc.actionRequired || doc.expiresAt).length;
  return (
    <Pressable onPress={onPress} style={[styles.casePill, active && styles.casePillActive]}>
      <Text style={[styles.casePillTitle, active && styles.casePillTextActive]} numberOfLines={1}>{item.title}</Text>
      <Text style={[styles.casePillMeta, active && styles.casePillTextActive]}>{item.statusText || item.status}</Text>
      <View style={styles.casePillBadges}>
        {pendingDocs > 0 ? <Text style={[styles.caseBadge, active && styles.caseBadgeActive]}>{pendingDocs} وثائق</Text> : null}
        {item.unreadCount > 0 ? <Text style={[styles.caseBadge, active && styles.caseBadgeActive]}>{item.unreadCount} رسائل</Text> : null}
      </View>
    </Pressable>
  );
}

function DocumentCard({ doc, selected, loading, onSelect, onSign, onReply }: { doc: any; selected: boolean; loading: boolean; onSelect: () => void; onSign: () => void; onReply: () => void }) {
  const needsSign = doc.actionRequired === 'بانتظار توقيعك' && !doc.isSigned;
  return (
    <Pressable onPress={onSelect} style={[styles.docCard, selected && styles.docCardSelected]}>
      <View style={styles.rowBetween}>
        <View style={styles.actionCluster}>
          {needsSign ? <Pressable onPress={onSign} style={styles.primaryTiny}>{loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="create-outline" size={15} color="#fff" /><Text style={styles.primaryTinyText}>توقيع</Text></>}</Pressable> : null}
          <Pressable onPress={onReply} style={styles.secondaryTiny}><Ionicons name="chatbubble-outline" size={15} color={colors.navy} /><Text style={styles.secondaryTinyText}>رد</Text></Pressable>
        </View>
        <Pill label={doc.isSigned ? 'موقعة' : doc.actionRequired || doc.type || 'مرفوعة'} tone={doc.isSigned ? 'green' : needsSign ? 'gold' : 'neutral'} />
      </View>
      <Text style={styles.cardTitle}>{doc.name}</Text>
      <Text style={styles.mutedText}>{doc.size || doc.type} · {doc.date || doc.uploadedAt || 'الآن'}</Text>
      {doc.expiresText || doc.expiresAt ? <Text style={styles.warningText}>تنتهي: {doc.expiresText || doc.expiresAt}</Text> : null}
    </Pressable>
  );
}

function MessageItem({ item }: { item: any }) {
  const mine = item.sender === 'user';
  return (
    <View style={[styles.messageRow, mine ? styles.messageMineRow : styles.messageOtherRow]}>
      <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
        <Text style={[styles.messageText, mine && styles.messageTextMine]}>{item.text}</Text>
        <Text style={[styles.messageMeta, mine && styles.messageTextMine]}>{item.deliveryState === 'sending' ? 'جارٍ الإرسال...' : item.time || item.createdAt || ''}</Text>
      </View>
    </View>
  );
}

function TimelineItem({ item }: { item: any }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot}><Ionicons name="time-outline" size={15} color={colors.navy} /></View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.mutedText}>{item.date} · {item.detail}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoValue}>{value || '-'}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children, action, onAction }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        {action ? <Pressable onPress={onAction} style={styles.sectionAction}><Text style={styles.sectionActionText}>{action}</Text></Pressable> : <View />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: 'blue' | 'gold' | 'green' | 'neutral' }) {
  return (
    <View style={[styles.stat, tone === 'gold' && styles.statGold, tone === 'green' && styles.statGreen, tone === 'neutral' && styles.statNeutral]}>
      <Text style={styles.statValue}>{formatValue(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Input({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'numeric' | 'email-address' }) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle} keyboardType={keyboardType || 'default'} style={styles.input} />
    </View>
  );
}

function isAgencyDocument(doc: any) {
  return Boolean(doc?.tags?.includes('agency') || String(doc?.name || '').includes('وكالة'));
}

function formatValue(value: string | number) {
  return typeof value === 'number' ? value.toLocaleString('ar-IQ') : value;
}

function modalTitle(modal: string | null) {
  if (modal === 'newCase') return 'فتح ملف جديد';
  if (modal === 'field') return 'إضافة بيانات';
  if (modal === 'folder') return 'مجلد جديد';
  if (modal === 'document') return 'إضافة وثيقة';
  if (modal === 'collaborator') return 'دعوة متعاون';
  if (modal === 'delete') return 'حذف الملف';
  return '';
}

const styles = StyleSheet.create({
  actionCluster: {
    flexDirection: 'row',
    gap: 7,
  },
  actionRow: {
    gap: 10,
    marginTop: 12,
  },
  attentionBox: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 12,
    padding: 12,
  },
  attentionItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    padding: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  bulkBar: {
    alignItems: 'center',
    backgroundColor: colors.goldTint,
    borderRadius: 16,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    padding: 10,
  },
  bulkText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  caseBadge: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  caseBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#fff',
  },
  casePill: {
    backgroundColor: '#fff',
    borderRadius: 18,
    minHeight: 104,
    padding: 12,
    width: 190,
  },
  casePillActive: {
    backgroundColor: colors.navy,
  },
  casePillBadges: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  casePillMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'right',
  },
  casePillTextActive: {
    color: '#fff',
  },
  casePillTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  caseRail: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingBottom: 12,
  },
  caseTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 28,
    marginTop: 10,
    textAlign: 'right',
  },
  chip: {
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 11,
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 10,
  },
  chipText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  chipTextActive: {
    color: '#fff',
  },
  collaboratorRow: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
    padding: 10,
  },
  composer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    padding: 8,
  },
  currentCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginBottom: 12,
    padding: 14,
  },
  dangerSoft: {
    backgroundColor: colors.redTint,
  },
  disabled: {
    opacity: 0.45,
  },
  docCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 10,
    padding: 12,
  },
  docCardSelected: {
    backgroundColor: colors.blueTint,
  },
  documentToolbar: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 10,
  },
  flex: {
    flex: 1,
  },
  gridTwo: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginBottom: 12,
    padding: 14,
  },
  heroAction: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },
  infoRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 8,
    padding: 12,
  },
  infoValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    color: colors.ink,
    minHeight: 46,
    paddingHorizontal: 12,
    textAlign: 'right',
  },
  inputLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 7,
    marginTop: 12,
    textAlign: 'right',
  },
  insightCard: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 16,
    flex: 1,
    padding: 10,
  },
  insightGrid: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  insightLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },
  insightValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'right',
  },
  messageBubble: {
    borderRadius: 18,
    maxWidth: '82%',
    padding: 11,
  },
  messageInput: {
    backgroundColor: colors.tint,
    borderRadius: 18,
    color: colors.ink,
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    textAlign: 'right',
  },
  messageMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'right',
  },
  messageMine: {
    backgroundColor: colors.blue,
  },
  messageMineRow: {
    alignItems: 'flex-start',
  },
  messageOther: {
    backgroundColor: '#fff',
  },
  messageOtherRow: {
    alignItems: 'flex-end',
  },
  messageRow: {
    marginVertical: 4,
  },
  messageText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'right',
  },
  messageTextMine: {
    color: '#fff',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,24,40,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalPanel: {
    backgroundColor: '#fff',
    borderRadius: 22,
    maxHeight: '88%',
    padding: 16,
    width: '94%',
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  mutedText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'right',
  },
  paymentComplete: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 8,
    marginTop: 12,
    padding: 14,
  },
  paymentPlanAmount: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 7,
    textAlign: 'right',
  },
  paymentPlanCard: {
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 112,
    padding: 10,
  },
  paymentPlanCardActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  paymentPlanGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  paymentPlanNote: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 5,
    textAlign: 'right',
  },
  paymentPlanTextActive: {
    color: '#fff',
  },
  paymentPlanTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  paymentPlanner: {
    backgroundColor: colors.goldTint,
    borderRadius: 18,
    marginTop: 12,
    padding: 12,
  },
  paymentSummary: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 10,
    padding: 12,
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 19,
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentStatusError: {
    color: colors.red,
  },
  paymentStatusSuccess: {
    color: colors.navy,
  },
  primaryTiny: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  primaryTinyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  progressFill: {
    backgroundColor: colors.gold,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 8,
    marginTop: 12,
    overflow: 'hidden',
  },
  resolutionBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    minHeight: 44,
    textAlign: 'right',
  },
  secondaryTiny: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  secondaryTinyText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: 12,
    padding: 12,
  },
  sectionAction: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sectionActionText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stat: {
    backgroundColor: colors.blueTint,
    borderRadius: 16,
    flex: 1,
    padding: 10,
  },
  statGold: {
    backgroundColor: colors.goldTint,
  },
  statGreen: {
    backgroundColor: colors.greenTint,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },
  statNeutral: {
    backgroundColor: colors.tint,
  },
  statsRail: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
  },
  statValue: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  status: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'right',
  },
  tab: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  tabActive: {
    backgroundColor: colors.navy,
  },
  tabRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 12,
  },
  tabText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  tabTextActive: {
    color: '#fff',
  },
  timelineDot: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  timelineItem: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
    padding: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'right',
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 5,
    marginBottom: 10,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  toolbarButtonActive: {
    backgroundColor: colors.navy,
  },
  toolbarText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  toolbarTextActive: {
    color: '#fff',
  },
  warningText: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
});
