import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { BottomSheet, Button, EmptyState, Pill, Screen, SkeletonCard, Toast } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type FeedFilter = 'all' | 'videos' | 'articles' | 'admins' | 'popular';
type SortMode = 'smart' | 'latest';
type StoryMode = 'new' | 'seen' | 'archive';

const filters: Array<{ id: FeedFilter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'all', label: 'الكل', icon: 'layers-outline' },
  { id: 'videos', label: 'فيديوهات', icon: 'play-circle-outline' },
  { id: 'articles', label: 'مقالات', icon: 'newspaper-outline' },
  { id: 'admins', label: 'الإدارة', icon: 'megaphone-outline' },
  { id: 'popular', label: 'الأكثر تفاعلاً', icon: 'flame-outline' },
];

const paymentMethods = [
  { id: 'zain-cash', label: 'زين كاش', subtitle: 'تأكيد سريع وآمن', icon: 'phone-portrait-outline' as const },
  { id: 'card', label: 'بطاقة مصرفية', subtitle: 'Visa / Mastercard', icon: 'card-outline' as const },
  { id: 'wallet-balance', label: 'رصيد المنصة', subtitle: 'خصم مباشر', icon: 'wallet-outline' as const },
];

const storyModes: Array<{ id: StoryMode; label: string }> = [
  { id: 'new', label: 'جديد' },
  { id: 'seen', label: 'شوهد' },
  { id: 'archive', label: 'الأرشيف' },
];

