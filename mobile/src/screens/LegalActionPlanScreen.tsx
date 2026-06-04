import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, Card, Pill, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  const [problem, setProblem] = useState('');
  const [submittedProblem, setSubmittedProblem] = useState('');
  const [completedRequirements, setCompletedRequirements] = useState<Record<string, boolean>>({});
  const [caseNotes, setCaseNotes] = useState('');
  const [caseBudget, setCaseBudget] = useState('');
  const [pickedDocs, setPickedDocs] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [clientListings, setClientListings] = useState<any[]>([]);
  const [lawyerListings, setLawyerListings] = useState<any[]>([]);
  const [marketplaceMessage, setMarketplaceMessage] = useState('');
  const [marketplaceError, setMarketplaceError] = useState('');
  const [busy, setBusy] = useState('');
  const plan = useMemo(() => (submittedProblem ? buildLegalActionPlan(submittedProblem) : null), [submittedProblem]);
  const canGenerate = problem.trim().length >= 12;
  const completionItems = useMemo(() => {
    if (!plan) return [];
    return [
      ...plan.requiredDocuments.map((item) => ({ id: `doc-${item}`, label: item, type: 'مستند' })),
      ...plan.nextSteps.map((item) => ({ id: `step-${item}`, label: item, type: 'خطوة' })),
    ];
  }, [plan]);
  const completedCount = completionItems.filter((item) => completedRequirements[item.id]).length;
  const readiness = completionItems.length ? Math.round((completedCount / completionItems.length) * 100) : 0;
  const suggestedBudget = useMemo(() => {
    if (!plan) return 0;
    if (plan.urgency === 'critical') return 750000;
    if (plan.category.includes('مطالبة') || plan.category.includes('شركة')) return 500000;
    if (plan.category.includes('أحوال')) return 350000;
    return 250000;
  }, [plan]);
  const missingRequirement = useMemo(() => completionItems.find((item) => !completedRequirements[item.id]), [completedRequirements, completionItems]);

  const handleShare = async () => {
    if (!plan) return;
    await Share.share({ message: plan.shareText });
  };

  const loadMarketplace = async () => {
    try {
      const clientResponse = await apiClient.getClientCaseMarketplaceListings();
      setClientListings(clientResponse.data || []);
    } catch {
      setClientListings([]);
    }
    if (user?.role === 'pro' || user?.role === 'admin') {
      try {
        const lawyerResponse = await apiClient.getLawyerCaseMarketplaceListings();
        setLawyerListings(lawyerResponse.data || []);
      } catch {
        setLawyerListings([]);
      }
    }
  };

  useEffect(() => {
    if (user) void loadMarketplace();
  }, [user?.id, user?.role]);

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (!result.canceled) setPickedDocs(result.assets.slice(0, 8));
  };

  const publishMarketplaceCase = async () => {
    if (!plan) return;
    const budget = Number(caseBudget.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(budget) || budget <= 0) {
      setMarketplaceError('حدد مبلغ الدعوى المقترح للمحامين.');
      return;
    }
    setBusy('publish');
    setMarketplaceMessage('');
    setMarketplaceError('');
    try {
      const data = new FormData();
      data.append('title', plan.category);
      data.append('matter', submittedProblem);
      data.append('category', plan.category);
      data.append('budget', String(budget));
      data.append('readiness', String(readiness));
      data.append('notes', caseNotes);
      data.append('location', String((user as any)?.location || ''));
      pickedDocs.forEach((doc) => {
        data.append('documents', {
          uri: doc.uri,
          name: doc.name || 'document',
          type: doc.mimeType || 'application/octet-stream',
        } as any);
      });
      const response = await apiClient.publishCaseMarketplaceListing(data);
      setMarketplaceMessage(response.message || 'تم نشر الدعوى للمحامين.');
      setPickedDocs([]);
      await loadMarketplace();
    } catch (error: any) {
      setMarketplaceError(error?.message || 'تعذر نشر الدعوى.');
    } finally {
      setBusy('');
    }
  };

  const respondToListing = async (id: string, decision: 'accept' | 'reject') => {
    setBusy(`${id}-${decision}`);
    try {
      await apiClient.respondToCaseMarketplaceListing(id, { decision });
      await loadMarketplace();
    } finally {
      setBusy('');
    }
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
          <Button
            title="إنشاء الخطة"
            disabled={!canGenerate}
            onPress={() => {
              setSubmittedProblem(problem.trim());
              setCompletedRequirements({});
              setCaseNotes('');
            }}
          />
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
              <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>مقترحات لتحسين خطتي</Text>
                <View style={styles.smallIcon}>
                  <Ionicons name="bulb-outline" size={18} color={colors.navy} />
                </View>
              </View>
              {missingRequirement ? (
                <SuggestionRow
                  icon="checkmark-circle-outline"
                  title={`أكمل ${missingRequirement.type} مهم`}
                  note={missingRequirement.label}
                  action="تحديد كمكتمل"
                  onPress={() => setCompletedRequirements((current) => ({ ...current, [missingRequirement.id]: true }))}
                />
              ) : (
                <SuggestionRow icon="shield-checkmark-outline" title="ملفك منظم وجاهز" note="يمكنك الآن نشر الدعوى أو اختيار محام مناسب." action="عرض المحامين" onPress={() => onOpen?.('lawyers')} />
              )}
              <SuggestionRow
                icon="cash-outline"
                title="مبلغ مقترح للدعوى"
                note={`${suggestedBudget.toLocaleString('en-US')} د.ع كبداية قابلة للتفاوض مع المحامي.`}
                action="استخدام المبلغ"
                onPress={() => setCaseBudget(String(suggestedBudget))}
              />
              <SuggestionRow
                icon="chatbox-ellipses-outline"
                title="رسالة مختصرة للمحامي"
                note="أضف ملخصاً واضحاً يزيد فرصة قبول الدعوى بسرعة."
                action="إضافة للملاحظات"
                onPress={() =>
                  setCaseNotes(
                    `أرغب بعرض هذه الدعوى على محام متخصص. التصنيف: ${plan.category}. الأولوية: ${plan.urgencyLabel}. جاهزية الملف: ${readiness}%. أحتاج تقييماً للتكلفة والخطوة القانونية الأقرب.`,
                  )
                }
              />
            </Card>

            <Card>
              <View style={styles.readinessHeader}>
                <Text style={styles.sectionTitle}>إكمال المتطلبات</Text>
                <Text style={styles.readinessValue}>{readiness}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${readiness}%` }]} />
              </View>
              {completionItems.map((item) => {
                const checked = Boolean(completedRequirements[item.id]);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setCompletedRequirements((current) => ({ ...current, [item.id]: !current[item.id] }))}
                    style={[styles.requirementRow, checked && styles.requirementRowDone]}
                  >
                    <View style={styles.requirementText}>
                      <Text style={styles.requirementType}>{item.type}</Text>
                      <Text style={[styles.requirementLabel, checked && styles.requirementLabelDone]}>{item.label}</Text>
                    </View>
                    <View style={[styles.checkBox, checked && styles.checkBoxDone]}>
                      {checked ? <Ionicons name="checkmark" size={17} color="#fff" /> : null}
                    </View>
                  </Pressable>
                );
              })}
              <TextInput
                multiline
                onChangeText={setCaseNotes}
                placeholder="أضف ملاحظاتك: التواريخ، أسماء الأطراف، المبلغ، الشهود..."
                placeholderTextColor={colors.subtle}
                style={styles.notesArea}
                textAlign="right"
                textAlignVertical="top"
                value={caseNotes}
              />
              <View style={styles.briefBox}>
                <Text style={styles.briefTitle}>ملخص جاهز للمحامي</Text>
                <Text style={styles.briefText}>التصنيف: {plan.category}</Text>
                <Text style={styles.briefText}>الأولوية: {plan.urgencyLabel}</Text>
                <Text style={styles.briefText}>الجاهزية: {readiness}%</Text>
                <Text style={styles.briefText}>ملاحظات: {caseNotes.trim() || 'لم تتم إضافة ملاحظات بعد'}</Text>
              </View>
              <Button title={readiness >= 60 ? 'اختيار محام مناسب' : 'إكمال التفاصيل مع المساعد'} onPress={() => onOpen?.(readiness >= 60 ? 'lawyers' : 'ai')} />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>نشر الدعوى للمحامين</Text>
              <Text style={styles.planSummary}>حدد مبلغ الدعوى المقترح وارفع الوثائق ليتم عرضها على المحامين القريبين والمقترحين للقبول أو الرفض.</Text>
              {marketplaceMessage ? <Text style={styles.successText}>{marketplaceMessage}</Text> : null}
              {marketplaceError ? <Text style={styles.errorText}>{marketplaceError}</Text> : null}
              <TextInput
                keyboardType="numeric"
                onChangeText={setCaseBudget}
                placeholder="المبلغ المقترح بالدينار"
                placeholderTextColor={colors.subtle}
                style={styles.amountInput}
                textAlign="right"
                value={caseBudget}
              />
              <Pressable onPress={pickDocuments} style={styles.uploadButton}>
                <Text style={styles.uploadText}>{pickedDocs.length ? `${pickedDocs.length} وثائق مختارة` : 'رفع وثائق الدعوى'}</Text>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.gold} />
              </Pressable>
              <Button title="نشر الدعوى للمحامين" loading={busy === 'publish'} onPress={publishMarketplaceCase} />
            </Card>

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

        {clientListings.length > 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>دعاواي المنشورة</Text>
            {clientListings.slice(0, 4).map((item) => <MarketplaceCard key={item.id} item={item} />)}
          </Card>
        ) : null}

        {lawyerListings.length > 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>دعاوى مقترحة للمحامي</Text>
            {lawyerListings.slice(0, 5).map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                action={
                  item.offerStatus ? (
                    <Text style={styles.offerStatus}>قرارك: {item.offerStatus === 'accepted' ? 'قبول' : 'رفض'}</Text>
                  ) : (
                    <View style={styles.offerActions}>
                      <Pressable onPress={() => respondToListing(item.id, 'reject')} style={styles.rejectButton}>
                        <Text style={styles.rejectText}>رفض</Text>
                      </Pressable>
                      <Pressable onPress={() => respondToListing(item.id, 'accept')} style={styles.acceptButton}>
                        <Text style={styles.acceptText}>{busy === `${item.id}-accept` ? 'جار القبول' : 'قبول'}</Text>
                      </Pressable>
                    </View>
                  )
                }
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function MarketplaceCard({ item, action }: { item: any; action?: React.ReactNode }) {
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketHead}>
        {action || <Text style={styles.offerStatus}>{item.status === 'assigned' ? `تم اختيار ${item.selectedLawyerName || 'محام'}` : 'بانتظار المحامين'}</Text>}
        <View style={styles.marketTitleWrap}>
          <Text style={styles.marketTitle}>{item.title}</Text>
          <Text style={styles.marketMeta}>{Number(item.budget || 0).toLocaleString('en-US')} د.ع · جاهزية {item.readiness}%</Text>
        </View>
      </View>
      <Text style={styles.marketMatter} numberOfLines={2}>{item.matter}</Text>
      <View style={styles.marketTags}>
        {item.nearby ? <Pill label="قريب" tone="blue" /> : null}
        {item.suggested ? <Pill label="مقترح" tone="gold" /> : null}
        <Pill label={`${item.documents?.length || 0} وثائق`} />
      </View>
    </View>
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

function SuggestionRow({
  icon,
  title,
  note,
  action,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  note: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}>
      <Text style={styles.suggestionAction}>{action}</Text>
      <View style={styles.suggestionText}>
        <Text style={styles.suggestionTitle}>{title}</Text>
        <Text style={styles.suggestionNote}>{note}</Text>
      </View>
      <View style={styles.suggestionIcon}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
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
  suggestionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    padding: 10,
  },
  suggestionIcon: {
    alignItems: 'center',
    backgroundColor: colors.goldTint,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  suggestionText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  suggestionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  suggestionNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'right',
  },
  suggestionAction: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  readinessHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  readinessValue: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '900',
  },
  progressTrack: {
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 8,
    marginBottom: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    height: '100%',
  },
  requirementRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
    padding: 10,
  },
  requirementRowDone: {
    backgroundColor: colors.greenTint,
    borderColor: '#bdebd7',
  },
  requirementText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  requirementType: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
  },
  requirementLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 2,
    textAlign: 'right',
  },
  requirementLabelDone: {
    color: colors.green,
    textDecorationLine: 'line-through',
  },
  checkBox: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  checkBoxDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  notesArea: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    marginTop: 10,
    minHeight: 105,
    padding: 11,
  },
  briefBox: {
    alignItems: 'flex-end',
    backgroundColor: colors.navy,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 10,
    padding: 12,
  },
  briefTitle: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
  },
  briefText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'right',
  },
  amountInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
    padding: 12,
  },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 10,
    minHeight: 46,
  },
  uploadText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  successText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },
  marketCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 9,
    padding: 11,
  },
  marketHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  marketTitleWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  marketTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  marketMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  marketMatter: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'right',
  },
  marketTags: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  offerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  rejectButton: {
    backgroundColor: colors.redTint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rejectText: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '900',
  },
  acceptButton: {
    backgroundColor: colors.green,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  acceptText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  offerStatus: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
});
