import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { EmptyState, Screen, SkeletonCard } from '../components/ui';
import { HeroSection } from '../components/ui/HeroSection';
import { colors } from '../theme/colors';

export function FollowingScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [followedLawyers, setFollowedLawyers] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'lawyers' | 'posts'>('lawyers');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

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

  const filteredLawyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return followedLawyers;
    return followedLawyers.filter(lawyer =>
      String(lawyer.name || '').toLowerCase().includes(q) ||
      String(lawyer.specialty || '').toLowerCase().includes(q) ||
      String(lawyer.location || '').toLowerCase().includes(q)
    );
  }, [followedLawyers, search]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return savedPosts;
    return savedPosts.filter(post =>
      String(post.content || '').toLowerCase().includes(q) ||
      String(post.category || '').toLowerCase().includes(q) ||
      String(post.author?.name || '').toLowerCase().includes(q)
    );
  }, [savedPosts, search]);

  const handleUnfollow = async (lawyerId: string) => {
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
              filteredLawyers.map(lawyer => (
                <View key={lawyer.id} style={styles.lawyerCard}>
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
                </View>
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
              filteredPosts.map(post => (
                <View key={post.id} style={styles.postCard}>
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
                </View>
              ))
            )}
          </View>
        )}

        {refreshing && (filteredLawyers.length === 0 || filteredPosts.length === 0) && (
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