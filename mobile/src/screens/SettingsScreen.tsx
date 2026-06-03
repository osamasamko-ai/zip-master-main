import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '../api/client';
import { Button, EmptyState, Screen, SkeletonCard, Toast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Section = 'readiness' | 'account' | 'publicProfile' | 'security' | 'documents' | 'billing' | 'notifications' | 'integrations' | 'activity';

type SessionItem = {
  id: string;
  device: string;
  location: string;
  lastSeen: string;
  current: boolean;
  ipAddress: string;
};

type InvoiceItem = {
  id: string;
  label: string;
  amount: string;
  date: string;
  status: 'paid' | 'pending';
};

type ActivityItem = {
  id: string;
  title: string;
  note: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type ReadinessStep = {
  id: string;
  title: string;
  note: string;
  section: Section;
  weight: number;
  done: boolean;
  status: 'done' | 'review' | 'missing';
  icon: keyof typeof Ionicons.glyphMap;
};

const fallbackSessions: SessionItem[] = [
  { id: 'session-1', device: 'iPhone 15 • التطبيق', location: 'بغداد، العراق', lastSeen: 'نشط الآن', current: true, ipAddress: '185.77.21.62' },
  { id: 'session-2', device: 'MacBook • Safari', location: 'بغداد، العراق', lastSeen: 'قبل 18 دقيقة', current: false, ipAddress: '185.77.21.14' },
  { id: 'session-3', device: 'Windows • Chrome', location: 'أربيل، العراق', lastSeen: 'أمس 09:40 ص', current: false, ipAddress: '109.224.15.83' },
];

const fallbackInvoices: InvoiceItem[] = [
  { id: 'inv-1', label: 'خطة Professional - نيسان', amount: '$79.00', date: '16 نيسان 2026', status: 'paid' },
  { id: 'inv-2', label: 'إضافة مساحة تخزينية', amount: '$12.00', date: '03 نيسان 2026', status: 'paid' },
  { id: 'inv-3', label: 'خطة Professional - أيار', amount: '$79.00', date: '01 أيار 2026', status: 'pending' },
];

const activitySeed: ActivityItem[] = [
  { id: 'a1', title: 'تم تحديث البريد الإلكتروني', note: 'جرى حفظ بيانات التواصل.', time: 'اليوم 11:20 ص', icon: 'person-outline' },
  { id: 'a2', title: 'تسجيل دخول جديد', note: 'تمت المصادقة من جهاز iPhone.', time: 'اليوم 09:05 ص', icon: 'shield-checkmark-outline' },
  { id: 'a3', title: 'تم إصدار فاتورة الاشتراك', note: 'فاتورة شهر أبريل جاهزة.', time: '16 أبريل 2026', icon: 'card-outline' },
];

const suggestedFees = ['25,000 د.ع', '50,000 د.ع', '75,000 د.ع', '100,000 د.ع'];
const suggestedSpecialties = ['أحوال شخصية', 'قضايا تجارية', 'عقارات', 'قانون العمل', 'العقود'];
const suggestedHighlights = ['صياغة العقود', 'تفاوض وتسوية النزاعات', 'تمثيل أمام المحاكم', 'استشارات للشركات'];

function formatConsultationFeeInput(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? `${Number(digits).toLocaleString('en-US')} د.ع` : '';
}

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const isProfessional = user?.role === 'pro' || user?.role === 'admin';
  const [activeSection, setActiveSection] = useState<Section>('readiness');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState('');
  const [status, setStatus] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [billingStatus, setBillingStatus] = useState<'active' | 'past_due'>('active');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [highlights, setHighlights] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [language, setLanguage] = useState('العربية');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [prefs, setPrefs] = useState({
    twoFactor: false,
    pushNotifications: true,
    emailAlerts: true,
    billingReminders: true,
    securityAlerts: true,
    marketingEmails: false,
  });
  const [sessions, setSessions] = useState<SessionItem[]>(fallbackSessions);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(fallbackInvoices);
  const [documents, setDocuments] = useState({
    nationalIdUrl: '',
    nationalIdVerified: false,
    lawyerLicenseUrl: '',
    lawyerLicenseVerified: false,
  });
  const [connectedApps, setConnectedApps] = useState([
    { id: 'google', name: 'Google Workspace', desc: 'المواعيد والملفات', connected: true, icon: 'logo-google' as const },
    { id: 'zain', name: 'Zain Cash', desc: 'المدفوعات السريعة', connected: true, icon: 'phone-portrait-outline' as const },
    { id: 'dropbox', name: 'Dropbox', desc: 'تخزين سحابي إضافي', connected: false, icon: 'cube-outline' as const },
  ]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>(activitySeed);

  const sections = useMemo(() => [
    { key: 'readiness' as const, label: 'الجاهزية', icon: 'checkmark-done-circle-outline' as const },
    { key: 'account' as const, label: 'الحساب', icon: 'id-card-outline' as const },
    ...(isProfessional ? [{ key: 'publicProfile' as const, label: 'الملف العام', icon: 'person-circle-outline' as const }] : []),
    { key: 'security' as const, label: 'الأمان', icon: 'shield-checkmark-outline' as const },
    { key: 'documents' as const, label: 'المستندات', icon: 'document-lock-outline' as const },
    { key: 'billing' as const, label: 'الفوترة', icon: 'card-outline' as const },
    { key: 'notifications' as const, label: 'الإشعارات', icon: 'notifications-outline' as const },
    { key: 'integrations' as const, label: 'التكاملات', icon: 'link-outline' as const },
    { key: 'activity' as const, label: 'النشاط', icon: 'time-outline' as const },
  ], [isProfessional]);

  const securityScore = prefs.twoFactor ? 92 : 71;
  const requiredDocumentItems = isProfessional
    ? [documents.nationalIdUrl, documents.lawyerLicenseUrl]
    : [documents.nationalIdUrl];
  const verifiedDocumentItems = isProfessional
    ? [documents.nationalIdVerified, documents.lawyerLicenseVerified]
    : [documents.nationalIdVerified];
  const uploadedDocs = requiredDocumentItems.filter(Boolean).length;
  const verifiedDocs = verifiedDocumentItems.filter(Boolean).length;
  const alertChannels = [prefs.emailAlerts, prefs.pushNotifications, prefs.billingReminders, prefs.securityAlerts].filter(Boolean).length;
  const readinessSteps = useMemo<ReadinessStep[]>(() => {
    const baseSteps: ReadinessStep[] = [
      {
        id: 'account',
        title: 'بيانات الحساب الأساسية',
        note: name && email && phone ? 'الاسم والبريد والهاتف مكتملة.' : 'أكمل الاسم ورقم الهاتف لتثبيت هوية الحساب.',
        section: 'account',
        weight: 20,
        done: Boolean(name && email && phone),
        status: name && email && phone ? 'done' : 'missing',
        icon: 'id-card-outline',
      },
      {
        id: 'national-id',
        title: 'البطاقة الوطنية',
        note: documents.nationalIdVerified ? 'تم اعتماد الهوية الوطنية.' : documents.nationalIdUrl ? 'مرفوعة وتنتظر مراجعة الإدارة.' : 'ارفع صورة واضحة أو ملف PDF للبطاقة الوطنية.',
        section: 'documents',
        weight: 20,
        done: documents.nationalIdVerified,
        status: documents.nationalIdVerified ? 'done' : documents.nationalIdUrl ? 'review' : 'missing',
        icon: 'document-lock-outline',
      },
      {
        id: 'security',
        title: 'قوة الأمان',
        note: prefs.twoFactor ? 'المصادقة الثنائية مفعلة.' : 'فعّل المصادقة الثنائية لحماية الدخول من الأجهزة الجديدة.',
        section: 'security',
        weight: 10,
        done: prefs.twoFactor,
        status: prefs.twoFactor ? 'done' : 'missing',
        icon: 'shield-checkmark-outline',
      },
      {
        id: 'notifications',
        title: 'قنوات التنبيه المهمة',
        note: prefs.pushNotifications && prefs.securityAlerts ? 'تنبيهات التطبيق والأمان مفعلة.' : 'فعّل تنبيهات التطبيق والأمان حتى لا تفوتك قرارات التوثيق.',
        section: 'notifications',
        weight: 10,
        done: Boolean(prefs.pushNotifications && prefs.securityAlerts),
        status: prefs.pushNotifications && prefs.securityAlerts ? 'done' : 'missing',
        icon: 'notifications-outline',
      },
    ];

    if (!isProfessional) {
      return [
        ...baseSteps,
        {
          id: 'billing',
          title: 'جاهزية الدفع',
          note: billingStatus === 'active' ? 'الفوترة في وضع جيد.' : 'راجع حالة الفوترة قبل استخدام الخدمات المدفوعة.',
          section: 'billing',
          weight: 40,
          done: billingStatus === 'active',
          status: billingStatus === 'active' ? 'done' : 'missing',
          icon: 'card-outline',
        },
      ];
    }

    return [
      baseSteps[0],
      {
        id: 'public-profile',
        title: 'الملف المهني العام',
        note: bio && specialty && highlights && consultationFee ? 'النبذة والتخصص والسعر ونقاط التميز مكتملة.' : 'أكمل النبذة والتخصص والسعر ونقاط التميز لرفع ظهورك.',
        section: 'publicProfile',
        weight: 20,
        done: Boolean(bio && specialty && highlights && consultationFee),
        status: bio && specialty && highlights && consultationFee ? 'done' : 'missing',
        icon: 'person-circle-outline',
      },
      baseSteps[1],
      {
        id: 'lawyer-license',
        title: 'بطاقة المحاماة',
        note: documents.lawyerLicenseVerified ? 'تم اعتماد بطاقة المحاماة.' : documents.lawyerLicenseUrl ? 'مرفوعة وتنتظر مراجعة الإدارة.' : 'ارفع بطاقة المحاماة لتفعيل استقبال العملاء.',
        section: 'documents',
        weight: 20,
        done: documents.lawyerLicenseVerified,
        status: documents.lawyerLicenseVerified ? 'done' : documents.lawyerLicenseUrl ? 'review' : 'missing',
        icon: 'briefcase-outline',
      },
      baseSteps[2],
      baseSteps[3],
    ];
  }, [billingStatus, bio, consultationFee, documents.lawyerLicenseUrl, documents.lawyerLicenseVerified, documents.nationalIdUrl, documents.nationalIdVerified, email, highlights, isProfessional, name, phone, prefs.pushNotifications, prefs.securityAlerts, prefs.twoFactor, specialty]);
  const profileCompletion = useMemo(() => {
    return readinessSteps.reduce((total, step) => total + (step.done ? step.weight : 0), 0);
  }, [readinessSteps]);
  const remainingSteps = readinessSteps.filter((step) => !step.done);
  const accountTrustStatus = verifiedDocs === verifiedDocumentItems.length ? 'موثق' : uploadedDocs > 0 ? 'قيد المراجعة' : 'غير مكتمل';

  useEffect(() => {
    let mounted = true;
    apiClient.getSettings().then((response) => {
      if (!mounted) return;
      const data = response.data || {};
      const profile = data.profile || {};
      setName(profile.name || user?.name || '');
      setEmail(profile.email || user?.email || '');
      setPhone(profile.phone || '');
      setCompany(profile.company || '');
      setTagline(profile.tagline || '');
      setBio(profile.bio || '');
      setSpecialty(profile.specialty || '');
      setExperienceYears(profile.experienceYears ? String(profile.experienceYears) : '');
      setHighlights(Array.isArray(profile.highlights) ? profile.highlights.join('\n') : profile.highlights || '');
      setConsultationFee(profile.consultationFee || '');
      setLanguage(profile.language || 'العربية');
      setPrefs({
        twoFactor: Boolean(profile.twoFactor),
        pushNotifications: Boolean(profile.pushNotifications ?? true),
        emailAlerts: Boolean(profile.emailAlerts ?? true),
        billingReminders: Boolean(profile.billingReminders ?? true),
        securityAlerts: Boolean(profile.securityAlerts ?? true),
        marketingEmails: Boolean(profile.marketingEmails),
      });
      setSessions(data.sessions?.length ? data.sessions : fallbackSessions);
      setInvoices(data.invoices?.length ? data.invoices : fallbackInvoices);
      setActivityItems(data.activityItems?.length ? data.activityItems : activitySeed);
      setDocuments({
        nationalIdUrl: profile.nationalIdUrl || '',
        nationalIdVerified: Boolean(profile.nationalIdVerified),
        lawyerLicenseUrl: profile.lawyerLicenseUrl || '',
        lawyerLicenseVerified: Boolean(profile.lawyerLicenseVerified),
      });
    }).catch(() => setStatus('تعذر تحميل الإعدادات. يتم عرض نسخة محفوظة.')).finally(() => mounted && setLoadingSettings(false));
    return () => { mounted = false; };
  }, [user?.email, user?.name]);

  const markChanged = () => {
    setHasChanges(true);
    setStatus('');
  };

  const saveAll = async () => {
    if (isProfessional && !/\d/.test(consultationFee)) {
      setStatus('أدخل سعر استشارة صحيح قبل الحفظ.');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      await Promise.all([
        apiClient.updateSettingsProfile({ name, phone, company, tagline, bio, specialty, experienceYears, highlights, consultationFee, language }),
        apiClient.updateSettingsPreferences({ ...prefs, language }),
      ]);
      setHasChanges(false);
      setStatus('تم حفظ الإعدادات بنجاح.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus('يرجى تعبئة جميع حقول كلمة المرور.');
      return;
    }
    if (newPassword.length < 8) {
      setStatus('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActivityItems((current) => [{ id: `a-${Date.now()}`, title: 'تم تغيير كلمة المرور', note: 'اكتملت عملية تحديث كلمة المرور.', time: 'الآن', icon: 'lock-closed-outline' }, ...current]);
      setStatus('تم تحديث كلمة المرور.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحديث كلمة المرور.');
    } finally {
      setSaving(false);
    }
  };

  const revokeSession = async (session: SessionItem) => {
    if (session.current) return;
    setSessions((current) => current.filter((item) => item.id !== session.id));
    setStatus('تم إنهاء الجلسة.');
    try {
      await apiClient.revokeSession(session.id);
    } catch {
      setStatus('تم إنهاء الجلسة محلياً، وتعذر تأكيدها من الخادم.');
    }
  };

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
    markChanged();
    if (key === 'twoFactor') {
      setActivityItems((current) => [{ id: `a-${Date.now()}`, title: !prefs.twoFactor ? 'تم تفعيل التحقق الثنائي' : 'تم إيقاف التحقق الثنائي', note: 'تم تحديث إعدادات الأمان.', time: 'الآن', icon: 'shield-checkmark-outline' }, ...current]);
    }
  };

  const addDocument = async (key: 'nationalId' | 'lawyerLicense') => {
    setStatus('');
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingDocument(key);
    try {
      const response = await apiClient.uploadProfileDocument(key, {
        uri: asset.uri,
        name: asset.name || `${key}-${Date.now()}`,
        type: asset.mimeType || 'application/octet-stream',
      });
      const fileUrl = response.data?.fileUrl || response.data?.data?.fileUrl || response.data?.url || '';
      setDocuments((current) => ({
        ...current,
        [`${key}Url`]: fileUrl || current[`${key}Url`],
        [`${key}Verified`]: false,
      } as typeof current));
      setStatus(key === 'nationalId' ? 'تم رفع البطاقة الوطنية للمراجعة.' : 'تم رفع بطاقة المحاماة للمراجعة.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر رفع المستند.');
    } finally {
      setUploadingDocument('');
    }
  };

  const exportData = () => {
    setStatus('تم تجهيز أرشيف البيانات داخل التطبيق.');
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}><Ionicons name="settings-outline" size={24} color={colors.gold} /></View>
          <View style={styles.headerText}>
            <Text style={styles.title}>الإعدادات</Text>
            <Text style={styles.subtitle}>إدارة الحساب، الأمان، الفوترة، المستندات، والنشاط.</Text>
          </View>
        </View>

        <View style={styles.scoreCard}>
          <Metric label="جاهزية الحساب" value={`${profileCompletion}%`} tone={profileCompletion >= 80 ? 'green' : 'gold'} />
          <Metric label="الأمان" value={`${securityScore}/100`} tone={securityScore >= 90 ? 'green' : 'gold'} />
          <Metric label="التوثيق" value={accountTrustStatus} tone={accountTrustStatus === 'موثق' ? 'green' : accountTrustStatus === 'قيد المراجعة' ? 'blue' : 'gold'} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {sections.map((section) => (
            <Pressable key={section.key} onPress={() => setActiveSection(section.key)} style={[styles.tab, activeSection === section.key && styles.tabActive]}>
              <Ionicons name={section.icon} size={15} color={activeSection === section.key ? '#fff' : colors.muted} />
              <Text style={[styles.tabText, activeSection === section.key && styles.tabTextActive]}>{section.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Toast message={status} tone={status.includes('تم') ? 'success' : status.includes('تعذر') || status.includes('أدخل') || status.includes('غير') ? 'error' : 'info'} />
        {loadingSettings ? <><SkeletonCard /><SkeletonCard /></> : null}

        {!loadingSettings && activeSection === 'readiness' ? (
          <>
            <SectionCard title="مركز جاهزية الحساب" note={remainingSteps.length ? `باقي ${remainingSteps.length} خطوة حتى يكتمل الحساب.` : 'كل عناصر الحساب الأساسية مكتملة.'}>
              <View style={styles.readinessHero}>
                <View style={styles.readinessScore}>
                  <Text style={styles.readinessScoreValue}>{profileCompletion}%</Text>
                  <Text style={styles.readinessScoreLabel}>جاهزية</Text>
                </View>
                <View style={styles.readinessHeroText}>
                  <Text style={styles.readinessTitle}>{profileCompletion >= 90 ? 'حسابك جاهز للعمل' : profileCompletion >= 60 ? 'اقتربت من الاكتمال' : 'ابدأ بإكمال الأساسيات'}</Text>
                  <Text style={styles.readinessNote}>{remainingSteps[0]?.note || 'يمكنك الآن استخدام ميزات الحساب بثقة أعلى.'}</Text>
                </View>
              </View>
              <ProgressBar value={profileCompletion} />
              <View style={styles.readinessSummary}>
                <InfoPill label="مرفوع" value={`${uploadedDocs}/${requiredDocumentItems.length}`} />
                <InfoPill label="موثق" value={`${verifiedDocs}/${verifiedDocumentItems.length}`} />
                <InfoPill label="الأمان" value={`${securityScore}/100`} />
              </View>
            </SectionCard>

            <SectionCard title="خطوات الإكمال" note="اضغط على أي خطوة للانتقال مباشرة إلى مكان تعديلها.">
              {readinessSteps.map((step) => (
                <ReadinessStepCard key={step.id} step={step} onPress={() => setActiveSection(step.section)} />
              ))}
            </SectionCard>

            <SectionCard title="قواعد فتح الميزات" note="توضح لماذا نطلب هذه الخطوات قبل بعض العمليات الحساسة.">
              <GateRow enabled={documents.nationalIdVerified} title="رفع المستندات الحساسة" note="يتطلب هوية وطنية موثقة." />
              <GateRow enabled={!isProfessional || documents.lawyerLicenseVerified} title="استقبال الاستشارات المدفوعة" note={isProfessional ? 'يتطلب بطاقة محاماة موثقة.' : 'هذه الميزة خاصة بالحسابات المهنية.'} />
              <GateRow enabled={prefs.twoFactor} title="حماية العمليات المالية" note="تفعيل المصادقة الثنائية يقلل مخاطر الدخول غير المصرح." />
            </SectionCard>
          </>
        ) : null}

        {!loadingSettings && activeSection === 'account' ? (
          <>
            <SectionCard title="بيانات الحساب" note={hasChanges ? 'توجد تغييرات غير محفوظة.' : 'كل شيء محفوظ.'}>
              <Field label="الاسم الكامل" value={name} onChangeText={(value: string) => { setName(value); markChanged(); }} placeholder="الاسم الكامل" />
              <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" keyboardType="email-address" editable={false} />
              <Field label="رقم الهاتف" value={phone} onChangeText={(value: string) => { setPhone(value); markChanged(); }} placeholder="رقم الهاتف" keyboardType="phone-pad" />
              <Field label="المكتب أو الجهة" value={company} onChangeText={(value: string) => { setCompany(value); markChanged(); }} placeholder="المكتب أو الجهة" />
              {isProfessional ? (
                <>
                  <Text style={styles.label}>سعر الاستشارة</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {suggestedFees.map((fee) => <Chip key={fee} label={fee} active={consultationFee === fee} onPress={() => { setConsultationFee(fee); markChanged(); }} />)}
                  </ScrollView>
                  <Field label="" value={consultationFee} onChangeText={(value: string) => { setConsultationFee(formatConsultationFeeInput(value)); markChanged(); }} placeholder="مثال: 50,000 د.ع" />
                </>
              ) : null}
              <Button title="حفظ التغييرات" onPress={saveAll} loading={saving} />
            </SectionCard>
            <SectionCard title="بيئة العمل" note="تفاصيل تشغيلية للقراءة فقط.">
              <InfoRow label="الدور" value={user?.role === 'admin' ? 'مدير' : user?.role === 'pro' ? 'محامي' : 'عميل'} />
              <InfoRow label="بيئة العمل" value="القسطاس الذكي - العراق" />
              <InfoRow label="تاريخ الانضمام" value="كانون الثاني 2024" />
            </SectionCard>
            <SectionCard title="منطقة الخطر" note="إجراءات حساسة لا يمكن التراجع عنها.">
              <Pressable onPress={logout} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
              </Pressable>
              <View style={styles.dangerBox}>
                <Text style={styles.dangerTitle}>حذف الحساب</Text>
                <Text style={styles.dangerText}>لطلب حذف الحساب والملفات، تواصل مع الدعم لمراجعة الهوية قبل التنفيذ.</Text>
              </View>
            </SectionCard>
          </>
        ) : null}

        {!loadingSettings && activeSection === 'publicProfile' && isProfessional ? (
          <>
            <SectionCard title="الملف الذي يراه العملاء" note="هذه الحقول تظهر في صفحة ملفك العام.">
              <Field label="عنوان تعريفي قصير" value={tagline} onChangeText={(value: string) => { setTagline(value); markChanged(); }} placeholder="مثال: استشارات دقيقة في العقود" />
              <Field label="نبذة وتعريف" value={bio} onChangeText={(value: string) => { setBio(value); markChanged(); }} placeholder="عرّف بنفسك وخبرتك" multiline />
              <Field label="التخصص الرئيسي" value={specialty} onChangeText={(value: string) => { setSpecialty(value); markChanged(); }} placeholder="مثال: قضايا تجارية" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {suggestedSpecialties.map((item) => <Chip key={item} label={item} active={specialty === item} onPress={() => { setSpecialty(item); markChanged(); }} />)}
              </ScrollView>
              <Field label="سنوات الخبرة" value={experienceYears} onChangeText={(value: string) => { setExperienceYears(value); markChanged(); }} placeholder="12" keyboardType="numeric" />
              <Field label="نقاط التميز" value={highlights} onChangeText={(value: string) => { setHighlights(value); markChanged(); }} placeholder="كل نقطة في سطر مستقل" multiline />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {suggestedHighlights.map((item) => <Chip key={item} label={`+ ${item}`} active={highlights.includes(item)} onPress={() => { if (!highlights.includes(item)) setHighlights((current) => `${current ? `${current}\n` : ''}${item}`); markChanged(); }} />)}
              </ScrollView>
              <Button title="حفظ الملف العام" onPress={saveAll} loading={saving} />
            </SectionCard>
          </>
        ) : null}

        {!loadingSettings && activeSection === 'security' ? (
          <>
            <SectionCard title="المصادقة الثنائية" note={prefs.twoFactor ? 'الحساب محمي بطبقة تحقق ثانية.' : 'فعّلها لرفع درجة الأمان.'}>
              <Toggle label="تفعيل المصادقة الثنائية" note="رمز تحقق عند تسجيل الدخول من جهاز جديد" value={prefs.twoFactor} onPress={() => togglePref('twoFactor')} />
            </SectionCard>
            <SectionCard title="تغيير كلمة المرور" note="كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.">
              <Field label="كلمة المرور الحالية" value={currentPassword} onChangeText={setCurrentPassword} placeholder="كلمة المرور الحالية" secureTextEntry />
              <Field label="كلمة المرور الجديدة" value={newPassword} onChangeText={setNewPassword} placeholder="كلمة المرور الجديدة" secureTextEntry />
              <Field label="تأكيد كلمة المرور" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="تأكيد كلمة المرور" secureTextEntry />
              <Button title="تحديث كلمة المرور" onPress={changePassword} loading={saving} />
            </SectionCard>
            <SectionCard title="الجلسات النشطة" note="راجع الأجهزة وسجل الدخول الأخير.">
              {sessions.map((session) => <SessionCard key={session.id} session={session} onRevoke={() => revokeSession(session)} />)}
            </SectionCard>
          </>
        ) : null}

        {!loadingSettings && activeSection === 'documents' ? (
          <SectionCard title="توثيق المستندات الأساسية" note={`${uploadedDocs}/${requiredDocumentItems.length} مرفوعة · ${verifiedDocs} موثقة`}>
            <DocumentCard title="البطاقة الوطنية" required uploaded={Boolean(documents.nationalIdUrl)} verified={documents.nationalIdVerified} loading={uploadingDocument === 'nationalId'} onPress={() => addDocument('nationalId')} />
            <DocumentCard title="بطاقة المحاماة" required={isProfessional} uploaded={Boolean(documents.lawyerLicenseUrl)} verified={documents.lawyerLicenseVerified} loading={uploadingDocument === 'lawyerLicense'} onPress={() => addDocument('lawyerLicense')} />
          </SectionCard>
        ) : null}

        {!loadingSettings && activeSection === 'billing' ? (
          <>
            <SectionCard title="خطة الاشتراك" note={billingStatus === 'active' ? 'نشط وفي وضع جيد.' : 'توجد متأخرات تحتاج مراجعة.'}>
              <View style={styles.planBox}>
                <Text style={styles.planName}>Professional</Text>
                <Text style={styles.planPrice}>$79 / شهرياً</Text>
                {['15 GB تخزين للمستندات', 'سجل نشاط 90 يوماً', 'أولوية متوسطة في الدعم'].map((item) => <InfoRow key={item} label="ميزة" value={item} />)}
                <View style={styles.inlineActions}>
                  <Button title="ترقية الخطة" onPress={() => setStatus('تم فتح مسار ترقية الخطة.')} />
                  <Button title="محاكاة متأخرات" variant="secondary" onPress={() => { setBillingStatus('past_due'); setStatus('تم عرض حالة المتأخرات.'); }} />
                </View>
              </View>
            </SectionCard>
            <SectionCard title="طريقة الدفع" note="وسيلة الدفع الأساسية وعنوان الفوترة.">
              <InfoRow label="البطاقة" value="Visa •••• 4242" />
              <InfoRow label="التجديد" value="01 May 2026" />
              <InfoRow label="مسؤول الفوترة" value={email || 'غير محدد'} />
            </SectionCard>
            <SectionCard title="الفواتير" note="أحدث الفواتير وسجل المدفوعات.">
              {invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />)}
            </SectionCard>
          </>
        ) : null}

        {!loadingSettings && activeSection === 'notifications' ? (
          <SectionCard title="إعدادات الإشعارات" note={`${alertChannels} قنوات نشطة`}>
            <Toggle label="تنبيهات التطبيق" note="تحديثات القضايا والرسائل" value={prefs.pushNotifications} onPress={() => togglePref('pushNotifications')} />
            <Toggle label="إشعارات البريد" note="ملخصات وتحديثات مهمة" value={prefs.emailAlerts} onPress={() => togglePref('emailAlerts')} />
            <Toggle label="تذكير الفواتير" note="قبل الاستحقاق وبعد الدفع" value={prefs.billingReminders} onPress={() => togglePref('billingReminders')} />
            <Toggle label="تنبيهات الأمان" note="تسجيل دخول أو تغيير حساس" value={prefs.securityAlerts} onPress={() => togglePref('securityAlerts')} />
            <Toggle label="رسائل تسويقية" note="ميزات وعروض وأخبار المنصة" value={prefs.marketingEmails} onPress={() => togglePref('marketingEmails')} />
            <Text style={styles.label}>اللغة المفضلة</Text>
            <View style={styles.segmented}>
              <Chip label="العربية" active={language === 'العربية'} onPress={() => { setLanguage('العربية'); markChanged(); }} />
              <Chip label="English" active={language === 'English'} onPress={() => { setLanguage('English'); markChanged(); }} />
            </View>
            <Button title="حفظ التفضيلات" onPress={saveAll} loading={saving} />
          </SectionCard>
        ) : null}

        {!loadingSettings && activeSection === 'integrations' ? (
          <>
            <SectionCard title="التطبيقات المتصلة" note="إدارة الربط مع الأدوات الخارجية.">
              {connectedApps.map((app) => (
                <IntegrationRow key={app.id} app={app} onPress={() => {
                  setConnectedApps((current) => current.map((item) => item.id === app.id ? { ...item, connected: !item.connected } : item));
                  setStatus(app.connected ? 'تم فصل التطبيق عن الحساب.' : 'تم ربط التطبيق بنجاح.');
                }} />
              ))}
            </SectionCard>
            <SectionCard title="تصدير البيانات" note="احصل على نسخة من بياناتك وسجلاتك.">
              <Button title="بدء التصدير" onPress={exportData} variant="secondary" />
            </SectionCard>
          </>
        ) : null}

        {!loadingSettings && activeSection === 'activity' ? (
          <SectionCard title="النشاط الأخير" note="سجل الأحداث التشغيلية والأمنية.">
            {activityItems.length === 0 ? <EmptyState title="لا يوجد نشاط بعد" /> : activityItems.map((item) => <ActivityRow key={item.id} item={item} />)}
          </SectionCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SectionCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {note ? <Text style={styles.cardNote}>{note}</Text> : null}
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, editable = true, multiline }: any) {
  return (
    <View style={styles.fieldBlock}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        autoCapitalize="none"
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.multilineInput, !editable && styles.inputDisabled]}
        textAlign="right"
      />
    </View>
  );
}

function Toggle({ label, note, value, onPress }: { label: string; note: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow}>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleNote}>{note}</Text>
      </View>
    </Pressable>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: 'green' | 'gold' | 'blue' }) {
  const style = tone === 'green' ? styles.metricGreen : tone === 'gold' ? styles.metricGold : styles.metricBlue;
  return <View style={[styles.metric, style]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillValue}>{value}</Text>
      <Text style={styles.infoPillLabel}>{label}</Text>
    </View>
  );
}

function ReadinessStepCard({ step, onPress }: { step: ReadinessStep; onPress: () => void }) {
  const toneStyle = step.status === 'done' ? styles.stepDone : step.status === 'review' ? styles.stepReview : styles.stepMissing;
  const statusLabel = step.status === 'done' ? 'مكتمل' : step.status === 'review' ? 'قيد المراجعة' : 'ناقص';
  const iconColor = step.status === 'done' ? colors.green : step.status === 'review' ? colors.blue : colors.gold;

  return (
    <Pressable onPress={onPress} style={styles.stepCard}>
      <View style={[styles.stepIcon, toneStyle]}>
        <Ionicons name={step.done ? 'checkmark-circle-outline' : step.icon} size={20} color={iconColor} />
      </View>
      <View style={styles.flex}>
        <View style={styles.stepTitleRow}>
          <Text style={[styles.stepBadge, toneStyle]}>{statusLabel}</Text>
          <Text style={styles.rowTitle}>{step.title}</Text>
        </View>
        <Text style={styles.rowNote}>{step.note}</Text>
      </View>
      <View style={styles.stepWeight}>
        <Text style={styles.stepWeightText}>{step.weight}%</Text>
        <Ionicons name="chevron-back-outline" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function GateRow({ enabled, title, note }: { enabled: boolean; title: string; note: string }) {
  return (
    <View style={styles.gateRow}>
      <View style={[styles.gateIcon, enabled ? styles.gateIconOn : styles.gateIconOff]}>
        <Ionicons name={enabled ? 'lock-open-outline' : 'lock-closed-outline'} size={18} color={enabled ? colors.green : colors.gold} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowNote}>{note}</Text>
      </View>
      <Text style={[styles.gateStatus, enabled ? styles.gateStatusOn : styles.gateStatusOff]}>{enabled ? 'مفتوح' : 'مقيّد'}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return <View style={styles.infoRow}><Text style={styles.infoValue}>{value}</Text><Text style={styles.infoLabel}>{label}</Text></View>;
}

function SessionCard({ session, onRevoke }: { session: SessionItem; onRevoke: () => void }) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.flex}><Text style={styles.rowTitle}>{session.device}</Text><Text style={styles.rowNote}>{session.location} · {session.lastSeen}</Text><Text style={styles.rowNote}>{session.ipAddress}</Text></View>
      {session.current ? <Text style={styles.currentBadge}>الحالي</Text> : <Pressable onPress={onRevoke} style={styles.dangerButton}><Text style={styles.dangerButtonText}>إنهاء</Text></Pressable>}
    </View>
  );
}

function DocumentCard({ title, required, uploaded, verified, loading, onPress }: { title: string; required: boolean; uploaded: boolean; verified: boolean; loading?: boolean; onPress: () => void }) {
  const label = verified ? 'موثق' : uploaded ? 'قيد المراجعة' : 'غير مرفوع';
  return (
    <Pressable disabled={loading} onPress={onPress} style={[styles.rowCard, loading && styles.rowCardDisabled]}>
      <View style={styles.docIcon}>{loading ? <ActivityIndicator color={colors.blue} /> : <Ionicons name={verified ? 'shield-checkmark-outline' : 'cloud-upload-outline'} size={20} color={verified ? colors.green : colors.blue} />}</View>
      <View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowNote}>{required ? 'مطلوب' : 'اختياري'} · {label}</Text></View>
      <Text style={styles.linkText}>{loading ? 'يرفع...' : uploaded ? 'استبدال' : 'رفع'}</Text>
    </Pressable>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceItem }) {
  return <View style={styles.infoRow}><Text style={invoice.status === 'paid' ? styles.paid : styles.pending}>{invoice.status === 'paid' ? 'مدفوعة' : 'قيد الانتظار'}</Text><View style={styles.flex}><Text style={styles.infoValue}>{invoice.label}</Text><Text style={styles.infoLabel}>{invoice.date} · {invoice.amount}</Text></View></View>;
}

