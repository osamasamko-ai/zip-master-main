import dotenv from 'dotenv';
dotenv.config();
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
import { getAllLawDocs } from './iraqiLawDataset';
function parseAttachments(value: string | string[] | null | undefined): string[] {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

const CACHE_TTL_MS = 30_000;
const cacheStore = new Map<string, { expiresAt: number; value: unknown }>();

async function getCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = cacheStore.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
        return cached.value as T;
    }

    const value = await loader();
    cacheStore.set(key, { expiresAt: now + CACHE_TTL_MS, value });
    return value;
}

function invalidateCache(...keys: string[]) {
    keys.forEach((key) => cacheStore.delete(key));
}

const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
    {
        key: 'pro_workspace',
        label: 'مساحة عمل المحامي',
        description: 'تفعيل أدوات القضايا والرسائل والوثائق للمحامين.',
        enabled: true,
    },
    {
        key: 'digital_contracts',
        label: 'العقود الرقمية',
        description: 'السماح بإنشاء ومراجعة عقود البيع الرقمية.',
        enabled: true,
    },
    {
        key: 'ai_assistant',
        label: 'مساعد الذكاء الاصطناعي',
        description: 'إظهار مساعد AI داخل تجربة المستخدم والمحامي.',
        enabled: true,
    },
    {
        key: 'payments',
        label: 'المدفوعات',
        description: 'تشغيل بوابات الدفع ورصيد الحسابات.',
        enabled: true,
    },
];

const DEFAULT_POLICIES: PolicySetting[] = [
    {
        key: 'free_consults',
        label: 'الاستشارات المجانية',
        value: '3',
        description: 'عدد الاستشارات المجانية المتاحة للحساب الجديد.',
    },
    {
        key: 'platform_fee_percent',
        label: 'عمولة المنصة',
        value: '8',
        description: 'النسبة المئوية التي تخصم من الخدمات المدفوعة.',
    },
    {
        key: 'kyc_review_hours',
        label: 'مهلة مراجعة KYC',
        value: '24',
        description: 'المدة المستهدفة لمراجعة طلبات اعتماد المحامين بالساعات.',
    },
    {
        key: 'tax_enabled',
        label: 'حساب الضريبة',
        value: 'true',
        description: 'تفعيل احتساب الضريبة على العمليات المالية المؤهلة.',
    },
];

const DEFAULT_PAYMENT_GATEWAYS: PaymentGateway[] = [
    { key: 'zain_cash', label: 'ZainCash', enabled: true, feePercent: 1.5 },
    { key: 'bank_transfer', label: 'تحويل مصرفي', enabled: true, feePercent: 0 },
    { key: 'card', label: 'بطاقات الدفع', enabled: false, feePercent: 2.5 },
];

const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
    {
        key: 'kyc_approved',
        label: 'قبول اعتماد المحامي',
        value: 'تم قبول طلب اعتمادك ويمكنك الآن استقبال القضايا.',
        active: true,
    },
    {
        key: 'kyc_rejected',
        label: 'رفض اعتماد المحامي',
        value: 'تعذر قبول طلب الاعتماد. يرجى مراجعة الوثائق وإعادة الإرسال.',
        active: true,
    },
    {
        key: 'payment_received',
        label: 'استلام دفعة',
        value: 'تم استلام الدفعة وتحديث رصيد حسابك.',
        active: true,
    },
    {
        key: 'case_update',
        label: 'تحديث قضية',
        value: 'يوجد تحديث جديد على قضيتك داخل مساحة العمل.',
        active: true,
    },
];

export function clearAdminCache() {
    cacheStore.clear();
    return true;
}

export type KycStatus = 'pending' | 'approved' | 'rejected';

export interface KycApplication {
    id: string;
    name: string;
    city: string;
    license: string;
    attachments: string[];
    status: KycStatus;
}

export interface UserRecord {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'pro' | 'admin';
    location: string;
    blocked: boolean;
    verified: boolean;
    licenseNumber?: string;
    specialty?: string;
    rating?: number;
    openCases?: number;
    freeConsultsRemaining?: number;
    subscriptionTier: 'basic' | 'pro' | 'enterprise';
    notificationsEnabled: boolean;
    accountBalance: number;
    licenseStatus: 'pending' | 'verified' | 'rejected';
    notes: string;
    contractTemplates?: any[];
}

export interface FeatureFlag {
    key: string;
    label: string;
    description: string;
    enabled: boolean;
}

export interface SupportTicket {
    id: string;
    requester: string;
    subject: string;
    status: 'open' | 'pending' | 'resolved' | 'escalated';
    priority: 'high' | 'medium' | 'low';
    createdAt: string;
}

export interface PolicySetting {
    key: string;
    label: string;
    value: string;
    description: string;
}

export interface SystemSettings {
    maintenanceMode: boolean;
    announcement: string;
    offlineMessage: string;
    supportEmail: string;
}

export interface PaymentGateway {
    key: string;
    label: string;
    enabled: boolean;
    feePercent: number;
}

export interface AiSettings {
    enabled: boolean;
    topK: number;
    fallbackMode: boolean;
    maxTokens: number;
    jpegQuality: number;
    forceLocalMode: boolean;
    pricePerRequest: number;
    pricePerToken: number;
    freeRequestsPerUser: number;
    freeTokensPerUser: number;
}

export interface WorkflowSettings {
    allowNewCases: boolean;
    enforceSignedDocs: boolean;
    autoAssignLawyers: boolean;
    openCasesPerLawyer: number;
}

export interface NotificationTemplate {
    key: string;
    label: string;
    value: string;
    active: boolean;
}

export interface ModerationRule {
    id: string;
    type: 'bannedWord' | 'sensitiveTopic';
    value: string;
    active: boolean;
}

export interface LegalDoc {
    id: string;
    title: string;
    law: string;
    article: string;
    category: string;
    summary: string;
    source: string;
}

export interface LegalService {
    id: string;
    title: string;
    description: string;
    icon: string;
    price: string;
    time: string;
    color: string;
    category: string;
    lawyerId?: string | null;
    lawyerName?: string | null;
    lawyerSpecialty?: string | null;
    lawyerAvatar?: string | null;
    active: boolean;
    sortOrder?: number;
    categoryId?: string | null;
}

export interface CategoryRecord {
    id: string;
    type: string;
    name: string;
    slug: string;
    description: string;
    icon: string;
    color: string;
    active: boolean;
    sortOrder: number;
}

