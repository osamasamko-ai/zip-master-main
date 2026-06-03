import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, RefreshControl, ScrollView, Share, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { apiClient } from '../api/client';
import { EmptyState, Screen, SkeletonCard, Toast } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type RouteKey =
  | 'home'
  | 'lawyers'
  | 'cases'
  | 'ai'
  | 'messages'
  | 'more'
  | 'feed'
  | 'legal'
  | 'contract'
  | 'billing'
  | 'following'
  | 'support'
  | 'settings'
  | 'intelligence'
  | 'pro'
  | 'admin'
  | 'profile';

type ProfileTab = 'overview' | 'posts' | 'reviews' | 'activity';

type ProfileStory = {
  id: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  seenByMe?: boolean;
  createdAt?: string;
};

const TABS: Array<{ id: ProfileTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'overview', label: 'حول', icon: 'person-circle-outline' },
  { id: 'posts', label: 'منشورات', icon: 'newspaper-outline' },
  { id: 'reviews', label: 'مراجعات', icon: 'star-outline' },
  { id: 'activity', label: 'نشاط', icon: 'pulse-outline' },
];

const CALENDAR_DAYS = [
  { day: 'السبت', date: '20 نيسان' },
  { day: 'الأحد', date: '21 نيسان' },
  { day: 'الاثنين', date: '22 نيسان' },
  { day: 'الثلاثاء', date: '23 نيسان' },
  { day: 'الأربعاء', date: '24 نيسان' },
];

const TIME_SLOTS = ['09:00 ص', '10:30 ص', '12:00 م', '02:00 م', '04:30 م', '06:00 م'];

