// CORS middleware for Admin API

import { AdminEnv } from '../types';

export function handleCORS(request: Request, env: AdminEnv): Response {
  const origin = request.headers.get('Origin');
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  // Check if origin is allowed
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: corsHeaders
  });
}