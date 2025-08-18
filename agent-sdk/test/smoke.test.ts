import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAgent, createTask, refreshToken, claimTask, runTask, checkPolicy, createPR } from '../src/index.js';

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

  describe('refreshToken', () => {
    it('successfully refreshes a token', async () => {
      const mockResponse = {
        ok: true,
        token: 'new_test_token_789'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await refreshToken('http://localhost:8787', 'old_token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/agent/refresh',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer old_token',
          },
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed token refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(refreshToken('http://localhost:8787', 'invalid_token')).rejects.toThrow('Failed to refresh token: 401 Unauthorized');
    });
  });

  describe('claimTask', () => {
    it('successfully claims a task', async () => {
      const mockResponse = {
        task_id: 'task_123',
        title: 'Test Task'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await claimTask('http://localhost:8787', 'test_token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/task/claim',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify({}),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles no available tasks', async () => {
      const mockResponse = {
        error: 'no_available_tasks'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await claimTask('http://localhost:8787', 'test_token');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('runTask', () => {
    it('successfully runs a task', async () => {
      const mockResponse = {
        ok: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const payload = {
        task_id: 'task_123',
        status: 'in_progress' as const,
        notes: 'Running tests'
      };

      const result = await runTask('http://localhost:8787', 'test_token', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/task/run',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify(payload),
        }
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('checkPolicy', () => {
    it('successfully checks policy', async () => {
      const mockResponse = {
        allow: true,
        reasons: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const payload = {
        actor: 'reviewer',
        changedPaths: ['docs/test.md']
      };

      const result = await checkPolicy('http://localhost:8787', 'test_token', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/policy/check',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify(payload),
        }
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('createPR', () => {
    it('successfully creates a PR', async () => {
      const mockResponse = {
        ok: true,
        artifact: 'PR-123.json',
        mode: 'local'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const payload = {
        task_id: 'task_123',
        title: 'Test PR',
        body: 'Test PR body',
        files: [{ path: 'test.md', content: 'test content' }]
      };

      const result = await createPR('http://localhost:8787', 'test_token', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/pr/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify(payload),
        }
      );

      expect(result).toEqual(mockResponse);
    });
  });
});