export interface UploadRecord {
    id: string;
    ownerId?: string | null;
    ownerName?: string | null;
    resourceType: string;
    resourceId?: string | null;
    purpose: string;
    originalName: string;
    filename: string;
    url: string;
    mimeType: string;
    size: number;
    status: string;
    createdAt: Date;
}

export interface PageRecord {
    id: string;
    slug: string;
    route: string;
    title: string;
    status: string;
    seoTitle?: string | null;
    seoDescription?: string | null;
    blocks?: Array<{
        id: string;
        key: string;
        type: string;
        title: string;
        body: string;
        mediaUploadId?: string | null;
        sortOrder: number;
        active: boolean;
    }>;
}

export interface RoleRecord {
    id: string;
    key: string;
    label: string;
    description: string;
    system: boolean;
    active: boolean;
    permissions?: string[];
}

export interface SecurityAlert {
    id: string;
    category: 'سجل دخول مشبوه' | 'تذكرة تصعيد' | 'انتهاك امتثال';
    title: string;
    detail: string;
    severity: 'high' | 'medium' | 'low';
    time: string;
}

export interface AuditRecord {
    id: string;
    type: 'security' | 'kyc' | 'transaction' | 'ai' | 'system';
    category: string;
    actor: string;
    message: string;
    time: string;
}

export interface TransactionRecord {
    id: string;
    label: string;
    source: string;
    amount: number;
    type: 'credit' | 'debit';
    status: 'completed' | 'pending' | 'failed';
}

export interface AdminMetrics {
    activeUsers: number;
    dailyVolume: number;
    avgResponseTimeMs: number;
    ragAccuracy: number;
    docsSynced: number;
    suspiciousEvents: number;
    openEscalations: number;
    complianceFlags: number;
    aiHealth: Array<{
        id: string;
        title: string;
        detail: string;
        severity: 'high' | 'medium' | 'low';
        action: string;
        tab: 'overview' | 'users' | 'cases' | 'resources' | 'roles' | 'financials' | 'contracts' | 'kyc' | 'support' | 'settings' | 'compliance' | 'system';
        icon: string;
    }>;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [usersCount, suspiciousCount, escalatedTickets, complianceAlerts, pendingKyc, staleKyc, inactiveLawyers, pages, recentPageEvents] = await Promise.all([
        prisma.user.count(),
        prisma.securityAlert.count({ where: { OR: [{ severity: 'high' }, { createdAt: { gte: sevenDaysAgo } }] } }),
        prisma.supportTicket.count({ where: { status: 'escalated' } }),
        prisma.auditLog.count({ where: { type: { in: ['security', 'system'] }, createdAt: { gte: sevenDaysAgo } } }),
        prisma.kycApplication.count({ where: { status: 'pending' } }),
        prisma.kycApplication.count({ where: { status: 'pending', createdAt: { lt: oneDayAgo } } }),
        prisma.user.count({
            where: {
                role: 'pro',
                lawyerProfile: {
                    is: {
                        isOnline: false,
                        OR: [
                            { profileScore: { lt: 60 } },
                            { licenseStatus: 'pending' },
                        ],
                    },
                },
            },
        }),
        prisma.page.findMany({ where: { status: 'published' }, select: { route: true, title: true }, take: 12 }),
        prisma.userEvent.groupBy({
            by: ['page'],
            where: { createdAt: { gte: sevenDaysAgo } },
            _count: { page: true },
        }),
    ]);
    const pageEventCounts = new Map(recentPageEvents.map((item) => [item.page, item._count.page]));
    const lowConversionPages = pages.filter((page) => (pageEventCounts.get(page.route.replace(/^\//, '')) || pageEventCounts.get(page.route) || 0) < 3);
    const aiHealth = [
        suspiciousCount > 0 ? {
            id: 'suspicious-activity',
            title: 'نشاط مشبوه يحتاج مراجعة',
            detail: `${suspiciousCount.toLocaleString('ar-IQ')} إشارات أمنية أو تنبيهات حديثة.`,
            severity: suspiciousCount >= 5 ? 'high' as const : 'medium' as const,
            action: 'فتح الحوكمة',
            tab: 'compliance' as const,
            icon: 'fa-shield-halved',
        } : null,
        staleKyc > 0 ? {
            id: 'kyc-bottleneck',
            title: 'اختناق في اعتماد KYC',
            detail: `${staleKyc.toLocaleString('ar-IQ')} طلبات معلقة لأكثر من 24 ساعة من أصل ${pendingKyc.toLocaleString('ar-IQ')}.`,
            severity: staleKyc >= 5 ? 'high' as const : 'medium' as const,
            action: 'فتح طابور الاعتماد',
            tab: 'kyc' as const,
            icon: 'fa-id-card',
        } : null,
        inactiveLawyers > 0 ? {
            id: 'inactive-lawyers',
            title: 'محامون غير نشطين',
            detail: `${inactiveLawyers.toLocaleString('ar-IQ')} ملفات محامين تحتاج تنشيطاً أو إكمال اعتماد.`,
            severity: 'medium' as const,
            action: 'مراجعة الحسابات',
            tab: 'users' as const,
            icon: 'fa-user-clock',
        } : null,
        lowConversionPages.length > 0 ? {
            id: 'low-conversion-pages',
            title: 'صفحات منخفضة التفاعل',
            detail: `${lowConversionPages.length.toLocaleString('ar-IQ')} صفحات منشورة لديها نشاط قليل آخر 7 أيام.`,
            severity: 'low' as const,
            action: 'تحسين المحتوى',
            tab: 'resources' as const,
            icon: 'fa-chart-line',
        } : null,
    ].filter(Boolean) as AdminMetrics['aiHealth'];

    return {
        activeUsers: usersCount,
        dailyVolume: 14500000,
        avgResponseTimeMs: 1180,
        ragAccuracy: 92,
        docsSynced: 870,
        suspiciousEvents: suspiciousCount,
        openEscalations: escalatedTickets,
        complianceFlags: complianceAlerts,
        aiHealth,
    };
}

export async function getKycApplications(search?: string, status?: KycStatus): Promise<KycApplication[]> {
    const applications = await prisma.kycApplication.findMany({
        where: {
            status: status || undefined,
            OR: search ? [
                { name: { contains: search } },
                { city: { contains: search } }
            ] : undefined
        }
    });
    return applications.map((application: any) => ({
        ...application,
        attachments: parseAttachments(application.attachments),
    })) as KycApplication[];
}

export async function updateKycApplication(id: string, status: KycStatus): Promise<KycApplication | null> {
    const updated = await prisma.kycApplication.update({
        where: { id },
        data: { status }
    }) as any;

    // Business Logic: If approved, update user verified status and lawyer profile
    if (status === 'approved' && updated.userId) {
        await prisma.user.update({
            where: { id: updated.userId },
            data: { verified: true }
        });
        await prisma.lawyerProfile.update({
            where: { userId: updated.userId },
            data: { licenseStatus: 'verified' }
        });
    }

    // Create Audit Log
    await prisma.transaction.create({
        data: {
            userId: updated.userId,
            amount: 0,
            label: `KYC ${status === 'approved' ? 'Approval' : 'Rejection'} for ${updated.name}`,
            source: 'System Admin',
            type: 'system'
        }
    });

    return {
        ...(updated as any),
        attachments: parseAttachments((updated as any).attachments),
    } as KycApplication;
}

export async function getUsers(): Promise<UserRecord[]> {
    const dbUsers = await prisma.user.findMany({
        include: { lawyerProfile: true }
    });

    return dbUsers.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as any,
        location: u.location || '',
        blocked: u.blocked,
        verified: u.verified,
        licenseNumber: u.lawyerProfile?.licenseNumber || undefined,
        specialty: u.lawyerProfile?.specialty || undefined,
        rating: u.lawyerProfile?.rating,
        openCases: u.lawyerProfile?.openCases,
        subscriptionTier: u.subscriptionTier as any,
        accountBalance: u.accountBalance,
        notes: u.notes || '',
        notificationsEnabled: u.notificationsEnabled,
        licenseStatus: (u.lawyerProfile?.licenseStatus as any) || 'pending',
        contractTemplates: u.contractTemplates || []
    }));
}

export async function getUserById(id: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({
        where: { id },
        include: { lawyerProfile: true }
    });
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as any,
        location: user.location || '',
        blocked: user.blocked,
        verified: user.verified,
        licenseNumber: user.lawyerProfile?.licenseNumber,
        specialty: user.lawyerProfile?.specialty,
        rating: user.lawyerProfile?.rating,
        openCases: user.lawyerProfile?.openCases,
        freeConsultsRemaining: undefined,
        subscriptionTier: user.subscriptionTier as any,
        accountBalance: user.accountBalance,
        notes: user.notes || '',
        notificationsEnabled: user.notificationsEnabled,
        licenseStatus: (user.lawyerProfile?.licenseStatus as any) || 'pending',
        contractTemplates: (user as any).contractTemplates || []
    };
}

