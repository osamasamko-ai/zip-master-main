import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '../api/client';
import { Card, EmptyState, Heading, Pill, Screen, SkeletonCard } from '../components/ui';
import { colors } from '../theme/colors';

type RouteKey =
  | 'home'
  | 'cases'
  | 'messages'
  | 'billing'
  | 'legal'
  | 'ai'
  | 'settings'
  | 'pro'
  | 'lawyers'
  | 'admin'
  | 'more';

type IntelligenceScreenProps = {
  onOpen?: (route: RouteKey) => void;
};

const targetRouteMap: Record<string, RouteKey> = {
  '/': 'home',
  '/user': 'home',
  '/cases': 'cases',
  '/mycases': 'cases',
  '/messages': 'messages',
  '/billing': 'billing',
  '/legal': 'legal',
  '/legal-docs': 'legal',
  '/aichat': 'ai',
  '/ai': 'ai',
  '/settings': 'settings',
  '/pro': 'pro',
  '/lawyers': 'lawyers',
  '/admin': 'admin',
};

function toneForPriority(priority?: string): 'neutral' | 'gold' | 'green' | 'red' | 'blue' {
  if (priority === 'high' || priority === 'critical') return 'red';
  if (priority === 'medium') return 'gold';
  if (priority === 'low') return 'blue';
  return 'neutral';
}

function iconFromServer(icon?: string): keyof typeof Ionicons.glyphMap {
  if (!icon) return 'sparkles-outline';
  if (icon.includes('wallet')) return 'wallet-outline';
  if (icon.includes('reply')) return 'return-up-back-outline';
  if (icon.includes('comment') || icon.includes('message')) return 'chatbubble-ellipses-outline';
  if (icon.includes('file') || icon.includes('document')) return 'document-text-outline';
  if (icon.includes('cloud')) return 'cloud-upload-outline';
  if (icon.includes('star')) return 'star-outline';
  if (icon.includes('shield')) return 'shield-checkmark-outline';
  if (icon.includes('circle-check') || icon.includes('check')) return 'checkmark-circle-outline';
  if (icon.includes('robot')) return 'sparkles-outline';
  if (icon.includes('book')) return 'book-outline';
  if (icon.includes('user')) return 'person-circle-outline';
  return 'sparkles-outline';
}

function routeFromTarget(target?: string): RouteKey {
  if (!target) return 'intelligence' as RouteKey;
  const cleanTarget = target.split('?')[0].replace(/\/$/, '') || '/';
  return targetRouteMap[cleanTarget] || 'more';
}

function getRiskColor(score: number) {
  if (score >= 70) return colors.red;
  if (score >= 40) return colors.gold;
  return colors.green;
}

