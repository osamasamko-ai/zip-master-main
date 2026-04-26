import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../components/ui/ActionButton';
import NoticePanel from '../components/ui/NoticePanel';
import StatusBadge from '../components/ui/StatusBadge';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentUpload } from '../components/DocumentUpload';
import { useDocumentUpload } from '../hooks/useDocumentUpload';

type SettingsSection = 'account' | 'security' | 'billing' | 'notifications' | 'integrations' | 'activity' | 'documents';

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
    <section className={`overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm ${className}`}>
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
  const { NotificationBell, notifications, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications } = useNotifications(); // Use global notifications
  const navigate = useNavigate();
  const { uploadNationalId, uploadLawyerLicense, uploading, error: uploadError } = useDocumentUpload();

  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [savedToast, setSavedToast] = useState('');
  const [sessionsNotice, setSessionsNotice] = useState('');
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
  const [form, setForm] = useState({
    name: user?.name ?? 'أحمد العراقي',
    email: user?.email ?? '',
    phone: '',
    company: user?.role === 'pro' ? 'مكتب النعيمي للمحاماة' : 'حساب فردي',
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

  React.useEffect(() => {
    const load = async () => {
      try {
        const response = await apiClient.getSettings();
        const data = response.data;
        if (!data?.profile) return;
        setSessions(data.sessions || []);
        setActivityItems(data.activityItems || []);
        setForm((current) => ({
          ...current,
          name: data.profile.name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          company: data.profile.company || '',
          consultationFee: data.profile.consultationFee || '',
          language: data.profile.language || 'العربية',
          twoFactor: !!data.profile.twoFactor,
          emailAlerts: !!data.profile.emailAlerts,
          pushNotifications: !!data.profile.pushNotifications,
          billingReminders: !!data.profile.billingReminders,
          securityAlerts: !!data.profile.securityAlerts,
          marketingEmails: !!data.profile.marketingEmails,
        }));
        setInvoices(data.invoices || []);
        setDocuments({
          nationalIdUrl: data.profile.nationalIdUrl || '',
          nationalIdVerified: !!data.profile.nationalIdVerified,
          lawyerLicenseUrl: data.profile.lawyerLicenseUrl || '',
          lawyerLicenseVerified: !!data.profile.lawyerLicenseVerified,
        });
      } catch (error) {
        console.error('Failed to load settings', error);
      }
    };
    load();
  }, []);

  const sections = useMemo(
    () => [
      { id: 'account' as const, label: 'الحساب', icon: 'fa-id-card', description: 'الهوية، بيانات الحساب، وبيئة العمل' },
      { id: 'security' as const, label: 'الأمان', icon: 'fa-shield-halved', description: 'كلمة المرور، الحماية، والجلسات' },
      { id: 'documents' as const, label: 'المستندات', icon: 'fa-file-shield', description: 'الهوية، بطاقة المحاماة، وحالة التحقق' },
      { id: 'billing' as const, label: 'الفوترة', icon: 'fa-credit-card', description: 'الخطة، المدفوعات، والفواتير' },
      { id: 'notifications' as const, label: 'الإشعارات', icon: 'fa-bell', description: 'التنبيهات والقنوات المفضلة' },
      { id: 'integrations' as const, label: 'التكاملات', icon: 'fa-link', description: 'الأدوات المتصلة وتصدير البيانات' },
      { id: 'activity' as const, label: 'النشاط', icon: 'fa-clock-rotate-left', description: 'تحليلات الاستخدام وسجل الأحداث' },
    ],
    []
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

  const connectedApps = useMemo(
    () => [
      { id: 'google', name: 'Google Workspace', status: 'connected', icon: 'fa-brands fa-google', desc: 'لمزامنة المواعيد والملفات' },
      { id: 'zain', name: 'Zain Cash', status: 'connected', icon: 'fa-solid fa-mobile-screen', desc: 'للمدفوعات السريعة' },
      { id: 'dropbox', name: 'Dropbox', status: 'disconnected', icon: 'fa-brands fa-dropbox', desc: 'تخزين سحابي إضافي' },
    ],
    []
  );

  const isProfessionalAccount = user?.role === 'pro' || user?.role === 'admin';

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
      await Promise.all([
        apiClient.updateSettingsProfile({
          name: form.name,
          phone: form.phone,
          company: form.company,
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
      setSavedToast('تم حفظ الإعدادات بنجاح');
      window.setTimeout(() => setSavedToast(''), 2200);
    } catch (error) {
      console.error('Failed to save settings', error);
      setSavedToast('تعذر حفظ الإعدادات');
    }
  };

  const revokeSession = async (sessionId: string) => {
    await apiClient.revokeSession(sessionId);
    setSessions((current) => current.filter((item) => item.id !== sessionId));
    setSessionsNotice('تم إنهاء الجلسة بنجاح');
    window.setTimeout(() => setSessionsNotice(''), 2200);
  };

  const toggleTwoFactor = () => {
    const next = !form.twoFactor;
    setForm((current) => ({ ...current, twoFactor: next }));
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
    <div className="app-view space-y-6 text-right">
      <section className="rounded-[2.5rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.04] p-8 shadow-premium">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Private Workspace</p>
            <h1 className="mt-3 text-3xl font-black text-brand-dark">الإعدادات</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-500">
              مساحة خاصة لإدارة الحساب والأمان والتفضيلات والفوترة والنشاط. لا تظهر هذه المعلومات للزوار أو العملاء.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              variant="secondary"
              className="relative"
            >
              <NotificationBell /> {/* Use the NotificationBell component from context */}
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden text-right origin-top-right"
                  >
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                      <button onClick={clearAllNotifications} className="text-[10px] font-black text-slate-400 hover:text-red-500">مسح الكل</button>
                      <h4 className="text-xs font-black text-brand-dark">التنبيهات</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); setIsNotificationsOpen(false); }}
                          className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition cursor-pointer ${!n.read ? 'bg-brand-navy/[0.02]' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold text-slate-400">{new Date(n.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
                            <p className={`text-xs font-black ${!n.read ? 'text-brand-navy' : 'text-slate-600'}`}>{n.title}</p>
                          </div>
                          <p className="text-[11px] font-bold text-slate-500 leading-relaxed">{n.message}</p>
                        </div>
                      )) : (
                        <div className="p-10 text-center text-slate-300">
                          <i className="fa-solid fa-bell-slash text-3xl mb-3 opacity-20"></i>
                          <p className="text-xs font-bold">لا توجد تنبيهات جديدة</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </ActionButton>
            <ActionButton
              onClick={() => navigate('/profile/lawyer-1')}
              variant="secondary"
            >
              عرض نموذج الملف العام
            </ActionButton>
            <ActionButton
              onClick={saveChanges}
              variant="primary"
            >
              حفظ التغييرات
            </ActionButton>
          </div>
        </div>
      </section>

      {savedToast && (
        <NoticePanel title="تم الحفظ" description={savedToast} tone="success" />
      )}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-3">
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

        <div className="space-y-6">
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
                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                      />
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
                                setForm((current) => ({ ...current, consultationFee: suggestion }));
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
                          setForm((current) => ({ ...current, consultationFee: nextValue }));
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
                  <ActionButton variant="danger">
                    حذف الحساب
                  </ActionButton>
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
                      <StatusBadge tone={verifiedDocumentsCount > 0 ? 'info' : 'default'}>
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
                          onClick={() => setBillingStatus('active')}
                          variant="primary"
                          size="sm"
                        >
                          ترقية الخطة
                        </ActionButton>
                        <ActionButton
                          type="button"
                          onClick={() => setBillingStatus('past_due')}
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl bg-brand-dark px-4 py-3 text-white">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">فيزا</p>
                        <p className="mt-3 text-lg font-bold">•••• 4242</p>
                        <p className="mt-2 text-xs text-white/70">تنتهي في 08/27</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-brand-dark">وسيلة الدفع الأساسية</p>
                        <p className="mt-1 text-sm text-slate-500">بطاقة Visa تنتهي بـ 4242 مرتبطة بالاشتراك الشهري.</p>
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <ActionButton variant="secondary" size="sm">
                            تغيير البطاقة
                          </ActionButton>
                          <ActionButton variant="primary" size="sm">
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
                        onClick={() => setForm((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
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
                    onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
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
              <SettingsCard title="التطبيقات المتصلة" description="إدارة الربط مع الأدوات الخارجية لتسريع سير عملك القانوني.">
                <div className="grid gap-4">
                  {connectedApps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/30 p-4 transition-all hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl text-slate-600 shadow-sm">
                          <i className={app.icon}></i>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-brand-dark">{app.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{app.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${app.status === 'connected' ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {app.status === 'connected' ? 'متصل' : 'غير متصل'}
                        </span>
                        <ActionButton variant={app.status === 'connected' ? 'danger' : 'primary'} size="sm">
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
                  <ActionButton variant="secondary" size="sm">
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
