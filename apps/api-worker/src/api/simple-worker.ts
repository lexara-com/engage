/**
 * Simple API Worker for Postman Testing
 * 
 * A simplified version of the API worker that can be built and tested
 * without all the dependencies, demonstrating the core API endpoints.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

export interface Env {
  ENVIRONMENT?: string;
  API_VERSION?: string;
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());

// CORS configuration for development
app.use('*', cors({
  origin: '*', // Allow all origins for testing
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: c.env.API_VERSION || '1.0.0-test',
    environment: c.env.ENVIRONMENT || 'development',
    message: 'Lexara API Worker is running'
  });
});

// API version endpoint
app.get('/api/v1/version', (c) => {
  return c.json({
    version: c.env.API_VERSION || '1.0.0-test',
    apiVersion: 'v1',
    buildTime: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// Mock authentication for testing
function createMockAuthContext(firmId: string = 'firm_test_001') {
  return {
    firm: {
      firmId,
      subscription: 'professional' as const,
      permissions: ['view_conversations', 'manage_conversations', 'view_analytics'],
    },
    user: {
      userId: 'user_test_001',
      auth0UserId: 'auth0|test123',
      role: 'attorney' as const,
      email: 'test@lawfirm.com',
      permissions: ['view_conversations', 'assign_conversations', 'manage_users']
    }
  };
}

// Firm-scoped API endpoints
const firmRoutes = new Hono<{ Bindings: Env }>();

// Conversations endpoints
firmRoutes.get('/conversations', (c) => {
  const authContext = createMockAuthContext();
  const mockConversations = [
    {
      sessionId: 'session_001',
      userId: 'user_001',
      firmId: authContext.firm.firmId,
      clientName: 'John Doe',
      clientEmail: 'john@example.com',
      practiceArea: 'personal_injury',
      status: 'active',
      phase: 'pre_login',
      assignedTo: null,
      conflictStatus: 'pending',
      goalsCompleted: 3,
      goalsTotal: 5,
      dataQualityScore: 75,
      createdAt: '2024-01-15T10:30:00Z',
      lastActivity: '2024-01-15T14:22:00Z',
      isDeleted: false
    },
    {
      sessionId: 'session_002',
      userId: 'user_002',
      firmId: authContext.firm.firmId,
      clientName: 'Jane Smith',
      clientEmail: 'jane@example.com',
      practiceArea: 'family_law',
      status: 'completed',
      phase: 'completed',
      assignedTo: 'user_test_001',
      conflictStatus: 'clear',
      goalsCompleted: 8,
      goalsTotal: 8,
      dataQualityScore: 95,
      createdAt: '2024-01-14T09:15:00Z',
      lastActivity: '2024-01-14T16:45:00Z',
      isDeleted: false
    }
  ];

  return c.json({
    success: true,
    conversations: mockConversations,
    total: mockConversations.length,
    hasMore: false,
    meta: {
      firmId: authContext.firm.firmId,
      timestamp: new Date().toISOString()
    }
  });
});

firmRoutes.get('/conversations/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId');
  const authContext = createMockAuthContext();
  
  const mockConversation = {
    sessionId,
    userId: 'user_001',
    firmId: authContext.firm.firmId,
    clientName: 'John Doe',
    clientEmail: 'john@example.com',
    practiceArea: 'personal_injury',
    status: 'active',
    phase: 'pre_login',
    assignedTo: null,
    conflictStatus: 'pending',
    messages: [
      {
        role: 'assistant',
        content: 'Hello! I\'m here to help you with your legal needs. Can you tell me your name?',
        timestamp: '2024-01-15T10:30:00Z',
        metadata: { source: 'ai_agent' }
      },
      {
        role: 'user',
        content: 'Hi, my name is John Doe.',
        timestamp: '2024-01-15T10:31:00Z',
        metadata: { source: 'web_chat' }
      },
      {
        role: 'assistant',
        content: 'Nice to meet you, John. What type of legal matter can I help you with today?',
        timestamp: '2024-01-15T10:31:30Z',
        metadata: { source: 'ai_agent' }
      },
      {
        role: 'user',
        content: 'I was in a car accident last week and need legal representation.',
        timestamp: '2024-01-15T10:32:15Z',
        metadata: { source: 'web_chat' }
      }
    ],
    userIdentity: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-0123',
      legalArea: 'personal_injury'
    },
    dataGoals: [
      { id: 'user_identification', description: 'Gather basic client information', completed: true },
      { id: 'conflict_check', description: 'Check for conflicts of interest', completed: false },
      { id: 'legal_needs_assessment', description: 'Understand legal requirements', completed: true },
      { id: 'case_details', description: 'Collect detailed case information', completed: false },
      { id: 'contact_preferences', description: 'Determine communication preferences', completed: false }
    ],
    completedGoals: ['user_identification', 'legal_needs_assessment'],
    conflictCheck: { status: 'pending', checkedAt: null },
    createdAt: '2024-01-15T10:30:00Z',
    lastActivity: '2024-01-15T10:32:15Z'
  };

  return c.json({
    success: true,
    conversation: mockConversation,
    meta: {
      firmId: authContext.firm.firmId,
      timestamp: new Date().toISOString()
    }
  });
});

firmRoutes.post('/conversations/:sessionId/messages', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const authContext = createMockAuthContext();

  // Validate message data
  if (!body.content || !body.role) {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Message content and role are required',
        details: { required: ['content', 'role'] }
      }
    }, 400);
  }

  if (!['user', 'assistant'].includes(body.role)) {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Role must be either "user" or "assistant"',
        details: { validRoles: ['user', 'assistant'] }
      }
    }, 400);
  }

  const newMessage = {
    role: body.role,
    content: body.content,
    timestamp: new Date().toISOString(),
    metadata: body.metadata || { source: 'api' }
  };

  return c.json({
    success: true,
    message: 'Message added successfully',
    conversation: {
      sessionId,
      messages: [newMessage], // In real implementation, this would include all messages
      lastActivity: new Date().toISOString()
    },
    meta: {
      firmId: authContext.firm.firmId,
      timestamp: new Date().toISOString()
    }
  });
});

firmRoutes.post('/conversations', async (c) => {
  const body = await c.req.json();
  const authContext = createMockAuthContext();

  // Generate new conversation
  const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);

  const newConversation = {
    sessionId,
    userId,
    firmId: authContext.firm.firmId,
    clientName: body.clientName || 'Anonymous Client',
    clientEmail: body.clientEmail,
    practiceArea: body.practiceArea || 'general',
    status: 'active',
    phase: 'pre_login',
    assignedTo: null,
    conflictStatus: 'pending',
    goalsCompleted: 0,
    goalsTotal: 5,
    dataQualityScore: 20,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    isDeleted: false
  };

  return c.json({
    success: true,
    message: 'Conversation created successfully',
    conversation: newConversation,
    meta: {
      firmId: authContext.firm.firmId,
      timestamp: new Date().toISOString()
    }
  }, 201);
});

// Users endpoint
firmRoutes.get('/users', (c) => {
  const authContext = createMockAuthContext();
  const mockUsers = [
    {
      userId: 'user_test_001',
      firmId: authContext.firm.firmId,
      auth0UserId: 'auth0|test123',
      email: 'attorney@lawfirm.com',
      name: 'John Attorney',
      role: 'attorney',
      status: 'active',
      lastLogin: '2024-01-15T09:00:00Z',
      conversationCount: 25,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      userId: 'user_test_002',
      firmId: authContext.firm.firmId,
      auth0UserId: 'auth0|test456',
      email: 'paralegal@lawfirm.com',
      name: 'Jane Paralegal',
      role: 'paralegal',
      status: 'active',
      lastLogin: '2024-01-15T08:30:00Z',
      conversationCount: 12,
      createdAt: '2024-01-02T00:00:00Z'
    }
  ];

  return c.json({
    success: true,
    users: mockUsers,
    total: mockUsers.length,
    meta: {
      firmId: authContext.firm.firmId,
      timestamp: new Date().toISOString()
    }
  });
});

// Analytics endpoint
firmRoutes.get('/analytics/overview', (c) => {
  const authContext = createMockAuthContext();
  
  const mockAnalytics = {
    totalConversations: 147,
    completedConversations: 89,
    activeConversations: 23,
    conversionRate: 60.5,
    averageCompletionTime: 18.5, // minutes
    topPracticeAreas: [
      { practiceArea: 'personal_injury', totalConversations: 45, conversionRate: 75.2 },
      { practiceArea: 'family_law', totalConversations: 38, conversionRate: 68.4 },
      { practiceArea: 'criminal_defense', totalConversations: 28, conversionRate: 52.1 },
      { practiceArea: 'business_law', totalConversations: 21, conversionRate: 71.4 }
    ],
    statusDistribution: [
      { status: 'completed', count: 89 },
      { status: 'active', count: 23 },
      { status: 'assigned', count: 15 },
      { status: 'pending_review', count: 12 },
      { status: 'conflict_detected', count: 8 }
    ],
    weeklyTrends: [
      { week: '2024-W01', conversations: 18, completed: 11 },
      { week: '2024-W02', conversations: 22, completed: 14 },
      { week: '2024-W03', conversations: 25, completed: 17 },
      { week: '2024-W04', conversations: 19, completed: 12 }
    ]
  };

  return c.json({
    success: true,
    analytics: mockAnalytics,
    meta: {
      firmId: authContext.firm.firmId,
      generatedAt: new Date().toISOString(),
      period: 'last_30_days'
    }
  });
});

// Search endpoint
firmRoutes.get('/search/conversations', (c) => {
  const query = c.req.query('q');
  const authContext = createMockAuthContext();

  if (!query) {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Search query parameter "q" is required'
      }
    }, 400);
  }

  const mockResults = [
    {
      sessionId: 'session_001',
      clientName: 'John Doe',
      practiceArea: 'personal_injury',
      status: 'active',
      snippet: `...${query} in a car accident last week and need legal representation...`,
      lastActivity: '2024-01-15T14:22:00Z',
      score: 0.92
    }
  ];

  return c.json({
    success: true,
    conversations: mockResults,
    scores: mockResults.map(r => r.score),
    query,
    total: mockResults.length,
    meta: {
      firmId: authContext.firm.firmId,
      timestamp: new Date().toISOString()
    }
  });
});

// Settings endpoint
firmRoutes.get('/settings', (c) => {
  const authContext = createMockAuthContext();
  
  const mockSettings = {
    firmName: 'Test Law Firm',
    practiceAreas: ['personal_injury', 'family_law', 'criminal_defense', 'business_law'],
    conflictCheckEnabled: true,
    autoAssignmentEnabled: true,
    notificationSettings: {
      emailNotifications: true,
      smsNotifications: false,
      slackIntegration: false
    },
    workflowSettings: {
      requireConflictCheck: true,
      autoCompleteGoals: 5,
      maxSessionDuration: 60 // minutes
    }
  };

  return c.json({
    success: true,
    settings: mockSettings,
    meta: {
      firmId: authContext.firm.firmId,
      timestamp: new Date().toISOString()
    }
  });
});

// Platform admin endpoints (for testing platform features)
const platformRoutes = new Hono<{ Bindings: Env }>();

platformRoutes.get('/firms', (c) => {
  const mockFirms = [
    {
      firmId: 'firm_001',
      firmName: 'Smith & Associates',
      subscription: 'professional',
      status: 'active',
      userCount: 8,
      conversationCount: 247,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      firmId: 'firm_002', 
      firmName: 'Johnson Legal Group',
      subscription: 'enterprise',
      status: 'active',
      userCount: 15,
      conversationCount: 892,
      createdAt: '2024-01-15T00:00:00Z'
    }
  ];

  return c.json({
    success: true,
    firms: mockFirms,
    total: mockFirms.length,
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

platformRoutes.get('/health', (c) => {
  const systemHealth = {
    status: 'healthy',
    uptime: '24.5 hours',
    checks: [
      { service: 'API Worker', status: 'healthy', responseTime: '12ms' },
      { service: 'D1 Database', status: 'healthy', responseTime: '8ms' },
      { service: 'Durable Objects', status: 'healthy', responseTime: '5ms' },
      { service: 'Vectorize', status: 'healthy', responseTime: '45ms' },
      { service: 'Auth0', status: 'healthy', responseTime: '120ms' }
    ],
    metrics: {
      requestsPerMinute: 1250,
      errorRate: 0.02,
      averageResponseTime: '180ms'
    }
  };

  return c.json({
    success: true,
    health: systemHealth,
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Mount all routes
app.route('/api/v1/firm', firmRoutes);
app.route('/api/v1/platform', platformRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
      path: c.req.path,
      method: c.req.method
    }
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
      details: c.env.ENVIRONMENT === 'development' ? err.message : undefined
    }
  }, 500);
});

export default app;