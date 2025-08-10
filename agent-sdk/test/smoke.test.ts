import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAgent, createTask } from '../src/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('agent-sdk', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('registerAgent', () => {
    it('successfully registers an agent', async () => {
      const mockResponse = {
        ok: true,
        id: 'agent_123',
        token: 'test_token_456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await registerAgent('http://localhost:8787', {
        name: 'Test Agent',
        kind: 'planner'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/agent/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Test Agent',
            kind: 'planner'
          }),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(registerAgent('http://localhost:8787', {
        name: 'Test Agent',
        kind: 'planner'
      })).rejects.toThrow('Failed to register agent: 400 Bad Request');
    });
  });

  describe('createTask', () => {
    it('successfully creates a task', async () => {
      const mockResponse = {
        ok: true,
        id: 'task_123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await createTask('http://localhost:8787', 'test_token', {
        title: 'Test Task',
        description: 'Test description'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/task/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify({
            title: 'Test Task',
            description: 'Test description'
          }),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed task creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(createTask('http://localhost:8787', 'invalid_token', {
        title: 'Test Task'
      })).rejects.toThrow('Failed to create task: 401 Unauthorized');
    });
  });
});

