import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Pill, Screen } from '../components/ui';
import { colors } from '../theme/colors';
import { buildLegalActionPlan, LegalPlan } from '../utils/legalActionPlan';

type RouteKey = 'lawyers' | 'contract' | 'ai';

const examples = [
  'صاحب البيت طردني من الشقة بدون إنذار',
  'شخص عليه دين ولم يرجع المبلغ',
  'أريد معرفة خطوات النفقة والحضانة',
  'شريكي في الشركة أخذ الأرباح ولم يسلمني حصتي',
];

const urgencyTone: Record<LegalPlan['urgency'], 'red' | 'gold' | 'blue'> = {
  critical: 'red',
  high: 'gold',
  medium: 'blue',
};

export function LegalActionPlanScreen({ onOpen }: { onOpen?: (route: RouteKey) => void }) {
  const [problem, setProblem] = useState('');
  const [submittedProblem, setSubmittedProblem] = useState('');
  const plan = useMemo(() => (submittedProblem ? buildLegalActionPlan(submittedProblem) : null), [submittedProblem]);
  const canGenerate = problem.trim().length >= 12;

  const handleShare = async () => {
    if (!plan) return;
    await Share.share({ message: plan.shareText });
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="git-branch-outline" size={24} color={colors.gold} />
          </View>
          <Text style={styles.kicker}>Legal Action Plan</Text>
          <Text style={styles.title}>اكتب مشكلتك واحصل على خطتك القانونية</Text>
          <Text style={styles.subtitle}>تصنيف، أولوية، مستندات، وخطوات عملية قبل اختيار المحامي.</Text>
        </View>

        <Card>
          <Text style={styles.label}>ما المشكلة القانونية؟</Text>
          <TextInput
            multiline
            onChangeText={setProblem}
            placeholder="مثال: شخص استدان مني مبلغاً ولدي وصل ومحادثات لكنه يرفض الدفع..."
            placeholderTextColor={colors.subtle}
            style={styles.textArea}
            textAlign="right"
            textAlignVertical="top"
            value={problem}
          />
          <View style={styles.examples}>
            {examples.map((example) => (
              <Pressable key={example} onPress={() => setProblem(example)} style={styles.exampleChip}>
                <Text style={styles.exampleText}>{example}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="إنشاء الخطة" disabled={!canGenerate} onPress={() => setSubmittedProblem(problem.trim())} />
        </Card>

        {plan ? (
          <>
            <Card>
              <View style={styles.planHeader}>
                <Pill label={`الأولوية: ${plan.urgencyLabel}`} tone={urgencyTone[plan.urgency]} />
                <Text style={styles.planTitle}>{plan.category}</Text>
              </View>
              <Text style={styles.planSummary}>{plan.summary}</Text>
              <View style={styles.costBox}>
                <Text style={styles.costLabel}>التكلفة المتوقعة</Text>
                <Text style={styles.costText}>{plan.estimatedCost}</Text>
              </View>
              <View style={styles.specialties}>
                {plan.matchingSpecialties.map((item) => (
                  <Pill key={item} label={item} />
                ))}
              </View>
            </Card>

            <PlanList icon="checkbox-outline" title="الخطوات التالية" items={plan.nextSteps} />
            <PlanList icon="folder-open-outline" title="المستندات المطلوبة" items={plan.requiredDocuments} />

            <Card>
              <Text style={styles.sectionTitle}>حوّل الخطة إلى إجراء</Text>
              <View style={styles.actionGrid}>
                <ActionButton icon="people-outline" title="محام" onPress={() => onOpen?.('lawyers')} />
                <ActionButton icon="create-outline" title="مستند" onPress={() => onOpen?.('contract')} />
                <ActionButton icon="sparkles-outline" title="المساعد" onPress={() => onOpen?.('ai')} />
              </View>
              <Button title="مشاركة الخطة" variant="secondary" onPress={handleShare} />
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.sectionTitle}>الفكرة التي تساعد التطبيق ينتشر</Text>
            <Text style={styles.planSummary}>المستخدم يشارك الخطة لأنها مفيدة فوراً، والمحامي يستلم ملفاً مرتباً بدل محادثة مبعثرة.</Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function PlanList({ icon, title, items }: { icon: keyof typeof Ionicons.glyphMap; title: string; items: string[] }) {
  return (
    <Card>
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.smallIcon}>
          <Ionicons name={icon} size={18} color={colors.navy} />
        </View>
      </View>
      {items.map((item, index) => (
        <View key={item} style={styles.listRow}>
          <Text style={styles.listText}>{item}</Text>
          <View style={styles.stepNumber}>
            <Text style={styles.stepText}>{index + 1}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

function ActionButton({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={21} color={colors.navy} />
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16,
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    marginBottom: 10,
    width: 48,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 34,
    marginTop: 5,
    textAlign: 'right',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 5,
    textAlign: 'right',
  },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'right',
  },
  textArea: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    minHeight: 138,
    padding: 12,
  },
  examples: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
    marginTop: 10,
  },
  exampleChip: {
    backgroundColor: colors.tint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  exampleText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  planHeader: {
    alignItems: 'flex-end',
    gap: 10,
  },
  planTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },
  planSummary: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 10,
    textAlign: 'right',
  },
  costBox: {
    alignItems: 'flex-end',
    backgroundColor: colors.navy,
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
  },
  costLabel: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  costText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },
  specialties: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 9,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  smallIcon: {
    alignItems: 'center',
    backgroundColor: colors.goldTint,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  listRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
    padding: 10,
  },
  listText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'right',
  },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  stepText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  actionGrid: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
    marginTop: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minHeight: 76,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  actionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
});
