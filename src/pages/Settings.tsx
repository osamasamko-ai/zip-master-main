import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../components/ui/ActionButton';
import NoticePanel from '../components/ui/NoticePanel';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { DocumentUpload } from '../components/DocumentUpload';
import { useDocumentUpload } from '../hooks/useDocumentUpload';

type SettingsSection = 'account' | 'publicProfile' | 'security' | 'billing' | 'notifications' | 'integrations' | 'activity' | 'documents';

type SessionItem = {
  id: string;
  device: string;
  location: string;
  lastSeen: string;
  current: boolean;
  ipAddress: string;
};

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'profile' | 'security' | 'billing' | 'system';
};

type InvoiceItem = {
  id: string;
  label: string;
  amount: string;
  date: string;
  status: 'paid' | 'pending';
};

type SettingsForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  tagline: string;
  bio: string;
  specialty: string;
  experienceYears: string;
  highlights: string;
  consultationFee: string;
  language: string;
  twoFactor: boolean;
  emailAlerts: boolean;
  pushNotifications: boolean;
  billingReminders: boolean;
  securityAlerts: boolean;
  marketingEmails: boolean;
};

type ConnectedApp = {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  icon: string;
  desc: string;
};

type NotificationPreferenceKey =
  | 'emailAlerts'
  | 'pushNotifications'
  | 'billingReminders'
  | 'securityAlerts'
  | 'marketingEmails';

type VerificationDocument = {
  key: 'nationalId' | 'lawyerLicense';
  label: string;
  description: string;
  helperText: string;
  icon: string;
  previewUrl: string;
  isVerified: boolean;
  required: boolean;
};

function formatConsultationFeeInput(value: string) {
  const digitsOnly = value.replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return '';
  }

  return `${Number(digitsOnly).toLocaleString('en-US')} د.ع`;
}

function isValidConsultationFee(value: string) {
  return /\d/.test(value);
}

const SUGGESTED_CONSULTATION_FEES = [
  '25,000 د.ع',
  '50,000 د.ع',
  '75,000 د.ع',
  '100,000 د.ع',
];

const SUGGESTED_SPECIALTIES = [
  'أحوال شخصية',
  'قضايا تجارية',
  'عقارات',
  'ملكية فكرية',
  'قانون العمل',
  'العقود',
];

const SUGGESTED_HIGHLIGHTS = [
  'تفاوض وتسوية النزاعات',
  'صياغة العقود',
  'تمثيل أمام المحاكم',
  'استشارات للشركات',
  'متابعة الإجراءات العقارية',
  'حماية العلامات التجارية',
];

