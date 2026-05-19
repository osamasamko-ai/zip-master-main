import { prisma } from './prisma';

type FeedFilter = 'all' | 'videos' | 'lawyers' | 'admins';

const POST_SELECT = {
  id: true,
  content: true,
  mediaUrl: true,
  mediaType: true,
  status: true,
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
    status: post.status,
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
    commentsCount: post.comments.length,
    likedByMe: Boolean(viewerId && post.likes.some((like: any) => like.userId === viewerId)),
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

async function getCurrentUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { lawyerProfile: true },
  });
}

export async function listFeedPosts(viewerId: string, filter: FeedFilter = 'all') {
  const roleFilter =
    filter === 'lawyers'
      ? { role: 'pro' }
      : filter === 'admins'
        ? { role: 'admin' }
        : undefined;

  const posts = await prisma.feedPost.findMany({
    where: {
      status: 'published',
      mediaType: filter === 'videos' ? 'video' : undefined,
      author: {
        role: roleFilter?.role,
        OR: [
          { role: 'admin' },
          { role: 'pro', OR: [{ verified: true }, { lawyerProfile: { licenseStatus: 'verified' } }] },
        ],
      },
    },
    select: POST_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  return posts.map((post) => mapPost(post, viewerId));
}

export async function createFeedPost(userId: string, payload: { content?: string; mediaUrl?: string | null; mediaType?: string | null }) {
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
      mediaUrl,
      mediaType,
      status: 'published',
    },
    select: POST_SELECT,
  });

  return mapPost(post, userId);
}

export async function updateFeedPost(userId: string, postId: string, payload: { content?: string; status?: string }) {
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
    prisma.feedComment.deleteMany({ where: { postId } }),
    prisma.feedPost.delete({ where: { id: postId } }),
  ]);
  return true;
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
