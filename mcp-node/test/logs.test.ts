import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ICN_MCP_LOG_DIR } from '../src/config.js';
import { readRecentLogs, sanitizeLogContent } from '../src/utils/logs.js';

describe('Logs Resource Retrieval', () => {
  const testLogDir = '/tmp/test-logs';

  beforeEach(async () => {
    // Create test log directory
    await fs.mkdir(testLogDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test log directory
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should read actual log file content', async () => {
    // Create a test log file
    const logContent = 'INFO: Application started\nDEBUG: Processing request\nERROR: Something went wrong';
    await fs.writeFile(path.join(testLogDir, 'test.log'), logContent);

    const result = await readRecentLogs(testLogDir);
    
    expect(result).toContain('=== test.log ===');
    expect(result).toContain('INFO: Application started');
    expect(result).toContain('DEBUG: Processing request');
    expect(result).toContain('ERROR: Something went wrong');
  });

  it('should respect size limits', async () => {
    // Create a large log file (2KB of content)
    const largeContent = 'A'.repeat(2048);
    await fs.writeFile(path.join(testLogDir, 'large.log'), largeContent);

    // Request only 1KB
    const result = await readRecentLogs(testLogDir, { maxKilobytes: 1 });
    
    // The result should be limited and show truncation
    expect(result).toContain('(truncated)');
    expect(result.length).toBeLessThan(2048 + 100); // Allow for metadata
  });

  it('should sanitize sensitive content', async () => {
    const sensitiveContent = `
INFO: Starting application
API_KEY=sk-1234567890abcdef1234567890abcdef12345678
Token: ghp_abcdef1234567890abcdef1234567890abcd
Password: mySecretPassword123
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef...
-----END RSA PRIVATE KEY-----
INFO: Application ready
    `;
    
    await fs.writeFile(path.join(testLogDir, 'sensitive.log'), sensitiveContent);

    const result = await readRecentLogs(testLogDir);
    
    // Verify sensitive content is redacted
    expect(result).not.toContain('sk-1234567890abcdef1234567890abcdef12345678');
    expect(result).not.toContain('ghp_abcdef1234567890abcdef1234567890abcd');
    expect(result).not.toContain('mySecretPassword123');
    expect(result).not.toContain('BEGIN RSA PRIVATE KEY');
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    
    // Verify redaction messages are present
    expect(result).toContain('[REDACTED]');
    expect(result).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(result).toContain('[REDACTED_PRIVATE_KEY]');
    expect(result).toContain('[REDACTED_JWT]');
    
    // Verify non-sensitive content is preserved
    expect(result).toContain('INFO: Starting application');
    expect(result).toContain('INFO: Application ready');
  });

  it('should handle missing log directory', async () => {
    const nonExistentDir = '/tmp/non-existent-logs';
    
    const result = await readRecentLogs(nonExistentDir);
    
    expect(result).toContain('Log directory not found');
    expect(result).toContain('ICN_MCP_LOG_DIR');
  });

  it('should handle empty log directory', async () => {
    // Directory exists but has no log files
    const result = await readRecentLogs(testLogDir);
    
    expect(result).toContain('No log files found in log directory');
  });

  it('should sort log files by modification time (newest first)', async () => {
    // Create multiple log files with different timestamps using fs.utimes
    const oldLogPath = path.join(testLogDir, 'old.log');
    const newLogPath = path.join(testLogDir, 'new.log');
    
    await fs.writeFile(oldLogPath, 'Old log content');
    await fs.writeFile(newLogPath, 'New log content');
    
    // Set explicit modification times (old file: 1 hour ago, new file: now)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    await fs.utimes(oldLogPath, now, oneHourAgo); // (access time, modified time)
    await fs.utimes(newLogPath, now, now);

    const result = await readRecentLogs(testLogDir);
    
    // The newer file should appear first in the output
    const newLogIndex = result.indexOf('=== new.log ===');
    const oldLogIndex = result.indexOf('=== old.log ===');
    
    expect(newLogIndex).toBeGreaterThan(-1);
    expect(oldLogIndex).toBeGreaterThan(-1);
    expect(newLogIndex).toBeLessThan(oldLogIndex);
  });

  it('should handle file read errors gracefully', async () => {
    // Create a file and then make it unreadable
    const testFile = path.join(testLogDir, 'unreadable.log');
    await fs.writeFile(testFile, 'Content');
    
    // Change permissions to make it unreadable (on Unix systems)
    try {
      await fs.chmod(testFile, 0o000);
    } catch {
      // Skip this test on systems where chmod doesn't work as expected
      return;
    }

    const result = await readRecentLogs(testLogDir);
    
    expect(result).toContain('=== unreadable.log ===');
    expect(result).toContain('Error reading file:');
    
    // Restore permissions for cleanup
    try {
      await fs.chmod(testFile, 0o644);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should only read .log files', async () => {
    // Create files with different extensions
    await fs.writeFile(path.join(testLogDir, 'app.log'), 'Log content');
    await fs.writeFile(path.join(testLogDir, 'config.txt'), 'Config content');
    await fs.writeFile(path.join(testLogDir, 'data.json'), '{"key": "value"}');
    await fs.writeFile(path.join(testLogDir, 'debug.log'), 'Debug content');

    const result = await readRecentLogs(testLogDir);
    
    // Should contain .log files
    expect(result).toContain('=== app.log ===');
    expect(result).toContain('=== debug.log ===');
    expect(result).toContain('Log content');
    expect(result).toContain('Debug content');
    
    // Should not contain non-.log files
    expect(result).not.toContain('config.txt');
    expect(result).not.toContain('data.json');
    expect(result).not.toContain('Config content');
    expect(result).not.toContain('{"key": "value"}');
  });

  it('should use default log directory configuration', () => {
    // Test that ICN_MCP_LOG_DIR is properly configured
    expect(ICN_MCP_LOG_DIR).toBeDefined();
    expect(typeof ICN_MCP_LOG_DIR).toBe('string');
    expect(ICN_MCP_LOG_DIR).toContain('var/logs');
  });
});

describe('Log Content Sanitization', () => {
  const testCases = [
    {
      name: 'GitHub Personal Access Token',
      input: 'Auth token: ghp_1234567890abcdef1234567890abcdef123456',
      expected: '[REDACTED_GITHUB_TOKEN]',
      shouldNotContain: 'ghp_1234567890abcdef1234567890abcdef123456'
    },
    {
      name: 'GitHub OAuth Token',
      input: 'OAuth: gho_1234567890abcdef1234567890abcdef123456',
      expected: '[REDACTED_GITHUB_TOKEN]',
      shouldNotContain: 'gho_1234567890abcdef1234567890abcdef123456'
    },
    {
      name: 'JWT Token',
      input: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      expected: '[REDACTED_JWT]',
      shouldNotContain: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
    },
    {
      name: 'RSA Private Key',
      input: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234567890abcdef...\n-----END RSA PRIVATE KEY-----',
      expected: '[REDACTED_PRIVATE_KEY]',
      shouldNotContain: 'BEGIN RSA PRIVATE KEY'
    },
    {
      name: 'API Key Pattern',
      input: 'API_KEY=sk-1234567890abcdef1234567890abcdef12345678',
      expected: '[REDACTED]',
      shouldNotContain: 'sk-1234567890abcdef1234567890abcdef12345678'
    },
    {
      name: 'Password Pattern',
      input: 'Password: mySecretPassword123',
      expected: '[REDACTED]',
      shouldNotContain: 'mySecretPassword123'
    },
    {
      name: 'Environment Variable Secret',
      input: 'DATABASE_PASSWORD=super_secret_password',
      expected: '[REDACTED]',
      shouldNotContain: 'super_secret_password'
    },
    {
      name: 'Bearer Token',
      input: 'Authorization: Bearer abc123def456ghi789jkl012mno345pqr678',
      expected: '[REDACTED]',
      shouldNotContain: 'abc123def456ghi789jkl012mno345pqr678'
    }
  ];

  testCases.forEach(({ name, input, expected, shouldNotContain }) => {
    it(`should redact ${name}`, () => {
      const sanitized = sanitizeLogContent(input);
      
      expect(sanitized).toContain(expected);
      expect(sanitized).not.toContain(shouldNotContain);
    });
  });

  it('should preserve non-sensitive content', () => {
    const input = 'INFO: Application started successfully\nDEBUG: Processing request\nERROR: File not found';
    const sanitized = sanitizeLogContent(input);
    
    expect(sanitized).toBe(input); // Should be unchanged
    expect(sanitized).toContain('INFO: Application started successfully');
    expect(sanitized).toContain('DEBUG: Processing request');
    expect(sanitized).toContain('ERROR: File not found');
  });

  it('should handle multiple secrets in the same content', () => {
    const input = `
Application logs:
API_KEY=sk-abcdef1234567890abcdef1234567890abcdef12
Token: ghp_1234567890abcdef1234567890abcdef123456
Password: mySecretPassword123
JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
Application ready.
    `;
    
    const sanitized = sanitizeLogContent(input);
    
    // All secrets should be redacted
    expect(sanitized).not.toContain('sk-abcdef1234567890abcdef1234567890abcdef12');
    expect(sanitized).not.toContain('ghp_1234567890abcdef1234567890abcdef123456');
    expect(sanitized).not.toContain('mySecretPassword123');
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    
    // Redaction markers should be present
    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(sanitized).toContain('[REDACTED_JWT]');
    
    // Non-sensitive content should be preserved
    expect(sanitized).toContain('Application logs:');
    expect(sanitized).toContain('Application ready.');
  });
});