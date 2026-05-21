import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../ui/EmptyState';
import FeedFilters from './FeedFilters';
import FeedSidebar from './FeedSidebar';
import PostCard from './PostCard';
import PostComposer from './PostComposer';
import SuggestedLawyers from './SuggestedLawyers';
import StoryStrip from './StoryStrip';
import TrendingTopics from './TrendingTopics';
import type { FeedFilter, FeedPost, FeedStory, SuggestedLawyer } from './types';

const FEED_PAGE_SIZE = 8;

function SkeletonPost() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex animate-pulse gap-3">
        <div className="h-11 w-11 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-slate-100" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 rounded bg-slate-100" />
        <div className="h-3 w-4/5 rounded bg-slate-100" />
      </div>
      <div className="mt-5 h-52 rounded-md bg-slate-100" />
    </div>
  );
}

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<FeedStory[]>([]);
  const [lawyers, setLawyers] = useState<SuggestedLawyer[]>([]);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishingStory, setIsPublishingStory] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const canCreatePost = user?.role === 'admin' || (user?.role === 'pro' && (user.verified || user.licenseStatus === 'verified'));

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
  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const replacePost = (updated: FeedPost) => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  };

  const loadPosts = useCallback(async (filter = activeFilter, offset = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    if (!append) setError('');
    try {
      const response = await apiClient.getFeedPosts(filter, { limit: FEED_PAGE_SIZE, offset });
      const incomingPosts = response.data || [];
      setPosts((current) => {
        if (!append) return incomingPosts;
        const existingIds = new Set(current.map((post) => post.id));
        return [...current, ...incomingPosts.filter((post) => !existingIds.has(post.id))];
      });
      setNextOffset(response.meta?.nextOffset ?? offset + incomingPosts.length);
      setHasMorePosts(Boolean(response.meta?.hasMore));
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تحميل منشورات تواصل.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeFilter]);

  const loadStories = async () => {
    try {
      const response = await apiClient.getFeedStories();
      setStories(response.data || []);
    } catch {
      setStories([]);
    }
  };

  useEffect(() => {
    setPosts([]);
    setNextOffset(0);
    setHasMorePosts(false);
    loadPosts(activeFilter, 0, false);
  }, [activeFilter, loadPosts]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || isLoading || isLoadingMore || !hasMorePosts) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadPosts(activeFilter, nextOffset, true);
        }
      },
      { rootMargin: '520px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeFilter, hasMorePosts, isLoading, isLoadingMore, loadPosts, nextOffset]);

  useEffect(() => {
    loadStories();
    apiClient.getLawyers().then((response) => {
      setLawyers((response.data || []).slice(0, 5));
    }).catch(() => undefined);
  }, []);

  const publishPost = async (payload: { content: string; category: string; media: File | null }) => {
    setIsPublishing(true);
    setError('');
    try {
      const response = await apiClient.createFeedPost(payload);
      setPosts((current) => [response.data, ...current]);
      setNextOffset((offset) => offset + 1);
      flash('تم نشر المنشور في تواصل.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر نشر المنشور.');
    } finally {
      setIsPublishing(false);
    }
  };

  const publishStory = async (payload: { text: string; media: File | null }) => {
    setIsPublishingStory(true);
    setError('');
    try {
      const response = await apiClient.createFeedStory(payload);
      setStories((current) => [response.data, ...current]);
      flash('تم نشر القصة لمدة 24 ساعة.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر نشر القصة.');
    } finally {
      setIsPublishingStory(false);
    }
  };

  const viewStory = async (storyId: string) => {
    const previousStories = stories;
    setStories((current) =>
      current.map((story) =>
        story.id === storyId
          ? { ...story, seenByMe: true, viewedAt: new Date().toISOString() }
          : story
      )
    );

    try {
      const response = await apiClient.markFeedStoryViewed(storyId);
      setStories((current) => current.map((story) => (story.id === storyId ? response.data : story)));
    } catch (err: any) {
      setStories(previousStories);
      setError(err.response?.data?.error || 'تعذر تحديث مشاهدة القصة.');
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
      setNextOffset((offset) => Math.max(0, offset - 1));
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
    <div className="w-full min-w-0 bg-[#f0f2f5] px-0 pb-10 text-right sm:px-2" dir="rtl">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="relative px-4 py-3 sm:px-5 sm:py-4">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#1877f2]">تواصل</p>
              <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">آخر منشورات تواصل</h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
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
            className={`my-4 rounded-lg border px-4 py-3 text-sm font-black ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}
          >
            {error || toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(220px,280px)_minmax(0,680px)_minmax(280px,340px)] xl:items-start xl:justify-center">
        <aside className="hidden space-y-4 xl:block xl:sticky xl:top-24">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">اختصارات</h2>
            <div className="mt-3 space-y-1">
              {[
                { label: 'آخر الأخبار', icon: 'fa-newspaper' },
                { label: 'فيديوهات قانونية', icon: 'fa-video' },
                { label: 'منشورات محفوظة', icon: 'fa-bookmark' },
                { label: 'المحامون', icon: 'fa-scale-balanced' },
              ].map((item) => (
                <button key={item.label} type="button" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-right text-sm font-black text-slate-700 transition hover:bg-slate-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f3ff] text-[#1877f2]">
                    <i className={`fa-solid ${item.icon} text-xs`}></i>
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </section>
          {topics.length > 0 && <TrendingTopics topics={topics} />}
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="space-y-3">
            <PostComposer user={user} canCreate={canCreatePost} isPublishing={isPublishing} onPublish={publishPost} />
            <StoryStrip
              user={user}
              stories={stories}
              canCreate={canCreatePost}
              isPublishing={isPublishingStory}
              onCreate={publishStory}
              onView={viewStory}
            />
          </div>
          <FeedFilters activeFilter={activeFilter} onChange={setActiveFilter} />
          <div className="xl:hidden">
            <SuggestedLawyers lawyers={lawyers} onFollow={followLawyer} />
          </div>

          {relatedPosts.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">منشورات تستحق المتابعة</h2>
                <i className="fa-solid fa-sparkles text-[#1877f2]"></i>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {relatedPosts.map((post) => (
                  <button key={post.id} onClick={() => openPost(post.id)} className="rounded-md bg-slate-50 p-3 text-right transition hover:bg-slate-100">
                    <p className="line-clamp-2 text-xs font-black leading-6 text-slate-800">{post.content}</p>
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
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10">
              <EmptyState icon="comments" title="لا توجد منشورات حالياً" description="جرّب فلتر آخر أو عد لاحقاً لمتابعة محتوى قانوني موثوق." />
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
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
              <div ref={loadMoreRef} className="min-h-10">
                {isLoadingMore && (
                  <div className="space-y-4">
                    <SkeletonPost />
                    <SkeletonPost />
                  </div>
                )}
                {!isLoadingMore && hasMorePosts && (
                  <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-center text-xs font-black text-slate-400 shadow-sm">
                    جاري تجهيز المزيد عند التمرير...
                  </div>
                )}
                {!hasMorePosts && posts.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-center text-xs font-black text-slate-400 shadow-sm">
                    وصلت إلى نهاية المنشورات
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <aside className="hidden xl:block xl:sticky xl:top-24">
          <FeedSidebar posts={posts} suggestedLawyers={lawyers} onFollow={followLawyer} onOpenPost={openPost} />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xl font-black text-slate-900">{value}</p>
      <p className="text-[10px] font-black text-slate-400">{label}</p>
    </div>
  );
}