export async function updateUserProfile(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                name: updates.name,
                email: updates.email,
                role: updates.role,
                location: updates.location,
                blocked: updates.blocked,
                verified: updates.verified,
                subscriptionTier: updates.subscriptionTier,
                accountBalance: updates.accountBalance,
                notificationsEnabled: updates.notificationsEnabled,
                notes: updates.notes,
            },
            include: { lawyerProfile: true }
        });

        if (updates.role === 'pro' || updates.role === 'admin' || user.lawyerProfile) {
            await prisma.lawyerProfile.upsert({
                where: { userId: id },
                create: {
                    userId: id,
                    licenseNumber: updates.licenseNumber || undefined,
                    specialty: updates.specialty || 'عام',
                    rating: updates.rating ?? 0,
                    openCases: updates.openCases ?? 0,
                    licenseStatus: updates.licenseStatus || 'pending',
                    submittedAt: 'اليوم',
                    profileScore: 25,
                },
                update: {
                    licenseNumber: updates.licenseNumber || undefined,
                    specialty: updates.specialty,
                    rating: updates.rating,
                    openCases: updates.openCases,
                    licenseStatus: updates.licenseStatus,
                },
            });
        }

        return getUserById(id);
    } catch (error) {
        console.error('Error updating user profile:', error);
        return null;
    }
}

export async function updateUserRole(id: string, role: string) {
    const updated = await prisma.user.update({
        where: { id },
        data: { role: role as any }
    });

    if (role === 'pro' || role === 'admin') {
        await prisma.lawyerProfile.upsert({
            where: { userId: id },
            create: {
                userId: id,
                specialty: 'عام',
                licenseStatus: 'pending',
                submittedAt: 'اليوم',
                profileScore: 20,
            },
            update: {},
        });
    }

    return getUserById(updated.id);
}

export async function toggleUserBlock(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    const updated = await prisma.user.update({
        where: { id },
        data: { blocked: !user.blocked }
    });
    return getUserById(updated.id);
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
    return getCached('feature-flags', async () => {
        await Promise.all(DEFAULT_FEATURE_FLAGS.map((flag) =>
            prisma.featureFlag.upsert({
                where: { key: flag.key },
                update: {},
                create: flag,
            })
        ));
        return prisma.featureFlag.findMany({ orderBy: { label: 'asc' } }) as any;
    });
}

export async function updateFeatureFlag(key: string, enabled: boolean) {
    const fallback = DEFAULT_FEATURE_FLAGS.find((flag) => flag.key === key);
    const updated = await prisma.featureFlag.upsert({
        where: { key },
        update: { enabled },
        create: {
            key,
            label: fallback?.label || key,
            description: fallback?.description || '',
            enabled,
        },
    }) as any;
    invalidateCache('feature-flags');
    return updated;
}

export async function getSupportTickets(): Promise<SupportTicket[]> {
    return prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } }) as any;
}

export async function updateSupportTicket(id: string, status: string) {
    return prisma.supportTicket.update({
        where: { id },
        data: { status: status as any }
    }) as any;
}

export async function getPolicies(): Promise<PolicySetting[]> {
    return getCached('system-policies', async () => {
        await Promise.all(DEFAULT_POLICIES.map((policy) =>
            prisma.systemPolicy.upsert({
                where: { key: policy.key },
                update: {},
                create: policy,
            })
        ));
        return prisma.systemPolicy.findMany({ orderBy: { label: 'asc' } }) as any;
    });
}

export async function updatePolicySetting(key: string, value: string) {
    const fallback = DEFAULT_POLICIES.find((policy) => policy.key === key);
    const updated = await prisma.systemPolicy.upsert({
        where: { key },
        update: { value },
        create: {
            key,
            label: fallback?.label || key,
            value,
            description: fallback?.description || '',
        },
    }) as any;
    invalidateCache('system-policies');
    return updated;
}

