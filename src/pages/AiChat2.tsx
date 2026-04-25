import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// This file is not using NotificationContext, so no changes are needed here for the current request.
type ChatRole = 'user' | 'ai';
type WorkspaceTab = 'chat' | 'sources' | 'prompts' | 'overview';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  time: string;
}

interface LawSource {
  id: string;
  title: string;
  law: string;
  article: string;
  category: string;
  summary: string;
  source: string;
}

interface ChatTab {
  id: string;
  name: string;
  description: string;
  messages: ChatMessage[];
  query: string;
  sources: LawSource[];
  lastUpdated: string;
  status: string;
  workspaceTab: WorkspaceTab;
}

const QUICK_PROMPTS = [
  'كيف أؤسس شركة محدودة؟',
  'عقوبة التزوير في القانون العراقي',
  'ما هي حقوق المستأجر؟',
  'كيف أرفع دعوى شطب سند ملكية؟',
];

const SAVED_TOPICS = [
  { id: 'h1', title: 'إجراءات تسجيل علامة تجارية', note: 'خطوات التسجيل والاعتراضات المحتملة' },
  { id: 'h2', title: 'مراجعة بند القوة القاهرة في العقد', note: 'صياغة أوضح وأكثر توازناً' },
  { id: 'h3', title: 'صياغة ملاحظات للامتثال الضريبي', note: 'قائمة متابعة يومية مختصرة' },
];

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'ai',
    text: 'أهلاً بك في LexiAI Pro. استخدم جلسة مستقلة لكل قضية أو عقد، وانتقل بين المحادثة والمراجع والقوالب من التبويبات العلوية بسهولة.',
    time: 'الآن',
  },
];

const INITIAL_TABS: ChatTab[] = [
  {
    id: 'general',
    name: 'عام',
    description: 'استفسارات يومية وتحليل سريع.',
    messages: initialMessages,
    query: '',
    sources: [],
    lastUpdated: 'الآن',
    status: 'نشط',
    workspaceTab: 'chat',
  },
  {
    id: 'contracts',
    name: 'عقود',
    description: 'مراجعة البنود والمخاطر التعاقدية.',
    messages: [],
    query: '',
    sources: [],
    lastUpdated: '-',
    status: 'جديد',
    workspaceTab: 'chat',
  },
  {
    id: 'litigation',
    name: 'التقاضي',
    description: 'إجراءات الدعوى والتحضير.',
    messages: [],
    query: '',
    sources: [],
    lastUpdated: '-',
    status: 'جديد',
    workspaceTab: 'chat',
  },
];

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: string;
  description: string;
}> = [
    { id: 'chat', label: 'المحادثة', icon: 'fa-solid fa-comments', description: 'السؤال والرد' },
    { id: 'sources', label: 'المراجع', icon: 'fa-solid fa-book-open', description: 'النصوص المرتبطة' },
    { id: 'prompts', label: 'القوالب', icon: 'fa-solid fa-bolt', description: 'اختصارات العمل' },
    { id: 'overview', label: 'النظرة العامة', icon: 'fa-solid fa-table-columns', description: 'ملخص الجلسة' },
  ];

