import axios, { AxiosInstance } from 'axios';

interface ApiResponse<T> {
    data: T;
    message?: string;
}

class ApiClient {
    private client: AxiosInstance;
    private token: string | null = null;

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

        // Load token from localStorage on initialization
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('auth_token');
        }
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getToken(): string | null {
        return this.token;
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
        const response = await this.client.get('/api/app/dashboard');
        return response.data;
    }

    async addCreditBalance(data: { amount: number; paymentMethod: string; note?: string }): Promise<ApiResponse<any>> {
        const response = await this.client.post('/api/app/billing/top-up', data);
        return response.data;
    }

    async getSettings(): Promise<ApiResponse<any>> {
        const response = await this.client.get('/api/app/settings');
        return response.data;
    }

    async updateSettingsProfile(data: any): Promise<ApiResponse<any>> {
        const response = await this.client.put('/api/app/settings/profile', data);
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
        const response = await this.client.get('/api/app/lawyers', { params: { search } });
        return response.data;
    }

    async getFollowing(): Promise<ApiResponse<any[]>> {
        const response = await this.client.get('/api/app/following');
        return response.data;
    }

    async getLawyerProfile(id: string): Promise<ApiResponse<any>> {
        const response = await this.client.get(`/api/app/lawyers/${id}`);
        return response.data;
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

    async signCaseDocument(caseId: string, documentId: string): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/documents/${documentId}/sign`);
        return response.data;
    }

    async addCaseMessage(caseId: string, text: string, senderRole: string = 'user'): Promise<ApiResponse<any>> {
        const response = await this.client.post(`/api/app/workspace/cases/${caseId}/messages`, { text, senderRole });
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
        const response = await this.client.post('/api/legal/generate-contract', data);
        return response.data;
    }
}

export default new ApiClient();