export function FeedScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('smart');
  const [storyMode, setStoryMode] = useState<StoryMode>('new');
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [storyPosting, setStoryPosting] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('عام');
  const [storyText, setStoryText] = useState('');
  const [commentPostId, setCommentPostId] = useState('');
  const [comment, setComment] = useState('');
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');
  const [activeStory, setActiveStory] = useState<any | null>(null);
  const [consultationPost, setConsultationPost] = useState<any | null>(null);
  const [consultationNote, setConsultationNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0].id);
  const [busyId, setBusyId] = useState('');
  const [status, setStatus] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);

  const canCreate = user?.role === 'admin' || (user?.role === 'pro' && (user?.verified || user?.licenseStatus === 'verified'));
  const categories = useMemo(() => ['عام', ...Array.from(new Set(posts.map((post) => String(post.category || '')).filter(Boolean)))].slice(0, 8), [posts]);
  const topics = useMemo(() => Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).slice(0, 8), [posts]);
  const featuredPosts = useMemo(() => posts.filter((post) => post.featured || post.pinned).slice(0, 3), [posts]);
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
  const storyCounts = useMemo(() => ({
    new: stories.filter((story) => !story.isArchived && !story.seenByMe).length,
    seen: stories.filter((story) => !story.isArchived && story.seenByMe).length,
    archive: stories.filter((story) => story.isArchived).length,
  }), [stories]);
  const visibleStories = useMemo(() => {
    const filtered = stories.filter((story) =>
      storyMode === 'archive' ? story.isArchived : storyMode === 'seen' ? !story.isArchived && story.seenByMe : !story.isArchived && !story.seenByMe
    );
    return filtered.length > 0 || storyMode === 'new' ? filtered : stories.filter((story) => !story.isArchived).slice(0, 8);
  }, [stories, storyMode]);

  const sortedPosts = useMemo(() => {
    if (sortMode === 'latest') return posts;
    return [...posts].sort((left, right) => {
      const leftScore = scorePost(left, interestTerms, authorAffinity);
      const rightScore = scorePost(right, interestTerms, authorAffinity);
      if (right.pinned !== left.pinned) return Number(right.pinned) - Number(left.pinned);
      if (right.featured !== left.featured) return Number(right.featured) - Number(left.featured);
      if (rightScore !== leftScore) return rightScore - leftScore;
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }, [authorAffinity, interestTerms, posts, sortMode]);

  const smartStories = useMemo(() => [...visibleStories].sort((left, right) => scoreStory(right, interestTerms, authorAffinity) - scoreStory(left, interestTerms, authorAffinity)), [authorAffinity, interestTerms, visibleStories]);
  const suggestedLawyers = useMemo(() => [...lawyers].sort((left, right) => scoreLawyer(right, interestTerms, authorAffinity) - scoreLawyer(left, interestTerms, authorAffinity)).slice(0, 5), [authorAffinity, interestTerms, lawyers]);

  const loadPosts = async (filter = activeFilter, offset = 0, append = false) => {
    if (append) setLoadingMore(true);
    else setRefreshing(true);
    setStatus('');
    try {
      const response = await apiClient.getFeedPosts(filter, { limit: 8, offset });
      const incoming = response.data || [];
      setPosts((current) => append ? [...current, ...incoming.filter((post: any) => !current.some((item) => item.id === post.id))] : incoming);
      const meta = (response as any).meta || {};
      setNextOffset(meta.nextOffset ?? offset + incoming.length);
      setHasMore(Boolean(meta.hasMore));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحميل المنشورات.');
    } finally {
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const loadSideData = async () => {
    setLoadingStories(true);
    const [storyResponse, lawyerResponse, intelligenceResponse] = await Promise.all([
      apiClient.getFeedStories('all').catch(() => ({ data: [] })),
      apiClient.getLawyers().catch(() => ({ data: [] })),
      apiClient.getIntelligence().catch(() => ({ data: null })),
    ]);
    setStories(storyResponse.data || []);
    setLawyers(lawyerResponse.data || []);
    setIntelligence(intelligenceResponse.data);
    setLoadingStories(false);
  };

  useEffect(() => {
    loadPosts(activeFilter, 0, false);
  }, [activeFilter]);

  useEffect(() => {
    loadSideData();
  }, []);

  const refresh = async () => {
    await Promise.all([loadPosts(activeFilter, 0, false), loadSideData()]);
  };

  const replacePost = (updated: any) => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  };

  const publishPost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const response = await apiClient.createFeedPost(content.trim(), category);
      setPosts((current) => [response.data, ...current]);
      setContent('');
      setStatus('تم نشر المنشور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر نشر المنشور.');
    } finally {
      setPosting(false);
    }
  };

  const publishStory = async () => {
    if (!storyText.trim()) return;
    setStoryPosting(true);
    try {
      const response = await apiClient.createFeedStory(storyText.trim());
      setStories((current) => [response.data, ...current]);
      setStoryText('');
      setStatus('تم نشر القصة لمدة 24 ساعة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر نشر القصة.');
    } finally {
      setStoryPosting(false);
    }
  };

  const viewStory = async (story: any) => {
    setActiveStory({ ...story, seenByMe: true });
    setStories((current) => current.map((item) => item.id === story.id ? { ...item, seenByMe: true } : item));
    if (story.seenByMe || story.isArchived) return;
    try {
      const response = await apiClient.markFeedStoryViewed(story.id);
      if (response.data) setStories((current) => current.map((item) => item.id === story.id ? response.data : item));
    } catch {
      setStories((current) => current.map((item) => item.id === story.id ? story : item));
    }
  };

  const react = async (id: string, action: 'like' | 'save' | 'share') => {
    setBusyId(`${action}-${id}`);
    try {
      const response =
        action === 'like'
          ? await apiClient.likeFeedPost(id)
          : action === 'save'
            ? await apiClient.saveFeedPost(id)
            : await apiClient.shareFeedPost(id);
      if (response.data) replacePost(response.data);
      if (action === 'share') setStatus('تمت مشاركة المنشور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء.');
    } finally {
      setBusyId('');
    }
  };

  const submitComment = async (postId: string) => {
    if (!comment.trim()) return;
    setBusyId(`comment-${postId}`);
    try {
      const response = await apiClient.addFeedComment(postId, comment.trim());
      if (response.data) replacePost(response.data);
      setComment('');
      setCommentPostId('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر إضافة التعليق.');
    } finally {
      setBusyId('');
    }
  };

  const saveEdit = async () => {
    if (!editingPost || !editContent.trim()) return;
    setBusyId(`edit-${editingPost.id}`);
    try {
      const response = await apiClient.updateFeedPost(editingPost.id, { content: editContent.trim() });
      if (response.data) replacePost(response.data);
      setEditingPost(null);
      setEditContent('');
      setStatus('تم تعديل المنشور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تعديل المنشور.');
    } finally {
      setBusyId('');
    }
  };

  const adminUpdate = async (post: any, payload: { status?: string; pinned?: boolean; featured?: boolean }) => {
    setBusyId(`admin-${post.id}`);
    try {
      const response = await apiClient.updateFeedPost(post.id, payload);
      if (payload.status === 'hidden') setPosts((current) => current.filter((item) => item.id !== post.id));
      else if (response.data) replacePost(response.data);
      setStatus('تم تحديث المنشور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحديث المنشور.');
    } finally {
      setBusyId('');
    }
  };

  const deletePost = async (post: any) => {
    setBusyId(`delete-${post.id}`);
    try {
      await apiClient.deleteFeedPost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setStatus('تم حذف المنشور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر حذف المنشور.');
    } finally {
      setBusyId('');
    }
  };

  const followLawyer = async (lawyerId: string) => {
    setBusyId(`follow-${lawyerId}`);
    try {
      await apiClient.followLawyer(lawyerId);
      setStatus('تمت متابعة المحامي.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر متابعة المحامي.');
    } finally {
      setBusyId('');
    }
  };

  const openConsultation = (post: any) => {
    setConsultationPost(post);
    setConsultationNote(`بخصوص منشورك في المجتمع القانوني: "${String(post.content || '').slice(0, 120)}"`);
    setPaymentMethod(paymentMethods[0].id);
  };

  const startConsultation = async () => {
    if (!consultationPost) return;
    setBusyId('consult');
    try {
      const method = paymentMethods.find((item) => item.id === paymentMethod);
      await apiClient.startLawyerConsultation(consultationPost.author.id, {
        paymentMethod: method?.label || paymentMethod,
        note: consultationNote.trim(),
      });
      setConsultationPost(null);
      setStatus('تم بدء الاستشارة من المنشور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر بدء الاستشارة.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing && posts.length > 0} onRefresh={refresh} />} showsVerticalScrollIndicator={false}>
        <HeroSection
          icon="layers-outline"
          title="المجتمع القانوني"
          subtitle={`${posts.length.toLocaleString('ar-IQ')} منشور · ${sortMode === 'smart' ? 'اقتراحات ذكية' : 'الأحدث أولاً'}`}
          refreshing={refreshing}
          rightElement={
            <Pressable onPress={() => setSortMode(sortMode === 'smart' ? 'latest' : 'smart')} style={styles.headerIcon}>
              <Ionicons name={sortMode === 'smart' ? 'sparkles-outline' : 'time-outline'} size={20} color={colors.blue} />
            </Pressable>
          }
        />

        <Toast message={status} tone={status.includes('تعذر') ? 'error' : 'success'} />

        {canCreate ? (
          <View style={styles.composer}>
            <View style={styles.composerTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{String(user?.name || 'م').charAt(0)}</Text></View>
              <Pressable onPress={() => setComposerOpen((current) => !current)} style={styles.composerPrompt}>
                <Text style={styles.composerPromptText}>{content || 'بماذا تفكر قانونياً؟'}</Text>
              </Pressable>
            </View>
            {composerOpen ? (
              <>
                <TextInput multiline value={content} onChangeText={setContent} placeholder="شارك سؤالاً أو تحديثاً قانونياً" placeholderTextColor={colors.subtle} style={styles.composerInput} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {categories.map((item) => <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />)}
                </ScrollView>
                <Button title="نشر" onPress={publishPost} loading={posting} />
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.viewerNotice}>
            <View style={styles.noticeIcon}><Ionicons name="eye-outline" size={18} color={colors.blue} /></View>
            <View style={styles.flex}>
              <Text style={styles.noticeTitle}>تابع، علّق، واحفظ المحتوى المهم</Text>
              <Text style={styles.mutedText}>النشر متاح للمحامين الموثقين وإدارة المنصة.</Text>
            </View>
          </View>
        )}

        <View style={styles.storyPanel}>
          <View style={styles.rowBetween}>
            {canCreate ? <Pressable onPress={() => setStoryComposerOpen((current) => !current)} style={styles.storyCreate}><Ionicons name="add" size={17} color="#fff" /><Text style={styles.storyCreateText}>قصة</Text></Pressable> : <View />}
            <Text style={styles.sectionTitle}>القصص</Text>
          </View>
          <View style={styles.storyTabs}>
            {storyModes.map((mode) => (
              <Pressable key={mode.id} onPress={() => setStoryMode(mode.id)} style={[styles.storyTab, storyMode === mode.id && styles.storyTabActive]}>
                <Text style={[styles.storyTabText, storyMode === mode.id && styles.storyTabTextActive]}>{mode.label}</Text>
                <Text style={[styles.storyTabCount, storyMode === mode.id && styles.storyTabCountActive]}>{storyCounts[mode.id]}</Text>
              </Pressable>
            ))}
          </View>
          {canCreate && storyComposerOpen ? (
            <View style={styles.storyComposer}>
              <TextInput value={storyText} onChangeText={setStoryText} placeholder="نص قصة قصيرة..." placeholderTextColor={colors.subtle} style={styles.storyInput} />
              <Pressable disabled={!storyText.trim() || storyPosting} onPress={publishStory} style={[styles.storyPublish, (!storyText.trim() || storyPosting) && styles.disabled]}>
                <Ionicons name="send" size={15} color="#fff" />
              </Pressable>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
            {loadingStories && stories.length === 0 ? (
              [1, 2, 3, 4].map((i) => <ShimmerStory key={i} />)
            ) : (
              <>
                {smartStories.length === 0 ? <Text style={styles.mutedText}>{storyMode === 'archive' ? 'لا توجد قصص مؤرشفة حالياً.' : storyMode === 'seen' ? 'لم تشاهد أي قصة بعد.' : 'لا توجد قصص جديدة حالياً.'}</Text> : null}
                {smartStories.map((story) => <StoryBubble key={story.id} story={story} onPress={() => viewStory(story)} />)}
              </>
            )}
          </ScrollView>
        </View>

        <View style={styles.sortPanel}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>ترتيب المنشورات</Text>
            <Text style={styles.mutedText}>{sortMode === 'smart' ? 'الأقرب لاهتماماتك وتفاعلاتك أولاً.' : 'أحدث المنشورات حسب وقت النشر.'}</Text>
          </View>
          <View style={styles.sortToggle}>
            <Pressable onPress={() => setSortMode('smart')} style={[styles.sortOption, sortMode === 'smart' && styles.sortOptionActive]}><Text style={[styles.sortText, sortMode === 'smart' && styles.sortTextActive]}>اقتراحات</Text></Pressable>
            <Pressable onPress={() => setSortMode('latest')} style={[styles.sortOption, sortMode === 'latest' && styles.sortOptionActive]}><Text style={[styles.sortText, sortMode === 'latest' && styles.sortTextActive]}>الأحدث</Text></Pressable>
          </View>
        </View>

        <View style={styles.feedControls}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {filters.map((filter) => <FilterChip key={filter.id} filter={filter} active={activeFilter === filter.id} onPress={() => setActiveFilter(filter.id)} />)}
          </ScrollView>
        </View>

        {featuredPosts.length > 0 ? (
          <View style={styles.featuredPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
              {featuredPosts.map((post) => <Pressable key={post.id} style={styles.featuredItem}><Text style={styles.featuredTitle} numberOfLines={2}>{post.content}</Text><Text style={styles.mutedText}>{post.category}</Text></Pressable>)}
            </ScrollView>
          </View>
        ) : null}

        {topics.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {topics.map((topic) => <View key={topic} style={styles.topicPill}><Text style={styles.topicText}>#{topic}</Text></View>)}
          </ScrollView>
        ) : null}

        {refreshing && posts.length === 0 ? (
          <>
            <SkeletonCard media />
            <SkeletonCard />
            <SkeletonCard media />
          </>
        ) : null}
        {!refreshing && sortedPosts.length === 0 ? <EmptyState title="لا توجد منشورات حالياً" note="جرّب فلتر آخر أو عد لاحقاً لمتابعة محتوى قانوني موثوق." /> : null}

        {sortedPosts.map((post, index) => (
          <React.Fragment key={post.id}>
            <PostCard
              post={post}
              userId={user?.id}
              userRole={user?.role}
              busyId={busyId}
              onLike={() => react(post.id, 'like')}
              onSave={() => react(post.id, 'save')}
              onShare={() => react(post.id, 'share')}
              onComment={() => setCommentPostId(commentPostId === post.id ? '' : post.id)}
              commentOpen={commentPostId === post.id}
              comment={comment}
              onChangeComment={setComment}
              onSubmitComment={() => submitComment(post.id)}
              onConsult={() => openConsultation(post)}
              onFollow={() => followLawyer(post.author.id)}
              onEdit={() => { setEditingPost(post); setEditContent(post.content); }}
              onDelete={() => deletePost(post)}
              onPin={() => adminUpdate(post, { pinned: !post.pinned })}
              onFeature={() => adminUpdate(post, { featured: !post.featured })}
              onHide={() => adminUpdate(post, { status: 'hidden' })}
            />
            {index === 1 && suggestedLawyers.length > 0 ? (
              <View style={styles.inlineLawyers}>
                <View style={styles.rowBetween}><View /><Text style={styles.sectionTitle}>أشخاص قد تتابعهم</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lawyerRow}>
                  {suggestedLawyers.map((lawyer) => <LawyerSuggestion key={lawyer.id} lawyer={lawyer} busy={busyId === `follow-${lawyer.id}`} onFollow={() => followLawyer(lawyer.id)} />)}
                </ScrollView>
              </View>
            ) : null}
          </React.Fragment>
        ))}

        {hasMore ? (
          <Pressable disabled={loadingMore} onPress={() => loadPosts(activeFilter, nextOffset, true)} style={styles.loadMore}>
            {loadingMore ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.loadMoreText}>تحميل المزيد</Text>}
          </Pressable>
        ) : posts.length > 0 ? <Text style={styles.endText}>وصلت إلى نهاية المنشورات</Text> : null}
      </ScrollView>

      <EditModal post={editingPost} content={editContent} loading={busyId === `edit-${editingPost?.id}`} onChange={setEditContent} onClose={() => setEditingPost(null)} onSubmit={saveEdit} />
      <StoryModal story={activeStory} onClose={() => setActiveStory(null)} />
      <ConsultationModal post={consultationPost} note={consultationNote} paymentMethod={paymentMethod} loading={busyId === 'consult'} onChangeNote={setConsultationNote} onChangePayment={setPaymentMethod} onClose={() => setConsultationPost(null)} onSubmit={startConsultation} />
    </Screen>
  );
}

function ShimmerStory() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [anim]);

  return <Animated.View style={[styles.storySkeleton, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] }) }]} />;
}

