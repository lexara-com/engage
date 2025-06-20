/**
 * Unit Tests - ConversationService
 *
 * Tests the core business logic of conversation management,
 * hybrid data routing, and service layer functionality.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationService } from '../../../src/services/data-layer/conversation-service';
import { TestDataFactory } from '../../setup';
// Mock dependencies
const mockDurableObjectNamespace = {
    get: vi.fn(),
    idFromName: vi.fn()
};
const mockD1Database = {
    prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
            all: vi.fn(),
            first: vi.fn(),
            run: vi.fn()
        }))
    })),
    exec: vi.fn()
};
const mockVectorizeIndex = {
    query: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn()
};
const mockEnv = {
    CONVERSATION_SESSION: mockDurableObjectNamespace,
    FIRM_INDEX_DB: mockD1Database,
    VECTORIZE_KNOWLEDGE: mockVectorizeIndex
};
describe('ConversationService', () => {
    let conversationService;
    beforeEach(() => {
        vi.clearAllMocks();
        conversationService = new ConversationService(mockEnv);
    });
    describe('createConversation', () => {
        it('should create a new conversation and sync to index', async () => {
            // Setup mocks
            const mockConversationDO = {
                create: vi.fn().mockResolvedValue({
                    sessionId: 'session_123',
                    userId: 'user_123',
                    firmId: 'firm_test_001',
                    clientName: 'John Doe',
                    createdAt: new Date(),
                    lastActivity: new Date()
                })
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            mockDurableObjectNamespace.idFromName.mockReturnValue('do_id_123');
            // Execute
            const result = await conversationService.createConversation('firm_test_001', {
                clientName: 'John Doe',
                practiceArea: 'personal_injury'
            });
            // Verify
            expect(result).toBeDefined();
            expect(result.firmId).toBe('firm_test_001');
            expect(result.clientName).toBe('John Doe');
            expect(mockConversationDO.create).toHaveBeenCalledWith(expect.objectContaining({
                firmId: 'firm_test_001',
                clientName: 'John Doe',
                practiceArea: 'personal_injury'
            }));
        });
        it('should generate unique session and user IDs', async () => {
            const mockConversationDO = {
                create: vi.fn().mockResolvedValue({
                    sessionId: 'session_123',
                    userId: 'user_123',
                    firmId: 'firm_test_001'
                })
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            await conversationService.createConversation('firm_test_001', {});
            const createCall = mockConversationDO.create.mock.calls[0][0];
            expect(createCall.sessionId).toMatch(/^[0-9A-Z]{26}$/); // ULID format
            expect(createCall.userId).toMatch(/^[0-9A-Z]{26}$/);
        });
    });
    describe('listConversations', () => {
        it('should query D1 index with proper filters', async () => {
            const mockResults = {
                results: [
                    TestDataFactory.conversation(),
                    TestDataFactory.conversation({ status: 'completed' })
                ]
            };
            mockD1Database.prepare().bind().all.mockResolvedValue(mockResults);
            mockD1Database.prepare().bind().first.mockResolvedValue({ total: 2 });
            const result = await conversationService.listConversations('firm_test_001', {
                status: 'active',
                limit: 10,
                offset: 0
            });
            expect(result.conversations).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(mockD1Database.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE firmId = ? AND isDeleted = FALSE'));
        });
        it('should handle pagination correctly', async () => {
            const mockResults = { results: Array(51).fill(TestDataFactory.conversation()) };
            mockD1Database.prepare().bind().all.mockResolvedValue(mockResults);
            mockD1Database.prepare().bind().first.mockResolvedValue({ total: 100 });
            const result = await conversationService.listConversations('firm_test_001', {
                limit: 50,
                offset: 0
            });
            expect(result.conversations).toHaveLength(50); // Should limit to 50
            expect(result.hasMore).toBe(true); // Should detect more records
            expect(result.total).toBe(100);
        });
        it('should apply multiple filters correctly', async () => {
            mockD1Database.prepare().bind().all.mockResolvedValue({ results: [] });
            mockD1Database.prepare().bind().first.mockResolvedValue({ total: 0 });
            await conversationService.listConversations('firm_test_001', {
                status: 'active',
                assignedTo: 'user_123',
                practiceArea: 'family_law'
            });
            const query = mockD1Database.prepare.mock.calls[0][0];
            expect(query).toContain('AND status = ?');
            expect(query).toContain('AND assignedTo = ?');
            expect(query).toContain('AND practiceArea = ?');
        });
    });
    describe('getConversation', () => {
        it('should fetch conversation from Durable Object', async () => {
            const mockConversationDO = {
                getState: vi.fn().mockResolvedValue({
                    sessionId: 'session_123',
                    firmId: 'firm_test_001',
                    messages: [
                        { role: 'user', content: 'Hello' },
                        { role: 'assistant', content: 'Hi there!' }
                    ]
                })
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            mockDurableObjectNamespace.idFromName.mockReturnValue('do_id_123');
            const result = await conversationService.getConversation('session_123');
            expect(result).toBeDefined();
            expect(result?.sessionId).toBe('session_123');
            expect(result?.messages).toHaveLength(2);
            expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith('session_123');
        });
        it('should return null for non-existent conversation', async () => {
            const mockConversationDO = {
                getState: vi.fn().mockResolvedValue(null)
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            const result = await conversationService.getConversation('nonexistent');
            expect(result).toBeNull();
        });
    });
    describe('addMessage', () => {
        it('should add message to DO and trigger index sync', async () => {
            const mockConversationDO = {
                addMessage: vi.fn().mockResolvedValue({
                    sessionId: 'session_123',
                    messages: [
                        { role: 'user', content: 'Hello' },
                        { role: 'assistant', content: 'Hi there!' }
                    ],
                    lastActivity: new Date()
                })
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            const messageData = {
                content: 'Test message',
                role: 'user'
            };
            const result = await conversationService.addMessage('session_123', messageData);
            expect(result).toBeDefined();
            expect(result.messages).toHaveLength(2);
            expect(mockConversationDO.addMessage).toHaveBeenCalledWith(expect.objectContaining({
                content: 'Test message',
                role: 'user',
                timestamp: expect.any(Date)
            }));
        });
        it('should include timestamp if not provided', async () => {
            const mockConversationDO = {
                addMessage: vi.fn().mockResolvedValue({})
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            await conversationService.addMessage('session_123', {
                content: 'Test',
                role: 'user'
            });
            const addMessageCall = mockConversationDO.addMessage.mock.calls[0][0];
            expect(addMessageCall.timestamp).toBeInstanceOf(Date);
        });
    });
    describe('searchConversations', () => {
        it('should perform vector search and fetch results from D1', async () => {
            const mockVectorResults = {
                matches: [
                    { id: 'session_123', score: 0.85 },
                    { id: 'session_456', score: 0.78 }
                ]
            };
            const mockD1Results = {
                results: [
                    TestDataFactory.conversation({ sessionId: 'session_123' }),
                    TestDataFactory.conversation({ sessionId: 'session_456' })
                ]
            };
            mockVectorizeIndex.query.mockResolvedValue(mockVectorResults);
            mockD1Database.prepare().bind().all.mockResolvedValue(mockD1Results);
            const result = await conversationService.searchConversations('firm_test_001', 'car accident injury', { limit: 10, threshold: 0.7 });
            expect(result.conversations).toHaveLength(2);
            expect(result.scores).toEqual([0.85, 0.78]);
            expect(mockVectorizeIndex.query).toHaveBeenCalledWith('car accident injury', expect.objectContaining({
                topK: 10,
                filter: { firmId: 'firm_test_001' }
            }));
        });
        it('should filter results by threshold', async () => {
            const mockVectorResults = {
                matches: [
                    { id: 'session_123', score: 0.85 },
                    { id: 'session_456', score: 0.65 } // Below threshold
                ]
            };
            mockVectorizeIndex.query.mockResolvedValue(mockVectorResults);
            mockD1Database.prepare().bind().all.mockResolvedValue({ results: [] });
            const result = await conversationService.searchConversations('firm_test_001', 'test query', { threshold: 0.7 });
            // Should only return results above threshold
            expect(mockD1Database.prepare).toHaveBeenCalledWith(expect.stringContaining('sessionId IN (?)'));
        });
        it('should return empty results when no matches above threshold', async () => {
            const mockVectorResults = {
                matches: [
                    { id: 'session_123', score: 0.5 },
                    { id: 'session_456', score: 0.4 }
                ]
            };
            mockVectorizeIndex.query.mockResolvedValue(mockVectorResults);
            const result = await conversationService.searchConversations('firm_test_001', 'test query', { threshold: 0.7 });
            expect(result.conversations).toHaveLength(0);
            expect(result.scores).toHaveLength(0);
        });
    });
    describe('getConversationAnalytics', () => {
        it('should aggregate conversation metrics from D1', async () => {
            // Mock D1 query results
            mockD1Database.prepare().bind().first
                .mockResolvedValueOnce({ total: 100 }) // Total conversations
                .mockResolvedValueOnce({ completed: 75 }); // Completed conversations
            mockD1Database.prepare().bind().all
                .mockResolvedValueOnce({
                results: [
                    { area: 'personal_injury', count: 50 },
                    { area: 'family_law', count: 30 }
                ]
            })
                .mockResolvedValueOnce({
                results: [
                    { status: 'completed', count: 75 },
                    { status: 'active', count: 25 }
                ]
            });
            const result = await conversationService.getConversationAnalytics('firm_test_001', {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31')
            });
            expect(result.totalConversations).toBe(100);
            expect(result.completedConversations).toBe(75);
            expect(result.conversionRate).toBe(75);
            expect(result.topPracticeAreas).toHaveLength(2);
            expect(result.statusDistribution).toHaveLength(2);
        });
        it('should handle zero conversations gracefully', async () => {
            mockD1Database.prepare().bind().first
                .mockResolvedValueOnce({ total: 0 })
                .mockResolvedValueOnce({ completed: 0 });
            mockD1Database.prepare().bind().all
                .mockResolvedValueOnce({ results: [] })
                .mockResolvedValueOnce({ results: [] });
            const result = await conversationService.getConversationAnalytics('firm_test_001', { startDate: new Date(), endDate: new Date() });
            expect(result.totalConversations).toBe(0);
            expect(result.conversionRate).toBe(0);
            expect(result.topPracticeAreas).toHaveLength(0);
        });
    });
    describe('Data Quality Score Calculation', () => {
        it('should calculate score based on goal completion and data completeness', () => {
            const conversationWithCompleteData = {
                dataGoals: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
                completedGoals: ['1', '2', '3', '4'],
                userIdentity: {
                    name: 'John Doe',
                    email: 'john@example.com',
                    phone: '555-1234',
                    legalArea: 'personal_injury'
                },
                conflictCheck: { status: 'clear' }
            };
            // Access private method for testing
            const service = conversationService;
            const score = service.calculateDataQualityScore(conversationWithCompleteData);
            // Should be close to 100 (50% goals + 30% identity + 20% conflict)
            expect(score).toBe(100);
        });
        it('should handle incomplete data correctly', () => {
            const conversationWithIncompleteData = {
                dataGoals: [{ id: '1' }, { id: '2' }],
                completedGoals: ['1'], // 50% completion
                userIdentity: {
                    name: 'John Doe',
                    email: 'john@example.com'
                    // Missing phone and legal area (50% complete)
                },
                conflictCheck: { status: 'pending' } // Incomplete
            };
            const service = conversationService;
            const score = service.calculateDataQualityScore(conversationWithIncompleteData);
            // Should be 25 (50% of 50%) + 15 (50% of 30%) + 0 (0% of 20%) = 40
            expect(score).toBe(40);
        });
    });
    describe('ULID Generation', () => {
        it('should generate valid ULID format', () => {
            const service = conversationService;
            const ulid = service.generateULID();
            expect(ulid).toMatch(/^[0-9A-Z]{26}$/);
            expect(ulid).toHaveLength(26);
        });
        it('should generate unique ULIDs', () => {
            const service = conversationService;
            const ulid1 = service.generateULID();
            const ulid2 = service.generateULID();
            expect(ulid1).not.toBe(ulid2);
        });
    });
    describe('Error Handling', () => {
        it('should handle DO operation failures gracefully', async () => {
            const mockConversationDO = {
                getState: vi.fn().mockRejectedValue(new Error('DO unavailable'))
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            await expect(conversationService.getConversation('session_123')).rejects.toThrow('DO unavailable');
        });
        it('should handle D1 query failures gracefully', async () => {
            mockD1Database.prepare().bind().all.mockRejectedValue(new Error('Database error'));
            await expect(conversationService.listConversations('firm_test_001')).rejects.toThrow('Database error');
        });
        it('should continue operation if index sync fails', async () => {
            const mockConversationDO = {
                addMessage: vi.fn().mockResolvedValue({
                    sessionId: 'session_123',
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            };
            mockDurableObjectNamespace.get.mockReturnValue(mockConversationDO);
            // Mock index sync failure (should not throw)
            mockD1Database.prepare().bind().run.mockRejectedValue(new Error('Index sync failed'));
            const result = await conversationService.addMessage('session_123', {
                content: 'Test',
                role: 'user'
            });
            // Should still return the result despite sync failure
            expect(result).toBeDefined();
            expect(result.sessionId).toBe('session_123');
        });
    });
});
//# sourceMappingURL=conversation-service.test.js.map