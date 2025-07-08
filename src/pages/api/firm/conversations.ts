import type { APIRoute } from 'astro';
import { fetchConversations } from '../../../lib/api/conversations';

// Server-side API proxy for conversation endpoints
// This keeps API keys and authentication secure

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    // Debug logging
    console.log('[API] Conversations endpoint called');
    console.log('[API] Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[API] Locals:', { 
      isAuthenticated: locals.isAuthenticated,
      user: locals.user ? { id: locals.user.id, email: locals.user.email } : null
    });
    
    // Check authentication
    if (!locals.isAuthenticated || !locals.user) {
      console.log('[API] Authentication check failed');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        debug: {
          hasLocals: !!locals,
          isAuthenticated: locals.isAuthenticated,
          hasUser: !!locals.user,
          cookies: request.headers.get('cookie')?.substring(0, 50) + '...'
        }
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Get query parameters
    const params = url.searchParams;
    
    // Use the shared fetchConversations function
    const result = await fetchConversations(locals.user.firmId, {
      page: parseInt(params.get('page') || '1'),
      limit: parseInt(params.get('limit') || '20'),
      status: params.get('status') || undefined,
      search: params.get('search') || undefined,
      practiceArea: params.get('practice') || undefined,
      assignedTo: params.get('assigned') || undefined
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

// Handle conversation details
export const GET_DETAIL: APIRoute = async ({ params, locals }) => {
  try {
    if (!locals.isAuthenticated || !locals.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const { id } = params;

    // Mock detailed conversation data
    const mockData = {
      success: true,
      data: {
        conversation: {
          sessionId: id,
          clientName: 'Sarah Johnson',
          clientEmail: 'sarah.johnson@email.com',
          clientPhone: '555-0123',
          practiceArea: 'personal_injury',
          status: 'active',
          assignedTo: 'attorney_123',
          assignedToName: 'James Wilson',
          lastActivity: new Date().toISOString(),
          messagesCount: 5,
          dataQualityScore: 85,
          conflictStatus: 'clear',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          messages: [
            {
              id: 'msg_001',
              role: 'assistant',
              content: 'Hello! I\'m here to help you with your legal matter. Could you please share your name and contact information?',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 'msg_002',
              role: 'user',
              content: 'Hi, I\'m Sarah Johnson. My email is sarah.johnson@email.com and my phone is 555-0123.',
              timestamp: new Date(Date.now() - 119 * 60 * 1000).toISOString()
            },
            {
              id: 'msg_003',
              role: 'assistant',
              content: 'Thank you, Sarah. What type of legal matter brings you here today?',
              timestamp: new Date(Date.now() - 118 * 60 * 1000).toISOString()
            },
            {
              id: 'msg_004',
              role: 'user',
              content: 'I was in a car accident last week. The other driver ran a red light and hit my car. I have injuries and my car is totaled.',
              timestamp: new Date(Date.now() - 117 * 60 * 1000).toISOString()
            },
            {
              id: 'msg_005',
              role: 'assistant',
              content: 'I\'m sorry to hear about your accident. Let me gather some important details to help evaluate your case. Were you injured in the accident? If so, what type of injuries did you sustain?',
              timestamp: new Date(Date.now() - 116 * 60 * 1000).toISOString()
            }
          ],
          metadata: {
            firmId: locals.user.firmId,
            source: 'web_intake',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...'
          }
        }
      }
    };

    return new Response(JSON.stringify(mockData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('API proxy error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};