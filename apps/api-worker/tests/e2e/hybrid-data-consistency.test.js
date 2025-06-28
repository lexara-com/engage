/**
 * End-to-End Tests - Hybrid Data Consistency
 *
 * Tests the complete data flow between Durable Objects and D1 indexes,
 * ensuring data consistency and proper synchronization in the hybrid architecture.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { testEnv, createTestRequest, createTestJWT, waitFor } from '../setup';
import app from '../../src/api/api-worker';
describe('Hybrid Data Consistency E2E Tests', () => {
    let authToken;
    let testFirmId;
    let testUserId;
    beforeEach(() => {
        testFirmId = 'firm_test_001';
        testUserId = 'user_test_001';
        authToken = createTestJWT({
            org: testFirmId,
            sub: testUserId,
            role: 'attorney',
            permissions: ['view_conversations', 'manage_conversations', 'assign_conversations']
        });
    });
    describe('Conversation Lifecycle Data Consistency', () => {
        it('should maintain consistency through complete conversation lifecycle', async () => {
            // Step 1: Create a new conversation (should exist in DO immediately)
            const createResponse = await app.fetch(createTestRequest({
                method: 'POST',
                path: '/api/v1/firm/conversations',
                body: {
                    clientName: 'E2E Test Client',
                    clientEmail: 'e2e@example.com',
                    practiceArea: 'personal_injury'
                },
                authToken
            }), testEnv.env);
            expect(createResponse.status).toBe(200);
            const { conversation: newConversation } = await createResponse.json();
            const sessionId = newConversation.sessionId;
            // Step 2: Verify conversation exists in DO (immediate)
            const doDetailResponse = await app.fetch(createTestRequest({
                method: 'GET',
                path: `/api/v1/firm/conversations/${sessionId}`,
                authToken
            }), testEnv.env);
            expect(doDetailResponse.status).toBe(200);
            const { conversation: doConversation } = await doDetailResponse.json();
            expect(doConversation.sessionId).toBe(sessionId);
            expect(doConversation.clientName).toBe('E2E Test Client');
            // Step 3: Wait for D1 index sync and verify conversation appears in list
            await waitFor(async () => {
                const listResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: '/api/v1/firm/conversations',
                    authToken
                }), testEnv.env);
                if (listResponse.status !== 200)
                    return false;
                const { conversations } = await listResponse.json();
                return conversations.some((c) => c.sessionId === sessionId);
            }, 10000);
            // Step 4: Add messages and verify DO update + D1 sync
            const messageData = {
                content: 'I was injured in a car accident',
                role: 'user',
                metadata: { source: 'web_chat' }
            };
            const messageResponse = await app.fetch(createTestRequest({
                method: 'POST',
                path: `/api/v1/firm/conversations/${sessionId}/messages`,
                body: messageData,
                authToken
            }), testEnv.env);
            expect(messageResponse.status).toBe(200);
            const { conversation: updatedConversation } = await messageResponse.json();
            expect(updatedConversation.messages).toContainEqual(expect.objectContaining({
                content: 'I was injured in a car accident',
                role: 'user'
            }));
            // Step 5: Verify lastActivity updated in D1 index
            await waitFor(async () => {
                const listResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: '/api/v1/firm/conversations',
                    authToken
                }), testEnv.env);
                if (listResponse.status !== 200)
                    return false;
                const { conversations } = await listResponse.json();
                const indexedConversation = conversations.find((c) => c.sessionId === sessionId);
                return indexedConversation &&
                    new Date(indexedConversation.lastActivity) >= new Date(Date.now() - 30000);
            }, 10000);
            // Step 6: Assign conversation and verify consistency
            const assignmentResponse = await app.fetch(createTestRequest({
                method: 'PUT',
                path: `/api/v1/firm/conversations/${sessionId}/assignment`,
                body: { assignedTo: testUserId },
                authToken
            }), testEnv.env);
            expect(assignmentResponse.status).toBe(200);
            // Step 7: Verify assignment in both DO and D1
            const assignedDoResponse = await app.fetch(createTestRequest({
                method: 'GET',
                path: `/api/v1/firm/conversations/${sessionId}`,
                authToken
            }), testEnv.env);
            const { conversation: assignedDoConversation } = await assignedDoResponse.json();
            expect(assignedDoConversation.assignedTo).toBe(testUserId);
            await waitFor(async () => {
                const listResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: `/api/v1/firm/conversations?assignedTo=${testUserId}`,
                    authToken
                }), testEnv.env);
                if (listResponse.status !== 200)
                    return false;
                const { conversations } = await listResponse.json();
                return conversations.some((c) => c.sessionId === sessionId && c.assignedTo === testUserId);
            }, 10000);
            // Step 8: Update status and verify final consistency
            const statusResponse = await app.fetch(createTestRequest({
                method: 'PUT',
                path: `/api/v1/firm/conversations/${sessionId}/status`,
                body: { status: 'completed' },
                authToken
            }), testEnv.env);
            expect(statusResponse.status).toBe(200);
            // Final verification: Ensure both DO and D1 show completed status
            await waitFor(async () => {
                const [doResponse, listResponse] = await Promise.all([
                    app.fetch(createTestRequest({
                        method: 'GET',
                        path: `/api/v1/firm/conversations/${sessionId}`,
                        authToken
                    }), testEnv.env),
                    app.fetch(createTestRequest({
                        method: 'GET',
                        path: `/api/v1/firm/conversations?status=completed`,
                        authToken
                    }), testEnv.env)
                ]);
                if (doResponse.status !== 200 || listResponse.status !== 200)
                    return false;
                const { conversation: doFinalConversation } = await doResponse.json();
                const { conversations: completedConversations } = await listResponse.json();
                return doFinalConversation.status === 'completed' &&
                    completedConversations.some((c) => c.sessionId === sessionId);
            }, 10000);
        });
        it('should handle concurrent updates without data corruption', async () => {
            const sessionId = 'session_test_001';
            // Simulate concurrent message additions
            const concurrentMessages = [
                { content: 'Message 1', role: 'user' },
                { content: 'Message 2', role: 'assistant' },
                { content: 'Message 3', role: 'user' },
                { content: 'Message 4', role: 'assistant' },
                { content: 'Message 5', role: 'user' }
            ];
            const messagePromises = concurrentMessages.map((message, index) => app.fetch(createTestRequest({
                method: 'POST',
                path: `/api/v1/firm/conversations/${sessionId}/messages`,
                body: { ...message, timestamp: new Date(Date.now() + index * 100) },
                authToken
            }), testEnv.env));
            const responses = await Promise.all(messagePromises);
            // All requests should succeed (or fail gracefully)
            responses.forEach(response => {
                expect([200, 404, 409]).toContain(response.status);
            });
            // Wait for all operations to complete and verify final state
            await waitFor(async () => {
                const detailResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: `/api/v1/firm/conversations/${sessionId}`,
                    authToken
                }), testEnv.env);
                if (detailResponse.status !== 200)
                    return false;
                const { conversation } = await detailResponse.json();
                return conversation.messages.length >= 3; // At least some messages should be present
            }, 15000);
        });
    });
    describe('Analytics Data Consistency', () => {
        it('should maintain accurate analytics across data sources', async () => {
            // Create multiple conversations with different statuses
            const conversationsToCreate = [
                { clientName: 'Client 1', practiceArea: 'personal_injury', status: 'active' },
                { clientName: 'Client 2', practiceArea: 'family_law', status: 'completed' },
                { clientName: 'Client 3', practiceArea: 'personal_injury', status: 'completed' }
            ];
            const createdConversations = [];
            for (const convData of conversationsToCreate) {
                const createResponse = await app.fetch(createTestRequest({
                    method: 'POST',
                    path: '/api/v1/firm/conversations',
                    body: convData,
                    authToken
                }), testEnv.env);
                if (createResponse.status === 200) {
                    const { conversation } = await createResponse.json();
                    createdConversations.push(conversation);
                    // Update status if needed
                    if (convData.status !== 'active') {
                        await app.fetch(createTestRequest({
                            method: 'PUT',
                            path: `/api/v1/firm/conversations/${conversation.sessionId}/status`,
                            body: { status: convData.status },
                            authToken
                        }), testEnv.env);
                    }
                }
            }
            // Wait for D1 sync
            await waitFor(async () => {
                const listResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: '/api/v1/firm/conversations',
                    authToken
                }), testEnv.env);
                if (listResponse.status !== 200)
                    return false;
                const { conversations } = await listResponse.json();
                return conversations.length >= createdConversations.length;
            }, 15000);
            // Verify analytics reflect the created conversations
            const analyticsResponse = await app.fetch(createTestRequest({
                method: 'GET',
                path: '/api/v1/firm/analytics/overview',
                authToken
            }), testEnv.env);
            expect(analyticsResponse.status).toBe(200);
            const { analytics } = await analyticsResponse.json();
            expect(analytics.totalConversations).toBeGreaterThanOrEqual(3);
            expect(analytics.completedConversations).toBeGreaterThanOrEqual(2);
            // Verify practice area analytics
            const practiceAreaResponse = await app.fetch(createTestRequest({
                method: 'GET',
                path: '/api/v1/firm/analytics/practice-areas',
                authToken
            }), testEnv.env);
            expect(practiceAreaResponse.status).toBe(200);
            const { practiceAreaMetrics } = await practiceAreaResponse.json();
            const personalInjuryMetrics = practiceAreaMetrics.find((m) => m.practiceArea === 'personal_injury');
            const familyLawMetrics = practiceAreaMetrics.find((m) => m.practiceArea === 'family_law');
            expect(personalInjuryMetrics?.totalConversations).toBeGreaterThanOrEqual(2);
            expect(familyLawMetrics?.totalConversations).toBeGreaterThanOrEqual(1);
        });
    });
    describe('Search Index Consistency', () => {
        it('should maintain search index consistency with conversation updates', async () => {
            const sessionId = 'session_test_001';
            // Add searchable content to conversation
            const searchableMessages = [
                { content: 'I was in a car accident on Highway 101', role: 'user' },
                { content: 'The other driver ran a red light', role: 'user' },
                { content: 'I suffered whiplash and back injuries', role: 'user' }
            ];
            for (const message of searchableMessages) {
                await app.fetch(createTestRequest({
                    method: 'POST',
                    path: `/api/v1/firm/conversations/${sessionId}/messages`,
                    body: message,
                    authToken
                }), testEnv.env);
                // Small delay to ensure messages are processed in order
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            // Wait for search index to update
            await waitFor(async () => {
                const searchResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: '/api/v1/firm/search/conversations?q=car%20accident',
                    authToken
                }), testEnv.env);
                if (searchResponse.status !== 200)
                    return false;
                const { conversations } = await searchResponse.json();
                return conversations.some((c) => c.sessionId === sessionId);
            }, 20000);
            // Verify search finds the conversation with relevant terms
            const searchResponse = await app.fetch(createTestRequest({
                method: 'GET',
                path: '/api/v1/firm/search/conversations?q=whiplash%20injury',
                authToken
            }), testEnv.env);
            expect(searchResponse.status).toBe(200);
            const { conversations, scores } = await searchResponse.json();
            expect(conversations.length).toBeGreaterThanOrEqual(1);
            expect(scores.length).toBeGreaterThanOrEqual(1);
            // Verify semantic search quality
            if (conversations.length > 0) {
                expect(scores[0]).toBeGreaterThan(0.5); // Reasonable similarity score
            }
        });
    });
    describe('Assignment Workflow Consistency', () => {
        it('should maintain assignment consistency across all data layers', async () => {
            const sessionId = 'session_test_001';
            const assigneeId = testUserId;
            // Create assignment
            const assignmentResponse = await app.fetch(createTestRequest({
                method: 'POST',
                path: '/api/v1/firm/assignments',
                body: {
                    sessionId,
                    assignedTo: assigneeId,
                    priority: 'high',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    notes: 'High priority case requiring immediate attention'
                },
                authToken
            }), testEnv.env);
            expect(assignmentResponse.status).toBe(200);
            // Verify assignment appears in assignment list
            await waitFor(async () => {
                const assignmentListResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: `/api/v1/firm/assignments?assignedTo=${assigneeId}`,
                    authToken
                }), testEnv.env);
                if (assignmentListResponse.status !== 200)
                    return false;
                const { assignments } = await assignmentListResponse.json();
                return assignments.some((a) => a.sessionId === sessionId && a.assignedTo === assigneeId);
            }, 10000);
            // Verify conversation shows as assigned
            await waitFor(async () => {
                const conversationResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: `/api/v1/firm/conversations/${sessionId}`,
                    authToken
                }), testEnv.env);
                if (conversationResponse.status !== 200)
                    return false;
                const { conversation } = await conversationResponse.json();
                return conversation.assignedTo === assigneeId;
            }, 10000);
            // Verify workload analysis reflects the assignment
            const workloadResponse = await app.fetch(createTestRequest({
                method: 'GET',
                path: '/api/v1/firm/assignments/workload',
                authToken
            }), testEnv.env);
            expect(workloadResponse.status).toBe(200);
            const { workloadAnalysis } = await workloadResponse.json();
            const userWorkload = workloadAnalysis.find((w) => w.assignedTo === assigneeId);
            expect(userWorkload).toBeDefined();
            expect(userWorkload.totalAssignments).toBeGreaterThanOrEqual(1);
        });
    });
    describe('Data Recovery and Resilience', () => {
        it('should maintain data integrity during simulated failures', async () => {
            const sessionId = 'session_test_001';
            // Perform multiple operations that should be resilient to partial failures
            const operations = [
                () => app.fetch(createTestRequest({
                    method: 'POST',
                    path: `/api/v1/firm/conversations/${sessionId}/messages`,
                    body: { content: 'Resilience test message 1', role: 'user' },
                    authToken
                }), testEnv.env),
                () => app.fetch(createTestRequest({
                    method: 'PUT',
                    path: `/api/v1/firm/conversations/${sessionId}/status`,
                    body: { status: 'in_review' },
                    authToken
                }), testEnv.env),
                () => app.fetch(createTestRequest({
                    method: 'POST',
                    path: `/api/v1/firm/conversations/${sessionId}/messages`,
                    body: { content: 'Resilience test message 2', role: 'assistant' },
                    authToken
                }), testEnv.env)
            ];
            // Execute operations with some delay
            for (const operation of operations) {
                const response = await operation();
                expect([200, 404]).toContain(response.status);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            // Verify final state is consistent
            await waitFor(async () => {
                const detailResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: `/api/v1/firm/conversations/${sessionId}`,
                    authToken
                }), testEnv.env);
                if (detailResponse.status !== 200)
                    return false;
                const { conversation } = await detailResponse.json();
                // Verify the conversation has been updated
                return conversation.messages.length >= 2 &&
                    conversation.status === 'in_review';
            }, 15000);
            // Verify index consistency
            await waitFor(async () => {
                const listResponse = await app.fetch(createTestRequest({
                    method: 'GET',
                    path: '/api/v1/firm/conversations?status=in_review',
                    authToken
                }), testEnv.env);
                if (listResponse.status !== 200)
                    return false;
                const { conversations } = await listResponse.json();
                return conversations.some((c) => c.sessionId === sessionId);
            }, 15000);
        });
    });
});
//# sourceMappingURL=hybrid-data-consistency.test.js.map