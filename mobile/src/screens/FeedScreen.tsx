import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { Button, EmptyState, Pill, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type FeedFilter = 'all' | 'videos' | 'articles' | 'admins' | 'popular';
type SortMode = 'smart' | 'latest';

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

export function FeedScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('smart');
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const canCreate = user?.role === 'admin' || user?.role === 'pro';
  const categories = useMemo(() => ['عام', ...Array.from(new Set(posts.map((post) => String(post.category || '')).filter(Boolean)))].slice(0, 8), [posts]);
  const topics = useMemo(() => Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).slice(0, 8), [posts]);
  const featuredPosts = useMemo(() => posts.filter((post) => post.featured || post.pinned).slice(0, 3), [posts]);

  const sortedPosts = useMemo(() => {
    if (sortMode === 'latest') return posts;
    return [...posts].sort((left, right) => {
      const leftScore = engagementScore(left);
      const rightScore = engagementScore(right);
      if (right.pinned !== left.pinned) return Number(right.pinned) - Number(left.pinned);
      if (right.featured !== left.featured) return Number(right.featured) - Number(left.featured);
      if (rightScore !== leftScore) return rightScore - leftScore;
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }, [posts, sortMode]);

  const smartStories = useMemo(() => [...stories].sort((left, right) => Number(left.seenByMe) - Number(right.seenByMe) || new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()), [stories]);
  const suggestedLawyers = useMemo(() => lawyers.slice(0, 5), [lawyers]);

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
    const [storyResponse, lawyerResponse] = await Promise.all([
      apiClient.getFeedStories('all').catch(() => ({ data: [] })),
      apiClient.getLawyers().catch(() => ({ data: [] })),
    ]);
    setStories(storyResponse.data || []);
    setLawyers(lawyerResponse.data || []);
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
        <View style={styles.feedHeader}>
          <View style={styles.heroTop}>
            <Pressable onPress={() => setSortMode(sortMode === 'smart' ? 'latest' : 'smart')} style={styles.headerIcon}>
              <Ionicons name={sortMode === 'smart' ? 'sparkles-outline' : 'time-outline'} size={20} color={colors.blue} />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.title}>المجتمع القانوني</Text>
              <Text style={styles.subtitle}>{posts.length.toLocaleString('ar-IQ')} منشور · {sortMode === 'smart' ? 'اقتراحات ذكية' : 'الأحدث أولاً'}</Text>
            </View>
          </View>
        </View>

        {status ? <Text style={styles.status}>{status}</Text> : null}

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
                <TextInput multiline value={content} onChangeText={setContent} placeholder="شارك سؤالاً أو تحديثاً قانونياً" placeholderTextColor="#98a2b3" style={styles.composerInput} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {categories.map((item) => <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />)}
                </ScrollView>
                <Button title="نشر" onPress={publishPost} loading={posting} />
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.storyPanel}>
          <View style={styles.rowBetween}>
            {canCreate ? <Pressable onPress={() => setStoryComposerOpen((current) => !current)} style={styles.storyCreate}><Ionicons name="add" size={17} color="#fff" /><Text style={styles.storyCreateText}>قصة</Text></Pressable> : <View />}
            <Text style={styles.sectionTitle}>القصص</Text>
          </View>
          {canCreate && storyComposerOpen ? (
            <View style={styles.storyComposer}>
              <TextInput value={storyText} onChangeText={setStoryText} placeholder="نص قصة قصيرة..." placeholderTextColor="#98a2b3" style={styles.storyInput} />
              <Pressable disabled={!storyText.trim() || storyPosting} onPress={publishStory} style={[styles.storyPublish, (!storyText.trim() || storyPosting) && styles.disabled]}>
                <Ionicons name="send" size={15} color="#fff" />
              </Pressable>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
            {smartStories.length === 0 ? <Text style={styles.mutedText}>لا توجد قصص حالياً.</Text> : null}
            {smartStories.map((story) => <StoryBubble key={story.id} story={story} onPress={() => viewStory(story)} />)}
          </ScrollView>
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

        {refreshing && posts.length === 0 ? <ActivityIndicator color={colors.gold} /> : null}
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

      <CommentModal postId={commentPostId} comment={comment} loading={busyId === `comment-${commentPostId}`} onChange={setComment} onClose={() => setCommentPostId('')} onSubmit={() => submitComment(commentPostId)} />
      <EditModal post={editingPost} content={editContent} loading={busyId === `edit-${editingPost?.id}`} onChange={setEditContent} onClose={() => setEditingPost(null)} onSubmit={saveEdit} />
      <StoryModal story={activeStory} onClose={() => setActiveStory(null)} />
      <ConsultationModal post={consultationPost} note={consultationNote} paymentMethod={paymentMethod} loading={busyId === 'consult'} onChangeNote={setConsultationNote} onChangePayment={setPaymentMethod} onClose={() => setConsultationPost(null)} onSubmit={startConsultation} />
    </Screen>
  );
}

