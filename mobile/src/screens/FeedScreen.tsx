import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Divider, EmptyState, Field, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function FeedScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commentPostId, setCommentPostId] = useState('');
  const [comment, setComment] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getFeedPosts();
      setPosts(response.data || []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      await apiClient.createFeedPost(content.trim());
      setContent('');
      await load();
    } finally {
      setPosting(false);
    }
  };

  const react = async (id: string, action: 'like' | 'save' | 'share') => {
    setBusyId(id);
    try {
      if (action === 'like') await apiClient.likeFeedPost(id);
      if (action === 'save') await apiClient.saveFeedPost(id);
      if (action === 'share') await apiClient.shareFeedPost(id);
      await load();
    } finally {
      setBusyId('');
    }
  };

  const submitComment = async (postId: string) => {
    if (!comment.trim()) return;
    setBusyId(postId);
    try {
      await apiClient.addFeedComment(postId, comment.trim());
      setComment('');
      setCommentPostId('');
      await load();
    } finally {
      setBusyId('');
    }
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <Heading title="المجتمع القانوني" subtitle="منشورات، أسئلة، وتحديثات من المحامين والمستخدمين." />
        <Card>
          <Field value={content} onChangeText={setContent} placeholder="شارك سؤالاً أو تحديثاً قانونياً" />
          <Button title="نشر" onPress={submit} loading={posting} />
        </Card>
        {posts.length === 0 ? <EmptyState title="لا توجد منشورات بعد" note="اسحب للتحديث أو ابدأ أول منشور." /> : null}
        {posts.map((post) => (
          <Card key={post.id}>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Pill label={post.category || 'عام'} tone="blue" />
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
                {post.author?.name || post.authorName || 'عضو المنصة'}
              </Text>
              <Text style={{ color: colors.muted, lineHeight: 22, textAlign: 'right' }}>{post.content}</Text>
              <Text style={{ color: colors.gold, fontWeight: '800', textAlign: 'right' }}>
                {post.likesCount ?? post.likes ?? 0} إعجاب · {post.commentsCount ?? 0} تعليق
              </Text>
              <Divider />
              <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                <FeedAction label="إعجاب" disabled={busyId === post.id} onPress={() => react(post.id, 'like')} />
                <FeedAction label="حفظ" disabled={busyId === post.id} onPress={() => react(post.id, 'save')} />
                <FeedAction label="مشاركة" disabled={busyId === post.id} onPress={() => react(post.id, 'share')} />
                <FeedAction label="تعليق" onPress={() => setCommentPostId(commentPostId === post.id ? '' : post.id)} />
              </View>
              {commentPostId === post.id ? (
                <View style={{ width: '100%' }}>
                  <Field value={comment} onChangeText={setComment} placeholder="اكتب تعليقاً" />
                  <Button title="إرسال التعليق" onPress={() => submitComment(post.id)} loading={busyId === post.id} />
                </View>
              ) : null}
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function FeedAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: '#eef2f6',
        borderRadius: 8,
        flex: 1,
        minHeight: 38,
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: colors.navy, fontSize: 12, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}
