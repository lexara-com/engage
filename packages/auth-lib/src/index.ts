// Engage Legal AI Platform - Authentication Library

// JWT Validator exports (renamed to avoid conflicts)
export {
  JwtAuthContext,
  validateAuth0Token,
  validateSessionAuth,
  extractAuthContext,
  createMockAdminContext,
  hasPermission as jwtHasPermission,
  hasRole as jwtHasRole,
  canAccessFirm as jwtCanAccessFirm
} from './jwt-validator';

// Auth middleware exports
export {
  AuthContext,
  JWTPayload,
  FIRM_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  extractBearerToken,
  verifyJWT,
  validateJWT,
  requireFirmAccess,
  requirePermission,
  requireRole,
  requireUserType,
  hasFirmPermission,
  hasPlatformPermission,
  createAuthMiddleware,
  validateConversationAccess,
  addAuthHeaders
} from './auth-middleware';

// Auth0 config exports
export {
  Auth0Config,
  Auth0Organization,
  Auth0User,
  JWTPayload as Auth0JWTPayload,
  AUTH0_CUSTOM_CLAIMS,
  AUTH0_ROLES,
  AUTH0_PERMISSIONS,
  getAuth0Config,
  getOrganizationName,
  validateAuth0Config,
  resolveUserOrganization,
  hasRole as auth0HasRole,
  hasPermission as auth0HasPermission,
  getFirmId,
  getUserType,
  canAccessFirm as auth0CanAccessFirm
} from './auth0-config';