// Core system types for Engage Legal AI Platform

/// <reference types="@cloudflare/workers-types" />

// Environment types for Cloudflare Workers
export interface Env {
  // Cloudflare bindings
  CONVERSATION_SESSION: DurableObjectNamespace;
  USER_IDENTITY: DurableObjectNamespace;
  PLATFORM_SESSION: DurableObjectNamespace;
  PLATFORM_AUDIT_LOG: DurableObjectNamespace;
  FIRM_REGISTRY: DurableObjectNamespace;
  
  // Vectorize databases
  SUPPORTING_DOCUMENTS: VectorizeIndex;
  CONFLICT_DATABASE: VectorizeIndex;
  
  // Workers AI
  AI: Ai;
  
  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  ANTHROPIC_API_KEY: string;
  
  // Auth0 configuration
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_AUDIENCE: string;
  
  // Platform admin configuration
  PLATFORM_ADMIN_CLIENT_ID: string;
  PLATFORM_ADMIN_DOMAIN: string;
  PLATFORM_ADMIN_AUDIENCE: string;
}

// Common utility types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Error handling types
export interface ErrorContext {
  operation?: string;
  userId?: string;
  firmId?: string;
  requestId?: string;
  [key: string]: unknown;
}