function SettingsCard({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`w-full min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 text-right">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-brand-dark">{title}</h3>
            {description && <p className="mt-1 text-sm font-bold text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

const PLAN_FEATURES = [
  'مستخدم واحد مع صلاحيات إدارة كاملة للحساب',
  '15 GB تخزين للمستندات والملفات القانونية',
  'سجل نشاط وتتبّع أمني لمدة 90 يوماً',
  'أولوية متوسطة في الدعم الفني والفوترة',
];

const INITIAL_SESSIONS: SessionItem[] = [
  { id: 'session-1', device: 'ماك بوك برو • سفاري', location: 'بغداد، العراق', lastSeen: 'نشط الآن', current: true, ipAddress: '185.77.21.14' },
  { id: 'session-2', device: 'آيفون 15 • التطبيق', location: 'بغداد، العراق', lastSeen: 'قبل 18 دقيقة', current: false, ipAddress: '185.77.21.62' },
  { id: 'session-3', device: 'ويندوز 11 • كروم', location: 'أربيل، العراق', lastSeen: 'أمس 09:40 ص', current: false, ipAddress: '109.224.15.83' },
];

const INITIAL_ACTIVITY: ActivityItem[] = [
  { id: 'activity-1', title: 'تم تحديث البريد الإلكتروني', description: 'جرى حفظ بيانات التواصل الجديدة للحساب.', time: 'اليوم 11:20 ص', type: 'profile' },
  { id: 'activity-2', title: 'تسجيل دخول جديد', description: 'تمت المصادقة من جهاز iPhone مع تفعيل التحقق الثنائي.', time: 'اليوم 09:05 ص', type: 'security' },
  { id: 'activity-3', title: 'تم إصدار فاتورة الاشتراك', description: 'فاتورة خطة Professional لشهر أبريل جاهزة للدفع.', time: '16 أبريل 2026', type: 'billing' },
  { id: 'activity-4', title: 'تم تغيير كلمة المرور', description: 'تم استبدال كلمة المرور بنجاح بعد مراجعة أمان الحساب.', time: '12 أبريل 2026', type: 'security' },
  { id: 'activity-5', title: 'تنبيه نظام', description: 'تمت مزامنة تفضيلات الحساب مع مركز القيادة دون أخطاء.', time: '10 أبريل 2026', type: 'system' },
];

const INITIAL_INVOICES: InvoiceItem[] = [
  { id: 'inv-1', label: 'خطة Professional - نيسان 2026', amount: '$79.00', date: '16 نيسان 2026', status: 'paid' },
  { id: 'inv-2', label: 'إضافة مساحة تخزينية', amount: '$12.00', date: '03 نيسان 2026', status: 'paid' },
  { id: 'inv-3', label: 'خطة Professional - أيار 2026', amount: '$79.00', date: '01 أيار 2026', status: 'pending' },
];

function getActivityTone(type: ActivityItem['type']) {
  switch (type) {
    case 'security':
      return 'bg-emerald-50 text-emerald-700';
    case 'billing':
      return 'bg-amber-50 text-amber-700';
    case 'system':
      return 'bg-blue-50 text-blue-700';
    default:
      return 'bg-slate-50 text-slate-500';
  }
}

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { uploadNationalId, uploadLawyerLicense, uploading, error: uploadError } = useDocumentUpload();

  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [savedToast, setSavedToast] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sessionsNotice, setSessionsNotice] = useState('');
  const [billingNotice, setBillingNotice] = useState('');
  const [integrationNotice, setIntegrationNotice] = useState('');
  const [billingStatus, setBillingStatus] = useState<'active' | 'past_due'>('active');
  const [documentNotice, setDocumentNotice] = useState('');
  const [sessions, setSessions] = useState<SessionItem[]>(INITIAL_SESSIONS);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>(INITIAL_ACTIVITY);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(INITIAL_INVOICES);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [consultationFeeError, setConsultationFeeError] = useState('');
  const [form, setForm] = useState<SettingsForm>({
    name: user?.name ?? 'أحمد العراقي',
    email: user?.email ?? '',
    phone: '',
    company: user?.role === 'pro' ? 'مكتب النعيمي للمحاماة' : 'حساب فردي',
    tagline: '',
    bio: '',
    specialty: '',
    experienceYears: '',
    highlights: '',
    consultationFee: '',
    language: 'العربية',
    twoFactor: false,
    emailAlerts: true,
    pushNotifications: true,
    billingReminders: true,
    securityAlerts: true,
    marketingEmails: false,
  });
  const [documents, setDocuments] = useState({
    nationalIdUrl: '',
    nationalIdVerified: false,
    lawyerLicenseUrl: '',
    lawyerLicenseVerified: false,
  });
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([
    { id: 'google', name: 'Google Workspace', status: 'connected', icon: 'fa-brands fa-google', desc: 'لمزامنة المواعيد والملفات' },
    { id: 'zain', name: 'Zain Cash', status: 'connected', icon: 'fa-solid fa-mobile-screen', desc: 'للمدفوعات السريعة' },
    { id: 'dropbox', name: 'Dropbox', status: 'disconnected', icon: 'fa-brands fa-dropbox', desc: 'تخزين سحابي إضافي' },
  ]);

  const updateForm = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const togglePreference = (key: NotificationPreferenceKey) => {
    updateForm(key, !form[key]);
  };

  React.useEffect(() => {
    const load = async () => {
      try {
        setIsLoadingSettings(true);
        setSettingsError('');
        const response = await apiClient.getSettings();
        const data = response.data;
        if (!data?.profile) return;
        setSessions(data.sessions || []);
        setActivityItems(data.activityItems || []);
        setForm({
          name: data.profile.name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          company: data.profile.company || '',
          tagline: data.profile.tagline || '',
          bio: data.profile.bio || '',
          specialty: data.profile.specialty || '',
          experienceYears: data.profile.experienceYears ? String(data.profile.experienceYears) : '',
          highlights: Array.isArray(data.profile.highlights)
            ? data.profile.highlights.join('\n')
            : data.profile.highlights || '',
          consultationFee: data.profile.consultationFee || '',
          language: data.profile.language || 'العربية',
          twoFactor: !!data.profile.twoFactor,
          emailAlerts: !!data.profile.emailAlerts,
          pushNotifications: !!data.profile.pushNotifications,
          billingReminders: !!data.profile.billingReminders,
          securityAlerts: !!data.profile.securityAlerts,
          marketingEmails: !!data.profile.marketingEmails,
        });
        setInvoices(data.invoices || []);
        setDocuments({
          nationalIdUrl: data.profile.nationalIdUrl || '',
          nationalIdVerified: !!data.profile.nationalIdVerified,
          lawyerLicenseUrl: data.profile.lawyerLicenseUrl || '',
          lawyerLicenseVerified: !!data.profile.lawyerLicenseVerified,
        });
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to load settings', error);
        setSettingsError('تعذر تحميل الإعدادات. تحقق من الاتصال وحاول مرة أخرى.');
      } finally {
        setIsLoadingSettings(false);
      }
    };
    load();
  }, []);

  const isProfessionalAccount = user?.role === 'pro' || user?.role === 'admin';

  const sections = useMemo(
    () => [
      { id: 'account' as const, label: 'الحساب', icon: 'fa-id-card', description: 'الهوية، بيانات الحساب، وبيئة العمل' },
      ...(isProfessionalAccount
        ? [{ id: 'publicProfile' as const, label: 'الملف العام', icon: 'fa-address-card', description: 'النبذة، التخصصات، ونقاط التميز' }]
        : []),
      { id: 'security' as const, label: 'الأمان', icon: 'fa-shield-halved', description: 'كلمة المرور، الحماية، والجلسات' },
      { id: 'documents' as const, label: 'المستندات', icon: 'fa-file-shield', description: 'الهوية، بطاقة المحاماة، وحالة التحقق' },
      { id: 'billing' as const, label: 'الفوترة', icon: 'fa-credit-card', description: 'الخطة، المدفوعات، والفواتير' },
      { id: 'notifications' as const, label: 'الإشعارات', icon: 'fa-bell', description: 'التنبيهات والقنوات المفضلة' },
      { id: 'integrations' as const, label: 'التكاملات', icon: 'fa-link', description: 'الأدوات المتصلة وتصدير البيانات' },
      { id: 'activity' as const, label: 'النشاط', icon: 'fa-clock-rotate-left', description: 'تحليلات الاستخدام وسجل الأحداث' },
    ],
    [isProfessionalAccount]
  );

  const usageStats = useMemo(
    () => [
      { label: 'الاشتراك', value: 'احترافي (Pro)', note: 'التجديد القادم: 01 أيار 2026' },
      { label: 'المساحة', value: '9.8 / 15 جيجابايت', note: 'تم استهلاك 65% من المساحة' },
      { label: 'قوة الأمان', value: form.twoFactor ? '92/100' : '71/100', note: form.twoFactor ? 'المصادقة مفعلة' : 'فعل المصادقة للتحسين' },
      { label: 'الجلسات', value: String(sessions.length), note: `${sessions.filter((item) => item.current).length} جهاز نشط حالياً` },
    ],
    [form.twoFactor, sessions]
  );

  const verificationDocuments = useMemo<VerificationDocument[]>(
    () => [
      {
        key: 'nationalId',
        label: 'البطاقة الوطنية',
        description: 'ارفع نسخة واضحة من الجهة الأمامية أو ملف PDF رسمي لاستخدامها في التحقق من الهوية.',
        helperText: 'يفضّل أن تكون البيانات كاملة وواضحة وبدون قص للأطراف.',
        icon: 'fa-id-card',
        previewUrl: documents.nationalIdUrl,
        isVerified: documents.nationalIdVerified,
        required: true,
      },
      {
        key: 'lawyerLicense',
        label: 'بطاقة المحاماة',
        description: isProfessionalAccount
          ? 'أضف بطاقة المحاماة الحالية لإكمال التحقق المهني وتفعيل الاعتماد في الملف العام.'
          : 'يمكنك رفع بطاقة المحاماة الآن إذا كنت بصدد الترقية إلى حساب مهني أو استكمال التحقق لاحقاً.',
        helperText: 'نقبل JPG وPNG وPDF بحجم يصل إلى 5MB لكل ملف.',
        icon: 'fa-scale-balanced',
        previewUrl: documents.lawyerLicenseUrl,
        isVerified: documents.lawyerLicenseVerified,
        required: isProfessionalAccount,
      },
    ],
    [documents, isProfessionalAccount]
  );

  const uploadedDocumentsCount = verificationDocuments.filter((item) => item.previewUrl).length;
  const verifiedDocumentsCount = verificationDocuments.filter((item) => item.isVerified).length;
  const requiredProfileFields = isProfessionalAccount
    ? [form.name, form.email, form.phone, form.company, form.consultationFee, form.bio, form.specialty, form.highlights]
    : [form.name, form.email, form.phone, form.company];
  const profileCompletion = Math.round((requiredProfileFields.filter(Boolean).length / requiredProfileFields.length) * 100);
  const securityScore = form.twoFactor ? 92 : 71;
  const alertChannelsCount = [
    form.emailAlerts,
    form.pushNotifications,
    form.billingReminders,
    form.securityAlerts,
  ].filter(Boolean).length;

  const handleNationalIdUpload = async (file: File) => {
    const fileUrl = await uploadNationalId(file);
    setDocuments((current) => ({
      ...current,
      nationalIdUrl: fileUrl,
      nationalIdVerified: false,
    }));
    setDocumentNotice('تم رفع البطاقة الوطنية وهي الآن بانتظار المراجعة.');
  };

  const handleLawyerLicenseUpload = async (file: File) => {
    const fileUrl = await uploadLawyerLicense(file);
    setDocuments((current) => ({
      ...current,
      lawyerLicenseUrl: fileUrl,
      lawyerLicenseVerified: false,
    }));
    setDocumentNotice('تم رفع بطاقة المحاماة وهي الآن بانتظار المراجعة.');
  };

  React.useEffect(() => {
    if (!documentNotice) return;

    const timeoutId = window.setTimeout(() => setDocumentNotice(''), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [documentNotice]);

  const saveChanges = async () => {
    if (isProfessionalAccount && !isValidConsultationFee(form.consultationFee)) {
      setConsultationFeeError('يرجى إدخال سعر استشارة قانونية صحيح قبل الحفظ.');
      setSavedToast('تعذر حفظ الإعدادات');
      return;
    }

    setConsultationFeeError('');
    try {
      setIsSaving(true);
      await Promise.all([
        apiClient.updateSettingsProfile({
          name: form.name,
          phone: form.phone,
          company: form.company,
          tagline: form.tagline,
          bio: form.bio,
          specialty: form.specialty,
          experienceYears: form.experienceYears,
          highlights: form.highlights,
          consultationFee: form.consultationFee,
          language: form.language,
        }),
        apiClient.updateSettingsPreferences({
          twoFactor: form.twoFactor,
          emailAlerts: form.emailAlerts,
          pushNotifications: form.pushNotifications,
          billingReminders: form.billingReminders,
          securityAlerts: form.securityAlerts,
          marketingEmails: form.marketingEmails,
          language: form.language,
        }),
      ]);
      setHasUnsavedChanges(false);
      setSavedToast('تم حفظ الإعدادات بنجاح');
      window.setTimeout(() => setSavedToast(''), 2200);
    } catch (error) {
      console.error('Failed to save settings', error);
      setSavedToast('تعذر حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      await apiClient.revokeSession(sessionId);
      setSessions((current) => current.filter((item) => item.id !== sessionId));
      setSessionsNotice('تم إنهاء الجلسة بنجاح');
    } catch (error) {
      console.error('Failed to revoke session', error);
      setSessionsNotice('تعذر إنهاء الجلسة. حاول مرة أخرى.');
    }
    window.setTimeout(() => setSessionsNotice(''), 2200);
  };

  const toggleTwoFactor = () => {
    const next = !form.twoFactor;
    setForm((current) => ({ ...current, twoFactor: next }));
    setHasUnsavedChanges(true);
    setActivityItems((current) => [
      {
        id: `activity-${Date.now()}`,
        title: next ? 'تم تفعيل التحقق الثنائي' : 'تم إيقاف التحقق الثنائي',
        description: 'تم تحديث إعدادات الأمان للحساب.',
        time: 'الآن',
        type: 'security',
      },
      ...current,
    ]);
  };

  const handleBillingAction = (message: string, status?: 'active' | 'past_due') => {
    if (status) setBillingStatus(status);
    setBillingNotice(message);
    window.setTimeout(() => setBillingNotice(''), 2600);
  };

  const toggleIntegration = (appId: string) => {
    let nextStatus: ConnectedApp['status'] = 'connected';
    setConnectedApps((current) =>
      current.map((app) => {
        if (app.id !== appId) return app;
        nextStatus = app.status === 'connected' ? 'disconnected' : 'connected';
        return { ...app, status: nextStatus };
      })
    );
    setIntegrationNotice(nextStatus === 'connected' ? 'تم ربط التطبيق بنجاح.' : 'تم فصل التطبيق عن الحساب.');
    window.setTimeout(() => setIntegrationNotice(''), 2400);
  };

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: form,
      sessions,
      invoices,
      documents,
      connectedApps,
      activityItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qistas-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setIntegrationNotice('تم تجهيز أرشيف البيانات وبدأ التحميل.');
    window.setTimeout(() => setIntegrationNotice(''), 2400);
  };

  const submitPasswordChange = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('يرجى تعبئة جميع حقول كلمة المرور.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setIsSubmittingPassword(true);
    apiClient.updatePassword(passwordForm.currentPassword, passwordForm.newPassword).then(() => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSuccess('تم تحديث كلمة المرور بنجاح.');
      setActivityItems((current) => [
        {
          id: `activity-${Date.now()}`,
          title: 'تم تغيير كلمة المرور',
          description: 'اكتملت عملية تحديث كلمة المرور وتسجيل الحدث الأمني.',
          time: 'الآن',
          type: 'security',
        },
        ...current,
      ]);
      setIsSubmittingPassword(false);
    }).catch((error: any) => {
      setPasswordError(error.response?.data?.error || 'تعذر تحديث كلمة المرور.');
      setIsSubmittingPassword(false);
    });
  };

  return (
    <div className="app-view fade-in mx-auto w-full min-w-0 max-w-full space-y-6 overflow-x-hidden pb-12 text-right">
      <section className="min-w-0 overflow-hidden rounded-[2rem] border border-brand-navy/10 bg-white shadow-premium">
        <div className="grid min-w-0 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:p-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-xs font-black text-brand-dark">
              <i className="fa-solid fa-sliders text-brand-gold"></i>
              Private Workspace
            </div>
            <h1 className="mt-4 text-3xl font-black text-brand-dark">الإعدادات</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-500">
              مساحة خاصة لإدارة الحساب والأمان والتفضيلات والفوترة والنشاط. لا تظهر هذه المعلومات للزوار أو العملاء.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <StatusBadge tone={hasUnsavedChanges ? 'warning' : 'success'}>
                {hasUnsavedChanges ? 'تغييرات غير محفوظة' : 'كل شيء محفوظ'}
              </StatusBadge>
              <StatusBadge tone={securityScore >= 90 ? 'success' : 'warning'}>
                الأمان {securityScore}/100
              </StatusBadge>
              <StatusBadge tone={profileCompletion === 100 ? 'success' : 'info'}>
                اكتمال الملف {profileCompletion}%
              </StatusBadge>
            </div>
          </div>
          <div className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-500">
                  <span>{profileCompletion}%</span>
                  <span>جاهزية الحساب</span>
                </div>
                <div className="h-2 rounded-full bg-white">
                  <div className="h-full rounded-full bg-brand-navy transition-all" style={{ width: `${profileCompletion}%` }}></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-lg font-black text-brand-dark">{sessions.length}</p>
                  <p className="text-[10px] font-bold text-slate-400">جلسات</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-lg font-black text-brand-dark">{alertChannelsCount}</p>
                  <p className="text-[10px] font-bold text-slate-400">قنوات</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-lg font-black text-brand-dark">{uploadedDocumentsCount}</p>
                  <p className="text-[10px] font-bold text-slate-400">مستندات</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="text-xs font-bold text-slate-500">
            {isLoadingSettings ? 'جاري تحميل آخر نسخة من الإعدادات...' : 'آخر تحديثات الحساب جاهزة للمراجعة والحفظ.'}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              onClick={() => user?.id ? navigate(`/profile/${user.id}`) : navigate('/settings')}
              variant="secondary"
            >
              <i className="fa-solid fa-eye"></i>
              عرض نموذج الملف العام
            </ActionButton>
            <ActionButton
              onClick={saveChanges}
              variant="primary"
              disabled={isSaving || isLoadingSettings}
            >
              <i className={`fa-solid ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}></i>
              {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </ActionButton>
          </div>
        </div>
      </section>

      {settingsError && (
        <NoticePanel title="تعذر التحميل" description={settingsError} tone="warning" />
      )}

      {savedToast && (
        <NoticePanel title={savedToast.includes('تعذر') ? 'تنبيه' : 'تم الحفظ'} description={savedToast} tone={savedToast.includes('تعذر') ? 'warning' : 'success'} />
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex w-full items-start gap-4 rounded-[1.75rem] border p-4 text-right transition ${activeSection === section.id
                ? 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/10'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-navy/20 hover:bg-slate-50'
                }`}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${activeSection === section.id ? 'bg-white/15' : 'bg-slate-100 text-brand-navy'}`}>
                <i className={`fa-solid ${section.icon}`}></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{section.label}</p>
                <p className={`mt-1 text-xs font-bold ${activeSection === section.id ? 'text-white/75' : 'text-slate-500'}`}>{section.description}</p>
              </div>
            </button>
          ))}
        </aside>

        <div className="min-w-0 space-y-6">
          {activeSection === 'account' && (
            <>
              <NoticePanel
                title="الخطوة التالية"
                description="راجع بيانات الحساب الأساسية أولًا، ثم انتقل إلى الأمان أو الفوترة حسب المهمة التي تريد إنجازها الآن."
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {usageStats.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="mt-2 text-xl font-black text-brand-dark">{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.note}</p>
                  </div>
                ))}
              </div>

              <SettingsCard title="بيانات الحساب" description="هذه البيانات داخلية لإدارة الحساب والوصول والمراسلات.">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: 'name', label: 'الاسم الكامل', type: 'text' },
                    { key: 'email', label: 'البريد الإلكتروني', type: 'email' },
                    { key: 'phone', label: 'رقم الهاتف', type: 'text' },
                    { key: 'company', label: 'المكتب أو الجهة', type: 'text' },
                  ].map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-2 block text-sm font-black text-brand-dark">{field.label}</span>
                      <input
                        type={field.type}
                        value={form[field.key as keyof typeof form] as string}
                        readOnly={field.key === 'email'}
                        onChange={(event) => updateForm(field.key as keyof SettingsForm, event.target.value)}
                        className={`w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy ${field.key === 'email' ? 'bg-slate-100 text-slate-500' : 'bg-slate-50'}`}
                      />
                      {field.key === 'email' && (
                        <span className="mt-1 block text-xs font-bold text-slate-400">لتغيير البريد الإلكتروني تواصل مع الدعم حفاظاً على أمان الحساب.</span>
                      )}
                    </label>
                  ))}
                </div>
                {isProfessionalAccount && (
                  <div className="mt-4">
                    <label className="block">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {SUGGESTED_CONSULTATION_FEES.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                updateForm('consultationFee', suggestion);
                                setConsultationFeeError('');
                              }}
                              className={`rounded-full border px-3 py-1 text-[10px] font-black transition ${
                                form.consultationFee === suggestion
                                  ? 'border-brand-navy bg-brand-navy text-white'
                                  : 'border-brand-gold/20 bg-brand-gold/10 text-brand-dark hover:bg-brand-gold/20'
                              }`}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                        <span className="block text-sm font-black text-brand-dark">سعر الاستشارة القانونية</span>
                      </div>
                      <input
                        type="text"
                        value={form.consultationFee}
                        onChange={(event) => {
                          const nextValue = formatConsultationFeeInput(event.target.value);
                          updateForm('consultationFee', nextValue);
                          setConsultationFeeError(nextValue ? '' : 'يرجى إدخال سعر استشارة قانونية صحيح.');
                        }}
                        placeholder="مثال: 50,000 د.ع"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                      />
                      <p className="mt-2 text-xs font-bold text-slate-400">
                        هذا السعر سيظهر للعملاء في صفحة المحامي ويُستخدم عند بدء الاستشارة المباشرة.
                      </p>
                      {consultationFeeError && (
                        <p className="mt-2 text-xs font-black text-red-500">{consultationFeeError}</p>
                      )}
                    </label>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title="بيئة العمل المرتبطة" description="تفاصيل تشغيلية مستمدة من سجلات الحساب وهي مخصصة للقراءة فقط.">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">الدور</p>
                    <p className="mt-2 text-sm font-bold text-brand-dark">{user?.roleDescription || 'عضو مساحة العمل'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">بيئة العمل</p>
                    <p className="mt-2 text-sm font-bold text-brand-dark">القسطاس الذكي - العراق</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">تاريخ الانضمام</p>
                    <p className="mt-2 text-sm font-bold text-brand-dark">كانون الثاني 2024</p>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title="منطقة الخطر" description="إجراءات حساسة تتعلق بحسابك ولا يمكن التراجع عنها." className="border-red-200 bg-red-50/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-700">حذف الحساب</p>
                    <p className="mt-1 text-xs font-bold text-red-600 opacity-70">
                      تحذير: سيتم حذف كافة المستندات والقضايا والمراسلات بشكل نهائي ولا يمكن استعادتها.
                    </p>
                  </div>
                  <ActionButton type="button" variant="danger" onClick={() => navigate('/support')}>
                    <i className="fa-solid fa-headset"></i>
                    طلب مراجعة الحذف
                  </ActionButton>
                </div>
              </SettingsCard>
            </>
          )}

          {activeSection === 'publicProfile' && isProfessionalAccount && (
            <>
              <NoticePanel
                title="الملف الذي يراه العملاء"
                description="هذه الحقول تظهر في صفحة ملفك العام، وتساعد العميل على فهم خبرتك بسرعة قبل بدء التواصل أو فتح قضية."
              />

              <SettingsCard title="نبذة وتعريف" description="اكتب تعريفاً مختصراً وواضحاً عن أسلوبك وخبرتك القانونية.">
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-brand-dark">عنوان تعريفي قصير</span>
                    <input
                      type="text"
                      value={form.tagline}
                      onChange={(event) => updateForm('tagline', event.target.value)}
                      maxLength={120}
                      placeholder="مثال: استشارات دقيقة في عقود الشركات والنزاعات التجارية"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                    />
                    <span className="mt-1 block text-xs font-bold text-slate-400">{form.tagline.length}/120</span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-brand-dark">نبذة وتعريف</span>
                    <textarea
                      value={form.bio}
                      onChange={(event) => updateForm('bio', event.target.value)}
                      rows={6}
                      maxLength={700}
                      placeholder="عرّف بنفسك: نوع القضايا التي تتابعها، أسلوب العمل، وما الذي يميز تجربة العميل معك."
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-700 outline-none transition focus:border-brand-navy"
                    />
                    <span className="mt-1 block text-xs font-bold text-slate-400">{form.bio.length}/700</span>
                  </label>
                </div>
              </SettingsCard>

              <SettingsCard title="التخصصات والتميز" description="حدد التخصص الرئيسي ونقاط القوة التي ستظهر كوسوم في الملف العام.">
                <div className="grid gap-5">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-brand-dark">التخصص الرئيسي</span>
                      <input
                        type="text"
                        value={form.specialty}
                        onChange={(event) => updateForm('specialty', event.target.value)}
                        placeholder="مثال: قضايا تجارية"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-brand-dark">سنوات الخبرة</span>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={form.experienceYears}
                        onChange={(event) => updateForm('experienceYears', event.target.value)}
                        placeholder="12"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-black text-brand-dark">اقتراحات سريعة للتخصص</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      {SUGGESTED_SPECIALTIES.map((specialty) => (
                        <button
                          key={specialty}
                          type="button"
                          onClick={() => updateForm('specialty', specialty)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                            form.specialty === specialty
                              ? 'border-brand-navy bg-brand-navy text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy/30'
                          }`}
                        >
                          {specialty}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-brand-dark">نقاط التميز</span>
                    <textarea
                      value={form.highlights}
                      onChange={(event) => updateForm('highlights', event.target.value)}
                      rows={5}
                      placeholder={`اكتب كل نقطة في سطر مستقل، مثل:\nصياغة العقود\nتفاوض وتسوية النزاعات`}
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-700 outline-none transition focus:border-brand-navy"
                    />
                    <span className="mt-1 block text-xs font-bold text-slate-400">ستظهر هذه النقاط كوسوم تحت قسم التخصصات والتميز.</span>
                  </label>

                  <div>
                    <p className="mb-2 text-sm font-black text-brand-dark">إضافة نقطة جاهزة</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      {SUGGESTED_HIGHLIGHTS.map((highlight) => {
                        const currentHighlights = form.highlights
                          .split(/\n|،|,/)
                          .map((item) => item.trim())
                          .filter(Boolean);
                        const isSelected = currentHighlights.includes(highlight);
                        return (
                          <button
                            key={highlight}
                            type="button"
                            onClick={() => {
                              if (isSelected) return;
                              updateForm('highlights', [...currentHighlights, highlight].join('\n'));
                            }}
                            disabled={isSelected}
                            className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                              isSelected
                                ? 'cursor-default border-emerald-100 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-navy/30 hover:bg-slate-50'
                            }`}
                          >
                            <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-plus'} ml-1 text-[10px]`}></i>
                            {highlight}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </SettingsCard>
            </>
          )}

          {activeSection === 'security' && (
            <>
              <SettingsCard title="تغيير كلمة المرور" description="تحديث كلمة المرور مع التحقق من المعايير الأمنية وحالة التطابق.">
                <form onSubmit={submitPasswordChange} className="grid gap-4 lg:grid-cols-3">
                  <div className="text-right">
                    <label className="mb-2 block text-sm font-bold text-slate-700">كلمة المرور الحالية</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-navy"
                    />
                  </div>
                  <div className="text-right">
                    <label className="mb-2 block text-sm font-bold text-slate-700">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-navy"
                    />
                  </div>
                  <div className="text-right">
                    <label className="mb-2 block text-sm font-bold text-slate-700">تأكيد كلمة المرور</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-navy"
                    />
                  </div>
                  <div className="lg:col-span-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-right">
                      {passwordError && <p className="text-sm font-semibold text-red-500">{passwordError}</p>}
                      {passwordSuccess && <p className="text-sm font-semibold text-emerald-600">{passwordSuccess}</p>}
                    </div>
                    <ActionButton
                      type="submit"
                      disabled={isSubmittingPassword}
                      variant="primary"
                    >
                      {isSubmittingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                    </ActionButton>
                  </div>
                </form>
              </SettingsCard>

              <SettingsCard title="المصادقة الثنائية" description="حماية إضافية للحساب تتطلب رمزاً من تطبيق المصادقة عند تسجيل الدخول.">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-dark">تفعيل تطبيق المصادقة</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {form.twoFactor
                        ? 'الحساب محمي حالياً بطبقة تحقق ثانية عند تسجيل الدخول من جهاز جديد.'
                        : 'فعّل التحقق الثنائي لتقليل مخاطر الوصول غير المصرح به.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTwoFactor}
                    className={`flex items-center justify-between rounded-full px-1 py-1 transition ${form.twoFactor ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`flex h-8 w-14 items-center rounded-full px-1 ${form.twoFactor ? 'justify-end' : 'justify-start'}`}>
                      <span className="h-6 w-6 rounded-full bg-white shadow-sm"></span>
                    </span>
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard
                title="الجلسات النشطة"
                description="قائمة بالأجهزة التي سجلت الدخول مؤخراً مع إمكانية إنهاء أي جلسة مشبوهة."
                actions={sessionsNotice ? <span className="text-sm font-semibold text-emerald-600">{sessionsNotice}</span> : undefined}
              >
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-400">الجهاز</p>
                          <p className="mt-1 text-sm font-bold text-brand-dark">{session.device}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-400">الموقع</p>
                          <p className="mt-1 text-sm font-bold text-brand-dark">{session.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-400">آخر ظهور</p>
                          <p className="mt-1 text-sm font-bold text-brand-dark">{session.lastSeen}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-400">عنوان IP</p>
                          <p className="mt-1 text-sm font-bold text-brand-dark">{session.ipAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {session.current && (
                          <StatusBadge tone="success">الحالي</StatusBadge>
                        )}
                        {!session.current && (
                          <ActionButton
                            type="button"
                            onClick={() => revokeSession(session.id)}
                            variant="danger"
                            size="sm"
                          >
                            إنهاء
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsCard>
            </>
          )}

          {activeSection === 'documents' && (
            <>
              <section className="overflow-hidden rounded-[2rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.04] shadow-sm">
                <div className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="text-right">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Identity & Verification</p>
                    <h2 className="mt-3 text-2xl font-black text-brand-dark">توثيق المستندات الأساسية</h2>
                    <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                      هذا القسم مخصص لرفع البطاقة الوطنية وبطاقة المحاماة ضمن تجربة واضحة وسريعة، مع إبقاء حالة كل مستند مفهومة فوراً للمستخدم.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                      <StatusBadge tone={uploadedDocumentsCount === verificationDocuments.length ? 'success' : 'warning'}>
                        {uploadedDocumentsCount}/{verificationDocuments.length} مستندات مرفوعة
                      </StatusBadge>
                      <StatusBadge tone={verifiedDocumentsCount > 0 ? 'info' : 'neutral'}>
                        {verifiedDocumentsCount} مستندات موثقة
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 text-right shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                        <i className="fa-solid fa-shield-check text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm font-black text-brand-dark">متطلبات الرفع</p>
                        <ul className="mt-3 space-y-2 text-xs font-bold leading-6 text-slate-500">
                          <li>استخدم صورة واضحة أو ملف PDF رسمي.</li>
                          <li>الحجم الأقصى لكل ملف هو 5MB.</li>
                          <li>سيتم إلغاء التوثيق السابق تلقائياً عند استبدال الملف.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {(documentNotice || uploadError) && (
                <NoticePanel
                  title={uploadError ? 'تعذر رفع المستند' : 'تم استلام المستند'}
                  description={uploadError || documentNotice}
                  tone={uploadError ? 'warning' : 'success'}
                />
              )}

              <div className="grid gap-5 xl:grid-cols-2">
                {verificationDocuments.map((document) => (
                  <div key={document.key} className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {document.required && <StatusBadge tone="warning">مطلوب</StatusBadge>}
                        {document.previewUrl && !document.isVerified && <StatusBadge tone="info">قيد المراجعة</StatusBadge>}
                        {!document.previewUrl && <StatusBadge tone="neutral">غير مرفوع</StatusBadge>}
                      </div>
                      <div className="text-right">
                        <h3 className="text-lg font-black text-brand-dark">{document.label}</h3>
                        <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{document.helperText}</p>
                      </div>
                    </div>

                    <DocumentUpload
                      label={document.label}
                      description={document.description}
                      icon={document.icon}
                      previewUrl={document.previewUrl}
                      isVerified={document.isVerified}
                      isLoading={uploading}
                      onUpload={document.key === 'nationalId' ? handleNationalIdUpload : handleLawyerLicenseUpload}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === 'billing' && (
            <>
              {billingNotice && (
                <NoticePanel title="تحديث الفوترة" description={billingNotice} tone={billingStatus === 'past_due' ? 'warning' : 'success'} />
              )}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <SettingsCard title="خطة الاشتراك" description="حالة الاشتراك الحالي، المميزات المتاحة، وتفاصيل التجديد.">
                  <div className="rounded-xl border border-brand-gold/20 bg-gradient-to-l from-white to-brand-gold/10 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="text-right">
                        <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-navy">
                          <i className="fa-solid fa-layer-group ml-2"></i>
                          الاحترافية
                        </div>
                        <h4 className="mt-3 text-xl font-black text-brand-dark">$79 / شهرياً</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          خطة تشغيل مناسبة للاستخدام اليومي المكثف مع فوترة شهرية وميزات أمنية وتقارير استخدام أساسية.
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <ActionButton
                          type="button"
                          onClick={() => handleBillingAction('تم فتح مسار ترقية الخطة. يمكنك متابعة التفاصيل من صفحة المدفوعات.', 'active')}
                          variant="primary"
                          size="sm"
                        >
                          ترقية الخطة
                        </ActionButton>
                        <ActionButton
                          type="button"
                          onClick={() => handleBillingAction('تم عرض حالة المتأخرات لتجربة التنبيه المالي.', 'past_due')}
                          variant="secondary"
                          size="sm"
                        >
                          محاكاة متأخرات
                        </ActionButton>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {PLAN_FEATURES.map((feature) => (
                        <div key={feature} className="flex items-center justify-end gap-2 rounded-xl bg-white/80 px-3 py-3 text-right">
                          <span className="text-sm font-semibold text-brand-dark">{feature}</span>
                          <i className="fa-solid fa-check text-xs text-emerald-500"></i>
                        </div>
                      ))}
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard title="حالة الدفع" description="ملخص سريع لصحة العمليات المالية للحساب.">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-400">الحالة</p>
                      <p className={`mt-2 text-sm font-bold ${billingStatus === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {billingStatus === 'active' ? 'نشط وفي وضع جيد' : 'توجد متأخرات - مطلوب مراجعة الدفع'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-400">تاريخ التجديد</p>
                      <p className="mt-2 text-sm font-bold text-brand-dark">01 May 2026</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-400">مسؤول الفوترة</p>
                      <p className="mt-2 text-sm font-bold text-brand-dark">{form.email}</p>
                    </div>
                  </div>
                </SettingsCard>
              </div>

              <SettingsCard title="طريقة الدفع" description="إدارة البطاقات المربوطة أو إضافة وسائل دفع احتياطية.">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="rounded-xl bg-brand-dark px-4 py-3 text-white">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">فيزا</p>
                        <p className="mt-3 text-lg font-bold">•••• 4242</p>
                        <p className="mt-2 text-xs text-white/70">تنتهي في 08/27</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-brand-dark">وسيلة الدفع الأساسية</p>
                        <p className="mt-1 text-sm text-slate-500">بطاقة Visa تنتهي بـ 4242 مرتبطة بالاشتراك الشهري.</p>
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <ActionButton type="button" variant="secondary" size="sm" onClick={() => handleBillingAction('تم توجيهك لمراجعة وسيلة الدفع من صفحة المدفوعات.')}>
                            تغيير البطاقة
                          </ActionButton>
                          <ActionButton type="button" variant="primary" size="sm" onClick={() => handleBillingAction('تم بدء إضافة وسيلة دفع احتياطية.')}>
                            إضافة وسيلة احتياطية
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h4 className="text-right text-sm font-bold text-brand-dark">عنوان الفوترة</h4>
                    <div className="mt-3 space-y-2 text-right text-sm text-slate-600">
                      <p>{form.name}</p>
                      <p>منطقة الكرادة، بغداد</p>
                      <p>العراق</p>
                      <p>ZIP: 10011</p>
                    </div>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title="الفواتير" description="قائمة بأحدث الفواتير الصادرة وسجل المدفوعات.">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-right">
                    <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-3 font-semibold">الفاتورة</th>
                        <th className="px-3 py-3 font-semibold">التاريخ</th>
                        <th className="px-3 py-3 font-semibold">المبلغ</th>
                        <th className="px-3 py-3 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-slate-100">
                          <td className="px-3 py-4 text-sm font-black text-brand-dark">{invoice.label}</td>
                          <td className="px-3 py-4 text-sm text-slate-500">{invoice.date}</td>
                          <td className="px-3 py-4 text-sm text-slate-500">{invoice.amount}</td>
                          <td className="px-3 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {invoice.status === 'paid' ? 'مدفوعة' : 'قيد الانتظار'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SettingsCard>
            </>
          )}

          {activeSection === 'notifications' && (
            <>
              <SettingsCard title="إعدادات الإشعارات" description="تحكم في كيفية ووقت تلقي التنبيهات من المنصة.">
                <div className="divide-y divide-slate-100">
                  {[
                    { key: 'pushNotifications', label: 'تنبيهات المتصفح والتطبيق', desc: 'استلام إشعارات فورية عند تحديث القضايا.' },
                    { key: 'emailAlerts', label: 'إشعارات البريد الإلكتروني', desc: 'ملخصات دورية وتحديثات هامة.' },
                    { key: 'billingReminders', label: 'تنبيهات الفوترة', desc: 'تذكيرات بموعد التجديد وفواتير الاشتراك.' },
                    { key: 'securityAlerts', label: 'تنبيهات الأمان', desc: 'عند تسجيل دخول جديد أو تغيير كلمة المرور.' },
                    { key: 'marketingEmails', label: 'رسائل تسويقية', desc: 'عروض وميزات جديدة وأخبار المنصة.' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-5 first:pt-0 last:pb-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-brand-dark">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => togglePreference(item.key as NotificationPreferenceKey)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${form[item.key as keyof typeof form] ? 'bg-brand-navy' : 'bg-slate-200'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form[item.key as keyof typeof form] ? '-translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="التفضيلات العامة" description="إعدادات اللغة وبعض ملامح التجربة اليومية.">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-brand-dark">اللغة المفضلة</span>
                  <select
                    value={form.language}
                    onChange={(event) => updateForm('language', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                  >
                    <option>العربية</option>
                    <option>English</option>
                  </select>
                </label>
              </SettingsCard>

              <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 p-5 text-right">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold">
                    <i className="fa-solid fa-lightbulb"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-dark">نصيحة ذكية</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">تفعيل تنبيهات الأمان يساعد في حماية حسابك من الوصول غير المصرح به بشكل استباقي.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === 'integrations' && (
            <>
              {integrationNotice && (
                <NoticePanel title="تحديث التكاملات" description={integrationNotice} tone="success" />
              )}

              <SettingsCard title="التطبيقات المتصلة" description="إدارة الربط مع الأدوات الخارجية لتسريع سير عملك القانوني.">
                <div className="grid gap-4">
                  {connectedApps.map((app) => (
                    <div key={app.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/30 p-4 transition-all hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl text-slate-600 shadow-sm">
                          <i className={app.icon}></i>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-sm font-bold text-brand-dark">{app.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{app.desc}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${app.status === 'connected' ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {app.status === 'connected' ? 'متصل' : 'غير متصل'}
                        </span>
                        <ActionButton
                          type="button"
                          onClick={() => toggleIntegration(app.id)}
                          variant={app.status === 'connected' ? 'danger' : 'primary'}
                          size="sm"
                        >
                          {app.status === 'connected' ? 'فصل' : 'ربط الآن'}
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="تصدير البيانات" description="احصل على نسخة من بياناتك وسجلاتك وملفاتك.">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-dark">تحميل أرشيف البيانات</p>
                    <p className="mt-1 text-xs text-slate-500">نسخة من كافة بياناتك وسجلاتك والملفات المرفوعة بصيغة JSON.</p>
                  </div>
                  <ActionButton type="button" onClick={exportData} variant="secondary" size="sm">
                    <i className="fa-solid fa-download"></i>
                    بدء التصدير
                  </ActionButton>
                </div>
              </SettingsCard>
            </>
          )}

          {activeSection === 'activity' && (
            <>
              <SettingsCard title="تحليلات استخدام الحساب" description="نظرة عامة على وتيرة التفاعل خلال الأسبوع الماضي.">
                <div className="grid gap-4 md:grid-cols-7">
                  {[3, 7, 5, 12, 8, 4, 2].map((value, index) => (
                    <div key={index} className="flex flex-col items-center gap-3">
                      <div className="flex h-44 w-full items-end justify-center rounded-2xl bg-slate-50 p-3">
                        <div className="w-full rounded-xl bg-brand-navy transition-all" style={{ height: `${value * 8}px` }}></div>
                      </div>
                      <p className="text-xs font-black text-slate-400">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]}</p>
                    </div>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="النشاط الأخير" description="سجل الأحداث التشغيلية والأمنية المرتبطة بحسابك.">
                <div className="relative space-y-6 before:absolute before:bottom-2 before:right-[2.25rem] before:top-2 before:w-0.5 before:bg-slate-100">
                  {activityItems.map((item) => (
                    <div key={item.id} className="relative flex items-start gap-6 pr-1">
                      <div className={`z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-white shadow-sm ${getActivityTone(item.type)}`}>
                        <i className={`${item.type === 'security' ? 'fa-solid fa-shield-halved' : item.type === 'billing' ? 'fa-solid fa-credit-card' : item.type === 'system' ? 'fa-solid fa-server' : 'fa-solid fa-user-pen'} text-xs`}></i>
                      </div>
                      <div className="flex-1 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50 lg:flex lg:items-center lg:justify-between">
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.type}</span>
                            <p className="text-sm font-bold text-brand-dark">{item.title}</p>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-slate-500">{item.description}</p>
                        </div>
                        <div className="mt-2 text-right text-xs font-medium text-slate-400 lg:mt-0">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
