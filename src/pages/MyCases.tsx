import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import apiClient from '../api/client';

type DocumentType = 'pdf' | 'image' | 'other';
type CaseStatus = 'pending' | 'review' | 'active' | 'closed';

type WorkspaceTab = 'summary' | 'chat' | 'financials' | 'resolution';
type DocFilter = 'all' | 'pending' | 'expired' | 'signed' | 'uploaded' | 'contracts';
type SidebarFilter = 'all' | 'needs_action' | 'in_progress' | 'waiting' | 'completed' | 'drafts';
type CaseAiMode = 'brief' | 'risk' | 'plan' | 'message';

type CaseMessageSender = 'user' | 'lawyer';
type MessageDeliveryState = 'sending' | 'failed';

type DocAction = string | null;

interface CaseLawyer {
  id?: string;
  name: string;
  role: string;
  img: string;
}

interface CaseMessage {
  id: number | string;
  sender: CaseMessageSender;
  text: string;
  awaitingResponse?: boolean;
  time?: string;
  createdAt?: string;
  deliveryState?: MessageDeliveryState;
}

interface LegalDocument {
  id: string;
  name: string;
  size: string;
  date: string;
  type: DocumentType;
  folderId: string | null;
  actionRequired: DocAction;
  expiresAt?: string | null;
  expiresText?: string | null;
  previewUrl?: string;
  isSigned?: boolean;
  isUploading?: boolean;
  progress?: number;
  tags?: string[];
  uploadedAt?: string;
}

interface FileFolder {
  id: string;
  name: string;
}

interface AIConsultation {
  id: string;
  title: string;
  date: string;
  excerpt: string;
}

interface CustomField {
  id: string;
  label: string;
  value: string;
}

interface CaseTimelineEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  type: 'hearing' | 'filing' | 'meeting' | 'system';
}

interface CaseFinancials {
  totalAgreed: number;
  paid: number;
  invoices: Array<{ id: string; amount: number; date: string; status: 'paid' | 'pending' }>;
}

interface LegalCase {
  client: string;
  id: string;
  title: string;
  lawyer: CaseLawyer;
  status: CaseStatus;
  statusText: string;
  progress: number;
  date: string;
  customFields: CustomField[];
  folders: FileFolder[];
  documents: LegalDocument[];
  aiConsultations: AIConsultation[];
  messages: CaseMessage[];
  timeline: CaseTimelineEvent[];
  financials: CaseFinancials;
  isArchived?: boolean;
  unreadCount?: number;
  collaborators?: Array<{ id: string; name: string; email: string; role: 'user' | 'lawyer'; permissions: 'view' | 'edit'; img: string; lastSeen?: string }>;
  accessLogs?: Array<{ id: string; userName: string; action: string; time: string }>;
}

interface AvailableLawyer {
  id: string;
  name: string;
  role: string;
  img: string;
}

const QUICK_REPLIES = ['نعم، أوافق على ذلك', 'هل هناك تحديث جديد؟', 'تم تجهيز المستندات', 'أحتاج توضيحاً أكثر'];

const CASE_TYPES = [
  { id: 'civil', label: 'مدنية' },
  { id: 'criminal', label: 'جنائية' },
  { id: 'commercial', label: 'تجارية' }
];

const SIDEBAR_FILTERS: Array<{ id: SidebarFilter; label: string; icon: string }> = [
  { id: 'needs_action', label: 'إجراء', icon: 'fa-bell' },
  { id: 'drafts', label: 'مسودات', icon: 'fa-pen-ruler' },
  { id: 'in_progress', label: 'نشطة', icon: 'fa-spinner' },
  { id: 'waiting', label: 'انتظار', icon: 'fa-hourglass-half' },
  { id: 'completed', label: 'منتهية', icon: 'fa-circle-check' },
  { id: 'all', label: 'الكل', icon: 'fa-layer-group' },
];

const DOC_FILTERS: Array<{ id: DocFilter; label: string; icon: string; activeClass: string; idleClass: string }> = [
  { id: 'all', label: 'الكل', icon: 'fa-layer-group', activeClass: 'bg-brand-navy text-white shadow-md', idleClass: 'bg-slate-50 text-slate-500 hover:bg-white hover:shadow-sm' },
  { id: 'pending', label: 'للتوقيع', icon: 'fa-signature', activeClass: 'bg-amber-500 text-white shadow-md', idleClass: 'bg-amber-50 text-amber-700 hover:bg-white hover:shadow-sm' },
  { id: 'contracts', label: 'العقود', icon: 'fa-file-contract', activeClass: 'bg-brand-gold text-brand-dark shadow-md', idleClass: 'bg-yellow-50 text-yellow-700 hover:bg-white hover:shadow-sm' },
  { id: 'signed', label: 'موقعة', icon: 'fa-circle-check', activeClass: 'bg-emerald-500 text-white shadow-md', idleClass: 'bg-emerald-50 text-emerald-700 hover:bg-white hover:shadow-sm' },
  { id: 'expired', label: 'منتهية', icon: 'fa-clock', activeClass: 'bg-red-500 text-white shadow-md', idleClass: 'bg-red-50 text-red-700 hover:bg-white hover:shadow-sm' },
  { id: 'uploaded', label: 'مرفوعة', icon: 'fa-cloud-arrow-up', activeClass: 'bg-blue-500 text-white shadow-md', idleClass: 'bg-blue-50 text-blue-700 hover:bg-white hover:shadow-sm' },
];

const CASE_AI_MODES: Array<{ id: CaseAiMode; label: string; icon: string }> = [
  { id: 'brief', label: 'ملخص ذكي', icon: 'fa-sparkles' },
  { id: 'risk', label: 'المخاطر', icon: 'fa-triangle-exclamation' },
  { id: 'plan', label: 'الخطة', icon: 'fa-route' },
  { id: 'message', label: 'رسالة', icon: 'fa-pen-nib' },
];

const buildReadOnlyCaseUrl = (origin: string, caseId: string, section: 'summary' | 'documents') => {
  const params = new URLSearchParams({
    caseId,
    mode: 'readonly',
    section,
  });

  return `${origin}/cases?${params.toString()}`;
};

const buildQrImageUrl = (data: string, size = 190) => {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
  });

  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
};

