// API Client for Firm Portal

import type { APIResponse, Conversation, ConversationDetail, User, FirmAnalytics, FirmSettings, SearchResult } from '@/types/api';

export class LexaraAPIClient {
  private baseURL: string;
  private getAuthToken: () => Promise<string | null>;

  constructor(baseURL: string, getAuthToken: () => Promise<string | null>) {
    this.baseURL = baseURL;
    this.getAuthToken = getAuthToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const token = await this.getAuthToken();
    
    const url = `${this.baseURL}${endpoint}`;
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...options.headers,
    });

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: data.error?.message || `Request failed with status ${response.status}`,
            details: data.error?.details
          }
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed'
        }
      };
    }
  }

  // Conversation endpoints
  async getConversations(filters?: {
    status?: string;
    assignedTo?: string;
    practiceArea?: string;
    limit?: number;
    offset?: number;
    page?: number;
    search?: string;
    period?: string;
  }): Promise<APIResponse<{ conversations: Conversation[]; total: number; hasMore: boolean }>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `/api/v1/conversations${params.toString() ? `?${params}` : ''}`;
    return this.request(endpoint);
  }

  async getConversation(sessionId: string): Promise<APIResponse<{ conversation: ConversationDetail }>> {
    return this.request(`/api/v1/conversations/${sessionId}`);
  }

  async createConversation(data: {
    clientName: string;
    clientEmail?: string;
    practiceArea: string;
  }): Promise<APIResponse<{ conversation: Conversation }>> {
    return this.request('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addMessage(sessionId: string, message: {
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
  }): Promise<APIResponse<{ conversation: ConversationDetail }>> {
    return this.request(`/api/v1/conversations/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }),
    });
  }

  async assignConversation(sessionId: string, assignedTo: string): Promise<APIResponse<{ conversation: Conversation }>> {
    return this.request(`/api/v1/firm/conversations/${sessionId}/assignment`, {
      method: 'PUT',
      body: JSON.stringify({ assignedTo }),
    });
  }

  async updateConversationStatus(sessionId: string, status: string): Promise<APIResponse<{ conversation: Conversation }>> {
    return this.request(`/api/v1/firm/conversations/${sessionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // User endpoints
  async getUsers(): Promise<APIResponse<{ users: User[]; total: number }>> {
    return this.request('/api/v1/firm/users');
  }

  async createUser(userData: {
    email: string;
    name: string;
    role: 'attorney' | 'paralegal' | 'admin';
  }): Promise<APIResponse<{ user: User }>> {
    return this.request('/api/v1/firm/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Analytics endpoints
  async getAnalytics(options?: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<APIResponse<any>> {
    const params = new URLSearchParams();
    if (options?.period) params.append('period', options.period);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    
    const endpoint = `/api/v1/analytics${params.toString() ? `?${params}` : ''}`;
    return this.request(endpoint);
  }

  async getFirmAnalytics(dateRange?: {
    startDate?: string;
    endDate?: string;
  }): Promise<APIResponse<{ analytics: FirmAnalytics }>> {
    const params = new URLSearchParams();
    if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange?.endDate) params.append('endDate', dateRange.endDate);
    
    const endpoint = `/api/v1/analytics${params.toString() ? `?${params}` : ''}`;
    return this.request(endpoint);
  }

  async getPracticeAreaAnalytics(): Promise<APIResponse<{ practiceAreaMetrics: any[] }>> {
    return this.request('/api/v1/analytics/practice-areas');
  }

  async getRecentActivity(options?: {
    limit?: number;
  }): Promise<APIResponse<{ activities: any[] }>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    
    const endpoint = `/api/v1/activity${params.toString() ? `?${params}` : ''}`;
    return this.request(endpoint);
  }

  // Search endpoints
  async searchConversations(query: string, filters?: {
    practiceArea?: string;
    status?: string;
    limit?: number;
  }): Promise<APIResponse<{ conversations: SearchResult[]; scores: number[]; total: number }>> {
    const params = new URLSearchParams({ q: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    
    return this.request(`/api/v1/firm/search/conversations?${params}`);
  }

  // Settings endpoints
  async getFirmSettings(): Promise<APIResponse<{ settings: FirmSettings }>> {
    return this.request('/api/v1/firm/settings');
  }

  async updateFirmSettings(section: string, settings: any): Promise<APIResponse<{ settings: FirmSettings }>> {
    return this.request(`/api/v1/firm/settings/${section}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Health check
  async healthCheck(): Promise<APIResponse<{ status: string; timestamp: string; version: string }>> {
    return this.request('/health');
  }
}

// Singleton instance for use across the application
let apiClient: LexaraAPIClient | null = null;

export function getAPIClient(getAuthToken: () => Promise<string | null>): LexaraAPIClient {
  if (!apiClient) {
    // Use deployed API for production, localhost for development
    const baseURL = import.meta.env.API_BASE_URL || 'https://lexara-api-demo.cloudswift.workers.dev';
    apiClient = new LexaraAPIClient(baseURL, getAuthToken);
  }
  return apiClient;
}

// Factory function for creating API client with Auth0 token
export async function createAPIClient(): Promise<LexaraAPIClient> {
  const { getAccessToken } = await import('@/utils/auth');
  return getAPIClient(getAccessToken);
}