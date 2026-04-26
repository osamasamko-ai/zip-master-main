import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import apiClient from '../api/client';

const USER_QUICK_MESSAGE_PROMPTS = [
  'أحتاج تحديثاً سريعاً على آخر خطوة في القضية.',
  'هل هناك مستندات مطلوبة مني اليوم؟',
  'هل يمكن تحديد الخطوة التالية بوضوح؟',
];

const LAWYER_QUICK_MESSAGE_PROMPTS = [
  'اطلعت على رسالتك وسأتابع الإجراء اليوم.',
  'أحتاج منك تزويدي بالمستندات الداعمة في أقرب وقت.',
  'الخطوة التالية هي مراجعة الملف ثم تزويدك بالتحديث.',
];

type MessageDeliveryState = 'sending' | 'failed';

type MessageItem = {
  id: string | number;
  sender: 'user' | 'lawyer';
  text: string;
  awaitingResponse?: boolean;
  time: string;
  deliveryState?: MessageDeliveryState;
};

type DocumentType = 'pdf' | 'image' | 'other';

interface LegalDocument {
  id: string;
  name: string;
  size: string;
  date: string; // Formatted date string
  type: DocumentType;
  folderId: string | null;
  actionRequired: string | null;
  expiresAt?: string | null;
  expiresText?: string | null;
  previewUrl?: string;
  isSigned?: boolean;
  isUploading?: boolean;
  progress?: number;
  tags?: string[];
  uploadedAt?: string;
}

// Helper function to determine file icon based on type
function getFileIconClass(type: DocumentType): string {
  return type === 'pdf' ? 'fa-file-pdf' : type === 'image' ? 'fa-file-image' : 'fa-file';
}
type WorkspaceCase = {
  id: string;
  title: string;
  statusText: string;
  date: string;
  unreadCount?: number;
  lawyer: {
    id?: string;
    name: string;
    role: string;
    img: string;
  };
  client: string;
  clientId: string;
  messages: MessageItem[];
  documents: LegalDocument[]; // Add this line
};

type Conversation = {
  id: string;
  lawyerId: string;
  lawyerName: string;
  lawyerRole: string;
  lawyerImg: string;
  cases: WorkspaceCase[];
  lastMessage: MessageItem | null;
  unreadCount: number;
  lastSeen?: string;
};