function PostCard({ post, userId, userRole, busyId, onLike, onSave, onShare, onComment, onConsult, onFollow, onEdit, onDelete, onPin, onFeature, onHide }: any) {
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
          <View style={styles.avatar}><Text style={styles.avatarText}>{String(post.author?.name || 'م').charAt(0)}</Text></View>
          <View style={styles.flex}>
            <View style={styles.authorLine}>
              {post.featured ? <Pill label="مميز" tone="gold" /> : null}
              <Text style={styles.authorName} numberOfLines={1}>{post.author?.name || post.authorName || 'عضو المنصة'}</Text>
            </View>
            <Text style={styles.mutedText}>{post.author?.specialty || post.author?.roleLabel || post.category} · {formatDate(post.createdAt)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.postText}>{text}</Text>
      {isLong ? <Pressable onPress={() => setExpanded((value) => !value)}><Text style={styles.readMore}>{expanded ? 'عرض أقل' : 'قراءة المزيد'}</Text></Pressable> : null}
      <View style={styles.tagRow}><Text style={styles.tag}>#{post.category || 'عام'}</Text><Text style={styles.tag}>{post.readingTime || 1} دقيقة قراءة</Text></View>
      {post.mediaUrl ? <View style={styles.mediaBox}><Ionicons name={post.mediaType === 'video' ? 'play-circle-outline' : 'image-outline'} size={28} color={colors.blue} /><Text style={styles.mutedText}>{post.mediaType === 'video' ? 'فيديو مرفق' : 'صورة مرفقة'}</Text></View> : null}
      <View style={styles.countRow}><Text style={styles.countText}>{(post.likesCount || 0).toLocaleString('ar-IQ')} إعجاب</Text><Text style={styles.countText}>{post.commentsCount || 0} تعليق · {post.shareCount || 0} مشاركة · {post.savesCount || 0} حفظ</Text></View>
      <View style={styles.actionRow}>
        <Action icon="thumbs-up-outline" label="إعجاب" active={post.likedByMe} loading={busyId === `like-${post.id}`} onPress={onLike} />
        <Action icon="chatbubble-outline" label="تعليق" onPress={onComment} />
        <Action icon="share-social-outline" label="مشاركة" loading={busyId === `share-${post.id}`} onPress={onShare} />
        <Action icon="bookmark-outline" label="حفظ" active={post.savedByMe} loading={busyId === `save-${post.id}`} onPress={onSave} />
      </View>
      {post.author?.role === 'lawyer' && post.author?.id !== userId ? (
        <View style={styles.lawyerActions}>
          <Pressable onPress={onConsult} style={styles.consultButton}><Ionicons name="card-outline" size={16} color="#fff" /><Text style={styles.consultText}>استشارة</Text></Pressable>
          <Pressable onPress={onFollow} style={styles.followButton}><Ionicons name="add-circle-outline" size={16} color={colors.blue} /><Text style={styles.followText}>متابعة</Text></Pressable>
        </View>
      ) : null}
      {(post.comments || []).slice(-2).map((item: any) => <View key={item.id} style={styles.commentBubble}><Text style={styles.commentAuthor}>{item.author?.name}</Text><Text style={styles.commentText}>{item.content}</Text></View>)}
    </View>
  );
}