export async function getSecurityAlerts(): Promise<SecurityAlert[]> {
    return prisma.securityAlert.findMany({ orderBy: { createdAt: 'desc' } }) as any;
}

export async function getAuditLogs(type?: string): Promise<AuditRecord[]> {
    return prisma.auditLog.findMany({
        where: type && type !== 'all' ? { type: type as any } : undefined,
        orderBy: { createdAt: 'desc' }
    }) as any;
}

export async function getTransactionRecords(): Promise<TransactionRecord[]> {
    return prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } }) as any;
}

export async function getExportCsv(type: 'kyc' | 'transactions'): Promise<string> {
    if (type === 'transactions') {
        const header = 'رقم العملية,الوصف,المصدر,المبلغ,النوع,الحالة\n';
        const transactionRecords = await getTransactionRecords();
        const rows = transactionRecords
            .map((transaction) => `${transaction.id},${transaction.label},${transaction.source},${transaction.amount},${transaction.type},${transaction.status}`)
            .join('\n');
        return `${header}${rows}`;
    }

    const header = 'رقم النقابة,اسم المحامي,المدينة,المستندات,الحالة\n';
    const kycApplications = await getKycApplications();
    const rows = kycApplications
        .map((application: KycApplication) =>
            `${application.id},${application.name},${application.city},"${application.attachments.join(' | ')}",${application.status}`
        )
        .join('\n');
    return `${header}${rows}`;
}

export async function getSystemSettings(): Promise<SystemSettings> {
    return getCached('system-settings', async () => {
        const settings = await prisma.systemSetting.findFirst();
        return (settings as any) || {
            maintenanceMode: false,
            announcement: '',
            offlineMessage: 'الموقع تحت الصيانة حالياً.',
            supportEmail: 'support@example.com'
        };
    });
}

export async function updateSystemSettings(settings: Partial<SystemSettings>) {
    const current = await prisma.systemSetting.findFirst();
    let updated: any;

    if (!current) {
        updated = await prisma.systemSetting.create({
            data: { ...settings } as any
        });
    } else {
        updated = await prisma.systemSetting.update({
            where: { id: current.id },
            data: settings
        });
    }

    invalidateCache('system-settings');
    return updated;
}

export async function getAiSettings(): Promise<AiSettings> {
    return getCached('ai-settings', async () => {
        // Reduced logging to keep console clean unless there's an actual error
        try {
            const settings = await prisma.aiSetting.findFirst();

            if (!settings) {
                console.warn('⚠️ [AI-CONFIG] No record found in "AiSetting" table. Returning default configuration.');
                return {
                    enabled: true,
                    topK: 3,
                    fallbackMode: false,
                    maxTokens: 2048
                } as any;
            }

            // Validation for unexpected null values within a found record
            const raw = settings as any;
            const requiredKeys: (keyof AiSettings)[] = ['enabled', 'topK', 'fallbackMode', 'maxTokens'];
            const missingKeys = requiredKeys.filter(k => raw[k] === null || raw[k] === undefined);

            if (missingKeys.length > 0) {
                console.error(`🚨 [AI-CONFIG] Found database record but some fields are NULL: [${missingKeys.join(', ')}]. Object:`, raw);
            } else {
                console.log('✅ [AI-CONFIG] Settings loaded and validated successfully from database.');
            }

            return settings as any;
        } catch (error) {
            console.warn('⚠️ [AI-CONFIG] Database fetch failed, using fallback settings.');
            // Fallback to prevent null pointer exceptions in callers
            return {
                enabled: true,
                topK: 3,
                fallbackMode: false,
                maxTokens: 2048
            } as any;
        }
    });
}

export async function updateAiSettings(settings: Partial<AiSettings>) {
    const current = await prisma.aiSetting.findFirst();
    let updated: any;

    if (!current) {
        updated = await prisma.aiSetting.create({
            data: {
                enabled: true, topK: 3, fallbackMode: false, maxTokens: 2048,
                ...settings
            } as any
        });
    } else {
        updated = await prisma.aiSetting.update({
            where: { id: current.id },
            data: settings
        });
    }

    invalidateCache('ai-settings');
    return updated;
}

export async function getPaymentGateways(): Promise<PaymentGateway[]> {
    return getCached('payment-gateways', async () => {
        await Promise.all(DEFAULT_PAYMENT_GATEWAYS.map((gateway) =>
            prisma.paymentGateway.upsert({
                where: { key: gateway.key },
                update: {},
                create: gateway,
            })
        ));
        return prisma.paymentGateway.findMany({ orderBy: { label: 'asc' } }) as any;
    });
}

export async function updatePaymentGateway(key: string, enabled: boolean, feePercent?: number) {
    const fallback = DEFAULT_PAYMENT_GATEWAYS.find((gateway) => gateway.key === key);
    const updated = await prisma.paymentGateway.upsert({
        where: { key },
        update: { enabled, feePercent },
        create: {
            key,
            label: fallback?.label || key,
            enabled,
            feePercent: feePercent ?? fallback?.feePercent ?? 0,
        },
    }) as any;
    invalidateCache('payment-gateways');
    return updated;
}

export async function getWorkflowSettings(): Promise<WorkflowSettings> {
    return getCached('workflow-settings', async () => {
        const settings = await prisma.workflowSetting.findFirst();
        return (settings as any) || {
            allowNewCases: true,
            enforceSignedDocs: true,
            autoAssignLawyers: false,
            openCasesPerLawyer: 5
        };
    });
}

export async function updateWorkflowSettings(settings: Partial<WorkflowSettings>) {
    const current = await prisma.workflowSetting.findFirst();
    let updated: any;

    if (!current) {
        updated = await prisma.workflowSetting.create({
            data: {
                allowNewCases: true, enforceSignedDocs: true, autoAssignLawyers: false, openCasesPerLawyer: 5,
                ...settings
            } as any
        });
    } else {
        updated = await prisma.workflowSetting.update({
            where: { id: current.id },
            data: settings
        });
    }

    invalidateCache('workflow-settings');
    return updated;
}

