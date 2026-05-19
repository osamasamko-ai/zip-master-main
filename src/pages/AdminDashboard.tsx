import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Chart } from 'chart.js/auto';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import NoticePanel from '../components/ui/NoticePanel';
import { motion, AnimatePresence } from 'framer-motion';

type KycStatus = 'pending' | 'approved' | 'rejected';

type KycApplication = {
  id: string;
  name: string;
  city: string;
  license: string;
  attachments: string[];
  status: KycStatus;
  specialty?: string;
  experienceYears?: number;
  submittedAt?: string;
  profileScore?: number;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'pro' | 'admin';
  location: string;
  blocked: boolean;
  verified: boolean;
  licenseNumber?: string;
  specialty?: string;
  rating?: number;
  openCases?: number;
  freeConsultsRemaining?: number;
  subscriptionTier: 'basic' | 'pro' | 'enterprise';
  notificationsEnabled: boolean;
  accountBalance: number;
  licenseStatus: 'pending' | 'verified' | 'rejected';
  notes: string;
};

type FeatureFlag = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

type SupportTicket = {
  id: string;
  requester: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'escalated';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
};

type PolicySetting = {
  key: string;
  label: string;
  value: string;
  description: string;
};

type SecurityAlert = {
  id: string;
  category: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  time: string;
};

type AuditRecord = {
  id: string;
  type: 'security' | 'kyc' | 'transaction' | 'ai' | 'system';
  category: string;
  actor: string;
  message: string;
  time: string;
};

type TransactionRecord = {
  id: string;
  label: string;
  source: string;
  amount: number;
  type: 'credit' | 'debit';
  status: 'completed' | 'pending' | 'failed';
};

type SystemSettings = {
  maintenanceMode: boolean;
  announcement: string;
  offlineMessage: string;
  supportEmail: string;
};

type PaymentGateway = {
  key: string;
  label: string;
  enabled: boolean;
  feePercent: number;
};

type AiSettings = {
  enabled: boolean;
  topK: number;
  fallbackMode: boolean;
  maxTokens: number;
  forceLocalMode: boolean;
  pricePerRequest: number;
  pricePerToken: number;
  freeRequestsPerUser: number;
  freeTokensPerUser: number;
  jpegQuality: number;
};

type WorkflowSettings = {
  allowNewCases: boolean;
  enforceSignedDocs: boolean;
  autoAssignLawyers: boolean;
  openCasesPerLawyer: number;
};

type NotificationTemplate = {
  key: string;
  label: string;
  value: string;
  active: boolean;
};

type ModerationRule = {
  id: string;
  type: 'bannedWord' | 'sensitiveTopic';
  value: string;
  active: boolean;
};

type LegalDoc = {
  id: string;
  title: string;
  law: string;
  article: string;
  category: string;
  summary: string;
  source: string;
};

type LegalService = {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: string;
  time: string;
  color: string;
  category: string;
  lawyerId?: string | null;
  lawyerName?: string | null;
  lawyerSpecialty?: string | null;
  lawyerAvatar?: string | null;
  active: boolean;
};

type CategoryRecord = {
  id: string;
  type: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  active: boolean;
  sortOrder: number;
};

type UploadRecord = {
  id: string;
  ownerName?: string | null;
  resourceType: string;
  resourceId?: string | null;
  purpose: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
  status: string;
  createdAt: string;
};

type PageRecord = {
  id: string;
  slug: string;
  route: string;
  title: string;
  status: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  blocks?: Array<{
    id: string;
    key: string;
    type: string;
    title: string;
    body: string;
    sortOrder: number;
    active: boolean;
  }>;
};

type PermissionRecord = {
  id: string;
  key: string;
  label: string;
  description: string;
  group: string;
};

type RoleRecord = {
  id: string;
  key: string;
  label: string;
  description: string;
  system: boolean;
  active: boolean;
  permissions?: string[];
};

type AdminCaseRecord = {
  id: string;
  title: string;
  matter: string;
  status: string;
  progress: number;
  riskScore: number;
  privateNote?: string;
  updatedAt: string;
  client?: { id: string; name: string; email: string } | null;
  lawyer?: { id: string; name: string; email: string } | null;
  documents?: unknown[];
  timelineEntries?: Array<{ id: string; dateLabel: string; title: string; detail: string; type: string }>;
};

type DigitalContract = {
  id: string;
  title: string;
  status: 'draft' | 'waiting_buyer' | 'signed' | 'verified';
  sellerName: string;
  buyerName: string;
  carModel: string;
  vinNumber: string;
  reviewNotes?: Array<{ author: string; text: string; date: string }>;
  price: string;
  createdAt: string;
};

type AdminMetrics = {
  activeUsers: number;
  dailyVolume: number;
  avgResponseTimeMs: number;
  ragAccuracy: number;
  docsSynced: number;
  suspiciousEvents: number;
  openEscalations: number;
  complianceFlags: number;
};

type AdminTab = 'overview' | 'users' | 'cases' | 'resources' | 'roles' | 'financials' | 'contracts' | 'kyc' | 'support' | 'settings' | 'compliance' | 'system';

type AdminToast = {
  id: string;
  title: string;
  message: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
};

const formatCurrency = (value: number) => new Intl.NumberFormat('ar-IQ').format(value) + ' د.ع';

const statusToneMap = {
  danger: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
} as const;

