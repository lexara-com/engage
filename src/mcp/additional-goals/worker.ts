// AdditionalGoals MCP Worker - Cloudflare Workers Entry Point
// Independent MCP server for supporting documents search and goal enhancement

/// <reference types="@cloudflare/workers-types" />

import { AdditionalGoalsMCPServer, AdditionalGoalsEnv } from './server';
import { MCPRequest, MCPNotification } from './types';

// Global server instance to maintain state across requests
let globalServer: AdditionalGoalsMCPServer | null = null;

export default {
  async fetch(request: Request, env: AdditionalGoalsEnv, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const url = new URL(request.url);
    
    // Maintain server instance across requests
    if (!globalServer) {
      globalServer = new AdditionalGoalsMCPServer(env);
    }
    const server = globalServer;

    try {
      // MCP Health Check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          server: 'engage-additional-goals',
          version: '1.0.0',
          protocol: 'MCP',
          timestamp: new Date().toISOString(),
          vectorizeBinding: !!env.SUPPORTING_DOCUMENTS ? 'available' : 'missing'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // MCP Server Info
      if (url.pathname === '/info' && request.method === 'GET') {
        return new Response(JSON.stringify({
          name: "engage-additional-goals",
          version: "1.0.0",
          description: "MCP server for supporting documents search and goal enhancement based on legal case type",
          capabilities: ["tools", "resources"],
          tools: ["query_supporting_documents", "enhance_goals", "get_document_requirements"],
          resources: ["search-strategies", "goal-enhancement-rules", "document-templates", "priority-matrix"],
          protocolVersion: "2024-11-05",
          vectorizeIntegration: true
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // MCP JSON-RPC Endpoint
      if (url.pathname === '/mcp' && request.method === 'POST') {
        const contentType = request.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "Invalid Request - Content-Type must be application/json"
            }
          }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        let body;
        try {
          body = await request.json();
        } catch (error) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Parse error - Invalid JSON"
            }
          }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        // Handle single request or batch
        if (Array.isArray(body)) {
          // Batch request
          const responses = await Promise.all(
            body.map(req => server.handleRequest(req as MCPRequest))
          );
          
          return new Response(JSON.stringify(responses), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } else {
          // Single request
          if (isNotification(body)) {
            // Notifications don't get responses
            await handleNotification(body as MCPNotification);
            return new Response(null, { 
              status: 204,
              headers: { 'Access-Control-Allow-Origin': '*' }
            });
          } else {
            // Regular request
            const response = await server.handleRequest(body as MCPRequest);
            return new Response(JSON.stringify(response), {
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
        }
      }

      // Test Vectorize endpoint (for development/testing)
      if (url.pathname === '/test/vectorize' && request.method === 'GET') {
        const vectorizeAvailable = !!env.SUPPORTING_DOCUMENTS;
        
        if (vectorizeAvailable) {
          try {
            // Test basic vectorize functionality
            // In production, this would test actual search capability
            return new Response(JSON.stringify({
              vectorize: {
                binding: 'available',
                status: 'connected',
                index: 'SUPPORTING_DOCUMENTS',
                note: 'Vectorize binding is available for supporting documents search'
              }
            }), {
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          } catch (error) {
            return new Response(JSON.stringify({
              vectorize: {
                binding: 'available',
                status: 'error',
                error: error.message
              }
            }), {
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
        } else {
          return new Response(JSON.stringify({
            vectorize: {
              binding: 'missing',
              status: 'unavailable',
              note: 'SUPPORTING_DOCUMENTS binding not found'
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      // Test Search endpoint (for development/testing)
      if (url.pathname === '/test/search' && request.method === 'GET') {
        const legalArea = url.searchParams.get('legal_area') || 'personal injury';
        const caseType = url.searchParams.get('case_type') || 'auto accident';
        
        try {
          // Mock search test
          const mockRequest = {
            sessionId: 'test-session',
            firmId: 'test-firm',
            legalArea: legalArea,
            caseType: caseType,
            currentGoals: []
          };
          
          // This would be a real search in production
          return new Response(JSON.stringify({
            search: {
              query: `${legalArea} ${caseType}`,
              status: 'simulated',
              note: 'This is a mock search result. In production, this would query the actual SUPPORTING_DOCUMENTS index.',
              mockResults: [
                {
                  id: 'doc_1',
                  title: `${legalArea} Case Requirements`,
                  practiceArea: legalArea,
                  relevanceScore: 0.92
                }
              ]
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            search: {
              status: 'error',
              error: error.message
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      // 404 for unknown endpoints
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Unknown endpoint',
        availableEndpoints: [
          'GET /health - Server health check',
          'GET /info - Server information and capabilities', 
          'POST /mcp - MCP JSON-RPC endpoint',
          'GET /test/vectorize - Test Vectorize binding',
          'GET /test/search?legal_area=X&case_type=Y - Test search functionality'
        ]
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      console.error('AdditionalGoals MCP Server Error:', error);
      
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: env.ENVIRONMENT === 'development' ? error.message : undefined
        }
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

// Helper function to check if request is a notification
function isNotification(body: any): boolean {
  return body && body.jsonrpc === "2.0" && body.method && !('id' in body);
}

// Handle MCP notifications (no response required)
async function handleNotification(notification: MCPNotification): Promise<void> {
  switch (notification.method) {
    case 'initialized':
      console.log('AdditionalGoals MCP: Client initialized');
      break;
    case 'notifications/tools/list_changed':
      console.log('AdditionalGoals MCP: Tools list changed notification');
      break;
    case 'notifications/resources/list_changed':
      console.log('AdditionalGoals MCP: Resources list changed notification');
      break;
    default:
      console.log(`AdditionalGoals MCP: Unknown notification - ${notification.method}`);
  }
}