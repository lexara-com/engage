// Auth0 Configuration for Engage Legal AI Platform
// Multi-tenant organization structure and application settings

/// <reference types="@cloudflare/workers-types" />

import { Env } from '@/types/shared';

export interface Auth0Config {
  domain: string;
  audience: string;
  adminClientId: string;
  clientIntakeClientId: string;
  jwksUri: string;
  issuer: string;
}

export interface Auth0Organization {
  id: string;
  name: string;
  displayName: string;
  organizationType: 'platform' | 'firm' | 'clients';
  metadata?: Record<string, any>;
}

export interface Auth0User {
  sub: string;          // Auth0 user ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  nickname?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  // Custom claims for Engage
  'https://lexara.app/roles'?: string[];
  'https://lexara.app/firm_id'?: string;
  'https://lexara.app/firm_slug'?: string;
  'https://lexara.app/org_id'?: string;
  'https://lexara.app/user_type'?: string;
  'https://lexara.app/permissions'?: string[];
}

export interface JWTPayload {
  iss: string;          // Issuer
  sub: string;          // Subject (user ID)
  aud: string | string[]; // Audience
  iat: number;          // Issued at
  exp: number;          // Expires at
  azp?: string;         // Authorized party
  scope?: string;       // Scopes
  // Custom claims
  'https://lexara.app/roles'?: string[];
  'https://lexara.app/firm_id'?: string;
  'https://lexara.app/firm_slug'?: string;
  'https://lexara.app/org_id'?: string;
  'https://lexara.app/user_type'?: string;
  'https://lexara.app/permissions'?: string[];
}

// Auth0 configuration based on environment
export function getAuth0Config(env: Env): Auth0Config {
  const domain = env.AUTH0_DOMAIN || 'lexara.us.auth0.com';
  
  return {
    domain,
    audience: env.AUTH0_AUDIENCE || 'https://api.lexara.app',
    adminClientId: env.AUTH0_CLIENT_ID || '', // Admin console SPA
    clientIntakeClientId: env.AUTH0_CLIENT_ID || '', // Client intake SPA (same for now)
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    issuer: `https://${domain}/`
  };
}

// Organization naming strategy for multi-tenancy
export function getOrganizationName(type: 'platform' | 'firm' | 'clients', firmId?: string): string {
  switch (type) {
    case 'platform':
      return 'lexara-platform';
    case 'firm':
      if (!firmId) throw new Error('firmId required for firm organization');
      return `firm-${firmId}`;
    case 'clients':
      return 'clients';
    default:
      throw new Error(`Unknown organization type: ${type}`);
  }
}

// Expected custom claims in JWT tokens
export const AUTH0_CUSTOM_CLAIMS = {
  USER_TYPE: 'https://lexara.app/user_type',
  FIRM_ID: 'https://lexara.app/firm_id',
  FIRM_SLUG: 'https://lexara.app/firm_slug',
  ORG_ID: 'https://lexara.app/org_id',
  ROLES: 'https://lexara.app/roles',
  PERMISSIONS: 'https://lexara.app/permissions'
} as const;

// Role definitions for Auth0 organizations
export const AUTH0_ROLES = {
  // Platform roles (lexara-platform organization)
  PLATFORM_ADMIN: 'platform:admin',
  PLATFORM_SUPPORT: 'platform:support',
  PLATFORM_BILLING: 'platform:billing',
  
  // Firm roles (firm-{firmId} organizations)
  FIRM_ADMIN: 'firm:admin',
  FIRM_LAWYER: 'firm:lawyer',
  FIRM_STAFF: 'firm:staff',
  FIRM_VIEWER: 'firm:viewer',
  
  // Client role (clients organization)
  CLIENT_USER: 'client:user'
} as const;

// Permission definitions for granular access control
export const AUTH0_PERMISSIONS = {
  // Platform permissions
  'platform:manage_all_firms': 'Manage all law firms on the platform',
  'platform:view_system_analytics': 'View system-wide analytics and metrics',
  'platform:manage_billing': 'Manage platform billing and subscriptions',
  'platform:access_support': 'Access support tools and customer data',
  
  // Firm management permissions
  'firm:manage_users': 'Add, remove, and manage firm users',
  'firm:manage_conflicts': 'Manage conflict of interest database',
  'firm:view_analytics': 'View firm-specific analytics and reports',
  'firm:manage_billing': 'Manage firm subscription and billing',
  'firm:manage_branding': 'Customize firm branding and appearance',
  'firm:view_conversations': 'View and search client conversations',
  'firm:delete_conversations': 'Delete client conversations',
  'firm:manage_compliance': 'Configure HIPAA and compliance settings',
  
  // Client permissions
  'client:access_conversations': 'Access own conversations and intake forms',
  'client:resume_conversations': 'Resume previous conversations'
} as const;

// Helper to validate Auth0 configuration
export function validateAuth0Config(env: Env): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!env.AUTH0_DOMAIN) {
    errors.push('AUTH0_DOMAIN environment variable is required');
  }
  
  if (!env.AUTH0_CLIENT_ID) {
    errors.push('AUTH0_CLIENT_ID environment variable is required');
  }
  
  if (!env.AUTH0_AUDIENCE) {
    errors.push('AUTH0_AUDIENCE environment variable is required');
  }
  
  // Validate domain format
  if (env.AUTH0_DOMAIN && !env.AUTH0_DOMAIN.includes('.auth0.com')) {
    errors.push('AUTH0_DOMAIN should be in format: tenant.region.auth0.com');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Helper to determine organization from context
export function resolveUserOrganization(userType: string, firmId?: string): string {
  switch (userType) {
    case 'lexara_admin':
      return getOrganizationName('platform');
    case 'firm_admin':
    case 'firm_user':
      if (!firmId) throw new Error('firmId required for firm users');
      return getOrganizationName('firm', firmId);
    case 'client':
      return getOrganizationName('clients');
    default:
      throw new Error(`Unknown user type: ${userType}`);
  }
}

// Role and permission helpers (updated for new claim structure)
export function hasRole(user: Auth0User, role: string): boolean {
  const roles = user['https://lexara.app/roles'] || [];
  return roles.includes(role);
}

export function hasPermission(user: Auth0User, permission: string): boolean {
  const permissions = user['https://lexara.app/permissions'] || [];
  return permissions.includes(permission);
}

export function getFirmId(user: Auth0User): string | undefined {
  return user['https://lexara.app/firm_id'];
}

export function getUserType(user: Auth0User): string | undefined {
  return user['https://lexara.app/user_type'];
}

// Check if user can access a specific firm
export function canAccessFirm(user: Auth0User, firmId: string): boolean {
  const userFirmId = getFirmId(user);
  const userType = getUserType(user);
  
  // Platform admins can access any firm
  if (userType === 'lexara_admin') {
    return true;
  }
  
  // Firm users can only access their own firm
  return userFirmId === firmId;
}