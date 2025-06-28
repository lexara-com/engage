/**
 * API Type Definitions
 * 
 * Core types for the Lexara API including request/response schemas,
 * authentication context, and data transfer objects.
 */

import type { ConversationSession, UserIdentityState } from '@lexara/shared-types';

// ============================================================================
// Authentication & Authorization
// ============================================================================

export interface AuthenticatedFirm {
  firmId: string;
  legalName: string;
  subscription: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'churned';
  permissions: Permission[];
  rateLimit: RateLimitConfig;
}

export interface AuthenticatedUser {
  userId: string;
  auth0UserId: string;
  email: string;
  name: string;
  role: string;
  permissions: Permission[];
  lastLogin?: string;
}

export interface RequestContext {
  requestId: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  firm: AuthenticatedFirm;
  user: AuthenticatedUser;
}

export type Permission = 
  | 'view_all_conversations'
  | 'view_assigned_conversations'
  | 'manage_conversations'
  | 'delete_conversations'
  | 'assign_conversations'
  | 'view_analytics'
  | 'view_advanced_analytics'
  | 'manage_users'
  | 'manage_firm_settings'
  | 'view_audit_logs'
  | 'manage_conflicts'
  | 'export_data';

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

// ============================================================================
// Common API Patterns
// ============================================================================

export interface ListParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

export interface BulkOperationRequest<T> {
  items: T[];
  strategy: 'fail_fast' | 'continue_on_error';
}

export interface BulkOperationResponse<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: string;
  }>;
  summary: {
    totalItems: number;
    successCount: number;
    failureCount: number;
  };
}

// ============================================================================
// Conversation API Types
// ============================================================================

export interface ConversationListParams extends ListParams {
  status?: 'active' | 'completed' | 'terminated';
  assignedTo?: string;
  practiceArea?: string;
  conflictStatus?: 'clear' | 'conflict_detected' | 'pending';
  clientName?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ConversationListItem {
  sessionId: string;
  clientName?: string;
  clientEmail?: string;
  practiceArea: string;
  status: string;
  phase: string;
  assignedTo?: string;
  assignedToName?: string;
  conflictStatus: string;
  goalsCompleted: number;
  goalsTotal: number;
  dataQualityScore: number;
  lastActivity: string;
  createdAt: string;
}

export type ConversationListResponse = ListResponse<ConversationListItem>;

export interface ConversationDetailResponse extends ConversationSession {
  // Additional computed fields for API response
  assignedToName?: string;
  reviewedByName?: string;
  estimatedCompletionTime?: number;
  similarConversations?: string[];
}

export interface AddMessageRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AssignConversationRequest {
  assignedTo: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  dueDate?: string;
  estimatedHours?: number;
  notes?: string;
}

export interface UpdateConversationRequest {
  status?: 'active' | 'completed' | 'terminated';
  assignedTo?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  tags?: string[];
  notes?: string;
}

// ============================================================================
// User API Types
// ============================================================================

export interface UserListParams extends ListParams {
  role?: string;
  status?: 'active' | 'inactive' | 'suspended';
  email?: string;
}

export interface UserListItem {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLogin?: string;
  conversationCount: number;
  assignedConversationCount: number;
  createdAt: string;
}

export type UserListResponse = ListResponse<UserListItem>;

export interface UserDetailResponse extends UserIdentityState {
  // Additional computed fields
  roleName: string;
  permissions: Permission[];
  recentActivity: Array<{
    action: string;
    timestamp: string;
    resourceType: string;
    resourceId: string;
  }>;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role: string;
  auth0UserId?: string;
  permissions?: Permission[];
}

export interface UpdateUserRequest {
  name?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'suspended';
  permissions?: Permission[];
}

// ============================================================================
// Assignment API Types
// ============================================================================

export interface AssignmentListParams extends ListParams {
  assignedTo?: string;
  status?: 'pending' | 'active' | 'completed' | 'reassigned';
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  overdue?: boolean;
  practiceArea?: string;
}

export interface AssignmentListItem {
  sessionId: string;
  clientName: string;
  practiceArea: string;
  assignedTo: string;
  assignedToName: string;
  assignedAt: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  isOverdue: boolean;
}

export type AssignmentListResponse = ListResponse<AssignmentListItem>;

export interface WorkloadAnalysisResponse {
  attorneys: Array<{
    userId: string;
    name: string;
    role: string;
    activeConversations: number;
    assignedCases: number;
    avgDataQuality: number;
    avgEstimatedHours: number;
    overdueCount: number;
    capacity: 'under' | 'optimal' | 'over';
  }>;
  summary: {
    totalActiveConversations: number;
    totalAssignedCases: number;
    avgCaseLoad: number;
    overduePercentage: number;
  };
}

// ============================================================================
// Analytics API Types
// ============================================================================

export interface AnalyticsTimeRange {
  start: string;
  end: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface FirmAnalyticsRequest {
  timeRange?: AnalyticsTimeRange;
  practiceAreas?: string[];
  includeComparisons?: boolean;
}

export interface FirmAnalyticsResponse {
  summary: {
    totalConversations: number;
    activeConversations: number;
    completedThisMonth: number;
    completionRate: number;
    avgCompletionTime: number;
    avgDataQualityScore: number;
    conflictDetectionRate: number;
  };
  