const getMockReply = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (normalized.includes('شركة') || normalized.includes('تأسس') || normalized.includes('محدودة')) {
    return 'لتأسيس شركة محدودة في العراق، يلزم تحديد رأس المال، إعداد عقد التأسيس، تقديم المستندات إلى السجل التجاري، ثم استكمال التسجيل الضريبي والإجراءات اللاحقة.';
  }
  if (normalized.includes('علامة تجارية') || normalized.includes('تسجيل علامة')) {
    return 'يبدأ تسجيل العلامة التجارية بتقديم الطلب، ثم الفحص الشكلي، ثم النشر للاعتراض. عند عدم وجود اعتراض نافذ، يصدر قرار التسجيل لمدة عشر سنوات قابلة للتجديد.';
  }
  if (normalized.includes('حقوق المستأجر') || normalized.includes('مستأجر')) {
    return 'يتمتع المستأجر بحقوق مهمة، منها الانتفاع بالعقار وفق العقد، والاعتراض على الإخلاء غير المشروع، والمطالبة بالتعويض عند وقوع إخلال قانوني من الطرف المؤجر.';
  }
  if (normalized.includes('قوة القاهرة') || normalized.includes('القوة القاهرة')) {
    return 'بند القوة القاهرة يعالج الحالات الخارجة عن الإرادة التي تجعل التنفيذ مستحيلاً أو مرهقاً. الأفضل تحديد أمثلة واضحة وآلية الإشعار وآثار التعليق أو الفسخ.';
  }
  return 'هذا توجيه أولي يمكن البناء عليه. شارك مزيداً من التفاصيل أو ألصق النص محل المراجعة للحصول على تحليل أدق ومراجع أقرب للموضوع.';
};

const createMessage = (role: ChatRole, text: string): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
});

const getSessionStatus = (tab: ChatTab) => {
  if (tab.sources.length >= 3) return 'موثقة';
  if (tab.messages.length >= 3) return 'نشطة';
  return 'جديدة';
};

