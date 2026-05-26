import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, EmptyState, Field, Heading, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function FeedScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);

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
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

