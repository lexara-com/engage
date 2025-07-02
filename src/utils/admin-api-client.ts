// Admin API Client for making authenticated requests to the Admin API

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ConversationFilters extends PaginationParams {
  status?: string;
  priority?: string;
  assignedTo?: string;
  conflictStatus?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export class AdminApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.getToken = getToken;
  }

  private async request<T>(
    method: string,
    path: string,
    data?: any,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Build URL with query params
    const url = new URL(`${this.baseUrl}${path}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      });
    }

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url.toString(), options);

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          error: 'request_failed',
          message: `Request failed with status ${response.status}`,
        }));
        throw error;
      }

      // Handle empty responses
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error && typeof error === 'object' && 'error' in error) {
        throw error; // Re-throw API errors
      }
      throw {
        error: 'network_error',
        message: 'Failed to connect to the API',
        details: error,
      };
    }
  }

  // Conversation endpoints
  async listConversations(firmId: string, filters?: ConversationFilters) {
    const queryParams: Record<string, string> = {};
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams[key] = String(value);
        }
      });
    }

    return this.request<{
      conversations: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>('GET', `/firms/${firmId}/conversations`, undefined, queryParams);
  }

  async getConversation(firmId: string, conversationId: string) {
    return this.request<any>('GET', `/firms/${firmId}/conversations/${conversationId}`);
  }

  async updateConversation(firmId: string, conversationId: string, updates: {
    status?: string;
    priority?: string;
    assignedTo?: string | null;
    tags?: string[];
  }) {
    return this.request<any>('PUT', `/firms/${firmId}/conversations/${conversationId}`, updates);
  }

  async addNote(firmId: string, conversationId: string, content: string) {
    return this.request<any>('POST', `/firms/${firmId}/conversations/${conversationId}/notes`, {
      content,
    });
  }

  async performAction(firmId: string, conversationId: string, action: string, data?: any) {
    return this.request<any>('POST', `/firms/${firmId}/conversations/${conversationId}/actions`, {
      action,
      ...data,
    });
  }

  async deleteConversation(firmId: string, conversationId: string) {
    return this.request<void>('DELETE', `/firms/${firmId}/conversations/${conversationId}`);
  }

  // Firm endpoints
  async getFirm(firmId: string) {
    return this.request<any>('GET', `/firms/${firmId}`);
  }

  async updateFirm(firmId: string, updates: any) {
    return this.request<any>('PUT', `/firms/${firmId}`, updates);
  }

  // Conflict endpoints
  async listConflicts(firmId: string, filters?: PaginationParams) {
    const queryParams: Record<string, string> = {};
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams[key] = String(value);
        }
      });
    }

    return this.request<{
      conflicts: any[];
      pagination: any;
    }>('GET', `/firms/${firmId}/conflicts`, undefined, queryParams);
  }

  async addConflict(firmId: string, conflict: any) {
    return this.request<any>('POST', `/firms/${firmId}/conflicts`, conflict);
  }

  async updateConflict(firmId: string, conflictId: string, updates: any) {
    return this.request<any>('PUT', `/firms/${firmId}/conflicts/${conflictId}`, updates);
  }

  async deleteConflict(firmId: string, conflictId: string) {
    return this.request<void>('DELETE', `/firms/${firmId}/conflicts/${conflictId}`);
  }

  // Supporting documents endpoints
  async listDocuments(firmId: string, filters?: PaginationParams) {
    const queryParams: Record<string, string> = {};
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams[key] = String(value);
        }
      });
    }

    return this.request<{
      documents: any[];
      pagination: any;
    }>('GET', `/firms/${firmId}/documents`, undefined, queryParams);
  }

  async uploadDocument(firmId: string, document: any) {
    return this.request<any>('POST', `/firms/${firmId}/documents`, document);
  }

  async updateDocument(firmId: string, documentId: string, updates: any) {
    return this.request<any>('PUT', `/firms/${firmId}/documents/${documentId}`, updates);
  }

  async deleteDocument(firmId: string, documentId: string) {
    return this.request<void>('DELETE', `/firms/${firmId}/documents/${documentId}`);
  }

  // Guidelines endpoints
  async listGuidelines(firmId: string) {
    return this.request<{
      guidelines: any[];
    }>('GET', `/firms/${firmId}/guidelines`);
  }

  async addGuideline(firmId: string, guideline: any) {
    return this.request<any>('POST', `/firms/${firmId}/guidelines`, guideline);
  }

  async updateGuideline(firmId: string, guidelineId: string, updates: any) {
    return this.request<any>('PUT', `/firms/${firmId}/guidelines/${guidelineId}`, updates);
  }

  async deleteGuideline(firmId: string, guidelineId: string) {
    return this.request<void>('DELETE', `/firms/${firmId}/guidelines/${guidelineId}`);
  }

  // Health check
  async health() {
    return this.request<{
      status: string;
      service: string;
      version: string;
      timestamp: string;
    }>('GET', '/health');
  }
}

// Helper function to get token from cookie
export function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'admin_token') {
      return value;
    }
  }
  return null;
}

// Create a singleton instance for browser usage
let apiClient: AdminApiClient | null = null;

export function getAdminApiClient(): AdminApiClient {
  if (!apiClient) {
    const baseUrl = import.meta.env.PUBLIC_ADMIN_API_URL || 'http://localhost:8787/v1/admin';
    apiClient = new AdminApiClient(baseUrl, getTokenFromCookie);
  }
  return apiClient;
}