export default function AiChat() {
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<ChatTab[]>(() => {
    if (typeof window === 'undefined') return INITIAL_TABS;
    try {
      const stored = window.localStorage.getItem('lexiai-chat-state');
      if (!stored) return INITIAL_TABS;
      const parsed = JSON.parse(stored) as { tabs: ChatTab[] };
      const restoredTabs = parsed.tabs?.map((tab) => ({
        ...tab,
        workspaceTab: tab.workspaceTab ?? 'chat',
      }));
      return restoredTabs?.length ? restoredTabs : INITIAL_TABS;
    } catch {
      return INITIAL_TABS;
    }
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window === 'undefined') return INITIAL_TABS[0].id;
    return window.localStorage.getItem('lexiai-chat-active') ?? INITIAL_TABS[0].id;
  });
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? INITIAL_TABS[0],
    [tabs, activeTabId]
  );

  const totals = useMemo(() => {
    const messageCount = tabs.reduce((sum, tab) => sum + tab.messages.length, 0);
    const sourceCount = tabs.reduce((sum, tab) => sum + tab.sources.length, 0);
    return { messageCount, sourceCount };
  }, [tabs]);

  useEffect(() => {
    if (!tabs.length) {
      setTabs(INITIAL_TABS);
      setActiveTabId(INITIAL_TABS[0].id);
    }
  }, [tabs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('lexiai-chat-state', JSON.stringify({ tabs, activeTabId }));
    window.localStorage.setItem('lexiai-chat-active', activeTabId);
  }, [tabs, activeTabId]);

  const updateTab = (tabId: string, updater: Partial<ChatTab> | ((tab: ChatTab) => ChatTab)) => {
    setTabs((current) =>
      current.map((tab) =>
        tab.id === tabId
          ? typeof updater === 'function'
            ? updater(tab)
            : { ...tab, ...updater }
          : tab
      )
    );
  };

  const setActiveWorkspaceTab = (workspaceTab: WorkspaceTab) => {
    updateTab(activeTab.id, { workspaceTab });
  };

  const createNewTab = () => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: ChatTab = {
      id: newTabId,
      name: 'جلسة جديدة',
      description: 'مساحة جديدة للاستشارة.',
      messages: initialMessages,
      query: '',
      sources: [],
      lastUpdated: 'الآن',
      status: 'نشط',
      workspaceTab: 'chat',
    };

    setTabs((current) => [newTab, ...current]);
    setActiveTabId(newTabId);
    setErrorMessage(null);
  };

  const closeTab = (tabId: string) => {
    setTabs((current) => {
      if (current.length === 1) {
        setActiveTabId(INITIAL_TABS[0].id);
        return INITIAL_TABS;
      }

      const nextTabs = current.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(nextTabs[0]?.id ?? INITIAL_TABS[0].id);
      }
      return nextTabs;
    });
  };

  const sendChat = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const tabId = activeTab.id;
    setErrorMessage(null);
    updateTab(tabId, (tab) => ({
      ...tab,
      messages: [...tab.messages, createMessage('user', trimmed)],
      query: '',
      lastUpdated: 'الآن',
      status: 'قيد المعالجة',
      workspaceTab: 'chat',
    }));
    setIsTyping(true);

    try {
      const response = await fetch('/api/legal/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, topK: 3 }),
      });
      const data = await response.json();
      const answer = data?.answer || getMockReply(trimmed);
      const aiMessage = createMessage('ai', data?.answer ? answer : `${answer}\n\n⚠️ تمت الاستعاضة برد محلي.`);

      updateTab(tabId, (tab) => ({
        ...tab,
        messages: [...tab.messages, aiMessage],
        sources: Array.isArray(data?.sources) ? data.sources : [],
        lastUpdated: aiMessage.time,
        status: 'نشط',
      }));

      if (!response.ok || !data.answer) {
        setErrorMessage('يوجد خلل في الاتصال بخادم RAG، لذا تم عرض رد تقديري عام.');
      }
    } catch (error) {
      const fallback = getMockReply(trimmed);
      const fallbackMessage = createMessage('ai', `${fallback}\n\n⚠️ تم استخدام الرد المحلي بسبب فشل الاتصال.`);

      updateTab(tabId, (tab) => ({
        ...tab,
        messages: [...tab.messages, fallbackMessage],
        lastUpdated: fallbackMessage.time,
        status: 'محلي',
      }));
      setErrorMessage('تعذّر الوصول إلى خادم التكامل. الرجاء المحاولة لاحقاً.');
      console.error('RAG request failed:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeTab.query.trim()) {
      sendChat(activeTab.query);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    updateTab(activeTab.id, { query: prompt, workspaceTab: 'chat' });
  };

  const handleSavedTopic = (topic: string) => {
    sendChat(topic);
  };

  const renderChatTab = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-brand-dark">المحادثة الحالية</h3>
            <p className="text-xs text-slate-500">كل الرسائل الخاصة بهذه الجلسة في مكان واحد.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {activeTab.messages.length} رسالة
          </span>
        </div>

        <div className="max-h-[560px] space-y-3 overflow-y-auto px-4 py-4">
          {activeTab.messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-2xl border px-4 py-3 ${message.role === 'user'
                  ? 'border-brand-navy/10 bg-brand-navy/[0.03]'
                  : 'border-slate-200 bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-500">{message.role === 'user' ? 'أنت' : 'LexiAI'}</span>
                <span>{message.time}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{message.text}</p>
            </article>
          ))}

          {isTyping && (
            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
              <span>المساعد يجهز الرد</span>
              <span className="flex items-center gap-1">
                <span className="typing-dot h-2 w-2 rounded-full bg-brand-gold"></span>
                <span className="typing-dot h-2 w-2 rounded-full bg-brand-gold"></span>
                <span className="typing-dot h-2 w-2 rounded-full bg-brand-gold"></span>
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <strong>تنبيه:</strong> {errorMessage}
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-brand-dark">ملخص الجلسة</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
              <span>الحالة</span>
              <span className="font-semibold text-brand-dark">{getSessionStatus(activeTab)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
              <span>آخر تحديث</span>
              <span className="font-semibold text-brand-dark">{activeTab.lastUpdated}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
              <span>المراجع</span>
              <span className="font-semibold text-brand-dark">{activeTab.sources.length}</span>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-brand-dark">أسئلة سريعة</h3>
            <button
              type="button"
              onClick={() => updateTab(activeTab.id, { workspaceTab: 'prompts' })}
              className="text-xs font-medium text-brand-navy hover:text-brand-dark"
            >
              عرض الكل
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleQuickPrompt(prompt)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right text-sm text-slate-700 transition hover:border-brand-navy hover:bg-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );

  const renderSourcesTab = () => (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-base font-bold text-brand-dark">المراجع القانونية</h3>
          <p className="text-xs text-slate-500">المواد والنصوص المرتبطة بهذه الجلسة.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {activeTab.sources.length} نتيجة
        </span>
      </div>

      <div className="p-4">
        {activeTab.sources.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            بعد إرسال سؤال قانوني ستظهر المراجع هنا بشكل مباشر.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeTab.sources.map((source) => (
              <article key={source.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-brand-dark">{source.title}</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {source.law} · {source.article}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500">{source.category}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{source.summary}</p>
                <p className="mt-3 text-[11px] text-slate-400">المصدر: {source.source}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const renderPromptsTab = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-brand-dark">القوالب السريعة</h3>
        <p className="mt-1 text-xs text-slate-500">اضغط على أي قالب لتعبئته مباشرة في محرر السؤال.</p>
        <div className="mt-4 grid gap-3">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleQuickPrompt(prompt)}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-right transition hover:border-brand-navy hover:bg-white"
            >
              <p className="text-sm font-bold text-brand-dark">{prompt}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-brand-dark">المواضيع المحفوظة</h3>
        <p className="mt-1 text-xs text-slate-500">تشغيل سريع للأسئلة المتكررة في عملك اليومي.</p>
        <div className="mt-4 grid gap-3">
          {SAVED_TOPICS.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => handleSavedTopic(topic.title)}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-right transition hover:border-brand-navy hover:bg-white"
            >
              <p className="text-sm font-bold text-brand-dark">{topic.title}</p>
              <p className="mt-1 text-xs text-slate-500">{topic.note}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const renderOverviewTab = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-brand-dark">ملخص سريع للجلسة</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 px-4 py-4">
            <p className="text-[11px] text-slate-400">الرسائل</p>
            <p className="mt-2 text-2xl font-bold text-brand-dark">{activeTab.messages.length}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 px-4 py-4">
            <p className="text-[11px] text-slate-400">المراجع</p>
            <p className="mt-2 text-2xl font-bold text-brand-dark">{activeTab.sources.length}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 px-4 py-4">
            <p className="text-[11px] text-slate-400">الحالة</p>
            <p className="mt-2 text-2xl font-bold text-brand-dark">{getSessionStatus(activeTab)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1.5fr)_110px_110px] bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <span>الجلسة</span>
            <span>رسائل</span>
            <span>مراجع</span>
          </div>
          <div className="divide-y divide-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className="grid w-full grid-cols-[minmax(0,1.5fr)_110px_110px] items-center px-4 py-3 text-right text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-brand-dark">{tab.name}</p>
                  <p className="truncate text-xs text-slate-400">{tab.description}</p>
                </div>
                <span>{tab.messages.length}</span>
                <span>{tab.sources.length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-brand-dark">أفضل ممارسة</h3>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
          <li>افتح جلسة مستقلة لكل عقد أو قضية حتى يبقى السياق واضحاً.</li>
          <li>استخدم تبويب المراجع بعد كل سؤال مهم لتأكيد السند القانوني.</li>
          <li>احتفظ بالقوالب للأسئلة المتكررة لتقليل وقت الكتابة اليومي.</li>
        </ul>
      </aside>
    </div>
  );

  return (
    <div className="app-view fade-in min-h-[calc(100vh-140px)]">
      <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#eef2ff_100%)] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">LexiAI Workspace</p>
              <h1 className="mt-1 text-2xl font-bold text-brand-dark sm:text-[28px]">المستشار القانوني الذكي</h1>
              <p className="mt-1 text-sm text-slate-500">
                واجهة أبسط وأسرع: جلسات واضحة، تبويبات مباشرة، ومعلومات كثيفة بدون ازدحام.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] text-slate-400">الجلسات</p>
                <p className="mt-1 text-xl font-bold text-brand-dark">{tabs.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] text-slate-400">الرسائل</p>
                <p className="mt-1 text-xl font-bold text-brand-dark">{totals.messageCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] text-slate-400">المراجع</p>
                <p className="mt-1 text-xl font-bold text-brand-dark">{totals.sourceCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-brand-dark">الجلسات</h2>
              <p className="text-xs text-slate-500">كل جلسة تحتفظ بحالتها وتبويبها النشط.</p>
            </div>
            <button
              type="button"
              onClick={createNewTab}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-3 py-2 text-sm font-bold text-white transition hover:bg-[#0f1754] focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            >
              <i className="fa-solid fa-plus"></i>
              جلسة جديدة
            </button>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1" role="tablist" aria-label="جلسات العمل">
            {tabs.map((tab) => {
              const selected = tab.id === activeTab.id;
              return (
                <div
                  key={tab.id}
                  className={`min-w-[240px] rounded-2xl border px-3 py-3 transition ${selected
                      ? 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/10'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      id={`session-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`session-panel-${tab.id}`}
                      onClick={() => setActiveTabId(tab.id)}
                      className="min-w-0 flex-1 text-right focus:outline-none"
                    >
                      <p className="truncate text-sm font-bold">{tab.name}</p>
                      <p className={`mt-1 truncate text-xs ${selected ? 'text-white/75' : 'text-slate-500'}`}>{tab.description}</p>
                      <div className={`mt-3 flex items-center gap-3 text-[11px] ${selected ? 'text-white/75' : 'text-slate-400'}`}>
                        <span>{tab.messages.length} رسالة</span>
                        <span>{tab.sources.length} مرجع</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => closeTab(tab.id)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${selected ? 'hover:bg-white/10' : 'hover:bg-slate-200'
                        }`}
                      aria-label={`إغلاق جلسة ${tab.name}`}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <main
          id={`session-panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`session-tab-${activeTab.id}`}
          className="min-h-[680px] bg-slate-50/60"
        >
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-brand-dark">{activeTab.name}</h2>
                  <span className="rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-dark">
                    {activeTab.status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {getSessionStatus(activeTab)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{activeTab.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {WORKSPACE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`workspace-tab-${tab.id}`}
                    aria-selected={activeTab.workspaceTab === tab.id}
                    aria-controls={`workspace-panel-${tab.id}`}
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${activeTab.workspaceTab === tab.id
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-navy hover:text-brand-navy'
                      }`}
                  >
                    <i className={tab.icon}></i>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6">
            {activeTab.workspaceTab === 'chat' && (
              <div id="workspace-panel-chat" role="tabpanel" aria-labelledby="workspace-tab-chat">
                {renderChatTab()}
              </div>
            )}
            {activeTab.workspaceTab === 'sources' && (
              <div id="workspace-panel-sources" role="tabpanel" aria-labelledby="workspace-tab-sources">
                {renderSourcesTab()}
              </div>
            )}
            {activeTab.workspaceTab === 'prompts' && (
              <div id="workspace-panel-prompts" role="tabpanel" aria-labelledby="workspace-tab-prompts">
                {renderPromptsTab()}
              </div>
            )}
            {activeTab.workspaceTab === 'overview' && (
              <div id="workspace-panel-overview" role="tabpanel" aria-labelledby="workspace-tab-overview">
                {renderOverviewTab()}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="chat-input" className="text-sm font-semibold text-brand-dark">
                    محرر السؤال
                  </label>
                  <span className="text-xs text-slate-400">لصق العقود والنصوص مدعوم</span>
                </div>
                <textarea
                  id="chat-input"
                  value={activeTab.query}
                  onChange={(event) => updateTab(activeTab.id, { query: event.target.value })}
                  rows={4}
                  placeholder="اكتب سؤالك القانوني أو ألصق النص الذي تريد مراجعته..."
                  className="min-h-[112px] w-full rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  type="submit"
                  className="inline-flex min-w-[160px] items-center justify-center rounded-2xl bg-brand-navy px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f1754] focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                >
                  إرسال
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab('sources')}
                  className="inline-flex min-w-[160px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-brand-navy hover:text-brand-navy"
                >
                  عرض المراجع
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
