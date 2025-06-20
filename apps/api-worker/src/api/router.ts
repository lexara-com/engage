/**
 * API Router - Central request routing and hybrid data layer orchestration
 * 
 * This router implements the core hybrid data strategy:
 * - List operations → D1 indexes (fast SQL queries)
 * - Detail operations → Durable Objects (source of truth)
 * - Analytics operations → D1 aggregations
 * - Search operations → Vectorize + D1
 * - Write operations → Durable Objects + async D1 sync
 */

import { Hono } from 'hono';
import type { Env } from './api-worker';

// Route handlers
import { conversationRoutes } from '@/routes/firm/conversations';
import { userRoutes } from '@/routes/firm/users';
import { assignmentRoutes } from '@/routes/firm/assignments';
import { analyticsRoutes } from '@/routes/firm/analytics';
import { conflictRoutes } from '@/routes/firm/conflicts';
import { searchRoutes } from '@/routes/firm/search';
import { auditRoutes } from '@/routes/firm/audit';
import { settingsRoutes } from '@/routes/firm/settings';

import { platformFirmRoutes } from '@/routes/platform/firms';
import { platformUserRoutes } from '@/routes/platform/users';
import { platformAnalyticsRoutes } from '@/routes/platform/analytics';
import { systemRoutes } from '@/routes/platform/system';

import { webhookRoutes } from '@/routes/common/webhooks';

export class APIRouter {
  
  /**
   * Get firm-scoped API routes
   * All routes automatically scoped to authenticated firm context
   */
  getFirmRoutes(): Hono<{ Bindings: Env }> {
    const firm = new Hono<{ Bindings: Env }>();
    
    // Conversation management
    firm.route('/conversations', conversationRoutes);
    
    // User & identity management
    firm.route('/users', userRoutes);
    
    // Case assignment & workload
    firm.route('/assignments', assignmentRoutes);
    
    // Analytics & reporting
    firm.route('/analytics', analyticsRoutes);
    
    // Conflict detection & resolution
    firm.route('/conflicts', conflictRoutes);
    
    // Search & discovery
    firm.route('/search', searchRoutes);
    
    // Audit & compliance
    firm.route('/audit', auditRoutes);
    
    // Firm configuration
    firm.route('/settings', settingsRoutes);
    
    return firm;
  }
  
  /**
   * Get platform admin API routes
   * Restricted to Lexara employees only
   */
  getPlatformRoutes(): Hono<{ Bindings: Env }> {
    const platform = new Hono<{ Bindings: Env }>();
    
    // Platform firm management
    platform.route('/firms', platformFirmRoutes);
    
    // Platform user management
    platform.route('/users', platformUserRoutes);
    
    // Platform analytics
    platform.route('/analytics', platformAnalyticsRoutes);
    
    // System health & monitoring
    platform.route('/system', systemRoutes);
    
    return platform;
  }
  
  /**
   * Get webhook API routes
   * For external system integrations
   */
  getWebhookRoutes(): Hono<{ Bindings: Env }> {
    const webhooks = new Hono<{ Bindings: Env }>();
    
    // Practice management system webhooks
    webhooks.route('/', webhookRoutes);
    
    return webhooks;
  }
}

/**
 * Data Layer Routing Utility
 * Determines which data layer to use based on operation type
 */
export class HybridDataRouter {
  
  /**
   * Determine if request should route to D1 indexes
   * Used for list operations and analytics
   */
  static shouldUseD1(method: string, pathname: string): boolean {
    // List operations (GET /conversations, /users, etc.)
    if (method === 'GET' && this.isListEndpoint(pathname)) {
      return true;
    }
    
    // Analytics operations (GET /analytics/*, /reports/*)
    if (method === 'GET' && this.isAnalyticsEndpoint(pathname)) {
      return true;
    }
    
    // Audit log queries (GET /audit/*)
    if (method === 'GET' && this.isAuditEndpoint(pathname)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine if request should route to Durable Objects
   * Used for detail operations and all writes
   */
  static shouldUseDurableObjects(method: string, pathname: string): boolean {
    // Detail operations (GET /conversations/{id}, /users/{id})
    if (method === 'GET' && this.isDetailEndpoint(pathname)) {
      return true;
    }
    
    // All write operations (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine if request should route to Vectorize
   * Used for search and conflict detection
   */
  static shouldUseVectorize(method: string, pathname: string): boolean {
    // Search operations
    if (pathname.includes('/search/')) {
      return true;
    }
    
    // Conflict detection
    if (pathname.includes('/conflicts/check')) {
      return true;
    }
    
    return false;
  }
  
  private static isListEndpoint(pathname: string): boolean {
    const listPatterns = [
      /\/conversations$/,
      /\/users$/,
      /\/assignments$/,
      /\/conflicts$/,
      /\/audit$/
    ];
    
    return listPatterns.some(pattern => pattern.test(pathname));
  }
  
  private static isDetailEndpoint(pathname: string): boolean {
    const detailPatterns = [
      /\/conversations\/[^/]+$/,
      /\/users\/[^/]+$/,
      /\/assignments\/[^/]+$/,
      /\/conflicts\/[^/]+$/
    ];
    
    return detailPatterns.some(pattern => pattern.test(pathname));
  }
  
  private static isAnalyticsEndpoint(pathname: string): boolean {
    return pathname.includes('/analytics/') || 
           pathname.includes('/reports/') ||
           pathname.includes('/workload');
  }
  
  private static isAuditEndpoint(pathname: string): boolean {
    return pathname.includes('/audit/');
  }
}

/**
 * Request Context Enhancement
 * Adds routing metadata to request context
 */
export interface RoutingContext {
  dataLayer: 'durable-objects' | 'd1' | 'vectorize' | 'hybrid';
  cacheStrategy: 'none' | 'short' | 'medium' | 'long';
  requiresSync: boolean; // Whether DO changes need D1 sync
}

export function getRoutingContext(method: string, pathname: string): RoutingContext {
  if (HybridDataRouter.shouldUseDurableObjects(method, pathname)) {
    return {
      dataLayer: 'durable-objects',
      cacheStrategy: 'none', // Real-time data, no caching
      requiresSync: ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
    };
  }
  
  if (HybridDataRouter.shouldUseD1(method, pathname)) {
    return {
      dataLayer: 'd1',
      cacheStrategy: pathname.includes('/analytics/') ? 'medium' : 'short',
      requiresSync: false
    };
  }
  
  if (HybridDataRouter.shouldUseVectorize(method, pathname)) {
    return {
      dataLayer: 'vectorize',
      cacheStrategy: 'short',
      requiresSync: false
    };
  }
  
  return {
    dataLayer: 'hybrid',
    cacheStrategy: 'short',
    requiresSync: false
  };
}