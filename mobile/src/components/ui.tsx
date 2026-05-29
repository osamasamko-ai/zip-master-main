import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export const Card = React.memo(function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
});

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitle}>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : <View />}
      <Text style={styles.sectionText}>{title}</Text>
    </View>
  );
}

export const EmptyState = React.memo(function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {note ? <Text style={styles.emptyNote}>{note}</Text> : null}
    </View>
  );
});

export function KeyValue({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.keyValueValue}>{value}</Text>
      <Text style={styles.keyValueLabel}>{label}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export const Pill = React.memo(function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue' }) {
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
});

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
      style={({ pressed }) => [styles.button, variant === 'secondary' && styles.secondaryButton, pressed && !loading && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.blue} /> : <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>{title}</Text>}
    </Pressable>
  );
}

export function Toast({ message, tone = 'success' }: { message?: string; tone?: 'success' | 'error' | 'info' }) {
  if (!message) return null;
  const toneStyle = tone === 'error' ? styles.toastError : tone === 'info' ? styles.toastInfo : styles.toastSuccess;
  return (
    <View style={[styles.toast, toneStyle]}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

export const SkeletonCard = React.memo(function SkeletonCard({ lines = 3, media = false }: { lines?: number; media?: boolean }) {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.skeletonHeaderText}>
          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          <View style={[styles.skeletonLine, styles.skeletonLineTiny]} />
        </View>
      </View>
      {Array.from({ length: lines }).map((_, index) => (
        <View key={index} style={[styles.skeletonLine, index === lines - 1 && styles.skeletonLineMedium]} />
      ))}
      {media ? <View style={styles.skeletonMedia} /> : null}
    </View>
  );
});

export function BottomSheet({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
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
      placeholderTextColor={colors.subtle}
      secureTextEntry={secureTextEntry}
      style={styles.input}
    />
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  heading: {
    marginBottom: 14,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 34,
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
    elevation: 2,
    marginBottom: 10,
    padding: 13,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
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
  emptyCard: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginBottom: 10,
    padding: 16,
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
    backgroundColor: colors.tint,
  },
  pillGold: {
    backgroundColor: colors.goldTint,
  },
  pillGreen: {
    backgroundColor: colors.greenTint,
  },
  pillRed: {
    backgroundColor: colors.redTint,
  },
  pillBlue: {
    backgroundColor: colors.blueTint,
  },
  pillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  pillTextStrong: {
    color: colors.ink,
  },
  keyValue: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 4,
  },
  keyValueValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  keyValueLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 8,
    elevation: 2,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  secondaryButton: {
    backgroundColor: colors.blueTint,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: colors.blue,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 52,
    marginBottom: 9,
    paddingHorizontal: 14,
    textAlign: 'right',
  },
  toast: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toastError: {
    backgroundColor: colors.redTint,
    borderColor: '#ffd5d2',
  },
  toastInfo: {
    backgroundColor: colors.blueTint,
    borderColor: '#cfe1ff',
  },
  toastSuccess: {
    backgroundColor: colors.greenTint,
    borderColor: '#c9edd5',
  },
  toastText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 19,
    textAlign: 'right',
  },
  skeletonCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginBottom: 10,
    padding: 13,
  },
  skeletonHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  skeletonAvatar: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 42,
    width: 42,
  },
  skeletonHeaderText: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 10,
    width: '100%',
  },
  skeletonLineMedium: {
    width: '76%',
  },
  skeletonLineShort: {
    width: '42%',
  },
  skeletonLineTiny: {
    width: '28%',
  },
  skeletonMedia: {
    aspectRatio: 1.45,
    backgroundColor: colors.tint,
    borderRadius: 8,
    marginTop: 2,
    width: '100%',
  },
  sheetBackdrop: {
    backgroundColor: colors.backdrop,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '88%',
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 44,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'right',
  },
});
