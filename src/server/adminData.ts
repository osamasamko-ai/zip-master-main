import dotenv from 'dotenv';
dotenv.config();
import { prisma } from './prisma';

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
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
    const usersCount = await prisma.user.count();
    const suspiciousCount = 3; // Mocking for now, could query security log table
    return {
        activeUsers: usersCount,
        dailyVolume: 14500000,
        avgResponseTimeMs: 1180,
        ragAccuracy: 92,
        docsSynced: 870,
        suspiciousEvents: suspiciousCount,
        openEscalations: 2,
        complianceFlags: 5,
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
    });

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
        subscriptionTier: u.subscriptionTier as any,
        accountBalance: u.accountBalance,
        notes: u.notes || '',
        notificationsEnabled: u.notificationsEnabled,
        licenseStatus: (u.lawyerProfile?.licenseStatus as any) || 'pending'
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
        licenseStatus: (user.lawyerProfile?.licenseStatus as any) || 'pending'
    };
}

export async function updateUserProfile(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                name: updates.name,
                location: updates.location,
                notificationsEnabled: updates.notificationsEnabled,
                notes: updates.notes,
            },
            include: { lawyerProfile: true }
        });

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
            licenseStatus: (user.lawyerProfile?.licenseStatus as any) || 'pending'
        };
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
    return getCached('feature-flags', async () => prisma.featureFlag.findMany() as any);
}

export async function updateFeatureFlag(key: string, enabled: boolean) {
    const updated = await prisma.featureFlag.update({
        where: { key },
        data: { enabled }
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
    return getCached('system-policies', async () => prisma.systemPolicy.findMany() as any);
}

export async function updatePolicySetting(key: string, value: string) {
    const updated = await prisma.systemPolicy.update({
        where: { key },
        data: { value }
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

export function getExportCsv(type: 'kyc' | 'transactions'): string {
    if (type === 'transactions') {
        const header = 'رقم العملية,الوصف,المصدر,المبلغ,النوع,الحالة\n';
        const rows = transactionRecords
            .map((transaction) => `${transaction.id},${transaction.label},${transaction.source},${transaction.amount},${transaction.type},${transaction.status}`)
            .join('\n');
        return `${header}${rows}`;
    }

    const header = 'رقم النقابة,اسم المحامي,المدينة,المستندات,الحالة\n';
    const rows = kycApplications
        .map((application: KycApplication) =>
            `${application.id},${application.name},${application.city},"${application.attachments.join(' | ')}",${application.status}`
        )
        .join('\n');
    return `${header}${rows}`;
}

export async function getSystemSettings(): Promise<SystemSettings> {
    return getCached('system-settings', async () => prisma.systemSetting.findFirst() as any);
}

export async function updateSystemSettings(settings: Partial<SystemSettings>) {
    const current = await prisma.systemSetting.findFirst();
    const updated = await prisma.systemSetting.update({
        where: { id: current?.id },
        data: settings
    }) as any;
    invalidateCache('system-settings');
    return updated;
}

export async function getAiSettings(): Promise<AiSettings> {
    return getCached('ai-settings', async () => prisma.aiSetting.findFirst() as any);
}

export async function updateAiSettings(settings: Partial<AiSettings>) {
    const current = await prisma.aiSetting.findFirst();
    const updated = await prisma.aiSetting.update({
        where: { id: current?.id },
        data: settings
    }) as any;
    invalidateCache('ai-settings');
    return updated;
}

export async function getPaymentGateways(): Promise<PaymentGateway[]> {
    return getCached('payment-gateways', async () => prisma.paymentGateway.findMany() as any);
}

export async function updatePaymentGateway(key: string, enabled: boolean, feePercent?: number) {
    const updated = await prisma.paymentGateway.update({
        where: { key },
        data: { enabled, feePercent }
    }) as any;
    invalidateCache('payment-gateways');
    return updated;
}

export async function getWorkflowSettings(): Promise<WorkflowSettings> {
    return getCached('workflow-settings', async () => prisma.workflowSetting.findFirst() as any);
}

export async function updateWorkflowSettings(settings: Partial<WorkflowSettings>) {
    const current = await prisma.workflowSetting.findFirst();
    const updated = await prisma.workflowSetting.update({
        where: { id: current?.id },
        data: settings
    }) as any;
    invalidateCache('workflow-settings');
    return updated;
}

export async function getNotificationTemplates(): Promise<NotificationTemplate[]> {
    return getCached('notification-templates', async () => prisma.notificationTemplate.findMany() as any);
}

export async function updateNotificationTemplate(key: string, partial: Partial<NotificationTemplate>) {
    const updated = await prisma.notificationTemplate.update({
        where: { key },
        data: partial
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
    return getCached('legal-docs', async () => prisma.legalDoc.findMany() as any);
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
