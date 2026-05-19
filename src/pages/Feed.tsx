import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/ui/EmptyState';

type FeedFilter = 'all' | 'videos' | 'lawyers' | 'admins';

type FeedPost = {
  id: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  status: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    role: 'lawyer' | 'admin';
    roleLabel: string;
    avatar: string;
    specialty?: string;
  };
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      role: string;
      avatar: string;
    };
  }>;
};

const filters: Array<{ id: FeedFilter; label: string; icon: string }> = [
  { id: 'all', label: 'كل المنشورات', icon: 'fa-layer-group' },
  { id: 'videos', label: 'الفيديو فقط', icon: 'fa-circle-play' },
  { id: 'lawyers', label: 'منشورات المحامين', icon: 'fa-scale-balanced' },
  { id: 'admins', label: 'إعلانات الإدارة', icon: 'fa-bullhorn' },
];

const formatDate = (value: string) => new Intl.DateTimeFormat('ar-IQ', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

function SkeletonPost() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex animate-pulse gap-3">
        <div className="h-12 w-12 rounded-2xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-slate-100" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 rounded bg-slate-100" />
        <div className="h-3 w-4/5 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const canCreatePost = user?.role === 'pro' || user?.role === 'admin';

  const stats = useMemo(() => ({
    total: posts.length,
    videos: posts.filter((post) => post.mediaType === 'video').length,
    admins: posts.filter((post) => post.author.role === 'admin').length,
  }), [posts]);

  const loadPosts = async (filter = activeFilter) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.getFeedPosts(filter);
      setPosts(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تحميل منشورات المجتمع القانوني.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts(activeFilter);
  }, [activeFilter]);

  const publishPost = async () => {
    if (!content.trim() && !media) return;
    setIsPublishing(true);
    setError('');
    try {
      const response = await apiClient.createFeedPost({ content, media });
      setPosts((current) => [response.data, ...current]);
      setContent('');
      setMedia(null);
      setToast('تم نشر المنشور في المجتمع القانوني.');
      window.setTimeout(() => setToast(''), 2600);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر نشر المنشور.');
    } finally {
      setIsPublishing(false);
    }
  };

  const replacePost = (updated: FeedPost) => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  };

  const likePost = async (postId: string) => {
    try {
      const response = await apiClient.likeFeedPost(postId);
      replacePost(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تحديث الإعجاب.');
    }
  };

  const addComment = async (postId: string) => {
    const draft = commentDrafts[postId]?.trim();
    if (!draft) return;
    try {
      const response = await apiClient.addFeedComment(postId, draft);
      replacePost(response.data);
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر إضافة التعليق.');
    }
  };

  const saveEdit = async (postId: string) => {
    try {
      const response = await apiClient.updateFeedPost(postId, { content: editingContent });
      replacePost(response.data);
      setEditingPostId(null);
      setEditingContent('');
      setToast('تم تعديل المنشور.');
      window.setTimeout(() => setToast(''), 2200);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تعديل المنشور.');
    }
  };

  const hidePost = async (postId: string) => {
    try {
      await apiClient.updateFeedPost(postId, { status: 'hidden' });
      setPosts((current) => current.filter((post) => post.id !== postId));
      setToast('تم إخفاء المنشور.');
      window.setTimeout(() => setToast(''), 2200);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر إخفاء المنشور.');
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await apiClient.deleteFeedPost(postId);
      setPosts((current) => current.filter((post) => post.id !== postId));
      setToast('تم حذف المنشور.');
      window.setTimeout(() => setToast(''), 2200);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر حذف المنشور.');
    }
  };

  const sharePost = async (postId: string) => {
    const url = `${window.location.origin}/feed#${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('تم نسخ رابط المنشور.');
      window.setTimeout(() => setToast(''), 2200);
    } catch {
      setToast(url);
    }
  };

  return (
    <div className="w-full space-y-6 text-right" dir="rtl">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-gold">المجتمع القانوني</p>
            <h1 className="mt-2 text-3xl font-black text-brand-dark">منشورات موثوقة من المحامين والإدارة</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              مساحة متابعة مختصرة للآراء القانونية، الفيديوهات التوضيحية، وتنبيهات المنصة الرسمية.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xl font-black text-brand-dark">{stats.total}</p>
              <p className="text-[10px] font-black text-slate-400">منشور</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xl font-black text-brand-dark">{stats.videos}</p>
              <p className="text-[10px] font-black text-slate-400">فيديو</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xl font-black text-brand-dark">{stats.admins}</p>
              <p className="text-[10px] font-black text-slate-400">إعلان</p>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {(error || toast) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-2xl border px-4 py-3 text-sm font-black ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}
          >
            {error || toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {canCreatePost ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <img src={user?.img || 'https://i.pravatar.cc/150'} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200" />
                <div>
                  <p className="text-sm font-black text-brand-dark">{user?.name}</p>
                  <p className="text-[11px] font-bold text-slate-400">{user?.role === 'admin' ? 'إدارة المنصة' : 'محامٍ موثق'}</p>
                </div>
              </div>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="اكتب توضيحاً قانونياً، تنبيهاً، أو شارك فيديو قصير..."
                className="w-full resize-none rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-700 outline-none transition focus:border-brand-navy focus:bg-white"
              />
              {media && (
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                  <button onClick={() => setMedia(null)} className="text-red-600">إزالة</button>
                  <span className="truncate">{media.name}</span>
                </div>
              )}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 transition hover:border-brand-navy hover:text-brand-navy">
                  <i className="fa-solid fa-photo-film"></i>
                  صورة أو فيديو
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(event) => setMedia(event.target.files?.[0] || null)}
                  />
                </label>
                <button
                  onClick={publishPost}
                  disabled={isPublishing || (!content.trim() && !media)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-navy px-5 py-3 text-sm font-black text-white shadow-lg shadow-brand-navy/15 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  {isPublishing ? 'جاري النشر...' : 'نشر'}
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy">
                  <i className="fa-solid fa-eye"></i>
                </div>
                <div>
                  <p className="text-sm font-black text-brand-dark">يمكنك المتابعة والتفاعل</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">النشر متاح فقط للمحامين الموثقين وإدارة المنصة.</p>
                </div>
              </div>
            </section>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`inline-flex min-w-fit items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black transition ${activeFilter === filter.id ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/15' : 'border border-slate-200 bg-white text-slate-500 hover:text-brand-navy'}`}
              >
                <i className={`fa-solid ${filter.icon}`}></i>
                {filter.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState icon="comments" title="لا توجد منشورات حالياً" description="جرّب فلتر آخر أو عد لاحقاً لمتابعة منشورات المحامين الموثقين." />
          ) : (
            <div className="space-y-5">
              {posts.map((post) => {
                const canManage = user?.role === 'admin' || user?.id === post.author.id;
                const isEditing = editingPostId === post.id;
                return (
                  <article key={post.id} id={post.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <img src={post.author.avatar} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-black text-brand-dark">{post.author.name}</h2>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${post.author.role === 'admin' ? 'bg-brand-gold/20 text-brand-dark' : 'bg-brand-navy/5 text-brand-navy'}`}>
                              {post.author.roleLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] font-bold text-slate-400">{formatDate(post.createdAt)}</p>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 gap-2">
                          {user?.id === post.author.id && (
                            <button
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditingContent(post.content);
                              }}
                              className="h-9 w-9 rounded-xl bg-slate-50 text-slate-500 transition hover:bg-brand-navy hover:text-white"
                              title="تعديل"
                            >
                              <i className="fa-solid fa-pen text-xs"></i>
                            </button>
                          )}
                          {user?.role === 'admin' && (
                            <button onClick={() => hidePost(post.id)} className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 transition hover:bg-amber-100" title="إخفاء">
                              <i className="fa-solid fa-eye-slash text-xs"></i>
                            </button>
                          )}
                          <button onClick={() => deletePost(post.id)} className="h-9 w-9 rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100" title="حذف">
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      {isEditing ? (
                        <div className="space-y-3">
                          <textarea
                            value={editingContent}
                            onChange={(event) => setEditingContent(event.target.value)}
                            rows={4}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold leading-7 outline-none focus:border-brand-navy"
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingPostId(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">إلغاء</button>
                            <button onClick={() => saveEdit(post.id)} className="rounded-xl bg-brand-navy px-4 py-2 text-xs font-black text-white">حفظ</button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm font-bold leading-8 text-slate-700">{post.content}</p>
                      )}
                    </div>

                    {post.mediaUrl && (
                      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-slate-50">
                        {post.mediaType === 'video' ? (
                          <video src={post.mediaUrl} controls className="max-h-[520px] w-full bg-black object-contain" />
                        ) : (
                          <img src={post.mediaUrl} alt="" className="max-h-[520px] w-full object-cover" />
                        )}
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-3">
                      <button onClick={() => likePost(post.id)} className={`rounded-2xl px-3 py-2 text-xs font-black transition ${post.likedByMe ? 'bg-brand-navy text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-brand-navy'}`}>
                        <i className="fa-solid fa-thumbs-up ml-2"></i>
                        إعجاب {post.likesCount}
                      </button>
                      <button className="rounded-2xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-brand-navy">
                        <i className="fa-solid fa-comment ml-2"></i>
                        تعليق {post.commentsCount}
                      </button>
                      <button onClick={() => sharePost(post.id)} className="rounded-2xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-brand-navy">
                        <i className="fa-solid fa-share-nodes ml-2"></i>
                        مشاركة
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {post.comments.slice(-3).map((comment) => (
                        <div key={comment.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                          <img src={comment.author.avatar} alt="" className="h-9 w-9 rounded-xl object-cover" />
                          <div>
                            <p className="text-xs font-black text-brand-dark">{comment.author.name}</p>
                            <p className="mt-1 text-xs font-bold leading-6 text-slate-600">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          value={commentDrafts[post.id] || ''}
                          onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') addComment(post.id);
                          }}
                          placeholder="اكتب تعليقاً مهنياً..."
                          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold outline-none focus:border-brand-navy focus:bg-white"
                        />
                        <button onClick={() => addComment(post.id)} className="rounded-2xl bg-brand-navy px-4 py-3 text-xs font-black text-white">
                          إرسال
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-brand-dark">قواعد المجتمع</h3>
            <div className="mt-4 space-y-3 text-xs font-bold leading-6 text-slate-500">
              <p>المنشورات تظهر فقط من محامين موثقين أو إدارة المنصة.</p>
              <p>التعليقات متاحة للجميع مع الحفاظ على مهنية النقاش.</p>
              <p>الإدارة تستطيع إخفاء أي محتوى يخالف قواعد المنصة.</p>
            </div>
          </section>
          <section className="rounded-[2rem] border border-brand-gold/20 bg-brand-gold/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy text-brand-gold">
                <i className="fa-solid fa-certificate"></i>
              </div>
              <div>
                <p className="text-sm font-black text-brand-dark">مصادر موثوقة</p>
                <p className="text-[11px] font-bold text-brand-dark/70">فلترة تلقائية للحسابات غير الموثقة</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
