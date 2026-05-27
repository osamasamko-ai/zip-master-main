import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { EmptyState, Screen, SkeletonCard } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { colors } from '../theme/colors';

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

export function FollowingScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [followedLawyers, setFollowedLawyers] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'lawyers' | 'posts'>('lawyers');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [sortMode, setSortMode] = useState<'date' | 'alpha'>('date');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [lawyersRes, postsRes] = await Promise.all([
        apiClient.getFollowing().catch(() => ({ data: [] })),
        apiClient.getFeedPosts('popular').catch(() => ({ data: [] }))
      ]);
      setFollowedLawyers(lawyersRes.data || []);
      setSavedPosts(postsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    setIsSelectMode(false);
  }, [activeTab]);

  const filteredLawyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...followedLawyers];
    if (q) {
      list = list.filter(lawyer =>
        String(lawyer.name || '').toLowerCase().includes(q) ||
        String(lawyer.specialty || '').toLowerCase().includes(q) ||
        String(lawyer.location || '').toLowerCase().includes(q)
      );
    }
    if (sortMode === 'alpha') {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
    }
    return list;
  }, [followedLawyers, search, sortMode]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...savedPosts];
    if (q) {
      list = list.filter(post =>
        String(post.content || '').toLowerCase().includes(q) ||
        String(post.category || '').toLowerCase().includes(q) ||
        String(post.author?.name || '').toLowerCase().includes(q)
      );
    }
    if (sortMode === 'alpha') {
      list.sort((a, b) => String(a.content || '').localeCompare(String(b.content || ''), 'ar'));
    }
    return list;
  }, [savedPosts, search, sortMode]);

  const handleSelectAll = useCallback(() => {
    const currentList = activeTab === 'lawyers' ? filteredLawyers : filteredPosts;
    const allIds = currentList.map(item => item.id);
    if (selectedIds.length === allIds.length && allIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  }, [activeTab, filteredLawyers, filteredPosts, selectedIds.length]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleUnfollow = async (lawyerId: string) => {
    if (isSelectMode) {
      toggleSelect(lawyerId);
      return;
    }
    setBusyId(lawyerId);
    try {
      await apiClient.unfollowLawyer(lawyerId);
      setFollowedLawyers(prev => prev.filter(l => l.id !== lawyerId));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId('');
    }
  };

  const handleUnsave = async (postId: string) => {
    if (isSelectMode) {
      toggleSelect(postId);
      return;
    }
    setBusyId(postId);
    try {
      await apiClient.saveFeedPost(postId);
      setSavedPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId('');
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.length === 0) return;
    setBusyId('bulk');
    try {
      if (activeTab === 'lawyers') {
        await Promise.all(selectedIds.map(id => apiClient.unfollowLawyer(id)));
        setFollowedLawyers(prev => prev.filter(l => !selectedIds.includes(l.id)));
      } else {
        await Promise.all(selectedIds.map(id => apiClient.saveFeedPost(id)));
        setSavedPosts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      }
      setIsSelectMode(false);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId('');
    }
  };

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <HeroSection
          icon="bookmark-outline"
          title="المتابعات والمحفوظات"
          subtitle="المحامون الذين تتابعهم والمنشورات التي قمت بحفظها."
          refreshing={refreshing}
        >
          <View style={styles.searchShell}>
            {search ? (
              <Pressable onPress={() => setSearch('')} style={styles.searchClear}>
                <Ionicons name="close" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
            <TextInput
              autoCapitalize="none"
              onChangeText={setSearch}
              placeholder={activeTab === 'lawyers' ? "ابحث في المتابعين..." : "ابحث في المحفوظات..."}
              placeholderTextColor={colors.subtle}
              style={styles.searchInput}
              value={search}
            />
            <Ionicons name="search-outline" size={19} color={colors.navy} />
          </View>
          <View style={styles.sortRow}>
            <Pressable onPress={() => setSortMode('date')} style={[styles.sortChip, sortMode === 'date' && styles.sortChipActive]}>
              <Ionicons name="time-outline" size={14} color={sortMode === 'date' ? '#fff' : colors.navy} />
              <Text style={[styles.sortChipText, sortMode === 'date' && styles.sortChipTextActive]}>الأحدث</Text>
            </Pressable>
            <Pressable onPress={() => setSortMode('alpha')} style={[styles.sortChip, sortMode === 'alpha' && styles.sortChipActive]}>
              <Ionicons name="text-outline" size={14} color={sortMode === 'alpha' ? '#fff' : colors.navy} />
              <Text style={[styles.sortChipText, sortMode === 'alpha' && styles.sortChipTextActive]}>أبجدياً</Text>
            </Pressable>
            <View style={styles.flex} />
            {isSelectMode && (activeTab === 'lawyers' ? filteredLawyers.length : filteredPosts.length) > 0 && (
              <Pressable onPress={handleSelectAll} style={styles.selectAllButton}>
                <Ionicons
                  name={selectedIds.length === (activeTab === 'lawyers' ? filteredLawyers.length : filteredPosts.length) ? "checkbox" : "square-outline"}
                  size={16}
                  color={colors.blue}
                />
                <Text style={styles.selectAllText}>الكل</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }}
              style={[styles.enterSelect, isSelectMode && styles.enterSelectActive]}
            >
              <Ionicons name={isSelectMode ? "close-circle-outline" : "checkbox-outline"} size={16} color={isSelectMode ? colors.red : colors.blue} />
              <Text style={[styles.enterSelectText, isSelectMode && styles.enterSelectTextActive]}>{isSelectMode ? 'إلغاء التحديد' : 'تحديد'}</Text>
            </Pressable>
          </View>
        </HeroSection>

        <View style={styles.tabSwitcher}>
          <Pressable
            onPress={() => setActiveTab('lawyers')}
            style={[styles.tab, activeTab === 'lawyers' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'lawyers' && styles.tabTextActive]}>
              المحامون ({followedLawyers.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('posts')}
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              المحفوظات ({savedPosts.length})
            </Text>
          </Pressable>
        </View>

        {activeTab === 'lawyers' ? (
          <View style={styles.section}>
            {filteredLawyers.length === 0 && !refreshing ? (
              <EmptyState
                title={search ? "لا توجد نتائج مطابقة" : "لا توجد متابعات"}
                note={search ? "جرّب تغيير كلمات البحث." : "ابدأ بمتابعة المحامين لتظهر قائمتهم هنا."}
              />
            ) : (
              filteredLawyers.map((lawyer) => (
                <InteractiveCard
                  key={lawyer.id}
                  onPress={() => isSelectMode ? toggleSelect(lawyer.id) : undefined}
                  style={[styles.lawyerCard, selectedIds.includes(lawyer.id) && styles.activeCard]}
                >
                  {isSelectMode && (
                    <View style={[styles.selectDot, selectedIds.includes(lawyer.id) && styles.selectDotActive]} />
                  )}
                  <View style={styles.lawyerHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{String(lawyer.name || 'م').charAt(0)}</Text>
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.lawyerTitleRow}>
                        {lawyer.verified && <Ionicons name="shield-checkmark" size={16} color={colors.blue} />}
                        <Text style={styles.lawyerName}>{lawyer.name}</Text>
                      </View>
                      <Text style={styles.specialtyLine}>{lawyer.specialty} · {lawyer.location}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleUnfollow(lawyer.id)}
                      style={styles.actionButton}
                      disabled={busyId === lawyer.id}
                    >
                      {busyId === lawyer.id ? (
                        <ActivityIndicator size="small" color={colors.gold} />
                      ) : (
                        <Ionicons name="bookmark" size={22} color={colors.gold} />
                      )}
                    </Pressable>
                  </View>
                </InteractiveCard>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {filteredPosts.length === 0 && !refreshing ? (
              <EmptyState
                title={search ? "لا توجد نتائج مطابقة" : "لا توجد محفوظات"}
                note={search ? "جرّب تغيير كلمات البحث." : "احفظ المنشورات المهمة للرجوع إليها لاحقاً."}
              />
            ) : (
              filteredPosts.map((post) => (
                <InteractiveCard
                  key={post.id}
                  onPress={() => isSelectMode ? toggleSelect(post.id) : undefined}
                  style={[styles.postCard, selectedIds.includes(post.id) && styles.activeCard]}
                >
                  {isSelectMode && (
                    <View style={[styles.selectDot, selectedIds.includes(post.id) && styles.selectDotActive]} />
                  )}
                  <View style={styles.postHeader}>
                    <View style={styles.authorInfo}>
                      <View style={styles.avatarSmall}>
                        <Text style={styles.avatarTextSmall}>{String(post.author?.name || 'م').charAt(0)}</Text>
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.authorName}>{post.author?.name || 'عضو المنصة'}</Text>
                        <Text style={styles.mutedTextSmall}>{post.category} · {post.createdAt || 'الآن'}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleUnsave(post.id)}
                      style={styles.actionButton}
                      disabled={busyId === post.id}
                    >
                      {busyId === post.id ? (
                        <ActivityIndicator size="small" color={colors.gold} />
                      ) : (
                        <Ionicons name="bookmark" size={22} color={colors.gold} />
                      )}
                    </Pressable>
                  </View>
                  <Text style={styles.postText} numberOfLines={3}>{post.content}</Text>
                </InteractiveCard>
              ))
            )}
          </View>
        )}

        {isSelectMode && selectedIds.length > 0 ? (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkText}>{selectedIds.length.toLocaleString('ar-IQ')} مختارة</Text>
            <Pressable onPress={handleBulkAction} style={styles.bulkButton} disabled={busyId === 'bulk'}>
              {busyId === 'bulk' ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.bulkButtonText}>{activeTab === 'lawyers' ? 'إلغاء المتابعة' : 'حذف المحفوظات'}</Text>}
            </Pressable>
          </View>
        ) : null}

        {refreshing && (filteredLawyers.length === 0 && filteredPosts.length === 0) && (
          <View style={styles.skeletonContainer}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 20 },
  activeCard: { borderColor: colors.blue, borderWidth: 1.5 },
  section: { marginTop: 4 },
  flex: { flex: 1 },
  tabSwitcher: {
    backgroundColor: colors.tint,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    gap: 4,
    marginBottom: 16,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.paper,
  },
  tabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  tabTextActive: {
    color: colors.blue,
  },
  selectAllButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginRight: 8 },
  selectAllText: { color: colors.blue, fontSize: 13, fontWeight: '900' },
  lawyerCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  lawyerHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  lawyerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
  },
  lawyerName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  specialtyLine: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
  },
  postCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  authorInfo: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  avatarSmall: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarTextSmall: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  authorName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  postHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    padding: 4,
  },
  searchShell: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    textAlign: 'right',
  },
  searchClear: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  sortRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  sortChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  sortChipActive: {
    backgroundColor: colors.navy,
  },
  sortChipText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  sortChipTextActive: {
    color: '#fff',
  },
  enterSelect: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  enterSelectActive: {
    opacity: 0.8,
  },
  enterSelectText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  enterSelectTextActive: {
    color: colors.red,
  },
  bulkBar: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 16,
    padding: 10,
    marginHorizontal: 16
  },
  bulkButton: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  bulkButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  bulkText: { color: '#fff', flex: 1, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  selectDot: { borderColor: colors.line, borderRadius: 999, borderWidth: 2, height: 18, width: 18, position: 'absolute', top: 14, left: 14, zIndex: 1 },
  selectDotActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  mutedTextSmall: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'right',
  },
  postText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'right',
  },
  skeletonContainer: { gap: 10 },
});