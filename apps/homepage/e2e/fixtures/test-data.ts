/**
 * Test data generators for E2E tests
 */

export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@e2etest.com`;
}

export function generateTestFirm() {
  const timestamp = Date.now();
  return {
    firmName: `Test Law Firm ${timestamp}`,
    firmSize: '1-5',
    practiceAreas: ['personal_injury', 'family_law'],
    plan: 'starter' as const,
  };
}

export function generateTestUser() {
  const id = Math.random().toString(36).substring(2, 8);
  return {
    firstName: `Test${id}`,
    lastName: 'User',
    email: generateTestEmail(),
    password: 'TestPassword123!',
    role: 'admin',
  };
}

export const TEST_USERS = {
  admin: {
    email: 'admin@testfirm.com',
    password: 'AdminTest123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  attorney: {
    email: 'attorney@testfirm.com',
    password: 'AttorneyTest123!',
    firstName: 'Attorney',
    lastName: 'User',
    role: 'attorney',
  },
  staff: {
    email: 'staff@testfirm.com',
    password: 'StaffTest123!',
    firstName: 'Staff',
    lastName: 'User',
    role: 'staff',
  },
};

export const PRACTICE_AREAS = [
  { value: 'personal_injury', label: 'Personal Injury' },
  { value: 'family_law', label: 'Family Law' },
  { value: 'criminal_defense', label: 'Criminal Defense' },
  { value: 'business_law', label: 'Business Law' },
  { value: 'estate_planning', label: 'Estate Planning' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
];

export const FIRM_SIZES = [
  { value: '1-5', label: '1-5 attorneys' },
  { value: '6-10', label: '6-10 attorneys' },
  { value: '11-25', label: '11-25 attorneys' },
  { value: '26-50', label: '26-50 attorneys' },
  { value: '51+', label: '51+ attorneys' },
];

export const PLANS = [
  {
    value: 'starter',
    name: 'Starter',
    price: 99,
    features: ['Up to 5 users', 'Basic features', 'Email support'],
  },
  {
    value: 'professional',
    name: 'Professional',
    price: 299,
    features: ['Up to 25 users', 'Advanced features', 'Priority support'],
  },
  {
    value: 'enterprise',
    name: 'Enterprise',
    price: 999,
    features: ['Unlimited users', 'All features', 'Dedicated support'],
  },
];