import { prisma } from './prisma';
import { hashPassword, verifyPassword } from './auth';

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
  },
];

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

function buildLawyerCard(user: any, followerCount: number, reviewCount: number, isFollowing = false) {
  const profile = user.lawyerProfile;
  return {
    id: user.id,
    name: user.name,
    specialty: profile?.specialty || 'عام',
    location: user.location || 'العراق',
    experience: `${profile?.experienceYears || 0} سنوات خبرة`,
    experienceYears: profile?.experienceYears || 0,
    availability: profile?.availability || 'متاح حسب الجدول',
    isOnline: profile?.isOnline || false,
    rating: profile?.rating || 0,
    reviews: `${reviewCount} مراجعة`,
    reviewCount,
    casesHandled: `+${profile?.openCases || 0} قضية`,
    consultationFee: profile?.consultationFee || 'غير محدد',
    verified: user.verified,
    accent: profile?.accent || 'from-slate-950 via-brand-dark to-brand-navy',
    avatar: profile?.avatar || user.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0d2a59&color=ffffff&rounded=true&font-size=0.4`,
    tagline: profile?.tagline || user.roleDescription || 'استشارات قانونية مهنية',
    followers: followerCount,
    responseTime: profile?.responseTime || 'يرد خلال ساعة',
    bio: profile?.bio || 'ملف قانوني مهني قيد التطوير.',
    highlights: parseJsonArray(profile?.highlights),
    license: profile?.licenseNumber || 'غير مضاف',
    attachments: ['هوية نقابية', 'رخصة ممارسة', 'اعتماد'],
    status: profile?.licenseStatus === 'verified' ? 'approved' : profile?.licenseStatus === 'rejected' ? 'rejected' : 'pending',
    submittedAt: profile?.submittedAt || formatRelativeDate(user.createdAt),
    profileScore: profile?.profileScore || 0,
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
    nationalIdUrl: user.lawyerProfile?.nationalIdUrl || '',
    nationalIdVerified: user.lawyerProfile?.nationalIdVerified || false,
    lawyerLicenseUrl: user.lawyerProfile?.lawyerLicenseUrl || '',
    lawyerLicenseVerified: user.lawyerProfile?.lawyerLicenseVerified || false,
  };
}

export async function updateCurrentUserProfile(userId: string, updates: Record<string, any>) {
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
  const [profile, sessions, activityItems, invoices] = await Promise.all([
    getCurrentUserProfile(userId),
    prisma.userSession.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  return {
    profile,
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

export async function getLawyers(currentUserId?: string, search?: string) {
  const [lawyers, follows] = await Promise.all([
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
  ]);

  const followedSet = new Set(follows.map((item) => item.lawyerId));
  return lawyers.map((user) =>
    buildLawyerCard(
      user,
      getRelatedCount(user, 'followers'),
      getRelatedCount(user, 'reviewsReceived'),
      followedSet.has(user.id),
    ),
  );
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
    },
  });

  if (!user || !user.lawyerProfile) return null;

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
  };
}

export async function getUserDashboard(userId: string) {
  const [cases, follows, lawyers, invoices, transactions] = await Promise.all([
    prisma.case.findMany({
      where: { clientId: userId, isArchived: false },
      select: {
        id: true,
        title: true,
        matter: true,
        progress: true,
        status: true,
        riskScore: true,
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
    cases: caseItems,
    documents: documentItems,
    schedule: scheduleItems,
    payments: paymentItems,
    lawyers: lawyerItems,
    services: USER_DASHBOARD_SERVICES,
  };
}
