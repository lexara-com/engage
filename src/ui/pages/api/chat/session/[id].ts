import type { APIRoute } from 'astro';

const ENGAGE_API_BASE = 'https://engage-legal-ai.cloudswift.workers.dev';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const sessionId = params.id;
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Session ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Forward session retrieval to Engage backend
    const response = await fetch(`${ENGAGE_API_BASE}/api/chat/session/${sessionId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Session not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Session retrieval error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};