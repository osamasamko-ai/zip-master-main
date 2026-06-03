import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, UIManager, View, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { apiClient } from '../api/client';
import { BottomSheet, Button, EmptyState, Pill, Screen, SkeletonCard, Toast } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const POST_MEDIA_ASPECT = 4 / 5;
const STORY_MEDIA_ASPECT = 9 / 16;

type FeedFilter = 'all' | 'videos' | 'articles' | 'admins' | 'popular';
type SortMode = 'smart' | 'latest';
type StoryMode = 'new' | 'seen' | 'archive';
type PickedMedia = ImagePicker.ImagePickerAsset;
type RouteKey =
  | 'lawyers'
  | 'cases'
  | 'ai'
  | 'messages'
  | 'legal'
  | 'contract'
  | 'billing'
  | 'following'
  | 'support'
  | 'settings'
  | 'intelligence'
  | 'pro'
  | 'admin'
  | 'profile'
  | 'feed'
  | 'home'
  | 'more';

type FeedScreenProps = {
  onOpen?: (route: RouteKey) => void;
};

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
const STORY_VIEW_DURATION = 6000;
const STORY_VIDEO_VIEW_DURATION = 12000;
// Story Scoring
const STORY_AUTHOR_AFFINITY_WEIGHT = 1.2;
const STORY_RECENCY_DECAY_HOURS = 24; // Story loses all recency score after 24 hours

function getPickedMediaKind(media?: PickedMedia | null) {
  const type = String(media?.type || '').toLowerCase();
  const mimeType = String(media?.mimeType || '').toLowerCase();
  return type === 'video' || mimeType.startsWith('video/') ? 'video' : 'image';
}

function getMediaMimeType(media: PickedMedia) {
  const mimeType = String(media.mimeType || '').toLowerCase();
  if (mimeType) return mimeType;

  const extension = String(media.fileName || media.uri || '').split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'm4v') return 'video/x-m4v';
  if (extension === 'webm') return 'video/webm';
  if (extension === '3gp' || extension === '3gpp') return 'video/3gpp';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';

  return getPickedMediaKind(media) === 'video' ? 'video/mp4' : 'image/jpeg';
}

function getMediaFileName(media: PickedMedia, fallback: string) {
  if (media.fileName) return media.fileName;
  const uriExtension = String(media.uri || '').split('?')[0].split('.').pop()?.toLowerCase();
  const mimeExtension = getMediaMimeType(media).split('/')[1]?.split(';')[0];
  const extension = uriExtension || mimeExtension || (getPickedMediaKind(media) === 'video' ? 'mp4' : 'jpg');
  return `${fallback}-${Date.now()}.${extension === 'jpeg' ? 'jpg' : extension === 'quicktime' ? 'mov' : extension === 'x-m4v' ? 'm4v' : extension}`;
}

function assetToUpload(media: PickedMedia, fallbackName: string) {
  return {
    uri: media.uri,
    name: getMediaFileName(media, fallbackName),
    type: getMediaMimeType(media),
  };
}

function mediaUrl(value?: string | null) {
  return apiClient.getMediaUrl(value);
}

function CachedImage({ uri, style, contentFit = 'cover' }: { uri?: string | null; style: any; contentFit?: 'cover' | 'contain' }) {
  if (!uri) return null;
  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={160}
    />
  );
}

