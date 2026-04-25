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

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    where: { caseId, userId },
  });

  if (existing) return existing;

  return prisma.chatSession.create({
    data: { caseId, userId },
  });
}

function mapWorkspaceCase(item: any) {
  return {
    client: item.client.name,
    id: item.id,
    title: item.title,
    lawyer: {
      id: item.lawyer.id,
      name: item.lawyer.name,
      role: item.lawyer.roleDescription || item.lawyer.lawyerProfile?.specialty || 'محامٍ',
      img: item.lawyer.img || item.lawyer.lawyerProfile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.lawyer.name)}&background=0d2a59&color=ffffff`,
    },
    status: mapCaseStatus(item.status),
    statusText: mapCaseStatusText(item.status),
    progress: item.progress,
    date: formatDateLabel(item.createdAt),
    unreadCount: item.unreadCount,
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
      actionRequired: (doc.actionRequired as 'بانتظار توقيعك' | null) || null,
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
    messages: item.chatSessions.flatMap((session: any) =>
      session.messages.map((message: any) => ({
        id: message.id,
        sender: message.senderRole === 'lawyer' ? 'lawyer' : 'user',
        text: message.text,
        time: formatShortDateLabel(message.createdAt),
      })),
    ),
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

export async function getCaseWorkspace(caseId: string) {
  const item = await prisma.case.findUnique({
    where: { id: caseId },
    select: workspaceCaseSelect,
  } as any);

  if (!item) return null;
  return mapWorkspaceCase(item);
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
  await prisma.case.delete({ where: { id: caseId } });
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

export async function addCaseDocument(caseId: string, payload: { name: string; size: string; type: string; folderId?: string | null; }) {
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
      tags: '[]',
    },
  });
  return getCaseWorkspace(caseId);
}

export async function addCaseMessage(caseId: string, userId: string, text: string, senderRole: 'user' | 'lawyer') {
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
  if (senderRole === 'user') {
    await prisma.case.update({
      where: { id: caseId },
      data: { unreadCount: { increment: 1 } },
    });
  }
  return getCaseWorkspace(caseId);
}

function mapProCase(item: any) {
  const outstandingInvoice = item.totalAgreedFee - item.paidAmount;
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
      date: formatShortDateLabel(doc.createdAt),
      status: doc.status === 'Signed' ? 'Signed' : doc.status === 'Needs Review' ? 'Needs Review' : doc.status === 'Reviewed' ? 'Reviewed' : 'Draft',
      caseTitle: item.title,
      owner: item.client.name,
      confidential: doc.confidential,
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

export async function updateProMessageState(messageId: string, data: { unread?: boolean; awaitingResponse?: boolean }) {
  await prisma.message.update({
    where: { id: messageId },
    data,
  });
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
