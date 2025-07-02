import { sequence } from 'astro:middleware';
import { adminAuth } from './middleware/admin-auth';

// Export the middleware handler
export const onRequest = sequence(
  adminAuth
  // Add other middleware here as needed
);