export async function getNotificationTemplates(): Promise<NotificationTemplate[]> {
    return getCached('notification-templates', async () => {
        await Promise.all(DEFAULT_NOTIFICATION_TEMPLATES.map((template) =>
            prisma.notificationTemplate.upsert({
                where: { key: template.key },
                update: {},
                create: template,
            })
        ));
        return prisma.notificationTemplate.findMany({ orderBy: { label: 'asc' } }) as any;
    });
}

export async function updateNotificationTemplate(key: string, partial: Partial<NotificationTemplate>) {
    const fallback = DEFAULT_NOTIFICATION_TEMPLATES.find((template) => template.key === key);
    const updated = await prisma.notificationTemplate.upsert({
        where: { key },
        update: partial,
        create: {
            key,
            label: partial.label || fallback?.label || key,
            value: partial.value || fallback?.value || '',
            active: partial.active ?? fallback?.active ?? true,
        },
    }) as any;
    invalidateCache('notification-templates');
    return updated;
}

export async function getModerationRules(): Promise<ModerationRule[]> {
    return getCached('moderation-rules', async () => prisma.moderationRule.findMany() as any);
}

export async function updateModerationRule(id: string, partial: Partial<ModerationRule>) {
    const updated = await prisma.moderationRule.update({
        where: { id },
        data: partial
    }) as any;
    invalidateCache('moderation-rules');
    return updated;
}

export async function addModerationRule(rule: Omit<ModerationRule, 'id'>) {
    const created = await prisma.moderationRule.create({ data: rule }) as any;
    invalidateCache('moderation-rules');
    return created;
}

export async function deleteModerationRule(id: string) {
    await prisma.moderationRule.delete({ where: { id } });
    invalidateCache('moderation-rules');
    return true;
}

export async function getLegalDocs(): Promise<LegalDoc[]> {
    return getCached('legal-docs', async () => {
        const databaseDocs = await prisma.legalDoc.findMany({
            where: { status: 'published' },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        }) as any[];
        const databaseDocIds = new Set(databaseDocs.map((doc) => doc.id));
        const defaultDocs = getAllLawDocs().filter((doc) => !databaseDocIds.has(doc.id));
        return [...databaseDocs, ...defaultDocs] as LegalDoc[];
    });
}

export async function addLegalDoc(doc: Omit<LegalDoc, 'id'>) {
    const created = await prisma.legalDoc.create({ data: doc }) as any;
    invalidateCache('legal-docs');
    return created;
}

export async function updateLegalDoc(id: string, settings: Partial<Omit<LegalDoc, 'id'>>) {
    const updated = await prisma.legalDoc.update({
        where: { id },
        data: settings
    }) as any;
    invalidateCache('legal-docs');
    return updated;
}

export async function deleteLegalDoc(id: string) {
    await prisma.legalDoc.delete({ where: { id } });
    invalidateCache('legal-docs');
    return true;
}

async function ensureLegalServicesTable() {
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "LegalService" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "title" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "icon" TEXT NOT NULL DEFAULT 'fa-solid fa-scale-balanced',
            "price" TEXT NOT NULL,
            "time" TEXT NOT NULL,
            "color" TEXT NOT NULL DEFAULT 'blue',
            "category" TEXT NOT NULL,
            "lawyerId" TEXT,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "LegalService_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
    `;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LegalService_active_sortOrder_createdAt_idx" ON "LegalService"("active", "sortOrder", "createdAt")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LegalService_category_idx" ON "LegalService"("category")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LegalService_lawyerId_idx" ON "LegalService"("lawyerId")`;
}

function mapLegalService(row: any): LegalService {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        icon: row.icon || 'fa-solid fa-scale-balanced',
        price: row.price,
        time: row.time,
        color: row.color || 'blue',
        category: row.category,
        lawyerId: row.lawyerId || null,
        lawyerName: row.lawyerName || null,
        lawyerSpecialty: row.lawyerSpecialty || null,
        lawyerAvatar: row.lawyerAvatar || null,
        active: row.active !== false && row.active !== 0,
    };
}

export async function getLegalServices(activeOnly = false): Promise<LegalService[]> {
    await ensureLegalServicesTable();
    const rows = await prisma.$queryRaw<any[]>`
        SELECT
            service.*,
            lawyer.name AS lawyerName,
            profile.specialty AS lawyerSpecialty,
            COALESCE(profile.avatar, lawyer.img) AS lawyerAvatar
        FROM "LegalService" service
        LEFT JOIN "User" lawyer ON lawyer.id = service.lawyerId
        LEFT JOIN "LawyerProfile" profile ON profile.userId = lawyer.id
        WHERE (${activeOnly} = false OR service.active = true)
        ORDER BY service.sortOrder ASC, service.createdAt DESC
    `;
    return rows.map(mapLegalService);
}

export async function addLegalService(service: Omit<LegalService, 'id' | 'lawyerName' | 'lawyerSpecialty' | 'lawyerAvatar' | 'active'> & { active?: boolean }) {
    await ensureLegalServicesTable();
    const id = crypto.randomUUID();
    await prisma.$executeRaw`
        INSERT INTO "LegalService" ("id", "title", "description", "icon", "price", "time", "color", "category", "lawyerId", "active", "updatedAt")
        VALUES (${id}, ${service.title}, ${service.description}, ${service.icon}, ${service.price}, ${service.time}, ${service.color}, ${service.category}, ${service.lawyerId || null}, ${service.active !== false}, CURRENT_TIMESTAMP)
    `;
    const created = (await getLegalServices()).find((item) => item.id === id);
    return created;
}

export async function deleteLegalService(id: string) {
    await ensureLegalServicesTable();
    await prisma.$executeRaw`DELETE FROM "LegalService" WHERE "id" = ${id}`;
    return true;
}

export async function updateLegalService(id: string, service: Partial<LegalService>) {
    const updated = await prisma.legalService.update({
        where: { id },
        data: {
            title: service.title,
            description: service.description,
            icon: service.icon,
            price: service.price,
            time: service.time,
            color: service.color,
            category: service.category,
            categoryId: service.categoryId ?? undefined,
            lawyerId: service.lawyerId === undefined ? undefined : service.lawyerId,
            active: service.active,
            sortOrder: service.sortOrder,
        },
        include: {
            lawyer: { include: { lawyerProfile: true } },
        },
    });

    return mapLegalService({
        ...updated,
        lawyerName: updated.lawyer?.name,
        lawyerSpecialty: updated.lawyer?.lawyerProfile?.specialty,
        lawyerAvatar: updated.lawyer?.lawyerProfile?.avatar || updated.lawyer?.img,
    });
}

