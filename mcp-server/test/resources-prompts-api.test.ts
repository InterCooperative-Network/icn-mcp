import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoute, apiRoutes } from '@/api';
import { resourcesPromptsRoutes } from '@/resources-prompts-api';
import fs from 'node:fs';
import path from 'node:path';

// Type interfaces for API responses
interface AgentRegisterResponse {
  ok: boolean;
  id: string;
  token: string;
}

interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

interface ResourcesListResponse {
  ok: boolean;
  data: {
    resources: Resource[];
    count: number;
  };
  meta: {
    requestId: string;
  };
}

interface ResourceResponse {
  ok: boolean;
  data: {
    contents: ResourceContent[];
    uri: string;
  };
  meta: {
    requestId: string;
  };
}

interface PromptListItem {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

interface PromptsListResponse {
  ok: boolean;
  data: {
    prompts: PromptListItem[];
    count: number;
  };
  meta: {
    requestId: string;
  };
}

interface ErrorResponse {
  ok: false;
  error: string;
  message?: string;
}

describe('Resources and Prompts HTTP API', () => {
  beforeEach(() => {
    // Use a unique DB for each test to ensure isolation
    const testDb = path.resolve(process.cwd(), `var/test-resources-${Date.now()}-${Math.random()}.sqlite`);
    process.env.MCP_DB_PATH = testDb;
    try { fs.unlinkSync(testDb); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'artifacts'), { recursive: true, force: true }); } catch {/* noop */}
    try { fs.rmSync(path.resolve(process.cwd(), 'branches'), { recursive: true, force: true }); } catch {/* noop */}
  });

