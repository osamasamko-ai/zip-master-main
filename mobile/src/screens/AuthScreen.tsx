import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { AuthUser, Role } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Mode = 'login' | 'register';
type RecentAuthAccount = {
  email: string;
  name: string;
  role?: string;
  img?: string;
  lastLoginAt: string;
};

const DEMO_ACCOUNTS = [
  { label: 'عميل', email: 'user@example.com', password: 'password123', icon: 'person-outline' as const },
  { label: 'محامي', email: 'lawyer@example.com', password: 'password123', icon: 'briefcase-outline' as const },
  { label: 'مدير', email: 'admin@example.com', password: 'password123', icon: 'shield-outline' as const },
];

const RECENT_AUTH_ACCOUNTS_KEY = 'recentAuthAccounts';
const REMEMBERED_EMAIL_KEY = 'rememberedEmail';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isProfessionalRole(role?: string | null) {
  return role === 'pro' || role === 'lawyer';
}

function getRoleLabel(role?: string | null) {
  if (role === 'admin') return 'مدير المنصة';
  if (isProfessionalRole(role)) return 'محامي';
  return 'عميل';
}

function getAccountInitials(account: RecentAuthAccount) {
  const source = account.name || account.email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function toRecentAccount(user: AuthUser, fallbackEmail: string, fallbackName?: string): RecentAuthAccount {
  return {
    email: user.email || fallbackEmail,
    name: user.name || fallbackName || user.email || fallbackEmail,
    role: user.role,
    img: user.img || user.avatar,
    lastLoginAt: new Date().toISOString(),
  };
}

async function readRecentAccounts() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_AUTH_ACCOUNTS_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 4) as RecentAuthAccount[] : [];
  } catch {
    return [];
  }
}

async function writeRecentAccount(account: RecentAuthAccount) {
  const current = await readRecentAccounts();
  const next = [account, ...current.filter((item) => item.email !== account.email)].slice(0, 4);
  await AsyncStorage.setItem(RECENT_AUTH_ACCOUNTS_KEY, JSON.stringify(next));
  return next;
}

