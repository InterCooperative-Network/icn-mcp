import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCommitStatus, createPullRequestComment, createIssueComment } from '@/github';
import fs from 'node:fs';
import path from 'node:path';

describe('GitHub API integration', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Clear artifacts directory for clean tests
    const artifactsDir = path.resolve(process.cwd(), 'artifacts');
    if (fs.existsSync(artifactsDir)) {
      const files = fs.readdirSync(artifactsDir);
      for (const file of files) {
        if (file.startsWith('STATUS-') || file.startsWith('COMMENT-')) {
          fs.unlinkSync(path.join(artifactsDir, file));
        }
      }
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createCommitStatus', () => {
    it('creates local artifact when no GitHub token', async () => {
      delete process.env.GITHUB_TOKEN;
      
      const result = await createCommitStatus({
        sha: 'abc123def456',
        state: 'pending',
        context: 'icn-mcp/test',
        description: 'Test status'
      });
      
      expect(result.mode).toBe('local');
      if (result.mode === 'local') {
        expect(result.artifact).toMatch(/STATUS-\d+\.json$/);
        expect(fs.existsSync(result.artifact)).toBe(true);
        
        const content = JSON.parse(fs.readFileSync(result.artifact, 'utf8'));
        expect(content.sha).toBe('abc123def456');
        expect(content.state).toBe('pending');
        expect(content.context).toBe('icn-mcp/test');
      }
    });

    it('includes all status parameters in local artifact', async () => {
      delete process.env.GITHUB_TOKEN;
      
      const result = await createCommitStatus({
        sha: 'test-sha',
        state: 'success',
        context: 'icn-mcp/task-processing',
        description: 'Task completed successfully',
        target_url: 'https://example.com/task/123'
      });
      
      if (result.mode === 'local') {
        const content = JSON.parse(fs.readFileSync(result.artifact, 'utf8'));
        expect(content.target_url).toBe('https://example.com/task/123');
        expect(content.description).toBe('Task completed successfully');
      }
    });
  });

  describe('createPullRequestComment', () => {
    it('creates local artifact when no GitHub token', async () => {
      delete process.env.GITHUB_TOKEN;
      
      const result = await createPullRequestComment({
        pull_number: 123,
        body: 'Test PR comment'
      });
      
      expect(result.mode).toBe('local');
      if (result.mode === 'local') {
        expect(result.artifact).toMatch(/COMMENT-\d+\.json$/);
        expect(fs.existsSync(result.artifact)).toBe(true);
        
        const content = JSON.parse(fs.readFileSync(result.artifact, 'utf8'));
        expect(content.pull_number).toBe(123);
        expect(content.body).toBe('Test PR comment');
      }
    });
  });

  describe('createIssueComment', () => {
    it('creates local artifact when no GitHub token', async () => {
      delete process.env.GITHUB_TOKEN;
      
      const result = await createIssueComment({
        issue_number: 456,
        body: 'Test issue comment'
      });
      
      expect(result.mode).toBe('local');
      if (result.mode === 'local') {
        expect(result.artifact).toMatch(/COMMENT-\d+\.json$/);
        expect(fs.existsSync(result.artifact)).toBe(true);
        
        const content = JSON.parse(fs.readFileSync(result.artifact, 'utf8'));
        expect(content.issue_number).toBe(456);
        expect(content.body).toBe('Test issue comment');
      }
    });

    it('handles long comment bodies', async () => {
      delete process.env.GITHUB_TOKEN;
      
      const longBody = 'Test comment '.repeat(100);
      const result = await createIssueComment({
        issue_number: 789,
        body: longBody
      });
      
      if (result.mode === 'local') {
        const content = JSON.parse(fs.readFileSync(result.artifact, 'utf8'));
        expect(content.body).toBe(longBody);
      }
    });
  });
});