import axios, { AxiosInstance } from 'axios';
import { optimizeImageForUpload } from '../utils/mediaOptimization';

interface ApiResponse<T> {
    data: T;
    message?: string;
}

class ApiClient {
    private client: AxiosInstance;
    private token: string | null = null;
    private cache = new Map<string, { timestamp: number; payload: any }>();
    private inflight = new Map<string, Promise<any>>();
    private cacheTtlMs = 20_000;

    constructor(baseURL: string = '') {
        this.client = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add token to every request
        this.client.interceptors.request.use((config) => {
            const token = this.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        this.client.interceptors.response.use((response) => {
            const method = String(response.config.method || 'get').toLowerCase();
            if (method !== 'get') {
                this.cache.clear();
                this.inflight.clear();
            }
            return response;
        });

        // Load token from localStorage on initialization
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('auth_token');
        }
    }

    setToken(token: string | null) {
        this.token = token;
        this.cache.clear();
        this.inflight.clear();
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getToken(): string | null {
        return this.token;
    }

    private async cachedGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
        const cacheKey = `${this.token || 'guest'}:${url}:${JSON.stringify(params || {})}`;
        const cached = this.cache.get(cacheKey);
        const now = Date.now();
        if (cached && now - cached.timestamp < this.cacheTtlMs) return cached.payload as T;
        const pending = this.inflight.get(cacheKey);
        if (pending) return pending as Promise<T>;

        const request = this.client.get(url, { params }).then((response) => {
            this.cache.set(cacheKey, { timestamp: Date.now(), payload: response.data });
            return response.data as T;
        }).finally(() => this.inflight.delete(cacheKey));
        this.inflight.set(cacheKey, request);
        return request;
    }

    async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
        const response = await this.client.post('/api/auth/login', { email, password });
        return response.data;
    }

    async register(email: string, password: string, name: string, role: string = 'user'): Promise<ApiResponse<{ token: string; user: any }>> {
        const response = await this.client.post('/api/auth/register', { email, password, name, role });
        return response.data;
    }

    async logout() {
        this.setToken(null);
    }

    async getUsers(): Promise<ApiResponse<any[]>> {
        const response = await this.client.get('/api/users');
        return response.data;
    }

    async updateUserProfile(id: string, data: any): Promise<ApiResponse<any>> {
        const response = await this.client.put(`/api/users/${id}`, data);
        return response.data;
    }

    async getAdminMetrics(): Promise<ApiResponse<any>> {
        const response = await this.client.get('/api/admin/metrics');
        return response.data;
    }

    async getAdminIntelligence(): Promise<ApiResponse<any>> {
        const response = await this.client.get('/api/admin/intelligence');
        return response.data;
    }

    async getKycApplications(search?: string, status?: string): Promise<ApiResponse<any[]>> {
        const response = await this.client.get('/api/kyc/applications', {
            params: { search, status },
        });
        return response.data;
    }

    async updateKycApplication(id: string, status: string): Promise<ApiResponse<any>> {
        const response = await this.client.put(`/api/kyc/applications/${id}`, { status });
        return response.data;
    }

    async getCurrentUser(): Promise<ApiResponse<any>> {
        const response = await this.client.get('/api/me');
        return response.data;
    }

    async getDashboard(): Promise<ApiResponse<any>> {
        return this.cachedGet<ApiResponse<any>>('/api/app/dashboard');
    }

