import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, EmptyState, Screen, SkeletonCard, Toast } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { colors } from '../theme/colors';

type AdminTab = 'overview' | 'users' | 'cases' | 'resources' | 'roles' | 'financials' | 'contracts' | 'kyc' | 'support' | 'settings' | 'compliance' | 'system';
type Composer = 'service' | 'doc' | 'category' | 'page' | 'role' | 'rule' | 'timeline' | 'broadcast' | null;

const tabs: Array<{ id: AdminTab; label: string; note: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'overview', label: 'المركز', note: 'أولويات اليوم', icon: 'grid-outline' },
  { id: 'users', label: 'الحسابات', note: 'أدوار وحظر', icon: 'people-outline' },
  { id: 'cases', label: 'القضايا', note: 'مسار ومخاطر', icon: 'briefcase-outline' },
  { id: 'resources', label: 'المحتوى', note: 'صفحات وخدمات', icon: 'layers-outline' },
  { id: 'roles', label: 'الصلاحيات', note: 'أدوار وحقوق', icon: 'shield-checkmark-outline' },
  { id: 'financials', label: 'الأموال', note: 'دفعات وبوابات', icon: 'card-outline' },
  { id: 'contracts', label: 'العقود', note: 'توقيع وتحقق', icon: 'document-text-outline' },
  { id: 'kyc', label: 'الاعتماد', note: 'محامون جدد', icon: 'id-card-outline' },
  { id: 'support', label: 'الدعم', note: 'تذاكر وتصعيد', icon: 'headset-outline' },
  { id: 'settings', label: 'الضبط', note: 'AI وسياسات', icon: 'options-outline' },
  { id: 'compliance', label: 'الحوكمة', note: 'قواعد ومراجع', icon: 'lock-closed-outline' },
  { id: 'system', label: 'الصحة', note: 'خوادم وسجلات', icon: 'server-outline' },
];

const asArray = (value: any) => Array.isArray(value?.data) ? value.data : Array.isArray(value) ? value : [];
const unwrap = (value: any) => value?.data ?? value ?? {};
const nextRole = (role: string) => role === 'user' ? 'pro' : role === 'pro' ? 'admin' : 'user';

