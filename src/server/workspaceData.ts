import { prisma } from './prisma';

const DEFAULT_AI_RESPONSE = 'تم توليد ملخص أولي للحالة، راجع المستندات والرسائل الأخيرة قبل مشاركة الصياغة النهائية.';

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat('ar-IQ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatShortDateLabel(date: Date) {
  return new Intl.DateTimeFormat('ar-IQ', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatRelativeTime(date: Date) {
  return formatDateLabel(date);
}

function getCaseAgeInfo(createdAt: Date) {
  const ageMs = Math.max(0, Date.now() - createdAt.getTime());
  const totalMinutes = Math.floor(ageMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const label = days > 0
    ? `${days.toLocaleString('ar-IQ')} يوم${hours ? ` و${hours.toLocaleString('ar-IQ')} ساعة` : ''}`
    : hours > 0
      ? `${hours.toLocaleString('ar-IQ')} ساعة${minutes ? ` و${minutes.toLocaleString('ar-IQ')} دقيقة` : ''}`
      : `${Math.max(1, minutes).toLocaleString('ar-IQ')} دقيقة`;

  return {
    startedAt: createdAt.toISOString(),
    startedAtLabel: formatDateLabel(createdAt),
    ageMinutes: totalMinutes,
    ageLabel: label,
  };
}

function formatCurrencyAmount(amount: number) {
  return `${amount.toLocaleString('en-US')} د.ع`;
}

function parseCurrencyAmount(value?: string | null) {
  const normalized = String(value || '').replace(/[^\d.]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hoursSince(value?: Date | string | null) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
}

function buildSmartCaseAlerts(item: any, sortedMessages: any[]) {
  const alerts: Array<{
    id: string;
    type: 'response' | 'document' | 'payment' | 'hearing';
    severity: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    action: string;
    tab: 'chat' | 'summary' | 'financials';
    createdAt: string;
  }> = [];
  const now = new Date().toISOString();
  const latestUserMessage = [...sortedMessages].reverse().find((message: any) => message.senderRole !== 'lawyer');
  const latestLawyerMessage = [...sortedMessages].reverse().find((message: any) => message.senderRole === 'lawyer');

  if (
    latestUserMessage?.createdAt &&
    latestUserMessage.awaitingResponse &&
    (!latestLawyerMessage || latestLawyerMessage.createdAt < latestUserMessage.createdAt)
  ) {
    const waitingHours = Math.round(hoursSince(latestUserMessage.createdAt));
    if (waitingHours >= 24) {
      alerts.push({
        id: `${item.id}-lawyer-response-delay`,
        type: 'response',
        severity: 'high',
        title: 'تأخر رد المحامي',
        message: `هذه القضية لم يرد عليها المحامي منذ ${waitingHours.toLocaleString('ar-IQ')} ساعة.`,
        action: 'راجع المحادثة أو أرسل تذكيراً مختصراً.',
        tab: 'chat',
        createdAt: now,
      });
    }
  }

  const documentsNeedingAction = item.documents.filter((doc: any) => doc.actionRequired || (doc.expiresAt && !doc.isSigned));
  if (documentsNeedingAction.length > 0) {
    alerts.push({
      id: `${item.id}-missing-document-action`,
      type: 'document',
      severity: 'high',
      title: 'يوجد مستند ناقص',
      message: `${documentsNeedingAction.length.toLocaleString('ar-IQ')} مستند يحتاج توقيعاً أو إجراءً قبل استمرار القضية.`,
      action: 'انتقل إلى الوثائق وأكمل المطلوب.',
      tab: 'summary',
      createdAt: now,
    });
  } else if (item.documents.length === 0 && item.status !== 'closed') {
    alerts.push({
      id: `${item.id}-no-documents`,
      type: 'document',
      severity: 'medium',
      title: 'لا توجد وثائق مرفوعة',
      message: 'إضافة وصل، عقد، وكالة، أو محادثات تزيد فرصة التقييم القانوني السريع.',
      action: 'ارفع أول مستند مرتبط بالقضية.',
      tab: 'summary',
      createdAt: now,
    });
  }

  const pendingInvoice = item.invoices.find((invoice: any) => invoice.status !== 'paid');
  const remainingBalance = Math.max(0, Number(item.totalAgreedFee || 0) - Number(item.paidAmount || 0));
  if (pendingInvoice || remainingBalance > 0) {
    alerts.push({
      id: `${item.id}-payment-due`,
      type: 'payment',
      severity: pendingInvoice ? 'medium' : 'low',
      title: 'اقترب موعد دفعة',
      message: pendingInvoice
        ? `توجد دفعة معلقة بقيمة ${pendingInvoice.amount}.`
        : `المتبقي من الأتعاب ${formatCurrencyAmount(remainingBalance)}.`,
      action: 'راجع المالية وخطة الدفع.',
      tab: 'financials',
      createdAt: now,
    });
  }

  const hearingEntry = [...item.timelineEntries].reverse().find((entry: any) => entry.type === 'hearing' || entry.type === 'meeting');
  if (hearingEntry && item.status !== 'closed') {
    alerts.push({
      id: `${item.id}-upcoming-hearing`,
      type: 'hearing',
      severity: 'medium',
      title: hearingEntry.type === 'hearing' ? 'اقترب موعد جلسة' : 'اقترب موعد اجتماع',
      message: `${hearingEntry.title}: ${hearingEntry.dateLabel}.`,
      action: 'راجع الخط الزمني وجهز المستندات اللازمة.',
      tab: 'summary',
      createdAt: now,
    });
  }

  const severityRank = { high: 3, medium: 2, low: 1 };
  return alerts.sort((left, right) => severityRank[right.severity] - severityRank[left.severity]).slice(0, 5);
}

function buildCaseRiskProfile(item: any, sortedMessages: any[]) {
  const pendingDocuments = item.documents.filter((doc: any) => doc.actionRequired || (doc.expiresAt && !doc.isSigned));
  const pendingInvoices = item.invoices.filter((invoice: any) => invoice.status !== 'paid');
  const remainingBalance = Math.max(0, Number(item.totalAgreedFee || 0) - Number(item.paidAmount || 0));
  const latestAwaitingMessage = [...sortedMessages].reverse().find((message: any) => message.awaitingResponse);
  const waitingHours = latestAwaitingMessage ? Math.round(hoursSince(latestAwaitingMessage.createdAt)) : 0;

  const score = item.status === 'closed'
    ? 0
    : Math.min(
        100,
        (pendingDocuments.length ? Math.min(35, pendingDocuments.length * 12) : 0) +
          (item.unreadCount ? Math.min(20, item.unreadCount * 5) : 0) +
          (pendingInvoices.length || remainingBalance > 0 ? 15 : 0) +
          (item.documents.length === 0 ? 14 : 0) +
          (waitingHours >= 24 ? 16 : waitingHours >= 8 ? 8 : 0) +
          (item.progress < 25 ? 8 : 0),
      );

  const level = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';
  const reasons = [
    pendingDocuments.length ? `${pendingDocuments.length.toLocaleString('ar-IQ')} وثائق تحتاج إجراء` : null,
    item.unreadCount ? `${item.unreadCount.toLocaleString('ar-IQ')} رسائل غير مقروءة` : null,
    pendingInvoices.length || remainingBalance > 0 ? 'دفعة أو رصيد يحتاج مراجعة' : null,
    item.documents.length === 0 && item.status !== 'closed' ? 'لا توجد وثائق مرفوعة' : null,
    waitingHours >= 8 ? `رسالة بانتظار متابعة منذ ${waitingHours.toLocaleString('ar-IQ')} ساعة` : null,
  ].filter(Boolean);

  return {
    score,
    level,
    label: level === 'high' ? 'مخاطر عالية' : level === 'medium' ? 'مخاطر متوسطة' : 'مخاطر منخفضة',
    reasons,
    nextAction: pendingDocuments[0]
      ? `ابدأ بمتابعة ${pendingDocuments[0].name}`
      : item.unreadCount
        ? 'اقرأ آخر الرسائل وحدد الرد المطلوب'
        : pendingInvoices.length || remainingBalance > 0
          ? 'راجع المدفوعات قبل الإجراء التالي'
          : 'تابع الملف دورياً ولا توجد إشارة حرجة',
  };
}

function mapCaseStatus(status: string): 'pending' | 'review' | 'active' | 'closed' {
  if (status === 'closed') return 'closed';
  if (status === 'review') return 'review';
  if (status === 'active') return 'active';
  return 'pending';
}

function mapCaseStatusText(status: string) {
  if (status === 'closed') return 'مكتملة';
  if (status === 'review') return 'قيد المراجعة';
  if (status === 'active') return 'نشطة';
  return 'قيد الانتظار';
}

function buildCaseStatusInsight(item: any, risk: ReturnType<typeof buildCaseRiskProfile>, sortedMessages: any[]) {
  const pendingDocuments = item.documents.filter((doc: any) => doc.actionRequired || (doc.expiresAt && !doc.isSigned)).length;
  const remainingBalance = Math.max(0, Number(item.totalAgreedFee || 0) - Number(item.paidAmount || 0));
  const latestAwaitingMessage = [...sortedMessages].reverse().find((message: any) => message.awaitingResponse);
  const readyToClose = item.status !== 'closed' && item.progress >= 80 && pendingDocuments === 0 && remainingBalance === 0;

  if (item.status === 'closed') {
    return { label: 'مغلقة ومؤرشفة للمتابعة', tone: 'success', icon: 'fa-circle-check', detail: 'اكتملت القضية ويمكن طلب تقييم التجربة.' };
  }
  if (risk.level === 'high') {
    return { label: 'عالية الخطورة', tone: 'danger', icon: 'fa-shield-halved', detail: risk.nextAction };
  }
  if ((item.unreadCount || 0) > 0) {
    return { label: 'بانتظار قراءة رسالة', tone: 'info', icon: 'fa-comments', detail: `${item.unreadCount.toLocaleString('ar-IQ')} رسائل غير مقروءة.` };
  }
  if (pendingDocuments > 0) {
    return { label: 'تحتاج وثائق', tone: 'warning', icon: 'fa-file-circle-exclamation', detail: `${pendingDocuments.toLocaleString('ar-IQ')} وثائق تحتاج إجراء.` };
  }
  if (remainingBalance > 0) {
    return { label: 'بانتظار تسوية مالية', tone: 'warning', icon: 'fa-wallet', detail: `${remainingBalance.toLocaleString('ar-IQ')} د.ع متبقية.` };
  }
  if (readyToClose) {
    return { label: 'جاهزة للإغلاق', tone: 'success', icon: 'fa-lock', detail: 'كل المؤشرات الأساسية جاهزة للمراجعة النهائية.' };
  }
  if (latestAwaitingMessage) {
    return { label: 'بانتظار رد', tone: 'neutral', icon: 'fa-clock', detail: 'توجد رسالة بانتظار متابعة.' };
  }
  if (item.status === 'review') {
    return { label: 'قيد مراجعة المحامي', tone: 'warning', icon: 'fa-magnifying-glass-chart', detail: 'الملف في مرحلة التحقق والمراجعة.' };
  }
  if (item.status === 'active') {
    return { label: 'نشطة ضمن التنفيذ', tone: 'active', icon: 'fa-route', detail: 'القضية تتحرك ضمن المسار التشغيلي.' };
  }
  return { label: 'بانتظار البداية', tone: 'info', icon: 'fa-hourglass-start', detail: 'الملف مفتوح وينتظر أول إجراء واضح.' };
}

function mapDocType(type: string): 'pdf' | 'image' | 'other' {
  if (type.toLowerCase().includes('pdf')) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'image', 'صورة'].some((entry) => type.toLowerCase().includes(entry))) return 'image';
  return 'other';
}

const workspaceCaseSelect = {
  id: true,
  title: true,
  matter: true,
  status: true,
  progress: true,
  riskScore: true,
  isArchived: true,
  totalAgreedFee: true,
  paidAmount: true,
  unreadCount: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
      img: true,
      location: true,
    },
  },
  lawyer: {
    select: {
      id: true,
      name: true,
      img: true,
      roleDescription: true,
      lawyerProfile: {
        select: {
          specialty: true,
          avatar: true,
        },
      },
    },
  },
  documents: {
    select: {
      id: true,
      name: true,
      size: true,
      type: true,
      folderId: true,
      actionRequired: true,
      expiresAt: true,
      expiresText: true,
      previewUrl: true,
      fileUrl: true,
      isSigned: true,
      tags: true,
      createdAt: true,
    },
  },
  folders: {
    select: {
      id: true,
      name: true,
    },
  },
  customFields: {
    select: {
      id: true,
      label: true,
      value: true,
    },
  },
  timelineEntries: {
    select: {
      id: true,
      dateLabel: true,
      title: true,
      detail: true,
      type: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  collaborators: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      img: true,
      lastSeen: true,
    },
  },
  accessLogs: {
    select: {
      id: true,
      userName: true,
      action: true,
      timeLabel: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  chatSessions: {
    select: {
      id: true,
      messages: {
        select: {
          id: true,
          senderRole: true,
          text: true,
          awaitingResponse: true,
          reaction: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
  invoices: {
    select: {
      id: true,
      amount: true,
      dateLabel: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

async function ensureCaseSession(caseId: string, userId: string) {
  const existing = await prisma.chatSession.findFirst({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) return existing;

  return prisma.chatSession.create({
    data: { caseId, userId },
  });
}

async function getLatestClientMessage(caseId: string) {
  return prisma.message.findFirst({
    where: {
      senderRole: 'user',
      session: { caseId },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      awaitingResponse: true,
    },
  });
}

export function mapWorkspaceCase(item: any) {
  const sortedMessages = item.chatSessions
    .flatMap((session: any) =>
      session.messages.map((message: any) => ({
        ...message,
        _createdAt: message.createdAt,
      })),
    )
    .sort((left: any, right: any) => left._createdAt.getTime() - right._createdAt.getTime());

  const smartAlerts = buildSmartCaseAlerts(item, sortedMessages);
  const risk = buildCaseRiskProfile(item, sortedMessages);
  const statusInsight = buildCaseStatusInsight(item, risk, sortedMessages);
  const lifecycle = getCaseAgeInfo(item.createdAt);

  return {
    client: item.client.name,
    id: item.id,
    clientId: item.client.id,
    clientImg: item.client.img || '',
    lawyerId: item.lawyer.id,
    title: item.title,
    matter: item.matter,
    lawyer: {
      id: item.lawyer.id,
      name: item.lawyer.name,
      role: item.lawyer.roleDescription || item.lawyer.lawyerProfile?.specialty || 'محامٍ',
      img: item.lawyer.img || item.lawyer.lawyerProfile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.lawyer.name)}&background=0d2a59&color=ffffff`,
    },
    status: mapCaseStatus(item.status),
    statusText: mapCaseStatusText(item.status),
    statusInsight,
    progress: item.progress,
    createdAt: item.createdAt, // Changed to return Date object
    lifecycle,
    unreadCount: item.unreadCount,
    smartAlerts,
    risk,
    customFields: item.customFields.map((field: any) => ({
      id: field.id,
      label: field.label,
      value: field.value,
    })),
    folders: item.folders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
    })),
    documents: item.documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      date: formatShortDateLabel(doc.createdAt),
      type: mapDocType(doc.type),
      folderId: doc.folderId,
      actionRequired: doc.actionRequired || null,
      expiresAt: doc.expiresAt,
      expiresText: doc.expiresText,
      previewUrl: doc.previewUrl || doc.fileUrl,
      isSigned: doc.isSigned,
      tags: parseJsonArray(doc.tags),
      uploadedAt: doc.createdAt.toISOString(),
    })),
    aiConsultations: item.timelineEntries.slice(0, 1).map((entry: any) => ({
      id: `ai-${entry.id}`,
      title: `خلاصة ${item.title}`,
      date: entry.dateLabel,
      excerpt: DEFAULT_AI_RESPONSE,
    })),
    messages: sortedMessages.map((message: any) => ({
      id: message.id,
      sender: message.senderRole === 'lawyer' ? 'lawyer' : 'user',
      text: message.text,
      awaitingResponse: message.awaitingResponse,
      reaction: message.reaction,
      createdAt: message.createdAt, // Changed to return Date object
    })),
    timeline: item.timelineEntries.map((entry: any) => ({
      id: entry.id,
      date: entry.dateLabel,
      title: entry.title,
      detail: entry.detail,
      type: entry.type,
    })),
    financials: {
      totalAgreed: item.totalAgreedFee,
      paid: item.paidAmount,
      invoices: item.invoices.map((invoice: any) => ({
        id: invoice.id,
        amount: Number(invoice.amount.replace(/[^\d.]/g, '') || 0),
        date: invoice.dateLabel,
        status: invoice.status === 'paid' ? 'paid' : 'pending',
      })),
    },
    isArchived: item.isArchived,
    collaborators: item.collaborators.map((collab: any) => ({
      id: collab.id,
      name: collab.name,
      email: collab.email,
      role: collab.role,
      permissions: collab.permissions,
      img: collab.img,
      lastSeen: collab.lastSeen,
    })),
    accessLogs: item.accessLogs.map((log: any) => ({
      id: log.id,
      userName: log.userName,
      action: log.action,
      time: log.timeLabel,
    })),
  };
}

export async function getClientWorkspace(userId: string) {
  const cases = await prisma.case.findMany({
    where: { clientId: userId },
    select: workspaceCaseSelect,
    orderBy: { updatedAt: 'desc' },
  } as any);

  return cases.map(mapWorkspaceCase);
}

export async function getLawyerWorkspace(userId: string) {
  const cases = await prisma.case.findMany({
    where: { lawyerId: userId },
    select: workspaceCaseSelect,
    orderBy: { updatedAt: 'desc' },
  } as any);

  return cases.map(mapWorkspaceCase);
}

export async function createClientCase(userId: string, payload: { title: string; matter: string; lawyerId: string; totalAgreedFee?: number; caseType?: string; }) {
  const assignedLawyer = await prisma.user.findFirst({
    where: {
      id: payload.lawyerId,
      role: { in: ['pro', 'admin'] },
    },
    select: { id: true },
  });

  if (!assignedLawyer) {
    throw new Error('المحامي المحدد غير صالح.');
  }

  const created = await prisma.case.create({
    data: {
      title: payload.title,
      matter: payload.matter,
      clientId: userId,
      lawyerId: payload.lawyerId,
      status: 'pending',
      totalAgreedFee: payload.totalAgreedFee || 0,
      paidAmount: 0,
      unreadCount: 1,
      customFields: payload.caseType ? {
        create: [{ label: 'نوع القضية', value: payload.caseType }],
      } : undefined,
      timelineEntries: {
        create: [{
          dateLabel: 'اليوم',
          title: 'فتح الملف',
          detail: `تم إنشاء ملف القضية الجديد.`,
          type: 'system',
        }],
      },
      accessLogs: {
        create: [{
          userName: 'أنت (المالك)',
          action: 'إنشاء ملف جديد',
          timeLabel: 'الآن',
        }],
      },
    },
    include: {
      client: true,
      lawyer: { include: { lawyerProfile: true } },
      documents: true,
      folders: true,
      customFields: true,
      timelineEntries: true,
      collaborators: true,
      accessLogs: true,
      chatSessions: { include: { messages: true } },
      invoices: true,
    },
  } as any);

  await ensureCaseSession(created.id, userId);
  return getCaseWorkspace(created.id);
}

export async function saveDraftContract(
  userId: string,
  payload: {
    contractText: string;
    sellerName: string;
    buyerName: string;
    carModel: string;
    vinNumber: string;
    price: string;
    currency: string;
    sellerSignature?: string;
    buyerSignature?: string;
    status?: string;
  },
  draftId?: string, // To update an existing draft
) {
  const data = {
    title: `مسودة عقد: ${payload.carModel}`,
    matter: 'عقد بيع مركبة',
    clientId: userId,
    lawyerId: userId, // Placeholder, can be updated later
    status: payload.status || 'pending', // 'pending' for draft
    privateNote: JSON.stringify(payload),
    progress: 0,
  };

  if (draftId) {
    return prisma.case.update({
      where: { id: draftId },
      data: data,
    });
  } else {
    return prisma.case.create({ data: data });
  }
}

/**
 * Finalizes a contract by updating metadata and creating a formal document entry
 */
export async function finalizeContract(
  contractId: string,
  payload: {
    pdfUrl: string;
    sellerSignature: string;
    buyerSignature: string;
    location?: { lat: number; lng: number } | null;
    selfie?: string | null;
  },
) {
  const contract = await prisma.case.findUnique({ where: { id: contractId } });
  if (!contract) throw new Error('Contract not found');

  const privateNote = JSON.parse(contract.privateNote || '{}');
  const updatedPrivateNote = {
    ...privateNote,
    pdfUrl: payload.pdfUrl,
    sellerSignature: payload.sellerSignature,
    buyerSignature: payload.buyerSignature,
    finalizedAt: new Date().toISOString(),
    finalizedLocation: payload.location,
    buyerSelfie: payload.selfie,
    status: 'signed'
  };

  return prisma.case.update({
    where: { id: contractId },
    data: {
      status: 'active',
      privateNote: JSON.stringify(updatedPrivateNote),
      progress: 100,
      documents: {
        create: {
          name: `عقد_موقع_${updatedPrivateNote.carModel || 'مركبة'}.pdf`,
          fileUrl: payload.pdfUrl,
          type: 'pdf',
          size: '1.5 MB',
          status: 'Signed',
          isSigned: true,
          tags: JSON.stringify(['contract', 'auto_sale'])
        }
      }
    }
  });
}

export async function startLawyerConsultation(
  userId: string,
  payload: {
    lawyerId: string;
    paymentMethod: string;
    note?: string;
  },
) {
  const lawyer = await prisma.user.findFirst({
    where: {
      id: payload.lawyerId,
      role: { in: ['pro', 'admin'] },
    },
    select: {
      id: true,
      name: true,
      lawyerProfile: {
        select: {
          consultationFee: true,
          specialty: true,
        },
      },
    },
  });

  if (!lawyer) {
    throw new Error('المحامي المحدد غير متاح حالياً.');
  }

  const consultationAmount = parseCurrencyAmount(lawyer.lawyerProfile?.consultationFee);
  if (consultationAmount <= 0) {
    throw new Error('تعذر تحديد سعر الاستشارة لهذا المحامي.');
  }

  const consultationTitle = `استشارة مع ${lawyer.name}`;
  const paymentLabel = `رسوم استشارة قانونية - ${lawyer.name}`;
  const note = payload.note?.trim();

  const createdCase = await prisma.$transaction(async (tx) => {
    const created = await tx.case.create({
      data: {
        title: consultationTitle,
        matter: 'استشارة قانونية خاصة',
        clientId: userId,
        lawyerId: lawyer.id,
        status: 'pending',
        totalAgreedFee: consultationAmount,
        paidAmount: consultationAmount,
        unreadCount: 1,
        customFields: {
          create: [
            { label: 'نوع القضية', value: 'استشارة' },
            { label: 'طريقة الدفع', value: payload.paymentMethod },
            { label: 'حالة الاستشارة', value: 'مدفوعة وجاهزة للبدء' },
          ],
        },
        timelineEntries: {
          create: [
            {
              dateLabel: 'اليوم',
              title: 'بدء الاستشارة',
              detail: `تم دفع رسوم الاستشارة عبر ${payload.paymentMethod} وإنشاء قناة التواصل المباشر مع المحامي.`,
              type: 'system',
            },
          ],
        },
        accessLogs: {
          create: [
            {
              userName: 'أنت (المالك)',
              action: 'إنشاء استشارة مدفوعة',
              timeLabel: 'الآن',
            },
          ],
        },
      },
      include: {
        client: true,
        lawyer: { include: { lawyerProfile: true } },
        documents: true,
        folders: true,
        customFields: true,
        timelineEntries: true,
        collaborators: true,
        accessLogs: true,
        chatSessions: { include: { messages: true } },
        invoices: true,
      },
    } as any);

    const session = await tx.chatSession.create({
      data: {
        caseId: created.id,
        userId,
      },
    });

    await tx.message.create({
      data: {
        sessionId: session.id,
        senderId: userId,
        senderRole: 'user',
        text: note || `مرحباً أستاذ ${lawyer.name}، أرغب ببدء الاستشارة القانونية الآن.`,
        unread: true,
        priority: 'High',
        channel: 'استشارة',
        awaitingResponse: true,
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount: consultationAmount,
        label: paymentLabel,
        source: payload.paymentMethod,
        type: 'debit',
        status: 'completed',
      },
    });

    await tx.transaction.create({
      data: {
        userId: lawyer.id,
        amount: consultationAmount,
        label: `دفعة استشارة جديدة - ${consultationTitle}`,
        source: payload.paymentMethod,
        type: 'credit',
        status: 'completed',
      },
    });

    await tx.invoice.create({
      data: {
        userId,
        caseId: created.id,
        label: paymentLabel,
        amount: formatCurrencyAmount(consultationAmount),
        dateLabel: 'اليوم',
        status: 'paid',
      },
    });

    await tx.user.update({
      where: { id: lawyer.id },
      data: {
        accountBalance: { increment: consultationAmount },
      },
    });

    return created;
  });

  const caseData = await getCaseWorkspace(createdCase.id);
  if (!caseData) {
    throw new Error('تم إنشاء الاستشارة لكن تعذر تحميل المحادثة.');
  }

  return {
    caseData,
    redirectTo: `/messages?lawyerId=${encodeURIComponent(lawyer.id)}&caseId=${encodeURIComponent(caseData.id)}`,
    amount: consultationAmount,
  };
}

export async function getCaseWorkspace(caseId: string) {
  const item = await prisma.case.findUnique({
    where: { id: caseId },
    select: workspaceCaseSelect,
  } as any);

  if (!item) return null;
  return mapWorkspaceCase(item);
}

export async function payCaseInstallment(userId: string, caseId: string, installments: number) {
  if (![1, 2, 3].includes(installments)) {
    throw new Error('اختر الدفع مرة واحدة أو على دفعتين أو ثلاث دفعات.');
  }

  const existingCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      client: { select: { id: true, accountBalance: true, name: true } },
      lawyer: { select: { id: true, name: true } },
      invoices: true,
    },
  });

  if (!existingCase || existingCase.clientId !== userId) {
    throw new Error('القضية غير متاحة لهذا الحساب.');
  }

  const total = Number(existingCase.totalAgreedFee || 0);
  const paid = Number(existingCase.paidAmount || 0);
  const due = Math.max(0, total - paid);

  if (total <= 0) {
    throw new Error('لا يوجد مبلغ متفق عليه لهذه القضية.');
  }

  if (due <= 0) {
    throw new Error('تم سداد هذه القضية بالكامل.');
  }

  const installmentAmount = Math.min(due, installments === 1 ? due : Math.ceil(due / installments));

  if (existingCase.client.accountBalance < installmentAmount) {
    throw new Error('رصيد المحفظة غير كافٍ. اشحن الرصيد ثم حاول مرة أخرى.');
  }

  const paidCaseInvoices = existingCase.invoices.filter((invoice) => invoice.status === 'paid').length;
  const installmentLabel = installments === 1
    ? `سداد كامل - ${existingCase.title}`
    : `دفعة ${paidCaseInvoices + 1} من ${installments} - ${existingCase.title}`;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { accountBalance: { decrement: installmentAmount } },
    });

    await tx.user.update({
      where: { id: existingCase.lawyerId },
      data: { accountBalance: { increment: installmentAmount } },
    });

    await tx.case.update({
      where: { id: caseId },
      data: {
        paidAmount: { increment: installmentAmount },
        status: paid + installmentAmount >= total ? 'active' : existingCase.status,
      },
    });

    await tx.invoice.create({
      data: {
        userId,
        caseId,
        label: installmentLabel,
        amount: formatCurrencyAmount(installmentAmount),
        dateLabel: 'اليوم',
        status: 'paid',
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount: installmentAmount,
        label: installmentLabel,
        source: 'Wallet',
        type: 'debit',
        status: 'completed',
      },
    });

    await tx.transaction.create({
      data: {
        userId: existingCase.lawyerId,
        amount: installmentAmount,
        label: `تحصيل قضية - ${existingCase.title}`,
        source: 'Wallet',
        type: 'credit',
        status: 'completed',
      },
    });

    await tx.caseTimelineEntry.create({
      data: {
        caseId,
        dateLabel: 'اليوم',
        title: 'تسجيل دفعة',
        detail: `تم دفع ${formatCurrencyAmount(installmentAmount)} من محفظة العميل.`,
        type: 'billing',
      },
    });

    await tx.caseAccessLog.create({
      data: {
        caseId,
        userName: existingCase.client.name || 'العميل',
        action: `دفع ${formatCurrencyAmount(installmentAmount)}`,
        timeLabel: 'الآن',
      },
    });
  });

  return getCaseWorkspace(caseId);
}

export async function toggleCaseArchive(caseId: string) {
  const current = await prisma.case.findUnique({ where: { id: caseId } });
  if (!current) return null;
  await prisma.case.update({
    where: { id: caseId },
    data: { isArchived: !current.isArchived },
  });
  return getCaseWorkspace(caseId);
}

export async function deleteCaseWorkspace(caseId: string) {
  // Delete in correct order due to foreign key constraints
  await prisma.$transaction(async (tx) => {
    // Delete chat messages and sessions
    await tx.message.deleteMany({ where: { session: { caseId } } });
    await tx.chatSession.deleteMany({ where: { caseId } });

    // Delete documents and folders
    await tx.document.deleteMany({ where: { caseId } });
    await tx.folder.deleteMany({ where: { caseId } });

    // Delete case-related data
    await tx.caseCustomField.deleteMany({ where: { caseId } });
    await tx.caseTimelineEntry.deleteMany({ where: { caseId } });
    await tx.caseCollaborator.deleteMany({ where: { caseId } });
    await tx.caseAccessLog.deleteMany({ where: { caseId } });

    // Delete optional references
    await tx.appointment.deleteMany({ where: { caseId } });
    await tx.invoice.deleteMany({ where: { caseId } });
    await tx.contract.deleteMany({ where: { caseId } });

    // Finally delete the case itself
    await tx.case.delete({ where: { id: caseId } });
  });
}

export async function addCaseCollaborator(caseId: string, payload: { email: string; role: string; permissions: string; }) {
  const name = payload.email.split('@')[0];
  await prisma.caseCollaborator.create({
    data: {
      caseId,
      name,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      img: `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.email)}&background=0d2a59&color=fff&rounded=true`,
      lastSeen: 'لم يسجل دخول بعد',
    },
  });
  await prisma.caseAccessLog.create({
    data: {
      caseId,
      userName: 'أنت (المالك)',
      action: `منح صلاحية لـ ${name}`,
      timeLabel: 'الآن',
    },
  });
  return getCaseWorkspace(caseId);
}

export async function removeCaseCollaborator(caseId: string, collaboratorId: string) {
  const existing = await prisma.caseCollaborator.findUnique({ where: { id: collaboratorId } });
  await prisma.caseCollaborator.delete({ where: { id: collaboratorId } });
  await prisma.caseAccessLog.create({
    data: {
      caseId,
      userName: 'أنت (المالك)',
      action: `إلغاء صلاحية ${existing?.name || 'مستخدم'}`,
      timeLabel: 'الآن',
    },
  });
  return getCaseWorkspace(caseId);
}

export async function addCaseFolder(caseId: string, name: string) {
  await prisma.folder.create({ data: { caseId, name } });
  return getCaseWorkspace(caseId);
}

export async function addCaseCustomField(caseId: string, label: string, value: string) {
  await prisma.caseCustomField.create({ data: { caseId, label, value } });
  return getCaseWorkspace(caseId);
}

export async function moveCaseDocuments(caseId: string, documentIds: string[], folderId: string | null) {
  await prisma.document.updateMany({
    where: { caseId, id: { in: documentIds } },
    data: { folderId },
  });
  return getCaseWorkspace(caseId);
}

export async function signCaseDocument(caseId: string, documentId: string) {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      actionRequired: null,
      expiresAt: null,
      expiresText: null,
      isSigned: true,
      status: 'Signed',
    },
  });
  return getCaseWorkspace(caseId);
}

export async function reviewCaseDocument(caseId: string, documentId: string, status: 'Reviewed' | 'Needs Review', note?: string) {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status,
      actionRequired: note || (status === 'Reviewed' ? null : undefined),
    },
  });
  return getCaseWorkspace(caseId);
}

export async function clearDocumentAction(caseId: string, documentId: string) {
  await prisma.document.update({
    where: { id: documentId },
    data: { actionRequired: null },
  });
  return getCaseWorkspace(caseId);
}

export async function addCaseDocument(caseId: string, payload: {
  name: string;
  size: string;
  type: string;
  folderId?: string | null;
  actionRequired?: string | null;
  tags?: string[];
}) {
  const previewUrl = `https://dummyimage.com/600x400/f3f4f6/1f2937&text=${encodeURIComponent(payload.name)}`;
  await prisma.document.create({
    data: {
      caseId,
      name: payload.name,
      fileUrl: previewUrl,
      previewUrl,
      size: payload.size,
      type: payload.type,
      folderId: payload.folderId ?? null,
      status: 'Draft',
      actionRequired: payload.actionRequired || null,
      tags: JSON.stringify(Array.isArray(payload.tags) ? payload.tags : []),
    },
  });
  return getCaseWorkspace(caseId);
}

export async function addCaseMessage(caseId: string, userId: string, text: string, senderRole: 'user' | 'lawyer') {
  const latestClientMessage = await getLatestClientMessage(caseId);

  if (latestClientMessage && !latestClientMessage.awaitingResponse) {
    throw new Error('تم إغلاق هذه المحادثة من جهة المحامي. لا يمكن إرسال رسائل جديدة حتى يعاد فتحها.');
  }

  const session = await ensureCaseSession(caseId, userId);
  await prisma.message.create({
    data: {
      sessionId: session.id,
      senderId: userId,
      text,
      senderRole,
      unread: senderRole === 'user',
      priority: 'Medium',
      channel: senderRole === 'lawyer' ? 'داخلي' : 'عميل',
      awaitingResponse: senderRole === 'user',
    },
  });
  await prisma.case.update({
    where: { id: caseId },
    data: {
      updatedAt: new Date(),
      unreadCount: senderRole === 'user' ? { increment: 1 } : 0,
    },
  });
  return getCaseWorkspace(caseId);
}

const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export async function updateCaseMessageReaction(
  caseId: string,
  userId: string,
  messageId: string,
  reaction: string | null,
  viewerRole: 'user' | 'lawyer',
) {
  if (reaction !== null && !MESSAGE_REACTIONS.includes(reaction)) {
    throw new Error('Unsupported message reaction');
  }

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      session: { caseId },
    },
    select: {
      senderRole: true,
      session: {
        select: {
          case: {
            select: {
              clientId: true,
              lawyerId: true,
            },
          },
        },
      },
    },
  });

  const caseData = message?.session.case;
  const canAccessCase = caseData && (caseData.clientId === userId || caseData.lawyerId === userId);

  if (!message || !canAccessCase) {
    throw new Error('Message not found');
  }

  if (message.senderRole === viewerRole) {
    throw new Error('Only received messages can be reacted to');
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { reaction },
  });

  return getCaseWorkspace(caseId);
}

function mapProCase(item: any) {
  const outstandingInvoice = item.totalAgreedFee - item.paidAmount;
  const privateNote = item.customFields?.find((field: any) => field.label === '__privateNote')?.value || '';
  return {
    id: item.id,
    title: item.title,
    client: item.client.name,
    matter: item.matter,
    status: item.status === 'closed' ? 'Closed' : item.status === 'review' ? 'In Review' : item.riskScore >= 70 ? 'At Risk' : 'Open',
    nextDeadline: item.timelineEntries[item.timelineEntries.length - 1]?.dateLabel || formatDateLabel(item.updatedAt),
    priority: item.riskScore >= 80 ? 'High' : item.riskScore >= 40 ? 'Medium' : 'Low',
    riskScore: item.riskScore,
    progress: item.progress,
    billableHours: Math.max(1, Math.round(item.progress / 10)),
    outstandingInvoice,
    isPinned: item.riskScore >= 70,
    privateNote,
  } as const;
}

export async function getProWorkspace(lawyerId: string) {
  const [lawyer, cases, appointments, followerCount, newFollowersThisWeek, reviewCount, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: lawyerId },
      include: {
        lawyerProfile: true,
      },
    }),
    prisma.case.findMany({
      where: { lawyerId },
      include: {
        client: true,
        documents: true,
        customFields: true,
        chatSessions: { include: { messages: { include: { sender: true }, orderBy: { createdAt: 'desc' } } } },
        timelineEntries: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    } as any),
    prisma.appointment.findMany({ where: { lawyerId }, orderBy: { createdAt: 'asc' } }),
    prisma.userFollow.count({ where: { lawyerId } }),
    prisma.userFollow.count({
      where: {
        lawyerId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.review.count({ where: { lawyerId } }),
    prisma.transaction.findMany({ where: { userId: lawyerId }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const caseRecords = cases.map(mapProCase);

  const clientsMap = new Map<string, any>();
  cases.forEach((item: any) => {
    const existing = clientsMap.get(item.client.id) || {
      id: item.client.id,
      name: item.client.name,
      company: item.client.company || item.matter,
      openCases: 0,
      lastActivity: formatDateLabel(item.updatedAt),
      status: item.riskScore >= 70 ? 'At Risk' : item.status === 'pending' ? 'Pending' : 'Active',
    };
    existing.openCases += 1;
    clientsMap.set(item.client.id, existing);
  });

  const teamTasks = cases.slice(0, 3).map((item: any, index: number) => ({
    id: `task-${item.id}`,
    title: `متابعة ${item.title}`,
    assignee: index === 0 ? 'ريم' : index === 1 ? 'يوسف' : 'هالة',
    due: item.timelineEntries[item.timelineEntries.length - 1]?.dateLabel || 'هذا الأسبوع',
    status: item.status === 'closed' ? 'done' : item.status === 'review' ? 'in-progress' : 'todo',
  }));

  const inboxMessages = cases.flatMap((item: any) =>
    item.chatSessions.flatMap((session: any) =>
      session.messages.slice(0, 3).map((message: any) => ({
        id: message.id,
        caseId: item.id,
        name: message.sender.name,
        time: formatRelativeTime(message.createdAt),
        img: message.sender.img || message.sender.name.slice(0, 2),
        unread: message.unread,
        text: message.text,
        priority: message.priority || 'Medium',
        channel: message.channel || 'عميل',
        caseTitle: item.title,
        awaitingResponse: message.awaitingResponse,
      })),
    ),
  ).sort((a, b) => Number(b.unread) - Number(a.unread));

  const vaultDocs = cases.flatMap((item: any) =>
    item.documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      type: doc.type.toLowerCase().includes('pdf') ? 'pdf' : doc.type.toLowerCase().includes('image') || doc.type.includes('صورة') ? 'image' : 'word',
      fileUrl: doc.fileUrl,
      previewUrl: doc.previewUrl,
      date: formatShortDateLabel(doc.createdAt),
      status: doc.status === 'Signed' ? 'Signed' : doc.status === 'Needs Review' ? 'Needs Review' : doc.status === 'Reviewed' ? 'Reviewed' : 'Draft',
      caseTitle: item.title,
      owner: item.client.name,
      confidential: doc.confidential,
      actionRequired: doc.actionRequired,
    })),
  );

  const caseTimeline = cases.flatMap((item: any) =>
    item.timelineEntries.map((entry: any) => ({
      id: entry.id,
      caseId: item.id,
      date: entry.dateLabel,
      title: entry.title,
      detail: entry.detail,
      type: entry.type === 'filing' ? 'filing' : entry.type === 'meeting' ? 'client' : 'note',
      court: item.matter,
      governorate: item.client.location || 'العراق',
    })),
  );

  const deadlineReminders = cases.slice(0, 4).map((item: any) => ({
    id: `deadline-${item.id}`,
    caseId: item.id,
    title: item.title,
    dueDate: item.timelineEntries[item.timelineEntries.length - 1]?.dateLabel || formatDateLabel(item.updatedAt),
    urgency: item.riskScore >= 80 ? 'critical' : item.riskScore >= 40 ? 'upcoming' : 'routine',
    category: 'جلسة',
    court: item.matter,
    governorate: item.client.location || 'العراق',
  }));

  const totalAgreedRevenue = cases.reduce((sum: number, item: any) => sum + Number(item.totalAgreedFee || 0), 0);
  const collectedRevenue = cases.reduce((sum: number, item: any) => sum + Number(item.paidAmount || 0), 0);
  const pendingRevenue = Math.max(0, totalAgreedRevenue - collectedRevenue);
  const withdrawnTotal = transactions
    .filter((item) => item.type === 'debit' && item.status === 'completed')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyEarnings = transactions
    .filter((item) => item.type === 'credit' && item.status === 'completed' && item.createdAt.getMonth() === currentMonth && item.createdAt.getFullYear() === currentYear)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const nextBillingDate = new Intl.DateTimeFormat('ar-IQ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(currentYear, currentMonth + 1, 1));
  const subscriptionTier = lawyer?.subscriptionTier || 'basic';
  const caseLimit = subscriptionTier === 'enterprise' ? 'غير محدود' : subscriptionTier === 'pro' ? '25' : '10';

  return {
    summary: {
      lawyerName: lawyer?.name || 'المحامي',
      availableToWithdraw: lawyer?.accountBalance ?? 0,
      pendingRevenue,
      monthlyEarnings,
      totalWithdrawn: withdrawnTotal,
      totalCollected: collectedRevenue,
      totalAgreedRevenue,
      followers: followerCount,
      newFollowersThisWeek,
      reviewCount,
      rating: lawyer?.lawyerProfile?.rating ?? 0,
      subscriptionTier,
      nextBillingDate,
      activeCases: caseRecords.filter((item) => item.status !== 'Closed').length,
      completedCases: caseRecords.filter((item) => item.status === 'Closed').length,
      payoutMethods: [
        { id: 'pm-zain', label: 'زين كاش', value: 'الحساب الافتراضي', recommended: true },
        { id: 'pm-bank', label: 'تحويل بنكي', value: lawyer?.location || 'العراق', recommended: false },
      ],
      usage: {
        activeCases: caseRecords.filter((item) => item.status !== 'Closed').length,
        caseLimit,
        aiAssists: 18,
        aiLimit: subscriptionTier === 'enterprise' ? 'غير محدود' : subscriptionTier === 'pro' ? '200' : '50',
      },
      recentTransactions: transactions.map((item) => ({
        id: item.id,
        label: item.label,
        amount: item.amount,
        status: item.status,
        type: item.type,
        date: formatDateLabel(item.createdAt),
      })),
    },
    cases: caseRecords,
    appointments: appointments.map((item) => ({
      id: item.id,
      title: item.title,
      time: item.timeLabel,
      client: item.clientName,
      type: item.type,
    })),
    clients: Array.from(clientsMap.values()),
    teamTasks,
    inboxMessages,
    vaultDocs,
    caseTimeline,
    deadlineReminders,
  };
}

export async function requestProWithdrawal(lawyerId: string, payload: { amount: number; payoutMethod?: string }) {
  const amount = Number(payload.amount);
  const payoutMethod = String(payload.payoutMethod || 'وسيلة السحب الافتراضية').trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('أدخل مبلغ سحب صحيح.');
  }

  const lawyer = await prisma.user.findFirst({
    where: {
      id: lawyerId,
      role: { in: ['pro', 'admin'] },
    },
    select: {
      id: true,
      name: true,
      accountBalance: true,
    },
  });

  if (!lawyer) {
    throw new Error('السحب متاح لحسابات المحامين فقط.');
  }

  if (lawyer.accountBalance < amount) {
    throw new Error('رصيدك المتاح غير كافٍ لهذا السحب.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: lawyerId },
      data: {
        accountBalance: {
          decrement: amount,
        },
      },
    });

    await tx.transaction.create({
      data: {
        userId: lawyerId,
        amount,
        label: `سحب أرباح - ${lawyer.name}`,
        source: payoutMethod,
        type: 'debit',
        status: 'completed',
      },
    });

    await tx.activityLog.create({
      data: {
        userId: lawyerId,
        title: 'تم تنفيذ طلب سحب',
        description: `تم سحب ${formatCurrencyAmount(amount)} عبر ${payoutMethod}.`,
        type: 'billing',
        timeLabel: 'الآن',
      },
    });
  });

  return getProWorkspace(lawyerId);
}

export async function createProAppointment(lawyerId: string, payload: { title: string; time: string; client: string; type: string; caseId?: string | null }) {
  await prisma.appointment.create({
    data: {
      lawyerId,
      caseId: payload.caseId || null,
      title: payload.title,
      timeLabel: payload.time,
      clientName: payload.client,
      type: payload.type,
    },
  });
  return getProWorkspace(lawyerId);
}

export async function createProCase(lawyerId: string, payload: { title: string; client: string; matter: string; priority: string; }) {
  const client = await prisma.user.findFirst({
    where: { name: payload.client },
  });

  const clientId = client?.id || (await prisma.user.create({
    data: {
      email: `${Date.now()}-${payload.client.replace(/\s+/g, '').toLowerCase()}@workspace.local`,
      passwordHash: 'temporary',
      name: payload.client,
      role: 'user',
      language: 'العربية',
      company: payload.matter,
    },
  })).id;

  const riskScore = payload.priority === 'High' ? 80 : payload.priority === 'Medium' ? 50 : 20;

  await prisma.case.create({
    data: {
      title: payload.title,
      matter: payload.matter,
      clientId,
      lawyerId,
      status: 'active',
      progress: 0,
      riskScore,
      timelineEntries: {
        create: [{
          dateLabel: 'اليوم',
          title: 'إنشاء القضية',
          detail: 'تم إنشاء ملف جديد من لوحة المحامي.',
          type: 'system',
        }],
      },
    },
  } as any);

  return getProWorkspace(lawyerId);
}

export async function uploadProVaultDocument(lawyerId: string, caseId: string | null) {
  const targetCase = caseId
    ? await prisma.case.findUnique({ where: { id: caseId } })
    : await prisma.case.findFirst({ where: { lawyerId }, orderBy: { updatedAt: 'desc' } });
  if (!targetCase) return getProWorkspace(lawyerId);

  await prisma.document.create({
    data: {
      caseId: targetCase.id,
      name: 'مستند_جديد.pdf',
      fileUrl: 'https://dummyimage.com/600x400/f3f4f6/1f2937&text=Upload',
      previewUrl: 'https://dummyimage.com/600x400/f3f4f6/1f2937&text=Upload',
      size: '0.8 MB',
      type: 'pdf',
      status: 'Draft',
      confidential: false,
      tags: '[]',
    },
  });

  return getProWorkspace(lawyerId);
}

export async function updateCaseProgress(caseId: string, progress: number) {
  return prisma.case.update({
    where: { id: caseId },
    data: { progress },
  });
}

export async function closeCaseWorkspace(userId: string, role: string, caseId: string, summary?: string) {
  const existingCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      client: { select: { id: true, name: true } },
      lawyer: { select: { id: true, name: true } },
      documents: true,
      customFields: true,
    },
  });

  if (!existingCase) {
    throw new Error('القضية غير موجودة.');
  }

  const isConsultation = existingCase.matter === 'استشارة قانونية خاصة'
    || existingCase.customFields.some((field) => field.label === 'نوع القضية' && field.value === 'استشارة');
  const canClose = role === 'admin'
    || ((role === 'pro' || role === 'lawyer') && existingCase.lawyerId === userId)
    || (role === 'user' && isConsultation && existingCase.clientId === userId);
  if (!canClose) {
    throw new Error(isConsultation ? 'إنهاء الاستشارة متاح لصاحب الاستشارة أو المحامي المسؤول أو الإدارة.' : 'إغلاق القضية متاح فقط للمحامي المسؤول أو الإدارة.');
  }

  const remainingBalance = Math.max(0, Number(existingCase.totalAgreedFee || 0) - Number(existingCase.paidAmount || 0));
  if (remainingBalance > 0) {
    throw new Error('لا يمكن إغلاق الملف قبل توضيح أو سداد المبلغ المتبقي.');
  }

  const pendingDocuments = isConsultation ? [] : existingCase.documents.filter((doc) => doc.actionRequired || doc.expiresAt);
  if (pendingDocuments.length > 0) {
    throw new Error('لا يمكن إغلاق الملف قبل معالجة الوثائق المطلوبة.');
  }

  const closeSummary = summary?.trim() || (isConsultation ? 'تم إنهاء محادثة الاستشارة بعد اكتمال الخلاصة.' : 'تم إغلاق الملف بعد اكتمال المتطلبات النهائية.');
  if ((existingCase.unreadCount || 0) > 0) {
    throw new Error('لا يمكن إغلاق الملف قبل قراءة الرسائل غير المقروءة.');
  }
  if (closeSummary.split(/\s+/).filter(Boolean).length < (isConsultation ? 5 : 8)) {
    throw new Error('خلاصة الإغلاق قصيرة جداً. أضف ما تم إنجازه والنتيجة النهائية قبل الاعتماد.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseId },
      data: {
        status: 'closed',
        progress: 100,
      },
    });

    await tx.caseTimelineEntry.create({
      data: {
        caseId,
        dateLabel: 'اليوم',
        title: isConsultation ? 'إنهاء الاستشارة' : 'إغلاق الملف',
        detail: closeSummary,
        type: 'system',
      },
    });

    await tx.caseAccessLog.create({
      data: {
        caseId,
        userName: role === 'user' ? existingCase.client.name || 'العميل' : existingCase.lawyer.name || 'المحامي',
        action: isConsultation ? 'إنهاء الاستشارة' : 'إغلاق الملف',
        timeLabel: 'الآن',
      },
    });

    if (role === 'user') {
      await tx.notification.create({
        data: {
          userId: existingCase.lawyerId,
          title: 'تم إنهاء استشارة',
          message: `أنهى العميل ${existingCase.title} ويمكنه الآن تقييم التجربة.`,
          type: 'success',
          link: '/pro',
        },
      });
    } else {
      await tx.notification.create({
        data: {
          userId: existingCase.clientId,
          title: isConsultation ? 'تم إنهاء الاستشارة' : 'تم إغلاق الملف',
          message: `${isConsultation ? 'تم إنهاء' : 'تم إغلاق'} ${existingCase.title}. يمكنك تقييم التجربة من صفحة القضايا.`,
          type: 'success',
          link: '/cases',
        },
      });
    }
  });

  return getCaseWorkspace(caseId);
}