function PostCard({ post, userId, userRole, busyId, commentOpen, comment, onChangeComment, onSubmitComment, onLike, onSave, onShare, onComment, onConsult, onFollow, onEdit, onDelete, onPin, onFeature, onHide }: any) {
  const [expanded, setExpanded] = useState(false);
  const canManage = userRole === 'admin' || userId === post.author?.id;
  const isLong = String(post.content || '').length > 260;
  const text = expanded || !isLong ? post.content : `${String(post.content || '').slice(0, 260)}...`;
  return (
    <View style={[styles.postCard, post.pinned && styles.pinnedPost]}>
      {(post.pinned || post.author?.role === 'admin') ? (
        <View style={styles.postRibbon}><Text style={styles.postRibbonText}>{post.pinned ? 'منشور مثبت' : 'إعلان رسمي'}</Text><Ionicons name={post.pinned ? 'pin-outline' : 'megaphone-outline'} size={15} color={colors.blue} /></View>
      ) : null}
      <View style={styles.postHeader}>
        {canManage ? (
          <View style={styles.manageRow}>
            {userId === post.author?.id ? <IconButton icon="create-outline" onPress={onEdit} /> : null}
            {userRole === 'admin' ? <><IconButton icon="pin-outline" onPress={onPin} /><IconButton icon="star-outline" onPress={onFeature} /><IconButton icon="eye-off-outline" onPress={onHide} /></> : null}
            <IconButton icon="trash-outline" danger onPress={onDelete} />
          </View>
        ) : null}
        <View style={styles.authorInfo}>
          <Avatar source={post.author?.avatar || post.author?.img} name={post.author?.name || 'م'} />
          <View style={styles.flex}>
            <View style={styles.authorLine}>
              {post.author?.verified ? <Ionicons name="shield-checkmark" size={16} color={colors.blue} /> : null}
              {post.featured ? <Pill label="مميز" tone="gold" /> : null}
              {post.author?.role === 'admin' ? <Pill label="إدارة" tone="blue" /> : <Pill label="محامي" tone="neutral" />}
              <Text style={styles.authorName} numberOfLines={1}>{post.author?.name || post.authorName || 'عضو المنصة'}</Text>
            </View>
            <Text style={styles.mutedText}>{post.author?.specialty || post.author?.roleLabel || post.category} · {formatDate(post.createdAt)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.postText}>{text}</Text>
      {isLong ? <Pressable onPress={() => setExpanded((value) => !value)}><Text style={styles.readMore}>{expanded ? 'عرض أقل' : 'قراءة المزيد'}</Text></Pressable> : null}
      <View style={styles.tagRow}><Text style={styles.tag}>#{post.category || 'عام'}</Text><Text style={styles.tag}>{post.readingTime || 1} دقيقة قراءة</Text></View>
      {post.mediaUrl ? (
        <View style={[styles.mediaBox, post.mediaType === 'image' && styles.imageMediaBox]}>
          {post.mediaType === 'image' ? (
            <Image source={{ uri: post.mediaUrl }} style={styles.postImage} resizeMode="cover" />
          ) : (
            <>
              <Ionicons name="play-circle-outline" size={34} color={colors.blue} />
              <Text style={styles.mutedText}>فيديو مرفق · افتحه من نسخة الويب للمشاهدة الكاملة</Text>
            </>
          )}
        </View>
      ) : null}
      <View style={styles.countRow}><Text style={styles.countText}>{(post.likesCount || 0).toLocaleString('ar-IQ')} إعجاب</Text><Text style={styles.countText}>{post.commentsCount || 0} تعليق · {post.shareCount || 0} مشاركة · {post.savesCount || 0} حفظ</Text></View>
      <View style={styles.actionRow}>
        <Action icon="thumbs-up-outline" label="إعجاب" active={post.likedByMe} loading={busyId === `like-${post.id}`} onPress={onLike} />
        <Action icon="chatbubble-outline" label="تعليق" onPress={onComment} />
        <Action icon="share-social-outline" label="مشاركة" loading={busyId === `share-${post.id}`} onPress={onShare} />
        <Action icon="bookmark-outline" label="حفظ" active={post.savedByMe} loading={busyId === `save-${post.id}`} onPress={onSave} />
      </View>
      {commentOpen ? (
        <View style={styles.inlineComment}>
          <TextInput
            value={comment}
            onChangeText={onChangeComment}
            placeholder="اكتب تعليقاً مهنياً..."
            placeholderTextColor={colors.subtle}
            style={styles.inlineCommentInput}
          />
          <Pressable disabled={!String(comment || '').trim() || busyId === `comment-${post.id}`} onPress={onSubmitComment} style={[styles.inlineCommentSend, (!String(comment || '').trim() || busyId === `comment-${post.id}`) && styles.disabled]}>
            {busyId === `comment-${post.id}` ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
          </Pressable>
        </View>
      ) : null}
      {post.author?.role === 'lawyer' && post.author?.id !== userId ? (
        <View style={styles.lawyerActions}>
          <Pressable onPress={onConsult} style={styles.consultButton}><Ionicons name="card-outline" size={16} color="#fff" /><Text style={styles.consultText}>استشارة</Text></Pressable>
          <Pressable onPress={onFollow} style={styles.followButton}><Ionicons name="add-circle-outline" size={16} color={colors.blue} /><Text style={styles.followText}>متابعة</Text></Pressable>
        </View>
      ) : null}
      {(post.comments || []).slice(-3).map((item: any) => <View key={item.id} style={styles.commentBubble}><Text style={styles.commentAuthor}>{item.author?.name}</Text><Text style={styles.commentText}>{item.content}</Text></View>)}
    </View>
  );
}

function StoryBubble({ story, onPress }: { story: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.storyBubble, !story.seenByMe && styles.storyUnseen]}>
      {story.mediaUrl && story.mediaType === 'image' ? <Image source={{ uri: story.mediaUrl }} style={styles.storyCoverImage} /> : null}
      <Avatar source={story.author?.avatar || story.author?.img} name={story.author?.name || 'م'} small />
      {!story.seenByMe && !story.isArchived ? <Text style={styles.newStoryBadge}>جديد</Text> : null}
      {story.isArchived ? <Text style={styles.archiveStoryBadge}>أرشيف</Text> : null}
      <Text style={styles.storyName} numberOfLines={1}>{story.author?.name || 'قصة'}</Text>
      <Text style={styles.storyText} numberOfLines={2}>{story.text}</Text>
    </Pressable>
  );
}

