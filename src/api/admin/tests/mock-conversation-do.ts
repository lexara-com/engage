// Mock Conversation Session Durable Object for testing

export class MockConversationSession implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  
  // Mock conversation data
  private mockConversations: Record<string, any> = {
    '01HK8Z2X3Y4V5W6A7B8C9D0E1F': {
      sessionId: '01HK8Z2X3Y4V5W6A7B8C9D0E1F',
      firmId: '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
      userId: '01HK8Z3X4Y5V6W7A8B9C0D1E2F',
      phase: 'data_gathering',
      messages: [
        { id: 'msg1', role: 'user', content: 'I was in a car accident', timestamp: new Date() },
        { id: 'msg2', role: 'assistant', content: 'I understand you were in an accident. Can you tell me more?', timestamp: new Date() },
        { id: 'msg3', role: 'user', content: 'It happened yesterday on Main Street', timestamp: new Date() },
        { id: 'msg4', role: 'assistant', content: 'Thank you for that information. Were you injured?', timestamp: new Date() },
        { id: 'msg5', role: 'user', content: 'Yes, I have back pain', timestamp: new Date() }
      ],
      userIdentity: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-0123'
      },
      dataGoals: [
        { id: 'g1', description: 'Collect accident details', completed: true },
        { id: 'g2', description: 'Identify injuries', completed: true },
        { id: 'g3', description: 'Get insurance information', completed: false },
        { id: 'g4', description: 'Document property damage', completed: false },
        { id: 'g5', description: 'Identify witnesses', completed: false }
      ],
      supportDocuments: ['doc-123', 'doc-456'],
      conflictCheck: { status: 'clear' },
      doVersion: 5,
      isDeleted: false
    },
    '01HK8Z4X5Y6V7W8A9B0C1D2E3F': {
      sessionId: '01HK8Z4X5Y6V7W8A9B0C1D2E3F',
      firmId: '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
      userId: '01HK8Z5X6Y7V8W9A0B1C2D3E4F',
      phase: 'completed',
      messages: Array(12).fill(null).map((_, i) => ({
        id: `msg${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date()
      })),
      userIdentity: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '555-0456'
      },
      dataGoals: Array(5).fill(null).map((_, i) => ({
        id: `g${i}`,
        description: `Goal ${i}`,
        completed: true
      })),
      supportDocuments: [],
      conflictCheck: { status: 'clear' },
      doVersion: 12,
      isDeleted: false
    },
    '01HK8Z6X7Y8V9W0A1B2C3D4E5F': {
      sessionId: '01HK8Z6X7Y8V9W0A1B2C3D4E5F',
      firmId: '01HK8Z1X2Y3V4W5A6B7C8D9E0F',
      userId: '01HK8Z7X8Y9V0W1A2B3C4D5E6F',
      phase: 'pre_login',
      messages: [
        { id: 'msg1', role: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date() },
        { id: 'msg2', role: 'user', content: 'I need help with a legal matter', timestamp: new Date() }
      ],
      userIdentity: {},
      dataGoals: [
        { id: 'g1', description: 'User identification', completed: false },
        { id: 'g2', description: 'Legal needs assessment', completed: false },
        { id: 'g3', description: 'Conflict check readiness', completed: false }
      ],
      supportDocuments: [],
      conflictCheck: { status: 'pending' },
      doVersion: 2,
      isDeleted: false
    }
  };

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathMatch = url.pathname.match(/^\/([^/]+)(?:\/(.+))?$/);
    
    if (!pathMatch) {
      return new Response('Not found', { status: 404 });
    }

    const [, endpoint, param] = pathMatch;

    // Extract session ID from the request or URL
    const sessionId = this.extractSessionId(request, url);

    switch (endpoint) {
      case 'full-conversation':
        return this.getFullConversation(request, sessionId);
      
      case 'delete':
        return this.markDeleted(request, sessionId);
      
      case 'sync-state':
        return this.getSyncState(sessionId);
      
      default:
        return new Response(JSON.stringify({
          error: 'NOT_FOUND',
          message: `Unknown endpoint: ${endpoint}`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  }

  private extractSessionId(request: Request, url: URL): string {
    // In real implementation, this would come from DO name
    // For testing, we'll use a header or default
    return request.headers.get('X-Session-Id') || '01HK8Z2X3Y4V5W6A7B8C9D0E1F';
  }

  private async getFullConversation(request: Request, sessionId: string): Promise<Response> {
    if (request.headers.get('X-Admin-Request') !== 'true') {
      return new Response(JSON.stringify({
        error: 'UNAUTHORIZED',
        message: 'Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const conversation = this.mockConversations[sessionId];
    if (!conversation) {
      return new Response(JSON.stringify({
        error: 'NOT_FOUND',
        message: 'Conversation not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(conversation), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async markDeleted(request: Request, sessionId: string): Promise<Response> {
    if (request.headers.get('X-Admin-Request') !== 'true') {
      return new Response(JSON.stringify({
        error: 'UNAUTHORIZED',
        message: 'Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const deletedBy = request.headers.get('X-Deleted-By');
    if (!deletedBy) {
      return new Response(JSON.stringify({
        error: 'BAD_REQUEST',
        message: 'X-Deleted-By header required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const conversation = this.mockConversations[sessionId];
    if (!conversation) {
      return new Response(JSON.stringify({
        error: 'NOT_FOUND',
        message: 'Conversation not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    conversation.isDeleted = true;
    conversation.deletedAt = new Date();
    conversation.deletedBy = deletedBy;

    return new Response(JSON.stringify({
      deleted: true,
      deletedAt: conversation.deletedAt
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getSyncState(sessionId: string): Promise<Response> {
    const conversation = this.mockConversations[sessionId];
    if (!conversation) {
      return new Response(JSON.stringify({
        error: 'NOT_FOUND',
        message: 'Conversation not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const syncState = {
      conversationId: conversation.sessionId,
      firmId: conversation.firmId,
      userId: conversation.userId,
      doVersion: conversation.doVersion,
      phase: conversation.phase,
      status: conversation.phase === 'completed' ? 'completed' : 'active',
      conflictStatus: conversation.conflictCheck.status,
      messageCount: conversation.messages.length,
      completedGoals: conversation.dataGoals.filter((g: any) => g.completed).length,
      totalGoals: conversation.dataGoals.length,
      lastActivity: new Date(),
      userIdentity: conversation.userIdentity
    };

    return new Response(JSON.stringify(syncState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}