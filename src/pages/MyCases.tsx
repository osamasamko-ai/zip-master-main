import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import NoticePanel from '../components/ui/NoticePanel';
import apiClient from '../api/client';

type DocumentType = 'pdf' | 'image' | 'other';
type CaseStatus = 'pending' | 'review' | 'active' | 'closed';

type WorkspaceTab = 'summary' | 'chat' | 'docs' | 'ai' | 'financials';
type DocFilter = 'all' | 'pending' | 'expired' | 'signed' | 'uploaded';
type SidebarFilter = 'all' | 'needs_action' | 'in_progress' | 'waiting' | 'completed';

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
  time: string;
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

// --- Sub-Components ---

const CaseSidebar = ({
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
  const filtered = cases.filter((c) => {
    const matchesArchive = showArchived ? c.isArchived : !c.isArchived;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.lawyer.name.toLowerCase().includes(searchQuery.toLowerCase());
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
      (statusFilter === 'completed' && c.status === 'closed');
    return matchesArchive && matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
      {filtered.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title="لا توجد قضايا مطابقة"
          description="جرّب تغيير البحث أو حالة الفلترة، أو بدّل بين القضايا النشطة والأرشيف."
        />
      ) : filtered.map((c) => (
        <div
          key={c.id}
          onClick={() => setActiveCaseId(c.id)}
          className={`p-4 rounded-2xl cursor-pointer transition-all border-2 relative group ${activeCaseId === c.id
            ? 'border-brand-navy bg-brand-navy/5 shadow-lg' // More prominent active state
            : 'border-transparent hover:border-slate-200 hover:bg-slate-50 hover:shadow-md' // Subtle hover shadow
            }`}
        >
          {c.unreadCount ? (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white border-2 border-white shadow-sm animate-bounce">
              {c.unreadCount}
            </span>
          ) : null}
          <div className="flex justify-between items-start mb-2">
            <h4 className={`font-black text-sm transition-colors ${activeCaseId === c.id ? 'text-brand-navy' : 'text-brand-dark group-hover:text-brand-navy'}`}>
              {c.title}
            </h4>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className={`px-2 py-1 rounded-lg text-[9px] font-black shrink-0 uppercase tracking-widest ${c.status === 'closed' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-navy/10 text-brand-navy'
                  }`}
              >
                {c.statusText}
              </span>
              {c.isArchived && (
                <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded italic flex items-center gap-1">
                  <i className="fa-solid fa-box-archive"></i> مؤرشف
                </span>
              )}
              {c.documents.some(d => d.actionRequired) && (
                <span className="flex h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/20 animate-pulse" title="إجراء مطلوب"></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <img src={c.lawyer.img} className="w-5 h-5 rounded-full border border-slate-200" alt={c.lawyer.name} />
            <span className="text-[11px] font-bold text-slate-400">{c.lawyer.name}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${c.status === 'closed' ? 'bg-emerald-500' : 'bg-brand-gold'}`}
              style={{ width: `${c.progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-3">
            <p className="text-[10px] font-black text-slate-300 uppercase">{c.date}</p>
            <p className="text-[10px] font-black text-slate-400">{c.progress}%</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const SummaryTab = ({
  activeCase,
  setIsNewFieldModalOpen,
  setActiveTab
}: {
  activeCase: LegalCase,
  setIsNewFieldModalOpen: (open: boolean) => void,
  setActiveTab: (tab: WorkspaceTab) => void
}) => (
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
          <button onClick={() => setIsNewFieldModalOpen(true)} className="text-[10px] font-black text-brand-navy hover:underline">تعديل البيانات</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {activeCase.customFields.map((f) => (
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

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
        <h4 className="text-lg font-black text-brand-dark mb-6 flex items-center gap-2">
          <i className="fa-solid fa-map-location-dot text-brand-gold"></i> خريطة الطريق
        </h4>
        <div className="relative space-y-8 before:absolute before:right-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
          <div className="relative pr-14">
            <div className="absolute right-4 top-1 h-5 w-5 rounded-full border-4 border-white bg-emerald-500 shadow-sm"></div>
            <p className="text-sm font-black text-brand-dark">فتح الملف ورفع المسودة</p>
            <p className="text-xs font-bold text-slate-400 mt-1">تمت المعالجة في {activeCase.date}</p>
          </div>
          <div className="relative pr-14">
            <div className="absolute right-4 top-1 h-5 w-5 rounded-full border-4 border-white bg-brand-gold animate-pulse shadow-sm"></div>
            <p className="text-sm font-black text-brand-navy">{activeCase.statusText}</p>
            <p className="text-xs font-bold text-slate-500 mt-1">بانتظار مراجعة المحامي للتعديلات المرفوعة.</p>
          </div>
          <div className="relative pr-14 opacity-40">
            <div className="absolute right-4 top-1 h-5 w-5 rounded-full border-4 border-white bg-slate-200"></div>
            <p className="text-sm font-black text-slate-500">التوقيع النهائي</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
        <h4 className="text-lg font-black text-brand-dark mb-6 flex items-center gap-2">
          <i className="fa-solid fa-clock-rotate-left text-brand-navy"></i> سجل الأحداث التفصيلي
        </h4>
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {activeCase.timeline.map((event) => (
            <div key={event.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 relative group">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-black text-brand-navy uppercase tracking-widest">{event.date}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${event.type === 'hearing' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{event.type === 'hearing' ? 'جلسة' : event.type === 'filing' ? 'إيداع' : 'حدث'}</span>
              </div>
              <p className="text-sm font-black text-brand-dark">{event.title}</p>
              <p className="text-xs font-bold text-slate-500 mt-1">{event.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="flex flex-col gap-4 sm:flex-row">
      <ActionButton onClick={() => setActiveTab('chat')} variant="primary" className="flex-1">تواصل مع المحامي</ActionButton>
      <ActionButton onClick={() => window.print()} variant="secondary" className="flex-1">طباعة التقرير الحالي</ActionButton>
    </div>
  </div>
);

const ChatTab = ({
  activeCase,
  newMessage,
  setNewMessage,
  sendMessage,
  isLawyerTyping,
  isRecording,
  setIsRecording
}: {
  activeCase: LegalCase,
  newMessage: string,
  setNewMessage: (msg: string) => void,
  sendMessage: (text?: string, optimisticId?: string) => void,
  isLawyerTyping: boolean,
  isRecording: boolean,
  setIsRecording: (r: boolean) => void
}) => (
  <>
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 custom-scrollbar">
      <div className="text-center w-full my-4">
        <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase">اليوم</span>
      </div>
      {activeCase.messages.map((msg) => (
        <div key={msg.id} className={`flex gap-3 max-w-[95%] group ${msg.sender === 'user' ? 'mr-auto flex-row-reverse' : ''}`}>
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
              <span className="uppercase">{msg.time}</span>
              {msg.sender === 'user' && <i className={`fa-solid fa-check-double ${msg.time === 'الآن' ? 'opacity-50' : 'text-blue-300'}`}></i>}
            </div>
          </div>
        </div>
      ))}
      {isLawyerTyping && (
        <div className="flex gap-3 max-w-[94%] fade-in">
          <div className="w-9 h-9 shrink-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm mt-1"><img src={activeCase.lawyer.img} className="w-full h-full object-cover" alt="avatar" /></div>
          <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-tr-md shadow-sm flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full typing-dot"></div>
            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full typing-dot"></div>
            <div className="w-1.5 h-1.5 bg-brand-gold rounded-full typing-dot"></div>
          </div>
        </div>
      )}
    </div>
    <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full px-1">
        {QUICK_REPLIES.map((reply, idx) => (
          <button key={idx} onClick={() => sendMessage(reply)} className="shrink-0 bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-2xl text-[11px] font-black hover:bg-brand-navy hover:text-white transition-all shadow-sm">{reply}</button>
        ))}
      </div>
      <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-3xl p-2 focus-within:bg-white focus-within:border-brand-navy transition-all relative">
        {!isRecording ? (
          <>
            <button className="p-3.5 text-slate-400 hover:text-brand-navy transition-colors rounded-2xl shrink-0"><i className="fa-solid fa-paperclip text-lg"></i></button>
            <textarea placeholder="اكتب رسالتك للمحامي..." className="w-full bg-transparent border-none focus:outline-none resize-none py-3.5 text-[15px] font-medium text-slate-700 max-h-32 min-h-[52px]" rows={1} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}></textarea>
            {!newMessage.trim() ? (
              <button onClick={() => setIsRecording(true)} className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl hover:bg-brand-navy/10 hover:text-brand-navy transition shrink-0 flex items-center justify-center shadow-sm"><i className="fa-solid fa-microphone"></i></button>
            ) : (
              <button onClick={() => sendMessage()} className="w-12 h-12 bg-brand-navy text-white rounded-2xl hover:bg-brand-dark transition-all shrink-0 flex items-center justify-center shadow-lg shadow-brand-navy/30"><i className="fa-solid fa-paper-plane"></i></button>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-between px-4 py-2 bg-red-50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-black text-red-600 font-mono">00:12</span>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsRecording(false)} className="text-slate-400 font-black text-xs">إلغاء</button>
              <button onClick={() => setIsRecording(false)} className="w-10 h-10 bg-red-500 text-white rounded-xl shadow-lg flex items-center justify-center"><i className="fa-solid fa-stop"></i></button>
            </div>
          </div>
        )}
      </div>
    </div>
  </>
);

const DocumentsTab = ({
  activeCase,
  docFilter,
  setDocFilter,
  filteredDocuments,
  fileInputRef,
  handleFileUpload,
  setIsNewFolderModalOpen,
  docSearchQuery,
  setDocSearchQuery
}: {
  activeCase: LegalCase,
  docFilter: DocFilter,
  setDocFilter: (f: DocFilter) => void,
  filteredDocuments: LegalDocument[],
  fileInputRef: React.RefObject<HTMLInputElement>,
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
  setIsNewFolderModalOpen: (open: boolean) => void,
  docSearchQuery: string,
  setDocSearchQuery: (q: string) => void
}) => (
  <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden">
    <div className="p-5 border-b border-slate-100 font-black text-sm text-brand-dark flex justify-between items-center bg-white">
      <span className="flex items-center gap-2"><i className="fa-solid fa-folder-tree text-brand-navy"></i> وثائق الملف</span>
      <button onClick={() => setIsNewFolderModalOpen(true)} className="text-slate-400 hover:text-brand-navy transition w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50"><i className="fa-solid fa-folder-plus"></i></button>
    </div>
    <div className="px-5 py-3 border-b border-slate-100 bg-white">
      <div className="relative">
        <input
          type="text"
          value={docSearchQuery}
          onChange={(e) => setDocSearchQuery(e.target.value)}
          placeholder="ابحث عن وثيقة بالاسم..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-10 pl-4 text-xs focus:outline-none focus:border-brand-navy transition text-right"
        />
        <i className="fa-solid fa-search absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
      </div>
    </div>
    <div className="px-5 py-4 border-b border-slate-100 bg-white flex gap-2 overflow-x-auto no-scrollbar">
      {['all', 'pending', 'signed', 'expired'].map((f) => (
        <button key={f} onClick={() => setDocFilter(f as DocFilter)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${docFilter === f ? 'bg-brand-navy text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-white'}`}>{f === 'all' ? 'الكل' : f === 'pending' ? 'للتوقيع' : f === 'signed' ? 'موقعة' : 'منتهية'}</button>
      ))}
    </div>
    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 custom-scrollbar">
      {filteredDocuments.map((doc) => (
        <div key={doc.id} className="border p-5 rounded-[1.75rem] hover:border-brand-navy transition-all bg-white shadow-sm hover:shadow-md relative group">
          <div className="flex items-start gap-4">
            <div className={`text-3xl ${doc.type === 'pdf' ? 'text-red-500' : 'text-blue-500'}`}><i className={`fa-solid ${doc.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}`}></i></div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black text-brand-dark truncate">{doc.name}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{doc.size} • {doc.date}</p>
              {doc.isSigned && <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-black border border-emerald-100"><i className="fa-solid fa-check-circle ml-1"></i>موقع</span>}
              <div className="flex flex-wrap gap-1 mt-2">
                {doc.tags?.map(tag => (
                  <span key={tag} className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button className="h-8 w-8 rounded-lg bg-slate-50 text-slate-400 hover:text-brand-navy shadow-sm"><i className="fa-solid fa-download text-xs"></i></button>
          </div>
        </div>
      ))}
    </div>
    <div className="p-6 border-t border-slate-100 bg-white">
      <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 rounded-[2rem] p-6 text-center hover:border-brand-navy hover:bg-slate-50 transition-all group">
        <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-300 group-hover:text-brand-navy mb-2"></i>
        <p className="text-sm font-black text-brand-dark">رفع وثائق جديدة</p>
      </button>
    </div>
  </div>
);

const AiTab = ({ activeCase }: { activeCase: LegalCase }) => (
  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col custom-scrollbar">
    {activeCase.aiConsultations && activeCase.aiConsultations.length > 0 ? (
      <div className="space-y-5">
        {activeCase.aiConsultations.map((ai) => (
          <div key={ai.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:border-brand-gold cursor-pointer transition-all group hover:shadow-md">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <h4 className="font-bold text-brand-dark text-sm">{ai.title}</h4>
              </div>
              <span className="text-[10px] text-gray-400">{ai.date}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2 line-clamp-2 pr-10">{ai.excerpt}</p>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 my-8">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-4 border border-slate-100 shadow-sm"><i className="fa-solid fa-robot text-3xl text-gray-300"></i></div>
        <h3 className="text-lg font-black text-brand-dark mb-1">لا توجد استشارات مربوطة</h3>
      </div>
    )}
  </div>
);

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

export default function MyCases() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('summary');
  const [newMessage, setNewMessage] = useState<string>('');
  const [isLawyerTyping, setIsLawyerTyping] = useState<boolean>(false);

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
    refreshCases(state?.activeCaseId);
  }, [location.state, refreshCases]);

  useEffect(() => {
    const refresh = () => {
      refreshCases(activeCaseId || undefined);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }, 5000);

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
  const [isSplitView, setIsSplitView] = useState(false);
  const [splitWidth, setSplitWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [activePreviewDoc, setActivePreviewDoc] = useState<LegalDocument | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [showArchived, setShowArchived] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<SidebarFilter>('needs_action');
  const [isRecording, setIsRecording] = useState(false);
  const [isCaseSwitcherOpen, setIsCaseSwitcherOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'lawyer'>('user');
  const [invitePermissions, setInvitePermissions] = useState<'view' | 'edit'>('view');
  const [isShareAccessModalOpen, setIsShareAccessModalOpen] = useState(false);
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
      setActiveTab('docs');
    }
    if (state.focusArea === 'messages') {
      setActiveTab('chat');
    }
    if (state.openNewCase) {
      setIsNewCaseModalOpen(true);
    }

    window.history.replaceState({}, document.title);
  }, [location.state]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleInviteCollaborator = async () => {
    if (!inviteEmail.trim()) {
      alert('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!activeCase) return;

    try {
      const response = await apiClient.addCaseCollaborator(activeCaseId, {
        email: inviteEmail,
        role: inviteRole,
        permissions: invitePermissions,
      });
      if (response.data) {
        setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
        alert(`تم منح صلاحية الوصول لـ ${inviteEmail} كـ ${inviteRole === 'lawyer' ? 'محامي' : 'مستخدم'}`);
        setInviteEmail('');
        setInviteRole('user');
        setInvitePermissions('view');
        setIsShareAccessModalOpen(false);
      }
    } catch (error: any) {
      console.error('Failed to invite collaborator', error);
      alert(error.response?.data?.error || 'فشل إضافة المتعاون. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleRevokeAccess = async (collabId: string) => {
    if (!activeCase) return;
    try {
      const response = await apiClient.removeCaseCollaborator(activeCaseId, collabId);
      if (response.data) {
        setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
      }
    } catch (error: any) {
      console.error('Failed to revoke access', error);
      alert(error.response?.data?.error || 'فشل حذف صلاحية الوصول.');
    }
  };

  const handleCreateCase = async () => {
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

  const handleDownloadQr = async () => {
    if (!activeCase) return;
    // Requesting a 1000x1000 resolution for high-quality printing
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(`${window.location.origin}/cases/${activeCase.id}`)}`;

    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR-${activeCase.title.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('عذراً، فشل تحميل الرمز. يرجى المحاولة مرة أخرى.');
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    setSelectedDocs(new Set());
  }, [activeCaseId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePreviewDoc(null);
        setIsQrModalOpen(false);
        setIsSummaryModalOpen(false);
        setIsNewCaseModalOpen(false);
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
      // Real implementation would require: 
      // import JSZip from 'jszip';
      // import { saveAs } from 'file-saver';

      // Simulating the packaging process for UI feedback
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(`تم البدء في ضغط وتنزيل ${activeCase.documents.length} وثيقة للملف: ${activeCase.title}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('فشل تصدير الوثائق. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !splitContainerRef.current) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      if (newWidth > 300 && newWidth < 600) setSplitWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  const uploadTimersRef = useRef<number[]>([]);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);

  // Folder states
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [movingDocId, setMovingDocId] = useState<string | null>(null);
  const [docMoveConfirmTo, setDocMoveConfirmTo] = useState<string | null | undefined>(undefined);
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

  // Sharing states
  const [docToShare, setDocToShare] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState<string>('');
  const [sharePermission, setSharePermission] = useState<'view' | 'comment' | 'edit'>('view');
  const [shareLinkGenerated, setShareLinkGenerated] = useState<string | null>(null);

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
          expires: expiringDocs[0].expiresAt
        });

        // Auto dismiss after 10 seconds to not be intrusive
        const timer = setTimeout(() => {
          setNotification(null);
        }, 10000);
        return () => clearTimeout(timer);
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

  const toggleDocSelection = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveDocuments = async (folderId: string | null, ids: string[]) => {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
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
    if (e.type === "dragenter" || e.type === "dragover") setIsDragActive(true);
    else if (e.type === "dragleave") setIsDragActive(false);
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
    setReplyModalDoc(doc);
    setReplyText('');
  }, []);

  const handleSendDocReply = useCallback(async () => {
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
  }, [replyText, replyModalDoc, activeCase, replaceCaseInState, refreshCases]);

  const sendMessage = useCallback(async (text: string = newMessage, optimisticId?: string) => {
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
  }, [activeCase, appendOptimisticMessage, newMessage, refreshCases, replaceCaseInState, updateMessageDeliveryState]);

  return (
    <div className="app-view fade-in space-y-6">
      {/* Toast Notification for Reminders */}
      {notification && notification.show && (
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

      <NoticePanel
        title="الخطوة التالية"
        description={activeCase ? `راجع "${activeCase.title}" ثم انتقل إلى ${activeCase.documents.some((doc) => doc.actionRequired) ? 'المستندات' : activeCase.unreadCount ? 'المحادثة' : 'الملخص'} لإنهاء الإجراء التالي بسرعة.` : 'ابدأ بفتح ملف جديد أو بتعديل الفلاتر للوصول إلى القضية المطلوبة.'}
        action={
          <ActionButton variant="primary" size="sm" onClick={() => activeCase ? setActiveTab('summary') : setIsNewCaseModalOpen(true)}>
            {activeCase ? 'افتح الملخص' : 'فتح ملف جديد'}
          </ActionButton>
        }
      />

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="h-12 w-12 hidden lg:flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-brand-navy transition-all"
          >
            <i className={`fa-solid ${isSidebarCollapsed ? 'fa-indent' : 'fa-outdent'}`}></i>
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">لوحة متابعة القضايا</p>
            <div className="flex items-center justify-end gap-3 mt-1">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-100 shadow-sm">
                <i className="fa-solid fa-wallet text-brand-gold text-xs"></i>
                <span className="text-xs font-black text-brand-dark">{(user?.accountBalance ?? 0).toLocaleString('ar-IQ')} د.ع</span>
              </div>
            </div>
            <h2 className="text-3xl font-black text-brand-dark mt-1">إدارة قضاياك وملفاتك</h2>
          </div>
        </div>
        <div className="flex gap-3">
          <ActionButton onClick={() => setShowArchived(!showArchived)} variant={showArchived ? 'primary' : 'secondary'}>
            {showArchived ? 'عرض القضايا النشطة' : 'عرض الأرشيف'}
          </ActionButton>
          <ActionButton
            onClick={() => setIsNewCaseModalOpen(true)}
            variant="primary"
          >
            <i className="fa-solid fa-circle-plus"></i> فتح ملف جديد
          </ActionButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[900px]">
        {!isSidebarCollapsed && (
          <div className="lg:col-span-3 bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden text-right animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
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
              <div className="flex gap-1 mt-4 overflow-x-auto no-scrollbar pb-1">
                {(['needs_action', 'in_progress', 'waiting', 'completed', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSidebarStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black whitespace-nowrap transition-all ${sidebarStatusFilter === f ? 'bg-brand-navy text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                  >
                    {f === 'needs_action'
                      ? 'تحتاج إجراء'
                      : f === 'in_progress'
                        ? 'قيد التنفيذ'
                        : f === 'waiting'
                          ? 'بانتظار المحامي'
                          : f === 'completed'
                            ? 'مكتملة'
                            : 'الكل'}
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
          </div>
        )}

        {/* Case Detail Workspace */}
        <div className={`${isSidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-9'} bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden text-right`}>
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
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/30">
                <div>
                  <div className="flex items-center gap-3 mb-1 relative">
                    <div className="group relative">
                      <button
                        onClick={() => setIsCaseSwitcherOpen(!isCaseSwitcherOpen)}
                        className="flex items-center gap-2 text-2xl font-black text-brand-dark hover:text-brand-navy transition-colors group"
                      >
                        {activeCase.title}
                        <i className={`fa-solid fa-chevron-down text-xs text-slate-300 group-hover:text-brand-navy transition-transform ${isCaseSwitcherOpen ? 'rotate-180' : ''}`}></i>
                      </button>

                      <AnimatePresence>
                        {isCaseSwitcherOpen && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsCaseSwitcherOpen(false)}></div>
                            <motion.div
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-3xl shadow-2xl z-30 overflow-hidden"
                            >
                              <div className="p-3 border-b border-slate-50 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">تبديل القضية بسرعة</div>
                              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                {cases.filter(c => c.id !== activeCaseId).map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => { setActiveCaseId(c.id); setIsCaseSwitcherOpen(false); }}
                                    className="w-full p-4 text-right hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                                  >
                                    <p className="text-sm font-black text-brand-dark truncate">{c.title}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">{c.client} • {c.statusText}</p>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                    <button
                      onClick={() => setIsSummaryModalOpen(true)}
                      className="text-slate-400 hover:text-brand-navy transition w-9 h-9 flex items-center justify-center rounded-xl hover:bg-brand-navy/5"
                      title="ملخص الملف"
                    >
                      <i className="fa-solid fa-file-invoice"></i>
                    </button>
                    <button
                      onClick={() => setIsQrModalOpen(true)}
                      className="text-slate-400 hover:text-brand-navy transition w-9 h-9 flex items-center justify-center rounded-xl hover:bg-brand-navy/5"
                      title="رمز QR للوصول السريع"
                    >
                      <i className="fa-solid fa-qrcode"></i>
                    </button>
                    <button
                      onClick={async () => {
                        const response = await apiClient.toggleWorkspaceCaseArchive(activeCaseId);
                        setCases(prev => prev.map(c => c.id === activeCaseId ? response.data : c));
                      }}
                      className={`transition w-9 h-9 flex items-center justify-center rounded-xl ${activeCase.isArchived ? 'text-brand-navy bg-brand-navy/5' : 'text-slate-400 hover:text-brand-navy hover:bg-brand-navy/5'}`}
                      title={activeCase.isArchived ? "إعادة من الأرشيف" : "نقل للأرشيف"}
                    >
                      <i className={`fa-solid ${activeCase.isArchived ? 'fa-box-open' : 'fa-box-archive'}`}></i>
                    </button>
                    <button onClick={() => setCaseToDelete(activeCase.id)} className="text-slate-400 hover:text-red-500 transition w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50" title="حذف الملف"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                  <p className="text-sm font-bold text-slate-400">رقم الملف: <span className="font-mono text-slate-600">#LXG-928{activeCase.id.split('-')[1]}</span></p>
                </div>
                <div className="flex gap-4">
                  {/* Collaborators Avatars List */}
                  {activeCase.collaborators && activeCase.collaborators.length > 0 && (
                    <div className="flex -space-x-3 space-x-reverse items-center ml-2">
                      {activeCase.collaborators.map((c) => (
                        <div key={c.id} className="relative group">
                          <img
                            src={c.img}
                            className="w-9 h-9 rounded-full border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-110 hover:z-20"
                            alt={c.name}
                          />
                          <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-2 py-1 bg-brand-dark text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-xl">
                            {c.name} ({c.role === 'lawyer' ? 'محامي' : 'مستخدم'})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setIsShareAccessModalOpen(true)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:border-brand-navy hover:text-brand-navy transition shadow-sm flex items-center gap-2">
                    <i className="fa-solid fa-user-plus"></i> مشاركة الوصول
                  </button>
                  <div
                    className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm cursor-pointer group/lawyer"
                    onClick={() => navigate(`/profile/${activeCase.lawyer.id}`)}
                  >
                    <img src={activeCase.lawyer.img} className="w-11 h-11 rounded-xl border-2 border-white shadow-md" alt={activeCase.lawyer.name} />
                    <div>
                      <p className="text-sm font-black text-brand-dark group-hover/lawyer:text-brand-navy transition-colors">{activeCase.lawyer.name}</p>
                      <p className="text-[10px] text-brand-navy font-black opacity-60">{activeCase.lawyer.role}</p>
                    </div>
                    <button className="mr-2 h-9 w-9 rounded-xl bg-slate-50 text-brand-navy flex items-center justify-center hover:bg-brand-navy hover:text-white transition-all shadow-sm">
                      <i className="fa-solid fa-phone-volume text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Fields Section */}
              <div className="p-5 border-b border-slate-100 bg-white shadow-sm z-10 relative">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-black text-brand-dark flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-brand-gold"></div>
                    معلومات الملف
                  </h4>
                  <button
                    onClick={() => setIsNewFieldModalOpen(true)}
                    className="text-[10px] bg-slate-50 border border-slate-200 text-brand-navy px-3 py-1.5 rounded-lg font-black transition hover:bg-white hover:border-brand-navy"
                  >
                    <i className="fa-solid fa-circle-plus ml-1"></i> إضافة بيانات
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {activeCase.customFields.map((field: any) => (
                    <div key={field.id} className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col hover:border-brand-gold/30 transition shadow-inner">
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1">{field.label}</span>
                      <span className="text-sm font-black text-brand-dark truncate" title={field.value}>{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Communication Area */}
                <div className="flex-1 flex flex-col border-l border-slate-100">

                  {/* Reminders / Actions Alert Banner */}
                  {activeCase.documents.filter((d: any) => d.actionRequired || d.expiresAt).length > 0 && (
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

                  <div className="flex border-b border-slate-100 font-black text-sm text-brand-dark bg-slate-50/50 p-1">
                    {[
                      { id: 'summary', label: 'الملخص', icon: 'fa-solid fa-rectangle-list' },
                      { id: 'chat', label: 'التوجيهات', icon: 'fa-regular fa-comments' },
                      { id: 'ai', label: 'الذكاء الاصطناعي', icon: 'fa-solid fa-robot' },
                      { id: 'financials', label: 'المالية', icon: 'fa-solid fa-file-invoice-dollar' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as WorkspaceTab)}
                        className={`flex-1 py-3.5 flex items-center justify-center gap-2 transition relative rounded-2xl ${activeTab === tab.id ? 'text-brand-navy z-10' : 'text-slate-400 hover:text-brand-dark hover:bg-white/50'}`}
                      >
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeWorkspaceTab"
                            className="absolute inset-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-2xl -z-10"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <i className={tab.icon}></i> {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'chat' ? (
                    <>
                      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 bg-slate-50/50 custom-scrollbar">
                        <div className="text-center w-full my-4">
                          <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase">اليوم</span>
                        </div>

                        {activeCase.messages.map((msg) => (
                          <div key={msg.id} className={`flex gap-3 max-w-[85%] group ${msg.sender === 'user' ? 'mr-auto flex-row-reverse' : ''}`}>
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
                                <span className="uppercase">{msg.time}</span>
                                {msg.sender === 'user' && (
                                  <i className={`fa-solid fa-check-double ${msg.time === 'الآن' ? 'opacity-50' : 'text-blue-300'}`}></i>
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
                          <div className="flex gap-3 max-w-[85%] fade-in">
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
                        <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-4">
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

                          <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-3xl p-2 focus-within:bg-white focus-within:border-brand-navy transition-all relative">
                            <button className="p-3.5 text-slate-400 hover:text-brand-navy transition-colors rounded-2xl shrink-0">
                              <i className="fa-solid fa-paperclip text-lg"></i>
                            </button>
                            <textarea
                              placeholder="اكتب رسالتك للمحامي..."
                              className="w-full bg-transparent border-none focus:outline-none resize-none py-3.5 text-[15px] font-medium text-slate-700 max-h-32 min-h-[52px]"
                              rows={1}
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
                                className="w-12 h-12 bg-slate-200/50 text-slate-400 rounded-2xl hover:bg-brand-navy/10 hover:text-brand-navy transition shrink-0 flex items-center justify-center shadow-sm"
                                title="تسجيل رسالة صوتية"
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
                  ) : activeTab === 'ai' ? (
                    <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-slate-50/50 flex flex-col custom-scrollbar">
                      {activeCase.aiConsultations && activeCase.aiConsultations.length > 0 ? (
                        <div className="space-y-5">
                          {activeCase.aiConsultations.map((ai: any) => (
                            <div key={ai.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:border-brand-gold cursor-pointer transition-all group hover:shadow-md">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center">
                                    <i className="fa-solid fa-robot"></i>
                                  </div>
                                  <h4 className="font-bold text-brand-dark text-sm">{ai.title}</h4>
                                </div>
                                <span className="text-[10px] text-gray-400">{ai.date}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2 pr-10">{ai.excerpt}</p>
                              <div className="pr-10 mt-3 pt-3 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition">
                                <span className="text-[11px] font-bold text-brand-gold">عرض الاستشارة الكاملة <i className="fa-solid fa-chevron-left text-[9px] mr-1"></i></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 my-8">
                          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                            <i className="fa-solid fa-robot text-3xl text-gray-300"></i>
                          </div>
                          <h3 className="text-lg font-black text-brand-dark mb-1">لا توجد استشارات مرتبطة</h3>
                          <p className="text-sm font-medium max-w-xs leading-relaxed">يمكنك ربط محادثاتك مع المستشار الذكي بهذا الملف للرجوع إليها لاحقاً.</p>
                        </div>
                      )}
                    </div>
                  ) : activeTab === 'summary' ? (
                    <SummaryTab
                      activeCase={activeCase}
                      setIsNewFieldModalOpen={setIsNewFieldModalOpen}
                      setActiveTab={setActiveTab}
                    />
                  ) : (
                    <FinancialsTab activeCase={activeCase} />
                  )}
                  <div className="mt-auto pt-6">
                    <button className="w-full py-4 border-2 border-dashed border-brand-navy/30 text-brand-navy rounded-[1.5rem] font-black text-sm hover:bg-brand-navy hover:text-white hover:border-brand-navy transition-all flex justify-center items-center gap-3">
                      <i className="fa-solid fa-link"></i> ربط استشارة ذكية جديدة
                    </button>
                    <Link to="/aichat" className="w-full mt-3 py-4 bg-brand-gold text-brand-dark rounded-[1.5rem] font-black text-sm hover:bg-yellow-500 transition-all flex justify-center items-center gap-3 shadow-lg shadow-brand-gold/20">
                      <i className="fa-solid fa-wand-magic-sparkles"></i> بدء محادثة ذكية جديدة
                    </Link>
                  </div>
                </div>
                {/* Documents Area */}
                <div className="w-full md:w-64 lg:w-80 flex flex-col shrink-0 bg-white border-r border-slate-100">
                  <div className="p-5 border-b border-slate-100 font-black text-sm text-brand-dark flex justify-between items-center bg-slate-50/50">
                    {activeFolderId ? (
                      <button
                        onClick={() => { setActiveFolderId(null); setSelectedDocs(new Set()); }}
                        className="flex items-center gap-2 hover:text-brand-navy transition"
                      >
                        <i className="fa-solid fa-arrow-right"></i>
                        <span className="truncate max-w-[120px]">
                          {activeCase.folders.find((f: any) => f.id === activeFolderId)?.name || 'الوثائق'}
                        </span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-2"><i className="fa-solid fa-folder-tree text-brand-navy"></i> وثائق الملف</span>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleExportAll}
                        disabled={isExporting || activeCase.documents.length === 0}
                        className="text-slate-400 hover:text-brand-navy transition w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50"
                        title="تصدير جميع الوثائق (ZIP)"
                      >
                        {isExporting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-export"></i>}
                      </button>
                      <button
                        onClick={() => setIsNewFolderModalOpen(true)}
                        className="text-slate-400 hover:text-brand-navy transition w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm"
                        title="مجلد جديد"
                      >
                        <i className="fa-solid fa-folder-plus"></i>
                      </button>
                      <span className="bg-brand-navy text-white text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center shadow-sm">
                        {activeCase.documents.length}
                      </span>
                    </div>
                  </div>

                  {/* Batch Action Bar */}
                  <AnimatePresence>
                    {selectedDocs.size > 0 && (
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
                  <div className="px-4 py-3 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
                    <button onClick={() => setDocFilter('all')} className={`px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${docFilter === 'all' ? 'bg-brand-navy text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-white hover:shadow-sm'}`}>الكل</button>
                    <button onClick={() => setDocFilter('pending')} className={`px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${docFilter === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-50 text-amber-600 hover:bg-white hover:shadow-sm'}`}>للتوقيع</button>
                    <button onClick={() => setDocFilter('signed')} className={`px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${docFilter === 'signed' ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-50 text-emerald-600 hover:bg-white hover:shadow-sm'}`}>موقعة</button>
                    <button onClick={() => setDocFilter('expired')} className={`px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${docFilter === 'expired' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-600 hover:bg-white hover:shadow-sm'}`}>منتهية</button>
                    <button onClick={() => setDocFilter('uploaded')} className={`px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${docFilter === 'uploaded' ? 'bg-brand-gold text-brand-dark shadow-md' : 'bg-yellow-50 text-yellow-700 hover:bg-white hover:shadow-sm'}`}>مرفوعة</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {/* Recent AI Consultation Summary */}
                    {!activeFolderId && docFilter === 'all' && activeCase.aiConsultations && activeCase.aiConsultations.length > 0 && (
                      <div className="border border-brand-navy/20 bg-blue-50/50 p-4 rounded-2xl flex flex-col gap-2 relative transition hover:bg-blue-50 cursor-pointer" onClick={() => setActiveTab('ai')}>
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-brand-navy rounded-r-2xl"></div>
                        <div className="flex items-start gap-3 pl-2 pr-1">
                          <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl text-brand-navy shrink-0 mt-0.5">
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest">أحدث استشارة</p>
                              <span className="text-[9px] font-black text-slate-400">{activeCase.aiConsultations[0].date}</span>
                            </div>
                            <p className="text-[13px] font-black text-brand-dark truncate">{activeCase.aiConsultations[0].title}</p>
                            <p className="text-[10px] font-medium text-slate-500 line-clamp-1 mt-1">{activeCase.aiConsultations[0].excerpt}</p>
                          </div>
                        </div>
                      </div>
                    )}

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
                    {filteredDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => !doc.isUploading && setActivePreviewDoc(doc)}
                        className={`border p-4 rounded-2xl hover:border-brand-navy cursor-pointer transition group flex flex-col gap-2 relative bg-white shadow-sm hover:shadow-md ${doc.actionRequired || doc.expiresAt ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100'}`}
                      >

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
                                {doc.actionRequired === 'بانتظار توقيعك' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDocToSign(doc.id); }}
                                    className="text-[9px] font-black bg-brand-navy text-white hover:bg-brand-dark px-3 py-1 rounded-lg transition shadow-md"
                                  >
                                    توقيع
                                  </button>
                                )}
                                {doc.actionRequired && doc.actionRequired !== 'بانتظار توقيعك' && (
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
                              <button
                                onClick={(e) => { e.stopPropagation(); setDocToShare(doc.id); }}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-brand-navy hover:bg-slate-100 transition shadow-sm"
                                title="مشاركة الوثيقة"
                              >
                                <i className="fa-solid fa-share-nodes"></i>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setMovingDocId(doc.id); }}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-brand-navy hover:bg-slate-100 transition shadow-sm"
                                title="نقل الملف"
                              >
                                <i className="fa-solid fa-folder-open"></i>
                              </button>
                              <button onClick={(e) => e.stopPropagation()} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-brand-navy hover:bg-slate-100 transition shadow-sm">
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
                      </div>
                    ))}
                  </div>

                  {activeCase.status !== 'closed' && (
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
      <AnimatePresence>
        {activePreviewDoc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-dark/90 backdrop-blur-md p-4 md:p-10"
          >
            <button
              onClick={() => setActivePreviewDoc(null)}
              className="absolute top-6 left-6 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center z-[210]"
            >
              <i className="fa-solid fa-times text-xl"></i>
            </button>

            <div className="absolute top-6 right-6 text-right hidden md:block">
              <h3 className="text-white font-black text-lg">{activePreviewDoc.name}</h3>
              <p className="text-white/50 text-xs font-bold uppercase mt-1">{activePreviewDoc.size} • {activePreviewDoc.date}</p>
            </div>

            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative w-full h-full max-w-5xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden">
                {activePreviewDoc.type === 'image' ? (
                  <img src={activePreviewDoc.previewUrl || 'https://via.placeholder.com/800'} className="max-w-full max-h-full object-contain" alt="" />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-slate-400">
                    <i className="fa-solid fa-file-pdf text-8xl"></i>
                    <p className="font-black">معاينة ملفات PDF قيد التطوير</p>
                    <button className="px-6 py-3 bg-brand-navy text-white rounded-xl font-bold">تحميل لقراءته محلياً</button>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-white">
                <div className="flex gap-2">
                  <button className="px-6 py-3 bg-slate-100 text-brand-navy rounded-xl font-black text-xs hover:bg-slate-200 transition">تحميل النسخة الأصلية</button>
                  <button className="px-6 py-3 bg-brand-navy text-white rounded-xl font-black text-xs shadow-lg shadow-brand-navy/20 transition">إرسال للمحامي</button>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full uppercase">وثيقة معتمدة</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Access Modal */}
      <AnimatePresence>
        {isQrModalOpen && activeCase && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-brand-dark">رمز الوصول السريع</h3>
                <button onClick={() => setIsQrModalOpen(false)} className="text-slate-400 hover:text-red-500 transition">
                  <i className="fa-solid fa-times text-xl"></i>
                </button>
              </div>

              <p className="text-xs font-bold text-slate-500 mb-6 leading-relaxed">
                امسح الرمز أدناه للوصول المباشر إلى ملف هذه القضية من أي جهاز محمول.
              </p>

              <div className="bg-slate-50 rounded-[2rem] p-6 mb-6 inline-block border-2 border-slate-100 shadow-inner relative group">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/cases/${activeCase.id}`)}`}
                  alt="Case QR Code"
                  className="w-44 h-44 rounded-xl mix-blend-multiply"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 backdrop-blur-[1px] rounded-[2rem]">
                  <i className="fa-solid fa-expand text-brand-navy text-2xl"></i>
                </div>
              </div>

              <div className="text-right space-y-1 mb-8 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <p className="text-sm font-black text-brand-dark truncate">{activeCase.title}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">رقم الملف: #LXG-928{activeCase.id.split('-').pop()}</p>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={() => window.print()} className="w-full py-3.5 bg-brand-navy text-white rounded-2xl font-black text-[11px] shadow-lg shadow-brand-navy/20 hover:bg-brand-dark transition flex items-center justify-center">
                  <i className="fa-solid fa-print ml-2"></i> طباعة الرمز للملف الورقي
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/cases/${activeCase.id}`); alert('تم نسخ الرابط'); }}
                    className="flex-1 py-3.5 bg-slate-100 text-brand-navy rounded-2xl font-black text-[11px] hover:bg-slate-200 transition"
                  >
                    <i className="fa-regular fa-copy ml-2"></i> نسخ الرابط
                  </button>
                  <button onClick={handleDownloadQr} className="flex-1 py-3.5 bg-slate-100 text-brand-navy rounded-2xl font-black text-[11px] hover:bg-slate-200 transition">
                    <i className="fa-solid fa-download ml-2"></i> تحميل PNG
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Case Summary Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && activeCase && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4 print:p-0 print:bg-white"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden">
                <h3 className="text-xl font-black text-brand-dark">ملخص القضية</h3>
                <button onClick={() => setIsSummaryModalOpen(false)} className="text-slate-400 hover:text-red-500 transition">
                  <i className="fa-solid fa-times text-xl"></i>
                </button>
              </div>

              {/* Content to Print */}
              <div className="p-8 space-y-8 text-right" id="case-summary-print">
                <div className="flex justify-between items-start border-b-2 border-brand-navy/10 pb-6">
                  <div>
                    <h1 className="text-3xl font-black text-brand-dark">{activeCase.title}</h1>
                    <p className="text-slate-500 font-bold mt-2">رقم الملف: #LXG-928{activeCase.id.split('-')[1]}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">تاريخ التقرير</p>
                    <p className="font-bold text-brand-dark">{new Date().toLocaleDateString('ar-IQ')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">المحامي المسؤول</h4>
                    <p className="text-lg font-black text-brand-dark">{activeCase.lawyer.name}</p>
                    <p className="text-sm font-bold text-brand-navy mt-1">{activeCase.lawyer.role}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">حالة الملف والتقدم</h4>
                    <p className="text-lg font-black text-brand-dark">{activeCase.statusText}</p>
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                      <div className="bg-brand-gold h-full rounded-full" style={{ width: `${activeCase.progress}%` }}></div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 mt-1">{activeCase.progress}% مكتمل</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">تفاصيل البيانات</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {activeCase.customFields.map(field => (
                      <div key={field.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{field.label}</p>
                        <p className="text-sm font-black text-brand-dark">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 print:hidden">
                <button onClick={() => window.print()} className="flex-1 py-4 bg-brand-navy text-white rounded-2xl font-black text-sm hover:bg-brand-dark transition shadow-lg shadow-brand-navy/20 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-print"></i> طباعة الملخص
                </button>
                <button onClick={() => setIsSummaryModalOpen(false)} className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-white transition">إغلاق</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {
        caseToDelete && (
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
        isNewFolderModalOpen && (
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
        movingDocId && activeCase && (
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
        isNewFieldModalOpen && (
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
        docToSign && (
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

      {/* Share Document Modal */}
      {
        docToShare && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-right fade-in relative">
              <h3 className="text-xl font-bold text-brand-dark mb-2">مشاركة الوثيقة بأمان</h3>
              <p className="text-sm text-gray-500 mb-6">شارك هذه الوثيقة مع أطراف أخرى (مثل المحامي المعاون أو الخصم) مع تحكم كامل بالصلاحيات.</p>

              <div className="bg-blue-50 text-brand-navy font-bold text-sm p-3 rounded-xl mb-6 border border-blue-100 flex items-center gap-2">
                <i className="fa-solid fa-file-pdf"></i>
                <span className="truncate">{activeCase?.documents.find(d => d.id === docToShare)?.name}</span>
              </div>

              {!shareLinkGenerated ? (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 mb-1">البريد الإلكتروني للطرف الآخر</label>
                    <input
                      type="email"
                      placeholder="example@domain.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-gold text-left text-brand-dark"
                      dir="ltr"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 mb-1">صلاحية الوصول</label>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex text-sm">
                      <button
                        onClick={() => setSharePermission('view')}
                        className={`flex-1 py-2 font-bold transition flex flex-col justify-center items-center gap-1 ${sharePermission === 'view' ? 'bg-brand-navy text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        <i className="fa-solid fa-eye text-lg"></i>
                        <span>قراءة فقط</span>
                      </button>
                      <button
                        onClick={() => setSharePermission('comment')}
                        className={`flex-1 py-2 font-bold transition flex flex-col justify-center items-center gap-1 border-r border-gray-200 ${sharePermission === 'comment' ? 'bg-brand-navy text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        <i className="fa-solid fa-comment-dots text-lg"></i>
                        <span>تعليق</span>
                      </button>
                      <button
                        onClick={() => setSharePermission('edit')}
                        className={`flex-1 py-2 font-bold transition flex flex-col justify-center items-center gap-1 border-r border-gray-200 ${sharePermission === 'edit' ? 'bg-brand-navy text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        <i className="fa-solid fa-pen text-lg"></i>
                        <span>تعديل</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex bg-orange-50 border border-orange-100 p-3 rounded-xl mb-6 items-start gap-2">
                    <i className="fa-solid fa-shield-halved text-orange-500 mt-1"></i>
                    <p className="text-[10px] text-orange-800">
                      رابط المشاركة سيكون محمياً وسيتم تسجيل جميع حركات الوصول للوثيقة في سجلات النظام تلقائياً.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDocToShare(null);
                        setShareEmail('');
                        setSharePermission('view');
                      }}
                      className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => setShareLinkGenerated(`https://portal.lx.gov/sh/${Math.random().toString(36).substring(2, 10)}`)}
                      className="flex-[1.5] py-3 bg-brand-navy text-white rounded-xl font-bold hover:bg-[#0f1754] transition shadow-md flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-link"></i> إنشاء رابط آمن
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    <i className="fa-solid fa-check"></i>
                  </div>
                  <h4 className="font-bold text-brand-dark mb-1">تم إرسال الدعوة وإنشاء الرابط!</h4>
                  <p className="text-xs text-gray-500 mb-6">تمت إضافة إذن الوصول لـ {shareEmail || 'المستخدم'}</p>

                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-6 flex items-center gap-2">
                    <input type="text" readOnly value={shareLinkGenerated} className="bg-transparent flex-1 outline-none text-xs text-gray-500 font-mono text-left" dir="ltr" />
                    <button className="text-brand-navy hover:text-brand-gold transition px-2 font-bold text-xs"><i className="fa-regular fa-copy"></i> نسخ</button>
                  </div>

                  <button
                    onClick={() => {
                      setDocToShare(null);
                      setShareLinkGenerated(null);
                      setShareEmail('');
                    }}
                    className="w-full py-3 bg-brand-navy text-white rounded-xl font-bold hover:bg-[#0f1754] transition"
                  >
                    إغلاق
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* New Case Modal */}
      <AnimatePresence>
        {isNewCaseModalOpen && (
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

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] p-8 text-right shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-500">
                  <i className="fa-solid fa-arrow-right-from-bracket text-3xl"></i>
                </div>
                <h3 className="mb-2 text-xl font-black text-brand-dark">تسجيل الخروج</h3>
                <p className="mb-8 text-sm font-bold text-slate-500 leading-relaxed">
                  هل أنت متأكد من رغبتك في تسجيل الخروج؟ ستحتاج إلى إدخال بيانات الاعتماد الخاصة بك مرة أخرى للوصول إلى ملفاتك.
                </p>

                <div className="flex w-full gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLogoutConfirmOpen(false)}
                    className="flex-1 rounded-2xl border border-slate-200 py-3.5 font-black text-slate-600 transition hover:bg-slate-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 rounded-2xl bg-red-500 py-3.5 font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600"
                  >
                    خروج
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Access Modal */}
      <AnimatePresence>
        {isShareAccessModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[160] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl text-right">
              <h3 className="text-xl font-black text-brand-dark mb-2">منح صلاحية الوصول</h3>
              <p className="text-sm font-bold text-slate-500 mb-6">قم بمنح صلاحية الوصول لشريك أو محامي آخر للاطلاع أو التحرير في هذا الملف.</p>
              <div className="mb-6">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">البريد الإلكتروني</label>
                <input type="email" placeholder="example@domain.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-right outline-none focus:border-brand-navy" />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">نوع الحساب</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-right outline-none focus:border-brand-navy cursor-pointer">
                    <option value="user">مستخدم / شريك</option>
                    <option value="lawyer">محامي آخر</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">الصلاحية</label>
                  <select value={invitePermissions} onChange={e => setInvitePermissions(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-right outline-none focus:border-brand-navy cursor-pointer">
                    <option value="view">قراءة فقط</option>
                    <option value="edit">تحرير وإضافة</option>
                  </select>
                </div>
              </div>

              {activeCase?.collaborators && activeCase.collaborators.length > 0 && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">المتعاونون الحاليون</h4>
                  <div className="space-y-3">
                    {activeCase.collaborators.map((collab) => (
                      <div key={collab.id} className="flex flex-row-reverse items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group">
                        <div className="flex flex-row-reverse items-center gap-3">
                          <img src={collab.img} className="w-10 h-10 rounded-xl border border-white shadow-sm" alt="" />
                          <div className="text-right">
                            <p className="text-sm font-black text-brand-dark">{collab.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{collab.role === 'lawyer' ? 'محامي' : 'مستخدم'} • {collab.permissions === 'edit' ? 'تحرير' : 'عرض'}</p>
                          </div>
                        </div>
                        <button onClick={() => handleRevokeAccess(collab.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-300 hover:text-red-500 hover:border-red-100 transition-all flex items-center justify-center shadow-sm">
                          <i className="fa-solid fa-user-minus text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setIsShareAccessModalOpen(false)} className="flex-1 py-3 font-black text-slate-400 hover:text-slate-600 transition">إلغاء</button>
                <button onClick={handleInviteCollaborator} className="flex-2 rounded-2xl bg-brand-navy text-white py-3 px-6 font-black shadow-lg shadow-brand-navy/20">إرسال دعوة</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Reply Modal */}
      <AnimatePresence>
        {replyModalDoc && (
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
