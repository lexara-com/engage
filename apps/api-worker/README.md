# Lexara API Worker

> **Dedicated RESTful API for the Lexara Engage legal client intake platform**

The Lexara API Worker provides a comprehensive RESTful API that implements a sophisticated hybrid data architecture, intelligently routing requests between Durable Objects (for real-time consistency) and D1 SQLite databases (for analytical queries) while maintaining strict multi-tenant security and legal compliance.

## Quick Start

```bash
# Clone and navigate to API worker
cd apps/api-worker

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Configure AUTH0_DOMAIN, AUTH0_AUDIENCE, etc.

# Setup local D1 database
pnpm run db:create
pnpm run db:migrate

# Start development server
pnpm run dev
# API available at http://localhost:8787
```

## Architecture Overview

### Hybrid Data Routing Strategy

The API worker implements intelligent data layer routing:

- **📋 List Operations** → D1 indexes (fast SQL queries)
- **🔍 Detail Operations** → Durable Objects (source of truth) 
- **📊 Analytics Operations** → D1 aggregations
- **🔎 Search Operations** → Vectorize + D1
- **✏️ Write Operations** → Durable Objects + async D1 sync

### API Endpoints

#### Firm-Scoped APIs (`/api/v1/firm/*`)
All endpoints automatically scoped to authenticated firm context:

```typescript
GET    /api/v1/firm/conversations              // List conversations
GET    /api/v1/firm/conversations/{id}         // Conversation details  
POST   /api/v1/firm/conversations/{id}/messages // Add message
PUT    /api/v1/firm/conversations/{id}/assignment // Assign conversation

GET    /api/v1/firm/users                      // List users
GET    /api/v1/firm/users/{id}                 // User details
POST   /api/v1/firm/users                      // Create user

GET    /api/v1/firm/analytics/overview         // Firm analytics
GET    /api/v1/firm/assignments/workload       // Workload analysis
POST   /api/v1/firm/conflicts/check            // Check conflicts
```

#### Platform Admin APIs (`/api/v1/platform/*`)
Restricted to Lexara employees:

```typescript
GET    /api/v1/platform/firms                 // List all firms
GET    /api/v1/platform/analytics/usage       // Platform metrics
GET    /api/v1/platform/health                // System health
```

### Authentication & Security

- **Auth0 JWT**: Bearer token authentication with organization-based firm isolation
- **Multi-Tenant**: Complete data separation by firm ID
- **Permission-Based**: Granular role-based access control
- **Rate Limiting**: Per-firm and per-user rate limits
- **Audit Logging**: Complete audit trails for legal compliance

## Integration Examples

### Chat Interface Integration

```typescript
// apps/chat-interface/src/api/api-client.ts
class LexaraAPIClient {
  constructor(private baseURL = 'https://api.lexara.app') {}
  
  async getConversations(filters?: ConversationFilters) {
    return this.get('/api/v1/firm/conversations', { params: filters });
  }
  
  async addMessage(sessionId: string, message: AddMessageRequest) {
    return this.post(`/api/v1/firm/conversations/${sessionId}/messages`, message);
  }
}
```

### Platform Admin Integration

```typescript
// apps/platform-admin/src/services/platform-api.ts
async function getAllFirms(filters?: FirmFilters) {
  return apiClient.get('/api/v1/platform/firms', { params: filters });
}

async function suspendFirm(firmId: string, reason: string) {
  return apiClient.put(`/api/v1/platform/firms/${firmId}/status`, {
    status: 'suspended',
    reason
  });
}
```

## Development

### Available Scripts