function StoryBubble({ story, onPress }: { story: any; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.storyBubble, !story.seenByMe && styles.storyUnseen]}>
      <View style={styles.storyAvatar}><Text style={styles.avatarText}>{String(story.author?.name || 'م').charAt(0)}</Text></View>
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

function CommentModal({ postId, comment, loading, onChange, onClose, onSubmit }: any) {
  return (
    <Modal transparent animationType="slide" visible={Boolean(postId)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalPanel}>
        <Text style={styles.modalTitle}>إضافة تعليق</Text>
        <TextInput multiline value={comment} onChangeText={onChange} placeholder="اكتب تعليقاً مهنياً..." placeholderTextColor="#98a2b3" style={styles.modalInput} />
        <View style={styles.modalActions}><Button title="إلغاء" variant="secondary" onPress={onClose} /><Button title="إرسال" loading={loading} onPress={onSubmit} /></View>
      </View></View>
    </Modal>
  );
}

function EditModal({ post, content, loading, onChange, onClose, onSubmit }: any) {
  return (
    <Modal transparent animationType="slide" visible={Boolean(post)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalPanel}>
        <Text style={styles.modalTitle}>تعديل المنشور</Text>
        <TextInput multiline value={content} onChangeText={onChange} placeholder="نص المنشور" placeholderTextColor="#98a2b3" style={styles.modalInput} />
        <View style={styles.modalActions}><Button title="إلغاء" variant="secondary" onPress={onClose} /><Button title="حفظ" loading={loading} onPress={onSubmit} /></View>
      </View></View>
    </Modal>
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
    <Modal transparent animationType="slide" visible={Boolean(post)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalPanel}>
        <Text style={styles.modalTitle}>بدء استشارة من المنشور</Text>
        <Text style={styles.mutedText}>{post?.author?.name} · {post?.author?.consultationFee || 'سعر غير محدد'}</Text>
        {paymentMethods.map((method) => <Pressable key={method.id} onPress={() => onChangePayment(method.id)} style={[styles.paymentItem, paymentMethod === method.id && styles.paymentItemActive]}><Ionicons name={method.icon} size={20} color={colors.navy} /><View style={styles.flex}><Text style={styles.cardTitle}>{method.label}</Text><Text style={styles.mutedText}>{method.subtitle}</Text></View></Pressable>)}
        <TextInput multiline value={note} onChangeText={onChangeNote} placeholder="ملاحظة للمحامي" placeholderTextColor="#98a2b3" style={styles.modalInput} />
        <View style={styles.modalActions}><Button title="إلغاء" variant="secondary" onPress={onClose} /><Button title="ابدأ الاستشارة" loading={loading} onPress={onSubmit} /></View>
      </View></View>
    </Modal>
  );
}

function engagementScore(post: any) {
  return (post.likesCount || 0) + (post.commentsCount || 0) * 2 + (post.savesCount || 0) * 2 + (post.shareCount || 0) + (post.featured ? 20 : 0) + (post.pinned ? 15 : 0);
}

