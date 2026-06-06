import { prisma } from './prisma';
import { hashPassword, verifyPassword } from './auth';
import { getLegalServices } from './adminData';

const USER_DASHBOARD_SERVICES = [
  {
    id: 'srv-1',
    title: 'تأسيس شركة محدودة',
    description: 'صياغة عقد التأسيس، مراجعة السجل التجاري، والحصول على شهادة التسجيل النهائية.',
    icon: 'fa-solid fa-building-circle-check',
    price: '750,000 د.ع',
    time: '14 - 21 يوم',
    color: 'indigo',
    category: 'تجاري',
    lawyerId: null,
    lawyerName: 'فريق القسطاس',
    lawyerSpecialty: 'خدمات شركات',
  },
  {
    id: 'srv-2',
    title: 'تسجيل علامة تجارية',
    description: 'حماية هويتك البصرية، فحص التشابه، وإيداع طلب التسجيل في وزارة الصناعة.',
    icon: 'fa-solid fa-copyright',
    price: '450,000 د.ع',
    time: '30 - 60 يوم',
    color: 'rose',
    category: 'ملكية فكرية',
    lawyerId: null,
    lawyerName: 'فريق القسطاس',
    lawyerSpecialty: 'ملكية فكرية',
  },
  {
    id: 'srv-3',
    title: 'توثيق عقد عقاري',
    description: 'مراجعة سند الملكية، صياغة اتفاقية البيع، وتوثيق الإجراءات أمام كاتب العدل.',
    icon: 'fa-solid fa-house-shield',
    price: '250,000 د.ع',
    time: '3 - 5 أيام',
    color: 'amber',
    category: 'عقارات',
    lawyerId: null,
    lawyerName: 'فريق القسطاس',
    lawyerSpecialty: 'عقارات',
  },
  {
    id: 'srv-4',
    title: 'مراجعة العقود والاتفاقيات',
    description: 'تحليل المخاطر القانونية، تعديل البنود المجحفة، وضمان الامتثال للقوانين العراقية.',
    icon: 'fa-solid fa-file-signature',
    price: '100,000 د.ع',
    time: '48 ساعة',
    color: 'blue',
    category: 'استشارات',
    lawyerId: null,
    lawyerName: 'فريق القسطاس',
    lawyerSpecialty: 'مراجعة عقود',
  },
  {
    id: 'srv-5',
    title: 'عقد بيع وشراء مركبة',
    description: 'توليد عقد بيع قانوني متكامل يتضمن كافة تفاصيل المركبة، الثمن، وشروط الضمان وفق القانون العراقي.',
    icon: 'fa-solid fa-car-side',
    price: '25,000 د.ع',
    time: 'فوري (AI)',
    color: 'emerald',
    category: 'عقود',
    lawyerId: null,
    lawyerName: 'فريق القسطاس',
    lawyerSpecialty: 'توليد عقود',
  },
];
const CONTRACT_CREATION_FEE = 25000; // رسوم ثابتة لإنشاء العقد
const PROMO_CODE_DISCOUNT = 10000; // خصم ثابت لكود الخصم

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatRelativeDate(date: Date) {
  return new Intl.DateTimeFormat('ar-IQ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatConsultationFee(value?: string | null) {
  const digitsOnly = String(value || '').replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return 'غير محدد';
  }

  return `${Number(digitsOnly).toLocaleString('en-US')} د.ع`;
}

function normalizeConsultationFee(value?: string | null) {
  const digitsOnly = String(value || '').replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return '';
  }

  return `${Number(digitsOnly).toLocaleString('en-US')} د.ع`;
}

function normalizeHighlights(value: unknown) {
  const items = Array.isArray(value)
    ? value
    : String(value || '').split(/\n|،|,/);

  return JSON.stringify(
    items
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 12)
  );
}

