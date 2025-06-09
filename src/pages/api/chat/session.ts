import type { APIRoute } from 'astro';

const ENGAGE_API_BASE = 'https://engage-legal-ai-production.cloudswift.workers.dev';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    
    // Forward session creation to Engage backend
    const response = await fetch(`${ENGAGE_API_BASE}/api/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    // Wrap the response in the expected format for the client
    return new Response(JSON.stringify({
      success: true,
      sessionId: data.sessionId,
      data: data
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Session creation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};