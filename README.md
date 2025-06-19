# Engage Legal AI Platform

AI-powered legal client intake platform built on Cloudflare Workers.

## 🚀 Quick Start

```bash
# Validate configuration
npm run validate:config

# Deploy to development
npm run deploy:all:dev

# Verify deployment
curl https://dev.lexara.app/health
curl https://platform-dev.lexara.app/health
```

## 📚 Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment procedures
- **[CONFIGURATION_REFERENCE.md](./CONFIGURATION_REFERENCE.md)** - Configuration files reference
- **[CLAUDE.md](./CLAUDE.md)** - System architecture and specifications

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