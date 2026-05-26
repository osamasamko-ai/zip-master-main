import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitle}>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : <View />}
      <Text style={styles.sectionText}>{title}</Text>
    </View>
  );
}

export function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      {note ? <Text style={styles.emptyNote}>{note}</Text> : null}
    </Card>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue' }) {
  const toneStyle = {
    neutral: styles.pillNeutral,
    gold: styles.pillGold,
    green: styles.pillGreen,
    red: styles.pillRed,
    blue: styles.pillBlue,
  }[tone];

  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={[styles.pillText, tone !== 'neutral' && styles.pillTextStrong]}>{label}</Text>
    </View>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={[styles.button, variant === 'secondary' && styles.secondaryButton]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.navy} /> : <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
}) {
  return (
    <TextInput
      autoCapitalize="none"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#98a2b3"
      secureTextEntry={secureTextEntry}
      style={styles.input}
    />
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    padding: 18,
  },
  heading: {
    marginBottom: 16,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'right',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
    textAlign: 'right',
  },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  sectionAction: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  emptyNote: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: 6,
    textAlign: 'right',
  },
  pill: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillNeutral: {
    backgroundColor: '#eef2f6',
  },
  pillGold: {
    backgroundColor: '#fff6df',
  },
  pillGreen: {
    backgroundColor: '#e9f8ef',
  },
  pillRed: {
    backgroundColor: '#fff1f0',
  },
  pillBlue: {
    backgroundColor: '#eff6ff',
  },
  pillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  pillTextStrong: {
    color: colors.ink,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButton: {
    backgroundColor: '#eef2f6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: colors.navy,
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 50,
    marginBottom: 10,
    paddingHorizontal: 14,
    textAlign: 'right',
  },
});
