import { prisma } from './prisma';

const safeJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
};

const parseMetadata = (value: string | null | undefined) => {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
};

const cleanText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, 240);
};

const makeAiBrief = (payload: {
  title: string;
  context: string;
  expected?: string;
  nextStep?: string;
}) =>
  [
    `حلل لي هذا التنبيه من منصة القسطاس الرقمي: ${payload.title}`,
    `السياق: ${payload.context}`,
    payload.nextStep ? `الخطوة المطلوبة: ${payload.nextStep}` : null,
    `أريد إجابة عملية تتضمن: ${payload.expected || 'ملخصاً مختصراً، المخاطر المحتملة، والخطوة التالية بصياغة واضحة.'}`,
  ]
    .filter(Boolean)
    .join('\n');

export const recordUserEvent = async (
  userId: string,
  payload: {
    name?: string;
    page?: string;
    resourceId?: string | null;
    metadata?: unknown;
  }
) => {
  const name = cleanText(payload.name, 'unknown_event');
  const page = cleanText(payload.page, 'unknown');
  const resourceId = payload.resourceId ? cleanText(payload.resourceId) : null;

  return prisma.userEvent.create({
    data: {
      userId,
      name,
      page,
      resourceId,
      metadata: safeJson(payload.metadata),
    },
  });
};

export const recordManyUserEvents = async (
  userId: string,
  events: Array<{ name?: string; page?: string; resourceId?: string | null; metadata?: unknown }>
) => {
  const cleaned = events.slice(0, 25).map((event) => ({
    userId,
    name: cleanText(event.name, 'unknown_event'),
    page: cleanText(event.page, 'unknown'),
    resourceId: event.resourceId ? cleanText(event.resourceId) : null,
    metadata: safeJson(event.metadata),
  }));

  if (!cleaned.length) return { count: 0 };
  return prisma.userEvent.createMany({ data: cleaned });
};

