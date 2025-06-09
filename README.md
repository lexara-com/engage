# Engage Legal AI Platform

AI-powered legal client intake platform built on Cloudflare Workers.

## Project Structure

```
src/
├── types/          # Shared TypeScript interfaces and types
├── utils/          # Utility functions (logging, errors, ULID generation)
├── durable-objects/# Durable Object implementations
├── mcp-servers/    # MCP server implementations
└── agent/          # Main agent worker and Claude integration
```

## Development

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers and AI access
- Wrangler CLI

### Setup
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Testing
```bash
npm test
npm run test:watch
```

### Deployment
```bash
# Staging
npm run deploy:staging

# Production  
npm run deploy:production
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for complete system architecture and design documentation.

## License

Proprietary - Lexara Legal Technologies