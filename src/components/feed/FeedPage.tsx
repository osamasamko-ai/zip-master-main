import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../ui/EmptyState';
import FeedFilters from './FeedFilters';
import FeedSidebar from './FeedSidebar';
import PostCard from './PostCard';
import PostComposer from './PostComposer';
import SuggestedLawyers from './SuggestedLawyers';
import TrendingTopics from './TrendingTopics';
import type { FeedFilter, FeedPost, SuggestedLawyer } from './types';

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
      <div className="mt-5 h-52 rounded-[1.5rem] bg-slate-100" />
    </div>
  );
}

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [lawyers, setLawyers] = useState<SuggestedLawyer[]>([]);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const canCreatePost = user?.role === 'pro' || user?.role === 'admin';

  const stats = useMemo(() => ({
    total: posts.length,
    videos: posts.filter((post) => post.mediaType === 'video').length,
    admins: posts.filter((post) => post.author.role === 'admin').length,
  }), [posts]);

  const topics = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category))).filter(Boolean).slice(0, 8),
    [posts]
  );

  const relatedPosts = useMemo(() => posts.filter((post) => post.featured || post.pinned).slice(0, 3), [posts]);
  const visiblePosts = posts.slice(0, visibleCount);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const replacePost = (updated: FeedPost) => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  };

  const loadPosts = async (filter = activeFilter) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.getFeedPosts(filter);
      setPosts(response.data || []);
      setVisibleCount(6);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تحميل منشورات المجتمع القانوني.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts(activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    apiClient.getLawyers().then((response) => {
      setLawyers((response.data || []).filter((item: any) => item.role === 'pro').slice(0, 5));
    }).catch(() => undefined);
  }, []);

  const publishPost = async (payload: { content: string; category: string; media: File | null }) => {
    setIsPublishing(true);
    setError('');
    try {
      const response = await apiClient.createFeedPost(payload);
      setPosts((current) => [response.data, ...current]);
      flash('تم نشر المنشور في المجتمع القانوني.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر نشر المنشور.');
    } finally {
      setIsPublishing(false);
    }
  };

  const likePost = async (postId: string) => {
    try {
      const response = await apiClient.likeFeedPost(postId);
      replacePost(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تحديث الإعجاب.');
    }
  };

  const savePost = async (postId: string) => {
    try {
      const response = await apiClient.saveFeedPost(postId);
      replacePost(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر حفظ المنشور.');
    }
  };

  const sharePost = async (postId: string) => {
    const url = `${window.location.origin}/feed#${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      const response = await apiClient.shareFeedPost(postId);
      replacePost(response.data);
      flash('تم نسخ رابط المنشور.');
    } catch {
      flash(url);
    }
  };

  const addComment = async (postId: string, content: string) => {
    try {
      const response = await apiClient.addFeedComment(postId, content);
      replacePost(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر إضافة التعليق.');
    }
  };

  const editPost = async (postId: string, content: string) => {
    try {
      const response = await apiClient.updateFeedPost(postId, { content });
      replacePost(response.data);
      flash('تم تعديل المنشور.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تعديل المنشور.');
    }
  };

  const adminUpdate = async (postId: string, payload: { status?: string; pinned?: boolean; featured?: boolean }, message: string) => {
    try {
      const response = await apiClient.updateFeedPost(postId, payload);
      if (payload.status === 'hidden') setPosts((current) => current.filter((post) => post.id !== postId));
      else replacePost(response.data);
      flash(message);
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تحديث المنشور.');
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await apiClient.deleteFeedPost(postId);
      setPosts((current) => current.filter((post) => post.id !== postId));
      flash('تم حذف المنشور.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر حذف المنشور.');
    }
  };

  const followLawyer = async (lawyerId: string) => {
    try {
      await apiClient.followLawyer(lawyerId);
      flash('تمت متابعة المحامي.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر متابعة المحامي.');
    }
  };

  const openPost = (postId: string) => {
    document.getElementById(postId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="w-full space-y-6 text-right" dir="rtl">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="relative p-6">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-brand-gold/20 to-transparent" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-gold">المجتمع القانوني</p>
              <h1 className="mt-2 text-3xl font-black text-brand-dark">منصة معرفة قانونية حية وموثوقة</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
                تابع تنبيهات الإدارة، فيديوهات المحامين، والمقالات العملية في مساحة اجتماعية مهنية مصممة للقراءة والمشاهدة والتفاعل.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <Stat label="منشور" value={stats.total} />
              <Stat label="فيديو" value={stats.videos} />
              <Stat label="إعلان" value={stats.admins} />
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-5">
          <PostComposer user={user} canCreate={canCreatePost} isPublishing={isPublishing} onPublish={publishPost} />
          <FeedFilters activeFilter={activeFilter} onChange={setActiveFilter} />
          {topics.length > 0 && <TrendingTopics topics={topics} />}
          <SuggestedLawyers lawyers={lawyers} onFollow={followLawyer} />

          {relatedPosts.length > 0 && (
            <section className="rounded-[2rem] border border-brand-gold/20 bg-brand-gold/10 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black text-brand-dark">منشورات تستحق المتابعة</h2>
                <i className="fa-solid fa-sparkles text-brand-gold"></i>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {relatedPosts.map((post) => (
                  <button key={post.id} onClick={() => openPost(post.id)} className="rounded-2xl bg-white/80 p-3 text-right transition hover:bg-white hover:shadow-sm">
                    <p className="line-clamp-2 text-xs font-black leading-6 text-brand-dark">{post.content}</p>
                    <p className="mt-2 text-[10px] font-bold text-slate-400">{post.category}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isLoading ? (
            <div className="space-y-4">
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10">
              <EmptyState icon="comments" title="لا توجد منشورات حالياً" description="جرّب فلتر آخر أو عد لاحقاً لمتابعة محتوى قانوني موثوق." />
            </div>
          ) : (
            <div className="space-y-5">
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  onLike={likePost}
                  onSave={savePost}
                  onShare={sharePost}
                  onComment={addComment}
                  onEdit={editPost}
                  onDelete={deletePost}
                  onHide={(id) => adminUpdate(id, { status: 'hidden' }, 'تم إخفاء المنشور.')}
                  onPin={(id, pinned) => adminUpdate(id, { pinned }, pinned ? 'تم تثبيت المنشور.' : 'تم إلغاء التثبيت.')}
                  onFeature={(id, featured) => adminUpdate(id, { featured }, featured ? 'تم تمييز المنشور.' : 'تم إلغاء التمييز.')}
                  onFollow={followLawyer}
                />
              ))}
              {visibleCount < posts.length && (
                <button onClick={() => setVisibleCount((count) => count + 5)} className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-brand-navy shadow-sm transition hover:border-brand-navy hover:shadow-lg">
                  تحميل المزيد من المنشورات
                </button>
              )}
            </div>
          )}
        </main>

        <FeedSidebar posts={posts} suggestedLawyers={lawyers} onFollow={followLawyer} onOpenPost={openPost} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xl font-black text-brand-dark">{value}</p>
      <p className="text-[10px] font-black text-slate-400">{label}</p>
    </div>
  );
}
