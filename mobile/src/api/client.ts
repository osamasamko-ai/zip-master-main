export type Role = 'user' | 'pro' | 'admin';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  verified?: boolean;
  avatar?: string;
  img?: string;
  accountBalance?: number;
};

type ApiEnvelope<T> = {
  data: T;
  message?: string;
  error?: string;
};

const fallbackApiUrl = 'http://127.0.0.1:3000';

class ApiClient {
  private token: string | null = null;
  private baseUrl = process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiEnvelope<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || 'Request failed');
    }

    return payload;
  }

  login(email: string, password: string) {
    return this.request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  register(email: string, password: string, name: string, role: Role = 'user') {
    return this.request<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
  }

  getDashboard() {
    return this.request<any>('/api/app/dashboard');
  }

  getLawyers(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/api/app/lawyers${query}`);
  }

  getWorkspaceCases() {
    return this.request<any[]>('/api/app/workspace/cases');
  }

  getSettings() {
    return this.request<any>('/api/app/settings');
  }

  updateSettingsProfile(data: any) {
    return this.request<any>('/api/app/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  updateSettingsPreferences(data: any) {
    return this.request<any>('/api/app/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  addCreditBalance(data: { amount: number; paymentMethod: string; note?: string }) {
    return this.request<any>('/api/app/billing/top-up', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getFeedPosts() {
    return this.request<any[]>('/api/app/feed?limit=10');
  }

  createFeedPost(content: string, category = 'عام') {
    return this.request<any>('/api/app/feed', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    });
  }

  likeFeedPost(id: string) {
    return this.request<any>(`/api/app/feed/${id}/like`, { method: 'POST' });
  }

  getFollowing() {
    return this.request<any[]>('/api/app/following');
  }

  followLawyer(id: string) {
    return this.request<any>(`/api/app/lawyers/${id}/follow`, { method: 'POST' });
  }

  unfollowLawyer(id: string) {
    return this.request<any>(`/api/app/lawyers/${id}/follow`, { method: 'DELETE' });
  }

  startLawyerConsultation(id: string, data: { paymentMethod: string; note?: string }) {
    return this.request<any>(`/api/app/lawyers/${id}/consultation`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  createWorkspaceCase(data: any) {
    return this.request<any>('/api/app/workspace/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  addCaseMessage(caseId: string, text: string, senderRole = 'user') {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, senderRole }),
    });
  }

  getLegalDocs() {
    return this.request<any[]>('/api/legal/docs');
  }

  getUserContracts() {
    return this.request<any[]>('/api/legal/contracts');
  }

  getContractTemplates() {
    return this.request<any[]>('/api/app/contract-templates');
  }

  generateCarContract(data: any) {
    return this.request<{ contractText: string }>('/api/legal/car-contract', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  saveDraftContract(data: any) {
    return this.request<any>('/api/legal/save-contract', {
      method: 'POST',
      body: JSON.stringify({ ...data, status: 'draft' }),
    });
  }

  payFromWallet(amount: number, serviceName: string, promoCode?: string) {
    return this.request<any>('/api/app/billing/pay-wallet', {
      method: 'POST',
      body: JSON.stringify({ amount, serviceName, promoCode }),
    });
  }

  applyPromoCode(code: string) {
    return this.request<{ discountAmount: number; message: string }>('/api/promo/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  sendSupportRequest(data: { name: string; phone: string; subject: string; message: string }) {
    return this.request<any>('/api/support/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getIntelligence() {
    return this.request<any>('/api/app/intelligence');
  }

  getProWorkspace() {
    return this.request<any>('/api/app/pro/workspace');
  }

  getAdminMetrics() {
    return this.request<any>('/api/admin/metrics');
  }

  async askAi(question: string, history: Array<{ role: string; content: string }> = []) {
    return this.request<{ answer?: string; response?: string; content?: string }>('/api/legal/ask', {
      method: 'POST',
      body: JSON.stringify({ question, message: question, history, tone: 'simple' }),
    });
  }
}

export const apiClient = new ApiClient();
