import { describe, it, expect } from 'vitest';
import { GET as testD1Binding } from '../src/pages/api/firm/test-d1-binding';

describe('D1 Database Binding Tests', () => {
  describe('Database Binding Pattern', () => {
    it('should detect when D1 binding is missing', async () => {
      const mockContext = {
        env: {}
      };
      
      const response = await testD1Binding(mockContext as any);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('D1 binding not found');
    });
    
    it('should work when D1 binding is present', async () => {
      const mockDB = {
        prepare: () => ({
          first: async () => ({ test: 1 })
        })
      };
      
      const mockContext = {
        env: {
          DB: mockDB
        }
      };
      
      const response = await testD1Binding(mockContext as any);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('D1 binding is working');
    });
  });
});