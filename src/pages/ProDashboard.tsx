import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'chart.js/auto';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNotifications, Notification as NotificationType } from '../context/NotificationContext';
import ActionButton from '../components/ui/ActionButton';
import NoticePanel from '../components/ui/NoticePanel';
import StatusBadge from '../components/ui/StatusBadge';
import apiClient from '../api/client';

interface Appointment {
  id: string;
  title: string;
  time: string;
  client: string;
  type: 'video' | 'chat' | 'doc';
}

interface CaseRecord {
  id: string;
  title: string;
  client: string;
  matter: string;
  status: 'Open' | 'In Review' | 'Closed' | 'At Risk';
  nextDeadline: string;
  priority: 'High' | 'Medium' | 'Low';
  riskScore: number;
  progress: number;
  billableHours: number;
  outstandingInvoice: number;
  isPinned: boolean;
  privateNote?: string;
}

interface ClientRecord {
  id: string;
  name: string;
  company: string;
  openCases: number;
  lastActivity: string;
  status: 'Active' | 'Pending' | 'At Risk';
}

interface TeamTask {
  id: string;
  title: string;
  assignee: string;
  due: string;
  status: 'todo' | 'in-progress' | 'done';
}

interface VaultDoc {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'word' | 'image';
  date: string;
  status: 'Draft' | 'Reviewed' | 'Signed' | 'Needs Review';
  caseTitle: string;
  owner: string;
  confidential: boolean;
}

interface InboxMessage {
  id: string;
  caseId: string;
  name: string;
  time: string;
  img: string;
  unread: boolean;
  text: string;
  priority: 'High' | 'Medium' | 'Low';
  channel: 'عميل' | 'شركة' | 'داخلي';
  caseTitle: string;
  awaitingResponse: boolean;
}

interface CaseTimelineEntry {
  id: string;
  caseId: string;
  date: string;
  title: string;
  detail: string;
  type: 'hearing' | 'filing' | 'note' | 'client';
  court: string;
  governorate: string;
}

interface DeadlineReminder {
  id: string;
  caseId: string;
  title: string;
  dueDate: string;
  urgency: 'critical' | 'upcoming' | 'routine';
  category: 'جلسة' | 'مرافعة' | 'تبليغ' | 'وكالة' | 'أتعاب';
  court: string;
  governorate: string;
}

type DashboardTab = 'overview' | 'cases' | 'messages' | 'earnings' | 'account';
type CaseViewFilter = 'all' | 'urgent' | 'pinned' | 'billing';
type VaultFilter = 'all' | 'needs-review' | 'signed' | 'confidential';
type InboxFilter = 'all' | 'unread' | 'urgent' | 'waiting';
type SavedViewId = 'today-work' | 'urgent-today' | 'awaiting-reply' | 'needs-review';

interface ProSummary {
  lawyerName: string;
  availableToWithdraw: number;
  pendingRevenue: number;
  monthlyEarnings: number;
  totalWithdrawn: number;
  totalCollected: number;
  totalAgreedRevenue: number;
  followers: number;
  newFollowersThisWeek: number;
  reviewCount: number;
  rating: number;
  subscriptionTier: string;
  nextBillingDate: string;
  activeCases: number;
  completedCases: number;
  payoutMethods: Array<{ id: string; label: string; value: string; recommended: boolean }>;
  usage: {
    activeCases: number;
    caseLimit: string;
    aiAssists: number;
    aiLimit: string;
  };
  recentTransactions: Array<{
    id: string;
    label: string;
    amount: number;
    status: string;
    type: string;
    date: string;
  }>;
}

const statusBadgeMap: Record<CaseRecord['status'], string> = {
  Open: 'bg-green-100 text-green-700',
  'In Review': 'bg-blue-100 text-blue-700',
  Closed: 'bg-gray-100 text-gray-700',
  'At Risk': 'bg-red-100 text-red-700'
};

const priorityBadgeMap: Record<CaseRecord['priority'], string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-gray-100 text-gray-700'
};

const vaultStatusLabelMap: Record<VaultDoc['status'], string> = {
  Draft: 'مسودة',
  Reviewed: 'تمت مراجعتها',
  Signed: 'موقعة',
  'Needs Review': 'تحتاج مراجعة'
};

const vaultStatusClassMap: Record<VaultDoc['status'], string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Reviewed: 'bg-blue-100 text-blue-700',
  Signed: 'bg-green-100 text-green-700',
  'Needs Review': 'bg-red-100 text-red-700'
};

function getFileIcon(type: VaultDoc['type']) {
  if (type === 'pdf') return 'fa-file-pdf text-red-500';
  if (type === 'word') return 'fa-file-word text-blue-500';
  return 'fa-file-image text-green-500';
}

const messagePriorityLabelMap: Record<InboxMessage['priority'], string> = {
  High: 'عاجلة',
  Medium: 'متوسطة',
  Low: 'عادية'
};

const messagePriorityClassMap: Record<InboxMessage['priority'], string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-gray-100 text-gray-700'
};

const tabs: Array<{ id: DashboardTab; label: string; icon: string; description: string }> = [
  { id: 'overview', label: 'نظرة عامة', icon: 'fa-grid-2', description: 'الأولويات، الدخل، والمهام الحالية' },
  { id: 'cases', label: 'القضايا', icon: 'fa-briefcase', description: 'إدارة الملفات النشطة والتاريخية' },
  { id: 'messages', label: 'الرسائل', icon: 'fa-inbox', description: 'تواصل العملاء وردودك السريعة' },
  { id: 'earnings', label: 'الأرباح', icon: 'fa-wallet', description: 'الإيرادات والسحب والتحويلات' },
  { id: 'account', label: 'الحساب', icon: 'fa-user-gear', description: 'المتابعون والاشتراك والإعدادات' }
];

const quickActions = [
  { icon: 'fa-folder-plus', label: 'قضية جديدة' },
  { icon: 'fa-envelope-open-text', label: 'رد على عميل' },
  { icon: 'fa-money-bill-transfer', label: 'طلب سحب' },
  { icon: 'fa-file-circle-check', label: 'مراجعة حالة' },
  { icon: 'fa-robot', label: 'مساعد AI' }
];

const todayAgenda = [
  { title: 'جلسة المحكمة التجارية', time: '10:00 ص', detail: 'قضية تعويض عمل - القاعة 2', icon: 'fa-building-columns' },
  { title: 'مراجعة مستندات العقد', time: '12:30 م', detail: 'شركة النور - اعتماد نهائي', icon: 'fa-file-signature' },
  { title: 'اتصال متابعة مع العميل', time: '02:00 م', detail: 'عبدالله الراشدي - تحديث موقف القضية', icon: 'fa-phone-volume' }
];

const responseTemplates = [
  'تم استلام رسالتكم، وسأراجع الموضوع اليوم وأوافيكم بالرد القانوني المناسب.',
  'أحتاج نسخة من المستندات المؤيدة والوكالة إن وجدت حتى أتمكن من إبداء الرأي بدقة.',
  'تم تثبيت موعد الجلسة وسأشارككم الملاحظات والإجراءات المطلوبة قبل الموعد مباشرة.',
  'يرجى تزويدي بصورة الهوية والوثائق الأصلية لإكمال الإجراء أمام المحكمة المختصة.'
];