const getCaseStatusTone = (status: CaseStatus) => {
  if (status === 'closed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'review') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (status === 'pending') return 'bg-blue-50 text-blue-700 ring-blue-100';
  return 'bg-brand-navy/5 text-brand-navy ring-brand-navy/10';
};

const getCaseSignal = (legalCase: LegalCase) => {
  const pendingDocs = legalCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length;
  const unread = legalCase.unreadCount ?? 0;
  const latestClientMessage = [...legalCase.messages].reverse().find((message) => message.sender === 'user');
  const awaitingLawyer = !!latestClientMessage?.awaitingResponse;

  if (pendingDocs > 0) {
    return { label: `${pendingDocs} وثائق`, icon: 'fa-file-signature', tone: 'bg-amber-50 text-amber-700 ring-amber-100' };
  }
  if (unread > 0) {
    return { label: `${unread} رسائل`, icon: 'fa-comments', tone: 'bg-blue-50 text-blue-700 ring-blue-100' };
  }
  if (awaitingLawyer) {
    return { label: 'بانتظار المحامي', icon: 'fa-clock', tone: 'bg-slate-100 text-slate-600 ring-slate-200' };
  }
  return { label: 'مستقر', icon: 'fa-shield-check', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
};

const getMessageTimeLabel = (message: CaseMessage) => {
  if (message.time) return message.time;
  if (!message.createdAt) return '';

  const createdAt = new Date(message.createdAt);
  if (Number.isNaN(createdAt.getTime())) return '';

  return createdAt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
};

const getLifecycleIndex = (legalCase: LegalCase) => {
  if (legalCase.status === 'closed') return 5;
  if (legalCase.progress >= 90) return 5;
  if (legalCase.financials.totalAgreed > 0 && legalCase.financials.paid >= legalCase.financials.totalAgreed && legalCase.progress >= 75) return 4;
  if (legalCase.progress >= 55) return 3;
  if (legalCase.documents.length > 0 || legalCase.documents.some((doc) => doc.actionRequired || doc.expiresAt)) return 2;
  if (legalCase.messages.length > 1 || legalCase.status === 'review' || legalCase.status === 'active') return 1;
  return 0;
};

const getTimelineEventMeta = (type: CaseTimelineEvent['type']) => {
  if (type === 'hearing') return { label: 'جلسة', icon: 'fa-building-columns', tone: 'bg-red-50 text-red-700 border-red-100' };
  if (type === 'filing') return { label: 'إيداع', icon: 'fa-file-circle-check', tone: 'bg-blue-50 text-blue-700 border-blue-100' };
  if (type === 'meeting') return { label: 'اجتماع', icon: 'fa-handshake', tone: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: 'تحديث', icon: 'fa-circle-info', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
};

const getCaseRoadmapSteps = (activeCase: LegalCase) => {
  const pendingDocuments = activeCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length;
  const paidPercent = activeCase.financials.totalAgreed > 0
    ? Math.round((activeCase.financials.paid / activeCase.financials.totalAgreed) * 100)
    : 100;
  const lifecycleIndex = getLifecycleIndex(activeCase);

  return [
    {
      id: 'opened',
      label: 'فتح الملف',
      note: `تم إنشاء الملف في ${activeCase.date}`,
      icon: 'fa-folder-plus',
      progressGate: 0,
      tab: 'summary' as WorkspaceTab,
    },
    {
      id: 'review',
      label: 'تقييم المحامي',
      note: activeCase.messages.length > 1 ? 'بدأت المراسلات والتوجيهات' : 'بانتظار أول توجيه واضح',
      icon: 'fa-user-tie',
      progressGate: 15,
      tab: 'chat' as WorkspaceTab,
    },
    {
      id: 'documents',
      label: 'اكتمال الوثائق',
      note: pendingDocuments > 0 ? `${pendingDocuments.toLocaleString('ar-IQ')} وثيقة تحتاج إجراء` : 'لا توجد وثائق معلقة حالياً',
      icon: 'fa-file-signature',
      progressGate: 35,
      tab: 'summary' as WorkspaceTab,
    },
    {
      id: 'execution',
      label: 'تنفيذ الإجراءات',
      note: activeCase.progress >= 55 ? 'القضية داخل مرحلة التنفيذ' : 'ستبدأ بعد اكتمال المتطلبات الأساسية',
      icon: 'fa-scale-balanced',
      progressGate: 55,
      tab: 'chat' as WorkspaceTab,
    },
    {
      id: 'settlement',
      label: 'المالية والاتفاق',
      note: activeCase.financials.totalAgreed > 0 ? `السداد ${paidPercent}%` : 'لا توجد أتعاب مسجلة بعد',
      icon: 'fa-wallet',
      progressGate: 75,
      tab: 'financials' as WorkspaceTab,
    },
    {
      id: 'closed',
      label: 'الإغلاق النهائي',
      note: activeCase.status === 'closed' ? 'تم إغلاق القضية' : 'يظهر عند اكتمال المراجعة النهائية',
      icon: 'fa-circle-check',
      progressGate: 90,
      tab: 'resolution' as WorkspaceTab,
    },
  ].map((step, index) => {
    const isCompleted = activeCase.status === 'closed' || activeCase.progress >= step.progressGate || index < lifecycleIndex;
    const isCurrent = activeCase.status !== 'closed' && !isCompleted && index === Math.min(lifecycleIndex, 5);
    return {
      ...step,
      state: isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming',
    };
  });
};

// --- Sub-Components ---

const CaseSidebar = React.memo(({
  cases,
  activeCaseId,
  setActiveCaseId,
  showArchived,
  searchQuery,
  statusFilter
}: {
  cases: LegalCase[],
  activeCaseId: string,
  setActiveCaseId: (id: string) => void,
  showArchived: boolean,
  searchQuery: string,
  statusFilter: SidebarFilter
}) => {
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return cases.filter((c) => {
      const matchesArchive = showArchived ? c.isArchived : !c.isArchived;
      const matchesSearch = !query || c.title.toLowerCase().includes(query) || c.lawyer.name.toLowerCase().includes(query) || c.client.toLowerCase().includes(query);
      const latestClientMessage = [...c.messages].reverse().find((message) => message.sender === 'user');
      const hasAction =
        c.status === 'pending' ||
        (c.unreadCount ?? 0) > 0 ||
        c.documents.some((doc) => doc.actionRequired || doc.expiresAt) ||
        !!latestClientMessage?.awaitingResponse;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'needs_action' && hasAction) ||
        (statusFilter === 'in_progress' && c.status === 'active') ||
        (statusFilter === 'waiting' && c.status === 'review') ||
        (statusFilter === 'completed' && c.status === 'closed') ||
        (statusFilter === 'drafts' && c.documents.some(d => d.actionRequired === 'مسودة' || !d.isSigned));
      return matchesArchive && matchesSearch && matchesStatus;
    });
  }, [cases, searchQuery, showArchived, statusFilter]);

  const actionCount = useMemo(
    () => filtered.reduce((total, item) => total + item.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length + (item.unreadCount ?? 0), 0),
    [filtered],
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[9px] font-black text-slate-400">مطابقة</p>
          <p className="mt-1 text-xl font-black text-brand-dark">{filtered.length.toLocaleString('ar-IQ')}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 shadow-sm">
          <p className="text-[9px] font-black text-amber-600">تنبيهات</p>
          <p className="mt-1 text-xl font-black text-amber-800">{actionCount.toLocaleString('ar-IQ')}</p>
        </div>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon="folder-open"
            title="لا توجد قضايا مطابقة"
            description="جرّب تغيير البحث أو حالة الفلترة، أو بدّل بين القضايا النشطة والأرشيف."
          />
        ) : filtered.map((c) => {
          const signal = getCaseSignal(c);
          return (
            <motion.div
              layout
              key={c.id}
              onClick={() => setActiveCaseId(c.id)}
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={`relative cursor-pointer overflow-hidden rounded-[1.35rem] border p-4 transition-all group ${activeCaseId === c.id
                ? 'border-brand-navy/20 bg-[linear-gradient(135deg,rgba(27,54,93,0.08),rgba(255,255,255,0.98))] shadow-lg shadow-brand-navy/10'
                : 'border-slate-100 bg-white hover:border-brand-navy/20 hover:shadow-md'
                }`}
            >
              {c.unreadCount ? (
                <span className="absolute left-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white shadow-sm">
                  {c.unreadCount}
                </span>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className={`truncate font-black text-sm transition-colors ${activeCaseId === c.id ? 'text-brand-navy' : 'text-brand-dark group-hover:text-brand-navy'}`}>
                    {c.title}
                  </h4>
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={c.lawyer.img}
                      className="h-6 w-6 rounded-xl border border-white shadow-sm cursor-pointer"
                      alt={c.lawyer.name}
	                      onClick={(e) => {
	                        e.stopPropagation();
	                        if (c.lawyer.id) {
	                          window.location.assign(`/profile/${c.lawyer.id}`);
	                        }
	                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black text-slate-600">{c.lawyer.name}</p>
                      <p className="truncate text-[9px] font-bold text-slate-400">{c.client}</p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ring-1 ${getCaseStatusTone(c.status)}`}>
                    {c.statusText}
                  </span>
                  {c.isArchived && (
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-500">
                      <i className="fa-solid fa-box-archive"></i>
                      مؤرشف
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ring-1 ${signal.tone}`}>
                  <i className={`fa-solid ${signal.icon}`}></i>
                  {signal.label}
                </span>
                <p className="text-[10px] font-black text-slate-400">{c.date}</p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${c.status === 'closed' ? 'bg-emerald-500' : 'bg-brand-gold'}`}
                  style={{ width: `${c.progress}%` }}
                ></div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-black text-slate-400">
                <span>{c.progress}% مكتمل</span>
                <span>{c.documents.length.toLocaleString('ar-IQ')} وثائق</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

CaseSidebar.displayName = 'CaseSidebar';

const buildCaseAiInsight = (activeCase: LegalCase, mode: CaseAiMode) => {
  const pendingDocs = activeCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt);
  const expiredDocs = activeCase.documents.filter((doc) => doc.expiresAt && !doc.isSigned);
  const signedDocs = activeCase.documents.filter((doc) => doc.isSigned).length;
  const latestMessage = [...activeCase.messages].reverse()[0];
  const latestUserMessage = [...activeCase.messages].reverse().find((message) => message.sender === 'user');
  const latestLawyerMessage = [...activeCase.messages].reverse().find((message) => message.sender === 'lawyer');
  const remainingBalance = Math.max(0, activeCase.financials.totalAgreed - activeCase.financials.paid);
  const paidPercent = activeCase.financials.totalAgreed > 0
    ? Math.round((activeCase.financials.paid / activeCase.financials.totalAgreed) * 100)
    : 0;
  const fileHealth = [
    pendingDocs.length === 0,
    activeCase.progress >= 50,
    remainingBalance === 0 || activeCase.financials.totalAgreed === 0,
    !latestUserMessage?.awaitingResponse,
  ].filter(Boolean).length;
  const confidence = Math.min(96, 58 + fileHealth * 9 + Math.min(activeCase.documents.length, 6) * 2);

  const draftMessage = pendingDocs.length > 0
    ? `أستاذ ${activeCase.lawyer.name}، راجعت ملف "${activeCase.title}" ووجدت ${pendingDocs.length.toLocaleString('ar-IQ')} وثائق تحتاج متابعة. ما هي الأولوية الأولى؟ وهل توجد مدة نهائية يجب الالتزام بها؟`
    : latestUserMessage?.awaitingResponse
      ? `أستاذ ${activeCase.lawyer.name}، أود متابعة رسالتي الأخيرة في ملف "${activeCase.title}". هل توجد مستجدات أو إجراء مطلوب مني؟`
      : `أستاذ ${activeCase.lawyer.name}، هل يمكنك تزويدي بتحديث مختصر عن ملف "${activeCase.title}" والخطوة القادمة المتوقعة؟`;

  if (mode === 'risk') {
    const risks = [
      pendingDocs.length > 0 ? `${pendingDocs.length.toLocaleString('ar-IQ')} وثائق تحتاج إجراء قبل أن يتأخر المسار.` : 'لا توجد وثائق معلقة حالياً.',
      expiredDocs.length > 0 ? `${expiredDocs.length.toLocaleString('ar-IQ')} وثائق مرتبطة بمدة أو صلاحية.` : 'لا تظهر وثائق منتهية أو حرجة حسب البيانات الحالية.',
      latestUserMessage?.awaitingResponse ? 'توجد رسالة منك بانتظار متابعة المحامي.' : 'لا توجد رسالة مرسلة منك بانتظار رد واضح.',
      remainingBalance > 0 ? `يوجد رصيد متبقٍ قدره ${remainingBalance.toLocaleString()} د.ع قد يؤثر على الإجراء التالي.` : 'الوضع المالي لا يظهر مانعاً حالياً.',
    ];

    return {
      eyebrow: 'تحليل المخاطر',
      title: pendingDocs.length || expiredDocs.length || latestUserMessage?.awaitingResponse ? 'يوجد ما يستحق الانتباه' : 'المخاطر الحالية منخفضة',
      summary: 'يركز هذا الفحص على الوثائق، المدد، الرسائل غير المتابعة، والوضع المالي داخل الملف.',
      bullets: risks,
      recommendation: pendingDocs.length > 0 ? 'ابدأ بالوثائق ذات الإجراء المطلوب، ثم أرسل سؤالاً محدداً للمحامي عن الأولوية.' : 'استمر في متابعة الملخص وسجل الأحداث عند ظهور تحديثات جديدة.',
      confidence,
      draftMessage,
    };
  }

  if (mode === 'plan') {
    return {
      eyebrow: 'خطة العمل',
      title: activeCase.progress >= 80 ? 'خطة إغلاق ومراجعة نهائية' : 'خطة متابعة قصيرة',
      summary: `التقدم الحالي ${activeCase.progress}%، والملف يحتوي على ${activeCase.documents.length.toLocaleString('ar-IQ')} وثائق و${activeCase.messages.length.toLocaleString('ar-IQ')} رسائل.`,
      bullets: [
        pendingDocs.length > 0 ? 'راجع الوثائق المطلوبة ووقّع أو علّق على كل وثيقة معلقة.' : 'ثبت أن الوثائق الحالية لا تحتاج إجراء مباشر.',
        latestLawyerMessage ? `راجع آخر توجيه من المحامي: ${latestLawyerMessage.text.slice(0, 90)}${latestLawyerMessage.text.length > 90 ? '...' : ''}` : 'اطلب من المحامي تحديد آخر موقف إجرائي.',
        remainingBalance > 0 ? `راجع المتبقي المالي (${remainingBalance.toLocaleString()} د.ع) قبل الانتقال لمرحلة حساسة.` : 'احتفظ بسجل الدفع ضمن ملخص القضية.',
        activeCase.progress >= 80 ? 'افتح مركز الإغلاق واطلب اعتماد النتيجة النهائية.' : 'تابع التقدم بعد تنفيذ الإجراء التالي.',
      ],
      recommendation: activeCase.progress >= 80 ? 'انتقل إلى تبويب الإغلاق للتأكد من اكتمال المتطلبات.' : 'نفّذ أول بند ثم حدّث المحامي برسالة قصيرة.',
      confidence,
      draftMessage,
    };
  }

  if (mode === 'message') {
    return {
      eyebrow: 'صياغة ذكية',
      title: 'مسودة رسالة جاهزة للمحامي',
      summary: 'المسودة مبنية على الوثائق المعلقة وآخر حالة ظاهرة في الملف. يمكنك استخدامها كما هي أو تعديلها في صندوق المحادثة.',
      bullets: [
        draftMessage,
        pendingDocs.length > 0 ? `الوثائق المقصودة: ${pendingDocs.slice(0, 3).map((doc) => doc.name).join('، ')}${pendingDocs.length > 3 ? '...' : ''}` : 'لا توجد وثائق معلقة مذكورة في المسودة.',
      ],
      recommendation: 'استخدم المسودة في المحادثة ثم عدّل الصياغة حسب ما تريد إرساله فعلياً.',
      confidence,
      draftMessage,
    };
  }

  return {
    eyebrow: 'ملخص ذكي',
    title: activeCaseActionCountLabel(activeCase, pendingDocs.length),
    summary: `القضية في حالة "${activeCase.statusText}" بنسبة إنجاز ${activeCase.progress}%. تم توقيع ${signedDocs.toLocaleString('ar-IQ')} من أصل ${activeCase.documents.length.toLocaleString('ar-IQ')} وثائق، والسداد الحالي ${paidPercent}%.`,
    bullets: [
      pendingDocs.length > 0 ? `أولوية الملف: ${pendingDocs[0].name}` : 'لا توجد وثيقة تحتاج توقيعاً أو إجراءً فورياً.',
      latestMessage ? `آخر تواصل: ${latestMessage.sender === 'user' ? 'أنت' : 'المحامي'} - ${latestMessage.text.slice(0, 95)}${latestMessage.text.length > 95 ? '...' : ''}` : 'لا توجد رسائل مسجلة بعد.',
      remainingBalance > 0 ? `المتبقي المالي: ${remainingBalance.toLocaleString()} د.ع.` : 'لا يوجد مبلغ متبقٍ ظاهر في السجل.',
    ],
    recommendation: pendingDocs.length > 0 ? 'افتح الوثائق المطلوبة أولاً، ثم أرسل تحديثاً للمحامي.' : 'راجع سجل الأحداث أو اطلب تحديثاً موجزاً من المحامي.',
    confidence,
    draftMessage,
  };
};

const activeCaseActionCountLabel = (activeCase: LegalCase, pendingDocuments: number) => {
  if (activeCase.status === 'closed') return 'الملف مغلق وجاهز للأرشفة';
  if (pendingDocuments > 0) return 'هناك إجراءات تستحق المتابعة';
  if ((activeCase.unreadCount ?? 0) > 0) return 'توجد رسائل جديدة تحتاج قراءة';
  if (activeCase.progress >= 80) return 'الملف قريب من الإغلاق';
  return 'الملف مستقر ويحتاج متابعة دورية';
};

const SmartCaseAssistant = ({
  activeCase,
  setActiveTab,
  setDocFilter,
  setNewMessage,
  isReadOnlyView = false,
}: {
  activeCase: LegalCase;
  setActiveTab: (tab: WorkspaceTab) => void;
  setDocFilter: (filter: DocFilter) => void;
  setNewMessage: (message: string) => void;
  isReadOnlyView?: boolean;
}) => {
  const [mode, setMode] = useState<CaseAiMode>('brief');
  const insight = useMemo(() => buildCaseAiInsight(activeCase, mode), [activeCase, mode]);
  const pendingDocuments = activeCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length;

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-brand-navy/10 bg-white text-right shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(26,35,126,0.06),rgba(248,250,252,0.95))] p-5 xl:border-l xl:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">ذكاء الملف</p>
              <h3 className="mt-1 text-lg font-black text-brand-dark">مساعد القضية</h3>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy text-white shadow-lg shadow-brand-navy/20">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">
            {CASE_AI_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-xs font-black transition ${mode === item.id
                  ? 'border-brand-navy bg-brand-navy text-white shadow-md shadow-brand-navy/15'
                  : 'border-white bg-white text-slate-500 hover:border-brand-navy/20 hover:text-brand-navy'
                  }`}
              >
                <span>{item.label}</span>
                <i className={`fa-solid ${item.icon}`}></i>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{insight.eyebrow}</p>
              <h3 className="mt-1 text-xl font-black text-brand-dark">{insight.title}</h3>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">{insight.summary}</p>
            </div>
            <div className="shrink-0 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center">
              <p className="text-[10px] font-black text-emerald-700">ثقة التحليل</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">{insight.confidence}%</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {insight.bullets.map((bullet, index) => (
              <div key={`${mode}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-brand-navy shadow-sm">
                  <i className={`fa-solid ${index === 0 ? 'fa-bullseye' : index === 1 ? 'fa-message' : 'fa-circle-info'} text-xs`}></i>
                </div>
                <p className="text-xs font-bold leading-6 text-slate-600">{bullet}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-brand-navy/10 bg-brand-navy/5 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black text-brand-navy">التوصية التالية</p>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-600">{insight.recommendation}</p>
            </div>
            {!isReadOnlyView && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    if (pendingDocuments > 0) {
                      setDocFilter('pending');
                      setActiveTab('summary');
                    } else {
                      setActiveTab('chat');
                    }
                  }}
                  className="rounded-2xl bg-brand-navy px-4 py-3 text-xs font-black text-white shadow-lg shadow-brand-navy/15 transition hover:bg-brand-dark"
                >
                  <i className="fa-solid fa-arrow-left ml-2"></i>
                  تنفيذ التوصية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewMessage(insight.draftMessage);
                    setActiveTab('chat');
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-brand-navy transition hover:border-brand-navy"
                >
                  <i className="fa-solid fa-pen-to-square ml-2"></i>
                  استخدم كرسالة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const SummaryTab = ({
  activeCase,
  setIsNewFieldModalOpen,
  setActiveTab,
  isReadOnlyView = false,
}: {
  activeCase: LegalCase,
  setIsNewFieldModalOpen: (open: boolean) => void,
  setActiveTab: (tab: WorkspaceTab) => void,
  isReadOnlyView?: boolean,
}) => {
  const roadmapSteps = getCaseRoadmapSteps(activeCase);
  const currentStep = roadmapSteps.find((step) => step.state === 'current') ?? roadmapSteps[roadmapSteps.length - 1];
  const completedSteps = roadmapSteps.filter((step) => step.state === 'completed').length;
  const sortedTimeline = [...activeCase.timeline];

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-slate-50/30 space-y-6 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">نسبة الإنجاز</p>
          <p className="text-4xl font-black text-brand-navy">{activeCase.progress}%</p>
          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden shadow-inner">
            <div className="bg-brand-gold h-full rounded-full transition-all duration-1000" style={{ width: `${activeCase.progress}%` }}></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">معلومات سريعة</p>
            {!isReadOnlyView && (
              <button onClick={() => setIsNewFieldModalOpen(true)} className="text-[10px] font-black text-brand-navy hover:underline">تعديل البيانات</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {activeCase.customFields.length === 0 ? (
              <div className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-xs font-black text-slate-500">لا توجد بيانات مخصصة بعد</p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">أضف رقم الدعوى أو المحكمة أو أي معلومة مهمة للرجوع السريع.</p>
              </div>
            ) : activeCase.customFields.map((f) => (
              <div key={f.id} className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400">{f.label}</span>
                <span className="text-sm font-black text-brand-dark">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">سلامة الملف (Health)</p>
          <div className="flex gap-4">
            {[
              { label: 'الهوية', done: true },
              { label: 'التوكيل', done: activeCase.progress > 50 },
              { label: 'الدفعة الأولى', done: activeCase.financials.paid > 0 }
            ].map(item => (
              <div key={item.label} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-[10px] font-black ${item.done ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                <i className={`fa-solid ${item.done ? 'fa-circle-check' : 'fa-circle-dot'}`}></i>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-6">
        <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="text-lg font-black text-brand-dark flex items-center gap-2">
                <i className="fa-solid fa-map-location-dot text-brand-gold"></i>
                خط سير القضية
              </h4>
              <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
                يوضح هذا المسار أين تقف القضية الآن، وما الذي اكتمل، وما هي الخطوة القادمة بينك وبين المحامي.
              </p>
            </div>
            <div className="rounded-2xl border border-brand-navy/10 bg-brand-navy/5 px-4 py-3 text-right">
              <p className="text-[10px] font-black text-brand-navy">المرحلة الحالية</p>
              <p className="mt-1 text-sm font-black text-brand-dark">{currentStep.label}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{completedSteps} / {roadmapSteps.length} مراحل مكتملة</p>
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-slate-100 bg-slate-50/60 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-xs font-black text-brand-dark">{activeCase.statusText}</span>
              <span className="text-xs font-black text-brand-navy">{activeCase.progress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white shadow-inner">
              <div className="h-full rounded-full bg-brand-gold transition-all duration-1000" style={{ width: `${activeCase.progress}%` }}></div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {roadmapSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveTab(step.tab)}
                className={`group relative min-h-[118px] rounded-[1.5rem] border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md ${step.state === 'completed'
                    ? 'border-emerald-100 bg-emerald-50/80'
                    : step.state === 'current'
                      ? 'border-brand-navy bg-white shadow-lg shadow-brand-navy/10'
                      : 'border-slate-100 bg-white/80 opacity-75 hover:opacity-100'
                  }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${step.state === 'completed'
                      ? 'bg-white text-emerald-600'
                      : step.state === 'current'
                        ? 'bg-brand-navy text-white'
                        : 'bg-slate-50 text-slate-400'
                    }`}>
                    <i className={`fa-solid ${step.state === 'completed' ? 'fa-check' : step.icon}`}></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${step.state === 'completed'
                          ? 'bg-white text-emerald-700'
                          : step.state === 'current'
                            ? 'bg-brand-navy/5 text-brand-navy'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                        {step.state === 'completed' ? 'مكتمل' : step.state === 'current' ? 'الحالي' : 'قادم'}
                      </span>
                      <span className="text-[10px] font-black text-slate-400">مرحلة {index + 1}</span>
                    </div>
                    <p className="mt-2 text-sm font-black text-brand-dark">{step.label}</p>
                    <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{step.note}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-black text-brand-dark flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-brand-navy"></i>
                سجل الأحداث
              </h4>
              <p className="mt-2 text-xs font-bold leading-6 text-slate-500">تاريخ مختصر لكل جلسة، إيداع، اجتماع، أو تحديث مهم.</p>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500 ring-1 ring-slate-100">
              {sortedTimeline.length.toLocaleString('ar-IQ')} حدث
            </span>
          </div>
          <div className="mt-6 max-h-[680px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedTimeline.length > 0 ? (
              <div className="relative space-y-4 before:absolute before:right-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-100">
                {sortedTimeline.map((event, index) => {
                  const meta = getTimelineEventMeta(event.type);
                  const isLatest = index === 0;
                  return (
                    <article key={event.id} className="relative pr-14">
                      <div className={`absolute right-2.5 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white shadow-sm ${isLatest ? 'bg-brand-gold text-brand-dark' : 'bg-slate-200 text-slate-500'
                        }`}>
                        <i className={`fa-solid ${isLatest ? 'fa-star' : 'fa-circle'} text-[8px]`}></i>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab(event.type === 'filing' ? 'summary' : 'chat')}
                        className={`w-full rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-sm ${isLatest ? 'border-brand-gold/30 bg-brand-gold/10' : 'border-slate-100 bg-slate-50/70 hover:bg-white'
                          }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${meta.tone}`}>
                            <i className={`fa-solid ${meta.icon} ml-1`}></i>
                            {meta.label}
                          </span>
                          <span className="text-[10px] font-black text-brand-navy">{event.date}</span>
                        </div>
                        <p className="mt-3 text-sm font-black text-brand-dark">{event.title}</p>
                        <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{event.detail}</p>
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
                  <i className="fa-solid fa-clock-rotate-left text-xl"></i>
                </div>
                <p className="mt-4 text-sm font-black text-brand-dark">لا توجد أحداث مسجلة بعد</p>
                <p className="mt-2 text-xs font-bold leading-6 text-slate-500">ستظهر هنا الجلسات، الإيداعات، وملاحظات المحامي عند إضافتها.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {!isReadOnlyView && (
      <div className="flex flex-col gap-4 sm:flex-row">
        <ActionButton onClick={() => setActiveTab('chat')} variant="primary" className="flex-1">تواصل مع المحامي</ActionButton>
        <ActionButton onClick={() => window.print()} variant="secondary" className="flex-1">طباعة التقرير الحالي</ActionButton>
      </div>
      )}
    </div>
  );
};

const FinancialsTab = ({ activeCase }: { activeCase: LegalCase }) => (
  <div className="flex-1 overflow-y-auto p-5 bg-slate-50/30 space-y-6 custom-scrollbar">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي الأتعاب</p>
        <p className="text-2xl font-black text-brand-dark">{activeCase.financials.totalAgreed.toLocaleString()} د.ع</p>
      </div>
      <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm text-center">
        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">المبلغ المسدد</p>
        <p className="text-2xl font-black text-emerald-700">{activeCase.financials.paid.toLocaleString()} د.ع</p>
      </div>
      <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 shadow-sm text-center">
        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">المتبقي</p>
        <p className="text-2xl font-black text-amber-700">{(activeCase.financials.totalAgreed - activeCase.financials.paid).toLocaleString()} د.ع</p>
        <div className="w-full bg-amber-200/30 h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all duration-1000"
            style={{ width: `${(activeCase.financials.paid / activeCase.financials.totalAgreed) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
        <h4 className="text-lg font-black text-brand-dark mb-6 flex items-center gap-2">
          <i className="fa-solid fa-user-shield text-emerald-500"></i> سجل الوصول (Audit)
        </h4>
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {activeCase.accessLogs?.map((log) => (
            <div key={log.id} className="flex flex-row-reverse items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-brand-navy">
                <i className="fa-solid fa-eye text-xs"></i>
              </div>
              <div className="text-right flex-1 min-w-0">
                <p className="text-xs font-black text-brand-dark truncate">{log.userName}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{log.action} • {log.time}</p>
              </div>
            </div>
          )) || <p className="text-center text-xs text-slate-400 py-10 font-bold">لا توجد سجلات دخول حتى الآن</p>}
        </div>
      </div>
    </div>

    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-black text-brand-dark flex items-center gap-2">
          <i className="fa-solid fa-file-invoice-dollar text-brand-navy"></i> سجل الفواتير
        </h4>
        <button className="text-[10px] font-black bg-slate-50 text-brand-navy px-4 py-2 rounded-xl border border-slate-200">طلب دفعة جديدة</button>
      </div>
      <div className="space-y-3">
        {activeCase.financials.invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-50 bg-slate-50/50 hover:bg-white transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-brand-navy">
                <i className="fa-solid fa-money-check-dollar"></i>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-brand-dark">فاتورة رقم {inv.id}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">{inv.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <p className="text-sm font-black text-brand-dark">{inv.amount.toLocaleString()} د.ع</p>
              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{inv.status === 'paid' ? 'تم التسديد' : 'معلقة'}</span>
              <button className="text-slate-300 group-hover:text-brand-navy transition"><i className="fa-solid fa-download"></i></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ResolutionTab = ({
  activeCase,
  setActiveTab,
  sendMessage,
}: {
  activeCase: LegalCase;
  setActiveTab: (tab: WorkspaceTab) => void;
  sendMessage: (text?: string, optimisticId?: string) => void;
}) => {
  const pendingDocuments = activeCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt);
  const remainingBalance = Math.max(0, activeCase.financials.totalAgreed - activeCase.financials.paid);
  const latestUserMessage = [...activeCase.messages].reverse().find((message) => message.sender === 'user');
  const checklist = [
    {
      label: 'لا توجد وثائق تنتظر إجراءك',
      note: pendingDocuments.length > 0 ? `${pendingDocuments.length.toLocaleString('ar-IQ')} وثيقة تحتاج متابعة` : 'كل الوثائق المطلوبة مكتملة أو تحت المراجعة.',
      done: pendingDocuments.length === 0,
      action: () => setActiveTab('summary'),
    },
    {
      label: 'التقدم التشغيلي وصل لمرحلة الإغلاق',
      note: activeCase.progress >= 80 ? `${activeCase.progress}% مكتمل` : `التقدم الحالي ${activeCase.progress}% ويحتاج متابعة إضافية.`,
      done: activeCase.progress >= 80 || activeCase.status === 'closed',
      action: () => setActiveTab('chat'),
    },
    {
      label: 'الوضع المالي واضح',
      note: remainingBalance === 0 ? 'لا يوجد مبلغ متبقٍ على هذه القضية.' : `${remainingBalance.toLocaleString()} د.ع متبقٍ حسب سجل الفواتير.`,
      done: remainingBalance === 0 || activeCase.financials.totalAgreed === 0,
      action: () => setActiveTab('financials'),
    },
    {
      label: 'آخر رسالة تمت متابعتها',
      note: latestUserMessage?.awaitingResponse ? 'توجد رسالة منك بانتظار متابعة المحامي.' : 'لا توجد رسالة معلقة منك حالياً.',
      done: !latestUserMessage?.awaitingResponse,
      action: () => setActiveTab('chat'),
    },
  ];
  const readyToClose = checklist.every((item) => item.done);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5 custom-scrollbar">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">Resolution Center</p>
              <h3 className="mt-2 text-2xl font-black text-brand-dark">إغلاق القضية بدون فقدان أي خطوة</h3>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-500">
                راجع المتطلبات النهائية، اطلب من المحامي اعتماد الإغلاق، ثم احتفظ بملخص القضية والوثائق للرجوع إليها لاحقاً.
              </p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-black ring-1 ${activeCase.status === 'closed'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                : readyToClose
                  ? 'bg-brand-navy/5 text-brand-navy ring-brand-navy/10'
                  : 'bg-amber-50 text-amber-700 ring-amber-100'
              }`}>
              {activeCase.status === 'closed' ? 'مغلقة' : readyToClose ? 'جاهزة للمراجعة النهائية' : 'تحتاج إكمال'}
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {checklist.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-right transition hover:border-brand-navy/20 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-brand-dark">{item.label}</p>
                  <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{item.note}</p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.done ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                  <i className={`fa-solid ${item.done ? 'fa-check' : 'fa-arrow-left'}`}></i>
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
            <h4 className="text-base font-black text-brand-dark">الإجراء التالي</h4>
            <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
              {activeCase.status === 'closed'
                ? 'القضية مغلقة. يمكنك حفظ الملخص أو الرجوع للوثائق في أي وقت.'
                : readyToClose
                  ? 'أرسل طلب اعتماد الإغلاق للمحامي ليؤكد النتيجة النهائية.'
                  : 'ابدأ بالعناصر غير المكتملة في قائمة الإغلاق.'}
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  const message = readyToClose
                    ? 'أرغب بمراجعة القضية للإغلاق النهائي. هل يمكنك تأكيد النتيجة والخطوات الختامية؟'
                    : 'أريد معرفة ما المتبقي قبل إغلاق القضية بشكل نهائي.';
                  sendMessage(message);
                  setActiveTab('chat');
                }}
                disabled={activeCase.status === 'closed'}
                className="rounded-2xl bg-brand-navy px-4 py-3 text-sm font-black text-white shadow-lg shadow-brand-navy/15 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                مراسلة المحامي للإغلاق
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
            <h4 className="text-base font-black text-brand-dark">نتيجة الملف</h4>
            <div className="mt-4 grid gap-3 text-right">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black text-slate-400">المحامي</p>
                <p className="mt-1 text-sm font-black text-brand-dark">{activeCase.lawyer.name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black text-slate-400">الوثائق</p>
                <p className="mt-1 text-sm font-black text-brand-dark">{activeCase.documents.length.toLocaleString('ar-IQ')} وثيقة</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black text-slate-400">الحالة</p>
                <p className="mt-1 text-sm font-black text-brand-dark">{activeCase.statusText}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default function MyCases() {
  const location = useLocation();

  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('summary');
  const [newMessage, setNewMessage] = useState<string>('');
  const [isLawyerTyping, setIsLawyerTyping] = useState<boolean>(false);
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const readOnlyCaseId = queryParams.get('caseId');
  const isReadOnlyView = queryParams.get('mode') === 'readonly';
  const readOnlySection = queryParams.get('section');

  const activeCase = useMemo(() => cases.find((c) => c.id === activeCaseId) || null, [cases, activeCaseId]);

  const [replyModalDoc, setReplyModalDoc] = useState<LegalDocument | null>(null);
  const [replyText, setReplyText] = useState('');

  const mergeCasesWithPendingMessages = useCallback((serverCases: LegalCase[], localCases: LegalCase[]) => {
    return serverCases.map((serverCase) => {
      const localCase = localCases.find((item) => item.id === serverCase.id);
      if (!localCase) {
        return serverCase;
      }

      const pendingMessages = localCase.messages.filter((message) => message.deliveryState);
      if (pendingMessages.length === 0) {
        return serverCase;
      }

      const mergedPendingMessages = pendingMessages.filter((pendingMessage) => {
        if (pendingMessage.deliveryState === 'failed') {
          return true;
        }

        return !serverCase.messages.some(
          (message) => message.sender === pendingMessage.sender && message.text === pendingMessage.text,
        );
      });

      if (mergedPendingMessages.length === 0) {
        return serverCase;
      }

      return {
        ...serverCase,
        messages: [...serverCase.messages, ...mergedPendingMessages],
      };
    });
  }, []);

  const replaceCaseInState = useCallback((nextCase: LegalCase) => {
    setCases((current) => {
      const existingIndex = current.findIndex((item) => item.id === nextCase.id);
      if (existingIndex === -1) {
        return [nextCase, ...current];
      }

      const next = [...current];
      next[existingIndex] = nextCase;
      return next;
    });
  }, []);

  const refreshCases = useCallback(async (nextActiveCaseId?: string | null) => {
    try {
      const response = await apiClient.getWorkspaceCases();
      const nextCases = response.data || [];
      if (nextCases.length > 0) {
        setCases((current) => mergeCasesWithPendingMessages(nextCases, current));

        // Robust selection of next active case:
        // 1. Use suggested ID if it exists in the fresh list
        // 2. Otherwise use the first available case
        const targetId = nextCases.some(c => c.id === nextActiveCaseId)
          ? nextActiveCaseId!
          : nextCases[0].id;
        setActiveCaseId(targetId);
      } else {
        setCases([]);
        setActiveCaseId(''); // Ensure active ID is cleared when no cases remain
      }
    } catch (error) {
      console.error('Failed to refresh cases', error);
    }
  }, [mergeCasesWithPendingMessages]);

  useEffect(() => {
    const state = location.state as { activeCaseId?: string } | null;
    refreshCases(readOnlyCaseId || state?.activeCaseId);
  }, [location.state, readOnlyCaseId, refreshCases]);

  useEffect(() => {
    const refresh = () => {
      refreshCases(activeCaseId || undefined);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeCaseId, refreshCases]);

  useEffect(() => {
    const loadLawyers = async () => {
      try {
        const response = await apiClient.getLawyers();
        const nextLawyers: AvailableLawyer[] = (response.data || []).map((lawyer: any) => ({
          id: lawyer.id,
          name: lawyer.name,
          role: lawyer.specialty || lawyer.tagline || lawyer.experience || 'محامٍ',
          img: lawyer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(lawyer.name)}&background=0d2a59&color=ffffff`,
        }));

        setAvailableLawyers(nextLawyers);
        setNewCaseLawyerId((current) =>
          nextLawyers.some((lawyer) => lawyer.id === current) ? current : nextLawyers[0]?.id || ''
        );
      } catch (error) {
        console.error('Failed to load lawyers for case creation', error);
        setAvailableLawyers([]);
        setNewCaseLawyerId('');
      }
    };

    loadLawyers();
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activePreviewDoc, setActivePreviewDoc] = useState<LegalDocument | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [showArchived, setShowArchived] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<SidebarFilter>('needs_action');
  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseType, setNewCaseType] = useState('civil');
  const [availableLawyers, setAvailableLawyers] = useState<AvailableLawyer[]>([]);
  const [newCaseLawyerId, setNewCaseLawyerId] = useState('');
  const [newCaseAmount, setNewCaseAmount] = useState('');
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [createCaseError, setCreateCaseError] = useState('');
  const [isLawyerDropdownOpen, setIsLawyerDropdownOpen] = useState(false);
  const [lawyerSearchQuery, setLawyerSearchQuery] = useState('');

  const filteredLawyersInModal = useMemo(() => {
    return availableLawyers.filter(l =>
      l.name.toLowerCase().includes(lawyerSearchQuery.toLowerCase()) ||
      l.role.toLowerCase().includes(lawyerSearchQuery.toLowerCase())
    );
  }, [availableLawyers, lawyerSearchQuery]);

  const currentModalLawyer = useMemo(() =>
    availableLawyers.find(l => l.id === newCaseLawyerId) || availableLawyers[0] || null
    , [availableLawyers, newCaseLawyerId]);

  useEffect(() => {
    const state = location.state as {
      openNewCase?: boolean;
      preselectedLawyerId?: string;
      activeCaseId?: string;
      focusArea?: 'docs' | 'messages';
    } | null;

    if (!state) return;

    if (state.preselectedLawyerId) {
      setNewCaseLawyerId(state.preselectedLawyerId);
    }
    if (state.activeCaseId) {
      setActiveCaseId(state.activeCaseId);
    }
    if (state.focusArea === 'docs') {
      setActiveTab('summary');
      setDocFilter('pending');
    }
    if (state.focusArea === 'messages') {
      setActiveTab('chat');
    }
    if (state.openNewCase) {
      setIsNewCaseModalOpen(true);
    }

    window.history.replaceState({}, document.title);
  }, [location.state]);

  useEffect(() => {
    if (!isReadOnlyView) return;
    setSelectedDocs(new Set());
    setMovingDocId(null);
    setDocToSign(null);
    setReplyModalDoc(null);
    if (readOnlySection === 'documents') {
      setActiveTab('summary');
      setDocFilter('all');
      return;
    }
    setActiveTab('summary');
  }, [isReadOnlyView, readOnlySection]);

  const handleCreateCase = async () => {
    if (isReadOnlyView) return;
    if (!newCaseTitle.trim() || !newCaseLawyerId) return;
    setCreateCaseError('');
    setIsCreatingCase(true);
    const caseTypeLabel = CASE_TYPES.find(t => t.id === newCaseType)?.label || 'مدنية';
    try {
      const response = await apiClient.createWorkspaceCase({
        title: newCaseTitle.trim(),
        matter: caseTypeLabel,
        lawyerId: newCaseLawyerId,
        totalAgreedFee: Number(newCaseAmount) || 0,
        caseType: caseTypeLabel,
      });

      const createdCase = response.data;
      if (createdCase?.id) {
        setCases((prev) => [createdCase, ...prev.filter((item) => item.id !== createdCase.id)]);
        setActiveCaseId(createdCase.id);
      } else {
        await refreshCases();
      }

      setNewCaseTitle('');
      setNewCaseAmount('');
      setNewCaseType('civil');
      setCreateCaseError('');
      setIsNewCaseModalOpen(false);
    } catch (error: any) {
      console.error('Failed to create case', error);
      setCreateCaseError(error.response?.data?.error || 'تعذر إنشاء الملف. تأكد من اختيار محامٍ صالح ثم حاول مرة أخرى.');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const downloadDocument = (doc: LegalDocument) => {
    if (doc.previewUrl) {
      const link = document.createElement('a');
      link.href = doc.previewUrl;
      link.download = doc.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    const manifest = [
      `Document: ${doc.name}`,
      `Size: ${doc.size}`,
      `Date: ${doc.date}`,
      `Type: ${doc.type}`,
      `Status: ${doc.isSigned ? 'signed' : doc.actionRequired || 'uploaded'}`,
    ].join('\n');
    const blob = new Blob([manifest], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.name.replace(/\.[^/.]+$/, '') || 'document'}-details.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    setSelectedDocs(new Set());
  }, [activeCaseId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePreviewDoc(null);
        setIsNewCaseModalOpen(false);
        setIsQrModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExportAll = async () => {
    if (!activeCase || activeCase.documents.length === 0) {
      alert('لا توجد وثائق للتصدير.');
      return;
    }

    setIsExporting(true);
    try {
      const rows = [
        'name,size,date,type,status,folder',
        ...activeCase.documents.map((doc) => [
          doc.name,
          doc.size,
          doc.date,
          doc.type,
          doc.isSigned ? 'signed' : doc.actionRequired || 'uploaded',
          activeCase.folders.find((folder) => folder.id === doc.folderId)?.name || 'root',
        ].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')),
      ];
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeCase.title.replace(/\s+/g, '_')}-documents.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('فشل تصدير الوثائق. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadTimersRef = useRef<number[]>([]);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);

  // Folder states
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [movingDocId, setMovingDocId] = useState<string | null>(null);
  const [docMoveConfirmTo, setDocMoveConfirmTo] = useState<string | null | undefined>(undefined);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set()); // State for selected documents
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Document Filtering
  const [docFilter, setDocFilter] = useState<DocFilter>('all');

  const filteredDocuments = useMemo(() => {
    if (!activeCase) return [] as LegalDocument[];

    return activeCase.documents.filter((doc) => {
      const inFolder = activeFolderId ? doc.folderId === activeFolderId : true;
      if (!inFolder) return false;

      const matchesSearch = doc.name.toLowerCase().includes(docSearchQuery.toLowerCase());
      if (!matchesSearch) return false;

      switch (docFilter) {
        case 'pending':
          return doc.actionRequired === 'بانتظار توقيعك' && !doc.isSigned;
        case 'signed':
          return !!doc.isSigned;
        case 'expired':
          return !!doc.expiresAt && !doc.isSigned;
        case 'contracts':
          return doc.tags?.includes('contract') ?? false;
        case 'uploaded':
          return !!doc.uploadedAt && (Date.now() - new Date(doc.uploadedAt).getTime()) < 1000 * 60 * 60 * 24 * 7;
        default:
          return true;
      }
    });
  }, [activeCase, docFilter, activeFolderId, docSearchQuery]);

  // Custom Fields states
  const [isNewFieldModalOpen, setIsNewFieldModalOpen] = useState<boolean>(false);
  const [newFieldLabel, setNewFieldLabel] = useState<string>('');
  const [newFieldValue, setNewFieldValue] = useState<string>('');

  // Signature states
  const [docToSign, setDocToSign] = useState<string | null>(null);
  const [isRequestingSignature, setIsRequestingSignature] = useState<boolean>(false);

  // Notification Toast State
  const [notification, setNotification] = useState<{ show: boolean, message: string, docId?: string, expires?: string } | null>(null);

  // Check for expired/expiring docs that need signature
  useEffect(() => {
    if (activeCase) {
      const expiringDocs = activeCase.documents.filter(
        d => d.actionRequired === 'بانتظار توقيعك' && d.expiresAt && !d.isSigned
      );
      if (expiringDocs.length > 0) {
        setNotification({
          show: true,
          message: `يوجد لديك وثيقة (${expiringDocs[0].name}) تتطلب التوقيع قبل انقضاء الصلاحية.`,
          docId: expiringDocs[0].id,
          expires: expiringDocs[0].expiresAt ?? undefined
        });
      } else {
        setNotification(null);
      }
    }
  }, [activeCaseId, cases]);

  useEffect(() => {
    return () => {
      uploadTimersRef.current.forEach(clearInterval);
      uploadTimersRef.current = [];
    };
  }, []);

  const confirmDelete = async () => {
    if (!caseToDelete) return;
    const idToDelete = caseToDelete;
    setCaseToDelete(null); // Close modal immediately for better UX
    try {
      await apiClient.deleteWorkspaceCase(idToDelete);
      await refreshCases();
      alert('تم حذف الملف بنجاح.');
    } catch (error: any) {
      console.error('Failed to delete case', error);
      alert(error.response?.data?.error || 'تعذر حذف الملف. يرجى المحاولة مرة أخرى.');
    }
  };

  const createFolder = async () => {
    if (isReadOnlyView) return;
    if (!newFolderName.trim() || !activeCase) {
      alert('يرجى إدخال اسم المجلد.');
      return;
    }
    try {
      const response = await apiClient.addCaseFolder(activeCaseId, newFolderName);
      if (response.data) {
        setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
        setNewFolderName('');
        setIsNewFolderModalOpen(false);
      }
    } catch (error: any) {
      console.error('Failed to create folder', error);
      alert(error.response?.data?.error || 'فشل إنشاء المجلد.');
    }
  };

  const addCustomField = async () => {
    if (isReadOnlyView) return;
    if (!newFieldLabel.trim() || !newFieldValue.trim() || !activeCase) {
      alert('يرجى ملء جميع الحقول.');
      return;
    }
    try {
      const response = await apiClient.addCaseCustomField(activeCaseId, newFieldLabel, newFieldValue);
      if (response.data) {
        setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
        setNewFieldLabel('');
        setNewFieldValue('');
        setIsNewFieldModalOpen(false);
      }
    } catch (error: any) {
      console.error('Failed to add custom field', error);
      alert(error.response?.data?.error || 'فشل إضافة الحقل.');
    }
  };

  const toggleDocSelection = (id: string) => { // Function to toggle document selection
    if (isReadOnlyView) return;
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveDocuments = async (folderId: string | null, ids: string[]) => {
    if (isReadOnlyView) return;
    if (!activeCase || ids.length === 0) return;
    try {
      const response = await apiClient.moveCaseDocuments(activeCaseId, ids, folderId);
      if (response.data) {
        setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
        setMovingDocId(null);
        setSelectedDocs(new Set());
        setDocMoveConfirmTo(undefined);
      }
    } catch (error: any) {
      console.error('Failed to move documents', error);
      alert(error.response?.data?.error || 'فشل نقل الوثائق.');
      setMovingDocId(null);
    }
  };

  const executeSignDocument = async () => {
    if (isReadOnlyView) return;
    if (!docToSign || !activeCase) return;
    setIsRequestingSignature(true);
    try {
      const response = await apiClient.signCaseDocument(activeCaseId, docToSign);
      if (response.data) {
        setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
        alert('تم توقيع الوثيقة بنجاح!');
      }
      setDocToSign(null);
    } catch (error: any) {
      console.error('Failed to sign document', error);
      alert(error.response?.data?.error || 'فشل توقيع الوثيقة.');
    } finally {
      setIsRequestingSignature(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLElement>) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    setIsDragActive(false);
    if (isReadOnlyView) return;

    const files = Array.from(
      'dataTransfer' in e ? e.dataTransfer.files || [] : e.target.files || []
    ) as File[];
    if (!files.length || !activeCase) {
      alert('يرجى اختيار ملف واحد على الأقل.');
      return;
    }

    // Validate file sizes and types
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

    files.forEach((file) => {
      // Check file size
      if (file.size > maxFileSize) {
        alert(`الملف "${file.name}" كبير جداً (الحد الأقصى: 50MB).`);
        return;
      }

      // Check file type
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions.includes(extension || '')) {
        alert(`نوع الملف "${file.name}" غير مدعوم.`);
        return;
      }

      const tempId = `temp-${Date.now()}-${file.name}`;
      const fileType: DocumentType = extension === 'pdf' ? 'pdf' : ['jpg', 'jpeg', 'png'].includes(extension || '') ? 'image' : 'other';
      const newDoc: LegalDocument = {
        id: tempId,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        date: 'الآن',
        type: fileType,
        folderId: activeFolderId,
        actionRequired: null,
        expiresAt: null,
        expiresText: null,
        progress: 0,
        isUploading: true,
        uploadedAt: new Date().toISOString(),
      };

      setCases((prev) => prev.map((c) => (c.id === activeCaseId ? { ...c, documents: [...c.documents, newDoc] } : c)));

      window.setTimeout(async () => {
        try {
          const response = await apiClient.addCaseDocument(activeCaseId, {
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
            type: fileType,
            folderId: activeFolderId,
          });
          if (response.data) {
            setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
          }
        } catch (error: any) {
          console.error('Failed to upload document', error);
          // Remove the failed upload
          setCases(prev => prev.map(c => c.id === activeCaseId ? { ...c, documents: c.documents.filter(d => d.id !== tempId) } : c));
          alert(`فشل رفع الملف "${file.name}".`);
        }
      }, 400);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnlyView) return;
    if (e.type === "dragenter" || e.type === "dragover") setIsDragActive(true);
    else if (e.type === "dragleave" || e.type === "drop") setIsDragActive(false);
  };

  const updateMessageDeliveryState = useCallback((caseId: string, messageId: string, deliveryState: MessageDeliveryState) => {
    setCases((current) =>
      current.map((item) =>
        item.id === caseId
          ? {
            ...item,
            messages: item.messages.map((message) =>
              message.id === messageId
                ? {
                  ...message,
                  deliveryState,
                  time: deliveryState === 'failed' ? 'فشل الإرسال' : 'الآن',
                }
                : message,
            ),
          }
          : item,
      ),
    );
  }, []);

  const appendOptimisticMessage = useCallback((caseId: string, message: CaseMessage) => {
    setCases((current) =>
      current.map((item) =>
        item.id === caseId
          ? {
            ...item,
            messages: [...item.messages, message],
          }
          : item,
      ),
    );
  }, []);

  const handleDocReply = useCallback((doc: LegalDocument) => {
    if (isReadOnlyView) return;
    setReplyModalDoc(doc);
    setReplyText('');
  }, [isReadOnlyView]);

  const handleSendDocReply = useCallback(async () => {
    if (isReadOnlyView) return;
    if (!replyText.trim() || !replyModalDoc || !activeCase) return;

    try {
      // Send the reply as a message to the lawyer
      const response = await apiClient.addCaseMessage(
        activeCase.id,
        `[رد على وثيقة: ${replyModalDoc.name}]\n\n${replyText}`,
        'user'
      );

      if (response.data) {
        replaceCaseInState(response.data);
      } else {
        await refreshCases(activeCase.id);
      }

      setReplyModalDoc(null);
      setReplyText('');

      // Mock lawyer typing
      setIsLawyerTyping(true);
      setTimeout(() => {
        setIsLawyerTyping(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to send reply', error);
      alert('فشل إرسال الرد. يرجى المحاولة مرة أخرى.');
    }
  }, [isReadOnlyView, replyText, replyModalDoc, activeCase, replaceCaseInState, refreshCases]);

  const sendMessage = useCallback(async (text: string = newMessage, optimisticId?: string) => {
    if (isReadOnlyView) return;
    if (!text.trim() || !activeCase) return;

    const outgoingText = text.trim();
    const nextOptimisticId = optimisticId || `temp-message-${Date.now()}`;

    if (!optimisticId) {
      appendOptimisticMessage(activeCase.id, {
        id: nextOptimisticId,
        sender: 'user',
        text: outgoingText,
        awaitingResponse: true,
        time: 'الآن',
        deliveryState: 'sending',
      });
      setNewMessage('');
    } else {
      updateMessageDeliveryState(activeCase.id, nextOptimisticId, 'sending');
    }

    try {
      const response = await apiClient.addCaseMessage(activeCase.id, outgoingText, 'user');
      if (response.data) {
        replaceCaseInState(response.data);
      } else {
        await refreshCases(activeCase.id);
      }
    } catch (error) {
      console.error('Failed to send message', error);
      updateMessageDeliveryState(activeCase.id, nextOptimisticId, 'failed');
      if (!optimisticId) {
        setNewMessage((current) => (current.trim().length ? current : outgoingText));
      }
      return;
    }

    // Mock lawyer typing
    setIsLawyerTyping(true);
    setTimeout(() => {
      setIsLawyerTyping(false);
      // We could mock a reply here if we really wanted to, but typing is enough UX.
    }, 3000);
  }, [activeCase, appendOptimisticMessage, isReadOnlyView, newMessage, refreshCases, replaceCaseInState, updateMessageDeliveryState]);

  const visibleCases = useMemo(
    () => cases.filter((item) => (showArchived ? item.isArchived : !item.isArchived)),
    [cases, showArchived]
  );

  const workspaceStats = useMemo(() => {
    const documentsNeedingAction = cases.reduce(
      (total, item) => total + item.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length,
      0
    );
    const unreadMessages = cases.reduce((total, item) => total + (item.unreadCount ?? 0), 0);
    const averageProgress = cases.length
      ? Math.round(cases.reduce((total, item) => total + item.progress, 0) / cases.length)
      : 0;

    return [
      { label: 'ملفات ظاهرة', value: visibleCases.length.toLocaleString('ar-IQ'), icon: 'fa-folder-open', tone: 'text-brand-navy bg-brand-navy/5 border-brand-navy/10' },
      { label: 'إجراءات مطلوبة', value: documentsNeedingAction.toLocaleString('ar-IQ'), icon: 'fa-bell', tone: 'text-amber-700 bg-amber-50 border-amber-100' },
      { label: 'رسائل جديدة', value: unreadMessages.toLocaleString('ar-IQ'), icon: 'fa-comments', tone: 'text-blue-700 bg-blue-50 border-blue-100' },
      { label: 'متوسط الإنجاز', value: `${averageProgress}%`, icon: 'fa-chart-simple', tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
    ];
  }, [cases, visibleCases.length]);

  const activeCaseActionCount = activeCase
    ? activeCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length + (activeCase.unreadCount ?? 0)
    : 0;

  const nextAction = activeCase
    ? activeCase.documents.some((doc) => doc.actionRequired || doc.expiresAt)
      ? { label: 'راجع المستندات المطلوبة', tab: 'summary' as WorkspaceTab, icon: 'fa-file-signature', docFilter: 'pending' as DocFilter }
      : activeCase.unreadCount
        ? { label: 'افتح التوجيهات الجديدة', tab: 'chat' as WorkspaceTab, icon: 'fa-comments' }
        : { label: 'راجع ملخص التقدم', tab: 'summary' as WorkspaceTab, icon: 'fa-rectangle-list' }
    : null;

  const activeCaseInsights = useMemo(() => {
    if (!activeCase) {
      return [];
    }

    const pendingDocs = activeCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length;
    const signedDocs = activeCase.documents.filter((doc) => doc.isSigned).length;
    const paidPercent = activeCase.financials.totalAgreed > 0
      ? Math.round((activeCase.financials.paid / activeCase.financials.totalAgreed) * 100)
      : 0;

    return [
      { label: 'الإجراءات', value: pendingDocs.toLocaleString('ar-IQ'), icon: 'fa-bell', tone: pendingDocs > 0 ? 'bg-amber-50 text-amber-700 ring-amber-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
      { label: 'الوثائق', value: activeCase.documents.length.toLocaleString('ar-IQ'), icon: 'fa-folder-open', tone: 'bg-blue-50 text-blue-700 ring-blue-100' },
      { label: 'الموقعة', value: signedDocs.toLocaleString('ar-IQ'), icon: 'fa-signature', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
      { label: 'السداد', value: `${paidPercent}%`, icon: 'fa-wallet', tone: 'bg-brand-navy/5 text-brand-navy ring-brand-navy/10' },
    ];
  }, [activeCase]);

  const documentFilterCounts = useMemo(() => {
    const docs = activeCase?.documents || [];
    const recentLimit = 1000 * 60 * 60 * 24 * 7;

    return {
      all: docs.length,
      pending: docs.filter((doc) => doc.actionRequired === 'بانتظار توقيعك' && !doc.isSigned).length,
      expired: docs.filter((doc) => doc.expiresAt && !doc.isSigned).length,
      signed: docs.filter((doc) => doc.isSigned).length,
      uploaded: docs.filter((doc) => doc.uploadedAt && Date.now() - new Date(doc.uploadedAt).getTime() < recentLimit).length,
      contracts: docs.filter((doc) => doc.tags?.includes('contract')).length,
    } satisfies Record<DocFilter, number>;
  }, [activeCase]);

  const documentHealth = useMemo(() => {
    const docs = activeCase?.documents || [];
    const signed = docs.filter((doc) => doc.isSigned).length;
    const needsAction = docs.filter((doc) => doc.actionRequired || doc.expiresAt).length;
    const percent = docs.length ? Math.round((signed / docs.length) * 100) : 0;

    return { signed, needsAction, percent };
  }, [activeCase]);

  const attentionQueue = useMemo(() => {
    return cases
      .map((item) => {
        const pendingDocs = item.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length;
        const unread = item.unreadCount ?? 0;
        const score = pendingDocs * 3 + unread * 2 + (item.status === 'pending' ? 1 : 0);

        return {
          id: item.id,
          title: item.title,
          statusText: item.statusText,
          pendingDocs,
          unread,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [cases]);

  const latestTimelineEvent = activeCase?.timeline?.[0] || null;
  const readOnlyLinks = useMemo(() => {
    if (!activeCase || typeof window === 'undefined') return null;

    return {
      summary: buildReadOnlyCaseUrl(window.location.origin, activeCase.id, 'summary'),
      documents: buildReadOnlyCaseUrl(window.location.origin, activeCase.id, 'documents'),
    };
  }, [activeCase]);

  return (
    <div className="app-view fade-in w-full max-w-full space-y-5 overflow-x-hidden">
      {/* Toast Notification for Reminders */}
      {!isReadOnlyView && notification && notification.show && (
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed top-24 right-8 z-[200] max-w-sm w-full bg-white rounded-2xl shadow-2xl shadow-brand-navy/10 border border-brand-navy/20 p-4">
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 bg-brand-navy/10 text-brand-navy rounded-full flex items-center justify-center shrink-0 mt-1">
              <i className="fa-solid fa-bell"></i>
            </div>
            <div className="flex-1">
              <h3 className="font-black text-brand-dark text-sm mb-1">تذكير هام!</h3>
              <p className="text-gray-500 text-xs leading-relaxed mb-3">{notification.message}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (notification.docId) {
                      setDocToSign(notification.docId);
                    }
                    setNotification(null);
                  }}
                  className="bg-brand-navy text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-dark transition shadow-sm"
                >
                  توقيع الآن
                </button>
                <button
                  onClick={() => setNotification(null)}
                  className="bg-gray-100 text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl text-xs font-bold transition"
                >
                  تجاهل
                </button>
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-red-500 transition"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </motion.div>
      )}

      {/* Header section */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-right shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-brand-navy hover:text-brand-navy lg:flex"
              title={isSidebarCollapsed ? 'إظهار قائمة القضايا' : 'إخفاء قائمة القضايا'}
            >
              <i className={`fa-solid ${isSidebarCollapsed ? 'fa-indent' : 'fa-outdent'}`}></i>
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">قضاياي</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-slate-100 bg-white px-3 py-1.5 text-xs font-black text-slate-500 shadow-sm">
                  {isReadOnlyView ? 'عرض قراءة فقط' : showArchived ? 'عرض الأرشيف' : 'القضايا النشطة'}
                </span>
                {activeCaseActionCount > 0 && (
                  <span className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 shadow-sm">
                    {activeCaseActionCount.toLocaleString('ar-IQ')} إجراء في الملف الحالي
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-black text-brand-dark sm:text-3xl">مركز إدارة القضايا</h2>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-500">كل ملف، رسالة، وثيقة، ودفعة في مساحة عمل واحدة مرتبة حسب ما يحتاج انتباهك أولاً.</p>
            </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {workspaceStats.map((stat) => (
                <div key={stat.label} className={`min-h-[86px] rounded-2xl border p-3 ${stat.tone}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black">{stat.label}</span>
                    <i className={`fa-solid ${stat.icon}`}></i>
                  </div>
                  <p className="mt-3 text-2xl font-black leading-none">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="border-t border-slate-100 bg-slate-50/70 p-5 xl:border-r xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">العمل الآن</p>
                <h3 className="mt-1 text-base font-black text-brand-dark">أولوية اليوم</h3>
              </div>
              <ActionButton
                onClick={() => setIsNewCaseModalOpen(true)}
                variant="primary"
                size="sm"
                disabled={isReadOnlyView}
              >
                <i className="fa-solid fa-circle-plus"></i>
                ملف جديد
              </ActionButton>
            </div>

            <div className="mt-4 space-y-2">
              {attentionQueue.length > 0 ? attentionQueue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveCaseId(item.id);
                    setActiveTab(item.pendingDocs > 0 ? 'summary' : 'chat');
                    if (item.pendingDocs > 0) setDocFilter('pending');
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white bg-white px-4 py-3 text-right shadow-sm transition hover:border-brand-navy/20"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black text-brand-dark">{item.title}</span>
                    <span className="mt-1 block text-[10px] font-bold text-slate-400">{item.statusText}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black">
                    {item.pendingDocs > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{item.pendingDocs} وثائق</span>}
                    {item.unread > 0 && <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{item.unread} رسائل</span>}
                  </span>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-black text-brand-dark">لا توجد إجراءات عاجلة</p>
                  <p className="mt-1 text-[11px] font-bold leading-5 text-slate-400">الملفات الحالية مستقرة ويمكنك المتابعة من الملخص.</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              disabled={isReadOnlyView}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 transition hover:border-brand-navy hover:text-brand-navy"
            >
              <i className={`fa-solid ${showArchived ? 'fa-folder-open' : 'fa-box-archive'}`}></i>
              {showArchived ? 'عرض القضايا النشطة' : 'عرض الأرشيف'}
            </button>
          </aside>
        </div>
      </div>

      {activeCase && (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-right shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">القضية الحالية</p>
              <h3 className="mt-1 truncate text-lg font-black text-brand-dark">{activeCase.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span className={`rounded-full px-3 py-1 text-[10px] font-black ring-1 ${getCaseStatusTone(activeCase.status)}`}>{activeCase.statusText}</span>
                {isReadOnlyView && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
                    قراءة فقط
                  </span>
                )}
                <span>{activeCase.progress}% مكتمل</span>
                {latestTimelineEvent && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                    <span className="truncate">آخر تحديث: {latestTimelineEvent.title}</span>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[430px]">
              {activeCaseInsights.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (isReadOnlyView) {
                      setActiveTab('summary');
                      return;
                    }
                    if (item.label === 'الإجراءات') {
                      setActiveTab('summary');
                      setDocFilter('pending');
                    } else if (item.label === 'السداد') {
                      setActiveTab('financials');
                    } else {
                      setActiveTab('summary');
                    }
                  }}
                  className={`rounded-2xl px-3 py-2 text-right ring-1 transition hover:-translate-y-0.5 hover:shadow-sm ${item.tone}`}
                >
                  <span className="flex items-center justify-between gap-2 text-[10px] font-black">
                    {item.label}
                    <i className={`fa-solid ${item.icon}`}></i>
                  </span>
                  <span className="mt-1 block text-lg font-black leading-none">{item.value}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isReadOnlyView && (
                <ActionButton variant="ghost" size="sm" onClick={() => setIsQrModalOpen(true)} title="QR للملخص والمستندات">
                  <i className="fa-solid fa-qrcode"></i>
                </ActionButton>
              )}
              {!isReadOnlyView && (
                <ActionButton
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const response = await apiClient.toggleWorkspaceCaseArchive(activeCaseId);
                    setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
                  }}
                  title={activeCase.isArchived ? 'إعادة من الأرشيف' : 'نقل للأرشيف'}
                >
                  <i className={`fa-solid ${activeCase.isArchived ? 'fa-box-open' : 'fa-box-archive'}`}></i>
                </ActionButton>
              )}
              {!isReadOnlyView && nextAction && (
                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if ('docFilter' in nextAction) setDocFilter(nextAction.docFilter);
                    setActiveTab(nextAction.tab);
                  }}
                >
                  <i className={`fa-solid ${nextAction.icon}`}></i>
                  {nextAction.label}
                </ActionButton>
              )}
              {!isReadOnlyView && (
                <ActionButton variant="secondary" size="sm" onClick={() => setActiveTab('chat')}>
                  <i className="fa-regular fa-comments"></i>
                  الرسائل
                </ActionButton>
              )}
              {!isReadOnlyView && (
                <ActionButton variant="secondary" size="sm" onClick={() => setActiveTab('resolution')}>
                  <i className="fa-solid fa-circle-check"></i>
                  الإغلاق
                </ActionButton>
              )}
              {!isReadOnlyView && (
                <ActionButton variant="danger" size="sm" onClick={() => setCaseToDelete(activeCase.id)} title="حذف الملف">
                  <i className="fa-solid fa-trash-can"></i>
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      )}

      {activeCase && (
        <SmartCaseAssistant
          activeCase={activeCase}
          setActiveTab={setActiveTab}
          setDocFilter={setDocFilter}
          setNewMessage={setNewMessage}
          isReadOnlyView={isReadOnlyView}
        />
      )}

      <div className={`grid min-h-[680px] w-full min-w-0 grid-cols-1 gap-5 2xl:h-[calc(100vh-250px)] ${isSidebarCollapsed ? '' : 'xl:grid-cols-[300px_minmax(0,1fr)]'}`}>
        {!isSidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="min-w-0 bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden text-right"
          >
            <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-brand-dark">قائمة الملفات</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">فلترة سريعة حسب الإجراء والحالة</p>
                </div>
                <span className="rounded-full bg-brand-navy/5 px-3 py-1 text-[10px] font-black text-brand-navy">
                  {visibleCases.length.toLocaleString('ar-IQ')}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="ابحث في ملفاتي..."
                  className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-11 pl-4 text-sm focus:outline-none focus:border-brand-navy transition text-right font-black"
                />
                <i className="fa-solid fa-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
                {SIDEBAR_FILTERS.filter((filter) => ['needs_action', 'in_progress', 'completed', 'all'].includes(filter.id)).map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setSidebarStatusFilter(filter.id)}
                    className={`flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-[10px] font-black transition-all ${sidebarStatusFilter === filter.id ? 'border-brand-navy bg-brand-navy text-white shadow-md shadow-brand-navy/15' : 'border-slate-100 bg-white text-slate-500 hover:border-brand-navy/20 hover:text-brand-navy'}`}
                  >
                    <i className={`fa-solid ${filter.icon}`}></i>
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <CaseSidebar
              cases={cases}
              activeCaseId={activeCaseId}
              setActiveCaseId={setActiveCaseId}
              showArchived={showArchived}
              searchQuery={sidebarSearch}
              statusFilter={sidebarStatusFilter}
            />
          </motion.div>
        )}

        {/* Case Detail Workspace */}
        <div className="min-w-0 flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-right shadow-premium">
          {!activeCase ? (
            <div className="flex-1 p-8">
              <EmptyState
                icon="folder-open"
                title="لا توجد ملفات نشطة"
                description="لم يتم العثور على أي ملفات. يمكنك فتح ملف جديد للبدء أو التبديل إلى الأرشيف."
                action={<ActionButton variant="primary" onClick={() => setIsNewCaseModalOpen(true)}>فتح ملف جديد</ActionButton>}
              />
            </div>
          ) : (
            <>
              {/* Custom Fields Section */}
              <div className="relative z-10 border-b border-slate-100 bg-white p-3 md:p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-black text-brand-dark flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-brand-gold"></div>
                    معلومات الملف
                  </h4>
                  {!isReadOnlyView && (
                    <button
                      onClick={() => setIsNewFieldModalOpen(true)}
                      className="text-[10px] bg-slate-50 border border-slate-200 text-brand-navy px-3 py-1.5 rounded-lg font-black transition hover:bg-white hover:border-brand-navy"
                    >
                      <i className="fa-solid fa-circle-plus ml-1"></i> إضافة بيانات
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {activeCase.customFields.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => !isReadOnlyView && setIsNewFieldModalOpen(true)}
                      className="col-span-2 min-h-[58px] rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-right transition hover:border-brand-navy hover:bg-white lg:col-span-4"
                    >
                      <span className="text-sm font-black text-brand-dark">{isReadOnlyView ? 'لا توجد بيانات إضافية للعرض' : 'أضف بيانات الملف المهمة'}</span>
                      <span className="mt-1 block text-[11px] font-bold text-slate-400">{isReadOnlyView ? 'هذه النسخة مخصصة للقراءة فقط.' : 'مثل المحكمة، رقم الدعوى، أو موعد الجلسة القادمة.'}</span>
                    </button>
                  ) : activeCase.customFields.map((field: any) => (
                    <div key={field.id} className="flex min-h-[58px] flex-col rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:border-brand-gold/30">
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1">{field.label}</span>
                      <span className="text-sm font-black text-brand-dark truncate" title={field.value}>{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex min-w-0 flex-col overflow-hidden 2xl:flex-row">
                {/* Communication Area */}
                <div className="flex min-h-0 min-w-0 flex-[1_1_auto] flex-col overflow-hidden border-l border-slate-100 2xl:min-w-[720px]">

                  {/* Reminders / Actions Alert Banner */}
                  {!isReadOnlyView && activeCase.documents.filter((d: any) => d.actionRequired || d.expiresAt).length > 0 && (
                    <div className="bg-amber-50 border-b border-amber-100 p-4">
                      <div className="flex items-start gap-3">
                        <i className="fa-solid fa-bell text-amber-500 mt-0.5"></i>
                        <div>
                          <h4 className="text-sm font-black text-amber-800 mb-1">تنبيهات وإجراءات مطلوبة</h4>
                          <div className="space-y-1">
                            {activeCase.documents.filter((d: any) => d.actionRequired || d.expiresAt).map((doc: any) => (
                              <div key={`alert-${doc.id}`} className="text-xs font-bold text-amber-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                <div className="flex items-center gap-2">
                                  <i className="fa-solid fa-file-signature text-amber-500"></i>
                                  <span>
                                    {doc.actionRequired && doc.actionRequired !== 'بانتظار توقيعك' ? (
                                      <>ملاحظة المحامي على <span className="font-black">{doc.name}</span>: <span className="italic">"{doc.actionRequired}"</span></>
                                    ) : (
                                      <>يرجى العمل على الوثيقة <span className="font-black cursor-pointer hover:text-amber-900 mx-1 underline underline-offset-4 decoration-amber-200">{doc.name}</span></>
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {doc.expiresAt && <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg text-[10px] font-black border border-red-100"><i className="fa-solid fa-clock ml-1"></i> {doc.expiresText}</span>}
                                  {doc.actionRequired === 'بانتظار توقيعك' && (
                                    <button
                                      onClick={() => setDocToSign(doc.id)}
                                      className="bg-brand-navy hover:bg-brand-dark text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md transition whitespace-nowrap"
                                    >
                                      <i className="fa-solid fa-pen-nib ml-1"></i> توقيع الآن
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sticky top-0 z-20 flex border-b border-slate-100 font-black text-sm text-brand-dark bg-slate-50/80 p-1 backdrop-blur">
                    {[
                      { id: 'summary', label: 'الملخص', icon: 'fa-solid fa-rectangle-list', badge: `${activeCase.progress}%` },
                      { id: 'chat', label: 'التوجيهات', icon: 'fa-regular fa-comments', badge: activeCase.unreadCount ? activeCase.unreadCount.toLocaleString('ar-IQ') : undefined },
                      { id: 'financials', label: 'المالية', icon: 'fa-solid fa-file-invoice-dollar', badge: `${Math.round((activeCase.financials.paid / Math.max(activeCase.financials.totalAgreed, 1)) * 100)}%` },
                      { id: 'resolution', label: 'الإغلاق', icon: 'fa-solid fa-circle-check', badge: activeCase.status === 'closed' ? 'تم' : undefined },
                    ].filter((tab) => !isReadOnlyView || tab.id === 'summary').map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as WorkspaceTab)}
                        className={`relative flex-1 rounded-2xl py-3.5 transition ${activeTab === tab.id ? 'z-10 text-brand-navy' : 'text-slate-400 hover:bg-white/50 hover:text-brand-dark'}`}
                      >
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeWorkspaceTab"
                            className="absolute inset-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-2xl -z-10"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="flex min-w-0 items-center justify-center gap-2 px-2">
                          <i className={tab.icon}></i>
                          <span className="truncate">{tab.label}</span>
                          {tab.badge && (
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${activeTab === tab.id ? 'bg-brand-navy/5 text-brand-navy' : 'bg-white text-slate-400 ring-1 ring-slate-100'}`}>
                              {tab.badge}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>

                  {activeTab === 'chat' ? (
                    <>
                      <div className="min-h-[360px] flex-1 overflow-y-auto overscroll-contain bg-slate-50/50 px-4 py-5 custom-scrollbar sm:max-h-[62vh] sm:px-6 lg:px-8 2xl:max-h-none">
                        <div className="text-center w-full my-4">
                          <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase">اليوم</span>
                        </div>

                        {activeCase.messages.map((msg) => (
                          <div key={msg.id} className={`flex gap-3 max-w-[96%] group sm:max-w-[88%] lg:max-w-[76%] ${msg.sender === 'user' ? 'mr-auto flex-row-reverse' : ''}`}>
                            <div className="w-9 h-9 shrink-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm mt-1">
                              <img src={msg.sender === 'user' ? 'https://i.pravatar.cc/150?img=11' : activeCase.lawyer.img} className="w-full h-full object-cover" alt="avatar" />
                            </div>
                            <div className={`p-4 rounded-2xl text-[14px] md:text-[15px] leading-7 shadow-sm relative ${msg.sender === 'user'
                              ? 'bg-brand-navy text-white rounded-tl-none before:absolute before:-left-1.5 before:top-4 before:w-3 before:h-3 before:bg-brand-navy before:rotate-45'
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tr-none before:absolute before:-right-1.5 before:top-4 before:w-3 before:h-3 before:bg-white before:rotate-45 before:border-t before:border-r before:border-slate-100'
                              }`}>
                              <p className="font-medium">{msg.text}</p>
                              {msg.sender === 'user' && (
                                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                                  <p className={`text-[10px] font-black ${msg.awaitingResponse ? 'text-amber-200' : 'text-emerald-200'}`}>
                                    {msg.awaitingResponse ? 'بانتظار متابعة المحامي' : 'تمت متابعة رسالتك'}
                                  </p>
                                  {msg.deliveryState === 'sending' && (
                                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black text-blue-100">
                                      جارٍ الإرسال...
                                    </span>
                                  )}
                                  {msg.deliveryState === 'failed' && (
                                    <button
                                      type="button"
                                      onClick={() => sendMessage(msg.text, String(msg.id))}
                                      className="rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-black text-red-100 transition hover:bg-red-500/25"
                                    >
                                      فشل الإرسال - إعادة المحاولة
                                    </button>
                                  )}
                                </div>
                              )}
                              <div className={`flex items-center justify-end gap-1.5 mt-2 text-[9px] font-black ${msg.sender === 'user' ? 'text-blue-200/70' : 'text-slate-400'}`}>
                                <span className="uppercase">{getMessageTimeLabel(msg)}</span>
                                {msg.sender === 'user' && (
                                  <i className={`fa-solid fa-check-double ${getMessageTimeLabel(msg) === 'الآن' ? 'opacity-50' : 'text-blue-300'}`}></i>
                                )}
                              </div>

                              {/* Message Actions Hover Overlay */}
                              <div className={`absolute top-2 opacity-0 group-hover:opacity-100 transition flex gap-1 ${msg.sender === 'user' ? '-left-10' : '-right-10'}`}>
                                <button className="w-8 h-8 rounded-xl bg-white shadow-md border border-slate-100 text-slate-400 hover:text-brand-navy flex items-center justify-center transition">
                                  <i className="fa-regular fa-copy text-[10px]"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Lawyer Typing Indicator */}
                        {isLawyerTyping && (
                          <div className="flex gap-3 max-w-[96%] fade-in sm:max-w-[88%] lg:max-w-[76%]">
                            <div className="w-9 h-9 shrink-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm mt-1">
                              <img src={activeCase.lawyer.img} className="w-full h-full object-cover" alt="avatar" />
                            </div>
                            <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-tr-md shadow-sm flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-brand-gold rounded-full typing-dot"></div>
                              <div className="w-1.5 h-1.5 bg-brand-gold rounded-full typing-dot"></div>
                              <div className="w-1.5 h-1.5 bg-brand-gold rounded-full typing-dot"></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chat Input */}
                      {activeCase.status !== 'closed' ? (
                        <div className="border-t border-slate-100 bg-white p-4 sm:px-6 lg:px-8 flex flex-col gap-4">
                          {/* Quick Replies */}
                          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full px-1">
                            {QUICK_REPLIES.map((reply, idx) => (
                              <button
                                key={idx}
                                onClick={() => sendMessage(reply)}
                                className="shrink-0 bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-2xl text-[11px] font-black hover:bg-brand-navy hover:text-white hover:border-brand-navy transition-all whitespace-nowrap shadow-sm"
                              >
                                {reply}
                              </button>
                            ))}
                          </div>

                          <div className="rounded-[1.6rem] border border-brand-navy/10 bg-[linear-gradient(135deg,rgba(15,39,78,0.03),rgba(255,255,255,1))] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Message Desk</p>
                                <p className="mt-1 text-sm font-black text-brand-dark">أرسل تحديثاً واضحاً إلى {activeCase.lawyer.name} مع الإجراء أو المستند المطلوب.</p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-[10px] font-black ${newMessage.trim().length > 0 ? 'bg-brand-navy/5 text-brand-navy' : 'bg-slate-100 text-slate-400'}`}>
                                {newMessage.trim().length > 0 ? `${newMessage.trim().length} حرف` : 'ابدأ الكتابة'}
                              </span>
                            </div>
                          </div>

                          <div className="flex min-h-[76px] items-end gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-2 transition-all focus-within:border-brand-navy focus-within:bg-white relative">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="p-3.5 text-slate-400 hover:text-brand-navy transition-colors rounded-2xl shrink-0"
                              title="إرفاق وثيقة"
                            >
                              <i className="fa-solid fa-paperclip text-lg"></i>
                            </button>
                            <textarea
                              placeholder="اكتب رسالتك للمحامي..."
                              className="w-full resize-none border-none bg-transparent py-3.5 text-[15px] font-medium text-slate-700 focus:outline-none min-h-[56px] max-h-40"
                              rows={2}
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  sendMessage();
                                }
                              }}
                            ></textarea>

                            {!newMessage.trim() ? (
                              <button
                                onClick={() => setIsRecording(!isRecording)}
                                className={`w-12 h-12 rounded-2xl transition shrink-0 flex items-center justify-center shadow-sm ${isRecording ? 'bg-red-50 text-red-500 ring-2 ring-red-100' : 'bg-slate-200/50 text-slate-400 hover:bg-brand-navy/10 hover:text-brand-navy'}`}
                                title={isRecording ? 'إيقاف التسجيل' : 'تسجيل رسالة صوتية'}
                              >
                                <i className="fa-solid fa-microphone"></i>
                              </button>
                            ) : (
                              <button
                                onClick={() => sendMessage(newMessage)}
                                className="w-12 h-12 bg-brand-navy text-white rounded-2xl hover:bg-brand-dark transition-all shrink-0 flex items-center justify-center shadow-lg shadow-brand-navy/30 scale-in-center"
                              >
                                <i className="fa-solid fa-paper-plane"></i>
                              </button>
                            )}
                          </div>
                          {isRecording && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-black text-red-700">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
                                التسجيل الصوتي قيد التحضير. يمكنك إيقافه أو إرسال رسالة نصية الآن.
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsRecording(false)}
                                className="rounded-xl bg-white px-3 py-1.5 text-[10px] font-black text-red-600 shadow-sm"
                              >
                                إيقاف
                              </button>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold text-slate-400">
                            <span>اختصار مفيد: `Enter` للإرسال و `Shift + Enter` لسطر جديد.</span>
                            {newMessage.trim().length > 0 && (
                              <button
                                type="button"
                                onClick={() => setNewMessage('')}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-slate-300 hover:text-brand-dark"
                              >
                                مسح المسودة
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400 font-black uppercase tracking-widest">
                          هذا الملف مغلق. لا يمكن إرسال رسائل جديدة.
                        </div>
                      )}
                    </>
                  ) : activeTab === 'summary' ? (
                    <SummaryTab
                      activeCase={activeCase}
                      setIsNewFieldModalOpen={setIsNewFieldModalOpen}
                      setActiveTab={setActiveTab}
                      isReadOnlyView={isReadOnlyView}
                    />
                  ) : activeTab === 'financials' ? (
                    <FinancialsTab activeCase={activeCase} />
                  ) : (
                    <ResolutionTab
                      activeCase={activeCase}
                      setActiveTab={setActiveTab}
                      sendMessage={sendMessage}
                    />
                  )}
                </div>
                {/* Documents Area */}
                <div className="flex w-full min-w-0 shrink-0 flex-col border-r border-slate-100 bg-white 2xl:w-72">
                  <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,1))] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {activeFolderId ? (
                          <button
                            onClick={() => { setActiveFolderId(null); setSelectedDocs(new Set()); }}
                            className="flex min-w-0 items-center gap-2 text-sm font-black text-brand-dark transition hover:text-brand-navy"
                          >
                            <i className="fa-solid fa-arrow-right shrink-0"></i>
                            <span className="truncate">
                              {activeCase.folders.find((f: any) => f.id === activeFolderId)?.name || 'الوثائق'}
                            </span>
                          </button>
                        ) : (
                          <p className="flex items-center gap-2 text-sm font-black text-brand-dark">
                            <i className="fa-solid fa-folder-tree text-brand-navy"></i>
                            وثائق الملف
                          </p>
                        )}
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          {filteredDocuments.length.toLocaleString('ar-IQ')} ظاهرة من {activeCase.documents.length.toLocaleString('ar-IQ')} وثائق
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={handleExportAll}
                          disabled={isExporting || activeCase.documents.length === 0}
                          className="text-slate-400 hover:text-brand-navy transition w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50"
                          title="تصدير جميع الوثائق (ZIP)"
                        >
                          {isExporting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-export"></i>}
                        </button>
                        {!isReadOnlyView && (
                          <button
                            onClick={() => setIsNewFolderModalOpen(true)}
                            className="text-slate-400 hover:text-brand-navy transition w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm"
                            title="مجلد جديد"
                          >
                            <i className="fa-solid fa-folder-plus"></i>
                          </button>
                        )}
                        <span className="bg-brand-navy text-white text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center shadow-sm">
                          {activeCase.documents.length}
                        </span>
                      </div>
                    </div>

                    {!isReadOnlyView && documentHealth.needsAction > 0 && (
                      <button
                        type="button"
                        onClick={() => setDocFilter('pending')}
                        className="mt-4 flex w-full items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-right text-xs font-black text-amber-800 transition hover:bg-amber-100"
                      >
                        <span>توجد وثائق تحتاج توقيعك</span>
                        <span>{documentHealth.needsAction.toLocaleString('ar-IQ')}</span>
                      </button>
                    )}
                  </div>

                  <div className="border-b border-slate-100 bg-white px-4 py-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={docSearchQuery}
                        onChange={(e) => setDocSearchQuery(e.target.value)}
                        placeholder="ابحث داخل الوثائق..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-right text-xs font-bold text-slate-700 transition focus:border-brand-navy focus:bg-white focus:outline-none"
                      />
                      <i className="fa-solid fa-search absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                    </div>
                  </div>

                  {/* Batch Action Bar */}
                  <AnimatePresence>
                    {!isReadOnlyView && selectedDocs.size > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="bg-brand-navy text-white px-5 py-3 flex items-center justify-between overflow-hidden shadow-lg border-b border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedDocs.size === filteredDocuments.length && filteredDocuments.length > 0}
                            onChange={() => {
                              if (selectedDocs.size === filteredDocuments.length) setSelectedDocs(new Set());
                              else setSelectedDocs(new Set(filteredDocuments.map(d => d.id)));
                            }}
                            className="h-4 w-4 rounded accent-brand-gold border-white/20"
                          />
                          <span className="text-[10px] font-black">{selectedDocs.size} ملف مختار</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setMovingDocId('batch')} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg text-[10px] font-black transition">
                            <i className="fa-solid fa-folder-tree ml-1"></i> نقل الجماعي
                          </button>
                          <button onClick={() => setSelectedDocs(new Set())} className="text-white/60 hover:text-white text-[10px] font-black transition">إلغاء</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Document Filters */}
                  <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-white px-4 py-3 no-scrollbar">
                    {DOC_FILTERS.filter((filter) => ['all', 'pending', 'signed', 'expired'].includes(filter.id)).map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setDocFilter(filter.id)}
                        className={`flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-[10px] font-black transition-all ${docFilter === filter.id ? filter.activeClass : filter.idleClass}`}
                      >
                        <i className={`fa-solid ${filter.icon}`}></i>
                        {filter.label}
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${docFilter === filter.id ? 'bg-white/20 text-current' : 'bg-white text-slate-400 ring-1 ring-slate-100'}`}>
                          {documentFilterCounts[filter.id].toLocaleString('ar-IQ')}
                        </span>
                      </button>
                    ))}
                  </div>


                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {/* Folders List (only show if not inside a folder and no specific filter is active) */}
                    {!activeFolderId && docFilter === 'all' && activeCase.folders.map((folder: any) => (
                      <div
                        key={folder.id}
                        onClick={() => setActiveFolderId(folder.id)}
                        className="border border-slate-200 bg-slate-50 p-4 rounded-2xl hover:border-brand-navy hover:bg-white cursor-pointer transition flex justify-between items-center group shadow-inner hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <i className="fa-solid fa-folder text-brand-gold text-2xl transition-transform group-hover:scale-110"></i>
                          <span className="text-sm font-black text-brand-dark truncate">{folder.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">
                          {activeCase.documents.filter((d: any) => d.folderId === folder.id).length}
                        </span>
                      </div>
                    ))}

                    {/* Documents List */}
                    {filteredDocuments.length === 0 && (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
                          <i className="fa-solid fa-file-circle-question text-xl"></i>
                        </div>
                        <p className="text-sm font-black text-brand-dark">لا توجد وثائق مطابقة</p>
                        <p className="mt-1 text-xs font-bold leading-6 text-slate-400">
                          {isReadOnlyView ? 'غيّر البحث أو الفلتر لعرض الوثائق المتاحة.' : 'غيّر البحث أو الفلتر، أو ارفع وثيقة جديدة لهذا الملف.'}
                        </p>
                        {(docSearchQuery || docFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => { setDocSearchQuery(''); setDocFilter('all'); }}
                            className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-brand-navy shadow-sm transition hover:border-brand-navy"
                          >
                            مسح الفلاتر
                          </button>
                        )}
                      </div>
                    )}
                    {filteredDocuments.map((doc) => (
                      <motion.div
                        layout
                        key={doc.id}
                        onClick={(e) => {
                          if (!(e.target as HTMLElement).closest('input[type="checkbox"], button')) {
                            !doc.isUploading && setActivePreviewDoc(doc);
                          }
                        }}
                        whileHover={{ y: -1 }}
                        className={`border p-4 rounded-2xl hover:border-brand-navy cursor-pointer transition group flex flex-col gap-2 relative bg-white shadow-sm hover:shadow-md ${doc.actionRequired || doc.expiresAt ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100'}`}
                      >
                        {!isReadOnlyView && (
                          <input
                            type="checkbox"
                            checked={selectedDocs.has(doc.id)}
                            onChange={() => toggleDocSelection(doc.id)}
                            onClick={(e) => e.stopPropagation()} // Prevent opening preview when clicking checkbox
                            className="absolute top-4 right-4 h-4 w-4 rounded accent-brand-navy z-10"
                          />
                        )}

                        {/* Hover Preview Tooltip */}
                        {doc.previewUrl && (
                          <div className="absolute top-1/2 right-full mr-4 -translate-y-1/2 w-52 bg-white border border-slate-200 shadow-2xl rounded-3xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible z-[60] transition-all duration-300">
                            <div className="w-full h-40 bg-gray-50 rounded-lg overflow-hidden border border-gray-100 mb-2 relative">
                              <img src={doc.previewUrl} alt={doc.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                              <span className="absolute bottom-2 left-2 text-white font-mono text-[9px] bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                {doc.type.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[11px] font-black text-center text-brand-dark truncate px-1">{doc.name}</p>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <div className={`text-2xl mt-1 ${doc.type === 'pdf' ? 'text-red-500' : 'text-blue-500'}`}>
                            <i className={`fa-solid ${doc.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}`}></i>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[13px] font-black text-brand-dark truncate">{doc.name}</p>
                            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase">
                              {doc.isUploading ? `جارٍ رفع الوثيقة... ${doc.progress || 0}%` : `${doc.size} • ${doc.date}`}
                            </p>

                            {/* Status Badges on Document */}
                            {!doc.isUploading && (doc.actionRequired || doc.expiresAt || doc.isSigned) && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {doc.isSigned && (
                                  <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg border border-emerald-100 shadow-sm">
                                    <i className="fa-solid fa-check-circle ml-1"></i>
                                    موقع
                                  </span>
                                )}
                                {doc.actionRequired && (
                                  <span className="text-[9px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded-lg border border-amber-100 shadow-sm">
                                    <i className="fa-solid fa-signature ml-1"></i>
                                    {doc.actionRequired}
                                  </span>
                                )}
                                {!isReadOnlyView && doc.actionRequired === 'بانتظار توقيعك' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDocToSign(doc.id); }}
                                    className="text-[9px] font-black bg-brand-navy text-white hover:bg-brand-dark px-3 py-1 rounded-lg transition shadow-md"
                                  >
                                    توقيع
                                  </button>
                                )}
                                {!isReadOnlyView && doc.actionRequired && doc.actionRequired !== 'بانتظار توقيعك' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDocReply(doc); }}
                                    className="text-[9px] font-black bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1 rounded-lg transition shadow-sm"
                                  >
                                    <i className="fa-solid fa-reply ml-1"></i>
                                    رد
                                  </button>
                                )}
                                {doc.expiresAt && (
                                  <span className="text-[9px] font-black bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-100 shadow-sm">
                                    <i className="fa-solid fa-clock ml-1"></i>
                                    {doc.expiresText}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {!doc.isUploading && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              {!isReadOnlyView && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMovingDocId(doc.id); }}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-brand-navy hover:bg-slate-100 transition shadow-sm"
                                  title="نقل الملف"
                                >
                                  <i className="fa-solid fa-folder-open"></i>
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); downloadDocument(doc); }}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-brand-navy hover:bg-slate-100 transition shadow-sm"
                                title="تحميل الوثيقة"
                              >
                                <i className="fa-solid fa-download"></i>
                              </button>
                            </div>
                          )}
                        </div>
                        {doc.isUploading && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-brand-navy h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${doc.progress || 0}%` }}
                            ></div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {!isReadOnlyView && activeCase.status !== 'closed' && (
                    <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                      <motion.div
                        animate={{ borderColor: isDragActive ? '#1B365D' : '#e2e8f0', scale: isDragActive ? 1.02 : 1 }}
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={(e) => { handleDrag(e); handleFileUpload(e as any); }}
                        className={`border-2 border-dashed rounded-3xl p-5 text-center cursor-pointer transition-all shadow-inner group ${isDragActive ? 'bg-brand-navy/5 border-brand-navy' : 'border-slate-200 hover:border-brand-navy hover:bg-white'}`}
                      >
                        <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-300 group-hover:text-brand-navy mb-3 transition-colors"></i>
                        <p className="text-sm font-black text-brand-dark group-hover:text-brand-navy transition-colors">رفع وثائق جديدة</p>
                        <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">تحديد ملفات متعددة</p>
                      </motion.div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Instant Document Previewer (Lightbox) */}
      {typeof document !== 'undefined' && createPortal((
      <AnimatePresence>
        {activePreviewDoc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setActivePreviewDoc(null)}
            className="fixed inset-0 z-[9998] flex h-dvh w-dvw items-center justify-center overflow-y-auto bg-brand-dark/90 p-3 backdrop-blur-md sm:p-5 md:p-8"
          >
            <button
              onClick={() => setActivePreviewDoc(null)}
              className="absolute left-4 top-4 z-[210] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:left-6 md:top-6 md:h-12 md:w-12"
            >
              <i className="fa-solid fa-times text-xl"></i>
            </button>

            <div className="absolute right-5 top-5 hidden max-w-md text-right md:block">
              <h3 className="truncate text-base font-black text-white lg:text-lg">{activePreviewDoc.name}</h3>
              <p className="text-white/50 text-xs font-bold uppercase mt-1">{activePreviewDoc.size} • {activePreviewDoc.date}</p>
            </div>

            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="relative mx-auto my-auto flex h-[min(82dvh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl md:rounded-[2rem]"
            >
              <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-5">
                {activePreviewDoc.type === 'image' ? (
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-white">
                    <img
                      src={activePreviewDoc.previewUrl || 'https://via.placeholder.com/800'}
                      className="max-h-full max-w-full object-contain"
                      alt=""
                    />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl bg-white text-center text-slate-400">
                    <i className="fa-solid fa-file-pdf text-6xl md:text-7xl"></i>
                    <p className="text-sm font-black">معاينة ملفات PDF قيد التطوير</p>
                    <button
                      type="button"
                      onClick={() => downloadDocument(activePreviewDoc)}
                      className="rounded-xl bg-brand-navy px-5 py-3 text-xs font-bold text-white"
                    >
                      تحميل لقراءته محلياً
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-right md:hidden">
                  <p className="truncate text-sm font-black text-brand-dark">{activePreviewDoc.name}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{activePreviewDoc.size} • {activePreviewDoc.date}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => downloadDocument(activePreviewDoc)}
                    className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-brand-navy transition hover:bg-slate-200"
                  >
                    تحميل النسخة الأصلية
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDocReply(activePreviewDoc);
                      setActivePreviewDoc(null);
                    }}
                    hidden={isReadOnlyView}
                    className="rounded-xl bg-brand-navy px-4 py-3 text-xs font-black text-white shadow-lg shadow-brand-navy/20 transition"
                  >
                    إرسال للمحامي
                  </button>
                </div>
                <div className="hidden text-right sm:block">
                  <span className="text-[10px] font-black bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full uppercase">وثيقة معتمدة</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      ), document.body)}

      {/* Read-only QR Modal */}
      {typeof document !== 'undefined' && createPortal((
      <AnimatePresence>
        {isQrModalOpen && activeCase && readOnlyLinks && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsQrModalOpen(false)}
            className="fixed inset-0 z-[9999] flex h-dvh w-dvw items-center justify-center overflow-y-auto bg-brand-dark/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 18 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="relative mx-auto my-auto w-full max-w-2xl rounded-[2rem] bg-white p-6 text-right shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-red-50 hover:text-red-500"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">QR قراءة فقط</p>
                  <h3 className="mt-1 text-xl font-black text-brand-dark">مشاركة الملخص والمستندات مع المحامي</h3>
                  <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                    هذه الروابط تفتح ملف {activeCase.title} بوضع قراءة فقط، مناسبة للمراجعة السريعة بدون تعديل أو توقيع.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  { label: 'ملخص القضية', icon: 'fa-rectangle-list', url: readOnlyLinks.summary },
                  { label: 'المستندات', icon: 'fa-folder-open', url: readOnlyLinks.documents },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-navy shadow-sm">
                        <i className={`fa-solid ${item.icon}`}></i>
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-black text-brand-dark">{item.label}</p>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">قراءة فقط</p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-center rounded-2xl bg-white p-3 shadow-inner">
                      <img
                        src={buildQrImageUrl(item.url)}
                        alt={`QR ${item.label}`}
                        className="h-40 w-40"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <input
                      readOnly
                      value={item.url}
                      onFocus={(event) => event.currentTarget.select()}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[10px] font-bold text-slate-500 outline-none focus:border-brand-navy"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                      className="mt-3 w-full rounded-xl bg-brand-navy px-4 py-3 text-xs font-black text-white transition hover:bg-brand-dark"
                    >
                      فتح الرابط
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      ), document.body)}

      {/* Delete Confirmation Modal */}
      {
        !isReadOnlyView && caseToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-right fade-in">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
              </div>
              <h3 className="text-xl font-bold text-brand-dark mb-2 text-center">حذف الملف</h3>
              <p className="text-gray-500 mb-8 text-center text-sm">
                هل أنت متأكد من رغبتك في حذف هذا الملف بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع الوثائق والمحادثات المرتبطة به.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCaseToDelete(null)}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-md shadow-red-500/20"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* New Folder Modal */}
      {
        !isReadOnlyView && isNewFolderModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-right fade-in">
              <h3 className="text-lg font-bold text-brand-dark mb-4">مجلد جديد</h3>
              <input
                type="text"
                placeholder="اسم المجلد..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 mb-6 text-sm focus:outline-none focus:border-brand-gold text-right"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={createFolder}
                  className="flex-1 py-2 bg-brand-navy text-white rounded-xl font-bold hover:bg-[#0f1754] transition shadow-md"
                >
                  إنشاء
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Move Document Modal */}
      {
        !isReadOnlyView && movingDocId && activeCase && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-right fade-in">
              {docMoveConfirmTo !== undefined ? (
                <div className="text-center p-2">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    <i className="fa-solid fa-folder-tree"></i>
                  </div>
                  <h3 className="text-xl font-bold text-brand-dark mb-2">تأكيد نقل الوثيقة</h3>
                  <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                    هل أنت متأكد من رغبتك في نقل {movingDocId === 'batch' ? `${selectedDocs.size} ملفات` : 'الوثيقة'} إلى المجلد <br />
                    <span className="font-bold text-brand-navy p-1 bg-gray-50 rounded mt-2 inline-block">
                      "{docMoveConfirmTo === null ? 'الرئيسية (بدون مجلد)' : activeCase.folders.find((f: any) => f.id === docMoveConfirmTo)?.name}"
                    </span>؟
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDocMoveConfirmTo(undefined)}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition"
                    >
                      رجوع
                    </button>
                    <button
                      onClick={() => moveDocuments(docMoveConfirmTo, movingDocId === 'batch' ? Array.from(selectedDocs) : [movingDocId!])}
                      className="flex-[1.5] py-3 bg-brand-navy text-white rounded-xl font-bold hover:bg-[#0f1754] transition shadow-md"
                    >
                      نعم، نقل {movingDocId === 'batch' ? 'الملفات' : 'الوثيقة'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-brand-dark mb-4">نقل الوثيقة إلى...</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
                    <div
                      onClick={() => setDocMoveConfirmTo(null)}
                      className="p-3 border border-gray-200 rounded-xl hover:border-brand-gold hover:bg-yellow-50/30 cursor-pointer transition flex items-center gap-3"
                    >
                      <i className="fa-solid fa-home text-brand-navy"></i>
                      <span className="text-sm font-bold">الرئيسية (بدون مجلد)</span>
                    </div>
                    {activeCase.folders.map((folder: any) => (
                      <div
                        key={folder.id}
                        onClick={() => setDocMoveConfirmTo(folder.id)}
                        className="p-3 border border-gray-200 rounded-xl hover:border-brand-gold hover:bg-yellow-50/30 cursor-pointer transition flex items-center gap-3"
                      >
                        <i className="fa-solid fa-folder text-brand-gold"></i>
                        <span className="text-sm font-bold text-brand-dark">{folder.name}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => { setMovingDocId(null); setDocMoveConfirmTo(undefined); }}
                    className="w-full py-2 border border-brand-navy text-brand-navy rounded-xl font-bold hover:bg-brand-navy hover:text-white transition"
                  >
                    إلغاء النافذة
                  </button>
                </>
              )}
            </div>
          </div>
        )
      }

      {/* New Custom Field Modal */}
      {
        !isReadOnlyView && isNewFieldModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-right fade-in">
              <h3 className="text-lg font-bold text-brand-dark mb-4">إضافة حقل بيانات جديد</h3>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم الحقل (مثال:- عنوان العقار، رقم القضية)</label>
                <input
                  type="text"
                  placeholder="أدخل اسم الحقل..."
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-gold text-right"
                  autoFocus
                />
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 mb-1">القيمة (مثال:- شارع التحلية، 847291)</label>
                <input
                  type="text"
                  placeholder="أدخل القيمة..."
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-gold text-right"
                  onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsNewFieldModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={addCustomField}
                  disabled={!newFieldLabel.trim() || !newFieldValue.trim()}
                  className="flex-1 py-2 bg-brand-navy text-white rounded-xl font-bold hover:bg-[#0f1754] transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Signature Modal */}
      {
        !isReadOnlyView && docToSign && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-right fade-in relative">
              <h3 className="text-xl font-bold text-brand-dark mb-2">التوقيع الإلكتروني</h3>
              <p className="text-sm text-gray-500 mb-6">يرجى توقيع الوثيقة المحددة أدناه للموافقة على الإجراء القانوني واعتماده. هذا التوقيع سيحفظ بسجل التغييرات رقمياً.</p>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="font-bold text-brand-dark text-sm mb-1">{activeCase?.documents.find(d => d.id === docToSign)?.name}</p>
                  <p className="text-xs text-orange-700">تنبيه: يجب التوقيع قبل {activeCase?.documents.find(d => d.id === docToSign)?.expiresAt || 'انتهاء الصلاحية'}</p>
                </div>
                <i className="fa-solid fa-file-contract text-3xl text-orange-400"></i>
              </div>

              <div className="border border-gray-200 bg-gray-50 rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition mb-6">
                <i className="fa-solid fa-signature text-4xl text-brand-navy mb-2 opacity-50"></i>
                <span className="text-sm font-bold text-brand-navy">أنقر هنا للتوقيع (محاكاة)</span>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDocToSign(null)}
                  disabled={isRequestingSignature}
                  className="flex-[0.5] py-3 px-4 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition min-w-[100px]"
                >
                  إلغاء التوقيع
                </button>
                <button
                  onClick={executeSignDocument}
                  disabled={isRequestingSignature}
                  className="flex-1 py-3 px-4 bg-brand-navy text-white rounded-xl font-bold hover:bg-brand-dark transition shadow-md flex items-center justify-center gap-2"
                >
                  {isRequestingSignature ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> جاري التوقيع والتشفير...</>
                  ) : (
                    <><i className="fa-solid fa-check-double"></i> اعتماد وتوقيع الوثيقة</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* New Case Modal */}
      <AnimatePresence>
        {!isReadOnlyView && isNewCaseModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl text-right"
            >
              <h3 className="text-2xl font-black text-brand-dark mb-2">فتح ملف قضية جديد</h3>
              <p className="text-sm font-bold text-slate-500 mb-6">أدخل عنواناً واضحاً للقضية لبدء العمل مع المحامي المتخصص.</p>

              <div className="mb-6 grid grid-cols-3 gap-2">
                {[
                  { label: 'بيانات', icon: 'fa-pen-to-square' },
                  { label: 'محامٍ', icon: 'fa-user-tie' },
                  { label: 'متابعة', icon: 'fa-comments' },
                ].map((step, index) => (
                  <div key={step.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-navy shadow-sm">
                      <i className={`fa-solid ${step.icon} text-xs`}></i>
                    </div>
                    <p className="mt-2 text-[10px] font-black text-brand-dark">{index + 1}. {step.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4 mb-8">
                {createCaseError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {createCaseError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">عنوان القضية</label>
                  <input
                    type="text"
                    placeholder="مثال: مراجعة عقد استثمار"
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-right outline-none focus:border-brand-navy"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">نوع القضية</label>
                    <select
                      value={newCaseType}
                      onChange={(e) => setNewCaseType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-right outline-none focus:border-brand-navy"
                    >
                      {CASE_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">المحامي المسؤول</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (availableLawyers.length === 0) return;
                        setIsLawyerDropdownOpen(!isLawyerDropdownOpen);
                        if (!isLawyerDropdownOpen) setLawyerSearchQuery('');
                      }}
                      disabled={availableLawyers.length === 0}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-4 pl-3 flex items-center justify-between text-sm font-bold text-right outline-none focus:border-brand-navy transition-all disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${isLawyerDropdownOpen ? 'rotate-180' : ''}`}></i>
                      <div className="flex items-center gap-3">
                        <span className="text-brand-dark">{currentModalLawyer?.name || 'لا يوجد محامون متاحون حالياً'}</span>
                        {currentModalLawyer ? (
                          <img src={currentModalLawyer.img} className="w-8 h-8 rounded-full border border-white shadow-sm" alt="" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-300">
                            <i className="fa-solid fa-user-slash text-xs"></i>
                          </div>
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isLawyerDropdownOpen && availableLawyers.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-[170] top-full mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
                        >
                          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="ابحث عن محامي..."
                                value={lawyerSearchQuery}
                                onChange={(e) => setLawyerSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs font-bold outline-none focus:border-brand-navy"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <i className="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            {filteredLawyersInModal.length > 0 ? (
                              filteredLawyersInModal.map(lawyer => (
                                <div
                                  key={lawyer.id}
                                  onClick={() => {
                                    setNewCaseLawyerId(lawyer.id);
                                    setIsLawyerDropdownOpen(false);
                                  }}
                                  className={`p-3 flex items-center justify-end gap-3 cursor-pointer transition-colors ${newCaseLawyerId === lawyer.id ? 'bg-brand-navy/5' : 'hover:bg-slate-50'}`}
                                >
                                  <div className="text-right">
                                    <p className="text-sm font-black text-brand-dark">{lawyer.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{lawyer.role}</p>
                                  </div>
                                  <img src={lawyer.img} className="w-10 h-10 rounded-xl border border-slate-100 shadow-sm" alt="" />
                                </div>
                              ))
                            ) : (
                              <div className="p-5 text-center text-xs text-slate-400 font-bold italic">لا توجد نتائج تطابق بحثك...</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">مبلغ الدعوة (دينار عراقي)</label>
                  <input
                    type="number"
                    placeholder="مثال: 500000"
                    value={newCaseAmount}
                    onChange={(e) => setNewCaseAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-right outline-none focus:border-brand-navy"
                  />
                </div>

                {availableLawyers.length === 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    لا يمكن فتح ملف جديد الآن لأنه لا يوجد محامون مسجلون في النظام حالياً.
                  </div>
                )}

                <div className="rounded-2xl border border-brand-navy/10 bg-brand-navy/5 px-4 py-4">
                  <p className="text-xs font-black text-brand-navy">بعد فتح الملف</p>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600">
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span>المحامي يستلم الملف ويحدد أول خطوة</span>
                      <i className="fa-solid fa-check text-emerald-500"></i>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span>تظهر الوثائق والرسائل داخل مساحة واحدة</span>
                      <i className="fa-solid fa-check text-emerald-500"></i>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span>يمكنك طلب الإغلاق عند اكتمال المتطلبات</span>
                      <i className="fa-solid fa-check text-emerald-500"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsNewCaseModalOpen(false);
                    setNewCaseTitle('');
                    setCreateCaseError('');
                  }}
                  className="flex-1 py-3 font-black text-slate-400 hover:text-slate-600 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCreateCase}
                  disabled={!newCaseTitle.trim() || !newCaseLawyerId || isCreatingCase}
                  className="flex-[2] rounded-2xl bg-brand-navy text-white py-3 px-6 font-black shadow-lg shadow-brand-navy/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingCase ? 'جاري الإنشاء...' : 'فتح الملف'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Reply Modal */}
      <AnimatePresence>
        {!isReadOnlyView && replyModalDoc && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 text-right"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-brand-dark">
                  {replyModalDoc.actionRequired && replyModalDoc.actionRequired !== 'بانتظار توقيعك' ? 'الرد على ملاحظة المحامي' : 'استفسار عن وثيقة'}
                </h3>
                <button onClick={() => setReplyModalDoc(null)} className="text-slate-400 hover:text-red-500 transition">
                  <i className="fa-solid fa-times text-xl"></i>
                </button>
              </div>

              <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">الوثيقة: {replyModalDoc.name}</p>
                {replyModalDoc.actionRequired && replyModalDoc.actionRequired !== 'بانتظار توقيعك' && (
                  <p className="text-sm font-bold text-brand-navy italic">"{replyModalDoc.actionRequired}"</p>
                )}
              </div>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="اكتب ردك هنا..."
                className="w-full h-32 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy focus:bg-white resize-none mb-6"
                autoFocus
              />

              <div className="flex gap-3">
                <button onClick={() => setReplyModalDoc(null)} className="flex-1 py-3 px-4 border border-slate-200 text-slate-500 rounded-xl font-black text-xs hover:bg-slate-50 transition">إلغاء</button>
                <button onClick={handleSendDocReply} disabled={!replyText.trim()} className="flex-[2] py-3 px-4 bg-brand-navy text-white rounded-xl font-black text-xs shadow-lg shadow-brand-navy/20 hover:bg-brand-dark transition disabled:opacity-50">إرسال الرد</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
