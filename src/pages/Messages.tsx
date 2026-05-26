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

const UPLOAD_MESSAGE_MARKERS = ['وثيقة جديدة:', 'مستند جديد:'];
const MESSAGE_REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'] as const;

type MessageReaction = typeof MESSAGE_REACTION_OPTIONS[number];

const buildAvatarUrl = (name: string, image?: string | null, background = '1A237E') => {
  return image || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=${background}&color=ffffff&rounded=true`;
};

type MessageDeliveryState = 'sending' | 'failed';
type SmartComposerTool = 'brief' | 'next' | 'documents' | 'polish' | 'risk';

type MessageItem = {
  id: string | number;
  sender: 'user' | 'lawyer';
  text: string;
  awaitingResponse?: boolean;
  reaction?: MessageReaction | null;
  createdAt: Date;
  deliveryState?: MessageDeliveryState;
  uploadProgress?: number;
};

type WorkspaceCase = {
  id: string;
  title: string;
  statusText: string;
  progress: number;
  createdAt: Date;
  unreadCount?: number;
  lawyer: {
    id?: string;
    name: string;
    role: string;
    img: string;
  };
  client: string;
  clientId: string;
  clientImg?: string;
  messages: MessageItem[];
  documents: LegalDocument[];
};

type DocumentType = 'pdf' | 'image' | 'other';

interface LegalDocument {
  id: string;
  name: string;
  size: string;
  createdAt: Date;
  type: DocumentType;
  folderId: string | null;
  actionRequired: string | null;
  expiresAt?: string | null;
  expiresText?: string | null;
  previewUrl?: string;
  fileUrl?: string;
  isSigned?: boolean;
  isUploading?: boolean;
  progress?: number;
  tags?: string[];
  uploadedAt?: string;
}

function getFileIconClass(type: DocumentType): string {
  return type === 'pdf' ? 'fa-file-pdf' : type === 'image' ? 'fa-file-image' : 'fa-file';
}

type Conversation = {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  participantImg: string;
  cases: WorkspaceCase[];
  lastMessage: MessageItem | null;
  unreadCount: number;
  lastSeen?: string;
};

type ConversationFilter = 'all' | 'unread' | 'urgent' | 'waiting' | 'closed';

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

function getUploadedFileNameFromMessage(text: string): string | null {
  const marker = UPLOAD_MESSAGE_MARKERS.find((entry) => text.includes(entry));
  return marker ? text.split(marker).pop()?.trim() || null : null;
}

function useSelectedLawyerId() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get('lawyerId') ?? '', [location.search]);
}

function useSelectedCaseId() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get('caseId') ?? '', [location.search]);
}

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const selectedLawyerIdFromQuery = useSelectedLawyerId();
  const selectedCaseIdFromQuery = useSelectedCaseId();
  const [cases, setCases] = useState<WorkspaceCase[]>([]);
  const [query, setQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [draft, setDraft] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true); // New state for loading skeleton
  const [replyModalDoc, setReplyModalDoc] = useState<LegalDocument | null>(null);
  const [activePreviewDoc, setActivePreviewDoc] = useState<LegalDocument | null>(null);
  const [activeCaseId, setActiveCaseId] = useState('');
  const [showCaseSummary, setShowCaseSummary] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isChatHeightExpanded, setIsChatHeightExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<MessageItem | null>(null);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLawyerTyping, setIsLawyerTyping] = useState(false);
  const [isAiConsulting, setIsAiConsulting] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiDeskOpen, setIsAiDeskOpen] = useState(false);
  const [smartDraftPreview, setSmartDraftPreview] = useState<{ title: string; text: string } | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploads = useRef<Map<string | number, XMLHttpRequest>>(new Map());

  const getProgressColor = useCallback((p: number) => {
    // Linear interpolation between Amber (245, 158, 11) and Green (34, 197, 94)
    const r = Math.round(245 + (34 - 245) * (p / 100));
    const g = Math.round(158 + (197 - 158) * (p / 100));
    const b = Math.round(11 + (94 - 11) * (p / 100));
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  const getDayLabel = useCallback((date: Date) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (isSameDay(date, now)) return 'اليوم';
    if (isSameDay(date, yesterday)) return 'أمس';
    return formatDate(date);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Show button if we are more than 300px away from the bottom
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowJumpToBottom(isScrolledUp);
  }, []);

  const jumpToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

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

  const inboxStats = useMemo(() => {
    const unread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
    const urgent = conversations.filter((conversation) =>
      conversation.cases.some((item) => item.statusText?.includes('خطر') || item.statusText?.includes('عاجل')),
    ).length;
    const waiting = conversations.filter((conversation) =>
      conversation.cases.some((item) => {
        const latestUserMessage = [...item.messages].reverse().find((message) => message.sender === 'user');
        return latestUserMessage?.awaitingResponse;
      }),
    ).length;

    return { unread, urgent, waiting };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        conversation.participantName.toLowerCase().includes(normalizedQuery) ||
        conversation.cases.some((item) => item.title.toLowerCase().includes(normalizedQuery));
      const matchesFilter =
        conversationFilter === 'all' ||
        (conversationFilter === 'unread' && conversation.unreadCount > 0) ||
        (conversationFilter === 'urgent' && conversation.cases.some((item) => item.statusText?.includes('خطر') || item.statusText?.includes('عاجل'))) ||
        (conversationFilter === 'waiting' && conversation.cases.some((item) => {
          const latestUserMessage = [...item.messages].reverse().find((message) => message.sender === 'user');
          return latestUserMessage?.awaitingResponse;
        })) ||
        (conversationFilter === 'closed' && conversation.cases.some((item) => {
          const latestUserMessage = [...item.messages].reverse().find((message) => message.sender === 'user');
          return latestUserMessage && !latestUserMessage.awaitingResponse;
        }));

      return matchesQuery && matchesFilter;
    });
  }, [conversationFilter, conversations, query]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedConversationId) ||
    conversations.find((conversation) => conversation.id === selectedConversationId) ||
    null;

  const selectedCase = useMemo(() => {
    if (!selectedConversation) return null;
    return selectedConversation.cases.find(c => c.id === activeCaseId) || selectedConversation.cases[0] || null;
  }, [selectedConversation, activeCaseId]);

  const threadMessages = useMemo(() => {
    return selectedCase?.messages || ([] as MessageItem[]);
  }, [selectedCase]);

  const latestClientMessage = [...threadMessages].reverse().find((message) => message.sender === 'user') || null;
  const draftLength = draft.trim().length;
  const isConversationClosed = latestClientMessage ? (Boolean(latestClientMessage) && !latestClientMessage.awaitingResponse) : false;
  const conversationHealthLabel = isConversationClosed ? 'المحادثة مغلقة' : latestClientMessage?.awaitingResponse ? (viewerRole === 'user' ? 'بانتظار رد المحامي' : 'بانتظار رد العميل') : 'المحادثة محدثة';
  const isUrgent = selectedCase?.statusText?.includes('خطر') || selectedCase?.statusText?.includes('عاجل');
  const quickMessagePrompts = viewerRole === 'lawyer' ? LAWYER_QUICK_MESSAGE_PROMPTS : USER_QUICK_MESSAGE_PROMPTS;
  const composerPlaceholder = isConversationClosed
    ? 'تم إغلاق هذه المحادثة من جهة المحامي.'
    : viewerRole === 'lawyer'
      ? 'اكتب ردك للعميل هنا...'
      : 'اكتب رسالتك أو استفسارك هنا...';
  const selectedCaseDocumentsNeedingAction = selectedCase?.documents.filter((doc) => doc.actionRequired || doc.expiresAt).length ?? 0;
  const selectedCaseSignedDocuments = selectedCase?.documents.filter((doc) => doc.isSigned).length ?? 0;
  const viewerName = user?.name || (viewerRole === 'lawyer' ? 'محامي' : 'مستخدم');
  const viewerAvatar = buildAvatarUrl(viewerName, user?.img || user?.avatar);

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
              message.reaction === currentMessage?.reaction &&
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
          selectedLawyerIdFromQuery && grouped.some((c) => c.participantId === selectedLawyerIdFromQuery)
            ? grouped.find((c) => c.participantId === selectedLawyerIdFromQuery)?.id || ''
            : grouped[0]?.id || '';
        setSelectedConversationId(preferred);

        const initialConv = grouped.find(c => c.id === preferred);
        if (initialConv) {
          const preferredCaseId =
            selectedCaseIdFromQuery && initialConv.cases.some((item) => item.id === selectedCaseIdFromQuery)
              ? selectedCaseIdFromQuery
              : initialConv.cases[0]?.id || '';
          setActiveCaseId(preferredCaseId);
        }
      }
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      if (isInitial) setIsLoadingConversations(false); // Set loading false after initial fetch
    }
  }, [mergeCasesWithPendingMessages, selectedCaseIdFromQuery, selectedLawyerIdFromQuery, viewerRole]);

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
    if (selectedCase && (selectedCase.unreadCount ?? 0) > 0) {
      markConversationMessagesAsRead(selectedCase.id);
    }
  }, [selectedCase, markConversationMessagesAsRead]);

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
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
                  createdAt: new Date(), // Update timestamp on retry/failure
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
        createdAt: new Date(),
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

  const handleAskAI = useCallback(async () => {
    if (!draft.trim() || !selectedCase) return;

    setIsAiConsulting(true);
    setAiResponse('');

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('lexigate_token');
      const response = await fetch('/api/legal/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: draft.trim(),
          tone: 'formal',
          topK: 3
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        // Simple SSE parsing for the demo
        const lines = chunk.split('\n');
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.chunk) setAiResponse(prev => (prev || '') + data.chunk);
            } catch (e) { }
          }
        });
      }
    } catch (error) {
      console.error('AI Consultation failed:', error);
    } finally {
      setIsAiConsulting(false);
    }
  }, [draft, selectedCase]);

  const handleSmartComposerTool = useCallback((tool: SmartComposerTool) => {
    if (!selectedCase) return;

    const lastMessage = threadMessages[threadMessages.length - 1];
    const pendingDocs = selectedCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt);
    const signedDocs = selectedCase.documents.filter((doc) => doc.isSigned).length;
    const progressLine = `القضية "${selectedCase.title}" حالياً ${selectedCase.progress}% وحالتها ${selectedCase.statusText}.`;

    if (tool === 'polish') {
      if (draft.trim()) {
        handleAskAI();
      } else {
        setAiResponse('اكتب مسودة قصيرة أولاً، ثم استخدم أداة الصياغة لتحويلها إلى رد قانوني واضح ومهني.');
      }
      return;
    }

    if (tool === 'brief') {
      setAiResponse([
        progressLine,
        `الوثائق: ${selectedCase.documents.length.toLocaleString('ar-IQ')} إجمالاً، ${signedDocs.toLocaleString('ar-IQ')} موقعة، ${pendingDocs.length.toLocaleString('ar-IQ')} تحتاج متابعة.`,
        lastMessage ? `آخر رسالة: ${lastMessage.sender === viewerRole ? 'أنت' : selectedConversation?.participantName || 'الطرف الآخر'} - ${lastMessage.text}` : 'لا توجد رسائل مسجلة بعد.',
      ].join('\n'));
      return;
    }

    if (tool === 'next') {
      const nextText = pendingDocs.length > 0
        ? viewerRole === 'lawyer'
          ? `مرحباً ${selectedCase.client}،\nالخطوة التالية هي مراجعة المستندات المطلوبة، وأهمها: ${pendingDocs[0].name}.\nيرجى تزويدي بالتحديث أو الإجراء المطلوب حتى نكمل ملف ${selectedCase.title}.`
          : `أستاذي، ما هي الخطوة التالية بخصوص ${pendingDocs[0].name} في قضية ${selectedCase.title}؟ وهل توجد مدة محددة يجب الالتزام بها؟`
        : viewerRole === 'lawyer'
          ? `مرحباً ${selectedCase.client}،\nراجعت ملف ${selectedCase.title}. الخطوة التالية هي متابعة الإجراء الحالي وسأوافيك بأي تحديث مهم.`
          : `أستاذي، هل يمكن تزويدي بالخطوة التالية المتوقعة في قضية ${selectedCase.title}؟`;
      setSmartDraftPreview({ title: 'مسودة الخطوة التالية', text: nextText });
      return;
    }

    if (tool === 'documents') {
      const documentText = viewerRole === 'lawyer'
        ? `مرحباً ${selectedCase.client}،\nيرجى تزويدي بالمستندات الناقصة أو الداعمة لقضية ${selectedCase.title}${pendingDocs[0] ? `، خصوصاً: ${pendingDocs[0].name}` : ''}.\nشكراً لتعاونكم.`
        : `أستاذي، هل توجد مستندات إضافية مطلوبة مني الآن لقضية ${selectedCase.title}؟ أرجو تحديدها بالاسم حتى أرفعها بشكل صحيح.`;
      setSmartDraftPreview({ title: 'مسودة طلب مستندات', text: documentText });
      return;
    }

    setAiResponse([
      'فحص ذكي سريع:',
      pendingDocs.length > 0 ? `يوجد ${pendingDocs.length.toLocaleString('ar-IQ')} مستند يحتاج متابعة.` : 'لا توجد مستندات معلقة حسب البيانات الحالية.',
      latestClientMessage?.awaitingResponse ? 'توجد رسالة من العميل بانتظار رد واضح.' : 'لا تظهر رسالة معلقة تحتاج رداً فورياً.',
      isUrgent ? 'حالة القضية تحمل إشارة عاجلة، الأفضل إبقاء الرد مختصراً ومحدد الخطوة.' : 'لا تظهر إشارة عاجلة حالياً.',
    ].join('\n'));
  }, [draft, handleAskAI, isUrgent, latestClientMessage?.awaitingResponse, selectedCase, selectedConversation?.participantName, threadMessages, viewerRole]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCase) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      alert('حجم الملف يتجاوز الحد المسموح به (5 ميجابايت). يرجى اختيار ملف أصغر.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const tempMsgId = `upload-${Date.now()}`;
    const senderName = viewerRole === 'lawyer' ? 'المحامي' : 'العميل';
    const msgText = `رفع ${senderName} وثيقة جديدة: ${file.name}`;

    // Add optimistic upload message
    appendOptimisticMessage(selectedCase.id, {
      id: tempMsgId,
      sender: viewerRole,
      text: msgText,
      createdAt: new Date(),
      uploadProgress: 0,
      deliveryState: 'sending'
    });

    const formData = new FormData();
    formData.append('file', file);

    setIsSending(true);
    const xhr = new XMLHttpRequest();
    activeUploads.current.set(tempMsgId, xhr);
    const token = localStorage.getItem('auth_token') || localStorage.getItem('lexigate_token');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setCases(current => current.map(c =>
          c.id === selectedCase.id
            ? { ...c, messages: c.messages.map(m => m.id === tempMsgId ? { ...m, uploadProgress: percent } : m) }
            : c
        ));
      }
    };

    xhr.onload = () => {
      activeUploads.current.delete(tempMsgId);
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText);
        if (result.data) replaceCaseInState(result.data);
      } else {
        updateMessageDeliveryState(selectedCase.id, tempMsgId, 'failed');
      }
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    xhr.onerror = () => {
      activeUploads.current.delete(tempMsgId);
      updateMessageDeliveryState(selectedCase.id, tempMsgId, 'failed');
      setIsSending(false);
    };

    xhr.onabort = () => {
      activeUploads.current.delete(tempMsgId);
      updateMessageDeliveryState(selectedCase.id, tempMsgId, 'failed');
      setIsSending(false);
    };

    xhr.open('POST', `/api/app/workspace/cases/${selectedCase.id}/documents/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  };

  const handleCancelUpload = useCallback((messageId: string | number) => {
    const xhr = activeUploads.current.get(messageId);
    if (xhr) {
      xhr.abort();
    }
  }, []);

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

  const handleSelectMessageReaction = useCallback(async (message: MessageItem, reaction: MessageReaction) => {
    if (!selectedCase || message.sender === viewerRole || message.deliveryState) {
      return;
    }

    const previousReaction = message.reaction ?? null;
    const nextReaction = previousReaction === reaction ? null : reaction;
    setActiveReactionPicker(null);

    setCases((current) =>
      current.map((item) =>
        item.id === selectedCase.id
          ? {
            ...item,
            messages: item.messages.map((currentMessage) =>
              currentMessage.id === message.id
                ? { ...currentMessage, reaction: nextReaction }
                : currentMessage,
            ),
          }
          : item,
      ),
    );

    try {
      const response = await apiClient.reactToCaseMessage(selectedCase.id, String(message.id), nextReaction);
      if (response.data) {
        replaceCaseInState(response.data);
      } else {
        await loadCases(false);
      }
    } catch (error) {
      console.error('Failed to update message reaction:', error);
      setCases((current) =>
        current.map((item) =>
          item.id === selectedCase.id
            ? {
              ...item,
              messages: item.messages.map((currentMessage) =>
                currentMessage.id === message.id
                  ? { ...currentMessage, reaction: previousReaction }
                  : currentMessage,
              ),
            }
            : item,
        ),
      );
    }
  }, [loadCases, replaceCaseInState, selectedCase, viewerRole]);

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
    setActiveReactionPicker(null);
    setSmartDraftPreview(null);
  }, [selectedCase?.id]);

  useEffect(() => {
    setActivePreviewDoc(null);
  }, [selectedCase?.id]);

  return (
    <div className="app-view fade-in mx-auto max-w-[1500px] pb-4 text-right">
      {conversations.length > 0 ? (
        <section className={`grid overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-premium ${isChatHeightExpanded ? 'xl:h-[calc(100vh-96px)] xl:min-h-[820px]' : 'xl:h-[calc(100vh-126px)] xl:min-h-[700px]'} ${isChatExpanded ? 'xl:grid-cols-[minmax(0,1fr)]' : selectedConversation && selectedCase ? 'xl:grid-cols-[340px_minmax(0,1fr)_320px]' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}`}>
          {!isChatExpanded && (
            <aside className="flex max-h-[720px] flex-col overflow-hidden border-b border-slate-200 bg-white xl:max-h-none xl:border-b-0 xl:border-l">
              <div className="border-b border-slate-100 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      title="رسالة جديدة"
                    >
                      <i className="fa-solid fa-pen-to-square text-sm"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversationFilter('unread')}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      title="غير المقروءة"
                    >
                      <i className="fa-regular fa-bell text-sm"></i>
                    </button>
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-950">الدردشات</h1>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">
                      {inboxStats.unread.toLocaleString('ar-IQ')} غير مقروءة
                    </p>
                  </div>
                </div>
                <div className="relative">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث عن محامٍ أو قضية"
                  className="w-full rounded-full border border-transparent bg-slate-100 px-4 py-3 pl-11 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
                <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {([
                  { id: 'all', label: 'الكل', count: conversations.length },
                  { id: 'unread', label: 'غير مقروء', count: conversations.filter((item) => item.unreadCount > 0).length },
                  { id: 'urgent', label: 'عاجل', count: inboxStats.urgent },
                  { id: 'waiting', label: viewerRole === 'lawyer' ? 'بانتظارك' : 'بانتظار المحامي', count: inboxStats.waiting },
                  {
                    id: 'closed', label: 'مغلقة', count: conversations.filter((conversation) => conversation.cases.some((item) => {
                      const latestUserMessage = [...item.messages].reverse().find((message) => message.sender === 'user');
                      return latestUserMessage && !latestUserMessage.awaitingResponse;
                    })).length
                  },
                ] as Array<{ id: ConversationFilter; label: string; count: number }>).map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setConversationFilter(filter.id)}
                    className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black transition ${conversationFilter === filter.id ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}
                  >
                    {filter.label}
                    <span className="mr-1 rounded-full bg-white/20 px-1.5 py-0.5">{filter.count.toLocaleString('ar-IQ')}</span>
                  </button>
                ))}
              </div>
              </div>

              {viewerRole === 'lawyer' && (
                <div className="mx-4 mt-3 flex items-center justify-between px-1">
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

              <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar p-2">
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
                      className={`w-full rounded-2xl border p-3 text-right transition-all duration-200 ${selectedConversation?.id === conversation.id
                        ? 'border-blue-100 bg-blue-50 shadow-sm'
                        : 'border-transparent hover:bg-slate-50'}`}
                    >
                      <div className="flex flex-row-reverse items-start gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={conversation.participantImg}
                            alt={conversation.participantName}
                            className="h-12 w-12 rounded-full object-cover shadow-sm cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/profile/${conversation.participantId}`);
                            }}
                          />
                          {conversation.cases.some(c => c.statusText?.includes('خطر') || c.statusText?.includes('عاجل')) && (
                            <span
                              className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full bg-red-50 text-[8px] flex items-center justify-center text-red-500 border border-red-100 shadow-sm"
                              title="قضية عاجلة"
                            ><i className="fa-solid fa-triangle-exclamation"></i></span>
                          )}
                          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"></span>
                        </div>
                        <div className="min-w-0 flex-1 text-right">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {conversation.lastMessage ? formatTime(conversation.lastMessage.createdAt) : conversation.cases[0] ? formatDate(conversation.cases[0].createdAt) : ''}
                            </span>
                            <p className={`truncate text-sm font-black ${conversation.unreadCount > 0 ? 'text-slate-950' : 'text-slate-700'}`}>{conversation.participantName}</p>
                          </div>
                          <div className="mt-0.5 flex flex-row-reverse items-center gap-2">
                            <div className="relative h-4 w-4 shrink-0">
                              <svg className="h-full w-full" viewBox="0 0 36 36">
                                <circle className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="transparent" r="16" cx="18" cy="18" />
                                <circle
                                  style={{ stroke: getProgressColor(conversation.cases[0]?.progress || 0) }}
                                  className="transition-all duration-1000"
                                  strokeWidth="4"
                                  strokeDasharray={`${conversation.cases[0]?.progress}, 100`}
                                  strokeLinecap="round"
                                  fill="transparent"
                                  r="16" cx="18" cy="18"
                                  transform="rotate(-90 18 18)" />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[5px] font-black text-slate-500">{conversation.cases[0]?.progress}%</span>
                            </div>
                            <p className="truncate text-[11px] font-bold text-slate-400">{conversation.cases[0]?.title}</p>
                          </div>
                          <p className={`mt-1 truncate text-xs font-medium ${conversation.unreadCount > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                            {conversation.lastMessage?.text || conversation.cases[0]?.title}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <span className="mt-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
                              {conversation.unreadCount.toLocaleString('ar-IQ')}
                            </span>
                          )}
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
                              <div className="flex flex-row-reverse items-center gap-2">
                                <div className="relative h-7 w-7 shrink-0">
                                  <svg className="h-full w-full" viewBox="0 0 36 36">
                                    <circle className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="transparent" r="16" cx="18" cy="18" />
                                    <circle
                                      style={{ stroke: getProgressColor(c.progress || 0) }}
                                      className="transition-all duration-1000"
                                      strokeWidth="3"
                                      strokeDasharray={`${c.progress}, 100`}
                                      strokeLinecap="round"
                                      fill="transparent"
                                      r="16" cx="18" cy="18"
                                      transform="rotate(-90 18 18)" />
                                  </svg>
                                  <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-slate-500">{c.progress}%</span>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-slate-700 truncate max-w-[100px]">{c.title}</p>
                                  <p className="text-slate-400 mt-0.5">{formatDate(c.createdAt)}</p>
                                </div>
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
          )}

          <section className="relative flex min-h-[680px] flex-col overflow-hidden bg-white xl:min-h-0">
            <AnimatePresence>
              {showJumpToBottom && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  onClick={jumpToBottom}
                  className="absolute bottom-40 left-8 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-brand-navy text-white shadow-2xl ring-4 ring-white transition hover:bg-brand-dark active:scale-95 md:bottom-44"
                  title="انتقال للأسفل"
                >
                  <i className="fa-solid fa-chevron-down text-lg"></i>
                </motion.button>
              )}
            </AnimatePresence>

            {selectedConversation && selectedCase ? (
              <>
                <div className="border-b border-slate-100 bg-white px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div
                      className={`flex items-center gap-3 ${viewerRole === 'user' ? 'cursor-pointer group/participant' : ''}`}
                      onClick={() => viewerRole === 'user' && navigate(`/profile/${selectedConversation.participantId}`)}
                    >
                      <div className="relative">
                        <img src={selectedConversation.participantImg} alt={selectedConversation.participantName} className="h-11 w-11 rounded-full object-cover shadow-sm" />
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"></span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <h2 className={`text-base font-black text-slate-950 ${viewerRole === 'user' ? 'group-hover/participant:text-blue-600 transition-colors' : ''}`}>
                            {selectedConversation.participantName}
                          </h2>
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-slate-500 flex items-center justify-end gap-1.5">
                          <span>{selectedConversation.participantRole}</span>
                          <span className="h-0.5 w-0.5 rounded-full bg-slate-300"></span>
                          <span className="text-slate-400 font-medium">آخر ظهور: {selectedConversation.lastSeen || 'الآن'}</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
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
                      <button
                        type="button"
                        onClick={() => setIsChatExpanded((current) => !current)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${isChatExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        title={isChatExpanded ? 'إرجاع عرض المحادثة' : 'توسيع مساحة المحادثة'}
                      >
                        <i className={`fa-solid ${isChatExpanded ? 'fa-compress' : 'fa-expand'} text-sm`}></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsChatHeightExpanded((current) => !current)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${isChatHeightExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        title={isChatHeightExpanded ? 'إرجاع ارتفاع المحادثة' : 'توسيع ارتفاع المحادثة'}
                      >
                        <i className={`fa-solid ${isChatHeightExpanded ? 'fa-down-left-and-up-right-to-center' : 'fa-up-right-and-down-left-from-center'} text-sm`}></i>
                      </button>
                      <button onClick={() => navigate('/cases', { state: { activeCaseId: selectedCase.id } })} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-blue-600" title="ملف القضية">
                        <i className="fa-solid fa-folder-open text-sm"></i>
                      </button>
                      <button onClick={() => navigate('/cases', { state: { activeCaseId: selectedCase.id, focusArea: 'docs' } })} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-blue-600" title="المرفقات">
                        <i className="fa-solid fa-paperclip text-sm"></i>
                      </button>
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

                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400">تقدم القضية</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${selectedCase.progress}%`, backgroundColor: getProgressColor(selectedCase.progress) }}
                          ></div>
                        </div>
                        <span className="text-xs font-black text-brand-dark">{selectedCase.progress}%</span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400">الوثائق</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{selectedCase.documents.length.toLocaleString('ar-IQ')}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400">مطلوب إجراء</p>
                      <p className={`mt-1 text-sm font-black ${selectedCaseDocumentsNeedingAction > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {selectedCaseDocumentsNeedingAction.toLocaleString('ar-IQ')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400">موقعة</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{selectedCaseSignedDocuments.toLocaleString('ar-IQ')}</p>
                    </div>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-white p-4 md:p-6"
                >
                  {threadMessages.map((message, index) => {
                    const isMe = message.sender === viewerRole;
                    const msgDate = new Date(message.createdAt);
                    const prevMsg = threadMessages[index - 1];
                    const showDateSeparator = !prevMsg || !isSameDay(new Date(prevMsg.createdAt), msgDate);

                    const attachedFileName = getUploadedFileNameFromMessage(message.text);
                    const attachedDoc = attachedFileName ? selectedCase?.documents.find(d => d.name === attachedFileName) : null;

                    return (
                      <React.Fragment key={message.id}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-6">
                            <span className="rounded-full bg-slate-100 px-4 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              {getDayLabel(msgDate)}
                            </span>
                          </div>
                        )}
                        <div className="max-w-4xl mx-auto w-full">
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-end gap-2 ${isMe ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`flex items-end gap-2 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                              <img
                                src={isMe ? viewerAvatar : selectedConversation.participantImg}
                                alt={isMe ? 'أنت' : selectedConversation.participantName}
                                onError={(event) => {
                                  event.currentTarget.src = buildAvatarUrl(isMe ? viewerName : selectedConversation.participantName, null);
                                }}
                                className="h-8 w-8 shrink-0 rounded-full border border-white object-cover shadow-sm"
                              />
                              <div className={`relative max-w-[88%] rounded-[1.35rem] px-4 py-2.5 text-right md:max-w-[72%] md:px-4 group ${!isMe && message.reaction ? 'mb-4' : ''} ${isMe
                                ? 'bg-blue-600 text-white rounded-bl-md'
                                : isRequestMessage(message.text)
                                  ? 'bg-amber-50 border border-amber-100 text-slate-800 rounded-br-md'
                                  : 'bg-slate-100 text-slate-800 rounded-br-md'
                                }`}
                              >
                                <div className={`mb-2 flex items-center justify-between gap-3 text-[10px] font-black ${isMe ? 'text-white/55' : 'text-slate-400'}`}>
                                  <span>{formatTime(message.createdAt)}</span>
                                  <span>{isMe ? 'أنت' : selectedConversation.participantName}</span>
                                </div>
                                <button
                                  onClick={() => navigator.clipboard.writeText(message.text)}
                                  className={`absolute top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 opacity-0 shadow-sm transition hover:text-brand-navy group-hover:opacity-100 ${isMe ? 'left-2' : 'right-2'}`}
                                  title="نسخ النص"
                                >
                                  <i className="fa-regular fa-copy text-xs"></i>
                                </button>
                                {isMe && (
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className={`absolute top-10 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 opacity-0 shadow-sm transition hover:text-red-500 group-hover:opacity-100 ${isMe ? 'left-2' : 'right-2'}`}
                                    title="حذف الرسالة"
                                  >
                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                  </button>
                                )}
                                {!isMe && (
                                  <button
                                    type="button"
                                    onClick={() => handleReplyToMessage(message)}
                                    className="absolute right-2 top-10 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 opacity-0 shadow-sm transition hover:text-brand-navy group-hover:opacity-100"
                                    title={viewerRole === 'lawyer' ? 'الرد على العميل' : 'الرد على المحامي'}
                                  >
                                    <i className="fa-solid fa-reply text-xs"></i>
                                  </button>
                                )}
                                {!isMe && (
                                  <div className="absolute left-2 top-2 z-20">
                                    <button
                                      type="button"
                                      onClick={() => setActiveReactionPicker((current) => current === message.id ? null : message.id)}
                                      className={`flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 shadow-sm transition hover:text-brand-navy ${activeReactionPicker === message.id ? 'opacity-100 ring-2 ring-blue-100' : 'opacity-0 group-hover:opacity-100'}`}
                                      title="إضافة تفاعل"
                                      aria-expanded={activeReactionPicker === message.id}
                                    >
                                      <i className="fa-regular fa-face-smile text-xs"></i>
                                    </button>
                                    <AnimatePresence>
                                      {activeReactionPicker === message.id && (
                                        <motion.div
                                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                          animate={{ opacity: 1, y: 0, scale: 1 }}
                                          exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                          className="absolute left-0 top-9 flex items-center gap-1 rounded-full border border-slate-100 bg-white p-1.5 shadow-2xl"
                                          dir="ltr"
                                        >
                                          {MESSAGE_REACTION_OPTIONS.map((reaction) => (
                                            <button
                                              key={reaction}
                                              type="button"
                                              onClick={() => handleSelectMessageReaction(message, reaction)}
                                              className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:-translate-y-0.5 hover:bg-slate-100 ${message.reaction === reaction ? 'bg-blue-50 ring-2 ring-blue-100' : ''}`}
                                              title={message.reaction === reaction ? 'إزالة التفاعل' : 'اختيار التفاعل'}
                                            >
                                              {reaction}
                                            </button>
                                          ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}
                                {message.uploadProgress !== undefined && (
                                  <div className="mt-3 mb-2 space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-black">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleCancelUpload(message.id)}
                                          className={`hover:text-red-500 transition-colors ${isMe ? 'text-white/50' : 'text-slate-400'}`}
                                          title="إلغاء رفع الوثيقة"
                                        >
                                          <i className="fa-solid fa-circle-xmark"></i>
                                        </button>
                                        <span className={isMe ? 'text-white/70' : 'text-slate-400'}>{message.uploadProgress}%</span>
                                      </div>
                                      <span className={isMe ? 'text-white/70' : 'text-slate-400'}>جارٍ رفع الوثيقة</span>
                                    </div>
                                    <div className={`h-1.5 w-full rounded-full overflow-hidden ${isMe ? 'bg-white/20' : 'bg-slate-100 shadow-inner'}`}>
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${message.uploadProgress}%` }}
                                        className={`h-full rounded-full ${isMe ? 'bg-brand-gold' : 'bg-brand-navy'}`}
                                      />
                                    </div>
                                  </div>
                                )}
                                <p className="text-[14px] md:text-[15px] font-medium leading-relaxed">{message.text}</p>

                                {attachedDoc && (
                                  <div
                                    className={`mt-3 p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-slate-50 border-slate-100 hover:border-brand-navy/30'}`}
                                  >
                                    <div
                                      onClick={() => setActivePreviewDoc(attachedDoc)}
                                      className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 group/file"
                                    >
                                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95 ${isMe ? 'bg-white/10' : 'bg-white shadow-sm'} ${attachedDoc.type === 'pdf' ? 'text-red-500' : 'text-blue-500'}`}>
                                        <i className={`fa-solid ${getFileIconClass(attachedDoc.type)} text-base`}></i>
                                      </div>
                                      <div className="text-right min-w-0">
                                        <p className={`text-[11px] font-black truncate group-hover/file:underline ${isMe ? 'text-white' : 'text-brand-dark'}`}>{attachedDoc.name}</p>
                                        <p className={`text-[9px] font-bold ${isMe ? 'text-white/60' : 'text-slate-400'}`}>{attachedDoc.size}</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => setActivePreviewDoc(attachedDoc)}
                                        className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all shadow-sm ${isMe ? 'bg-white/10 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-400 hover:text-brand-navy'}`}
                                        title="معاينة فورية"
                                      >
                                        <i className="fa-solid fa-eye text-[10px]"></i>
                                      </button>
                                      <a
                                        href={attachedDoc.previewUrl || attachedDoc.fileUrl || '#'}
                                        download={attachedDoc.name}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all shadow-sm ${isMe ? 'bg-white text-brand-navy hover:bg-brand-gold' : 'bg-brand-navy text-white hover:bg-brand-dark'}`}
                                        title="تنزيل الملف"
                                      >
                                        <i className="fa-solid fa-download text-[10px]"></i>
                                      </a>
                                    </div>
                                  </div>
                                )}

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
                                <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[9px] font-black uppercase ${isMe ? 'text-white/50' : 'text-slate-400'}`}>
                                  <span>{message.deliveryState === 'sending' ? 'جارٍ المزامنة' : 'تمت المزامنة'}</span>
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
                                {!isMe && message.reaction && (
                                  <div className="absolute -bottom-4 left-4 flex h-7 min-w-8 items-center justify-center rounded-full border border-white bg-white px-2 text-base shadow-sm">
                                    {message.reaction}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </React.Fragment>
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

                <div className="border-t border-slate-100 bg-white p-3 md:p-4">
                  <div className="max-w-4xl mx-auto w-full">
                    <div className="rounded-[1.35rem] bg-white">
                      <AnimatePresence>
                        {aiResponse && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="mb-4 p-4 rounded-2xl bg-brand-gold/5 border border-brand-gold/20 text-right shadow-sm relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-1 h-full bg-brand-gold opacity-50"></div>
                            <div className="flex items-center justify-between mb-2">
                              <button onClick={() => setAiResponse(null)} className="text-slate-400 hover:text-red-500 transition"><i className="fa-solid fa-times text-xs"></i></button>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest">اقتراح المساعد الذكي</span>
                                <i className="fa-solid fa-robot text-brand-gold text-xs"></i>
                              </div>
                            </div>
                            <div className="text-xs font-bold text-slate-700 leading-relaxed mb-3 whitespace-pre-wrap">{aiResponse}</div>
                            <div className="flex justify-start gap-2">
                              <button
                                onClick={() => { setDraft(aiResponse); setAiResponse(null); }}
                                className="text-[10px] font-black bg-brand-gold text-brand-dark px-3 py-1.5 rounded-lg hover:bg-yellow-500 transition shadow-sm"
                              >
                                استخدام الرد
                              </button>
                              <button
                                onClick={() => { setDraft(prev => prev + '\n\n' + aiResponse); setAiResponse(null); }}
                                className="text-[10px] font-black bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
                              >
                                إلحاق بالمسودة
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

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
                      <div className="rounded-[1.4rem] bg-slate-100 p-2 focus-within:ring-4 focus-within:ring-blue-50">
                        <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex flex-col gap-3 p-2.5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-center justify-end gap-2">
                              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 sm:inline-flex">
                                {selectedCaseDocumentsNeedingAction.toLocaleString('ar-IQ')} إجراء
                              </span>
                              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 sm:inline-flex">
                                {selectedCaseSignedDocuments.toLocaleString('ar-IQ')} موقعة
                              </span>
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white shadow-sm">
                                <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                              </div>
                              <div className="min-w-0 text-right">
                                <p className="text-xs font-black text-brand-dark">AI Desk</p>
                                <p className="truncate text-[10px] font-bold text-slate-400">{conversationHealthLabel}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 lg:justify-end">
                              {!isAiDeskOpen && smartDraftPreview && (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                                  مسودة جاهزة
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setIsAiDeskOpen((current) => !current)}
                                className="flex h-9 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 text-[10px] font-black text-slate-600 transition hover:bg-white hover:text-brand-navy"
                                aria-expanded={isAiDeskOpen}
                              >
                                {isAiDeskOpen ? 'إخفاء الأدوات' : 'فتح الأدوات'}
                                <i className={`fa-solid fa-chevron-down text-[9px] transition ${isAiDeskOpen ? 'rotate-180' : ''}`}></i>
                              </button>
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {isAiDeskOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-slate-100"
                              >
                                <div className="flex min-w-0 items-center gap-2 overflow-x-auto p-2.5 no-scrollbar lg:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSmartComposerTool('polish')}
                                    disabled={isConversationClosed || isAiConsulting}
                                    className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-brand-navy px-3 text-[10px] font-black text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {isAiConsulting ? (
                                      <span className="h-3 w-3 rounded-full border-2 border-white/70 border-t-transparent animate-spin"></span>
                                    ) : (
                                      <i className="fa-solid fa-pen-nib"></i>
                                    )}
                                    صياغة احترافية
                                  </button>
                                  {[
                                    { id: 'brief' as const, label: 'ملخص', icon: 'fa-align-right' },
                                    { id: 'next' as const, label: 'خطوة', icon: 'fa-route' },
                                    { id: 'documents' as const, label: 'مستندات', icon: 'fa-file-circle-plus' },
                                    { id: 'risk' as const, label: 'فحص', icon: 'fa-shield-halved' },
                                  ].map((tool) => (
                                    <button
                                      key={tool.id}
                                      type="button"
                                      title={tool.label}
                                      onClick={() => handleSmartComposerTool(tool.id)}
                                      disabled={isConversationClosed}
                                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 text-[10px] font-black text-slate-600 transition hover:border-brand-navy/10 hover:bg-brand-navy/5 hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <i className={`fa-solid ${tool.icon}`}></i>
                                      {tool.label}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <AnimatePresence>
                          {smartDraftPreview && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 8 }}
                              className="mb-2 rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-right shadow-sm"
                            >
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => setSmartDraftPreview(null)}
                                  className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-black text-slate-400 transition hover:text-red-500"
                                >
                                  تجاهل
                                </button>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-amber-800">{smartDraftPreview.title}</p>
                                  <p className="mt-1 line-clamp-2 text-xs font-bold leading-6 text-amber-900/80">{smartDraftPreview.text}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap justify-start gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingToMessage(null);
                                    setDraft(smartDraftPreview.text);
                                    setSmartDraftPreview(null);
                                    textareaRef.current?.focus();
                                  }}
                                  className="rounded-xl bg-brand-navy px-3 py-2 text-[10px] font-black text-white transition hover:bg-brand-dark"
                                >
                                  استخدام
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingToMessage(null);
                                    setDraft((current) => current ? `${current}\n\n${smartDraftPreview.text}` : smartDraftPreview.text);
                                    setSmartDraftPreview(null);
                                    textareaRef.current?.focus();
                                  }}
                                  className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-brand-navy ring-1 ring-amber-100 transition hover:bg-amber-50"
                                >
                                  إلحاق
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/70 bg-white/80 p-2 shadow-sm">
                          <div className="flex shrink-0 items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-600">
                            <i className="fa-solid fa-bolt text-[9px]"></i>
                            ردود سريعة
                          </div>
                          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar">
                            {quickMessagePrompts.map((prompt) => (
                              <button
                                key={prompt}
                                type="button"
                                title={prompt}
                                onClick={() => {
                                  setReplyingToMessage(null);
                                  setDraft(prompt);
                                }}
                                disabled={isConversationClosed}
                                className="max-w-[240px] shrink-0 truncate rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-600 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                          <span className="hidden shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-400 sm:inline-flex">
                            {draftLength.toLocaleString('ar-IQ')} حرف
                          </span>
                        </div>
                        {replyingToMessage && (
                          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-brand-navy/10 bg-slate-50 px-4 py-3 text-right">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">
                                {viewerRole === 'lawyer' ? 'الرد على رسالة العميل' : 'الرد على رسالة المحامي'}
                              </p>
                              <p className="mt-1 truncate text-xs font-bold text-slate-500">{replyingToMessage.text}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setReplyingToMessage(null)}
                              className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-black text-slate-400 transition hover:text-red-500"
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
                          className="max-h-24 min-h-10 w-full resize-none overflow-y-auto rounded-xl border-0 bg-transparent px-3 py-1.5 text-[14px] font-medium leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                        />

                        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isSending || isConversationClosed}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue-600 transition hover:bg-blue-50 disabled:opacity-40"
                              title="إرفاق وثيقة"
                            >
                              <i className="fa-solid fa-paperclip text-sm"></i>
                            </button>
                            <span className="flex h-9 items-center rounded-full bg-white px-3 text-[10px] font-black text-slate-400">
                              {draftLength.toLocaleString('ar-IQ')} حرف
                            </span>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            {draft.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft('');
                                  setReplyingToMessage(null);
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 transition hover:text-red-500"
                                title="مسح المسودة"
                              >
                                <i className="fa-solid fa-trash-can text-sm"></i>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleSend}
                              disabled={!draft.trim() || isSending || isConversationClosed}
                              className="flex h-9 min-w-24 items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-[11px] font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:opacity-30"
                            >
                              <i className="fa-solid fa-paper-plane text-sm"></i>
                              إرسال
                            </button>
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

          {!isChatExpanded && selectedConversation && selectedCase && (
            <aside className="flex max-h-[720px] flex-col overflow-hidden border-t border-slate-200 bg-white p-4 xl:max-h-none xl:border-r xl:border-t-0">
              <div className="border-b border-slate-100 pb-5 text-center">
                <img
                  src={selectedConversation.participantImg}
                  alt={selectedConversation.participantName}
                  className="mx-auto h-20 w-20 rounded-full object-cover shadow-sm"
                />
                <h3 className="mt-3 truncate text-lg font-black text-slate-950">{selectedConversation.participantName}</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">{selectedConversation.participantRole}</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => viewerRole === 'user' && navigate(`/profile/${selectedConversation.participantId}`)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-blue-600"
                    title="الملف الشخصي"
                  >
                    <i className="fa-regular fa-user text-sm"></i>
                  </button>
                  <button
                    onClick={() => navigate('/cases', { state: { activeCaseId: selectedCase.id } })}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-blue-600"
                    title="القضية"
                  >
                    <i className="fa-solid fa-folder-open text-sm"></i>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isConversationClosed}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-blue-600 disabled:opacity-40"
                    title="إرفاق ملف"
                  >
                    <i className="fa-solid fa-paperclip text-sm"></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-4">
                <h3 className="text-sm font-black text-slate-950">الملفات والوسائط</h3>
                <button
                  onClick={() => navigate(`/cases`, { state: { activeCaseId: selectedCase.id, focusArea: 'docs' } })}
                  className="text-slate-400 hover:text-blue-600 transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
                  title="عرض كل الوثائق"
                >
                  <i className="fa-solid fa-folder-open"></i>
                </button>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-100 px-3 py-3 text-center">
                  <p className="text-[9px] font-black text-slate-400">الكل</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{selectedCase.documents.length.toLocaleString('ar-IQ')}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-3 py-3 text-center">
                  <p className="text-[9px] font-black text-amber-700">مطلوب</p>
                  <p className="mt-1 text-sm font-black text-amber-800">{selectedCaseDocumentsNeedingAction.toLocaleString('ar-IQ')}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-center">
                  <p className="text-[9px] font-black text-emerald-700">موقعة</p>
                  <p className="mt-1 text-sm font-black text-emerald-800">{selectedCaseSignedDocuments.toLocaleString('ar-IQ')}</p>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto">
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
                      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-3 text-right transition hover:bg-slate-100"
                    >
                      <div className={`text-xl ${doc.type === 'pdf' ? 'text-red-500' : doc.type === 'image' ? 'text-blue-500' : 'text-gray-500'}`}>
                        <i className={`fa-solid ${getFileIconClass(doc.type)}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-brand-dark truncate">{doc.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{doc.size} • {formatDate(doc.createdAt)}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-400">
                        معاينة
                      </span>
                      {doc.actionRequired && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDocReply(doc);
                          }}
                          className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-600 transition hover:bg-amber-100"
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
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{activePreviewDoc.size} • {formatDate(activePreviewDoc.createdAt)}</p>
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

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
    </div>
  );
}

function buildConversations(cases: WorkspaceCase[], viewerRole: string): Conversation[] {
  const grouped = new Map<string, Conversation>();

  cases.forEach((item) => {
    let participantId: string;
    let participantName: string;
    let participantRole: string;
    let participantImg: string;

    if (viewerRole === 'user') {
      participantId = item.lawyer.id || 'unknown-lawyer'; // Fallback for safety
      participantName = item.lawyer.name;
      participantRole = item.lawyer.role;
      participantImg = buildAvatarUrl(item.lawyer.name, item.lawyer.img, '0d2a59');
    } else { // viewerRole === 'lawyer'
      participantId = item.clientId;
      participantName = item.client;
      participantRole = 'عميل'; // Assuming client role is always 'عميل'
      participantImg = buildAvatarUrl(item.client, item.clientImg, '0d2a59');
    }

    const existing = grouped.get(participantId);
    const sortedMessages = [...(item.messages || [])];
    const lastMessage = sortedMessages[sortedMessages.length - 1] || null;

    if (existing) {
      existing.cases.push(item);
      existing.unreadCount += item.unreadCount || 0;
      if (!existing.lastMessage || (lastMessage && new Date(lastMessage.createdAt) > new Date(existing.lastMessage.createdAt))) {
        existing.lastMessage = lastMessage;
      }
      existing.cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return;
    }

    grouped.set(participantId, {
      id: participantId,
      participantId,
      participantName,
      participantRole,
      participantImg,
      cases: [item],
      lastMessage,
      unreadCount: item.unreadCount || 0,
      lastSeen: 'منذ ٥ دقائق',
    });
  });

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.unreadCount !== right.unreadCount) return right.unreadCount - left.unreadCount;
    const leftLastMessageTime = left.lastMessage ? new Date(left.lastMessage.createdAt).getTime() : 0;
    const rightLastMessageTime = right.lastMessage ? new Date(right.lastMessage.createdAt).getTime() : 0;
    return rightLastMessageTime - leftLastMessageTime;
  });
}
