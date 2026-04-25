import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import apiClient from '../api/client';

const QUICK_MESSAGE_PROMPTS = [
  'أحتاج تحديثاً سريعاً على آخر خطوة في القضية.',
  'هل هناك مستندات مطلوبة مني اليوم؟',
  'هل يمكن تحديد الخطوة التالية بوضوح؟',
];

type MessageItem = {
  id: string | number;
  sender: 'user' | 'lawyer';
  text: string;
  awaitingResponse?: boolean;
  time: string;
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

  const loadCases = async (preferredConversationId?: string) => {
    try {
      const response = await apiClient.getWorkspaceCases();
      const nextCases = response.data || [];
      setCases(nextCases);

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
  };

  useEffect(() => {
    loadCases();
  }, [selectedLawyerIdFromQuery]);

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
  }, [selectedConversationId, selectedLawyerIdFromQuery]);

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
  const selectedCase = selectedConversation?.cases[0] || null;
  const threadMessages = selectedCase?.messages || [];
  const latestClientMessage = [...threadMessages].reverse().find((message) => message.sender === 'user') || null;
  const draftLength = draft.trim().length;
  const conversationHealthLabel = latestClientMessage?.awaitingResponse ? 'بانتظار رد المحامي' : 'المحادثة محدثة';

  const handleSend = async () => {
    if (!draft.trim() || !selectedCase) return;

    setIsSending(true);
    try {
      await apiClient.addCaseMessage(selectedCase.id, draft.trim(), 'user');
      setDraft('');
      await loadCases(selectedConversation?.id);
    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="app-view fade-in space-y-8 pb-12 text-right">
      <section className="rounded-[2.5rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.03] p-8 shadow-premium">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Messages</p>
            <h1 className="mt-3 text-3xl font-black text-brand-dark">محادثاتك القانونية في مكان واحد</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              راجع أحدث الردود، افتح القضية المرتبطة، أو أرسل تحديثاً سريعاً للمحامي دون التنقل بين الشاشات.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">المحادثات</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">{conversations.length.toLocaleString('ar-IQ')}</p>
            </div>
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">غير المقروء</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">
                {conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0).toLocaleString('ar-IQ')}
              </p>
            </div>
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">الإجراء الأسرع</p>
              <p className="mt-2 text-sm font-black text-brand-dark">اطلب تحديثاً أو افتح القضية</p>
            </div>
          </div>
        </div>
      </section>

      {conversations.length > 0 ? (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن محامٍ أو قضية"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
              />
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>

            <div className="mt-4 space-y-3">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-[1.6rem] border px-4 py-4 text-right transition ${selectedConversation?.id === conversation.id ? 'border-brand-navy bg-[linear-gradient(135deg,rgba(15,39,78,0.04),rgba(255,255,255,1))] shadow-md ring-1 ring-brand-navy/10' : 'border-slate-200 bg-slate-50/60 hover:border-brand-navy/20 hover:bg-white hover:shadow-sm'}`}
                >
                  <div className="flex items-start gap-3">
                    <img src={conversation.lawyerImg} alt={conversation.lawyerName} className="h-12 w-12 rounded-2xl object-cover shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-slate-400">
                          {conversation.lastMessage?.time || conversation.cases[0]?.date}
                        </span>
                        <p className="truncate text-sm font-black text-brand-dark">{conversation.lawyerName}</p>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-500">{conversation.lawyerRole}</p>
                      <p className="mt-2 truncate text-xs font-bold text-slate-500">
                        {conversation.lastMessage?.text || conversation.cases[0]?.title}
                      </p>
                      {conversation.lastMessage?.sender === 'user' && (
                        <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${conversation.lastMessage.awaitingResponse ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {conversation.lastMessage.awaitingResponse ? 'بانتظار متابعة المحامي' : 'تمت متابعة طلبك'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {conversation.unreadCount > 0 ? (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black text-red-600">
                        {conversation.unreadCount.toLocaleString('ar-IQ')} غير مقروء
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
                        {conversation.cases.length.toLocaleString('ar-IQ')} قضية مرتبطة
                      </span>
                    )}
                    <span className="text-[10px] font-black text-slate-400">{conversation.cases[0]?.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            {selectedConversation && selectedCase ? (
              <>
                <div className="border-b border-slate-100 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <img src={selectedConversation.lawyerImg} alt={selectedConversation.lawyerName} className="h-14 w-14 rounded-[1.5rem] object-cover shadow-sm" />
                      <div className="text-right">
                        <h2 className="text-xl font-black text-brand-dark">{selectedConversation.lawyerName}</h2>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {selectedConversation.lawyerRole} • عادةً يرد خلال وقت قصير
                        </p>
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black ${latestClientMessage?.awaitingResponse ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {conversationHealthLabel}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
                            {selectedCase.statusText}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <ActionButton onClick={() => setDraft(QUICK_MESSAGE_PROMPTS[0])} variant="secondary" size="sm">
                        اطلب تحديثاً
                      </ActionButton>
                      <ActionButton onClick={() => navigate('/cases', { state: { activeCaseId: selectedCase.id } })} variant="secondary" size="sm">
                        افتح القضية
                      </ActionButton>
                      <ActionButton onClick={() => navigate('/cases', { state: { activeCaseId: selectedCase.id, focusArea: 'docs' } })} variant="ghost" size="sm">
                        أرسل مستنداً
                      </ActionButton>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1))] px-4 py-4 text-right">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-slate-400">القضية المرتبطة</p>
                        <p className="mt-1 text-sm font-black text-brand-dark">{selectedCase.title}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{selectedCase.statusText}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400">الرسائل</p>
                          <p className="mt-1 text-sm font-black text-brand-dark">{threadMessages.length.toLocaleString('ar-IQ')}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400">الحالة</p>
                          <p className={`mt-1 text-sm font-black ${latestClientMessage?.awaitingResponse ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {latestClientMessage?.awaitingResponse ? 'مفتوحة' : 'متابعة'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="max-h-[520px] space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.75),rgba(255,255,255,1))] p-5">
                  {threadMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 text-right shadow-sm ${message.sender === 'user' ? 'bg-white border border-slate-200 text-slate-700' : 'bg-brand-navy text-white'}`}>
                        <p className="text-sm font-bold leading-7">{message.text}</p>
                        {message.sender === 'user' && (
                          <p className={`mt-2 text-[10px] font-black ${message.awaitingResponse ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {message.awaitingResponse ? 'بانتظار متابعة المحامي' : 'تمت متابعة رسالتك'}
                          </p>
                        )}
                        <p className={`mt-2 text-[10px] font-black ${message.sender === 'user' ? 'text-slate-400' : 'text-white/70'}`}>{message.time}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-5">
                  <div className="rounded-[1.8rem] border border-brand-navy/10 bg-[linear-gradient(135deg,rgba(15,39,78,0.03),rgba(255,255,255,1))] p-4 shadow-sm">
                    <div className="flex flex-wrap justify-end gap-2">
                      {QUICK_MESSAGE_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setDraft(prompt)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 transition hover:border-brand-navy/30 hover:text-brand-navy"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-black text-slate-400">رسالتك إلى {selectedConversation.lawyerName}</p>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black ${draftLength > 0 ? 'bg-brand-navy/5 text-brand-navy' : 'bg-slate-100 text-slate-400'}`}>
                            {draftLength > 0 ? `${draftLength} حرف` : 'ابدأ الكتابة'}
                          </span>
                        </div>
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          placeholder="اكتب رسالتك هنا بصياغة واضحة، ويمكنك الإشارة إلى المستند أو الخطوة المطلوبة..."
                          className="min-h-[130px] rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                        />
                        <p className="text-[11px] font-bold text-slate-400">نصيحة: الرسائل الأقصر والواضحة تساعد المحامي على الرد بسرعة أكبر.</p>
                      </div>
                      <div className="grid gap-3">
                        <ActionButton onClick={handleSend} variant="primary" disabled={!draft.trim() || isSending}>
                          {isSending ? 'جارٍ الإرسال...' : 'إرسال الآن'}
                        </ActionButton>
                        <ActionButton onClick={() => setDraft('أرفقت المستند المطلوب وسأتابع معكم اليوم.')} variant="secondary">
                          رد جاهز
                        </ActionButton>
                        <ActionButton onClick={() => setDraft('')} variant="ghost" disabled={!draft.length || isSending}>
                          مسح المسودة
                        </ActionButton>
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
      )}
    </div>
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
