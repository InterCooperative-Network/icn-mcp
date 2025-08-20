import fs from 'node:fs/promises';
import path from 'node:path';

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

/**
 * Service for managing MCP resources like documentation, policy, and CODEOWNERS
 */
export class ResourceService {
  private repoRoot: string;
  private docsRoot: string;
  private policyRulesPath: string;

  constructor() {
    this.repoRoot = this.getRepoRoot();
    this.docsRoot = this.getDocsRoot();
    this.policyRulesPath = this.getPolicyRulesPath();
  }

  private getRepoRoot(): string {
    if (process.env.REPO_ROOT) {
      return process.env.REPO_ROOT;
    }
    
    // Try to find the repo root by looking for package.json or .git
    let current = process.cwd();
    
    while (current !== path.dirname(current)) {
      try {
        const packageJson = path.join(current, 'package.json');
        const gitDir = path.join(current, '.git');
        
        // Use fs.accessSync to check existence
        try {
          const fs = require('node:fs');
          fs.accessSync(packageJson);
          // Check if this is the root package.json (has workspaces)
          const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
          if (pkg.workspaces) {
            return current;
          }
        } catch {
          try {
            const fs = require('node:fs');
            fs.accessSync(gitDir);
            return current;
          } catch {
            // Continue searching if neither exists
          }
        }
      } catch {
        // Continue searching
      }
      current = path.dirname(current);
    }
    
    // Fallback to current working directory
    return process.cwd();
  }

  private getDocsRoot(): string {
    return process.env.DOCS_ROOT || path.join(this.getRepoRoot(), 'docs');
  }

  private getPolicyRulesPath(): string {
    return process.env.POLICY_RULES_PATH || path.join(this.getRepoRoot(), 'mcp-server', 'policy.rules.json');
  }

  /**
   * List all available resources
   */
  async listResources(): Promise<Resource[]> {
    const resources: Resource[] = [];
    
    try {
      // Add documentation resources
      const docsRoot = this.docsRoot;
      
      // Architecture documentation
      const archDir = path.join(docsRoot, 'architecture');
      try {
        const archFiles = await fs.readdir(archDir);
        for (const file of archFiles) {
          if (file.endsWith('.md')) {
            resources.push({
              uri: `icn://docs/architecture/${file}`,
              name: `Architecture: ${file}`,
              description: `ICN architecture documentation from ${file}`,
              mimeType: 'text/markdown'
            });
          }
        }
      } catch {
        // Directory might not exist, continue
      }

      // Invariants documentation
      const invariantsDir = path.join(docsRoot, 'invariants');
      try {
        const invFiles = await fs.readdir(invariantsDir);
        for (const file of invFiles) {
          if (file.endsWith('.md')) {
            resources.push({
              uri: `icn://docs/invariants/${file}`,
              name: `Invariants: ${file}`,
              description: `ICN system invariants from ${file}`,
              mimeType: 'text/markdown'
            });
          }
        }
      } catch {
        // Directory might not exist, continue
      }

      // Policy documentation
      const policyDir = path.join(docsRoot, 'policy');
      try {
        const policyFiles = await fs.readdir(policyDir);
        for (const file of policyFiles) {
          if (file.endsWith('.md')) {
            resources.push({
              uri: `icn://docs/policy/${file}`,
              name: `Policy: ${file}`,
              description: `ICN policy documentation from ${file}`,
              mimeType: 'text/markdown'
            });
          }
        }
      } catch {
        // Directory might not exist, continue
      }

      // API documentation
      const apiDir = path.join(docsRoot, 'api');
      try {
        const apiFiles = await fs.readdir(apiDir);
        for (const file of apiFiles) {
          if (file.endsWith('.md')) {
            resources.push({
              uri: `icn://docs/api/${file}`,
              name: `API: ${file}`,
              description: `ICN API documentation from ${file}`,
              mimeType: 'text/markdown'
            });
          }
        }
      } catch {
        // Directory might not exist, continue
      }

      // Protocol documentation
      const protocolDir = path.join(docsRoot, 'protocol');
      try {
        const protocolFiles = await fs.readdir(protocolDir);
        for (const file of protocolFiles) {
          if (file.endsWith('.md')) {
            resources.push({
              uri: `icn://docs/protocol/${file}`,
              name: `Protocol: ${file}`,
              description: `ICN protocol documentation from ${file}`,
              mimeType: 'text/markdown'
            });
          }
        }
      } catch {
        // Directory might not exist, continue
      }

      // Policy rules JSON
      try {
        await fs.access(this.policyRulesPath);
        resources.push({
          uri: `icn://policy/rules.json`,
          name: 'Policy Rules',
          description: 'ICN policy engine rules and configuration',
          mimeType: 'application/json'
        });
      } catch {
        // File might not exist, continue
      }

      // CODEOWNERS file
      try {
        const codeownersPath = path.join(this.repoRoot, 'CODEOWNERS');
        await fs.access(codeownersPath);
        resources.push({
          uri: `icn://CODEOWNERS`,
          name: 'CODEOWNERS',
          description: 'GitHub CODEOWNERS file specifying code ownership and review requirements',
          mimeType: 'text/plain'
        });
      } catch {
        // File might not exist, continue
      }

      // Recent logs
      resources.push({
        uri: `icn://logs/recent`,
        name: 'Recent Logs',
        description: 'Recent system and task execution logs for debugging',
        mimeType: 'text/plain'
      });

    } catch (error) {
      console.error('[Resource Service] Error listing resources:', error);
    }

    return resources;
  }

