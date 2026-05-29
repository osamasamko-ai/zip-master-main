import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { apiClient } from '../api/client';
import { BottomSheet, Button, EmptyState, Pill, Screen, SkeletonCard, Toast } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

const INSTA_STORY_SIZE = 72;
const INSTA_AVATAR_SIZE = 36;
const POST_IMAGE_ASPECT = 1; // Square like classic Instagram

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

// Scoring Constants for better readability and maintainability
// Post Scoring
const POST_CATEGORY_CONTENT_WEIGHT = 1.6;
const POST_AUTHOR_AFFINITY_WEIGHT = 1.4;
const POST_ENGAGEMENT_COMMENT_SAVE_WEIGHT = 2;
const POST_ENGAGEMENT_SCALING_FACTOR = 4; // Divisor for log1p engagement
const POST_RECENCY_MAX_SCORE = 1.2;
const POST_RECENCY_DECAY_HOURS = 72; // Post loses all recency score after 72 hours
const POST_VIDEO_MEDIA_BOOST = 0.25;
const POST_IMAGE_MEDIA_BOOST = 0.15;
const POST_FEATURED_BOOST = 1.5;
const POST_PINNED_BOOST = 1;
const POST_SAVED_BOOST = 0.5;
const POST_LIKED_BOOST = 0.25;
// Story Scoring
const STORY_AUTHOR_AFFINITY_WEIGHT = 1.2;
const STORY_RECENCY_DECAY_HOURS = 24; // Story loses all recency score after 24 hours
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
  const [storyMedia, setStoryMedia] = useState<any | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
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

  const renderHeader = () => (
    <View>
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
        <Text style={styles.sectionTitle}>القصص اليومية</Text>
        <View style={styles.storyTabs}>
          {storyModes.map((mode) => (
            <Pressable key={mode.id} onPress={() => setStoryMode(mode.id)} style={[styles.storyTab, storyMode === mode.id && styles.storyTabActive]}>
              <Text style={[styles.storyTabText, storyMode === mode.id && styles.storyTabTextActive]}>{mode.label}</Text>
              <Text style={[styles.storyTabCount, storyMode === mode.id && styles.storyTabCountActive]}>{storyCounts[mode.id]}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
          {canCreate && storyMode === 'new' && (
            <InteractiveCard onPress={() => setStoryComposerOpen(true)} style={styles.addStoryBubble}>
              <View style={styles.addStoryCircle}><Ionicons name="add" size={22} color="#fff" /></View>
              <Avatar source={user?.img} name={user?.name || 'م'} small />
              <Text style={styles.storyName} numberOfLines={1}>إضافة قصة</Text>
            </InteractiveCard>
          )}
          {loadingStories && stories.length === 0 ? (
            [1, 2, 3, 4].map((i) => <ShimmerStory key={i} />)
          ) : (
            <>
              {smartStories.length === 0 && !canCreate ? <Text style={styles.mutedText}>{storyMode === 'archive' ? 'لا توجد قصص مؤرشفة حالياً.' : storyMode === 'seen' ? 'لم تشاهد أي قصة بعد.' : 'لا توجد قصص جديدة حالياً.'}</Text> : null}
              {smartStories.map((story, idx) => <StoryBubble key={story.id} story={story} onPress={() => openStoryViewer(idx)} />)}
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

      {!refreshing && sortedPosts.length === 0 ? <EmptyState title="لا توجد منشورات حالياً" note="جرّب فلتر آخر أو عد لاحقاً لمتابعة محتوى قانوني موثوق." /> : null}
    </View>
  );

  const renderFooter = () => (
    <View style={{ paddingBottom: 40 }}>
      {loadingMore ? (
        <ActivityIndicator color={colors.navy} style={{ marginVertical: 20 }} />
      ) : (
        !hasMore && posts.length > 0 && <Text style={styles.endText}>وصلت إلى نهاية المنشورات</Text>
      )}
    </View>
  );

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View>
      <PostCardMemo
        post={item}
        userId={user?.id}
        userRole={user?.role}
        user={user}
        busyId={busyId}
        onLike={() => react(item.id, 'like')}
        onSave={() => react(item.id, 'save')}
        onShare={() => react(item.id, 'share')}
        onComment={() => setCommentPostId(commentPostId === item.id ? '' : item.id)}
        commentOpen={commentPostId === item.id}
        comment={comment}
        onChangeComment={setComment}
        onSubmitComment={() => submitComment(item.id)}
        onConsult={() => openConsultation(item)}
        onFollow={() => followLawyer(item.author.id)}
        onEdit={() => { setEditingPost(item); setEditContent(item.content); }}
        onDelete={() => deletePost(item)}
        onPin={() => adminUpdate(item, { pinned: !item.pinned })}
        onFeature={() => adminUpdate(item, { featured: !item.featured })}
        onHide={() => adminUpdate(item, { status: 'hidden' })}
      />
      {index === 1 && suggestedLawyers.length > 0 ? (
        <View style={styles.inlineLawyers}>
          <View style={styles.rowBetween}><View /><Text style={styles.sectionTitle}>أشخاص قد تتابعهم</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lawyerRow}>
            {suggestedLawyers.map((lawyer) => <LawyerSuggestion key={lawyer.id} lawyer={lawyer} busy={busyId === `follow-${lawyer.id}`} onFollow={() => followLawyer(lawyer.id)} />)}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  const replacePost = (updated: any) => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  };

  const publishPost = async () => {
    if (!content.trim()) return;

    setPosting(true);
    setStatus('');

    try {
      const response = await (apiClient.createFeedPost as any)(content.trim(), category);

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
    if (!storyText.trim() && !storyMedia) return;
    setStoryPosting(true);
    setStatus('');

    try {
      const response = await (apiClient.createFeedStory as any)(storyText.trim());

      setStories((current) => [response.data, ...current]);
      setStoryText('');
      setStoryMedia(null);
      setStatus('تم نشر القصة لمدة 24 ساعة.');
      setStoryComposerOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر نشر القصة.');
    } finally {
      setStoryPosting(false);
    }
  };

  const pickStoryMedia = async () => {
    setStatus('تم تعطيل اختيار الصور مؤقتاً بسبب عدم توافق نسخة expo-image-picker مع نسخة Expo الحالية. شغّل: npx expo install expo-image-picker ثم أعد تفعيل الاستيراد.');
  };

  const openStoryViewer = (index: number) => {
    setActiveStoryIndex(index);
    setActiveStory(true);
  };

  const react = async (id: string, action: 'like' | 'save' | 'share') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyId(`${action}-${id}`);
    try {
      const response = action === 'like'
        ? await apiClient.likeFeedPost(id)
        : action === 'save'
          ? await apiClient.saveFeedPost(id)
          : await apiClient.shareFeedPost(id);

      if (response.data) replacePost(response.data);
      if (action === 'share') setStatus('تمت مشاركة المنشور.');
      if (action === 'save' && response.data.savedByMe) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    <View style={styles.screenContainer}>
      <Toast message={status} tone={status.includes('تعذر') ? 'error' : 'success'} />
      <FlashList
        data={sortedPosts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing && posts.length > 0} onRefresh={refresh} tintColor={colors.navy} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        onEndReached={() => hasMore && !loadingMore && loadPosts(activeFilter, nextOffset, true)}
        onEndReachedThreshold={0.5}
        estimatedItemSize={550}
        ListEmptyComponent={
          refreshing ? (
            <View style={{ padding: 16 }}>
              <SkeletonCard media />
              <SkeletonCard />
            </View>
          ) : null
        }
      />
      <EditModal post={editingPost} content={editContent} loading={busyId === `edit-${editingPost?.id}`} onChange={setEditContent} onClose={() => setEditingPost(null)} onSubmit={saveEdit} />
      <StoryModal visible={Boolean(activeStory)} stories={smartStories} initialIndex={activeStoryIndex} onClose={() => setActiveStory(null)} />
      <StoryComposerModal visible={storyComposerOpen} onClose={() => setStoryComposerOpen(false)} text={storyText} onChange={setStoryText} onPublish={publishStory} onPickMedia={pickStoryMedia} onRemoveMedia={() => setStoryMedia(null)} media={storyMedia} loading={storyPosting} />
      <ConsultationModal post={consultationPost} note={consultationNote} paymentMethod={paymentMethod} loading={busyId === 'consult'} onChangeNote={setConsultationNote} onChangePayment={setPaymentMethod} onClose={() => setConsultationPost(null)} onSubmit={startConsultation} />
    </View>
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

function InteractiveCard({ children, onPress, style }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 8, tension: 40 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 40 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const PostCardMemo = React.memo(PostCard);

function PostCard({ post, userId, userRole, user, busyId, commentOpen, comment, onChangeComment, onSubmitComment, onLike, onSave, onShare, onComment, onConsult, onFollow, onEdit, onDelete, onPin, onFeature, onHide }: any) {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(heartScale.value, [0, 1], [0.5, 1.2])
      }
    ],
    opacity: heartOpacity.value,
  }));

  const lastTap = useRef(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleImagePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!post.likedByMe) {
        onLike();
      }

      heartScale.value = 0;
      heartOpacity.value = 0;

      heartScale.value = withSequence(
        withSpring(1, { damping: 12, stiffness: 100 }),
        withDelay(400, withTiming(0, { duration: 200 }))
      );
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(400, withTiming(0, { duration: 200 }))
      );
    }
    lastTap.current = now;
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const canManage = userRole === 'admin' || userId === post.author?.id;
  const isLong = String(post.content || '').length > 260;
  const text = expanded || !isLong ? post.content : `${String(post.content || '').slice(0, 260)}...`;

  return (
    <Animated.View style={[styles.instaPost, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.instaPostHeader}>
        <Avatar source={post.author?.avatar || post.author?.img} name={post.author?.name || 'م'} />
        <View style={styles.instaPostHeaderInfo}>
          <View style={styles.authorLine}>
            <Text style={styles.instaAuthorName}>{post.author?.name || 'عضو المنصة'}</Text>
            {post.author?.verified && <Ionicons name="shield-checkmark" size={14} color={colors.blue} />}
          </View>
          <Text style={styles.instaPostLocation}>{post.category || 'المجتمع القانوني'}</Text>
        </View>
        <Pressable hitSlop={10} onPress={() => { /* Open more menu */ }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
        </Pressable>
      </View>

      {/* Media Content */}
      {post.mediaUrl ? (
        <Pressable onPress={handleImagePress} style={[styles.mediaBox, post.mediaType === 'image' && styles.imageMediaBox]}>
          {post.mediaType === 'image' ? (
            <>
              <Image source={post.mediaUrl} style={styles.instaPostImage} contentFit="cover" transition={400} />
              <Reanimated.View style={[styles.heartOverlay, animatedHeartStyle]}>
                <Ionicons name="heart" size={80} color="#fff" />
              </Reanimated.View>
            </>
          ) : <View style={styles.videoPlaceholder}><Ionicons name="play" size={40} color="#fff" /></View>}
        </Pressable>
      ) : <View style={styles.textOnlyPostSpacer} />}

      {/* Icons */}
      <View style={styles.instaActionRow}>
        <View style={styles.instaActionLeft}>
          <Pressable onPress={onLike} style={styles.instaIcon}>
            <Ionicons name={post.likedByMe ? "heart" : "heart-outline"} size={26} color={post.likedByMe ? colors.red : colors.ink} />
          </Pressable>
          <Pressable onPress={onComment} style={styles.instaIcon}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.ink} />
          </Pressable>
          <Pressable onPress={onShare} style={styles.instaIcon}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <Pressable onPress={onSave} style={styles.instaIcon}>
          <Ionicons name={post.savedByMe ? "bookmark" : "bookmark-outline"} size={24} color={post.savedByMe ? colors.gold : colors.ink} />
        </Pressable>
      </View>

      {/* Captions & Info */}
      <View style={styles.instaContent}>
        <Text style={styles.instaLikesText}>{(post.likesCount || 0).toLocaleString('ar-IQ')} إعجاب</Text>

        <View style={styles.instaCaptionRow}>
          <Text style={styles.instaCaption}>
            <Text style={styles.instaCaptionAuthor}>{post.author?.name || 'عضو'} </Text>
            {text}
          </Text>
        </View>

        {isLong && <Pressable onPress={toggleExpand}><Text style={styles.instaReadMore}>{expanded ? 'عرض أقل' : 'المزيد'}</Text></Pressable>}

        {post.commentsCount > 0 && (
          <Pressable onPress={onComment}>
            <Text style={styles.instaViewComments}>عرض جميع التعليقات ({post.commentsCount.toLocaleString('ar-IQ')})</Text>
          </Pressable>
        )}

        <Text style={styles.instaTime}>{formatDate(post.createdAt)}</Text>
      </View>

      {commentOpen ? (
        <View style={styles.instaInlineComment}>
          <Avatar source={user?.img} name={user?.name || 'م'} small />
          <TextInput value={comment} onChangeText={onChangeComment} placeholder="أضف تعليقاً..." placeholderTextColor={colors.subtle} style={styles.instaCommentInput} />
          <Pressable onPress={onSubmitComment} disabled={!comment.trim()}><Text style={[styles.instaCommentPost, !comment.trim() && { opacity: 0.5 }]}>نشر</Text></Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

function StoryBubble({ story, onPress }: { story: any; onPress: () => void }) {
  return (
    <InteractiveCard onPress={onPress} style={styles.instaStory}>
      <View style={[styles.instaStoryRing, !story.seenByMe && !story.isArchived && styles.instaStoryRingUnseen]}>
        <View style={styles.instaStoryInner}>
          <Avatar source={story.author?.avatar || story.author?.img} name={story.author?.name || 'م'} />
        </View>
      </View>
      <Text style={styles.instaStoryName} numberOfLines={1}>{story.author?.name?.split(' ')[0]}</Text>
    </InteractiveCard>
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

function EditModal({ post, content, loading, onChange, onClose, onSubmit }: any) {
  return (
    <BottomSheet visible={Boolean(post)} title="تعديل المنشور" onClose={onClose}>
      <TextInput multiline value={content} onChangeText={onChange} placeholder="نص المنشور" placeholderTextColor={colors.subtle} style={styles.modalInput} />
      <View style={styles.modalActions}><Button title="إلغاء" variant="secondary" onPress={onClose} /><Button title="حفظ" loading={loading} onPress={onSubmit} /></View>
    </BottomSheet>
  );
}

function StoryComposerModal({ visible, onClose, text, onChange, onPublish, onPickMedia, onRemoveMedia, media, loading }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.composerModalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.composerModalContent}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.navy} />
            </Pressable>
            <Text style={styles.modalTitle}>نشر قصة يومية</Text>
          </View>

          <View style={styles.storyDraftPreview}>
            {media ? <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <Text style={styles.storyDraftText}>{text || 'شارك خبراً أو نصيحة قانونية سريعة...'}</Text>
          </View>

          <TextInput
            multiline
            value={text}
            onChangeText={onChange}
            placeholder="ما الذي تود مشاركته مع المجتمع؟"
            placeholderTextColor={colors.subtle}
            maxLength={240}
            style={styles.storyModalInput}
          />

          <Pressable onPress={onPickMedia} style={styles.mediaPickerButton}>
            <Ionicons name="images-outline" size={20} color={colors.navy} />
            <Text style={styles.mediaPickerText}>{media ? 'تغيير الوسائط' : 'إرفاق صورة أو فيديو'}</Text>
            {media && <Pressable onPress={onRemoveMedia} style={styles.mediaClear}><Ionicons name="close-circle" size={18} color={colors.red} /></Pressable>}
          </Pressable>

          <View style={styles.modalActions}>
            <Button
              title={loading ? "جاري النشر..." : "نشر القصة الآن"}
              onPress={() => {
                if ((!String(text || '').trim() && !media) || loading) return;
                onPublish();
              }}
              loading={loading}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const REPORT_REASONS = [
  { id: 'harassment', label: 'تحرش أو مضايقة' },
  { id: 'hate', label: 'خطاب كراهية' },
  { id: 'spam', label: 'محتوى غير مرغوب فيه' },
  { id: 'misinfo', label: 'معلومات مضللة' },
  { id: 'other', label: 'أخرى' },
];

function StoryModal({ visible, stories, initialIndex, onClose }: { visible: boolean; stories: any[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportStory, setReportStory] = useState<any>(null);
  const [reporting, setReporting] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);

  const translateY = useSharedValue(0);
  const modalOpacity = useSharedValue(1);

  const closeStory = useCallback(() => {
    onClose();
    translateY.value = 0;
    modalOpacity.value = 1;
  }, [onClose]);

  const swipeGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        modalOpacity.value = interpolate(event.translationY, [0, 300], [1, 0.5], 'clamp');
      }
    })
    .onEnd((event) => {
      if (event.translationY > 150 || event.velocityY > 800) {
        translateY.value = withTiming(height, { duration: 250 }, () => {
          runOnJS(closeStory)();
        });
      } else {
        translateY.value = withSpring(0);
        modalOpacity.value = withSpring(1);
      }
    });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: modalOpacity.value,
  }));

  const handleReport = async (reason: string) => {
    if (!reportStory) return;
    setReporting(true);
    try {
      // In a real app, call apiClient.reportFeedStory(reportStory.id, reason)
      console.log('Story report reason:', reason);
      await new Promise(r => setTimeout(r, 1000));
      setReportModalVisible(false);
      setReportStory(null);
    } finally {
      setReporting(false);
    }
  };

  const handleScroll = (e: any) => {
    const nextIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    if (nextIndex !== currentIndex) setCurrentIndex(nextIndex);
  };

  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  useEffect(() => {
    if (!visible || !stories[currentIndex]) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 6000,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished) {
        if (currentIndex < stories.length - 1) {
          listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
          onClose();
        }
      }
    });
    return () => anim.stop();
  }, [currentIndex, visible, stories]);

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <View style={styles.storyViewerContainer}>
      {item.mediaUrl ? <Image source={{ uri: item.mediaUrl }} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.storyOverlay} />
      <View style={styles.storyProgressRail}>
        <View style={styles.storyProgressBar}>
          <Animated.View style={[styles.storyProgressFill, { width: currentIndex === index ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : index < currentIndex ? '100%' : '0%' }]} />
        </View>
      </View>
      <View style={styles.storyViewerHeader}>
        <View style={styles.authorInfo}>
          <Avatar source={item.author?.avatar} name={item.author?.name} small />
          <View style={styles.flex}>
            <Text style={styles.viewerAuthorName}>{item.author?.name}</Text>
            <Text style={styles.viewerMeta}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.viewerHeaderActions}>
          {item.mediaType === 'video' && (
            <Pressable onPress={() => setIsMuted(!isMuted)} style={styles.viewerHeaderButton}>
              <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color="#fff" />
            </Pressable>
          )}
          <Pressable onPress={() => { setReportStory(item); setReportModalVisible(true); }} style={styles.viewerHeaderButton}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={onClose} style={styles.viewerClose}><Ionicons name="close" size={30} color="#fff" /></Pressable>
        </View>
      </View>
      <View style={styles.viewerContent}>
        <View style={styles.viewerTextContainer}><Text style={styles.viewerText}>{item.text}</Text></View>
      </View>
      <View style={styles.viewerFooter}>
        <Pressable style={styles.viewerReply}><Ionicons name="chatbubble-outline" size={18} color="#fff" /><Text style={styles.viewerReplyText}>أرسل رداً مهنياً...</Text></Pressable>
      </View>
    </View>
  );

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Modal transparent visible={reportModalVisible} animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
        <Pressable style={styles.reportBackdrop} onPress={() => setReportModalVisible(false)}>
          <View style={styles.reportMenu}>
            <Text style={styles.reportTitle}>الإبلاغ عن القصة</Text>
            {REPORT_REASONS.map(reason => (
              <Pressable key={reason.id} style={styles.reportOption} onPress={() => handleReport(reason.id)}>
                <Text style={styles.reportOptionText}>{reporting ? 'جارٍ الإرسال...' : reason.label}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.reportOption, styles.reportCancel]} onPress={() => setReportModalVisible(false)}>
              <Text style={styles.reportCancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={swipeGesture}>
          <Reanimated.View style={[{ flex: 1 }, animatedContainerStyle]}>
            <FlatList
              ref={listRef}
              data={stories}
              renderItem={renderItem}
              horizontal
              pagingEnabled
              keyExtractor={item => item.id}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              onMomentumScrollEnd={handleScroll}
              showsHorizontalScrollIndicator={false}
            />
          </Reanimated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function scoreText(terms: string[], ...parts: Array<string | undefined | null>) {
  const text = parts.join(' ').toLowerCase();
  if (!terms.length) return 0;
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function scorePost(post: any, terms: string[], affinity: Map<string, number>) {
  const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt || 0).getTime()) / 36e5); // Convert milliseconds to hours
  const recencyScore = Math.max(0, POST_RECENCY_MAX_SCORE - ageHours / POST_RECENCY_DECAY_HOURS);
  const engagement = Math.log1p((post.likesCount || 0) + (post.commentsCount || 0) * POST_ENGAGEMENT_COMMENT_SAVE_WEIGHT + (post.savesCount || 0) * POST_ENGAGEMENT_COMMENT_SAVE_WEIGHT + (post.shareCount || 0)) / POST_ENGAGEMENT_SCALING_FACTOR;
  const mediaScore = post.mediaType === 'video' ? POST_VIDEO_MEDIA_BOOST : post.mediaType === 'image' ? POST_IMAGE_MEDIA_BOOST : 0;
  return scoreText(terms, post.category, post.content, post.author?.specialty, post.author?.name) * POST_CATEGORY_CONTENT_WEIGHT +
    (affinity.get(post.author?.id) || 0) * POST_AUTHOR_AFFINITY_WEIGHT +
    engagement +
    recencyScore +
    mediaScore +
    (post.featured ? POST_FEATURED_BOOST : 0) +
    (post.pinned ? POST_PINNED_BOOST : 0) +
    (post.savedByMe ? POST_SAVED_BOOST : 0) +
    (post.likedByMe ? POST_LIKED_BOOST : 0);
}

