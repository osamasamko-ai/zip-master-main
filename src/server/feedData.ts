import { prisma } from './prisma';

type FeedFilter = 'all' | 'videos' | 'articles' | 'lawyers' | 'admins' | 'popular';

const POST_SELECT = {
  id: true,
  content: true,
  category: true,
  mediaUrl: true,
  mediaType: true,
  status: true,
  pinned: true,
  featured: true,
  shareCount: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      role: true,
      img: true,
      verified: true,
      lawyerProfile: {
        select: {
          avatar: true,
          licenseStatus: true,
          specialty: true,
        },
      },
    },
  },
  likes: { select: { userId: true } },
  saves: { select: { userId: true } },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          img: true,
          lawyerProfile: { select: { avatar: true } },
        },
      },
    },
  },
};

const STORY_SELECT = {
  id: true,
  text: true,
  mediaUrl: true,
  mediaType: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      role: true,
      img: true,
      verified: true,
      lawyerProfile: {
        select: {
          avatar: true,
          licenseStatus: true,
          specialty: true,
        },
      },
    },
  },
  views: {
    select: {
      userId: true,
      viewedAt: true,
    },
  },
};

function cleanContent(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isVerifiedLawyer(user: any) {
  return user?.role === 'pro' && (user.verified || user.lawyerProfile?.licenseStatus === 'verified');
}

function canPublish(user: any) {
  return user?.role === 'admin' || isVerifiedLawyer(user);
}

function canManagePost(user: any, post: { authorId: string }) {
  return user?.role === 'admin' || user?.userId === post.authorId;
}

function mapPost(post: any, viewerId?: string) {
  const authorRole = post.author.role === 'admin' ? 'admin' : 'lawyer';
  return {
    id: post.id,
    content: post.content,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    category: post.category,
    status: post.status,
    pinned: post.pinned,
    featured: post.featured,
    shareCount: post.shareCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: {
      id: post.author.id,
      name: post.author.name,
      role: authorRole,
      roleLabel: authorRole === 'admin' ? 'إدارة المنصة' : 'محامٍ موثق',
      avatar: post.author.lawyerProfile?.avatar || post.author.img || 'https://i.pravatar.cc/150',
      specialty: post.author.lawyerProfile?.specialty || '',
    },
    likesCount: post.likes.length,
    savesCount: post.saves.length,
    commentsCount: post.comments.length,
    likedByMe: Boolean(viewerId && post.likes.some((like: any) => like.userId === viewerId)),
    savedByMe: Boolean(viewerId && post.saves.some((save: any) => save.userId === viewerId)),
    readingTime: Math.max(1, Math.ceil((post.content || '').split(/\s+/).filter(Boolean).length / 180)),
    comments: post.comments.map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        role: comment.author.role,
        avatar: comment.author.lawyerProfile?.avatar || comment.author.img || 'https://i.pravatar.cc/150',
      },
    })),
  };
}

function mapStory(story: any, viewerId?: string) {
  const authorRole = story.author.role === 'admin' ? 'admin' : 'lawyer';
  const seenView = viewerId ? story.views?.find((view: any) => view.userId === viewerId) : null;
  const isArchived = story.status !== 'active' || new Date(story.expiresAt).getTime() <= Date.now();
  return {
    id: story.id,
    text: story.text,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    status: story.status,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
    seenByMe: Boolean(seenView),
    viewedAt: seenView?.viewedAt || null,
    isArchived,
    author: {
      id: story.author.id,
      name: story.author.name,
      role: authorRole,
      roleLabel: authorRole === 'admin' ? 'إدارة المنصة' : 'محامٍ موثق',
      avatar: story.author.lawyerProfile?.avatar || story.author.img || 'https://i.pravatar.cc/150',
      specialty: story.author.lawyerProfile?.specialty || '',
    },
  };
}

async function getCurrentUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { lawyerProfile: true },
  });
}