export async function submitCaseReview(userId: string, caseId: string, rating: number, text?: string) {
  const normalizedRating = Math.max(1, Math.min(5, Math.round(Number(rating))));
  if (!Number.isFinite(normalizedRating)) {
    throw new Error('اختر تقييماً من 1 إلى 5.');
  }

  const existingCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      title: true,
      clientId: true,
      lawyerId: true,
      status: true,
      matter: true,
      customFields: true,
    },
  });

  if (!existingCase || existingCase.clientId !== userId) {
    throw new Error('لا يمكنك تقييم هذا الملف.');
  }

  if (existingCase.status !== 'closed') {
    const isConsultation = existingCase.matter === 'استشارة قانونية خاصة'
      || existingCase.customFields.some((field) => field.label === 'نوع القضية' && field.value === 'استشارة');
    throw new Error(isConsultation ? 'يمكن تقييم المحامي بعد إنهاء محادثة الاستشارة.' : 'يمكن تقييم المحامي بعد إغلاق الملف فقط.');
  }

  const reviewText = `[case:${caseId}] ${(text?.trim() || `تقييم تجربة ${existingCase.title}`).slice(0, 800)}`;
  const existingReview = await prisma.review.findFirst({
    where: {
      authorId: userId,
      lawyerId: existingCase.lawyerId,
      text: { contains: `[case:${caseId}]` },
    },
  });

  const review = existingReview
    ? await prisma.review.update({
      where: { id: existingReview.id },
      data: {
        rating: normalizedRating,
        text: reviewText,
      },
    })
    : await prisma.review.create({
      data: {
        authorId: userId,
        lawyerId: existingCase.lawyerId,
        rating: normalizedRating,
        text: reviewText,
      },
    });

  const aggregate = await prisma.review.aggregate({
    where: { lawyerId: existingCase.lawyerId },
    _avg: { rating: true },
  });

  await prisma.lawyerProfile.update({
    where: { userId: existingCase.lawyerId },
    data: {
      rating: Number((aggregate._avg.rating || normalizedRating).toFixed(2)),
    },
  });

  return {
    id: review.id,
    rating: review.rating,
    text: review.text.replace(`[case:${caseId}]`, '').trim(),
  };
}

