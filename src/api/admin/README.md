# Engage Firm Admin API

## Overview

The Firm Admin API provides RESTful endpoints for law firms to manage their Engage AI platform configuration, view conversations, and handle administrative tasks. This API is designed to be consumed by a web-based admin portal.

## Architecture

### Storage Model

The API uses a hybrid storage approach:

1. **Durable Objects (DO)**: Store complete conversation data (messages, state, goals)
2. **D1 Database**: Stores searchable metadata, admin fields, and audit logs

This design enables:
- Fast queries and filtering via D1
- Strong consistency for active conversations via DO
- Admin-only fields that don't affect conversation flow
- Complete audit trail of administrative actions

### Key Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Admin Portal  │────▶│  Admin API      │────▶│  D1 Database    │
│   (Future UI)   │     │  Worker         │     │  (Metadata)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          ▲
                               │                          │
                               ▼                          │ Sync Events
                        ┌─────────────────┐               │
                        │ Conversation    │───────────────┘
                        │ Session DO      │
                        │ (Full Data)     │
                        └─────────────────┘
```

## API Structure

### Base URL
- Production: `https://api.engage.lexara.com/v1/admin`
- Development: `http://localhost:8787/v1/admin`

### Authentication
All endpoints require JWT bearer token authentication via Auth0:
```
Authorization: Bearer <JWT_TOKEN>
```

### Main Endpoints

#### Firms
- `GET /firms` - List all firms (admin only)
- `POST /firms` - Create new firm
- `GET /firms/{firmId}` - Get firm details
- `PUT /firms/{firmId}` - Update firm settings
- `DELETE /firms/{firmId}` - Delete firm

#### Conversations
- `GET /firms/{firmId}/conversations` - List conversations with filtering
- `GET /firms/{firmId}/conversations/{conversationId}` - Get full conversation details
- `PUT /firms/{firmId}/conversations/{conversationId}` - Update metadata only
- `DELETE /firms/{firmId}/conversations/{conversationId}` - Delete conversation
- `POST /firms/{firmId}/conversations/{conversationId}/notes` - Add internal note
- `POST /firms/{firmId}/conversations/{conversationId}/actions` - Perform admin action

#### Conflicts
- `GET /firms/{firmId}/conflicts` - List conflict entries
- `POST /firms/{firmId}/conflicts` - Add conflict entry
- `PUT /firms/{firmId}/conflicts/{conflictId}` - Update conflict
- `DELETE /firms/{firmId}/conflicts/{conflictId}` - Remove conflict
- `POST /firms/{firmId}/conflicts/bulk` - Bulk import conflicts

#### Supporting Documents
- `GET /firms/{firmId}/documents` - List documents
- `POST /firms/{firmId}/documents` - Upload document
- `GET /firms/{firmId}/documents/{documentId}` - Get document metadata
- `PUT /firms/{firmId}/documents/{documentId}` - Update metadata
- `DELETE /firms/{firmId}/documents/{documentId}` - Delete document
- `GET /firms/{firmId}/documents/{documentId}/content` - Download document

#### Guidelines
- `GET /firms/{firmId}/guidelines` - List guidelines
- `POST /firms/{firmId}/guidelines` - Add guideline

## Data Flow

### Conversation Creation (Agent-Driven)
1. User interacts with AI Agent
2. Agent creates conversation in Durable Object
3. DO emits sync event to queue
4. Sync worker updates D1 with searchable metadata

### Admin Updates (API-Driven)
1. Admin makes API request (e.g., assign attorney)
2. API updates D1 directly (admin fields only)
3. API logs change to audit table
4. Conversation content in DO remains unchanged

### Data Retrieval
1. List/Search: Query D1 for metadata
2. Details: Fetch from both D1 and DO, merge results
3. Return complete view to admin

## Implementation Status

### Completed
- ✅ OpenAPI 3.1 specification
- ✅ D1 database schema
- ✅ DO to D1 sync mechanism design

### In Progress
- 🚧 Base API worker implementation
- 🚧 Request routing and middleware

### Pending
- ⏳ JWT authentication middleware
- ⏳ Individual endpoint implementations
- ⏳ Request validation
- ⏳ Error handling
- ⏳ Testing framework

## Security Considerations

1. **Authentication**: All requests require valid JWT from Auth0
2. **Authorization**: Role-based access (admin vs attorney vs staff)
3. **Data Isolation**: Complete separation between firms
4. **Audit Trail**: All admin actions are logged
5. **Input Validation**: Strict validation on all inputs
6. **Rate Limiting**: Prevent abuse and ensure fair usage

## Development Setup

```bash
# Install dependencies
npm install

# Run D1 migrations
wrangler d1 migrations apply engage-db --local

# Start development server
npm run dev:admin-api

# Run tests
npm test
```

## Testing

The API includes:
- Unit tests for individual functions
- Integration tests for endpoints
- Postman collection for manual testing
- Load testing scripts

## Monitoring

Key metrics to track:
- API response times
- Error rates by endpoint
- D1 query performance
- DO sync lag
- Authentication failures

## Future Enhancements

1. **Webhooks**: Notify external systems of conversation events
2. **Bulk Operations**: Export conversations, bulk updates
3. **Analytics API**: Aggregated metrics and insights
4. **Real-time Updates**: WebSocket support for live data
5. **Advanced Search**: Full-text search across conversations