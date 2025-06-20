/**
 * Test Setup - Comprehensive testing infrastructure for API Worker
 */
import { Miniflare } from 'miniflare';
export interface TestEnvironment {
    mf: Miniflare;
    db: D1Database;
    env: {
        CONVERSATION_SESSION: DurableObjectNamespace;
        USER_IDENTITY: DurableObjectNamespace;
        FIRM_INDEX_DB: D1Database;
        PLATFORM_DB: D1Database;
        KNOWLEDGE_BASE: VectorizeIndex;
        CONFLICT_DB: VectorizeIndex;
        API_CACHE: KVNamespace;
        ENVIRONMENT: string;
        API_VERSION: string;
        AUTH0_DOMAIN: string;
        AUTH0_AUDIENCE: string;
    };
}
declare let testEnv: TestEnvironment;
/**
 * Initialize test environment with Miniflare
 */
export declare function setupTestEnvironment(): Promise<TestEnvironment>;
/**
 * Initialize database schemas for testing
 */
export declare function initializeTestDatabase(db: D1Database): Promise<void>;
/**
 * Seed test data
 */
export declare function seedTestData(db: D1Database): Promise<void>;
/**
 * Clean up test data between tests
 */
export declare function cleanupTestData(db: D1Database): Promise<void>;
/**
 * Create test auth context
 */
export declare function createTestAuthContext(overrides?: Partial<{
    firmId: string;
    userId: string;
    auth0UserId: string;
    role: string;
    permissions: string[];
}>): {
    firm: {
        firmId: string;
        subscription: string;
        permissions: string[];
        rateLimit: {
            requests: number;
            window: number;
        };
    };
    user: {
        userId: string;
        auth0UserId: string;
        role: string;
        email: string;
        permissions: string[];
    };
    audit: {
        ipAddress: string;
        userAgent: string;
        requestId: string;
    };
};
/**
 * Mock JWT token for testing
 */
export declare function createTestJWT(claims?: Record<string, any>): string;
/**
 * Create test HTTP request
 */
export declare function createTestRequest(options: {
    method?: string;
    path: string;
    body?: any;
    headers?: Record<string, string>;
    authToken?: string;
}): Request;
/**
 * Test utility to wait for async operations
 */
export declare function waitFor(condition: () => Promise<boolean> | boolean, timeout?: number, interval?: number): Promise<void>;
/**
 * Test data factories
 */
export declare const TestDataFactory: {
    conversation: (overrides?: Partial<any>) => {
        sessionId: string;
        userId: string;
        firmId: string;
        clientName: string;
        clientEmail: string;
        practiceArea: string;
        status: string;
        phase: string;
        conflictStatus: string;
        goalsCompleted: number;
        goalsTotal: number;
        dataQualityScore: number;
        createdAt: string;
        lastActivity: string;
        isDeleted: boolean;
    };
    user: (overrides?: Partial<any>) => {
        userId: string;
        firmId: string;
        auth0UserId: string;
        email: string;
        name: string;
        role: string;
        status: string;
        lastLogin: string;
        conversationCount: number;
        createdAt: string;
    };
    assignment: (overrides?: Partial<any>) => {
        assignmentId: string;
        sessionId: string;
        firmId: string;
        assignedTo: string;
        assignedBy: string;
        assignedAt: string;
        status: string;
        priority: string;
        dueDate: string;
        notes: string;
    };
};
export { testEnv };
//# sourceMappingURL=setup.d.ts.map