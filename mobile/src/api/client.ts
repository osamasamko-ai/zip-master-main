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

  getFeedPosts() {
    return this.request<any[]>('/api/app/feed?limit=10');
  }

  async askAi(question: string, history: Array<{ role: string; content: string }> = []) {
    return this.request<{ answer?: string; response?: string; content?: string }>('/api/legal/ask', {
      method: 'POST',
      body: JSON.stringify({ question, message: question, history, tone: 'simple' }),
    });
  }
}

export const apiClient = new ApiClient();