function slugify(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\u0600-\u06FF\w-]/g, '')
        .slice(0, 80) || crypto.randomUUID();
}

function cleanText(value: unknown, fallback = '') {
    return typeof value === 'string' ? value.trim().slice(0, 5000) : fallback;
}

function cleanKey(value: unknown, fallback = '') {
    return cleanText(value, fallback).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 80);
}

function cleanStatus(value: unknown, allowed: string[], fallback: string) {
    return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

export async function getCategories(type?: string): Promise<CategoryRecord[]> {
    return prisma.category.findMany({
        where: type ? { type } : undefined,
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }) as any;
}

export async function addCategory(payload: Partial<CategoryRecord>): Promise<CategoryRecord> {
    const type = cleanKey(payload.type, 'content');
    const name = cleanText(payload.name);
    if (!type || !name) {
        throw new Error('type and name are required');
    }
    return prisma.category.create({
        data: {
            type,
            name,
            slug: cleanKey(payload.slug) || slugify(name),
            description: cleanText(payload.description),
            icon: cleanText(payload.icon, 'fa-solid fa-layer-group'),
            color: cleanText(payload.color, 'blue').slice(0, 40),
            active: payload.active !== false,
            sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : 0,
        },
    }) as any;
}

export async function updateCategory(id: string, payload: Partial<CategoryRecord>): Promise<CategoryRecord> {
    return prisma.category.update({
        where: { id },
        data: {
            type: payload.type ? cleanKey(payload.type) : undefined,
            name: payload.name ? cleanText(payload.name) : undefined,
            slug: payload.slug ? cleanKey(payload.slug) : undefined,
            description: payload.description == null ? undefined : cleanText(payload.description),
            icon: payload.icon == null ? undefined : cleanText(payload.icon, 'fa-solid fa-layer-group'),
            color: payload.color == null ? undefined : cleanText(payload.color, 'blue').slice(0, 40),
            active: payload.active,
            sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : undefined,
        },
    }) as any;
}

export async function deleteCategory(id: string) {
    await prisma.$transaction([
        prisma.legalService.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
        prisma.contractClause.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
        prisma.category.delete({ where: { id } }),
    ]);
    return true;
}

export async function reorderCategories(items: Array<{ id: string; sortOrder: number }>) {
    await prisma.$transaction(items.filter((item) => item.id && Number.isFinite(item.sortOrder)).map((item) =>
        prisma.category.update({ where: { id: item.id }, data: { sortOrder: Number(item.sortOrder) } })
    ));
    return getCategories();
}

export async function getUploads(): Promise<UploadRecord[]> {
    const rows = await prisma.upload.findMany({
        include: { owner: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
    });
    return rows.map((row: any) => ({
        ...row,
        ownerName: row.owner?.name || null,
    }));
}

export async function addUploadRecord(payload: {
    ownerId?: string | null;
    resourceType: string;
    resourceId?: string | null;
    purpose: string;
    originalName: string;
    filename: string;
    url: string;
    mimeType: string;
    size: number;
}) {
    return prisma.upload.create({
        data: {
            ownerId: payload.ownerId || null,
            resourceType: cleanKey(payload.resourceType, 'media'),
            resourceId: payload.resourceId || null,
            purpose: cleanKey(payload.purpose, 'admin_media'),
            originalName: cleanText(payload.originalName, 'upload'),
            filename: payload.filename,
            url: payload.url,
            mimeType: payload.mimeType,
            size: payload.size,
        },
    });
}

export async function updateUploadRecord(id: string, payload: Partial<UploadRecord>) {
    return prisma.upload.update({
        where: { id },
        data: {
            resourceType: payload.resourceType ? cleanKey(payload.resourceType) : undefined,
            resourceId: payload.resourceId,
            purpose: payload.purpose ? cleanKey(payload.purpose) : undefined,
            status: payload.status ? cleanStatus(payload.status, ['active', 'archived', 'quarantined'], 'active') : undefined,
        },
    });
}

export async function deleteUploadRecord(id: string) {
    const upload = await prisma.upload.findUnique({ where: { id }, select: { filename: true } });
    await prisma.$transaction([
        prisma.siteContentBlock.updateMany({ where: { mediaUploadId: id }, data: { mediaUploadId: null } }),
        prisma.upload.delete({ where: { id } }),
    ]);
    if (upload?.filename) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        const filePath = path.resolve(uploadsDir, path.basename(upload.filename));
        if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    return true;
}

export async function getPages(): Promise<PageRecord[]> {
    return prisma.page.findMany({
        include: { blocks: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
        orderBy: { updatedAt: 'desc' },
    }) as any;
}

export async function addPage(payload: Partial<PageRecord>): Promise<PageRecord> {
    const title = cleanText(payload.title);
    const route = cleanText(payload.route);
    if (!title || !route || !route.startsWith('/')) throw new Error('title and a root-relative route are required');
    return prisma.page.create({
        data: {
            title,
            route,
            slug: cleanKey(payload.slug) || slugify(route.replace(/^\//, '') || title),
            status: cleanStatus(payload.status, ['draft', 'published', 'archived'], 'draft'),
            seoTitle: payload.seoTitle == null ? undefined : cleanText(payload.seoTitle),
            seoDescription: payload.seoDescription == null ? undefined : cleanText(payload.seoDescription),
        },
        include: { blocks: true },
    }) as any;
}

export async function updatePage(id: string, payload: Partial<PageRecord>): Promise<PageRecord> {
    return prisma.page.update({
        where: { id },
        data: {
            title: payload.title == null ? undefined : cleanText(payload.title),
            route: payload.route == null ? undefined : cleanText(payload.route),
            slug: payload.slug == null ? undefined : cleanKey(payload.slug),
            status: payload.status == null ? undefined : cleanStatus(payload.status, ['draft', 'published', 'archived'], 'draft'),
            seoTitle: payload.seoTitle == null ? undefined : cleanText(payload.seoTitle),
            seoDescription: payload.seoDescription == null ? undefined : cleanText(payload.seoDescription),
        },
        include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    }) as any;
}

export async function deletePage(id: string) {
    await prisma.siteContentBlock.deleteMany({ where: { pageId: id } });
    await prisma.page.delete({ where: { id } });
    return true;
}

export async function addPageBlock(pageId: string, payload: any) {
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true } });
    if (!page) throw new Error('page not found');
    return prisma.siteContentBlock.create({
        data: {
            pageId,
            key: cleanKey(payload.key) || slugify(payload.title || payload.type || 'block'),
            type: cleanKey(payload.type, 'text'),
            title: cleanText(payload.title),
            body: cleanText(payload.body),
            mediaUploadId: payload.mediaUploadId || null,
            sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : 0,
            active: payload.active !== false,
        },
    });
}

export async function updatePageBlock(blockId: string, payload: any, pageId?: string) {
    if (pageId) {
        const block = await prisma.siteContentBlock.findFirst({ where: { id: blockId, pageId }, select: { id: true } });
        if (!block) throw new Error('block not found for page');
    }
    return prisma.siteContentBlock.update({
        where: { id: blockId },
        data: {
            key: payload.key == null ? undefined : cleanKey(payload.key),
            type: payload.type == null ? undefined : cleanKey(payload.type),
            title: payload.title == null ? undefined : cleanText(payload.title),
            body: payload.body == null ? undefined : cleanText(payload.body),
            mediaUploadId: payload.mediaUploadId,
            sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : undefined,
            active: payload.active,
        },
    });
}

export async function deletePageBlock(blockId: string, pageId?: string) {
    if (pageId) {
        const block = await prisma.siteContentBlock.findFirst({ where: { id: blockId, pageId }, select: { id: true } });
        if (!block) throw new Error('block not found for page');
    }
    await prisma.siteContentBlock.delete({ where: { id: blockId } });
    return true;
}

const DEFAULT_PERMISSIONS = [
    'users.read', 'users.create', 'users.update', 'users.delete',
    'cases.read', 'cases.create', 'cases.update', 'cases.reassign', 'cases.delete',
    'content.manage', 'feed.manage', 'uploads.manage', 'settings.manage', 'billing.manage',
    'roles.manage', 'audit.read', 'kyc.manage', 'support.manage',
];

const PERMISSION_LABELS: Record<string, { label: string; group: string }> = {
    'users.read': { label: 'عرض المستخدمين', group: 'المستخدمون' },
    'users.create': { label: 'إنشاء مستخدم', group: 'المستخدمون' },
    'users.update': { label: 'تعديل المستخدمين', group: 'المستخدمون' },
    'users.delete': { label: 'حذف المستخدمين', group: 'المستخدمون' },
    'cases.read': { label: 'عرض القضايا', group: 'القضايا' },
    'cases.create': { label: 'إنشاء القضايا', group: 'القضايا' },
    'cases.update': { label: 'تعديل القضايا', group: 'القضايا' },
    'cases.reassign': { label: 'إسناد القضايا', group: 'القضايا' },
    'cases.delete': { label: 'حذف القضايا', group: 'القضايا' },
    'content.manage': { label: 'إدارة المحتوى', group: 'المحتوى' },
    'feed.manage': { label: 'إدارة المجتمع القانوني', group: 'المحتوى' },
    'uploads.manage': { label: 'إدارة الملفات', group: 'المحتوى' },
    'settings.manage': { label: 'إدارة الإعدادات', group: 'النظام' },
    'billing.manage': { label: 'إدارة الأموال', group: 'الأموال' },
    'roles.manage': { label: 'إدارة الصلاحيات', group: 'الصلاحيات' },
    'audit.read': { label: 'عرض السجلات', group: 'التدقيق' },
    'kyc.manage': { label: 'إدارة الاعتماد', group: 'الاعتماد' },
    'support.manage': { label: 'إدارة الدعم', group: 'الدعم' },
};

export async function ensureRolesAndPermissions() {
    await Promise.all(DEFAULT_PERMISSIONS.map((key) => {
        const [resource, action] = key.split('.');
        return prisma.permission.upsert({
            where: { key },
            update: { description: PERMISSION_LABELS[key]?.label || key },
            create: { key, resource, action, description: PERMISSION_LABELS[key]?.label || key },
        });
    }));

    const adminRole = await prisma.role.upsert({
        where: { key: 'admin' },
        update: { label: 'Admin', system: true, active: true },
        create: { key: 'admin', label: 'Admin', description: 'Full platform access', system: true },
    });

    const permissions = await prisma.permission.findMany();
    await Promise.all(permissions.map((permission) =>
        prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
            update: {},
            create: { roleId: adminRole.id, permissionId: permission.id },
        })
    ));
}