function useSelectedLawyerId() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get('lawyerId') ?? '', [location.search]);
}

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const selectedLawyerIdFromQuery = useSelectedLawyerId();
  const [cases, setCases] = useState<WorkspaceCase[]>([]);
  const [query, setQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [draft, setDraft] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true); // New state for loading skeleton
  const [replyModalDoc, setReplyModalDoc] = useState<LegalDocument | null>(null);
  const [activePreviewDoc, setActivePreviewDoc] = useState<LegalDocument | null>(null);
  const [activeCaseId, setActiveCaseId] = useState('');
  const [showCaseSummary, setShowCaseSummary] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<MessageItem | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLawyerTyping, setIsLawyerTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const viewerRole: 'user' | 'lawyer' = useMemo(() => (user?.role === 'pro' || user?.role === 'admin' ? 'lawyer' : 'user'), [user]);

  const mergeCasesWithPendingMessages = useCallback((serverCases: WorkspaceCase[], localCases: WorkspaceCase[]) => {
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

  const conversations = useMemo(() => buildConversations(cases, viewerRole), [cases, viewerRole]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return conversations;

    return conversations.filter((conversation) =>
      conversation.lawyerName.toLowerCase().includes(normalizedQuery) ||
      conversation.cases.some((item) => item.title.toLowerCase().includes(normalizedQuery)),
    );
  }, [conversations, query]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedConversationId) ||
    conversations.find((conversation) => conversation.id === selectedConversationId) ||
    null;

  const selectedCase = useMemo(() => {
    if (!selectedConversation) return null;
    return selectedConversation.cases.find(c => c.id === activeCaseId) || selectedConversation.cases[0];
  }, [selectedConversation, activeCaseId]);

  const threadMessages = useMemo(() => {
    return selectedCase?.messages || [];
  }, [selectedCase?.messages]);

  const latestClientMessage = [...threadMessages].reverse().find((message) => message.sender === 'user') || null;
  const draftLength = draft.trim().length;
  const isConversationClosed = Boolean(latestClientMessage) && !latestClientMessage.awaitingResponse;
  const conversationHealthLabel = isConversationClosed ? 'المحادثة مغلقة' : latestClientMessage?.awaitingResponse ? 'بانتظار رد المحامي' : 'المحادثة محدثة';
  const isUrgent = selectedCase?.statusText?.includes('خطر') || selectedCase?.statusText?.includes('عاجل');
  const quickMessagePrompts = viewerRole === 'lawyer' ? LAWYER_QUICK_MESSAGE_PROMPTS : USER_QUICK_MESSAGE_PROMPTS;
  const composerPlaceholder = isConversationClosed
    ? 'تم إغلاق هذه المحادثة من جهة المحامي.'
    : viewerRole === 'lawyer'
      ? 'اكتب ردك للعميل هنا...'
      : 'اكتب رسالتك أو استفسارك هنا...';

  const replaceCaseInState = useCallback((nextCase: WorkspaceCase) => {
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

  const loadCases = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoadingConversations(true); // Set loading true only for initial fetch
    try {
      const response = await apiClient.getWorkspaceCases();
      const nextCases = response.data || [];

      setCases((current) => {
        const merged = mergeCasesWithPendingMessages(nextCases, current);
        // Skip update only when the thread content and state are unchanged.
        if (merged.length === current.length && merged.every((item, idx) => {
          const currentItem = current[idx];
          if (
            item.id !== currentItem.id ||
            item.messages.length !== currentItem.messages.length ||
            item.unreadCount !== currentItem.unreadCount
          ) {
            return false;
          }

          return item.messages.every((message, messageIdx) => {
            const currentMessage = currentItem.messages[messageIdx];
            return (
              message.id === currentMessage?.id &&
              message.awaitingResponse === currentMessage?.awaitingResponse &&
              message.text === currentMessage?.text &&
              message.sender === currentMessage?.sender
            );
          });
        })) {
          return current;
        }
        return merged;
      });

      if (isInitial) {
        const grouped = buildConversations(nextCases, viewerRole);
        const preferred =
          selectedLawyerIdFromQuery && grouped.some((c) => c.lawyerId === selectedLawyerIdFromQuery)
            ? grouped.find((c) => c.lawyerId === selectedLawyerIdFromQuery)?.id || ''
            : grouped[0]?.id || '';
        setSelectedConversationId(preferred);

        const initialConv = grouped.find(c => c.id === preferred);
        if (initialConv) {
          setActiveCaseId(initialConv.cases[0]?.id || '');
        }
      }
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      if (isInitial) setIsLoadingConversations(false); // Set loading false after initial fetch
    }
  }, [mergeCasesWithPendingMessages, selectedLawyerIdFromQuery, viewerRole]);

  const markConversationMessagesAsRead = useCallback(async (caseId: string) => {
    try {
      const response = await apiClient.markCaseMessagesAsRead(caseId);
      if (response.data) {
        replaceCaseInState(response.data);
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [replaceCaseInState]);

  // Mark messages as read when a new conversation or case is selected
  useEffect(() => {
    if (selectedConversation) {
      selectedConversation.cases.forEach((c) => {
        if ((c.unreadCount ?? 0) > 0) {
          markConversationMessagesAsRead(c.id);
        }
      });
    }
  }, [selectedConversation, markConversationMessagesAsRead]);

  useEffect(() => {
    loadCases(true);
  }, [loadCases]);

  useEffect(() => {
    const handleRefresh = () => {
      if (document.visibilityState === 'visible') {
        loadCases(false);
      }
    };

    const intervalId = window.setInterval(() => {
      handleRefresh();
    }, 5000);

    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleRefresh);
    };
  }, [loadCases]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [threadMessages, isLawyerTyping]);

  // Auto-expand textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [draft]);

  const ConversationSkeleton = () => (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100 animate-pulse">
          <div className="flex flex-row-reverse items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-slate-200 shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Detect if a message is a "Request" (e.g., asking for docs)
  const isRequestMessage = (text: string) => {
    const keywords = ['يرجى', 'مستند', 'وثيقة', 'توقيع', 'إرسال', 'تزويدنا'];
    return keywords.some(k => text.includes(k));
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

  const appendOptimisticMessage = useCallback((caseId: string, message: MessageItem) => {
    setCases((current) =>
      current.map((item) =>
        item.id === caseId
          ? {
            ...item,
            unreadCount: item.unreadCount ?? 0,
            messages: [...item.messages, message],
          }
          : item,
      ),
    );
  }, []);

  const submitMessage = useCallback(async (caseId: string, outgoingText: string, optimisticId?: string) => {
    if (!outgoingText.trim()) {
      return false;
    }

    const nextOptimisticId = optimisticId || `temp-message-${Date.now()}`;

    if (!optimisticId) {
      appendOptimisticMessage(caseId, {
        id: nextOptimisticId,
        sender: viewerRole,
        text: outgoingText,
        awaitingResponse: viewerRole === 'user',
        time: 'الآن',
        deliveryState: 'sending',
      });
      setDraft('');
    } else {
      updateMessageDeliveryState(caseId, nextOptimisticId, 'sending');
    }

    setIsSending(true);

    try {
      const response = await apiClient.addCaseMessage(caseId, outgoingText, viewerRole);
      if (response.data) {
        replaceCaseInState(response.data);
      } else {
        await loadCases(false);
      }
      return true;
    } catch (error) {
      console.error('Failed to send message', error);
      updateMessageDeliveryState(caseId, nextOptimisticId, 'failed');
      if (!optimisticId) {
        setDraft((current) => (current.trim().length ? current : outgoingText));
      }
      return false;
    } finally {
      setIsSending(false);
    }
  }, [appendOptimisticMessage, loadCases, replaceCaseInState, updateMessageDeliveryState, viewerRole]);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || !selectedCase || isConversationClosed) return;
    const success = await submitMessage(selectedCase.id, draft.trim());

    if (success) {
      setReplyingToMessage(null);
    }

    if (success && viewerRole === 'user') {
      // Mock lawyer typing response to user's message
      setIsLawyerTyping(true);
      // Usually this would be driven by a socket event 'lawyer_typing'
      setTimeout(() => {
        setIsLawyerTyping(false);
      }, 3000);
    }
  }, [draft, isConversationClosed, selectedCase, submitMessage, viewerRole]);

  const handleRetryMessage = useCallback(async (message: MessageItem) => {
    if (!selectedCase || message.sender !== viewerRole) return;
    await submitMessage(selectedCase.id, message.text, String(message.id));
  }, [selectedCase, submitMessage, viewerRole]);

  const handleReplyToMessage = useCallback((message: MessageItem) => {
    setReplyingToMessage(message);
    setDraft((current) => {
      if (current.trim()) {
        return current;
      }

      return viewerRole === 'lawyer'
        ? `بخصوص رسالتك: "${message.text}"\n`
        : `رداً على رسالتك: "${message.text}"\n`;
    });
    textareaRef.current?.focus();
  }, [viewerRole]);

  const handleToggleConversationCompletion = useCallback(async () => {
    if (viewerRole !== 'lawyer' || !latestClientMessage?.id) {
      return;
    }

    try {
      await apiClient.updateProMessageState(String(latestClientMessage.id), {
        awaitingResponse: !latestClientMessage.awaitingResponse,
        unread: false,
      });
      await loadCases(false);
    } catch (error) {
      console.error('Failed to update conversation completion:', error);
    }
  }, [latestClientMessage, loadCases, viewerRole]);

  const handleDocReply = useCallback((doc: LegalDocument) => {
    setReplyModalDoc(doc);
    setReplyText('');
  }, []);

  const handleSendDocReply = async () => {
    if (!replyModalDoc || !selectedCase || !replyText.trim()) return;

    const docName = replyModalDoc.name;
    const docId = replyModalDoc.id;
    const caseId = selectedCase.id;
    const messageText = `رد بخصوص [${docName}]: ${replyText.trim()}`;

    setReplyModalDoc(null);
    setReplyText('');

    await submitMessage(caseId, messageText);

    try {
      const authToken = localStorage.getItem('auth_token') || localStorage.getItem('lexigate_token');
      const response = await fetch(`/api/app/workspace/cases/${caseId}/documents/${docId}/clear-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      const result = await response.json();
      if (result.data) replaceCaseInState(result.data);
    } catch (error) {
      console.error('Failed to clear document action', error);
    }
  };

  const handleDeleteMessage = useCallback(async (messageId: string | number) => {
    if (!selectedCase) return;

    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه الرسالة؟')) return;

    setCases((current) =>
      current.map((c) =>
        c.id === selectedCase.id
          ? {
            ...c,
            messages: c.messages.filter((m) => m.id !== messageId),
          }
          : c
      )
    );
  }, [selectedCase]);

  useEffect(() => {
    setReplyingToMessage(null);
  }, [selectedCase?.id]);

  useEffect(() => {
    setActivePreviewDoc(null);
  }, [selectedCase?.id]);

  return (
    <div className="app-view fade-in space-y-6 pb-6 text-right mx-auto max-w-[1400px]">
      <section className="rounded-[2.5rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.03] p-6 md:p-8 shadow-premium">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Messages</p>
            <h1 className="mt-3 text-3xl font-black text-brand-dark">محادثاتك القانونية في مكان واحد</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              راجع أحدث الردود، افتح القضية المرتبطة، أو أرسل تحديثاً سريعاً للمحامي دون التنقل بين الشاشات.
            </p>
          </div>

          <div className="flex gap-3 sm:min-w-[360px]">
            <div className="flex-1 rounded-3xl border border-white bg-white/90 p-4 shadow-sm text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">المحادثات</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">{conversations.length.toLocaleString('ar-IQ')}</p>
            </div>
            <div className="flex-1 rounded-3xl border border-white bg-white/90 p-4 shadow-sm text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">غير المقروء</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">
                {conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0).toLocaleString('ar-IQ')}
              </p>
            </div>
            <div className="hidden lg:block flex-1 rounded-3xl border border-white bg-white/90 p-4 shadow-sm text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">الإجراء الأسرع</p>
              <p className="mt-2 text-sm font-black text-brand-dark">اطلب تحديثاً أو افتح القضية</p>
            </div>
          </div>
        </div>
      </section>

      {conversations.length > 0 ? (
        <section className={`grid gap-6 h-[calc(100vh-220px)] min-h-[600px] ${selectedConversation && selectedCase ? 'xl:grid-cols-[300px_minmax(0,1fr)_280px]' : 'xl:grid-cols-[300px_minmax(0,1fr)]'}`}>
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm flex flex-col overflow-hidden">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن محامٍ أو قضية"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy" // Added pl-11 for icon
              />
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            </div>

            {viewerRole === 'lawyer' && (
              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ملخص القضايا</p>
                <button
                  onClick={() => setShowCaseSummary(!showCaseSummary)}
                  className={`h-5 w-9 rounded-full transition-colors relative flex items-center px-1 ${showCaseSummary ? 'bg-brand-gold' : 'bg-slate-200'}`}
                  title={showCaseSummary ? "إخفاء ملخص القضايا" : "عرض ملخص القضايا"}
                >
                  <div className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${showCaseSummary ? '-translate-x-4' : 'translate-x-0'}`}></div>
                </button>
              </div>
            )}

            <div className="mt-4 space-y-1 overflow-y-auto flex-1 custom-scrollbar pr-1">
              {isLoadingConversations ? (
                <ConversationSkeleton />
              ) : filteredConversations.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <i className="fa-solid fa-magnifying-glass text-xl"></i>
                  </div>
                  <p className="text-xs font-bold text-slate-400">لا توجد نتائج تطابق بحثك</p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      setActiveCaseId(conversation.cases[0]?.id || '');
                    }}
                    className={`w-full rounded-2xl p-3 text-right transition-all duration-200 border-2 ${selectedConversation?.id === conversation.id
                      ? 'border-brand-navy/10 bg-brand-navy/5 shadow-sm'
                      : 'border-transparent hover:bg-slate-50'}`}
                  >
                    <div className="flex flex-row-reverse items-start gap-3">
                      <div className="relative shrink-0">
                        <img src={conversation.lawyerImg} alt={conversation.lawyerName} className="h-11 w-11 rounded-xl object-cover shadow-sm" />
                        {conversation.cases.some(c => c.statusText?.includes('خطر') || c.statusText?.includes('عاجل')) && (
                          <span
                            className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full bg-red-50 text-[8px] flex items-center justify-center text-red-500 border border-red-100 shadow-sm"
                            title="قضية عاجلة"
                          ><i className="fa-solid fa-triangle-exclamation"></i></span>
                        )}
                        {conversation.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white ring-2 ring-red-500/10"></span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-right">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{conversation.lastMessage?.time || conversation.cases[0]?.date}</span>
                          <p className={`truncate text-sm font-black ${conversation.unreadCount > 0 ? 'text-brand-dark' : 'text-slate-600'}`}>{conversation.lawyerName}</p>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-slate-400">{conversation.cases[0]?.title}</p>
                        <p className={`mt-1 truncate text-xs font-medium ${conversation.unreadCount > 0 ? 'text-brand-navy font-bold' : 'text-slate-400'}`}>
                          {conversation.lastMessage?.text || conversation.cases[0]?.title}
                        </p>
                      </div>
                    </div>

                    {showCaseSummary && viewerRole === 'lawyer' && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        {conversation.cases.map(c => (
                          <div
                            key={c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConversationId(conversation.id);
                              setActiveCaseId(c.id);
                            }}
                            className={`rounded-xl p-2 text-[10px] flex items-center justify-between border cursor-pointer transition-all ${activeCaseId === c.id ? 'bg-brand-navy/10 border-brand-navy/20 shadow-inner' : 'bg-white/50 border-slate-100/50 hover:bg-white hover:shadow-sm'}`}
                          >
                            <div className="text-right">
                              <p className="font-bold text-slate-700 truncate max-w-[120px]">{c.title}</p>
                              <p className="text-slate-400 mt-0.5">{c.date}</p>
                            </div>
                            <span className="rounded-lg bg-brand-navy/5 px-2 py-1 font-black text-brand-navy">{c.statusText}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white shadow-premium flex flex-col overflow-hidden">
            {selectedConversation && selectedCase ? (
              <>
                <div className="border-b border-slate-100 p-4 bg-slate-50/30">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <img src={selectedConversation.lawyerImg} alt={selectedConversation.lawyerName} className="h-12 w-12 rounded-xl object-cover shadow-sm" />
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-brand-dark">{viewerRole === 'lawyer' ? selectedCase.client : selectedConversation.lawyerName}</h2>
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="متصل الآن"></span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-slate-500 flex items-center justify-end gap-1.5">
                          <span>{viewerRole === 'lawyer' ? 'عميل' : selectedConversation.lawyerRole}</span>
                          <span className="h-0.5 w-0.5 rounded-full bg-slate-300"></span>
                          <span className="text-slate-400 font-medium">آخر ظهور: {selectedConversation.lastSeen || 'الآن'}</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap justify-end gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter ${isConversationClosed ? 'bg-slate-100 text-slate-700' : latestClientMessage?.awaitingResponse ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {conversationHealthLabel}
                          </span>
                          {viewerRole === 'lawyer' && latestClientMessage && (
                            <button
                              type="button"
                              onClick={handleToggleConversationCompletion}
                              className={`rounded-full border px-2.5 py-1 text-[9px] font-black transition ${isConversationClosed
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-brand-gold/30 bg-brand-gold/10 text-brand-dark hover:bg-brand-gold/20'}`}
                            >
                              <i className={`fa-solid ${isConversationClosed ? 'fa-lock' : 'fa-circle-check'} ml-1`}></i>
                              {isConversationClosed ? 'إعادة فتح المحادثة' : 'إكمال المحادثة'}
                            </button>
                          )}
                          {selectedConversation.cases.length > 1 && viewerRole === 'lawyer' ? (
                            <div className="relative group/case-pick">
                              <button className="rounded-full bg-brand-navy text-white border border-brand-navy px-2 py-0.5 text-[9px] font-black flex items-center gap-1 shadow-sm">
                                {selectedCase.title}
                                <i className="fa-solid fa-chevron-down text-[7px] opacity-70"></i>
                              </button>
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-100 shadow-2xl rounded-xl py-1 z-50 opacity-0 invisible group-hover/case-pick:opacity-100 group-hover/case-pick:visible transition-all">
                                <p className="px-3 py-1.5 text-[8px] font-black text-slate-400 border-b border-slate-50 uppercase tracking-widest">تبديل ملف القضية</p>
                                {selectedConversation.cases.map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => setActiveCaseId(c.id)}
                                    className={`w-full px-3 py-2 text-right text-[10px] font-black hover:bg-slate-50 transition-colors flex items-center justify-between ${activeCaseId === c.id ? 'text-brand-navy bg-brand-navy/5' : 'text-slate-600'}`}
                                  >
                                    <span className="truncate">{c.title}</span>
                                    {activeCaseId === c.id && <i className="fa-solid fa-check text-[8px]"></i>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="rounded-full bg-white border border-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-400">
                              {selectedCase.title}
                            </span>
                          )}
                          <span className="rounded-full bg-white border border-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-400">
                            {selectedCase.statusText}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton onClick={() => navigate('/cases', { state: { activeCaseId: selectedCase.id } })} variant="ghost" size="sm" className="bg-white border-slate-100 text-slate-600 hover:text-brand-navy">
                        <i className="fa-solid fa-folder-open ml-1.5"></i>
                        الملف
                      </ActionButton>
                      <ActionButton onClick={() => navigate('/cases', { state: { activeCaseId: selectedCase.id, focusArea: 'docs' } })} variant="secondary" size="sm" className="bg-white border border-slate-100">
                        <i className="fa-solid fa-paperclip ml-1.5 text-brand-gold"></i>
                        المرفقات
                      </ActionButton>
                    </div>
                  </div>

                  {isUrgent && (
                    <div className="mt-3 rounded-xl bg-red-50 border border-red-100 p-2.5 flex items-center gap-3 text-right">
                      <div className="h-7 w-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                      </div>
                      <p className="text-[11px] font-black text-red-700">تنبيه: هذه القضية تتطلب متابعة فورية نظراً لاقتراب موعد جلسة أو مهلة قانونية.</p>
                    </div>
                  )}
                </div>

                <div
                  ref={scrollRef}
                  className="flex-1 space-y-6 overflow-y-auto bg-slate-50/20 p-6 custom-scrollbar"
                >
                  <div className="flex justify-center my-4">
                    <span className="rounded-full bg-slate-100 px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">اليوم</span>
                  </div>

                  {threadMessages.map((message) => {
                    const isMe = message.sender === viewerRole;
                    return (
                      <div key={message.id} className="max-w-4xl mx-auto w-full">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[85%] md:max-w-[70%] rounded-[1.5rem] px-5 py-3 text-right shadow-sm relative group ${isMe
                            ? 'bg-brand-navy text-white rounded-tl-none'
                            : isRequestMessage(message.text)
                              ? 'bg-white border-2 border-brand-gold/30 text-slate-700 rounded-tr-none ring-4 ring-brand-gold/5'
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tr-none'
                            }`}
                          >
                            <button
                              onClick={() => navigator.clipboard.writeText(message.text)}
                              className={`absolute top-2 opacity-0 group-hover:opacity-100 transition h-8 w-8 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-brand-navy shadow-sm z-10 ${isMe ? '-left-10' : '-right-10'}`}
                              title="نسخ النص"
                            >
                              <i className="fa-regular fa-copy text-xs"></i>
                            </button>
                            {isMe && (
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                className={`absolute top-11 opacity-0 group-hover:opacity-100 transition h-8 w-8 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 shadow-sm z-10 ${isMe ? '-left-10' : '-right-10'}`}
                                title="حذف الرسالة"
                              >
                                <i className="fa-solid fa-trash-can text-xs"></i>
                              </button>
                            )}
                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => handleReplyToMessage(message)}
                                className="absolute top-11 opacity-0 group-hover:opacity-100 transition h-8 w-8 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-brand-navy shadow-sm z-10 -right-10"
                                title={viewerRole === 'lawyer' ? 'الرد على العميل' : 'الرد على المحامي'}
                              >
                                <i className="fa-solid fa-reply text-xs"></i>
                              </button>
                            )}
                            <p className="text-[14px] md:text-[15px] font-medium leading-relaxed">{message.text}</p>
                            {isMe && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <p className={`text-[10px] font-black ${message.awaitingResponse ? (viewerRole === 'user' ? 'text-blue-200/80' : 'text-amber-200/80') : 'text-emerald-200/80'}`}>
                                  {message.awaitingResponse ? (viewerRole === 'user' ? 'بانتظار رد المحامي' : 'بانتظار رد العميل') : 'تم الرد'}
                                </p>
                                {message.deliveryState === 'sending' && (
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black text-white/60">
                                    جارٍ الإرسال...
                                  </span>
                                )}
                                {message.deliveryState === 'failed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRetryMessage(message)}
                                    className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black text-red-200 transition hover:bg-red-500/40"
                                  >
                                    فشل - إعادة محاولة
                                  </button>
                                )}
                              </div>
                            )}
                            <div className={`mt-2 flex items-center justify-end gap-1.5 text-[9px] font-black uppercase ${isMe ? 'text-white/50' : 'text-slate-400'}`}>
                              <span>{message.time}</span>
                              {isMe && (
                                <motion.i
                                  initial={false}
                                  animate={message.awaitingResponse ? { scale: 1, opacity: 0.4 } : { scale: [1, 1.4, 1], opacity: 1, color: '#93c5fd' }}
                                  transition={{ duration: 0.4 }}
                                  className="fa-solid fa-check-double"
                                  title={message.awaitingResponse ? 'تم الإرسال' : 'تمت القراءة'}
                                />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}

                  {isLawyerTyping && (
                    <div className="max-w-4xl mx-auto w-full">
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-tr-none px-5 py-3 shadow-sm flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-duration:0.8s]"></div>
                          <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></div>
                          <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 p-4 bg-white">
                  <div className="max-w-4xl mx-auto w-full">
                    <div className="rounded-3xl border border-brand-navy/5 bg-slate-50/50 p-4 shadow-sm">
                      {isConversationClosed && (
                        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
                          {viewerRole === 'lawyer' ? (
                            <button
                              type="button"
                              onClick={handleToggleConversationCompletion}
                              className="shrink-0 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-100"
                            >
                              إعادة فتح
                            </button>
                          ) : (
                            <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-slate-500">
                              بانتظار إعادة الفتح
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-black text-emerald-800">تم إغلاق هذه المحادثة من جهة المحامي</p>
                            <p className="mt-1 text-[10px] font-bold text-emerald-700">تم إيقاف الإرسال إلى أن يعيد المحامي فتحها.</p>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap justify-end gap-2 mb-4">
                        {quickMessagePrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => {
                              setReplyingToMessage(null);
                              setDraft(prompt);
                            }}
                            disabled={isConversationClosed}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-brand-navy/30 hover:text-brand-navy"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col md:flex-row gap-3 items-end">
                        <div className="flex-1 space-y-2 w-full">
                          <div className="relative group">
                            {replyingToMessage && (
                              <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-brand-navy/10 bg-white px-4 py-3 text-right">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">
                                    {viewerRole === 'lawyer' ? 'الرد على رسالة العميل' : 'الرد على رسالة المحامي'}
                                  </p>
                                  <p className="mt-1 truncate text-xs font-bold text-slate-500">{replyingToMessage.text}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setReplyingToMessage(null)}
                                  className="shrink-0 rounded-xl bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-400 transition hover:text-red-500"
                                >
                                  إلغاء
                                </button>
                              </div>
                            )}
                            <textarea
                              ref={textareaRef}
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              onKeyDown={(e) => {
                                if (isConversationClosed) {
                                  return;
                                }
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                              }}
                              placeholder={composerPlaceholder}
                              disabled={isConversationClosed}
                              className="min-h-[80px] max-h-[200px] w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 pb-14 text-[14px] font-medium text-slate-700 outline-none transition focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/5 resize-none shadow-inner overflow-y-auto"
                            />
                            <div className="absolute right-4 bottom-3 flex gap-2">
                              <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-brand-navy hover:bg-white border border-transparent hover:border-slate-100 shadow-sm transition"><i className="fa-solid fa-paperclip text-sm"></i></button>
                            </div>
                            <div className="absolute left-3 bottom-3 flex gap-2">
                              {draft.length > 0 && (
                                <button
                                  onClick={() => {
                                    setDraft('');
                                    setReplyingToMessage(null);
                                  }}
                                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 transition"
                                  title="مسح المسودة"
                                >
                                  <i className="fa-solid fa-trash-can text-sm"></i>
                                </button>
                              )}
                              <button
                                onClick={handleSend}
                                disabled={!draft.trim() || isSending || isConversationClosed}
                                className="h-9 w-9 bg-brand-navy text-white rounded-xl shadow-lg shadow-brand-navy/20 hover:bg-brand-dark transition disabled:opacity-30 flex items-center justify-center"
                              >
                                <i className="fa-solid fa-paper-plane text-sm"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 p-8">
                <EmptyState
                  icon="comments"
                  title="اختر محادثة للمتابعة"
                  description="ستظهر هنا رسائلك المرتبطة بالقضايا الحالية حتى تتمكن من الرد أو طلب تحديث سريع."
                />
              </div>
            )}
          </section>

          {selectedConversation && selectedCase && (
            <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-brand-dark">وثائق القضية</h3>
                <button
                  onClick={() => navigate(`/cases`, { state: { activeCaseId: selectedCase.id, focusArea: 'docs' } })}
                  className="text-slate-400 hover:text-brand-navy transition w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50"
                  title="عرض كل الوثائق"
                >
                  <i className="fa-solid fa-folder-open"></i>
                </button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
                {selectedCase.documents.length > 0 ? (
                  selectedCase.documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setActivePreviewDoc(doc)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setActivePreviewDoc(doc);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 transition text-right hover:border-brand-navy/20 hover:bg-white hover:shadow-sm cursor-pointer"
                    >
                      <div className={`text-xl ${doc.type === 'pdf' ? 'text-red-500' : doc.type === 'image' ? 'text-blue-500' : 'text-gray-500'}`}>
                        <i className={`fa-solid ${getFileIconClass(doc.type)}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-brand-dark truncate">{doc.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{doc.size} • {doc.date}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-slate-400 border border-slate-100">
                        معاينة
                      </span>
                      {doc.actionRequired && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDocReply(doc);
                          }}
                          className="rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 px-2 py-0.5 text-[9px] font-black transition flex items-center gap-1"
                        >
                          <i className="fa-solid fa-reply text-[8px]"></i>
                          رد
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    <i className="fa-solid fa-file-circle-xmark text-3xl mb-3 opacity-20"></i>
                    <p className="text-xs font-bold">لا توجد وثائق لهذا الملف</p>
                  </div>
                )}
              </div>
            </aside>
          )}
        </section>
      ) : (
        <EmptyState
          icon="comments"
          title="لا توجد محادثات حتى الآن"
          description="ابدأ قضية جديدة أو اختر محامياً مناسباً لبدء أول تواصل قانوني من داخل المنصة."
          action={
            <div className="flex justify-center gap-3">
              <ActionButton onClick={() => navigate('/lawyers')} variant="secondary">
                ابحث عن محامٍ
              </ActionButton>
              <ActionButton onClick={() => navigate('/cases', { state: { openNewCase: true } })} variant="primary">
                افتح قضية جديدة
              </ActionButton>
            </div>
          }
        />
      )}

      <AnimatePresence>
        {activePreviewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[240] flex items-center justify-center bg-brand-dark/80 backdrop-blur-sm p-4"
          >
            <button
              type="button"
              onClick={() => setActivePreviewDoc(null)}
              className="absolute inset-0"
              aria-label="إغلاق المعاينة"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative z-[241] flex h-[min(85vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                <button
                  type="button"
                  onClick={() => setActivePreviewDoc(null)}
                  className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 transition hover:text-red-500"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
                <div className="min-w-0 flex-1 text-right">
                  <p className="truncate text-lg font-black text-brand-dark">{activePreviewDoc.name}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{activePreviewDoc.size} • {activePreviewDoc.date}</p>
                </div>
              </div>

              <div className="flex-1 overflow-hidden bg-slate-100">
                {activePreviewDoc.previewUrl ? (
                  activePreviewDoc.type === 'image' ? (
                    <img
                      src={activePreviewDoc.previewUrl}
                      alt={activePreviewDoc.name}
                      className="h-full w-full object-contain"
                    />
                  ) : activePreviewDoc.type === 'pdf' ? (
                    <iframe
                      src={activePreviewDoc.previewUrl}
                      title={activePreviewDoc.name}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-400">
                      <i className={`fa-solid ${getFileIconClass(activePreviewDoc.type)} text-7xl`}></i>
                      <p className="font-black">المعاينة غير متاحة لهذا النوع من الملفات</p>
                    </div>
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-400">
                    <i className={`fa-solid ${getFileIconClass(activePreviewDoc.type)} text-7xl`}></i>
                    <p className="font-black">لا توجد معاينة متاحة لهذه الوثيقة حالياً</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white p-5">
                <div className="flex gap-2">
                  {activePreviewDoc.previewUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(activePreviewDoc.previewUrl, '_blank', 'noopener,noreferrer')}
                      className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-brand-navy transition hover:bg-slate-200"
                    >
                      فتح في نافذة جديدة
                    </button>
                  )}
                  {activePreviewDoc.actionRequired && (
                    <button
                      type="button"
                      onClick={() => {
                        setActivePreviewDoc(null);
                        handleDocReply(activePreviewDoc);
                      }}
                      className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-100"
                    >
                      الرد على الملاحظة
                    </button>
                  )}
                </div>
                <span className="rounded-full bg-brand-navy/5 px-3 py-1 text-[10px] font-black text-brand-navy">
                  {activePreviewDoc.type === 'pdf' ? 'PDF' : activePreviewDoc.type === 'image' ? 'صورة' : 'ملف'}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <button onClick={handleSendDocReply} disabled={!replyText.trim() || isSending} className="flex-[2] py-3 px-4 bg-brand-navy text-white rounded-xl font-black text-xs shadow-lg shadow-brand-navy/20 hover:bg-brand-dark transition disabled:opacity-50">إرسال الرد</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function buildConversations(cases: WorkspaceCase[], viewerRole: string): Conversation[] {
  const grouped = new Map<string, Conversation>();

  cases.forEach((item) => {
    const otherPartyId = viewerRole === 'lawyer' ? item.clientId : (item.lawyer.id || item.id);
    const existing = grouped.get(otherPartyId);
    const sortedMessages = [...(item.messages || [])];
    const lastMessage = sortedMessages[sortedMessages.length - 1] || null;

    if (existing) {
      existing.cases.push(item);
      existing.unreadCount += item.unreadCount || 0;
      if (!existing.lastMessage || (lastMessage && String(lastMessage.time) > String(existing.lastMessage.time))) {
        existing.lastMessage = lastMessage;
      }
      return;
    }

    grouped.set(otherPartyId, {
      id: otherPartyId,
      lawyerId: item.lawyer.id || '',
      lawyerName: viewerRole === 'lawyer' ? item.client : item.lawyer.name,
      lawyerRole: viewerRole === 'lawyer' ? 'عميل' : item.lawyer.role,
      lawyerImg: viewerRole === 'lawyer' ? `https://ui-avatars.com/api/?name=${encodeURIComponent(item.client)}&background=0d2a59&color=ffffff` : item.lawyer.img,
      cases: [item],
      lastMessage,
      unreadCount: item.unreadCount || 0,
      lastSeen: 'منذ ٥ دقائق',
    });
  });

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.unreadCount !== right.unreadCount) return right.unreadCount - left.unreadCount;
    return (right.cases[0]?.date || '').localeCompare(left.cases[0]?.date || '', 'ar');
  });
}
