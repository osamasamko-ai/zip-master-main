import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiClient } from '../api/client';
import { EmptyState, Screen } from '../components/ui';
import { colors } from '../theme/colors';

type Tone = 'formal' | 'simple' | 'friendly';
type WorkspaceTab = 'chat' | 'sources' | 'prompts' | 'overview';
type ChatRole = 'user' | 'assistant';

type Source = {
  id?: string;
  title?: string;
  law?: string;
  article?: string;
  category?: string;
  summary?: string;
  source?: string;
};

type Message = {
  id: string;
  role: ChatRole;
  content: string;
  time: string;
  sources?: Source[];
  tone?: Tone;
};

type ChatSession = {
  id: string;
  name: string;
  description: string;
  status: string;
  lastUpdated: string;
  query: string;
  messages: Message[];
  sources: Source[];
  workspaceTab: WorkspaceTab;
};

const TONES: Array<{ id: Tone; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'formal', label: 'رسمي', icon: 'briefcase-outline' },
  { id: 'simple', label: 'بسيط', icon: 'bulb-outline' },
  { id: 'friendly', label: 'ودي', icon: 'hand-left-outline' },
];

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'chat', label: 'المحادثة', icon: 'chatbubble-outline' },
  { id: 'sources', label: 'المراجع', icon: 'book-outline' },
  { id: 'prompts', label: 'القوالب', icon: 'flash-outline' },
  { id: 'overview', label: 'الملخص', icon: 'analytics-outline' },
];

const QUICK_PROMPTS = [
  'ما هي عقوبة التزوير في القانون العراقي؟',
  'كيفية تأسيس شركة محدودة في بغداد؟',
  'حقوق المستأجر في العقارات التجارية',
  'إجراءات تسجيل العلامة التجارية',
  'كيف أرفع دعوى شطب سند ملكية؟',
];

const SAVED_TOPICS = [
  { id: 'h1', title: 'إجراءات تسجيل علامة تجارية', note: 'خطوات التسجيل والاعتراضات المحتملة' },
  { id: 'h2', title: 'مراجعة بند القوة القاهرة في العقد', note: 'صياغة أوضح وأكثر توازناً' },
  { id: 'h3', title: 'صياغة ملاحظات للامتثال الضريبي', note: 'قائمة متابعة يومية مختصرة' },
];

const initialMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'أهلاً بك. اكتب سؤالك أو الصق نصاً قانونياً، وسأرتب لك الإجابة مع المراجع عندما تكون متاحة.',
  time: 'الآن',
  tone: 'simple',
};

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'general',
    name: 'عام',
    description: 'استفسارات وتحليل سريع.',
    status: 'نشط',
    lastUpdated: 'الآن',
    query: '',
    messages: [initialMessage],
    sources: [],
    workspaceTab: 'chat',
  },
  {
    id: 'contracts',
    name: 'عقود',
    description: 'مراجعة البنود والمخاطر.',
    status: 'جديد',
    lastUpdated: '-',
    query: '',
    messages: [],
    sources: [],
    workspaceTab: 'chat',
  },
  {
    id: 'litigation',
    name: 'تقاضي',
    description: 'إجراءات الدعوى والتحضير.',
    status: 'جديد',
    lastUpdated: '-',
    query: '',
    messages: [],
    sources: [],
    workspaceTab: 'chat',
  },
];

const nowLabel = () => new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

const createMessage = (role: ChatRole, content: string, tone?: Tone, sources?: Source[]): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  time: nowLabel(),
  tone,
  sources,
});

const getSessionStatus = (session: ChatSession) => {
  if (session.sources.length >= 3) return 'موثقة';
  if (session.messages.length >= 3) return 'نشطة';
  return 'جديدة';
};

