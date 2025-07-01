import type { APIRoute } from 'astro';

// Server-side API proxy for conversation endpoints
// This keeps API keys and authentication secure

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    // Check authentication
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

    // Get query parameters
    const params = url.searchParams;
    const page = parseInt(params.get('page') || '1');
    const limit = parseInt(params.get('limit') || '20');
    const status = params.get('status') || undefined;
    const search = params.get('search') || undefined;
    const practiceArea = params.get('practice') || undefined;
    const assignedTo = params.get('assigned') || undefined;

    // Initialize API URL - use the real API worker
    // According to issue #35, the API is available at localhost:8787 for dev
    const apiUrl = import.meta.env.API_URL || 'http://localhost:8787';
    
    try {
      // Build query parameters for the API
      const apiParams = new URLSearchParams();
      if (status) apiParams.append('status', status);
      if (search) apiParams.append('q', search);
      if (practiceArea) apiParams.append('practiceArea', practiceArea);
      if (assignedTo) apiParams.append('assignedTo', assignedTo);
      apiParams.append('page', page.toString());
      apiParams.append('limit', limit.toString());

      // Make request to the real API worker
      const apiResponse = await fetch(`${apiUrl}/api/v1/firm/conversations?${apiParams}`, {
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
      
      // Transform the response to match our expected format
      return new Response(JSON.stringify({
        success: true,
        data: {
          conversations: data.data?.conversations || [],
          pagination: {
            page: page,
            limit: limit,
            total: data.data?.pagination?.total || 0,
            pages: data.data?.pagination?.pages || 1
          }
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      console.log('API call failed, returning mock data:', error);
      
      // Fall back to mock data if API is not available
      // This ensures the UI still works during development
    const mockData = {
      success: true,
      data: {
        conversations: [
          {
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
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
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
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
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
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
          },
          {
            sessionId: 'session_004',
            clientName: 'Robert Thompson',
            clientEmail: 'rthompson@company.com',
            clientPhone: '555-0126',
            practiceArea: 'criminal_defense',
            status: 'terminated',
            assignedTo: 'attorney_789',
            assignedToName: 'David Brown',
            lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            messagesCount: 8,
            dataQualityScore: 45,
            conflictStatus: 'confirmed',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            sessionId: 'session_005',
            clientName: 'Lisa Anderson',
            clientEmail: 'landerson@email.com',
            clientPhone: '555-0127',
            practiceArea: 'personal_injury',
            status: 'active',
            assignedTo: 'attorney_123',
            assignedToName: 'James Wilson',
            lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            messagesCount: 7,
            dataQualityScore: 88,
            conflictStatus: 'clear',
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        ],
        pagination: {
          page: page,
          limit: limit,
          total: 45,
          pages: Math.ceil(45 / limit)
        }
      }
    };

    // Filter by status if provided
    if (status) {
      mockData.data.conversations = mockData.data.conversations.filter(
        conv => conv.status === status
      );
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      mockData.data.conversations = mockData.data.conversations.filter(
        conv => 
          conv.clientName.toLowerCase().includes(searchLower) ||
          conv.clientEmail.toLowerCase().includes(searchLower) ||
          conv.practiceArea.toLowerCase().includes(searchLower)
      );
    }

    // TODO: In production, replace mock data with actual API call:
    // const response = await apiClient.conversations.list({
    //   firmId: locals.user.firmId,
    //   page,
    //   limit,
    //   status,
    //   search
    // });

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