function scoreStory(story: any, terms: string[], affinity: Map<string, number>) {
  const ageHours = Math.max(0, (Date.now() - new Date(story.createdAt || 0).getTime()) / 36e5);
  return scoreText(terms, story.text, story.author?.specialty, story.author?.name) + // Base text relevance
    (affinity.get(story.author?.id) || 0) * STORY_AUTHOR_AFFINITY_WEIGHT + // Author affinity
    (!story.seenByMe ? 1 : 0) + // Boost for unseen stories
    Math.max(0, 1 - ageHours / STORY_RECENCY_DECAY_HOURS); // Recency decay over 24 hours
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

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: colors.paper },
  authorLine: { alignItems: 'center', flexDirection: 'row-reverse', gap: 4 },
  avatar: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: INSTA_AVATAR_SIZE, justifyContent: 'center', width: INSTA_AVATAR_SIZE },
  avatarSmall: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  chip: { backgroundColor: colors.tint, borderRadius: 999, minHeight: 34, justifyContent: 'center', paddingHorizontal: 11 },
  chipActive: { backgroundColor: colors.navy },
  chipRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  chipText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: '#fff' },

  // INSTAGRAM POST STYLES
  instaPost: { backgroundColor: '#fff', marginBottom: 16 },
  instaPostHeader: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, gap: 10 },
  instaPostHeaderInfo: { flex: 1, alignItems: 'flex-end' },
  instaAuthorName: { fontSize: 14, fontWeight: '900', color: colors.ink },
  instaPostLocation: { fontSize: 11, color: colors.muted, marginTop: 1 },
  instaPostImage: { width: '100%', aspectRatio: POST_IMAGE_ASPECT },
  instaActionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  instaActionLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 16 },
  instaIcon: { padding: 2 },
  instaContent: { paddingHorizontal: 14 },
  instaLikesText: { fontSize: 14, fontWeight: '900', color: colors.ink, marginBottom: 5, textAlign: 'right' },
  instaCaptionRow: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  instaCaption: { fontSize: 14, color: colors.ink, lineHeight: 21, textAlign: 'right' },
  instaCaptionAuthor: { fontWeight: '900', color: colors.ink },
  instaReadMore: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'right', fontWeight: '700' },
  instaViewComments: { fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'right', fontWeight: '600' },
  instaTime: { fontSize: 10, color: colors.subtle, marginTop: 8, textAlign: 'right', textTransform: 'uppercase' },

  // INSTAGRAM COMMENT INPUT
  instaInlineComment: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopColor: colors.line, borderTopWidth: 0.5, gap: 10 },
  instaCommentInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 4, textAlign: 'right' },
  instaCommentPost: { fontSize: 14, fontWeight: '900', color: colors.blue },

  // INSTAGRAM STORY STYLES
  instaStory: { alignItems: 'center', width: INSTA_STORY_SIZE + 10, gap: 6 },
  instaStoryRing: { width: INSTA_STORY_SIZE, height: INSTA_STORY_SIZE, borderRadius: 999, padding: 2.5, backgroundColor: colors.line, justifyContent: 'center', alignItems: 'center' },
  instaStoryRingUnseen: { backgroundColor: colors.gold }, // Or use a linear gradient if available
  instaStoryInner: { width: '100%', height: '100%', borderRadius: 999, backgroundColor: '#fff', padding: 2.5, justifyContent: 'center', alignItems: 'center' },
  instaStoryName: { fontSize: 11, fontWeight: '700', color: colors.ink },
  addStoryBubble: { alignItems: 'center', gap: 6, width: INSTA_STORY_SIZE + 10 },
  addStoryCircle: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 22, justifyContent: 'center', position: 'absolute', left: 5, bottom: 20, width: 22, zIndex: 10, borderWidth: 2, borderColor: '#fff' },

  composer: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 20, borderWidth: 1, marginBottom: 16, padding: 16, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 4 },
  composerPrompt: { flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
  composerPromptText: { color: colors.muted, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  composerTop: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10 },
  composerInput: { backgroundColor: colors.tint, borderRadius: 12, padding: 12, textAlign: 'right', minHeight: 80, color: colors.ink, marginBottom: 10 },

  disabled: { opacity: 0.45 },
  endText: { color: colors.muted, fontSize: 12, fontWeight: '900', marginVertical: 14, textAlign: 'center' },
  feedControls: { marginBottom: 4 },
  filterChip: { alignItems: 'center', backgroundColor: colors.tint, borderRadius: 999, flexDirection: 'row-reverse', gap: 5, minHeight: 34, paddingHorizontal: 12 },
  filterChipActive: { backgroundColor: colors.navy },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  filterText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#fff' },
  flex: { flex: 1 },
  heartOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  iconButton: { alignItems: 'center', backgroundColor: colors.tint, borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  imageMediaBox: { backgroundColor: '#000' },
  mediaBox: { width: '100%', aspectRatio: POST_IMAGE_ASPECT },
  videoPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.navy, justifyContent: 'center', alignItems: 'center' },
  textOnlyPostSpacer: { height: 12 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', marginBottom: 10 },
  storyRow: { flexDirection: 'row-reverse', gap: 12, paddingTop: 10 },
  storySkeleton: { backgroundColor: colors.tint, borderRadius: 999, height: INSTA_STORY_SIZE, width: INSTA_STORY_SIZE },
  storyPanel: { borderBottomColor: colors.line, borderBottomWidth: 0.5, paddingBottom: 16, marginBottom: 4, paddingHorizontal: 12 },

  // Header & Sort
  headerIcon: { padding: 8, borderRadius: 999, backgroundColor: colors.tint },
  viewerNotice: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: colors.tint, borderRadius: 12, padding: 14, marginBottom: 12 },
  noticeIcon: { width: 36, height: 36, borderRadius: 999, backgroundColor: colors.blueTint || colors.tint, justifyContent: 'center', alignItems: 'center' },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: colors.ink, textAlign: 'right' },
  storyTabs: { flexDirection: 'row-reverse', gap: 6, marginBottom: 10 },
  storyTab: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.tint },
  storyTabActive: { backgroundColor: colors.blueTint || colors.tint },
  storyTabText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  storyTabTextActive: { color: colors.blue, fontWeight: '900' },
  storyTabCount: { fontSize: 10, fontWeight: '800', color: colors.subtle },
  storyTabCountActive: { color: colors.blue },
  sortPanel: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.paper, borderBottomWidth: 0.5, borderBottomColor: colors.line, marginBottom: 4 },
  sortToggle: { flexDirection: 'row-reverse', backgroundColor: colors.tint, borderRadius: 999, overflow: 'hidden' },
  sortOption: { paddingVertical: 6, paddingHorizontal: 12 },
  sortOptionActive: { backgroundColor: colors.navy },
  sortText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  sortTextActive: { color: '#fff' },

  // Featured & Topics
  featuredPanel: { marginVertical: 8 },
  featuredRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12 },
  featuredItem: { backgroundColor: colors.tint, borderRadius: 12, padding: 12, width: 180 },
  featuredTitle: { fontSize: 13, fontWeight: '800', color: colors.ink, textAlign: 'right', lineHeight: 20 },
  topicPill: { backgroundColor: colors.surface || colors.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  topicText: { fontSize: 12, fontWeight: '700', color: colors.blue },

  // Lawyers
  inlineLawyers: { backgroundColor: colors.paper, padding: 12, borderTopWidth: 0.5, borderTopColor: colors.line },
  lawyerRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 8 },
  lawyerCard: { alignItems: 'center', backgroundColor: colors.tint, borderRadius: 12, padding: 12, width: 120 },
  followButton: { marginTop: 8, backgroundColor: colors.blue, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, minWidth: 70, alignItems: 'center' },
  followText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  // Modal & Common
  modalActions: { gap: 10, marginTop: 16 },
  modalInput: { backgroundColor: colors.tint, borderRadius: 12, padding: 12, textAlign: 'right', minHeight: 80 },
  rowBetween: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mutedText: { fontSize: 12, color: colors.muted, textAlign: 'right' },
  statusBadge: { fontSize: 10, fontWeight: '900', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  paymentItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.tint, marginBottom: 8 },
  paymentItemActive: { borderColor: colors.blue, borderWidth: 1.5, backgroundColor: colors.blueTint || colors.tint },
  modalHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  closeButton: { padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'right' },
  composerModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  composerModalContent: { backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  storyDraftPreview: { backgroundColor: colors.navy, borderRadius: 16, height: 180, justifyContent: 'center', alignItems: 'center', padding: 20, marginBottom: 16, overflow: 'hidden' },
  storyDraftText: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  storyModalInput: { backgroundColor: colors.tint, borderRadius: 12, padding: 12, textAlign: 'right', minHeight: 60, color: colors.ink, marginBottom: 12 },
  mediaPickerButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.tint, borderRadius: 12, marginBottom: 12 },
  mediaPickerText: { fontSize: 13, fontWeight: '700', color: colors.navy, flex: 1, textAlign: 'right' },
  mediaClear: { marginLeft: 8 },

  // Story Viewer
  storyViewerContainer: { width, flex: 1, backgroundColor: '#000', justifyContent: 'space-between' },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  storyProgressRail: { flexDirection: 'row', gap: 3, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 8 },
  storyProgressBar: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  storyProgressFill: { backgroundColor: '#fff', height: '100%' },
  storyViewerHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  authorInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  viewerAuthorName: { color: '#fff', fontSize: 14, fontWeight: '900' },
  viewerMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  viewerHeaderActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  viewerHeaderButton: { padding: 4 },
  viewerClose: { padding: 4 },
  viewerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  viewerTextContainer: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, padding: 16 },
  viewerText: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
  viewerFooter: { paddingBottom: Platform.OS === 'ios' ? 30 : 10, paddingHorizontal: 12 },
  viewerReply: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  viewerReplyText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  // Report
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  reportMenu: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20 },
  reportTitle: { fontSize: 16, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 12 },
  reportOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, alignItems: 'center' },
  reportOptionText: { fontSize: 14, color: colors.navy, fontWeight: '700' },
  reportCancel: { borderBottomWidth: 0, marginTop: 8 },
  reportCancelText: { color: colors.red, fontWeight: '900' },
});
