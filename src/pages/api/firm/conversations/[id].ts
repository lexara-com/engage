import type { APIRoute } from 'astro';

// Handle conversation details
export const GET: APIRoute = async ({ params, locals }) => {
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
    const apiUrl = import.meta.env.API_URL || 'http://localhost:8787';

    try {
      // Make request to the real API worker
      const apiResponse = await fetch(`${apiUrl}/api/v1/firm/conversations/${id}`, {
        headers: {
          'Accept': 'application/json',
          // TODO: Add Authorization header with JWT token when available
          // 'Authorization': `Bearer ${locals.session?.token}`
        }
      });

      if (!apiResponse.ok) {
        throw new Error(`API responded with ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      
      // Return the API response
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      console.log('API call failed, returning mock data:', error);

    // Mock detailed conversation data
    const mockConversations: Record<string, any> = {
      'session_001': {
        sessionId: 'session_001',
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
        ]
      },
      'session_002': {
        sessionId: 'session_002',
        clientName: 'Michael Chen',
        clientEmail: 'mchen@example.com',
        clientPhone: '555-0124',
        practiceArea: 'family_law',
        status: 'completed',
        assignedTo: 'attorney_456',
        assignedToName: 'Emily Davis',
        lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        messagesCount: 12,
        dataQualityScore: 92,
        conflictStatus: 'clear',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        messages: [
          {
            id: 'msg_001',
            role: 'assistant',
            content: 'Hello! I\'m here to help you with your legal matter. Could you please share your name and contact information?',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'msg_002',
            role: 'user',
            content: 'I\'m Michael Chen. I need help with a divorce case.',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60000).toISOString()
          }
        ]
      },
      'session_003': {
        sessionId: 'session_003',
        clientName: 'Jennifer Martinez',
        clientEmail: 'jmartinez@email.com',
        clientPhone: '555-0125',
        practiceArea: 'employment_law',
        status: 'active',
        assignedTo: null,
        assignedToName: null,
        lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        messagesCount: 3,
        dataQualityScore: 70,
        conflictStatus: 'potential',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        messages: [
          {
            id: 'msg_001',
            role: 'assistant',
            content: 'Hello! I\'m here to help you with your legal matter. Could you please share your name and contact information?',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'msg_002',
            role: 'user',
            content: 'Jennifer Martinez. I believe I was wrongfully terminated from my job.',
            timestamp: new Date(Date.now() - 59 * 60 * 1000).toISOString()
          },
          {
            id: 'msg_003',
            role: 'assistant',
            content: 'I\'m sorry to hear about your situation. Can you tell me more about the circumstances of your termination?',
            timestamp: new Date(Date.now() - 58 * 60 * 1000).toISOString()
          }
        ]
      }
    };

    const conversation = mockConversations[id!] || {
      sessionId: id,
      clientName: 'Unknown Client',
      clientEmail: 'unknown@email.com',
      clientPhone: 'Not provided',
      practiceArea: 'general',
      status: 'active',
      messages: []
    };

    const mockData = {
      success: true,
      data: {
        conversation: conversation
      }
    };

    return new Response(JSON.stringify(mockData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    }
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