function ImpactSummary({
  tone,
  title,
  description,
}: {
  tone: keyof typeof statusToneMap;
  title: string;
  description: string;
}) {
  return (
    <div className={`rounded-3xl border p-4 ${statusToneMap[tone]}`}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-6">{description}</p>
    </div>
  );
}

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-brand-gold/30 text-brand-dark px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const growthChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [kycApplications, setKycApplications] = useState<KycApplication[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'user' | 'pro' | 'admin'>('all');
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [policies, setPolicies] = useState<PolicySetting[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings | null>(null);
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
  const [moderationRules, setModerationRules] = useState<ModerationRule[]>([]);
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [legalServices, setLegalServices] = useState<LegalService[]>([]);
  const [digitalContracts, setDigitalContracts] = useState<DigitalContract[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [adminCases, setAdminCases] = useState<AdminCaseRecord[]>([]);
  const [newDoc, setNewDoc] = useState<Partial<LegalDoc>>({ title: '', law: '', article: '', category: '', summary: '', source: '' });
  const [newService, setNewService] = useState<Partial<LegalService>>({
    title: '',
    description: '',
    price: '',
    time: '',
    category: '',
    lawyerId: '',
    icon: 'fa-solid fa-scale-balanced',
    color: 'blue',
  });
  const [newCategory, setNewCategory] = useState<Partial<CategoryRecord>>({ type: 'case', name: '', description: '', icon: 'fa-folder', color: '#1B365D' });
  const [newPage, setNewPage] = useState<Partial<PageRecord>>({ title: '', slug: '', route: '', status: 'draft' });
  const [newRole, setNewRole] = useState<Partial<RoleRecord>>({ key: '', label: '', description: '' });
  const [timelineDrafts, setTimelineDrafts] = useState<Record<string, { title: string; detail: string; type: string }>>({});
  const [newBannedWord, setNewBannedWord] = useState('');
  const [newModerationType, setNewModerationType] = useState<'bannedWord' | 'sensitiveTopic'>('bannedWord');
  const [moderationSearch, setModerationSearch] = useState('');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const navigate = useNavigate();
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const [activeToast, setActiveToast] = useState<AdminToast | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReviewContract, setSelectedReviewContract] = useState<DigitalContract | null>(null);
  const [userSaveStatus, setUserSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'pending' | 'resolved' | 'escalated'>('all');
  const [supportSearch, setSupportSearch] = useState('');
  const [kycStatusFilter, setKycStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [auditType, setAuditType] = useState<'all' | 'security' | 'kyc' | 'transaction' | 'ai' | 'system'>('all');
  const [statusLabel, setStatusLabel] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'updated'>('updated');

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined'
      ? window.localStorage.getItem('auth_token') || window.localStorage.getItem('lexigate_token')
      : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showToast = (title: string, message: string, tone: AdminToast['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setActiveToast({ id, title, message, tone });
    window.setTimeout(() => {
      setActiveToast((current) => (current?.id === id ? null : current));
    }, 4200);
  };

  const adminFetch = (url: string, init: RequestInit = {}) => {
    const headers = {
      ...getAuthHeaders(),
      ...(init.headers || {}),
    };
    return fetch(url, { ...init, headers });
  };

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const payload = await response.json();
      return payload?.error || fallback;
    } catch {
      return fallback;
    }
  };

  const confirmDeleteDoc = async () => {
    if (!docToDelete) return;
    await deleteLegalDocument(docToDelete);
    setDocToDelete(null);
  };

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [systemLogs, setSystemLogs] = useState<Array<{ id: string, time: string, level: 'info' | 'warn' | 'error', msg: string }>>([
    { id: '1', time: '14:20:01', level: 'info', msg: 'AI RAG Engine: Indexing complete for 42 documents.' },
    { id: '2', time: '14:21:45', level: 'warn', msg: 'ZainCash: Delayed response from gateway (3.2s).' }
  ]);

  const pendingCount = useMemo(
    () => kycApplications.filter((app) => app.status === 'pending').length,
    [kycApplications]
  );

  const approvedCount = useMemo(
    () => kycApplications.filter((app) => app.status === 'approved').length,
    [kycApplications]
  );

  const rejectedCount = useMemo(
    () => kycApplications.filter((app) => app.status === 'rejected').length,
    [kycApplications]
  );

  const pendingWithMissingDocs = useMemo(
    () => kycApplications.filter((app) => app.status === 'pending' && app.attachments.length < 3).length,
    [kycApplications]
  );

  const averageAttachmentCount = useMemo(
    () => (kycApplications.length ? Math.round(kycApplications.reduce((sum, app) => sum + app.attachments.length, 0) / kycApplications.length) : 0),
    [kycApplications]
  );

  const filteredModerationRules = useMemo(
    () => moderationRules.filter((rule) => rule.value.toLowerCase().includes(moderationSearch.trim().toLowerCase())),
    [moderationRules, moderationSearch]
  );

  const activeModerationCount = useMemo(
    () => moderationRules.filter((rule) => rule.active).length,
    [moderationRules]
  );

  const availableLawyers = useMemo(
    () => users.filter((item) => item.role === 'pro' || item.role === 'admin'),
    [users]
  );

  const serviceCategories = useMemo(
    () => Array.from(new Set([...legalServices.map((service) => service.category), ...legalDocs.map((doc) => doc.category)].filter(Boolean))),
    [legalDocs, legalServices]
  );

  const filteredKycApplications = useMemo(
    () => kycApplications.filter((application) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesQuery =
        !query ||
        application.name.toLowerCase().includes(query) ||
        application.city.toLowerCase().includes(query) ||
        application.license.toLowerCase().includes(query) ||
        application.attachments.some((attachment) => attachment.toLowerCase().includes(query));
      const matchesStatus = kycStatusFilter === 'all' || application.status === kycStatusFilter;
      return matchesQuery && matchesStatus;
    }),
    [kycApplications, searchTerm, kycStatusFilter]
  );

  const filteredUsers = useMemo(
    () => users.filter((userItem) => {
      const query = userSearchTerm.trim().toLowerCase();
      const matchesRole = userRoleFilter === 'all' || userItem.role === userRoleFilter;
      const matchesQuery = !query ||
        userItem.name.toLowerCase().includes(query) ||
        userItem.email.toLowerCase().includes(query) ||
        userItem.location.toLowerCase().includes(query) ||
        userItem.specialty?.toLowerCase().includes(query) ||
        userItem.licenseNumber?.toLowerCase().includes(query);
      return matchesRole && matchesQuery;
    }),
    [users, userSearchTerm, userRoleFilter]
  );

  const filteredAuditLogs = useMemo(
    () => auditLogs.filter((log) => auditType === 'all' || log.type === auditType),
    [auditLogs, auditType]
  );

  const blockedCount = useMemo(
    () => users.filter((item) => item.blocked).length,
    [users]
  );

  const escalatedTicketCount = useMemo(
    () => supportTickets.filter((ticket) => ticket.status === 'escalated').length,
    [supportTickets]
  );

  const openTicketCount = useMemo(
    () => supportTickets.filter((ticket) => ticket.status === 'open').length,
    [supportTickets]
  );

  const urgentAlerts = useMemo(
    () => alerts.filter((alert) => alert.severity === 'high'),
    [alerts]
  );

  const recentKycAudit = useMemo(
    () => auditLogs.filter((log) => log.type === 'kyc').slice(0, 4),
    [auditLogs]
  );

  const recentSupportAudit = useMemo(
    () => auditLogs.filter((log) => log.type === 'system' || log.type === 'security').slice(0, 5),
    [auditLogs]
  );

  const complianceAudit = useMemo(
    () => auditLogs.filter((log) => log.type === 'ai' || log.type === 'security' || log.type === 'system').slice(0, 5),
    [auditLogs]
  );

  const selectedUserAudit = useMemo(() => {
    if (!selectedUser) return [];
    return auditLogs
      .filter((log) => log.actor.includes(selectedUser.name) || log.message.includes(selectedUser.name))
      .slice(0, 4);
  }, [auditLogs, selectedUser]);

  const triageQueues = useMemo(
    () => [
      {
        id: 'kyc' as const,
        label: 'طلبات KYC عاجلة',
        count: pendingCount,
        detail: pendingWithMissingDocs > 0 ? `${pendingWithMissingDocs} طلبات ينقصها مستندات` : 'كل الطلبات بملفات مكتملة نسبياً',
        tone: pendingCount > 0 ? 'warning' : 'success',
        cta: 'فتح الاعتمادات',
      },
      {
        id: 'support' as const,
        label: 'تصعيدات الدعم',
        count: escalatedTicketCount,
        detail: openTicketCount > 0 ? `${openTicketCount} تذاكر ما زالت مفتوحة` : 'لا توجد تذاكر مفتوحة حالياً',
        tone: escalatedTicketCount > 0 ? 'danger' : 'success',
        cta: 'فتح التذاكر',
      },
      {
        id: 'users' as const,
        label: 'حسابات تحتاج قراراً',
        count: blockedCount + urgentAlerts.length,
        detail: blockedCount > 0 ? `${blockedCount} حسابات محظورة و${urgentAlerts.length} تنبيهات عالية` : `${urgentAlerts.length} تنبيهات عالية تحتاج تحقق`,
        tone: blockedCount + urgentAlerts.length > 0 ? 'danger' : 'info',
        cta: 'فتح المستخدمين',
      },
      {
        id: 'compliance' as const,
        label: 'امتثال وسياسات',
        count: metrics?.complianceFlags ?? 0,
        detail: `${legalDocs.length} وثائق قانونية و${activeModerationCount} قواعد مراقبة مفعلة`,
        tone: (metrics?.complianceFlags ?? 0) > 0 ? 'warning' : 'info',
        cta: 'فتح الامتثال',
      },
    ],
    [
      activeModerationCount,
      blockedCount,
      escalatedTicketCount,
      legalDocs.length,
      metrics?.complianceFlags,
      openTicketCount,
      pendingCount,
      pendingWithMissingDocs,
      urgentAlerts.length,
    ]
  );

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      return;
    }
    const current = users.find((item) => item.id === selectedUserId) || null;
    setSelectedUser(current);
  }, [selectedUserId, users]);

  const filteredTickets = useMemo(
    () => supportTickets.filter((ticket) => {
      const matchesFilter = ticketFilter === 'all' || ticket.status === ticketFilter;
      const query = supportSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.requester.toLowerCase().includes(query) ||
        ticket.priority.toLowerCase().includes(query) ||
        ticket.status.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    }),
    [supportTickets, ticketFilter, supportSearch]
  );

  const ticketStats = useMemo(
    () => ({
      open: supportTickets.filter((ticket) => ticket.status === 'open').length,
      pending: supportTickets.filter((ticket) => ticket.status === 'pending').length,
      resolved: supportTickets.filter((ticket) => ticket.status === 'resolved').length,
      escalated: supportTickets.filter((ticket) => ticket.status === 'escalated').length,
    }),
    [supportTickets]
  );

  useEffect(() => {
    async function loadData() {
      setIsLoadingDashboard(true);
      setLoadError(null);
      try {
        const [metricRes, kycRes, userRes, flagRes, ticketRes, alertRes, auditRes, txRes, policyRes, systemRes, aiRes, paymentRes, workflowRes, notificationRes, moderationRes, docsRes, servicesRes, contractRes, categoryRes, uploadRes, pageRes, roleRes, permissionRes, caseRes] = await Promise.all([
          adminFetch('/api/admin/metrics'),
          adminFetch('/api/admin/kyc'),
          adminFetch('/api/admin/users'),
          adminFetch('/api/admin/feature-flags'),
          adminFetch('/api/admin/support-tickets'),
          adminFetch('/api/admin/alerts'),
          adminFetch('/api/admin/audit-logs'),
          adminFetch('/api/admin/transactions'),
          adminFetch('/api/admin/policies'),
          adminFetch('/api/admin/system-settings'),
          adminFetch('/api/admin/ai-settings'),
          adminFetch('/api/admin/payment-gateways'),
          adminFetch('/api/admin/workflow-settings'),
          adminFetch('/api/admin/notification-templates'),
          adminFetch('/api/admin/moderation-rules'),
          adminFetch('/api/admin/legal-docs'),
          adminFetch('/api/admin/legal-services'),
          adminFetch('/api/admin/contracts'),
          adminFetch('/api/admin/categories'),
          adminFetch('/api/admin/uploads'),
          adminFetch('/api/admin/pages'),
          adminFetch('/api/admin/roles'),
          adminFetch('/api/admin/permissions'),
          adminFetch('/api/admin/cases'),
        ]);

        if (metricRes.ok) setMetrics(await metricRes.json());
        if (kycRes.ok) setKycApplications(await kycRes.json());
        if (userRes.ok) setUsers(await userRes.json());
        if (flagRes.ok) setFlags(await flagRes.json());
        if (ticketRes.ok) setSupportTickets(await ticketRes.json());
        if (alertRes.ok) setAlerts(await alertRes.json());
        if (auditRes.ok) setAuditLogs(await auditRes.json());
        if (txRes.ok) setTransactions(await txRes.json());
        if (policyRes.ok) setPolicies(await policyRes.json());
        if (systemRes.ok) setSystemSettings(await systemRes.json());
        if (aiRes.ok) setAiSettings(await aiRes.json());
        if (paymentRes.ok) setPaymentGateways(await paymentRes.json());
        if (workflowRes.ok) setWorkflowSettings(await workflowRes.json());
        if (notificationRes.ok) setNotificationTemplates(await notificationRes.json());
        if (moderationRes.ok) setModerationRules(await moderationRes.json());
        if (docsRes.ok) setLegalDocs(await docsRes.json());
        if (servicesRes.ok) setLegalServices(await servicesRes.json());
        if (contractRes.ok) {
          const res = await contractRes.json();
          setDigitalContracts(res.data || []);
        }
        if (categoryRes.ok) setCategories(await categoryRes.json());
        if (uploadRes.ok) setUploads(await uploadRes.json());
        if (pageRes.ok) setPages(await pageRes.json());
        if (roleRes.ok) setRoles(await roleRes.json());
        if (permissionRes.ok) setPermissions(await permissionRes.json());
        if (caseRes.ok) setAdminCases(await caseRes.json());
        setLastUpdatedAt(new Date());
      } catch (error) {
        console.error('Failed to load admin dashboard', error);
        setLoadError('تعذر تحميل بعض بيانات الإدارة. تحقق من الاتصال أو صلاحيات الجلسة.');
      } finally {
        setIsLoadingDashboard(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    const taxPolicy = policies.find((policy) => policy.key === 'tax_enabled');
    if (taxPolicy) {
      setTaxEnabled(taxPolicy.value === 'true');
    }
  }, [policies]);

  // Simulate live log streaming
  useEffect(() => {
    const interval = setInterval(() => {
      const newLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString('en-GB'),
        level: Math.random() > 0.8 ? 'warn' : 'info' as any,
        msg: `System Audit: Admin requested data for ${Math.floor(Math.random() * 100)} user records.`
      };
      setSystemLogs(prev => [newLog, ...prev].slice(0, 50));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // User Growth Chart Logic
  useEffect(() => {
    if (activeTab !== 'overview' || !growthChartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(growthChartRef.current, {
      type: 'line',
      data: {
        labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
        datasets: [{
          label: 'نمو المستخدمين',
          data: [400, 600, 850, 1100, 1050, 1245],
          borderColor: '#1B365D',
          backgroundColor: 'rgba(27, 54, 93, 0.05)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#C5A059'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [activeTab]);

  const toggleUserSelection = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUserIds(next);
  };

  const updateApplicationStatus = async (id: string, status: KycStatus) => {
    setStatusLabel('processing');
    const response = await adminFetch(`/api/admin/kyc/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setStatusLabel('error');
      showToast('تعذر تحديث KYC', 'لم يتم حفظ حالة طلب الاعتماد.', 'danger');
      return;
    }

    const { application } = await response.json();
    setKycApplications((prev) => prev.map((item) => (item.id === application.id ? application : item)));
    setAuditLogs((prev) => [
      {
        id: `audit-${Date.now()}`,
        type: 'kyc',
        category:
          application.status === 'approved'
            ? 'اعتماد محامي'
            : application.status === 'rejected'
              ? 'رفض محامي'
              : 'تحديث حالة KYC',
        actor: 'مدير النظام',
        message: `تم تحديث حالة طلب ${application.name} إلى ${application.status === 'pending' ? 'قيد الانتظار' : application.status === 'approved' ? 'معتمد' : 'مرفوض'}.`,
        time: 'الآن',
      },
      ...prev,
    ]);
    setStatusLabel('success');
    showToast('تم تحديث طلب الاعتماد', `تم نقل الطلب إلى حالة ${status}.`, 'success');
    window.setTimeout(() => setStatusLabel('idle'), 1400);
  };

  const downloadExport = async (type: 'kyc' | 'transactions' | 'tickets') => {
    if (type === 'tickets') {
      const rows = [`موضوع,المرسل,الأولوية,الحالة,تاريخ الإنشاء`, ...filteredTickets.map((ticket) => (
        `${ticket.subject.replace(/,/g, '،')},${ticket.requester.replace(/,/g, '،')},${ticket.priority},${ticket.status},${ticket.createdAt}`
      ))];
      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `support-tickets-export.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return;
    }

    const response = await adminFetch(`/api/admin/export?type=${type}`);
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${type}-export.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadContractsExport = () => {
    const rows = [
      'العقد,البائع,المشتري,المركبة,VIN,السعر,الحالة,تاريخ الإنشاء',
      ...digitalContracts.map((contract) => [
        contract.id,
        contract.sellerName,
        contract.buyerName,
        contract.carModel,
        contract.vinNumber,
        contract.price,
        contract.status,
        contract.createdAt,
      ].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'digital-contracts-export.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const toggleFlag = async (key: string, enabled: boolean) => {
    const response = await adminFetch(`/api/admin/feature-flags/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      showToast('تعذر إضافة التصنيف', await readApiError(response, 'لم يتم حفظ التصنيف.'), 'danger');
      return;
    }
    const flag = await response.json();
    setFlags((prev) => prev.map((item) => (item.key === flag.key ? flag : item)));
    showToast('تم تحديث الميزة', `${flag.label} ${flag.enabled ? 'مفعلة' : 'معطلة'} الآن.`, 'success');
  };

  const updateSelectedUserField = <K extends keyof UserRecord>(field: K, value: UserRecord[K]) => {
    if (!selectedUser) return;
    setSelectedUser({ ...selectedUser, [field]: value });
  };

  const saveSelectedUser = async () => {
    if (!selectedUser) return;
    setUserSaveStatus('saving');

    const response = await adminFetch(`/api/admin/users/${selectedUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedUser),
    });

    if (!response.ok) {
      setUserSaveStatus('error');
      showToast('تعذر حفظ المستخدم', 'لم يتم حفظ تعديلات ملف المستخدم.', 'danger');
      return;
    }

    const updatedUser = await response.json();
    setUsers((prev) => prev.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
    setSelectedUser(updatedUser);
    setUserSaveStatus('saved');
    showToast('تم حفظ المستخدم', 'تم تحديث بيانات الحساب بنجاح.', 'success');
    window.setTimeout(() => setUserSaveStatus('idle'), 1400);
  };

  const cycleUserRole = async (id: string) => {
    const userItem = users.find((item) => item.id === id);
    if (!userItem) return;
    setUserSaveStatus('saving');
    const nextRole = userItem.role === 'user' ? 'pro' : userItem.role === 'pro' ? 'admin' : 'user';
    try {
      const response = await adminFetch(`/api/admin/users/${id}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) throw new Error('Failed to update role');
      const updated = await response.json();
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setUserSaveStatus('saved');
      showToast('تم تغيير الدور', `أصبح دور المستخدم ${updated.role}.`, 'success');
    } catch (err) {
      console.error(err);
      setUserSaveStatus('error');
      showToast('تعذر تغيير الدور', 'لم يتم حفظ الدور الجديد.', 'danger');
    } finally {
      setTimeout(() => setUserSaveStatus('idle'), 2000);
    }
  };

  const toggleUserBlock = async (id: string) => {
    setUserSaveStatus('saving');
    try {
      const response = await adminFetch(`/api/admin/users/${id}/block`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to toggle block status');
      const updated = await response.json();
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setUserSaveStatus('saved');
      showToast(updated.blocked ? 'تم حظر المستخدم' : 'تم إلغاء الحظر', 'تم تحديث حالة الوصول للحساب.', updated.blocked ? 'warning' : 'success');
    } catch (err) {
      setUserSaveStatus('error');
      showToast('تعذر تحديث الحظر', 'لم يتم حفظ حالة الحظر.', 'danger');
    } finally {
      setTimeout(() => setUserSaveStatus('idle'), 2000);
    }
  };

  const cycleSelectedUserRoles = async () => {
    const ids = Array.from(selectedUserIds);
    for (const id of ids) {
      await cycleUserRole(id);
    }
    setSelectedUserIds(new Set());
  };

  const blockSelectedUsers = async () => {
    const ids = Array.from(selectedUserIds);
    for (const id of ids) {
      const userItem = users.find((item) => item.id === id);
      if (userItem && !userItem.blocked) {
        await toggleUserBlock(id);
      }
    }
    setSelectedUserIds(new Set());
  };

  const showKycDocuments = (application: KycApplication) => {
    if (application.attachments.length === 0) {
      setStatusLabel('error');
      showToast('لا توجد وثائق', 'هذا الطلب لا يحتوي على مرفقات قابلة للعرض.', 'warning');
      window.setTimeout(() => setStatusLabel('idle'), 1400);
      return;
    }

    application.attachments.forEach((attachment) => {
      window.open(attachment, '_blank', 'noopener,noreferrer');
    });
  };

  const openKycProfile = (application: KycApplication) => {
    const matchedUser = users.find((item) =>
      item.id === application.id ||
      item.licenseNumber === application.license ||
      item.name === application.name ||
      item.email.toLowerCase().includes(application.name.toLowerCase().replace(/\s+/g, '.'))
    );

    if (!matchedUser) {
      showToast('لا يوجد ملف مرتبط', 'لم يتم العثور على حساب مستخدم مطابق لهذا الطلب.', 'warning');
      return;
    }

    navigate(`/profile/${matchedUser.id}`, { state: { lawyer: matchedUser } });
  };

  const clearSystemCache = async () => {
    const response = await adminFetch('/api/admin/cache/clear', { method: 'POST' });
    if (!response.ok) {
      showToast('تعذر تحديث التصنيف', await readApiError(response, 'لم يتم حفظ حالة التصنيف.'), 'danger');
      return;
    }
    setSystemLogs((prev) => [
      { id: `log-${Date.now()}`, time: new Date().toLocaleTimeString('en-GB'), level: 'info', msg: 'Admin cache cleared successfully.' },
      ...prev,
    ]);
    showToast('تم تفريغ الذاكرة المؤقتة', 'تم تسجيل العملية في سجلات النظام.', 'success');
    forceSync();
  };

  const restartAiServices = async () => {
    const response = await adminFetch('/api/admin/ai/restart', { method: 'POST' });
    if (!response.ok) {
      showToast('تعذر حذف التصنيف', await readApiError(response, 'قد يكون التصنيف مرتبطاً ببيانات أخرى.'), 'danger');
      return;
    }
    setSystemLogs((prev) => [
      { id: `log-${Date.now()}`, time: new Date().toLocaleTimeString('en-GB'), level: 'warn', msg: 'AI services restart queued by admin.' },
      ...prev,
    ]);
    showToast('تم جدولة إعادة تشغيل AI', 'تم إرسال الطلب إلى سجل النظام.', 'warning');
  };

  const handleActorClick = (actorName: string) => {
    const target = users.find((u) => u.name === actorName);
    if (target) {
      setSelectedUserId(target.id);
      setActiveTab('users');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateTicketStatus = async (id: string, status: SupportTicket['status']) => {
    const response = await adminFetch(`/api/admin/support-tickets/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      showToast('تعذر إنشاء الصفحة', await readApiError(response, 'لم يتم حفظ الصفحة.'), 'danger');
      return;
    }
    const updated = await response.json();
    setSupportTickets((prev) => prev.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
    showToast('تم تحديث التذكرة', `تم نقل التذكرة إلى ${status}.`, 'success');
  };

  const updatePolicy = async (key: string, value: string) => {
    setPolicies((prev) => prev.map((policy) => (policy.key === key ? { ...policy, value } : policy)));
    const response = await adminFetch(`/api/admin/policies/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      showToast('تعذر تحديث السياسة', 'لم يتم حفظ قيمة السياسة الجديدة.', 'danger');
      return;
    }
    showToast('تم تحديث السياسة', 'تم حفظ قيمة السياسة بنجاح.', 'success');
  };

  const updateSystemSetting = async (settings: Partial<SystemSettings>) => {
    const response = await adminFetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      showToast('تعذر تحديث الصفحة', await readApiError(response, 'لم يتم حفظ حالة الصفحة.'), 'danger');
      return;
    }
    const updated = await response.json();
    setSystemSettings(updated);
    showToast('تم تحديث النظام', 'تم حفظ إعدادات النظام.', 'success');
  };

  const updateAiSetting = async (settings: Partial<AiSettings>) => {
    const response = await adminFetch('/api/admin/ai-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      showToast('تعذر إضافة القسم', await readApiError(response, 'لم يتم حفظ قسم المحتوى.'), 'danger');
      return;
    }
    const updated = await response.json();
    setAiSettings(updated);
    showToast('تم تحديث AI', 'تم حفظ إعدادات الذكاء الاصطناعي.', 'success');
  };

  const updatePaymentGatewayItem = async (key: string, enabled: boolean, feePercent?: number) => {
    const response = await adminFetch(`/api/admin/payment-gateways/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, feePercent }),
    });
    if (!response.ok) {
      showToast('تعذر حذف الصفحة', await readApiError(response, 'لم يتم حذف الصفحة.'), 'danger');
      return;
    }
    const updated = await response.json();
    setPaymentGateways((prev) => prev.map((gateway) => (gateway.key === updated.key ? updated : gateway)));
    showToast('تم تحديث بوابة الدفع', 'تم حفظ إعدادات بوابة الدفع.', 'success');
  };

  const updateWorkflowSettingsHandler = async (settings: Partial<WorkflowSettings>) => {
    const response = await adminFetch('/api/admin/workflow-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      showToast('تعذر تحديث القضية', await readApiError(response, 'لم يتم حفظ مسار القضية.'), 'danger');
      return;
    }
    const updated = await response.json();
    setWorkflowSettings(updated);
    showToast('تم تحديث سير العمل', 'تم حفظ إعدادات القضايا والتوقيع.', 'success');
  };

  const updateNotificationTemplate = async (key: string, partial: Partial<NotificationTemplate>) => {
    const response = await adminFetch(`/api/admin/notification-templates/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!response.ok) {
      showToast('تعذر إضافة المحطة', await readApiError(response, 'لم يتم حفظ الجدول الزمني.'), 'danger');
      return;
    }
    const updated = await response.json();
    setNotificationTemplates((prev) => prev.map((template) => (template.key === updated.key ? updated : template)));
    showToast('تم تحديث قالب الإشعار', 'تم حفظ قالب الإشعار.', 'success');
  };

  const toggleModerationRule = async (id: string, active: boolean) => {
    const response = await adminFetch(`/api/admin/moderation-rules/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!response.ok) {
      showToast('تعذر حذف الملف', await readApiError(response, 'لم يتم حذف سجل الرفع.'), 'danger');
      return;
    }
    const updated = await response.json();
    setModerationRules((prev) => prev.map((rule) => (rule.id === updated.id ? updated : rule)));
    showToast('تم تحديث قاعدة المراقبة', `القاعدة ${updated.active ? 'مفعلة' : 'معطلة'} الآن.`, 'success');
  };

  const addModerationRule = async () => {
    const value = newBannedWord.trim();
    if (!value) return;
    const response = await adminFetch('/api/admin/moderation-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newModerationType, value, active: true }),
    });
    if (!response.ok) return;
    const created = await response.json();
    setModerationRules((prev) => [created, ...prev]);
    setNewBannedWord('');
    showToast('تمت إضافة قاعدة مراقبة', 'أصبحت القاعدة مفعلة ضمن الامتثال.', 'success');
  };

  const deleteModerationRule = async (id: string) => {
    const response = await adminFetch(`/api/admin/moderation-rules/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setModerationRules((prev) => prev.filter((rule) => rule.id !== id));
    showToast('تم حذف القاعدة', 'تمت إزالة قاعدة المراقبة من النظام.', 'warning');
  };

  const addLegalDocument = async () => {
    if (!newDoc.title || !newDoc.law || !newDoc.article || !newDoc.category || !newDoc.summary || !newDoc.source) {
      return;
    }
    const response = await adminFetch('/api/admin/legal-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDoc),
    });
    if (!response.ok) return;
    const created = await response.json();
    setLegalDocs((prev) => [created, ...prev]);
    setNewDoc({ title: '', law: '', article: '', category: '', summary: '', source: '' });
    showToast('تمت إضافة المرجع القانوني', 'أصبح المرجع متاحاً ضمن مصادر الامتثال.', 'success');
  };

  const deleteLegalDocument = async (id: string) => {
    const response = await adminFetch(`/api/admin/legal-docs/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setLegalDocs((prev) => prev.filter((doc) => doc.id !== id));
    showToast('تم حذف المرجع', 'تمت إزالة المرجع القانوني.', 'warning');
  };

  const addLegalService = async () => {
    if (!newService.title || !newService.description || !newService.price || !newService.time || !newService.category || !newService.lawyerId) {
      return;
    }

    const response = await adminFetch('/api/admin/legal-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(newService),
    });

    if (!response.ok) return;
    const created = await response.json();
    setLegalServices((prev) => [created, ...prev]);
    setNewService({
      title: '',
      description: '',
      price: '',
      time: '',
      category: '',
      lawyerId: '',
      icon: 'fa-solid fa-scale-balanced',
      color: 'blue',
    });
    showToast('تم نشر الخدمة', 'ستظهر الخدمة ضمن الخدمات القانونية المتاحة.', 'success');
  };

  const deleteLegalService = async (id: string) => {
    const response = await adminFetch(`/api/admin/legal-services/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setLegalServices((prev) => prev.filter((service) => service.id !== id));
    showToast('تم حذف الخدمة', 'تمت إزالة الخدمة القانونية من الواجهة.', 'warning');
  };

  const addAdminCategory = async () => {
    if (!newCategory.name?.trim()) return;
    const response = await adminFetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCategory),
    });
    if (!response.ok) return;
    const category = await response.json();
    setCategories((prev) => [category, ...prev]);
    setNewCategory({ type: 'case', name: '', description: '', icon: 'fa-folder', color: '#1B365D' });
    showToast('تمت إضافة التصنيف', 'أصبح التصنيف متاحاً للإسناد والتنظيم.', 'success');
  };

  const toggleAdminCategory = async (category: CategoryRecord) => {
    const response = await adminFetch(`/api/admin/categories/${category.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !category.active }),
    });
    if (!response.ok) return;
    const updated = await response.json();
    setCategories((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const removeAdminCategory = async (id: string) => {
    const response = await adminFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setCategories((prev) => prev.filter((category) => category.id !== id));
    showToast('تم حذف التصنيف', 'تمت إزالة التصنيف من لوحة الإدارة.', 'warning');
  };

  const addAdminPage = async () => {
    if (!newPage.title?.trim()) return;
    const slug = (newPage.slug || newPage.title || '').trim().replace(/\s+/g, '-').toLowerCase();
    const route = newPage.route?.trim() || `/${slug}`;
    const response = await adminFetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPage, slug, route }),
    });
    if (!response.ok) return;
    const page = await response.json();
    setPages((prev) => [page, ...prev]);
    setNewPage({ title: '', slug: '', route: '', status: 'draft' });
    showToast('تم إنشاء الصفحة', 'يمكنك الآن إضافة محتوى الصفحة وتفعيلها.', 'success');
  };

  const updateAdminPageStatus = async (page: PageRecord, status: string) => {
    const response = await adminFetch(`/api/admin/pages/${page.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return;
    const updated = await response.json();
    setPages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const addPageContentBlock = async (page: PageRecord) => {
    const response = await adminFetch(`/api/admin/pages/${page.id}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: `block-${(page.blocks?.length || 0) + 1}`,
        type: 'text',
        title: 'قسم جديد',
        body: '',
        sortOrder: page.blocks?.length || 0,
        active: true,
      }),
    });
    if (!response.ok) return;
    const block = await response.json();
    setPages((prev) => prev.map((item) => (
      item.id === page.id ? { ...item, blocks: [...(item.blocks || []), block] } : item
    )));
  };

  const removeAdminPage = async (id: string) => {
    const response = await adminFetch(`/api/admin/pages/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setPages((prev) => prev.filter((page) => page.id !== id));
  };

  const updateAdminCase = async (id: string, payload: Partial<AdminCaseRecord>) => {
    const response = await adminFetch(`/api/admin/cases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    const updated = await response.json();
    setAdminCases((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    showToast('تم تحديث القضية', 'تم حفظ التغيير في مسار القضية.', 'success');
  };

  const addAdminTimelineEntry = async (caseId: string) => {
    const draft = timelineDrafts[caseId];
    if (!draft?.title?.trim()) return;
    const response = await adminFetch(`/api/admin/cases/${caseId}/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateLabel: 'اليوم', title: draft.title, detail: draft.detail, type: draft.type || 'system' }),
    });
    if (!response.ok) return;
    const entry = await response.json();
    setAdminCases((prev) => prev.map((item) => (
      item.id === caseId ? { ...item, timelineEntries: [...(item.timelineEntries || []), entry] } : item
    )));
    setTimelineDrafts((prev) => ({ ...prev, [caseId]: { title: '', detail: '', type: 'system' } }));
  };

  const removeUpload = async (id: string) => {
    const response = await adminFetch(`/api/admin/uploads/${id}`, { method: 'DELETE' });
    if (!response.ok) return;
    setUploads((prev) => prev.filter((upload) => upload.id !== id));
  };

  const toggleRolePermission = async (role: RoleRecord, permissionKey: string) => {
    const current = new Set(role.permissions || []);
    if (current.has(permissionKey)) current.delete(permissionKey);
    else current.add(permissionKey);
    const permissionsPayload = Array.from(current);
    const response = await adminFetch(`/api/admin/roles/${role.id}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: permissionsPayload }),
    });
    if (!response.ok) {
      showToast('تعذر تحديث الصلاحيات', await readApiError(response, 'لم يتم حفظ صلاحيات الدور.'), 'danger');
      return;
    }
    setRoles((prev) => prev.map((item) => (item.id === role.id ? { ...item, permissions: permissionsPayload } : item)));
  };

  const addAdminRole = async () => {
    if (!newRole.key?.trim() || !newRole.label?.trim()) {
      showToast('بيانات الدور ناقصة', 'أدخل مفتاح الدور واسمه قبل الحفظ.', 'warning');
      return;
    }
    const response = await adminFetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRole),
    });
    if (!response.ok) {
      showToast('تعذر إنشاء الدور', await readApiError(response, 'لم يتم حفظ الدور الجديد.'), 'danger');
      return;
    }
    const role = await response.json();
    setRoles((prev) => [...prev, { ...role, permissions: [] }]);
    setNewRole({ key: '', label: '', description: '' });
    showToast('تم إنشاء الدور', 'يمكنك الآن اختيار الصلاحيات المناسبة له.', 'success');
  };

  const updateAdminRole = async (role: RoleRecord, partial: Partial<RoleRecord>) => {
    const response = await adminFetch(`/api/admin/roles/${role.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!response.ok) {
      showToast('تعذر تحديث الدور', await readApiError(response, 'لم يتم حفظ تعديل الدور.'), 'danger');
      return;
    }
    const updated = await response.json();
    setRoles((prev) => prev.map((item) => (item.id === role.id ? { ...item, ...updated } : item)));
  };

  const removeAdminRole = async (role: RoleRecord) => {
    if (role.system) {
      showToast('دور نظامي', 'لا يمكن حذف الأدوار النظامية.', 'warning');
      return;
    }
    const response = await adminFetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
    if (!response.ok) {
      showToast('تعذر حذف الدور', await readApiError(response, 'لم يتم حذف الدور.'), 'danger');
      return;
    }
    setRoles((prev) => prev.filter((item) => item.id !== role.id));
    showToast('تم حذف الدور', 'تمت إزالة الدور وصلاحياته.', 'warning');
  };

  const forceSync = () => {
    setSyncStatus('syncing');
    window.setTimeout(() => {
      setSyncStatus('updated');
      setLastUpdatedAt(new Date());
      showToast('تمت المزامنة', 'تم تحديث حالة لوحة الإدارة.', 'success');
    }, 1200);
  };

  const adminTabs: Array<{
    id: AdminTab;
    label: string;
    icon: string;
    description: string;
    count?: number;
    adminOnly?: boolean;
  }> = [
      { id: 'overview', label: 'المركز', icon: 'fa-grid-2', description: 'أولويات اليوم', count: pendingCount + escalatedTicketCount + urgentAlerts.length },
      { id: 'users', label: 'الحسابات', icon: 'fa-users', description: 'أدوار وحظر', count: blockedCount },
      { id: 'cases', label: 'القضايا', icon: 'fa-briefcase', description: 'مسار وقرارات', count: adminCases.filter((item) => item.status !== 'closed').length, adminOnly: true },
      { id: 'resources', label: 'المحتوى', icon: 'fa-layer-group', description: 'تصنيفات وصفحات', count: categories.length + pages.length + uploads.length, adminOnly: true },
      { id: 'roles', label: 'الصلاحيات', icon: 'fa-user-shield', description: 'أدوار وحقوق', count: roles.length, adminOnly: true },
      { id: 'financials', label: 'الأموال', icon: 'fa-money-bill-transfer', description: 'سيولة ودفعات', count: transactions.length, adminOnly: true },
      { id: 'contracts', label: 'العقود', icon: 'fa-file-contract', description: 'توقيع وتحقق', count: digitalContracts.filter((contract) => contract.status !== 'signed' && contract.status !== 'verified').length },
      { id: 'kyc', label: 'الاعتماد', icon: 'fa-id-card', description: 'محامون جدد', count: pendingCount },
      { id: 'support', label: 'الدعم', icon: 'fa-life-ring', description: 'تذاكر وتصعيد', count: escalatedTicketCount || openTicketCount },
      { id: 'settings', label: 'الضبط', icon: 'fa-sliders', description: 'AI وسياسات', count: flags.filter((flag) => flag.enabled).length, adminOnly: true },
      { id: 'compliance', label: 'الحوكمة', icon: 'fa-shield-halved', description: 'قواعد ومراجع', count: (metrics?.complianceFlags ?? 0) + activeModerationCount, adminOnly: true },
      { id: 'system', label: 'الصحة', icon: 'fa-server', description: 'خوادم وسجلات', count: systemLogs.filter((log) => log.level === 'warn' || log.level === 'error').length, adminOnly: true }
    ];

  const adminSavedViews = [
    {
      id: 'kyc',
      label: 'طابور الاعتماد',
      note: 'طلبات المحامين المعلقة',
      count: pendingCount,
      icon: 'fa-id-card',
      action: () => {
        setActiveTab('kyc');
        setKycStatusFilter('pending');
      },
    },
    {
      id: 'support',
      label: 'التصعيدات',
      note: 'الدعم عالي الأولوية',
      count: escalatedTicketCount,
      icon: 'fa-life-ring',
      action: () => {
        setActiveTab('support');
        setTicketFilter('escalated');
      },
    },
    {
      id: 'financials',
      label: 'المعاملات',
      note: 'السيولة والتقارير',
      count: transactions.length,
      icon: 'fa-money-bill-transfer',
      action: () => setActiveTab('financials'),
    },
    {
      id: 'compliance',
      label: 'الامتثال',
      note: 'القواعد والمراجع',
      count: metrics?.complianceFlags ?? 0,
      icon: 'fa-shield-halved',
      action: () => setActiveTab('compliance'),
    },
  ];

  useEffect(() => {
    if (!isAdmin && (activeTab === 'settings' || activeTab === 'compliance' || activeTab === 'cases' || activeTab === 'resources' || activeTab === 'roles')) {
      setActiveTab('overview');
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (user && !isAdmin) {
      window.location.assign('/user');
    }
  }, [user, isAdmin]);

  const decodeVin = (vin: string) => {
    if (!vin || vin.length !== 17) return { origin: 'غير صالح', year: '-' };
    const countryMap: Record<string, string> = {
      'J': 'اليابان', '1': 'أمريكا', '2': 'كندا', '3': 'المكسيك',
      'K': 'كوريا', 'W': 'ألمانيا', 'S': 'بريطانيا', 'L': 'الصين'
    };
    const yearMap: Record<string, string> = {
      'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024', 'S': '2025'
    };
    return { origin: countryMap[vin[0]] || 'دولي', year: yearMap[vin[9]] || 'غير محدد' };
  };

  const renderContractsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-brand-navy p-5 text-white">
          <p className="text-[10px] font-black uppercase text-blue-200/60">إجمالي العقود</p>
          <p className="mt-2 text-2xl font-black">{digitalContracts.length}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 border border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">موقعة ومكتملة</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{digitalContracts.filter(c => c.status === 'signed').length}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 border border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">بانتظار المشتري</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{digitalContracts.filter(c => c.status === 'waiting_buyer').length}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 border border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">مسودات</p>
          <p className="mt-2 text-2xl font-black text-slate-500">{digitalContracts.filter(c => c.status === 'draft').length}</p>
        </div>
      </div>

      <section className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h4 className="font-black text-brand-dark">سجل العقود الرقمية</h4>
          <div className="flex gap-2">
            <button onClick={downloadContractsExport} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-[10px] font-black hover:bg-slate-50">تصدير CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">المركبة والمعرّف</th>
                <th className="px-6 py-4">الأطراف (بائع/مشتري)</th>
                <th className="px-6 py-4">القيمة</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">تاريخ الإصدار</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {digitalContracts.map(contract => (
                <tr key={contract.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-black text-brand-dark">{contract.carModel}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">VIN: {contract.vinNumber}</p>
                      {contract.vinNumber && contract.vinNumber !== 'غير متوفر' && (
                        <div className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 group/vin relative cursor-help">
                          <i className="fa-solid fa-microchip text-[8px] text-emerald-500"></i>
                          <span className="text-[8px] font-black text-emerald-600 uppercase">Automated Check</span>
                          <div className="absolute bottom-full right-0 mb-2 w-40 p-3 bg-brand-dark text-white text-[10px] rounded-2xl opacity-0 group-hover/vin:opacity-100 transition-all z-50 shadow-2xl pointer-events-none text-right border border-white/10">
                            <p className="font-black border-b border-white/10 pb-1.5 mb-2 text-brand-gold">تحليل الشاصي آلياً:</p>
                            <p className="mb-1">المنشأ: <span className="text-blue-300">{decodeVin(contract.vinNumber).origin}</span></p>
                            <p>سنة الصنع: <span className="text-blue-300">{decodeVin(contract.vinNumber).year}</span></p>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">ID: {contract.id.substring(0, 8)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-600">ب: {contract.sellerName}</p>
                    <p className="text-xs font-bold text-slate-600 mt-1">م: {contract.buyerName}</p>
                  </td>
                  <td className="px-6 py-4 font-black text-brand-navy">{contract.price} د.ع</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${contract.status === 'signed' ? 'bg-emerald-50 text-emerald-600' : contract.status === 'waiting_buyer' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      {contract.status === 'signed' ? 'موقع نهائياً' : contract.status === 'waiting_buyer' ? 'بانتظار المشتري' : 'مسودة قيد الإعداد'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">{new Date(contract.createdAt).toLocaleDateString('ar-IQ')}</td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex justify-end gap-2">
                      {(contract.reviewNotes?.length ?? 0) > 0 && (
                        <button onClick={() => setSelectedReviewContract(contract)} className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition shadow-sm" title="عرض سجل المراجعة">
                          <i className="fa-solid fa-clipboard-check text-xs"></i>
                        </button>
                      )}
                      <button onClick={() => navigate(`/verify/${contract.id}`)} className="h-8 w-8 rounded-lg bg-slate-100 text-brand-navy hover:bg-brand-navy hover:text-white transition shadow-sm" title="معاينة العقد"><i className="fa-solid fa-eye text-xs"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="app-view w-full max-w-full overflow-x-hidden text-right space-y-6">
      {isLoadingDashboard && (
        <div className="rounded-3xl border border-brand-navy/10 bg-white/85 p-4 text-sm font-bold text-brand-navy shadow-sm">
          <i className="fa-solid fa-circle-notch ml-2 animate-spin text-brand-gold"></i>
          جارٍ تحميل بيانات الإدارة والقياسات التشغيلية...
        </div>
      )}
      {loadError && (
        <NoticePanel
          tone="warning"
          title="تعذر تحميل كامل البيانات"
          description={loadError}
          action={<ActionButton variant="secondary" size="sm" onClick={() => window.location.reload()}>إعادة المحاولة</ActionButton>}
        />
      )}
      <NoticePanel
        title="الخطوة التالية"
        description={`ابدأ بمراجعة ${pendingCount} طلب KYC ${pendingCount > 0 ? 'معلّق' : 'ثم انتقل إلى'} التنبيهات الحرجة وسجلات الدعم للحفاظ على استقرار التشغيل.`}
        action={
          <ActionButton variant="primary" size="sm" onClick={() => setActiveTab(pendingCount > 0 ? 'kyc' : 'support')}>
            {pendingCount > 0 ? 'فتح KYC' : 'فتح الدعم'}
          </ActionButton>
        }
      />
      <section className="overflow-hidden rounded-[32px] border border-brand-navy/10 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#eef4fb_100%)] shadow-premium">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex items-center rounded-full border border-brand-gold/20 bg-white/80 px-3 py-1 text-xs font-black text-brand-navy">
                <i className="fa-solid fa-server ml-2"></i>
                مركز الإدارة
              </div>
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500"></span>
                {syncStatus === 'syncing' ? 'مزامنة جارية' : 'محدث'}
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 shadow-sm">
                <i className="fa-solid fa-clock text-brand-gold text-xs"></i>
                <span className="text-[10px] font-black text-slate-500">
                  آخر تحديث {lastUpdatedAt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <h2 className="mt-4 text-3xl font-black leading-tight text-brand-dark">مركز الإدارة التشغيلي</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-600">
              مساحة قيادة يومية لإدارة الاعتمادات، المستخدمين، الدعم، الأموال، والامتثال من نقطة واحدة واضحة.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'مستخدمون', value: metrics?.activeUsers, icon: 'fa-users', color: 'text-brand-navy', tab: 'users' as AdminTab },
                { label: 'تصعيدات', value: metrics?.openEscalations, icon: 'fa-triangle-exclamation', color: 'text-red-600', tab: 'support' as AdminTab },
                { label: 'KYC', value: pendingCount, icon: 'fa-id-card', color: 'text-amber-700', tab: 'kyc' as AdminTab },
                { label: 'تنبيهات', value: metrics?.suspiciousEvents, icon: 'fa-shield-halved', color: 'text-brand-dark', tab: 'compliance' as AdminTab },
              ].map((stat) => (
                <button
                  key={stat.label}
                  type="button"
                  onClick={() => setActiveTab(stat.tab)}
                  className="rounded-2xl border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-brand-navy/20 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 ${stat.color}`}>
                      <i className={`fa-solid ${stat.icon}`}></i>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                  </div>
                  <p className={`mt-3 text-2xl font-black ${stat.color}`}>{stat.value ?? '...'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-brand-navy/10 bg-brand-navy p-5 text-white xl:border-r xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">Admin Focus</p>
                <h3 className="mt-2 text-xl font-black">قرار المنصة الآن</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-gold">
                <i className="fa-solid fa-compass-drafting"></i>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-sm font-black text-white">
                {pendingCount > 0 ? 'اعتماد المحامين أولاً' : escalatedTicketCount > 0 ? 'راجع تصعيدات الدعم' : 'راجع صحة النظام'}
              </p>
              <p className="mt-2 text-xs font-bold leading-6 text-white/70">
                {pendingCount > 0
                  ? `${pendingCount} طلبات KYC تنتظر قراراً.`
                  : escalatedTicketCount > 0
                    ? `${escalatedTicketCount} تذاكر مصعدة تحتاج متابعة.`
                    : 'لا توجد أولوية حرجة ظاهرة حالياً.'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab(pendingCount > 0 ? 'kyc' : escalatedTicketCount > 0 ? 'support' : 'system')}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-brand-navy"
                >
                  فتح الأولوية
                </button>
                <button
                  type="button"
                  onClick={forceSync}
                  className="rounded-xl border border-white/20 px-3 py-2 text-xs font-black text-white"
                >
                  مزامنة
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="px-2">
            <h3 className="text-sm font-black text-brand-dark">عروض الإدارة السريعة</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">اختصر الوصول إلى أكثر الطوابير حساسية في التشغيل اليومي.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {adminSavedViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={view.action}
                className={`rounded-2xl border px-4 py-3 text-right transition ${activeTab === view.id ? 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/15' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy/30 hover:bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${view.icon} text-xs`}></i>
                  <p className="text-sm font-black">{view.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${activeTab === view.id ? 'bg-white/10 text-white' : 'bg-white text-brand-navy'}`}>{view.count}</span>
                </div>
                <p className={`mt-1 text-[10px] font-bold ${activeTab === view.id ? 'text-white/70' : 'text-slate-400'}`}>{view.note}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-[2.5rem] border border-gray-200 bg-white p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">لوحة الإدارة</p>
              <h3 className="mt-2 text-3xl font-black text-brand-dark">التحكم التشغيلي الكامل</h3>
              <p className="mt-2 max-w-2xl text-sm font-bold text-slate-500">
                كل تبويب يحتفظ بحالته الداخلية أثناء التنقل لتسهيل مراجعة السجلات، المستخدمين، والإعدادات في جلسات العمل الطويلة.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                type="button"
                onClick={forceSync}
                variant="secondary"
              >
                <i className="fa-solid fa-rotate ml-2"></i>
                {syncStatus === 'syncing' ? 'جاري المزامنة...' : 'مزامنة الآن'}
              </ActionButton>
              <ActionButton
                type="button"
                onClick={() => window.location.reload()}
                variant="primary"
              >
                <i className="fa-solid fa-arrows-rotate ml-2"></i>
                تحديث الواجهة
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-brand-dark">إشارات حرجة</h3>
              <p className="text-sm text-gray-500">نقاط تحتاج انتباهاً فورياً.</p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600">{alerts.length} تنبيه</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              { label: 'الوثائق المتزامنة', value: metrics?.docsSynced },
              { label: 'علامات الامتثال', value: metrics?.complianceFlags },
              { label: 'حالة المزامنة', value: syncStatus === 'syncing' ? 'جارية' : 'محدثة' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase text-slate-400">{item.label}</p>
                <p className="text-lg font-black text-brand-dark">{item.value ?? '...'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sticky top-20 z-20 w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-2 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.65)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="hidden shrink-0 items-center gap-2 px-3 text-right xl:flex">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-navy text-brand-gold shadow-sm">
              <i className="fa-solid fa-sliders text-sm"></i>
            </div>
            <div>
              <p className="text-xs font-black text-brand-dark">أقسام الإدارة</p>
              <p className="mt-0.5 text-[10px] font-bold text-slate-400">تنقل سريع</p>
            </div>
          </div>
          <div
            role="tablist"
            aria-label="Admin dashboard sections"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-[1.55rem] bg-slate-50/90 p-1 shadow-inner no-scrollbar"
          >
          {adminTabs
            .filter((tab) => !tab.adminOnly || isAdmin)
            .map((tab) => (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`admin-panel-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex min-w-[132px] items-center gap-2 rounded-[1.25rem] border px-3 py-3 text-right transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 sm:min-w-[148px] ${activeTab === tab.id ? 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/20' : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-brand-navy'}`}
              >
                {activeTab === tab.id && (
                  <motion.span
                    layoutId="admin-tab-glow"
                    className="absolute inset-x-3 -bottom-1 h-1 rounded-t-full bg-brand-gold"
                  />
                )}
                <div className="relative z-10 flex min-w-0 items-center gap-2">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${activeTab === tab.id ? 'bg-white/15 text-brand-gold' : 'bg-white text-slate-400 shadow-sm group-hover:text-brand-navy'}`}>
                    <i className={`fa-solid ${tab.icon} text-sm`}></i>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black whitespace-nowrap">{tab.label}</p>
                      {typeof tab.count === 'number' && (
                        <span
                          title={`${tab.count.toLocaleString('ar-IQ')} عنصر يحتاج متابعة`}
                          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[9px] font-black ${activeTab === tab.id ? 'bg-brand-gold text-brand-dark' : tab.count > 0 ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                        >
                          {tab.count > 99 ? '+99' : tab.count}
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 hidden max-w-[105px] truncate text-[10px] font-bold sm:block ${activeTab === tab.id ? 'text-white/70' : 'text-slate-400'}`}>{tab.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="hidden shrink-0 items-center gap-2 px-2 xl:flex">
            <button
              type="button"
              onClick={forceSync}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-brand-navy/30 hover:text-brand-navy"
              title="مزامنة الآن"
            >
              <i className={`fa-solid fa-rotate text-xs ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}></i>
            </button>
            <span className={`rounded-full px-3 py-2 text-[10px] font-black ${syncStatus === 'syncing' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {syncStatus === 'syncing' ? 'مزامنة' : 'محدث'}
            </span>
          </div>
        </div>
      </section>

      <section
        id={`admin-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`admin-tab-${activeTab}`}
        className="rounded-3xl border border-gray-200 bg-white p-5 shadow-premium overflow-hidden"
      >
        <div className="mb-6 flex flex-col gap-3 border-b border-gray-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-3xl font-black text-brand-dark">{adminTabs.find((tab) => tab.id === activeTab)?.label}</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">
              {adminTabs.find((tab) => tab.id === activeTab)?.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest">
            <span className="rounded-full bg-slate-50 px-4 py-2 text-slate-500 border border-slate-100">مدير النظام</span>
            <span className="rounded-full bg-slate-50 px-4 py-2 text-slate-500 border border-slate-100">{filteredTickets.length} تذكرة</span>
            <span className="rounded-full bg-slate-50 px-4 py-2 text-red-600 border border-red-50">{blockedCount} محظور</span>
          </div>
        </div>

        <div className="space-y-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <section className="rounded-[2.5rem] border border-slate-200 bg-slate-50/70 p-6">
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-brand-dark">مركز الفرز اليومي</p>
                    <p className="text-xs font-bold text-slate-500">ابدأ بالقرارات الحرجة ثم انتقل إلى مؤشرات الصحة العامة.</p>
                  </div>
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-black text-red-700">
                    {pendingCount + escalatedTicketCount + urgentAlerts.length} عناصر تحتاج قراراً
                  </span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {triageQueues.map((queue) => (
                    <button
                      key={queue.label}
                      type="button"
                      onClick={() => setActiveTab(queue.id)}
                      className="rounded-[2rem] border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:border-brand-navy/20 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-brand-dark">{queue.label}</p>
                          <p className="mt-2 text-xs font-bold leading-6 text-slate-500">{queue.detail}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${queue.tone === 'danger'
                          ? 'bg-red-50 text-red-700'
                          : queue.tone === 'warning'
                            ? 'bg-amber-50 text-amber-700'
                            : queue.tone === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                          {queue.count}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-xs font-black text-brand-navy">{queue.cta}</span>
                        <i className="fa-solid fa-arrow-left text-xs text-slate-400"></i>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <section className="rounded-[2.5rem] border border-slate-200 bg-slate-50/50 p-6">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-brand-dark">صحة التشغيل</p>
                      <p className="text-xs font-bold text-slate-500">مؤشرات مستقرة وسريعة للمراجعة اليومية.</p>
                    </div>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">تشغيل مستقر</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { label: 'المستخدمون النشطون', value: metrics?.activeUsers },
                      { label: 'المعاملات اليوم', value: metrics ? formatCurrency(metrics.dailyVolume) : '...' },
                      { label: 'متوسط زمن الاستجابة', value: metrics?.avgResponseTimeMs ? `${metrics.avgResponseTimeMs} ms` : '...' },
                      { label: 'قواعد الامتثال', value: metrics?.complianceFlags },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                        <p className="mt-3 text-3xl font-black text-brand-dark">{item.value ?? '...'}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-widest text-brand-dark">اتجاه نمو المنصة</p>
                      <span className="text-[10px] font-bold text-slate-400">آخر 6 أشهر</span>
                    </div>
                    <div className="h-56 w-full"><canvas ref={growthChartRef}></canvas></div>
                  </div>
                </section>

                <section className="space-y-4 rounded-[2.5rem] border border-slate-200 bg-slate-50/50 p-6">
                  <div>
                    <p className="text-sm font-black text-brand-dark">أثر تدقيقي قريب من القرار</p>
                    <p className="text-xs font-bold text-slate-500">آخر السجلات المرتبطة بالمراجعات، الدعم، والأمن.</p>
                  </div>
                  {recentSupportAudit.length === 0 ? (
                    <EmptyState icon="clock-rotate-left" title="لا توجد سجلات حديثة" description="ستظهر هنا أحدث الإشارات التشغيلية." />
                  ) : (
                    recentSupportAudit.map((entry) => (
                      <div key={entry.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-brand-dark">{entry.category}</p>
                            <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{entry.message}</p>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400">{entry.time}</span>
                        </div>
                        <button
                          onClick={() => handleActorClick(entry.actor)}
                          className={`mt-2 text-[11px] font-bold text-right transition-colors ${users.some((u) => u.name === entry.actor)
                            ? 'text-brand-navy hover:underline cursor-pointer'
                            : 'text-slate-400 cursor-default'
                            }`}
                        >
                          {entry.actor}
                        </button>
                      </div>
                    ))
                  )}
                </section>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[2.5rem] bg-slate-50/50 p-6 border border-slate-100 shadow-inner max-h-[760px] overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h4 className="text-xl font-black text-brand-dark">إدارة الحسابات</h4>
                    <p className="text-sm font-bold text-slate-500">تحكم في كل المحامين والعملاء من مكان واحد.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input
                        type="search"
                        value={userSearchTerm}
                        onChange={(event) => setUserSearchTerm(event.target.value)}
                        placeholder="ابحث باسم أو بريد..."
                        className="w-full rounded-2xl border border-slate-200 pl-10 pr-4 py-3 text-sm font-bold text-slate-700 focus:border-brand-navy outline-none"
                      />
                    </div>
                    <select
                      value={userRoleFilter}
                      onChange={(event) => setUserRoleFilter(event.target.value as any)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 focus:border-brand-navy outline-none"
                    >
                      <option value="all">كل الأدوار</option>
                      <option value="user">عميل</option>
                      <option value="pro">محامي</option>
                      <option value="admin">مدير</option>
                    </select>
                  </div>
                </div>

                {selectedUserIds.size > 0 && (
                  <div className="mb-4 flex items-center justify-between rounded-2xl bg-brand-navy p-4 text-white">
                    <p className="text-xs font-black">تم اختيار {selectedUserIds.size} مستخدم</p>
                    <div className="flex gap-2">
                      <button onClick={cycleSelectedUserRoles} className="rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-black hover:bg-white/20 transition">تغيير الدور</button>
                      <button onClick={blockSelectedUsers} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-black text-red-200 hover:bg-red-500/40 transition">حظر الكل</button>
                      <button onClick={() => setSelectedUserIds(new Set())} className="text-[10px] font-bold text-white/60 hover:text-white">إلغاء</button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 mt-4">
                  {filteredUsers.length === 0 ? (
                    <EmptyState icon="users" title="لا توجد نتائج للمستخدمين" description="لا توجد مستخدمين يطابقون الفلتر الحالي." />
                  ) : (
                    filteredUsers.map((userItem) => (
                      <button
                        key={userItem.id}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('.check-area')) return;
                          setSelectedUserId(userItem.id);
                        }}
                        className={`w-full rounded-[2rem] border p-5 text-right transition group ${selectedUserId === userItem.id ? 'border-brand-navy bg-white shadow-lg' : 'border-slate-100 bg-white/50 hover:bg-white hover:border-slate-200'}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="check-area flex items-center gap-3">
                            <input type="checkbox" checked={selectedUserIds.has(userItem.id)} onChange={() => toggleUserSelection(userItem.id)} className="h-4 w-4 rounded accent-brand-navy" />
                          </div>
                          <div className="text-right">
                            <p className={`text-base font-black ${selectedUserId === userItem.id ? 'text-brand-navy' : 'text-brand-dark'}`}>{userItem.name}</p>
                            <p className="text-[11px] font-bold text-slate-400 mt-1">{userItem.email}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${userItem.role === 'pro' ? 'bg-blue-50 text-blue-700' : userItem.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                            {userItem.role}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span className="rounded-md bg-slate-50 px-2 py-1">{userItem.location}</span>
                          {userItem.specialty && <span className="rounded-md bg-slate-50 px-2 py-1">{userItem.specialty}</span>}
                          <span className={`rounded-md px-2 py-1 ${userItem.licenseStatus === 'verified' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{userItem.licenseStatus === 'verified' ? 'موثق' : 'مراجعة'}</span>
                          {userItem.blocked && <span className="rounded-md bg-red-50 text-red-600">محظور</span>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[2.5rem] bg-slate-50/50 p-6 border border-slate-100 shadow-inner min-h-[760px]">
                {!selectedUser ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                    <p className="text-lg font-semibold">اختر مستخدماً من القائمة للتعديل.</p>
                    <p className="text-sm mt-2">يمكنك تعديل البيانات الأساسية، صلاحيات الوصول، وحالة الاعتماد لكل ملف.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">ملف المستخدم</p>
                        <h4 className="text-2xl font-bold text-brand-dark">{selectedUser.name}</h4>
                        <p className="text-sm text-gray-500">#{selectedUser.id} · {selectedUser.role === 'pro' ? 'محامي' : selectedUser.role === 'admin' ? 'مدير' : 'عميل'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-brand-dark border border-gray-200">{selectedUser.subscriptionTier}</span>
                        <span className={`rounded-full px-4 py-2 text-xs font-semibold ${selectedUser.blocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {selectedUser.blocked ? 'محظور' : 'نشط'}
                        </span>
                      </div>
                    </div>

                    <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <ImpactSummary
                        tone={selectedUser.blocked ? 'danger' : 'warning'}
                        title={selectedUser.blocked ? 'أثر قرار إلغاء الحظر' : 'أثر قرار الحظر'}
                        description={selectedUser.blocked ? 'إلغاء الحظر سيعيد الوصول إلى القضايا والرسائل والمدفوعات، لذلك راجع آخر أثر تدقيقي قبل إعادة التفعيل.' : 'الحظر سيوقف الدخول ويعطل المتابعة والرسائل النشطة لهذا الحساب حتى تتم مراجعته أو إلغاء القرار.'}
                      />
                      <ImpactSummary
                        tone={selectedUser.role === 'admin' ? 'danger' : 'info'}
                        title="أثر تغيير الدور"
                        description={selectedUser.role === 'admin' ? 'منح دور المدير يفتح صلاحيات سياسات النظام والحوكمة. استخدمه فقط بعد مراجعة الهوية والتفويض.' : selectedUser.role === 'pro' ? 'تحويل الملف إلى محامٍ يفعّل متطلبات الترخيص والاعتماد وظهور الملف ضمن تدفقات العمل المهنية.' : 'إرجاع الملف إلى عميل يلغي امتيازات الممارسة ويعيد التجربة إلى مسار الخدمة الأساسي.'}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 mb-6">
                      <label className="block text-sm text-gray-600">
                        الاسم الكامل
                        <input
                          type="text"
                          value={selectedUser.name}
                          onChange={(event) => updateSelectedUserField('name', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                        />
                      </label>
                      <label className="block text-sm text-gray-600">
                        البريد الإلكتروني
                        <input
                          type="email"
                          value={selectedUser.email}
                          onChange={(event) => updateSelectedUserField('email', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                        />
                      </label>
                      <label className="block text-sm text-gray-600">
                        الموقع
                        <input
                          type="text"
                          value={selectedUser.location}
                          onChange={(event) => updateSelectedUserField('location', event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                        />
                      </label>
                      <label className="block text-sm text-gray-600">
                        الدور
                        <select
                          value={selectedUser.role}
                          onChange={(event) => updateSelectedUserField('role', event.target.value as UserRecord['role'])}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                        >
                          <option value="user">عميل</option>
                          <option value="pro">محامي</option>
                          <option value="admin">مدير</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-4 mb-6 sm:grid-cols-2">
                      <label className="block text-sm text-gray-600">
                        حالة الحظر
                        <button
                          type="button"
                          onClick={() => updateSelectedUserField('blocked', !selectedUser.blocked)}
                          className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${selectedUser.blocked ? 'bg-green-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          {selectedUser.blocked ? 'إلغاء الحظر' : 'حظر المستخدم'}
                        </button>
                      </label>
                      <label className="block text-sm text-gray-600">
                        إشعارات المستخدم
                        <button
                          type="button"
                          onClick={() => updateSelectedUserField('notificationsEnabled', !selectedUser.notificationsEnabled)}
                          className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${selectedUser.notificationsEnabled ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                          {selectedUser.notificationsEnabled ? 'إشعارات مفعلة' : 'إشعارات معطلة'}
                        </button>
                      </label>
                    </div>

                    <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-brand-dark">سياق تدقيقي قريب</p>
                          <p className="text-xs font-bold text-slate-500">راجع آخر أثر قبل حفظ أي تعديل عالي التأثير.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{selectedUserAudit.length} سجل</span>
                      </div>
                      <div className="space-y-3">
                        {selectedUserAudit.length === 0 ? (
                          <p className="text-sm font-semibold text-slate-500">لا توجد سجلات مرتبطة مباشرة بهذا المستخدم حتى الآن.</p>
                        ) : (
                          selectedUserAudit.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black text-brand-dark">{entry.category}</p>
                                  <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{entry.message}</p>
                                </div>
                                <span className="text-[11px] font-bold text-slate-400">{entry.time}</span>
                              </div>
                              <button
                                onClick={() => handleActorClick(entry.actor)}
                                className={`mt-2 text-[11px] font-bold text-right transition-colors ${users.some((u) => u.name === entry.actor)
                                  ? 'text-brand-navy hover:underline cursor-pointer'
                                  : 'text-slate-400 cursor-default'
                                  }`}
                              >
                                {entry.actor}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedUser.role === 'pro' ? (
                      <div className="space-y-4 mb-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block text-sm text-gray-600">
                            رقم الرخصة
                            <input
                              type="text"
                              value={selectedUser.licenseNumber || ''}
                              onChange={(event) => updateSelectedUserField('licenseNumber', event.target.value)}
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                            />
                          </label>
                          <label className="block text-sm text-gray-600">
                            التخصص
                            <input
                              type="text"
                              value={selectedUser.specialty || ''}
                              onChange={(event) => updateSelectedUserField('specialty', event.target.value)}
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                            />
                          </label>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block text-sm text-gray-600">
                            التقييم
                            <input
                              type="number"
                              min={0}
                              max={5}
                              step={0.1}
                              value={selectedUser.rating ?? 0}
                              onChange={(event) => updateSelectedUserField('rating', Number(event.target.value))}
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                            />
                          </label>
                          <label className="block text-sm text-gray-600">
                            القضايا المفتوحة
                            <input
                              type="number"
                              min={0}
                              value={selectedUser.openCases ?? 0}
                              onChange={(event) => updateSelectedUserField('openCases', Number(event.target.value))}
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                            />
                          </label>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block text-sm text-gray-600">
                            حالة الترخيص
                            <select
                              value={selectedUser.licenseStatus}
                              onChange={(event) => updateSelectedUserField('licenseStatus', event.target.value as UserRecord['licenseStatus'])}
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                            >
                              <option value="pending">قيد المراجعة</option>
                              <option value="verified">موثق</option>
                              <option value="rejected">مرفوض</option>
                            </select>
                          </label>
                          <label className="block text-sm text-gray-600">
                            موثوق
                            <button
                              type="button"
                              onClick={() => updateSelectedUserField('verified', !selectedUser.verified)}
                              className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${selectedUser.verified ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                              {selectedUser.verified ? 'موثق' : 'غير موثق'}
                            </button>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 mb-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block text-sm text-gray-600">
                            الاستشارات المجانية المتبقية
                            <input
                              type="number"
                              min={0}
                              value={selectedUser.freeConsultsRemaining ?? 0}
                              onChange={(event) => updateSelectedUserField('freeConsultsRemaining', Number(event.target.value))}
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                            />
                          </label>
                          <label className="block text-sm text-gray-600">
                            رصيد الحساب
                            <input
                              type="number"
                              min={0}
                              value={selectedUser.accountBalance}
                              onChange={(event) => updateSelectedUserField('accountBalance', Number(event.target.value))}
                              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="mb-6">
                      <label className="block text-sm text-gray-600">ملاحظات المسؤول</label>
                      <textarea
                        rows={4}
                        value={selectedUser.notes}
                        onChange={(event) => updateSelectedUserField('notes', event.target.value)}
                        className="mt-2 w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        onClick={saveSelectedUser}
                        className="rounded-2xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition"
                      >
                        حفظ التعديلات
                      </button>
                      <span className="text-sm text-gray-500">{userSaveStatus === 'saving' ? 'جاري الحفظ...' : userSaveStatus === 'saved' ? 'تم الحفظ بنجاح' : userSaveStatus === 'error' ? 'فشل الحفظ، حاول مرة أخرى' : ' '}</span>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}

          {activeTab === 'financials' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-3xl bg-brand-navy p-6 text-white shadow-xl shadow-brand-navy/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/60">إجمالي السيولة</p>
                  <p className="mt-2 text-2xl font-black">42,850,000 د.ع</p>
                </div>
                <div className="rounded-3xl bg-white p-6 border border-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">عمولات المنصة اليوم</p>
                  <p className="mt-2 text-2xl font-black text-emerald-600">845,000 د.ع</p>
                </div>
                <div className="rounded-3xl bg-white p-6 border border-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">متوسط قيمة المعاملة</p>
                  <p className="mt-2 text-2xl font-black text-brand-dark">45,000 د.ع</p>
                </div>
              </div>
              <section className="rounded-[2.5rem] bg-white border border-slate-200 overflow-hidden shadow-premium">
                <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h4 className="text-xl font-black text-brand-dark">سجل المعاملات والسيولة</h4>
                    <p className="text-xs font-bold text-slate-400 mt-1">تتبع التدفقات المالية من زين كاش والتحويلات البنكية.</p>
                  </div>
                  <button onClick={() => downloadExport('transactions')} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-brand-navy hover:bg-slate-50 transition shadow-sm">تصدير التقرير المالي</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                      <tr className="hidden md:table-row">
                        <th className="px-8 py-4">العملية والوصف</th>
                        <th className="px-8 py-4">المصدر</th>
                        <th className="px-8 py-4">المبلغ</th>
                        <th className="px-8 py-4">الحالة</th>
                        <th className="px-8 py-4">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 md:table-row-group">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="flex flex-col p-4 border border-slate-200 rounded-xl bg-white shadow-sm mb-3 md:table-row md:p-0 md:border-0 md:bg-transparent md:shadow-none md:mb-0 hover:bg-slate-50/80 transition-colors group">
                          <td className="md:table-cell md:px-8 md:py-5">
                            <div className="flex flex-col md:block">
                              <span className="md:hidden text-xs font-bold text-slate-400 mb-1">العملية والوصف</span>
                              <p className="font-black text-brand-dark text-sm">{tx.label}</p>
                              <p className="font-mono text-[10px] text-slate-400 mt-1 uppercase">ID: {tx.id}</p>
                            </div>
                          </td>
                          <td className="md:table-cell md:px-8 md:py-5">
                            <div className="flex flex-col md:block">
                              <span className="md:hidden text-xs font-bold text-slate-400 mb-1">المصدر</span>
                              <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600">
                                <i className={`fa-solid ${tx.source === 'ZainCash' ? 'fa-mobile-screen' : 'fa-building-columns'} text-[10px]`}></i>
                                {tx.source}
                              </span>
                            </div>
                          </td>
                          <td className={`md:table-cell md:px-8 md:py-5`}>
                            <div className="flex flex-col md:block">
                              <span className="md:hidden text-xs font-bold text-slate-400 mb-1">المبلغ</span>
                              <span className={`text-sm font-black ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </span>
                            </div>
                          </td>
                          <td className="md:table-cell md:px-8 md:py-5">
                            <div className="flex flex-col md:block">
                              <span className="md:hidden text-xs font-bold text-slate-400 mb-1">الحالة</span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black ${tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${tx.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                {tx.status === 'completed' ? 'مكتملة' : 'معلقة'}
                              </span>
                            </div>
                          </td>
                          <td className="md:table-cell md:px-8 md:py-5">
                            <div className="flex flex-col md:block">
                              <span className="md:hidden text-xs font-bold text-slate-400 mb-1">التاريخ</span>
                              <span className="text-xs font-bold text-slate-400">14 نيسان، 10:40ص</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'kyc' && (
            <section className="rounded-3xl bg-gray-50 p-5 border border-gray-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h4 className="text-lg font-bold text-brand-dark">قائمة التحقق من المحامين الجدد</h4>
                  <p className="text-sm text-gray-500">عرض سريع ومكثف لحالة كل طلب KYC مع إجراءات مباشرة.</p>
                </div>
                <button
                  onClick={() => downloadExport('kyc')}
                  className="rounded-2xl bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy transition"
                >
                  تنزيل CSV
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4 mb-4 text-sm">
                <div className="rounded-3xl bg-white p-4 border border-gray-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">طلبات جديدة</p>
                  <p className="mt-2 text-xl font-semibold text-brand-dark">{pendingCount}</p>
                </div>
                <div className="rounded-3xl bg-white p-4 border border-gray-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">طلبات مكتملة</p>
                  <p className="mt-2 text-xl font-semibold text-brand-dark">{approvedCount + rejectedCount}</p>
                </div>
                <div className="rounded-3xl bg-white p-4 border border-gray-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">وثائق ناقصة</p>
                  <p className="mt-2 text-xl font-semibold text-brand-dark">{pendingWithMissingDocs}</p>
                </div>
                <div className="rounded-3xl bg-white p-4 border border-gray-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">متوسط عدد المستندات</p>
                  <p className="mt-2 text-xl font-semibold text-brand-dark">{averageAttachmentCount} / 3</p>
                </div>
              </div>

              <div className="mb-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <ImpactSummary
                  tone="warning"
                  title="أثر اعتماد الطلب"
                  description="الاعتماد يفعّل حساب المحامي في المسارات المهنية ويجعله قابلاً للإسناد والظهور ضمن البحث إذا كانت بقية المتطلبات مكتملة."
                />
                <ImpactSummary
                  tone="danger"
                  title="أثر رفض الطلب"
                  description="الرفض يوقف الانتقال إلى المسار المهني ويستلزم وضوح السبب في الملاحظات أو السجل حتى يمكن الرجوع إليه لاحقاً."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center mb-4">
                <input
                  type="search"
                  placeholder="ابحث عن محامي أو رقم النقابة أو مستند..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm text-gray-700"
                />
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setKycStatusFilter('all');
                  }}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-slate-50 transition"
                >
                  إعادة التعيين
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 mb-4">
                <span>فلتر الحالة:</span>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setKycStatusFilter(status)}
                    className={`rounded-full px-3 py-2 transition ${kycStatusFilter === status ? 'bg-brand-dark text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {status === 'all' ? 'الكل' : status === 'pending' ? 'قيد الانتظار' : status === 'approved' ? 'معتمد' : 'مرفوض'}
                  </button>
                ))}
              </div>

              <div className="w-full">
                <div className="w-full rounded-3xl sm:border border-gray-200 sm:bg-white text-sm sm:table overflow-hidden">
                  <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-gray-500 sm:grid border-b border-slate-100 bg-slate-50/50 rounded-t-3xl">
                    <div>المحامي</div>
                    <div>رقم النقابة</div>
                    <div>التخصص</div>
                    <div>الخبرة</div>
                    <div>المستندات</div>
                    <div className="text-right">الحالة والإجراءات</div>
                  </div>
                  <div className="divide-y divide-slate-100 sm:divide-y">
                    {filteredKycApplications.length === 0 ? (
                      <div className="p-6">
                        <EmptyState icon="id-card" title="لا توجد طلبات KYC مطابقة" description="لا توجد طلبات تطابق معايير البحث الحالية." />
                      </div>
                    ) : (
                      filteredKycApplications.map((application) => (
                        <div key={application.id} className="flex flex-col p-5 border border-slate-200 rounded-[2rem] bg-white shadow-sm mb-4 sm:grid sm:gap-3 sm:px-4 sm:py-5 sm:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1.5fr] sm:items-center sm:border-0 sm:rounded-none sm:bg-transparent sm:shadow-none sm:mb-0 hover:bg-slate-50/50 transition-colors group">
                          <div className="flex flex-col gap-1 sm:block mb-3 sm:mb-0">
                            <span className="sm:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المحامي</span>
                            <button
                              type="button"
                              onClick={() => openKycProfile(application)}
                              className="text-left text-sm font-semibold text-brand-navy underline-offset-4 transition hover:text-brand-dark hover:underline"
                            >
                              <HighlightText text={application.name} highlight={searchTerm} />
                            </button>
                            <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                              <span>{application.city}</span>
                              {application.profileScore != null && <span>درجة الملف: {application.profileScore}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:block mb-3 sm:mb-0">
                            <span className="sm:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">رقم النقابة</span>
                            <div className="text-xs font-mono text-gray-600">{application.license}</div>
                          </div>
                          <div className="flex flex-col gap-1 sm:block mb-3 sm:mb-0">
                            <span className="sm:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">التخصص</span>
                            <div className="text-xs text-gray-600 font-bold">{application.specialty || 'عام'}</div>
                          </div>
                          <div className="flex flex-col gap-1 sm:block mb-3 sm:mb-0">
                            <span className="sm:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الخبرة</span>
                            <div className="text-xs text-gray-600 font-bold">{application.experienceYears != null ? `${application.experienceYears} سنة` : 'غير محدد'}</div>
                          </div>
                          <div className="flex flex-col gap-1 text-xs text-gray-600 sm:block mb-4 sm:mb-0">
                            <span className="sm:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المستندات</span>
                            <span>{application.attachments.length} من 3 مستندات</span>
                            {application.attachments.length < 3 ? (
                              <span className="text-red-600">{3 - application.attachments.length} ناقصة</span>
                            ) : (
                              <span className="text-green-600">مكتملة</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-3 sm:gap-2 items-end text-right border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
                            <span className="sm:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest self-start mb-1">الإجراءات</span>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <label htmlFor={`status-${application.id}`} className="sr-only">الحالة</label>
                              <select
                                id={`status-${application.id}`}
                                value={application.status}
                                onChange={(event) => {
                                  const value = event.target.value as 'pending' | 'approved' | 'rejected';
                                  if (value !== application.status && value !== 'pending') {
                                    updateApplicationStatus(application.id, value);
                                  }
                                }}
                                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[11px] font-bold text-gray-700 outline-none focus:border-brand-navy"
                              >
                                <option value="pending">قيد الانتظار</option>
                                <option value="approved">معتمد</option>
                                <option value="rejected">مرفوض</option>
                              </select>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => updateApplicationStatus(application.id, 'approved')}
                                disabled={application.status !== 'pending'}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-[11px] font-black text-emerald-700 hover:bg-emerald-500 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <i className="fa-solid fa-check" /> قبول
                              </button>
                              <button
                                onClick={() => updateApplicationStatus(application.id, 'rejected')}
                                disabled={application.status !== 'pending'}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-[11px] font-black text-red-700 hover:bg-red-500 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <i className="fa-solid fa-xmark" /> رفض
                              </button>
                              <button
                                onClick={() => showKycDocuments(application)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition"
                              >
                                <i className="fa-solid fa-file-lines" /> عرض الوثائق
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                حالة التحديث: {statusLabel === 'idle' ? 'جاهز' : statusLabel === 'processing' ? 'جاري المعالجة...' : statusLabel === 'success' ? 'تم التحديث بنجاح' : 'حدث خطأ'}
              </div>
              <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-brand-dark">سجل الاعتماد القريب</p>
                    <p className="text-xs font-bold text-slate-500">يظهر بجانب قرار KYC لتسريع المراجعة.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{recentKycAudit.length} سجل</span>
                </div>
                <div className="grid gap-3">
                  {recentKycAudit.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-brand-dark">{entry.category}</p>
                          <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{entry.message}</p>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">{entry.time}</span>
                      </div>
                      <button
                        onClick={() => handleActorClick(entry.actor)}
                        className={`mt-2 text-[11px] font-bold text-right transition-colors ${users.some((u) => u.name === entry.actor)
                          ? 'text-brand-navy hover:underline cursor-pointer'
                          : 'text-slate-400 cursor-default'
                          }`}
                      >
                        {entry.actor}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'support' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
              <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
                  <div>
                    <h4 className="text-lg font-bold text-brand-dark">التذاكر والدعم</h4>
                    <p className="text-sm text-gray-500">إدارة الحالات المفتوحة والتصعيدات بسهولة.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold text-red-700">مفتوح {ticketStats.open}</span>
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-700">قيد الانتظار {ticketStats.pending}</span>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-[11px] font-semibold text-green-700">محلول {ticketStats.resolved}</span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold text-blue-700">مصعد {ticketStats.escalated}</span>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
                    <label className="block text-right">
                      <span className="block text-xs font-semibold text-gray-500 mb-2">ابحث في التذاكر</span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="ابحث بالموضوع أو المرسل أو الحالة"
                          value={supportSearch}
                          onChange={(event) => setSupportSearch(event.target.value)}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700"
                        />
                        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
                          <i className="fa-solid fa-search text-xs"></i>
                        </span>
                      </div>
                    </label>
                    <button
                      onClick={() => setSupportSearch('')}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                    >
                      مسح البحث
                    </button>
                  </div>

                  <div className="rounded-3xl bg-white p-4 border border-gray-200 grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                      <div>
                        <label className="block text-xs text-gray-500 mb-2">فلتر التذاكر</label>
                        <select
                          value={ticketFilter}
                          onChange={(event) => setTicketFilter(event.target.value as any)}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                        >
                          <option value="all">الكل</option>
                          <option value="open">مفتوح</option>
                          <option value="pending">قيد الانتظار</option>
                          <option value="resolved">محلول</option>
                          <option value="escalated">مصعد</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => downloadExport('tickets')}
                          className="rounded-2xl bg-brand-gold px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition"
                        >
                          تصدير التذاكر
                        </button>
                        <span className="rounded-full bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700">عرض {filteredTickets.length} تذكرة</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">فلتر سريع:</span>
                      <button
                        onClick={() => setTicketFilter('all')}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${ticketFilter === 'all' ? 'bg-brand-dark text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        الكل
                      </button>
                      <button
                        onClick={() => setTicketFilter('open')}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${ticketFilter === 'open' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        مفتوح
                      </button>
                      <button
                        onClick={() => setTicketFilter('pending')}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${ticketFilter === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        قيد الانتظار
                      </button>
                      <button
                        onClick={() => setTicketFilter('resolved')}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${ticketFilter === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        محلول
                      </button>
                      <button
                        onClick={() => setTicketFilter('escalated')}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${ticketFilter === 'escalated' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        مصعد
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ImpactSummary
                      tone="danger"
                      title="أثر التصعيد"
                      description="التصعيد ينقل التذكرة إلى مسار أسرع ويزيد أولويتها التشغيلية، لذلك استخدمه عندما تتأثر قضية أو دفعة أو وصول مستخدم."
                    />
                    <ImpactSummary
                      tone="success"
                      title="أثر تعليم التذكرة كمحلولة"
                      description="الحل يغلق دورة المتابعة الحالية ويؤثر على تقارير الأداء، لذلك يجب أن يكون مدعوماً بسجل أو تحديث واضح."
                    />
                  </div>
                  {filteredTickets.length === 0 ? (
                    <EmptyState icon="life-ring" title="لا توجد تذاكر مطابقة" description="لا توجد تذاكر تطابق معايير البحث الحالية." />
                  ) : (
                    filteredTickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-3xl bg-white p-5 border border-gray-200 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-brand-dark truncate">
                              <HighlightText text={ticket.subject} highlight={supportSearch} />
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-gray-500">
                              <span className="inline-flex items-center gap-2">
                                <i className="fa-solid fa-user text-[10px]" />
                                {ticket.requester}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-2 capitalize">
                                <i className="fa-solid fa-flag text-[10px]" />
                                {ticket.priority}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${ticket.status === 'open' ? 'bg-red-100 text-red-600' : ticket.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {ticket.status}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">{ticket.createdAt}</span>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <button
                            onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                            className="rounded-2xl bg-green-100 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-500 hover:text-white transition"
                          >
                            <span className="inline-flex items-center gap-2">
                              <i className="fa-solid fa-check" />
                              تم الحل
                            </span>
                          </button>
                          <button
                            onClick={() => updateTicketStatus(ticket.id, 'escalated')}
                            className="rounded-2xl bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-500 hover:text-white transition"
                          >
                            <span className="inline-flex items-center gap-2">
                              <i className="fa-solid fa-exclamation" />
                              تصعيد
                            </span>
                          </button>
                          <button
                            onClick={() => updateTicketStatus(ticket.id, 'pending')}
                            className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                          >
                            <span className="inline-flex items-center gap-2">
                              <i className="fa-solid fa-clock" />
                              قيد الانتظار
                            </span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h4 className="text-lg font-bold text-brand-dark">سجلات النشاط</h4>
                    <p className="text-sm text-gray-500">تتبّع الأحداث الآنية وراجع أي نشاط حساس.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{filteredAuditLogs.length} سجلات</span>
                </div>
                <div className="space-y-3 max-h-[640px] overflow-y-auto">
                  {filteredAuditLogs.length === 0 ? (
                    <EmptyState icon="clock-rotate-left" title="لا توجد سجلات مطابقة" description="لا توجد سجلات تطابق الفلتر الحالي." />
                  ) : (
                    filteredAuditLogs.map((entry) => (
                      <div key={entry.id} className="rounded-3xl bg-white p-4 border border-gray-200">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <p className="text-sm font-semibold text-brand-dark">{entry.category}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{entry.message}</p>
                          </div>
                          <span className="text-[11px] text-gray-400">{entry.time}</span>
                        </div>
                        <button
                          onClick={() => handleActorClick(entry.actor)}
                          className={`mt-2 text-[11px] font-bold text-right transition-colors ${users.some((u) => u.name === entry.actor)
                            ? 'text-brand-navy hover:underline cursor-pointer'
                            : 'text-gray-400 cursor-default'
                            }`}
                        >
                          {entry.actor}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
                <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h4 className="text-lg font-bold text-brand-dark">إعدادات النظام</h4>
                    <p className="text-sm text-gray-500">تخصيص حالة الصيانة، الإعلانات، والبريد الدعم.</p>
                  </div>
                  <button
                    onClick={() => updateSystemSetting({ maintenanceMode: !systemSettings?.maintenanceMode })}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${systemSettings?.maintenanceMode ? 'bg-red-500 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  >
                    {systemSettings?.maintenanceMode ? 'تعطيل وضع الصيانة' : 'تفعيل وضع الصيانة'}
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl bg-white p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-brand-dark">الإعلان العام</label>
                    <textarea
                      rows={3}
                      value={systemSettings?.announcement || ''}
                      onChange={(event) => updateSystemSetting({ announcement: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                    />
                  </div>
                  <div className="rounded-3xl bg-white p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-brand-dark">نص حالة الصيانة</label>
                    <textarea
                      rows={2}
                      value={systemSettings?.offlineMessage || ''}
                      onChange={(event) => updateSystemSetting({ offlineMessage: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                    />
                  </div>
                  <div className="rounded-3xl bg-white p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-brand-dark">البريد الإلكتروني للدعم</label>
                    <input
                      type="email"
                      value={systemSettings?.supportEmail || ''}
                      onChange={(event) => updateSystemSetting({ supportEmail: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                    />
                  </div>
                </div>

                {/* Broadcast Hub Section */}
                <div className="mt-6 rounded-3xl bg-brand-navy p-6 text-white shadow-lg shadow-brand-navy/20">
                  <div className="flex items-center gap-3 mb-4">
                    <i className="fa-solid fa-bullhorn text-brand-gold"></i>
                    <h4 className="text-lg font-black">البث الموحد (Broadcast)</h4>
                  </div>
                  <p className="text-sm text-blue-100 mb-4">إرسال تنبيه فوري يظهر في الشريط العلوي لجميع المستخدمين والمحامين.</p>
                  <textarea
                    rows={2}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="اكتب رسالة الإعلان هنا..."
                    className="w-full rounded-2xl border-none bg-white/10 p-4 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-brand-gold outline-none mb-4"
                  />
                  <button
                    onClick={() => {
                      const message = broadcastMessage.trim();
                      if (!message) {
                        showToast('اكتب رسالة أولاً', 'لا يمكن إرسال إعلان فارغ للمستخدمين.', 'warning');
                        return;
                      }
                      updateSystemSetting({ announcement: message });
                      setBroadcastMessage('');
                    }}
                    className="w-full py-3 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:bg-yellow-500 transition disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!broadcastMessage.trim()}
                  >
                    إرسال الإعلان الآن
                  </button>
                </div>
              </section>
              <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h4 className="text-lg font-bold text-brand-dark">الذكاء الاصطناعي وسير العمل</h4>
                    <p className="text-sm text-gray-500">ضبط معلمات الذكاء الاصطناعي وسير إجراءات القضايا.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <ImpactSummary
                    tone="danger"
                    title="أثر تعديلات السياسات العامة"
                    description="تغيير الصيانة أو الإعلانات أو سياسات سير العمل ينعكس فوراً على تجربة المستخدمين والمحامين، لذلك يفضّل مراجعته مع السجل والتوقيت."
                  />
                  <button
                    onClick={() => updateAiSetting({ enabled: !aiSettings?.enabled })}
                    className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${aiSettings?.enabled ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    {aiSettings?.enabled ? 'الذكاء الاصطناعي مفعل' : 'تعطيل الذكاء الاصطناعي'}
                  </button>
                  <button
                    onClick={() => updateAiSetting({ fallbackMode: !aiSettings?.fallbackMode })}
                    className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${aiSettings?.fallbackMode ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    {aiSettings?.fallbackMode ? 'وضع التخزين المؤقت مفعّل' : 'وضع التخزين المؤقت معطّل'}
                  </button>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-gray-500">
                      أعلى عدد للمراجع
                      <input
                        type="number"
                        min={1}
                        value={aiSettings?.topK ?? 3}
                        onChange={(event) => updateAiSetting({ topK: Number(event.target.value) })}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                      />
                    </label>
                    <label className="block text-sm text-gray-500">
                      حد الرموز
                      <input
                        type="number"
                        min={100}
                        value={aiSettings?.maxTokens ?? 500}
                        onChange={(event) => updateAiSetting({ maxTokens: Number(event.target.value) })}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-gray-500">
                      سعر كل استدعاء AI
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-gray-500">IQ</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={aiSettings?.pricePerRequest ?? 0}
                          onChange={(event) => updateAiSetting({ pricePerRequest: Number(event.target.value) })}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                        />
                      </div>
                    </label>
                    <label className="block text-sm text-gray-500">
                      سعر كل 1000 رمز
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-gray-500">IQ</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={aiSettings?.pricePerToken ?? 0}
                          onChange={(event) => updateAiSetting({ pricePerToken: Number(event.target.value) })}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                        />
                      </div>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-gray-500">
                      طلبات مجانية لكل مستخدم
                      <input
                        type="number"
                        min={0}
                        value={aiSettings?.freeRequestsPerUser ?? 0}
                        onChange={(event) => updateAiSetting({ freeRequestsPerUser: Number(event.target.value) })}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                      />
                    </label>
                    <label className="block text-sm text-gray-500">
                      رموز مجانية لكل مستخدم
                      <input
                        type="number"
                        min={0}
                        value={aiSettings?.freeTokensPerUser ?? 0}
                        onChange={(event) => updateAiSetting({ freeTokensPerUser: Number(event.target.value) })}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                      />
                    </label>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => updateWorkflowSettingsHandler({ allowNewCases: !workflowSettings?.allowNewCases })}
                      className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${workflowSettings?.allowNewCases ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      {workflowSettings?.allowNewCases ? 'السماح بإنشاء القضايا الجديدة' : 'منع إنشاء القضايا الجديدة'}
                    </button>
                    <button
                      onClick={() => updateWorkflowSettingsHandler({ enforceSignedDocs: !workflowSettings?.enforceSignedDocs })}
                      className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${workflowSettings?.enforceSignedDocs ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      {workflowSettings?.enforceSignedDocs ? 'فرض توقيع الوثائق' : 'عدم فرض توقيع الوثائق'}
                    </button>
                    <button
                      onClick={() => updateWorkflowSettingsHandler({ autoAssignLawyers: !workflowSettings?.autoAssignLawyers })}
                      className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${workflowSettings?.autoAssignLawyers ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      {workflowSettings?.autoAssignLawyers ? 'تفعيل التعيين الآلي للمحامين' : 'تعطيل التعيين الآلي للمحامين'}
                    </button>
                    <label className="block text-sm text-gray-500">
                      السعة القصوى لكل محامي
                      <input
                        type="number"
                        min={1}
                        value={workflowSettings?.openCasesPerLawyer ?? 10}
                        onChange={(event) => updateWorkflowSettingsHandler({ openCasesPerLawyer: Number(event.target.value) })}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                      />
                    </label>
                  </div>
                </div>
              </section>
              </div>
              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-brand-dark">بوابات الدفع والميزات</h4>
                      <p className="text-sm text-gray-500">تفعيل أدوات المنصة والتحكم برسوم بوابات الدفع من مكان واحد.</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {flags.filter((flag) => flag.enabled).length}/{flags.length} ميزات
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-brand-dark">بوابات الدفع</p>
                        <span className="text-xs font-bold text-gray-500">{paymentGateways.filter((gateway) => gateway.enabled).length} مفعلة</span>
                      </div>
                      <div className="space-y-3">
                        {paymentGateways.length === 0 ? (
                          <EmptyState icon="credit-card" title="لا توجد بوابات دفع" description="لم تصل إعدادات بوابات الدفع من الخادم بعد." />
                        ) : (
                          paymentGateways.map((gateway) => (
                            <div key={gateway.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-bold text-brand-dark">{gateway.label}</p>
                                  <p className="text-xs text-gray-500">رسوم العملية الحالية {gateway.feePercent}%</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updatePaymentGatewayItem(gateway.key, !gateway.enabled, gateway.feePercent)}
                                  className={`rounded-2xl px-4 py-2 text-xs font-black transition ${gateway.enabled ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                  {gateway.enabled ? 'مفعلة' : 'معطلة'}
                                </button>
                              </div>
                              <label className="mt-3 block text-xs font-bold text-gray-500">
                                نسبة الرسوم
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={gateway.feePercent}
                                  onChange={(event) => {
                                    const nextValue = Number(event.target.value);
                                    setPaymentGateways((prev) => prev.map((item) => (
                                      item.key === gateway.key ? { ...item, feePercent: nextValue } : item
                                    )));
                                  }}
                                  onBlur={(event) => updatePaymentGatewayItem(gateway.key, gateway.enabled, Number(event.currentTarget.value))}
                                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                                />
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-brand-dark">مفاتيح الميزات</p>
                        <button
                          type="button"
                          onClick={() => {
                            const nextTaxEnabled = !taxEnabled;
                            setTaxEnabled(nextTaxEnabled);
                            updatePolicy('tax_enabled', String(nextTaxEnabled));
                          }}
                          className={`rounded-2xl px-3 py-2 text-xs font-black transition ${taxEnabled ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                          الضريبة {taxEnabled ? 'مفعلة' : 'معطلة'}
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {flags.length === 0 ? (
                          <div className="md:col-span-2">
                            <EmptyState icon="toggle-on" title="لا توجد ميزات" description="لم تصل مفاتيح الميزات من الخادم بعد." />
                          </div>
                        ) : (
                          flags.map((flag) => (
                            <button
                              key={flag.key}
                              type="button"
                              onClick={() => toggleFlag(flag.key, !flag.enabled)}
                              className={`rounded-2xl border p-4 text-right transition ${flag.enabled ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-white'}`}
                            >
                              <span className="block text-sm font-black">{flag.label}</span>
                              <span className="mt-1 block text-xs font-semibold leading-5">{flag.description}</span>
                              <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black">
                                {flag.enabled ? 'مفعلة' : 'معطلة'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
                <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-brand-dark">السياسات والإشعارات</h4>
                      <p className="text-sm text-gray-500">تحكم بالقيم التشغيلية ونصوص الإشعارات التي تظهر للمستخدمين.</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {notificationTemplates.filter((template) => template.active).length} قوالب نشطة
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <p className="mb-3 text-sm font-black text-brand-dark">سياسات المنصة</p>
                      <div className="space-y-3">
                        {policies.length === 0 ? (
                          <EmptyState icon="sliders" title="لا توجد سياسات" description="لم تصل إعدادات السياسات من الخادم بعد." />
                        ) : (
                          policies.map((policy) => (
                            <label key={policy.key} className="block rounded-2xl border border-gray-100 bg-gray-50 p-3">
                              <span className="block text-sm font-bold text-brand-dark">{policy.label}</span>
                              <span className="mt-1 block text-xs text-gray-500">{policy.description}</span>
                              <input
                                type="text"
                                value={policy.value}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setPolicies((prev) => prev.map((item) => (
                                    item.key === policy.key ? { ...item, value: nextValue } : item
                                  )));
                                }}
                                onBlur={(event) => updatePolicy(policy.key, event.currentTarget.value)}
                                className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                              />
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <p className="mb-3 text-sm font-black text-brand-dark">قوالب الإشعارات</p>
                      <div className="space-y-3">
                        {notificationTemplates.length === 0 ? (
                          <EmptyState icon="bell" title="لا توجد قوالب إشعار" description="لم تصل قوالب الإشعارات من الخادم بعد." />
                        ) : (
                          notificationTemplates.map((template) => (
                            <div key={template.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-brand-dark">{template.label}</p>
                                <button
                                  type="button"
                                  onClick={() => updateNotificationTemplate(template.key, { active: !template.active })}
                                  className={`rounded-2xl px-3 py-2 text-xs font-black transition ${template.active ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                  {template.active ? 'نشط' : 'متوقف'}
                                </button>
                              </div>
                              <textarea
                                rows={3}
                                value={template.value}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setNotificationTemplates((prev) => prev.map((item) => (
                                    item.key === template.key ? { ...item, value: nextValue } : item
                                  )));
                                }}
                                onBlur={(event) => updateNotificationTemplate(template.key, { value: event.currentTarget.value })}
                                className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-lg font-black text-brand-dark">الخدمات القانونية المتاحة</h4>
                    <p className="text-sm font-bold text-slate-500">أنشئ الخدمة من لوحة الإدارة وحدد التصنيف والمحامي في خطوتين فقط.</p>
                  </div>
                  <span className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-dark">
                    {legalServices.length} خدمة منشورة
                  </span>
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-right">
                        <p className="text-sm font-black text-brand-dark">1. تفاصيل الخدمة</p>
                        <p className="text-xs font-bold text-slate-500">اسم واضح، سعر، ومدة متوقعة.</p>
                      </div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-navy text-sm font-black text-white">1</span>
                    </div>
                    <div className="grid gap-3">
                      <input
                        type="text"
                        placeholder="اسم الخدمة"
                        value={newService.title || ''}
                        onChange={(event) => setNewService((prev) => ({ ...prev, title: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand-navy"
                      />
                      <textarea
                        rows={3}
                        placeholder="وصف مختصر لما يحصل عليه العميل"
                        value={newService.description || ''}
                        onChange={(event) => setNewService((prev) => ({ ...prev, description: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand-navy"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          placeholder="السعر مثل 75,000 د.ع"
                          value={newService.price || ''}
                          onChange={(event) => setNewService((prev) => ({ ...prev, price: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand-navy"
                        />
                        <input
                          type="text"
                          placeholder="المدة مثل 48 ساعة"
                          value={newService.time || ''}
                          onChange={(event) => setNewService((prev) => ({ ...prev, time: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand-navy"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-right">
                        <p className="text-sm font-black text-brand-dark">2. التصنيف والمحامي</p>
                        <p className="text-xs font-bold text-slate-500">اربط الخدمة بمحامٍ ظاهر للعميل.</p>
                      </div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-gold text-sm font-black text-brand-dark">2</span>
                    </div>
                    <div className="grid gap-3">
                      <input
                        type="text"
                        list="legal-service-categories"
                        placeholder="التصنيف مثل تجاري أو عقارات"
                        value={newService.category || ''}
                        onChange={(event) => setNewService((prev) => ({ ...prev, category: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand-navy"
                      />
                      <datalist id="legal-service-categories">
                        {serviceCategories.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                      <select
                        value={newService.lawyerId || ''}
                        onChange={(event) => setNewService((prev) => ({ ...prev, lawyerId: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand-navy"
                      >
                        <option value="">اختر المحامي المسؤول</option>
                        {availableLawyers.map((lawyer) => (
                          <option key={lawyer.id} value={lawyer.id}>
                            {lawyer.name} {lawyer.specialty ? `- ${lawyer.specialty}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={addLegalService}
                        disabled={!newService.title || !newService.description || !newService.price || !newService.time || !newService.category || !newService.lawyerId}
                        className="rounded-2xl bg-brand-navy px-4 py-3 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        نشر الخدمة في لوحة المستخدم
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {legalServices.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500 lg:col-span-2">
                      لا توجد خدمات منشورة من الإدارة بعد.
                    </div>
                  ) : (
                    legalServices.map((service) => (
                      <div key={service.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            onClick={() => deleteLegalService(service.id)}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                          >
                            حذف
                          </button>
                          <div className="min-w-0 text-right">
                            <div className="mb-2 flex flex-row-reverse flex-wrap gap-2">
                              <span className="rounded-full bg-brand-navy/5 px-3 py-1 text-[10px] font-black text-brand-navy">{service.category}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">{service.price}</span>
                            </div>
                            <p className="truncate text-base font-black text-brand-dark">{service.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs font-bold leading-6 text-slate-500">{service.description}</p>
                            <p className="mt-3 text-[11px] font-black text-brand-navy">
                              {service.lawyerName || 'محام غير محدد'} {service.lawyerSpecialty ? `• ${service.lawyerSpecialty}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
              <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h4 className="text-lg font-bold text-brand-dark">مصادر القوانين</h4>
                    <p className="text-sm text-gray-500">أضف وأدِر المراجع القانونية والأبحاث.</p>
                  </div>
                </div>
                <div className="mb-4">
                  <ImpactSummary
                    tone="danger"
                    title="أثر حذف مصدر قانوني"
                    description="حذف المرجع قد يزيله من نتائج الاستشهاد والمراجعة ويؤثر على قابلية التتبع القانوني، لذلك راجع البديل أو سبب الإزالة أولاً."
                  />
                </div>
                <div className="space-y-3">
                  {legalDocs.map((doc) => (
                    <div key={doc.id} className="rounded-3xl bg-white p-4 border border-gray-200 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-brand-dark">{doc.title}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{doc.law} • {doc.article}</p>
                      </div>
                      <button
                        onClick={() => setDocToDelete(doc.id)}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3">
                  <input
                    type="text"
                    placeholder="عنوان الوثيقة"
                    value={newDoc.title || ''}
                    onChange={(event) => setNewDoc((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="القانون"
                      value={newDoc.law || ''}
                      onChange={(event) => setNewDoc((prev) => ({ ...prev, law: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                    />
                    <input
                      type="text"
                      placeholder="المادة"
                      value={newDoc.article || ''}
                      onChange={(event) => setNewDoc((prev) => ({ ...prev, article: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="التصنيف"
                    value={newDoc.category || ''}
                    onChange={(event) => setNewDoc((prev) => ({ ...prev, category: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                  />
                  <input
                    type="text"
                    placeholder="رابط المصدر"
                    value={newDoc.source || ''}
                    onChange={(event) => setNewDoc((prev) => ({ ...prev, source: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                  />
                  <textarea
                    rows={3}
                    placeholder="ملخص الوثيقة"
                    value={newDoc.summary || ''}
                    onChange={(event) => setNewDoc((prev) => ({ ...prev, summary: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                  />
                  <button
                    onClick={addLegalDocument}
                    className="rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition"
                  >
                    إضافة وثيقة جديدة
                  </button>
                </div>
              </section>
              <section className="rounded-3xl bg-gray-50 p-6 border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h4 className="text-lg font-bold text-brand-dark">قواعد مراقبة المحتوى</h4>
                    <p className="text-sm text-gray-500">تحكم بالكلمات والمواضيع الحساسة.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <ImpactSummary
                    tone="warning"
                    title="أثر تعديل قواعد المراقبة"
                    description="تعطيل أو حذف قاعدة يغيّر مستوى الحماية على المحتوى الحساس فوراً، لذلك أبقِ السجل القريب والمبرر التشغيلي واضحين."
                  />
                  <div className="grid gap-4 rounded-3xl bg-white p-5 border border-gray-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="space-y-2 text-right">
                        <p className="text-sm font-bold text-brand-dark">أضف قاعدة مراقبة جديدة</p>
                        <p className="text-xs text-gray-500">يمكنك إدارة الكلمات المحظورة والمواضيع الحساسة من هنا.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] w-full sm:w-auto">
                        <label className="space-y-2 text-right">
                          <span className="text-sm font-semibold text-brand-dark">نوع القاعدة</span>
                          <select
                            value={newModerationType}
                            onChange={(event) => setNewModerationType(event.target.value as 'bannedWord' | 'sensitiveTopic')}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                          >
                            <option value="bannedWord">كلمة محظورة</option>
                            <option value="sensitiveTopic">موضوع حساس</option>
                          </select>
                        </label>
                        <button
                          onClick={addModerationRule}
                          className="inline-flex items-center justify-center rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
                        >
                          إضافة قاعدة
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <label className="space-y-2 text-right">
                        <span className="text-sm font-semibold text-brand-dark">الكلمة أو الموضوع</span>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="أدخل كلمة أو تعبير جديد"
                            value={newBannedWord}
                            onChange={(event) => setNewBannedWord(event.target.value)}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm text-gray-700"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-gray-400">
                            <i className="fa-solid fa-key text-sm"></i>
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-3xl bg-white p-4 border border-gray-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 text-right">
                        <p className="text-sm font-semibold text-brand-dark">قواعد المراقبة ({filteredModerationRules.length})</p>
                        <p className="text-xs text-gray-500">عرض القواعد التي تطابق بحثك أو كلها إذا لم يكن هناك بحث.</p>
                      </div>
                      <div className="relative w-full sm:w-60">
                        <input
                          type="text"
                          placeholder="البحث في القواعد"
                          value={moderationSearch}
                          onChange={(event) => setModerationSearch(event.target.value)}
                          className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 pr-10 text-sm text-gray-700"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-gray-400">
                          <i className="fa-solid fa-search text-xs"></i>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        {activeModerationCount} مفعل
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                        {moderationRules.length - activeModerationCount} معطل
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {filteredModerationRules.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-gray-300 bg-slate-50 p-6 text-center text-sm text-gray-500">
                        لم يتم العثور على أية قواعد.
                      </div>
                    ) : (
                      filteredModerationRules.map((rule) => (
                        <div key={rule.id} className="rounded-3xl bg-slate-50 p-4 border border-gray-200 shadow-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 text-right">
                              <p className="truncate text-sm font-semibold text-brand-dark">{rule.value}</p>
                              <p className="text-[11px] text-gray-500">{rule.type === 'bannedWord' ? 'كلمة محظورة' : 'موضوع حساس'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {rule.active ? 'مفعل' : 'معطل'}
                              </span>
                              <button
                                onClick={() => toggleModerationRule(rule.id, !rule.active)}
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${rule.active ? 'bg-white text-slate-700 border border-gray-200 hover:bg-slate-100' : 'bg-brand-navy text-white hover:bg-brand-dark'}`}
                              >
                                {rule.active ? 'تعطيل' : 'تفعيل'}
                              </button>
                              <button
                                onClick={() => deleteModerationRule(rule.id)}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              >
                                حذف
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-sm font-black text-brand-dark">سجل الامتثال القريب</h5>
                        <p className="text-xs font-bold text-slate-500">مجاور لقرارات الوثائق والقواعد لتوضيح الأثر.</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{complianceAudit.length} سجل</span>
                    </div>
                    <div className="space-y-3">
                      {complianceAudit.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-brand-dark">{entry.category}</p>
                              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{entry.message}</p>
                            </div>
                            <span className="text-[11px] font-bold text-slate-400">{entry.time}</span>
                          </div>
                          <button
                            onClick={() => handleActorClick(entry.actor)}
                            className={`mt-2 text-[11px] font-bold text-right transition-colors ${users.some((u) => u.name === entry.actor)
                              ? 'text-brand-navy hover:underline cursor-pointer'
                              : 'text-slate-400 cursor-default'
                              }`}
                          >
                            {entry.actor}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
            </div>
          )}

          {activeTab === 'cases' && (
            <section className="grid gap-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-lg font-black text-brand-dark">إدارة القضايا من البداية إلى الإغلاق</h4>
                    <p className="text-sm font-bold text-slate-500">تحكم بالحالة، نسبة التقدم، المخاطر، وملاحظات الجدول الزمني بين العميل والمحامي.</p>
                  </div>
                  <span className="rounded-full bg-brand-navy px-3 py-1 text-[11px] font-black text-white">{adminCases.length} قضية</span>
                </div>
              </div>

              <div className="grid gap-4">
                {adminCases.length === 0 ? (
                  <EmptyState icon="briefcase" title="لا توجد قضايا" description="ستظهر القضايا هنا عند إنشائها من مساحة العميل أو المحامي." />
                ) : adminCases.map((caseItem) => {
                  const draft = timelineDrafts[caseItem.id] || { title: '', detail: '', type: 'system' };
                  return (
                    <div key={caseItem.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{caseItem.matter}</span>
                            <span className="rounded-full bg-brand-navy/10 px-3 py-1 text-[11px] font-black text-brand-navy">{caseItem.status}</span>
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">مخاطر {caseItem.riskScore}%</span>
                          </div>
                          <h5 className="truncate text-base font-black text-brand-dark">{caseItem.title}</h5>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            العميل: {caseItem.client?.name || 'غير محدد'} · المحامي: {caseItem.lawyer?.name || 'غير مسند'} · مستندات {caseItem.documents?.length || 0}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
                          <select
                            value={caseItem.status}
                            onChange={(event) => updateAdminCase(caseItem.id, { status: event.target.value })}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                          >
                            <option value="pending">قيد البدء</option>
                            <option value="active">نشطة</option>
                            <option value="review">قيد المراجعة</option>
                            <option value="closed">محلولة</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={caseItem.progress}
                            onChange={(event) => updateAdminCase(caseItem.id, { progress: Number(event.target.value) })}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                            aria-label="نسبة تقدم القضية"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={caseItem.riskScore}
                            onChange={(event) => updateAdminCase(caseItem.id, { riskScore: Number(event.target.value) })}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                            aria-label="درجة المخاطر"
                          />
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-gold" style={{ width: `${Math.max(0, Math.min(100, caseItem.progress || 0))}%` }} />
                      </div>
                      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                        <div className="rounded-3xl bg-slate-50 p-4">
                          <p className="mb-3 text-xs font-black text-brand-dark">الجدول الزمني</p>
                          <div className="space-y-3">
                            {(caseItem.timelineEntries || []).slice(-4).map((entry) => (
                              <div key={entry.id} className="border-r-4 border-brand-gold bg-white p-3 text-right">
                                <p className="text-xs font-black text-brand-dark">{entry.title}</p>
                                <p className="mt-1 text-[11px] font-bold text-slate-500">{entry.dateLabel} · {entry.detail || entry.type}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-3xl border border-slate-100 p-4">
                          <p className="mb-3 text-xs font-black text-brand-dark">إضافة محطة للعميل والمحامي</p>
                          <div className="grid gap-2">
                            <input
                              value={draft.title}
                              onChange={(event) => setTimelineDrafts((prev) => ({ ...prev, [caseItem.id]: { ...draft, title: event.target.value } }))}
                              placeholder="عنوان المحطة"
                              className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold"
                            />
                            <textarea
                              value={draft.detail}
                              onChange={(event) => setTimelineDrafts((prev) => ({ ...prev, [caseItem.id]: { ...draft, detail: event.target.value } }))}
                              placeholder="تفاصيل مختصرة"
                              rows={2}
                              className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold"
                            />
                            <button onClick={() => addAdminTimelineEntry(caseItem.id)} className="rounded-2xl bg-brand-navy px-4 py-2 text-xs font-black text-white">
                              إضافة للجدول
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'resources' && (
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <h4 className="text-lg font-black text-brand-dark">التصنيفات</h4>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={newCategory.name || ''} onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))} placeholder="اسم التصنيف" className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                    <select value={newCategory.type || 'case'} onChange={(event) => setNewCategory((prev) => ({ ...prev, type: event.target.value }))} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold">
                      <option value="case">قضايا</option>
                      <option value="service">خدمات</option>
                      <option value="content">محتوى</option>
                      <option value="contract">عقود</option>
                    </select>
                  </div>
                  <textarea value={newCategory.description || ''} onChange={(event) => setNewCategory((prev) => ({ ...prev, description: event.target.value }))} placeholder="وصف مختصر" rows={2} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                  <button onClick={addAdminCategory} className="rounded-2xl bg-brand-navy px-4 py-3 text-sm font-black text-white">إضافة تصنيف</button>
                </div>
                <div className="mt-5 space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                      <div>
                        <p className="text-sm font-black text-brand-dark">{category.name}</p>
                        <p className="text-[11px] font-bold text-slate-500">{category.type} · {category.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => toggleAdminCategory(category)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600">{category.active ? 'تعطيل' : 'تفعيل'}</button>
                        <button onClick={() => removeAdminCategory(category.id)} className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-black text-red-700">حذف</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <h4 className="text-lg font-black text-brand-dark">الصفحات ومحتوى الموقع</h4>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input value={newPage.title || ''} onChange={(event) => setNewPage((prev) => ({ ...prev, title: event.target.value }))} placeholder="عنوان الصفحة" className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                  <input value={newPage.route || ''} onChange={(event) => setNewPage((prev) => ({ ...prev, route: event.target.value }))} placeholder="/route" className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                  <button onClick={addAdminPage} className="rounded-2xl bg-brand-gold px-4 py-2 text-xs font-black text-brand-dark">إنشاء</button>
                </div>
                <div className="mt-5 space-y-3">
                  {pages.map((page) => (
                    <div key={page.id} className="rounded-3xl bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-brand-dark">{page.title}</p>
                          <p className="text-[11px] font-bold text-slate-500">{page.route} · {page.blocks?.length || 0} أقسام</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <select value={page.status} onChange={(event) => updateAdminPageStatus(page, event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black">
                            <option value="draft">مسودة</option>
                            <option value="published">منشورة</option>
                            <option value="archived">مؤرشفة</option>
                          </select>
                          <button onClick={() => addPageContentBlock(page)} className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-brand-navy">قسم جديد</button>
                          <button onClick={() => removeAdminPage(page.id)} className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-black text-red-700">حذف</button>
                        </div>
                      </div>
                      {(page.blocks || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(page.blocks || []).map((block) => (
                            <span key={block.id} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">{block.title || block.key}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 xl:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-lg font-black text-brand-dark">مكتبة الرفعات</h4>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{uploads.length} ملف</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {uploads.slice(0, 12).map((upload) => (
                    <div key={upload.id} className="rounded-3xl bg-slate-50 p-4">
                      <p className="truncate text-sm font-black text-brand-dark">{upload.originalName}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">{upload.purpose} · {upload.ownerName || 'بدون مالك'} · {(upload.size / 1024).toFixed(1)} KB</p>
                      <div className="mt-3 flex gap-2">
                        <a href={upload.url} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-brand-navy">فتح</a>
                        <button onClick={() => removeUpload(upload.id)} className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-black text-red-700">حذف</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'roles' && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-5">
                <h4 className="text-lg font-black text-brand-dark">الأدوار والصلاحيات</h4>
                <p className="text-sm font-bold text-slate-500">إدارة وصول الإدارة للموارد: مستخدمون، قضايا، محتوى، إعدادات، وملفات.</p>
              </div>
              <div className="mb-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[0.8fr_1fr_1.2fr_auto]">
                <input
                  value={newRole.key || ''}
                  onChange={(event) => setNewRole((prev) => ({ ...prev, key: event.target.value }))}
                  placeholder="role-key"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                />
                <input
                  value={newRole.label || ''}
                  onChange={(event) => setNewRole((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="اسم الدور"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                />
                <input
                  value={newRole.description || ''}
                  onChange={(event) => setNewRole((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="وصف مختصر"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                />
                <button onClick={addAdminRole} className="rounded-2xl bg-brand-navy px-4 py-2 text-xs font-black text-white">
                  إضافة دور
                </button>
              </div>
              <div className="grid gap-4">
                {roles.map((role) => (
                  <div key={role.id} className="rounded-[2rem] bg-slate-50 p-4">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-brand-dark">{role.label}</p>
                          {role.system && <span className="rounded-full bg-brand-gold/20 px-2 py-1 text-[10px] font-black text-brand-dark">نظامي</span>}
                          {!role.active && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">معطل</span>}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500">{role.description || role.key}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">{role.permissions?.length || 0} صلاحية</span>
                        <button
                          onClick={() => updateAdminRole(role, { active: !role.active })}
                          disabled={role.system}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {role.active ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button
                          onClick={() => removeAdminRole(role)}
                          disabled={role.system}
                          className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {permissions.map((permission) => (
                        <label key={`${role.id}-${permission.key}`} className="flex items-start gap-3 rounded-2xl bg-white p-3 text-right">
                          <input
                            type="checkbox"
                            checked={(role.permissions || []).includes(permission.key)}
                            onChange={() => toggleRolePermission(role, permission.key)}
                            disabled={role.system}
                            className="mt-1 h-4 w-4 accent-brand-navy"
                          />
                          <span>
                            <span className="block text-xs font-black text-brand-dark">{permission.label}</span>
                            <span className="block text-[10px] font-bold text-slate-500">{permission.group}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'system' && (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl bg-slate-50 p-6 border border-slate-200">
                <h4 className="text-lg font-black text-brand-dark mb-4">حالة البنية التحتية</h4>
                <div className="space-y-4">
                  {[
                    { label: 'اتصال قاعدة البيانات', status: 'Online', color: 'text-emerald-500' },
                    { label: 'خادم RAG (AI)', status: 'Optimal', color: 'text-emerald-500' },
                    { label: 'بوابة زين كاش', status: 'Active', color: 'text-emerald-500' },
                    { label: 'استهلاك الذاكرة', status: '42%', color: 'text-blue-500' },
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                      <span className="text-sm font-bold text-slate-500">{stat.label}</span>
                      <span className={`text-sm font-black ${stat.color}`}>{stat.status}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-3xl bg-slate-50 p-6 border border-slate-200">
                <h4 className="text-lg font-black text-brand-dark mb-4">أدوات المطورين</h4>
                <div className="grid gap-4">
                  <button onClick={clearSystemCache} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-brand-navy transition">
                    <span className="text-sm font-bold">تفريغ الذاكرة المؤقتة (Cache)</span>
                    <i className="fa-solid fa-broom text-slate-400"></i>
                  </button>
                  <button onClick={restartAiServices} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-red-500 transition group">
                    <span className="text-sm font-bold group-hover:text-red-600">إعادة تشغيل خدمات AI</span>
                    <i className="fa-solid fa-power-off text-slate-400 group-hover:text-red-500"></i>
                  </button>
                </div>
              </section>
              <section className="rounded-[2.5rem] bg-[#0a0f1a] p-8 border border-slate-800 xl:col-span-2 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-black text-emerald-400 font-mono tracking-tighter">/sys/logs live_stream</h4>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="bg-black/40 rounded-2xl p-6 font-mono text-[11px] h-80 overflow-y-auto custom-scrollbar space-y-2 border border-white/5">
                  {systemLogs.map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <span className="text-slate-600">[{log.time}]</span>
                      <span className={log.level === 'warn' ? 'text-amber-400' : 'text-blue-400'}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className={i === 0 ? "text-white font-bold" : "text-slate-400"}>{log.msg}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal for Legal Docs */}
        {docToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-right">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
              </div>
              <h3 className="text-xl font-bold text-brand-dark mb-2 text-center">حذف الوثيقة القانونية</h3>
              <p className="text-gray-500 mb-8 text-center text-sm">
                هل أنت متأكد من رغبتك في حذف هذا المرجع القانوني؟ قد يؤثر هذا على دقة نتائج البحث والذكاء الاصطناعي.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDocToDelete(null)}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDeleteDoc}
                  className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-md shadow-red-500/20"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legal Review Log Modal */}
        <AnimatePresence>
          {selectedReviewContract && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl text-right"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-brand-dark">سجل المراجعة القانونية</h3>
                  <button onClick={() => setSelectedReviewContract(null)} className="text-slate-400 hover:text-red-500 transition">
                    <i className="fa-solid fa-times text-xl"></i>
                  </button>
                </div>

                <p className="text-sm font-bold text-slate-500 mb-6 leading-relaxed">
                  ملاحظات المحامين المسجلة على عقد: <span className="text-brand-navy">{selectedReviewContract.carModel}</span>
                </p>

                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                  {selectedReviewContract.reviewNotes?.map((note, index) => (
                    <div key={index} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-brand-navy uppercase">{note.author}</span>
                        <span className="text-[10px] font-bold text-slate-400">{note.date}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{note.text}"</p>
                    </div>
                  ))}
                </div>
                <ActionButton onClick={() => setSelectedReviewContract(null)} variant="secondary" className="w-full mt-6 py-3">إغلاق</ActionButton>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="fixed bottom-6 right-6 z-[700] w-[calc(100%-3rem)] max-w-sm"
          >
            <div className={`rounded-[1.75rem] border p-4 text-right shadow-2xl backdrop-blur-xl ${activeToast.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : activeToast.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : activeToast.tone === 'danger'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-brand-navy/10 bg-white text-brand-dark'
              }`}>
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveToast(null)}
                  className="rounded-xl p-1 text-current opacity-45 transition hover:opacity-100"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
                <div className="flex-1">
                  <p className="text-sm font-black">{activeToast.title}</p>
                  <p className="mt-1 text-xs font-bold leading-6 opacity-80">{activeToast.message}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                  <i className={`fa-solid ${activeToast.tone === 'success' ? 'fa-circle-check text-emerald-600' : activeToast.tone === 'danger' ? 'fa-circle-exclamation text-red-600' : activeToast.tone === 'warning' ? 'fa-triangle-exclamation text-amber-600' : 'fa-bell text-brand-navy'}`}></i>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