export function FeedScreen({ onOpen }: FeedScreenProps = {}) {
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
  const [postMedia, setPostMedia] = useState<PickedMedia | null>(null);
  const [storyText, setStoryText] = useState('');
  const [storyMedia, setStoryMedia] = useState<PickedMedia | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyViewerStories, setStoryViewerStories] = useState<any[]>([]);
  const [commentPostId, setCommentPostId] = useState('');
  const [comment, setComment] = useState('');
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
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

  const loadPosts = useCallback(async (filter = activeFilter, offset = 0, append = false) => {
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
  }, [activeFilter]);

  const loadSideData = useCallback(async () => {
    setLoadingStories(true);
    try {
      const [storyResponse, lawyerResponse, intelligenceResponse] = await Promise.all([
        apiClient.getFeedStories('all').catch(() => ({ data: [] })),
        apiClient.getLawyers().catch(() => ({ data: [] })),
        apiClient.getIntelligence().catch(() => ({ data: null })),
      ]);
      setStories(storyResponse.data || []);
      setLawyers(lawyerResponse.data || []);
      setIntelligence(intelligenceResponse.data);
    } finally {
      setLoadingStories(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(activeFilter, 0, false);
  }, [activeFilter, loadPosts]);

  useEffect(() => {
    loadSideData();
  }, [loadSideData]);

  const refresh = useCallback(async () => {
    await Promise.all([loadPosts(activeFilter, 0, false), loadSideData()]);
  }, [activeFilter, loadPosts, loadSideData]);

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
            <Pressable onPress={() => onOpen?.('profile')} style={styles.avatar}>
              <Text style={styles.avatarText}>{String(user?.name || 'م').charAt(0)}</Text>
            </Pressable>
            <Pressable onPress={() => setComposerOpen((current) => !current)} style={styles.composerPrompt}>
              <Text style={styles.composerPromptText}>{content || 'بماذا تفكر قانونياً؟'}</Text>
            </Pressable>
          </View>
          {composerOpen ? (
            <>
              <TextInput multiline value={content} onChangeText={setContent} placeholder="شارك سؤالاً أو تحديثاً قانونياً" placeholderTextColor={colors.subtle} style={styles.composerInput} />
              <View style={styles.composerMetaRow}>
                <Text style={styles.composerHint}>اختر تصنيفاً ليسهل وصول المنشور للمهتمين</Text>
                <Text style={styles.composerCount}>{content.trim().length.toLocaleString('ar-IQ')} حرف</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {categories.map((item) => <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />)}
              </ScrollView>
              {postMedia ? (
                <MediaPreview media={postMedia} variant="post" onRemove={() => setPostMedia(null)} />
              ) : null}
              <View style={styles.composerToolRow}>
                <Pressable onPress={() => pickPostMedia('image')} style={styles.composerTool}>
                  <Ionicons name="image-outline" size={18} color={colors.green} />
                  <Text style={styles.composerToolText}>صورة</Text>
                </Pressable>
                <Pressable onPress={() => pickPostMedia('video')} style={styles.composerTool}>
                  <Ionicons name="videocam-outline" size={18} color={colors.red} />
                  <Text style={styles.composerToolText}>فيديو</Text>
                </Pressable>
              </View>
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
        <Text style={styles.storyPanelNote}>تابع تحديثات المجتمع كما تظهر في فيسبوك.</Text>
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
            <CreateStoryCard user={user} onPress={() => setStoryComposerOpen(true)} />
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
          <View style={styles.rowBetween}><View /><Text style={styles.sectionTitle}>مختارات مهمة</Text></View>
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

  const renderFooter = useCallback(() => (
    <View style={{ paddingBottom: 40 }}>
      {loadingMore ? (
        <ActivityIndicator color={colors.navy} style={{ marginVertical: 20 }} />
      ) : (
        !hasMore && posts.length > 0 && <Text style={styles.endText}>وصلت إلى نهاية المنشورات</Text>
      )}
    </View>
  ), [hasMore, loadingMore, posts.length]);

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View>
      <PostCardMemo
        post={item}
        userId={user?.id}
        userRole={user?.role}
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
        onFollow={() => item.author?.id && followLawyer(item.author.id)}
        onEdit={() => { setEditingPost(item); setEditContent(item.content); }}
        onDelete={() => deletePost(item)}
        onPin={() => adminUpdate(item, { pinned: !item.pinned })}
        onFeature={() => adminUpdate(item, { featured: !item.featured })}
        onHide={() => adminUpdate(item, { status: 'hidden' })}
        onOpenProfile={() => onOpen?.('profile')}
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

  const publishPost = useCallback(async () => {
    if (!content.trim() && !postMedia) return;

    setPosting(true);
    setStatus('');

    try {
      const response = await apiClient.createFeedPost({
        content: content.trim(),
        category,
        media: postMedia ? assetToUpload(postMedia, 'post-media') : null,
      });

      setPosts((current) => [response.data, ...current]);
      setContent('');
      setPostMedia(null);
      setComposerOpen(false);
      setStatus('تم نشر المنشور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر نشر المنشور.');
    } finally {
      setPosting(false);
    }
  }, [category, content, postMedia]);

  const publishStory = async () => {
    if (!storyText.trim() && !storyMedia) return;
    setStoryPosting(true);
    setStatus('');

    try {
      const response = await apiClient.createFeedStory({
        text: storyText.trim(),
        media: storyMedia ? assetToUpload(storyMedia, 'story-media') : null,
      });

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

  const pickMedia = async (kind: 'image' | 'video' | 'all') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus('يلزم السماح بالوصول للصور والفيديو لإرفاق وسائط.');
      return null;
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      allowsEditing: false,
      mediaTypes:
        kind === 'image'
          ? ImagePicker.MediaTypeOptions.Images
          : kind === 'video'
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.All,
      quality: 0.72,
      videoMaxDuration: 45,
    };

    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (!result.canceled && result.assets?.[0]) {
      return result.assets[0];
    }
    return null;
  };

  const pickPostMedia = async (kind: 'image' | 'video') => {
    const media = await pickMedia(kind);
    if (media) {
      setPostMedia(media);
      setComposerOpen(true);
    }
  };

  const pickStoryMedia = async () => {
    const media = await pickMedia('all');
    if (media) setStoryMedia(media);
  };

  const openStoryViewer = (index: number) => {
    const storiesForViewer = smartStories.length > 0 ? smartStories : stories.filter((story) => !story.isArchived);
    const story = storiesForViewer[index];
    if (!story) return;

    setStoryViewerStories(storiesForViewer);
    setActiveStoryIndex(index);
    setStoryViewerOpen(true);
    if (story?.id && !story.seenByMe) {
      setStories((current) => current.map((item) => item.id === story.id ? { ...item, seenByMe: true } : item));
      void apiClient.markFeedStoryViewed(story.id).catch(() => undefined);
    }
  };

  const markStoryViewed = useCallback((story: any) => {
    if (!story?.id || story.seenByMe) return;
    setStories((current) => current.map((item) => item.id === story.id ? { ...item, seenByMe: true } : item));
    setStoryViewerStories((current) => current.map((item) => item.id === story.id ? { ...item, seenByMe: true } : item));
    void apiClient.markFeedStoryViewed(story.id).catch(() => undefined);
  }, []);

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
      <Toast message={status} tone={status.includes('تعذر') ? 'error' : 'success'} />
      <FlatList
        data={sortedPosts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing && posts.length > 0} onRefresh={refresh} tintColor={colors.navy} />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        onEndReached={() => hasMore && !loadingMore && !refreshing && loadPosts(activeFilter, nextOffset, true)}
        onEndReachedThreshold={0.5}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={80}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
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
      <StoryModal
        visible={storyViewerOpen}
        stories={storyViewerStories}
        initialIndex={activeStoryIndex}
        onClose={() => setStoryViewerOpen(false)}
        onViewed={markStoryViewed}
        onReply={() => setStatus('سيتم تفعيل الردود على القصص قريباً.')}
        onReport={() => setStatus('تم إرسال البلاغ للمراجعة.')}
      />
      <StoryComposerModal visible={storyComposerOpen} onClose={() => setStoryComposerOpen(false)} text={storyText} onChange={setStoryText} onPublish={publishStory} onPickMedia={pickStoryMedia} onRemoveMedia={() => setStoryMedia(null)} media={storyMedia} loading={storyPosting} />
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

function MediaPreview({ media, variant, onRemove }: { media: PickedMedia; variant: 'post' | 'story'; onRemove: () => void }) {
  const kind = getPickedMediaKind(media);
  const isStory = variant === 'story';

  return (
    <View style={[styles.mediaPreview, isStory && styles.storyMediaPreview]}>
      {kind === 'image' ? (
        <Image source={{ uri: media.uri }} style={styles.mediaPreviewImage} resizeMode="contain" />
      ) : (
        <View style={styles.videoPreview}>
          <FeedVideo uri={media.uri} style={styles.mediaPreviewImage} contentFit="cover" nativeControls={false} muted autoPlay loop />
          <View style={styles.videoPreviewShade}>
            <Ionicons name="play-circle" size={44} color="#fff" />
            <Text style={styles.videoPreviewText}>فيديو جاهز للنشر</Text>
          </View>
        </View>
      )}
      <View style={styles.mediaPreviewBadge}>
        <Ionicons name={kind === 'video' ? 'videocam' : 'image'} size={13} color="#fff" />
        <Text style={styles.mediaPreviewBadgeText}>{kind === 'video' ? 'فيديو' : 'صورة'}</Text>
      </View>
      <Pressable onPress={onRemove} style={styles.mediaRemoveButton}>
        <Ionicons name="close" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

function FeedVideo({
  uri,
  style,
  contentFit = 'cover',
  nativeControls = true,
  autoPlay = false,
  loop = false,
  muted = false,
}: {
  uri: string;
  style: any;
  contentFit?: 'contain' | 'cover' | 'fill';
  nativeControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}) {
  const [shouldLoad, setShouldLoad] = useState(autoPlay);

  if (!shouldLoad && nativeControls) {
    return (
      <Pressable onPress={() => setShouldLoad(true)} style={[style, styles.videoLazyPoster]}>
        <View style={styles.videoLazyButton}>
          <Ionicons name="play" size={24} color={colors.blue} />
        </View>
        <Text style={styles.videoLazyText}>اضغط لتشغيل الفيديو</Text>
      </Pressable>
    );
  }

  return <FeedVideoPlayer uri={uri} style={style} contentFit={contentFit} nativeControls={nativeControls} autoPlay={autoPlay} loop={loop} muted={muted} />;
}

function FeedVideoPlayer({
  uri,
  style,
  contentFit = 'cover',
  nativeControls = true,
  autoPlay = false,
  loop = false,
  muted = false,
}: {
  uri: string;
  style: any;
  contentFit?: 'contain' | 'cover' | 'fill';
  nativeControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}) {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = loop;
    playerInstance.muted = muted;
    playerInstance.staysActiveInBackground = false;
    if (autoPlay) playerInstance.play();
  });

  useEffect(() => {
    player.loop = loop;
    player.muted = muted;
    if (autoPlay) player.play();
    else player.pause();
  }, [autoPlay, loop, muted, player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={nativeControls}
      allowsPictureInPicture={false}
      playsInline
    />
  );
}

function CreateStoryCard({ user, onPress }: { user: any; onPress: () => void }) {
  return (
    <InteractiveCard onPress={onPress} style={styles.createStoryCard}>
      <View style={styles.createStoryMedia}>
        {user?.img || user?.avatar ? (
          <CachedImage uri={mediaUrl(user.img || user.avatar)} style={styles.createStoryImage} contentFit="cover" />
        ) : (
          <View style={styles.createStoryFallback}>
            <Text style={styles.createStoryInitial}>{String(user?.name || 'م').charAt(0)}</Text>
          </View>
        )}
      </View>
      <View style={styles.createStoryFooter}>
        <View style={styles.createStoryPlus}>
          <Ionicons name="add" size={22} color="#fff" />
        </View>
        <Text style={styles.createStoryText} numberOfLines={2}>إنشاء قصة</Text>
      </View>
    </InteractiveCard>
  );
}

const PostCardMemo = React.memo(PostCard);

function PostCard({ post, userId, userRole, busyId, commentOpen, comment, onChangeComment, onSubmitComment, onLike, onSave, onShare, onComment, onConsult, onFollow, onEdit, onDelete, onPin, onFeature, onHide, onOpenProfile }: any) {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
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
      if (!post.likedByMe) {
        onLike();
      }
      heartAnim.setValue(0);
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, bounciness: 15 }),
        Animated.timing(heartAnim, { toValue: 0, duration: 200, delay: 500, useNativeDriver: true })
      ]).start();
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
    <Animated.View style={[styles.postCard, post.pinned && styles.pinnedPost, { opacity: fadeAnim }]}>
      {(post.pinned || post.author?.role === 'admin') ? (
        <View style={[styles.postRibbon, post.pinned && styles.pinnedRibbon]}>
          <Text style={styles.postRibbonText}>{post.pinned ? 'منشور مثبت' : 'إعلان رسمي'}</Text>
          <Ionicons name={post.pinned ? 'pin-outline' : 'megaphone-outline'} size={15} color={post.pinned ? colors.gold : colors.blue} />
        </View>
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
          <Pressable onPress={onOpenProfile} hitSlop={8}>
            <Avatar source={post.author?.avatar || post.author?.img} name={post.author?.name || 'م'} />
          </Pressable>
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
      {isLong ? <Pressable onPress={toggleExpand}><Text style={styles.readMore}>{expanded ? 'عرض أقل' : 'قراءة المزيد'}</Text></Pressable> : null}
      <View style={styles.tagRow}><Text style={styles.tag}>#{post.category || 'عام'}</Text><Text style={styles.tag}>{post.readingTime || 1} دقيقة قراءة</Text></View>
      {post.mediaUrl ? (
        post.mediaType === 'image' ? (
          <Pressable onPress={handleImagePress} style={[styles.mediaBox, styles.imageMediaBox]}>
            <>
              <CachedImage uri={mediaUrl(post.mediaUrl)} style={styles.postImage} contentFit="contain" />
              <Animated.View style={[styles.heartOverlay, { transform: [{ scale: heartAnim }], opacity: heartAnim }]}>
                <Ionicons name="heart" size={80} color="#fff" />
              </Animated.View>
            </>
          </Pressable>
        ) : (
          <View style={[styles.mediaBox, styles.imageMediaBox]}>
            <FeedVideo uri={mediaUrl(post.mediaUrl)} style={styles.postImage} contentFit="contain" nativeControls />
          </View>
        )
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
    </Animated.View>
  );
}

function StoryBubble({ story, onPress }: { story: any; onPress: () => void }) {
  const hasMedia = Boolean(story.mediaUrl);
  const isVideo = story.mediaType === 'video';

  return (
    <InteractiveCard onPress={onPress} style={styles.storyBubble}>
      {hasMedia && story.mediaType === 'image' ? <CachedImage uri={mediaUrl(story.mediaUrl)} style={styles.storyCardMedia} contentFit="contain" /> : null}
      {isVideo ? (
        <View style={styles.storyCardVideo}>
          <FeedVideo uri={mediaUrl(story.mediaUrl)} style={styles.storyCardMedia} contentFit="cover" nativeControls={false} muted autoPlay loop />
          <View style={styles.storyVideoBadge}>
            <Ionicons name="play-circle" size={42} color="#fff" />
          </View>
        </View>
      ) : null}
      {!hasMedia ? (
        <View style={styles.storyCardTextOnly}>
          <Ionicons name="newspaper-outline" size={28} color="#fff" />
          <Text style={styles.storyCardTextOnlyText} numberOfLines={4}>{story.text || 'قصة جديدة'}</Text>
        </View>
      ) : null}
      {hasMedia ? <View style={styles.storyCardShade} /> : null}
      <View style={[styles.storyAvatarWrap, !story.seenByMe && !story.isArchived && styles.avatarUnseen]}>
        <Avatar source={story.author?.avatar || story.author?.img} name={story.author?.name || 'م'} small />
      </View>
      {!story.seenByMe && !story.isArchived ? <Text style={styles.newStoryBadge}>جديد</Text> : null}
      {story.isArchived ? <Text style={styles.archiveStoryBadge}>أرشيف</Text> : null}
      <View style={styles.storyCardFooter}>
        <Text style={styles.storyName} numberOfLines={2}>{story.author?.name || 'قصة'}</Text>
        {isVideo ? <Text style={styles.storyText} numberOfLines={1}>فيديو</Text> : null}
      </View>
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
  if (source) return <CachedImage uri={mediaUrl(source)} style={sizeStyle} contentFit="cover" />;
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
            {media ? (
              getPickedMediaKind(media) === 'image' ? (
                <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              ) : (
                <View style={styles.storyVideoDraft}>
                  <FeedVideo uri={media.uri} style={styles.mediaPreviewImage} contentFit="cover" nativeControls={false} muted autoPlay loop />
                  <View style={styles.videoPreviewShade}>
                    <Ionicons name="play-circle" size={56} color="#fff" />
                    <Text style={styles.videoPreviewText}>فيديو قصة جاهز</Text>
                  </View>
                </View>
              )
            ) : null}
            <Text style={styles.storyDraftText}>{text || (media ? 'أضف تعليقاً قصيراً للقصة...' : 'شارك خبراً أو نصيحة قانونية سريعة...')}</Text>
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
          {media ? <MediaPreview media={media} variant="story" onRemove={onRemoveMedia} /> : null}

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

function StoryModal({ visible, stories, initialIndex, onClose, onViewed, onReply, onReport }: { visible: boolean; stories: any[]; initialIndex: number; onClose: () => void; onViewed?: (story: any) => void; onReply?: (story: any) => void; onReport?: (story: any, reason: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportStory, setReportStory] = useState<any>(null);
  const [reporting, setReporting] = useState(false);
  const [pressedControl, setPressedControl] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  const listRef = useRef<FlatList>(null);
  const currentStory = stories[currentIndex];
  const isProgressPaused = reportModalVisible || pressedControl;

  const handleReport = async (reason: string) => {
    if (!reportStory) return;
    setReporting(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      onReport?.(reportStory, reason);
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

  const goToStory = useCallback((index: number) => {
    const nextIndex = Math.max(0, Math.min(index, stories.length - 1));
    if (nextIndex === currentIndex) return;
    setCurrentIndex(nextIndex);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  }, [currentIndex, stories.length]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      goToStory(currentIndex + 1);
    } else {
      onClose();
    }
  }, [currentIndex, goToStory, onClose, stories.length]);

  const goPrevious = useCallback(() => {
    if (progressValue.current > 0.22) {
      progress.setValue(0);
      progressValue.current = 0;
      return;
    }
    goToStory(currentIndex - 1);
  }, [currentIndex, goToStory, progress]);

  useEffect(() => {
    if (!visible) return;
    const nextIndex = Math.min(initialIndex, Math.max(stories.length - 1, 0));
    setCurrentIndex(nextIndex);
    setTimeout(() => listRef.current?.scrollToIndex({ index: nextIndex, animated: false }), 40);
  }, [visible, initialIndex, stories.length]);

  useEffect(() => {
    const subscription = progress.addListener(({ value }) => {
      progressValue.current = value;
    });

    return () => progress.removeListener(subscription);
  }, [progress]);

  useEffect(() => {
    progress.setValue(0);
    progressValue.current = 0;
    if (visible && currentStory) onViewed?.(currentStory);
  }, [currentIndex, currentStory?.id, onViewed, progress, visible]);

  useEffect(() => {
    if (!visible || !currentStory || isProgressPaused) return;
    const storyDuration = currentStory.mediaType === 'video' ? STORY_VIDEO_VIEW_DURATION : STORY_VIEW_DURATION;
    const remainingDuration = Math.max(350, storyDuration * (1 - progressValue.current));
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: remainingDuration,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [currentStory?.id, goNext, isProgressPaused, progress, visible]);

  useEffect(() => {
    if (!visible) {
      progress.stopAnimation();
      progress.setValue(0);
      progressValue.current = 0;
      setReportModalVisible(false);
      setReportStory(null);
      setPressedControl(false);
    }
  }, [progress, visible]);

  const renderItem = ({ item }: { item: any, index: number }) => (
    <View style={styles.storyViewerContainer}>
      {item.mediaUrl && item.mediaType === 'image' ? <CachedImage uri={mediaUrl(item.mediaUrl)} style={styles.storyViewerMedia} contentFit="contain" /> : null}
      {item.mediaUrl && item.mediaType === 'video' ? (
        <View style={styles.storyVideoViewer}>
          <FeedVideo uri={mediaUrl(item.mediaUrl)} style={styles.storyViewerMedia} contentFit="contain" nativeControls autoPlay muted={isMuted} />
        </View>
      ) : null}
      <View style={styles.storyOverlay} />
      <View style={styles.storyProgressRail}>
        {stories.map((story, progressIndex) => {
          const isCurrent = currentIndex === progressIndex;
          const isComplete = progressIndex < currentIndex;
          return (
          <View key={story.id || progressIndex} style={[styles.storyProgressBar, isCurrent && styles.storyProgressBarActive]}>
            <Animated.View
              style={[
                styles.storyProgressFill,
                isComplete && styles.storyProgressFillComplete,
                {
                  width:
                    isCurrent
                      ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                      : isComplete
                        ? '100%'
                        : '0%',
                },
              ]}
            />
          </View>
        )})}
      </View>
      <View style={styles.storyCounter}>
        <Text style={styles.storyCounterText}>{`${(currentIndex + 1).toLocaleString('ar-IQ')} / ${stories.length.toLocaleString('ar-IQ')}`}</Text>
      </View>
      <View style={styles.storyViewerHeader}>
        <View style={styles.authorInfo}>
          <Avatar source={item.author?.avatar || item.author?.img} name={item.author?.name} small />
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
      <View pointerEvents="box-none" style={styles.storyTapLayer}>
        <Pressable
          onPress={goPrevious}
          onPressIn={() => setPressedControl(true)}
          onPressOut={() => setPressedControl(false)}
          style={styles.storyTapZone}
        />
        <Pressable
          onPress={goNext}
          onPressIn={() => setPressedControl(true)}
          onPressOut={() => setPressedControl(false)}
          style={styles.storyTapZone}
        />
      </View>
      <View style={styles.viewerContent}>
        {item.text ? <View style={styles.viewerTextContainer}><Text style={styles.viewerText}>{item.text}</Text></View> : null}
      </View>
      <View style={styles.viewerFooter}>
        <Pressable onPress={() => onReply?.(item)} style={styles.viewerReply}><Ionicons name="chatbubble-outline" size={18} color="#fff" /><Text style={styles.viewerReplyText}>أرسل رداً مهنياً...</Text></Pressable>
      </View>
    </View>
  );

  if (!stories.length) return null;

  return (
    <Modal animationType="fade" visible={visible} onRequestClose={onClose}>
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
      <FlatList
        ref={listRef}
        data={stories}
        renderItem={renderItem}
        style={styles.storyViewerList}
        contentContainerStyle={styles.storyViewerTrack}
        horizontal
        pagingEnabled
        keyExtractor={item => item.id}
        initialScrollIndex={Math.min(initialIndex, stories.length - 1)}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => listRef.current?.scrollToIndex({ index: Math.min(info.index, stories.length - 1), animated: false }), 80);
        }}
        onMomentumScrollEnd={handleScroll}
        showsHorizontalScrollIndicator={false}
      />
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
  actionRow: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row-reverse', gap: 4, marginTop: 12, paddingTop: 8 },
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
  addStoryBubble: { alignItems: 'center', backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line, height: 138, justifyContent: 'center', width: 104 },
  addStoryCircle: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 28, justifyContent: 'center', position: 'absolute', right: -6, top: -6, width: 28, zIndex: 5, borderWidth: 3, borderColor: colors.paper },
  composer: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginBottom: 14, padding: 14, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 3 },
  composerCount: { color: colors.subtle, fontSize: 11, fontWeight: '900' },
  composerHint: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  composerModalBackdrop: { backgroundColor: 'rgba(15,23,42,0.6)', flex: 1, justifyContent: 'flex-end' },
  composerModalContent: { backgroundColor: colors.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: '60%' },
  modalHeader: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20 },
  closeButton: { padding: 4 },
  storyDraftPreview: { alignItems: 'center', aspectRatio: STORY_MEDIA_ASPECT, backgroundColor: colors.navy, borderRadius: 18, justifyContent: 'center', marginBottom: 20, overflow: 'hidden', padding: 24, width: '100%' },
  storyDraftText: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 28, textAlign: 'center' },
  storyModalInput: { backgroundColor: colors.surface, borderRadius: 16, color: colors.ink, fontSize: 15, fontWeight: '700', minHeight: 80, padding: 16, textAlign: 'right', textAlignVertical: 'top' },
  storyViewerContainer: { backgroundColor: colors.navy, flex: 1, height, minHeight: height, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, width },
  storyViewerList: { backgroundColor: colors.navy, flex: 1, height },
  storyViewerMedia: { ...StyleSheet.absoluteFillObject, height, width },
  storyViewerTrack: { minHeight: height },
  storyProgressRail: { flexDirection: 'row-reverse', gap: 5, marginBottom: 12, zIndex: 4 },
  storyProgressBar: { backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 999, flex: 1, height: 5, overflow: 'hidden' },
  storyProgressBarActive: { backgroundColor: 'rgba(255,255,255,0.34)' },
  storyProgressFill: { backgroundColor: '#fff', height: '100%', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5 },
  storyProgressFillComplete: { backgroundColor: 'rgba(255,255,255,0.92)' },
  storyCounter: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(15,23,42,0.38)', borderRadius: 999, marginBottom: 12, paddingHorizontal: 10, paddingVertical: 4, zIndex: 4 },
  storyCounterText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  storyViewerHeader: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', zIndex: 4 },
  storyTapLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 3 },
  storyTapZone: { flex: 1 },
  viewerAuthorName: { color: '#fff', fontSize: 14, fontWeight: '900' },
  viewerMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  viewerClose: { padding: 4 },
  viewerContent: { flex: 1, justifyContent: 'center', zIndex: 2 },
  viewerTextContainer: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  viewerText: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 36, textAlign: 'center' },
  viewerFooter: { alignItems: 'center', borderTopColor: 'rgba(255,255,255,0.1)', borderTopWidth: 1, flexDirection: 'row-reverse', paddingVertical: 20, marginBottom: Platform.OS === 'ios' ? 30 : 10, zIndex: 4 },
  viewerReply: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 8, height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  viewerReplyText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  composerInput: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    color: colors.ink,
    marginTop: 12,
    minHeight: 100,
    padding: 16,
    textAlign: 'right',
    textAlignVertical: 'top',
    borderColor: colors.line,
    borderWidth: 1,
    fontSize: 15
  },
  composerMetaRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10, marginBottom: 8, marginTop: 8 },
  composerPrompt: { backgroundColor: colors.tint, borderRadius: 999, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
  composerPromptText: { color: colors.muted, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  composerTool: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row-reverse', gap: 7, justifyContent: 'center', minHeight: 40 },
  composerToolRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  composerToolText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  composerTop: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10 },
  consultButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 6, justifyContent: 'center', minHeight: 38 },
  consultText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  countRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12 },
  countText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  createStoryCard: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: 199, overflow: 'hidden', width: 112 },
  createStoryFallback: { alignItems: 'center', backgroundColor: colors.blueTint, flex: 1, justifyContent: 'center' },
  createStoryFooter: { alignItems: 'center', backgroundColor: colors.paper, height: 58, justifyContent: 'flex-end', paddingBottom: 9, paddingHorizontal: 8 },
  createStoryImage: { height: '100%', width: '100%' },
  createStoryInitial: { color: colors.blue, fontSize: 28, fontWeight: '900' },
  createStoryMedia: { backgroundColor: colors.tint, flex: 1 },
  createStoryPlus: { alignItems: 'center', backgroundColor: colors.blue, borderColor: colors.paper, borderRadius: 999, borderWidth: 3, height: 34, justifyContent: 'center', position: 'absolute', top: -18, width: 34 },
  createStoryText: { color: colors.ink, fontSize: 11, fontWeight: '900', lineHeight: 15, textAlign: 'center' },
  dangerButton: { backgroundColor: colors.redTint },
  disabled: { opacity: 0.45 },
  endText: { color: colors.muted, fontSize: 12, fontWeight: '900', marginVertical: 14, textAlign: 'center' },
  featuredItem: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 8, minHeight: 82, padding: 11, width: 210 },
  featuredPanel: { marginBottom: 10 },
  featuredRow: { flexDirection: 'row-reverse', gap: 9, paddingBottom: 8 },
  featuredTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', lineHeight: 20, textAlign: 'right' },
  feedControls: { marginBottom: 4 },
  feedHeader: { marginBottom: 12 },
  filterChip: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 999, flexDirection: 'row-reverse', gap: 5, minHeight: 38, paddingHorizontal: 12 },
  filterChipActive: { backgroundColor: colors.navy },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  filterText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#fff' },
  flex: { flex: 1 },
  followButton: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 6, justifyContent: 'center', minHeight: 38 },
  followText: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  headerIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  heartOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  hero: { backgroundColor: colors.paper, borderRadius: 16, marginBottom: 12, padding: 14 },
  heroIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  heroTop: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12 },
  iconButton: { alignItems: 'center', backgroundColor: colors.tint, borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  imageMediaBox: { backgroundColor: '#101828', padding: 0 },
  inlineComment: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  inlineCommentInput: { backgroundColor: colors.tint, borderRadius: 999, color: colors.ink, flex: 1, minHeight: 42, paddingHorizontal: 14, textAlign: 'right' },
  inlineCommentSend: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  lawyerActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  inlineLawyers: { backgroundColor: '#fff', borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginBottom: 12, padding: 12 },
  lawyerCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, padding: 12, width: 138 },
  lawyerRow: { flexDirection: 'row-reverse', gap: 10, paddingTop: 8 },
  lawyersPanel: { backgroundColor: colors.surface, borderRadius: 18, marginBottom: 12, padding: 12 },
  loadMore: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 999, justifyContent: 'center', marginVertical: 12, minHeight: 44 },
  loadMoreText: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  manageRow: { flexDirection: 'row', gap: 5 },
  mediaBox: { alignItems: 'center', backgroundColor: '#101828', borderRadius: 8, marginHorizontal: -14, marginTop: 12, overflow: 'hidden' },
  mediaClear: { marginLeft: 'auto' },
  mediaPickerButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 16, backgroundColor: colors.tint, borderRadius: 16, marginBottom: 16 },
  mediaPickerText: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  mediaPreview: { aspectRatio: POST_MEDIA_ASPECT, backgroundColor: '#101828', borderRadius: 8, marginBottom: 10, overflow: 'hidden', width: '100%' },
  mediaPreviewBadge: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.72)', borderRadius: 999, bottom: 10, flexDirection: 'row-reverse', gap: 5, paddingHorizontal: 10, paddingVertical: 6, position: 'absolute', right: 10 },
  mediaPreviewBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  mediaPreviewImage: { height: '100%', width: '100%' },
  mediaRemoveButton: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.72)', borderRadius: 999, height: 32, justifyContent: 'center', left: 10, position: 'absolute', top: 10, width: 32 },
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  reportMenu: { backgroundColor: '#fff', borderRadius: 24, width: '90%', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  reportTitle: { fontSize: 18, fontWeight: '900', color: colors.ink, marginBottom: 15, textAlign: 'center' },
  reportOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, alignItems: 'center' },
  reportOptionText: { fontSize: 14, fontWeight: '800', color: colors.navy },
  reportCancel: { borderBottomWidth: 0, marginTop: 10 },
  reportCancelText: { color: colors.red, fontWeight: '900' },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.3)' },
  viewerHeaderActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  viewerHeaderButton: { padding: 4 },
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
  feedVideoBox: { alignItems: 'center', aspectRatio: POST_MEDIA_ASPECT, backgroundColor: '#101828', justifyContent: 'center', width: '100%' },
  feedVideoText: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 8 },
  postAction: { alignItems: 'center', borderRadius: 8, flex: 1, gap: 3, justifyContent: 'center', minHeight: 42 },
  postActionActive: { backgroundColor: colors.blueTint },
  postActionText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  postCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 3
  },
  postHeader: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  postImage: { aspectRatio: POST_MEDIA_ASPECT, width: '100%' },
  postRibbon: { alignItems: 'center', backgroundColor: colors.surface, flexDirection: 'row-reverse', gap: 6, marginHorizontal: -14, marginTop: -14, marginBottom: 14, padding: 9 },
  pinnedRibbon: { backgroundColor: colors.goldTint, borderBottomColor: colors.gold, borderBottomWidth: 1 },
  postRibbonText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  postText: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 26, marginTop: 14, textAlign: 'right' },
  readMore: { color: colors.blue, fontSize: 12, fontWeight: '900', marginTop: 6, textAlign: 'right' },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  sortOption: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sortOptionActive: { backgroundColor: colors.paper },
  sortPanel: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 8, flexDirection: 'row-reverse', gap: 12, marginBottom: 12, padding: 12 },
  sortText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  sortTextActive: { color: colors.blue },
  sortToggle: { backgroundColor: colors.tint, borderRadius: 999, flexDirection: 'row-reverse', padding: 3 },
  status: { color: colors.navy, fontSize: 12, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  storyAvatar: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  storyAvatarWrap: { borderColor: 'rgba(255,255,255,0.92)', borderRadius: 999, borderWidth: 2, position: 'absolute', right: 8, top: 8, zIndex: 3 },
  storyBubble: { backgroundColor: '#101828', borderColor: colors.line, borderWidth: 1, borderRadius: 10, height: 199, overflow: 'hidden', width: 112 },
  avatarUnseen: { borderColor: colors.blue, borderWidth: 3 },
  storyCardFooter: { bottom: 9, left: 8, position: 'absolute', right: 8, zIndex: 3 },
  storyCardMedia: { height: '100%', width: '100%' },
  storyCardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.22)', zIndex: 1 },
  storyCardTextOnly: { alignItems: 'center', backgroundColor: colors.navy, flex: 1, gap: 8, justifyContent: 'center', padding: 12 },
  storyCardTextOnlyText: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 18, textAlign: 'center' },
  storyCardVideo: { alignItems: 'center', backgroundColor: '#101828', flex: 1, justifyContent: 'center' },
  storyVideoBadge: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  storyComposer: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  storyCoverImage: { borderRadius: 12, height: 70, marginBottom: 8, width: '100%' },
  storyInput: { backgroundColor: colors.tint, borderRadius: 999, color: colors.ink, flex: 1, minHeight: 42, paddingHorizontal: 12, textAlign: 'right' },
  storyMediaPreview: { aspectRatio: STORY_MEDIA_ASPECT },
  storyName: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 16, textAlign: 'right', textShadowColor: 'rgba(0,0,0,0.34)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  storyPanel: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 8, marginBottom: 12, padding: 12 },
  storyPanelNote: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  storyPublish: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  storyRow: { flexDirection: 'row-reverse', gap: 10, paddingBottom: 2, paddingTop: 12 },
  storyText: { color: 'rgba(255,255,255,0.86)', fontSize: 10, fontWeight: '900', lineHeight: 15, marginTop: 3, textAlign: 'right' },
  storyVideoCover: { alignItems: 'center', backgroundColor: '#101828', borderRadius: 12, height: 70, justifyContent: 'center', marginBottom: 8, width: '100%' },
  storyVideoDraft: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: '#101828', justifyContent: 'center' },
  storyVideoViewer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: '#101828', justifyContent: 'center' },
  storySkeleton: { backgroundColor: colors.tint, borderRadius: 10, height: 199, width: 112 },
  storyTab: { alignItems: 'center', borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 5, justifyContent: 'center', minHeight: 32 },
  storyTabActive: { backgroundColor: colors.paper },
  storyTabCount: { backgroundColor: colors.paper, borderRadius: 999, color: colors.subtle, fontSize: 9, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  storyTabCountActive: { backgroundColor: colors.blueTint, color: colors.blue },
  storyTabs: { backgroundColor: colors.tint, borderRadius: 999, flexDirection: 'row-reverse', gap: 4, marginTop: 10, padding: 4 },
  storyTabText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  storyTabTextActive: { color: colors.blue },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  tag: { backgroundColor: colors.blueTint, borderRadius: 999, color: colors.blue, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4 },
  tagRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'right' },
  topicPill: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  topicText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  videoPreview: { alignItems: 'center', backgroundColor: '#101828', flex: 1, justifyContent: 'center' },
  videoLazyButton: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, height: 58, justifyContent: 'center', width: 58 },
  videoLazyPoster: { alignItems: 'center', backgroundColor: '#101828', gap: 10, justifyContent: 'center' },
  videoLazyText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  videoPreviewShade: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.26)', justifyContent: 'center' },
  videoPreviewText: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 8 },
  viewerNotice: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 16, flexDirection: 'row-reverse', gap: 10, marginBottom: 12, padding: 12 },
});
