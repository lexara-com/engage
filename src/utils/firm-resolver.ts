// Firm Resolution Middleware - Determines which law firm a request belongs to
// Supports subdomain, custom domain, and path-based routing

import { Firm, FirmContext, Env } from '@/types/shared';
import { createLogger } from '@/utils/logger';
import { FirmNotFoundError } from '@/utils/errors';

const logger = createLogger('FirmResolver');

export interface FirmResolutionResult {
  firmContext: FirmContext | null;
  isDefaultDemo: boolean;
  routingMethod: 'subdomain' | 'domain' | 'path' | 'default' | 'demo';
  error?: string;
}

// Default demo firm for development and testing
const DEFAULT_DEMO_FIRM: Firm = {
  firmId: 'demo_firm_01',
  name: 'Demo Law Firm',
  slug: 'demo',
  contactEmail: 'demo@lexara.com',
  branding: {
    primaryColor: '#1e40af',
    secondaryColor: '#64748b',
    fontFamily: 'Inter, sans-serif'
  },
  practiceAreas: ['personal_injury', 'employment_law', 'family_law'],
  restrictions: [],
  supportingDocuments: [],
  subscription: {
    tier: 'professional',
    status: 'active',
    monthlyConversationLimit: 1000,
    currentUsage: 0
  },
  compliance: {
    hipaaEnabled: true,
    retentionPolicyDays: 365,
    allowAnonymousChats: true,
    requireAuth0Login: false,
    enableConflictChecking: true
  },
  users: [],
  createdAt: new Date('2024-01-01'),
  lastActive: new Date(),
  isActive: true
};

// Extract subdomain from hostname
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const cleanHostname = hostname.split(':')[0];
  
  // Split by dots
  const parts = cleanHostname.split('.');
  
  // Need at least 3 parts for subdomain (sub.domain.com)
  if (parts.length < 3) return null;
  
  const subdomain = parts[0];
  
  // Ignore common prefixes
  if (['www', 'api', 'app'].includes(subdomain)) return null;
  
  return subdomain;
}

// Extract firm slug from path (for path-based routing)
function extractFirmFromPath(pathname: string): string | null {
  // Expected format: /firm/smith-associates/chat or /demo/acme-law
  const pathMatch = pathname.match(/^\/(?:firm|demo)\/([a-z0-9-]+)/);
  return pathMatch ? pathMatch[1] : null;
}

// Get FirmRegistry Durable Object
async function getFirmRegistry(env: Env): Promise<DurableObjectStub> {
  const id = env.FIRM_REGISTRY.idFromName('global-registry');
  return env.FIRM_REGISTRY.get(id);
}

// Resolve firm context from request
export async function resolveFirmContext(request: Request, env: Env): Promise<FirmResolutionResult> {
  const url = new URL(request.url);
  const hostname = url.hostname;
  const pathname = url.pathname;
  
  logger.info('Resolving firm context', { hostname, pathname });

  try {
    const firmRegistry = await getFirmRegistry(env);

    // 1. Check for subdomain routing (highest priority)
    const subdomain = extractSubdomain(hostname);
    if (subdomain) {
      logger.info('Attempting subdomain resolution', { subdomain });
      
      const response = await firmRegistry.fetch(new Request(`http://localhost/slug/${subdomain}`));
      if (response.ok) {
        const firm = await response.json() as Firm;
        return {
          firmContext: {
            firm,
            isValidDomain: true,
            subdomain
          },
          isDefaultDemo: false,
          routingMethod: 'subdomain'
        };
      }
    }

    // 2. Check for custom domain routing
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('pages.dev')) {
      logger.info('Attempting custom domain resolution', { hostname });
      
      const response = await firmRegistry.fetch(new Request(`http://localhost/domain/${hostname}`));
      if (response.ok) {
        const firm = await response.json() as Firm;
        return {
          firmContext: {
            firm,
            isValidDomain: true
          },
          isDefaultDemo: false,
          routingMethod: 'domain'
        };
      }
    }

    // 3. Check for path-based routing
    const pathFirmSlug = extractFirmFromPath(pathname);
    if (pathFirmSlug) {
      logger.info('Attempting path-based resolution', { pathFirmSlug });
      
      // Check if it's a demo request
      if (pathname.startsWith('/demo/')) {
        // Return demo firm with the requested slug styling
        const demoFirm: Firm = {
          ...DEFAULT_DEMO_FIRM,
          firmId: `demo_${pathFirmSlug}`,
          name: `${pathFirmSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Demo`,
          slug: pathFirmSlug
        };
        
        return {
          firmContext: {
            firm: demoFirm,
            isValidDomain: true
          },
          isDefaultDemo: true,
          routingMethod: 'demo'
        };
      }
      
      // Try to find actual firm
      const response = await firmRegistry.fetch(new Request(`http://localhost/slug/${pathFirmSlug}`));
      if (response.ok) {
        const firm = await response.json() as Firm;
        return {
          firmContext: {
            firm,
            isValidDomain: true
          },
          isDefaultDemo: false,
          routingMethod: 'path'
        };
      }
    }

    // 4. Default to demo firm for development
    logger.info('Using default demo firm');
    return {
      firmContext: {
        firm: DEFAULT_DEMO_FIRM,
        isValidDomain: true
      },
      isDefaultDemo: true,
      routingMethod: 'default'
    };

  } catch (error) {
    logger.error('Firm resolution failed', { error: error.message, hostname, pathname });
    
    // Fallback to demo firm on error
    return {
      firmContext: {
        firm: DEFAULT_DEMO_FIRM,
        isValidDomain: false
      },
      isDefaultDemo: true,
      routingMethod: 'default',
      error: error.message
    };
  }
}

