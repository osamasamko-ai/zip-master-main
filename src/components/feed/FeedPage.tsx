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
import { useTrackEvent, useUserIntelligence } from '../../hooks/useIntelligence';

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
  const { trackEvent } = useTrackEvent('feed');
  const { data: intelligence, refresh: refreshIntelligence } = useUserIntelligence();
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
  const [postSortMode, setPostSortMode] = useState<'smart' | 'latest'>('smart');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const canCreatePost = user?.role === 'admin' || (user?.role === 'pro' && (user.verified || user.licenseStatus === 'verified'));

  const topics = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category))).filter(Boolean).slice(0, 8),
    [posts]
  );

  const relatedPosts = useMemo(() => posts.filter((post) => post.featured || post.pinned).slice(0, 3), [posts]);
  const interestTerms = useMemo(() => {
    const categories = (intelligence?.topCategories || []).map((item: any) => item.label);
    const searches = (intelligence?.topSearches || []).map((item: any) => item.label);
    return [...categories, ...searches].map((item) => String(item).toLowerCase()).filter(Boolean);
  }, [intelligence]);

  const authorAffinity = useMemo(() => {
    const entries = (intelligence?.topAuthors || []) as Array<{ id: string; count: number }>;
    const maxCount = Math.max(1, ...entries.map((item) => item.count || 0));
    return new Map(entries.map((item) => [item.id, (item.count || 0) / maxCount]));
  }, [intelligence]);

  const scoreText = useCallback((...parts: Array<string | undefined | null>) => {
    const text = parts.join(' ').toLowerCase();
    if (!interestTerms.length) return 0;
    return interestTerms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
  }, [interestTerms]);

  const scorePost = useCallback((post: FeedPost) => {
    const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / 36e5);
    const recencyScore = Math.max(0, 1.2 - ageHours / 72);
    const engagementScore = Math.log1p(post.likesCount + post.commentsCount * 2 + post.savesCount * 2 + post.shareCount) / 4;
    const authorScore = authorAffinity.get(post.author.id) || 0;
    const mediaScore = post.mediaType === 'video' ? 0.25 : post.mediaType === 'image' ? 0.15 : 0;

    return (
      scoreText(post.category, post.content, post.author.specialty, post.author.name) * 1.6 +
      authorScore * 1.4 +
      engagementScore +
      recencyScore +
      mediaScore +
      (post.featured ? 1.5 : 0) +
      (post.pinned ? 1 : 0) +
      (post.savedByMe ? 0.5 : 0) +
      (post.likedByMe ? 0.25 : 0)
    );
  }, [authorAffinity, scoreText]);

  const diversifyPosts = useCallback((items: FeedPost[]) => {
    const selected: FeedPost[] = [];
    const remaining = [...items];
    const categoryCounts = new Map<string, number>();
    const authorCounts = new Map<string, number>();

    while (remaining.length) {
      let bestIndex = 0;
      let bestScore = Number.NEGATIVE_INFINITY;

      remaining.forEach((post, index) => {
        const categoryPenalty = (categoryCounts.get(post.category) || 0) * 0.75;
        const authorPenalty = (authorCounts.get(post.author.id) || 0) * 0.9;
        const score = scorePost(post) - categoryPenalty - authorPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      const [nextPost] = remaining.splice(bestIndex, 1);
      selected.push(nextPost);
      categoryCounts.set(nextPost.category, (categoryCounts.get(nextPost.category) || 0) + 1);
      authorCounts.set(nextPost.author.id, (authorCounts.get(nextPost.author.id) || 0) + 1);
    }

    return selected;
  }, [scorePost]);

  const sortedPosts = useMemo(() => {
    if (postSortMode === 'latest') return posts;

    const sorted = [...posts].sort((left, right) => {
      const scoreDelta = scorePost(right) - scorePost(left);
      if (scoreDelta !== 0) return scoreDelta;
      if (right.pinned !== left.pinned) return Number(right.pinned) - Number(left.pinned);
      if (right.featured !== left.featured) return Number(right.featured) - Number(left.featured);
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
    return diversifyPosts(sorted);
  }, [diversifyPosts, postSortMode, posts, scorePost]);

  const smartStories = useMemo(() => {
    const scored = stories
      .filter((story) => !story.isArchived)
      .map((story) => ({
        story,
        score:
          scoreText(story.text, story.author.specialty, story.author.name) +
          (authorAffinity.get(story.author.id) || 0) * 1.2 +
          (!story.seenByMe ? 1 : 0) +
          Math.max(0, 1 - (Date.now() - new Date(story.createdAt).getTime()) / 36e5 / 24),
      }))
      .sort((left, right) => right.score - left.score)
      .map((item) => item.story);

    return scored;
  }, [authorAffinity, scoreText, stories]);

  const smartLawyers = useMemo(() => {
    const scored = lawyers
      .map((lawyer) => ({
        lawyer,
        score:
          scoreText(lawyer.specialty, lawyer.lawyerProfile?.specialty, lawyer.name) * 1.5 +
          (authorAffinity.get(lawyer.id) || 0) * 1.8 +
          Math.min(1, (lawyer.followers || 0) / 1000),
      }))
      .sort((left, right) => right.score - left.score)
      .map((item) => item.lawyer);

    return scored;
  }, [authorAffinity, lawyers, scoreText]);

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
    trackEvent('feed_filter_changed', { filter: activeFilter });
    loadPosts(activeFilter, 0, false);
  }, [activeFilter, loadPosts, trackEvent]);

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
      trackEvent('feed_post_created', { category: payload.category, hasMedia: Boolean(payload.media) }, response.data?.id);
      void refreshIntelligence();
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
      trackEvent('feed_story_created', { hasMedia: Boolean(payload.media), textLength: payload.text.length }, response.data?.id);
      void refreshIntelligence();
      flash('تم نشر القصة لمدة 24 ساعة.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر نشر القصة.');
    } finally {
      setIsPublishingStory(false);
    }
  };

  const viewStory = async (storyId: string) => {
    const story = stories.find((item) => item.id === storyId);
    trackEvent('feed_story_viewed', {
      authorId: story?.author.id,
      authorName: story?.author.name,
      category: story?.author.specialty,
      title: story?.text,
    }, storyId);
    void refreshIntelligence();
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
      const post = posts.find((item) => item.id === postId);
      trackEvent('feed_post_liked', { category: post?.category, title: post?.content, authorId: post?.author.id }, postId);
      void refreshIntelligence();
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر تحديث الإعجاب.');
    }
  };

  const savePost = async (postId: string) => {
    try {
      const response = await apiClient.saveFeedPost(postId);
      replacePost(response.data);
      const post = posts.find((item) => item.id === postId);
      trackEvent('feed_post_saved', { category: post?.category, title: post?.content, authorId: post?.author.id }, postId);
      void refreshIntelligence();
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
      const post = posts.find((item) => item.id === postId);
      trackEvent('feed_post_shared', { category: post?.category, title: post?.content, authorId: post?.author.id }, postId);
      flash('تم نسخ رابط المنشور.');
    } catch {
      flash(url);
    }
  };

  const addComment = async (postId: string, content: string) => {
    try {
      const response = await apiClient.addFeedComment(postId, content);
      replacePost(response.data);
      const post = posts.find((item) => item.id === postId);
      trackEvent('feed_post_commented', { category: post?.category, title: post?.content, authorId: post?.author.id }, postId);
      void refreshIntelligence();
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
      const lawyer = lawyers.find((item) => item.id === lawyerId);
      trackEvent('feed_lawyer_followed', {
        lawyerName: lawyer?.name,
        category: lawyer?.lawyerProfile?.specialty || lawyer?.specialty,
      }, lawyerId);
      void refreshIntelligence();
      flash('تمت متابعة المحامي.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'تعذر متابعة المحامي.');
    }
  };

  const openPost = (postId: string) => {
    const post = posts.find((item) => item.id === postId);
    trackEvent('feed_post_opened', { category: post?.category, title: post?.content, authorId: post?.author.id }, postId);
    document.getElementById(postId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="w-full min-w-0 bg-[#f0f2f5] px-0 pb-10 text-right sm:px-2" dir="rtl">
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
              stories={smartStories.length ? smartStories : stories}
              canCreate={canCreatePost}
              isPublishing={isPublishingStory}
              onCreate={publishStory}
              onView={viewStory}
            />
          </div>
          <FeedFilters activeFilter={activeFilter} onChange={setActiveFilter} />
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">ترتيب المنشورات</h2>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {postSortMode === 'smart'
                    ? 'يتم تقديم المنشورات الأقرب لاهتماماتك وتفاعلاتك.'
                    : 'يتم عرض المنشورات حسب وقت النشر.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1">
                {[
                  { id: 'smart' as const, label: 'حسب الاقتراحات', icon: 'fa-wand-magic-sparkles' },
                  { id: 'latest' as const, label: 'الأحدث', icon: 'fa-clock' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPostSortMode(item.id);
                      trackEvent('feed_post_sort_changed', { mode: item.id, interestTerms });
                    }}
                    className={`rounded-full px-3 py-2 text-[11px] font-black transition ${postSortMode === item.id ? 'bg-white text-[#1877f2] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <i className={`fa-solid ${item.icon} ml-1.5`}></i>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <div className="xl:hidden">
            <SuggestedLawyers lawyers={smartLawyers.length ? smartLawyers : lawyers} onFollow={followLawyer} />
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
              {sortedPosts.map((post) => (
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
          <FeedSidebar posts={posts} suggestedLawyers={smartLawyers.length ? smartLawyers : lawyers} onFollow={followLawyer} onOpenPost={openPost} />
        </aside>
      </div>
    </div>
  );
}