export async function getRoles(): Promise<RoleRecord[]> {
    await ensureRolesAndPermissions();
    const rows = await prisma.role.findMany({
        include: { permissions: { include: { permission: true } } },
        orderBy: { label: 'asc' },
    });
    return rows.map((role) => ({
        id: role.id,
        key: role.key,
        label: role.label,
        description: role.description,
        system: role.system,
        active: role.active,
        permissions: role.permissions.map((item) => item.permission.key),
    }));
}

export async function getPermissions() {
    await ensureRolesAndPermissions();
    const rows = await prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
    return rows.map((permission) => ({
        ...permission,
        label: PERMISSION_LABELS[permission.key]?.label || permission.description || permission.key,
        group: PERMISSION_LABELS[permission.key]?.group || permission.resource,
    }));
}

export async function addRole(payload: Partial<RoleRecord>) {
    const key = cleanKey(payload.key);
    const label = cleanText(payload.label);
    if (!key || !label) throw new Error('key and label are required');
    return prisma.role.create({
        data: {
            key,
            label,
            description: cleanText(payload.description),
            active: payload.active !== false,
            system: false,
        },
    });
}

export async function updateRole(id: string, payload: Partial<RoleRecord>) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new Error('role not found');
    return prisma.role.update({
        where: { id },
        data: {
            label: payload.label == null ? undefined : cleanText(payload.label),
            description: payload.description == null ? undefined : cleanText(payload.description),
            active: role.system ? undefined : payload.active,
        },
    });
}

export async function updateRolePermissions(id: string, permissionKeys: string[]) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new Error('role not found');
    if (role.system) throw new Error('system role permissions cannot be changed');
    const cleanedKeys = Array.from(new Set(permissionKeys.map((key) => cleanKey(key)).filter(Boolean)));
    if (role.key === 'admin' && !cleanedKeys.includes('roles.manage')) {
        throw new Error('admin role must keep roles.manage');
    }
    const permissions = await prisma.permission.findMany({ where: { key: { in: cleanedKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })),
    });
    return getRoles();
}

