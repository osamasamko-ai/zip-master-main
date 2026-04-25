import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import apiClient from '../api/client';

const QUICK_MESSAGE_PROMPTS = [
  'أحتاج تحديثاً سريعاً على آخر خطوة في القضية.',
  'هل هناك مستندات مطلوبة مني اليوم؟',
  'هل يمكن تحديد الخطوة التالية بوضوح؟',
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
  messages: MessageItem[];
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
};

function useSelectedLawyerId() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get('lawyerId') ?? '', [location.search]);
}

export default function Messages() {
  const navigate = useNavigate();
  const selectedLawyerIdFromQuery = useSelectedLawyerId();
  const [cases, setCases] = useState<WorkspaceCase[]>([]);
  const [query, setQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLawyerTyping, setIsLawyerTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const loadCases = useCallback(async (preferredConversationId?: string) => {
    try {
      const response = await apiClient.getWorkspaceCases();
      const nextCases = response.data || [];
      setCases((current) => mergeCasesWithPendingMessages(nextCases, current));

      const grouped = buildConversations(nextCases);
      const preferred =
        preferredConversationId && grouped.some((conversation) => conversation.id === preferredConversationId)
          ? preferredConversationId
          : selectedLawyerIdFromQuery && grouped.some((conversation) => conversation.lawyerId === selectedLawyerIdFromQuery)
            ? grouped.find((conversation) => conversation.lawyerId === selectedLawyerIdFromQuery)?.id || ''
            : grouped[0]?.id || '';
      setSelectedConversationId(preferred);
    } catch (error) {
      console.error('Failed to load messages', error);
      setCases([]);
    }
  }, [mergeCasesWithPendingMessages, selectedLawyerIdFromQuery]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    const refresh = () => {
      loadCases(selectedConversationId || undefined);
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
  }, [loadCases, selectedConversationId]);

  const conversations = useMemo(() => buildConversations(cases), [cases]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return conversations;

    return conversations.filter((conversation) =>
      conversation.lawyerName.toLowerCase().includes(normalizedQuery) ||
      conversation.cases.some((item) => item.title.toLowerCase().includes(normalizedQuery)),
    );
  }, [conversations, query]);

  useEffect(() => {
    if (!filteredConversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(filteredConversations[0]?.id || '');
    }
  }, [filteredConversations, selectedConversationId]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedConversationId) ||
    conversations.find((conversation) => conversation.id === selectedConversationId) ||
    null;
  const selectedCase = useMemo(() => selectedConversation?.cases[0] || null, [selectedConversation]);

  const threadMessages = useMemo(() => {
    return selectedCase?.messages || [];
  }, [selectedCase?.messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [threadMessages, isLawyerTyping]);

  const latestClientMessage = [...threadMessages].reverse().find((message) => message.sender === 'user') || null;
  const draftLength = draft.trim().length;
  const conversationHealthLabel = latestClientMessage?.awaitingResponse ? 'بانتظار رد المحامي' : 'المحادثة محدثة';
  const isUrgent = selectedCase?.statusText?.includes('خطر') || selectedCase?.statusText?.includes('عاجل');

  // Detect if a message is a "Request" (e.g., asking for docs)
  const isRequestMessage = (text: string) => {
    const keywords = ['يرجى', 'مستند', 'وثيقة', 'توقيع', 'إرسال', 'تزويدنا'];
    return keywords.some(k => text.includes(keywords[0]));
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
        sender: 'user',
        text: outgoingText,
        awaitingResponse: true,
        time: 'الآن',
        deliveryState: 'sending',
      });
      setDraft('');
    } else {
      updateMessageDeliveryState(caseId, nextOptimisticId, 'sending');
    }

    setIsSending(true);

    try {
      const response = await apiClient.addCaseMessage(caseId, outgoingText, 'user');
      if (response.data) {
        replaceCaseInState(response.data);
      } else {
        await loadCases(selectedConversationId || undefined);
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
  }, [appendOptimisticMessage, loadCases, replaceCaseInState, selectedConversationId, updateMessageDeliveryState]);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || !selectedCase) return;
    const success = await submitMessage(selectedCase.id, draft.trim());

    if (success) {
      // Mock lawyer typing response to user's message
      setIsLawyerTyping(true);
      // Usually this would be driven by a socket event 'lawyer_typing'
      setTimeout(() => {
        setIsLawyerTyping(false);
      }, 3000);
    }
  }, [draft, selectedCase, submitMessage]);

  const handleRetryMessage = useCallback(async (message: MessageItem) => {
    if (!selectedCase || message.sender !== 'user') return;
    await submitMessage(selectedCase.id, message.text, String(message.id));
  }, [selectedCase, submitMessage]);

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
        <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] h-[calc(100vh-220px)] min-h-[600px]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm flex flex-col overflow-hidden">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن محامٍ أو قضية"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
              />
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            </div>

            <div className="mt-4 space-y-1 overflow-y-auto flex-1 custom-scrollbar pr-1">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-2xl p-3 text-right transition-all duration-200 border-2 ${selectedConversation?.id === conversation.id
                    ? 'border-brand-navy/10 bg-brand-navy/5 shadow-sm'
                    : 'border-transparent hover:bg-slate-50'}`}
                >
                  <div className="flex flex-row-reverse items-start gap-3">
                    <div className="relative shrink-0">
                      <img src={conversation.lawyerImg} alt={conversation.lawyerName} className="h-11 w-11 rounded-xl object-cover shadow-sm" />
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
                </button>
              ))}
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
                          <h2 className="text-lg font-black text-brand-dark">{selectedConversation.lawyerName}</h2>
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="متصل الآن"></span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-slate-500">
                          {selectedConversation.lawyerRole}
                        </p>
                        <div className="mt-1.5 flex flex-wrap justify-end gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter ${latestClientMessage?.awaitingResponse ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {conversationHealthLabel}
                          </span>
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

                  {threadMessages.map((message) => (
                    <div key={message.id} className="max-w-4xl mx-auto w-full">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-[1.5rem] px-5 py-3 text-right shadow-sm relative ${message.sender === 'user'
                          ? 'bg-brand-navy text-white rounded-tl-none'
                          : isRequestMessage(message.text)
                            ? 'bg-white border-2 border-brand-gold/30 text-slate-700 rounded-tr-none ring-4 ring-brand-gold/5'
                            : 'bg-white border border-slate-100 text-slate-700 rounded-tr-none'
                          }`}
                        >
                          <p className="text-[14px] md:text-[15px] font-medium leading-relaxed">{message.text}</p>
                          {message.sender === 'user' && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className={`text-[10px] font-black ${message.awaitingResponse ? 'text-blue-200/80' : 'text-emerald-200/80'}`}>
                                {message.awaitingResponse ? 'بانتظار رد المحامي' : 'تم الرد'}
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
                          <p className={`mt-2 text-[9px] font-black uppercase ${message.sender === 'user' ? 'text-white/50' : 'text-slate-400'}`}>{message.time}</p>
                        </div>
                      </motion.div>
                    </div>
                  ))}

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
                      <div className="flex flex-wrap justify-end gap-2 mb-4">
                        {QUICK_MESSAGE_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => setDraft(prompt)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 transition hover:border-brand-navy/30 hover:text-brand-navy"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col md:flex-row gap-3 items-end">
                        <div className="flex-1 space-y-2 w-full">
                          <div className="relative group">
                            <textarea
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                              placeholder="اكتب رسالتك أو استفسارك هنا..."
                              className="min-h-[80px] w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-[14px] font-medium text-slate-700 outline-none transition focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/5 resize-none shadow-inner"
                            />
                            <div className="absolute right-4 bottom-3 flex gap-2">
                              <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-brand-navy hover:bg-white border border-transparent hover:border-slate-100 shadow-sm transition"><i className="fa-solid fa-paperclip text-sm"></i></button>
                            </div>
                            <div className="absolute left-3 bottom-3 flex gap-2">
                              {draft.length > 0 && (
                                <button
                                  onClick={() => setDraft('')}
                                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 transition"
                                  title="مسح المسودة"
                                >
                                  <i className="fa-solid fa-trash-can text-sm"></i>
                                </button>
                              )}
                              <button
                                onClick={handleSend}
                                disabled={!draft.trim() || isSending}
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
              <div className="p-8">
                <EmptyState
                  icon="comments"
                  title="اختر محادثة للمتابعة"
                  description="ستظهر هنا رسائلك المرتبطة بالقضايا الحالية حتى تتمكن من الرد أو طلب تحديث سريع."
                />
              </div>
            )}
          </section>
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
      )
      }
    </div >
  );
}

function buildConversations(cases: WorkspaceCase[]): Conversation[] {
  const grouped = new Map<string, Conversation>();

  cases.forEach((item) => {
    const lawyerId = item.lawyer.id || item.id;
    const existing = grouped.get(lawyerId);
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

    grouped.set(lawyerId, {
      id: lawyerId,
      lawyerId,
      lawyerName: item.lawyer.name,
      lawyerRole: item.lawyer.role,
      lawyerImg: item.lawyer.img,
      cases: [item],
      lastMessage,
      unreadCount: item.unreadCount || 0,
    });
  });

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.unreadCount !== right.unreadCount) return right.unreadCount - left.unreadCount;
    return (right.cases[0]?.date || '').localeCompare(left.cases[0]?.date || '', 'ar');
  });
}