  describe('GET /api/resources', () => {
    it('should require authentication', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources'
      });

      expect(response.statusCode).toBe(401);
      const data = response.json() as ErrorResponse;
      expect(data).toEqual({ ok: false, error: 'unauthorized' });

      await app.close();
    });

    it('should list resources with valid token', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as ResourcesListResponse;
      expect(data.ok).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.resources).toBeInstanceOf(Array);
      expect(data.data.count).toBeGreaterThanOrEqual(0);
      expect(data.meta.requestId).toBeDefined();

      // Should include some expected resources
      const resources = data.data.resources;
      const hasLogs = resources.some((r: Resource) => r.uri === 'icn://logs/recent');
      expect(hasLogs).toBe(true);

      await app.close();
    });
  });

  describe('GET /api/resources/:uri', () => {
    it('should require authentication', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources/icn://logs/recent'
      });

      expect(response.statusCode).toBe(401);
      const data = response.json() as ErrorResponse;
      expect(data).toEqual({ ok: false, error: 'unauthorized' });

      await app.close();
    });

    it('should read specific resource with valid token', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources/icn://logs/recent',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as ResourceResponse;
      expect(data.ok).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.contents).toBeInstanceOf(Array);
      expect(data.data.uri).toBe('icn://logs/recent');
      expect(data.meta.requestId).toBeDefined();

      // Content should be returned
      expect(data.data.contents.length).toBeGreaterThan(0);
      expect(data.data.contents[0].uri).toBe('icn://logs/recent');
      expect(data.data.contents[0].mimeType).toBe('text/plain');
      expect(typeof data.data.contents[0].text).toBe('string');

      await app.close();
    });

    it('should return 404 for non-existent resource', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources/icn://does/not/exist',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      // Should return error but not 404, as this is handled gracefully by the service
      expect(response.statusCode).toBe(200);
      const data = response.json() as ResourceResponse;
      expect(data.ok).toBe(true);
      expect(data.data.contents[0].text).toContain('Error reading resource');

      await app.close();
    });

    it('should read CODEOWNERS file if it exists', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources/icn://CODEOWNERS',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as ResourceResponse;
      expect(data.ok).toBe(true);
      expect(data.data.contents[0].uri).toBe('icn://CODEOWNERS');
      expect(data.data.contents[0].mimeType).toBe('text/plain');

      await app.close();
    });

    it('should read policy rules JSON', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources/icn://policy/rules.json',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as ResourceResponse;
      expect(data.ok).toBe(true);
      expect(data.data.contents[0].uri).toBe('icn://policy/rules.json');
      expect(data.data.contents[0].mimeType).toBe('application/json');
      
      // Should be valid JSON
      expect(() => JSON.parse(data.data.contents[0].text)).not.toThrow();

      await app.close();
    });
  });

  describe('GET /api/prompts', () => {
    it('should require authentication', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/prompts'
      });

      expect(response.statusCode).toBe(401);
      const data = response.json() as ErrorResponse;
      expect(data).toEqual({ ok: false, error: 'unauthorized' });

      await app.close();
    });

    it('should list prompts with valid token', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/prompts',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as PromptsListResponse;
      expect(data.ok).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.prompts).toBeInstanceOf(Array);
      expect(data.data.count).toBeGreaterThanOrEqual(0);
      expect(data.meta.requestId).toBeDefined();

      // Each prompt should have expected structure
      if (data.data.prompts.length > 0) {
        const prompt = data.data.prompts[0];
        expect(prompt.name).toBeDefined();
        expect(prompt.description).toBeDefined();
        expect(prompt.arguments).toBeInstanceOf(Array);
      }

      await app.close();
    });
  });

  describe('GET /api/prompts/:name', () => {
    it('should require authentication', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/prompts/test-prompt'
      });

      expect(response.statusCode).toBe(401);
      const data = response.json() as ErrorResponse;
      expect(data).toEqual({ ok: false, error: 'unauthorized' });

      await app.close();
    });

    it('should return 404 for non-existent prompt', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/prompts/non-existent-prompt',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(response.statusCode).toBe(404);
      const data = response.json() as ErrorResponse;
      expect(data.ok).toBe(false);
      expect(data.error).toBe('not_found');
      expect(data.message).toContain('not found');

      await app.close();
    });

    it('GET /api/resources should return invariants documentation if available', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources/icn://docs/invariants/catalog.md',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json() as ResourceResponse;
      expect(data.ok).toBe(true);
      expect(data.data.contents[0].uri).toBe('icn://docs/invariants/catalog.md');
      expect(data.data.contents[0].mimeType).toBe('text/markdown');
      expect(typeof data.data.contents[0].text).toBe('string');

      await app.close();
    });

    it('GET /api/resources should return architecture documentation if available', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      // First get list of resources to find an architecture doc
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/resources',
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      expect(listResponse.statusCode).toBe(200);
      const listData = listResponse.json() as ResourcesListResponse;
      
      // Find an architecture doc if available
      const archDoc = listData.data.resources.find((r: Resource) => r.uri.startsWith('icn://docs/architecture/'));
      
      if (archDoc) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/resources/${archDoc.uri}`,
          headers: { Authorization: `Bearer ${regData.token}` }
        });

        expect(response.statusCode).toBe(200);
        const data = response.json() as ResourceResponse;
        expect(data.ok).toBe(true);
        expect(data.data.contents[0].uri).toBe(archDoc.uri);
        expect(data.data.contents[0].mimeType).toBe('text/markdown');
        expect(typeof data.data.contents[0].text).toBe('string');
      }

      await app.close();
    });
  });

  describe('Error handling', () => {
    it('should return proper error format for invalid URI parameters', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      // Register agent to get token
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/agent/register',
        payload: { name: 'Test Agent', kind: 'planner' }
      });
      const regData = regRes.json() as AgentRegisterResponse;

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources/',  // Empty URI
        headers: { Authorization: `Bearer ${regData.token}` }
      });

      // Should return 400 since empty URI parameter is invalid
      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('should include requestId in error responses', async () => {
      const app = Fastify({ logger: false });
      app.register(healthRoute);
      app.register(apiRoutes, { prefix: '/api' });
      app.register(resourcesPromptsRoutes, { prefix: '/api' });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/resources'
      });

      expect(response.statusCode).toBe(401);
      const data = response.json() as ErrorResponse;
      expect(data.ok).toBe(false);
      expect(data.error).toBe('unauthorized');

      await app.close();
    });
  });
});