export function IntelligenceScreen({ onOpen }: IntelligenceScreenProps) {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.getIntelligence();
      setData(response.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const recommendations = data?.recommendations || data?.actions || data?.insights || [];
  const dailyBrief = data?.dailyBrief;
  const caseRisk = data?.caseRisk || [];
  const healthChecks = data?.healthChecks || [];
  const assistant = data?.assistant;
  const quickActions = useMemo(() => {
    return recommendations
      .map((item: any) => item.quickAction ? { ...item.quickAction, source: item } : null)
      .filter(Boolean)
      .slice(0, 4);
  }, [recommendations]);
  const topRisk = caseRisk[0];

  const openTarget = (target?: string) => {
    const route = routeFromTarget(target);
    if (route === ('intelligence' as RouteKey)) return;
    onOpen?.(route);
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} showsVerticalScrollIndicator={false}>
        <Heading title="الذكاء التشغيلي" subtitle="مركز ذكي للموجز اليومي، مخاطر القضايا، والإجراءات المتوقعة." />

        {!data && refreshing ? (
          <>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
          </>
        ) : null}

        {assistant ? (
          <Card style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="sparkles-outline" size={22} color={colors.gold} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.heroEyebrow}>المساعد الذكي</Text>
                <Text style={styles.heroTitle}>{assistant.headline}</Text>
              </View>
            </View>
            <Text style={styles.heroText}>{assistant.summary}</Text>
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceTrack}>
                <View style={[styles.confidenceFill, { width: `${Math.min(100, Math.max(0, assistant.confidence || 0))}%` }]} />
              </View>
              <Text style={styles.confidenceText}>{assistant.confidence || 0}% ثقة</Text>
            </View>
            <Pressable onPress={() => openTarget(assistant.target)} style={styles.primaryAction}>
              <Ionicons name="arrow-back-outline" size={17} color="#fff" />
              <Text style={styles.primaryActionText}>{assistant.nextAction || assistant.aiAction || 'افتح الإجراء'}</Text>
            </Pressable>
          </Card>
        ) : null}

        {dailyBrief ? (
          <Card>
            <View style={styles.sectionHeader}>
              <Pill label="AI Daily Brief" tone="blue" />
              <Text style={styles.sectionTitle}>{dailyBrief.title}</Text>
            </View>
            <Text style={styles.mutedText}>{dailyBrief.summary}</Text>
            {(dailyBrief.items || []).map((item: any) => (
              <Pressable key={item.id} onPress={() => openTarget(item.target)} style={styles.briefItem}>
                <View style={[styles.briefIcon, { backgroundColor: toneForPriority(item.priority) === 'red' ? colors.redTint : colors.blueTint }]}>
                  <Ionicons name={iconFromServer(item.icon)} size={17} color={toneForPriority(item.priority) === 'red' ? colors.red : colors.blue} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemNote}>{item.detail}</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {quickActions.length > 0 ? (
          <Card>
            <View style={styles.sectionHeader}>
              <Pill label="Predictive" tone="gold" />
              <Text style={styles.sectionTitle}>إجراءات متوقعة</Text>
            </View>
            <View style={styles.quickGrid}>
              {quickActions.map((action: any, index: number) => (
                <Pressable key={`${action.label}-${index}`} onPress={() => openTarget(action.target)} style={styles.quickCard}>
                  <Ionicons name={iconFromServer(action.icon)} size={18} color={colors.blue} />
                  <Text style={styles.quickText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {topRisk ? (
          <Card>
            <View style={styles.sectionHeader}>
              <Pill label="Smart Risk" tone={toneForPriority(topRisk.level)} />
              <Text style={styles.sectionTitle}>أعلى ملف يحتاج انتباه</Text>
            </View>
            <View style={styles.riskRow}>
              <View style={styles.riskGauge}>
                <Text style={[styles.riskScore, { color: getRiskColor(topRisk.score || 0) }]}>{topRisk.score || 0}%</Text>
                <Text style={styles.riskLabel}>مخاطر</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{topRisk.title}</Text>
                <Text style={styles.itemNote}>{topRisk.nextAction || topRisk.label || 'راجع الملف وحدد الخطوة التالية.'}</Text>
              </View>
            </View>
            {(topRisk.reasons || []).slice(0, 3).map((reason: string) => (
              <View key={reason} style={styles.reasonRow}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.gold} />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
            <Pressable onPress={() => onOpen?.('cases')} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>فتح القضايا</Text>
            </Pressable>
          </Card>
        ) : null}

        {healthChecks.length > 0 ? (
          <Card>
            <View style={styles.sectionHeader}>
              <Pill label="Health" tone="green" />
              <Text style={styles.sectionTitle}>مراقبة صحة الحساب</Text>
            </View>
            <View style={styles.healthGrid}>
              {healthChecks.map((item: any) => (
                <View key={item.label} style={styles.healthCell}>
                  <Text style={styles.healthValue}>{item.value}</Text>
                  <Text style={styles.healthLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {recommendations.length === 0 && !refreshing ? (
          <EmptyState title="لا توجد تنبيهات حالياً" note="ستظهر هنا الأولويات والاقتراحات عند توفر بيانات كافية." />
        ) : null}

        {recommendations.map((item: any, index: number) => (
          <Card key={item.id || index}>
            <View style={styles.recommendationTop}>
              <Pill label={item.priority || item.level || 'اقتراح'} tone={toneForPriority(item.priority || item.level)} />
              <View style={styles.recommendationIcon}>
                <Ionicons name={iconFromServer(item.icon)} size={18} color={colors.blue} />
              </View>
            </View>
            <Text style={styles.recommendationTitle}>{item.title || item.label || 'اقتراح ذكي'}</Text>
            <Text style={styles.mutedText}>{item.note || item.description || item.reason || 'راجع هذه النقطة لتحسين سير العمل.'}</Text>
            {item.impact ? <Text style={styles.impactText}>الأثر: {item.impact}</Text> : null}
            <View style={styles.actionRow}>
              <Pressable onPress={() => openTarget(item.target)} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>{item.action || 'فتح'}</Text>
              </Pressable>
              {item.aiBrief ? (
                <Pressable onPress={() => onOpen?.('ai')} style={styles.aiAction}>
                  <Ionicons name="sparkles-outline" size={15} color={colors.gold} />
                  <Text style={styles.aiActionText}>{item.aiAction || 'حلل بالذكاء'}</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  aiAction: {
    alignItems: 'center',
    backgroundColor: colors.goldTint,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
  },
  aiActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  briefIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  briefItem: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 10,
    padding: 10,
  },
  confidenceFill: {
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 7,
  },
  confidenceRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 12,
  },
  confidenceText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  confidenceTrack: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    flex: 1,
    height: 7,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  healthCell: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    padding: 10,
  },
  healthGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'right',
  },
  healthValue: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'right',
  },
  heroCard: {
    backgroundColor: colors.navySoft,
  },
  heroEyebrow: {
    color: colors.lightGold,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroText: {
    color: '#e8eef7',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'right',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: 3,
    textAlign: 'right',
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  impactText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'right',
  },
  itemNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 3,
    textAlign: 'right',
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'right',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 7,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 45,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  quickCard: {
    alignItems: 'center',
    backgroundColor: colors.blueTint,
    borderRadius: 8,
    flexBasis: '48%',
    gap: 6,
    justifyContent: 'center',
    minHeight: 78,
    padding: 10,
  },
  quickGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  reasonRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
    marginTop: 8,
  },
  reasonText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'right',
  },
  recommendationIcon: {
    alignItems: 'center',
    backgroundColor: colors.blueTint,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  recommendationTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  recommendationTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riskGauge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    height: 72,
    justifyContent: 'center',
    width: 78,
  },
  riskLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  riskRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 11,
    marginTop: 10,
  },
  riskScore: {
    fontSize: 20,
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.blueTint,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  secondaryActionText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '900',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
});
