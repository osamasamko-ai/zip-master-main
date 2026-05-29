export type Role = 'user' | 'pro' | 'admin';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  verified?: boolean;
  licenseStatus?: string;
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
const defaultCacheTtlMs = 20_000;
const staleCacheTtlMs = 5 * 60_000;

type CacheEntry = {
  payload: ApiEnvelope<any>;
  timestamp: number;
};

class ApiClient {
  private token: string | null = null;
  private baseUrl = process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl;
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<ApiEnvelope<any>>>();

  setToken(token: string | null) {
    if (this.token !== token) {
      this.cache.clear();
      this.inflight.clear();
    }
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  getMediaUrl(value?: string | null) {
    if (!value) return '';
    if (/^(https?:|file:|data:|blob:)/i.test(value)) return value;
    return `${this.baseUrl}${value.startsWith('/') ? value : `/${value}`}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiEnvelope<T>> {
    const method = (options.method || 'GET').toUpperCase();
    const cacheKey = `${this.token || 'guest'}:${method}:${path}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    const canCache = method === 'GET';
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (canCache && cached && now - cached.timestamp < defaultCacheTtlMs) {
      return cached.payload as ApiEnvelope<T>;
    }

    if (canCache) {
      const pending = this.inflight.get(cacheKey);
      if (pending) return pending as Promise<ApiEnvelope<T>>;
    }

    const requestPromise = fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(options.headers || {}),
      },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || 'Request failed');
        }

        if (canCache) {
          this.cache.set(cacheKey, { payload, timestamp: Date.now() });
        } else {
          this.invalidateAppCache();
        }

        return payload as ApiEnvelope<T>;
      })
      .catch((error) => {
        if (canCache && cached && now - cached.timestamp < staleCacheTtlMs) {
          return cached.payload as ApiEnvelope<T>;
        }
        throw error;
      })
      .finally(() => {
        if (canCache) this.inflight.delete(cacheKey);
      });

    if (canCache) this.inflight.set(cacheKey, requestPromise);

    return requestPromise;
  }

  private invalidateAppCache() {
    this.cache.clear();
    this.inflight.clear();
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

  getLawyerProfile(id: string) {
    return this.request<any>(`/api/app/lawyers/${id}`);
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

  updatePassword(currentPassword: string, newPassword: string) {
    return this.request<any>('/api/app/settings/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  revokeSession(id: string) {
    return this.request<any>(`/api/app/settings/sessions/${id}`, { method: 'DELETE' });
  }

  addCreditBalance(data: { amount: number; paymentMethod: string; note?: string }) {
    return this.request<any>('/api/app/billing/top-up', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getFeedPosts(filter = 'all', options: { limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams({
      filter,
      limit: String(options.limit ?? 8),
      offset: String(options.offset ?? 0),
    });
    return this.request<any[]>(`/api/app/feed?${params.toString()}`);
  }

  getFeedStories(mode: 'active' | 'archive' | 'all' = 'all') {
    return this.request<any[]>(`/api/app/feed/stories?mode=${encodeURIComponent(mode)}`);
  }

  markFeedStoryViewed(storyId: string) {
    return this.request<any>(`/api/app/feed/stories/${storyId}/view`, { method: 'POST' });
  }

  createFeedStory(data: { text: string; media?: any | null }) {
    const formData = new FormData();
    formData.append('text', data.text);
    if (data.media) formData.append('media', data.media as any);

    return this.request<any>('/api/app/feed/stories', {
      method: 'POST',
      body: formData as any,
    });
  }

  createFeedPost(data: { content: string; category?: string; media?: any | null }) {
    const formData = new FormData();
    formData.append('content', data.content);
    if (data.category) formData.append('category', data.category);
    if (data.media) formData.append('media', data.media as any);

    return this.request<any>('/api/app/feed', {
      method: 'POST',
      body: formData as any,
    });
  }

  updateFeedPost(id: string, data: { content?: string; status?: string; pinned?: boolean; featured?: boolean }) {
    return this.request<any>(`/api/app/feed/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteFeedPost(id: string) {
    return this.request<any>(`/api/app/feed/${id}`, { method: 'DELETE' });
  }

  likeFeedPost(id: string) {
    return this.request<any>(`/api/app/feed/${id}/like`, { method: 'POST' });
  }

  saveFeedPost(id: string) {
    return this.request<any>(`/api/app/feed/${id}/save`, { method: 'POST' });
  }

  shareFeedPost(id: string) {
    return this.request<any>(`/api/app/feed/${id}/share`, { method: 'POST' });
  }

  addFeedComment(id: string, content: string) {
    return this.request<any>(`/api/app/feed/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
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

  toggleWorkspaceCaseArchive(id: string) {
    return this.request<any>(`/api/app/workspace/cases/${id}/archive`, {
      method: 'POST',
    });
  }

  deleteWorkspaceCase(id: string) {
    return this.request<any>(`/api/app/workspace/cases/${id}`, {
      method: 'DELETE',
    });
  }

  addCaseCollaborator(caseId: string, data: any) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  removeCaseCollaborator(caseId: string, collaboratorId: string) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    });
  }

  addCaseFolder(caseId: string, name: string) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/folders`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  addCaseCustomField(caseId: string, label: string, value: string) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/custom-fields`, {
      method: 'POST',
      body: JSON.stringify({ label, value }),
    });
  }

  moveCaseDocuments(caseId: string, documentIds: string[], folderId: string | null) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/documents/move`, {
      method: 'POST',
      body: JSON.stringify({ documentIds, folderId }),
    });
  }

  addCaseDocument(caseId: string, data: any) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  signCaseDocument(caseId: string, documentId: string) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/documents/${documentId}/sign`, {
      method: 'POST',
    });
  }

  addCaseMessage(caseId: string, text: string, senderRole = 'user') {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, senderRole }),
    });
  }

  markCaseMessagesAsRead(caseId: string) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/mark-read`, {
      method: 'POST',
    });
  }

  reactToCaseMessage(caseId: string, messageId: string, reaction: string | null) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/messages/${messageId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
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

  createProCase(data: { title: string; client: string; matter: string; priority: string }) {
    return this.request<any>('/api/app/pro/workspace/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  createProAppointment(data: { title: string; time: string; client: string; type: string; caseId?: string | null }) {
    return this.request<any>('/api/app/pro/workspace/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  uploadProVaultDocument(caseId?: string | null) {
    return this.request<any>('/api/app/pro/workspace/vault-upload', {
      method: 'POST',
      body: JSON.stringify({ caseId }),
    });
  }

  updateProMessageState(id: string, data: { unread?: boolean; awaitingResponse?: boolean }) {
    return this.request<any>(`/api/app/pro/workspace/messages/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  bulkUpdateProCaseStatus(caseIds: string[], status: string) {
    return this.request<any>('/api/app/pro/workspace/cases/status', {
      method: 'POST',
      body: JSON.stringify({ caseIds, status }),
    });
  }

  bulkDeleteProCases(caseIds: string[]) {
    return this.request<any>('/api/app/pro/workspace/cases/delete', {
      method: 'POST',
      body: JSON.stringify({ caseIds }),
    });
  }

  updateWorkspaceCaseProgress(caseId: string, progress: number) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ progress }),
    });
  }

  updateWorkspaceCasePrivateNote(caseId: string, note: string) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/private-note`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
  }

  reviewWorkspaceDocument(caseId: string, documentId: string, status: string, note?: string) {
    return this.request<any>(`/api/app/workspace/cases/${caseId}/documents/${documentId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
  }

  getAdminMetrics() {
    return this.request<any>('/api/admin/metrics');
  }

  getAdminIntelligence() {
    return this.request<any>('/api/admin/intelligence');
  }

  getAdminUsers() {
    return this.request<any[]>('/api/admin/users');
  }

  updateAdminUser(id: string, data: any) {
    return this.request<any>(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  updateAdminUserRole(id: string, role: string) {
    return this.request<any>(`/api/admin/users/${id}/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }

  toggleAdminUserBlock(id: string) {
    return this.request<any>(`/api/admin/users/${id}/block`, { method: 'POST' });
  }

  getAdminKyc() {
    return this.request<any[]>('/api/admin/kyc');
  }

  updateAdminKyc(id: string, status: string) {
    return this.request<any>(`/api/admin/kyc/${id}`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  getAdminTransactions() {
    return this.request<any[]>('/api/admin/transactions');
  }

  getAdminAlerts() {
    return this.request<any[]>('/api/admin/alerts');
  }

  getAdminAuditLogs() {
    return this.request<any[]>('/api/admin/audit-logs');
  }

  getAdminSupportTickets() {
    return this.request<any[]>('/api/admin/support-tickets');
  }

  updateAdminSupportTicket(id: string, data: any) {
    return this.request<any>(`/api/admin/support-tickets/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getAdminLegalServices() {
    return this.request<any[]>('/api/admin/legal-services');
  }

  addAdminLegalService(data: any) {
    return this.request<any>('/api/admin/legal-services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteAdminLegalService(id: string) {
    return this.request<any>(`/api/admin/legal-services/${id}`, { method: 'DELETE' });
  }

  getAdminFeatureFlags() {
    return this.request<any[]>('/api/admin/feature-flags');
  }

  updateAdminFeatureFlag(key: string, enabled: boolean) {
    return this.request<any>(`/api/admin/feature-flags/${key}`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  getAdminPolicies() {
    return this.request<any[]>('/api/admin/policies');
  }

  updateAdminPolicy(key: string, value: string) {
    return this.request<any>(`/api/admin/policies/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }

  getAdminSystemSettings() {
    return this.request<any>('/api/admin/system-settings');
  }

  updateAdminSystemSettings(data: any) {
    return this.request<any>('/api/admin/system-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getAdminAiSettings() {
    return this.request<any>('/api/admin/ai-settings');
  }

  updateAdminAiSettings(data: any) {
    return this.request<any>('/api/admin/ai-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  restartAdminAi() {
    return this.request<any>('/api/admin/ai/restart', { method: 'POST' });
  }

  getAdminPaymentGateways() {
    return this.request<any[]>('/api/admin/payment-gateways');
  }

  updateAdminPaymentGateway(key: string, enabled: boolean, feePercent?: number) {
    return this.request<any>(`/api/admin/payment-gateways/${key}`, {
      method: 'POST',
      body: JSON.stringify({ enabled, feePercent }),
    });
  }

  getAdminWorkflowSettings() {
    return this.request<any>('/api/admin/workflow-settings');
  }

  updateAdminWorkflowSettings(data: any) {
    return this.request<any>('/api/admin/workflow-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getAdminNotificationTemplates() {
    return this.request<any[]>('/api/admin/notification-templates');
  }

  updateAdminNotificationTemplate(key: string, data: any) {
    return this.request<any>(`/api/admin/notification-templates/${key}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getAdminModerationRules() {
    return this.request<any[]>('/api/admin/moderation-rules');
  }

  addAdminModerationRule(data: any) {
    return this.request<any>('/api/admin/moderation-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAdminModerationRule(id: string, data: any) {
    return this.request<any>(`/api/admin/moderation-rules/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteAdminModerationRule(id: string) {
    return this.request<any>(`/api/admin/moderation-rules/${id}`, { method: 'DELETE' });
  }

  getAdminLegalDocs() {
    return this.request<any[]>('/api/admin/legal-docs');
  }

  addAdminLegalDoc(data: any) {
    return this.request<any>('/api/admin/legal-docs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteAdminLegalDoc(id: string) {
    return this.request<any>(`/api/admin/legal-docs/${id}`, { method: 'DELETE' });
  }

  getAdminContracts() {
    return this.request<any>('/api/admin/contracts');
  }

  getAdminCategories() {
    return this.request<any[]>('/api/admin/categories');
  }

  addAdminCategory(data: any) {
    return this.request<any>('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAdminCategory(id: string, data: any) {
    return this.request<any>(`/api/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteAdminCategory(id: string) {
    return this.request<any>(`/api/admin/categories/${id}`, { method: 'DELETE' });
  }

  getAdminUploads() {
    return this.request<any[]>('/api/admin/uploads');
  }

  deleteAdminUpload(id: string) {
    return this.request<any>(`/api/admin/uploads/${id}`, { method: 'DELETE' });
  }

  getAdminPages() {
    return this.request<any[]>('/api/admin/pages');
  }

  addAdminPage(data: any) {
    return this.request<any>('/api/admin/pages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAdminPage(id: string, data: any) {
    return this.request<any>(`/api/admin/pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteAdminPage(id: string) {
    return this.request<any>(`/api/admin/pages/${id}`, { method: 'DELETE' });
  }

  addAdminPageBlock(pageId: string, data: any) {
    return this.request<any>(`/api/admin/pages/${pageId}/blocks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getAdminRoles() {
    return this.request<any[]>('/api/admin/roles');
  }

  getAdminPermissions() {
    return this.request<any[]>('/api/admin/permissions');
  }

  addAdminRole(data: any) {
    return this.request<any>('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAdminRole(id: string, data: any) {
    return this.request<any>(`/api/admin/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  updateAdminRolePermissions(id: string, permissions: string[]) {
    return this.request<any>(`/api/admin/roles/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  deleteAdminRole(id: string) {
    return this.request<any>(`/api/admin/roles/${id}`, { method: 'DELETE' });
  }

  getAdminCases() {
    return this.request<any[]>('/api/admin/cases');
  }

  updateAdminCase(id: string, data: any) {
    return this.request<any>(`/api/admin/cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  addAdminCaseTimeline(id: string, data: any) {
    return this.request<any>(`/api/admin/cases/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exportAdminCsv(type: 'kyc' | 'transactions') {
    const response = await fetch(`${this.baseUrl}/api/admin/export?type=${type}`, {
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || 'Export failed');
    }
    return response.text();
  }

  clearAdminCache() {
    return this.request<any>('/api/admin/cache/clear', { method: 'POST' });
  }

  async askAi(question: string, history: Array<{ role: string; content: string }> = [], tone: 'formal' | 'simple' | 'friendly' = 'simple') {
    return this.request<{ answer?: string; response?: string; content?: string; mode?: string; sources?: any[] }>('/api/legal/ask', {
      method: 'POST',
      body: JSON.stringify({ question, message: question, history, tone }),
    });
  }
}

export const apiClient = new ApiClient();
