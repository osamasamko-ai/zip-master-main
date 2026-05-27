import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Pill, Screen, SkeletonCard, Toast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type ConversationFilter = 'all' | 'unread' | 'urgent' | 'waiting' | 'closed';
type ComposerTray = 'quick' | 'tools' | null;
type MessageReaction = '👍' | '❤️' | '😂' | '😮' | '😢' | '😡';
type SmartTool = 'brief' | 'next' | 'documents' | 'risk' | 'polish';

const reactions: MessageReaction[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const userQuickPrompts = [
  'أحتاج تحديثاً سريعاً على آخر خطوة في القضية.',
  'هل هناك مستندات مطلوبة مني اليوم؟',
  'هل يمكن تحديد الخطوة التالية بوضوح؟',
];
const lawyerQuickPrompts = [
  'اطلعت على رسالتك وسأتابع الإجراء اليوم.',
  'أحتاج منك تزويدي بالمستندات الداعمة في أقرب وقت.',
  'الخطوة التالية هي مراجعة الملف ثم تزويدك بالتحديث.',
];

export function MessagesScreen() {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [activeCaseId, setActiveCaseId] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [smartDraft, setSmartDraft] = useState<{ title: string; text: string } | null>(null);
  const [reactionMessage, setReactionMessage] = useState<any | null>(null);
  const [showCaseSummary, setShowCaseSummary] = useState(false);
  const [showThreadDetails, setShowThreadDetails] = useState(false);
  const [composerTray, setComposerTray] = useState<ComposerTray>(null);
  const [threadOpen, setThreadOpen] = useState(false);

  const viewerRole: 'user' | 'lawyer' = user?.role === 'pro' || user?.role === 'admin' ? 'lawyer' : 'user';

  const load = async (initial = false) => {
    if (initial) setInitialLoading(true);
    setRefreshing(true);
    try {
      const response = await apiClient.getWorkspaceCases();
      const nextCases = response.data || [];
      setCases(nextCases);
      if (initial) {
        const grouped = buildConversations(nextCases, viewerRole);
        setSelectedConversationId(grouped[0]?.id || '');
        setActiveCaseId(grouped[0]?.cases[0]?.id || '');
      }
    } finally {
      setRefreshing(false);
      if (initial) setInitialLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => load(false), 8000);
    return () => clearInterval(timer);
  }, [viewerRole]);

  const conversations = useMemo(() => buildConversations(cases, viewerRole), [cases, viewerRole]);
  const inboxStats = useMemo(() => {
    const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
    const urgent = conversations.filter((item) => item.cases.some(isUrgentCase)).length;
    const waiting = conversations.filter((item) => item.cases.some(isWaitingCase)).length;
    const closed = conversations.filter((item) => item.cases.some(isClosedCase)).length;
    return { unread, urgent, waiting, closed };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesQuery =
        !normalized ||
        conversation.participantName.toLowerCase().includes(normalized) ||
        conversation.cases.some((item: any) => String(item.title || '').toLowerCase().includes(normalized));
      const matchesFilter =
        filter === 'all' ||
        (filter === 'unread' && conversation.unreadCount > 0) ||
        (filter === 'urgent' && conversation.cases.some(isUrgentCase)) ||
        (filter === 'waiting' && conversation.cases.some(isWaitingCase)) ||
        (filter === 'closed' && conversation.cases.some(isClosedCase));
      return matchesQuery && matchesFilter;
    });
  }, [conversations, filter, query]);

  const selectedConversation =
    conversations.find((item) => item.id === selectedConversationId) ||
    filteredConversations[0] ||
    conversations[0] ||
    null;

  const selectedCase = selectedConversation?.cases.find((item: any) => item.id === activeCaseId) || selectedConversation?.cases[0] || null;
  const threadMessages = selectedCase?.messages || [];
  const latestUserMessage = [...threadMessages].reverse().find((message: any) => message.sender === 'user') || null;
  const closed = latestUserMessage ? !latestUserMessage.awaitingResponse : false;
  const healthLabel = closed ? 'المحادثة مغلقة' : latestUserMessage?.awaitingResponse ? (viewerRole === 'user' ? 'بانتظار رد المحامي' : 'بانتظار رد العميل') : 'المحادثة محدثة';
  const docsNeedingAction = selectedCase?.documents?.filter((doc: any) => doc.actionRequired || doc.expiresAt).length || 0;
  const signedDocs = selectedCase?.documents?.filter((doc: any) => doc.isSigned).length || 0;
  const quickPrompts = viewerRole === 'lawyer' ? lawyerQuickPrompts : userQuickPrompts;

  useEffect(() => {
    if (selectedCase?.id && (selectedCase.unreadCount || 0) > 0) {
      apiClient.markCaseMessagesAsRead(selectedCase.id).then((response) => {
        if (response.data) replaceCase(response.data);
      }).catch(() => undefined);
    }
  }, [selectedCase?.id]);

  const replaceCase = (nextCase: any) => {
    setCases((current) => current.map((item) => (item.id === nextCase.id ? nextCase : item)));
  };

  const selectConversation = (conversation: any) => {
    setSelectedConversationId(conversation.id);
    setActiveCaseId(conversation.cases[0]?.id || '');
    setThreadOpen(true);
    setDraft('');
    setAiResponse('');
    setSmartDraft(null);
    setShowThreadDetails(false);
    setComposerTray(null);
  };

  const sendMessage = async (text = draft) => {
    const outgoing = text.trim();
    if (!outgoing || !selectedCase || closed) return;
    const tempId = `temp-${Date.now()}`;
    setDraft('');
    setSending(true);
    setCases((current) =>
      current.map((item) =>
        item.id === selectedCase.id
          ? {
            ...item,
            messages: [
              ...(item.messages || []),
              { id: tempId, sender: viewerRole, text: outgoing, awaitingResponse: viewerRole === 'user', createdAt: new Date(), deliveryState: 'sending' },
            ],
          }
          : item,
      ),
    );

    try {
      const response = await apiClient.addCaseMessage(selectedCase.id, outgoing, viewerRole);
      if (response.data) replaceCase(response.data);
      setStatus('تم إرسال الرسالة.');
    } catch {
      setStatus('تعذر إرسال الرسالة. حاول مرة أخرى.');
      setDraft(outgoing);
      setCases((current) =>
        current.map((item) =>
          item.id === selectedCase.id
            ? { ...item, messages: (item.messages || []).map((message: any) => message.id === tempId ? { ...message, deliveryState: 'failed' } : message) }
            : item,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const reactToMessage = async (message: any, reaction: MessageReaction) => {
    if (!selectedCase || message.sender === viewerRole) return;
    const nextReaction = message.reaction === reaction ? null : reaction;
    setReactionMessage(null);
    setCases((current) =>
      current.map((item) =>
        item.id === selectedCase.id
          ? { ...item, messages: (item.messages || []).map((currentMessage: any) => currentMessage.id === message.id ? { ...currentMessage, reaction: nextReaction } : currentMessage) }
          : item,
      ),
    );
    try {
      const response = await apiClient.reactToCaseMessage(selectedCase.id, String(message.id), nextReaction);
      if (response.data) replaceCase(response.data);
    } catch {
      load(false);
    }
  };

  const useSmartTool = async (tool: SmartTool) => {
    if (!selectedCase) return;
    const pendingDocs = selectedCase.documents?.filter((doc: any) => doc.actionRequired || doc.expiresAt) || [];
    const lastMessage = threadMessages[threadMessages.length - 1];

    if (tool === 'polish') {
      if (!draft.trim()) {
        setAiResponse('اكتب مسودة قصيرة أولاً، ثم استخدم أداة الصياغة لتحويلها إلى رد واضح ومهني.');
        setAiOpen(true);
        return;
      }
      setAiOpen(true);
      setAiResponse('جارٍ صياغة الرد...');
      try {
        const response = await apiClient.askAi(draft, threadMessages.slice(-6).map((message: any) => ({
          role: message.sender === viewerRole ? 'user' : 'assistant',
          content: message.text,
        })));
        setAiResponse(response.data.answer || response.data.response || response.data.content || 'لم يصل رد من المساعد.');
      } catch {
        setAiResponse('تعذر استدعاء المساعد الذكي حالياً.');
      }
      return;
    }

    if (tool === 'brief') {
      setAiResponse([
        `القضية "${selectedCase.title}" حالياً ${selectedCase.progress}% وحالتها ${selectedCase.statusText}.`,
        `الوثائق: ${(selectedCase.documents || []).length} إجمالاً، ${signedDocs} موقعة، ${pendingDocs.length} تحتاج متابعة.`,
        lastMessage ? `آخر رسالة: ${lastMessage.text}` : 'لا توجد رسائل مسجلة بعد.',
      ].join('\n'));
      setAiOpen(true);
      return;
    }

    if (tool === 'next') {
      setSmartDraft({
        title: 'مسودة الخطوة التالية',
        text: pendingDocs[0]
          ? `ما هي الخطوة التالية بخصوص ${pendingDocs[0].name} في قضية ${selectedCase.title}؟`
          : `هل يمكن تزويدي بالخطوة التالية المتوقعة في قضية ${selectedCase.title}؟`,
      });
      return;
    }

    if (tool === 'documents') {
      setSmartDraft({
        title: 'مسودة طلب مستندات',
        text: `هل توجد مستندات إضافية مطلوبة الآن لقضية ${selectedCase.title}؟ أرجو تحديدها بالاسم حتى أرفعها بشكل صحيح.`,
      });
      return;
    }

    setAiResponse([
      'فحص ذكي سريع:',
      pendingDocs.length > 0 ? `يوجد ${pendingDocs.length} مستند يحتاج متابعة.` : 'لا توجد مستندات معلقة حسب البيانات الحالية.',
      latestUserMessage?.awaitingResponse ? 'توجد رسالة بانتظار رد واضح.' : 'لا تظهر رسالة معلقة تحتاج رداً فورياً.',
      isUrgentCase(selectedCase) ? 'حالة القضية تحمل إشارة عاجلة.' : 'لا تظهر إشارة عاجلة حالياً.',
    ].join('\n'));
    setAiOpen(true);
  };

  return (
    <Screen>
      {!threadOpen ? (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} />} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Pressable onPress={() => load(false)} style={styles.heroAction}>
                <Ionicons name="refresh-outline" size={18} color={colors.navy} />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.title}>الرسائل</Text>
                <Text style={styles.subtitle}>{conversations.length.toLocaleString('ar-IQ')} محادثة · {inboxStats.unread.toLocaleString('ar-IQ')} غير مقروءة</Text>
              </View>
            </View>
            <View style={styles.searchBox}>
              {query ? (
                <Pressable onPress={() => setQuery('')} style={styles.clearSearch}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
              <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن محامٍ أو قضية" placeholderTextColor="#98a2b3" style={styles.searchInput} />
              <Ionicons name="search-outline" size={19} color={colors.navy} />
            </View>
          </View>

          <View style={styles.inboxRail}>
            <InboxStat label="غير مقروء" value={inboxStats.unread} tone="red" />
            <InboxStat label="عاجل" value={inboxStats.urgent} tone="gold" />
            <InboxStat label={viewerRole === 'lawyer' ? 'بانتظارك' : 'بانتظار المحامي'} value={inboxStats.waiting} tone="blue" />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {([
              { id: 'all', label: 'الكل', count: conversations.length },
              { id: 'unread', label: 'غير مقروء', count: conversations.filter((item) => item.unreadCount > 0).length },
              { id: 'urgent', label: 'عاجل', count: inboxStats.urgent },
              { id: 'waiting', label: viewerRole === 'lawyer' ? 'بانتظارك' : 'بانتظار المحامي', count: inboxStats.waiting },
              { id: 'closed', label: 'مغلقة', count: inboxStats.closed },
            ] as Array<{ id: ConversationFilter; label: string; count: number }>).map((item) => (
              <FilterChip key={item.id} active={filter === item.id} label={item.label} count={item.count} onPress={() => setFilter(item.id)} />
            ))}
          </ScrollView>

          {viewerRole === 'lawyer' ? (
            <Card>
              <View style={styles.rowBetween}>
                <Pressable onPress={() => setShowCaseSummary((current) => !current)} style={[styles.toggle, showCaseSummary && styles.toggleActive]}>
                  <Text style={[styles.toggleText, showCaseSummary && styles.toggleTextActive]}>{showCaseSummary ? 'إخفاء' : 'عرض'}</Text>
                </Pressable>
                <Text style={styles.cardTitle}>ملخص القضايا داخل المحادثات</Text>
              </View>
            </Card>
          ) : null}

          {initialLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredConversations.length === 0 ? (
            <EmptyState title="لا توجد نتائج تطابق بحثك" note="جرّب تغيير الفلتر أو البحث باسم آخر." />
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                selected={selectedConversation?.id === conversation.id}
                showCases={showCaseSummary && viewerRole === 'lawyer'}
                onPress={() => selectConversation(conversation)}
                onSelectCase={(caseId) => {
                  setSelectedConversationId(conversation.id);
                  setActiveCaseId(caseId);
                  setThreadOpen(true);
                }}
              />
            ))
          )}

          {conversations.length === 0 && !initialLoading ? (
            <EmptyState title="لا توجد رسائل بعد" note="ابدأ استشارة أو أرسل رسالة من داخل قضية." />
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.threadScreen}>
          {selectedConversation && selectedCase ? (
            <>
              <View style={styles.threadHeader}>
                <Pressable onPress={() => setThreadOpen(false)} style={styles.iconButton}>
                  <Ionicons name="chevron-forward" size={20} color={colors.navy} />
                </Pressable>
                <View style={styles.threadAvatar}>
                  <Text style={styles.threadAvatarText}>{String(selectedConversation.participantName || 'م').charAt(0)}</Text>
                  <View style={styles.threadOnlineDot} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.threadTitleRow}>
                    {selectedConversation.unreadCount > 0 ? <View style={styles.threadUnreadDot} /> : null}
                    <Text style={styles.threadName} numberOfLines={1}>{selectedConversation.participantName}</Text>
                  </View>
                  <Text style={styles.threadMeta}>{selectedConversation.participantRole} · آخر ظهور: {selectedConversation.lastSeen || 'الآن'}</Text>
                </View>
                <Pressable onPress={() => setShowThreadDetails((current) => !current)} style={styles.threadActionButton}>
                  <Ionicons name={showThreadDetails ? 'chevron-up' : 'information-circle-outline'} size={18} color={colors.blue} />
                </Pressable>
              </View>

              <Pressable onPress={() => setShowThreadDetails((current) => !current)} style={styles.caseCompact}>
                <View style={styles.threadProgressTrack}>
                  <View style={[styles.threadProgressFill, { width: `${Math.min(100, Math.max(0, selectedCase.progress || 0))}%` }]} />
                </View>
                <View style={styles.caseCompactTextRow}>
                  <Text style={styles.threadProgressText} numberOfLines={1}>{selectedCase.title}</Text>
                  <Text style={styles.caseCompactPercent}>{selectedCase.progress || 0}%</Text>
                </View>
              </Pressable>

              {showThreadDetails ? (
                <View style={styles.threadDetailsPanel}>
                  <View style={styles.badgeRow}>
                    <Pill label={healthLabel} tone={closed ? 'neutral' : latestUserMessage?.awaitingResponse ? 'gold' : 'green'} />
                    <Pill label={selectedCase.statusText} tone={isUrgentCase(selectedCase) ? 'red' : 'blue'} />
                  </View>

                  {selectedConversation.cases.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.caseSwitchRow}>
                      {selectedConversation.cases.map((item: any) => (
                        <Pressable key={item.id} onPress={() => setActiveCaseId(item.id)} style={[styles.caseSwitch, activeCaseId === item.id && styles.caseSwitchActive]}>
                          <Text style={[styles.caseSwitchText, activeCaseId === item.id && styles.caseSwitchTextActive]} numberOfLines={1}>{item.title}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}

                  {isUrgentCase(selectedCase) ? (
                    <View style={styles.urgentBox}>
                      <Ionicons name="warning-outline" size={18} color={colors.red} />
                      <Text style={styles.urgentText}>هذه القضية تتطلب متابعة فورية نظراً لاقتراب موعد أو مهلة قانونية.</Text>
                    </View>
                  ) : null}

                  <View style={styles.caseStats}>
                    <CaseStat label="تقدم القضية" value={`${selectedCase.progress || 0}%`} />
                    <CaseStat label="الوثائق" value={(selectedCase.documents || []).length} />
                    <CaseStat label="مطلوب إجراء" value={docsNeedingAction} tone={docsNeedingAction > 0 ? 'gold' : 'green'} />
                    <CaseStat label="موقعة" value={signedDocs} />
                  </View>
                </View>
              ) : null}

              <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false}>
                {threadMessages.length === 0 ? (
                  <View style={styles.emptyThread}>
                    <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.gold} />
                    <Text style={styles.emptyThreadTitle}>لا توجد رسائل في هذه القضية بعد</Text>
                    <Text style={styles.emptyThreadText}>ابدأ المحادثة بسؤال واضح أو استخدم أحد الردود السريعة بالأسفل.</Text>
                  </View>
                ) : null}
                {threadMessages.map((message: any, index: number) => {
                  const previous = threadMessages[index - 1];
                  const showDate = !previous || !isSameDay(new Date(previous.createdAt), new Date(message.createdAt));
                  return (
                    <React.Fragment key={message.id}>
                      {showDate ? <Text style={styles.dateSeparator}>{dayLabel(new Date(message.createdAt))}</Text> : null}
                      <MessageBubble
                        message={message}
                        isMe={message.sender === viewerRole}
                        participantName={selectedConversation.participantName}
                        onReact={() => setReactionMessage(message)}
                      />
                    </React.Fragment>
                  );
                })}
              </ScrollView>

              {aiOpen && aiResponse ? (
                <View style={styles.aiPanel}>
                  <View style={styles.rowBetween}>
                    <Pressable onPress={() => setAiResponse('')} style={styles.iconButtonSmall}>
                      <Ionicons name="close" size={15} color={colors.muted} />
                    </Pressable>
                    <Text style={styles.kicker}>اقتراح المساعد الذكي</Text>
                  </View>
                  <Text style={styles.aiText}>{aiResponse}</Text>
                  <View style={styles.inlineActions}>
                    <Button title="استخدام الرد" onPress={() => { setDraft(aiResponse); setAiResponse(''); }} />
                    <Button title="إلحاق" variant="secondary" onPress={() => { setDraft((current) => current ? `${current}\n\n${aiResponse}` : aiResponse); setAiResponse(''); }} />
                  </View>
                </View>
              ) : null}

              {smartDraft ? (
                <View style={styles.smartDraft}>
                  <Text style={styles.cardTitle}>{smartDraft.title}</Text>
                  <Text style={styles.subtitle}>{smartDraft.text}</Text>
                  <View style={styles.inlineActions}>
                    <Button title="استخدام" onPress={() => { setDraft(smartDraft.text); setSmartDraft(null); }} />
                    <Button title="إلحاق" variant="secondary" onPress={() => { setDraft((current) => current ? `${current}\n\n${smartDraft.text}` : smartDraft.text); setSmartDraft(null); }} />
                  </View>
                </View>
              ) : null}

              <View style={styles.composer}>
                {composerTray === 'quick' ? (
                  <>
                    <View style={styles.composerHeader}>
                      <Text style={styles.composerLabel}>ردود سريعة</Text>
                      <Pressable onPress={() => setComposerTray(null)} style={styles.trayClose}>
                        <Ionicons name="close" size={14} color={colors.muted} />
                      </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                      {quickPrompts.map((prompt) => (
                        <Pressable key={prompt} disabled={closed} onPress={() => { setDraft(prompt); setComposerTray(null); }} style={styles.quickPrompt}>
                          <Text style={styles.quickPromptText} numberOfLines={1}>{prompt}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}

                {composerTray === 'tools' ? (
                  <>
                    <View style={styles.composerHeader}>
                      <Text style={styles.composerLabel}>أدوات ذكية</Text>
                      <Pressable onPress={() => setComposerTray(null)} style={styles.trayClose}>
                        <Ionicons name="close" size={14} color={colors.muted} />
                      </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                      {([
                        { id: 'polish', label: 'صياغة', icon: 'create-outline' },
                        { id: 'brief', label: 'ملخص', icon: 'document-text-outline' },
                        { id: 'next', label: 'خطوة', icon: 'git-branch-outline' },
                        { id: 'documents', label: 'مستندات', icon: 'attach-outline' },
                        { id: 'risk', label: 'فحص', icon: 'shield-checkmark-outline' },
                      ] as Array<{ id: SmartTool; label: string; icon: keyof typeof Ionicons.glyphMap }>).map((tool) => (
                        <Pressable key={tool.id} disabled={closed} onPress={() => useSmartTool(tool.id)} style={styles.toolChip}>
                          <Ionicons name={tool.icon} size={15} color={colors.navy} />
                          <Text style={styles.toolText}>{tool.label}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}

                {closed ? (
                  <View style={styles.closedBox}>
                    <Text style={styles.closedText}>تم إغلاق هذه المحادثة. الإرسال متوقف حتى يتم إعادة فتحها.</Text>
                  </View>
                ) : null}

                <View style={styles.inputRow}>
                  <Pressable disabled={closed} onPress={() => setComposerTray((current) => current === 'quick' ? null : 'quick')} style={[styles.composerIconButton, composerTray === 'quick' && styles.composerIconButtonActive]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={19} color={composerTray === 'quick' ? '#fff' : colors.blue} />
                  </Pressable>
                  <Pressable disabled={closed} onPress={() => setComposerTray((current) => current === 'tools' ? null : 'tools')} style={[styles.composerIconButton, composerTray === 'tools' && styles.composerIconButtonActive]}>
                    <Ionicons name="sparkles-outline" size={18} color={composerTray === 'tools' ? '#fff' : colors.blue} />
                  </Pressable>
                  <Pressable disabled={sending || closed || !draft.trim()} onPress={() => sendMessage()} style={[styles.sendButton, (!draft.trim() || closed) && styles.sendButtonDisabled]}>
                    <Ionicons name={sending ? 'hourglass-outline' : 'send'} size={18} color="#fff" />
                  </Pressable>
                  <TextInput
                    editable={!closed}
                    multiline
                    onChangeText={setDraft}
                    placeholder={viewerRole === 'lawyer' ? 'اكتب ردك للعميل هنا...' : 'اكتب رسالتك أو استفسارك هنا...'}
                    placeholderTextColor="#98a2b3"
                    style={styles.messageInput}
                    value={draft}
                  />
                  {draft ? <Text style={styles.draftCount}>{draft.length.toLocaleString('ar-IQ')}</Text> : null}
                </View>
                <Toast message={status} tone={status.includes('تعذر') ? 'error' : 'success'} />
              </View>
            </>
          ) : (
            <EmptyState title="اختر محادثة" note="اختر محادثة من القائمة لعرض الرسائل والتفاصيل." />
          )}
        </View>
      )}

      <ReactionModal
        message={reactionMessage}
        onClose={() => setReactionMessage(null)}
        onReact={(reaction) => reactionMessage && reactToMessage(reactionMessage, reaction)}
      />
    </Screen>
  );
}

function ConversationCard({ conversation, selected, showCases, onPress, onSelectCase }: { conversation: any; selected: boolean; showCases: boolean; onPress: () => void; onSelectCase: (caseId: string) => void }) {
  const urgent = conversation.cases.some(isUrgentCase);
  const progress = conversation.cases[0]?.progress || 0;
  return (
    <Pressable onPress={onPress} style={[styles.conversationCard, conversation.unreadCount > 0 && styles.conversationCardUnread, selected && styles.conversationCardActive]}>
      <View style={[styles.conversationAccent, urgent ? styles.conversationAccentUrgent : conversation.unreadCount > 0 ? styles.conversationAccentUnread : null]} />
      <View style={styles.conversationTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{String(conversation.participantName || 'م').charAt(0)}</Text>
          <View style={styles.onlineDot} />
          {urgent ? <View style={styles.urgentDot}><Ionicons name="warning" size={9} color={colors.red} /></View> : null}
        </View>
        <View style={styles.flex}>
          <View style={styles.rowBetween}>
            <Text style={styles.timeText}>{conversation.lastMessage ? formatTime(conversation.lastMessage.createdAt) : formatDate(conversation.cases[0]?.createdAt)}</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>{conversation.participantName}</Text>
          </View>
          <Text style={styles.caseTitle} numberOfLines={1}>{conversation.cases[0]?.title}</Text>
          <View style={styles.conversationBadges}>
            <View style={[styles.miniBadge, urgent && styles.miniBadgeUrgent]}>
              <Ionicons name={urgent ? 'warning-outline' : 'folder-open-outline'} size={12} color={urgent ? colors.red : colors.navy} />
              <Text style={[styles.miniBadgeText, urgent && styles.miniBadgeTextUrgent]}>{conversation.cases.length.toLocaleString('ar-IQ')} قضية</Text>
            </View>
            {conversation.unreadCount > 0 ? (
              <View style={styles.miniBadgeUnread}>
                <Ionicons name="mail-unread-outline" size={12} color={colors.blue} />
                <Text style={styles.miniBadgeUnreadText}>جديد</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.previewText, conversation.unreadCount > 0 && styles.previewUnread]} numberOfLines={1}>
            {conversation.lastMessage?.text || conversation.cases[0]?.title}
          </Text>
          <View style={styles.conversationFooter}>
            <View style={styles.progressTiny}><View style={[styles.progressTinyFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.progressText}>{progress}%</Text>
            {conversation.unreadCount > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{conversation.unreadCount.toLocaleString('ar-IQ')}</Text></View> : null}
          </View>
        </View>
      </View>
      {showCases ? (
        <View style={styles.caseSummaryList}>
          {conversation.cases.map((item: any) => (
            <Pressable key={item.id} onPress={() => onSelectCase(item.id)} style={styles.caseSummaryItem}>
              <Pill label={item.statusText} tone={isUrgentCase(item) ? 'red' : 'blue'} />
              <Text style={styles.caseSummaryTitle} numberOfLines={1}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function MessageBubble({ message, isMe, participantName, onReact }: { message: any; isMe: boolean; participantName: string; onReact: () => void }) {
  const request = isRequestMessage(message.text);
  return (
    <View style={[styles.messageRow, isMe ? styles.messageRowMine : styles.messageRowOther]}>
      {!isMe ? (
        <View style={styles.messageAvatarMini}>
          <Text style={styles.messageAvatarText}>{String(participantName || 'م').charAt(0)}</Text>
        </View>
      ) : null}
      <View style={styles.messageStack}>
        {request && !isMe ? (
          <View style={styles.requestTag}>
            <Ionicons name="document-attach-outline" size={12} color={colors.gold} />
            <Text style={styles.requestTagText}>طلب مستند</Text>
          </View>
        ) : null}
        <View style={[styles.messageBubble, isMe ? styles.messageMine : request ? styles.messageRequest : styles.messageOther]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMine]}>{message.text}</Text>
          {message.deliveryState === 'failed' ? <Text style={styles.failedText}>فشل الإرسال</Text> : null}
          {!isMe ? (
            <Pressable onPress={onReact} style={styles.reactButton}>
              <Text style={styles.reactButtonText}>{message.reaction || 'تفاعل'}</Text>
            </Pressable>
          ) : null}
          {!isMe && message.reaction ? <Text style={styles.reactionBadge}>{message.reaction}</Text> : null}
        </View>
        <Text style={[styles.messageSeenText, isMe && styles.messageSeenMine]}>
          {isMe ? message.deliveryState === 'sending' ? 'جارٍ الإرسال...' : message.awaitingResponse ? 'تم الإرسال · بانتظار الرد' : 'تمت القراءة' : formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function ReactionModal({ message, onClose, onReact }: { message: any | null; onClose: () => void; onReact: (reaction: MessageReaction) => void }) {
  return (
    <Modal transparent animationType="fade" visible={Boolean(message)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.reactionPanel}>
          <Text style={styles.cardTitle}>اختر تفاعلاً</Text>
          <View style={styles.reactionRow}>
            {reactions.map((reaction) => (
              <Pressable key={reaction} onPress={() => onReact(reaction)} style={styles.reactionOption}>
                <Text style={styles.reactionEmoji}>{reaction}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="إغلاق" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function FilterChip({ active, label, count, onPress }: { active: boolean; label: string; count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <Text style={[styles.filterCount, active && styles.filterChipTextActive]}>{count.toLocaleString('ar-IQ')}</Text>
    </Pressable>
  );
}

function InboxStat({ label, value, tone }: { label: string; value: number; tone: 'red' | 'gold' | 'blue' }) {
  const toneStyle = tone === 'red' ? styles.statRed : tone === 'gold' ? styles.statGold : styles.statBlue;
  return (
    <View style={[styles.inboxStat, toneStyle]}>
      <Text style={styles.statValue}>{value.toLocaleString('ar-IQ')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CaseStat({ label, value, tone }: { label: string; value: string | number; tone?: 'gold' | 'green' }) {
  return (
    <View style={styles.caseStat}>
      <Text style={[styles.caseStatValue, tone === 'gold' && styles.goldText, tone === 'green' && styles.greenText]}>{typeof value === 'number' ? value.toLocaleString('ar-IQ') : value}</Text>
      <Text style={styles.caseStatLabel}>{label}</Text>
    </View>
  );
}

function buildConversations(cases: any[], viewerRole: string) {
  const map = new Map<string, any>();
  cases.forEach((item) => {
    const participantId = viewerRole === 'user' ? item.lawyer?.id || 'unknown-lawyer' : item.clientId || item.client || 'client';
    const participantName = viewerRole === 'user' ? item.lawyer?.name || 'المحامي المسؤول' : item.client || 'العميل';
    const participantRole = viewerRole === 'user' ? item.lawyer?.role || 'محامي' : 'عميل';
    const messages = [...(item.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const lastMessage = messages[messages.length - 1] || null;

    if (!map.has(participantId)) {
      map.set(participantId, {
        id: participantId,
        participantId,
        participantName,
        participantRole,
        cases: [],
        lastMessage: null,
        unreadCount: 0,
        lastSeen: 'الآن',
      });
    }

    const conversation = map.get(participantId);
    conversation.cases.push({ ...item, messages });
    conversation.unreadCount += item.unreadCount || 0;
    if (lastMessage && (!conversation.lastMessage || new Date(lastMessage.createdAt) > new Date(conversation.lastMessage.createdAt))) {
      conversation.lastMessage = lastMessage;
    }
  });

  return Array.from(map.values()).sort((left, right) => {
    if (left.unreadCount !== right.unreadCount) return right.unreadCount - left.unreadCount;
    return new Date(right.lastMessage?.createdAt || right.cases[0]?.createdAt || 0).getTime() - new Date(left.lastMessage?.createdAt || left.cases[0]?.createdAt || 0).getTime();
  });
}

function isUrgentCase(item: any) {
  return String(item?.statusText || '').includes('خطر') || String(item?.statusText || '').includes('عاجل');
}

function isWaitingCase(item: any) {
  const latestUserMessage = [...(item?.messages || [])].reverse().find((message: any) => message.sender === 'user');
  return Boolean(latestUserMessage?.awaitingResponse);
}

function isClosedCase(item: any) {
  const latestUserMessage = [...(item?.messages || [])].reverse().find((message: any) => message.sender === 'user');
  return Boolean(latestUserMessage && !latestUserMessage.awaitingResponse);
}

function isRequestMessage(text: string) {
  return ['يرجى', 'مستند', 'وثيقة', 'توقيع', 'إرسال', 'تزويدنا'].some((word) => String(text || '').includes(word));
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' });
}

function isSameDay(date1: Date, date2: Date) {
  return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
}

function dayLabel(date: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return 'اليوم';
  if (isSameDay(date, yesterday)) return 'أمس';
  return date.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  aiPanel: {
    backgroundColor: '#fff6df',
    borderColor: '#fedf89',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
  },
  aiText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'right',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  caseStat: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    flex: 1,
    padding: 10,
  },
  caseStats: {
    flexDirection: 'row-reverse',
    gap: 8,
    padding: 10,
  },
  caseStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'right',
  },
  caseStatValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  caseCompact: {
    backgroundColor: '#f8fafc',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  caseCompactPercent: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  caseCompactTextRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 6,
  },
  caseSummaryItem: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 8,
    padding: 8,
  },
  caseSummaryList: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 4,
  },
  caseSummaryTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  caseSwitch: {
    backgroundColor: '#eef2f6',
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 180,
    minHeight: 38,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  caseSwitchActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  caseSwitchRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  caseSwitchText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  caseSwitchTextActive: {
    color: '#fff',
  },
  caseTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'right',
  },
  clearSearch: {
    alignItems: 'center',
    backgroundColor: '#eef2f6',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  closedBox: {
    backgroundColor: '#e9f8ef',
    borderRadius: 16,
    marginVertical: 8,
    padding: 10,
  },
  closedText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  composer: {
    backgroundColor: '#fff',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  composerIconButton: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  composerIconButtonActive: {
    backgroundColor: colors.blue,
  },
  composerHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  composerLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  conversationAccent: {
    borderRadius: 999,
    bottom: 10,
    position: 'absolute',
    right: 0,
    top: 10,
    width: 4,
  },
  conversationAccentUnread: {
    backgroundColor: colors.blue,
  },
  conversationAccentUrgent: {
    backgroundColor: colors.red,
  },
  conversationCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 8,
    overflow: 'hidden',
    padding: 12,
    paddingRight: 16,
  },
  conversationCardActive: {
    backgroundColor: '#f7fbff',
  },
  conversationCardUnread: {
    backgroundColor: '#f7fbff',
  },
  conversationBadges: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  conversationFooter: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 8,
  },
  conversationTop: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 999,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  draftCount: {
    backgroundColor: '#eef2f6',
    borderRadius: 999,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    minWidth: 26,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    textAlign: 'center',
  },
  deliveryText: {
    color: '#dbeafe',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  failedText: {
    color: '#fecaca',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  emptyThread: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#f8fafc',
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 0,
    marginTop: 24,
    maxWidth: 310,
    padding: 18,
  },
  emptyThreadText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyThreadTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  filterChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  filterChipText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterCount: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 12,
  },
  flex: {
    flex: 1,
  },
  goldText: {
    color: colors.gold,
  },
  greenText: {
    color: colors.green,
  },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginBottom: 12,
    padding: 14,
  },
  heroAction: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconButtonSmall: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  inlineActions: {
    gap: 8,
    marginTop: 10,
  },
  inboxRail: {
    backgroundColor: '#fff',
    borderRadius: 18,
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
    padding: 8,
  },
  inboxStat: {
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  messageBubble: {
    borderRadius: 20,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageAvatarMini: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.navy,
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    marginBottom: 18,
    width: 28,
  },
  messageAvatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  messageInput: {
    backgroundColor: '#f2f4f7',
    borderRadius: 22,
    color: colors.ink,
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  messageMetaMine: {
    color: '#dbeafe',
  },
  messageMetaText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  messageMine: {
    backgroundColor: colors.blue,
  },
  messageOther: {
    backgroundColor: '#f2f4f7',
  },
  messageRequest: {
    backgroundColor: '#fff6df',
    borderRadius: 20,
    borderColor: '#fedf89',
    borderWidth: 1,
  },
  messageRow: {
    gap: 7,
    marginVertical: 3,
  },
  messageRowMine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  messageRowOther: {
    alignItems: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messagesContent: {
    flexGrow: 1,
    padding: 12,
  },
  messagesList: {
    flex: 1,
  },
  messageText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'right',
  },
  messageTextMine: {
    color: '#fff',
  },
  messageSeenMine: {
    textAlign: 'left',
  },
  messageSeenText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginHorizontal: 8,
    marginTop: 3,
    textAlign: 'right',
  },
  messageStack: {
    maxWidth: '78%',
  },
  miniBadge: {
    alignItems: 'center',
    backgroundColor: '#eef2f6',
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniBadgeText: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
  },
  miniBadgeTextUrgent: {
    color: colors.red,
  },
  miniBadgeUnread: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniBadgeUnreadText: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: '900',
  },
  miniBadgeUrgent: {
    backgroundColor: '#fff1f0',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 24, 40, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  onlineDot: {
    backgroundColor: colors.green,
    borderColor: '#fff',
    borderRadius: 999,
    borderWidth: 2,
    bottom: -1,
    height: 13,
    position: 'absolute',
    right: -1,
    width: 13,
  },
  previewText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  previewUnread: {
    color: colors.blue,
    fontWeight: '900',
  },
  progressText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  progressTiny: {
    backgroundColor: '#eef2f6',
    borderRadius: 999,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
  progressTinyFill: {
    backgroundColor: colors.gold,
    height: '100%',
  },
  quickPrompt: {
    backgroundColor: '#f2f4f7',
    borderRadius: 999,
    maxWidth: 250,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickPromptText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  quickRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 8,
  },
  reactButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reactButtonText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  reactionBadge: {
    bottom: -12,
    fontSize: 18,
    position: 'absolute',
    right: 12,
  },
  reactionEmoji: {
    fontSize: 26,
  },
  reactionOption: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  reactionPanel: {
    backgroundColor: colors.paper,
    borderRadius: 22,
    padding: 16,
    width: '88%',
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 14,
  },
  requestTag: {
    alignItems: 'center',
    backgroundColor: '#fff6df',
    borderColor: '#fedf89',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  requestTagText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    textAlign: 'right',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  smartDraft: {
    backgroundColor: '#fff6df',
    borderColor: '#fedf89',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
  },
  statBlue: {
    backgroundColor: '#eff6ff',
  },
  statGold: {
    backgroundColor: '#fff6df',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'right',
  },
  statRed: {
    backgroundColor: '#fff1f0',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
  },
  statValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  status: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  statusError: {
    color: colors.red,
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#f2f4f7',
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'right',
  },
  threadHeader: {
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  threadMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
  threadName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  threadActionButton: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  threadActions: {
    gap: 7,
  },
  threadAvatar: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  threadAvatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  threadDetailsPanel: {
    backgroundColor: '#fff',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingTop: 4,
  },
  threadOnlineDot: {
    backgroundColor: colors.green,
    borderColor: '#fff',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 0,
    height: 13,
    position: 'absolute',
    right: 0,
    width: 13,
  },
  threadProgress: {
    marginTop: 9,
  },
  threadProgressFill: {
    backgroundColor: colors.gold,
    height: '100%',
  },
  threadProgressText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'right',
  },
  threadProgressTrack: {
    backgroundColor: '#eef2f6',
    borderRadius: 999,
    height: 7,
    overflow: 'hidden',
  },
  threadScreen: {
    backgroundColor: '#fff',
    borderRadius: 22,
    flex: 1,
    overflow: 'hidden',
  },
  threadTitleRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
  },
  threadUnreadDot: {
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  timeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  toggle: {
    backgroundColor: '#eef2f6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toggleActive: {
    backgroundColor: colors.navy,
  },
  toggleText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  toggleTextActive: {
    color: '#fff',
  },
  toolChip: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 999,
    flexDirection: 'row-reverse',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  toolText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  trayClose: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  urgentBox: {
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderColor: '#fecdca',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    margin: 10,
    padding: 10,
  },
  urgentDot: {
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderRadius: 999,
    bottom: -3,
    height: 18,
    justifyContent: 'center',
    left: -3,
    position: 'absolute',
    width: 18,
  },
  urgentText: {
    color: colors.red,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
});