```bash
# Development
pnpm run dev                    # Start dev server with hot reload
pnpm run build                  # Build for production
pnpm run typecheck             # TypeScript type checking

# Testing
pnpm run test                   # Run unit tests
pnpm run test:integration      # Run integration tests  
pnpm run test:e2e              # Run end-to-end tests
pnpm run test:coverage         # Run tests with coverage

# Database
pnpm run db:create             # Create D1 database
pnpm run db:migrate            # Apply migrations
pnpm run db:schema             # View current schema

# Deployment
pnpm run deploy:dev            # Deploy to development
pnpm run deploy:staging        # Deploy to staging
pnpm run deploy:prod           # Deploy to production

# Documentation
pnpm run docs:generate         # Generate OpenAPI docs
pnpm run docs:serve            # Serve interactive docs
```

### Environment Variables

```bash
# Required in .env.local
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.lexara.app
ANTHROPIC_API_KEY=sk-ant-api03-...
STRIPE_SECRET_KEY=sk_test_...
```

### Testing Strategy

#### Unit Tests (90%+ Coverage Required)
```typescript
describe('ConversationService', () => {
  it('should route list queries to D1', async () => {
    const service = new ConversationService(mockD1, mockDO);
    const result = await service.getConversations(firmId, filters);
    
    expect(mockD1.prepare).toHaveBeenCalled();
    expect(result).toMatchSchema(ConversationListResponseSchema);
  });
});
```

#### Integration Tests
```typescript
describe('Conversation APIs', () => {
  it('should maintain data consistency between DO and D1', async () => {
    // Test DO → D1 sync after writes
    await testClient.post('/api/v1/firm/conversations/123/messages', message);
    
    // Verify immediate DO update
    const doResponse = await testClient.get('/api/v1/firm/conversations/123');
    expect(doResponse.data.messages).toContain(message);
    
    // Verify eventual D1 consistency
    await waitFor(() => 
      testClient.get('/api/v1/firm/conversations')
        .then(r => expect(r.data.conversations[0].lastActivity).toBeTruthy())
    );
  });
});
```

## Performance & Monitoring

### Performance Targets
- **Response Time**: < 200ms for list operations, < 50ms for cached responses
- **Throughput**: 10,000+ requests per minute per firm  
- **Availability**: 99.9% uptime with automatic failover
- **Data Consistency**: < 1 second eventual consistency for D1 indexes

### Built-in Monitoring
```typescript
// Metrics available at /api/v1/platform/metrics
interface APIMetrics {
  requests: { total: number; byEndpoint: Record<string, number> };
  performance: { avgResponseTime: number; p95ResponseTime: number };
  dataLayer: { d1QueryTime: number; durableObjectTime: number };
  errors: { authFailures: number; rateLimitExceeded: number };
}
```

## Deployment

### Environment Targets

- **Development**: `api-dev.lexara.app` 
- **Staging**: `api-staging.lexara.app`
- **Production**: `api.lexara.app`

### Database Setup

```bash
# Create D1 databases
wrangler d1 create firm-indexes
wrangler d1 create platform-data

# Apply schema
pnpm run db:migrate:prod
```

### Secrets Configuration

```bash
# Set secrets via Cloudflare dashboard or CLI
wrangler secret put AUTH0_DOMAIN
wrangler secret put AUTH0_AUDIENCE  
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put STRIPE_SECRET_KEY
```

## API Documentation

### Interactive Documentation
- **Development**: https://api-dev.lexara.app/docs
- **Production**: https://api.lexara.app/docs

### OpenAPI Specification
- **JSON**: https://api.lexara.app/api-docs.json
- **Local**: http://localhost:8787/docs

## Support

### Development Issues
- Check the [troubleshooting guide](./docs/deployment/monitoring.md)
- Review [integration examples](./docs/integration-guides/) 
- Submit issues to the development team

### API Support
- **Documentation**: https://docs.lexara.com/api
- **Email**: api-support@lexara.com
- **Status Page**: https://status.lexara.com

## License

Proprietary - Lexara Inc. All rights reserved.

---

**Next Steps**: See [CLAUDE.md](./CLAUDE.md) for comprehensive technical documentation including complete API specifications, data flow patterns, and implementation details.