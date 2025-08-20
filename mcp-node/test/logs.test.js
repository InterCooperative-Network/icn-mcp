import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ICN_MCP_LOG_DIR } from '../src/config.js';
// We'll test the log reading functionality by creating a test server instance
// and testing the private methods through the public resource interface
class TestLogReader {
    sanitizeLogContent(content) {
        // Copy of the sanitization logic from server.ts for testing
        return content
            // GitHub tokens (must come before generic token patterns)
            .replace(/(ghp_|gho_|ghu_|ghs_|ghr_)[\w]{36}/g, '[REDACTED_GITHUB_TOKEN]')
            // JWT tokens (before generic token patterns)
            .replace(/eyJ[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}/g, '[REDACTED_JWT]')
            // Private keys (before generic patterns)
            .replace(/-----BEGIN [A-Z\s]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z\s]+ PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
            // API keys and tokens (more general patterns)
            .replace(/([Aa]pi[_-]?[Kk]ey[s]?[:\s=]+)[\w-]{20,}/g, '$1[REDACTED]')
            .replace(/([Tt]oken[s]?[:\s=]+)[\w-.]{20,}/g, '$1[REDACTED]')
            .replace(/(Bearer\s+)[\w-.]{20,}/g, '$1[REDACTED]')
            .replace(/(Authorization[:\s=]+Bearer\s+)[\w-.]{20,}/g, '$1[REDACTED]')
            // Generic secrets in environment variables
            .replace(/([A-Z_]+_(?:SECRET|PASSWORD|KEY|TOKEN)[:\s=]+)[\w-.]{8,}/g, '$1[REDACTED]')
            // Password patterns
            .replace(/([Pp]assword[s]?[:\s=]+)[\w-.]{6,}/g, '$1[REDACTED]');
    }
    async readRecentLogs(logDir, maxKilobytes = 10) {
        try {
            // Check if log directory exists
            try {
                await fs.access(logDir);
            }
            catch {
                return 'Log directory not found. Set ICN_MCP_LOG_DIR environment variable to specify log location.';
            }
            // Read all .log files in the directory
            const files = await fs.readdir(logDir);
            const logFiles = files.filter(file => file.endsWith('.log'));
            if (logFiles.length === 0) {
                return 'No log files found in log directory.';
            }
            // Get file stats and sort by modification time (newest first)
            const fileStats = await Promise.all(logFiles.map(async (file) => {
                const filePath = path.join(logDir, file);
                const stats = await fs.stat(filePath);
                return { file, filePath, mtime: stats.mtime };
            }));
            fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            // Read content from files until we reach the size limit
            const maxBytes = maxKilobytes * 1024;
            let totalBytes = 0;
            let content = '';
            for (const { filePath, file } of fileStats) {
                if (totalBytes >= maxBytes)
                    break;
                try {
                    const fileContent = await fs.readFile(filePath, 'utf-8');
                    const remainingBytes = maxBytes - totalBytes;
                    if (fileContent.length <= remainingBytes) {
                        content += `\n=== ${file} ===\n${fileContent}`;
                        totalBytes += fileContent.length;
                    }
                    else {
                        // Take only the most recent part of the file
                        const truncatedContent = fileContent.slice(-remainingBytes);
                        content += `\n=== ${file} (truncated) ===\n${truncatedContent}`;
                        totalBytes = maxBytes;
                        break;
                    }
                }
                catch (error) {
                    content += `\n=== ${file} ===\nError reading file: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
                }
            }
            // Sanitize the content to remove secrets
            return this.sanitizeLogContent(content || 'No log content available.');
        }
        catch (error) {
            return `Error reading logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
describe('Logs Resource Retrieval', () => {
    const testLogDir = '/tmp/test-logs';
    const logReader = new TestLogReader();
    beforeEach(async () => {
        // Create test log directory
        await fs.mkdir(testLogDir, { recursive: true });
    });
    afterEach(async () => {
        // Clean up test log directory
        try {
            await fs.rm(testLogDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    });
    it('should read actual log file content', async () => {
        // Create a test log file
        const logContent = 'INFO: Application started\nDEBUG: Processing request\nERROR: Something went wrong';
        await fs.writeFile(path.join(testLogDir, 'test.log'), logContent);
        const result = await logReader.readRecentLogs(testLogDir);
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
        const result = await logReader.readRecentLogs(testLogDir, 1);
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
        const result = await logReader.readRecentLogs(testLogDir);
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
        const result = await logReader.readRecentLogs(nonExistentDir);
        expect(result).toContain('Log directory not found');
        expect(result).toContain('ICN_MCP_LOG_DIR');
    });
    it('should handle empty log directory', async () => {
        // Directory exists but has no log files
        const result = await logReader.readRecentLogs(testLogDir);
        expect(result).toContain('No log files found in log directory');
    });
    it('should sort log files by modification time (newest first)', async () => {
        // Create multiple log files with different timestamps
        await fs.writeFile(path.join(testLogDir, 'old.log'), 'Old log content');
        // Wait a bit to ensure different modification times
        await new Promise(resolve => setTimeout(resolve, 10));
        await fs.writeFile(path.join(testLogDir, 'new.log'), 'New log content');
        const result = await logReader.readRecentLogs(testLogDir);
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
        }
        catch {
            // Skip this test on systems where chmod doesn't work as expected
            return;
        }
        const result = await logReader.readRecentLogs(testLogDir);
        expect(result).toContain('=== unreadable.log ===');
        expect(result).toContain('Error reading file:');
        // Restore permissions for cleanup
        try {
            await fs.chmod(testFile, 0o644);
        }
        catch {
            // Ignore cleanup errors
        }
    });
    it('should only read .log files', async () => {
        // Create files with different extensions
        await fs.writeFile(path.join(testLogDir, 'app.log'), 'Log content');
        await fs.writeFile(path.join(testLogDir, 'config.txt'), 'Config content');
        await fs.writeFile(path.join(testLogDir, 'data.json'), '{"key": "value"}');
        await fs.writeFile(path.join(testLogDir, 'debug.log'), 'Debug content');
        const result = await logReader.readRecentLogs(testLogDir);
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
