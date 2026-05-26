import React from 'react';
import { Text } from 'react-native';
import { Card, Heading, Screen } from '../components/ui';
import { colors } from '../theme/colors';

export function MessagesScreen() {
  return (
    <Screen>
      <Heading title="الرسائل" subtitle="واجهة أولية للمحادثات بين المستخدم والمحامي." />
      <Card>
        <Text style={{ color: colors.muted, textAlign: 'right' }}>سيتم ربط هذه الشاشة برسائل القضايا والمحادثات المباشرة في المرحلة التالية.</Text>
      </Card>
    </Screen>
  );
}

