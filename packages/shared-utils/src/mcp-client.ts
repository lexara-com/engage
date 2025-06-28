// MCP Client Implementation for Engage Agent
// Handles communication with MCP servers via JSON-RPC 2.0

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

export interface MCPServerConfig {
  url: string;
  name: string;
  version: string;
}

export class MCPClient {
  private initialized = false;
  private requestId = 1;

  constructor(private config: MCPServerConfig) {}

  // Initialize MCP connection
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const initRequest: MCPRequest = {
      jsonrpc: "2.0",
      id: this.getNextId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {}
        },
        clientInfo: {
          name: this.config.name,
          version: this.config.version
        }
      }
    };

    const response = await this.sendRequest(initRequest);
    
    if (response.error) {
      // If server is already initialized, that's fine - we can proceed
      if (response.error.message.includes('already initialized')) {
        this.initialized = true;
        return;
      }
      throw new Error(`MCP initialization failed: ${response.error.message}`);
    }

    // Send initialized notification
    await this.sendNotification({
      jsonrpc: "2.0",
      method: "initialized"
    });

    this.initialized = true;
  }

  // Call an MCP tool
  async callTool(name: string, arguments_: Record<string, any>): Promise<any> {
    await this.ensureInitialized();

    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.getNextId(),
      method: "tools/call",
      params: {
        name,
        arguments: arguments_
      }
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new Error(`MCP tool call failed: ${response.error.message}`);
    }

    return response.result;
  }

  // List available tools
  async listTools(): Promise<any[]> {
    await this.ensureInitialized();

    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.getNextId(),
      method: "tools/list"
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new Error(`MCP tools/list failed: ${response.error.message}`);
    }

    return response.result?.tools || [];
  }

  // Read an MCP resource
  async readResource(uri: string): Promise<any> {
    await this.ensureInitialized();

    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.getNextId(),
      method: "resources/read",
      params: { uri }
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new Error(`MCP resource read failed: ${response.error.message}`);
    }

    return response.result;
  }

  // List available resources
  async listResources(): Promise<any[]> {
    await this.ensureInitialized();

    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.getNextId(),
      method: "resources/list"
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new Error(`MCP resources/list failed: ${response.error.message}`);
    }

    return response.result?.resources || [];
  }

  // Send HTTP request to MCP server
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      const response = await fetch(`${this.config.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as MCPResponse;
    } catch (error) {
      throw new Error(`MCP request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Send notification (no response expected)
  private async sendNotification(notification: MCPNotification): Promise<void> {
    try {
      await fetch(`${this.config.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notification)
      });
    } catch (error) {
      console.warn('MCP notification failed:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private getNextId(): number {
    return this.requestId++;
  }
}

// Factory functions for creating MCP clients
export function createGoalTrackerClient(baseUrl?: string, env?: any): MCPClient {
  // Default to production URLs, allow override for development
  const url = baseUrl || 'https://engage-goal-tracker-mcp.cloudswift.workers.dev';
    
  return new MCPClient({
    url,
    name: 'engage-agent',
    version: '1.0.0'
  });
}

export function createConflictCheckerClient(baseUrl?: string, env?: any): MCPClient {
  // Default to production URLs, allow override for development
  const url = baseUrl || 'https://engage-conflict-checker-mcp.cloudswift.workers.dev';
    
  return new MCPClient({
    url,
    name: 'engage-agent',
    version: '1.0.0'
  });
}

export function createAdditionalGoalsClient(baseUrl?: string, env?: any): MCPClient {
  // Default to production URLs, allow override for development
  const url = baseUrl || 'https://engage-additional-goals-mcp.cloudswift.workers.dev';
    
  return new MCPClient({
    url,
    name: 'engage-agent',
    version: '1.0.0'
  });
}