export async function updateProMessageState(messageId: string, data: { unread?: boolean; awaitingResponse?: boolean }) {
  const currentMessage = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      unread: true,
      awaitingResponse: true,
      session: {
        select: {
          caseId: true,
          case: {
            select: {
              unreadCount: true,
            },
          },
        },
      },
    },
  });

  if (!currentMessage?.session.caseId) {
    return;
  }

  await prisma.message.update({
    where: { id: messageId },
    data,
  });

  if (typeof data.awaitingResponse === 'boolean' && data.awaitingResponse !== currentMessage.awaitingResponse) {
    const currentUnreadCount = currentMessage.session.case?.unreadCount ?? 0;
    const nextUnreadCount = data.awaitingResponse
      ? currentUnreadCount + 1
      : Math.max(0, currentUnreadCount - 1);

    await prisma.case.update({
      where: { id: currentMessage.session.caseId },
      data: {
        unreadCount: nextUnreadCount,
      },
    });
  }
}

export async function updateProCaseStatuses(caseIds: string[], status: string) {
  await prisma.case.updateMany({
    where: { id: { in: caseIds } },
    data: {
      status: status === 'Closed' ? 'closed' : status === 'In Review' ? 'review' : status === 'At Risk' ? 'active' : 'active',
      riskScore: status === 'At Risk' ? 90 : undefined,
    },
  });
}

export async function deleteProCases(caseIds: string[]) {
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
}

export async function markCaseMessagesAsRead(caseId: string, userId: string) {
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      clientId: true,
      lawyerId: true,
    },
  });

  if (!caseRecord) {
    return null;
  }

  const counterpartRole = userId === caseRecord.lawyerId ? 'user' : 'lawyer';

  await prisma.message.updateMany({
    where: {
      session: { caseId },
      senderRole: counterpartRole,
      unread: true,
    },
    data: {
      unread: false,
      awaitingResponse: false,
    },
  });

  await prisma.case.update({
    where: { id: caseId },
    data: { unreadCount: 0 },
  });

  return prisma.case.findUnique({
    where: { id: caseId },
    select: workspaceCaseSelect,
  });
}