export async function listFeedStories(viewerId: string, mode: 'active' | 'archive' | 'all' = 'active') {
  const now = new Date();
  const activeWhere = {
    status: 'active',
    expiresAt: { gt: now },
  };
  const archiveWhere = {
    OR: [
      { status: { not: 'active' } },
      { expiresAt: { lte: now } },
    ],
  };

  const stories = await prisma.feedStory.findMany({
    where: {
      ...(mode === 'archive' ? archiveWhere : mode === 'all' ? { OR: [activeWhere, archiveWhere] } : activeWhere),
      author: {
        OR: [
          { role: 'admin' },
          { role: 'pro', OR: [{ verified: true }, { lawyerProfile: { licenseStatus: 'verified' } }] },
        ],
      },
    },
    select: STORY_SELECT,
    orderBy: [{ createdAt: 'desc' }],
    take: mode === 'all' ? 60 : 30,
  });

  return stories.map((story) => mapStory(story, viewerId));
}

export async function createFeedStory(userId: string, payload: { text?: string; mediaUrl?: string | null; mediaType?: string | null }) {
  const user = await getCurrentUser(userId);
  if (!canPublish(user)) {
    throw new Error('only verified lawyers and admins can create stories');
  }

  const text = cleanContent(payload.text, 240);
  const mediaType = payload.mediaType === 'video' || payload.mediaType === 'image' ? payload.mediaType : null;
  const mediaUrl = payload.mediaUrl || null;

  if (!text && !mediaUrl) {
    throw new Error('story text or media is required');
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const story = await prisma.feedStory.create({
    data: {
      authorId: userId,
      text,
      mediaUrl,
      mediaType,
      expiresAt,
      status: 'active',
    },
    select: STORY_SELECT,
  });

  return mapStory(story, userId);
}

export async function markFeedStoryViewed(userId: string, storyId: string) {
  const story = await prisma.feedStory.findFirst({
    where: {
      id: storyId,
      author: {
        OR: [
          { role: 'admin' },
          { role: 'pro', OR: [{ verified: true }, { lawyerProfile: { licenseStatus: 'verified' } }] },
        ],
      },
    },
    select: STORY_SELECT,
  });

  if (!story) {
    return null;
  }

  await prisma.feedStoryView.upsert({
    where: { storyId_userId: { storyId, userId } },
    create: { storyId, userId },
    update: { viewedAt: new Date() },
  });

  const updatedStory = await prisma.feedStory.findUnique({
    where: { id: storyId },
    select: STORY_SELECT,
  });

  return updatedStory ? mapStory(updatedStory, userId) : null;
}

export async function listFeedPosts(
  viewerId: string,
  filter: FeedFilter = 'all',
  options: { limit?: number; offset?: number } = {}
) {
  const roleFilter =
    filter === 'lawyers'
      ? { role: 'pro' }
      : filter === 'admins'
        ? { role: 'admin' }
        : undefined;
  const limit = Math.min(Math.max(Number(options.limit) || 8, 1), 20);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const where = {
    status: 'published',
    mediaType: filter === 'videos' ? 'video' : undefined,
    AND: filter === 'articles' ? [{ mediaType: { not: 'video' } }] : undefined,
    author: {
      role: roleFilter?.role,
      OR: [
        { role: 'admin' },
        { role: 'pro', OR: [{ verified: true }, { lawyerProfile: { licenseStatus: 'verified' } }] },
      ],
    },
  };
  const orderBy = filter === 'popular'
    ? [{ pinned: 'desc' as const }, { likes: { _count: 'desc' as const } }, { comments: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
    : [{ pinned: 'desc' as const }, { featured: 'desc' as const }, { createdAt: 'desc' as const }];

  const [posts, total] = await Promise.all([
    prisma.feedPost.findMany({
      where,
      select: POST_SELECT,
      orderBy,
      skip: offset,
      take: limit,
    }),
    prisma.feedPost.count({ where }),
  ]);

  return {
    posts: posts.map((post) => mapPost(post, viewerId)),
    total,
    limit,
    offset,
    nextOffset: offset + posts.length,
    hasMore: offset + posts.length < total,
  };
}

export async function createFeedPost(userId: string, payload: { content?: string; category?: string; mediaUrl?: string | null; mediaType?: string | null }) {
  const user = await getCurrentUser(userId);
  if (!canPublish(user)) {
    throw new Error('only verified lawyers and admins can create posts');
  }

  const content = cleanContent(payload.content);
  const mediaType = payload.mediaType === 'video' || payload.mediaType === 'image' ? payload.mediaType : null;
  const mediaUrl = payload.mediaUrl || null;

  if (!content && !mediaUrl) {
    throw new Error('post content or media is required');
  }

  const post = await prisma.feedPost.create({
    data: {
      authorId: userId,
      content,
      category: cleanContent(payload.category, 60) || 'معلومة قانونية',
      mediaUrl,
      mediaType,
      status: 'published',
    },
    select: POST_SELECT,
  });

  return mapPost(post, userId);
}

export async function updateFeedPost(userId: string, postId: string, payload: { content?: string; status?: string; pinned?: boolean; featured?: boolean }) {
  const user = await getCurrentUser(userId);
  const existing = await prisma.feedPost.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!existing) throw new Error('post not found');
  if (!canManagePost({ ...user, userId }, existing)) throw new Error('not allowed to edit this post');

  const status = user?.role === 'admin' && (payload.status === 'hidden' || payload.status === 'published') ? payload.status : undefined;
  const post = await prisma.feedPost.update({
    where: { id: postId },
    data: {
      content: payload.content == null ? undefined : cleanContent(payload.content),
      status,
      pinned: user?.role === 'admin' && typeof payload.pinned === 'boolean' ? payload.pinned : undefined,
      featured: user?.role === 'admin' && typeof payload.featured === 'boolean' ? payload.featured : undefined,
    },
    select: POST_SELECT,
  });
  return mapPost(post, userId);
}

export async function deleteFeedPost(userId: string, postId: string) {
  const user = await getCurrentUser(userId);
  const existing = await prisma.feedPost.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!existing) throw new Error('post not found');
  if (!canManagePost({ ...user, userId }, existing)) throw new Error('not allowed to delete this post');

  await prisma.$transaction([
    prisma.feedLike.deleteMany({ where: { postId } }),
    prisma.feedSave.deleteMany({ where: { postId } }),
    prisma.feedComment.deleteMany({ where: { postId } }),
    prisma.feedPost.delete({ where: { id: postId } }),
  ]);
  return true;
}

export async function toggleFeedSave(userId: string, postId: string) {
  const post = await prisma.feedPost.findFirst({ where: { id: postId, status: 'published' }, select: { id: true } });
  if (!post) throw new Error('post not found');

  const existing = await prisma.feedSave.findUnique({ where: { postId_userId: { postId, userId } } });
  if (existing) {
    await prisma.feedSave.delete({ where: { postId_userId: { postId, userId } } });
  } else {
    await prisma.feedSave.create({ data: { postId, userId } });
  }

  const updated = await prisma.feedPost.findUnique({ where: { id: postId }, select: POST_SELECT });
  return mapPost(updated, userId);
}

export async function shareFeedPost(userId: string, postId: string) {
  const post = await prisma.feedPost.findFirst({ where: { id: postId, status: 'published' }, select: { id: true } });
  if (!post) throw new Error('post not found');
  const updated = await prisma.feedPost.update({
    where: { id: postId },
    data: { shareCount: { increment: 1 } },
    select: POST_SELECT,
  });
  return mapPost(updated, userId);
}

export async function toggleFeedLike(userId: string, postId: string) {
  const post = await prisma.feedPost.findFirst({ where: { id: postId, status: 'published' }, select: { id: true } });
  if (!post) throw new Error('post not found');

  const existing = await prisma.feedLike.findUnique({ where: { postId_userId: { postId, userId } } });
  if (existing) {
    await prisma.feedLike.delete({ where: { postId_userId: { postId, userId } } });
  } else {
    await prisma.feedLike.create({ data: { postId, userId } });
  }

  const updated = await prisma.feedPost.findUnique({ where: { id: postId }, select: POST_SELECT });
  return mapPost(updated, userId);
}

export async function addFeedComment(userId: string, postId: string, contentValue: unknown) {
  const content = cleanContent(contentValue, 800);
  if (!content) throw new Error('comment content is required');
  const post = await prisma.feedPost.findFirst({ where: { id: postId, status: 'published' }, select: { id: true } });
  if (!post) throw new Error('post not found');

  await prisma.feedComment.create({
    data: { postId, authorId: userId, content },
  });

  const updated = await prisma.feedPost.findUnique({ where: { id: postId }, select: POST_SELECT });
  return mapPost(updated, userId);
}
