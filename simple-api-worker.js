// Simple API Worker for Firm Portal Demo
// This provides mock data for the deployed firm portal

// Mock data for demonstrations
const mockConversations = [
  {
    sessionId: "session_001",
    userId: "user_001",
    firmId: "firm_demo",
    phase: "completed",
    userIdentity: {
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      phone: "(555) 123-4567"
    },
    lastActivity: "2024-12-20T10:30:00Z",
    createdAt: "2024-12-19T09:15:00Z",
    conflictCheck: { status: "clear" },
    legalArea: "Personal Injury",
    status: "completed"
  },
  {
    sessionId: "session_002", 
    userId: "user_002",
    firmId: "firm_demo",
    phase: "data_gathering",
    userIdentity: {
      name: "Michael Chen",
      email: "m.chen@email.com",
      phone: "(555) 987-6543"
    },
    lastActivity: "2024-12-20T11:45:00Z",
    createdAt: "2024-12-20T11:30:00Z",
    conflictCheck: { status: "clear" },
    legalArea: "Family Law",
    status: "active"
  },
  {
    sessionId: "session_003",
    userId: "user_003", 
    firmId: "firm_demo",
    phase: "pre_login",
    userIdentity: {
      name: "Amanda Rodriguez",
      email: "amanda.r@email.com",
      phone: "(555) 456-7890"
    },
    lastActivity: "2024-12-20T12:15:00Z",
    createdAt: "2024-12-20T12:10:00Z",
    conflictCheck: { status: "pending" },
    legalArea: "Business Law",
    status: "starting"
  }
];

const mockAnalytics = {
  todayConversations: 3,
  weeklyCompleted: 12,
  conversionRate: 0.78,
  totalConversations: 45,
  practiceAreaBreakdown: {
    "Personal Injury": 18,
    "Family Law": 15,
    "Business Law": 8,
    "Criminal Law": 4
  }
};

const mockRecentActivity = [
  {
    id: "activity_001",
    description: "New conversation started with Amanda Rodriguez",
    timestamp: "2024-12-20T12:15:00Z",
    type: "conversation_started"
  },
  {
    id: "activity_002", 
    description: "Conflict check completed for Michael Chen",
    timestamp: "2024-12-20T11:50:00Z",
    type: "conflict_resolved"
  },
  {
    id: "activity_003",
    description: "Conversation completed for Sarah Johnson",
    timestamp: "2024-12-20T10:35:00Z", 
    type: "conversation_completed"
  }
];

function corsResponse(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 200 }));
    }
    
    // Health check
    if (url.pathname === '/health') {
      return corsResponse(new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0-demo',
        environment: 'demo'
      }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    
    // Get conversations
    if (url.pathname === '/api/v1/conversations') {
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');
      
      let filtered = [...mockConversations];
      
      if (status) {
        filtered = filtered.filter(conv => conv.status === status);
      }
      
      if (search) {
        filtered = filtered.filter(conv => 
          conv.userIdentity.name.toLowerCase().includes(search.toLowerCase()) ||
          conv.userIdentity.email.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      return corsResponse(new Response(JSON.stringify({
        success: true,
        data: {
          conversations: filtered.slice(0, limit),
          total: filtered.length,
          hasMore: filtered.length > limit
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    
    // Get specific conversation
    if (url.pathname.startsWith('/api/v1/conversations/') && url.pathname.split('/').length === 5) {
      const sessionId = url.pathname.split('/')[4];
      const conversation = mockConversations.find(conv => conv.sessionId === sessionId);
      
      if (!conversation) {
        return corsResponse(new Response(JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      
      return corsResponse(new Response(JSON.stringify({
        success: true,
        data: { conversation }
      }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    
    // Get analytics
    if (url.pathname === '/api/v1/analytics') {
      return corsResponse(new Response(JSON.stringify({
        success: true,
        data: mockAnalytics
      }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    
    // Get recent activity
    if (url.pathname === '/api/v1/activity') {
      const limit = parseInt(url.searchParams.get('limit')) || 5;
      
      return corsResponse(new Response(JSON.stringify({
        success: true,
        data: {
          activities: mockRecentActivity.slice(0, limit)
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    
    // Firm registration endpoint
    if (url.pathname === '/api/v1/firm/register' && request.method === 'POST') {
      try {
        const firmData = await request.json();
        
        // Validate required fields
        const requiredFields = ['firmName', 'firstName', 'lastName', 'email', 'plan'];
        const missingFields = requiredFields.filter(field => !firmData[field]);
        
        if (missingFields.length > 0) {
          return corsResponse(new Response(JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Missing required fields: ${missingFields.join(', ')}`
            }
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        
        if (!firmData.agreedToTerms) {
          return corsResponse(new Response(JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Must agree to Terms of Service and Privacy Policy'
            }
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        
        // Generate mock IDs
        const firmId = `firm_${Date.now()}`;
        const userId = `user_${Date.now()}`;
        
        // Create mock firm and user data
        const firm = {
          id: firmId,
          name: firmData.firmName,
          size: firmData.firmSize,
          practiceAreas: firmData.practiceAreas || [],
          plan: firmData.plan,
          status: 'active',
          createdAt: new Date().toISOString(),
          settings: {
            intakeEnabled: true,
            conflictDetectionEnabled: true,
            autoAssignmentEnabled: false
          }
        };
        
        const user = {
          id: userId,
          firmId: firmId,
          email: firmData.email,
          name: `${firmData.firstName} ${firmData.lastName}`,
          firstName: firmData.firstName,
          lastName: firmData.lastName,
          role: 'admin',
          status: 'active',
          createdAt: new Date().toISOString()
        };
        
        // In a real implementation, this would:
        // 1. Create firm in database
        // 2. Create user in database  
        // 3. Set up Auth0 organization
        // 4. Send welcome email
        // 5. Initialize firm settings
        
        console.log('Mock firm registration:', { firm, user });
        
        return corsResponse(new Response(JSON.stringify({
          success: true,
          data: {
            firm,
            user,
            message: `Welcome to Lexara, ${firmData.firstName}! Your law firm account has been created successfully.`
          }
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        }));
        
      } catch (error) {
        return corsResponse(new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to process registration request'
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
    }
    
    // Default 404
    return corsResponse(new Response(JSON.stringify({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' }
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
};