    async trackEvent(event: { name: string; page: string; resourceId?: string | null; metadata?: any }): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/events', event);
        return response.data;
    }

    async trackEvents(events: Array<{ name: string; page: string; resourceId?: string | null; metadata?: any }>): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/events', { events });
        return response.data;
    }

    async getIntelligence(): Promise<ApiResponse<any>> {
        return this.cachedGet<ApiResponse<any>>('/api/app/intelligence');
    }

    async addCreditBalance(data: { amount: number; paymentMethod: string; note?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/billing/top-up', data);
        return response.data;
    }

    async getSettings(): Promise<ApiResponse<any>> {
        return this.cachedGet<ApiResponse<any>>('/api/app/settings');
    }

    async updateSettingsProfile(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.put('/api/app/settings/profile', data);
        return response.data;
    }

    async uploadProfileMedia(kind: 'avatar' | 'cover', file: File): Promise<ApiResponse<any>> {
        const uploadFile = await optimizeImageForUpload(file);
        const formData = new FormData();
        formData.append('kind', kind);
        formData.append('image', uploadFile);
        const response = await this.client.post('/api/app/profile/media', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    async updateSettingsPreferences(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.put('/api/app/settings/preferences', data);
        return response.data;
    }

    async updatePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/settings/password', { currentPassword, newPassword });
        return response.data;
    }

    async revokeSession(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.delete(`/api/app/settings/sessions/${id}`);
        return response.data;
    }

    async getLawyers(search?: string): Promise<ApiResponse<any[]>> {
        return this.cachedGet<ApiResponse<any[]>>('/api/app/lawyers', { search });
    }

    async getFollowing(): Promise<ApiResponse<any[]>> {
        return this.cachedGet<ApiResponse<any[]>>('/api/app/following');
    }

    async getLawyerProfile(id: string): Promise<ApiResponse<any>> {
        return this.cachedGet<ApiResponse<any>>(`/api/app/lawyers/${id}`);
    }

    async followLawyer(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/lawyers/${id}/follow`);
        return response.data;
    }

    async unfollowLawyer(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.delete(`/api/app/lawyers/${id}/follow`);
        return response.data;
    }

    async startLawyerConsultation(id: string, data: { paymentMethod: string; note?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/lawyers/${id}/consultation`, data);
        return response.data;
    }

    async getWorkspaceCases(): Promise<ApiResponse<any[]>> {
        const response = await this.client.get('/api/app/workspace/cases');
        return response.data;
    }

    async createWorkspaceCase(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/workspace/cases', data);
        return response.data;
    }

    async toggleWorkspaceCaseArchive(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${id}/archive`);
        return response.data;
    }

    async deleteWorkspaceCase(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.delete(`/api/app/workspace/cases/${id}`);
        return response.data;
    }

    async addCaseCollaborator(caseId: string, data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/collaborators`, data);
        return response.data;
    }

    async removeCaseCollaborator(caseId: string, collaboratorId: string): Promise<ApiResponse<any>> {
        const response = await this.client.delete(`/api/app/workspace/cases/${caseId}/collaborators/${collaboratorId}`);
        return response.data;
    }

    async addCaseFolder(caseId: string, name: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/folders`, { name });
        return response.data;
    }

    async addCaseCustomField(caseId: string, label: string, value: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/custom-fields`, { label, value });
        return response.data;
    }

    async moveCaseDocuments(caseId: string, documentIds: string[], folderId: string | null): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/documents/move`, { documentIds, folderId });
        return response.data;
    }

    async addCaseDocument(caseId: string, data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/documents`, data);
        return response.data;
    }

    async publishCaseMarketplaceListing(data: FormData): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/case-marketplace', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    async getClientCaseMarketplaceListings(): Promise<ApiResponse<any[]>> {
        const response = await this.cachedGet<ApiResponse<any[]>>('/api/app/case-marketplace/client');
        return response;
    }

    async getLawyerCaseMarketplaceListings(): Promise<ApiResponse<any[]>> {
        const response = await this.cachedGet<ApiResponse<any[]>>('/api/app/case-marketplace/lawyer');
        return response;
    }

    async respondToCaseMarketplaceListing(id: string, data: { decision: 'accept' | 'reject'; note?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/case-marketplace/${id}/respond`, data);
        return response.data;
    }

    async payCaseInstallment(caseId: string, installments: 1 | 2 | 3): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/payments`, { installments });
        return response.data;
    }

    async closeWorkspaceCase(caseId: string, summary?: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/close`, { summary });
        return response.data;
    }

    async submitCaseReview(caseId: string, data: { rating: number; text?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/review`, data);
        return response.data;
    }

    async signCaseDocument(caseId: string, documentId: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/documents/${documentId}/sign`);
        return response.data;
    }

    async addCaseMessage(caseId: string, text: string, senderRole: string = 'user'): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/messages`, { text, senderRole });
        return response.data;
    }

    async reactToCaseMessage(caseId: string, messageId: string, reaction: string | null): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/messages/${messageId}/reaction`, { reaction });
        return response.data;
    }

    async markCaseMessagesAsRead(caseId: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/mark-read`);
        return response.data;
    }

    async getProWorkspace(): Promise<ApiResponse<any>> {
        const response = await this.client.get('/api/app/pro/workspace');
        return response.data;
    }

    async requestProWithdrawal(data: { amount: number; payoutMethod?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/pro/workspace/withdrawals', data);
        return response.data;
    }

    async createProCase(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/pro/workspace/cases', data);
        return response.data;
    }

    async createProAppointment(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/pro/workspace/appointments', data);
        return response.data;
    }

    async uploadProVaultDocument(caseId?: string | null): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/pro/workspace/vault-upload', { caseId });
        return response.data;
    }

    async updateProMessageState(id: string, data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/pro/workspace/messages/${id}`, data);
        return response.data;
    }

    async bulkUpdateProCaseStatus(caseIds: string[], status: string): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/pro/workspace/cases/status', { caseIds, status });
        return response.data;
    }

    async bulkDeleteProCases(caseIds: string[]): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/pro/workspace/cases/delete', { caseIds });
        return response.data;
    }

    async generateCarContract(data: any): Promise<ApiResponse<{ contractText: string }>> {
        const response = await this.client.post('/api/legal/car-contract', data);
        return response.data;
    }

    async whatsappCarContract(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/legal/whatsapp-contract', data);
        return response.data;
    }

    async getContractTemplates(): Promise<ApiResponse<any[]>> {
        const response = await this.client.get('/api/app/contract-templates');
        return response.data;
    }

    async saveContractTemplate(data: { name: string; text: string }): Promise<ApiResponse<any[]>> {
        const response = await this.client.post('/api/app/contract-templates', data);
        return response.data;
    }

    async deleteContractTemplate(index: number): Promise<ApiResponse<string[]>> {
        const response = await this.client.delete('/api/app/contract-templates', { data: { index } });
        return response.data;
    }

    async saveContractToWallet(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/legal/save-contract', data);
        return response.data;
    }

    async saveDraftContract(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/legal/save-contract', { ...data, status: 'draft' });
        return response.data;
    }

    async getUserContracts(): Promise<ApiResponse<any[]>> {
        const response = await this.client.get('/api/legal/contracts');
        return response.data;
    }

    async requestContractReview(data: { lawyerId: string; contractId?: string; notes?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/legal/request-review', data);
        return response.data;
    }

    async uploadContractPdf(blob: Blob): Promise<ApiResponse<{ url: string }>> {
        const formData = new FormData();
        formData.append('pdf', blob, 'contract.pdf');
        const response = await this.client.post('/api/legal/upload-contract-pdf', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }

    async scheduleContractReminder(data: { contractId: string; phone: string; name: string; hours: number }): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/legal/schedule-reminder', data);
        return response.data;
    }

    async applyPromoCode(code: string): Promise<ApiResponse<{ discountAmount: number; message: string }>> {
        const response = await this.client.post('/api/promo/apply', { code });
        return response.data;
    }

    async payFromWallet(amount: number, serviceName: string, promoCode?: string): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/billing/pay-wallet', { amount, serviceName, promoCode });
        return response.data;
    }

    async processZainCashPayment(amount: number, serviceId: string): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/payments/zain-cash', { amount, serviceId });
        return response.data;
    }

    async sendSupportRequest(data: { name: string; phone: string; subject: string; message: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/support/request', data);
        return response.data;
    }

    async getFeedPosts(filter: string = 'all', options: { limit?: number; offset?: number } = {}): Promise<ApiResponse<any[]> & { meta?: any }> {
        return this.cachedGet<ApiResponse<any[]> & { meta?: any }>('/api/app/feed', { filter, ...options });
    }

    async getFeedStories(mode: 'active' | 'archive' | 'all' = 'all'): Promise<ApiResponse<any[]>> {
        return this.cachedGet<ApiResponse<any[]>>('/api/app/feed/stories', { mode });
    }

    async markFeedStoryViewed(storyId: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/feed/stories/${storyId}/view`);
        return response.data;
    }

    async createFeedStory(data: { text: string; media?: File | null }): Promise<ApiResponse<any>> {
        const formData = new FormData();
        formData.append('text', data.text);
        if (data.media) formData.append('media', await optimizeImageForUpload(data.media));
        const response = await this.client.post('/api/app/feed/stories', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    async createFeedPost(data: { content: string; category?: string; media?: File | null }): Promise<ApiResponse<any>> {
        const formData = new FormData();
        formData.append('content', data.content);
        if (data.category) formData.append('category', data.category);
        if (data.media) formData.append('media', await optimizeImageForUpload(data.media));
        const response = await this.client.post('/api/app/feed', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    async updateFeedPost(id: string, data: { content?: string; status?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.put(`/api/app/feed/${id}`, data);
        return response.data;
    }

    async deleteFeedPost(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.delete(`/api/app/feed/${id}`);
        return response.data;
    }

    async likeFeedPost(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/feed/${id}/like`);
        return response.data;
    }

    async saveFeedPost(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/feed/${id}/save`);
        return response.data;
    }

    async shareFeedPost(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/feed/${id}/share`);
        return response.data;
    }

    async addFeedComment(id: string, content: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/feed/${id}/comments`, { content });
        return response.data;
    }
}

export default new ApiClient();
