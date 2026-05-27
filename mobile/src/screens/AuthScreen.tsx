import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Role } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Mode = 'login' | 'register';
type UtilityTab = 'account' | 'verify';

const VALUE_POINTS = [
  'محامون يفهمون الواقع القانوني العراقي.',
  'متابعة أوضح للقضية والمستندات.',
  'تواصل أسرع وأكثر مهنية.',
];

const TRUST_SIGNALS = [
  { icon: 'business-outline' as const, title: 'للقانون العراقي', text: 'تجربة مصممة لطبيعة الإجراءات المحلية.' },
  { icon: 'shield-checkmark-outline' as const, title: 'خصوصية مهنية', text: 'ملفات ورسائل قانونية في مساحة واضحة.' },
];

const DEMO_ACCOUNTS = [
  { label: 'عميل تجريبي', email: 'user@example.com', password: 'password123', icon: 'person-outline' as const },
  { label: 'محامي تجريبي', email: 'lawyer@example.com', password: 'password123', icon: 'briefcase-outline' as const },
  { label: 'مدير', email: 'admin@example.com', password: 'password123', icon: 'shield-outline' as const },
];

const PASSWORD_HINTS = [
  { key: 'minLength', text: '8 أحرف على الأقل' },
  { key: 'hasUpperCase', text: 'حرف كبير واحد' },
  { key: 'hasNumber', text: 'رقم واحد' },
  { key: 'hasSpecial', text: 'رمز خاص' },
] as const;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getPasswordStrengthLabel(score: number) {
  const labels = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جداً'];
  const colorsByScore = [colors.line, colors.red, colors.gold, colors.green, colors.blue];
  return { label: labels[score], color: colorsByScore[score] };
}

