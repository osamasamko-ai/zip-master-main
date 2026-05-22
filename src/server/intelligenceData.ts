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
  const events = await prisma.userEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

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

  const recommendations = [
    topCategories[0]
      ? {
          id: 'continue-category',
          title: `متابعة ${topCategories[0].label}`,
          description: `لاحظنا اهتمامك بهذا التصنيف. يمكن ترتيب النتائج وإظهار المواد المرتبطة به أولاً.`,
          action: 'افتح LegalDocs',
          target: '/legal',
        }
      : null,
    topSearches[0]
      ? {
          id: 'repeat-search',
          title: `آخر بحث مهم: ${topSearches[0].label}`,
          description: 'احفظ هذا الموضوع أو اسأل المساعد عنه للحصول على شرح مع مراجع.',
          action: 'اسأل المساعد',
          target: '/aichat',
        }
      : null,
    recentResources[0]
      ? {
          id: 'resume-resource',
          title: `العودة إلى ${recentResources[0].label}`,
          description: 'مرجع فتحته مؤخرًا ويمكن أن يكون نقطة متابعة جيدة.',
          action: 'متابعة القراءة',
          target: recentResources[0].page === 'legalDocs' ? '/legal' : '/aichat',
        }
      : null,
  ].filter(Boolean);

  return {
    totals: {
      events: events.length,
      categories: topCategories.length,
      searches: topSearches.length,
    },
    topCategories,
    topSearches,
    topAuthors,
    topPages,
    recentResources: recentResources.slice(0, 6),
    recommendations,
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
