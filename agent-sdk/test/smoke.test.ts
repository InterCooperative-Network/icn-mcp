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
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Test Agent',
            kind: 'planner'
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Bad Request')
      });

      await expect(registerAgent('http://localhost:8787', {
        name: 'Test Agent',
        kind: 'planner'
      })).rejects.toThrow('HTTP 400: Bad Request');
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
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify({
            title: 'Test Task',
            description: 'Test description'
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed task creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized')
      });

      await expect(createTask('http://localhost:8787', 'test_token', {
        title: 'Test Task'
      })).rejects.toThrow('Authentication failed');
    });
  });

  describe('refreshToken', () => {
    it('successfully refreshes a token', async () => {
      const mockResponse = {
        ok: true,
        token: 'new_token_456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await refreshToken('http://localhost:8787', 'old_token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/agent/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer old_token',
          },
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed token refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized')
      });

      await expect(refreshToken('http://localhost:8787', 'old_token')).rejects.toThrow('Authentication failed');
    });
  });

  describe('claimTask', () => {
    it('successfully claims a task', async () => {
      const mockResponse = {
        task_id: 'task_456',
        title: 'Claimed Task'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await claimTask('http://localhost:8787', 'test_token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/task/claim',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify({}),
        })
      );

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
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify(payload),
        })
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
        actor: 'reviewer' as const,
        action: 'pr.create' as const,
        paths: ['docs/test.md']
      };

      const result = await checkPolicy('http://localhost:8787', 'test_token', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/policy/check',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify(payload),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('createPR', () => {
    it('successfully creates a PR', async () => {
      const mockResponse = {
        ok: true,
        artifact: 'PR-task_123.json'
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
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          },
          body: JSON.stringify(payload),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('throws error when policy denies PR creation', async () => {
      const mockResponse = {
        allow: false,
        reasons: ['Invalid file path', 'Missing documentation']
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

      await expect(createPR('http://localhost:8787', 'test_token', payload))
        .rejects.toThrow('PR creation denied by policy: Invalid file path, Missing documentation');
    });
  });
});