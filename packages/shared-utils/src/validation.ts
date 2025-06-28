// Common validation utilities

import type { AuthContext } from '@lexara/shared-types';

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function isValidFirmSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
}

export function hasPermission(context: AuthContext, permission: string): boolean {
  return context.permissions.includes(permission);
}

export function hasRole(context: AuthContext, role: string): boolean {
  return context.roles.includes(role);
}

export function validateStateParameter(state: string): { valid: boolean; data?: any; error?: string } {
  try {
    const decoded = JSON.parse(atob(state));
    
    if (!decoded.timestamp || !decoded.returnTo) {
      return { valid: false, error: 'Missing required state fields' };
    }
    
    const age = Date.now() - decoded.timestamp;
    if (age > 10 * 60 * 1000) { // 10 minutes
      return { valid: false, error: 'State parameter expired' };
    }
    
    return { valid: true, data: decoded };
  } catch (error) {
    return { valid: false, error: 'Invalid state parameter format' };
  }
}