export async function roleHasPermission(roleKey: string, permissionKey: string) {
    await ensureRolesAndPermissions();
    const permission = await prisma.rolePermission.findFirst({
        where: {
            role: { key: roleKey, active: true },
            permission: { key: permissionKey },
        },
        select: { roleId: true },
    });
    return Boolean(permission);
}

export async function deleteRole(id: string) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (role?.system) throw new Error('system roles cannot be deleted');
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await prisma.role.delete({ where: { id } });
    return true;
}

export async function getAdminCases() {
    return prisma.case.findMany({
        include: {
            client: { select: { id: true, name: true, email: true } },
            lawyer: { select: { id: true, name: true, email: true } },
            documents: true,
            timelineEntries: { orderBy: { createdAt: 'asc' } },
            invoices: true,
            chatSessions: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
        },
        orderBy: { updatedAt: 'desc' },
    });
}

export async function getAdminCase(id: string) {
    return prisma.case.findUnique({
        where: { id },
        include: {
            client: true,
            lawyer: true,
            documents: true,
            folders: true,
            customFields: true,
            timelineEntries: { orderBy: { createdAt: 'asc' } },
            collaborators: true,
            accessLogs: true,
            appointments: true,
            invoices: true,
            chatSessions: { include: { messages: { include: { sender: true }, orderBy: { createdAt: 'asc' } } } },
        },
    });
}

export async function updateAdminCase(id: string, payload: any) {
    return prisma.case.update({
        where: { id },
        data: {
            title: payload.title,
            matter: payload.matter,
            status: payload.status,
            progress: typeof payload.progress === 'number' ? payload.progress : undefined,
            riskScore: typeof payload.riskScore === 'number' ? payload.riskScore : undefined,
            isArchived: payload.isArchived,
            totalAgreedFee: typeof payload.totalAgreedFee === 'number' ? payload.totalAgreedFee : undefined,
            paidAmount: typeof payload.paidAmount === 'number' ? payload.paidAmount : undefined,
            privateNote: payload.privateNote,
            clientId: payload.clientId,
            lawyerId: payload.lawyerId,
        },
    });
}

export async function addAdminCaseTimelineEntry(caseId: string, payload: any) {
    const item = await prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!item) throw new Error('case not found');
    const title = cleanText(payload.title);
    if (!title) throw new Error('timeline title is required');
    return prisma.caseTimelineEntry.create({
        data: {
            caseId,
            dateLabel: cleanText(payload.dateLabel, 'اليوم'),
            title,
            detail: cleanText(payload.detail),
            type: cleanKey(payload.type, 'system'),
        },
    });
}

export async function updateAdminCaseTimelineEntry(id: string, payload: any, caseId?: string) {
    if (caseId) {
        const entry = await prisma.caseTimelineEntry.findFirst({ where: { id, caseId }, select: { id: true } });
        if (!entry) throw new Error('timeline entry not found for case');
    }
    return prisma.caseTimelineEntry.update({
        where: { id },
        data: {
            dateLabel: payload.dateLabel == null ? undefined : cleanText(payload.dateLabel),
            title: payload.title == null ? undefined : cleanText(payload.title),
            detail: payload.detail == null ? undefined : cleanText(payload.detail),
            type: payload.type == null ? undefined : cleanKey(payload.type),
        },
    });
}

export async function deleteAdminCaseTimelineEntry(id: string, caseId?: string) {
    if (caseId) {
        const entry = await prisma.caseTimelineEntry.findFirst({ where: { id, caseId }, select: { id: true } });
        if (!entry) throw new Error('timeline entry not found for case');
    }
    await prisma.caseTimelineEntry.delete({ where: { id } });
    return true;
}

export async function getContractsAdmin() {
    const [contracts, legacyCases] = await Promise.all([
        prisma.contract.findMany({
            include: { owner: { select: { id: true, name: true, email: true } }, case: { select: { id: true, title: true } } },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.case.findMany({
            where: { matter: 'عقد بيع مركبة' },
            include: { client: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    const normalizedContracts = contracts.map((contract) => ({
        id: contract.id,
        title: contract.title,
        status: contract.status,
        sellerName: contract.sellerName || contract.owner.name,
        buyerName: contract.buyerName || 'غير محدد',
        carModel: contract.subject || 'غير محدد',
        vinNumber: '',
        reviewNotes: [],
        price: contract.price || '0',
        createdAt: contract.createdAt,
        source: 'contract',
    }));

    const legacy = legacyCases.map((item) => {
        let details: any = {};
        try {
            details = JSON.parse(item.privateNote || '{}');
        } catch {
            details = {};
        }
        return {
            id: item.id,
            title: item.title,
            status: item.status === 'pending' && details.status === 'waiting_buyer_signature' ? 'waiting_buyer' : item.status === 'pending' ? 'draft' : 'signed',
            sellerName: details.sellerName || item.client.name,
            buyerName: details.buyerName || 'غير محدد',
            carModel: details.carModel || 'غير محدد',
            vinNumber: details.vinNumber || 'غير متوفر',
            reviewNotes: details.reviewNotes || [],
            price: details.price || '0',
            createdAt: item.createdAt,
            source: 'legacy_case',
        };
    });

    return [...normalizedContracts, ...legacy];
}

export async function createUser(userData: { email: string; passwordHash: string; name: string; role: 'user' | 'pro' | 'admin'; }) {
    const newUser = await prisma.user.create({
        data: {
            email: userData.email,
            passwordHash: userData.passwordHash,
            name: userData.name,
            role: userData.role,
            verified: false, // New users are not verified by default
            blocked: false,
            // Provide default values for other non-nullable fields if not explicitly set
            accountBalance: 0,
            notificationsEnabled: true,
            twoFactorEnabled: false,
            emailAlerts: true,
            pushNotifications: true,
            billingReminders: true,
            securityAlerts: true,
            marketingEmails: false,
            language: 'ar', // Default language
            subscriptionTier: 'basic', // Default subscription tier
        },
        include: { lawyerProfile: true }
    });

    // If the new user is a 'pro', create a default lawyerProfile
    if (newUser.role === 'pro') {
        await prisma.lawyerProfile.create({
            data: {
                userId: newUser.id,
                licenseStatus: 'pending',
                submittedAt: new Date().toISOString(), // Use current date
                profileScore: 15,
            },
        });
    }

    // Return a subset of user data, similar to getUserById for consistency
    return getUserById(newUser.id);
}
