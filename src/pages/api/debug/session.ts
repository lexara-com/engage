import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const { locals } = context;
  
  return new Response(JSON.stringify({
    isAuthenticated: locals.isAuthenticated,
    user: locals.user,
    firm: locals.firm,
    sessionExpiry: locals.sessionExpiry
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};