function LawyerSuggestion({ lawyer, busy, onFollow }: { lawyer: any; busy: boolean; onFollow: () => void }) {
  return (
    <View style={styles.lawyerCard}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{String(lawyer.name || 'م').charAt(0)}</Text></View>
      <Text style={styles.authorName} numberOfLines={1}>{lawyer.name}</Text>
      <Text style={styles.mutedText} numberOfLines={1}>{lawyer.specialty || lawyer.lawyerProfile?.specialty || 'محامٍ'}</Text>
      <Pressable disabled={busy} onPress={onFollow} style={styles.followButton}><Text style={styles.followText}>{busy ? '...' : 'متابعة'}</Text></Pressable>
    </View>
  );
}

function FilterChip({ filter, active, onPress }: { filter: { label: string; icon: keyof typeof Ionicons.glyphMap }; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Ionicons name={filter.icon} size={15} color={active ? '#fff' : colors.navy} /><Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text></Pressable>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function Action({ icon, label, active, loading, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; loading?: boolean; onPress: () => void }) {
  return <Pressable disabled={loading} onPress={onPress} style={[styles.postAction, active && styles.postActionActive]}>{loading ? <ActivityIndicator color={colors.blue} /> : <><Ionicons name={icon} size={16} color={active ? colors.blue : colors.muted} /><Text style={[styles.postActionText, active && styles.activeText]}>{label}</Text></>}</Pressable>;
}

function IconButton({ icon, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.iconButton, danger && styles.dangerButton]}><Ionicons name={icon} size={16} color={danger ? colors.red : colors.muted} /></Pressable>;
}

function Avatar({ source, name, small }: { source?: string | null; name: string; small?: boolean }) {
  const sizeStyle = small ? styles.avatarSmall : styles.avatar;
  if (source) return <Image source={{ uri: source }} style={sizeStyle} />;
  return <View style={sizeStyle}><Text style={styles.avatarText}>{String(name || 'م').charAt(0)}</Text></View>;
}

function CommentModal({ postId, comment, loading, onChange, onClose, onSubmit }: any) {
  return (
    <Modal transparent animationType="slide" visible={Boolean(postId)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalPanel}>
        <Text style={styles.modalTitle}>إضافة تعليق</Text>
        <TextInput multiline value={comment} onChangeText={onChange} placeholder="اكتب تعليقاً مهنياً..." placeholderTextColor={colors.subtle} style={styles.modalInput} />
        <View style={styles.modalActions}><Button title="إلغاء" variant="secondary" onPress={onClose} /><Button title="إرسال" loading={loading} onPress={onSubmit} /></View>
      </View></View>
    </Modal>
  );
}

function EditModal({ post, content, loading, onChange, onClose, onSubmit }: any) {
  return (
    <BottomSheet visible={Boolean(post)} title="تعديل المنشور" onClose={onClose}>
      <TextInput multiline value={content} onChangeText={onChange} placeholder="نص المنشور" placeholderTextColor={colors.subtle} style={styles.modalInput} />
      <View style={styles.modalActions}><Button title="إلغاء" variant="secondary" onPress={onClose} /><Button title="حفظ" loading={loading} onPress={onSubmit} /></View>
    </BottomSheet>
  );
}

function StoryModal({ story, onClose }: { story: any | null; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" visible={Boolean(story)} onRequestClose={onClose}>
      <View style={styles.storyModalBackdrop}><Pressable onPress={onClose} style={styles.storyModalClose}><Ionicons name="close" size={21} color="#fff" /></Pressable><View style={styles.storyModalCard}><Text style={styles.storyModalAuthor}>{story?.author?.name}</Text><Text style={styles.storyModalText}>{story?.text}</Text></View></View>
    </Modal>
  );
}

function ConsultationModal({ post, note, paymentMethod, loading, onChangeNote, onChangePayment, onClose, onSubmit }: any) {
  return (
    <BottomSheet visible={Boolean(post)} title="بدء استشارة من المنشور" onClose={onClose}>
      <Text style={styles.mutedText}>{post?.author?.name} · {post?.author?.consultationFee || 'سعر غير محدد'}</Text>
      {paymentMethods.map((method) => <Pressable key={method.id} onPress={() => onChangePayment(method.id)} style={[styles.paymentItem, paymentMethod === method.id && styles.paymentItemActive]}><Ionicons name={method.icon} size={20} color={colors.navy} /><View style={styles.flex}><Text style={styles.cardTitle}>{method.label}</Text><Text style={styles.mutedText}>{method.subtitle}</Text></View></Pressable>)}
      <TextInput multiline value={note} onChangeText={onChangeNote} placeholder="ملاحظة للمحامي" placeholderTextColor={colors.subtle} style={styles.modalInput} />
      <View style={styles.modalActions}><Button title="إلغاء" variant="secondary" onPress={onClose} /><Button title="ابدأ الاستشارة" loading={loading} onPress={onSubmit} /></View>
    </BottomSheet>
  );
}

function scoreText(terms: string[], ...parts: Array<string | undefined | null>) {
  const text = parts.join(' ').toLowerCase();
  if (!terms.length) return 0;
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function scorePost(post: any, terms: string[], affinity: Map<string, number>) {
  const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt || 0).getTime()) / 36e5);
  const recencyScore = Math.max(0, 1.2 - ageHours / 72);
  const engagement = Math.log1p((post.likesCount || 0) + (post.commentsCount || 0) * 2 + (post.savesCount || 0) * 2 + (post.shareCount || 0)) / 4;
  const mediaScore = post.mediaType === 'video' ? 0.25 : post.mediaType === 'image' ? 0.15 : 0;
  return scoreText(terms, post.category, post.content, post.author?.specialty, post.author?.name) * 1.6 +
    (affinity.get(post.author?.id) || 0) * 1.4 +
    engagement +
    recencyScore +
    mediaScore +
    (post.featured ? 1.5 : 0) +
    (post.pinned ? 1 : 0) +
    (post.savedByMe ? 0.5 : 0) +
    (post.likedByMe ? 0.25 : 0);
}

