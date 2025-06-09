import type { APIRoute } from 'astro';

const ENGAGE_API_BASE = 'https://engage-legal-ai-production.cloudswift.workers.dev';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { sessionId, message, stream = true } = body;
    
    if (!sessionId || !message) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: sessionId and message'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Forward request to Engage backend (backend doesn't support streaming)
    const response = await fetch(`${ENGAGE_API_BASE}/api/v1/conversations/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        message
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // If streaming is requested, simulate streaming by returning the response as SSE
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          // Send the complete message as a single chunk
          const chunk = JSON.stringify({
            type: 'chunk',
            content: data.message
          });
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          
          // Send completion signal
          const complete = JSON.stringify({
            type: 'complete'
          });
          controller.enqueue(encoder.encode(`data: ${complete}\n\n`));
          
          controller.close();
        }
      });
      
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }
    
    // Otherwise return JSON response
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
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