export function AuthScreen() {
  const { login, register, isLoading, error } = useAuth();
  const passwordInputRef = useRef<TextInput | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [documentId, setDocumentId] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [recentAccounts, setRecentAccounts] = useState<RecentAuthAccount[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(REMEMBERED_EMAIL_KEY), readRecentAccounts()]).then(([savedEmail, accounts]) => {
      if (!mounted) return;
      if (savedEmail) setEmail(savedEmail);
      setRecentAccounts(accounts);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const emailValue = normalizeEmail(email);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const passwordScore = useMemo(() => {
    if (!password) return 0;
    return [
      password.length >= 8,
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
  }, [password]);
  const isRegister = mode === 'register';
  const canSubmit = isRegister
    ? name.trim().length > 1 && emailValid && passwordScore >= 2 && password === confirmPassword
    : emailValid && password.length > 0;
  const authInsight = useMemo(() => {
    if (isRegister) {
      if (role === 'pro') {
        return {
          icon: 'briefcase-outline' as const,
          title: 'مسار محامي ذكي',
          text: 'بعد التسجيل ستدخل إلى مكتبي لإدارة القضايا، ويمكنك إكمال بيانات الترخيص لاحقاً.',
          tone: 'blue' as const,
        };
      }
      return {
        icon: 'folder-open-outline' as const,
        title: 'مسار عميل واضح',
        text: 'سنجهز لك لوحة العميل للبحث عن محام، فتح قضية، أو متابعة الرسائل.',
        tone: 'cyan' as const,
      };
    }

    const matchedAccount = recentAccounts.find((account) => account.email === emailValue);
    if (matchedAccount) {
      return {
        icon: 'time-outline' as const,
        title: `مرحباً بعودتك يا ${matchedAccount.name.split(' ')[0] || matchedAccount.name}`,
        text: `هذا حساب ${getRoleLabel(matchedAccount.role)} محفوظ على هذا الجهاز. أدخل كلمة المرور فقط.`,
        tone: 'green' as const,
      };
    }

    return {
      icon: 'sparkles-outline' as const,
      title: 'دخول ذكي',
      text: 'اختر حساباً محفوظاً أو اكتب بريدك، وسنوجهك تلقائياً حسب دورك بعد الدخول.',
      tone: 'gold' as const,
    };
  }, [emailValue, isRegister, recentAccounts, role]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setLocalError('');
    setConfirmPassword('');
  };

  const fillDemo = (demo: (typeof DEMO_ACCOUNTS)[number]) => {
    switchMode('login');
    setEmail(demo.email);
    setPassword(demo.password);
  };

  const selectRecentAccount = async (account: RecentAuthAccount) => {
    switchMode('login');
    setEmail(account.email);
    setPassword('');
    await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, account.email);
    requestAnimationFrame(() => passwordInputRef.current?.focus());
  };

  const forgetRecentAccount = async (emailToRemove: string) => {
    const next = recentAccounts.filter((account) => account.email !== emailToRemove);
    setRecentAccounts(next);
    await AsyncStorage.setItem(RECENT_AUTH_ACCOUNTS_KEY, JSON.stringify(next));
    if (emailValue === emailToRemove) {
      setEmail('');
      setPassword('');
      await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  };

  const submit = async () => {
    setLocalError('');
    if (!canSubmit) {
      setLocalError(isRegister ? 'أكمل البيانات الأساسية وتأكد من تطابق كلمة المرور.' : 'أدخل بريدك وكلمة المرور.');
      return;
    }

    if (isRegister) {
      try {
        const registeredUser = await register(emailValue, password, name.trim(), role);
        setRecentAccounts(await writeRecentAccount(toRecentAccount(registeredUser, emailValue, name.trim())));
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.');
      }
      return;
    }

    try {
      const loggedInUser = await login(emailValue, password);
      setRecentAccounts(await writeRecentAccount(toRecentAccount(loggedInUser, emailValue)));
      await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, loggedInUser.email || emailValue);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    }
  };

  const sendForgot = () => {
    const value = normalizeEmail(forgotEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setForgotMessage('اكتب بريداً صحيحاً.');
      return;
    }
    setForgotMessage(`تم تسجيل طلب الاستعادة للبريد ${value}.`);
  };

  const verifyDocument = () => {
    if (!documentId.trim()) return;
    setVerifyMessage(`تم تجهيز طلب التحقق للمستند ${documentId.trim()}.`);
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.logo}>
              <FontAwesome5 name="balance-scale" size={23} color={colors.gold} />
            </View>
            <Text style={styles.title}>القسطاس</Text>
            <Text style={styles.brandSubtitle}>Smart Legal Platform</Text>
            <Text style={styles.subtitle}>ادخل لحسابك وتابع القضايا، الرسائل، والمستندات من مكان واحد.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.modeSwitch}>
              <Segment label="دخول" selected={mode === 'login'} onPress={() => switchMode('login')} />
              <Segment label="حساب جديد" selected={mode === 'register'} onPress={() => switchMode('register')} />
            </View>

            <Text style={styles.cardTitle}>{isRegister ? 'إنشاء حساب' : 'تسجيل الدخول'}</Text>
            <Text style={styles.cardNote}>{isRegister ? 'نحتاج فقط البيانات المهمة لفتح حسابك.' : 'استخدم بريدك وكلمة المرور للمتابعة.'}</Text>

            <View
              style={[
                styles.insightCard,
                authInsight.tone === 'green' ? styles.greenInsight : authInsight.tone === 'blue' ? styles.blueInsight : authInsight.tone === 'cyan' ? styles.cyanInsight : styles.goldInsight,
              ]}
            >
              <View style={styles.insightIcon}>
                <Ionicons name={authInsight.icon} size={18} color={colors.blue} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.insightTitle}>{authInsight.title}</Text>
                <Text style={styles.insightText}>{authInsight.text}</Text>
              </View>
            </View>

            {(localError || error) ? <Message type="error" text={localError || error} /> : null}

            {!isRegister && recentAccounts.length > 0 ? (
              <View style={styles.recentBlock}>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentHint}>مثل فيسبوك</Text>
                  <Text style={styles.recentTitle}>العودة لحساب محفوظ</Text>
                </View>
                {recentAccounts.map((account) => (
                  <View key={account.email} style={styles.recentCard}>
                    <Pressable onPress={() => forgetRecentAccount(account.email)} style={styles.removeAccount} hitSlop={8}>
                      <Ionicons name="close" size={15} color={colors.subtle} />
                    </Pressable>
                    <Pressable onPress={() => selectRecentAccount(account)} style={styles.recentMain}>
                      {account.img ? (
                        <Image source={{ uri: account.img }} style={styles.recentAvatar} />
                      ) : (
                        <View style={styles.recentAvatarFallback}>
                          <Text style={styles.recentInitials}>{getAccountInitials(account)}</Text>
                        </View>
                      )}
                      <View style={styles.flex}>
                        <Text style={styles.recentName} numberOfLines={1}>{account.name}</Text>
                        <Text style={styles.recentEmail} numberOfLines={1}>{account.email}</Text>
                        <Text style={styles.recentRole}>{getRoleLabel(account.role)}</Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
                <Text style={styles.recentPrivacy}>نحفظ الحساب فقط على هذا الجهاز لتسريع الرجوع، وكلمة المرور لا يتم حفظها.</Text>
              </View>
            ) : null}

            {isRegister ? (
              <Field label="الاسم الكامل" value={name} onChangeText={setName} placeholder="اسمك الكامل" icon="person-outline" />
            ) : null}

            <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="name@example.com" icon="mail-outline" keyboardType="email-address" ltr />

            <Field
              label="كلمة المرور"
              value={password}
              onChangeText={setPassword}
              placeholder="كلمة المرور"
              icon="lock-closed-outline"
              inputRef={!isRegister ? passwordInputRef : undefined}
              secureTextEntry={!showPassword}
              actionIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onAction={() => setShowPassword((current) => !current)}
            />

            {isRegister ? (
              <>
                <View style={styles.strengthRow}>
                  {[1, 2, 3, 4].map((step) => (
                    <View key={step} style={[styles.strengthStep, passwordScore >= step && styles.strengthStepOn]} />
                  ))}
                </View>
                <Field label="تأكيد كلمة المرور" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="أعد كتابة كلمة المرور" icon="checkmark-circle-outline" secureTextEntry />
                <View style={styles.roleRow}>
                  <RoleButton label="عميل" icon="person-outline" active={role === 'user'} onPress={() => setRole('user')} />
                  <RoleButton label="محامي" icon="briefcase-outline" active={role === 'pro'} onPress={() => setRole('pro')} />
                </View>
              </>
            ) : null}

            <Pressable disabled={!canSubmit || isLoading} onPress={submit} style={[styles.primaryButton, (!canSubmit || isLoading) && styles.disabled]}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Ionicons name={isRegister ? 'person-add-outline' : 'log-in-outline'} size={18} color="#fff" />}
              <Text style={styles.primaryText}>{isRegister ? 'فتح الحساب' : 'دخول'}</Text>
            </Pressable>

            {!isRegister ? (
              <>
                <Pressable onPress={() => setForgotOpen(true)} style={styles.linkButton}>
                  <Text style={styles.linkText}>نسيت كلمة المرور؟</Text>
                </Pressable>
                <View style={styles.demoRow}>
                  {DEMO_ACCOUNTS.map((demo) => (
                    <Pressable key={demo.email} onPress={() => fillDemo(demo)} style={styles.demoButton}>
                      <Ionicons name={demo.icon} size={15} color={colors.blue} />
                      <Text style={styles.demoText}>{demo.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>

          <Pressable onPress={() => setVerifyOpen(true)} style={styles.verifyCard}>
            <View style={styles.verifyIcon}>
              <Ionicons name="qr-code-outline" size={20} color={colors.blue} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.verifyTitle}>تحقق من مستند</Text>
              <Text style={styles.verifyText}>افحص رقم عقد أو مستند دون تسجيل دخول.</Text>
            </View>
            <Ionicons name="chevron-back-outline" size={18} color={colors.muted} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <SimpleModal visible={forgotOpen} title="استعادة كلمة المرور" onClose={() => setForgotOpen(false)}>
        <Field label="البريد الإلكتروني" value={forgotEmail} onChangeText={(value) => { setForgotEmail(value); setForgotMessage(''); }} placeholder="name@example.com" icon="mail-outline" keyboardType="email-address" ltr />
        {forgotMessage ? <Message type={forgotMessage.startsWith('تم') ? 'success' : 'error'} text={forgotMessage} /> : null}
        <Pressable onPress={sendForgot} style={styles.primaryButton}>
          <Ionicons name="paper-plane-outline" size={17} color="#fff" />
          <Text style={styles.primaryText}>إرسال الطلب</Text>
        </Pressable>
      </SimpleModal>

      <SimpleModal visible={verifyOpen} title="التحقق من مستند" onClose={() => setVerifyOpen(false)}>
        <Field label="رقم المستند" value={documentId} onChangeText={(value) => { setDocumentId(value); setVerifyMessage(''); }} placeholder="مثال: contract-123" icon="qr-code-outline" />
        {verifyMessage ? <Message type="success" text={verifyMessage} /> : null}
        <Pressable disabled={!documentId.trim()} onPress={verifyDocument} style={[styles.primaryButton, !documentId.trim() && styles.disabled]}>
          <Ionicons name="shield-checkmark-outline" size={17} color="#fff" />
          <Text style={styles.primaryText}>تحقق الآن</Text>
        </Pressable>
      </SimpleModal>
    </View>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, selected && styles.segmentActive]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  secureTextEntry,
  actionIcon,
  onAction,
  inputRef,
  ltr,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'email-address' | 'default';
  secureTextEntry?: boolean;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  inputRef?: React.Ref<TextInput>;
  ltr?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color={colors.subtle} />
        <TextInput
          autoCapitalize="none"
          autoComplete={secureTextEntry ? 'password' : keyboardType === 'email-address' ? 'email' : undefined}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          ref={inputRef}
          secureTextEntry={secureTextEntry}
          style={[styles.input, ltr && styles.inputLtr]}
          textAlign={ltr ? 'left' : 'right'}
          value={value}
        />
        {actionIcon ? (
          <Pressable onPress={onAction} style={styles.iconButton}>
            <Ionicons name={actionIcon} size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function RoleButton({ label, icon, active, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.roleButton, active && styles.roleButtonActive]}>
      <Ionicons name={icon} size={17} color={active ? '#fff' : colors.blue} />
      <Text style={[styles.roleText, active && styles.roleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Message({ type, text }: { type: 'error' | 'success'; text: string }) {
  const success = type === 'success';
  return (
    <View style={[styles.message, success ? styles.messageSuccess : styles.messageError]}>
      <Ionicons name={success ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={18} color={success ? colors.green : colors.red} />
      <Text style={[styles.messageText, { color: success ? colors.green : colors.red }]}>{text}</Text>
    </View>
  );
}

function SimpleModal({ visible, title, children, onClose }: { visible: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
            <Text style={styles.sheetTitle}>{title}</Text>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.backdrop,
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
  },
  cardNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 14,
    marginTop: 4,
    textAlign: 'right',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  demoButton: {
    alignItems: 'center',
    backgroundColor: colors.blueTint,
    borderRadius: 8,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 44,
  },
  demoRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  demoText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.45,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  flex: {
    flex: 1,
  },
  blueInsight: {
    backgroundColor: colors.blueTint,
    borderColor: 'rgba(58, 80, 107, 0.16)',
  },
  cyanInsight: {
    backgroundColor: '#ecfeff',
    borderColor: 'rgba(8, 145, 178, 0.18)',
  },
  goldInsight: {
    backgroundColor: colors.goldTint,
    borderColor: 'rgba(197, 160, 89, 0.24)',
  },
  greenInsight: {
    backgroundColor: colors.greenTint,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 44,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 16,
    paddingTop: 12,
  },
  iconButton: {
    padding: 6,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 8,
  },
  inputLtr: {
    writingDirection: 'ltr',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    paddingHorizontal: 11,
  },
  insightCard: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 12,
    padding: 11,
  },
  insightIcon: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  insightText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'right',
  },
  insightTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  keyboard: {
    flex: 1,
  },
  label: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
    textAlign: 'right',
  },
  linkButton: {
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    width: 54,
  },
  brandSubtitle: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  message: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
    padding: 10,
  },
  messageError: {
    backgroundColor: colors.redTint,
    borderColor: '#f7b4af',
  },
  messageSuccess: {
    backgroundColor: colors.greenTint,
    borderColor: '#bdebd7',
  },
  messageText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 19,
    textAlign: 'right',
  },
  modeSwitch: {
    backgroundColor: colors.tint,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 4,
    marginBottom: 16,
    padding: 4,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  recentAvatar: {
    backgroundColor: colors.blueTint,
    borderRadius: 12,
    height: 48,
    width: 48,
  },
  recentAvatarFallback: {
    alignItems: 'center',
    backgroundColor: colors.navySoft,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  recentBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 10,
  },
  recentCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  recentEmail: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  recentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recentHint: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: '900',
  },
  recentInitials: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  recentMain: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    minHeight: 68,
    padding: 9,
    paddingLeft: 42,
  },
  recentName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  recentPrivacy: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 17,
    textAlign: 'right',
  },
  recentRole: {
    alignSelf: 'flex-end',
    backgroundColor: colors.blueTint,
    borderRadius: 999,
    color: colors.blue,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recentTitle: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '900',
  },
  removeAccount: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    left: 8,
    position: 'absolute',
    top: 8,
    width: 30,
    zIndex: 2,
  },
  roleButton: {
    alignItems: 'center',
    backgroundColor: colors.blueTint,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },
  roleButtonActive: {
    backgroundColor: colors.blue,
  },
  roleRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
  },
  roleText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  roleTextActive: {
    color: '#fff',
  },
  screen: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 40,
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
    color: colors.blue,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  strengthRow: {
    flexDirection: 'row-reverse',
    gap: 5,
    marginBottom: 12,
  },
  strengthStep: {
    backgroundColor: colors.line,
    borderRadius: 999,
    flex: 1,
    height: 5,
  },
  strengthStepOn: {
    backgroundColor: colors.green,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 21,
    maxWidth: 310,
    textAlign: 'center',
  },
  title: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: '900',
    marginBottom: 5,
  },
  verifyCard: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 12,
    padding: 13,
  },
  verifyIcon: {
    alignItems: 'center',
    backgroundColor: colors.blueTint,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  verifyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
  verifyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
});