function scoreStory(story: any, terms: string[], affinity: Map<string, number>) {
  const ageHours = Math.max(0, (Date.now() - new Date(story.createdAt || 0).getTime()) / 36e5);
  return scoreText(terms, story.text, story.author?.specialty, story.author?.name) +
    (affinity.get(story.author?.id) || 0) * 1.2 +
    (!story.seenByMe ? 1 : 0) +
    Math.max(0, 1 - ageHours / 24);
}

function scoreLawyer(lawyer: any, terms: string[], affinity: Map<string, number>) {
  return scoreText(terms, lawyer.specialty, lawyer.lawyerProfile?.specialty, lawyer.name) * 1.5 +
    (affinity.get(lawyer.id) || 0) * 1.8 +
    Math.min(1, (lawyer.followers || 0) / 1000);
}

function formatDate(value?: string) {
  if (!value) return 'الآن';
  return new Date(value).toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  actionRow: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row-reverse', gap: 2, marginTop: 10, paddingTop: 4 },
  activeText: { color: colors.blue },
  archiveStoryBadge: { backgroundColor: 'rgba(16,24,40,0.72)', borderRadius: 999, color: '#fff', fontSize: 9, fontWeight: '900', left: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, position: 'absolute', top: 8 },
  authorInfo: { alignItems: 'center', flex: 1, flexDirection: 'row-reverse', gap: 10 },
  authorLine: { alignItems: 'center', flexDirection: 'row-reverse', gap: 6 },
  authorName: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  avatar: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  avatarSmall: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  chip: { backgroundColor: colors.tint, borderRadius: 999, minHeight: 34, justifyContent: 'center', paddingHorizontal: 11 },
  chipActive: { backgroundColor: colors.navy },
  chipRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  chipText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: '#fff' },
  commentAuthor: { color: colors.ink, fontSize: 11, fontWeight: '900', textAlign: 'right' },
  commentBubble: { alignSelf: 'flex-end', backgroundColor: colors.tint, borderRadius: 16, marginTop: 8, maxWidth: '92%', padding: 9 },
  commentText: { color: colors.ink, fontSize: 12, fontWeight: '700', lineHeight: 19, marginTop: 3, textAlign: 'right' },
  composer: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10
  },
  composerInput: { backgroundColor: colors.surface, borderRadius: 12, color: colors.ink, marginTop: 10, minHeight: 80, padding: 12, textAlign: 'right', textAlignVertical: 'top', borderColor: colors.line, borderWidth: 1 },
  composerPrompt: { backgroundColor: colors.tint, borderRadius: 999, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
  composerPromptText: { color: colors.muted, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  composerTop: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10 },
  consultButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 6, justifyContent: 'center', minHeight: 38 },
  consultText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  countRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12 },
  countText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  dangerButton: { backgroundColor: colors.redTint },
  disabled: { opacity: 0.45 },
  endText: { color: colors.muted, fontSize: 12, fontWeight: '900', marginVertical: 14, textAlign: 'center' },
  featuredItem: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 11, width: 210 },
  featuredPanel: { marginBottom: 8 },
  featuredRow: { flexDirection: 'row-reverse', gap: 9, paddingBottom: 8 },
  featuredTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', lineHeight: 20, textAlign: 'right' },
  feedControls: { marginBottom: 4 },
  feedHeader: { marginBottom: 12 },
  filterChip: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 999, flexDirection: 'row-reverse', gap: 5, minHeight: 38, paddingHorizontal: 11 },
  filterChipActive: { backgroundColor: colors.navy },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  filterText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#fff' },
  flex: { flex: 1 },
  followButton: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 6, justifyContent: 'center', minHeight: 38 },
  followText: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  headerIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  hero: { backgroundColor: colors.paper, borderRadius: 16, marginBottom: 12, padding: 14 },
  heroIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  heroTop: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12 },
  iconButton: { alignItems: 'center', backgroundColor: colors.tint, borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  imageMediaBox: { backgroundColor: '#101828', padding: 0 },
  inlineComment: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  inlineCommentInput: { backgroundColor: colors.tint, borderRadius: 999, color: colors.ink, flex: 1, minHeight: 42, paddingHorizontal: 14, textAlign: 'right' },
  inlineCommentSend: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  lawyerActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  inlineLawyers: { backgroundColor: '#fff', borderRadius: 18, marginBottom: 12, padding: 12 },
  lawyerCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, padding: 12, width: 138 },
  lawyerRow: { flexDirection: 'row-reverse', gap: 10, paddingTop: 8 },
  lawyersPanel: { backgroundColor: colors.surface, borderRadius: 18, marginBottom: 12, padding: 12 },
  loadMore: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 999, justifyContent: 'center', marginVertical: 12, minHeight: 44 },
  loadMoreText: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  manageRow: { flexDirection: 'row', gap: 5 },
  mediaBox: { alignItems: 'center', backgroundColor: colors.tint, borderRadius: 16, gap: 4, marginTop: 12, padding: 18 },
  modalActions: { gap: 9, marginTop: 12 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(16,24,40,0.45)', flex: 1, justifyContent: 'center', padding: 16 },
  modalInput: { backgroundColor: colors.tint, borderRadius: 16, color: colors.ink, minHeight: 96, padding: 12, textAlign: 'right', textAlignVertical: 'top' },
  modalPanel: { backgroundColor: '#fff', borderRadius: 22, maxHeight: '88%', padding: 16, width: '94%' },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginBottom: 10, textAlign: 'right' },
  mutedText: { color: colors.muted, fontSize: 11, fontWeight: '800', lineHeight: 18, marginTop: 4, textAlign: 'right' },
  newStoryBadge: { backgroundColor: colors.blue, borderRadius: 999, color: '#fff', fontSize: 9, fontWeight: '900', left: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, position: 'absolute', top: 8 },
  noticeIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  noticeTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  paymentItem: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, flexDirection: 'row-reverse', gap: 10, marginBottom: 8, padding: 10 },
  paymentItemActive: { backgroundColor: colors.blueTint },
  pinnedPost: { borderColor: colors.blue, borderWidth: 1.5 },
  postAction: { alignItems: 'center', borderRadius: 10, flex: 1, gap: 3, justifyContent: 'center', minHeight: 42 },
  postActionActive: { backgroundColor: colors.blueTint },
  postActionText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  postCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10
  },
  postHeader: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  postImage: { aspectRatio: 1, width: '100%' },
  postRibbon: { alignItems: 'center', backgroundColor: colors.surface, flexDirection: 'row-reverse', gap: 6, marginHorizontal: -14, marginTop: -14, marginBottom: 14, padding: 9 },
  postRibbonText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  postText: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 24, marginTop: 12, textAlign: 'right' },
  readMore: { color: colors.blue, fontSize: 12, fontWeight: '900', marginTop: 6, textAlign: 'right' },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  sortOption: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sortOptionActive: { backgroundColor: colors.paper },
  sortPanel: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 16, flexDirection: 'row-reverse', gap: 12, marginBottom: 12, padding: 12 },
  sortText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  sortTextActive: { color: colors.blue },
  sortToggle: { backgroundColor: colors.tint, borderRadius: 999, flexDirection: 'row-reverse', padding: 3 },
  status: { color: colors.navy, fontSize: 12, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  storyAvatar: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  storyBubble: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 16, minHeight: 138, padding: 10, width: 104 },
  storyComposer: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  storyCoverImage: { borderRadius: 12, height: 70, marginBottom: 8, width: '100%' },
  storyCreate: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, flexDirection: 'row-reverse', gap: 5, minHeight: 34, paddingHorizontal: 10 },
  storyCreateText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  storyInput: { backgroundColor: colors.tint, borderRadius: 999, color: colors.ink, flex: 1, minHeight: 42, paddingHorizontal: 12, textAlign: 'right' },
  storyModalAuthor: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  storyModalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.92)', flex: 1, justifyContent: 'center', padding: 20 },
  storyModalCard: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.18)', borderRadius: 24, borderWidth: 1, justifyContent: 'center', minHeight: 320, padding: 22, width: '92%' },
  storyModalClose: { position: 'absolute', right: 18, top: 48, zIndex: 2 },
  storyModalText: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 34, marginTop: 18, textAlign: 'center' },
  storyName: { color: colors.ink, fontSize: 11, fontWeight: '900', marginTop: 7, textAlign: 'right' },
  storyPanel: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, marginBottom: 12, padding: 12 },
  storyPublish: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  storyRow: { flexDirection: 'row-reverse', gap: 10, paddingTop: 10 },
  storyText: { color: colors.muted, fontSize: 10, fontWeight: '800', lineHeight: 15, marginTop: 5, textAlign: 'right' },
  storySkeleton: { backgroundColor: colors.tint, borderRadius: 16, height: 138, width: 104 },
  storyTab: { alignItems: 'center', borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 5, justifyContent: 'center', minHeight: 32 },
  storyTabActive: { backgroundColor: colors.paper },
  storyTabCount: { backgroundColor: colors.paper, borderRadius: 999, color: colors.subtle, fontSize: 9, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  storyTabCountActive: { backgroundColor: colors.blueTint, color: colors.blue },
  storyTabs: { backgroundColor: colors.tint, borderRadius: 999, flexDirection: 'row-reverse', gap: 4, marginTop: 10, padding: 4 },
  storyTabText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  storyTabTextActive: { color: colors.blue },
  storyUnseen: { borderColor: colors.blue, borderWidth: 2 },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  tag: { backgroundColor: colors.blueTint, borderRadius: 999, color: colors.blue, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4 },
  tagRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'right' },
  topicPill: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  topicText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  viewerNotice: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 16, flexDirection: 'row-reverse', gap: 10, marginBottom: 12, padding: 12 },
});
