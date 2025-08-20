import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Configuration for log reading operations
 */
export interface LogReaderConfig {
  /** Maximum size of log content to read in kilobytes */
  maxKilobytes: number;
}

/**
 * Default configuration for log reading
 */
export const DEFAULT_LOG_CONFIG: LogReaderConfig = {
  maxKilobytes: 10
};

/**
 * Sanitizes log content by redacting sensitive information such as API keys,
 * tokens, passwords, and private keys.
 * 
 * @param content - The raw log content to sanitize
 * @returns The sanitized content with sensitive information redacted
 */
export function sanitizeLogContent(content: string): string {
  // Redact common secret patterns - order matters: more specific patterns first
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

/**
 * Reads recent log files from the specified directory, applying size limits
 * and content sanitization.
 * 
 * @param logDir - Directory path containing log files
 * @param config - Configuration for log reading (optional)
 * @returns Promise resolving to sanitized log content string
 */
export async function readRecentLogs(
  logDir: string, 
  config: LogReaderConfig = DEFAULT_LOG_CONFIG
): Promise<string> {
  try {
    // Check if log directory exists
    try {
      await fs.access(logDir);
    } catch {
      return 'Log directory not found. Set ICN_MCP_LOG_DIR environment variable to specify log location.';
    }

    // Read all .log files in the directory
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    if (logFiles.length === 0) {
      return 'No log files found in log directory.';
    }

    // Get file stats and sort by modification time (newest first)
    const fileStats = await Promise.all(
      logFiles.map(async (file) => {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        return { file, filePath, mtime: stats.mtime };
      })
    );
    
    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Read content from files until we reach the size limit
    const maxBytes = config.maxKilobytes * 1024;
    let totalBytes = 0;
    let content = '';

    for (const { filePath, file } of fileStats) {
      if (totalBytes >= maxBytes) break;

      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const remainingBytes = maxBytes - totalBytes;
        
        if (fileContent.length <= remainingBytes) {
          content += `\n=== ${file} ===\n${fileContent}`;
          totalBytes += fileContent.length;
        } else {
          // Take only the most recent part of the file
          const truncatedContent = fileContent.slice(-remainingBytes);
          content += `\n=== ${file} (truncated) ===\n${truncatedContent}`;
          totalBytes = maxBytes;
          break;
        }
      } catch (error) {
        content += `\n=== ${file} ===\nError reading file: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
      }
    }

    // Sanitize the content to remove secrets
    return sanitizeLogContent(content || 'No log content available.');
    
  } catch (error) {
    return `Error reading logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}