export const getUserIntelligence = async (userId: string) => {
  const [user, events, clientCases, lawyerCases, invoices, transactions, notifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        verified: true,
        accountBalance: true,
        img: true,
        phone: true,
        location: true,
        lawyerProfile: {
          select: {
            licenseStatus: true,
            profileScore: true,
            specialty: true,
            consultationFee: true,
            availability: true,
            bio: true,
          },
        },
      },
    }),
    prisma.userEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.case.findMany({
      where: { clientId: userId, isArchived: false },
      include: {
        documents: true,
        invoices: true,
        chatSessions: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 4 } } },
        customFields: true,
        lawyer: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.case.findMany({
      where: { lawyerId: userId, isArchived: false },
      include: {
        documents: true,
        invoices: true,
        chatSessions: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 4 } } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.notification.findMany({ where: { userId, read: false }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);

  const categoryCounts = new Map<string, number>();
  const searchCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();
  const authorCounts = new Map<string, { label: string; count: number }>();
  const recentResources: Array<{ id: string; label: string; page: string }> = [];

  for (const event of events) {
    pageCounts.set(event.page, (pageCounts.get(event.page) || 0) + 1);
    const metadata = parseMetadata(event.metadata);
    const category = cleanText(metadata.category);
    const query = cleanText(metadata.query || metadata.question);
    const label = cleanText(metadata.title || metadata.label || metadata.law || event.resourceId);
    const authorId = cleanText(metadata.authorId || metadata.lawyerId);
    const authorLabel = cleanText(metadata.authorName || metadata.lawyerName || metadata.author || authorId);

    if (category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    if (query && query.length > 2) searchCounts.set(query, (searchCounts.get(query) || 0) + 1);
    if (authorId) {
      const current = authorCounts.get(authorId) || { label: authorLabel || authorId, count: 0 };
      authorCounts.set(authorId, { ...current, count: current.count + 1 });
    }
    if (event.resourceId && label && !recentResources.some((item) => item.id === event.resourceId)) {
      recentResources.push({ id: event.resourceId, label, page: event.page });
    }
  }

  const topCategories = Array.from(categoryCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const topSearches = Array.from(searchCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const topPages = Array.from(pageCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const topAuthors = Array.from(authorCounts.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 8)
    .map(([id, value]) => ({ id, label: value.label, count: value.count }));

  const ownedCases = user?.role === 'pro' || user?.role === 'admin' ? lawyerCases : clientCases;
  const allCases = user?.role === 'pro' || user?.role === 'admin' ? [...lawyerCases, ...clientCases] : clientCases;
  const pendingDocuments = allCases.flatMap((item) =>
    item.documents
      .filter((doc) => doc.actionRequired || (doc.expiresAt && !doc.isSigned))
      .map((doc) => ({ doc, caseItem: item })),
  );
  const casesWithoutDocs = allCases.filter((item) => item.status !== 'closed' && item.documents.length === 0);
  const unreadCases = allCases.filter((item) => item.unreadCount > 0);
  const waitingReplies = allCases.filter((item) =>
    item.chatSessions.some((session) =>
      session.messages.some((message) => message.awaitingResponse && message.senderRole !== (user?.role === 'pro' ? 'lawyer' : 'user')),
    ),
  );
  const closingReadyCases = allCases.filter((item) => {
    const remainingBalance = Math.max(0, Number(item.totalAgreedFee || 0) - Number(item.paidAmount || 0));
    const hasPendingDocs = item.documents.some((doc) => doc.actionRequired || (doc.expiresAt && !doc.isSigned));
    return item.status !== 'closed' && item.progress >= 80 && remainingBalance === 0 && !hasPendingDocs;
  });
  const pendingInvoices = invoices.filter((invoice) => invoice.status !== 'paid');
  const recentDebitTotal = transactions
    .filter((tx) => tx.type === 'debit' && tx.status === 'completed')
    .slice(0, 5)
    .reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const profileMissing = [
    !user?.img ? 'الصورة الشخصية' : null,
    !user?.phone ? 'رقم الهاتف' : null,
    !user?.location ? 'الموقع' : null,
    user?.role === 'pro' && !user.lawyerProfile?.specialty ? 'التخصص' : null,
    user?.role === 'pro' && !user.lawyerProfile?.consultationFee ? 'سعر الاستشارة' : null,
    user?.role === 'pro' && !user.lawyerProfile?.bio ? 'نبذة المحامي' : null,
  ].filter(Boolean) as string[];

  const operationalRecommendations = [
    pendingDocuments[0]
      ? {
          id: 'pending-document',
          priority: 'high',
          title: 'وثيقة تحتاج إجراء الآن',
          description: `${pendingDocuments[0].doc.name} في ملف "${pendingDocuments[0].caseItem.title}" تحتاج توقيعاً أو متابعة.`,
          action: 'افتح الوثائق',
          target: `/cases`,
          icon: 'fa-file-signature',
          aiAction: 'حلل الوثيقة',
          aiBrief: makeAiBrief({
            title: 'وثيقة تحتاج إجراء الآن',
            context: `${pendingDocuments[0].doc.name} في ملف "${pendingDocuments[0].caseItem.title}" تحتاج توقيعاً أو متابعة.`,
            nextStep: 'ساعدني على معرفة ما يجب فحصه قبل التوقيع أو الرد.',
            expected: 'قائمة تحقق قبل الإجراء، مخاطر التأخير أو التوقيع، ونص رسالة قصيرة للمحامي أو العميل.',
          }),
          impact: 'تجنب تعطيل الملف أو توقيع وثيقة ناقصة.',
        }
      : null,
    unreadCases[0]
      ? {
          id: 'unread-case',
          priority: 'high',
          title: 'رسائل قضية غير مقروءة',
          description: `ملف "${unreadCases[0].title}" يحتوي على ${unreadCases[0].unreadCount.toLocaleString('ar-IQ')} رسائل تحتاج قراءة.`,
          action: 'افتح المحادثة',
          target: '/cases',
          icon: 'fa-comments',
          aiAction: 'لخص الرسائل',
          aiBrief: makeAiBrief({
            title: 'رسائل قضية غير مقروءة',
            context: `ملف "${unreadCases[0].title}" يحتوي على ${unreadCases[0].unreadCount.toLocaleString('ar-IQ')} رسائل غير مقروءة.`,
            nextStep: 'جهز لي طريقة متابعة منظمة قبل فتح المحادثة.',
            expected: 'أولويات القراءة، أسئلة يجب طرحها، ورداً مقترحاً يحافظ على الطابع المهني.',
          }),
          impact: 'تقليل احتمال فوات طلب مهم داخل المحادثة.',
        }
      : null,
    waitingReplies[0]
      ? {
          id: 'waiting-reply',
          priority: 'medium',
          title: user?.role === 'pro' ? 'عميل ينتظر ردك' : 'رسالة بانتظار متابعة',
          description: `راجع ملف "${waitingReplies[0].title}" حتى لا تتأخر الخطوة التالية.`,
          action: 'راجع التوجيهات',
          target: user?.role === 'pro' ? '/pro' : '/cases',
          icon: 'fa-reply',
          aiAction: 'جهز الرد',
          aiBrief: makeAiBrief({
            title: user?.role === 'pro' ? 'عميل ينتظر ردك' : 'رسالة بانتظار متابعة',
            context: `ملف "${waitingReplies[0].title}" يحتاج رداً حتى لا تتأخر الخطوة التالية.`,
            nextStep: 'اقترح رداً واضحاً ومهنياً حسب دوري في الملف.',
            expected: 'ملخص الوضع، رد قصير قابل للإرسال، ونقاط يجب التأكد منها قبل الإرسال.',
          }),
          impact: 'تسريع المتابعة وتقليل تأخر الملف.',
        }
      : null,
    closingReadyCases[0]
      ? {
          id: 'ready-to-close',
          priority: 'medium',
          title: 'ملف جاهز للإغلاق',
          description: `"${closingReadyCases[0].title}" مكتمل تقريباً ولا تظهر عليه وثائق أو مبالغ معلقة.`,
          action: 'افتح مركز الإغلاق',
          target: '/cases',
          icon: 'fa-circle-check',
          aiAction: 'راجع الإغلاق',
          aiBrief: makeAiBrief({
            title: 'ملف جاهز للإغلاق',
            context: `"${closingReadyCases[0].title}" مكتمل تقريباً ولا تظهر عليه وثائق أو مبالغ معلقة.`,
            nextStep: 'راجع معي شروط الإغلاق النهائي قبل تنفيذ الإجراء.',
            expected: 'قائمة تحقق للإغلاق، مخاطر ما بعد الإغلاق، ورسالة ختامية مناسبة للطرف الآخر.',
          }),
          impact: 'إغلاق الملف بثقة وبأثر توثيقي أوضح.',
        }
      : null,
    casesWithoutDocs[0]
      ? {
          id: 'missing-documents',
          priority: 'medium',
          title: 'ملف بلا مستندات',
          description: `إضافة مستند واحد على الأقل إلى "${casesWithoutDocs[0].title}" تزيد وضوح التقييم القانوني.`,
          action: 'ارفع مستند',
          target: '/cases',
          icon: 'fa-cloud-arrow-up',
          aiAction: 'حدد المستندات',
          aiBrief: makeAiBrief({
            title: 'ملف بلا مستندات',
            context: `ملف "${casesWithoutDocs[0].title}" لا يحتوي على مستندات حتى الآن.`,
            nextStep: 'حدد لي أكثر المستندات أهمية لبدء تقييم قانوني جيد.',
            expected: 'قائمة مستندات مرتبة بالأولوية، سبب أهمية كل مستند، وسؤال متابعة للعميل أو المحامي.',
          }),
          impact: 'رفع جودة التقييم القانوني من أول خطوة.',
        }
      : null,
    pendingInvoices[0]
      ? {
          id: 'pending-invoice',
          priority: 'medium',
          title: 'دفعة تحتاج مراجعة',
          description: `${pendingInvoices[0].label} ما زالت بحالة ${pendingInvoices[0].status}.`,
          action: 'راجع المدفوعات',
          target: '/billing',
          icon: 'fa-wallet',
          aiAction: 'حلل الدفعة',
          aiBrief: makeAiBrief({
            title: 'دفعة تحتاج مراجعة',
            context: `${pendingInvoices[0].label} ما زالت بحالة ${pendingInvoices[0].status}.`,
            nextStep: 'ساعدني على صياغة متابعة دفع واضحة ومحترمة.',
            expected: 'سبب المتابعة، صياغة رسالة دفع، ونقاط تحقق قبل التصعيد.',
          }),
          impact: 'تحسين وضوح المتابعة المالية وتقليل التأخير.',
        }
      : null,
    profileMissing.length > 0
      ? {
          id: 'profile-completion',
          priority: 'low',
          title: 'أكمل ملفك لتحسين التوصيات',
          description: `البيانات الناقصة: ${profileMissing.slice(0, 3).join('، ')}.`,
          action: 'افتح الإعدادات',
          target: '/settings',
          icon: 'fa-user-gear',
          aiAction: 'حسن الملف',
          aiBrief: makeAiBrief({
            title: 'أكمل ملفك لتحسين التوصيات',
            context: `البيانات الناقصة: ${profileMissing.slice(0, 3).join('، ')}.`,
            nextStep: 'اقترح صياغة وتحسينات تجعل الملف أكثر ثقة ووضوحاً.',
            expected: 'ترتيب الإكمال، نص نبذة مقترح عند الحاجة، وأثر كل عنصر على تجربة العميل.',
          }),
          impact: 'رفع الثقة والتخصيص داخل المنصة.',
        }
      : null,
  ].filter(Boolean);

  const recommendations = [
    ...operationalRecommendations,
    topCategories[0]
      ? {
          id: 'continue-category',
          priority: 'low',
          title: `متابعة ${topCategories[0].label}`,
          description: `لاحظنا اهتمامك بهذا التصنيف. يمكن ترتيب النتائج وإظهار المواد المرتبطة به أولاً.`,
          action: 'افتح LegalDocs',
          target: '/legal',
          icon: 'fa-book-open',
          aiAction: 'اشرح التصنيف',
          aiBrief: makeAiBrief({
            title: `متابعة ${topCategories[0].label}`,
            context: `ظهر اهتمام متكرر بتصنيف "${topCategories[0].label}" داخل المواد القانونية.`,
            nextStep: 'لخص لي أهم ما يجب معرفته في هذا التصنيف.',
            expected: 'شرح مبسط، مواد أو محاور بحث مقترحة، وأسئلة ذكية للمتابعة.',
          }),
          impact: 'تحويل الاهتمام المتكرر إلى معرفة منظمة.',
        }
      : null,
    topSearches[0]
      ? {
          id: 'repeat-search',
          priority: 'low',
          title: `آخر بحث مهم: ${topSearches[0].label}`,
          description: 'احفظ هذا الموضوع أو اسأل المساعد عنه للحصول على شرح مع مراجع.',
          action: 'اسأل المساعد',
          target: '/aichat',
          icon: 'fa-robot',
          aiAction: 'حلل البحث',
          aiBrief: makeAiBrief({
            title: `آخر بحث مهم: ${topSearches[0].label}`,
            context: `المستخدم بحث عن "${topSearches[0].label}" أكثر من مرة أو ضمن نشاط حديث.`,
            nextStep: 'قدم إجابة قانونية عراقية عملية مع مراجع عند توفرها.',
            expected: 'تعريف مختصر، الإجراء القانوني، المخاطر، ومتى يجب استشارة محام.',
          }),
          impact: 'تحويل البحث إلى إجابة قابلة للتنفيذ.',
        }
      : null,
    recentResources[0]
      ? {
          id: 'resume-resource',
          priority: 'low',
          title: `العودة إلى ${recentResources[0].label}`,
          description: 'مرجع فتحته مؤخرًا ويمكن أن يكون نقطة متابعة جيدة.',
          action: 'متابعة القراءة',
          target: recentResources[0].page === 'legalDocs' ? '/legal' : '/aichat',
          icon: 'fa-clock-rotate-left',
          aiAction: 'لخص المرجع',
          aiBrief: makeAiBrief({
            title: `العودة إلى ${recentResources[0].label}`,
            context: `تم فتح مرجع "${recentResources[0].label}" مؤخراً في صفحة ${recentResources[0].page}.`,
            nextStep: 'ساعدني على تلخيصه وربطه بسؤال عملي.',
            expected: 'ملخص قصير، نقاط قانونية مهمة، وثلاثة أسئلة متابعة مفيدة.',
          }),
          impact: 'استكمال القراءة بدون فقدان السياق.',
        }
      : null,
  ].filter(Boolean).slice(0, 8);

  const healthChecks = [
    { label: 'الملفات النشطة', value: ownedCases.filter((item) => item.status !== 'closed').length },
    { label: 'وثائق مطلوبة', value: pendingDocuments.length },
    { label: 'رسائل جديدة', value: unreadCases.reduce((total, item) => total + item.unreadCount, 0) },
    { label: 'تنبيهات غير مقروءة', value: notifications.length },
  ];

  return {
    totals: {
      events: events.length,
      categories: topCategories.length,
      searches: topSearches.length,
      activeCases: healthChecks[0].value,
      pendingDocuments: pendingDocuments.length,
      unreadMessages: healthChecks[2].value,
      accountBalance: user?.accountBalance ?? 0,
      recentDebitTotal,
    },
    topCategories,
    topSearches,
    topAuthors,
    topPages,
    recentResources: recentResources.slice(0, 6),
    recommendations,
    healthChecks,
    assistant: {
      headline: recommendations[0]?.title || 'كل شيء مستقر حالياً',
      summary: recommendations[0]?.description || 'لا توجد أولوية عاجلة. تابع ملفاتك أو اسأل المساعد عن أي موضوع قانوني.',
      nextAction: recommendations[0]?.action || 'افتح المساعد',
      target: recommendations[0]?.target || '/aichat',
      aiAction: recommendations[0]?.aiAction || 'ابدأ تحليل ذكي',
      aiBrief: recommendations[0]?.aiBrief || makeAiBrief({
        title: 'جلسة قانونية عامة',
        context: 'لا توجد أولوية عاجلة حالياً، لكن يمكن استخدام المساعد لصياغة سؤال أو فهم إجراء قانوني.',
        nextStep: 'ابدأ معي بسؤال قانوني عراقي عام.',
      }),
      confidence: Math.min(96, 58 + events.length * 2 + allCases.length * 4 + pendingDocuments.length * 6),
      generatedAt: new Date().toISOString(),
    },
  };
};

export const getAdminIntelligence = async () => {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
  const events = await prisma.userEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const countBy = (selector: (event: (typeof events)[number]) => string) => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      const key = selector(event) || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));
  };

  return {
    totals: {
      events: events.length,
      users: new Set(events.map((event) => event.userId)).size,
      pages: new Set(events.map((event) => event.page)).size,
    },
    eventsByName: countBy((event) => event.name),
    eventsByPage: countBy((event) => event.page),
    emptySearches: events
      .filter((event) => event.name === 'search_empty')
      .slice(0, 20)
      .map((event) => ({ ...event, metadata: parseMetadata(event.metadata) })),
    recent: events.slice(0, 30).map((event) => ({ ...event, metadata: parseMetadata(event.metadata) })),
  };
};