function IntegrationRow({ app, onPress }: { app: any; onPress: () => void }) {
  return <View style={styles.rowCard}><View style={styles.docIcon}><Ionicons name={app.icon} size={19} color={colors.blue} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{app.name}</Text><Text style={styles.rowNote}>{app.desc} · {app.connected ? 'متصل' : 'غير متصل'}</Text></View><Pressable onPress={onPress} style={[styles.smallButton, app.connected && styles.smallButtonDanger]}><Text style={[styles.smallButtonText, app.connected && styles.smallButtonDangerText]}>{app.connected ? 'فصل' : 'ربط'}</Text></Pressable></View>;
}

function ActivityRow({ item }: { item: any }) {
  return <View style={styles.rowCard}><View style={styles.docIcon}><Ionicons name={item.icon} size={18} color={colors.gold} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowNote}>{item.note}</Text><Text style={styles.rowNote}>{item.time}</Text></View></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginBottom: 12, padding: 13, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16 },
  cardNote: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 20, marginBottom: 12, marginTop: 4, textAlign: 'right' },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  chip: { backgroundColor: colors.tint, borderRadius: 999, minHeight: 34, justifyContent: 'center', paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.blue },
  chipRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 10 },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: '#fff' },
  content: { paddingBottom: 20 },
  currentBadge: { backgroundColor: colors.greenTint, borderRadius: 999, color: colors.green, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  dangerBox: { backgroundColor: colors.redTint, borderColor: '#f7b4af', borderRadius: 8, borderWidth: 1, padding: 12 },
  dangerButton: { backgroundColor: colors.redTint, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  dangerButtonText: { color: colors.red, fontSize: 12, fontWeight: '900' },
  dangerTitle: { color: colors.red, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  dangerText: { color: colors.ink, fontSize: 12, fontWeight: '700', lineHeight: 20, marginTop: 5, textAlign: 'right' },
  docIcon: { alignItems: 'center', backgroundColor: colors.blueTint, borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  fieldBlock: { marginBottom: 10 },
  flex: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12, marginBottom: 12 },
  headerIcon: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 8, height: 50, justifyContent: 'center', width: 50 },
  headerText: { alignItems: 'flex-end', flex: 1 },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 3, textAlign: 'right' },
  infoPill: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, padding: 9 },
  infoPillLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  infoPillValue: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  infoRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row-reverse', gap: 10, paddingVertical: 10 },
  infoValue: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  inlineActions: { gap: 8, marginTop: 12 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 50, paddingHorizontal: 12 },
  inputDisabled: { color: colors.muted },
  label: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 7, textAlign: 'right' },
  linkText: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  logoutButton: { alignItems: 'center', backgroundColor: colors.red, borderRadius: 8, flexDirection: 'row-reverse', gap: 8, justifyContent: 'center', marginBottom: 10, minHeight: 46 },
  logoutButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  metric: { alignItems: 'flex-end', borderRadius: 8, flex: 1, padding: 10 },
  metricBlue: { backgroundColor: colors.blueTint },
  metricGold: { backgroundColor: colors.goldTint },
  metricGreen: { backgroundColor: colors.greenTint },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 3 },
  metricValue: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  multilineInput: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  paid: { color: colors.green, fontSize: 12, fontWeight: '900' },
  pending: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  planBox: { backgroundColor: colors.goldTint, borderRadius: 8, padding: 12 },
  planName: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'right' },
  planPrice: { color: colors.gold, fontSize: 16, fontWeight: '900', marginBottom: 8, marginTop: 4, textAlign: 'right' },
  progressFill: { backgroundColor: colors.green, borderRadius: 999, height: '100%' },
  progressTrack: { backgroundColor: colors.line, borderRadius: 999, height: 9, marginTop: 12, overflow: 'hidden' },
  readinessHero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, flexDirection: 'row-reverse', gap: 12, padding: 12 },
  readinessHeroText: { alignItems: 'flex-end', flex: 1 },
  readinessNote: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 20, marginTop: 4, textAlign: 'right' },
  readinessScore: { alignItems: 'center', backgroundColor: colors.navy, borderRadius: 8, height: 76, justifyContent: 'center', width: 76 },
  readinessScoreLabel: { color: '#fff', fontSize: 10, fontWeight: '800', opacity: 0.82 },
  readinessScoreValue: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  readinessSummary: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  readinessTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  rowCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, flexDirection: 'row-reverse', gap: 10, marginBottom: 8, padding: 11 },
  rowCardDisabled: { opacity: 0.65 },
  rowNote: { color: colors.muted, fontSize: 11, fontWeight: '700', lineHeight: 18, marginTop: 3, textAlign: 'right' },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  scoreCard: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  segmented: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  smallButton: { backgroundColor: colors.blueTint, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  smallButtonDanger: { backgroundColor: colors.redTint },
  smallButtonDangerText: { color: colors.red },
  smallButtonText: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  stepBadge: { borderRadius: 999, fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  stepCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, flexDirection: 'row-reverse', gap: 10, marginBottom: 8, padding: 11 },
  stepDone: { backgroundColor: colors.greenTint, color: colors.green },
  stepIcon: { alignItems: 'center', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  stepMissing: { backgroundColor: colors.goldTint, color: colors.gold },
  stepReview: { backgroundColor: colors.blueTint, color: colors.blue },
  stepTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  stepWeight: { alignItems: 'center', flexDirection: 'row-reverse', gap: 2 },
  stepWeightText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 21, marginTop: 4, textAlign: 'right' },
  tab: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: 'row-reverse', gap: 5, minHeight: 38, paddingHorizontal: 12 },
  tabActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  tabs: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 12 },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  toggleRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 12 },
  toggleTrack: { backgroundColor: colors.line, borderRadius: 999, height: 30, justifyContent: 'center', padding: 3, width: 54 },
  toggleTrackOn: { backgroundColor: colors.green },
  toggleThumb: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, height: 24, width: 24 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleText: { alignItems: 'flex-end', flex: 1 },
  toggleLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  toggleNote: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3, textAlign: 'right' },
  gateIcon: { alignItems: 'center', borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  gateIconOff: { backgroundColor: colors.goldTint },
  gateIconOn: { backgroundColor: colors.greenTint },
  gateRow: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row-reverse', gap: 10, paddingVertical: 10 },
  gateStatus: { borderRadius: 999, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  gateStatusOff: { backgroundColor: colors.goldTint, color: colors.gold },
  gateStatusOn: { backgroundColor: colors.greenTint, color: colors.green },
});