  /**
   * Read a specific resource by URI
   */
  async readResource(uri: string): Promise<ResourceContent[]> {
    try {
      if (uri.startsWith('icn://docs/architecture/')) {
        const filename = uri.replace('icn://docs/architecture/', '');
        const filePath = path.join(this.docsRoot, 'architecture', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }];
      }

      if (uri.startsWith('icn://docs/invariants/')) {
        const filename = uri.replace('icn://docs/invariants/', '');
        const filePath = path.join(this.docsRoot, 'invariants', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }];
      }

      if (uri.startsWith('icn://docs/policy/')) {
        const filename = uri.replace('icn://docs/policy/', '');
        const filePath = path.join(this.docsRoot, 'policy', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }];
      }

      if (uri.startsWith('icn://docs/api/')) {
        const filename = uri.replace('icn://docs/api/', '');
        const filePath = path.join(this.docsRoot, 'api', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }];
      }

      if (uri.startsWith('icn://docs/protocol/')) {
        const filename = uri.replace('icn://docs/protocol/', '');
        const filePath = path.join(this.docsRoot, 'protocol', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }];
      }

      if (uri === 'icn://policy/rules.json') {
        const content = await fs.readFile(this.policyRulesPath, 'utf-8');
        return [{
          uri,
          mimeType: 'application/json',
          text: content
        }];
      }

      if (uri === 'icn://CODEOWNERS') {
        const codeownersPath = path.join(this.repoRoot, 'CODEOWNERS');
        const content = await fs.readFile(codeownersPath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/plain',
          text: content
        }];
      }

      if (uri === 'icn://logs/recent') {
        const { readRecentLogs } = await import('../utils/logs.js');
        const { ICN_MCP_LOG_DIR, ICN_MCP_LOG_MAX_KB } = await import('../config.js');
        const logs = await readRecentLogs(ICN_MCP_LOG_DIR, { maxKilobytes: ICN_MCP_LOG_MAX_KB });
        return [{
          uri,
          mimeType: 'text/plain',
          text: logs
        }];
      }

      throw new Error(`Resource not found: ${uri}`);

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [{
        uri,
        mimeType: 'text/plain',
        text: `Error reading resource: ${errorMessage}`
      }];
    }
  }
}