function parseMoney(value?: string | number | null) {
  const numericValue = typeof value === 'number' ? value : Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function parseResponseMinutes(value?: string | null) {
  const text = String(value || '');
  const number = Number(text.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(number) || number <= 0) return 90;
  if (text.includes('ساعة')) return number * 60;
  return number;
}

function normalizeMatchText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function includesMatch(source?: string | null, target?: string | null) {
  const left = normalizeMatchText(source);
  const right = normalizeMatchText(target);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

type LawyerMatchContext = {
  city?: string;
  caseType?: string;
  budget?: number;
};

type LawyerAcceptanceStats = {
  total: number;
  accepted: number;
  similarTotal: number;
  similarAccepted: number;
};

function calculateLawyerMatch(user: any, context: LawyerMatchContext, acceptanceStats?: LawyerAcceptanceStats) {
  const profile = user.lawyerProfile;
  const reasons: string[] = [];
  let score = 0;

  if (context.city && includesMatch(user.location, context.city)) {
    score += 20;
    reasons.push('نفس المدينة');
  } else if (context.city) {
    reasons.push('مدينة مختلفة');
  }

  if (context.caseType && includesMatch(profile?.specialty, context.caseType)) {
    score += 25;
    reasons.push('مناسب لنوع القضية');
  } else if (context.caseType) {
    reasons.push('تخصص قريب يحتاج مراجعة');
  }

  const fee = parseMoney(profile?.consultationFee);
  if (context.budget && fee > 0) {
    if (fee <= context.budget) {
      score += 15;
      reasons.push('ضمن ميزانيتك');
    } else if (fee <= context.budget * 1.25) {
      score += 8;
      reasons.push('قريب من الميزانية');
    } else {
      reasons.push('أعلى من الميزانية');
    }
  }

  const responseMinutes = parseResponseMinutes(profile?.responseTime);
  if (profile?.isOnline || responseMinutes <= 30) {
    score += 15;
    reasons.push('رد سريع');
  } else if (responseMinutes <= 60) {
    score += 10;
    reasons.push('رد خلال ساعة');
  } else {
    score += 5;
  }

  const similarTotal = acceptanceStats?.similarTotal || 0;
  const similarAccepted = acceptanceStats?.similarAccepted || 0;
  const total = acceptanceStats?.total || 0;
  const accepted = acceptanceStats?.accepted || 0;
  const similarAcceptanceRate = similarTotal > 0 ? Math.round((similarAccepted / similarTotal) * 100) : total > 0 ? Math.round((accepted / total) * 100) : 0;
  if (similarAcceptanceRate >= 70) {
    score += 15;
    reasons.push('قبول عال للقضايا المشابهة');
  } else if (similarAcceptanceRate >= 40) {
    score += 10;
    reasons.push('قبول جيد للقضايا المشابهة');
  } else if (similarAcceptanceRate > 0) {
    score += 5;
  }

  score += Math.min(10, Math.round(((profile?.rating || 0) / 5) * 6) + (user.verified ? 4 : 0));
  if (user.verified) reasons.push('محام موثق');

  return {
    matchScore: Math.max(0, Math.min(100, score)),
    matchReasons: reasons.slice(0, 6),
    responseMinutes,
    similarAcceptanceRate,
    budgetFit: context.budget && fee > 0 ? fee <= context.budget : null,
  };
}

function normalizeExperienceYears(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(60, Math.round(numericValue)));
}

function buildLawyerCard(user: any, followerCount: number, reviewCount: number, isFollowing = false, matchContext: LawyerMatchContext = {}, acceptanceStats?: LawyerAcceptanceStats) {
  const profile = user.lawyerProfile;
  const match = calculateLawyerMatch(user, matchContext, acceptanceStats);
  const role = user.role || 'user';
  const isProfessional = role === 'pro';
  const isAdmin = role === 'admin';
  const roleLabel = isProfessional ? (profile?.specialty || 'محامٍ') : isAdmin ? 'إدارة المنصة' : 'مستخدم';
  const defaultBio = isProfessional
    ? 'ملف قانوني مهني قيد التطوير.'
    : isAdmin
      ? 'ملف إداري موثق يعرض نشاط الحساب ودوره داخل المنصة.'
      : 'ملف شخصي يعرض نشاط المستخدم وتفاعله داخل المنصة.';
  const fallbackHighlights = isProfessional
    ? [profile?.specialty, user.roleDescription, 'استشارات قانونية'].filter(Boolean)
    : isAdmin
      ? ['إدارة المنصة', 'متابعة الجودة', 'دعم المستخدمين']
      : ['عضو في المنصة', 'متابعة القضايا', 'تواصل قانوني'];

  return {
    id: user.id,
    name: user.name,
    role,
    isProfessional,
    specialty: roleLabel,
    location: user.location || 'العراق',
    experience: isProfessional ? `${profile?.experienceYears || 0} سنوات خبرة` : `عضو منذ ${formatRelativeDate(user.createdAt)}`,
    experienceYears: profile?.experienceYears || 0,
    availability: isProfessional ? (profile?.availability || 'متاح حسب الجدول') : 'حساب نشط',
    isOnline: profile?.isOnline || role === 'admin',
    rating: profile?.rating || 0,
    reviews: `${reviewCount} مراجعة`,
    reviewCount,
    casesHandled: isProfessional ? `+${profile?.openCases || 0} قضية` : `${user._count?.feedPosts || 0} منشور`,
    consultationFee: isProfessional ? formatConsultationFee(profile?.consultationFee) : 'غير متاح',
    verified: user.verified,
    accent: profile?.accent || (isAdmin ? 'from-slate-950 via-brand-dark to-brand-navy' : 'from-brand-navy via-blue-900 to-slate-950'),
    avatar: user.img || profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0d2a59&color=ffffff&rounded=true&font-size=0.4`,
    coverImage: profile?.coverImage || '',
    tagline: profile?.tagline || user.roleDescription || (isProfessional ? 'استشارات قانونية مهنية' : isAdmin ? 'إدارة وتشغيل المنصة' : 'عضو في منصة القسطاس'),
    followers: followerCount,
    responseTime: isProfessional ? (profile?.responseTime || 'يرد خلال ساعة') : 'نشاط داخل المنصة',
    responseMinutes: match.responseMinutes,
    matchScore: match.matchScore,
    matchReasons: match.matchReasons,
    similarAcceptanceRate: match.similarAcceptanceRate,
    budgetFit: match.budgetFit,
    bio: profile?.bio || defaultBio,
    highlights: parseJsonArray(profile?.highlights).length ? parseJsonArray(profile?.highlights) : fallbackHighlights,
    license: isProfessional ? (profile?.licenseNumber || 'غير مضاف') : user.id.slice(0, 8).toUpperCase(),
    attachments: isProfessional ? ['هوية نقابية', 'رخصة ممارسة', 'اعتماد'] : ['هوية الحساب', 'نشاط المنصة', 'إعدادات الأمان'],
    status: isProfessional
      ? profile?.licenseStatus === 'verified' ? 'approved' : profile?.licenseStatus === 'rejected' ? 'rejected' : 'pending'
      : user.verified ? 'approved' : 'pending',
    submittedAt: profile?.submittedAt || formatRelativeDate(user.createdAt),
    profileScore: profile?.profileScore || (user.verified ? 85 : 45),
    isFollowing,
  };
}

function getRelatedCount(item: any, key: 'followers' | 'reviewsReceived') {
  if (typeof item?._count?.[key] === 'number') {
    return item._count[key];
  }

  const relation = item?.[key];
  return Array.isArray(relation) ? relation.length : 0;
}

const lawyerProfileCardSelect = {
  licenseNumber: true,
  specialty: true,
  experienceYears: true,
  avatar: true,
  coverImage: true,
  tagline: true,
  availability: true,
  isOnline: true,
  consultationFee: true,
  accent: true,
  responseTime: true,
  bio: true,
  highlights: true,
  rating: true,
  openCases: true,
  licenseStatus: true,
  submittedAt: true,
  profileScore: true,
} as const;

export async function getCurrentUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { lawyerProfile: true },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    company: user.company || (user.role === 'pro' ? 'مكتب محاماة' : 'حساب فردي'),
    language: user.language || 'العربية',
    location: user.location || '',
    img: user.img || '',
    avatar: user.img || user.lawyerProfile?.avatar || '',
    verified: user.verified,
    subscriptionTier: user.subscriptionTier,
    accountBalance: user.accountBalance,
    notificationsEnabled: user.notificationsEnabled,
    twoFactor: user.twoFactorEnabled,
    emailAlerts: user.emailAlerts,
    pushNotifications: user.pushNotifications,
    billingReminders: user.billingReminders,
    securityAlerts: user.securityAlerts,
    marketingEmails: user.marketingEmails,
    roleDescription: user.roleDescription || '',
    tagline: user.lawyerProfile?.tagline || '',
    bio: user.lawyerProfile?.bio || '',
    specialty: user.lawyerProfile?.specialty || '',
    experienceYears: user.lawyerProfile?.experienceYears || 0,
    highlights: parseJsonArray(user.lawyerProfile?.highlights),
    consultationFee: normalizeConsultationFee(user.lawyerProfile?.consultationFee),
    nationalIdUrl: user.lawyerProfile?.nationalIdUrl || '',
    nationalIdVerified: user.lawyerProfile?.nationalIdVerified || false,
    lawyerLicenseUrl: user.lawyerProfile?.lawyerLicenseUrl || '',
    lawyerLicenseVerified: user.lawyerProfile?.lawyerLicenseVerified || false,
  };
}

export async function updateCurrentUserProfile(userId: string, updates: Record<string, any>) {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!existingUser) {
    return null;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: updates.name,
      phone: updates.phone,
      company: updates.company,
      language: updates.language,
      location: updates.location,
      img: updates.img,
      roleDescription: updates.roleDescription,
    },
    include: { lawyerProfile: true },
  });

  if (existingUser.role === 'pro' || existingUser.role === 'admin') {
    await prisma.lawyerProfile.upsert({
      where: { userId },
      update: {
        tagline: updates.tagline,
        bio: updates.bio,
        specialty: updates.specialty,
        experienceYears: normalizeExperienceYears(updates.experienceYears),
        highlights: normalizeHighlights(updates.highlights),
        consultationFee: normalizeConsultationFee(updates.consultationFee),
      },
      create: {
        userId,
        tagline: updates.tagline,
        bio: updates.bio,
        specialty: updates.specialty,
        experienceYears: normalizeExperienceYears(updates.experienceYears),
        highlights: normalizeHighlights(updates.highlights),
        consultationFee: normalizeConsultationFee(updates.consultationFee),
      },
    });
  }

  return getCurrentUserProfile(user.id);
}

export async function updateCurrentUserPreferences(userId: string, updates: Record<string, any>) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: updates.twoFactor,
      notificationsEnabled: updates.emailAlerts || updates.pushNotifications || updates.billingReminders || updates.securityAlerts,
      emailAlerts: updates.emailAlerts,
      pushNotifications: updates.pushNotifications,
      billingReminders: updates.billingReminders,
      securityAlerts: updates.securityAlerts,
      marketingEmails: updates.marketingEmails,
      language: updates.language,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      title: 'تم تحديث التفضيلات',
      description: 'تم حفظ إعدادات الإشعارات والأمان للحساب.',
      type: 'system',
      timeLabel: 'الآن',
    },
  });

  return getCurrentUserProfile(userId);
}

export async function changeCurrentUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: 'User not found' };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: 'Current password is incorrect' };

  const nextHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: nextHash },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      title: 'تم تغيير كلمة المرور',
      description: 'اكتملت عملية تحديث كلمة المرور بنجاح.',
      type: 'security',
      timeLabel: 'الآن',
    },
  });

  return { ok: true };
}

export async function getUserSettingsBundle(userId: string) {
  const [profile, sessions, activityItems, invoices, documentUploads] = await Promise.all([
    getCurrentUserProfile(userId),
    prisma.userSession.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.upload.findMany({
      where: {
        ownerId: userId,
        resourceType: 'lawyer_profile',
        purpose: { in: ['national_id_front', 'national_id_back', 'lawyer_license_front', 'lawyer_license_back'] },
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const latestUploadUrl = (purpose: string) => documentUploads.find((item) => item.purpose === purpose)?.url || '';
  const profileWithDocumentSides = {
    ...profile,
    nationalIdFrontUrl: latestUploadUrl('national_id_front') || profile.nationalIdUrl || '',
    nationalIdBackUrl: latestUploadUrl('national_id_back'),
    lawyerLicenseFrontUrl: latestUploadUrl('lawyer_license_front') || profile.lawyerLicenseUrl || '',
    lawyerLicenseBackUrl: latestUploadUrl('lawyer_license_back'),
  };

  return {
    profile: profileWithDocumentSides,
    sessions: sessions.map((item) => ({
      id: item.id,
      device: item.device,
      location: item.location,
      lastSeen: item.lastSeen,
      current: item.current,
      ipAddress: item.ipAddress,
    })),
    activityItems: activityItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      time: item.timeLabel,
      type: item.type,
    })),
    invoices: invoices.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount,
      date: item.dateLabel,
      status: item.status,
    })),
  };
}

export async function revokeSession(userId: string, sessionId: string) {
  await prisma.userSession.deleteMany({
    where: { id: sessionId, userId },
  });
}

async function getLawyerAcceptanceStats(lawyerIds: string[], caseType?: string): Promise<Record<string, LawyerAcceptanceStats>> {
  if (lawyerIds.length === 0) return {};
  try {
    const placeholders = lawyerIds.map(() => '?').join(', ');
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        o."lawyerId" as lawyerId,
        COUNT(*) as total,
        SUM(CASE WHEN o.status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN LOWER(l.category) LIKE LOWER(?) THEN 1 ELSE 0 END) as similarTotal,
        SUM(CASE WHEN LOWER(l.category) LIKE LOWER(?) AND o.status = 'accepted' THEN 1 ELSE 0 END) as similarAccepted
      FROM "CaseMarketplaceOffer" o
      JOIN "CaseMarketplaceListing" l ON l.id = o."listingId"
      WHERE o."lawyerId" IN (${placeholders})
      GROUP BY o."lawyerId"
      `,
      `%${caseType || ''}%`,
      `%${caseType || ''}%`,
      ...lawyerIds,
    );
    return rows.reduce<Record<string, LawyerAcceptanceStats>>((acc, row) => {
      acc[row.lawyerId] = {
        total: Number(row.total || 0),
        accepted: Number(row.accepted || 0),
        similarTotal: caseType ? Number(row.similarTotal || 0) : Number(row.total || 0),
        similarAccepted: caseType ? Number(row.similarAccepted || 0) : Number(row.accepted || 0),
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export async function getLawyers(currentUserId?: string, search?: string, matchContext: LawyerMatchContext = {}) {
  const [lawyers, follows, currentUser] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { in: ['pro', 'admin'] },
        lawyerProfile: { isNot: null },
        ...(search
          ? {
            OR: [
              { name: { contains: search } },
              { location: { contains: search } },
              { lawyerProfile: { specialty: { contains: search } } },
            ],
          }
          : {}),
      },
      select: {
        id: true,
        name: true,
        role: true,
        location: true,
        verified: true,
        img: true,
        roleDescription: true,
        createdAt: true,
        lawyerProfile: {
          select: lawyerProfileCardSelect,
        },
        _count: {
          select: {
            followers: true,
            reviewsReceived: true,
          },
        },
      },
      orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
    }),
    currentUserId
      ? prisma.userFollow.findMany({ where: { followerId: currentUserId }, select: { lawyerId: true } })
      : Promise.resolve([]),
    currentUserId
      ? prisma.user.findUnique({ where: { id: currentUserId }, select: { location: true } })
      : Promise.resolve(null),
  ]);

  const followedSet = new Set(follows.map((item) => item.lawyerId));
  const effectiveContext = {
    ...matchContext,
    city: matchContext.city || currentUser?.location || '',
  };
  const acceptanceStats = await getLawyerAcceptanceStats(lawyers.map((item) => item.id), effectiveContext.caseType);
  return lawyers.map((user) =>
    buildLawyerCard(
      user,
      getRelatedCount(user, 'followers'),
      getRelatedCount(user, 'reviewsReceived'),
      followedSet.has(user.id),
      effectiveContext,
      acceptanceStats[user.id],
    ),
  ).sort((left, right) => (right.matchScore || 0) - (left.matchScore || 0));
}