function avatarFor(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d2a59&color=ffffff&rounded=true&font-size=0.4`;
}

function mediaUrl(value?: string | null) {
  return apiClient.getMediaUrl(value);
}

function toHighlights(value: any) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '')
    .split(/\n|،|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string) {
  if (!value) return 'الآن';
  return new Intl.DateTimeFormat('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function buildOwnProfileFromSettings(profile: any, fallbackUser: any) {
  const role = profile?.role || fallbackUser?.role || 'user';
  const isProfessional = role === 'pro';
  const isAdmin = role === 'admin';
  const name = profile?.name || fallbackUser?.name || 'مستخدم';
  const highlights = toHighlights(profile?.highlights);

  return {
    id: fallbackUser?.id || profile?.id || '',
    name,
    email: profile?.email || fallbackUser?.email || '',
    role,
    isProfessional,
    specialty: isProfessional ? profile?.specialty || 'محامٍ' : isAdmin ? 'إدارة المنصة' : 'مستخدم',
    location: profile?.location || 'العراق',
    experience: isProfessional ? `${profile?.experienceYears || 0} سنوات خبرة` : 'حساب نشط',
    experienceYears: profile?.experienceYears || 0,
    availability: isProfessional ? 'متاح حسب الجدول' : 'حساب نشط',
    isOnline: isAdmin,
    rating: 0,
    reviews: '0 مراجعة',
    reviewCount: 0,
    casesHandled: isProfessional ? '0 قضية' : '0 منشور',
    consultationFee: isProfessional ? profile?.consultationFee || 'غير محدد' : 'غير متاح',
    verified: Boolean(profile?.verified || fallbackUser?.verified),
    avatar: profile?.avatar || profile?.img || fallbackUser?.img || fallbackUser?.avatar || avatarFor(name),
    coverImage: profile?.coverImage || '',
    tagline: profile?.tagline || profile?.roleDescription || fallbackUser?.roleDescription || (isAdmin ? 'إدارة وتشغيل المنصة' : isProfessional ? 'استشارات قانونية مهنية' : 'عضو في منصة القسطاس'),
    followers: 0,
    responseTime: isProfessional ? 'يرد خلال ساعة' : 'نشاط داخل المنصة',
    bio: profile?.bio || (isAdmin ? 'ملف إداري موثق يعرض نشاط الحساب ودوره داخل المنصة.' : isProfessional ? 'ملف قانوني مهني قيد التطوير.' : 'ملف شخصي يعرض نشاط المستخدم وتفاعله داخل المنصة.'),
    highlights: highlights.length ? highlights : isAdmin ? ['إدارة المنصة', 'متابعة الجودة', 'دعم المستخدمين'] : isProfessional ? ['استشارات قانونية', 'تواصل مهني'] : ['عضو في المنصة', 'متابعة القضايا', 'تواصل قانوني'],
    license: (fallbackUser?.id || profile?.id || 'PROFILE').slice(0, 8).toUpperCase(),
    attachments: isProfessional ? ['هوية نقابية', 'رخصة ممارسة', 'اعتماد'] : ['هوية الحساب', 'نشاط المنصة', 'إعدادات الأمان'],
    status: profile?.verified || fallbackUser?.verified ? 'approved' : 'pending',
    submittedAt: 'حسابك',
    profileScore: profile?.verified || fallbackUser?.verified ? 85 : 45,
    accountBalance: profile?.accountBalance ?? fallbackUser?.accountBalance ?? 0,
    nationalIdVerified: Boolean(profile?.nationalIdVerified),
    lawyerLicenseVerified: Boolean(profile?.lawyerLicenseVerified),
    twoFactorEnabled: Boolean(profile?.twoFactor),
  };
}

function InteractiveCard({ children, onPress, style, disabled }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 8, tension: 40 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 40 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function ProfileScreen({ onOpen }: { onOpen?: (route: RouteKey) => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<ProfileStory[]>([]);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [relatedLawyers, setRelatedLawyers] = useState<any[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [followBusy, setFollowBusy] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [status, setStatus] = useState('');

  const isOwnProfile = Boolean(user?.id && profile?.id === user.id);
  const isProfessionalProfile = profile?.role === 'pro' || profile?.isProfessional;
  const isAdminProfile = profile?.role === 'admin';
  const activeStory = stories.find((story) => story.id === activeStoryId) || null;

  const profileHighlights = useMemo(
    () => (profile?.highlights?.length ? profile.highlights : [profile?.specialty, profile?.experience, profile?.responseTime].filter(Boolean)),
    [profile],
  );

  const credentialBadges = useMemo(
    () => [
      `${isProfessionalProfile ? 'رقم النقابة' : 'معرّف الحساب'}: ${profile?.license || '-'}`,
      `المرفقات: ${profile?.attachments?.length || 0} / 3`,
      `درجة الملف: ${profile?.profileScore ?? 0}%`,
      `الانضمام: ${profile?.submittedAt || 'غير محدد'}`,
    ],
    [isProfessionalProfile, profile],
  );

  const loadProfile = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    setLoading((current) => current || !profile);
    try {
      const response = await apiClient.getLawyerProfile(user.id);
      const payload = response.data?.data || response.data || response;
      if (!payload?.lawyer) throw new Error('Invalid profile payload');

      setProfile(payload.lawyer);
      setReviews(payload.reviews || []);
      setPosts(payload.posts || []);
      setStories(payload.stories || []);
      setActivityItems(payload.activity || []);
      setIsFollowing(Boolean(payload.lawyer?.isFollowing));
      setLoadError('');

      if (payload.lawyer.role === 'pro' || payload.lawyer.isProfessional) {
        const lawyersResponse = await apiClient.getLawyers();
        setRelatedLawyers((lawyersResponse.data || []).filter((item: any) => item.id !== user.id && item.specialty === payload.lawyer.specialty).slice(0, 2));
      } else {
        setRelatedLawyers([]);
      }
    } catch {
      try {
        const settingsResponse = await apiClient.getSettings();
        const fallback = buildOwnProfileFromSettings(settingsResponse.data?.profile, user);
        setProfile(fallback);
        setReviews([]);
        setPosts([]);
        setStories([]);
        setActivityItems(settingsResponse.data?.activityItems || []);
        setRelatedLawyers([]);
        setLoadError('');
      } catch {
        setLoadError('تعذر فتح الملف الشخصي حالياً. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [user?.id]);

  const markStorySeen = async (story: ProfileStory) => {
    setActiveStoryId(story.id);
    if (story.seenByMe) return;
    setStories((current) => current.map((item) => (item.id === story.id ? { ...item, seenByMe: true } : item)));
    await apiClient.markFeedStoryViewed(story.id).catch(() => undefined);
  };

  const toggleFollow = async () => {
    if (!profile?.id || isOwnProfile) return;
    setFollowBusy(true);
    try {
      const response = isFollowing ? await apiClient.unfollowLawyer(profile.id) : await apiClient.followLawyer(profile.id);
      const next = response.data || {};
      setIsFollowing(!isFollowing);
      setProfile((current: any) => current ? { ...current, followers: next.followerCount ?? Math.max(0, (current.followers || 0) + (isFollowing ? -1 : 1)) } : current);
      setStatus(isFollowing ? 'تم إلغاء المتابعة.' : 'تمت متابعة الملف.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحديث المتابعة.');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ title: profile?.name, message: `تعرّف على الملف المهني لـ ${profile?.name} على منصة القسطاس.` });
    } catch {
      setStatus('تعذر مشاركة الملف حالياً.');
    }
  };

  if (loading && !profile) {
    return (
      <Screen>
        <SkeletonCard media />
        <SkeletonCard />
        <SkeletonCard lines={2} />
      </Screen>
    );
  }

  if (!profile && loadError) {
    return (
      <Screen>
        <EmptyState title="تعذر تحميل الملف" note={loadError} />
        <Pressable onPress={() => onOpen?.('lawyers')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>العودة إلى المحامين</Text>
        </Pressable>
      </Screen>
    );
  }

  const coverUri = mediaUrl(profile?.coverImage) || null;
  const avatarUri = mediaUrl(profile?.avatar || profile?.img) || avatarFor(profile?.name || 'مستخدم');

  return (
    <Screen>
      <Toast message={status} tone={status.includes('تعذر') ? 'error' : 'success'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadProfile} tintColor={colors.navy} />}
        contentContainerStyle={styles.content}
      >
        <HeroSection
          icon="scale-outline"
          title={isOwnProfile ? "ملفي الشخصي" : "الملف الشخصي"}
          subtitle={isOwnProfile ? `أهلاً ${profile?.name?.split(' ')[0]}، هنا تجد ملخص نشاطك وبياناتك.` : `عرض السجل المهني لـ ${profile?.name}`}
          refreshing={refreshing}
        />

        {isOwnProfile && (
          <Pressable onPress={() => onOpen?.('settings')} style={styles.completionBarContainer}>
            <View style={styles.completionTextRow}>
              <Text style={styles.completionLabel}>جاهزية الحساب والتوثيق</Text>
              <Text style={styles.completionValue}>{profile?.profileScore ?? 0}%</Text>
            </View>
            <View style={styles.completionTrack}>
              <View
                style={[styles.completionFill, { width: `${profile?.profileScore ?? 0}%` }]}
              />
            </View>
          </Pressable>
        )}

        <View style={styles.hero}>
          <View style={styles.cover}>
            {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" /> : <View style={styles.coverFallback} />}
            <View style={styles.coverOverlay} />
            <View style={styles.coverActions} pointerEvents="box-none">
              <IconButton icon="newspaper-outline" onPress={() => onOpen?.('feed')} />
              {isOwnProfile ? <IconButton icon="camera-outline" onPress={() => onOpen?.('settings')} /> : null}
            </View>
          </View>

          <View style={styles.identity}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
              <View style={[styles.onlineDot, profile?.isOnline ? styles.onlineDotActive : styles.onlineDotMuted]} />
              {stories.length > 0 ? (
                <Pressable onPress={() => markStorySeen(stories.find((story) => !story.seenByMe) || stories[0])} style={styles.storyPlay}>
                  <Ionicons name="play" size={10} color="#fff" />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.identityText}>
              <View style={styles.badgeRow}>
                {profile?.verified || profile?.status === 'approved' ? (
                  <View style={styles.verifiedRow}><Ionicons name="shield-checkmark" size={14} color={colors.blue} /><Badge label={isProfessionalProfile ? 'محامٍ موثق' : isAdminProfile ? 'إدارة موثقة' : 'حساب موثق'} tone="blue" /></View>
                ) : <Badge label="بانتظار التوثيق" tone="gold" />}
                <Badge label={profile?.specialty || 'حساب'} />
              </View>
              <Text style={styles.name}>{profile?.name}</Text>
              <Text style={styles.tagline}>{profile?.tagline}</Text>
              <Text style={styles.socialProof}>
                {(profile?.followers || 0).toLocaleString('ar-IQ')} متابع · {profile?.reviewCount || 0} مراجعة · {profile?.casesHandled}
              </Text>
              <View style={styles.metaLine}>
                <Meta icon="location-outline" text={profile?.location || 'العراق'} />
                <Meta icon="briefcase-outline" text={profile?.experience || 'حساب نشط'} />
                <Meta icon="time-outline" text={profile?.responseTime || 'نشط'} />
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            {isOwnProfile ? (
              <Action label="تعديل الملف" icon="settings-outline" primary onPress={() => onOpen?.('settings')} />
            ) : profile?.id ? (
              <>
                <Action label="تواصل" icon="chatbubble-outline" primary onPress={() => onOpen?.('messages')} />
                <Action label={isFollowing ? 'متابع' : 'متابعة'} icon={isFollowing ? 'checkmark-outline' : 'add-outline'} loading={followBusy} onPress={toggleFollow} />
                <Action label="مشاركة" icon="share-social-outline" onPress={handleShare} />
              </>
            ) : (
              <Action label="عرض النشاط" icon="newspaper-outline" primary onPress={() => onOpen?.('feed')} />
            )}
            <Pressable onPress={() => { setNotificationsEnabled((current) => !current); setStatus(notificationsEnabled ? 'تم إيقاف تنبيهات الملف.' : 'تم تفعيل تنبيهات الملف.'); }} style={[styles.notifyButton, notificationsEnabled && styles.notifyButtonActive]}>
              <Ionicons name={notificationsEnabled ? 'notifications' : 'notifications-off-outline'} size={18} color={notificationsEnabled ? colors.blue : colors.muted} />
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <Stat label={isProfessionalProfile ? 'التقييم' : 'اكتمال الملف'} value={isProfessionalProfile ? Number(profile?.rating || 0).toFixed(1) : `${profile?.profileScore ?? 0}%`} note={isProfessionalProfile ? `${profile?.reviewCount || 0} مراجعة` : 'جاهزية الحساب'} />
            <Stat label="المتابعون" value={(profile?.followers || 0).toLocaleString('ar-IQ')} note="متابع" />
            <Stat label={isOwnProfile ? 'قوة الأمان' : isProfessionalProfile ? 'الخبرة' : 'الحالة'} value={isOwnProfile ? (profile?.twoFactorEnabled ? '92/100' : '71/100') : isProfessionalProfile ? `${profile?.experienceYears || 0}` : profile?.verified ? 'موثق' : 'نشط'} note={isOwnProfile ? (profile?.twoFactorEnabled ? 'حماية قوية' : 'تحتاج تحسين') : isProfessionalProfile ? 'سنوات ممارسة' : profile?.specialty} />
            <Stat label={isProfessionalProfile ? 'القضايا' : 'النشاط'} value={profile?.casesHandled || '0'} note={isProfessionalProfile ? 'منجزة' : 'عام'} />
          </View>
        </View>

        {stories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRail}>
            {stories.map((story) => (
              <InteractiveCard key={story.id} onPress={() => markStorySeen(story)} style={[styles.storyChip, !story.seenByMe && styles.storyChipNew]}>
                <Ionicons name={story.seenByMe ? 'play-circle-outline' : 'ellipse'} size={16} color={story.seenByMe ? colors.muted : colors.blue} />
                <Text style={styles.storyChipText} numberOfLines={1}>{story.text || 'قصة جديدة'}</Text>
              </InteractiveCard>
            ))}
          </ScrollView>
        ) : null}

        {activeStory ? (
          <View style={styles.storyPreview}>
            <View style={styles.storyPreviewHeader}>
              <Pressable onPress={() => setActiveStoryId(null)} style={styles.smallIconButton}>
                <Ionicons name="close" size={17} color={colors.muted} />
              </Pressable>
              <Text style={styles.storyPreviewTitle}>قصة {profile?.name}</Text>
            </View>
            {activeStory.mediaUrl && activeStory.mediaType === 'video' ? (
              <ProfileVideo uri={mediaUrl(activeStory.mediaUrl)} style={styles.storyImage} contentFit="contain" nativeControls autoPlay />
            ) : activeStory.mediaUrl ? (
              <Image source={{ uri: mediaUrl(activeStory.mediaUrl) }} style={styles.storyImage} resizeMode="contain" />
            ) : null}
            <Text style={styles.storyText}>{activeStory.text || 'لا يوجد نص للقصة.'}</Text>
          </View>
        ) : null}

        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, selected && styles.tabActive]}>
                <Ionicons name={tab.icon} size={15} color={selected ? '#fff' : colors.muted} />
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'overview' ? (
          <OverviewTab
            profile={profile}
            isOwnProfile={isOwnProfile}
            isProfessionalProfile={isProfessionalProfile}
            highlights={profileHighlights}
            credentialBadges={credentialBadges}
            relatedLawyers={relatedLawyers}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            setStatus={setStatus}
            onOpen={onOpen}
          />
        ) : activeTab === 'posts' ? (
          <PostsTab posts={posts} profile={profile} onOpen={onOpen} />
        ) : activeTab === 'reviews' ? (
          <ReviewsTab reviews={reviews} />
        ) : (
          <ActivityTab items={activityItems} />
        )}
      </ScrollView>
    </Screen>
  );
}

function OverviewTab({ profile, isOwnProfile, isProfessionalProfile, highlights, credentialBadges, relatedLawyers, selectedDate, setSelectedDate, selectedSlot, setSelectedSlot, setStatus, onOpen }: any) {
  const nextRoute = isOwnProfile ? 'settings' : isProfessionalProfile ? 'messages' : 'feed';

  return (
    <View style={styles.tabContent}>
      <Notice
        title="الخطوة التالية"
        text={
          isProfessionalProfile
            ? `ابدأ برسالة مباشرة أو افتح قضية إذا كان تخصص ${profile?.specialty} يناسب حاجتك.`
            : isOwnProfile
              ? 'حدّث صورتك ونبذتك وبياناتك ليظهر ملفك بشكل أوضح داخل المنصة.'
              : 'هذا ملف عام يعرض هوية الحساب ونشاطه داخل المنصة.'
        }
        action={isOwnProfile ? 'تعديل الملف' : isProfessionalProfile ? 'ابدأ الآن' : 'عرض النشاط'}
        onPress={() => onOpen?.(nextRoute)}
      />

      <Section title="نبذة وتعريف" style={styles.sectionNoPadding}>
        <Text style={styles.bodyText}>{profile?.bio}</Text>
      </Section>

      <Section title={isProfessionalProfile ? 'التخصصات والتميز' : 'الاهتمامات والنشاط'}>
        <View style={styles.chipWrap}>
          {highlights.map((item: string) => <InteractiveCard key={item} style={styles.infoChipInteractive}><InfoChip label={item} icon="sparkles-outline" /></InteractiveCard>)}
        </View>
      </Section>

      <Section title={isProfessionalProfile ? 'اعتماد الملف المهني' : 'اعتماد الحساب'}>
        <View style={styles.credentialGrid}>
          <Credential label={isProfessionalProfile ? 'رقم النقابة' : 'معرّف الحساب'} value={profile?.license || '-'} />
          <Credential label="حالة التحقق" value={profile?.status === 'approved' ? 'معتمد' : profile?.status === 'pending' ? 'قيد الانتظار' : 'غير مكتمل'} tone={profile?.status === 'approved' ? 'green' : 'gold'} />
          <Credential label={isProfessionalProfile ? 'المرفقات المهنية' : 'عناصر الملف'} value={`${profile?.attachments?.length || 0} مرفقات`} />
          <Credential label="درجة الملف" value={`${profile?.profileScore ?? 0}%`} />
        </View>
        <View style={styles.chipWrap}>
          {(profile?.attachments || []).map((item: string) => <InfoChip key={item} label={item} />)}
        </View>
        <View style={styles.chipWrap}>
          {credentialBadges.map((item: string) => <InfoChip key={item} label={item} />)}
        </View>
      </Section>

      <Section title="إشارات الثقة">
        <TrustRow label="التحقق" value={profile?.verified ? 'موثق' : 'بانتظار التوثيق'} tone={profile?.verified ? 'green' : 'gold'} />
        <TrustRow label="المراجعات" value={`${profile?.reviewCount || 0} مراجعة`} />
        <TrustRow label={isProfessionalProfile ? 'سعر الاستشارة' : 'نوع الحساب'} value={isProfessionalProfile ? profile?.consultationFee : profile?.specialty} />
        <TrustRow label="الرصيد" value={`${profile?.accountBalance ?? 0}`} />
      </Section>

      {isProfessionalProfile ? (
        <Section title="مواعيد متاحة للحجز" action="توقيت بغداد">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarRail}>
            {CALENDAR_DAYS.map((day, index) => ( // Wrap DayCard with InteractiveCard
              <Pressable key={day.date} onPress={() => setSelectedDate(index)} style={[styles.dayCard, selectedDate === index && styles.dayCardActive]}>
                <Text style={[styles.dayText, selectedDate === index && styles.dayTextActive]}>{day.day}</Text>
                <Text style={[styles.dateText, selectedDate === index && styles.dayTextActive]}>{day.date}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.slotGrid}>
            {TIME_SLOTS.map((slot) => (
              <InteractiveCard
                key={slot}
                onPress={() => {
                  setSelectedSlot(slot);
                  setStatus(`تم اختيار موعد ${slot}. افتح الرسائل لتأكيد الحجز.`);
                }}
                style={[styles.slot, selectedSlot === slot && styles.slotActive]}
              >
                <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextActive]}>{slot}</Text>
              </InteractiveCard>
            ))}
          </View>
        </Section>
      ) : null}

      {isProfessionalProfile && relatedLawyers.length > 0 ? (
        <Section title="محامون مشابهون">
          {relatedLawyers.map((item: any) => (
            <InteractiveCard key={item.id} onPress={() => onOpen?.('lawyers')} style={styles.relatedRow}>
              <Image source={{ uri: mediaUrl(item.avatar || item.img) || avatarFor(item.name) }} style={styles.relatedAvatar} />
              <View style={styles.relatedText}>
                <Text style={styles.relatedName}>{item.name}</Text>
                <Text style={styles.relatedMeta}>{item.specialty} · {item.rating || 0}</Text>
              </View>
            </InteractiveCard>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function PostsTab({ posts, profile, onOpen }: any) {
  const likes = posts.reduce((sum: number, post: any) => sum + (post.likesCount || 0), 0);
  const mediaCount = posts.filter((post: any) => post.mediaUrl).length;

  return (
    <View style={styles.tabContent}>
      <Section title={`منشورات ${profile?.name || ''}`} action="عرض تواصل">
        <View style={styles.postSummary}>
          <Credential label="منشور" value={posts.length.toLocaleString('ar-IQ')} />
          <Credential label="إعجاب" value={likes.toLocaleString('ar-IQ')} tone="gold" />
          <Credential label="وسائط" value={mediaCount.toLocaleString('ar-IQ')} />
        </View>
        <Pressable onPress={() => onOpen?.('feed')} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>فتح تواصل</Text>
        </Pressable>
      </Section>

      {posts.length === 0 ? (
        <EmptyState title="لا توجد منشورات بعد" note="عند نشر نشاط في تواصل سيظهر هنا." />
      ) : (
        posts.map((post: any) => ( // Wrap PostCard with InteractiveCard
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Image source={{ uri: mediaUrl(profile?.avatar || profile?.img) || avatarFor(profile?.name || 'مستخدم') }} style={styles.postAvatar} />
              <View style={styles.postHeaderText}>
                <View style={styles.badgeRow}>
                  {post.pinned ? <Badge label="مثبت" tone="gold" /> : null}
                  {post.featured ? <Badge label="مميز" tone="blue" /> : null}
                  {post.category ? <Badge label={`#${post.category}`} /> : null}
                </View>
                <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
              </View>
            </View>
            {post.content ? <Text style={styles.postContent}>{post.content}</Text> : null}
            {post.mediaUrl && post.mediaType === 'video' ? (
              <ProfileVideo uri={mediaUrl(post.mediaUrl)} style={styles.postImage} contentFit="contain" nativeControls />
            ) : post.mediaUrl ? (
              <Image source={{ uri: mediaUrl(post.mediaUrl) }} style={styles.postImage} resizeMode="contain" />
            ) : null}
            <Text style={styles.postStats}>{(post.likesCount || 0).toLocaleString('ar-IQ')} إعجاب · {(post.commentsCount || 0).toLocaleString('ar-IQ')} تعليق · {(post.shareCount || 0).toLocaleString('ar-IQ')} مشاركة</Text>
          </View>
        ))
      )}
    </View>
  );
}