  trends: {
    conversationsOverTime: Array<{
      date: string;
      count: number;
      completed: number;
    }>;
    dataQualityTrend: Array<{
      date: string;
      avgScore: number;
    }>;
  };
  
  practiceAreas: Array<{
    practiceArea: string;
    totalConversations: number;
    completedConversations: number;
    avgDataQuality: number;
    avgCompletionHours: number;
    conversionRate: number;
  }>;
  
  attorneyPerformance: Array<{
    userId: string;
    name: string;
    activeConversations: number;
    completedThisMonth: number;
    avgDataQuality: number;
    avgResponseTime: number;
  }>;
  
  conflictDetection: {
    totalConflictsDetected: number;
    confirmedConflicts: number;
    clearedConflicts: number;
    avgConfidenceScore: number;
    falsePositiveRate: number;
  };
}

// ============================================================================
// Conflict API Types
// ============================================================================

export interface ConflictCheckRequest {
  identifiers: {
    names?: string[];
    emails?: string[];
    phones?: string[];
    entities?: string[];
  };
  matterDescription?: string;
  threshold?: number;
}

export interface ConflictCheckResponse {
  status: 'clear' | 'potential_conflict' | 'confirmed_conflict';
  confidence: number;
  matches: Array<{
    type: 'client' | 'opposing_party' | 'matter' | 'entity';
    matchedEntity: string;
    confidence: number;
    conflictReason: string;
    existingMatter?: string;
    matchType: 'exact' | 'fuzzy' | 'phonetic' | 'alias';
  }>;
  requiresReview: boolean;
  recommendations: string[];
}

export interface ConflictListParams extends ListParams {
  status?: 'detected' | 'reviewing' | 'cleared' | 'confirmed';
  conflictType?: 'client' | 'opposing_party' | 'matter' | 'entity';
  unresolved?: boolean;
  confidenceMin?: number;
}

export interface ResolveConflictRequest {
  resolution: 'waived' | 'client_consented' | 'no_conflict' | 'cannot_represent';
  notes?: string;
  approvedBy?: string;
}

// ============================================================================
// Search API Types
// ============================================================================

export interface SearchParams {
  query: string;
  filters?: FilterParams;
  semanticSearch?: boolean;
  limit?: number;
}

export interface ConversationSearchParams extends SearchParams {
  practiceArea?: string;
  dateRange?: AnalyticsTimeRange;
  assignedTo?: string;
  minDataQuality?: number;
}

export interface SearchResult {
  id: string;
  type: 'conversation' | 'document' | 'knowledge';
  title: string;
  excerpt: string;
  relevanceScore: number;
  matchedFields: string[];
  metadata: Record<string, unknown>;
}

export type SearchResponse = ListResponse<SearchResult>;

// ============================================================================
// Export/Import Types
// ============================================================================

export interface ExportRequest {
  type: 'conversations' | 'users' | 'audit' | 'analytics';
  format: 'json' | 'csv' | 'pdf';
  filters?: FilterParams;
  dateRange?: AnalyticsTimeRange;
}

export interface ExportResponse {
  exportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
  recordCount?: number;
}