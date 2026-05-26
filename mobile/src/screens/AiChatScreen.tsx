import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Field, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

type Message = { role: 'user' | 'assistant'; content: string };

export function AiChatScreen() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!question.trim()) return;
    const nextQuestion = question.trim();
    const nextMessages: Message[] = [...messages, { role: 'user', content: nextQuestion }];
    setMessages(nextMessages);
    setQuestion('');
    setLoading(true);
    try {
      const response = await apiClient.askAi(nextQuestion, nextMessages);
      setMessages([...nextMessages, { role: 'assistant', content: response.data?.answer || response.data?.response || 'لا توجد إجابة حالياً.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Heading title="المساعد الذكي" subtitle="اسأل سؤالاً قانونياً عاماً واحصل على شرح مبسط." />
      <ScrollView style={{ flex: 1 }}>
        {messages.map((message, index) => (
          <Card key={`${message.role}-${index}`}>
            <Text style={{ color: message.role === 'user' ? colors.navy : colors.ink, fontWeight: '800', textAlign: 'right' }}>
              {message.role === 'user' ? 'أنت' : 'المساعد'}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 22, marginTop: 8, textAlign: 'right' }}>{message.content}</Text>
          </Card>
        ))}
      </ScrollView>
      <View>
        <Field value={question} onChangeText={setQuestion} placeholder="اكتب سؤالك القانوني" />
        <Button title="إرسال" onPress={ask} loading={loading} />
      </View>
    </Screen>
  );
}