function ReviewsTab({ reviews }: { reviews: any[] }) {
  return (
    <View style={styles.tabContent}>
      <Section title="المراجعات" style={styles.sectionNoPadding}>
        {reviews.length === 0 ? (
          <Text style={styles.emptyInline}>لا توجد مراجعات بعد.</Text>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewTime}>{review.time}</Text>
                <Text style={styles.reviewAuthor}>{review.author}</Text>
              </View>
              <Text style={styles.stars}>{'★'.repeat(Number(review.rating || 0))}</Text>
              <Text style={styles.reviewText}>{review.text}</Text>
            </View>
          ))
        )}
      </Section>
    </View>
  );
}

function ActivityTab({ items }: { items: any[] }) {
  return (
    <View style={styles.tabContent}>
      <Section title="النشاط الأخير" style={styles.sectionNoPadding}>
        {items.length === 0 ? (
          <Text style={styles.emptyInline}>لا يوجد نشاط حديث.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <Text style={styles.activityTime}>{item.time}</Text>
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityNote}>{item.note}</Text>
              </View>
            </View>
          ))
        )}
      </Section>
    </View>
  );
}

function Section({ title, action, children, style }: { title: string; action?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return ( // Apply Card styling to Section
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        {action ? <Text style={styles.sectionAction}>{action}</Text> : <View />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Notice({ title, text, action, onPress }: { title: string; text: string; action?: string; onPress?: () => void }) {
  return ( // Apply Card styling to Notice
    <View style={styles.notice}>
      <View style={styles.noticeTextWrap}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeText}>{text}</Text>
      </View>
      {action ? (
        <Pressable onPress={onPress} style={styles.noticeButton}>
          <Text style={styles.noticeButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return ( // Apply InteractiveCard to Stat
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </View>
  );
}

function Credential({ label, value, tone }: { label: string; value: string | number; tone?: 'green' | 'gold' }) {
  return ( // Apply Card styling to Credential
    <View style={styles.credential}>
      <Text style={styles.credentialLabel}>{label}</Text>
      <Text style={[styles.credentialValue, tone === 'green' && styles.greenText, tone === 'gold' && styles.goldText]}>{value}</Text>
    </View>
  );
}

function TrustRow({ label, value, tone }: { label: string; value: string | number; tone?: 'green' | 'gold' }) {
  return ( // Apply Card styling to TrustRow
    <View style={styles.trustRow}>
      <Text style={[styles.trustValue, tone === 'green' && styles.greenText, tone === 'gold' && styles.goldText]}>{value}</Text>
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

function InfoChip({ label, icon }: { label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return ( // Apply Card styling to InfoChip
    <View style={styles.infoChip}>
      {icon ? <Ionicons name={icon} size={13} color={colors.gold} /> : null}
      <Text style={styles.infoChipText}>{label}</Text>
    </View>
  );
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'blue' | 'gold' }) {
  return (
    <View style={[styles.badge, tone === 'blue' && styles.badgeBlue, tone === 'gold' && styles.badgeGold]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return ( // Apply Card styling to Meta
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={colors.muted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function IconButton({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return ( // Apply InteractiveCard to IconButton
    <Pressable onPress={onPress} style={styles.iconButton}>
      <Ionicons name={icon} size={18} color={colors.navy} />
    </Pressable>
  );
}

function Action({ label, icon, primary, loading, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; primary?: boolean; loading?: boolean; onPress: () => void }) {
  return ( // Apply InteractiveCard to Action
    <Pressable onPress={onPress} disabled={loading} style={[styles.actionButton, primary && styles.actionButtonPrimary]}>
      {loading ? <ActivityIndicator color={primary ? '#fff' : colors.navy} /> : <Ionicons name={icon} size={17} color={primary ? '#fff' : colors.navy} />}
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function ProfileVideo({
  uri,
  style,
  contentFit = 'cover',
  nativeControls = true,
  autoPlay = false,
}: {
  uri: string;
  style: any;
  contentFit?: 'contain' | 'cover' | 'fill';
  nativeControls?: boolean;
  autoPlay?: boolean;
}) {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.staysActiveInBackground = false;
    if (autoPlay) playerInstance.play();
  });

  useEffect(() => {
    if (autoPlay) player.play();
    else player.pause();
  }, [autoPlay, player]);

  return <VideoView player={player} style={style} contentFit={contentFit} nativeControls={nativeControls} playsInline allowsPictureInPicture={false} />;
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 18,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '800',
  },
  hero: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
  },
  cover: {
    height: 150,
    position: 'relative',
  },
  coverImage: {
    height: '100%',
    width: '100%',
  },
  coverFallback: {
    backgroundColor: colors.navy,
    height: '100%',
    width: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,42,67,0.28)',
  },
  coverActions: {
    bottom: 10,
    flexDirection: 'row-reverse',
    gap: 8,
    left: 10,
    position: 'absolute',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  identity: {
    alignItems: 'flex-end',
    flexDirection: 'row-reverse',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 0,
  },
  avatarWrap: {
    marginTop: -36,
    position: 'relative',
  },
  avatar: {
    backgroundColor: colors.paper,
    borderColor: '#fff',
    borderRadius: 48,
    borderWidth: 4,
    height: 96,
    width: 96,
  },
  onlineDot: {
    borderColor: colors.paper,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 8,
    height: 17,
    position: 'absolute',
    right: 8,
    width: 17,
  },
  onlineDotActive: {
    backgroundColor: colors.green,
  },
  onlineDotMuted: {
    backgroundColor: colors.subtle,
  },
  storyPlay: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderColor: '#fff',
    borderRadius: 999,
    borderWidth: 3,
    bottom: 5,
    height: 28,
    justifyContent: 'center',
    left: 4,
    position: 'absolute',
    width: 28,
  },
  identityText: {
    alignItems: 'flex-end',
    flex: 1,
    paddingTop: 12,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  verifiedRow: { // Already styled, ensuring consistency
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeBlue: {
    backgroundColor: colors.blueTint,
  },
  badgeGold: {
    backgroundColor: colors.goldTint,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  name: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 9,
    textAlign: 'right',
  },
  tagline: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'right',
  },
  socialProof: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 7,
    textAlign: 'right',
  },
  metaLine: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 8,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 4,
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    padding: 14,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 12,
    flexGrow: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  actionButtonPrimary: {
    backgroundColor: colors.blue,
  },
  actionText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  actionTextPrimary: {
    color: '#fff',
  },
  notifyButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  notifyButtonActive: {
    backgroundColor: '#e7f3ff',
  },
  statsGrid: {
    borderTopColor: colors.line,
    borderTopWidth: 0, // Remove top border as HeroSection already has a border
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    padding: 14,
  },
  statCard: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  statValue: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'right',
  },
  statNote: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  storyRail: {
    gap: 8,
    paddingTop: 12,
  },
  storyChip: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  storyChipNew: {
    borderColor: '#bfdbfe',
  },
  storyChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  storyPreview: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  storyPreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  smallIconButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  storyPreviewTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  storyImage: {
    aspectRatio: 9 / 12,
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
  },
  storyText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 23,
    textAlign: 'center',
  },
  tabs: {
    backgroundColor: colors.tint,
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: 4,
    marginTop: 12,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 4,
    justifyContent: 'center',
    minHeight: 38,
  },
  tabActive: {
    backgroundColor: colors.navy,
  },
  tabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    marginTop: 0, // Remove extra margin as sections have their own
    gap: 12,
  },
  notice: {
    alignItems: 'center',
    backgroundColor: colors.blueTint,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  noticeTextWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'right',
  },
  noticeButton: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  noticeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  section: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  }, // Already styled, ensuring consistency
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionAction: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  bodyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'right',
  },
  chipWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  infoChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.blueTint,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  infoChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  infoChipInteractive: { // Wrapper style for InteractiveCard
    marginRight: 8, // Adjust spacing for interactive chips
    fontWeight: '900',
  },
  credentialGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  credential: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  credentialLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  credentialValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'right',
  },
  greenText: {
    color: colors.green,
  },
  goldText: {
    color: colors.gold,
  },
  trustRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12,
  },
  trustLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  trustValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  calendarRail: {
    gap: 8,
  },
  dayCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.blueTint,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 96,
    padding: 11,
  },
  dayCardActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  dayText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  dateText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  dayTextActive: {
    color: '#fff',
  },
  slotGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  slot: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  slotActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  slotText: { // Added for text inside InteractiveCard
    color: colors.ink, fontSize: 12, fontWeight: '900',
  },
  slotTextActive: {
    color: '#fff',
  },
  relatedRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 8,
    padding: 10,
  },
  relatedAvatar: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
  relatedText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  relatedName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  relatedMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  postSummary: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 8,
    marginTop: 10,
    minHeight: 42,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  postCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  postHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  postAvatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  postHeaderText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  postDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },
  postContent: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 12,
    textAlign: 'right',
  },
  postImage: {
    aspectRatio: 1.2,
    borderRadius: 8,
    marginTop: 12,
    width: '100%',
  },
  postStats: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'right',
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 10,
    padding: 12,
  },
  reviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewAuthor: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  reviewTime: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  stars: {
    color: colors.gold,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'right',
  },
  reviewText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'right',
  },
  activityRow: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 12,
  },
  activityTime: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  activityText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  activityTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  activityNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'right',
  },
  emptyInline: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'right',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  completionBarContainer: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  completionTextRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionLabel: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  completionValue: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  completionTrack: { backgroundColor: colors.tint, borderRadius: 999, height: 6, overflow: 'hidden' },
  completionFill: { backgroundColor: colors.navy, height: '100%' },
  sectionNoPadding: {
    paddingVertical: 0, // For sections that only contain text and don't need extra vertical padding
  },
});
