const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('cashflow_token');
  }

  setToken(token: string) {
    localStorage.setItem('cashflow_token', token);
  }

  clearToken() {
    localStorage.removeItem('cashflow_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // use fallback
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    this.clearToken();
  }

  async register(name: string, email: string, password: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // Dashboard
  async getDashboardSummary() {
    return this.request<any>('/dashboard/summary');
  }

  async getCashFlow(months = 6) {
    return this.request<any[]>(`/dashboard/cash-flow?months=${months}`);
  }

  // Transactions
  async getTransactions(params: Record<string, string | number> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });
    return this.request<{ items: any[]; pagination: any }>(`/transactions?${query.toString()}`);
  }

  async createTransaction(data: any) {
    return this.request<any>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reclassifyTransaction(id: string, categoryId: string) {
    return this.request<any>(`/transactions/${id}/reclassify`, {
      method: 'POST',
      body: JSON.stringify({ categoryId }),
    });
  }

  async updateTransaction(id: string, data: any) {
    return this.request<any>(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTransaction(id: string) {
    return this.request<any>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategories() {
    return this.request<any[]>('/categories');
  }

  async createCategory(data: any) {
    return this.request<any>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: any) {
    return this.request<any>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string) {
    return this.request<any>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Accounts
  async getAccounts() {
    return this.request<any[]>('/accounts');
  }

  async createAccount(data: any) {
    return this.request<any>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccount(id: string, data: any) {
    return this.request<any>(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Budgets
  async getBudgets() {
    return this.request<any[]>('/budgets');
  }

  async createBudget(data: any) {
    return this.request<any>('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBudget(id: string, data: any) {
    return this.request<any>(`/budgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBudget(id: string) {
    return this.request<any>(`/budgets/${id}`, {
      method: 'DELETE',
    });
  }

  // Savings Goals
  async getSavingsGoals() {
    return this.request<any[]>('/savings-goals');
  }

  async createSavingsGoal(data: any) {
    return this.request<any>('/savings-goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSavingsGoal(id: string, data: any) {
    return this.request<any>(`/savings-goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSavingsGoal(id: string) {
    return this.request<any>(`/savings-goals/${id}`, {
      method: 'DELETE',
    });
  }

  // Rules
  async getRules() {
    return this.request<any[]>('/categorization-rules');
  }

  async createRule(data: any) {
    return this.request<any>('/categorization-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRule(id: string, data: any) {
    return this.request<any>(`/categorization-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRule(id: string) {
    return this.request<any>(`/categorization-rules/${id}`, {
      method: 'DELETE',
    });
  }

  async applyRules() {
    return this.request<any>('/categorization-rules/apply', {
      method: 'POST',
    });
  }

  // Bank Integration / Sync
  async triggerSync(days = 1) {
    return this.request<any>('/integrations/sync', {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  }

  async getIntegrationStatus() {
    return this.request<any>('/integrations/status');
  }

  async getSyncRuns() {
    return this.request<any[]>('/integrations/sync-runs');
  }

  async getReconciliationStatus() {
    return this.request<any>('/reconciliation/status');
  }

  async runReconciliation(lookbackDays = 2) {
    return this.request<any>('/reconciliation/run', {
      method: 'POST',
      body: JSON.stringify({ lookbackDays }),
    });
  }

  async calibrateBalance(balance: number, accountNumber = '1468651509999') {
    return this.request<any>('/integrations/calibrate-balance', {
      method: 'POST',
      body: JSON.stringify({ balance, accountNumber }),
    });
  }

  // Analytics & Gemini AI Forecast
  async getAnalyticsConfig() {
    return this.request<any>('/analytics/config');
  }

  async getCategoryReport(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    return this.request<any>(`/analytics/report${query ? `?${query}` : ''}`);
  }

  async runAnalytics(options: any) {
    return this.request<any>('/analytics/analyze', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getLatestForecast() {
    return this.request<any>('/analytics/latest');
  }

  async getForecast(refresh = false) {
    return this.request<any>(`/analytics/forecast${refresh ? '?refresh=true' : ''}`);
  }
}

export const api = new ApiClient();