function SurfaceCard({ title, description, actions, children, className = '' }: { title: string, description?: string, actions?: React.ReactNode, children: React.ReactNode, className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-50 bg-slate-50/30 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between text-right">
        <div>
          <h3 className="text-lg font-black text-brand-dark">{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-500 font-bold">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function ListWorkspaceHeader({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  stats,
  primaryAction,
  secondaryActions,
}: {
  title: string;
  description: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters: Array<{ id: string; label: string; count: number; active: boolean; onClick: () => void }>;
  stats: Array<{ label: string; value: number; tone?: string }>;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-right">
          <h3 className="text-lg font-bold text-brand-dark">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:flex-wrap">
          {secondaryActions}
          <div className="relative w-full min-w-0 sm:min-w-[280px] xl:w-auto">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"></i>
            <input
              value={searchValue}
              onChange={event => onSearchChange(event.target.value)}
              type="text"
              placeholder={searchPlaceholder}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-right focus:border-brand-gold focus:outline-none"
            />
          </div>
          {primaryAction}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-gray-50 p-3 text-center">
            <p className={`text-xl font-bold ${stat.tone ?? 'text-brand-dark'}`}>{stat.value}</p>
            <p className="text-[10px] text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map(filter => (
          <button
            key={filter.id}
            type="button"
            onClick={filter.onClick}
            className={`rounded-full px-3 py-2 text-xs font-bold transition ${filter.active ? 'bg-brand-navy text-white' : 'border border-gray-200 bg-gray-50 text-gray-700 hover:border-brand-gold hover:bg-white'}`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>
    </section>
  );
}

function WorkspacePreviewPanel({
  eyebrow,
  title,
  subtitle,
  status,
  summary,
  meta,
  nextStep,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  status?: React.ReactNode;
  summary: React.ReactNode;
  meta: Array<{ label: string; value: React.ReactNode }>;
  nextStep: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-bold text-brand-dark">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        {status}
      </div>
      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
        {summary}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {meta.map((item) => (
          <div key={item.label} className="rounded-2xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="mt-1 font-bold text-brand-dark">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-brand-navy/5 p-4 text-sm text-brand-dark">{nextStep}</div>
      <div className="mt-4 grid grid-cols-2 gap-2">{actions}</div>
    </div>
  );
}

export default function ProDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [summary, setSummary] = useState<ProSummary | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);
  const [caseTimeline, setCaseTimeline] = useState<CaseTimelineEntry[]>([]);
  const [deadlineReminders, setDeadlineReminders] = useState<DeadlineReminder[]>([]);

  const fetchWorkspaceData = async (showLoader = false) => {
    if (showLoader) {
      setIsInitialLoading(true);
    }

    try {
      const response = await apiClient.getProWorkspace();
      applyWorkspaceData(response.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      if (showLoader) {
        setIsInitialLoading(false);
      }
    }
  };

  const applyWorkspaceData = (data: any) => {
    setSummary(data.summary || null);
    setCases(data.cases || []);
    setAppointments(data.appointments || []);
    setClients(data.clients || []);
    setTeamTasks(data.teamTasks || []);
    setInboxMessages(data.inboxMessages || []);
    setVaultDocs(data.vaultDocs || []);
    setCaseTimeline(data.caseTimeline || []);
    setDeadlineReminders(data.deadlineReminders || []);
  };

  // Data Fetching Hook
  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async (showLoader = false) => {
      try {
        if (showLoader && isMounted) {
          setIsInitialLoading(true);
        }

        const response = await apiClient.getProWorkspace();
        if (!isMounted) return;
        applyWorkspaceData(response.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        if (showLoader && isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(false);
      }
    };

    fetchDashboardData(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(false);
      }
    }, 5000);

    window.addEventListener('focus', handleVisibilityRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, []);
  const nextPriorityCase = useMemo(
    () => [...cases].sort((left, right) => right.riskScore - left.riskScore)[0],
    [cases]
  );
  const [isAddApptModalOpen, setIsAddApptModalOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({ title: '', time: '', client: '', type: 'video' as Appointment['type'] });
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [newCase, setNewCase] = useState({ title: '', client: '', matter: '', priority: 'Medium' as CaseRecord['priority'] });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedVaultDocId, setSelectedVaultDocId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [caseViewMode, setCaseViewMode] = useState<'list' | 'workbench'>('list');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [searchVaultTerm, setSearchVaultTerm] = useState('');
  const [searchInboxTerm, setSearchInboxTerm] = useState('');
  const [caseViewFilter, setCaseViewFilter] = useState<CaseViewFilter>('all');
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>('all');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) setSelectedCaseId(cases[0].id);
  }, [cases, selectedCaseId]);

  useEffect(() => {
    if (!selectedVaultDocId && vaultDocs.length > 0) setSelectedVaultDocId(vaultDocs[0].id);
  }, [selectedVaultDocId, vaultDocs]);

  useEffect(() => {
    if (!activeMessageId && inboxMessages.length > 0) setActiveMessageId(inboxMessages[0].id);
  }, [activeMessageId, inboxMessages]);

  const [displayMode, setDisplayMode] = useState<'compact' | 'comfortable'>('comfortable');
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [recentActivities] = useState([
    { id: '1', type: 'doc', text: 'قام العميل أحمد برفع مسودة العقد النهائية', time: 'منذ ١٠ دقائق', icon: 'fa-file-arrow-up', color: 'text-blue-500' },
    { id: '2', type: 'billing', text: 'تم استلام دفعة مالية بقيمة ٥٠٠,٠٠٠ د.ع من شركة النور', time: 'منذ ساعة', icon: 'fa-circle-check', color: 'text-emerald-500' },
    { id: '3', type: 'case', text: 'تنبيه: اقتراب موعد جلسة قضية تعويض العمل', time: 'منذ ٣ ساعات', icon: 'fa-triangle-exclamation', color: 'text-red-500' },
  ]);

  const [lastDeletedCases, setLastDeletedCases] = useState<CaseRecord[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isAiUsingContext, setIsAiUsingContext] = useState(true);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeTimerCaseId, setActiveTimerCaseId] = useState<string | null>(null);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let interval: number;
    if (isTimerRunning) {
      interval = window.setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return [];

    const items = [
      ...cases.map((c) => ({ id: c.id, type: 'قضية', title: c.title, subtitle: c.client, icon: 'fa-briefcase', action: () => { setSelectedCaseId(c.id); setActiveTab('cases'); setIsCommandPaletteOpen(false); setCommandQuery(''); } })),
      ...vaultDocs.map((d) => ({ id: d.id, type: 'وثيقة', title: d.name, subtitle: d.caseTitle, icon: 'fa-file-lines', action: () => { setSelectedVaultDocId(d.id); setSelectedCaseId(cases.find(caseItem => caseItem.title === d.caseTitle)?.id ?? selectedCaseId); setActiveTab('cases'); setCaseViewMode('workbench'); setIsCommandPaletteOpen(false); setCommandQuery(''); } })),
      ...inboxMessages.map((m) => ({ id: m.id, type: 'رسالة', title: m.name, subtitle: m.text, icon: 'fa-envelope', action: () => { setActiveMessageId(m.id); setActiveTab('messages'); setIsCommandPaletteOpen(false); setCommandQuery(''); } })),
    ];

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
    );
  }, [commandQuery, cases, vaultDocs, inboxMessages, selectedCaseId]);

  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [activeQuickAction, setActiveQuickAction] = useState('');
  const [quickActionNote, setQuickActionNote] = useState('اختر إجراءً سريعًا لبدء العمل.');
  const [aiPrompt, setAiPrompt] = useState('تلخيص حالة القضية الأخيرة');
  const [aiResponse, setAiResponse] = useState('هنا يظهر ملخص الذكاء الاصطناعي بعد التشغيل، مع أهم النقاط والإجراءات المقترحة.');
  const [isAiRunning, setIsAiRunning] = useState(false);
  const { notifications, unreadCount, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications, NotificationBell } = useNotifications();
  const [caseNote, setCaseNote] = useState('');
  const [workbenchReply, setWorkbenchReply] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [activeSavedView, setActiveSavedView] = useState<SavedViewId>('urgent-today');
  const [activeToast, setActiveToast] = useState<NotificationType | null>(null);

  const selectedCase = useMemo(
    () => cases.find(caseItem => caseItem.id === selectedCaseId) ?? cases[0],
    [cases, selectedCaseId]
  );
  const selectedVaultDoc = useMemo(
    () => vaultDocs.find(doc => doc.id === selectedVaultDocId) ?? vaultDocs[0],
    [vaultDocs, selectedVaultDocId]
  );
  const selectedInboxMessage = useMemo(
    () => inboxMessages.find(message => message.id === activeMessageId) ?? inboxMessages[0],
    [inboxMessages, activeMessageId]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const base = hour < 12 ? 'صباح الخير' : hour < 18 ? 'طاب يومك' : 'مساء الخير';
    return `${base} دكتور ${user?.name?.split(' ')[0] || 'عمر'}`;
  }, [user]);

  const caseRelatedDocs = useMemo(() => vaultDocs.filter(d => d.caseTitle === selectedCase?.title), [vaultDocs, selectedCase]);
  const caseRelatedMessages = useMemo(() => inboxMessages.filter(m => m.caseTitle === selectedCase?.title), [inboxMessages, selectedCase]);

  const selectedCaseTimeline = caseTimeline.filter(entry => entry.caseId === selectedCase?.id);
  const selectedCaseReminders = deadlineReminders.filter(reminder => reminder.caseId === selectedCase?.id);
  const linkedMessageCase = cases.find(
    caseItem =>
      caseItem.id === selectedInboxMessage?.caseId ||
      caseItem.title === selectedInboxMessage?.caseTitle,
  );
  const replyTargetCase = linkedMessageCase ?? selectedCase ?? null;
  const canSendInboxReply = Boolean(
    replyDraft.trim() &&
    selectedInboxMessage &&
    (selectedInboxMessage?.caseId || linkedMessageCase?.id || selectedCase?.id),
  );
  const replyDraftLength = replyDraft.trim().length;

  const urgentCases = cases.filter(caseItem => caseItem.status === 'At Risk' || caseItem.priority === 'High');
  const pinnedCases = cases.filter(caseItem => caseItem.isPinned);
  const outstandingBillingCases = cases.filter(caseItem => caseItem.outstandingInvoice > 0);
  const unreadMessagesCount = inboxMessages.filter(message => message.unread).length;
  const urgentInboxCount = inboxMessages.filter(message => message.priority === 'High').length;
  const waitingReplyCount = inboxMessages.filter(message => message.awaitingResponse).length;
  const openTasksCount = teamTasks.filter(task => task.status !== 'done').length;
  const docsNeedingReviewCount = vaultDocs.filter(doc => doc.status === 'Needs Review').length;
  const confidentialDocsCount = vaultDocs.filter(doc => doc.confidential).length;
  const signedDocsCount = vaultDocs.filter(doc => doc.status === 'Signed').length;
  const billableHoursTotal = cases.reduce((sum, caseItem) => sum + caseItem.billableHours, 0);
  const outstandingInvoiceTotal = cases.reduce((sum, caseItem) => sum + caseItem.outstandingInvoice, 0);
  const availableToWithdraw = summary?.availableToWithdraw ?? 0;
  const pendingRevenue = summary?.pendingRevenue ?? outstandingInvoiceTotal;
  const monthlyEarnings = summary?.monthlyEarnings ?? 0;
  const totalWithdrawn = summary?.totalWithdrawn ?? 0;
  const followersCount = summary?.followers ?? 0;
  const newFollowersThisWeek = summary?.newFollowersThisWeek ?? 0;
  const reviewCount = summary?.reviewCount ?? 0;
  const ratingValue = summary?.rating ?? 0;
  const subscriptionTier = summary?.subscriptionTier ?? 'basic';

  const searchableCases = cases.filter(caseItem => {
    const query = workspaceSearch.trim().toLowerCase();
    if (!query) return true;
    return [caseItem.title, caseItem.client, caseItem.matter].some(value => value.toLowerCase().includes(query));
  });

  const filteredCases = searchableCases.filter(caseItem => {
    if (caseViewFilter === 'urgent') return caseItem.status === 'At Risk' || caseItem.priority === 'High';
    if (caseViewFilter === 'pinned') return caseItem.isPinned;
    if (caseViewFilter === 'billing') return caseItem.outstandingInvoice > 0;
    return true;
  });

  const filteredVaultDocs = vaultDocs.filter(doc => {
    const matchesSearch = [doc.name, doc.caseTitle, doc.owner].some(value => value.toLowerCase().includes(searchVaultTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (vaultFilter === 'needs-review') return doc.status === 'Needs Review';
    if (vaultFilter === 'signed') return doc.status === 'Signed';
    if (vaultFilter === 'confidential') return doc.confidential;
    return true;
  });

  const filteredInboxMessages = inboxMessages.filter(message => {
    const matchesSearch = [message.name, message.text, message.caseTitle, message.channel].some(value => value.toLowerCase().includes(searchInboxTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (inboxFilter === 'unread') return message.unread;
    if (inboxFilter === 'urgent') return message.priority === 'High';
    if (inboxFilter === 'waiting') return message.awaitingResponse;
    return true;
  });

  const caseFilters = [
    { id: 'all' as const, label: 'كل القضايا', count: cases.length },
    { id: 'urgent' as const, label: 'العاجلة', count: urgentCases.length },
    { id: 'pinned' as const, label: 'المثبّتة', count: pinnedCases.length },
    { id: 'billing' as const, label: 'المالية', count: outstandingBillingCases.length }
  ];

  const inboxFilters = [
    { id: 'all' as const, label: 'الكل', count: inboxMessages.length },
    { id: 'unread' as const, label: 'غير المقروءة', count: unreadMessagesCount },
    { id: 'urgent' as const, label: 'العاجلة', count: urgentInboxCount },
    { id: 'waiting' as const, label: 'بانتظار رد', count: waitingReplyCount }
  ];

  const vaultFilters = [
    { id: 'all' as const, label: 'الكل', count: vaultDocs.length },
    { id: 'needs-review' as const, label: 'تحتاج مراجعة', count: docsNeedingReviewCount },
    { id: 'signed' as const, label: 'موقعة', count: signedDocsCount },
    { id: 'confidential' as const, label: 'سرية', count: confidentialDocsCount }
  ];

  const aiPromptSuggestions = [
    'استخراج المخاطر القانونية من عقد الإيجار',
    'صياغة رد قانوني على رسالة العميل',
    'تلخيص حالة القضية استعداداً للاجتماع',
    'صياغة نقاط دفاعية سريعة للنهج التعاقدي',
    'مراجعة التزامات الأطراف الرئيسية في العقد'
  ];

  const professionalAdvices = [
    { id: 1, text: "قم بمراجعة المواعيد النهائية للقضايا عالية المخاطر أولاً لتجنب أي فوات للمدد القانونية.", icon: "fa-triangle-exclamation", color: "text-red-500" },
    { id: 2, text: "استخدم مساعد AI لتلخيص العقود الطويلة؛ سيوفر لك ذلك وقتاً ثميناً للتركيز على استراتيجية المرافعة.", icon: "fa-robot", color: "text-brand-navy" },
    { id: 3, text: "تأكد من تحديث الساعات القابلة للفوترة بشكل يومي لضمان دقة التحصيل المالي لمكتبك.", icon: "fa-clock", color: "text-emerald-500" },
    { id: 4, text: "تنظيم المستندات في مجلدات رقمية مخصصة يسهل الوصول للمعلومات أثناء جلسات الاستماع الحرجة.", icon: "fa-folder-tree", color: "text-brand-gold" }
  ];

  // Mock data for Heatmap
  const activityHeatmap = useMemo(() => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return Array.from({ length: 7 }, (_, i) => ({
      day: days[i],
      values: Array.from({ length: 12 }, () => Math.floor(Math.random() * 5))
    }));
  }, []);

  const toggleCaseSelection = (id: string) => {
    const newSelection = new Set(selectedCases);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedCases(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedCases.size === filteredCases.length) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(filteredCases.map(c => c.id)));
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const topStats = useMemo(
    () => [
      { label: 'قضايا عاجلة', value: urgentCases.length, note: 'تحتاج معالجة فورية', icon: 'fa-solid fa-fire-extinguisher', tone: 'text-red-600', progress: 65, color: 'bg-red-500' },
      { label: 'رسائل جديدة', value: unreadMessagesCount, note: `${waitingReplyCount} بانتظار رد`, icon: 'fa-solid fa-envelope-open-text', tone: 'text-brand-navy', progress: 40, color: 'bg-brand-navy' },
      { label: 'الأرباح المتاحة', value: Math.round(availableToWithdraw / 1000), note: 'بالألف د.ع قابلة للسحب', icon: 'fa-solid fa-wallet', tone: 'text-emerald-600', progress: 72, color: 'bg-emerald-500' },
      { label: 'المتابعون', value: followersCount, note: `${newFollowersThisWeek} هذا الأسبوع`, icon: 'fa-solid fa-user-group', tone: 'text-amber-600', progress: 28, color: 'bg-amber-500' },
    ],
    [availableToWithdraw, followersCount, newFollowersThisWeek, unreadMessagesCount, urgentCases.length, waitingReplyCount]
  );

  const handleBulkStatusUpdate = async (newStatus: CaseRecord['status']) => {
    await apiClient.bulkUpdateProCaseStatus(Array.from(selectedCases), newStatus);
    setCases(prev => prev.map(c =>
      selectedCases.has(c.id) ? { ...c, status: newStatus } : c
    ));
    setSelectedCases(new Set());
    setIsBulkStatusModalOpen(false);
    setQuickActionNote(`تم تحديث حالة ${selectedCases.size} قضية بنجاح.`);
  };

  const handleBulkDelete = async () => {
    const casesToDelete = cases.filter(c => selectedCases.has(c.id));
    await apiClient.bulkDeleteProCases(Array.from(selectedCases));
    setLastDeletedCases(casesToDelete);
    setCases(prev => prev.filter(c => !selectedCases.has(c.id)));
    setSelectedCases(new Set());
    setShowUndoToast(true);
    setTimeout(() => setShowUndoToast(false), 6000);
  };

  const handleUndoDelete = () => {
    if (lastDeletedCases.length === 0) return;
    setCases(prev => [...lastDeletedCases, ...prev]);
    setLastDeletedCases([]);
    setShowUndoToast(false);
    recentActivities.shift(); // Remove the delete log
  };

  useEffect(() => {
    if (activeTab !== 'overview' || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: ['الإجمالي المتفق', 'المحصل', 'المتاح للسحب', 'المعلق', 'المسحوب'],
        datasets: [{
          label: 'الإيرادات (ألف دينار)',
          data: [
            Number((summary?.totalAgreedRevenue ?? 0) / 1000),
            Number((summary?.totalCollected ?? 0) / 1000),
            Number((availableToWithdraw ?? 0) / 1000),
            Number((pendingRevenue ?? 0) / 1000),
            Number((totalWithdrawn ?? 0) / 1000),
          ],
          borderColor: '#1A237E',
          backgroundColor: 'rgba(26, 35, 126, 0.08)',
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#C5A059',
          pointBorderColor: '#FFF',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            backgroundColor: '#1B365D',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 12,
            displayColors: false,
            callbacks: {
              label: (context) => {
                const val = context.parsed.y;
                return `القيمة: ${val.toLocaleString('ar-IQ')} ألف د.ع`;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E5E7EB' } },
          x: { grid: { display: false } }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [activeTab, availableToWithdraw, pendingRevenue, summary, totalWithdrawn]);

  const handleQuickAction = (label: string) => {
    setActiveSavedView('today-work');
    setActiveQuickAction(label);
    switch (label) {
      case 'قضية جديدة':
        setActiveTab('cases');
        setIsNewCaseModalOpen(true);
        setQuickActionNote('تم تحويلك مباشرة إلى تبويب القضايا لبدء إنشاء ملف جديد.');
        break;
      case 'رد على عميل':
        setActiveTab('messages');
        setActiveMessageId(inboxMessages[0]?.id ?? null);
        setQuickActionNote('تبويب التواصل مفتوح مع أحدث رسالة لبدء الرد السريع.');
        break;
      case 'طلب سحب':
        setActiveTab('earnings');
        setQuickActionNote('قسم الأرباح مفتوح الآن لمراجعة الرصيد القابل للسحب والتحويلات الأخيرة.');
        break;
      case 'مراجعة حالة':
        setActiveTab('cases');
        setCaseViewFilter('urgent');
        setCaseViewMode('list');
        setQuickActionNote('تم فتح طابور القضايا الأكثر احتياجاً لتدخلك الآن.');
        break;
      case 'مساعد AI':
        setActiveTab('account');
        setQuickActionNote('تم فتح قسم التشغيل حيث المساعد جاهز للتحليل وإنتاج المسودات.');
        break;
    }
  };

  const handleStatClick = (label: string) => {
    if (label === 'قضايا عاجلة') {
      setActiveSavedView('urgent-today');
      setActiveTab('cases');
      setCaseViewFilter('urgent');
      setCaseViewMode('list');
    } else if (label === 'رسائل جديدة') {
      setActiveSavedView('awaiting-reply');
      setActiveTab('messages');
      setInboxFilter('unread');
    } else if (label === 'الأرباح المتاحة') {
      setActiveTab('earnings');
    } else if (label === 'المتابعون') {
      setActiveTab('account');
    }
  };

  const handleOpenSavedView = (view: SavedViewId) => {
    setActiveSavedView(view);
    if (view === 'today-work') {
      setActiveTab('cases');
      setCaseViewMode('list');
      setCaseViewFilter('all');
      setInboxFilter('all');
      setVaultFilter('all');
      return;
    }
    if (view === 'urgent-today') {
      setActiveTab('cases');
      setCaseViewMode('list');
      setCaseViewFilter('urgent');
      return;
    }
    if (view === 'awaiting-reply') {
      setActiveTab('messages');
      setInboxFilter('waiting');
      return;
    }
    setActiveTab('cases');
    setCaseViewMode('workbench');
  };

  const savedViews = [
    { id: 'today-work' as const, label: 'طابور اليوم', note: 'كل الملفات المفتوحة', count: cases.length },
    { id: 'urgent-today' as const, label: 'العاجلة اليوم', note: 'قضايا عالية الخطورة', count: urgentCases.length },
    { id: 'awaiting-reply' as const, label: 'بانتظار رد', note: 'رسائل تحتاج متابعة', count: waitingReplyCount },
    { id: 'needs-review' as const, label: 'تحتاج مراجعة', note: 'وثائق معلقة', count: docsNeedingReviewCount },
  ];

  const handleToggleTimer = (caseId: string) => {
    if (activeTimerCaseId === caseId) {
      setIsTimerRunning(!isTimerRunning);
    } else {
      setActiveTimerCaseId(caseId);
      setTimerSeconds(0);
      setIsTimerRunning(true);
    }
  };

  const handleRunAiSummary = () => {
    setIsAiRunning(true);
    setAiResponse('جاري تحليل المعلومات...');
    setTimeout(() => {
      setAiResponse('نقطة التنفيذ: راجع الملفات المفتوحة قبل 24 أبريل، فعّل متابعة KYC للعميل عالي المخاطر، وجدول اتصالاً سريعاً لإغلاق الملاحظات التعاقدية.');
      setIsAiRunning(false);
    }, 900);
  };

  const handleAddCase = async () => {
    if (!newCase.title || !newCase.client || !newCase.matter) return;
    const response = await apiClient.createProCase(newCase);
    applyWorkspaceData(response.data);
    setSelectedCaseId(response.data?.cases?.[0]?.id ?? null);
    setIsNewCaseModalOpen(false);
    setNewCase({ title: '', client: '', matter: '', priority: 'Medium' });
    setQuickActionNote('تم إنشاء قضية جديدة ويمكن متابعتها من جدول القضايا فوراً.');
  };

  const handleAddAppointment = async () => {
    if (!newAppt.title || !newAppt.time) return;
    const response = await apiClient.createProAppointment(newAppt);
    applyWorkspaceData(response.data);
    setIsAddApptModalOpen(false);
    setNewAppt({ title: '', time: '', client: '', type: 'video' });
  };

  const handleVaultUpload = async () => {
    const response = await apiClient.uploadProVaultDocument(selectedCase?.id ?? null);
    applyWorkspaceData(response.data);
    setSelectedVaultDocId(response.data?.vaultDocs?.[0]?.id ?? null);
    setActiveTab('cases');
    setCaseViewMode('workbench');
  };

  const handleMarkMessageRead = async (messageId: string) => {
    await apiClient.updateProMessageState(messageId, { unread: false });
    setInboxMessages(prev => prev.map(message => (message.id === messageId ? { ...message, unread: false } : message)));
  };

  const handleToggleAwaitingResponse = async (messageId: string) => {
    const target = inboxMessages.find(message => message.id === messageId);
    await apiClient.updateProMessageState(messageId, {
      awaitingResponse: !target?.awaitingResponse,
      unread: false,
    });
    setInboxMessages(prev => prev.map(message => (
      message.id === messageId ? { ...message, awaitingResponse: !message.awaitingResponse, unread: false } : message
    )));
  };

  const handleUseReplyTemplate = (template: string) => {
    const prefix = selectedInboxMessage ? `إلى ${selectedInboxMessage.name}:\n` : '';
    setReplyDraft(`${prefix}${template}`);
  };

  const handleSendInboxReply = async () => {
    const targetCaseId = selectedInboxMessage?.caseId || linkedMessageCase?.id || selectedCase?.id;
    if (!replyDraft.trim() || !selectedInboxMessage || !targetCaseId) return;

    setIsSendingReply(true);
    try {
      await apiClient.addCaseMessage(targetCaseId, replyDraft.trim(), 'lawyer');
      await apiClient.updateProMessageState(selectedInboxMessage.id, {
        unread: false,
        awaitingResponse: false,
      });
      await fetchWorkspaceData(false);
      setReplyDraft('');
      setSelectedCaseId(targetCaseId);
      setQuickActionNote(`تم إرسال الرد إلى ${selectedInboxMessage.name} وسيظهر لدى العميل مباشرة.`);
    } catch (err) {
      console.error("Failed to send inbox reply", err);
      setQuickActionNote('تعذر إرسال الرد حالياً. حاول مرة أخرى.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleUpdateCaseProgress = async (caseId: string, progress: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`/api/app/workspace/cases/${caseId}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ progress })
      });
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, progress } : c));
      setQuickActionNote(`تم حفظ نسبة الإنجاز الجديدة: ${progress}%.`);
    } catch (err) {
      console.error("Failed to persist progress", err);
    }
  };

  const handleUpdateCaseStatus = async (caseId: string, newStatus: CaseRecord['status']) => {
    try {
      await apiClient.bulkUpdateProCaseStatus([caseId], newStatus);
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus } : c));
      setQuickActionNote(`تم تغيير حالة الملف إلى: ${newStatus}.`);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleSavePrivateNote = async () => {
    if (!selectedCase) return;
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`/api/app/workspace/cases/${selectedCase.id}/private-note`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ note: caseNote })
      });
      setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, privateNote: caseNote } : c));
      setQuickActionNote('تم حفظ الملاحظة الخاصة بنجاح.');
    } catch (err) {
      console.error("Failed to save note", err);
    }
  };

  const handleSendWorkbenchMessage = async () => {
    if (!workbenchReply.trim() || !selectedCase) return;
    try {
      const outgoingText = workbenchReply.trim();
      await apiClient.addCaseMessage(selectedCase.id, outgoingText, 'lawyer');
      await fetchWorkspaceData(false);
      setWorkbenchReply('');
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const renderCaseWorkbench = () => (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-row-reverse items-start gap-4">
            <button
              onClick={() => setCaseViewMode('list')}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-brand-navy/20 hover:bg-white hover:text-brand-navy"
            >
              <i className="fa-solid fa-arrow-right"></i>
            </button>
            <div className="text-right">
              <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                <div className="relative group/status">
                  <button className={`rounded-full px-3 py-1 text-[10px] font-black uppercase flex items-center gap-1.5 transition-transform hover:scale-[1.02] ${statusBadgeMap[selectedCase.status]}`}>
                    {selectedCase.status}
                    <i className="fa-solid fa-chevron-down text-[7px] opacity-50"></i>
                  </button>
                  <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-slate-100 shadow-xl rounded-xl py-1 z-50 opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all">
                    {(['Open', 'In Review', 'Closed', 'At Risk'] as CaseRecord['status'][]).map(s => (
                      <button key={s} onClick={() => handleUpdateCaseStatus(selectedCase.id, s)} className="w-full px-3 py-1.5 text-right text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black ${priorityBadgeMap[selectedCase.priority]}`}>{selectedCase.priority}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">{selectedCase.nextDeadline}</span>
              </div>
              <h2 className="text-2xl font-black text-brand-dark">{selectedCase.title}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{selectedCase.client} • {selectedCase.matter}</p>
              <p className="mt-3 max-w-3xl text-xs font-bold leading-6 text-slate-500">
                ابدأ من الإجراء التالي الواضح: راجع الرسالة أو المستند أو الفاتورة الأقرب لهذه القضية، ثم حدّث التقدم من نفس الشاشة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {activeTimerCaseId === selectedCase.id && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${isTimerRunning ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                <i className="fa-solid fa-stopwatch text-xs"></i>
                <span className="text-xs font-mono font-black">{formatTimer(timerSeconds)}</span>
              </div>
            )}
            <button
              onClick={() => handleToggleTimer(selectedCase.id)}
              className={`rounded-xl px-4 py-2.5 text-xs font-black transition-all shadow-sm active:scale-95 ${isTimerRunning && activeTimerCaseId === selectedCase.id ? 'bg-red-500 text-white shadow-red-200' : 'bg-emerald-500 text-white shadow-emerald-200'}`}
            >
              <i className={`fa-solid ${isTimerRunning && activeTimerCaseId === selectedCase.id ? 'fa-pause' : 'fa-play'} ml-2`}></i>
              {isTimerRunning && activeTimerCaseId === selectedCase.id ? 'إيقاف' : 'بدء التوقيت'}
            </button>
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition hover:border-brand-navy/20 hover:bg-slate-50 hover:text-brand-navy">تصدير التقرير</button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">الإجراء التالي</p>
            <p className="mt-2 text-sm font-black text-brand-dark">{caseRelatedMessages.length > 0 ? 'راجع آخر رسالة ثم أرسل تحديثاً' : 'ابدأ بإضافة مستند أو ملاحظة داخلية'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">الفوترة</p>
            <p className="mt-2 text-sm font-black text-brand-dark">{selectedCase.outstandingInvoice.toLocaleString()} د.ع مستحق</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">الرسائل</p>
            <p className="mt-2 text-sm font-black text-brand-dark">{caseRelatedMessages.length} رسالة مرتبطة</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">المستندات</p>
            <p className="mt-2 text-sm font-black text-brand-dark">{caseRelatedDocs.length} ملف داخل القضية</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SurfaceCard
              title="رد سريع للعميل"
              description="كل ما تحتاجه للرد أو طلب مستند من داخل نفس المساحة."
              className="flex flex-col"
            >
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {responseTemplates.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setWorkbenchReply(t)}
                    className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-500 transition hover:border-brand-navy/20 hover:bg-white hover:text-brand-navy"
                    title={t}
                  >
                    {t.substring(0, 20)}...
                  </button>
                ))}
              </div>
              <div className="space-y-3 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {caseRelatedMessages.length > 0 ? caseRelatedMessages.map(msg => {
                  const isMe = msg.name === user?.name;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[88%] rounded-[1.35rem] px-4 py-3 text-right text-xs font-bold leading-6 shadow-sm ${isMe ? 'bg-white border border-slate-200 text-slate-700' : 'bg-brand-navy text-white'}`}>
                        <div className={`mb-1 text-[10px] font-black ${isMe ? 'text-slate-400' : 'text-white/70'}`}>{isMe ? 'أنت' : msg.name} • {msg.time}</div>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-10 text-center text-slate-300">
                    <i className="fa-solid fa-comments mb-3 block text-3xl opacity-20"></i>
                    <p className="text-xs font-bold">ابدأ أول رد داخل هذه القضية</p>
                  </div>
                )}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="relative">
                  <textarea
                    rows={3}
                    value={workbenchReply}
                    onChange={(e) => setWorkbenchReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendWorkbenchMessage();
                      }
                    }}
                    placeholder="اكتب تحديثاً أو طلباً واضحاً للعميل..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 pl-14 text-sm text-right outline-none resize-none transition focus:border-brand-navy focus:bg-white"
                  />
                  <button
                    onClick={handleSendWorkbenchMessage}
                    disabled={!workbenchReply.trim()}
                    className="absolute left-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy text-white text-xs shadow-md transition hover:scale-105 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard
              title="مستندات القضية"
              description="الوثائق الأساسية فقط حتى لا يصبح العرض مزدحماً."
              actions={<button onClick={handleVaultUpload} className="rounded-xl bg-brand-navy/5 px-3 py-2 text-[10px] font-black text-brand-navy transition hover:bg-brand-navy/10">رفع جديد</button>}
            >
              <div className="space-y-3">
                {caseRelatedDocs.length > 0 ? caseRelatedDocs.slice(0, 5).map(doc => (
                  <div key={doc.id} className="flex flex-row-reverse items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 px-3 py-3 transition hover:bg-white">
                    <div className="flex flex-row-reverse items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                        <i className={`fa-solid ${getFileIcon(doc.type).split(' ')[0]} ${getFileIcon(doc.type).split(' ')[1]} text-base`}></i>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-brand-dark">{doc.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{doc.date}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${vaultStatusClassMap[doc.status]}`}>{vaultStatusLabelMap[doc.status]}</span>
                  </div>
                )) : (
                  <div className="py-10 text-center text-slate-300">
                    <i className="fa-solid fa-folder-open mb-3 block text-3xl opacity-20"></i>
                    <p className="text-xs font-bold">لا توجد مستندات بعد</p>
                  </div>
                )}
              </div>
            </SurfaceCard>
          </div>

          <SurfaceCard title="سجل الأحداث" description="تسلسل زمني مبسط لآخر الإجراءات المهمة فقط.">
            <div className="space-y-3">
              {selectedCaseTimeline.slice(0, 6).map(entry => (
                <div key={entry.id} className="flex flex-row-reverse items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-navy shadow-sm">
                    <i className={`fa-solid ${entry.type === 'hearing' ? 'fa-building-columns' : entry.type === 'client' ? 'fa-comments' : 'fa-file-lines'}`}></i>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black text-slate-400">{entry.date}</span>
                      <h4 className="text-sm font-black text-brand-dark">{entry.title}</h4>
                    </div>
                    <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{entry.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-5">
          <SurfaceCard title="لوحة الحالة">
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <span>{selectedCase.progress}%</span>
                  <span>التقدم</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedCase.progress}
                  onChange={(e) => handleUpdateCaseProgress(selectedCase.id, parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-gold"
                />
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">المخاطر</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-red-100">
                      <div className="h-full bg-red-500" style={{ width: `${selectedCase.riskScore}%` }}></div>
                    </div>
                    <span className="text-sm font-black text-red-600">{selectedCase.riskScore}%</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">الالتزام القادم</p>
                  <p className="mt-2 text-sm font-black text-brand-dark">{selectedCaseReminders[0]?.dueDate || selectedCase.nextDeadline}</p>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                {[
                  { label: 'الوكالة القانونية', done: true },
                  { label: 'هوية العميل الموثقة', done: true },
                  { label: 'دفع الرسوم الأولية', done: false },
                ].map((item, i) => (
                  <div key={i} className="flex flex-row-reverse items-center justify-between text-[11px] font-black">
                    <span className={item.done ? 'text-slate-600' : 'text-red-500'}>{item.label}</span>
                    <i className={`fa-solid ${item.done ? 'fa-circle-check text-emerald-500' : 'fa-circle-exclamation text-slate-200'}`}></i>
                  </div>
                ))}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="مؤشرات سريعة">
            <div className="space-y-3">
              {[
                { label: 'ساعات فوترة', value: `${selectedCase.billableHours} ساعة` },
                { label: 'مبلغ مستحق', value: `${selectedCase.outstandingInvoice.toLocaleString()} د.ع` },
                { label: 'آخر موعد', value: selectedCase.nextDeadline },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-black text-brand-dark">{item.value}</span>
                  <span className="text-xs font-black text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="ملاحظات خاصة" description="ملخص داخلي سريع لا يظهر للعميل.">
            <div className="space-y-3">
              <textarea
                value={caseNote}
                onChange={(e) => setCaseNote(e.target.value)}
                placeholder="أدخل ملاحظاتك الخاصة هنا..."
                className="h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-700 text-right outline-none transition-all focus:border-brand-navy focus:bg-white"
              />
              <button
                onClick={handleSavePrivateNote}
                className="w-full rounded-xl bg-brand-gold px-4 py-2.5 text-[11px] font-black text-brand-dark shadow-sm transition hover:bg-yellow-500"
              >
                حفظ الملاحظة
              </button>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-5">
      <section className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'تحتاج إجراء الآن', value: urgentCases.length, note: 'ابدأ بالأعلى خطورة', tone: 'text-red-600' },
            { label: 'رسائل غير مقروءة', value: unreadMessagesCount, note: `${waitingReplyCount} تنتظر ردك`, tone: 'text-brand-dark' },
            { label: 'متاح للسحب', value: `${Math.round(availableToWithdraw / 1000)}k`, note: 'ألف د.ع', tone: 'text-emerald-600' },
            { label: 'متابعون جدد', value: newFollowersThisWeek, note: `${followersCount} إجمالي المتابعين`, tone: 'text-brand-navy' }
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</p>
              <p className={`mt-2 text-2xl font-bold ${item.tone}`}>{item.value}</p>
              <p className="mt-2 text-xs text-gray-500">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">مركز العمل اليومي</h3>
              <p className="mt-1 text-sm text-gray-500">كل ما تحتاجه للرد، إدارة القضايا، وسحب الأرباح من مكان واحد.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action.label)}
                  className={`rounded-2xl border px-3 py-2 text-xs font-bold transition ${activeQuickAction === action.label ? 'border-brand-navy bg-brand-navy text-white' : 'border-gray-200 bg-gray-50 text-brand-dark hover:border-brand-gold hover:bg-white'}`}
                >
                  <i className={`fa-solid ${action.icon} ml-2`}></i>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-brand-navy/10 bg-brand-navy/5 p-4 text-sm text-brand-dark">
            <span className="font-bold">حالة الإجراء الحالي:</span> {quickActionNote}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">آخر المستجدات</h3>
              <p className="text-sm text-gray-500">موجز النشاط التفاعلي خلال الساعات الأخيرة.</p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400">
              <i className="fa-solid fa-bolt-lightning"></i>
            </div>
          </div>
          <div className="space-y-4">
            {recentActivities.map(activity => (
              <div key={activity.id} className="flex flex-row-reverse items-center gap-4 group cursor-default">
                <div className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-2xl bg-slate-50 ${activity.color} transition-all group-hover:bg-white border border-transparent group-hover:border-slate-100 group-hover:shadow-sm`}>
                  <i className={`fa-solid ${activity.icon}`}></i>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs font-black text-slate-700 leading-relaxed">{activity.text}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">طابور الأولوية</h3>
              <p className="text-sm text-gray-500">ابدأ بهذه القضايا لأن تأثيرها مباشر على العميل أو الإيراد أو الموعد.</p>
              </div>
              <button type="button" onClick={() => setActiveTab('cases')} className="text-xs font-bold text-brand-navy">عرض الكل</button>
            </div>
            <div className="space-y-3">
              {urgentCases.map(caseItem => (
                <button
                  key={caseItem.id}
                  type="button"
                  onClick={() => {
                    setSelectedCaseId(caseItem.id);
                    setActiveTab('cases');
                  }}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-right hover:border-brand-gold hover:bg-white transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">{caseItem.matter}</p>
                      <h4 className="mt-1 font-bold text-brand-dark">{caseItem.title}</h4>
                      <p className="mt-1 text-xs text-gray-500">العميل: {caseItem.client}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${priorityBadgeMap[caseItem.priority]}`}>{caseItem.priority}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                    <span>الموعد: {caseItem.nextDeadline}</span>
                    <span>المخاطر: {caseItem.riskScore}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">جدول اليوم</h3>
              <p className="text-sm text-gray-500">مواعيد قريبة تضمن عدم ضياع أي متابعة تشغيلية.</p>
              </div>
              <button type="button" onClick={() => setIsAddApptModalOpen(true)} className="rounded-xl bg-brand-navy px-3 py-2 text-xs font-bold text-white">إضافة</button>
            </div>
            <div className="space-y-3">
              {todayAgenda.map(item => (
                <div key={item.title} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-right">
                      <p className="font-bold text-brand-dark">{item.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-navy/10 text-brand-navy">
                        <i className={`fa-solid ${item.icon}`}></i>
                      </div>
                      <span className="text-xs font-bold text-brand-dark">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">الأداء المالي</h3>
              <p className="text-sm text-gray-500">عرض واضح للمبلغ المتفق، المحصّل، المتاح للسحب، والمعلّق.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-600">2026</span>
          </div>
          <div className="h-64">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">مؤشرات فورية</h3>
              <p className="text-sm text-gray-500">لقطة سريعة على السيولة، المتابعة، والنمو.</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
              <span className="text-gray-500">متاح للسحب</span>
              <span className="font-bold text-emerald-600">{availableToWithdraw.toLocaleString()} د.ع</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
              <span className="text-gray-500">إيراد معلّق</span>
              <span className="font-bold text-amber-700">{pendingRevenue.toLocaleString()} د.ع</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
              <span className="text-gray-500">المتابعون</span>
              <span className="font-bold text-brand-dark">{followersCount}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">نمو الممارسة</h3>
              <p className="text-sm text-gray-500">تحسين الظهور والتفاعل والتحويل إلى قضايا مدفوعة.</p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold">
              <i className="fa-solid fa-lightbulb"></i>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              { id: 1, text: `لديك ${newFollowersThisWeek} متابع جديد هذا الأسبوع. أظهر توفرك أو سرّع الردود لتحويل الاهتمام إلى استشارات.`, icon: 'fa-user-group', color: 'text-brand-navy' },
              { id: 2, text: `خطة الاشتراك الحالية: ${subscriptionTier}. راقب حد القضايا النشطة واستخدام الأدوات حتى لا تصل لنقطة تعطل.`, icon: 'fa-crown', color: 'text-brand-gold' },
              { id: 3, text: `أسرع طريقة لزيادة التحصيل هذا اليوم هي متابعة القضايا ذات الفواتير المفتوحة ثم إرسال تحديث مختصر للعميل.`, icon: 'fa-wallet', color: 'text-emerald-500' },
            ].map(advice => (
              <div key={advice.id} className="flex flex-row-reverse items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 transition hover:bg-white">
                <i className={`fa-solid ${advice.icon} ${advice.color} mt-1`}></i>
                <p className="text-xs font-bold text-slate-600 leading-relaxed text-right">{advice.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  const renderCasesTab = () => (
    <div className="space-y-5">
      <ListWorkspaceHeader
        title="إدارة القضايا"
        description="طابور واضح للقضايا النشطة والتاريخية مع أسرع طريق إلى الإجراء التالي."
        searchValue={workspaceSearch}
        onSearchChange={setWorkspaceSearch}
        searchPlaceholder="ابحث عن قضية، عميل، أو موضوع..."
        stats={[
          { label: 'كل القضايا', value: cases.length },
          { label: 'عاجلة اليوم', value: urgentCases.length, tone: 'text-red-600' },
          { label: 'فواتير مفتوحة', value: outstandingBillingCases.length, tone: 'text-brand-dark' },
        ]}
        filters={caseFilters.map(filter => ({
          ...filter,
          active: caseViewFilter === filter.id,
          onClick: () => {
            setActiveSavedView(filter.id === 'urgent' ? 'urgent-today' : 'today-work');
            setCaseViewFilter(filter.id);
          },
        }))}
        secondaryActions={
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button onClick={() => setDisplayMode('comfortable')} className={`rounded-lg px-3 py-1 text-[10px] font-bold transition ${displayMode === 'comfortable' ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500'}`}>مريح</button>
            <button onClick={() => setDisplayMode('compact')} className={`rounded-lg px-3 py-1 text-[10px] font-bold transition ${displayMode === 'compact' ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500'}`}>مضغوط</button>
          </div>
        }
        primaryAction={<button type="button" onClick={() => setIsNewCaseModalOpen(true)} className="rounded-2xl bg-brand-navy px-4 py-2.5 text-sm font-bold text-white">قضية جديدة</button>}
      />

      {selectedCases.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-navy px-4 py-3 text-white">
          <span className="text-xs font-bold">تم اختيار {selectedCases.size}</span>
          <div className="h-4 w-px bg-white/20"></div>
          <button onClick={() => setIsBulkStatusModalOpen(true)} className="text-[10px] font-black hover:text-brand-gold transition">تحديث الحالة</button>
          <button onClick={handleBulkDelete} className="text-[10px] font-black hover:text-red-400 transition">حذف</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-5">
        <section className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-right">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-brand-navy"
                      checked={selectedCases.size === filteredCases.length && filteredCases.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-bold">القضية</th>
                  <th className="px-4 py-3 font-bold">الحالة</th>
                  <th className="px-4 py-3 font-bold hidden md:table-cell">الأولوية</th>
                  <th className="px-4 py-3 font-bold hidden lg:table-cell">الموعد</th>
                  <th className="px-4 py-3 font-bold hidden xl:table-cell">الفوترة</th>
                  <th className="px-4 py-3 font-bold hidden sm:table-cell">المخاطر</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredCases.map(caseItem => (
                  <tr
                    key={caseItem.id}
                    className={`group cursor-pointer transition hover:bg-gray-50 ${selectedCase?.id === caseItem.id ? 'bg-brand-navy/5' : 'bg-white'}`}
                  >
                    <td className={`px-4 ${displayMode === 'compact' ? 'py-2' : 'py-4'}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-brand-navy"
                        checked={selectedCases.has(caseItem.id)}
                        onChange={(e) => { e.stopPropagation(); toggleCaseSelection(caseItem.id); }}
                      />
                    </td>
                    <td onClick={() => { setSelectedCaseId(caseItem.id); setCaseViewMode('workbench'); }} className={`px-4 ${displayMode === 'compact' ? 'py-2' : 'py-4'}`}>
                      <div className="flex flex-col">
                        <p className="font-bold text-brand-dark">{caseItem.title}</p>
                        <p className="mt-1 text-xs text-gray-500">{caseItem.client} • {caseItem.matter}</p>
                      </div>
                    </td>
                    <td className="px-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusBadgeMap[caseItem.status]}`}>{caseItem.status}</span></td>
                    <td className="px-4 hidden md:table-cell"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${priorityBadgeMap[caseItem.priority]}`}>{caseItem.priority}</span></td>
                    <td className="px-4 text-gray-600 hidden lg:table-cell">{caseItem.nextDeadline}</td>
                    <td className="px-4 text-gray-600 hidden xl:table-cell">{caseItem.billableHours}h</td>
                    <td className="px-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2" >
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                          <div className={`h-full ${caseItem.riskScore > 80 ? 'bg-red-500' : caseItem.riskScore > 50 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${caseItem.riskScore}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-brand-dark">{caseItem.riskScore}%</span>
                      </div>
                    </td>
                    <td className="px-4 text-left">
                      <div className="opacity-0 transition group-hover:opacity-100">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedCaseId(caseItem.id); setCaseViewMode('workbench'); }} className="h-8 w-8 rounded-lg bg-slate-100 text-brand-navy transition hover:bg-brand-navy hover:text-white">
                          <i className="fa-solid fa-arrow-right-to-bracket text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCases.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">لا توجد قضايا مطابقة للبحث أو الفلتر الحالي.</div>
          )}
        </section>

        <section className="space-y-5">
          {selectedCase && (
            <WorkspacePreviewPanel
              eyebrow="معاينة القضية"
              title={selectedCase.title}
              subtitle={`${selectedCase.client} • ${selectedCase.matter}`}
              status={<span className={`rounded-full px-3 py-1 text-[10px] font-bold ${statusBadgeMap[selectedCase.status]}`}>{selectedCase.status}</span>}
              summary={
                <div className="space-y-3">
                  <p>{selectedCase.client} لديه ملف {selectedCase.priority === 'High' ? 'عالي الأولوية' : 'قيد المتابعة'} مع مخاطر عند {selectedCase.riskScore}% وتقدم تشغيلـي عند {selectedCase.progress}%.</p>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                      <span>تقدم العمل</span>
                      <span>{selectedCase.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full bg-brand-gold" style={{ width: `${selectedCase.progress}%` }}></div>
                    </div>
                  </div>
                </div>
              }
              meta={[
                { label: 'الموعد النهائي', value: selectedCase.nextDeadline },
                { label: 'المبلغ المستحق', value: `${selectedCase.outstandingInvoice.toLocaleString()} د.ع` },
                { label: 'ساعات الفوترة', value: `${selectedCase.billableHours} ساعة` },
                { label: 'مستوى المخاطر', value: `${selectedCase.riskScore}%` },
              ]}
              nextStep={<><span className="font-bold">الخطوة التالية:</span> افتح الملف وابدأ برسالة تحديث أو متابعة الفوترة أو مراجعة الوثائق من داخل نفس المساحة.</>}
              actions={
                <>
                  <ActionButton variant="primary" size="sm" onClick={() => setCaseViewMode('workbench')}>فتح الملف</ActionButton>
                  <ActionButton variant="secondary" size="sm" onClick={() => setActiveTab('messages')}>فتح الرسائل</ActionButton>
                  <ActionButton variant="secondary" size="sm" onClick={() => setCaseViewMode('workbench')}>عرض الوثائق</ActionButton>
                  <ActionButton variant="ghost" size="sm" onClick={() => setActiveTab('earnings')}>الفوترة</ActionButton>
                </>
              }
            />
          )}

          {selectedCase && (
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="text-right">
                  <h3 className="text-lg font-bold text-brand-dark">التسلسل الإجرائي</h3>
                  <p className="text-sm text-gray-500">كل جلسة، إيداع، أو تواصل مهم داخل ملف القضية.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold text-gray-600">{selectedCaseTimeline.length} حدث</span>
              </div>
              <div className="space-y-3">
                {selectedCaseTimeline.map(entry => (
                  <div key={entry.id} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-right">
                        <div className="flex flex-wrap justify-end gap-2 mb-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${entry.type === 'hearing' ? 'bg-red-100 text-red-700' : entry.type === 'filing' ? 'bg-blue-100 text-blue-700' : entry.type === 'client' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                            {entry.type === 'hearing' ? 'جلسة' : entry.type === 'filing' ? 'إيداع' : entry.type === 'client' ? 'تواصل' : 'ملاحظة'}
                          </span>
                          <span className="rounded-full bg-brand-navy/10 px-2.5 py-1 text-[10px] font-bold text-brand-navy">{entry.governorate}</span>
                        </div>
                        <p className="font-bold text-brand-dark">{entry.title}</p>
                        <p className="mt-1 text-xs text-gray-500">{entry.detail}</p>
                        <p className="mt-2 text-[11px] text-gray-400">{entry.court} • {entry.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedCaseTimeline.length === 0 && <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">لا توجد أحداث مسجلة لهذه القضية حتى الآن.</div>}
              </div>
            </div>
          )}

          {selectedCase && (
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="text-right">
                  <h3 className="text-lg font-bold text-brand-dark">تنبيهات القضية</h3>
                  <p className="text-sm text-gray-500">مواعيد الجلسات والوكالات والمهام الحرجة المرتبطة بهذا الملف.</p>
                </div>
                <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold text-red-600">{selectedCaseReminders.length} تنبيه</span>
              </div>
              <div className="space-y-3">
                {selectedCaseReminders.map(reminder => (
                  <div key={reminder.id} className={`rounded-2xl border p-4 ${reminder.urgency === 'critical' ? 'border-red-200 bg-red-50' : reminder.urgency === 'upcoming' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-right">
                        <p className="font-bold text-brand-dark">{reminder.title}</p>
                        <p className="mt-1 text-xs text-gray-600">{reminder.court} • {reminder.governorate}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-brand-dark">{reminder.category}</span>
                    </div>
                    <p className="mt-3 text-[11px] font-bold text-gray-600">{reminder.dueDate}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-brand-dark">قاعدة العملاء</h3>
            <div className="mt-4 space-y-3">
              {clients.map(client => (
                <div key={client.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <p className="font-bold text-brand-dark">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.company}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${client.status === 'Active' ? 'bg-green-100 text-green-700' : client.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{client.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  const renderCommunicationsTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.95fr] gap-5">
      <section className="space-y-5">
        <ListWorkspaceHeader
          title="الرسائل"
          description="مركز واضح لكل رسائل العملاء مع أسرع طريق للرد أو فتح القضية المرتبطة."
          searchValue={searchInboxTerm}
          onSearchChange={setSearchInboxTerm}
          searchPlaceholder="ابحث في الرسائل..."
          stats={[
            { label: 'كل الرسائل', value: inboxMessages.length },
            { label: 'عالية الأولوية', value: urgentInboxCount, tone: 'text-red-600' },
            { label: 'بانتظار رد', value: waitingReplyCount, tone: 'text-amber-700' },
          ]}
          filters={inboxFilters.map(filter => ({
            ...filter,
            active: inboxFilter === filter.id,
            onClick: () => {
              setActiveSavedView(filter.id === 'waiting' ? 'awaiting-reply' : 'today-work');
              setInboxFilter(filter.id);
            },
          }))}
        />
        <div className="mt-4 space-y-3">
          {filteredInboxMessages.map(message => (
            <button
              key={message.id}
              type="button"
              onClick={() => {
                setActiveMessageId(message.id);
                handleMarkMessageRead(message.id);
              }}
              className={`w-full rounded-2xl border p-4 text-right transition ${selectedInboxMessage?.id === message.id ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-100 bg-white hover:border-brand-gold'}`}
            >
              <div className="flex items-start gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
                  <img src={`https://i.pravatar.cc/150?img=${message.img}`} alt="Client" className="h-full w-full object-cover" />
                  {message.unread && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-red-500"></span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-brand-dark">{message.name}</h4>
                    <span className="text-[10px] text-gray-400">{message.time}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${messagePriorityClassMap[message.priority]}`}>{messagePriorityLabelMap[message.priority]}</span>
                    <span className="rounded-full bg-brand-navy/10 px-2.5 py-1 text-[10px] font-bold text-brand-navy">{message.channel}</span>
                    {message.awaitingResponse && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">بانتظار رد</span>}
                  </div>
                  <p className="mt-2 truncate text-xs text-gray-500">{message.text}</p>
                  <p className="mt-2 text-[10px] text-gray-400">مرتبطة بـ {message.caseTitle}</p>
                </div>
              </div>
            </button>
          ))}
          {filteredInboxMessages.length === 0 && <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">لا توجد رسائل مطابقة.</div>}
        </div>
      </section>

      <section className="space-y-5">
        {selectedInboxMessage && (
          <WorkspacePreviewPanel
            eyebrow="معاينة الرسالة"
            title={selectedInboxMessage.name}
            subtitle={selectedInboxMessage.caseTitle}
            status={<span className={`rounded-full px-3 py-1 text-[10px] font-bold ${messagePriorityClassMap[selectedInboxMessage.priority]}`}>{messagePriorityLabelMap[selectedInboxMessage.priority]}</span>}
            summary={selectedInboxMessage.text}
            meta={[
              { label: 'القناة', value: selectedInboxMessage.channel },
              { label: 'وقت الوصول', value: selectedInboxMessage.time },
              { label: 'حالة المتابعة', value: selectedInboxMessage.awaitingResponse ? 'بانتظار معالجة' : 'تمت المتابعة' },
              { label: 'الأولوية', value: messagePriorityLabelMap[selectedInboxMessage.priority] },
            ]}
            nextStep={<><span className="font-bold">الإجراء المقترح:</span> أرسل رداً موجزاً أو حوّل الرسالة إلى متابعة مرتبطة بالقضية خلال نفس الجلسة.</>}
            actions={
              <>
                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={handleSendInboxReply}
                  disabled={!canSendInboxReply || isSendingReply}
                >
                  {isSendingReply ? 'جارٍ الإرسال...' : 'إرسال الرد'}
                </ActionButton>
                <ActionButton variant="secondary" size="sm" onClick={() => linkedMessageCase && setSelectedCaseId(linkedMessageCase.id)}>فتح القضية</ActionButton>
                <ActionButton variant="secondary" size="sm" onClick={() => handleToggleAwaitingResponse(selectedInboxMessage.id)}>
                  {selectedInboxMessage.awaitingResponse ? 'تمييز كمكتمل' : 'إعادة للمتابعة'}
                </ActionButton>
                <ActionButton variant="ghost" size="sm" onClick={() => handleMarkMessageRead(selectedInboxMessage.id)}>تعليم كمقروءة</ActionButton>
              </>
            }
          />
        )}

        {selectedInboxMessage && linkedMessageCase && (
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            {linkedMessageCase && (
              <div className="rounded-2xl border border-brand-navy/10 bg-brand-navy/5 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">القضية المرتبطة</p>
                    <p className="mt-1 font-bold text-brand-dark">{linkedMessageCase.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{linkedMessageCase.nextDeadline} • {linkedMessageCase.matter}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCaseId(linkedMessageCase.id);
                    setActiveTab('cases');
                  }}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-brand-navy"
                  >
                    فتح ملف القضية
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedInboxMessage && (
          <div className="overflow-hidden rounded-3xl border border-brand-navy/10 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(15,39,78,0.05),rgba(255,255,255,1))] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-navy/50">Reply Desk</p>
                  <h3 className="mt-2 text-lg font-bold text-brand-dark">صياغة رد سريع وواضح</h3>
                  <p className="mt-1 text-sm text-slate-500">اختر قالبًا مناسبًا، عدّل الصياغة، ثم أرسل الرد مباشرة إلى العميل ضمن القضية الصحيحة.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
                  <div className="rounded-2xl border border-white bg-white/90 p-3 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">الهدف</p>
                    <p className="mt-2 text-xs font-black text-brand-dark">{replyTargetCase?.title || 'غير محدد'}</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white/90 p-3 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">المسودة</p>
                    <p className={`mt-2 text-xs font-black ${replyDraftLength > 0 ? 'text-brand-dark' : 'text-slate-400'}`}>
                      {replyDraftLength > 0 ? `${replyDraftLength} حرف` : 'فارغة'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-500">قوالب ردود سريعة</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-400 shadow-sm">
                    اختر قالبًا للبدء
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {responseTemplates.map(template => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => handleUseReplyTemplate(template)}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-right text-xs leading-6 text-gray-700 transition hover:border-brand-gold hover:shadow-sm"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-xs font-bold text-gray-500">مسودة الرد</label>
                  <span className="text-[10px] font-black text-slate-400">اختصار الإرسال: `Ctrl/Cmd + Enter`</span>
                </div>
                <textarea
                  value={replyDraft}
                  onChange={event => setReplyDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      handleSendInboxReply();
                    }
                  }}
                  placeholder="اكتب الرد القانوني بلغة واضحة ومباشرة، واذكر الخطوة التالية للعميل إن لزم..."
                  className="min-h-[160px] w-full resize-none rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 text-sm leading-7 text-right focus:border-brand-gold focus:outline-none"
                />
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-right">
                    <p className="text-xs font-black text-brand-dark">
                      {replyTargetCase
                        ? `سيتم الإرسال ضمن قضية: ${replyTargetCase.title}`
                        : 'لا توجد قضية مرتبطة بهذه الرسالة'}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                      {canSendInboxReply ? 'الرد جاهز للإرسال إلى العميل.' : 'أضف نصًا أو تأكد من وجود قضية مرتبطة قبل الإرسال.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setReplyDraft('')}
                      disabled={!replyDraft.length || isSendingReply}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-500 transition hover:border-slate-300 hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      مسح المسودة
                    </button>
                    <ActionButton
                      variant="primary"
                      size="sm"
                      onClick={handleSendInboxReply}
                      disabled={!canSendInboxReply || isSendingReply}
                      className="min-w-[132px]"
                    >
                      {isSendingReply ? 'جارٍ الإرسال...' : 'إرسال الآن'}
                    </ActionButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-brand-dark">اقتراحات الرد السريع</h3>
          <div className="mt-4 space-y-3 text-sm">
            {[
              'أرسل رداً موجزاً يحدد النقاط القانونية التي ستتم مراجعتها اليوم.',
              'حوّل الرسالة إلى ملاحظة مرتبطة بالقضية لحفظ التسلسل الزمني.',
              'صعّد الرسالة إلى متابعة عاجلة إذا ارتبطت بموعد أو مهلة قانونية.'
            ].map(item => (
              <div key={item} className="rounded-2xl bg-gray-50 p-3 text-gray-600">{item}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  const renderEarningsTab = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-5">
        <SurfaceCard
          title="ملخص الأرباح"
          description="فصل واضح بين المتاح للسحب، الإيراد المعلّق، والتحويلات السابقة."
          actions={<ActionButton variant="primary" size="sm">طلب سحب</ActionButton>}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'المتاح للسحب', value: `${availableToWithdraw.toLocaleString()} د.ع`, note: 'يمكن طلبه الآن', tone: 'text-emerald-600' },
              { label: 'إيراد معلق', value: `${pendingRevenue.toLocaleString()} د.ع`, note: 'بانتظار التحصيل أو التصفية', tone: 'text-amber-700' },
              { label: 'هذا الشهر', value: `${monthlyEarnings.toLocaleString()} د.ع`, note: 'إيراد محقق خلال الشهر الحالي', tone: 'text-brand-dark' },
              { label: 'إجمالي المسحوب', value: `${totalWithdrawn.toLocaleString()} د.ع`, note: 'تحويلات مكتملة', tone: 'text-brand-navy' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-right">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</p>
                <p className={`mt-2 text-2xl font-bold ${item.tone}`}>{item.value}</p>
                <p className="mt-2 text-xs text-gray-500">{item.note}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#0f274e_0%,#15386c_55%,#1d4f88_100%)] p-5 text-white shadow-lg shadow-brand-navy/10">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Premium Finance</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-white/70">القيمة المتاحة الآن</p>
                <p className="mt-2 text-4xl font-black">{availableToWithdraw.toLocaleString()}</p>
                <p className="mt-2 text-xs font-bold text-white/60">دينار عراقي جاهز للتحويل عند تفعيل نقطة السحب</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-brand-gold">
                <i className="fa-solid fa-wallet text-xl"></i>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">الحركة المالية</p>
            <div className="mt-4 space-y-3">
              {[
                { label: 'إجمالي متفق عليه', value: `${summary?.totalAgreedRevenue?.toLocaleString?.() ?? 0} د.ع`, tone: 'text-brand-dark' },
                { label: 'محصل فعلياً', value: `${summary?.totalCollected?.toLocaleString?.() ?? 0} د.ع`, tone: 'text-emerald-600' },
                { label: 'معلق حالياً', value: `${pendingRevenue.toLocaleString()} د.ع`, tone: 'text-amber-700' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className={`text-sm font-black ${item.tone}`}>{item.value}</span>
                  <span className="text-xs font-black text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SurfaceCard
          title="سحب الأموال"
          description="خطوة واحدة لاختيار المبلغ ثم تأكيد وسيلة التحويل."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const amount = Math.round(availableToWithdraw * ratio);
                  return (
                    <button
                      key={ratio}
                      type="button"
                      className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-sm font-bold text-brand-dark transition hover:border-brand-navy hover:bg-white"
                    >
                      {amount.toLocaleString()} د.ع
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                <span className="font-bold text-brand-dark">ملاحظة:</span> تم تجهيز واجهة السحب لتكون مباشرة وواضحة. تنفيذ التحويل الفعلي ما يزال يحتاج نقطة API مخصصة للسحب حتى لا يتم عرض حركة مالية غير حقيقية.
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-black text-brand-dark">وسائل التحويل</h4>
              <div className="mt-4 space-y-3">
                {(summary?.payoutMethods || []).map((method) => (
                  <div key={method.id} className="rounded-2xl border border-white bg-white px-4 py-4 text-right shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      {method.recommended && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">مفضلة</span>
                      )}
                      <div>
                        <p className="text-sm font-black text-brand-dark">{method.label}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{method.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="سجل المعاملات"
          description="سجل محاسبي سريع للمراجعة أثناء العمل اليومي."
        >
          <div className="space-y-3">
            {(summary?.recentTransactions || []).length > 0 ? (
              summary?.recentTransactions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black ${item.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {item.type === 'credit' ? 'إيراد' : 'سحب'}
                    </span>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-black text-brand-dark">{item.label}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{item.date}</p>
                    </div>
                    <p className="text-sm font-black text-brand-dark">{Number(item.amount).toLocaleString()} د.ع</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                لا توجد معاملات حديثة لعرضها.
              </div>
            )}
          </div>
        </SurfaceCard>
      </section>

      <section className="space-y-5">
        <WorkspacePreviewPanel
          eyebrow="قرار مالي سريع"
          title="أفضل خطوة الآن"
          subtitle="تسلسل واضح حتى لا تضيع حالة أي مبلغ"
          status={<span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">مالي</span>}
          summary={
            <div className="space-y-2">
              <p>لديك <span className="font-bold text-emerald-700">{availableToWithdraw.toLocaleString()} د.ع</span> متاحة الآن و <span className="font-bold text-amber-700">{pendingRevenue.toLocaleString()} د.ع</span> ما تزال معلقة.</p>
              <p>ابدأ بالقضايا ذات الفواتير المفتوحة إذا كان هدفك زيادة التحصيل قبل تقديم طلب السحب.</p>
            </div>
          }
          meta={[
            { label: 'إيراد محصل', value: `${summary?.totalCollected?.toLocaleString?.() ?? 0} د.ع` },
            { label: 'الفواتير المفتوحة', value: outstandingBillingCases.length },
            { label: 'هذا الشهر', value: `${monthlyEarnings.toLocaleString()} د.ع` },
            { label: 'آخر سحب', value: `${totalWithdrawn.toLocaleString()} د.ع` },
          ]}
          nextStep={<><span className="font-bold">الإجراء المقترح:</span> راجع القضايا ذات الرصيد المفتوح ثم انتقل مباشرة لتأكيد وسيلة السحب.</>}
          actions={
            <>
              <ActionButton variant="primary" size="sm">طلب سحب</ActionButton>
              <ActionButton variant="secondary" size="sm" onClick={() => { setActiveTab('cases'); setCaseViewFilter('billing'); }}>
                افتح القضايا المالية
              </ActionButton>
              <ActionButton variant="ghost" size="sm" onClick={() => setActiveTab('overview')}>العودة للنظرة العامة</ActionButton>
              <ActionButton variant="ghost" size="sm" onClick={() => setActiveTab('account')}>الاشتراك والحساب</ActionButton>
            </>
          }
        />
      </section>
    </div>
  );

  const renderAccountTab = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5">
        <SurfaceCard
          title="نمو الملف المهني"
          description="متابعون ومراجعات وإشارات تساعدك على فهم أداء الواجهة العامة."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'إجمالي المتابعين', value: followersCount, note: `${newFollowersThisWeek} جديد هذا الأسبوع` },
              { label: 'التقييم', value: ratingValue.toFixed(1), note: `${reviewCount} مراجعة` },
              { label: 'القضايا النشطة', value: summary?.activeCases ?? cases.length, note: 'ملفات تعمل عليها حالياً' },
              { label: 'المكتملة', value: summary?.completedCases ?? cases.filter((item) => item.status === 'Closed').length, note: 'تم إغلاقها بنجاح' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-right">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-brand-dark">{item.value}</p>
                <p className="mt-2 text-xs text-gray-500">{item.note}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="الاشتراك الحالي"
          description="معلومات واضحة عن الخطة وحدود الاستخدام وما الذي تحتاجه للترقية."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-3xl bg-[linear-gradient(135deg,#0f274e_0%,#173d73_60%,#285c99_100%)] p-5 text-white shadow-lg shadow-brand-navy/10">
              <div className="flex items-start justify-between gap-3">
                <div className="text-right">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">Current Plan</p>
                  <p className="mt-3 text-3xl font-black">{subscriptionTier.toUpperCase()}</p>
                  <p className="mt-2 text-sm font-bold text-white/80">تاريخ المراجعة أو التجديد القادم: {summary?.nextBillingDate || 'غير محدد'}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-gold">
                  <i className="fa-solid fa-crown"></i>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400">القضايا النشطة</p>
                <p className="mt-1 text-sm font-black text-brand-dark">{summary?.usage.activeCases ?? 0} / {summary?.usage.caseLimit ?? 'غير محدد'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400">استخدام أدوات AI</p>
                <p className="mt-1 text-sm font-black text-brand-dark">{summary?.usage.aiAssists ?? 0} / {summary?.usage.aiLimit ?? '0'}</p>
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="إجراءات الحساب"
          description="اختصارات مباشرة للحساب، الاشتراك، ونمو الملف العام."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton variant="primary" className="w-full">إدارة الاشتراك</ActionButton>
            <ActionButton variant="secondary" className="w-full">تحديث وسيلة السحب</ActionButton>
            <ActionButton variant="ghost" className="w-full">تحسين الملف العام</ActionButton>
            <ActionButton variant="ghost" className="w-full">عرض سجل الفواتير</ActionButton>
          </div>
        </SurfaceCard>
      </section>

      <section className="space-y-5">
        <WorkspacePreviewPanel
          eyebrow="ملخص الحساب"
          title={summary?.lawyerName || user?.name || 'المحامي'}
          subtitle="الحساب والاشتراك ونمو الجمهور"
          status={<span className="rounded-full bg-brand-gold/15 px-3 py-1 text-[10px] font-bold text-brand-dark">{subscriptionTier}</span>}
          summary={
            <div className="space-y-2">
              <p>هذا القسم مصمم ليحفظ عناصر النمو والإعدادات المالية والاشتراك في مكان واحد بدل تشتيتها داخل التشغيل اليومي.</p>
              <p>أفضل استخدام له هو مراجعة الاشتراك والنمو أسبوعياً، مع إبقاء العمل اليومي في القضايا والرسائل.</p>
            </div>
          }
          meta={[
            { label: 'متابعون', value: followersCount },
            { label: 'مراجعات', value: reviewCount },
            { label: 'الخطة', value: subscriptionTier },
            { label: 'التقييم', value: ratingValue.toFixed(1) },
          ]}
          nextStep={<><span className="font-bold">الإجراء المقترح:</span> حدّث الملف المهني إذا انخفض النمو، وراجع الاشتراك قبل الوصول إلى حدود الاستخدام.</>}
          actions={
            <>
              <ActionButton variant="primary" size="sm">إدارة الاشتراك</ActionButton>
              <ActionButton variant="secondary" size="sm" onClick={() => setActiveTab('earnings')}>الأرباح والسحب</ActionButton>
              <ActionButton variant="ghost" size="sm" onClick={() => setActiveTab('messages')}>العودة للرسائل</ActionButton>
              <ActionButton variant="ghost" size="sm" onClick={() => setActiveTab('cases')}>العودة للقضايا</ActionButton>
            </>
          }
        />

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-brand-dark">مؤشرات النمو</h3>
          <div className="mt-4 space-y-3">
            {[
              { label: 'متابعون جدد', value: newFollowersThisWeek, tone: 'text-brand-navy' },
              { label: 'إجمالي المتابعين', value: followersCount, tone: 'text-brand-dark' },
              { label: 'عدد المراجعات', value: reviewCount, tone: 'text-amber-700' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className={`text-sm font-black ${item.tone}`}>{item.value}</span>
                <span className="text-xs font-black text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  const renderDocumentsTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.95fr] gap-5">
      <section className="space-y-5">
        <ListWorkspaceHeader
          title="طابور الوثائق"
          description="نفس نمط العمل اليومي مع الوثائق: ابحث، فلتر، ثم افتح الملف الذي يحتاج إجراءً."
          searchValue={searchVaultTerm}
          onSearchChange={setSearchVaultTerm}
          searchPlaceholder="ابحث عن وثيقة..."
          stats={[
            { label: 'كل الملفات', value: vaultDocs.length },
            { label: 'تحتاج مراجعة', value: docsNeedingReviewCount, tone: 'text-red-600' },
            { label: 'سرية', value: confidentialDocsCount, tone: 'text-brand-navy' },
          ]}
          filters={vaultFilters.map(filter => ({
            ...filter,
            active: vaultFilter === filter.id,
            onClick: () => {
              setActiveSavedView(filter.id === 'needs-review' ? 'needs-review' : 'today-work');
              setVaultFilter(filter.id);
            },
          }))}
          primaryAction={<button type="button" onClick={handleVaultUpload} className="rounded-2xl bg-brand-navy px-4 py-2.5 text-sm font-bold text-white">رفع ملف</button>}
        />
        <div className="mt-4 space-y-3">
          {filteredVaultDocs.map(doc => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedVaultDocId(doc.id)}
              className={`w-full rounded-2xl border p-4 text-right transition ${selectedVaultDoc?.id === doc.id ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-100 bg-white hover:border-brand-gold'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-xl ${getFileIcon(doc.type)}`}>
                  <i className={`fa-solid ${getFileIcon(doc.type).split(' ')[0]}`}></i>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="truncate font-bold text-brand-dark">{doc.name}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${vaultStatusClassMap[doc.status]}`}>{vaultStatusLabelMap[doc.status]}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{doc.caseTitle} • {doc.owner}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                    <span>{doc.size}</span>
                    <span>{doc.date}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
          {filteredVaultDocs.length === 0 && <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">لا توجد وثائق مطابقة.</div>}
        </div>
      </section>

      <section className="space-y-5">
        {selectedVaultDoc && (
          <WorkspacePreviewPanel
            eyebrow="معاينة الوثيقة"
            title={selectedVaultDoc.name}
            subtitle={selectedVaultDoc.caseTitle}
            status={<span className={`rounded-full px-3 py-1 text-[10px] font-bold ${vaultStatusClassMap[selectedVaultDoc.status]}`}>{vaultStatusLabelMap[selectedVaultDoc.status]}</span>}
            summary={selectedVaultDoc.status === 'Needs Review' ? 'هذه الوثيقة ما زالت تحتاج مراجعة وربط ملاحظات واضحة قبل إرسالها أو اعتمادها.' : 'الوثيقة جاهزة للمشاركة أو الحفظ النهائي ضمن ملف القضية، مع إمكانية إضافة ملاحظات داخلية عند الحاجة.'}
            meta={[
              { label: 'المالك', value: selectedVaultDoc.owner },
              { label: 'آخر تحديث', value: selectedVaultDoc.date },
              { label: 'النوع', value: selectedVaultDoc.type.toUpperCase() },
              { label: 'السرية', value: selectedVaultDoc.confidential ? 'سري' : 'عادي' },
            ]}
            nextStep={<><span className="font-bold">الإجراء المقترح:</span> {selectedVaultDoc.status === 'Needs Review' ? 'ابدأ بمراجعة الوثيقة وربط ملاحظاتك بالملف قبل إرسالها.' : 'أكمل المشاركة الداخلية أو اربطها بخطوة القضية التالية.'}</>}
            actions={
              <>
                <ActionButton variant="primary" size="sm">فتح الملف</ActionButton>
                <ActionButton variant="secondary" size="sm">مشاركة داخلية</ActionButton>
                <ActionButton variant="secondary" size="sm">إضافة ملاحظة</ActionButton>
                <ActionButton variant="ghost" size="sm">ربط بالقضية</ActionButton>
              </>
            }
          />
        )}

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-brand-dark">ملخص الإجراء</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
              <span className="text-gray-500">ملفات موقعة</span>
              <span className="font-bold text-brand-dark">{signedDocsCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
              <span className="text-gray-500">قيد المراجعة</span>
              <span className="font-bold text-red-600">{docsNeedingReviewCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
              <span className="text-gray-500">ملفات سرية</span>
              <span className="font-bold text-brand-dark">{confidentialDocsCount}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderOperationsTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
      <section className="space-y-5">
        {/* Workload Heatmap */}
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">خريطة كثافة العمل</h3>
              <p className="text-sm text-gray-500">توزيع النشاط والمهام المنجزة خلال الأسبوع.</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-500">
              <div className="h-2 w-2 rounded-sm bg-brand-navy"></div>
              <span>ذروة النشاط</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {activityHeatmap.map((row, i) => (
              <div key={i} className="flex flex-row-reverse items-center gap-3 min-w-max">
                <span className="w-16 text-[10px] text-slate-400 font-black text-right">{row.day}</span>
                <div className="flex gap-1.5">
                  {row.values.map((val, j) => (
                    <div
                      key={j}
                      className={`h-5 w-5 rounded-[4px] transition-all hover:scale-125 hover:z-10 cursor-pointer ${val === 0 ? 'bg-slate-100 border border-slate-200' :
                        val === 1 ? 'bg-brand-navy/15' :
                          val === 2 ? 'bg-brand-navy/35' :
                            val === 3 ? 'bg-brand-navy/65' : 'bg-brand-navy'
                        }`}
                      title={`${val} مهام/ساعات نشاط`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">مركز المواعيد والتنبيهات</h3>
              <p className="text-sm text-gray-500">متابعة جلسات المحاكم، الوكالات، والتكليفات حسب المحكمة والمحافظة.</p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold text-red-600">{deadlineReminders.filter(item => item.urgency === 'critical').length} حرجة</span>
          </div>
          <div className="space-y-3">
            {deadlineReminders.map(reminder => (
              <button
                key={reminder.id}
                type="button"
                onClick={() => {
                  setSelectedCaseId(reminder.caseId);
                  setActiveTab('cases');
                }}
                className={`w-full rounded-2xl border p-4 text-right transition ${reminder.urgency === 'critical' ? 'border-red-200 bg-red-50 hover:bg-red-100/60' : reminder.urgency === 'upcoming' ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/60' : 'border-gray-200 bg-gray-50 hover:bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-right">
                    <p className="font-bold text-brand-dark">{reminder.title}</p>
                    <p className="mt-1 text-xs text-gray-600">{cases.find(item => item.id === reminder.caseId)?.title} • {reminder.court}</p>
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(reminder.court + ' ' + reminder.governorate)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="mt-2 inline-flex items-center gap-2 text-[10px] font-black text-brand-navy hover:underline">
                      <i className="fa-solid fa-location-dot"></i> عرض الموقع على الخارطة
                    </a>
                    <p className="mt-2 text-[11px] text-gray-500">{reminder.governorate} • {reminder.dueDate}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-brand-dark">{reminder.category}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${reminder.urgency === 'critical' ? 'bg-red-100 text-red-700' : reminder.urgency === 'upcoming' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                      {reminder.urgency === 'critical' ? 'حرج' : reminder.urgency === 'upcoming' ? 'قريب' : 'اعتيادي'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-right">
              <h3 className="text-lg font-bold text-brand-dark">جدول المواعيد</h3>
              <p className="text-sm text-gray-500">مخصص للعمل الكثيف خلال اليوم.</p>
            </div>
            <button type="button" onClick={() => setIsAddApptModalOpen(true)} className="rounded-2xl bg-brand-navy px-3 py-2 text-xs font-bold text-white">إضافة موعد</button>
          </div>
          <div className="space-y-3">
            {appointments.map((appointment, index) => (
              <div key={appointment.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-right">
                    <p className="font-bold text-brand-dark">{appointment.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{appointment.client || 'عميل غير محدد'}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${index === 0 ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600'}`}>{appointment.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-brand-dark">مهام الفريق</h3>
          <div className="mt-4 space-y-3">
            {teamTasks.map(task => (
              <div key={task.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="text-right">
                    <p className="font-bold text-brand-dark">{task.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{task.assignee} • {task.due}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${task.status === 'done' ? 'bg-green-100 text-green-700' : task.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {task.status === 'todo' ? 'جديد' : task.status === 'in-progress' ? 'قيد التنفيذ' : 'مكتمل'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-brand-dark">مؤشرات التشغيل</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gray-50 p-4 text-right">
              <p className="text-xs text-gray-400">قضايا مثبّتة</p>
              <p className="mt-2 text-xl font-bold text-brand-dark">{pinnedCases.length}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-right">
              <p className="text-xs text-gray-400">فواتير مفتوحة</p>
              <p className="mt-2 text-xl font-bold text-brand-dark">{outstandingBillingCases.length}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-right">
              <p className="text-xs text-gray-400">تنبيهات الوثائق</p>
              <p className="mt-2 text-xl font-bold text-brand-dark">{docsNeedingReviewCount}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-right">
              <p className="text-xs text-gray-400">ردود مطلوبة</p>
              <p className="mt-2 text-xl font-bold text-brand-dark">{waitingReplyCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-right">
            <h3 className="text-lg font-bold text-brand-dark">مساعد الذكاء الاصطناعي</h3>
            <p className="mt-1 text-sm text-gray-500">أدوات الصياغة والتحليل تأتي بعد الاطلاع على الجدول والتنبيهات الأساسية.</p>
          </div>
          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <label className="mb-2 block text-xs font-bold text-gray-500">اطلب من المساعد</label>
            <textarea
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              className="min-h-[130px] w-full resize-none rounded-2xl border border-gray-200 bg-white p-4 text-sm text-right focus:border-brand-gold focus:outline-none"
            />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {aiPromptSuggestions.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setAiPrompt(prompt)}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-right text-xs text-gray-700 transition hover:border-brand-gold hover:text-brand-dark"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleRunAiSummary} className="mt-4 w-full rounded-2xl bg-brand-navy py-3 text-sm font-bold text-white">
              {isAiRunning ? 'جارٍ التحليل...' : 'تشغيل المساعد'}
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase text-gray-400">النتيجة</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">{aiResponse}</p>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="app-view fade-in w-full max-w-full space-y-5 overflow-x-hidden">
      <section className="rounded-[32px] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/5 p-5 shadow-premium md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 text-right">
            <div className="flex items-center justify-end gap-3 mb-4">
              <NotificationBell />
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-100 shadow-sm">
                <i className="fa-solid fa-sack-dollar text-brand-gold text-xs"></i>
                <span className="text-xs font-black text-brand-dark">{(user?.accountBalance ?? 0).toLocaleString('ar-IQ')} د.ع</span>
              </div>
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden text-right origin-top-right"
                  >
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                      <button onClick={clearAllNotifications} className="text-[10px] font-black text-slate-400 hover:text-red-500">مسح الكل</button>
                      <h4 className="text-xs font-black text-brand-dark">التنبيهات</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? notifications.map((n: NotificationType) => (
                        <div
                          key={n.id}
                          onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); setIsNotificationsOpen(false); }}
                          className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition cursor-pointer ${!n.read ? 'bg-brand-navy/[0.02]' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold text-slate-400">{new Date(n.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
                            <p className={`text-xs font-black ${!n.read ? 'text-brand-navy' : 'text-slate-600'}`}>{n.title}</p>
                          </div>
                          <p className="text-[11px] font-bold text-slate-500 leading-relaxed">{n.message}</p>
                        </div>
                      )) : (
                        <div className="p-10 text-center text-slate-300">
                          <i className="fa-solid fa-bell-slash text-3xl mb-3 opacity-20"></i>
                          <p className="text-xs font-bold">لا توجد تنبيهات جديدة</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="inline-flex items-center rounded-full border border-brand-gold/20 bg-white/80 px-3 py-1 text-xs font-bold text-brand-navy">
                <i className="fa-solid fa-briefcase ml-2"></i>
                مساحة المحامي
              </div>
            </div>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-brand-dark">لوحة المحامي الاحترافية</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              مساحة عمل قانونية عالية الاستخدام اليومي، مصممة ليكون الرد على العملاء، إدارة القضايا، الأرباح، والاشتراك واضحاً وسريعاً بلا تشتيت.
            </p>
            {nextPriorityCase && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <StatusBadge tone="warning">الأولوية الآن: {nextPriorityCase.title}</StatusBadge>
                <StatusBadge tone="info">آخر موعد: {nextPriorityCase.nextDeadline}</StatusBadge>
              </div>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-auto xl:grid-cols-2 xl:min-w-[360px]">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">قضايا عاجلة</p>
              <p className="mt-2 text-2xl font-bold text-brand-dark">{urgentCases.length}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">رسائل جديدة</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{unreadMessagesCount}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">وثائق معلقة</p>
              <p className="mt-2 text-2xl font-bold text-brand-navy">{docsNeedingReviewCount}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">مهام مفتوحة</p>
              <p className="mt-2 text-2xl font-bold text-brand-dark">{openTasksCount}</p>
            </div>
          </div>
        </div>
      </section>

      {nextPriorityCase && (
        <NoticePanel
          title="الخطوة التالية"
          description={`ابدأ بملف ${nextPriorityCase.title} لأن مستوى الخطورة فيه ${nextPriorityCase.riskScore}% ولديه أقرب خطوة تشغيلية اليوم.`}
          action={
            <ActionButton variant="primary" size="sm" onClick={() => setActiveTab('cases')}>
              افتح القضايا
            </ActionButton>
          }
        />
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-right px-2">
            <h3 className="text-sm font-black text-brand-dark">العروض المحفوظة</h3>
            <p className="mt-1 text-xs text-slate-500">اختصارات سريعة لأكثر أوضاع العمل تكراراً: الأولويات، الرسائل المنتظرة، أو الملفات التي تحتاج مراجعة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => handleOpenSavedView(view.id)}
                className={`rounded-2xl border px-4 py-3 text-right transition ${activeSavedView === view.id ? 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/15' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy/30 hover:bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${activeSavedView === view.id ? 'bg-white/10 text-white' : 'bg-white text-brand-navy'}`}>{view.count}</span>
                  <p className="text-sm font-black">{view.label}</p>
                </div>
                <p className={`mt-1 text-[10px] ${activeSavedView === view.id ? 'text-white/70' : 'text-slate-400'}`}>{view.note}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <nav
            role="tablist"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-50/80 rounded-[2.25rem] shadow-inner"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const badgeCount =
                tab.id === 'cases' ? urgentCases.length :
                  tab.id === 'messages' ? unreadMessagesCount :
                    tab.id === 'earnings' ? outstandingBillingCases.length :
                      tab.id === 'account' ? newFollowersThisWeek : 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex min-w-[150px] items-center gap-3 rounded-[1.75rem] px-5 py-4 text-right transition-all duration-300 focus:outline-none ${isActive ? 'text-white' : 'text-slate-500 hover:text-brand-navy'
                    }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 z-0 rounded-[1.75rem] bg-brand-navy shadow-lg shadow-brand-navy/20" />
                  )}

                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-white/15' : 'bg-white shadow-sm border border-slate-100 group-hover:border-brand-navy/30'
                      }`}>
                      <i className={`fa-solid ${tab.icon} ${isActive ? 'text-white' : 'text-brand-navy'}`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black whitespace-nowrap">{tab.label}</p>
                        {badgeCount > 0 && (
                          <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black ${isActive ? 'bg-brand-gold text-brand-dark' : 'bg-red-500 text-white'
                            }`}>
                            {badgeCount}
                          </span>
                        )}
                      </div>
                      <p className={`truncate text-[10px] font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="flex flex-col gap-3 px-4 sm:flex-row sm:flex-wrap xl:flex-nowrap">
            <ActionButton
              onClick={() => setIsCommandPaletteOpen(true)}
              variant="ghost"
              className="text-slate-400 hover:text-brand-navy"
            >
              <span className="font-bold">البحث السريع (Ctrl+K)</span>
              <i className="fa-solid fa-magnifying-glass"></i>
            </ActionButton>
            <ActionButton type="button" onClick={() => setIsAddApptModalOpen(true)} variant="secondary">
              <i className="fa-solid fa-calendar-plus ml-2"></i>
              موعد
            </ActionButton>
            <ActionButton type="button" onClick={() => setIsNewCaseModalOpen(true)} variant="primary">
              <i className="fa-solid fa-plus ml-2"></i>
              قضية
            </ActionButton>
          </div>
        </div>
      </section>

      <section
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="min-h-[520px]"
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'cases' && (caseViewMode === 'list' ? renderCasesTab() : renderCaseWorkbench())}
        {activeTab === 'messages' && renderCommunicationsTab()}
        {activeTab === 'earnings' && renderEarningsTab()}
        {activeTab === 'account' && renderAccountTab()}
      </section>

      {isAddApptModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-right shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-brand-dark">إضافة موعد جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">عنوان الموعد</label>
                <input
                  type="text"
                  value={newAppt.title}
                  onChange={event => setNewAppt({ ...newAppt, title: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-500">الوقت</label>
                  <input
                    type="time"
                    value={newAppt.time}
                    onChange={event => setNewAppt({ ...newAppt, time: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-500">النوع</label>
                  <select
                    value={newAppt.type}
                    onChange={event => setNewAppt({ ...newAppt, type: event.target.value as Appointment['type'] })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                  >
                    <option value="video">جلسة فيديو</option>
                    <option value="chat">استشارة كتابية</option>
                    <option value="doc">مراجعة وثائق</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">اسم العميل</label>
                <input
                  type="text"
                  value={newAppt.client}
                  onChange={event => setNewAppt({ ...newAppt, client: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setIsAddApptModalOpen(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 font-bold text-gray-600">إلغاء</button>
              <button type="button" onClick={handleAddAppointment} className="flex-[2] rounded-xl bg-brand-navy py-3 font-bold text-white">حفظ الموعد</button>
            </div>
          </div>
        </div>
      )}

      {isNewCaseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-right shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-brand-dark">إنشاء قضية جديدة</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">اسم القضية</label>
                <input
                  type="text"
                  value={newCase.title}
                  onChange={event => setNewCase({ ...newCase, title: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">اسم العميل</label>
                <input
                  type="text"
                  value={newCase.client}
                  onChange={event => setNewCase({ ...newCase, client: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">موضوع القضية</label>
                <input
                  type="text"
                  value={newCase.matter}
                  onChange={event => setNewCase({ ...newCase, matter: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">الأولوية</label>
                <select
                  value={newCase.priority}
                  onChange={event => setNewCase({ ...newCase, priority: event.target.value as CaseRecord['priority'] })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-gold focus:outline-none"
                >
                  <option value="High">عالية</option>
                  <option value="Medium">متوسطة</option>
                  <option value="Low">منخفضة</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setIsNewCaseModalOpen(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 font-bold text-gray-600">إلغاء</button>
              <button type="button" onClick={handleAddCase} className="flex-[2] rounded-xl bg-brand-navy py-3 font-bold text-white">إنشاء القضية</button>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette Modal */}
      {isCommandPaletteOpen && (
          <div
            className="fixed inset-0 z-[300] flex items-start justify-center bg-brand-dark/20 px-4 pt-[15vh] backdrop-blur-sm"
            onClick={() => setIsCommandPaletteOpen(false)}
          >
            <div
              className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/20 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative border-b border-slate-100 p-6">
                <i className="fa-solid fa-magnifying-glass absolute right-8 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  autoFocus
                  placeholder="ابحث عن قضية، وثيقة، أو رسالة..."
                  className="w-full bg-transparent pr-12 text-lg font-bold text-brand-dark outline-none placeholder:text-slate-300 text-right"
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                />
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4">
                {commandResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="mb-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">نتائج البحث</p>
                    {commandResults.map((res) => (
                      <button
                        key={`${res.type}-${res.id}`}
                        onClick={res.action}
                        className="flex w-full items-center justify-between rounded-2xl p-4 text-right transition hover:bg-slate-50"
                      >
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{res.type}</span>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-brand-dark">{res.title}</p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[300px]">{res.subtitle}</p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy">
                            <i className={`fa-solid ${res.icon}`}></i>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-terminal mb-3 block text-3xl opacity-20"></i>
                    <p className="text-sm font-bold">{commandQuery ? 'لا توجد نتائج تطابق بحثك' : 'ابدأ الكتابة للبحث السريع...'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Bulk Status Update Modal */}
      {isBulkStatusModalOpen && (
          <div
            className="fixed inset-0 z-[400] flex items-center justify-center bg-brand-dark/40 px-4 backdrop-blur-sm"
          >
            <div
              className="w-full max-w-sm rounded-[2.5rem] bg-white p-8 text-right shadow-2xl"
            >
              <h3 className="mb-2 text-xl font-black text-brand-dark">تحديث الحالة الجماعي</h3>
              <p className="mb-6 text-sm font-bold text-slate-500">سيتم تغيير حالة {selectedCases.size} قضية مختارة إلى:</p>

              <div className="grid gap-3">
                {(['Open', 'In Review', 'Closed', 'At Risk'] as CaseRecord['status'][]).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleBulkStatusUpdate(status)}
                    className={`flex items-center justify-between rounded-2xl border border-slate-100 p-4 text-sm font-black transition hover:border-brand-navy hover:bg-slate-50`}
                  >
                    <span className={`h-2 w-2 rounded-full ${statusBadgeMap[status].split(' ')[0].replace('bg-', 'bg-')}`}></span>
                    {status}
                  </button>
                ))}
              </div>

              <button onClick={() => setIsBulkStatusModalOpen(false)} className="mt-6 w-full py-3 text-xs font-black text-slate-400 hover:text-brand-dark transition">إلغاء</button>
            </div>
          </div>
        )}

      {/* Undo Delete Toast */}
      {showUndoToast && (
          <div
            className="fixed bottom-8 left-1/2 z-[500] -translate-x-1/2 w-full max-w-md px-4"
          >
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/10 bg-brand-dark p-4 text-white shadow-2xl">
              <div className="flex items-center gap-3 pr-2">
                <i className="fa-solid fa-trash-can text-red-400"></i>
                <p className="text-sm font-bold">تم حذف القضايا المختارة ({lastDeletedCases.length})</p>
              </div>
              <button
                onClick={handleUndoDelete}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-brand-gold transition hover:bg-white/20"
              >
                تراجع
              </button>
            </div>
          </div>
        )}

      {/* Real-time Toast Notification */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.9, x: 20 }}
            className="fixed bottom-6 right-6 z-[600] max-w-sm w-full"
          >
            <div className="bg-brand-dark text-white rounded-[2rem] p-5 shadow-2xl border border-white/10 flex items-start gap-4 backdrop-blur-md">
              <div className="h-12 w-12 rounded-2xl bg-brand-gold/20 flex items-center justify-center text-brand-gold shrink-0 shadow-inner">
                <i className="fa-solid fa-bell-concierge text-lg animate-bounce"></i>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <h4 className="text-sm font-black text-brand-gold mb-1">{activeToast.title}</h4>
                <p className="text-xs font-bold text-slate-300 leading-relaxed line-clamp-2">{activeToast.message}</p>
                <button 
                  onClick={() => {
                    if (activeToast.link) navigate(activeToast.link);
                    setActiveToast(null);
                  }}
                  className="mt-3 text-[10px] font-black uppercase tracking-widest text-brand-gold hover:text-white transition-colors"
                >
                  عرض التفاصيل <i className="fa-solid fa-arrow-left mr-1"></i>
                </button>
              </div>
              <button onClick={() => setActiveToast(null)} className="text-white/30 hover:text-white transition">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