export function AuthScreen() {
  const { login, register, isLoading, error } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [utilityTab, setUtilityTab] = useState<UtilityTab>('account');
  const [role, setRole] = useState<Role>('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState('');
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [documentIdInput, setDocumentIdInput] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');

  const isRegisterMode = mode === 'register';
  const emailPreview = normalizeEmail(email);
  const forgotEmailPreview = normalizeEmail(forgotEmail);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPreview);
  const forgotEmailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmailPreview);
  const passwordsMatch = confirmPassword !== '' && password === confirmPassword;
  const passwordsMismatch = confirmPassword !== '' && password !== confirmPassword;

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (!password) return 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const passwordRequirements = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );

  const registerChecklist = [
    { label: 'الاسم الكامل', met: name.trim().length > 1 },
    { label: 'بريد صحيح', met: emailLooksValid },
    { label: 'كلمة مرور قوية', met: passwordStrength >= 3 },
    { label: 'تأكيد مطابق', met: passwordsMatch },
  ];

  const canSubmitLogin = emailLooksValid && password.length > 0 && !isLoading;
  const canSubmitRegister = registerChecklist.every((item) => item.met) && !isLoading;
  const strengthUi = getPasswordStrengthLabel(passwordStrength);
  const destinationPreview = isRegisterMode
    ? role === 'pro'
      ? 'سيتم فتح لوحة المحامي بعد إنشاء الحساب.'
      : 'سيتم فتح لوحة العميل بعد إنشاء الحساب.'
    : 'سيتم توجيهك إلى لوحة التحكم المناسبة لحسابك.';

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setUtilityTab('account');
    setLocalError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleDemoLogin = (demo: (typeof DEMO_ACCOUNTS)[number]) => {
    switchMode('login');
    setEmail(demo.email);
    setPassword(demo.password);
    setLocalError('');
  };

  const validateRegisterForm = () => {
    if (!name.trim()) return 'يرجى إدخال الاسم الكامل.';
    if (!emailLooksValid) return 'صيغة البريد الإلكتروني غير صحيحة.';
    if (password.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.';
    if (passwordStrength < 3) return 'اختر كلمة مرور أقوى قبل المتابعة.';
    if (password !== confirmPassword) return 'تأكيد كلمة المرور غير مطابق.';
    return '';
  };

  const submit = async () => {
    setLocalError('');
    if (mode === 'login') {
      if (!canSubmitLogin) {
        setLocalError('أدخل بريداً صحيحاً وكلمة المرور.');
        return;
      }
      await login(emailPreview, password);
      return;
    }

    const validationError = validateRegisterForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    await register(emailPreview, password, name.trim(), role);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmailLooksValid) {
      setForgotMessage('تأكد من كتابة بريد إلكتروني صحيح.');
      return;
    }
    setForgotLoading(true);
    setForgotMessage('');
    await new Promise((resolve) => setTimeout(resolve, 900));
    setForgotMessage(`تم تسجيل طلب الاستعادة للبريد ${forgotEmailPreview}. ربط إرسال الرابط الفعلي يحتاج خدمة البريد في الخادم.`);
    setForgotLoading(false);
  };

  const verifyDocument = () => {
    if (!documentIdInput.trim()) return;
    setVerifyMessage(`تم تجهيز طلب التحقق للمستند ${documentIdInput.trim()}. افتح مسار التحقق في الويب عند الحاجة.`);
  };

  return (
    <ScreenShell>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.topHeader}>
            <View style={styles.logo}>
              <Ionicons name="scale-outline" size={25} color={colors.gold} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandName}>القسطاس</Text>
              <Text style={styles.brandSub}>خدمات قانونية عراقية منظمة في مكان واحد</Text>
            </View>
          </View>

          <View style={styles.valueRail}>
            {VALUE_POINTS.map((point) => (
              <View key={point} style={styles.valuePill}>
                <Ionicons name="checkmark-circle" size={15} color={colors.green} />
                <Text style={styles.valuePillText} numberOfLines={1}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderText}>
                <Text style={styles.eyebrow}>{isRegisterMode ? 'فتح حساب جديد' : 'تسجيل الدخول'}</Text>
                <Text style={styles.panelTitle}>{isRegisterMode ? 'ابدأ رحلتك القانونية الآن' : 'مرحباً بعودتك'}</Text>
                <Text style={styles.panelNote}>
                  {isRegisterMode ? 'أدخل بياناتك وسنجهز لك مساحة تناسب دورك.' : 'سجّل دخولك بسرعة وتابع عملك من نفس المكان.'}
                </Text>
              </View>
              <View style={styles.panelIcon}>
                <Ionicons name={isRegisterMode ? 'person-add-outline' : 'finger-print-outline'} size={22} color={colors.gold} />
              </View>
            </View>

            <View style={styles.modeSwitch}>
              <Segment label="تسجيل الدخول" selected={!isRegisterMode} onPress={() => switchMode('login')} />
              <Segment label="حساب جديد" selected={isRegisterMode} onPress={() => switchMode('register')} />
            </View>

            <View style={styles.utilitySwitch}>
              <MiniSegment icon="person-outline" label="الحساب" selected={utilityTab === 'account'} onPress={() => setUtilityTab('account')} />
              <MiniSegment icon="qr-code-outline" label="تحقق مستند" selected={utilityTab === 'verify'} onPress={() => setUtilityTab('verify')} />
            </View>

            {utilityTab === 'verify' ? (
              <View style={styles.form}>
                <View style={styles.infoBox}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={colors.navy} />
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoTitle}>التحقق دون تسجيل دخول</Text>
                    <Text style={styles.infoText}>أدخل رقم المستند أو رمز QR للتحقق من صحة عقد أو مستند رقمي صادر من القسطاس.</Text>
                  </View>
                </View>
                <AuthField
                  label="رقم المستند"
                  value={documentIdInput}
                  onChangeText={(value) => {
                    setDocumentIdInput(value);
                    setVerifyMessage('');
                  }}
                  placeholder="مثال: contract-123"
                  icon="qr-code-outline"
                />
                {verifyMessage ? <Message tone="success" text={verifyMessage} /> : null}
                <PrimaryButton title="تحقق الآن" icon="shield-checkmark-outline" disabled={!documentIdInput.trim()} onPress={verifyDocument} />
              </View>
            ) : (
              <View style={styles.form}>
                {(localError || error) ? <Message tone="error" text={localError || error} /> : null}

                {isLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color={colors.navy} />
                    <Text style={styles.loadingText}>جاري تحضير مساحتك القانونية</Text>
                  </View>
                ) : null}

                {!isRegisterMode ? (
                  <>
                    <View style={styles.demoBox}>
                      <View style={styles.demoHeader}>
                        <Text style={styles.demoMuted}>للتجربة السريعة</Text>
                        <Text style={styles.demoTitle}>حسابات جاهزة</Text>
                      </View>
                      <View style={styles.demoGrid}>
                        {DEMO_ACCOUNTS.map((demo) => (
                          <Pressable key={demo.email} onPress={() => handleDemoLogin(demo)} style={styles.demoButton}>
                            <Ionicons name={demo.icon} size={15} color={colors.navy} />
                            <Text style={styles.demoText}>{demo.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </>
                ) : null}

                {isRegisterMode ? (
                  <AuthField label="الاسم الكامل" value={name} onChangeText={setName} placeholder="الاسم كما تريد ظهوره" icon="id-card-outline" />
                ) : null}

                <AuthField
                  label="البريد الإلكتروني"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  icon="mail-outline"
                  keyboardType="email-address"
                  ltr
                  hint={email ? (emailLooksValid ? 'صيغة البريد تبدو سليمة.' : 'تحقق من صيغة البريد قبل المتابعة.') : undefined}
                  hintTone={emailLooksValid ? 'success' : 'warning'}
                />

                <AuthField
                  label="كلمة المرور"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isRegisterMode ? 'اختر كلمة مرور قوية' : '••••••••'}
                  icon="lock-closed-outline"
                  secureTextEntry={!showPassword}
                  actionIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onAction={() => setShowPassword((current) => !current)}
                />

                {isRegisterMode && password ? (
                  <View style={styles.passwordBox}>
                    <View style={styles.strengthHeader}>
                      <Text style={[styles.strengthLabel, { color: passwordStrength >= 3 ? colors.green : colors.muted }]}>{strengthUi.label}</Text>
                      <Text style={styles.strengthTitle}>قوة كلمة المرور</Text>
                    </View>
                    <View style={styles.strengthBar}>
                      {[1, 2, 3, 4].map((step) => (
                        <View key={step} style={[styles.strengthStep, { backgroundColor: passwordStrength >= step ? strengthUi.color : colors.line }]} />
                      ))}
                    </View>
                    <View style={styles.requirementsGrid}>
                      {PASSWORD_HINTS.map((requirement) => {
                        const met = passwordRequirements[requirement.key];
                        return <CheckChip key={requirement.key} label={requirement.text} met={met} />;
                      })}
                    </View>
                  </View>
                ) : null}

                {isRegisterMode ? (
                  <>
                    <AuthField
                      label="تأكيد كلمة المرور"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="أعد كتابة كلمة المرور"
                      icon="checkmark-circle-outline"
                      secureTextEntry={!showConfirmPassword}
                      actionIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      onAction={() => setShowConfirmPassword((current) => !current)}
                      hint={confirmPassword ? (passwordsMatch ? 'كلمتا المرور متطابقتان.' : 'تأكيد كلمة المرور غير مطابق.') : undefined}
                      hintTone={passwordsMismatch ? 'error' : 'success'}
                    />

                    <Text style={styles.fieldLabel}>نوع الحساب</Text>
                    <View style={styles.roleGrid}>
                      <RoleCard selected={role === 'user'} icon="person-outline" title="عميل" text="للاستشارة ومتابعة قضية ومراسلة محامٍ." onPress={() => setRole('user')} />
                      <RoleCard selected={role === 'pro'} icon="briefcase-outline" title="محامي" text="لإدارة القضايا واستقبال العملاء." onPress={() => setRole('pro')} />
                    </View>

                    <View style={styles.noteBox}>
                      <Text style={styles.noteTitle}>نقطة مهمة</Text>
                      <Text style={styles.noteText}>
                        {role === 'pro'
                          ? 'حساب المحامي يبدأ فوراً، وقد تحتاج لاحقاً إلى بيانات الترخيص لتفعيل الظهور واستقبال العملاء.'
                          : 'استخدم بريداً فعّالاً حتى نتمكن من إرسال الإشعارات أو تعليمات استعادة الحساب.'}
                      </Text>
                    </View>

                    <View style={styles.checklistBox}>
                      <View style={styles.checklistHeader}>
                        <Text style={styles.checklistCount}>{registerChecklist.filter((item) => item.met).length}/{registerChecklist.length}</Text>
                        <Text style={styles.checklistTitle}>جاهزية الحساب</Text>
                      </View>
                      <View style={styles.requirementsGrid}>
                        {registerChecklist.map((item) => <CheckChip key={item.label} label={item.label} met={item.met} />)}
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.loginTools}>
                    <Pressable onPress={() => setRememberMe((current) => !current)} style={styles.rememberButton}>
                      <Ionicons name={rememberMe ? 'checkbox' : 'square-outline'} size={18} color={rememberMe ? colors.navy : colors.muted} />
                      <Text style={styles.rememberText}>تذكرني على هذا الجهاز</Text>
                    </Pressable>
                    <Pressable onPress={() => setForgotVisible(true)}>
                      <Text style={styles.forgotText}>هل نسيت كلمة المرور؟</Text>
                    </Pressable>
                  </View>
                )}

                <PrimaryButton
                  title={isRegisterMode ? 'فتح الحساب' : 'دخول للمنصة'}
                  icon={isRegisterMode ? 'person-add-outline' : 'log-in-outline'}
                  disabled={isRegisterMode ? !canSubmitRegister : !canSubmitLogin}
                  loading={isLoading}
                  onPress={submit}
                />
                <Text style={styles.destination}>{destinationPreview}</Text>
              </View>
            )}
          </View>

          <View style={styles.trustGrid}>
            {TRUST_SIGNALS.map((item) => (
              <View key={item.title} style={styles.trustCard}>
                <Ionicons name={item.icon} size={18} color={colors.gold} />
                <View style={styles.trustTextWrap}>
                  <Text style={styles.trustTitle}>{item.title}</Text>
                  <Text style={styles.trustText}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ForgotPasswordModal
        visible={forgotVisible}
        email={forgotEmail}
        setEmail={setForgotEmail}
        loading={forgotLoading}
        message={forgotMessage}
        emailValid={forgotEmailLooksValid}
        onClose={() => setForgotVisible(false)}
        onSubmit={handleForgotPassword}
      />
    </ScreenShell>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, selected && styles.segmentActive]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MiniSegment({ icon, label, selected, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.miniSegment, selected && styles.miniSegmentActive]}>
      <Ionicons name={icon} size={15} color={selected ? '#fff' : colors.muted} />
      <Text style={[styles.miniSegmentText, selected && styles.miniSegmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  actionIcon,
  onAction,
  keyboardType,
  ltr,
  hint,
  hintTone = 'success',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  secureTextEntry?: boolean;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  keyboardType?: 'email-address' | 'default';
  ltr?: boolean;
  hint?: string;
  hintTone?: 'success' | 'warning' | 'error';
}) {
  const hintColor = hintTone === 'error' ? colors.red : hintTone === 'warning' ? colors.gold : colors.green;

  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={18} color={colors.subtle} />
        <TextInput
          autoCapitalize="none"
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
          style={[styles.input, ltr && styles.inputLtr]}
          textAlign={ltr ? 'left' : 'right'}
        />
        {actionIcon ? (
          <Pressable onPress={onAction} style={styles.inputAction}>
            <Ionicons name={actionIcon} size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={[styles.fieldHint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

function RoleCard({ selected, icon, title, text, onPress }: { selected: boolean; icon: keyof typeof Ionicons.glyphMap; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.roleCard, selected && styles.roleCardActive]}>
      <View style={[styles.roleIcon, selected && styles.roleIconActive]}>
        <Ionicons name={icon} size={20} color={selected ? '#fff' : colors.muted} />
      </View>
      <View style={styles.roleTextWrap}>
        <Text style={[styles.roleTitle, selected && styles.roleTitleActive]}>{title}</Text>
        <Text style={styles.roleText}>{text}</Text>
      </View>
    </Pressable>
  );
}

function CheckChip({ label, met }: { label: string; met: boolean }) {
  return (
    <View style={[styles.checkChip, met && styles.checkChipMet]}>
      <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={met ? colors.green : colors.muted} />
      <Text style={[styles.checkChipText, met && styles.checkChipTextMet]}>{label}</Text>
    </View>
  );
}

function Message({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  return (
    <View style={[styles.message, tone === 'error' ? styles.messageError : styles.messageSuccess]}>
      <Ionicons name={tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={19} color={tone === 'error' ? colors.red : colors.green} />
      <Text style={[styles.messageText, { color: tone === 'error' ? colors.red : colors.green }]}>{text}</Text>
    </View>
  );
}

function PrimaryButton({ title, icon, disabled, loading, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; disabled?: boolean; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={[styles.primaryButton, (disabled || loading) && styles.primaryButtonDisabled]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={18} color="#fff" />}
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function ForgotPasswordModal({
  visible,
  email,
  setEmail,
  loading,
  message,
  emailValid,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  email: string;
  setEmail: (value: string) => void;
  loading: boolean;
  message: string;
  emailValid: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
            <View style={styles.modalHeaderText}>
              <Text style={styles.eyebrow}>استعادة الوصول</Text>
              <Text style={styles.modalTitle}>إعادة تعيين كلمة المرور</Text>
              <Text style={styles.modalNote}>أدخل بريدك الإلكتروني لتسجيل طلب الاستعادة. إرسال الرابط الفعلي يحتاج تفعيل خدمة البريد في الخادم.</Text>
            </View>
          </View>
          <AuthField
            label="البريد الإلكتروني"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            icon="mail-outline"
            keyboardType="email-address"
            ltr
            hint={email ? (emailValid ? 'سيتم استخدام هذا البريد لإرسال رابط الاستعادة.' : 'تأكد من كتابة بريد إلكتروني صحيح.') : undefined}
            hintTone={emailValid ? 'success' : 'warning'}
          />
          {message ? <Message tone={message.startsWith('تم') ? 'success' : 'error'} text={message} /> : null}
          <View style={styles.modalActions}>
            <Pressable disabled={loading} onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>إلغاء</Text>
            </Pressable>
            <Pressable disabled={loading || !emailValid} onPress={onSubmit} style={[styles.modalSubmit, (!emailValid || loading) && styles.primaryButtonDisabled]}>
              {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="paper-plane-outline" size={16} color="#fff" />}
              <Text style={styles.primaryButtonText}>إرسال الرابط</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  topHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  brandCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  brandText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  brandName: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'right',
  },
  brandSub: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'right',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 34,
    marginTop: 18,
    textAlign: 'right',
  },
  heroText: {
    color: '#e4e7ec',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'right',
  },
  valueList: {
    gap: 8,
    marginTop: 16,
  },
  valueRail: {
    gap: 7,
    marginBottom: 12,
  },
  valuePill: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  valuePillText: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  valueItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 11,
  },
  valueNumber: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '900',
  },
  valueText: {
    color: '#fff',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'right',
  },
  trustGrid: {
    gap: 8,
    marginTop: 12,
  },
  trustCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 11,
  },
  trustTextWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  trustTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  trustText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'right',
  },
  panel: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 13,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  panelIcon: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  panelHeaderText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  eyebrow: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'right',
  },
  panelNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 5,
    textAlign: 'right',
  },
  modeSwitch: {
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 4,
    marginTop: 13,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.paper,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: colors.navy,
  },
  utilitySwitch: {
    backgroundColor: colors.surface,
    borderColor: colors.tint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 10,
    padding: 5,
  },
  miniSegment: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    justifyContent: 'center',
    minHeight: 36,
  },
  miniSegmentActive: {
    backgroundColor: colors.navy,
  },
  miniSegmentText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  miniSegmentTextActive: {
    color: '#fff',
  },
  form: {
    gap: 11,
    marginTop: 12,
  },
  infoBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 12,
  },
  infoTextWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  infoTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  infoText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'right',
  },
  loadingBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 8,
    padding: 16,
  },
  loadingText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
  demoBox: {
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  demoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  demoMuted: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  demoTitle: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
  },
  demoGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
  demoButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    flexGrow: 1,
    justifyContent: 'center',
    minWidth: 96,
    padding: 10,
  },
  demoText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 7,
    textAlign: 'right',
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 48,
  },
  inputLtr: {
    writingDirection: 'ltr',
  },
  inputAction: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  fieldHint: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'right',
  },
  passwordBox: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  strengthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '900',
  },
  strengthTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  strengthBar: {
    flexDirection: 'row-reverse',
    gap: 5,
    marginTop: 10,
  },
  strengthStep: {
    borderRadius: 999,
    flex: 1,
    height: 7,
  },
  requirementsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  checkChip: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  checkChipMet: {
    backgroundColor: colors.greenTint,
  },
  checkChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  checkChipTextMet: {
    color: colors.green,
  },
  roleGrid: {
    gap: 8,
  },
  roleCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 12,
  },
  roleCardActive: {
    backgroundColor: colors.blueTint,
    borderColor: colors.navy,
  },
  roleIcon: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  roleIconActive: {
    backgroundColor: colors.navy,
  },
  roleTextWrap: {
    alignItems: 'flex-end',
    flex: 1,
  },
  roleTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  roleTitleActive: {
    color: colors.navy,
  },
  roleText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'right',
  },
  noteBox: {
    backgroundColor: colors.goldTint,
    borderColor: '#f6d084',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  noteTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  noteText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'right',
  },
  checklistBox: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  checklistHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  checklistCount: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  checklistTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  loginTools: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  rememberButton: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  rememberText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  forgotText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  destination: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  message: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    padding: 11,
  },
  messageError: {
    backgroundColor: colors.redTint,
    borderColor: '#f7b4af',
  },
  messageSuccess: {
    backgroundColor: colors.greenTint,
    borderColor: '#b7ebc6',
  },
  messageText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'right',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,24,40,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    gap: 12,
    padding: 16,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalHeaderText: {
    alignItems: 'flex-end',
    flex: 1,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'right',
  },
  modalNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  modalSubmit: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },
});