function formatDate(value?: string) {
  if (!value) return 'الآن';
  return new Date(value).toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  actionRow: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row-reverse', gap: 2, marginTop: 10, paddingTop: 4 },
  activeText: { color: colors.blue },
  authorInfo: { alignItems: 'center', flex: 1, flexDirection: 'row-reverse', gap: 10 },
  authorLine: { alignItems: 'center', flexDirection: 'row-reverse', gap: 6 },
  authorName: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  avatar: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  chip: { backgroundColor: '#eef2f6', borderRadius: 999, minHeight: 34, justifyContent: 'center', paddingHorizontal: 11 },
  chipActive: { backgroundColor: colors.navy },
  chipRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  chipText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: '#fff' },
  commentAuthor: { color: colors.ink, fontSize: 11, fontWeight: '900', textAlign: 'right' },
  commentBubble: { alignSelf: 'flex-end', backgroundColor: '#f2f4f7', borderRadius: 16, marginTop: 8, maxWidth: '92%', padding: 9 },
  commentText: { color: colors.ink, fontSize: 12, fontWeight: '700', lineHeight: 19, marginTop: 3, textAlign: 'right' },
  composer: { backgroundColor: '#fff', borderBottomColor: colors.line, borderBottomWidth: 1, marginHorizontal: -18, marginBottom: 8, paddingHorizontal: 18, paddingVertical: 10 },
  composerInput: { backgroundColor: '#f2f4f7', borderRadius: 18, color: colors.ink, marginTop: 10, minHeight: 76, padding: 12, textAlign: 'right', textAlignVertical: 'top' },
  composerPrompt: { backgroundColor: '#f2f4f7', borderRadius: 999, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
  composerPromptText: { color: colors.muted, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  composerTop: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10 },
  consultButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 6, justifyContent: 'center', minHeight: 38 },
  consultText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  countRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12 },
  countText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  dangerButton: { backgroundColor: '#fff1f0' },
  disabled: { opacity: 0.45 },
  endText: { color: colors.muted, fontSize: 12, fontWeight: '900', marginVertical: 14, textAlign: 'center' },
  featuredItem: { backgroundColor: '#fff', borderRadius: 16, padding: 11, width: 210 },
  featuredPanel: { marginBottom: 8 },
  featuredRow: { flexDirection: 'row-reverse', gap: 9, paddingBottom: 8 },
  featuredTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', lineHeight: 20, textAlign: 'right' },
  feedControls: { marginBottom: 4 },
  feedHeader: { backgroundColor: '#fff', borderBottomColor: colors.line, borderBottomWidth: 1, marginHorizontal: -18, marginBottom: 0, paddingHorizontal: 18, paddingVertical: 12 },
  filterChip: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, flexDirection: 'row-reverse', gap: 5, minHeight: 38, paddingHorizontal: 11 },
  filterChipActive: { backgroundColor: colors.navy },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 12 },
  filterText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#fff' },
  flex: { flex: 1 },
  followButton: { alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 999, flex: 1, flexDirection: 'row-reverse', gap: 6, justifyContent: 'center', minHeight: 38 },
  followText: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  headerIcon: { alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  hero: { backgroundColor: '#fff', borderRadius: 22, marginBottom: 12, padding: 14 },
  heroIcon: { alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  heroTop: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12 },
  iconButton: { alignItems: 'center', backgroundColor: '#f2f4f7', borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  lawyerActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  inlineLawyers: { backgroundColor: '#fff', borderRadius: 18, marginBottom: 12, padding: 12 },
  lawyerCard: { alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, padding: 12, width: 138 },
  lawyerRow: { flexDirection: 'row-reverse', gap: 10, paddingTop: 8 },
  lawyersPanel: { backgroundColor: '#f8fafc', borderRadius: 18, marginBottom: 12, padding: 12 },
  loadMore: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, justifyContent: 'center', marginVertical: 12, minHeight: 44 },
  loadMoreText: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  manageRow: { flexDirection: 'row', gap: 5 },
  mediaBox: { alignItems: 'center', backgroundColor: '#eef2f6', borderRadius: 16, gap: 4, marginTop: 12, padding: 18 },
  modalActions: { gap: 9, marginTop: 12 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(16,24,40,0.45)', flex: 1, justifyContent: 'center', padding: 16 },
  modalInput: { backgroundColor: '#f2f4f7', borderRadius: 16, color: colors.ink, minHeight: 96, padding: 12, textAlign: 'right', textAlignVertical: 'top' },
  modalPanel: { backgroundColor: '#fff', borderRadius: 22, maxHeight: '88%', padding: 16, width: '94%' },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginBottom: 10, textAlign: 'right' },
  mutedText: { color: colors.muted, fontSize: 11, fontWeight: '800', lineHeight: 18, marginTop: 4, textAlign: 'right' },
  paymentItem: { alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, flexDirection: 'row-reverse', gap: 10, marginBottom: 8, padding: 10 },
  paymentItemActive: { backgroundColor: '#eff6ff' },
  pinnedPost: { borderColor: '#bfdbfe', borderWidth: 1 },
  postAction: { alignItems: 'center', borderRadius: 10, flex: 1, gap: 3, justifyContent: 'center', minHeight: 42 },
  postActionActive: { backgroundColor: '#eff6ff' },
  postActionText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  postCard: { backgroundColor: '#fff', borderRadius: 0, marginHorizontal: -18, marginBottom: 8, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 12 },
  postHeader: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  postRibbon: { alignItems: 'center', backgroundColor: '#f8fafc', flexDirection: 'row-reverse', gap: 6, marginHorizontal: -12, marginTop: -12, marginBottom: 12, padding: 9 },
  postRibbonText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  postText: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 24, marginTop: 12, textAlign: 'right' },
  readMore: { color: colors.blue, fontSize: 12, fontWeight: '900', marginTop: 6, textAlign: 'right' },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  sortOption: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  sortOptionActive: { backgroundColor: '#fff' },
  sortPanel: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, flexDirection: 'row-reverse', gap: 12, marginBottom: 12, padding: 12 },
  sortText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  sortTextActive: { color: colors.blue },
  sortToggle: { backgroundColor: '#f2f4f7', borderRadius: 999, flexDirection: 'row-reverse', padding: 3 },
  status: { color: colors.navy, fontSize: 12, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  storyAvatar: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  storyBubble: { backgroundColor: '#fff', borderRadius: 16, minHeight: 138, padding: 10, width: 104 },
  storyComposer: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  storyCreate: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, flexDirection: 'row-reverse', gap: 5, minHeight: 34, paddingHorizontal: 10 },
  storyCreateText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  storyInput: { backgroundColor: '#f2f4f7', borderRadius: 999, color: colors.ink, flex: 1, minHeight: 42, paddingHorizontal: 12, textAlign: 'right' },
  storyModalAuthor: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  storyModalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.92)', flex: 1, justifyContent: 'center', padding: 20 },
  storyModalCard: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.18)', borderRadius: 24, borderWidth: 1, justifyContent: 'center', minHeight: 320, padding: 22, width: '92%' },
  storyModalClose: { position: 'absolute', right: 18, top: 48, zIndex: 2 },
  storyModalText: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 34, marginTop: 18, textAlign: 'center' },
  storyName: { color: colors.ink, fontSize: 11, fontWeight: '900', marginTop: 7, textAlign: 'right' },
  storyPanel: { backgroundColor: '#f8fafc', borderBottomColor: colors.line, borderBottomWidth: 1, marginHorizontal: -18, marginBottom: 8, paddingHorizontal: 18, paddingVertical: 12 },
  storyPublish: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  storyRow: { flexDirection: 'row-reverse', gap: 10, paddingTop: 10 },
  storyText: { color: colors.muted, fontSize: 10, fontWeight: '800', lineHeight: 15, marginTop: 5, textAlign: 'right' },
  storyUnseen: { borderColor: colors.blue, borderWidth: 2 },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  tag: { backgroundColor: '#eff6ff', borderRadius: 999, color: colors.blue, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4 },
  tagRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'right' },
  topicPill: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  topicText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
});