const fallbackReply = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (normalized.includes('شركة') || normalized.includes('محدودة')) {
    return 'لتأسيس شركة محدودة في العراق، ابدأ بعقد التأسيس، تحديد رأس المال، تقديم المستندات إلى السجل التجاري، ثم استكمال التسجيل الضريبي.';
  }
  if (normalized.includes('مستأجر')) {
    return 'حقوق المستأجر ترتبط بالعقد وبطبيعة العقار، وتشمل الانتفاع الهادئ والاعتراض على الإخلاء غير المشروع والمطالبة بالتعويض عند الإخلال.';
  }
  if (normalized.includes('قوة القاهرة')) {
    return 'بند القوة القاهرة يحتاج أمثلة واضحة، مدة إشعار، أثر التعليق أو الفسخ، وآلية إثبات الحالة الخارجة عن الإرادة.';
  }
  return 'هذا توجيه أولي. أضف تفاصيل القضية أو ألصق النص محل المراجعة للحصول على تحليل أدق ومراجع أقرب للموضوع.';
};

export function AiChatScreen() {
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState(INITIAL_SESSIONS[0].id);
  const [tone, setTone] = useState<Tone>('simple');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localOnlyMode, setLocalOnlyMode] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<any>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );

  const totals = useMemo(
    () => ({
      messages: sessions.reduce((sum, session) => sum + session.messages.length, 0),
      sources: sessions.reduce((sum, session) => sum + session.sources.length, 0),
    }),
    [sessions],
  );

  const personalPrompts = useMemo<string[]>(
    () => (Array.isArray(intelligence?.topSearches) ? intelligence.topSearches.slice(0, 3).map((item: any) => item.label || item.title).filter(Boolean) : []),
    [intelligence],
  );

  const starterPrompts = personalPrompts.length > 0 ? personalPrompts : QUICK_PROMPTS.slice(0, 3);

  const updateSession = (sessionId: string, updater: Partial<ChatSession> | ((session: ChatSession) => ChatSession)) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? (typeof updater === 'function' ? updater(session) : { ...session, ...updater }) : session,
      ),
    );
  };

  const loadIntelligence = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getIntelligence();
      setIntelligence(response.data);
    } catch {
      setIntelligence(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadIntelligence();
  }, []);

  const createNewSession = () => {
    const next: ChatSession = {
      id: `session-${Date.now()}`,
      name: 'جلسة جديدة',
      description: 'سياق منفصل لسؤال جديد.',
      status: 'نشط',
      lastUpdated: 'الآن',
      query: '',
      messages: [initialMessage],
      sources: [],
      workspaceTab: 'chat',
    };
    setSessions((current) => [next, ...current]);
    setActiveSessionId(next.id);
    setErrorMessage(null);
  };

  const closeSession = (sessionId: string) => {
    if (sessions.length === 1) {
      setSessions(INITIAL_SESSIONS);
      setActiveSessionId(INITIAL_SESSIONS[0].id);
      return;
    }

    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);
    if (activeSessionId === sessionId) setActiveSessionId(nextSessions[0]?.id ?? INITIAL_SESSIONS[0].id);
  };

  const setActiveWorkspaceTab = (workspaceTab: WorkspaceTab) => {
    updateSession(activeSession.id, { workspaceTab });
  };

  const setQuery = (query: string) => {
    updateSession(activeSession.id, { query });
  };

  const shareText = async (title: string, text: string) => {
    await Share.share({ title, message: text || 'لا توجد محادثة للمشاركة.' });
  };

  const copyMessage = async (message: Message) => {
    await shareText('إجابة LexiAI', message.content);
    setCopiedMessageId(message.id);
    setTimeout(() => setCopiedMessageId(null), 1500);
  };

  const shareConversation = async () => {
    const text = activeSession.messages.map((message) => `${message.role === 'user' ? 'السؤال' : 'الإجابة'}: ${message.content}`).join('\n\n');
    await shareText('محادثة LexiAI', text);
  };

  const exportConversation = async () => {
    const text = activeSession.messages.map((message) => `${message.role === 'user' ? 'السؤال' : 'الإجابة'}\n${message.content}`).join('\n\n---\n\n');
    await shareText(`lexiai-chat-${new Date().toISOString().slice(0, 10)}.txt`, text);
  };

  const sendChat = async (text = activeSession.query) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const sessionId = activeSession.id;
    const history = activeSession.messages.map((message) => ({ role: message.role, content: message.content }));
    const userMessage = createMessage('user', trimmed, tone);

    setErrorMessage(null);
    updateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage],
      query: '',
      status: 'قيد المعالجة',
      lastUpdated: userMessage.time,
      workspaceTab: 'chat',
    }));
    setLoading(true);

    try {
      const response = await apiClient.askAi(trimmed, history, tone);
      const data = response.data || {};
      const sources = Array.isArray(data.sources) ? data.sources : [];
      const answer = data.answer || data.response || data.content || fallbackReply(trimmed);
      const assistantMessage = createMessage('assistant', answer, tone, sources);

      setLocalOnlyMode(data.mode === 'local');
      updateSession(sessionId, (session) => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        sources,
        status: 'نشط',
        lastUpdated: assistantMessage.time,
      }));
      void loadIntelligence();
    } catch (error) {
      const fallbackMessage = createMessage('assistant', `${fallbackReply(trimmed)}\n\nتم استخدام رد محلي بسبب تعذر الاتصال بخادم المساعد.`, tone);
      updateSession(sessionId, (session) => ({
        ...session,
        messages: [...session.messages, fallbackMessage],
        status: 'محلي',
        lastUpdated: fallbackMessage.time,
      }));
      setLocalOnlyMode(true);
      setErrorMessage(error instanceof Error ? error.message : 'تعذر الوصول إلى خادم المساعد.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrompt = (prompt: string, sendImmediately = false) => {
    if (sendImmediately) {
      void sendChat(prompt);
      return;
    }
    updateSession(activeSession.id, { query: prompt, workspaceTab: 'chat' });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <Pressable onPress={createNewSession} style={styles.headerButton}>
          <Ionicons name="add" size={19} color={colors.navy} />
        </Pressable>
        <Pressable onPress={shareConversation} style={styles.headerButton}>
          <Ionicons name="share-social-outline" size={18} color={colors.navy} />
        </Pressable>
        <Pressable onPress={exportConversation} style={styles.headerButton}>
          <Ionicons name="download-outline" size={18} color={colors.navy} />
        </Pressable>
      </View>

      <View style={styles.headerText}>
        <View style={styles.statusLine}>
          <Text style={styles.statusText}>{loading ? 'جاري التحليل' : 'متصل'}</Text>
          <View style={[styles.statusDot, loading && styles.statusDotBusy]} />
        </View>
        <Text style={styles.title}>المساعد الذكي</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {activeSession.name} · {activeSession.messages.length} رسالة · {activeSession.sources.length} مرجع
        </Text>
      </View>
    </View>
  );

  const renderSessions = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessions}>
      {sessions.map((session) => {
        const selected = session.id === activeSession.id;
        return (
          <Pressable key={session.id} onPress={() => setActiveSessionId(session.id)} style={[styles.sessionChip, selected && styles.sessionChipActive]}>
            <View style={styles.sessionChipTextWrap}>
              <Text style={[styles.sessionChipTitle, selected && styles.sessionChipTitleActive]} numberOfLines={1}>
                {session.name}
              </Text>
              <Text style={[styles.sessionChipMeta, selected && styles.sessionChipMetaActive]}>
                {session.messages.length} / {session.sources.length}
              </Text>
            </View>
            {selected ? (
              <Pressable onPress={() => closeSession(session.id)} style={styles.sessionClose}>
                <Ionicons name="close" size={13} color="#fff" />
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderTabs = () => (
    <View style={styles.tabs}>
      {WORKSPACE_TABS.map((tab) => {
        const selected = activeSession.workspaceTab === tab.id;
        return (
          <Pressable key={tab.id} onPress={() => setActiveWorkspaceTab(tab.id)} style={[styles.tab, selected && styles.tabActive]}>
            <Ionicons name={tab.icon} size={15} color={selected ? '#fff' : colors.muted} />
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderTonePicker = () => (
    <View style={styles.toneRow}>
      {TONES.map((item) => {
        const selected = tone === item.id;
        return (
          <Pressable key={item.id} onPress={() => setTone(item.id)} style={[styles.toneChip, selected && styles.toneChipActive]}>
            <Ionicons name={item.icon} size={14} color={selected ? colors.navy : colors.muted} />
            <Text style={[styles.toneText, selected && styles.toneTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderStarter = () => {
    if (activeSession.messages.length > 1 || activeSession.workspaceTab !== 'chat') return null;

    return (
      <View style={styles.starter}>
        <Text style={styles.starterTitle}>ابدأ بسرعة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptRail}>
          {starterPrompts.map((prompt) => (
            <Pressable key={prompt} onPress={() => handlePrompt(prompt, true)} style={styles.promptPill}>
              <Text style={styles.promptPillText} numberOfLines={2}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderChat = () => (
    <View style={styles.chatPanel}>
      {errorMessage ? (
        <View style={styles.alert}>
          <Pressable onPress={() => setErrorMessage(null)}>
            <Ionicons name="close-circle-outline" size={20} color={colors.red} />
          </Pressable>
          <Text style={styles.alertText}>{errorMessage}</Text>
        </View>
      ) : null}

      {localOnlyMode ? (
        <View style={styles.notice}>
          <Ionicons name="server-outline" size={18} color={colors.gold} />
          <Text style={styles.noticeText}>تم استخدام القاعدة المحلية. راجع المراجع قبل الاعتماد النهائي.</Text>
        </View>
      ) : null}

      {renderStarter()}

      {activeSession.messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          copied={copiedMessageId === message.id}
          onCopy={() => copyMessage(message)}
          onSources={() => setActiveWorkspaceTab('sources')}
        />
      ))}

      {loading ? (
        <View style={styles.typingRow}>
          <View style={styles.assistantAvatar}>
            <Ionicons name="sparkles-outline" size={17} color={colors.gold} />
          </View>
          <View style={styles.typingBubble}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.typingText}>المساعد يكتب</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderSources = () => (
    <View style={styles.panel}>
      <PanelHeader title="المراجع القانونية" note="المواد المرتبطة بآخر إجابة." count={`${activeSession.sources.length}`} />
      {activeSession.sources.length === 0 ? (
        <EmptyState title="لا توجد مراجع بعد" note="اسأل سؤالاً قانونياً، وستظهر المراجع هنا إن أعادها الخادم." />
      ) : (
        activeSession.sources.map((source, index) => (
          <View key={`${source.title}-${index}`} style={styles.sourceCard}>
            <View style={styles.sourceTop}>
              <Badge label={`مرجع ${index + 1}`} />
              <Text style={styles.sourceTitle}>{source.title || 'مرجع قانوني'}</Text>
            </View>
            <Text style={styles.sourceLaw}>{[source.law, source.article ? `مادة ${source.article}` : null].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.sourceSummary}>{source.summary || 'لا يوجد ملخص متاح لهذا المرجع.'}</Text>
            {source.source ? <Text style={styles.sourceLink}>المصدر: {source.source}</Text> : null}
          </View>
        ))
      )}
    </View>
  );

  const renderPrompts = () => (
    <View style={styles.panel}>
      <PanelHeader title="القوالب" note="اختصارات مفيدة للأسئلة المتكررة." />

      {personalPrompts.length > 0 ? (
        <View style={styles.promptGroup}>
          <Text style={styles.groupTitle}>من نشاطك</Text>
          {personalPrompts.map((prompt) => (
            <PromptButton key={prompt} title={prompt} onPress={() => handlePrompt(prompt, true)} highlighted />
          ))}
        </View>
      ) : null}

      <View style={styles.promptGroup}>
        <Text style={styles.groupTitle}>أسئلة سريعة</Text>
        {QUICK_PROMPTS.map((prompt) => (
          <PromptButton key={prompt} title={prompt} onPress={() => handlePrompt(prompt)} />
        ))}
      </View>

      <View style={styles.promptGroup}>
        <Text style={styles.groupTitle}>مواضيع محفوظة</Text>
        {SAVED_TOPICS.map((topic) => (
          <PromptButton key={topic.id} title={topic.title} note={topic.note} onPress={() => handlePrompt(topic.title, true)} />
        ))}
      </View>
    </View>
  );

  const renderOverview = () => (
    <View style={styles.panel}>
      <PanelHeader title="الملخص" note="حالة الجلسة ومساحة العمل." />
      <View style={styles.overviewGrid}>
        <OverviewTile label="الرسائل" value={activeSession.messages.length} />
        <OverviewTile label="المراجع" value={activeSession.sources.length} />
        <OverviewTile label="الحالة" value={getSessionStatus(activeSession)} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>إجمالي العمل</Text>
        <Text style={styles.summaryText}>{sessions.length} جلسات · {totals.messages} رسائل · {totals.sources} مراجع</Text>
      </View>

      {sessions.map((session) => (
        <Pressable key={session.id} onPress={() => setActiveSessionId(session.id)} style={styles.sessionRow}>
          <View style={styles.sessionRowStats}>
            <Text style={styles.sessionRowStat}>{session.messages.length} رسالة</Text>
            <Text style={styles.sessionRowStat}>{session.sources.length} مرجع</Text>
          </View>
          <View style={styles.sessionRowText}>
            <Text style={styles.sessionRowTitle}>{session.name}</Text>
            <Text style={styles.sessionRowDesc}>{session.description}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  const renderActivePanel = () => {
    if (activeSession.workspaceTab === 'sources') return renderSources();
    if (activeSession.workspaceTab === 'prompts') return renderPrompts();
    if (activeSession.workspaceTab === 'overview') return renderOverview();
    return renderChat();
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadIntelligence} tintColor={colors.navy} />}
        contentContainerStyle={styles.content}
      >
        {renderHeader()}
        {renderSessions()}
        {renderTabs()}
        {renderActivePanel()}
      </ScrollView>

      <View style={styles.composerWrap}>
        {renderTonePicker()}
        <View style={styles.composer}>
          <TextInput
            value={activeSession.query}
            onChangeText={setQuery}
            placeholder="اكتب سؤالاً أو الصق نصاً للمراجعة..."
            placeholderTextColor={colors.subtle}
            multiline
            style={styles.input}
            textAlign="right"
          />
          <Pressable disabled={!activeSession.query.trim() || loading} onPress={() => sendChat()} style={[styles.sendButton, (!activeSession.query.trim() || loading) && styles.sendButtonDisabled]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="paper-plane" size={19} color="#fff" />}
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>قد يخطئ الذكاء الاصطناعي. راجع المراجع دائماً.</Text>
      </View>
    </Screen>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function PanelHeader({ title, note, count }: { title: string; note?: string; count?: string }) {
  return (
    <View style={styles.panelHeader}>
      {count ? <Badge label={count} /> : <View />}
      <View style={styles.panelTitleWrap}>
        <Text style={styles.panelTitle}>{title}</Text>
        {note ? <Text style={styles.panelNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

function MessageBubble({ message, copied, onCopy, onSources }: { message: Message; copied: boolean; onCopy: () => void; onSources: () => void }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser ? (
        <View style={styles.assistantAvatar}>
          <Ionicons name="scale-outline" size={16} color={colors.navy} />
        </View>
      ) : null}

      <View style={[styles.messageWrap, isUser && styles.messageWrapUser]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.content}</Text>
          {!isUser && message.sources?.length ? (
            <Pressable onPress={onSources} style={styles.sourcesButton}>
              <Ionicons name="book-outline" size={14} color={colors.navy} />
              <Text style={styles.sourcesButtonText}>عرض {message.sources.length} مراجع</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.messageMetaRow, isUser && styles.messageMetaUser]}>
          <Text style={styles.messageTime}>{message.time}</Text>
          {!isUser && message.content ? (
            <Pressable onPress={onCopy} style={styles.copyButton}>
              <Ionicons name={copied ? 'checkmark-outline' : 'copy-outline'} size={13} color={colors.muted} />
              <Text style={styles.copyText}>{copied ? 'تم' : 'مشاركة'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function PromptButton({ title, note, highlighted, onPress }: { title: string; note?: string; highlighted?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.promptButton, highlighted && styles.promptButtonHighlighted]}>
      <Ionicons name="chevron-back-outline" size={17} color={highlighted ? colors.gold : colors.navy} />
      <View style={styles.promptTextWrap}>
        <Text style={styles.promptTitle}>{title}</Text>
        {note ? <Text style={styles.promptNote}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}

function OverviewTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.overviewTile}>
      <Text style={styles.overviewValue}>{value}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statusText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
  },
  statusDot: {
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  statusDotBusy: {
    backgroundColor: colors.gold,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'right',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'right',
  },
  sessions: {
    gap: 8,
    paddingBottom: 2,
  },
  sessionChip: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 132,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  sessionChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  sessionChipTextWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  sessionChipTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  sessionChipTitleActive: {
    color: '#fff',
  },
  sessionChipMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  sessionChipMetaActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  sessionClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  tabs: {
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 4,
    marginTop: 12,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 4,
    justifyContent: 'center',
    minHeight: 38,
  },
  tabActive: {
    backgroundColor: colors.navy,
  },
  tabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  tabTextActive: {
    color: '#fff',
  },
  chatPanel: {
    marginTop: 12,
  },
  panel: {
    marginTop: 12,
  },
  starter: {
    marginBottom: 10,
  },
  starterTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'right',
  },
  promptRail: {
    gap: 8,
  },
  promptPill: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 62,
    padding: 11,
    width: 190,
  },
  promptPillText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 19,
    textAlign: 'right',
  },
  alert: {
    alignItems: 'center',
    backgroundColor: colors.redTint,
    borderColor: '#f7b4af',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    padding: 12,
  },
  alertText: {
    color: colors.red,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'right',
  },
  notice: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#f6d084',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 10,
    padding: 12,
  },
  noticeText: {
    color: '#92400e',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'right',
  },
  messageRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 9,
    marginBottom: 12,
  },
  messageRowUser: {
    flexDirection: 'row',
  },
  assistantAvatar: {
    alignItems: 'center',
    backgroundColor: colors.goldTint,
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  messageWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  messageWrapUser: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    borderRadius: 8,
    maxWidth: '92%',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  assistantBubble: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: colors.navy,
  },
  messageText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'right',
  },
  userMessageText: {
    color: '#fff',
  },
  sourcesButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sourcesButtonText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  messageMetaRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 5,
  },
  messageMetaUser: {
    flexDirection: 'row',
  },
  messageTime: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  copyButton: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 4,
  },
  copyText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  typingRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 9,
    marginBottom: 8,
  },
  typingBubble: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  typingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  panelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  panelTitleWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  panelNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 3,
    textAlign: 'right',
  },
  badge: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  sourceCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 13,
  },
  sourceTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  sourceTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  sourceLaw: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'right',
  },
  sourceSummary: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
    textAlign: 'right',
  },
  sourceLink: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'right',
  },
  promptGroup: {
    marginBottom: 14,
  },
  groupTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'right',
  },
  promptButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 13,
  },
  promptButtonHighlighted: {
    backgroundColor: '#fffbeb',
    borderColor: '#f6d084',
  },
  promptTextWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  promptTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  promptNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  overviewTile: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  overviewValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  overviewLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 13,
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  summaryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'right',
  },
  sessionRow: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    padding: 12,
  },
  sessionRowStats: {
    gap: 4,
  },
  sessionRowStat: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  sessionRowText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  sessionRowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  sessionRowDesc: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
    textAlign: 'right',
  },
  composerWrap: {
    backgroundColor: colors.canvas,
    paddingTop: 8,
  },
  toneRow: {
    flexDirection: 'row-reverse',
    gap: 7,
    marginBottom: 8,
  },
  toneChip: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    justifyContent: 'center',
    minHeight: 34,
  },
  toneChipActive: {
    backgroundColor: colors.goldTint,
  },
  toneText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  toneTextActive: {
    color: colors.navy,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 9,
    padding: 8,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    maxHeight: 108,
    minHeight: 46,
    paddingHorizontal: 7,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  disclaimer: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
});