export function AdminScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [composer, setComposer] = useState<Composer>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState('');

  const [metrics, setMetrics] = useState<any>({});
  const [intelligence, setIntelligence] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [kyc, setKyc] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [aiSettings, setAiSettings] = useState<any>({});
  const [gateways, setGateways] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<any>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);

  const [serviceTitle, setServiceTitle] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docSummary, setDocSummary] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [ruleValue, setRuleValue] = useState('');
  const [timelineTitle, setTimelineTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const load = async (initial = false) => {
    if (initial) setLoading(true);
    setRefreshing(true);
    try {
      const responses = await Promise.all([
        apiClient.getAdminMetrics().catch(() => ({})),
        apiClient.getAdminIntelligence().catch(() => ({})),
        apiClient.getAdminKyc().catch(() => []),
        apiClient.getAdminUsers().catch(() => []),
        apiClient.getAdminFeatureFlags().catch(() => []),
        apiClient.getAdminSupportTickets().catch(() => []),
        apiClient.getAdminAlerts().catch(() => []),
        apiClient.getAdminAuditLogs().catch(() => []),
        apiClient.getAdminTransactions().catch(() => []),
        apiClient.getAdminPolicies().catch(() => []),
        apiClient.getAdminSystemSettings().catch(() => ({})),
        apiClient.getAdminAiSettings().catch(() => ({})),
        apiClient.getAdminPaymentGateways().catch(() => []),
        apiClient.getAdminWorkflowSettings().catch(() => ({})),
        apiClient.getAdminNotificationTemplates().catch(() => []),
        apiClient.getAdminModerationRules().catch(() => []),
        apiClient.getAdminLegalDocs().catch(() => []),
        apiClient.getAdminLegalServices().catch(() => []),
        apiClient.getAdminContracts().catch(() => ({})),
        apiClient.getAdminCategories().catch(() => []),
        apiClient.getAdminUploads().catch(() => []),
        apiClient.getAdminPages().catch(() => []),
        apiClient.getAdminRoles().catch(() => []),
        apiClient.getAdminPermissions().catch(() => []),
        apiClient.getAdminCases().catch(() => []),
      ]);
      setMetrics(unwrap(responses[0]));
      setIntelligence(unwrap(responses[1]));
      setKyc(asArray(responses[2]));
      setUsers(asArray(responses[3]));
      setFlags(asArray(responses[4]));
      setTickets(asArray(responses[5]));
      setAlerts(asArray(responses[6]));
      setAuditLogs(asArray(responses[7]));
      setTransactions(asArray(responses[8]));
      setPolicies(asArray(responses[9]));
      setSystemSettings(unwrap(responses[10]));
      setAiSettings(unwrap(responses[11]));
      setGateways(asArray(responses[12]));
      setWorkflow(unwrap(responses[13]));
      setTemplates(asArray(responses[14]));
      setRules(asArray(responses[15]));
      setDocs(asArray(responses[16]));
      setServices(asArray(responses[17]));
      setContracts(asArray(unwrap(responses[18])));
      setCategories(asArray(responses[19]));
      setUploads(asArray(responses[20]));
      setPages(asArray(responses[21]));
      setRoles(asArray(responses[22]));
      setPermissions(asArray(responses[23]));
      setCases(asArray(responses[24]));
      setLastUpdated(new Date());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحميل لوحة الإدارة.');
    } finally {
      setRefreshing(false);
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, []);

  const pendingKyc = kyc.filter((item) => item.status === 'pending' || item.status === 'review');
  const escalatedTickets = tickets.filter((item) => item.status === 'escalated');
  const openTickets = tickets.filter((item) => item.status === 'open');
  const blockedUsers = users.filter((item) => item.blocked);
  const highAlerts = alerts.filter((item) => item.severity === 'high');
  const activeRules = rules.filter((item) => item.active);
  const activeFlags = flags.filter((item) => item.enabled);
  const unsignedContracts = contracts.filter((item) => item.status !== 'signed' && item.status !== 'verified');
  const activeCases = cases.filter((item) => item.status !== 'closed');
  const selectedUser = users.find((item) => item.id === selectedUserId) || users[0];

  const filteredUsers = useMemo(() => users.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [item.name, item.email, item.role, item.location, item.specialty].some((value) => String(value || '').toLowerCase().includes(q));
    const matchesFilter = filter === 'all' || item.role === filter || (filter === 'blocked' && item.blocked);
    return matchesSearch && matchesFilter;
  }), [filter, search, users]);

  const filteredKyc = useMemo(() => kyc.filter((item) => filter === 'all' || item.status === filter), [filter, kyc]);
  const filteredTickets = useMemo(() => tickets.filter((item) => filter === 'all' || item.status === filter), [filter, tickets]);
  const filteredAudit = useMemo(() => auditLogs.filter((item) => filter === 'all' || item.type === filter), [auditLogs, filter]);

  const openTab = (tab: AdminTab, nextFilter = 'all') => {
    setActiveTab(tab);
    setFilter(nextFilter);
    setComposer(null);
  };

  const run = async (key: string, action: () => Promise<any>, success: string) => {
    setBusy(key);
    try {
      await action();
      setStatus(success);
      await load(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تنفيذ العملية.');
    } finally {
      setBusy('');
    }
  };

  const addService = () => {
    if (!serviceTitle.trim()) return setStatus('أدخل اسم الخدمة.');
    const lawyerId = users.find((item) => item.role === 'pro' || item.role === 'admin')?.id;
    if (!lawyerId) return setStatus('لا يوجد محام متاح لإسناد الخدمة.');
    return run('service', () => apiClient.addAdminLegalService({
      title: serviceTitle.trim(),
      description: 'خدمة مضافة من تطبيق الجوال.',
      price: servicePrice || 'غير محدد',
      time: 'حسب الطلب',
      category: categories[0]?.name || 'عام',
      lawyerId,
      icon: 'fa-solid fa-scale-balanced',
      color: 'blue',
    }), 'تم نشر الخدمة.');
  };

  const addDoc = () => {
    if (!docTitle.trim() || !docSummary.trim()) return setStatus('أدخل عنوان المرجع وملخصه.');
    return run('doc', () => apiClient.addAdminLegalDoc({
      title: docTitle.trim(),
      law: 'مرجع إداري',
      article: 'عام',
      category: categories[0]?.name || 'عام',
      summary: docSummary.trim(),
      source: 'mobile-admin',
    }), 'تمت إضافة المرجع القانوني.');
  };

  const addCategory = () => {
    if (!categoryName.trim()) return setStatus('أدخل اسم التصنيف.');
    return run('category', () => apiClient.addAdminCategory({
      type: 'case',
      name: categoryName.trim(),
      description: 'تصنيف مضاف من الجوال.',
      icon: 'fa-folder',
      color: colors.navy,
      active: true,
    }), 'تمت إضافة التصنيف.');
  };

  const addPage = () => {
    if (!pageTitle.trim()) return setStatus('أدخل عنوان الصفحة.');
    const slug = pageTitle.trim().replace(/\s+/g, '-').toLowerCase();
    return run('page', () => apiClient.addAdminPage({ title: pageTitle.trim(), slug, route: `/${slug}`, status: 'draft' }), 'تم إنشاء الصفحة.');
  };

  const addRole = () => {
    if (!roleKey.trim() || !roleLabel.trim()) return setStatus('أدخل مفتاح الدور واسمه.');
    return run('role', () => apiClient.addAdminRole({ key: roleKey.trim(), label: roleLabel.trim(), description: 'دور مضاف من الجوال.' }), 'تم إنشاء الدور.');
  };

  const addRule = () => {
    if (!ruleValue.trim()) return setStatus('أدخل قيمة قاعدة المراقبة.');
    return run('rule', () => apiClient.addAdminModerationRule({ type: 'bannedWord', value: ruleValue.trim(), active: true }), 'تمت إضافة قاعدة المراقبة.');
  };

  const addTimeline = (caseId: string) => {
    if (!timelineTitle.trim()) return setStatus('أدخل عنوان محطة الجدول الزمني.');
    return run(`timeline-${caseId}`, () => apiClient.addAdminCaseTimeline(caseId, { dateLabel: 'اليوم', title: timelineTitle.trim(), detail: 'محطة مضافة من الجوال.', type: 'system' }), 'تمت إضافة محطة للقضية.');
  };

  const shareExport = async (type: 'kyc' | 'transactions' | 'tickets' | 'contracts') => {
    setBusy(`export-${type}`);
    try {
      let csv = '';
      if (type === 'tickets') {
        csv = ['subject,requester,priority,status', ...tickets.map((item) => `${item.subject || item.title || ''},${item.requester || item.email || ''},${item.priority || ''},${item.status || ''}`)].join('\n');
      } else if (type === 'contracts') {
        csv = ['contract,seller,buyer,car,vin,price,status', ...contracts.map((item) => `${item.id},${item.sellerName || ''},${item.buyerName || ''},${item.carModel || ''},${item.vinNumber || ''},${item.price || ''},${item.status || ''}`)].join('\n');
      } else {
        csv = await apiClient.exportAdminCsv(type);
      }
      await Share.share({ title: `${type}-export.csv`, message: csv });
      setStatus('تم تجهيز ملف التصدير للمشاركة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تجهيز التصدير.');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
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
          icon="scale-outline"
          kicker="Admin Command Center"
          title="مركز الإدارة التشغيلي"
          subtitle="اعتمادات، مستخدمون، قضايا، محتوى، أموال، امتثال، وصحة النظام بتجربة مناسبة للجوال."
          refreshing={refreshing}
        >
          <View style={styles.commandGrid}>
            <QuickAction icon="id-card-outline" label="KYC" count={pendingKyc.length} onPress={() => openTab('kyc', 'pending')} />
            <QuickAction icon="headset-outline" label="تصعيد" count={escalatedTickets.length} onPress={() => openTab('support', 'escalated')} />
            <QuickAction icon="shield-outline" label="امتثال" count={(metrics.complianceFlags || 0) + activeRules.length} onPress={() => openTab('compliance')} />
            <QuickAction icon="sync-outline" label="مزامنة" count={0} onPress={() => load(false)} />
          </View>
          <Text style={styles.lastUpdated}>آخر تحديث {lastUpdated.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</Text>
        </HeroSection>

        <Toast message={status} tone={status.includes('تعذر') || status.includes('أدخل') || status.includes('لا يوجد') ? 'error' : status.includes('تم') ? 'success' : 'info'} />

        <View style={styles.statsGrid}>
          <Metric label="مستخدمون" value={metrics.activeUsers ?? metrics.users ?? users.length} tone="blue" onPress={() => openTab('users')} />
          <Metric label="KYC" value={pendingKyc.length} tone="gold" onPress={() => openTab('kyc', 'pending')} />
          <Metric label="تصعيدات" value={escalatedTickets.length} tone="red" onPress={() => openTab('support', 'escalated')} />
          <Metric label="عقود" value={unsignedContracts.length} tone="green" onPress={() => openTab('contracts')} />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.navy} />
          <TextInput value={search} onChangeText={setSearch} placeholder="بحث في المستخدمين والسجلات" placeholderTextColor={colors.subtle} style={styles.searchInput} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map((item) => <TabChip key={item.id} tab={item} active={activeTab === item.id} count={countForTab(item.id)} onPress={() => openTab(item.id)} />)}
        </ScrollView>

        {activeTab === 'overview' ? renderOverview() : null}
        {activeTab === 'users' ? renderUsers() : null}
        {activeTab === 'cases' ? renderCases() : null}
        {activeTab === 'resources' ? renderResources() : null}
        {activeTab === 'roles' ? renderRoles() : null}
        {activeTab === 'financials' ? renderFinancials() : null}
        {activeTab === 'contracts' ? renderContracts() : null}
        {activeTab === 'kyc' ? renderKyc() : null}
        {activeTab === 'support' ? renderSupport() : null}
        {activeTab === 'settings' ? renderSettings() : null}
        {activeTab === 'compliance' ? renderCompliance() : null}
        {activeTab === 'system' ? renderSystem() : null}
      </ScrollView>
    </Screen>
  );

  function countForTab(tab: AdminTab) {
    const map: Record<AdminTab, number> = {
      overview: pendingKyc.length + escalatedTickets.length + highAlerts.length,
      users: blockedUsers.length,
      cases: activeCases.length,
      resources: docs.length + services.length + categories.length + pages.length + uploads.length,
      roles: roles.length,
      financials: transactions.length,
      contracts: unsignedContracts.length,
      kyc: pendingKyc.length,
      support: escalatedTickets.length || openTickets.length,
      settings: activeFlags.length,
      compliance: (metrics.complianceFlags || 0) + activeRules.length,
      system: alerts.length,
    };
    return map[tab];
  }

  function renderOverview() {
    const queues = [
      { title: 'طلبات KYC عاجلة', note: `${pendingKyc.length} طلب ينتظر قراراً`, count: pendingKyc.length, tab: 'kyc' as AdminTab, filter: 'pending', tone: 'gold' as const },
      { title: 'تصعيدات الدعم', note: `${openTickets.length} تذاكر مفتوحة`, count: escalatedTickets.length, tab: 'support' as AdminTab, filter: 'escalated', tone: 'red' as const },
      { title: 'حسابات تحتاج مراجعة', note: `${blockedUsers.length} محظور و${highAlerts.length} تنبيه عالي`, count: blockedUsers.length + highAlerts.length, tab: 'users' as AdminTab, filter: 'blocked', tone: 'red' as const },
      { title: 'امتثال وسياسات', note: `${docs.length} مرجع و${activeRules.length} قاعدة مفعلة`, count: metrics.complianceFlags || activeRules.length, tab: 'compliance' as AdminTab, filter: 'all', tone: 'blue' as const },
    ];
    return (
      <>
        <Card title="مركز الفرز اليومي" note="ابدأ بالقرارات الحرجة ثم انتقل إلى صحة التشغيل.">
          {queues.map((queue) => (
            <Pressable key={queue.title} onPress={() => openTab(queue.tab, queue.filter)} style={styles.queueRow}>
              <Status label={String(queue.count)} tone={queue.tone} />
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{queue.title}</Text>
                <Text style={styles.itemNote}>{queue.note}</Text>
              </View>
              <Ionicons name="chevron-back-outline" size={18} color={colors.subtle} />
            </Pressable>
          ))}
        </Card>
        <Card title="UX Intelligence" note="تعلم أين يتحرك المستخدمون وأين يتوقفون.">
          <View style={styles.statsGrid}>
            <Metric label="أحداث" value={intelligence?.totals?.events || 0} tone="blue" />
            <Metric label="مستخدمون" value={intelligence?.totals?.users || 0} tone="green" />
            <Metric label="صفحات" value={intelligence?.totals?.pages || 0} tone="gold" />
          </View>
          {(intelligence?.eventsByName || []).slice(0, 4).map((item: any) => <InfoRow key={item.label} icon="pulse-outline" title={item.label} note={`${item.count} حدث`} />)}
        </Card>
        <Card title="إشارات حرجة" note="نقاط تحتاج انتباهاً فورياً.">
          <InfoRow icon="documents-outline" title="الوثائق المتزامنة" note={String(metrics.docsSynced ?? docs.length)} />
          <InfoRow icon="shield-checkmark-outline" title="علامات الامتثال" note={String(metrics.complianceFlags ?? 0)} />
          <InfoRow icon="speedometer-outline" title="متوسط الاستجابة" note={metrics.avgResponseTimeMs ? `${metrics.avgResponseTimeMs} ms` : 'غير متوفر'} />
        </Card>
      </>
    );
  }

  function renderUsers() {
    return (
      <>
        <FilterRow items={['all', 'user', 'pro', 'admin', 'blocked']} labels={['الكل', 'مستخدم', 'محامي', 'مدير', 'محظور']} />
        {selectedUser ? (
          <Card title="ملف المستخدم المختار" note={`${selectedUser.name || 'مستخدم'} · تعديل سريع آمن للجوال`}>
            <InfoRow icon="mail-outline" title="البريد" note={selectedUser.email || 'غير متوفر'} />
            <InfoRow icon="location-outline" title="الموقع والتخصص" note={`${selectedUser.location || '-'} · ${selectedUser.specialty || '-'}`} />
            <View style={styles.rowWrap}>
              <Status label={selectedUser.subscriptionTier || 'basic'} tone="blue" />
              <Status label={selectedUser.licenseStatus || 'license'} tone={selectedUser.licenseStatus === 'verified' ? 'green' : 'gold'} />
              <Status label={`رصيد ${selectedUser.accountBalance || 0}`} tone="green" />
            </View>
            <View style={styles.actions}>
              <Button title="توثيق" variant="secondary" loading={busy === `verify-${selectedUser.id}`} onPress={() => run(`verify-${selectedUser.id}`, () => apiClient.updateAdminUser(selectedUser.id, { ...selectedUser, verified: !selectedUser.verified }), 'تم تحديث التوثيق.')} />
              <Button title="الإشعارات" variant="secondary" loading={busy === `notify-${selectedUser.id}`} onPress={() => run(`notify-${selectedUser.id}`, () => apiClient.updateAdminUser(selectedUser.id, { ...selectedUser, notificationsEnabled: !selectedUser.notificationsEnabled }), 'تم تحديث إشعارات المستخدم.')} />
            </View>
          </Card>
        ) : null}
        {filteredUsers.slice(0, 40).map((item) => (
          <Pressable key={item.id} onPress={() => setSelectedUserId(item.id)}>
            <Card title={item.name || 'مستخدم'} note={`${item.email || ''} · ${item.location || item.specialty || 'بدون موقع'}`}>
              <View style={styles.rowWrap}>
                <Status label={item.role || 'user'} tone={item.role === 'admin' ? 'red' : item.role === 'pro' ? 'blue' : 'green'} />
                {item.blocked ? <Status label="محظور" tone="red" /> : <Status label="نشط" tone="green" />}
              </View>
              <View style={styles.actions}>
                <Button title="تغيير الدور" variant="secondary" loading={busy === `role-${item.id}`} onPress={() => run(`role-${item.id}`, () => apiClient.updateAdminUserRole(item.id, nextRole(item.role)), 'تم تغيير الدور.')} />
                <Button title={item.blocked ? 'إلغاء الحظر' : 'حظر'} variant="secondary" loading={busy === `block-${item.id}`} onPress={() => run(`block-${item.id}`, () => apiClient.toggleAdminUserBlock(item.id), 'تم تحديث حالة الوصول.')} />
              </View>
            </Card>
          </Pressable>
        ))}
        {filteredUsers.length === 0 ? <EmptyState title="لا يوجد مستخدمون مطابقون" /> : null}
      </>
    );
  }

  function renderCases() {
    return (
      <>
        <View style={styles.statsGrid}>
          <Metric label="نشطة" value={activeCases.length} tone="blue" />
          <Metric label="مخاطر" value={cases.filter((item) => (item.riskScore || 0) > 70).length} tone="red" />
          <Metric label="مغلقة" value={cases.filter((item) => item.status === 'closed').length} tone="green" />
        </View>
        {cases.slice(0, 25).map((item) => (
          <Card key={item.id} title={item.title || 'قضية'} note={`${item.clientName || item.client || 'عميل'} · ${item.matter || item.status || 'ملف إداري'}`}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, item.progress || 0))}%` }]} /></View>
            <View style={styles.rowWrap}>
              <Status label={item.status || 'open'} tone={(item.riskScore || 0) > 70 ? 'red' : item.status === 'closed' ? 'green' : 'blue'} />
              <Status label={`خطر ${item.riskScore || 0}`} tone={(item.riskScore || 0) > 70 ? 'red' : 'gold'} />
            </View>
            <View style={styles.actions}>
              <Button title="قيد المراجعة" variant="secondary" onPress={() => run(`case-${item.id}`, () => apiClient.updateAdminCase(item.id, { status: 'in_review' }), 'تم تحديث القضية.')} />
              <Button title="+ تقدم" variant="secondary" onPress={() => run(`case-progress-${item.id}`, () => apiClient.updateAdminCase(item.id, { progress: Math.min(100, (item.progress || 0) + 10) }), 'تم تحديث تقدم القضية.')} />
              <Button title="+ خطر" variant="secondary" onPress={() => run(`case-risk-${item.id}`, () => apiClient.updateAdminCase(item.id, { riskScore: Math.min(100, (item.riskScore || 0) + 10) }), 'تم تحديث مخاطر القضية.')} />
              <Button title="محطة زمنية" variant="secondary" onPress={() => setComposer(composer === 'timeline' ? null : 'timeline')} />
            </View>
            {composer === 'timeline' ? (
              <View style={styles.formBlock}>
                <Field value={timelineTitle} onChangeText={setTimelineTitle} placeholder="عنوان المحطة" />
                <Button title="إضافة للقضية" loading={busy === `timeline-${item.id}`} onPress={() => addTimeline(item.id)} />
              </View>
            ) : null}
          </Card>
        ))}
      </>
    );
  }

  function renderResources() {
    return (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <SmallChip label="خدمة" active={composer === 'service'} onPress={() => setComposer(composer === 'service' ? null : 'service')} />
          <SmallChip label="مرجع" active={composer === 'doc'} onPress={() => setComposer(composer === 'doc' ? null : 'doc')} />
          <SmallChip label="تصنيف" active={composer === 'category'} onPress={() => setComposer(composer === 'category' ? null : 'category')} />
          <SmallChip label="صفحة" active={composer === 'page'} onPress={() => setComposer(composer === 'page' ? null : 'page')} />
        </ScrollView>
        {composer === 'service' ? <FormCard title="إضافة خدمة"><Field value={serviceTitle} onChangeText={setServiceTitle} placeholder="اسم الخدمة" /><Field value={servicePrice} onChangeText={setServicePrice} placeholder="السعر" /><Button title="نشر الخدمة" loading={busy === 'service'} onPress={addService} /></FormCard> : null}
        {composer === 'doc' ? <FormCard title="إضافة مرجع"><Field value={docTitle} onChangeText={setDocTitle} placeholder="عنوان المرجع" /><Field value={docSummary} onChangeText={setDocSummary} placeholder="ملخص" /><Button title="إضافة المرجع" loading={busy === 'doc'} onPress={addDoc} /></FormCard> : null}
        {composer === 'category' ? <FormCard title="إضافة تصنيف"><Field value={categoryName} onChangeText={setCategoryName} placeholder="اسم التصنيف" /><Button title="إضافة التصنيف" loading={busy === 'category'} onPress={addCategory} /></FormCard> : null}
        {composer === 'page' ? <FormCard title="إنشاء صفحة"><Field value={pageTitle} onChangeText={setPageTitle} placeholder="عنوان الصفحة" /><Button title="إنشاء الصفحة" loading={busy === 'page'} onPress={addPage} /></FormCard> : null}
        <Card title="الخدمات القانونية" note={`${services.length} خدمة`}>
          {services.slice(0, 12).map((item) => (
            <View key={item.id} style={styles.compactItem}>
              <InfoRow icon="scale-outline" title={item.title} note={`${item.price || ''} · ${item.category || 'عام'}`} />
              <Button title="حذف" variant="secondary" loading={busy === `service-del-${item.id}`} onPress={() => run(`service-del-${item.id}`, () => apiClient.deleteAdminLegalService(item.id), 'تم حذف الخدمة.')} />
            </View>
          ))}
        </Card>
        <Card title="المراجع والصفحات" note={`${docs.length} مرجع · ${pages.length} صفحة · ${uploads.length} ملف`}>
          {docs.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.compactItem}>
              <InfoRow icon="book-outline" title={item.title} note={item.category || item.law || 'مرجع'} />
              <Button title="حذف" variant="secondary" loading={busy === `doc-del-${item.id}`} onPress={() => run(`doc-del-${item.id}`, () => apiClient.deleteAdminLegalDoc(item.id), 'تم حذف المرجع.')} />
            </View>
          ))}
          {pages.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.compactItem}>
              <InfoRow icon="reader-outline" title={item.title} note={`${item.route || item.slug} · ${item.status} · ${(item.blocks || []).length} أقسام`} />
              <View style={styles.actions}>
                <Button title={item.status === 'published' ? 'أرشفة' : 'نشر'} variant="secondary" loading={busy === `page-${item.id}`} onPress={() => run(`page-${item.id}`, () => apiClient.updateAdminPage(item.id, { status: item.status === 'published' ? 'archived' : 'published' }), 'تم تحديث الصفحة.')} />
                <Button title="قسم" variant="secondary" loading={busy === `block-${item.id}`} onPress={() => run(`block-${item.id}`, () => apiClient.addAdminPageBlock(item.id, { key: `block-${(item.blocks || []).length + 1}`, type: 'text', title: 'قسم جديد', body: '', sortOrder: (item.blocks || []).length, active: true }), 'تمت إضافة قسم للصفحة.')} />
                <Button title="حذف" variant="secondary" loading={busy === `page-del-${item.id}`} onPress={() => run(`page-del-${item.id}`, () => apiClient.deleteAdminPage(item.id), 'تم حذف الصفحة.')} />
              </View>
            </View>
          ))}
          {categories.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.compactItem}>
              <InfoRow icon="folder-outline" title={item.name} note={item.active ? 'مفعل' : 'معطل'} />
              <View style={styles.actions}>
                <Button title={item.active ? 'تعطيل' : 'تفعيل'} variant="secondary" loading={busy === `cat-${item.id}`} onPress={() => run(`cat-${item.id}`, () => apiClient.updateAdminCategory(item.id, { active: !item.active }), 'تم تحديث التصنيف.')} />
                <Button title="حذف" variant="secondary" loading={busy === `cat-del-${item.id}`} onPress={() => run(`cat-del-${item.id}`, () => apiClient.deleteAdminCategory(item.id), 'تم حذف التصنيف.')} />
              </View>
            </View>
          ))}
          {uploads.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.compactItem}>
              <InfoRow icon="cloud-upload-outline" title={item.originalName || item.filename || 'ملف'} note={`${item.purpose || 'media'} · ${item.ownerName || 'بدون مالك'}`} />
              <View style={styles.actions}>
                {item.url ? <Button title="فتح" variant="secondary" onPress={() => Linking.openURL(item.url)} /> : null}
                <Button title="حذف" variant="secondary" loading={busy === `upload-del-${item.id}`} onPress={() => run(`upload-del-${item.id}`, () => apiClient.deleteAdminUpload(item.id), 'تم حذف الملف.')} />
              </View>
            </View>
          ))}
        </Card>
      </>
    );
  }

  function renderRoles() {
    return (
      <>
        <Pressable onPress={() => setComposer(composer === 'role' ? null : 'role')} style={styles.actionBanner}>
          <Ionicons name={composer === 'role' ? 'close-outline' : 'add-outline'} size={18} color={colors.blue} />
          <Text style={styles.actionBannerText}>{composer === 'role' ? 'إغلاق إنشاء الدور' : 'إنشاء دور جديد'}</Text>
        </Pressable>
        {composer === 'role' ? <FormCard title="دور جديد"><Field value={roleKey} onChangeText={setRoleKey} placeholder="role_key" /><Field value={roleLabel} onChangeText={setRoleLabel} placeholder="اسم الدور" /><Button title="إنشاء الدور" loading={busy === 'role'} onPress={addRole} /></FormCard> : null}
        {roles.map((role) => (
          <Card key={role.id} title={role.label || role.key} note={role.description || `${(role.permissions || []).length} صلاحية`}>
            <View style={styles.rowWrap}>
              {(role.permissions || []).slice(0, 4).map((permission: string) => <Status key={permission} label={permission} tone="blue" />)}
              {role.system ? <Status label="نظامي" tone="gold" /> : null}
              {!role.active ? <Status label="معطل" tone="red" /> : null}
            </View>
            <View style={styles.actions}>
              <Button title={role.active ? 'تعطيل' : 'تفعيل'} variant="secondary" loading={busy === `role-active-${role.id}`} onPress={() => run(`role-active-${role.id}`, () => apiClient.updateAdminRole(role.id, { active: !role.active }), 'تم تحديث الدور.')} />
              {!role.system ? <Button title="حذف" variant="secondary" loading={busy === `role-del-${role.id}`} onPress={() => run(`role-del-${role.id}`, () => apiClient.deleteAdminRole(role.id), 'تم حذف الدور.')} /> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {permissions.slice(0, 8).map((permission) => {
                const key = permission.key || permission.id;
                const active = (role.permissions || []).includes(key);
                return <SmallChip key={key} label={permission.label || key} active={active} onPress={() => {
                  const next = active ? (role.permissions || []).filter((item: string) => item !== key) : [...(role.permissions || []), key];
                  run(`perm-${role.id}`, () => apiClient.updateAdminRolePermissions(role.id, next), 'تم تحديث الصلاحيات.');
                }} />;
              })}
            </ScrollView>
          </Card>
        ))}
      </>
    );
  }

  function renderFinancials() {
    return (
      <>
        <Pressable onPress={() => shareExport('transactions')} style={styles.actionBanner}>
          <Ionicons name="download-outline" size={18} color={colors.blue} />
          <Text style={styles.actionBannerText}>{busy === 'export-transactions' ? 'تجهيز التقرير المالي...' : 'تصدير التقرير المالي CSV'}</Text>
        </Pressable>
        <View style={styles.statsGrid}>
          <Metric label="اليوم" value={metrics.dailyVolume || 0} tone="green" />
          <Metric label="عمليات" value={transactions.length} tone="blue" />
          <Metric label="بوابات" value={gateways.length} tone="gold" />
        </View>
        <Card title="بوابات الدفع" note="تفعيل الرسوم ومراقبة السيولة.">
          {gateways.map((item) => <ToggleRow key={item.key} title={item.label || item.key} note={`رسوم ${item.feePercent ?? 0}%`} active={item.enabled} onPress={() => run(`gateway-${item.key}`, () => apiClient.updateAdminPaymentGateway(item.key, !item.enabled, item.feePercent), 'تم تحديث بوابة الدفع.')} />)}
        </Card>
        <Card title="آخر المعاملات" note="الإيرادات والسحوبات.">
          {transactions.slice(0, 12).map((item) => <InfoRow key={item.id} icon="receipt-outline" title={item.label || item.userName || item.type} note={`${item.amount || 0} · ${item.status || ''} · ${item.date || item.createdAt || ''}`} />)}
        </Card>
      </>
    );
  }

  function renderContracts() {
    return (
      <>
        <Pressable onPress={() => shareExport('contracts')} style={styles.actionBanner}>
          <Ionicons name="download-outline" size={18} color={colors.blue} />
          <Text style={styles.actionBannerText}>تصدير العقود CSV</Text>
        </Pressable>
        <View style={styles.statsGrid}>
          <Metric label="الإجمالي" value={contracts.length} tone="blue" />
          <Metric label="موقعة" value={contracts.filter((item) => item.status === 'signed').length} tone="green" />
          <Metric label="انتظار" value={contracts.filter((item) => item.status === 'waiting_buyer').length} tone="gold" />
        </View>
        {contracts.slice(0, 20).map((item) => (
          <Card key={item.id} title={item.carModel || item.title || 'عقد رقمي'} note={`VIN ${item.vinNumber || 'غير متوفر'} · ${item.price || 0} د.ع`}>
            <InfoRow icon="person-outline" title="الأطراف" note={`بائع: ${item.sellerName || '-'} · مشتري: ${item.buyerName || '-'}`} />
            <Status label={item.status || 'draft'} tone={item.status === 'signed' ? 'green' : item.status === 'waiting_buyer' ? 'gold' : 'blue'} />
            {(item.reviewNotes || []).slice(0, 2).map((note: any, index: number) => <InfoRow key={`${item.id}-${index}`} icon="clipboard-outline" title={note.author || 'مراجعة قانونية'} note={`${note.date || ''} · ${note.text || ''}`} />)}
          </Card>
        ))}
      </>
    );
  }

  function renderKyc() {
    return (
      <>
        <Pressable onPress={() => shareExport('kyc')} style={styles.actionBanner}>
          <Ionicons name="download-outline" size={18} color={colors.blue} />
          <Text style={styles.actionBannerText}>تصدير طلبات KYC CSV</Text>
        </Pressable>
        <FilterRow items={['pending', 'approved', 'rejected', 'all']} labels={['معلقة', 'مقبولة', 'مرفوضة', 'الكل']} />
        {filteredKyc.map((item) => (
          <Card key={item.id} title={item.name || item.userName || item.user?.name || 'طلب تحقق'} note={`${item.email || item.city || item.user?.email || ''} · ${item.license || item.type || 'مراجعة هوية'}`}>
            <View style={styles.rowWrap}>
              <Status label={item.status || 'pending'} tone={item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'gold'} />
              <Status label={`${(item.attachments || []).length} مرفق`} tone="blue" />
            </View>
            <View style={styles.actions}>
              {(item.attachments || []).length > 0 ? <Button title="فتح المرفق" variant="secondary" onPress={() => Linking.openURL(item.attachments[0])} /> : null}
              <Button title="رفض" variant="secondary" loading={busy === `kyc-r-${item.id}`} onPress={() => run(`kyc-r-${item.id}`, () => apiClient.updateAdminKyc(item.id, 'rejected'), 'تم رفض الطلب.')} />
              <Button title="قبول" loading={busy === `kyc-a-${item.id}`} onPress={() => run(`kyc-a-${item.id}`, () => apiClient.updateAdminKyc(item.id, 'approved'), 'تم قبول الطلب.')} />
            </View>
          </Card>
        ))}
        {filteredKyc.length === 0 ? <EmptyState title="لا توجد طلبات KYC" /> : null}
      </>
    );
  }

  function renderSupport() {
    return (
      <>
        <Pressable onPress={() => shareExport('tickets')} style={styles.actionBanner}>
          <Ionicons name="download-outline" size={18} color={colors.blue} />
          <Text style={styles.actionBannerText}>تصدير تذاكر الدعم CSV</Text>
        </Pressable>
        <FilterRow items={['all', 'open', 'pending', 'resolved', 'escalated']} labels={['الكل', 'مفتوحة', 'معلقة', 'محلولة', 'مصعدة']} />
        {filteredTickets.map((item) => (
          <Card key={item.id} title={item.subject || item.title || 'تذكرة دعم'} note={`${item.requester || item.email || 'مستخدم'} · ${item.priority || 'normal'}`}>
            <Text style={styles.bodyText}>{item.message || item.description || 'لا يوجد وصف.'}</Text>
            <View style={styles.actions}>
              {['pending', 'resolved', 'escalated'].map((next) => <Button key={next} title={next} variant="secondary" loading={busy === `ticket-${item.id}-${next}`} onPress={() => run(`ticket-${item.id}-${next}`, () => apiClient.updateAdminSupportTicket(item.id, { status: next }), 'تم تحديث التذكرة.')} />)}
            </View>
          </Card>
        ))}
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <Pressable onPress={() => setComposer(composer === 'broadcast' ? null : 'broadcast')} style={styles.actionBanner}>
          <Ionicons name={composer === 'broadcast' ? 'close-outline' : 'megaphone-outline'} size={18} color={colors.blue} />
          <Text style={styles.actionBannerText}>{composer === 'broadcast' ? 'إغلاق إعلان المنصة' : 'إرسال إعلان للمنصة'}</Text>
        </Pressable>
        {composer === 'broadcast' ? <FormCard title="إعلان المنصة"><Field value={broadcastMessage} onChangeText={setBroadcastMessage} placeholder="نص الإعلان" /><Button title="نشر الإعلان" loading={busy === 'broadcast'} onPress={() => {
          if (!broadcastMessage.trim()) return setStatus('أدخل نص الإعلان.');
          return run('broadcast', () => apiClient.updateAdminSystemSettings({ ...systemSettings, announcement: broadcastMessage.trim() }), 'تم نشر الإعلان.');
        }} /></FormCard> : null}
        <Card title="ميزات المنصة" note={`${activeFlags.length} مفعلة`}>
          {flags.map((item) => <ToggleRow key={item.key} title={item.label || item.key} note={item.description || item.key} active={item.enabled} onPress={() => run(`flag-${item.key}`, () => apiClient.updateAdminFeatureFlag(item.key, !item.enabled), 'تم تحديث الميزة.')} />)}
        </Card>
        <Card title="إعدادات AI والنظام" note="تشغيل ذكي وسياسات عامة.">
          <ToggleRow title="المساعد الذكي" note={`نموذج ${aiSettings.model || 'default'}`} active={aiSettings.enabled !== false} onPress={() => run('ai-settings', () => apiClient.updateAdminAiSettings({ ...aiSettings, enabled: aiSettings.enabled === false }), 'تم تحديث AI.')} />
          <ToggleRow title="وضع الطوارئ للذكاء الاصطناعي" note="Fallback Mode" active={!!aiSettings.fallbackMode} onPress={() => run('ai-fallback', () => apiClient.updateAdminAiSettings({ ...aiSettings, fallbackMode: !aiSettings.fallbackMode }), 'تم تحديث وضع AI الاحتياطي.')} />
          <ToggleRow title="الضريبة" note="سياسة الفوترة" active={(policies.find((item) => item.key === 'tax_enabled')?.value ?? 'true') === 'true'} onPress={() => {
            const policy = policies.find((item) => item.key === 'tax_enabled');
            if (policy) run('tax', () => apiClient.updateAdminPolicy(policy.key, policy.value === 'true' ? 'false' : 'true'), 'تم تحديث السياسة.');
          }} />
          <Button title="إعادة تشغيل AI" variant="secondary" loading={busy === 'restart-ai'} onPress={() => run('restart-ai', () => apiClient.restartAdminAi(), 'تم جدولة إعادة تشغيل AI.')} />
        </Card>
        <Card title="سير العمل والإشعارات" note={`${templates.length} قالب إشعار`}>
          <ToggleRow title="قبول قضايا جديدة" note="مسار القضايا" active={workflow.allowNewCases !== false} onPress={() => run('workflow-cases', () => apiClient.updateAdminWorkflowSettings({ ...workflow, allowNewCases: workflow.allowNewCases === false }), 'تم تحديث قبول القضايا.')} />
          <ToggleRow title="إجبار توقيع المستندات" note="ضبط التوقيع" active={!!workflow.enforceSignedDocs} onPress={() => run('workflow-docs', () => apiClient.updateAdminWorkflowSettings({ ...workflow, enforceSignedDocs: !workflow.enforceSignedDocs }), 'تم تحديث توقيع المستندات.')} />
          <ToggleRow title="إسناد المحامين آلياً" note="توزيع العمل" active={!!workflow.autoAssignLawyers} onPress={() => run('workflow-assign', () => apiClient.updateAdminWorkflowSettings({ ...workflow, autoAssignLawyers: !workflow.autoAssignLawyers }), 'تم تحديث الإسناد الآلي.')} />
          <ToggleRow title="التوقيع الرقمي" note="مسار العقود" active={workflow.digitalSignatureEnabled !== false} onPress={() => run('workflow-sign', () => apiClient.updateAdminWorkflowSettings({ ...workflow, digitalSignatureEnabled: workflow.digitalSignatureEnabled === false }), 'تم تحديث سير العمل.')} />
          {templates.slice(0, 5).map((item) => <ToggleRow key={item.key} title={item.label || item.key} note={item.channel || 'notification'} active={item.enabled !== false} onPress={() => run(`template-${item.key}`, () => apiClient.updateAdminNotificationTemplate(item.key, { enabled: item.enabled === false }), 'تم تحديث قالب الإشعار.')} />)}
        </Card>
      </>
    );
  }

  function renderCompliance() {
    return (
      <>
        <Pressable onPress={() => setComposer(composer === 'rule' ? null : 'rule')} style={styles.actionBanner}>
          <Ionicons name={composer === 'rule' ? 'close-outline' : 'add-outline'} size={18} color={colors.blue} />
          <Text style={styles.actionBannerText}>{composer === 'rule' ? 'إغلاق قاعدة المراقبة' : 'إضافة قاعدة مراقبة'}</Text>
        </Pressable>
        {composer === 'rule' ? <FormCard title="قاعدة جديدة"><Field value={ruleValue} onChangeText={setRuleValue} placeholder="كلمة محظورة أو موضوع حساس" /><Button title="إضافة القاعدة" loading={busy === 'rule'} onPress={addRule} /></FormCard> : null}
        <Card title="قواعد المراقبة" note={`${activeRules.length} قاعدة مفعلة`}>
          {rules.map((item) => (
            <View key={item.id} style={styles.compactItem}>
              <ToggleRow title={item.value} note={item.type || 'moderation'} active={item.active} onPress={() => run(`rule-${item.id}`, () => apiClient.updateAdminModerationRule(item.id, { active: !item.active }), 'تم تحديث قاعدة المراقبة.')} />
              <Button title="حذف" variant="secondary" loading={busy === `rule-del-${item.id}`} onPress={() => run(`rule-del-${item.id}`, () => apiClient.deleteAdminModerationRule(item.id), 'تم حذف قاعدة المراقبة.')} />
            </View>
          ))}
        </Card>
        <Card title="الخدمات والمراجع القانونية" note="حذف سريع للعناصر الحساسة">
          {services.slice(0, 6).map((item) => <InfoAction key={item.id} icon="scale-outline" title={item.title} note={item.category || 'خدمة'} action="حذف" loading={busy === `service-del-c-${item.id}`} onPress={() => run(`service-del-c-${item.id}`, () => apiClient.deleteAdminLegalService(item.id), 'تم حذف الخدمة.')} />)}
          {docs.slice(0, 6).map((item) => <InfoAction key={item.id} icon="book-outline" title={item.title} note={item.category || 'مرجع'} action="حذف" loading={busy === `doc-del-c-${item.id}`} onPress={() => run(`doc-del-c-${item.id}`, () => apiClient.deleteAdminLegalDoc(item.id), 'تم حذف المرجع.')} />)}
        </Card>
        <Card title="سجل الحوكمة" note="AI، أمن، ونظام">
          {filteredAudit.slice(0, 12).map((item) => <InfoRow key={item.id} icon="shield-outline" title={item.category || item.type || 'سجل'} note={`${item.actor || ''} · ${item.message || ''} · ${item.time || ''}`} />)}
        </Card>
      </>
    );
  }

  function renderSystem() {
    return (
      <>
        <Card title="صحة النظام" note="عمليات فورية وسجلات مراقبة.">
          <InfoRow icon="server-outline" title="حالة النظام" note={systemSettings.maintenanceMode ? 'صيانة' : 'تشغيل'} />
          <InfoRow icon="warning-outline" title="التنبيهات" note={`${alerts.length} تنبيه · ${highAlerts.length} عالي`} />
          <View style={styles.actions}>
            <Button title="تنظيف الكاش" variant="secondary" loading={busy === 'cache'} onPress={() => run('cache', () => apiClient.clearAdminCache(), 'تم تنظيف كاش الإدارة.')} />
            <Button title="إعادة AI" variant="secondary" loading={busy === 'restart-ai'} onPress={() => run('restart-ai', () => apiClient.restartAdminAi(), 'تم جدولة إعادة تشغيل AI.')} />
            <Button title={systemSettings.maintenanceMode ? 'إيقاف الصيانة' : 'تفعيل الصيانة'} variant="secondary" loading={busy === 'maintenance'} onPress={() => run('maintenance', () => apiClient.updateAdminSystemSettings({ ...systemSettings, maintenanceMode: !systemSettings.maintenanceMode }), 'تم تحديث إعدادات النظام.')} />
          </View>
        </Card>
        <Card title="التنبيهات الأمنية" note="أعلى المخاطر أولاً">
          {alerts.slice(0, 12).map((item) => <InfoRow key={item.id} icon="alert-circle-outline" title={item.title || item.category || 'تنبيه'} note={`${item.severity || ''} · ${item.message || item.detail || ''}`} />)}
        </Card>
        <Card title="سجلات النظام" note="آخر عمليات الإدارة">
          {auditLogs.slice(0, 12).map((item) => <InfoRow key={item.id} icon="terminal-outline" title={item.category || item.type || 'سجل'} note={`${item.actor || ''} · ${item.message || ''}`} />)}
        </Card>
      </>
    );
  }

  function FilterRow({ items, labels }: { items: string[]; labels: string[] }) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {items.map((item, index) => <SmallChip key={item} label={labels[index]} active={filter === item} onPress={() => setFilter(item)} />)}
      </ScrollView>
    );
  }
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      {children}
    </View>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.formCard}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function QuickAction({ icon, label, count, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
      <Ionicons name={icon} size={18} color={colors.blue} />
      <Text style={styles.quickActionText}>{label}</Text>
      {count > 0 ? <Text style={styles.quickBadge}>{count > 99 ? '+99' : count}</Text> : null}
    </Pressable>
  );
}

function TabChip({ tab, active, count, onPress }: { tab: { label: string; note: string; icon: keyof typeof Ionicons.glyphMap }; active: boolean; count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabChip, active && styles.tabChipActive]}>
      <Ionicons name={tab.icon} size={16} color={active ? '#fff' : colors.navy} />
      <View>
        <Text style={[styles.tabLabel, active && styles.tabTextActive]}>{tab.label}</Text>
        <Text style={[styles.tabNote, active && styles.tabNoteActive]}>{tab.note}</Text>
      </View>
      {count > 0 ? <Text style={[styles.tabBadge, active && styles.tabBadgeActive]}>{count > 99 ? '+99' : count}</Text> : null}
    </Pressable>
  );
}

function Metric({ label, value, tone, onPress }: { label: string; value: number | string; tone: 'red' | 'blue' | 'green' | 'gold'; onPress?: () => void }) {
  const toneStyle = tone === 'red' ? styles.metricRed : tone === 'green' ? styles.metricGreen : tone === 'gold' ? styles.metricGold : styles.metricBlue;
  return <Pressable onPress={onPress} style={[styles.metric, toneStyle]}><Text style={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString('ar-IQ') : value}</Text><Text style={styles.metricLabel}>{label}</Text></Pressable>;
}

function Field({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle} style={styles.input} textAlign="right" />;
}

function SmallChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.smallChip, active && styles.smallChipActive]}><Text style={[styles.smallChipText, active && styles.smallChipTextActive]} numberOfLines={1}>{label}</Text></Pressable>;
}

function Status({ label, tone }: { label: string; tone: 'red' | 'green' | 'blue' | 'gold' }) {
  const style = tone === 'red' ? styles.statusRed : tone === 'green' ? styles.statusGreen : tone === 'gold' ? styles.statusGold : styles.statusBlue;
  return <Text style={[styles.statusBadge, style]}>{label}</Text>;
}

function InfoRow({ icon, title, note }: { icon: keyof typeof Ionicons.glyphMap; title: string; note: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={17} color={colors.blue} /></View>
      <View style={styles.flex}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoNote} numberOfLines={2}>{note}</Text>
      </View>
    </View>
  );
}

function InfoAction({ icon, title, note, action, loading, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; note: string; action: string; loading?: boolean; onPress: () => void }) {
  return (
    <View style={styles.compactItem}>
      <InfoRow icon={icon} title={title} note={note} />
      <Button title={action} variant="secondary" loading={loading} onPress={onPress} />
    </View>
  );
}

function ToggleRow({ title, note, active, onPress }: { title: string; note: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow}>
      <View style={[styles.toggle, active && styles.toggleActive]}><View style={[styles.toggleDot, active && styles.toggleDotActive]} /></View>
      <View style={styles.flex}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoNote}>{note}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionBanner: { alignItems: 'center', backgroundColor: colors.blueTint, borderColor: '#cfe2ff', borderRadius: 8, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, marginBottom: 10, padding: 12 },
  actionBannerText: { color: colors.blue, flex: 1, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  bodyText: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 22, marginTop: 8, textAlign: 'right' },
  card: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, elevation: 2, marginBottom: 12, padding: 13, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18 },
  chipRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  commandGrid: { flexDirection: 'row-reverse', gap: 8, marginTop: 14 },
  compactItem: { borderBottomColor: colors.line, borderBottomWidth: 1, paddingBottom: 9, paddingTop: 2 },
  content: { paddingBottom: 20 },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  flex: { flex: 1 },
  formBlock: { backgroundColor: colors.surface, borderRadius: 8, marginTop: 10, padding: 10 },
  formCard: { backgroundColor: colors.paper, borderColor: colors.blue, borderRadius: 8, borderWidth: 1, marginBottom: 12, padding: 13 },
  infoIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  infoNote: { color: colors.muted, fontSize: 11, fontWeight: '700', lineHeight: 18, marginTop: 3, textAlign: 'right' },
  infoRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10, paddingVertical: 9 },
  infoTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 48, marginTop: 9, paddingHorizontal: 12 },
  itemNote: { color: colors.muted, fontSize: 11, fontWeight: '700', lineHeight: 18, marginTop: 3, textAlign: 'right' },
  itemTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: '900', textAlign: 'right' },
  lastUpdated: { color: colors.subtle, fontSize: 11, fontWeight: '800', marginTop: 10, textAlign: 'right' },
  metric: { alignItems: 'flex-end', borderRadius: 8, flex: 1, minHeight: 70, justifyContent: 'center', padding: 9 },
  metricBlue: { backgroundColor: colors.blueTint },
  metricGold: { backgroundColor: colors.goldTint },
  metricGreen: { backgroundColor: colors.greenTint },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  metricRed: { backgroundColor: colors.redTint },
  metricValue: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  progressFill: { backgroundColor: colors.blue, borderRadius: 999, height: '100%' },
  progressTrack: { backgroundColor: colors.tint, borderRadius: 999, height: 7, marginVertical: 10, overflow: 'hidden' },
  queueRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row-reverse', gap: 10, paddingVertical: 10 },
  quickAction: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 58, justifyContent: 'center', paddingHorizontal: 5 },
  quickActionText: { color: colors.ink, fontSize: 11, fontWeight: '900', marginTop: 3 },
  quickBadge: { backgroundColor: colors.red, borderRadius: 999, color: '#fff', fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, position: 'absolute', right: 5, top: 5 },
  rowWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  searchBox: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, marginBottom: 10, paddingHorizontal: 12 },
  searchInput: { color: colors.ink, flex: 1, minHeight: 44, textAlign: 'right' },
  sectionNote: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 19, marginBottom: 10, marginTop: 4, textAlign: 'right' },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  smallChip: { backgroundColor: colors.tint, borderRadius: 999, justifyContent: 'center', minHeight: 34, maxWidth: 180, paddingHorizontal: 12 },
  smallChipActive: { backgroundColor: colors.navy },
  smallChipText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  smallChipTextActive: { color: '#fff' },
  statsGrid: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  statusBadge: { borderRadius: 999, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  statusBlue: { backgroundColor: colors.blueTint, color: colors.blue },
  statusGold: { backgroundColor: colors.goldTint, color: colors.gold },
  statusGreen: { backgroundColor: colors.greenTint, color: colors.green },
  statusRed: { backgroundColor: colors.redTint, color: colors.red },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 21, marginTop: 5, textAlign: 'right' },
  tabBadge: { backgroundColor: colors.red, borderRadius: 999, color: '#fff', fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeActive: { backgroundColor: colors.gold, color: colors.ink },
  tabChip: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, minHeight: 50, minWidth: 142, paddingHorizontal: 10 },
  tabChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabLabel: { color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  tabNote: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 1, textAlign: 'right' },
  tabNoteActive: { color: 'rgba(255,255,255,0.72)' },
  tabRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 12 },
  tabTextActive: { color: '#fff' },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900', textAlign: 'right' },
  toggle: { alignItems: 'flex-start', backgroundColor: colors.tint, borderRadius: 999, height: 26, justifyContent: 'center', paddingHorizontal: 3, width: 46 },
  toggleActive: { alignItems: 'flex-end', backgroundColor: colors.green },
  toggleDot: { backgroundColor: '#fff', borderRadius: 999, height: 20, width: 20 },
  toggleDotActive: { backgroundColor: '#fff' },
  toggleRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row-reverse', gap: 10, paddingVertical: 10 },
});