export async function getFollowingLawyers(userId: string) {
  const following = await prisma.userFollow.findMany({
    where: { followerId: userId },
    select: {
      lawyerId: true,
      lawyer: {
        select: {
          id: true,
          name: true,
          location: true,
          verified: true,
          img: true,
          roleDescription: true,
          createdAt: true,
          lawyerProfile: {
            select: lawyerProfileCardSelect,
          },
          _count: {
            select: {
              followers: true,
              reviewsReceived: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return following.map((item: any) =>
    buildLawyerCard(
      item.lawyer,
      getRelatedCount(item.lawyer, 'followers'),
      getRelatedCount(item.lawyer, 'reviewsReceived'),
      true,
    ),
  );
}

export async function followLawyer(userId: string, lawyerId: string) {
  if (userId === lawyerId) {
    throw new Error('لا يمكنك متابعة نفسك');
  }

  const lawyer = await prisma.user.findFirst({
    where: {
      id: lawyerId,
      role: { in: ['pro', 'admin'] },
      lawyerProfile: { isNot: null },
    },
    select: { id: true },
  });

  if (!lawyer) {
    throw new Error('المحامي غير موجود');
  }

  await prisma.userFollow.upsert({
    where: {
      followerId_lawyerId: { followerId: userId, lawyerId },
    },
    update: {},
    create: { followerId: userId, lawyerId },
  });

  const followerCount = await prisma.userFollow.count({ where: { lawyerId } });
  return {
    lawyerId,
    isFollowing: true,
    followerCount,
  };
}

export async function unfollowLawyer(userId: string, lawyerId: string) {
  await prisma.userFollow.deleteMany({
    where: { followerId: userId, lawyerId },
  });

  const followerCount = await prisma.userFollow.count({ where: { lawyerId } });
  return {
    lawyerId,
    isFollowing: false,
    followerCount,
  };
}

export async function getLawyerProfile(lawyerId: string, currentUserId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: lawyerId },
    select: {
      id: true,
      name: true,
      location: true,
      verified: true,
      img: true,
      roleDescription: true,
      createdAt: true,
      lawyerProfile: {
        select: lawyerProfileCardSelect,
      },
      _count: {
        select: {
          followers: true,
          reviewsReceived: true,
          feedPosts: true,
        },
      },
      reviewsReceived: {
        select: {
          id: true,
          rating: true,
          text: true,
          createdAt: true,
          author: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      activityLogs: {
        select: {
          id: true,
          title: true,
          description: true,
          timeLabel: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      },
      feedPosts: {
        where: { status: 'published' },
        select: {
          id: true,
          content: true,
          category: true,
          mediaUrl: true,
          mediaType: true,
          pinned: true,
          featured: true,
          shareCount: true,
          createdAt: true,
          updatedAt: true,
          likes: { select: { userId: true } },
          saves: { select: { userId: true } },
          comments: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      },
      feedStories: {
        where: {
          status: 'active',
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          text: true,
          mediaUrl: true,
          mediaType: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          views: {
            select: {
              userId: true,
              viewedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      },
    },
  });

  if (!user) return null;

  const isFollowing = currentUserId
    ? (await prisma.userFollow.count({ where: { followerId: currentUserId, lawyerId } })) > 0
    : false;

  return {
    lawyer: buildLawyerCard(
      user,
      getRelatedCount(user, 'followers'),
      getRelatedCount(user, 'reviewsReceived'),
      isFollowing,
    ),
    reviews: user.reviewsReceived.map((review) => ({
      id: review.id,
      author: review.author.name,
      rating: review.rating,
      text: review.text,
      time: formatRelativeDate(review.createdAt),
    })),
    activity: user.activityLogs.map((item) => ({
      id: item.id,
      title: item.title,
      note: item.description,
      time: item.timeLabel,
    })),
    posts: user.feedPosts.map((post) => ({
      id: post.id,
      content: post.content,
      category: post.category,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      pinned: post.pinned,
      featured: post.featured,
      shareCount: post.shareCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likesCount: post.likes.length,
      savesCount: post.saves.length,
      commentsCount: post.comments.length,
      likedByMe: Boolean(currentUserId && post.likes.some((like) => like.userId === currentUserId)),
      savedByMe: Boolean(currentUserId && post.saves.some((save) => save.userId === currentUserId)),
    })),
    stories: user.feedStories.map((story) => {
      const viewed = currentUserId ? story.views.find((view) => view.userId === currentUserId) : null;
      return {
        id: story.id,
        text: story.text,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        status: story.status,
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
        seenByMe: Boolean(viewed),
        viewedAt: viewed?.viewedAt || null,
        isArchived: false,
      };
    }),
  };
}

export async function getUserDashboard(userId: string) {
  const [currentUser, cases, follows, lawyers, invoices, transactions, legalServices] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountBalance: true,
      },
    }),
    prisma.case.findMany({
      where: { clientId: userId, isArchived: false },
      select: {
        id: true,
        title: true,
        matter: true,
        progress: true,
        status: true,
        riskScore: true,
        unreadCount: true,
        updatedAt: true,
        lawyer: {
          select: {
            name: true,
            lawyerProfile: {
              select: {
                specialty: true,
              },
            },
          },
        },
        documents: {
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    prisma.userFollow.findMany({ where: { followerId: userId }, select: { lawyerId: true } }),
    prisma.user.findMany({
      where: { role: 'pro', lawyerProfile: { isNot: null } },
      select: {
        id: true,
        name: true,
        location: true,
        verified: true,
        img: true,
        roleDescription: true,
        createdAt: true,
        lawyerProfile: {
          select: lawyerProfileCardSelect,
        },
        _count: {
          select: {
            followers: true,
            reviewsReceived: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 8 }),
    getLegalServices(true),
  ]);

  const caseItems = cases.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.matter,
    progress: item.progress,
    status: item.status === 'closed' ? 'جاهزة' : item.status === 'review' ? 'قيد المراجعة' : item.status === 'pending' ? 'بانتظارك' : 'نشطة',
    urgency: item.riskScore >= 80 ? 'عالي' : item.riskScore >= 40 ? 'متوسط' : 'منخفض',
    nextStep: item.status === 'pending' ? 'إكمال البيانات والمرفقات المطلوبة' : 'متابعة الملف مع المحامي',
    lawyer: item.lawyer.name,
    deadline: formatRelativeDate(item.updatedAt),
    icon: 'fa-solid fa-scale-balanced',
    tone: item.riskScore >= 80 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600',
    milestones: [
      { id: `${item.id}-ms1`, label: 'فتح الملف', status: 'completed' },
      { id: `${item.id}-ms2`, label: 'المراجعة', status: item.progress >= 40 ? 'completed' : 'current' },
      { id: `${item.id}-ms3`, label: 'الإجراء القادم', status: item.progress >= 100 ? 'completed' : 'upcoming' },
    ],
    unread: item.status === 'pending',
  }));

  const documentItems = cases.flatMap((caseItem) =>
    caseItem.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      caseName: caseItem.title,
      updatedAt: formatRelativeDate(doc.createdAt),
      status: doc.status === 'Signed' ? 'مكتمل' : doc.status === 'Needs Review' ? 'مطلوب' : 'قيد المراجعة',
    })),
  );

  const actionRequiredCases = cases.filter((item) => item.status === 'pending' || item.unreadCount > 0).length;
  const requiredDocuments = documentItems.filter((item) => item.status === 'مطلوب').length;
  const inReviewDocuments = documentItems.filter((item) => item.status === 'قيد المراجعة').length;
  const completedDocuments = documentItems.filter((item) => item.status === 'مكتمل').length;
  const totalDocuments = documentItems.length;
  const fileHealth =
    totalDocuments === 0
      ? 0
      : Math.round(((completedDocuments + inReviewDocuments * 0.6) / totalDocuments) * 100);

  const scheduleItems = caseItems.slice(0, 3).map((item, index) => ({
    id: `sch-${item.id}`,
    title: `متابعة ${item.title}`,
    time: index === 0 ? 'اليوم 07:00 م' : index === 1 ? 'غداً 10:00 ص' : 'هذا الأسبوع',
    type: 'متابعة',
    caseName: item.title,
  }));

  const paymentItems = [...invoices.map((item) => ({
    id: item.id,
    label: item.label,
    amount: item.amount,
    status: item.status === 'paid' ? 'مدفوع' : 'معلق',
    date: item.dateLabel,
  })), ...transactions.slice(0, 3).map((item) => ({
    id: item.id,
    label: item.label,
    amount: `${item.amount.toLocaleString('en-US')} د.ع`,
    status: item.status === 'completed' ? 'مدفوع' : 'معلق',
    date: formatRelativeDate(item.createdAt),
    source: item.source,
    type: item.type,
  }))].slice(0, 8);

  const followedLawyerIds = new Set(follows.map((item) => item.lawyerId));
  const lawyerItems = lawyers.map((lawyer) =>
    buildLawyerCard(
      lawyer,
      getRelatedCount(lawyer, 'followers'),
      getRelatedCount(lawyer, 'reviewsReceived'),
      followedLawyerIds.has(lawyer.id),
    ),
  );

  return {
    summary: {
      activeCases: caseItems.length,
      actionRequiredCases,
      requiredDocuments,
      totalDocuments,
      completedDocuments,
      fileHealth,
      accountBalance: currentUser?.accountBalance ?? 0,
    },
    cases: caseItems,
    documents: documentItems,
    schedule: scheduleItems,
    payments: paymentItems,
    lawyers: lawyerItems,
    services: legalServices.length > 0 ? legalServices : USER_DASHBOARD_SERVICES,
  };
}

export async function addCreditBalance(
  userId: string,
  payload: { amount: number; paymentMethod: string; note?: string },
) {
  const amount = Number(payload.amount);
  const paymentMethod = String(payload.paymentMethod || '').trim();
  const note = String(payload.note || '').trim();

  if (!Number.isFinite(amount) || amount < 5000) {
    throw new Error('أقل مبلغ يمكن إضافته هو 5,000 د.ع.');
  }

  if (amount > 1000000) {
    throw new Error('أكبر مبلغ يمكن إضافته حالياً هو 1,000,000 د.ع.');
  }

  if (!paymentMethod) {
    throw new Error('يرجى اختيار طريقة الدفع.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        accountBalance: {
          increment: amount,
        },
      },
      select: {
        accountBalance: true,
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount,
        label: 'إضافة رصيد إلى المحفظة',
        source: paymentMethod,
        type: 'credit',
        status: 'completed',
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        title: 'تمت إضافة رصيد',
        description: note
          ? `تمت إضافة ${amount.toLocaleString('en-US')} د.ع عبر ${paymentMethod}. ملاحظة: ${note}`
          : `تمت إضافة ${amount.toLocaleString('en-US')} د.ع عبر ${paymentMethod}.`,
        timeLabel: formatRelativeDate(new Date()),
        type: 'billing',
      },
    });

    return { updatedUser, transaction };
  });

  return {
    balance: result.updatedUser.accountBalance,
    transaction: {
      id: result.transaction.id,
      label: result.transaction.label,
      amount: `${result.transaction.amount.toLocaleString('en-US')} د.ع`,
      status: 'مدفوع',
      date: formatRelativeDate(result.transaction.createdAt),
      source: result.transaction.source,
      type: result.transaction.type,
    },
  };
}

export async function deductFromWalletForService(
  userId: string,
  requestedAmount: number,
  serviceName: string,
  promoCode?: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('المستخدم غير موجود.');
  }

  let finalAmount = requestedAmount;
  let discountApplied = 0;
  let transactionLabel = serviceName;

  if (promoCode === 'NEWUSER100') { // مثال بسيط لكود خصم
    // في بيئة إنتاجية، يجب التحقق من:
    // 1. صلاحية الكود (تاريخ انتهاء، عدد مرات الاستخدام)
    // 2. إذا كان المستخدم "جديداً" (مثلاً، لا توجد لديه معاملات سابقة)
    // 3. إذا كان الكود قد استخدم من قبل هذا المستخدم

    // للتبسيط، نطبق الخصم مباشرة
    discountApplied = PROMO_CODE_DISCOUNT;
    finalAmount = Math.max(0, requestedAmount - discountApplied);
    transactionLabel = `${serviceName} (مع خصم ${discountApplied.toLocaleString()} د.ع)`;
  }

  if (user.accountBalance < finalAmount) {
    throw new Error('رصيد المحفظة غير كافٍ لإتمام العملية.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        accountBalance: {
          decrement: finalAmount,
        },
      },
      select: {
        accountBalance: true,
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount: finalAmount,
        label: transactionLabel,
        source: 'Wallet',
        type: 'debit',
        status: 'completed',
      },
    });
    return { updatedUser, transaction };
  });

  return {
    balance: result.updatedUser.accountBalance,
    transaction: {
      id: result.transaction.id,
      label: result.transaction.label,
      amount: `${result.transaction.amount.toLocaleString('en-US')} د.ع`,
      status: 'مدفوع',
      date: formatRelativeDate(result.transaction.createdAt),
      source: result.transaction.source,
      type: result.transaction.type,
    },
  };
}