// Create firm-aware Durable Object name
export function createFirmAwareDOName(firmId: string, sessionId: string): string {
  return `${firmId}:${sessionId}`;
}

// Extract firmId and sessionId from DO name
export function parseFirmAwareDOName(doName: string): { firmId: string; sessionId: string } | null {
  const parts = doName.split(':');
  if (parts.length !== 2) return null;
  
  return {
    firmId: parts[0],
    sessionId: parts[1]
  };
}

// Validate firm access for authenticated user
export function validateFirmAccess(firm: Firm, auth0UserId?: string): boolean {
  if (!auth0UserId) {
    // Anonymous access - check firm settings
    return firm.compliance.allowAnonymousChats;
  }
  
  // Check if user is authorized for this firm
  const user = firm.users.find(u => u.auth0UserId === auth0UserId && u.isActive);
  return !!user;
}

// Get firm-specific configuration for conversation
export function getFirmConversationConfig(firm: Firm) {
  return {
    name: firm.name,
    branding: firm.branding,
    practiceAreas: firm.practiceAreas,
    restrictions: firm.restrictions,
    compliance: firm.compliance,
    usageLimit: firm.subscription.monthlyConversationLimit,
    currentUsage: firm.subscription.currentUsage,
    canStartNewConversation: firm.subscription.currentUsage < firm.subscription.monthlyConversationLimit
  };
}

// Update firm usage (conversation count)
export async function incrementFirmUsage(env: Env, firmId: string): Promise<void> {
  try {
    const firmRegistry = await getFirmRegistry(env);
    const response = await firmRegistry.fetch(new Request(`http://localhost/firm/${firmId}`));
    
    if (response.ok) {
      const firm = await response.json() as Firm;
      firm.subscription.currentUsage += 1;
      firm.lastActive = new Date();
      
      // Update the firm (this would need a PUT endpoint in FirmRegistry)
      await firmRegistry.fetch(new Request(`http://localhost/firm/${firmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firm)
      }));
      
      logger.info('Firm usage incremented', { 
        firmId, 
        newUsage: firm.subscription.currentUsage,
        limit: firm.subscription.monthlyConversationLimit 
      });
    }
  } catch (error) {
    logger.error('Failed to increment firm usage', { firmId, error: error.message });
    // Don't throw - usage tracking is not critical for conversation functionality
  }
}

// Helper to create firm-aware Vectorize index names  
// Strategy: Separate indexes per firm for complete physical isolation
export function getFirmVectorizeIndexNames(firmId: string) {
  return {
    conflictDatabase: `conflict-database-${firmId}`,
    supportingDocuments: `supporting-documents-${firmId}`
  };
}

// Create Vectorize indexes for new firm
export async function createFirmVectorizeIndexes(env: Env, firmId: string): Promise<void> {
  const indexNames = getFirmVectorizeIndexNames(firmId);
  
  // Note: In practice, Vectorize indexes are created via Wrangler CLI or Dashboard
  // This is a placeholder for the automation we'd build
  logger.info('Vectorize indexes needed for firm', {
    firmId,
    indexes: indexNames,
    note: 'Create these indexes via Wrangler CLI: wrangler vectorize create'
  });
  
  // Future: API call to create indexes automatically
  // await env.VECTORIZE_ADMIN.createIndex(indexNames.conflictDatabase, {
  //   dimensions: 384, // sentence-transformers embedding size
  //   metric: 'cosine'
  // });
}

// Export types for use in other modules
export type { FirmResolutionResult };